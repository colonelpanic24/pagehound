import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.author import Author
from ..models.book import Book, book_authors
from ..routers.books import _book_to_dict
from ..services.file_utils import compute_sort_name

router = APIRouter(prefix="/authors", tags=["authors"])


class MergeAuthorsRequest(BaseModel):
    author_ids: list[int]
    new_name: str


@router.get("/")
async def list_authors(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Author, func.count(book_authors.c.book_id).label("book_count"))
        .outerjoin(book_authors, book_authors.c.author_id == Author.id)
        .group_by(Author.id)
        .having(func.count(book_authors.c.book_id) > 0)
    )
    out = [
        {
            "id": a.id,
            "name": a.name,
            "sort_name": a.sort_name,
            "book_count": count,
            "photo_url": a.photo_url,
        }
        for a, count in rows
    ]
    out.sort(key=lambda a: a["sort_name"].lower())
    return out


@router.get("/{author_id}")
async def get_author(author_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Author)
        .options(
            selectinload(Author.books).options(
                selectinload(Book.authors),
                selectinload(Book.series),
            )
        )
        .where(Author.id == author_id)
    )
    author = result.scalar_one_or_none()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    books_sorted = sorted(author.books, key=lambda b: b.sort_title)
    return {
        "id": author.id,
        "name": author.name,
        "sort_name": author.sort_name,
        "photo_url": author.photo_url,
        "bio": author.bio,
        "books": [_book_to_dict(b) for b in books_sorted],
    }


@router.get("/{author_id}/discover")
async def discover_author_books(author_id: int, db: AsyncSession = Depends(get_db)):
    """Return Google Books results for this author not already in our library."""
    from ..config import get_settings
    from ..services.metadata import google_books

    result = await db.execute(
        select(Author).options(selectinload(Author.books)).where(Author.id == author_id)
    )
    author = result.scalar_one_or_none()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    settings = get_settings()
    library_isbns: set[str] = set()
    library_titles: set[str] = set()
    for b in author.books:
        if b.isbn_13:
            library_isbns.add(b.isbn_13)
        if b.isbn_10:
            library_isbns.add(b.isbn_10)
        library_titles.add(b.title.lower().strip())

    loop = asyncio.get_event_loop()
    candidates = await loop.run_in_executor(
        None,
        lambda: google_books.search_by_author(author.name, settings.google_books_api_key),
    )

    out = []
    for c in candidates:
        if c.isbn_13 and c.isbn_13 in library_isbns:
            continue
        if c.isbn_10 and c.isbn_10 in library_isbns:
            continue
        if c.title and c.title.lower().strip() in library_titles:
            continue
        out.append({
            "title": c.title,
            "authors": c.authors,
            "published_date": c.published_date,
            "cover_url": c.cover_url,
            "isbn_13": c.isbn_13,
            "isbn_10": c.isbn_10,
            "description": c.description,
        })

    return out


@router.post("/{author_id}/enrich-photo")
async def enrich_author_photo(author_id: int, db: AsyncSession = Depends(get_db)):
    """Queue a task to fetch photo + bio for this author from Open Library."""
    from ..tasks.enrich_authors import enrich_author_task

    result = await db.execute(select(Author).where(Author.id == author_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Author not found")

    enrich_author_task.delay(author_id)
    return {"queued": author_id}


@router.post("/enrich-photos")
async def enrich_all_photos():
    """Queue photo + bio fetch for all authors that don't have a photo yet."""
    from ..tasks.enrich_authors import enrich_all_authors_task

    enrich_all_authors_task.delay()
    return {"queued": True}


@router.post("/merge")
async def merge_authors(body: MergeAuthorsRequest, db: AsyncSession = Depends(get_db)):
    """Merge multiple authors into one, reassigning all books."""
    if len(body.author_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two authors required")

    new_name = body.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="new_name is required")

    # Load all selected authors with their books
    result = await db.execute(
        select(Author)
        .options(selectinload(Author.books))
        .where(Author.id.in_(body.author_ids))
    )
    authors = result.scalars().all()
    if len(authors) < 2:
        raise HTTPException(status_code=404, detail="One or more authors not found")

    # Find or create the target author (prefer existing author with matching name)
    new_name_lower = new_name.lower()
    target = next((a for a in authors if a.name.lower() == new_name_lower), None)
    if target is None:
        # Check if an author with this name already exists outside the selection
        existing = await db.execute(select(Author).where(Author.name == new_name))
        target = existing.scalar_one_or_none()
        if target is None:
            target = Author(name=new_name, sort_name=compute_sort_name(new_name))
            db.add(target)
            await db.flush()  # get target.id

    others = [a for a in authors if a.id != target.id]

    # Reassign books from each non-target author to the target
    for old_author in others:
        for book in list(old_author.books):
            if target not in book.authors:
                book.authors.append(target)
            book.authors.remove(old_author)

    # Delete the merged-away authors
    for old_author in others:
        await db.delete(old_author)

    await db.commit()
    return {"merged_into": target.id, "name": target.name}
