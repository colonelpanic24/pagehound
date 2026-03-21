"""Tests for Kobo store API and Kobo admin endpoints."""
import uuid

import pytest

from tests.conftest import seed_book


async def _seed_device(client, name="My Kobo"):
    r = await client.post("/api/kobo/devices", json={"name": name})
    assert r.status_code == 201
    return r.json()


# ── Admin endpoints ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_devices_empty(client):
    r = await client.get("/api/kobo/devices")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_create_device(client):
    device = await _seed_device(client, "Libra Colour")
    assert device["name"] == "Libra Colour"
    assert uuid.UUID(device["auth_token"])  # valid UUID
    assert "/kobo/" in device["sync_url"]


@pytest.mark.asyncio
async def test_delete_device(client):
    device = await _seed_device(client)
    r = await client.delete(f"/api/kobo/devices/{device['id']}")
    assert r.status_code == 204
    r2 = await client.get("/api/kobo/devices")
    assert r2.json() == []


@pytest.mark.asyncio
async def test_delete_nonexistent_device(client):
    r = await client.delete("/api/kobo/devices/9999")
    assert r.status_code == 404


# ── Kobo store API ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_initialization_invalid_token(client):
    r = await client.get("/kobo/bad-token/v1/initialization")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_initialization(client):
    device = await _seed_device(client)
    token = device["auth_token"]
    r = await client.get(f"/kobo/{token}/v1/initialization")
    assert r.status_code == 200
    data = r.json()
    assert "Resources" in data
    assert "image_host" in data["Resources"]


@pytest.mark.asyncio
async def test_user_profile(client):
    device = await _seed_device(client)
    r = await client.get(f"/kobo/{device['auth_token']}/v1/user/profile")
    assert r.status_code == 200
    assert r.json()["UserKey"] == "pagehound-user"


@pytest.mark.asyncio
async def test_library_sync_empty(client):
    device = await _seed_device(client)
    r = await client.get(f"/kobo/{device['auth_token']}/v1/library/sync")
    assert r.status_code == 200
    assert r.headers.get("x-kobo-sync") == "done"
    assert r.json() == []


@pytest.mark.asyncio
async def test_library_sync_with_book(client, db_session):
    await seed_book(db_session, title="The Hobbit", sort_title="Hobbit, The")
    device = await _seed_device(client)
    r = await client.get(f"/kobo/{device['auth_token']}/v1/library/sync")
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 1
    assert "NewEntitlement" in entries[0]
    be = entries[0]["NewEntitlement"]
    assert be["BookMetadata"]["Title"] == "The Hobbit"


@pytest.mark.asyncio
async def test_library_sync_incremental_no_changes(client, db_session):
    """With a future SyncToken, no books should be returned."""
    await seed_book(db_session)
    device = await _seed_device(client)
    # Use a far-future token so no books qualify
    r = await client.get(
        f"/kobo/{device['auth_token']}/v1/library/sync",
        params={"SyncToken": "2099-01-01T00:00:00Z"},
    )
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_reading_state_put_and_get(client, db_session):
    book = await seed_book(db_session)
    device = await _seed_device(client)
    token = device["auth_token"]
    book_uuid = str(uuid.UUID(int=book.id))

    # PUT reading state
    body = {
        "ReadingState": {
            "CurrentBookmark": {
                "ContentSourceProgressPercent": 0.42,
                "Location": {
                    "Source": "KoboSpan",
                    "Type": "KoboSpan",
                    "Value": "epubcfi(/6/4!/4/2/2/2:0)",
                },
            },
            "StatusInfo": {"Status": "Reading"},
        }
    }
    r = await client.put(f"/kobo/{token}/v1/library/{book_uuid}/state", json=body)
    assert r.status_code == 200

    # GET reading state
    r2 = await client.get(f"/kobo/{token}/v1/library/{book_uuid}/state")
    assert r2.status_code == 200
    state = r2.json()["ReadingState"]
    assert abs(state["CurrentBookmark"]["ContentSourceProgressPercent"] - 0.42) < 0.001
    assert state["CurrentBookmark"]["Location"]["Value"] == "epubcfi(/6/4!/4/2/2/2:0)"


@pytest.mark.asyncio
async def test_sync_ack(client):
    device = await _seed_device(client)
    r = await client.post(
        f"/kobo/{device['auth_token']}/v1/library/sync/acknowledgement",
        json={"Results": [{"CurrentToken": "abc"}]},
    )
    assert r.status_code == 200
