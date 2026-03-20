import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import asc, desc, distinct, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.author import Author
from ..models.book import Book

router = APIRouter(prefix="/books", tags=["books"])


def _book_to_dict(book: Book) -> dict:
    return {
        "id": book.id,
        "title": book.title,
        "sort_title": book.sort_title,
        "subtitle": book.subtitle,
        "description": book.description,
        "isbn_10": book.isbn_10,
        "isbn_13": book.isbn_13,
        "publisher": book.publisher,
        "published_date": book.published_date,
        "language": book.language,
        "page_count": book.page_count,
        "cover_image_path": book.cover_image_path,
        "file_path": book.file_path,
        "file_format": book.file_format,
        "file_size": book.file_size,
        "added_date": book.added_date.isoformat() if book.added_date else None,
        "modified_date": book.modified_date.isoformat() if book.modified_date else None,
        "metadata_source": book.metadata_source,
        "metadata_confidence": book.metadata_confidence,
        "series_id": book.series_id,
        "series_index": book.series_index,
        "is_read": book.is_read,
        "is_missing": book.is_missing,
        "rating": book.rating,
        "authors": [{"id": a.id, "name": a.name, "sort_name": a.sort_name} for a in book.authors],
        "series": {"id": book.series.id, "name": book.series.name} if book.series else None,
    }


@router.get("/formats")
async def list_formats(db: AsyncSession = Depends(get_db)):
    """Return distinct file formats present in the library."""
    result = await db.execute(select(distinct(Book.file_format)).where(Book.file_format.isnot(None)))
    formats = [row[0] for row in result.all() if row[0]]
    return sorted(formats)


@router.get("/languages")
async def list_languages(db: AsyncSession = Depends(get_db)):
    """Return distinct languages present in the library."""
    result = await db.execute(select(distinct(Book.language)).where(Book.language.isnot(None)))
    languages = [row[0] for row in result.all() if row[0]]
    return sorted(languages)


@router.get("/")
async def list_books(
    skip: int = 0,
    limit: int = 100,
    format: str | None = None,
    language: str | None = None,
    is_read: bool | None = None,
    series_id: int | None = None,
    author_id: int | None = None,
    sort: str = "added_date",
    sort_dir: str = "desc",
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Book).options(selectinload(Book.authors), selectinload(Book.series))

    # Filters
    if format is not None:
        query = query.where(Book.file_format == format)
    if language is not None:
        query = query.where(Book.language == language)
    if is_read is not None:
        query = query.where(Book.is_read == is_read)
    if series_id is not None:
        query = query.where(Book.series_id == series_id)
    if author_id is not None:
        query = query.where(Book.authors.any(Author.id == author_id))
    if q is not None:
        pattern = f"%{q}%"
        query = query.where(
            Book.title.ilike(pattern) | Book.authors.any(Author.name.ilike(pattern))
        )

    # Sorting
    sort_column_map: dict[str, Any] = {
        "title": Book.sort_title,
        "added_date": Book.added_date,
        "published_date": Book.published_date,
        "rating": Book.rating,
        "series_index": Book.series_index,
    }
    sort_col = sort_column_map.get(sort, Book.added_date)
    if sort_dir.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    books = result.scalars().all()
    return [_book_to_dict(b) for b in books]


@router.get("/{book_id}")
async def get_book(book_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Book)
        .options(selectinload(Book.authors), selectinload(Book.series))
        .where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _book_to_dict(book)


@router.patch("/{book_id}")
async def update_book(book_id: int, updates: dict, db: AsyncSession = Depends(get_db)):
    """Partially update a book record. Emits library.book_updated WebSocket event."""
    from ..websocket_manager import ws_manager

    result = await db.execute(
        select(Book)
        .options(selectinload(Book.authors), selectinload(Book.series))
        .where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Fields that may be updated via PATCH
    allowed_fields = {
        "title",
        "subtitle",
        "description",
        "isbn_10",
        "isbn_13",
        "publisher",
        "published_date",
        "language",
        "page_count",
        "cover_image_path",
        "metadata_source",
        "metadata_confidence",
        "series_id",
        "series_index",
        "is_read",
        "rating",
    }

    for field, value in updates.items():
        if field in allowed_fields:
            setattr(book, field, value)

    # Recompute sort_title if title changed
    if "title" in updates and updates["title"]:
        from ..services.file_utils import compute_sort_title
        book.sort_title = compute_sort_title(updates["title"])

    book.modified_date = datetime.utcnow()
    await db.commit()
    await db.refresh(book)

    book_dict = _book_to_dict(book)

    await ws_manager.broadcast("library.book_updated", {"book": book_dict})

    return book_dict


@router.get("/{book_id}/file")
async def serve_book_file(book_id: int, db: AsyncSession = Depends(get_db)):
    """Stream the raw book file to the browser."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.file_path or not os.path.exists(book.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    content_types: dict[str, str] = {
        "epub": "application/epub+zip",
        "pdf": "application/pdf",
        "mobi": "application/x-mobipocket-ebook",
    }
    media_type = content_types.get(book.file_format or "", "application/octet-stream")
    return FileResponse(book.file_path, media_type=media_type)


class ProgressBody(BaseModel):
    percent_complete: float
    position: str | None = None


@router.get("/{book_id}/progress")
async def get_reading_progress(book_id: int, db: AsyncSession = Depends(get_db)):
    """Return the browser reading progress for a book."""
    from ..models.reading_progress import ReadingProgress

    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.kobo_device_id == "browser",
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        return {"percent_complete": 0.0, "position": None}
    return {"percent_complete": p.percent_complete or 0.0, "position": p.last_read_position}


@router.put("/{book_id}/progress")
async def save_reading_progress(
    book_id: int, body: ProgressBody, db: AsyncSession = Depends(get_db)
):
    """Persist browser reading position for a book."""
    from ..models.reading_progress import ReadingProgress

    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.book_id == book_id,
            ReadingProgress.kobo_device_id == "browser",
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        p = ReadingProgress(book_id=book_id, kobo_device_id="browser")
        db.add(p)

    p.percent_complete = body.percent_complete
    p.last_read_position = (body.position or "")[:512]
    p.last_synced = datetime.utcnow()
    return {"ok": True}
