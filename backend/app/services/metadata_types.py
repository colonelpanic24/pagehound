"""Shared types for metadata services."""
from typing import TypedDict


class MetadataCandidate(TypedDict, total=False):
    source: str          # "google_books" | "open_library"
    title: str | None
    subtitle: str | None
    authors: list[str]
    description: str | None
    isbn_10: str | None
    isbn_13: str | None
    publisher: str | None
    published_date: str | None
    language: str | None
    page_count: int | None
    cover_url: str | None
    confidence: int      # populated by scorer, 0-100
