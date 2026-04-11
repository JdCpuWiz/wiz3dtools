#!/usr/bin/env python3
"""
Bambu Monitor — MQTT listener for Bambu P1S printers.

Connects to each printer's local MQTT broker, tracks real-time print state,
and creates filament_jobs in wiz3dtools when a print finishes.
"""

from __future__ import annotations

import json
import logging
import os
import socket
import ssl
import struct
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx
import paho.mqtt.client as mqtt
from flask import Flask, jsonify

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("bambu-monitor")
logging.getLogger("paho").setLevel(logging.WARNING)

# ── Config ─────────────────────────────────────────────────────────────────────

WIZ3DTOOLS_URL   = os.getenv("WIZ3DTOOLS_URL", "http://backend:3000").rstrip("/")
SERVICE_TOKEN    = os.getenv("MCP_SERVICE_TOKEN", "")
MONITOR_PORT     = int(os.getenv("MONITOR_PORT", "8015"))
CONFIG_RELOAD_S  = int(os.getenv("CONFIG_RELOAD_S", "300"))  # re-fetch printer configs every 5min

BAMBU_CAMERA_PORT = 6000

BAMBU_MQTT_PORT  = 8883
BAMBU_USERNAME   = "bblp"

# Minimum remain delta to consider a slot was used during the print
REMAIN_DELTA_THRESHOLD = 0.5  # %


def _api_headers() -> dict:
    return {"Authorization": f"Bearer {SERVICE_TOKEN}"}


# ── State ──────────────────────────────────────────────────────────────────────

@dataclass
class AmsSlotState:
    ams_id: int
    tray_id: int
    remain: float | None = None
    tray_color: str | None = None
    tray_type: str | None = None
    tray_sub_brands: str | None = None


@dataclass
class PrinterState:
    printer_id: int
    printer_name: str
    serial: str
    ip: str
    access_code: str
    connected: bool = False
    gcode_state: str | None = None
    mc_percent: float | None = None
    mc_remaining_time: int | None = None
    layer_num: int | None = None
    total_layer_num: int | None = None
    subtask_name: str | None = None
    nozzle_temper: float | None = None
    bed_temper: float | None = None
    chamber_temper: float | None = None
    spd_mag: int | None = None
    ams_slots: list[AmsSlotState] = field(default_factory=list)
    # Snapshots for filament tracking
    _ams_snapshot: dict[str, float] = field(default_factory=dict)  # "ams.tray" → remain%
    _prev_gcode_state: str | None = None
    last_updated: str | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def snapshot_key(self, ams_id: int, tray_id: int) -> str:
        return f"{ams_id}.{tray_id}"

    def take_ams_snapshot(self):
        with self._lock:
            self._ams_snapshot = {
                self.snapshot_key(s.ams_id, s.tray_id): s.remain
                for s in self.ams_slots
                if s.remain is not None
            }

    def get_used_slots(self) -> list[tuple[AmsSlotState, float, float]]:
        """Return slots where remain dropped by more than threshold. (slot, start%, end%)"""
        used = []
        for slot in self.ams_slots:
            key = self.snapshot_key(slot.ams_id, slot.tray_id)
            start = self._ams_snapshot.get(key)
            end = slot.remain
            if start is not None and end is not None:
                delta = start - end
                if delta >= REMAIN_DELTA_THRESHOLD:
                    used.append((slot, start, end))
        return used

    def to_dict(self) -> dict:
        with self._lock:
            return {
                "printerId": self.printer_id,
                "printerName": self.printer_name,
                "serial": self.serial,
                "connected": self.connected,
                "gcodeState": self.gcode_state,
                "mcPercent": self.mc_percent,
                "mcRemainingTime": self.mc_remaining_time,
                "layerNum": self.layer_num,
                "totalLayerNum": self.total_layer_num,
                "subtaskName": self.subtask_name,
                "nozzleTemper": self.nozzle_temper,
                "bedTemper": self.bed_temper,
                "chamberTemper": self.chamber_temper,
                "spdMag": self.spd_mag,
                "amsSlots": [
                    {
                        "amsId": s.ams_id,
                        "trayId": s.tray_id,
                        "remain": s.remain,
                        "trayColor": s.tray_color,
                        "trayType": s.tray_type,
                        "traySubBrands": s.tray_sub_brands,
                    }
                    for s in self.ams_slots
                ],
                "lastUpdated": self.last_updated,
            }


# ── Wiz3dtools helpers ─────────────────────────────────────────────────────────

def fetch_printer_configs() -> list[dict]:
    """Fetch active printer configs (including access codes) from wiz3dtools."""
    try:
        r = httpx.get(
            f"{WIZ3DTOOLS_URL}/api/printers/config",
            headers=_api_headers(),
            timeout=10,
        )
        r.raise_for_status()
        data = r.json().get("data", [])
        # Only return printers with Bambu config set
        return [p for p in data if p.get("ipAddress") and p.get("serialNumber") and p.get("accessCode")]
    except Exception as e:
        logger.error(f"Failed to fetch printer configs: {e}")
        return []


def fetch_colors() -> list[dict]:
    """Fetch all active colors from wiz3dtools for hex matching."""
    try:
        r = httpx.get(
            f"{WIZ3DTOOLS_URL}/api/colors",
            headers=_api_headers(),
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("data", [])
    except Exception as e:
        logger.error(f"Failed to fetch colors: {e}")
        return []


def match_color_by_hex(ams_hex: str | None, colors: list[dict]) -> dict | None:
    """Try to match an AMS RFID hex to a color in the catalog.

    AMS hex is RRGGBBAA (8 chars). Our catalog stores #RRGGBB (6 chars).
    Compare first 6 chars (ignore alpha).
    """
    if not ams_hex or len(ams_hex) < 6:
        return None
    search = ams_hex[:6].upper()
    for c in colors:
        catalog_hex = c.get("hex", "").lstrip("#").upper()
        if catalog_hex == search:
            return c
    return None


def create_filament_job(
    printer_id: int,
    job_name: str | None,
    slot: AmsSlotState,
    remain_start: float,
    remain_end: float,
    color_id: int | None,
    status: str,
    filament_grams: float | None = None,
) -> None:
    slot_id = f"{slot.ams_id}.{slot.tray_id}"
    payload = {
        "printerId": printer_id,
        "jobName": job_name,
        "amsSlotId": slot_id,
        "amsColorHex": slot.tray_color,
        "amsMaterial": slot.tray_type,
        "remainStart": remain_start,
        "remainEnd": remain_end,
        "filamentGrams": filament_grams,
        "colorId": color_id,
        "status": status,
    }
    try:
        r = httpx.post(
            f"{WIZ3DTOOLS_URL}/api/filament-jobs",
            headers={**_api_headers(), "Content-Type": "application/json"},
            json=payload,
            timeout=10,
        )
        r.raise_for_status()
        logger.info(f"Created filament job [{status}] for slot {slot_id} ({slot.tray_type} {slot.tray_color})")
    except Exception as e:
        logger.error(f"Failed to create filament job: {e}")


def process_print_finish(state: PrinterState, colors: list[dict]) -> None:
    """On print FINISH: calculate which slots were used, create filament jobs."""
    used_slots = state.get_used_slots()
    if not used_slots:
        logger.info(f"[{state.printer_name}] Print finished but no significant filament change detected.")
        return

    for slot, remain_start, remain_end in used_slots:
        matched_color = match_color_by_hex(slot.tray_color, colors)

        if matched_color:
            # Auto-resolve: POST job with status=auto_resolved — backend deducts inventory automatically
            mfg = matched_color.get("manufacturer") or {}
            full_net = float(mfg.get("fullSpoolNetWeightG") or 1000)
            grams = round((remain_start - remain_end) / 100.0 * full_net, 2)

            create_filament_job(
                printer_id=state.printer_id,
                job_name=state.subtask_name,
                slot=slot,
                remain_start=remain_start,
                remain_end=remain_end,
                color_id=matched_color["id"],
                status="auto_resolved",
                filament_grams=grams,
            )

        else:
            # No match — create pending job for manual attribution
            create_filament_job(
                printer_id=state.printer_id,
                job_name=state.subtask_name,
                slot=slot,
                remain_start=remain_start,
                remain_end=remain_end,
                color_id=None,
                status="pending",
                filament_grams=None,
            )
            logger.info(
                f"[{state.printer_name}] No color match for {slot.tray_color} ({slot.tray_type}) "
                f"— created pending filament job."
            )


# ── Bambu camera (port 6000) ───────────────────────────────────────────────────

def get_camera_jpeg(ip: str, access_code: str, timeout: float = 5.0) -> bytes | None:
    """
    Connect to a Bambu printer's camera service on port 6000, authenticate,
    and return one JPEG frame.  Same protocol used by the HA Bambu integration.
    """
    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.set_ciphers('ALL:@SECLEVEL=0')

        logger.info(f"Camera {ip}: opening TCP connection to port {BAMBU_CAMERA_PORT}...")
        raw = socket.create_connection((ip, BAMBU_CAMERA_PORT), timeout=timeout)
        raw.settimeout(timeout)  # must be set before wrap_socket for TLS handshake timeout
        logger.info(f"Camera {ip}: TCP connected, starting TLS handshake...")
        ssl_sock = ctx.wrap_socket(raw)
        ssl_sock.settimeout(timeout)
        logger.info(f"Camera {ip}: TLS OK, cipher={ssl_sock.cipher()}, sending auth...")

        # 80-byte auth packet:
        #   bytes  0-3  : 0x40 0x00 0x00 0x00
        #   bytes  4-7  : 0x03 0x00 0x00 0x00
        #   bytes  8-15 : padding (zeros)
        #   bytes 16-47 : username "bblp", null-padded to 32 bytes
        #   bytes 48-79 : access_code, null-padded to 32 bytes
        auth = bytearray(80)
        auth[0:4] = b'\x40\x00\x00\x00'
        auth[4:8] = b'\x03\x00\x00\x00'
        username = b'bblp'
        auth[16:16 + len(username)] = username
        code_bytes = access_code.encode()[:32]
        auth[48:48 + len(code_bytes)] = code_bytes
        ssl_sock.sendall(bytes(auth))
        logger.info(f"Camera {ip}: auth sent, reading stream...")

        # Read the stream until we have one complete JPEG (FF D8 … FF D9)
        buf       = bytearray()
        start_idx = -1
        deadline  = time.monotonic() + timeout

        while time.monotonic() < deadline:
            try:
                chunk = ssl_sock.recv(8192)
            except (ssl.SSLError, OSError, socket.timeout) as e:
                logger.info(f"Camera {ip}: recv error after {len(buf)} bytes — {e}")
                break
            if not chunk:
                logger.info(f"Camera {ip}: connection closed by printer after {len(buf)} bytes")
                break
            buf.extend(chunk)
            logger.debug(f"Camera {ip}: {len(buf)} bytes, first 8: {bytes(buf[:8]).hex()}")

            if start_idx == -1:
                idx = bytes(buf).find(b'\xff\xd8\xff')
                if idx >= 0:
                    start_idx = idx
                    logger.info(f"Camera {ip}: JPEG start found at offset {idx}")

            if start_idx >= 0:
                end_idx = bytes(buf).find(b'\xff\xd9', start_idx + 2)
                if end_idx >= 0:
                    frame = bytes(buf[start_idx:end_idx + 2])
                    logger.info(f"Camera {ip}: JPEG frame complete, {len(frame)} bytes")
                    return frame

        logger.info(f"Camera {ip}: timeout — {len(buf)} bytes received, start_idx={start_idx}")

    except Exception as e:
        logger.warning(f"Camera {ip}: error — {type(e).__name__}: {e}")
    return None


# ── MQTT Client ────────────────────────────────────────────────────────────────

class BambuPrinterClient:
    def __init__(self, state: PrinterState):
        self.state = state
        self._colors: list[dict] = []
        self._client: mqtt.Client | None = None
        self._stop = False

    def start(self):
        self._stop = False
        self._connect()

    def stop(self):
        self._stop = True
        self._cleanup_client()

    def refresh_colors(self, colors: list[dict]):
        self._colors = colors

    def _cleanup_client(self):
        """Stop and discard the existing MQTT client cleanly."""
        client = self._client
        self._client = None
        if client:
            try:
                client.loop_stop()
            except Exception:
                pass
            try:
                client.disconnect()
            except Exception:
                pass

    def _connect(self):
        if self._stop:
            return

        # Always clean up any previous client before creating a new one so
        # stale loop_start() threads don't accumulate.
        self._cleanup_client()

        client = mqtt.Client(client_id="", clean_session=True, protocol=mqtt.MQTTv311)
        client.username_pw_set(BAMBU_USERNAME, self.state.access_code)

        tls_ctx = ssl.create_default_context()
        tls_ctx.check_hostname = False
        tls_ctx.verify_mode = ssl.CERT_NONE
        client.tls_set_context(tls_ctx)

        # Delegate all reconnect logic to paho's built-in loop_start() mechanism.
        # min_delay=5 so the first retry waits 5s; doubles each attempt up to 120s.
        # This avoids fighting with our own manual reconnect thread.
        client.reconnect_delay_set(min_delay=5, max_delay=120)

        client.on_connect    = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message    = self._on_message

        try:
            # keepalive=30 sends pings every 30s; detects dead connections faster than 60s
            client.connect(self.state.ip, BAMBU_MQTT_PORT, keepalive=30)
            self._client = client
            client.loop_start()
            logger.info(f"[{self.state.printer_name}] Connecting to {self.state.ip}:{BAMBU_MQTT_PORT} (serial={self.state.serial})")
        except Exception as e:
            # connect() itself threw (e.g. DNS failure, network unreachable).
            # loop hasn't started yet so paho can't retry — schedule manually.
            logger.error(f"[{self.state.printer_name}] Connection failed: {e}")
            if not self._stop:
                t = threading.Timer(10, self._connect)
                t.daemon = True
                t.start()

    def _on_connect(self, client, userdata, flags, rc):
        _rc_desc = {
            0: "accepted",
            1: "refused — bad protocol version",
            2: "refused — client ID rejected",
            3: "refused — server unavailable",
            4: "refused — bad username/password",
            5: "refused — not authorised",
        }
        if rc == 0:
            self.state.connected = True
            topic = f"device/{self.state.serial}/report"
            result, _ = client.subscribe(topic)
            logger.info(
                f"[{self.state.printer_name}] Connected (session_present={flags.get('session present', 0)}), "
                f"subscribed to {topic} (result={result})"
            )
        else:
            logger.error(
                f"[{self.state.printer_name}] MQTT connect refused rc={rc}: "
                f"{_rc_desc.get(rc, 'unknown')} — paho will retry"
            )

    def _on_disconnect(self, client, userdata, rc):
        self.state.connected = False
        if rc == 0:
            logger.info(f"[{self.state.printer_name}] Disconnected cleanly")
        else:
            logger.warning(
                f"[{self.state.printer_name}] Disconnected unexpectedly rc={rc} "
                f"(MQTT_ERR_CONN_LOST) — paho will reconnect with backoff"
            )

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8", errors="replace"))
            print_data = payload.get("print", {})
            if not print_data:
                return
            self._handle_print_status(print_data)
        except Exception as e:
            logger.debug(f"[{self.state.printer_name}] Message parse error: {e}")

    def _handle_print_status(self, data: dict):
        prev_state = self.state.gcode_state
        new_state  = data.get("gcode_state")

        with self.state._lock:
            if "mc_percent"        in data: self.state.mc_percent        = data["mc_percent"]
            if "mc_remaining_time" in data: self.state.mc_remaining_time = data["mc_remaining_time"]
            if "layer_num"         in data: self.state.layer_num         = data["layer_num"]
            if "total_layer_num"   in data: self.state.total_layer_num   = data["total_layer_num"]
            if "subtask_name"      in data: self.state.subtask_name      = data["subtask_name"]
            if "nozzle_temper"     in data: self.state.nozzle_temper     = data["nozzle_temper"]
            if "bed_temper"        in data: self.state.bed_temper        = data["bed_temper"]
            if "chamber_temper"    in data: self.state.chamber_temper    = data["chamber_temper"]
            if "spd_mag"           in data: self.state.spd_mag           = data["spd_mag"]
            if new_state:                   self.state.gcode_state       = new_state

            # Parse AMS data
            ams_root = data.get("ams", {})
            if ams_root and "ams" in ams_root:
                new_slots: list[AmsSlotState] = []
                for ams_unit in ams_root["ams"]:
                    ams_id = int(ams_unit.get("id", 0))
                    for tray in ams_unit.get("tray", []):
                        tray_id = int(tray.get("id", 0))
                        remain = tray.get("remain")
                        slot = AmsSlotState(
                            ams_id=ams_id,
                            tray_id=tray_id,
                            remain=float(remain) if remain is not None else None,
                            tray_color=tray.get("tray_color"),
                            tray_type=tray.get("tray_type"),
                            tray_sub_brands=tray.get("tray_sub_brands"),
                        )
                        new_slots.append(slot)
                self.state.ams_slots = new_slots

            self.state.last_updated = datetime.now(timezone.utc).isoformat()

        # State transition handling (outside lock to avoid deadlock)
        if new_state and new_state != prev_state:
            self._handle_state_transition(prev_state, new_state)

    def _handle_state_transition(self, prev: str | None, new: str):
        logger.info(f"[{self.state.printer_name}] State: {prev} → {new}")

        if new == "RUNNING" and prev in (None, "IDLE", "FINISH", "FAILED"):
            # Print started — snapshot AMS remain
            self.state.take_ams_snapshot()
            logger.info(f"[{self.state.printer_name}] Print started, AMS snapshot taken.")

        elif new == "FINISH":
            logger.info(f"[{self.state.printer_name}] Print finished: {self.state.subtask_name}")
            process_print_finish(self.state, self._colors)


# ── Monitor Manager ────────────────────────────────────────────────────────────

class BambuMonitor:
    def __init__(self):
        self.clients: dict[str, BambuPrinterClient] = {}  # serial → client
        self.states:  dict[str, PrinterState]        = {}  # serial → state
        self._lock = threading.Lock()

    def load_and_sync(self):
        """Fetch printer configs and reconnect any new/changed printers."""
        configs = fetch_printer_configs()
        colors  = fetch_colors()

        current_serials = set()
        for cfg in configs:
            serial = cfg["serialNumber"]
            current_serials.add(serial)

            with self._lock:
                if serial in self.clients:
                    # Refresh color cache on existing client
                    self.clients[serial].refresh_colors(colors)
                else:
                    state = PrinterState(
                        printer_id=cfg["id"],
                        printer_name=cfg["name"],
                        serial=serial,
                        ip=cfg["ipAddress"],
                        access_code=cfg["accessCode"],
                    )
                    client = BambuPrinterClient(state)
                    client.refresh_colors(colors)
                    self.clients[serial] = client
                    self.states[serial]  = state
                    client.start()
                    logger.info(f"Started client for printer '{cfg['name']}' ({serial})")

        # Stop clients for removed printers
        with self._lock:
            removed = set(self.clients) - current_serials
            for serial in removed:
                logger.info(f"Stopping client for removed serial {serial}")
                self.clients[serial].stop()
                del self.clients[serial]
                del self.states[serial]


    def get_all_status(self) -> list[dict]:
        with self._lock:
            return [s.to_dict() for s in self.states.values()]

    def run_config_reloader(self):
        """Periodically reload printer configs (picks up adds/edits/deletes from UI)."""
        while True:
            time.sleep(CONFIG_RELOAD_S)
            logger.info("Reloading printer configs...")
            self.load_and_sync()


monitor = BambuMonitor()

# ── Flask REST API ─────────────────────────────────────────────────────────────

app = Flask(__name__)


@app.route("/status")
def status():
    return jsonify({"success": True, "data": monitor.get_all_status()})


@app.route("/health")
def health():
    connected = sum(1 for s in monitor.states.values() if s.connected)
    total     = len(monitor.states)
    return jsonify({"status": "ok", "connected": connected, "total": total})


@app.route("/camera/<serial>")
def camera_frame(serial: str):
    """Return a single JPEG frame from the printer camera (port 6000 protocol)."""
    state = monitor.states.get(serial)
    if not state:
        return jsonify({"error": "Printer not found"}), 404

    jpeg = get_camera_jpeg(state.ip, state.access_code, timeout=5.0)
    if jpeg is None:
        return jsonify({"error": "Could not get frame"}), 502

    from flask import Response
    return Response(jpeg, mimetype="image/jpeg", headers={"Cache-Control": "no-cache, no-store"})


@app.route("/reload", methods=["POST"])
def reload():
    """Immediately reload printer configs — called by wiz3dtools after any printer add/update/delete."""
    logger.info("Config reload triggered via API")
    monitor.load_and_sync()
    connected = sum(1 for s in monitor.states.values() if s.connected)
    return jsonify({"status": "ok", "printers": len(monitor.states), "connected": connected})


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("Bambu Monitor starting...")

    # Initial load — retry until wiz3dtools is ready
    for attempt in range(10):
        configs = fetch_printer_configs()
        if configs or attempt >= 5:
            break
        logger.info(f"Waiting for wiz3dtools to be ready (attempt {attempt + 1}/10)...")
        time.sleep(10)

    monitor.load_and_sync()

    # Background config reloader
    reloader = threading.Thread(target=monitor.run_config_reloader, daemon=True)
    reloader.start()

    logger.info(f"Starting REST API on port {MONITOR_PORT}")
    from waitress import serve
    serve(app, host="0.0.0.0", port=MONITOR_PORT, threads=4)
