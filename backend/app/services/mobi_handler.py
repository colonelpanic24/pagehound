import logging
import os

logger = logging.getLogger(__name__)


def extract_metadata(file_path: str) -> dict:
    """Minimal MOBI metadata extractor — guesses title/author from filename.

    Expected filename format: "Author - Title.mobi"
    Returns same dict shape as epub_handler/pdf_handler.
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
        basename = os.path.splitext(os.path.basename(file_path))[0]
        if " - " in basename:
            author_part, title_part = basename.split(" - ", 1)
            result["title"] = title_part.strip()
            result["authors"] = [author_part.strip()]
        else:
            result["title"] = basename.strip()
    except Exception as e:
        logger.warning("mobi_handler: failed to parse filename %s: %s", file_path, e)

    return result
