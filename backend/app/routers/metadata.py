"""Metadata enrichment and review queue endpoints."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.book import Book
from ..models.job import Job
from ..models.metadata_review import MetadataReview
from ..websocket_manager import ws_manager
from .books import _book_to_dict

router = APIRouter(prefix="/metadata", tags=["metadata"])


# ── Serialisation ─────────────────────────────────────────────────────────────

def _review_to_dict(review: MetadataReview) -> dict:
    book = review.book
    return {
        "id": review.id,
        "book_id": review.book_id,
        "status": review.status,
        "candidates": review.candidates,
        "suggested_fields": review.suggested_fields,
        "suggested_confidence": review.suggested_confidence,
        "created_at": review.created_at.isoformat(),
        "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
        "book": {
            "id": book.id,
            "title": book.title,
            "subtitle": book.subtitle,
            "description": book.description,
            "isbn_10": book.isbn_10,
            "isbn_13": book.isbn_13,
            "publisher": book.publisher,
            "published_date": book.published_date,
            "language": book.language,
            "page_count": book.page_count,
            "cover_image_path": book.cover_image_path,
            "metadata_source": book.metadata_source,
            "metadata_confidence": book.metadata_confidence,
            "authors": [{"id": a.id, "name": a.name} for a in book.authors],
        },
    }


# ── Review queue ──────────────────────────────────────────────────────────────

@router.get("/review")
async def list_reviews(status: str = "pending", db: AsyncSession = Depends(get_db)):
    """List metadata reviews, default to pending ones."""
    result = await db.execute(
        select(MetadataReview)
        .where(MetadataReview.status == status)
        .options(selectinload(MetadataReview.book).selectinload(Book.authors))
        .order_by(MetadataReview.created_at.desc())
    )
    reviews = result.scalars().all()
    return [_review_to_dict(r) for r in reviews]


@router.get("/review/{review_id}")
async def get_review(review_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MetadataReview)
        .where(MetadataReview.id == review_id)
        .options(selectinload(MetadataReview.book).selectinload(Book.authors))
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return _review_to_dict(review)


class ApproveBody(BaseModel):
    fields: dict | None = None  # explicit field set; if absent, all suggested_fields are applied


@router.post("/review/{review_id}/approve")
async def approve_review(
    review_id: int,
    body: ApproveBody | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Approve a review. Pass {fields: {...}} to apply only selected fields."""
    result = await db.execute(
        select(MetadataReview)
        .where(MetadataReview.id == review_id)
        .options(selectinload(MetadataReview.book).selectinload(Book.authors))
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.status != "pending":
        raise HTTPException(status_code=409, detail=f"Review already {review.status}")

    # Use caller-supplied field set when provided, otherwise apply all suggested fields
    if body and body.fields is not None:
        fields = body.fields
    else:
        fields = dict(review.suggested_fields)

    book = review.book
    allowed = {
        "title", "subtitle", "description", "isbn_10", "isbn_13",
        "publisher", "published_date", "language", "page_count",
    }
    for field, value in fields.items():
        if field in allowed:
            setattr(book, field, value)

    # Pick best candidate for source/confidence
    candidates = review.candidates or []
    best = max(candidates, key=lambda c: c.get("confidence", 0), default={})
    book.metadata_source = best.get("source", "review")
    book.metadata_confidence = review.suggested_confidence
    book.modified_date = datetime.utcnow()

    review.status = "approved"
    review.reviewed_at = datetime.utcnow()
    await db.commit()

    # Reload with eager-loaded relationships for the WS broadcast
    await db.refresh(book)
    result2 = await db.execute(
        select(Book)
        .where(Book.id == book.id)
        .options(selectinload(Book.authors), selectinload(Book.series))
    )
    book = result2.scalar_one()
    book_dict = _book_to_dict(book)
    await ws_manager.broadcast("metadata.enriched", {"book": book_dict})
    return {"ok": True, "book": book_dict}


@router.post("/review/{review_id}/reject")
async def reject_review(review_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MetadataReview).where(MetadataReview.id == review_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.status != "pending":
        raise HTTPException(status_code=409, detail=f"Review already {review.status}")

    review.status = "rejected"
    review.reviewed_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Enrichment triggers ───────────────────────────────────────────────────────

@router.post("/enrich/{book_id}")
async def enrich_book(book_id: int, db: AsyncSession = Depends(get_db)):
    """Queue metadata enrichment for a single book."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Book not found")

    from ..tasks.metadata_enrich import enrich_book_metadata
    enrich_book_metadata.delay(book_id)
    return {"queued": True, "book_id": book_id}


@router.post("/enrich-all")
async def enrich_all(db: AsyncSession = Depends(get_db)):
    """Queue enrichment for all books that have no metadata_source."""
    from ..tasks.metadata_enrich import enrich_library_metadata

    result = await db.execute(
        select(Book).where(Book.metadata_source.is_(None))
    )
    count = len(result.scalars().all())

    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        type="metadata_enrich",
        label="Library metadata enrichment",
        status="pending",
        triggered_by="user",
    )
    db.add(job)
    await db.commit()

    enrich_library_metadata.delay(job_id)
    return {"job_id": job_id, "queued": count}
