"""OPDS 1.2 Atom feed for Kobo and other readers."""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from lxml import etree
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..models.author import Author
from ..models.book import Book
from ..services.kobo_utils import _iso

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/opds", tags=["opds"])
settings = get_settings()

# XML namespaces
_ATOM = "http://www.w3.org/2005/Atom"
_OPDS = "http://opds-spec.org/2010/catalog"
_DC = "http://purl.org/dc/terms/"
_OS = "http://a9.com/-/spec/opensearch/1.1/"

_NSMAP = {
    None: _ATOM,
    "opds": _OPDS,
    "dcterms": _DC,
    "opensearch": _OS,
}


def _feed(title: str, feed_id: str, updated: str) -> etree._Element:
    feed = etree.Element("feed", nsmap=_NSMAP)
    etree.SubElement(feed, "id").text = feed_id
    etree.SubElement(feed, "title").text = title
    etree.SubElement(feed, "updated").text = updated
    etree.SubElement(feed, "author").append(_text("name", "PageHound"))

    base = settings.base_url.rstrip("/")

    _link(feed, rel="self", href=f"{base}/opds", type="application/atom+xml;profile=opds-catalog;kind=navigation")
    _link(feed, rel="start", href=f"{base}/opds", type="application/atom+xml;profile=opds-catalog;kind=navigation")
    _link(
        feed,
        rel="search",
        href=f"{base}/opds/search?q={{searchTerms}}",
        type="application/atom+xml",
        title="Search PageHound",
    )
    return feed


def _text(tag: str, text: str) -> etree._Element:
    el = etree.Element(tag)
    el.text = text
    return el


def _link(parent: etree._Element, *, rel: str, href: str, type: str, title: str = "") -> None:
    attrib: dict[str, str] = {"rel": rel, "href": href, "type": type}
    if title:
        attrib["title"] = title
    etree.SubElement(parent, "link", attrib=attrib)


def _xml_response(root: etree._Element) -> Response:
    content = etree.tostring(root, xml_declaration=True, encoding="UTF-8", pretty_print=True)
    return Response(content=content, media_type="application/atom+xml; charset=utf-8")


def _book_entry(book: Book, base: str) -> etree._Element:
    entry = etree.Element("entry")
    etree.SubElement(entry, "title").text = book.title or ""
    etree.SubElement(entry, "id").text = f"urn:pagehound:book:{book.id}"
    etree.SubElement(entry, "updated").text = _iso(book.modified_date)

    for a in book.authors:
        author_el = etree.SubElement(entry, "author")
        etree.SubElement(author_el, "name").text = a.name

    if book.description:
        summary = etree.SubElement(entry, "summary")
        summary.text = book.description
        summary.set("type", "text")

    if book.cover_image_path:
        _link(
            entry,
            rel="http://opds-spec.org/image",
            href=f"{base}/covers/{book.cover_image_path}",
            type="image/jpeg",
        )
        _link(
            entry,
            rel="http://opds-spec.org/image/thumbnail",
            href=f"{base}/covers/{book.cover_image_path}",
            type="image/jpeg",
        )

    if book.file_path and book.file_format:
        fmt = book.file_format.lower()
        mime = {
            "epub": "application/epub+zip",
            "pdf": "application/pdf",
            "mobi": "application/x-mobipocket-ebook",
        }.get(fmt, "application/octet-stream")
        link = etree.SubElement(entry, "link")
        link.set("rel", "http://opds-spec.org/acquisition")
        link.set("href", f"{base}/opds/book/{book.id}/acquisition/{fmt}")
        link.set("type", mime)
        price = etree.SubElement(
            link,
            f"{{{_OPDS}}}price",
            attrib={"currencycode": "USD"},
        )
        price.text = "0.00"

    return entry


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
async def opds_root():
    """OPDS navigation root."""
    base = settings.base_url.rstrip("/")
    now = _iso(datetime.utcnow())
    feed = _feed("PageHound Library", f"{base}/opds", now)

    # "All Books" entry
    all_entry = etree.SubElement(feed, "entry")
    etree.SubElement(all_entry, "title").text = "All Books"
    etree.SubElement(all_entry, "id").text = f"{base}/opds/books"
    etree.SubElement(all_entry, "updated").text = now
    etree.SubElement(all_entry, "content", type="text").text = "Browse all books in the library"
    _link(
        all_entry,
        rel="subsection",
        href=f"{base}/opds/books",
        type="application/atom+xml;profile=opds-catalog;kind=acquisition",
    )

    return _xml_response(feed)


@router.get("/catalog")
async def opds_catalog():
    return await opds_root()


@router.get("/books")
async def opds_books(
    page: int = Query(default=0, ge=0),
    size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Paginated acquisition feed of all books."""
    base = settings.base_url.rstrip("/")
    now = _iso(datetime.utcnow())

    result = await db.execute(
        select(Book)
        .options(selectinload(Book.authors))
        .where(Book.is_missing == False)  # noqa: E712
        .order_by(Book.sort_title)
        .offset(page * size)
        .limit(size)
    )
    books = result.scalars().all()

    feed = _feed("PageHound — All Books", f"{base}/opds/books", now)
    feed.set(f"{{{_OS}}}totalResults", str(len(books)))

    _link(
        feed,
        rel="self",
        href=f"{base}/opds/books?page={page}&size={size}",
        type="application/atom+xml;profile=opds-catalog;kind=acquisition",
    )
    if page > 0:
        _link(
            feed,
            rel="previous",
            href=f"{base}/opds/books?page={page - 1}&size={size}",
            type="application/atom+xml;profile=opds-catalog;kind=acquisition",
        )
    if len(books) == size:
        _link(
            feed,
            rel="next",
            href=f"{base}/opds/books?page={page + 1}&size={size}",
            type="application/atom+xml;profile=opds-catalog;kind=acquisition",
        )

    for book in books:
        feed.append(_book_entry(book, base))

    return _xml_response(feed)


@router.get("/search")
async def opds_search(
    q: str = Query(default=""),
    page: int = Query(default=0, ge=0),
    size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Search the library, return OPDS acquisition feed."""
    base = settings.base_url.rstrip("/")
    now = _iso(datetime.utcnow())

    query = (
        select(Book)
        .options(selectinload(Book.authors))
        .where(Book.is_missing == False)  # noqa: E712
        .order_by(Book.sort_title)
        .offset(page * size)
        .limit(size)
    )
    if q:
        pattern = f"%{q}%"
        query = query.where(
            Book.title.ilike(pattern) | Book.authors.any(Author.name.ilike(pattern))
        )

    result = await db.execute(query)
    books = result.scalars().all()

    feed = _feed(f"Search: {q}", f"{base}/opds/search?q={q}", now)
    for book in books:
        feed.append(_book_entry(book, base))

    return _xml_response(feed)


@router.get("/book/{book_id}/acquisition/{fmt}")
async def opds_acquire(book_id: int, fmt: str, db: AsyncSession = Depends(get_db)):
    """Redirect to the book file download endpoint."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"/api/books/{book_id}/file", status_code=302)
