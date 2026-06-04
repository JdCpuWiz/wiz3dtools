#!/usr/bin/env python3
"""
Bambu Monitor — wiz3dtools-side proxy for BamBuddy printer state.

BuildPlan #6 Phase 2 (2026-06-04): rewritten to consume BamBuddy's REST
API instead of speaking MQTT directly to printers. The MQTT-side
(paho-mqtt, ssl, per-printer broker connections) is gone — BamBuddy is
now the canonical MQTT consumer for the 3 P1S printers. We poll its
`/api/v1/printers/{id}/status` endpoint and re-publish the data in the
same JSON shape the wiz3dtools dashboard already consumes, so neither
the Express backend (`/api/bambu/live` + `/events`) nor the React UI
needs to change.

Why polling and not SSE: BamBuddy's printer state is hot in its own
process (it's the MQTT subscriber). 2-second polling against localhost
HTTP costs nothing meaningful. Switching to SSE would require BamBuddy
to expose a push channel, which it doesn't, and would add complexity
for no real-time gain (2s granularity is invisible on the UI).

Phase 2 keeps the legacy `inhouse_transition()` + `create_filament_job()`
calls intact — those endpoints still exist in the wiz3dtools backend and
the dashboard's "pending filament attribution" UI still depends on
filament_jobs being created on FINISH. Phase 3 will rip them out together.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from flask import Flask, Response, jsonify

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("bambu-monitor")

# ── Config ─────────────────────────────────────────────────────────────────────

WIZ3DTOOLS_URL   = os.getenv("WIZ3DTOOLS_URL", "http://backend:3000").rstrip("/")
BAMBUDDY_URL     = os.getenv("BAMBUDDY_URL", "http://192.168.7.147:8000").rstrip("/")
BAMBUDDY_API_KEY = os.getenv("BAMBUDDY_API_KEY", "")
SERVICE_TOKEN    = os.getenv("MCP_SERVICE_TOKEN", "")
MONITOR_PORT     = int(os.getenv("MONITOR_PORT", "8015"))
POLL_INTERVAL_S  = float(os.getenv("POLL_INTERVAL_S", "2.0"))
CONFIG_RELOAD_S  = int(os.getenv("CONFIG_RELOAD_S", "300"))
# Refresh BamBuddy's printer index (the serial→bambuddy_id map) less often
# than wiz3dtools config — BamBuddy printers change rarely.
BAMBUDDY_INDEX_REFRESH_S = int(os.getenv("BAMBUDDY_INDEX_REFRESH_S", "300"))

# Minimum AMS remain delta to count a slot as used during a print.
REMAIN_DELTA_THRESHOLD = 0.5  # %


def _wiz_headers() -> dict:
    return {"Authorization": f"Bearer {SERVICE_TOKEN}"}


def _bambuddy_headers() -> dict:
    return {"X-API-Key": BAMBUDDY_API_KEY} if BAMBUDDY_API_KEY else {}


# Bambu Studio reports speed_level as 1-4 (Silent/Standard/Sport/Ludicrous).
# The original Bambu MQTT spd_mag was a 0-200% magnitude. Map categorical
# back to the percentage the dashboard expects so the "Speed" pill keeps
# showing a number rather than a label.
SPEED_LEVEL_TO_PCT = {1: 50, 2: 100, 3: 125, 4: 166}


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
    printer_id: int           # wiz3dtools printer.id
    printer_name: str         # wiz3dtools printer.name
    serial: str               # Bambu serial number (lookup key into BamBuddy)
    bambuddy_id: int | None = None  # BamBuddy's internal printer_id
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
    _ams_snapshot: dict[str, float] = field(default_factory=dict)
    last_updated: str | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def snapshot_key(self, ams_id: int, tray_id: int) -> str:
        return f"{ams_id}.{tray_id}"

    def take_ams_snapshot(self) -> None:
        with self._lock:
            self._ams_snapshot = {
                self.snapshot_key(s.ams_id, s.tray_id): s.remain
                for s in self.ams_slots
                if s.remain is not None
            }

    def get_used_slots(self) -> list[tuple[AmsSlotState, float | None, float | None, bool]]:
        """Slots that likely supplied filament for the just-finished print.

        See the original implementation in this file's git history for the
        semantics of (start, end, unknown_remain). Behavior unchanged from
        the MQTT era — the data source is the only thing that moved.
        """
        used = []
        for slot in self.ams_slots:
            key = self.snapshot_key(slot.ams_id, slot.tray_id)
            start = self._ams_snapshot.get(key)
            end = slot.remain
            if start is None or end is None:
                continue
            if start == -1 and end == -1:
                used.append((slot, None, None, True))
            elif start >= 0 and end >= 0 and (start - end) >= REMAIN_DELTA_THRESHOLD:
                used.append((slot, start, end, False))
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


# ── Wiz3dtools helpers (unchanged contract from MQTT era) ──────────────────────

def fetch_printer_configs() -> list[dict]:
    """Active wiz3dtools printers — we only care about ones with a serial."""
    try:
        r = httpx.get(
            f"{WIZ3DTOOLS_URL}/api/printers/config",
            headers=_wiz_headers(),
            timeout=10,
        )
        r.raise_for_status()
        data = r.json().get("data", [])
        return [p for p in data if p.get("serialNumber")]
    except Exception as e:
        logger.error(f"Failed to fetch wiz3dtools printer configs: {e}")
        return []


def fetch_colors() -> list[dict]:
    """All active colors from wiz3dtools (for AMS hex matching at FINISH)."""
    try:
        r = httpx.get(
            f"{WIZ3DTOOLS_URL}/api/colors",
            headers=_wiz_headers(),
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("data", [])
    except Exception as e:
        logger.error(f"Failed to fetch colors: {e}")
        return []


def match_color_by_hex(ams_hex: str | None, colors: list[dict]) -> dict | None:
    if not ams_hex or len(ams_hex) < 6:
        return None
    search = ams_hex[:6].upper()
    for c in colors:
        if c.get("hex", "").lstrip("#").upper() == search:
            return c
    return None


def inhouse_transition(printer_name: str, event: str) -> int | None:
    try:
        r = httpx.post(
            f"{WIZ3DTOOLS_URL}/api/queue/inhouse-transition",
            headers={**_wiz_headers(), "Content-Type": "application/json"},
            json={"printerName": printer_name, "event": event},
            timeout=5,
        )
        r.raise_for_status()
        return r.json().get("queueItemId")
    except Exception as e:
        logger.debug(f"inhouse-transition ({event}) for '{printer_name}' failed: {e}")
        return None


def create_filament_job(
    printer_id: int,
    job_name: str | None,
    slot: AmsSlotState,
    remain_start: float | None,
    remain_end: float | None,
    color_id: int | None,
    status: str,
    filament_grams: float | None = None,
    queue_item_id: int | None = None,
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
        "queueItemId": queue_item_id,
        "status": status,
    }
    try:
        r = httpx.post(
            f"{WIZ3DTOOLS_URL}/api/filament-jobs",
            headers={**_wiz_headers(), "Content-Type": "application/json"},
            json=payload,
            timeout=10,
        )
        r.raise_for_status()
        logger.info(f"Created filament job [{status}] for slot {slot_id} ({slot.tray_type} {slot.tray_color})")
    except Exception as e:
        logger.error(f"Failed to create filament job: {e}")


def process_print_finish(state: PrinterState, colors: list[dict], queue_item_id: int | None = None) -> None:
    used_slots = state.get_used_slots()
    if not used_slots:
        logger.info(f"[{state.printer_name}] Print finished but no significant filament change detected.")
        return

    for slot, remain_start, remain_end, unknown_remain in used_slots:
        matched_color = match_color_by_hex(slot.tray_color, colors)

        if unknown_remain:
            logger.info(
                f"[{state.printer_name}] Slot {slot.ams_id}.{slot.tray_id} has unknown remain "
                f"({slot.tray_color} {slot.tray_type}) — creating pending job for manual attribution."
            )
            create_filament_job(
                printer_id=state.printer_id,
                job_name=state.subtask_name,
                slot=slot,
                remain_start=None,
                remain_end=None,
                color_id=matched_color["id"] if matched_color else None,
                status="pending",
                filament_grams=None,
                queue_item_id=queue_item_id,
            )

        elif matched_color:
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
                queue_item_id=queue_item_id,
            )

        else:
            create_filament_job(
                printer_id=state.printer_id,
                job_name=state.subtask_name,
                slot=slot,
                remain_start=remain_start,
                remain_end=remain_end,
                color_id=None,
                status="pending",
                filament_grams=None,
                queue_item_id=queue_item_id,
            )
            logger.info(
                f"[{state.printer_name}] No color match for {slot.tray_color} ({slot.tray_type}) "
                f"— created pending filament job."
            )


# ── BamBuddy translation ───────────────────────────────────────────────────────

def fetch_bambuddy_printer_index() -> dict[str, int]:
    """Build a {serial_number → bambuddy_id} map."""
    try:
        r = httpx.get(
            f"{BAMBUDDY_URL}/api/v1/printers/",
            headers=_bambuddy_headers(),
            timeout=10,
        )
        r.raise_for_status()
        printers = r.json()
        return {p["serial_number"]: p["id"] for p in printers if p.get("serial_number") and p.get("is_active", True)}
    except Exception as e:
        logger.error(f"Failed to fetch BamBuddy printer index: {e}")
        return {}


def fetch_bambuddy_status(bambuddy_id: int) -> dict | None:
    try:
        r = httpx.get(
            f"{BAMBUDDY_URL}/api/v1/printers/{bambuddy_id}/status",
            headers=_bambuddy_headers(),
            timeout=5,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.debug(f"BamBuddy status fetch failed for id={bambuddy_id}: {e}")
        return None


def apply_bambuddy_status(state: PrinterState, data: dict) -> None:
    """Translate one BamBuddy status payload onto a wiz3dtools PrinterState.

    Field mapping (BamBuddy → PrinterState):
      connected         → connected
      state             → gcode_state            (RUNNING/FINISH/IDLE/PREPARE/FAILED/PAUSE)
      progress          → mc_percent             (0-100 float)
      remaining_time    → mc_remaining_time      (seconds)
      layer_num         → layer_num
      total_layers      → total_layer_num
      subtask_name      → subtask_name
      temperatures.nozzle / .bed → nozzle_temper / bed_temper
      speed_level (1-4) → spd_mag (via SPEED_LEVEL_TO_PCT)
      ams[].tray[]      → ams_slots[]
      chamber_temper    → null (P1S exposes no chamber thermistor in BamBuddy's payload)
    """
    with state._lock:
        state.connected         = bool(data.get("connected", False))
        state.gcode_state       = data.get("state")
        state.mc_percent        = data.get("progress")
        state.mc_remaining_time = data.get("remaining_time")
        state.layer_num         = data.get("layer_num")
        state.total_layer_num   = data.get("total_layers")
        state.subtask_name      = data.get("subtask_name")

        temps = data.get("temperatures") or {}
        state.nozzle_temper  = temps.get("nozzle")
        state.bed_temper     = temps.get("bed")
        state.chamber_temper = None

        speed_level = data.get("speed_level")
        state.spd_mag = SPEED_LEVEL_TO_PCT.get(speed_level) if isinstance(speed_level, int) else None

        # AMS: only overwrite when BamBuddy actually included tray entries
        # (matches the MQTT-era guard against empty-array metadata updates).
        new_slots: list[AmsSlotState] = []
        for ams_unit in data.get("ams", []) or []:
            ams_id = int(ams_unit.get("id", 0))
            for tray in ams_unit.get("tray", []) or []:
                tray_id = int(tray.get("id", 0))
                remain = tray.get("remain")
                new_slots.append(AmsSlotState(
                    ams_id=ams_id,
                    tray_id=tray_id,
                    remain=float(remain) if remain is not None else None,
                    tray_color=tray.get("tray_color"),
                    tray_type=tray.get("tray_type"),
                    tray_sub_brands=tray.get("tray_sub_brands"),
                ))
        if new_slots:
            state.ams_slots = new_slots

        state.last_updated = datetime.now(timezone.utc).isoformat()


# ── Per-printer poller ─────────────────────────────────────────────────────────

class PrinterPoller:
    """One thread per printer. Polls BamBuddy at POLL_INTERVAL_S and fires
    state-transition handlers (print start / finish) just like the old
    MQTT message handler did.
    """

    def __init__(self, state: PrinterState):
        self.state = state
        self._colors: list[dict] = []
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def refresh_colors(self, colors: list[dict]) -> None:
        self._colors = colors

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"poll-{self.state.printer_name}")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def _loop(self) -> None:
        logger.info(f"[{self.state.printer_name}] Poller started (bambuddy_id={self.state.bambuddy_id})")
        while not self._stop_event.is_set():
            if self.state.bambuddy_id is None:
                # No mapping yet — wait for monitor.reload to populate.
                self._stop_event.wait(POLL_INTERVAL_S)
                continue

            data = fetch_bambuddy_status(self.state.bambuddy_id)
            if data is None:
                # Transient error: mark disconnected, sleep, retry.
                if self.state.connected:
                    self.state.connected = False
                    broadcast_state()
                self._stop_event.wait(POLL_INTERVAL_S)
                continue

            prev_state = self.state.gcode_state
            apply_bambuddy_status(self.state, data)
            broadcast_state()

            new_state = self.state.gcode_state
            if new_state and new_state != prev_state:
                self._handle_state_transition(prev_state, new_state)

            self._stop_event.wait(POLL_INTERVAL_S)
        logger.info(f"[{self.state.printer_name}] Poller stopped")

    def _handle_state_transition(self, prev: str | None, new: str) -> None:
        logger.info(f"[{self.state.printer_name}] State: {prev} → {new}")

        if new == "RUNNING" and prev not in ("RUNNING", "PAUSE"):
            self.state.take_ams_snapshot()
            logger.info(f"[{self.state.printer_name}] Print started ({prev} → RUNNING), AMS snapshot taken.")
            inhouse_transition(self.state.printer_name, "start")

        elif new == "FINISH":
            logger.info(f"[{self.state.printer_name}] Print finished: {self.state.subtask_name}")
            queue_item_id = inhouse_transition(self.state.printer_name, "finish")
            if queue_item_id:
                logger.info(f"[{self.state.printer_name}] Linked to in-house queue item {queue_item_id}")
            process_print_finish(self.state, self._colors, queue_item_id=queue_item_id)


# ── Monitor manager ────────────────────────────────────────────────────────────

class BambuMonitor:
    def __init__(self) -> None:
        self.pollers: dict[str, PrinterPoller] = {}
        self.states:  dict[str, PrinterState]   = {}
        self._lock = threading.Lock()
        self._bambuddy_index: dict[str, int] = {}

    def refresh_bambuddy_index(self) -> None:
        idx = fetch_bambuddy_printer_index()
        if idx:
            self._bambuddy_index = idx
            with self._lock:
                for serial, state in self.states.items():
                    state.bambuddy_id = idx.get(serial)
            logger.info(f"BamBuddy printer index: {len(idx)} printer(s) — {list(idx.values())}")

    def load_and_sync(self) -> None:
        """Fetch wiz3dtools configs + BamBuddy index, start/stop pollers."""
        self.refresh_bambuddy_index()
        configs = fetch_printer_configs()
        colors  = fetch_colors()

        current_serials: set[str] = set()
        for cfg in configs:
            serial = cfg["serialNumber"]
            current_serials.add(serial)

            with self._lock:
                if serial in self.pollers:
                    self.pollers[serial].refresh_colors(colors)
                    self.states[serial].bambuddy_id = self._bambuddy_index.get(serial)
                else:
                    state = PrinterState(
                        printer_id=cfg["id"],
                        printer_name=cfg["name"],
                        serial=serial,
                        bambuddy_id=self._bambuddy_index.get(serial),
                    )
                    poller = PrinterPoller(state)
                    poller.refresh_colors(colors)
                    self.pollers[serial] = poller
                    self.states[serial]  = state
                    poller.start()
                    logger.info(f"Started poller for printer '{cfg['name']}' ({serial})")

        with self._lock:
            removed = set(self.pollers) - current_serials
            for serial in removed:
                logger.info(f"Stopping poller for removed serial {serial}")
                self.pollers[serial].stop()
                del self.pollers[serial]
                del self.states[serial]

    def get_all_status(self) -> list[dict]:
        with self._lock:
            return [s.to_dict() for s in self.states.values()]

    def run_config_reloader(self) -> None:
        while True:
            time.sleep(CONFIG_RELOAD_S)
            logger.info("Reloading wiz3dtools printer configs...")
            self.load_and_sync()

    def run_index_reloader(self) -> None:
        while True:
            time.sleep(BAMBUDDY_INDEX_REFRESH_S)
            logger.debug("Refreshing BamBuddy printer index...")
            self.refresh_bambuddy_index()


monitor = BambuMonitor()


# ── SSE broadcast ──────────────────────────────────────────────────────────────

_sse_clients: list[queue.Queue] = []
_sse_lock = threading.Lock()


def broadcast_state() -> None:
    data = json.dumps(monitor.get_all_status())
    with _sse_lock:
        dead = [q for q in _sse_clients if q.full()]
        for q in dead:
            _sse_clients.remove(q)
        for q in _sse_clients:
            try:
                q.put_nowait(data)
            except queue.Full:
                pass


# ── Flask REST API ─────────────────────────────────────────────────────────────

app = Flask(__name__)


@app.route("/status")
def status():
    return jsonify({"success": True, "data": monitor.get_all_status()})


@app.route("/health")
def health():
    connected = sum(1 for s in monitor.states.values() if s.connected)
    total     = len(monitor.states)
    return jsonify({
        "status": "ok",
        "connected": connected,
        "total": total,
        "bambuddy": BAMBUDDY_URL,
    })


@app.route("/events")
def events():
    q: queue.Queue = queue.Queue(maxsize=20)
    with _sse_lock:
        _sse_clients.append(q)

    initial = json.dumps(monitor.get_all_status())
    q.put_nowait(initial)

    def generate():
        try:
            while True:
                try:
                    data = q.get(timeout=25)
                    yield f"data: {data}\n\n"
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            with _sse_lock:
                try:
                    _sse_clients.remove(q)
                except ValueError:
                    pass

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/reload", methods=["POST"])
def reload():
    logger.info("Config reload triggered via API")
    monitor.load_and_sync()
    connected = sum(1 for s in monitor.states.values() if s.connected)
    return jsonify({
        "status": "ok",
        "printers": len(monitor.states),
        "connected": connected,
        "bambuddy_index_size": len(monitor._bambuddy_index),
    })


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info(f"Bambu Monitor (BamBuddy REST mode) starting — BAMBUDDY_URL={BAMBUDDY_URL}")
    if not BAMBUDDY_API_KEY:
        logger.warning("BAMBUDDY_API_KEY is empty — BamBuddy will return 401 on every poll.")

    # Wait for wiz3dtools backend to come up before first sync.
    for attempt in range(10):
        configs = fetch_printer_configs()
        if configs or attempt >= 5:
            break
        logger.info(f"Waiting for wiz3dtools to be ready (attempt {attempt + 1}/10)...")
        time.sleep(10)

    monitor.load_and_sync()

    # Background reloaders — wiz3dtools config every 5min, BamBuddy index every 5min.
    threading.Thread(target=monitor.run_config_reloader, daemon=True, name="cfg-reloader").start()
    threading.Thread(target=monitor.run_index_reloader, daemon=True, name="idx-reloader").start()

    logger.info(f"Starting REST API on port {MONITOR_PORT}")
    from waitress import serve
    serve(app, host="0.0.0.0", port=MONITOR_PORT, threads=16)
