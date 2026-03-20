import logging

logger = logging.getLogger(__name__)


def extract_metadata(file_path: str) -> dict:
    """Extract metadata from a PDF file using pymupdf (fitz).

    Cover = first page rendered as JPEG at 200px width.
    Returns same dict shape as epub_handler.
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
    }
    try:
        import fitz  # pymupdf

        doc = fitz.open(file_path)

        # Page count
        try:
            result["page_count"] = doc.page_count
        except Exception:
            pass

        # Metadata dict from PyMuPDF
        try:
            meta = doc.metadata or {}

            if meta.get("title"):
                result["title"] = meta["title"].strip() or None

            if meta.get("author"):
                raw_authors = meta["author"]
                # Authors may be comma- or semicolon-separated
                for sep in (";", ","):
                    if sep in raw_authors:
                        result["authors"] = [a.strip() for a in raw_authors.split(sep) if a.strip()]
                        break
                else:
                    if raw_authors.strip():
                        result["authors"] = [raw_authors.strip()]

            if meta.get("subject"):
                result["description"] = meta["subject"].strip() or None

            if meta.get("producer") or meta.get("creator"):
                result["publisher"] = (meta.get("producer") or meta.get("creator") or "").strip() or None

            if meta.get("creationDate"):
                # PyMuPDF date format: D:YYYYMMDDHHmmSS
                raw_date = meta["creationDate"]
                if raw_date.startswith("D:"):
                    raw_date = raw_date[2:]
                if len(raw_date) >= 8:
                    result["published_date"] = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        except Exception:
            pass

        # Cover: render first page as JPEG at 200px wide
        try:
            if doc.page_count > 0:
                page = doc[0]
                page_width = page.rect.width
                if page_width > 0:
                    scale = 200.0 / page_width
                else:
                    scale = 1.0
                mat = fitz.Matrix(scale, scale)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img_bytes = pix.tobytes("jpeg")
                result["cover_data"] = img_bytes
        except Exception as e:
            logger.debug("pdf_handler: could not render cover for %s: %s", file_path, e)

        doc.close()

    except Exception as e:
        logger.warning("pdf_handler: failed to read %s: %s", file_path, e)

    return result
