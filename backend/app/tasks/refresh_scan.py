import logging
import os
from datetime import datetime

from .celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def run_refresh_scan(self, job_id: str, triggered_by: str = "user") -> dict:
    """Re-check all books in DB: mark missing files and re-extract changed metadata."""
    try:
        from ..config import get_settings
        from ..database import SyncSession
        from ..models.book import Book
        from ..models.job import Job
        from ..services import cover_extractor
        from ..services.file_utils import compute_sort_name, compute_sort_title, detect_format
        from ..websocket_manager import publish_event

        settings = get_settings()

        # 1. Update Job record to running
        with SyncSession() as session:
            job = session.get(Job, job_id)
            if job is None:
                job = Job(
                    id=job_id,
                    type="refresh_scan",
                    label="Refresh scan",
                    status="running",
                    triggered_by=triggered_by,
                    started_at=datetime.utcnow(),
                )
                session.add(job)
            else:
                job.status = "running"
                job.started_at = datetime.utcnow()
            session.commit()

        # 2. Publish job started
        try:
            publish_event(
                "job.started",
                {"job_id": job_id, "type": "refresh_scan", "label": "Refresh scan"},
            )
        except Exception as e:
            logger.warning("run_refresh_scan: publish_event(job.started) failed: %s", e)

        # 3. Query all books
        with SyncSession() as session:
            books = session.query(Book).all()
            book_ids = [b.id for b in books]
            book_data = {
                b.id: {
                    "file_path": b.file_path,
                    "modified_date": b.modified_date,
                    "file_format": b.file_format,
                }
                for b in books
            }

        total = len(book_ids)
        checked = 0
        updated = 0
        missing = 0
        unchanged = 0

        # 4. Process each book
        for idx, book_id in enumerate(book_ids):
            info = book_data[book_id]
            file_path = info["file_path"]
            pct = int((idx / total) * 100) if total > 0 else 100

            try:
                publish_event(
                    "job.progress",
                    {
                        "job_id": job_id,
                        "message": f"Checking: {os.path.basename(file_path)}",
                        "percent": pct,
                    },
                )
            except Exception:
                pass

            checked += 1

            if not os.path.exists(file_path):
                # Mark as missing
                with SyncSession() as session:
                    book = session.get(Book, book_id)
                    if book and not book.is_missing:
                        book.is_missing = True
                        session.commit()
                try:
                    publish_event("library.book_removed", {"book_id": book_id})
                except Exception:
                    pass
                missing += 1
                continue

            # Check if mtime has changed since last import
            try:
                mtime = datetime.utcfromtimestamp(os.path.getmtime(file_path))
                recorded_mtime = info["modified_date"]

                # Allow a 2-second tolerance for filesystem precision
                mtime_changed = recorded_mtime is None or abs((mtime - recorded_mtime).total_seconds()) > 2
            except OSError:
                mtime_changed = False

            if not mtime_changed:
                unchanged += 1
                continue

            # Re-extract metadata and update book
            file_format = info["file_format"] or detect_format(file_path)
            try:
                if file_format == "epub":
                    from ..services import epub_handler
                    meta = epub_handler.extract_metadata(file_path)
                elif file_format == "pdf":
                    from ..services import pdf_handler
                    meta = pdf_handler.extract_metadata(file_path)
                else:
                    from ..services import mobi_handler
                    meta = mobi_handler.extract_metadata(file_path)
            except Exception as e:
                logger.warning("run_refresh_scan: metadata extraction failed for %s: %s", file_path, e)
                unchanged += 1
                continue

            with SyncSession() as session:
                from ..models.author import Author

                book = session.get(Book, book_id)
                if not book:
                    continue

                raw_title = meta.get("title") or book.title
                book.title = raw_title
                book.sort_title = compute_sort_title(raw_title)
                book.description = meta.get("description") or book.description
                book.language = meta.get("language") or book.language
                book.publisher = meta.get("publisher") or book.publisher
                book.published_date = meta.get("published_date") or book.published_date
                book.page_count = meta.get("page_count") or book.page_count
                book.is_missing = False
                book.modified_date = mtime

                # Update authors if any returned
                author_names: list[str] = meta.get("authors") or []
                if author_names:
                    author_objects = []
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
                    book.authors = author_objects

                # Update cover if new cover data available
                cover_data = meta.get("cover_data")
                if cover_data:
                    rel_path = cover_extractor.save_cover(book.id, cover_data, settings.covers_dir)
                    if rel_path:
                        book.cover_image_path = rel_path

                session.commit()

            updated += 1

        summary = {
            "checked": checked,
            "updated": updated,
            "missing": missing,
            "unchanged": unchanged,
        }

        # 5. Update Job record
        _finish_job(job_id, "completed", summary)

        # Publish completed
        try:
            publish_event("job.completed", {"job_id": job_id, "summary": summary})
        except Exception as e:
            logger.warning("run_refresh_scan: publish_event(job.completed) failed: %s", e)

        return summary

    except Exception as e:
        logger.exception("run_refresh_scan: unexpected error: %s", e)
        _finish_job(job_id, "failed", {}, error=str(e))
        return {"error": str(e)}


def _finish_job(job_id: str, status: str, summary: dict, error: str | None = None) -> None:
    try:
        from ..database import SyncSession
        from ..models.job import Job

        with SyncSession() as session:
            job = session.get(Job, job_id)
            if job:
                job.status = status
                job.finished_at = datetime.utcnow()
                job.summary = summary
                if error:
                    job.error = error
                session.commit()
    except Exception as e:
        logger.warning("_finish_job: could not update job %s: %s", job_id, e)
