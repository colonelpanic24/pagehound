"""WebSocket endpoint — one persistent connection per client, multiplexed by event type."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..websocket_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send a welcome ping so the client can verify the connection
        await ws_manager.send_to(websocket, "system.connected", {"message": "PageHound WebSocket ready"})

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            # Handle client-initiated ping for keep-alive
            if msg.get("event") == "ping":
                await ws_manager.send_to(websocket, "pong", {"ts": msg.get("ts")})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally.")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        await ws_manager.disconnect(websocket)
