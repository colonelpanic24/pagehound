"""Tests for /api/books endpoints."""

import pytest

from tests.conftest import seed_author, seed_book


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
