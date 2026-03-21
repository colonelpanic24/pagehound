"""Google Books API metadata search."""
import logging
import re

import httpx

from ..metadata_types import MetadataCandidate

logger = logging.getLogger(__name__)
_BASE = "https://www.googleapis.com/books/v1/volumes"


def search(
    title: str,
    authors: list[str],
    isbn_13: str | None = None,
    isbn_10: str | None = None,
    api_key: str = "",
) -> list[MetadataCandidate]:
    """Return up to 5 MetadataCandidate dicts from Google Books."""
    # ISBN search first — most precise
    if isbn_13 or isbn_10:
        isbn = isbn_13 or isbn_10
        results = _query(f"isbn:{isbn}", api_key)
        if results:
            return results[:3]

    # Title + author search
    parts = [f'intitle:"{_clean(title)}"']
    if authors:
        parts.append(f'inauthor:"{_clean(authors[0])}"')
    results = _query(" ".join(parts), api_key)
    return results[:5]


def _clean(s: str) -> str:
    return s.replace('"', "").strip()


def search_by_author(author_name: str, api_key: str = "") -> list[MetadataCandidate]:
    """Return up to 20 books by a given author name from Google Books."""
    return _query(f'inauthor:"{_clean(author_name)}"', api_key, max_results=20)


def _query(q: str, api_key: str, max_results: int = 5) -> list[MetadataCandidate]:
    params: dict = {"q": q, "maxResults": max_results, "printType": "books"}
    if api_key:
        params["key"] = api_key
    try:
        resp = httpx.get(_BASE, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Google Books query failed (%s): %s", q, exc)
        return []

    out: list[MetadataCandidate] = []
    for item in data.get("items", []):
        vi = item.get("volumeInfo", {})
        isbns = {
            entry["type"]: entry["identifier"]
            for entry in vi.get("industryIdentifiers", [])
        }
        thumbnail = (
            vi.get("imageLinks", {}).get("thumbnail")
            or vi.get("imageLinks", {}).get("smallThumbnail")
        )
        if thumbnail:
            thumbnail = re.sub(r"zoom=\d+", "zoom=1", thumbnail)
            thumbnail = thumbnail.replace("http://", "https://")

        # Normalise language to 2-letter code
        lang = vi.get("language")
        if lang and "-" in lang:
            lang = lang.split("-")[0]

        out.append(
            MetadataCandidate(
                source="google_books",
                title=vi.get("title"),
                subtitle=vi.get("subtitle"),
                authors=vi.get("authors") or [],
                description=vi.get("description"),
                isbn_10=isbns.get("ISBN_10"),
                isbn_13=isbns.get("ISBN_13"),
                publisher=vi.get("publisher"),
                published_date=vi.get("publishedDate"),
                language=lang,
                page_count=vi.get("pageCount"),
                cover_url=thumbnail,
            )
        )
    return out
