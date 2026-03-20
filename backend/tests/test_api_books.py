"""Tests for /api/books endpoints."""

import pytest

from tests.conftest import seed_book


@pytest.mark.asyncio
async def test_list_books_empty(client):
    r = await client.get("/api/books/")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_list_books_returns_book(client, db_session):
    await seed_book(db_session, title="Dune", sort_title="Dune")
    r = await client.get("/api/books/")
    assert r.status_code == 200
    books = r.json()
    assert len(books) == 1
    assert books[0]["title"] == "Dune"
    assert books[0]["file_format"] == "epub"


@pytest.mark.asyncio
async def test_get_book_not_found(client):
    r = await client.get("/api/books/9999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_book_found(client, db_session):
    book = await seed_book(db_session, title="Foundation", sort_title="Foundation")
    r = await client.get(f"/api/books/{book.id}")
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Foundation"
    assert data["authors"] == []
    assert data["series"] is None


@pytest.mark.asyncio
async def test_list_books_pagination(client, db_session):
    for i in range(5):
        await seed_book(
            db_session,
            title=f"Book {i}",
            sort_title=f"Book {i:02d}",
            file_path=f"/books/book{i}.epub",
        )
    r = await client.get("/api/books/?limit=3")
    assert r.status_code == 200
    assert len(r.json()) == 3


@pytest.mark.asyncio
async def test_list_books_skip(client, db_session):
    for i in range(4):
        await seed_book(
            db_session,
            title=f"Book {i}",
            sort_title=f"Book {i:02d}",
            file_path=f"/books/book{i}.epub",
        )
    r = await client.get("/api/books/?skip=2&limit=10")
    assert r.status_code == 200
    assert len(r.json()) == 2


# ── Filter tests ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_books_filter_format(client, db_session):
    await seed_book(db_session, title="Epub Book", file_path="/b/a.epub", file_format="epub")
    await seed_book(db_session, title="PDF Book", file_path="/b/b.pdf", file_format="pdf")
    r = await client.get("/api/books/?format=pdf")
    assert r.status_code == 200
    books = r.json()
    assert len(books) == 1
    assert books[0]["title"] == "PDF Book"


@pytest.mark.asyncio
async def test_list_books_filter_language(client, db_session):
    await seed_book(db_session, title="English Book", file_path="/b/a.epub", language="en")
    await seed_book(db_session, title="French Book", file_path="/b/b.epub", language="fr")
    r = await client.get("/api/books/?language=fr")
    assert r.status_code == 200
    books = r.json()
    assert len(books) == 1
    assert books[0]["title"] == "French Book"


@pytest.mark.asyncio
async def test_list_books_filter_is_read(client, db_session):
    await seed_book(db_session, title="Read Book", file_path="/b/a.epub", is_read=True)
    await seed_book(db_session, title="Unread Book", file_path="/b/b.epub", is_read=False)
    r = await client.get("/api/books/?is_read=true")
    assert r.status_code == 200
    books = r.json()
    assert len(books) == 1
    assert books[0]["title"] == "Read Book"


@pytest.mark.asyncio
async def test_list_books_filter_q_matches_title(client, db_session):
    await seed_book(db_session, title="Foundation", sort_title="Foundation", file_path="/b/a.epub")
    await seed_book(db_session, title="Dune", sort_title="Dune", file_path="/b/b.epub")
    r = await client.get("/api/books/?q=Found")
    assert r.status_code == 200
    books = r.json()
    assert len(books) == 1
    assert books[0]["title"] == "Foundation"


# ── PATCH /api/books/{id} ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_book_not_found(client):
    r = await client.patch("/api/books/9999", json={"title": "Anything"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_patch_book_updates_title(client, db_session):
    book = await seed_book(db_session, title="Old Title", sort_title="Old Title")
    r = await client.patch(f"/api/books/{book.id}", json={"title": "New Title"})
    assert r.status_code == 200
    assert r.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_patch_book_updates_is_read(client, db_session):
    book = await seed_book(db_session)
    r = await client.patch(f"/api/books/{book.id}", json={"is_read": True})
    assert r.status_code == 200
    assert r.json()["is_read"] is True


@pytest.mark.asyncio
async def test_patch_book_ignores_unknown_fields(client, db_session):
    book = await seed_book(db_session, title="Keep Me")
    r = await client.patch(f"/api/books/{book.id}", json={"nonexistent_field": "value"})
    assert r.status_code == 200
    assert r.json()["title"] == "Keep Me"


# ── GET /api/books/formats ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_formats_empty(client):
    r = await client.get("/api/books/formats")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_get_formats_returns_sorted_distinct(client, db_session):
    await seed_book(db_session, file_path="/b/a.epub", file_format="epub")
    await seed_book(db_session, file_path="/b/b.pdf", file_format="pdf")
    await seed_book(db_session, file_path="/b/c2.epub", file_format="epub")
    r = await client.get("/api/books/formats")
    assert r.status_code == 200
    assert r.json() == ["epub", "pdf"]
