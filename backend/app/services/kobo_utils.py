"""Shared helpers for the Kobo store API and OPDS feed."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime


def book_kobo_uuid(book_id: int) -> str:
    """Return a stable UUID string derived deterministically from book.id."""
    return str(uuid.UUID(int=book_id))


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return "2000-01-01T00:00:00Z"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def book_to_entitlement(book, base_url: str, auth_token: str, *, is_new: bool = True) -> dict:
    """Build a Kobo NewEntitlement / ChangedEntitlement dict for a book."""
    kobo_id = book_kobo_uuid(book.id)
    authors = [{"Name": a.name, "Role": "Author"} for a in (book.authors or [])]
    now_str = _iso(datetime.utcnow())
    modified_str = _iso(book.modified_date)
    added_str = _iso(book.added_date)

    metadata = {
        "CrossRevisionId": kobo_id,
        "RevisionId": kobo_id,
        "WorkId": kobo_id,
        "Title": book.title or "",
        "Contributors": authors,
        "Description": book.description or "",
        "PublisherId": book.publisher or "",
        "Language": book.language or "en",
        "CoverImageId": kobo_id,
        "Categories": ["BOOK"],
        "Accessibility": {"Role": "Full"},
        "PublicationDate": book.published_date or "2000-01-01",
        "IsOwned": True,
    }

    entitlement = {
        "Accessibility": {"Role": "Full"},
        "ActivePeriod": {"From": added_str},
        "Created": added_str,
        "CrossRevisionId": kobo_id,
        "Id": kobo_id,
        "IsRemoved": False,
        "IsHiddenFromArchive": False,
        "IsLocked": False,
        "LastModified": modified_str,
        "OriginCategory": "Imported",
        "RevisionId": kobo_id,
        "Status": "Active",
        "DownloadUrls": [
            {
                "Format": "EPUB",
                "Url": f"{base_url}/kobo/{auth_token}/v1/books/{kobo_id}/file/epub",
            }
        ],
    }

    reading_state = {
        "Created": added_str,
        "CurrentBookmark": None,
        "LastModified": modified_str,
        "PriorityTimestamp": modified_str,
        "StatusInfo": {"LastModified": now_str, "Status": "ReadyToRead"},
    }

    key = "NewEntitlement" if is_new else "ChangedEntitlement"
    return {
        key: {
            "BookMetadata": metadata,
            "BookEntitlement": entitlement,
            "ReadingState": reading_state,
        }
    }
