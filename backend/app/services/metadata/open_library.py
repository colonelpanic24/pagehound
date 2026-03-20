"""Open Library search API metadata."""
import logging

import httpx

from ..metadata_types import MetadataCandidate

logger = logging.getLogger(__name__)
_SEARCH = "https://openlibrary.org/search.json"
_COVERS = "https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"


def search(
    title: str,
    authors: list[str],
    isbn_13: str | None = None,
    isbn_10: str | None = None,
) -> list[MetadataCandidate]:
    """Return up to 5 MetadataCandidate dicts from Open Library."""
    # ISBN search first
    if isbn_13 or isbn_10:
        results = _query({"isbn": isbn_13 or isbn_10, "limit": 3})
        if results:
            return results[:3]

    params: dict = {"title": title, "limit": 5}
    if authors:
        params["author"] = authors[0]
    return _query(params)[:5]


def _query(params: dict) -> list[MetadataCandidate]:
    try:
        resp = httpx.get(_SEARCH, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Open Library query failed (%s): %s", params, exc)
        return []

    out: list[MetadataCandidate] = []
    for doc in data.get("docs", []):
        isbns: list[str] = doc.get("isbn") or []
        isbn_13 = next((i for i in isbns if len(i) == 13), None)
        isbn_10 = next((i for i in isbns if len(i) == 10), None)

        cover_url: str | None = None
        cover_id = doc.get("cover_i")
        if cover_id:
            cover_url = _COVERS.format(cover_id=cover_id)

        publishers: list[str] = doc.get("publisher") or []
        langs: list[str] = doc.get("language") or []
        lang = langs[0] if langs else None
        # OL lang codes are full words like "eng" — map to 2-letter
        lang = _ol_lang(lang) if lang else None

        out.append(
            MetadataCandidate(
                source="open_library",
                title=doc.get("title"),
                subtitle=None,
                authors=doc.get("author_name") or [],
                description=None,
                isbn_10=isbn_10,
                isbn_13=isbn_13,
                publisher=publishers[0] if publishers else None,
                published_date=(
                    str(doc["first_publish_year"])
                    if doc.get("first_publish_year")
                    else None
                ),
                language=lang,
                page_count=doc.get("number_of_pages_median"),
                cover_url=cover_url,
            )
        )
    return out


_LANG_MAP = {
    "eng": "en", "fre": "fr", "ger": "de", "spa": "es", "ita": "it",
    "por": "pt", "rus": "ru", "jpn": "ja", "chi": "zh", "ara": "ar",
    "dut": "nl", "pol": "pl", "swe": "sv", "dan": "da", "nor": "no",
    "fin": "fi", "tur": "tr", "kor": "ko", "heb": "he", "hun": "hu",
}


def _ol_lang(code: str) -> str:
    return _LANG_MAP.get(code.lower(), code)
