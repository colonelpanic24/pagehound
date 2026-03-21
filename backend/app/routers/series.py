from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.book import Book
from ..models.series import Series
from ..routers.books import _book_to_dict

router = APIRouter(prefix="/series", tags=["series"])


class MergeSeriesRequest(BaseModel):
    series_ids: list[int]
    new_name: str


@router.get("/")
async def list_series(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Series).options(
            selectinload(Series.books).options(
                selectinload(Book.authors),
                selectinload(Book.series),
            )
        )
    )
    all_series = result.scalars().all()

    out = []
    for s in all_series:
        if not s.books:
            continue
        books_sorted = sorted(s.books, key=lambda b: (b.series_index or 9999, b.id))
        cover_book = books_sorted[0]
        out.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "book_count": len(s.books),
            "cover_book_id": cover_book.id,
            "cover_image_path": cover_book.cover_image_path,
        })

    out.sort(key=lambda s: s["name"].lower())
    return out


@router.get("/{series_id}")
async def get_series(series_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Series)
        .options(
            selectinload(Series.books).options(
                selectinload(Book.authors),
                selectinload(Book.series),
            )
        )
        .where(Series.id == series_id)
    )
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    books_sorted = sorted(series.books, key=lambda b: (b.series_index or 9999, b.id))
    return {
        "id": series.id,
        "name": series.name,
        "description": series.description,
        "books": [_book_to_dict(b) for b in books_sorted],
    }


@router.post("/merge")
async def merge_series(body: MergeSeriesRequest, db: AsyncSession = Depends(get_db)):
    """Merge multiple series into one, reassigning all books."""
    if len(body.series_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two series required")

    new_name = body.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="new_name is required")

    # Load all selected series with their books
    result = await db.execute(
        select(Series)
        .options(selectinload(Series.books))
        .where(Series.id.in_(body.series_ids))
    )
    all_series = result.scalars().all()
    if len(all_series) < 2:
        raise HTTPException(status_code=404, detail="One or more series not found")

    # Find or create the target series (prefer existing with matching name)
    new_name_lower = new_name.lower()
    target = next((s for s in all_series if s.name.lower() == new_name_lower), None)
    if target is None:
        existing = await db.execute(select(Series).where(Series.name == new_name))
        target = existing.scalar_one_or_none()
        if target is None:
            target = Series(name=new_name)
            db.add(target)
            await db.flush()

    others = [s for s in all_series if s.id != target.id]

    # Reassign books from each non-target series to the target
    for old_series in others:
        for book in list(old_series.books):
            book.series = target

    # Delete the merged-away series
    for old_series in others:
        await db.delete(old_series)

    await db.commit()
    return {"merged_into": target.id, "name": target.name}
