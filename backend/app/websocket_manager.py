"""
WebSocketManager: connection registry + Redis pub/sub fan-out.

Architecture:
  - Celery tasks publish JSON-encoded events to Redis channel "pagehound:events"
  - An asyncio background task (start_redis_listener) subscribes to that channel
    and calls broadcast() to fan out to all connected WebSocket clients
  - This runs inside the FastAPI process so it can share the event loop
"""

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from .config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

REDIS_CHANNEL = "pagehound:events"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class WebSocketManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        logger.info("WS client connected. Total: %d", len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)
        logger.info("WS client disconnected. Total: %d", len(self._connections))

    # ------------------------------------------------------------------
    # Sending
    # ------------------------------------------------------------------

    async def broadcast(self, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "payload": payload, "timestamp": _now_iso()})
        dead: list[WebSocket] = []
        async with self._lock:
            snapshot = list(self._connections)
        for ws in snapshot:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)

    async def send_to(self, ws: WebSocket, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "payload": payload, "timestamp": _now_iso()})
        try:
            await ws.send_text(message)
        except Exception:
            await self.disconnect(ws)

    # ------------------------------------------------------------------
    # Redis pub/sub listener (runs as a background asyncio task)
    # ------------------------------------------------------------------

    async def start_redis_listener(self) -> None:
        """Subscribe to Redis and fan out events to all WebSocket clients."""
        while True:
            try:
                redis = Redis.from_url(settings.redis_url, decode_responses=True)
                pubsub = redis.pubsub()
                await pubsub.subscribe(REDIS_CHANNEL)
                logger.info("Redis pub/sub listener started on channel '%s'", REDIS_CHANNEL)
                async for message in pubsub.listen():
                    if message["type"] != "message":
                        continue
                    try:
                        data = json.loads(message["data"])
                        await self.broadcast(data["event"], data["payload"])
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning("Malformed Redis message: %s — %s", message["data"], e)
            except asyncio.CancelledError:
                logger.info("Redis listener cancelled.")
                return
            except Exception as e:
                logger.error("Redis listener error: %s — reconnecting in 3s", e)
                await asyncio.sleep(3)


# Singleton used throughout the app
ws_manager = WebSocketManager()


# ------------------------------------------------------------------
# Helper used by Celery tasks to publish events
# (synchronous — uses redis-py sync client)
# ------------------------------------------------------------------

def publish_event(event: str, payload: dict[str, Any]) -> None:
    """Called from Celery tasks. Publishes an event to the Redis channel."""
    import redis as sync_redis  # sync client

    client = sync_redis.from_url(settings.redis_url, decode_responses=True)
    message = json.dumps({"event": event, "payload": payload})
    client.publish(REDIS_CHANNEL, message)
    client.close()
