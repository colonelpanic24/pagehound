"""
Seed a demo PageHound database with fictional data for README screenshots.

Creates a completely separate data directory so it never touches your real library.
All author names, book titles, and descriptions are fictional.
Cover art uses picsum.photos — public-domain placeholder images seeded by a fixed
integer so the same image always appears for the same book.

Usage (from repo root):
    backend/.venv/bin/python3 scripts/seed_screenshots.py

The demo data lives at ~/.local/share/pagehound-demo/ by default.
Override with DEMO_DATA_DIR env var.

After seeding, capture screenshots with:
    scripts/update_screenshots.sh
"""

import asyncio
import os
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

DEMO_DIR = Path(
    os.environ.get("DEMO_DATA_DIR", Path.home() / ".local/share/pagehound-demo")
).expanduser()
DEMO_DIR.mkdir(parents=True, exist_ok=True)

COVERS_DIR = DEMO_DIR / ".covers"
COVERS_DIR.mkdir(parents=True, exist_ok=True)

# Set env vars BEFORE importing any app modules (config is cached on first call)
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{DEMO_DIR}/pagehound.db"
os.environ["BOOKS_DIR"] = str(DEMO_DIR)
os.environ["REDIS_URL"] = "redis://localhost:6379/0"

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))


def picsum_url(seed: int, size: int = 400) -> str:
    return f"https://picsum.photos/seed/{seed}/{size}/{int(size * 1.4)}"


def download_cover(book_id: int, seed: int) -> str | None:
    """Download a picsum image and save it as {book_id}.jpg. Returns rel path or None."""
    dest = COVERS_DIR / f"{book_id}.jpg"
    if dest.exists():
        return f".covers/{book_id}.jpg"
    url = picsum_url(seed)
    try:
        urllib.request.urlretrieve(url, str(dest))  # noqa: S310
        return f".covers/{book_id}.jpg"
    except Exception as e:
        print(f"    Warning: could not download cover for book {book_id}: {e}")
        return None


# ── Fictional seed data ────────────────────────────────────────────────────────
# All names, titles, ISBNs, and descriptions are completely fictional.

AUTHORS = [
    {"name": "Elena Vasquez", "sort_name": "Vasquez, Elena"},
    {"name": "Marcus Webb", "sort_name": "Webb, Marcus"},
    {"name": "Iona Fraser", "sort_name": "Fraser, Iona"},
    {"name": "Robert Chen", "sort_name": "Chen, Robert"},
    {"name": "Amara Osei", "sort_name": "Osei, Amara"},
]

SERIES_LIST = [
    {"name": "The Cartographer's Daughter"},
    {"name": "The Drift Protocol"},
]

# (title, subtitle, authors_idx, series_idx, series_index, format, published_date, publisher, page_count, language, description, isbn_13, rating, is_read, cover_seed)
BOOKS = [
    # The Cartographer's Daughter series by Elena Vasquez
    (
        "The First Map", None, [0], 0, 1.0, "epub",
        "2019-03-12", "Meridian Press", 342, "en",
        "A young cartographer's apprentice discovers a map that shouldn't exist, leading her across "
        "a continent of shifting borders and forgotten kingdoms. The first book in the acclaimed "
        "Cartographer's Daughter trilogy.",
        "9780000000001", 5, True, 301,
    ),
    (
        "The Northern Passage", None, [0], 0, 2.0, "epub",
        "2020-09-08", "Meridian Press", 389, "en",
        "Continuing north through the glacial wastes, Mara faces the cartographers' guild and its "
        "centuries-old secret. Maps can lie, and the truth they hide reshapes everything.",
        "9780000000002", 4, True, 302,
    ),
    (
        "The Last Territory", None, [0], 0, 3.0, "epub",
        "2022-05-30", "Meridian Press", 411, "en",
        "The final journey. The edges of the map have always been marked 'unknown'. Mara is about "
        "to find out why — and whether the truth can survive being written down.",
        "9780000000003", 5, False, 303,
    ),
    (
        "Where the Rivers Diverge", "A Story of Borderlands", [0], None, None, "pdf",
        "2016-11-14", "Meridian Press", 278, "en",
        "A standalone novel set in a disputed river delta where three nations claim the same "
        "stretch of water. A hydrographer must chart a peace both sides will accept.",
        "9780000000004", 4, True, 304,
    ),

    # Marcus Webb thrillers
    (
        "Cold Harbour", None, [1], None, None, "epub",
        "2018-07-22", "Blackwater Books", 312, "en",
        "A retired intelligence analyst is pulled back into the field when a defector arrives "
        "claiming to know the identity of a deep-cover mole. Cold, precise, and unsettling.",
        "9780000000005", 4, True, 311,
    ),
    (
        "The Retrieval", None, [1], None, None, "epub",
        "2021-02-09", "Blackwater Books", 356, "en",
        "When an exfiltration goes wrong in a city locked down by protests, Webb's protagonist "
        "must improvise his way out with a source he isn't sure he can trust.",
        "9780000000006", 3, False, 312,
    ),
    (
        "The Long Exposure", "A Thriller", [1], None, None, "mobi",
        "2023-10-17", "Blackwater Books", 398, "en",
        "A photojournalist's archive of conflict-zone images contains something that powerful "
        "people want erased. Marcus Webb delivers his most propulsive novel yet.",
        "9780000000007", None, False, 313,
    ),

    # The Drift Protocol series by Robert Chen
    (
        "Station Zero", None, [3], 1, 1.0, "epub",
        "2015-06-01", "Cosm Publishing", 288, "en",
        "The first crew to staff the deep-space relay station arrives to find the previous team "
        "gone — and the station's logs overwritten with a single repeating phrase.",
        "9780000000008", 5, True, 321,
    ),
    (
        "Signal Decay", None, [3], 1, 2.0, "epub",
        "2017-11-20", "Cosm Publishing", 334, "en",
        "The signal they've been chasing leads back to Earth — to a facility that was "
        "decommissioned thirty years ago and a project nobody is supposed to remember.",
        "9780000000009", 4, True, 322,
    ),
    (
        "Dark Matter Transit", None, [3], 1, 3.0, "epub",
        "2020-04-14", "Cosm Publishing", 401, "en",
        "The third and final book. The drift is not a journey through space. The crew of "
        "Station Zero must decide what they are willing to become.",
        "9780000000010", 5, False, 323,
    ),

    # Iona Fraser historical fiction
    (
        "The Silk Road Letters", "Dispatches from the Edge of the Known World", [2], None, None, "pdf",
        "2014-08-05", "Ardent House", 465, "en",
        "Told through letters, a Victorian-era naturalist traces the ancient trade routes from "
        "Constantinople to Samarkand. Meticulous research underpins a vivid human story.",
        "9780000000011", 4, True, 331,
    ),
    (
        "Amber and Ash", None, [2], None, None, "epub",
        "2017-03-28", "Ardent House", 387, "en",
        "In the Baltic amber trade of the twelfth century, a merchant widow disguises herself "
        "to keep her family's business alive. A story of survival and reinvention.",
        "9780000000012", 4, False, 332,
    ),
    (
        "Letters from Kandahar", None, [2], None, None, "epub",
        "2021-09-13", "Ardent House", 312, "en",
        "A contemporary novelist in correspondence with her grandmother's wartime letters "
        "discovers a family secret spanning three generations and two continents.",
        "9780000000013", 3, False, 333,
    ),

    # Amara Osei literary fiction
    (
        "Threshold", None, [4], None, None, "epub",
        "2019-01-21", "Caraway Press", 256, "en",
        "Three strangers meet in the waiting room of a hospital and pass a single night "
        "in conversation. Quiet, devastating, and precise.",
        "9780000000014", 5, True, 341,
    ),
    (
        "The Weight of Small Things", None, [4], None, None, "epub",
        "2021-07-06", "Caraway Press", 298, "en",
        "A family gathering after a long estrangement. The things left unsaid accumulate "
        "like sediment until something has to give. Osei's most celebrated work.",
        "9780000000015", 4, False, 342,
    ),

    # Anthology — two authors
    (
        "Voices from the Margin", "An Anthology of Contemporary Fiction", [0, 4], None, None, "epub",
        "2020-10-05", "Caraway Press", 512, "en",
        "Edited by Elena Vasquez and Amara Osei, this anthology gathers thirty short stories "
        "from writers working outside the mainstream publishing industry.",
        "9780000000016", 4, True, 351,
    ),
]


async def seed() -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    # Import models AFTER env vars are set and path is configured
    from app.database import Base
    from app.models.author import Author
    from app.models.book import Book, book_authors
    from app.models.job import Job
    from app.models.metadata_review import MetadataReview
    from app.models.series import Series

    db_url = os.environ["DATABASE_URL"]
    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        # Import all model modules so metadata is registered
        import app.models.download  # noqa: F401
        import app.models.kobo_device  # noqa: F401
        import app.models.kobo_sync_state  # noqa: F401
        import app.models.reading_progress  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as db:
        # Clear existing data
        for tbl in [
            "metadata_reviews", "jobs", "book_authors", "book_tags",
            "reading_progress", "books", "authors", "series",
            "kobo_sync_states", "kobo_devices",
        ]:
            try:
                await db.execute(text(f"DELETE FROM {tbl}"))  # noqa: S608
            except Exception:
                pass
        await db.commit()

        # Create authors
        author_objs = []
        for a in AUTHORS:
            obj = Author(name=a["name"], sort_name=a["sort_name"])
            db.add(obj)
            author_objs.append(obj)
        await db.flush()

        # Create series
        series_objs = []
        for s in SERIES_LIST:
            obj = Series(name=s["name"])
            db.add(obj)
            series_objs.append(obj)
        await db.flush()

        # Create books
        book_objs = []
        now = datetime.utcnow()
        for idx, (
            title, subtitle, author_idxs, series_idx, series_index,
            fmt, published_date, publisher, page_count, language,
            description, isbn_13, rating, is_read, cover_seed,
        ) in enumerate(BOOKS, start=1):
            added = now - timedelta(days=len(BOOKS) - idx)
            book = Book(
                title=title,
                sort_title=title.lstrip("The ").lstrip("A ").lstrip("An "),
                subtitle=subtitle,
                description=description,
                isbn_13=isbn_13,
                publisher=publisher,
                published_date=published_date,
                language=language,
                page_count=page_count,
                file_path=f"{DEMO_DIR}/books/{title.replace(' ', '_')}.{fmt}",
                file_format=fmt,
                file_size=page_count * 3000 if page_count else None,
                added_date=added,
                modified_date=added,
                metadata_source="google_books",
                metadata_confidence=85 + (idx % 15),
                series_id=series_objs[series_idx].id if series_idx is not None else None,
                series_index=series_index,
                rating=rating,
                is_read=is_read,
            )
            book.authors = [author_objs[i] for i in author_idxs]
            db.add(book)
            book_objs.append(book)

        await db.flush()

        # Download covers now that we have IDs
        print("Downloading placeholder covers...")
        for book, (_, _, _, _, _, _, _, _, _, _, _, _, _, _, cover_seed) in zip(book_objs, BOOKS):
            rel = download_cover(book.id, cover_seed)
            if rel:
                book.cover_image_path = rel

        await db.flush()

        # Create completed jobs
        scan_job = Job(
            id="00000000-0000-0000-0000-000000000001",
            type="library_scan",
            label="Library scan",
            status="completed",
            triggered_by="user",
            started_at=now - timedelta(hours=2, minutes=5),
            finished_at=now - timedelta(hours=2),
            summary={"found": 16, "imported": 16, "skipped": 0, "failed": 0},
        )
        enrich_job = Job(
            id="00000000-0000-0000-0000-000000000002",
            type="metadata_enrich",
            label="Library metadata enrichment",
            status="completed",
            triggered_by="scan",
            started_at=now - timedelta(hours=1, minutes=55),
            finished_at=now - timedelta(hours=1, minutes=30),
            summary={"enriched": 13, "auto_applied": 13, "needs_review": 3, "failed": 0},
        )
        db.add(scan_job)
        db.add(enrich_job)

        # Create pending metadata reviews
        # Review 1: Cold Harbour — suggest better description + page count
        cold_harbour = book_objs[4]  # index 4
        db.add(MetadataReview(
            book_id=cold_harbour.id,
            status="pending",
            candidates=[
                {
                    "source": "google_books",
                    "confidence": 72,
                    "title": "Cold Harbour",
                    "publisher": "Blackwater Books",
                    "published_date": "2018-07-22",
                    "description": "A retired intelligence analyst is pulled back in when a defector arrives "
                                   "with knowledge of a deep-cover mole. Webb's breakout thriller.",
                    "page_count": 319,
                    "isbn_13": "9780000000005",
                },
            ],
            suggested_fields={
                "description": "A retired intelligence analyst is pulled back in when a defector arrives "
                               "with knowledge of a deep-cover mole. Webb's breakout thriller.",
                "page_count": 319,
            },
            suggested_confidence=72,
            created_at=now - timedelta(hours=1, minutes=20),
        ))

        # Review 2: Station Zero — suggest subtitle + isbn_10
        station_zero = book_objs[7]  # index 7
        db.add(MetadataReview(
            book_id=station_zero.id,
            status="pending",
            candidates=[
                {
                    "source": "google_books",
                    "confidence": 68,
                    "title": "Station Zero",
                    "subtitle": "The Drift Protocol, Book One",
                    "publisher": "Cosm Publishing",
                    "isbn_10": "0000000008",
                    "isbn_13": "9780000000008",
                },
                {
                    "source": "open_library",
                    "confidence": 61,
                    "title": "Station Zero",
                    "publisher": "Cosm Pub",
                    "page_count": 291,
                },
            ],
            suggested_fields={
                "subtitle": "The Drift Protocol, Book One",
                "isbn_10": "0000000008",
                "page_count": 291,
            },
            suggested_confidence=68,
            created_at=now - timedelta(hours=1, minutes=15),
        ))

        # Review 3: Threshold — suggest language code fix + publisher
        threshold = book_objs[13]  # index 13
        db.add(MetadataReview(
            book_id=threshold.id,
            status="pending",
            candidates=[
                {
                    "source": "open_library",
                    "confidence": 65,
                    "title": "Threshold",
                    "publisher": "Caraway Press",
                    "published_date": "2019-01-21",
                    "language": "eng",
                },
            ],
            suggested_fields={
                "language": "eng",
            },
            suggested_confidence=65,
            created_at=now - timedelta(hours=1, minutes=10),
        ))

        await db.commit()

    await engine.dispose()

    total_books = len(BOOKS)
    print(f"Seeded {len(AUTHORS)} authors, {len(SERIES_LIST)} series, {total_books} books")
    print(f"  Database: {DEMO_DIR}/pagehound.db")
    print(f"  Covers:   {COVERS_DIR}/")
    print()
    print("Next steps:")
    print("  scripts/update_screenshots.sh")


if __name__ == "__main__":
    asyncio.run(seed())
