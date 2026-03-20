"""Merge a metadata candidate into a book's fields."""
from .metadata_types import MetadataCandidate

# Fields we're allowed to update from online metadata
_MERGEABLE = (
    "title", "subtitle", "description",
    "isbn_10", "isbn_13",
    "publisher", "published_date",
    "language", "page_count",
)


def merge(book, candidate: MetadataCandidate, strategy: str) -> dict:
    """Return a dict of field→value to apply to the Book.

    strategy="prefer_online": use candidate value for any non-None online field.
    strategy="fill_gaps":     only fill fields that are currently None on the book.
    """
    updates: dict = {}
    for field in _MERGEABLE:
        value = candidate.get(field)  # type: ignore[literal-required]
        if value is None:
            continue
        if strategy == "fill_gaps" and getattr(book, field) is not None:
            continue
        updates[field] = value
    return updates
