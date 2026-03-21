import logging

logger = logging.getLogger(__name__)


def extract_metadata(file_path: str) -> dict:
    """Extract metadata from an EPUB file using ebooklib.

    Returns a dict with keys:
        title, authors, description, language, publisher,
        published_date, page_count, cover_data
    Never raises — returns partial results on error.
    """
    result: dict = {
        "title": None,
        "authors": [],
        "description": None,
        "language": None,
        "publisher": None,
        "published_date": None,
        "page_count": None,
        "cover_data": None,
        "series_name": None,
        "series_index": None,
        "tags": [],
        "isbn_10": None,
        "isbn_13": None,
    }
    try:
        import ebooklib
        from ebooklib import epub

        book = epub.read_epub(file_path, options={"ignore_ncx": True})

        # Title
        try:
            title = book.get_metadata("DC", "title")
            if title:
                result["title"] = title[0][0]
        except Exception:
            pass

        # Authors
        try:
            creators = book.get_metadata("DC", "creator")
            if creators:
                result["authors"] = [c[0] for c in creators if c[0]]
        except Exception:
            pass

        # Description
        try:
            desc = book.get_metadata("DC", "description")
            if desc:
                result["description"] = desc[0][0]
        except Exception:
            pass

        # Language
        try:
            lang = book.get_metadata("DC", "language")
            if lang:
                result["language"] = lang[0][0]
        except Exception:
            pass

        # Publisher
        try:
            pub = book.get_metadata("DC", "publisher")
            if pub:
                result["publisher"] = pub[0][0]
        except Exception:
            pass

        # Published date
        try:
            date = book.get_metadata("DC", "date")
            if date:
                result["published_date"] = date[0][0]
        except Exception:
            pass

        # Page count — EPUB doesn't have a reliable page count; approximate via spine items
        try:
            spine_items = [item for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT)]
            if spine_items:
                # Very rough heuristic: count items (each is roughly a chapter)
                result["page_count"] = None  # not meaningful for EPUB
        except Exception:
            pass

        # Tags / subjects
        try:
            subjects = book.get_metadata("DC", "subject")
            if subjects:
                result["tags"] = [s[0] for s in subjects if s[0]]
        except Exception:
            pass

        # ISBNs — parse DC:identifier values
        try:
            identifiers = book.get_metadata("DC", "identifier") or []
            for val, _attrs in identifiers:
                if not val:
                    continue
                raw = val.strip()
                lower = raw.lower()
                candidate = raw.split(":")[-1].strip().replace("-", "")
                if lower.startswith("isbn:") or (attrs := (_attrs or {})) and str(attrs.get("scheme", "")).upper() == "ISBN":
                    candidate = raw.split(":")[-1].strip().replace("-", "")
                    if len(candidate) == 13 and candidate.isdigit() and not result["isbn_13"]:
                        result["isbn_13"] = candidate
                    elif len(candidate) == 10 and not result["isbn_10"]:
                        result["isbn_10"] = candidate
                elif len(candidate) == 13 and candidate.isdigit() and candidate.startswith("978") and not result["isbn_13"]:
                    result["isbn_13"] = candidate
        except Exception:
            pass

        # Series — Calibre OPF custom meta (calibre:series / calibre:series_index)
        try:
            opf_metas = book.metadata.get("http://www.idpf.org/2007/opf", {}).get("meta", [])
            series_name = None
            series_index = None
            for _, attrs in opf_metas:
                if not isinstance(attrs, dict):
                    continue
                if attrs.get("name") == "calibre:series":
                    series_name = attrs.get("content")
                elif attrs.get("name") == "calibre:series_index":
                    try:
                        series_index = float(attrs["content"])
                    except (KeyError, ValueError, TypeError):
                        pass
            if series_name:
                result["series_name"] = series_name
                result["series_index"] = series_index
        except Exception:
            pass

        # Cover image
        try:
            cover_data = None
            # Try OPF cover metadata first
            cover_meta = book.get_metadata("OPF", "cover")
            if cover_meta:
                cover_id = cover_meta[0][1].get("content") if cover_meta[0][1] else None
                if cover_id:
                    cover_item = book.get_item_with_id(cover_id)
                    if cover_item:
                        cover_data = cover_item.get_content()

            # Fallback: look for item with "cover" in id or href
            if not cover_data:
                for item in book.get_items():
                    if item.media_type and item.media_type.startswith("image/"):
                        item_id = (item.id or "").lower()
                        item_href = (item.file_name or "").lower()
                        if "cover" in item_id or "cover" in item_href:
                            cover_data = item.get_content()
                            break

            # Last resort: first image in the book
            if not cover_data:
                for item in book.get_items():
                    if item.media_type and item.media_type.startswith("image/"):
                        cover_data = item.get_content()
                        break

            result["cover_data"] = cover_data
        except Exception:
            pass

    except Exception as e:
        logger.warning("epub_handler: failed to read %s: %s", file_path, e)

    return result
