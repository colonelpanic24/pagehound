"""Downloads API — search external sources and manage download queue."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.download import Download

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/downloads", tags=["downloads"])


# ── Request / response schemas ────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    source: str = "annas_archive"
    limit: int = 20


class EnqueueRequest(BaseModel):
    title: str
    authors: list[str]
    file_format: str | None = None
    file_size_bytes: int | None = None
    source: str
    source_id: str
    cover_url: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _dl_dict(d: Download) -> dict:
    return {
        "id": d.id,
        "title": d.title,
        "authors": d.authors,
        "file_format": d.file_format,
        "file_size_bytes": d.file_size_bytes,
        "source": d.source,
        "source_id": d.source_id,
        "status": d.status,
        "progress": d.progress,
        "file_path": d.file_path,
        "error": d.error,
        "cover_url": d.cover_url,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        "book_id": d.book_id,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/search")
async def search_books(req: SearchRequest):
    """Search an external book source and return results."""
    if req.source != "annas_archive":
        raise HTTPException(status_code=400, detail=f"Unknown source: {req.source!r}")
    from ..services.sources import annas_archive
    results = await asyncio.to_thread(annas_archive.search, req.query, req.limit)
    return {"source": req.source, "results": results}


@router.post("/")
async def enqueue_download(req: EnqueueRequest, db: AsyncSession = Depends(get_db)):
    """Add a book to the download queue and start downloading."""
    download = Download(
        title=req.title,
        authors=", ".join(req.authors),
        file_format=req.file_format,
        file_size_bytes=req.file_size_bytes,
        source=req.source,
        source_id=req.source_id,
        cover_url=req.cover_url,
        status="queued",
        progress=0,
    )
    db.add(download)
    await db.flush()
    await db.refresh(download)

    from ..tasks.download_book import download_book
    download_book.delay(download.id)

    return _dl_dict(download)


@router.get("/")
async def list_downloads(db: AsyncSession = Depends(get_db)):
    """Return the 100 most recent downloads."""
    result = await db.execute(
        select(Download).order_by(desc(Download.created_at)).limit(100)
    )
    return [_dl_dict(d) for d in result.scalars().all()]


@router.get("/{download_id}")
async def get_download(download_id: int, db: AsyncSession = Depends(get_db)):
    dl = await db.get(Download, download_id)
    if not dl:
        raise HTTPException(status_code=404, detail="Download not found")
    return _dl_dict(dl)
