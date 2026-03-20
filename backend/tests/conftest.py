"""
Shared test fixtures.

- In-memory SQLite engine / session
- httpx AsyncClient wired to the FastAPI app with DB dependency overridden
  and lifespan skipped (no Redis listener, no background tasks)
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.models import Author, Book, Job, Series

# ── In-memory database ─────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


# ── Test client ────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(engine):
    """
    httpx.AsyncClient pointed at the FastAPI app with:
    - DB dependency swapped for in-memory SQLite
    - lifespan disabled (no Redis pub/sub listener started)
    """
    from app.main import app

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Seed helpers ───────────────────────────────────────────────────────────────

async def seed_author(db: AsyncSession, **kwargs) -> Author:
    defaults = dict(name="Test Author", sort_name="Author, Test")
    defaults.update(kwargs)
    a = Author(**defaults)
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


async def seed_book(db: AsyncSession, **kwargs) -> Book:
    defaults = dict(
        title="Test Book",
        sort_title="Test Book",
        file_path="/books/test/test.epub",
        file_format="epub",
    )
    defaults.update(kwargs)
    b = Book(**defaults)
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b
