"""
WebSocket connection manager for pipeline status updates.

One pipeline_id can have multiple connected clients (e.g. multiple browser tabs).
Messages are JSON:
  { "running": true,  "step": "Generating image…", "step_index": 2 }
  { "running": false, "step": "",                  "step_index": 0 }
"""
import asyncio
import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# pipeline_id → set of connected WebSockets
_connections: dict[int, set[WebSocket]] = defaultdict(set)

# pipeline_id → last known status (for new connections that join mid-run)
_status: dict[int, dict] = {}


async def connect(pipeline_id: int, ws: WebSocket) -> None:
    await ws.accept()
    _connections[pipeline_id].add(ws)
    # Send current status immediately so the client knows if a run is already in progress
    current = _status.get(pipeline_id, {"running": False, "step": "", "step_index": 0})
    await _send(ws, current)


def disconnect(pipeline_id: int, ws: WebSocket) -> None:
    _connections[pipeline_id].discard(ws)


async def _send(ws: WebSocket, data: dict) -> None:
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass


async def broadcast(pipeline_id: int, running: bool, step: str = "", step_index: int = 0) -> None:
    msg = {"running": running, "step": step, "step_index": step_index}
    _status[pipeline_id] = msg
    dead = set()
    for ws in list(_connections[pipeline_id]):
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            dead.add(ws)
    for ws in dead:
        _connections[pipeline_id].discard(ws)
    if not running:
        _status.pop(pipeline_id, None)


def broadcast_sync(pipeline_id: int, running: bool, step: str = "", step_index: int = 0) -> None:
    """Fire-and-forget broadcast safe to call from sync code (e.g. non-async contexts)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(broadcast(pipeline_id, running, step, step_index))
    except Exception as e:
        logger.debug("[WS] broadcast_sync error: %s", e)
