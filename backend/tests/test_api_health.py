"""Tests for the health endpoint and basic app wiring."""

import pytest


@pytest.mark.asyncio
async def test_health_ok(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["service"] == "pagehound"
