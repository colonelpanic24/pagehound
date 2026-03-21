"""Tests for the OPDS 1.2 Atom feed."""
import pytest

from tests.conftest import seed_book


@pytest.mark.asyncio
async def test_opds_root(client):
    r = await client.get("/opds")
    assert r.status_code == 200
    assert "application/atom+xml" in r.headers["content-type"]
    assert b"PageHound" in r.content


@pytest.mark.asyncio
async def test_opds_catalog(client):
    r = await client.get("/opds/catalog")
    assert r.status_code == 200
    assert "application/atom+xml" in r.headers["content-type"]


@pytest.mark.asyncio
async def test_opds_books_empty(client):
    r = await client.get("/opds/books")
    assert r.status_code == 200
    assert b"<feed" in r.content


@pytest.mark.asyncio
async def test_opds_books_returns_entry(client, db_session):
    await seed_book(db_session, title="Neuromancer", sort_title="Neuromancer")
    r = await client.get("/opds/books")
    assert r.status_code == 200
    assert b"Neuromancer" in r.content
    assert b"acquisition" in r.content


@pytest.mark.asyncio
async def test_opds_search(client, db_session):
    await seed_book(db_session, title="Snow Crash", sort_title="Snow Crash")
    await seed_book(db_session, title="Dune", sort_title="Dune", file_path="/books/dune.epub")
    r = await client.get("/opds/search", params={"q": "Snow"})
    assert r.status_code == 200
    assert b"Snow Crash" in r.content
    assert b"Dune" not in r.content


@pytest.mark.asyncio
async def test_opds_acquire_redirect(client, db_session):
    book = await seed_book(db_session)
    r = await client.get(f"/opds/book/{book.id}/acquisition/epub", follow_redirects=False)
    assert r.status_code == 302
    assert f"/api/books/{book.id}/file" in r.headers["location"]
