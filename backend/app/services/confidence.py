"""Confidence scoring for metadata candidates."""
import re
from difflib import SequenceMatcher

from .metadata_types import MetadataCandidate


def score(candidate: MetadataCandidate, book) -> int:
    """Score a metadata candidate against the current book (0-100).

    Weights:
      title similarity   30 pts
      author match       25 pts
      isbn match         30 pts  (if book has an ISBN)
      language match      5 pts
      has description     3 pts
      has cover           2 pts
      has any isbn        5 pts  (rewards richer records even when book has none)
    """
    total = 0

    # ── Title (30 pts) ────────────────────────────────────────────────────────
    cand_title = candidate.get("title") or ""
    if cand_title and book.title:
        ratio = SequenceMatcher(
            None,
            _norm_title(book.title),
            _norm_title(cand_title),
        ).ratio()
        total += round(ratio * 30)

    # ── Author (25 pts) ──────────────────────────────────────────────────────
    cand_authors = [_norm_name(a) for a in (candidate.get("authors") or [])]
    book_authors = [_norm_name(a.name) for a in (book.authors or [])]
    if cand_authors and book_authors:
        # Full intersection
        if set(cand_authors) & set(book_authors):
            total += 25
        else:
            # Partial: any candidate token appears in any book-author token
            if any(
                any(bt in ca or ca in bt for ca in cand_authors)
                for bt in book_authors
            ):
                total += 12

    # ── ISBN (30 pts) ────────────────────────────────────────────────────────
    if book.isbn_13 and candidate.get("isbn_13") == book.isbn_13:
        total += 30
    elif book.isbn_10 and candidate.get("isbn_10") == book.isbn_10:
        total += 25

    # ── Language (5 pts) ─────────────────────────────────────────────────────
    cand_lang = candidate.get("language")
    if book.language and cand_lang:
        if book.language.split("-")[0].lower() == cand_lang.split("-")[0].lower():
            total += 5

    # ── Richness bonuses ─────────────────────────────────────────────────────
    if candidate.get("description"):
        total += 3
    if candidate.get("cover_url"):
        total += 2
    if candidate.get("isbn_13") or candidate.get("isbn_10"):
        total += 5

    return min(total, 100)


def _norm_title(t: str) -> str:
    """Lowercase, strip series suffix like '(Series #1)', collapse spaces."""
    t = t.lower()
    t = re.sub(r"\s*[\(\[].+?[\)\]]", "", t)   # remove parenthetical/bracket suffixes
    t = re.sub(r"[^\w\s]", " ", t)
    return " ".join(t.split())


def _norm_name(name: str) -> str:
    """Normalise author name: 'Last, First' and 'First Last' become the same tokens."""
    name = name.lower().strip()
    if "," in name:
        parts = [p.strip() for p in name.split(",", 1)]
        name = f"{parts[1]} {parts[0]}"
    return " ".join(name.split())
