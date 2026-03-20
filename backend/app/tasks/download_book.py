"""Celery task for downloading a book from an external source."""
from __future__ import annotations

import logging
import os
import re
import shutil
import tempfile

import httpx

from ..websocket_manager import publish_event
from .celery_app import celery_app

logger = logging.getLogger(__name__)

_DL_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0"
    ),
    "Accept": "*/*",
}


def _safe_name(s: str, max_len: int = 80) -> str:
    """Strip characters that are unsafe in filenames."""
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", s)
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s[:max_len]


def _unique_path(path: str) -> str:
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 2
    while os.path.exists(f"{base} ({i}){ext}"):
        i += 1
    return f"{base} ({i}){ext}"


@celery_app.task(bind=True, max_retries=1, default_retry_delay=10)
def download_book(self, download_id: int) -> dict:
    """Download a book file and import it into the library."""
    from ..config import get_settings
    from ..database import SyncSession
    from ..models.download import Download
    from ..services.sources import annas_archive

    settings = get_settings()

    with SyncSession() as session:
        dl = session.get(Download, download_id)
        if not dl:
            return {"error": "download not found"}
        title = dl.title
        authors = dl.authors
        file_format = dl.file_format or "epub"
        source_id = dl.source_id
        dl.status = "downloading"
        session.commit()

    publish_event("download.progress", {"download_id": download_id, "percent": 0})

    tmp_path: str | None = None
    try:
        # Resolve download URL
        url = annas_archive.get_download_url(source_id)
        if not url:
            raise ValueError("Could not resolve a download URL for this book.")

        # Build destination filename
        safe_title = _safe_name(title)
        safe_author = _safe_name(authors)
        ext = file_format.lstrip(".")
        if safe_author:
            base_name = f"{safe_title} - {safe_author}.{ext}"
        else:
            base_name = f"{safe_title}.{ext}"
        os.makedirs(settings.books_dir, exist_ok=True)
        dest_path = _unique_path(os.path.join(settings.books_dir, base_name))

        # Download to a temp file then move atomically
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp_path = tmp.name

        with httpx.Client(
            headers=_DL_HEADERS,
            follow_redirects=True,
            timeout=httpx.Timeout(connect=30, read=600, write=60, pool=30),
        ) as client:
            with client.stream("GET", url) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                last_reported = -1
                with open(tmp_path, "wb") as fh:
                    for chunk in resp.iter_bytes(chunk_size=65_536):
                        fh.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            percent = min(int(downloaded / total * 100), 99)
                            if percent - last_reported >= 5:
                                last_reported = percent
                                _set_progress(download_id, percent)
                                publish_event(
                                    "download.progress",
                                    {
                                        "download_id": download_id,
                                        "percent": percent,
                                        "bytes_downloaded": downloaded,
                                        "bytes_total": total,
                                    },
                                )

        shutil.move(tmp_path, dest_path)
        tmp_path = None

        # Mark done
        with SyncSession() as session:
            dl = session.get(Download, download_id)
            if dl:
                dl.status = "done"
                dl.progress = 100
                dl.file_path = dest_path
                session.commit()

        publish_event(
            "download.completed",
            {"download_id": download_id, "title": title, "file_path": dest_path},
        )

        # Hand off to import pipeline
        from .import_pipeline import import_book_file

        import_book_file.delay(dest_path)

        return {"ok": True, "file_path": dest_path}

    except Exception as exc:
        error_msg = str(exc)
        logger.exception("download_book failed for download_id=%s", download_id)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        with SyncSession() as session:
            dl = session.get(Download, download_id)
            if dl:
                dl.status = "failed"
                dl.error = error_msg
                session.commit()
        publish_event(
            "download.failed",
            {"download_id": download_id, "title": title, "error": error_msg},
        )
        return {"error": error_msg}


def _set_progress(download_id: int, percent: int) -> None:
    from ..database import SyncSession
    from ..models.download import Download

    with SyncSession() as session:
        dl = session.get(Download, download_id)
        if dl:
            dl.progress = percent
            session.commit()
