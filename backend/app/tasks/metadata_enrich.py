"""Celery tasks for metadata enrichment."""
import logging
from datetime import datetime

from .celery_app import celery_app
from .import_pipeline import book_to_dict

logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def enrich_book_metadata(self, book_id: int) -> dict:
    """Fetch metadata from Google Books + Open Library for a single book.

    Returns one of:
        {"auto_applied": True, "confidence": int, "source": str}
        {"review_needed": True, "review_id": int, "confidence": int}
        {"skipped": True, "reason": str}
        {"error": str}
    """
    try:
        return _enrich(book_id)
    except Exception as exc:
        logger.exception("enrich_book_metadata: unexpected error for book %s", book_id)
        return {"error": str(exc)}


@celery_app.task(bind=True)
def enrich_library_metadata(self, job_id: str) -> dict:
    """Enrich all books that have no metadata_source yet."""
    try:
        from ..database import SyncSession
        from ..models.book import Book
        from ..models.job import Job
        from ..websocket_manager import publish_event

        with SyncSession() as db:
            job = db.get(Job, job_id)
            if job:
                job.status = "running"
                job.started_at = datetime.utcnow()
                db.commit()

        publish_event(
            "job.started",
            {"job_id": job_id, "type": "metadata_enrich", "label": "Library metadata enrichment"},
        )

        with SyncSession() as db:
            book_ids = [
                row[0]
                for row in db.query(Book.id)
                .filter(Book.metadata_source.is_(None))
                .all()
            ]

        total = len(book_ids)
        auto_applied = 0
        review_needed = 0
        failed = 0

        for idx, bid in enumerate(book_ids):
            result = _enrich(bid)
            if result.get("auto_applied"):
                auto_applied += 1
            elif result.get("review_needed"):
                review_needed += 1
            elif result.get("error"):
                failed += 1

            percent = round((idx + 1) / total * 100) if total else 100
            try:
                publish_event(
                    "job.progress",
                    {"job_id": job_id, "message": f"Enriching {idx + 1}/{total}", "percent": percent},
                )
            except Exception:
                pass

        summary = {
            "total": total,
            "auto_applied": auto_applied,
            "review_needed": review_needed,
            "failed": failed,
        }

        with SyncSession() as db:
            job = db.get(Job, job_id)
            if job:
                job.status = "completed"
                job.finished_at = datetime.utcnow()
                job.summary = summary
                db.commit()

        publish_event("job.completed", {"job_id": job_id, "summary": summary})
        return summary

    except Exception as exc:
        logger.exception("enrich_library_metadata: unexpected error")
        try:
            from ..database import SyncSession
            from ..models.job import Job

            with SyncSession() as db:
                job = db.get(Job, job_id)
                if job:
                    job.status = "failed"
                    job.finished_at = datetime.utcnow()
                    job.error = str(exc)
                    db.commit()
        except Exception:
            pass
        return {"error": str(exc)}


# ── Core enrichment logic ─────────────────────────────────────────────────────

def _enrich(book_id: int) -> dict:
    from ..config import get_settings
    from ..database import SyncSession
    from ..models.book import Book
    from ..models.metadata_review import MetadataReview
    from ..services import confidence as conf_svc
    from ..services import merger as merger_svc
    from ..services.metadata import google_books, open_library
    from ..websocket_manager import publish_event

    settings = get_settings()

    with SyncSession() as db:
        book = db.query(Book).filter(Book.id == book_id).first()
        if not book:
            return {"skipped": True, "reason": "book not found"}

        # Already enriched with high confidence — skip
        if (
            book.metadata_source
            and book.metadata_confidence is not None
            and book.metadata_confidence >= settings.auto_apply_threshold
        ):
            return {"skipped": True, "reason": "already enriched"}

        title = book.title
        authors = [a.name for a in (book.authors or [])]
        isbn_13 = book.isbn_13
        isbn_10 = book.isbn_10

    # ── Fetch candidates from both sources ────────────────────────────────────
    candidates = []

    try:
        gb = google_books.search(title, authors, isbn_13, isbn_10, settings.google_books_api_key)
        candidates.extend(gb)
    except Exception as exc:
        logger.warning("Google Books failed for book %s: %s", book_id, exc)

    try:
        ol = open_library.search(title, authors, isbn_13, isbn_10)
        candidates.extend(ol)
    except Exception as exc:
        logger.warning("Open Library failed for book %s: %s", book_id, exc)

    if not candidates:
        return {"skipped": True, "reason": "no candidates found"}

    # ── Score each candidate ──────────────────────────────────────────────────
    with SyncSession() as db:
        book = db.query(Book).filter(Book.id == book_id).first()
        scored = sorted(
            [(c, conf_svc.score(c, book)) for c in candidates],
            key=lambda x: x[1],
            reverse=True,
        )
        best_candidate, best_score = scored[0]
        all_candidates = [dict(**c, confidence=s) for c, s in scored]
        suggested_fields = merger_svc.merge(book, best_candidate, settings.metadata_strategy)

        if best_score >= settings.auto_apply_threshold:
            # ── Auto-apply ────────────────────────────────────────────────────
            for field, value in suggested_fields.items():
                setattr(book, field, value)
            book.metadata_source = best_candidate.get("source", "unknown")
            book.metadata_confidence = best_score
            book.modified_date = datetime.utcnow()

            # Try to download cover if none exists
            cover_url = best_candidate.get("cover_url")
            if cover_url and not book.cover_image_path:
                _try_download_cover(book, cover_url, settings.covers_dir, db)

            db.commit()
            db.refresh(book)
            bdict = book_to_dict(book)
            source = book.metadata_source

        else:
            # ── Queue for review ──────────────────────────────────────────────
            existing = (
                db.query(MetadataReview)
                .filter_by(book_id=book_id, status="pending")
                .first()
            )
            if existing:
                db.delete(existing)
                db.flush()

            review = MetadataReview(
                book_id=book_id,
                status="pending",
                candidates=all_candidates,
                suggested_fields=suggested_fields,
                suggested_confidence=best_score,
            )
            db.add(review)
            db.commit()
            db.refresh(review)

            try:
                publish_event(
                    "metadata.review_needed",
                    {"review_id": review.id, "book_id": book_id, "confidence": best_score},
                )
            except Exception:
                pass
            return {"review_needed": True, "review_id": review.id, "confidence": best_score}

    try:
        publish_event("metadata.enriched", {"book": bdict})
    except Exception:
        pass
    return {"auto_applied": True, "confidence": best_score, "source": source}


def _try_download_cover(book, cover_url: str, covers_dir: str, db) -> None:
    try:
        import httpx

        from ..services import cover_extractor

        data = httpx.get(cover_url, timeout=10, follow_redirects=True).content
        rel_path = cover_extractor.save_cover(book.id, data, covers_dir)
        if rel_path:
            book.cover_image_path = rel_path
    except Exception as exc:
        logger.warning("Cover download failed for book %s: %s", book.id, exc)
