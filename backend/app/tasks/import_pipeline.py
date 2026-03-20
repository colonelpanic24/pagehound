import logging
import os
from datetime import datetime

from .celery_app import celery_app

logger = logging.getLogger(__name__)


def book_to_dict(book) -> dict:
    """Serialize a Book ORM instance to a plain dict (same shape as /api/books/ endpoint)."""
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
        "authors": [{"id": a.id, "name": a.name, "sort_name": a.sort_name} for a in (book.authors or [])],
        "series": {"id": book.series.id, "name": book.series.name} if book.series else None,
    }


@celery_app.task(bind=True)
def import_book_file(self, file_path: str, job_id: str | None = None) -> dict:
    """Import a single book file into the library.

    Returns:
        {"skipped": True}  — already in DB or unrecognised format
        {"book_id": int, "title": str}  — successfully imported
        {"error": str}  — unexpected failure
    """
    try:
        from ..config import get_settings
        from ..database import SyncSession
        from ..models.author import Author
        from ..models.book import Book
        from ..services import cover_extractor
        from ..services.file_utils import compute_sort_name, compute_sort_title, detect_format
        from ..websocket_manager import publish_event

        settings = get_settings()

        # 1. Check if already in DB
        with SyncSession() as session:
            existing = session.query(Book).filter(Book.file_path == file_path).first()
            if existing:
                return {"skipped": True}

        # 2. Detect format
        file_format = detect_format(file_path)
        if not file_format:
            logger.debug("import_book_file: unrecognised format for %s", file_path)
            return {"skipped": True}

        # 3. Extract metadata
        if file_format == "epub":
            from ..services import epub_handler
            meta = epub_handler.extract_metadata(file_path)
        elif file_format == "pdf":
            from ..services import pdf_handler
            meta = pdf_handler.extract_metadata(file_path)
        else:
            from ..services import mobi_handler
            meta = mobi_handler.extract_metadata(file_path)

        # 4. File size
        try:
            file_size = os.path.getsize(file_path)
        except OSError:
            file_size = None

        # 5. Persist to DB
        with SyncSession() as session:
            # 5a. Find or create Author records
            author_names: list[str] = meta.get("authors") or []
            author_objects: list[Author] = []
            for author_name in author_names:
                if not author_name:
                    continue
                sort_name = compute_sort_name(author_name)
                author = session.query(Author).filter(Author.name == author_name).first()
                if not author:
                    author = Author(name=author_name, sort_name=sort_name)
                    session.add(author)
                    session.flush()
                author_objects.append(author)

            # Fall back to filename-derived title if metadata has none
            raw_title: str = meta.get("title") or os.path.splitext(os.path.basename(file_path))[0]

            # 5b. Create Book record
            book = Book(
                title=raw_title,
                sort_title=compute_sort_title(raw_title),
                description=meta.get("description"),
                language=meta.get("language"),
                publisher=meta.get("publisher"),
                published_date=meta.get("published_date"),
                page_count=meta.get("page_count"),
                file_path=file_path,
                file_format=file_format,
                file_size=file_size,
                added_date=datetime.utcnow(),
                modified_date=datetime.utcnow(),
                authors=author_objects,
            )
            session.add(book)
            session.flush()  # get book.id before cover save

            # 5c. Save cover
            cover_data = meta.get("cover_data")
            if cover_data:
                rel_path = cover_extractor.save_cover(book.id, cover_data, settings.covers_dir)
                if rel_path:
                    book.cover_image_path = rel_path

            session.commit()
            session.refresh(book)

            book_dict = book_to_dict(book)
            book_id = book.id
            book_title = book.title

        # 6. Publish WS event
        try:
            publish_event("library.book_added", {"book": book_dict})
        except Exception as pub_err:
            logger.warning("import_book_file: publish_event failed: %s", pub_err)

        # 7. Return
        return {"book_id": book_id, "title": book_title}

    except Exception as e:
        logger.exception("import_book_file: unexpected error for %s: %s", file_path, e)
        return {"error": str(e)}
