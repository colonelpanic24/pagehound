import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import init_db
from .routers import books, downloads, jobs, library, metadata, ws
from .websocket_manager import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("PageHound starting up…")
    await init_db()

    # Ensure covers dir exists
    os.makedirs(settings.covers_dir, exist_ok=True)

    # Start Redis pub/sub listener as a background task
    listener_task = asyncio.create_task(ws_manager.start_redis_listener())

    yield

    # Shutdown
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass
    logger.info("PageHound shut down.")


app = FastAPI(
    title="PageHound",
    description="Self-hosted e-book library manager",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(ws.router)
app.include_router(books.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(library.router, prefix="/api")
app.include_router(metadata.router, prefix="/api")
app.include_router(downloads.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "pagehound"}


# Serve cover images
covers_path = settings.covers_dir
if os.path.isdir(covers_path):
    app.mount("/covers", StaticFiles(directory=covers_path), name="covers")
