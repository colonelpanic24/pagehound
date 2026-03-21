import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import init_db
from .routers import books, downloads, jobs, kobo, kobo_admin, library, metadata, opds, ws
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
    version="0.2.0",
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
app.include_router(kobo_admin.router, prefix="/api")
app.include_router(kobo.router)
app.include_router(opds.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "pagehound"}


# Serve cover images
covers_path = settings.covers_dir
if os.path.isdir(covers_path):
    app.mount("/covers", StaticFiles(directory=covers_path), name="covers")

# Serve frontend build if present (demo / production mode).
# The StaticFiles mount serves JS/CSS/image assets; the catch-all route below
# serves index.html for any SPA deep-link path that isn't an asset.
_static_dir = Path(__file__).resolve().parent.parent / "static"
if _static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        from fastapi import HTTPException
        # Let the API, WebSocket, and Kobo/OPDS routers handle their own prefixes
        _api_prefixes = ("api/", "ws", "covers/", "kobo/", "opds")
        if any(full_path.startswith(p) for p in _api_prefixes):
            raise HTTPException(status_code=404, detail="Not found")
        index = _static_dir / "index.html"
        return FileResponse(str(index))
