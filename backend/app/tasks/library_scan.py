import logging
import os
import uuid
from datetime import datetime

from .celery_app import celery_app
from .import_pipeline import import_book_file

logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def run_library_scan(self, job_id: str, triggered_by: str = "user") -> dict:
    """Walk books_dir and import any files not yet in the DB."""
    try:
        from ..config import get_settings
        from ..database import SyncSession
        from ..models.book import Book
        from ..models.job import Job
        from ..services.file_utils import BOOK_EXTENSIONS
        from ..websocket_manager import publish_event

        settings = get_settings()

        # 1. Update Job record to running
        with SyncSession() as session:
            job = session.get(Job, job_id)
            if job is None:
                job = Job(
                    id=job_id,
                    type="library_scan",
                    label="Library scan",
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
                {"job_id": job_id, "type": "library_scan", "label": "Library scan"},
            )
        except Exception as e:
            logger.warning("run_library_scan: publish_event(job.started) failed: %s", e)

        # 3. Walk books_dir
        books_dir = settings.books_dir
        if not os.path.isdir(books_dir):
            logger.warning("run_library_scan: books_dir does not exist: %s", books_dir)
            _finish_job(job_id, "completed", {"found": 0, "imported": 0, "skipped": 0, "failed": 0})
            try:
                publish_event(
                    "job.completed",
                    {"job_id": job_id, "summary": {"found": 0, "imported": 0, "skipped": 0, "failed": 0}},
                )
            except Exception:
                pass
            return {"found": 0, "imported": 0, "skipped": 0, "failed": 0}

        covers_dir = settings.covers_dir
        all_files: list[str] = []
        for root, dirs, files in os.walk(books_dir):
            # Skip the .covers directory
            dirs[:] = [d for d in dirs if os.path.join(root, d) != covers_dir and d != ".covers"]
            for fname in files:
                ext = os.path.splitext(fname)[1].lower()
                if ext in BOOK_EXTENSIONS:
                    all_files.append(os.path.join(root, fname))

        # 4. Query existing file_paths
        with SyncSession() as session:
            existing_paths: set[str] = {
                row[0] for row in session.query(Book.file_path).all()
            }

        new_files = [f for f in all_files if f not in existing_paths]
        total = len(new_files)
        found = len(all_files)
        imported = 0
        skipped = 0
        failed = 0

        # 5. Process each new file
        for idx, file_path in enumerate(new_files):
            rel_path = os.path.relpath(file_path, books_dir)
            pct = int((idx / total) * 100) if total > 0 else 100

            try:
                publish_event(
                    "job.progress",
                    {"job_id": job_id, "message": f"Indexing: {rel_path}", "percent": pct},
                )
            except Exception:
                pass

            # Call import logic directly (not via .delay()) for inline progress tracking
            result = import_book_file.run(file_path, job_id)

            if result.get("skipped"):
                skipped += 1
            elif result.get("error"):
                failed += 1
                logger.warning("run_library_scan: import failed for %s: %s", file_path, result["error"])
            else:
                imported += 1

        summary = {"found": found, "imported": imported, "skipped": skipped, "failed": failed}

        # 6. Update Job record
        _finish_job(job_id, "completed", summary)

        # 7. Publish completed
        try:
            publish_event("job.completed", {"job_id": job_id, "summary": summary})
        except Exception as e:
            logger.warning("run_library_scan: publish_event(job.completed) failed: %s", e)

        # 8. If new books were imported, kick off a single tracked enrichment job
        if imported > 0:
            try:
                from ..models.job import Job
                from .metadata_enrich import enrich_library_metadata

                enrich_job_id = str(uuid.uuid4())
                with SyncSession() as session:
                    session.add(Job(
                        id=enrich_job_id,
                        type="metadata_enrich",
                        label="Library metadata enrichment",
                        status="pending",
                        triggered_by="scan",
                    ))
                    session.commit()
                enrich_library_metadata.delay(enrich_job_id)
            except Exception as e:
                logger.warning("run_library_scan: could not enqueue enrichment job: %s", e)

        return summary

    except Exception as e:
        logger.exception("run_library_scan: unexpected error: %s", e)
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
