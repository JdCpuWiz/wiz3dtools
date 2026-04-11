#!/usr/bin/env python3
"""Wiz3DTools MCP Server — print queue and filament inventory tools for Jarvis AI."""

import os
import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

mcp = FastMCP(
    "wiz3dtools",
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)

_BASE = os.getenv("WIZ3DTOOLS_URL", "http://192.168.7.28:3000").rstrip("/")
_TOKEN = os.getenv("MCP_SERVICE_TOKEN", "")


def _headers() -> dict:
    return {"Authorization": f"Bearer {_TOKEN}"}


# ── Tools ──────────────────────────────────────────────────────────────────────

@mcp.tool()
async def get_queue_stats() -> str:
    """Get a summary count of items currently in the print queue by status.

    Returns counts for: printing, pending, completed, and cancelled.
    Use this for a quick overview like 'what's going on with the queue?'
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_BASE}/api/queue", headers=_headers(), timeout=10)
        r.raise_for_status()
        items = r.json().get("data", [])

    counts: dict[str, int] = {}
    for item in items:
        status = item.get("status", "unknown")
        counts[status] = counts.get(status, 0) + 1

    if not counts:
        return "The print queue is empty."

    parts = []
    for status in ["printing", "pending", "completed", "cancelled"]:
        if counts.get(status, 0) > 0:
            parts.append(f"{counts[status]} {status}")

    return "Print queue: " + ", ".join(parts) + "."


@mcp.tool()
async def get_print_queue(status: str = "active") -> str:
    """Get items currently in the print queue.

    Args:
        status: Filter by status. Use 'active' for pending+printing (default),
                'printing' for currently printing only, 'pending' for waiting,
                'completed' for finished jobs.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_BASE}/api/queue", headers=_headers(), timeout=10)
        r.raise_for_status()
        items = r.json().get("data", [])

    if status == "active":
        filtered = [i for i in items if i.get("status") in ("printing", "pending")]
    else:
        filtered = [i for i in items if i.get("status") == status]

    if not filtered:
        label = "active" if status == "active" else status
        return f"No {label} items in the print queue."

    lines = []
    for item in filtered:
        qty = item.get("quantity", 1)
        name = item.get("name") or item.get("description") or "Unnamed item"
        item_status = item.get("status", "")
        customer = item.get("customerName") or item.get("customer_name") or ""
        printer = item.get("printerName") or item.get("printer_name") or ""
        colors = item.get("colors", [])

        parts = [f"[{item_status.upper()}]", f"x{qty}", name]
        if customer:
            parts.append(f"for {customer}")
        if printer:
            parts.append(f"on {printer}")
        if colors:
            color_names = [c.get("name", "") for c in colors if c.get("name")]
            if color_names:
                parts.append(f"({', '.join(color_names)})")

        lines.append(" ".join(parts))

    label = "active" if status == "active" else status
    return f"{len(filtered)} {label} queue item(s):\n" + "\n".join(f"- {l}" for l in lines)


@mcp.tool()
async def get_filament_inventory() -> str:
    """Get current filament inventory levels for all active colors.

    Returns each color's name, manufacturer, current net grams remaining,
    and status (OK / Low / Critical / Empty).
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_BASE}/api/colors", headers=_headers(), timeout=10)
        r.raise_for_status()
        colors = r.json().get("data", [])

    active = [c for c in colors if c.get("active", True)]
    if not active:
        return "No active filament colors configured."

    lines = []
    for c in active:
        name = c.get("name", "Unknown")
        mfg = (c.get("manufacturer") or {}).get("name", "")
        gross = float(c.get("inventoryGrams", 0))
        mfg_data = c.get("manufacturer") or {}
        empty_spool = float(mfg_data.get("emptySpoolWeightG", 0))
        low_thresh = float(mfg_data.get("lowThresholdG", 500))
        critical_thresh = float(mfg_data.get("criticalThresholdG", 200))
        full_net = float(mfg_data.get("fullSpoolNetWeightG", 1000))

        net = max(0.0, gross - empty_spool)

        if net <= 0:
            status = "EMPTY"
        elif net <= critical_thresh:
            status = "CRITICAL"
        elif net <= low_thresh:
            status = "LOW"
        else:
            status = "OK"

        label = f"{mfg} {name}".strip() if mfg else name
        lines.append(f"- {label}: {net:.0f}g remaining [{status}]")

    return f"Filament inventory ({len(active)} active colors):\n" + "\n".join(lines)


@mcp.tool()
async def get_low_filament() -> str:
    """Get filament colors that are low or critically low on stock.

    Use this to answer 'what filament is running low?' or
    'do we need to order filament?'
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_BASE}/api/colors", headers=_headers(), timeout=10)
        r.raise_for_status()
        colors = r.json().get("data", [])

    alerts = []
    for c in colors:
        if not c.get("active", True):
            continue
        name = c.get("name", "Unknown")
        mfg = (c.get("manufacturer") or {}).get("name", "")
        gross = float(c.get("inventoryGrams", 0))
        mfg_data = c.get("manufacturer") or {}
        empty_spool = float(mfg_data.get("emptySpoolWeightG", 0))
        low_thresh = float(mfg_data.get("lowThresholdG", 500))
        critical_thresh = float(mfg_data.get("criticalThresholdG", 200))

        net = max(0.0, gross - empty_spool)
        if net <= low_thresh:
            if net <= 0:
                status = "EMPTY"
            elif net <= critical_thresh:
                status = "CRITICAL"
            else:
                status = "LOW"
            label = f"{mfg} {name}".strip() if mfg else name
            alerts.append((status, label, net))

    if not alerts:
        return "All filament levels are OK — nothing is low or critical."

    # Sort: EMPTY first, then CRITICAL, then LOW
    order = {"EMPTY": 0, "CRITICAL": 1, "LOW": 2}
    alerts.sort(key=lambda x: (order.get(x[0], 9), x[1]))

    lines = [f"- [{a[0]}] {a[1]}: {a[2]:.0f}g remaining" for a in alerts]
    return f"{len(alerts)} filament color(s) need attention:\n" + "\n".join(lines)


@mcp.tool()
async def get_sales_summary(days: int = 30) -> str:
    """Get a sales revenue summary for the last N days.

    Args:
        days: Number of days to look back (default 30).
    """
    from datetime import datetime, timedelta

    end = datetime.now()
    start = end - timedelta(days=days)

    params = {
        "startDate": start.strftime("%Y-%m-%d"),
        "endDate": end.strftime("%Y-%m-%d"),
    }

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{_BASE}/api/reports/sales",
            headers=_headers(),
            params=params,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json().get("data", {})

    summary = data.get("summary", {})
    rows = data.get("invoices", [])

    grand_total = float(summary.get("grandTotal", 0))
    subtotal = float(summary.get("totalSubtotal", 0))
    tax = float(summary.get("totalTax", 0))
    shipping = float(summary.get("totalShipping", 0))
    count = len(rows)

    if count == 0:
        return f"No sales in the last {days} days."

    return (
        f"Sales summary — last {days} days:\n"
        f"  {count} invoice(s)\n"
        f"  Subtotal: ${subtotal:.2f}\n"
        f"  Shipping: ${shipping:.2f}\n"
        f"  Tax: ${tax:.2f}\n"
        f"  Total revenue: ${grand_total:.2f}"
    )


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.settings.host = "0.0.0.0"
    mcp.settings.port = 8014
    mcp.run(transport="streamable-http")
