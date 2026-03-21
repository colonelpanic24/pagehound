import os

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import sessionmaker as sync_sessionmaker

from .config import get_settings

settings = get_settings()

# Ensure data directory exists for SQLite
if settings.database_url.startswith("sqlite"):
    db_path = settings.database_url.split("///")[-1]
    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)

engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    from .models import (  # noqa: F401
        author,
        book,
        download,
        job,
        kobo_device,
        kobo_sync_state,
        metadata_review,
        reading_progress,
        series,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    create_sync_tables()


# ---------------------------------------------------------------------------
# Sync engine for Celery tasks (no asyncio)
# ---------------------------------------------------------------------------


def _sync_url(url: str) -> str:
    return url.replace("sqlite+aiosqlite", "sqlite").replace("postgresql+asyncpg", "postgresql")


sync_engine = create_engine(
    _sync_url(settings.database_url),
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)
SyncSession = sync_sessionmaker(sync_engine, autocommit=False, autoflush=False)


def create_sync_tables() -> None:
    Base.metadata.create_all(sync_engine)
