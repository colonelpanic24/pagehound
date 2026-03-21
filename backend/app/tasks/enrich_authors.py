"""Celery tasks for enriching author metadata from Open Library."""
import logging

from .celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def enrich_author_task(self, author_id: int) -> dict:
    """Fetch photo and bio for a single author from Open Library."""
    try:
        from ..config import get_settings
        from ..database import SyncSession
        from ..models.author import Author
        from ..services.author_enricher import enrich_author

        settings = get_settings()
        photos_dir = settings.author_photos_dir
        if not photos_dir:
            import os
            photos_dir = os.path.join(os.path.dirname(settings.covers_dir or "/tmp"), "author-photos")

        with SyncSession() as session:
            author = session.get(Author, author_id)
            if not author:
                return {"error": f"Author {author_id} not found"}

            result = enrich_author(author_id, author.name, photos_dir)

            if result["bio"] and not author.bio:
                author.bio = result["bio"]
            if result["photo_url"]:
                author.photo_url = result["photo_url"]

            session.commit()
            return {"author_id": author_id, "photo": result["photo_url"], "bio": bool(result["bio"])}

    except Exception as e:
        logger.exception("enrich_author_task failed for author %d: %s", author_id, e)
        return {"error": str(e)}


@celery_app.task(bind=True)
def enrich_all_authors_task(self) -> dict:
    """Fetch photos and bios for all authors that don't have them yet."""
    try:
        from ..database import SyncSession
        from ..models.author import Author

        with SyncSession() as session:
            rows = session.query(Author.id).filter(Author.photo_url == None).all()  # noqa: E711
            author_ids = [r.id for r in rows]

        for author_id in author_ids:
            enrich_author_task.delay(author_id)

        return {"queued": len(author_ids)}

    except Exception as e:
        logger.exception("enrich_all_authors_task failed: %s", e)
        return {"error": str(e)}
