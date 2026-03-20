"""Anna's Archive search and download adapter."""
from __future__ import annotations

import logging
import os
import re

import httpx
from bs4 import BeautifulSoup

from .base import SearchResult

logger = logging.getLogger(__name__)

SOURCE_ID = "annas_archive"
DISPLAY_NAME = "Anna's Archive"

_BASE_URL = os.environ.get("ANNAS_ARCHIVE_BASE_URL", "https://annas-archive.org")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "DNT": "1",
}

_DOWNLOAD_DOMAINS = [
    "download.library.lol",
    "libgen.li",
    "libgen.rs",
    "cloudflare-ipfs.com",
    "annas-archive.se",
    "annas-archive.li",
    "annas-dl.org",
]


def search(query: str, limit: int = 20) -> list[SearchResult]:
    """Search Anna's Archive and return up to *limit* results."""
    params = {
        "q": query,
        "ext": "epub,pdf",
        "sort": "",
        "lang": "",
        "content": "book_any",
    }
    try:
        with httpx.Client(headers=_HEADERS, follow_redirects=True, timeout=20) as client:
            resp = client.get(f"{_BASE_URL}/search", params=params)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
    except Exception as exc:
        logger.warning("Anna's Archive search failed: %s", exc)
        return []

    results: list[SearchResult] = []
    seen: set[str] = set()

    for anchor in soup.find_all("a", href=re.compile(r"^/md5/[a-fA-F0-9]+")):
        href: str = anchor["href"]
        m = re.match(r"/md5/([a-fA-F0-9]+)", href)
        if not m:
            continue
        md5 = m.group(1).lower()
        if md5 in seen:
            continue
        seen.add(md5)

        # Cover image
        img = anchor.find("img")
        cover_url: str | None = None
        if img and img.get("src"):
            src = str(img["src"])
            cover_url = src if src.startswith("http") else f"{_BASE_URL}{src}"

        # Extract all visible text nodes in document order
        text_parts = [t for t in anchor.stripped_strings]
        if not text_parts:
            continue

        title = text_parts[0]
        authors: list[str] = []
        file_format: str | None = None
        file_size_str: str | None = None
        file_size_bytes: int | None = None
        language: str | None = None
        year: str | None = None

        for part in text_parts[1:]:
            part = part.strip()
            if not part:
                continue

            # Metadata line: contains a known book format keyword
            if re.search(r"\b(epub|pdf|mobi|azw3?|djvu)\b", part, re.IGNORECASE):
                for segment in re.split(r",\s*", part):
                    seg = segment.strip()
                    # File format
                    fm = re.search(r"\b(epub|pdf|mobi|azw3?|djvu)\b", seg, re.IGNORECASE)
                    if fm:
                        file_format = fm.group(1).lower()
                    # File size
                    sm = re.search(r"([\d.]+)\s*(kb|mb|gb)", seg, re.IGNORECASE)
                    if sm:
                        file_size_str = seg
                        val = float(sm.group(1))
                        unit = sm.group(2).lower()
                        file_size_bytes = int(
                            val * {"kb": 1024, "mb": 1024**2, "gb": 1024**3}[unit]
                        )
                    # Year
                    ym = re.search(r"\b(19|20)\d{2}\b", seg)
                    if ym and not year:
                        year = ym.group(0)
                    # Language code [XX] or [XXX]
                    lm = re.search(r"\[([A-Z]{2,3})\]", seg)
                    if lm and not language:
                        language = lm.group(1).lower()
            elif not authors:
                # First non-title, non-metadata line → author
                authors = [a.strip() for a in re.split(r"[;]", part) if a.strip()]

        results.append(
            SearchResult(
                id=md5,
                title=title,
                authors=authors,
                file_format=file_format,
                file_size_bytes=file_size_bytes,
                file_size_str=file_size_str,
                language=language,
                publisher=None,
                year=year,
                source=SOURCE_ID,
                cover_url=cover_url,
                description=None,
                extra={"md5": md5},
            )
        )

        if len(results) >= limit:
            break

    return results


def get_download_url(md5: str) -> str | None:
    """Return the best available direct download URL for the given MD5."""
    url = f"{_BASE_URL}/md5/{md5}"
    try:
        with httpx.Client(headers=_HEADERS, follow_redirects=True, timeout=20) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return None
            soup = BeautifulSoup(resp.text, "lxml")
    except Exception as exc:
        logger.warning("get_download_url failed for md5=%s: %s", md5, exc)
        return None

    # First pass: prefer known download domains
    for anchor in soup.find_all("a", href=True):
        href: str = anchor["href"]
        if not href.startswith("http"):
            continue
        if any(domain in href for domain in _DOWNLOAD_DOMAINS):
            return href

    # Second pass: slow_download paths on the same base
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if "/slow_download/" in href:
            return href if href.startswith("http") else f"{_BASE_URL}{href}"

    # Third pass: any link with a book file extension
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if href.startswith("http") and re.search(r"\.(epub|pdf|mobi|azw3?)(\?|$|#)", href, re.I):
            return href

    return None
