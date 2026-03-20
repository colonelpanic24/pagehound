"""Shared types for book source adapters."""
from typing import TypedDict


class SearchResult(TypedDict):
    id: str                      # Source-specific identifier (e.g. MD5 hash)
    title: str
    authors: list[str]
    file_format: str | None      # epub, pdf, mobi …
    file_size_bytes: int | None
    file_size_str: str | None    # human-readable e.g. "3.8 MB"
    language: str | None         # ISO 639-1 code e.g. "en"
    publisher: str | None
    year: str | None
    source: str                  # e.g. "annas_archive"
    cover_url: str | None
    description: str | None
    extra: dict                  # source-specific data (passed through to download)
