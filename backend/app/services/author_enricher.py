"""Fetch author bio and photo from Open Library."""
import io
import logging
import os

import httpx

logger = logging.getLogger(__name__)

MAX_PHOTO_WIDTH = 400

_OL_SEARCH = "https://openlibrary.org/search/authors.json"
_OL_AUTHOR = "https://openlibrary.org/authors/{olid}.json"
_OL_PHOTO  = "https://covers.openlibrary.org/a/olid/{olid}-L.jpg"


def _find_olid(name: str) -> str | None:
    try:
        resp = httpx.get(_OL_SEARCH, params={"q": name, "limit": 1}, timeout=10)
        resp.raise_for_status()
        docs = resp.json().get("docs", [])
        if docs:
            key = docs[0].get("key", "")          # e.g. "/authors/OL1234567A"
            return key.split("/")[-1] if key else None
    except Exception as e:
        logger.warning("author_enricher: OL search failed for %r: %s", name, e)
    return None


def _fetch_bio(olid: str) -> str | None:
    try:
        resp = httpx.get(_OL_AUTHOR.format(olid=olid), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        bio = data.get("bio")
        if isinstance(bio, dict):
            return bio.get("value")
        if isinstance(bio, str):
            return bio
    except Exception as e:
        logger.warning("author_enricher: OL author detail failed for %s: %s", olid, e)
    return None


def _download_photo(olid: str, dest_path: str) -> bool:
    try:
        resp = httpx.get(_OL_PHOTO.format(olid=olid), timeout=15, follow_redirects=True)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image/"):
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            _save_resized(resp.content, dest_path)
            return True
    except Exception as e:
        logger.warning("author_enricher: photo download failed for %s: %s", olid, e)
    return False


def _save_resized(data: bytes, dest_path: str) -> None:
    """Save image data as JPEG, resizing down to MAX_PHOTO_WIDTH if needed."""
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    width, height = img.size
    if width > MAX_PHOTO_WIDTH:
        new_height = int(height * MAX_PHOTO_WIDTH / width)
        img = img.resize((MAX_PHOTO_WIDTH, new_height), Image.LANCZOS)
    img.save(dest_path, "JPEG", quality=85, optimize=True)


def enrich_author(author_id: int, author_name: str, photos_dir: str) -> dict:
    """Look up an author on Open Library. Returns dict with bio and photo_url."""
    result: dict = {"bio": None, "photo_url": None}

    olid = _find_olid(author_name)
    if not olid:
        return result

    result["bio"] = _fetch_bio(olid)

    dest_path = os.path.join(photos_dir, f"{author_id}.jpg")
    if _download_photo(olid, dest_path):
        result["photo_url"] = f"/author-photos/{author_id}.jpg"

    return result
