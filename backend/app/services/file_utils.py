import os

BOOK_EXTENSIONS = {".epub", ".pdf", ".mobi", ".azw", ".azw3"}

_ARTICLES = {"the", "a", "an"}


def compute_sort_title(title: str) -> str:
    """Move leading articles to end: 'The Great Gatsby' → 'Great Gatsby, The'"""
    if not title:
        return title
    parts = title.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() in _ARTICLES:
        return f"{parts[1]}, {parts[0]}"
    return title


def compute_sort_name(name: str) -> str:
    """'Philip K. Dick' → 'Dick, Philip K.'"""
    if not name:
        return name
    parts = name.strip().rsplit(" ", 1)
    if len(parts) == 2:
        return f"{parts[1]}, {parts[0]}"
    return name


def detect_format(file_path: str) -> str | None:
    """Return 'epub'/'pdf'/'mobi'/'azw'/'azw3' based on extension, or None."""
    ext = os.path.splitext(file_path)[1].lower()
    mapping = {
        ".epub": "epub",
        ".pdf": "pdf",
        ".mobi": "mobi",
        ".azw": "azw",
        ".azw3": "azw3",
    }
    return mapping.get(ext)
