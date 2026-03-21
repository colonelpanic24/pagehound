"""Kobo store API — endpoints the Kobo device firmware contacts."""
from __future__ import annotations

import logging
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..models.book import Book
from ..models.kobo_device import KoboDevice
from ..models.reading_progress import ReadingProgress
from ..services.kobo_utils import _iso, book_to_entitlement

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/kobo", tags=["kobo"])

settings = get_settings()


# ── Auth dependency ────────────────────────────────────────────────────────────

async def _get_device(
    auth_token: str,
    x_kobo_deviceid: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> KoboDevice:
    result = await db.execute(
        select(KoboDevice).where(KoboDevice.auth_token == auth_token)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=401, detail="Unknown Kobo auth token")
    # Update device_id if first time we see it
    if x_kobo_deviceid and not device.device_id:
        device.device_id = x_kobo_deviceid
    return device


# ── Initialization ─────────────────────────────────────────────────────────────

@router.get("/{auth_token}/v1/initialization")
async def initialization(
    device: KoboDevice = Depends(_get_device),
    db: AsyncSession = Depends(get_db),
):
    device.last_synced = datetime.utcnow()
    base = settings.base_url.rstrip("/")
    return {
        "Resources": {
            "image_host": base,
            "image_url_template": f"{base}/kobo/image/{{ImageId}}/{{Width}}/{{Height}}/{{Quality}}/image.jpg",
            "image_url_quality_template": f"{base}/kobo/image/{{ImageId}}/{{Width}}/{{Height}}/{{Quality}}/image.jpg",
            "updated_time": _iso(datetime.utcnow()),
        }
    }


# ── User profile ───────────────────────────────────────────────────────────────

@router.get("/{auth_token}/v1/user/profile")
async def user_profile(device: KoboDevice = Depends(_get_device)):
    return {
        "UserKey": "pagehound-user",
        "UserDisplayName": "PageHound",
        "HasMadePurchase": False,
    }


# ── Library sync ───────────────────────────────────────────────────────────────

@router.get("/{auth_token}/v1/library/sync")
async def library_sync(
    device: KoboDevice = Depends(_get_device),
    sync_token: str | None = Query(default=None, alias="SyncToken"),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Book)
        .options(selectinload(Book.authors))
        .where(Book.is_missing == False)  # noqa: E712
    )

    since: datetime | None = None
    if sync_token:
        try:
            since = datetime.fromisoformat(sync_token.replace("Z", "+00:00"))
        except ValueError:
            since = None

    if since is not None:
        query = query.where(Book.modified_date >= since.replace(tzinfo=None))

    result = await db.execute(query)
    books = result.scalars().all()

    new_token = _iso(datetime.utcnow())
    device.last_synced = datetime.utcnow()

    entries = [
        book_to_entitlement(
            b,
            settings.base_url.rstrip("/"),
            device.auth_token,
            is_new=(since is None),
        )
        for b in books
    ]

    headers = {
        "x-kobo-sync": "done",
        "x-kobo-synctoken": new_token,
    }
    return Response(
        content=__import__("json").dumps(entries),
        media_type="application/json",
        headers=headers,
    )


# ── Sync acknowledgement ───────────────────────────────────────────────────────

@router.post("/{auth_token}/v1/library/sync/acknowledgement")
async def sync_ack(
    auth_token: str,
    device: KoboDevice = Depends(_get_device),
    db: AsyncSession = Depends(get_db),
):
    device.last_synced = datetime.utcnow()
    return {}


# ── Download URL ───────────────────────────────────────────────────────────────

@router.get("/{auth_token}/v1/products/{book_uuid}/download/url")
async def download_url(
    book_uuid: str,
    auth_token: str,
    device: KoboDevice = Depends(_get_device),
    db: AsyncSession = Depends(get_db),
):
    await _find_book_by_uuid(book_uuid, db)
    base = settings.base_url.rstrip("/")
    url = f"{base}/kobo/{auth_token}/v1/books/{book_uuid}/file/epub"
    return {"Url": url}


# ── Book file download ─────────────────────────────────────────────────────────

@router.get("/{auth_token}/v1/books/{book_uuid}/file/{fmt}")
async def serve_book_file(
    book_uuid: str,
    fmt: str,
    device: KoboDevice = Depends(_get_device),
    db: AsyncSession = Depends(get_db),
):
    book = await _find_book_by_uuid(book_uuid, db)
    if not book.file_path or not os.path.exists(book.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    content_types: dict[str, str] = {
        "epub": "application/epub+zip",
        "kepub": "application/epub+zip",
        "pdf": "application/pdf",
        "mobi": "application/x-mobipocket-ebook",
    }
    media_type = content_types.get(fmt.lower(), "application/octet-stream")
    return FileResponse(book.file_path, media_type=media_type)


# ── Reading state GET ──────────────────────────────────────────────────────────

@router.get("/{auth_token}/v1/library/{book_uuid}/state")
async def get_reading_state(
    book_uuid: str,
    device: KoboDevice = Depends(_get_device),
    db: AsyncSession = Depends(get_db),
):
    book = await _find_book_by_uuid(book_uuid, db)
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book.id,
            ReadingProgress.kobo_device_id == device.auth_token,
        )
    )
    p = result.scalar_one_or_none()

    now_str = _iso(datetime.utcnow())
    if p and p.percent_complete is not None:
        status = "Finished" if p.percent_complete >= 0.99 else "Reading"
        bookmark = {
            "ContentSourceProgressPercent": p.percent_complete,
            "Location": {
                "Source": "KoboSpan",
                "Type": "KoboSpan",
                "Value": p.last_read_position or "",
            },
        }
    else:
        status = "ReadyToRead"
        bookmark = None

    return {
        "ReadingState": {
            "CurrentBookmark": bookmark,
            "LastModified": _iso(p.last_synced if p else None),
            "PriorityTimestamp": _iso(p.last_synced if p else None),
            "StatusInfo": {"LastModified": now_str, "Status": status},
        }
    }


# ── Reading state PUT ──────────────────────────────────────────────────────────

@router.put("/{auth_token}/v1/library/{book_uuid}/state")
async def put_reading_state(
    book_uuid: str,
    body: dict,
    device: KoboDevice = Depends(_get_device),
    db: AsyncSession = Depends(get_db),
):
    book = await _find_book_by_uuid(book_uuid, db)
    reading_state = body.get("ReadingState", {})
    bookmark = reading_state.get("CurrentBookmark") or {}
    pct = bookmark.get("ContentSourceProgressPercent")
    location = (bookmark.get("Location") or {}).get("Value") or ""

    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book.id,
            ReadingProgress.kobo_device_id == device.auth_token,
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        p = ReadingProgress(book_id=book.id, kobo_device_id=device.auth_token)
        db.add(p)

    if pct is not None:
        p.percent_complete = float(pct)
    p.last_read_position = location[:512]
    p.last_synced = datetime.utcnow()
    await db.commit()

    # Broadcast progress via WS
    try:
        from ..websocket_manager import ws_manager
        await ws_manager.broadcast(
            "kobo.progress_synced",
            {
                "book_id": book.id,
                "device_id": device.id,
                "device_name": device.name,
                "percent": p.percent_complete,
            },
        )
    except Exception:
        pass

    return {}


# ── Cover image serving ────────────────────────────────────────────────────────

@router.get("/image/{image_id}/{width}/{height}/{quality}/image.jpg")
async def serve_cover_image(
    image_id: str,
    width: int,
    height: int,
    quality: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve a resized JPEG cover for the Kobo device."""
    # Resolve book from deterministic uuid
    try:
        book_int_id = uuid.UUID(image_id).int
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid image id")

    result = await db.execute(select(Book).where(Book.id == book_int_id))
    book = result.scalar_one_or_none()
    if not book or not book.cover_image_path:
        raise HTTPException(status_code=404, detail="No cover available")

    covers_dir = settings.covers_dir
    cover_path = os.path.join(covers_dir, book.cover_image_path)
    if not os.path.exists(cover_path):
        raise HTTPException(status_code=404, detail="Cover file not found")

    # Check resize cache
    cache_dir = os.path.join(covers_dir, ".kobo-resized")
    os.makedirs(cache_dir, exist_ok=True)
    cache_file = os.path.join(cache_dir, f"{image_id}_{width}x{height}.jpg")

    if not os.path.exists(cache_file):
        try:
            from PIL import Image
            img = Image.open(cover_path).convert("RGB")
            img.thumbnail((width, height), Image.LANCZOS)
            img.save(cache_file, "JPEG", quality=85)
        except Exception as exc:
            logger.warning("Cover resize failed: %s", exc)
            raise HTTPException(status_code=500, detail="Cover resize failed")

    with open(cache_file, "rb") as f:
        data = f.read()

    return Response(content=data, media_type="image/jpeg")


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _find_book_by_uuid(book_uuid: str, db: AsyncSession) -> Book:
    """Resolve a Kobo UUID (deterministic from book.id) to a Book row."""
    try:
        book_int_id = __import__("uuid").UUID(book_uuid).int
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid book UUID")

    result = await db.execute(
        select(Book).options(selectinload(Book.authors)).where(Book.id == book_int_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


# Fix missing import at top (uuid is used in serve_cover_image)
import uuid  # noqa: E402
