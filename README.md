# PageHound

A self-hosted e-book library manager. Scan your book collection, fetch metadata, read in the browser, and sync to a Kobo device — with real-time UI updates over WebSockets.

Intended as a modern replacement for Calibre-Web / Booklore.

---

## Features (planned)

- [x] Library scanning and indexing (EPUB, PDF, MOBI, AZW)
- [x] Real-time job status via WebSockets (no polling)
- [x] Dark mode
- [ ] Metadata fetch from Google Books and Open Library with confidence scoring
- [ ] Anna's Archive search and download
- [ ] In-browser reader (epub.js + pdf.js)
- [ ] Kobo sync (store API + OPDS)

---

## Requirements

### Local dev

- **Python 3.11+**
- **Node.js 20+**
- **tmux**
- **redis-server** — must be installed and on your PATH

  ```bash
  sudo apt install redis-server
  ```

  Redis is required at runtime; the dev script will print an error and refuse to start if it can't find `redis-server` or `docker`.

### Production (Docker Compose)

- Docker and Docker Compose

---

## Dev setup

```bash
git clone <repo>
cd pagehound

# Start everything: Redis, FastAPI backend, Celery worker, Vite frontend
./dev.sh
```

`dev.sh` creates a tmux session named `pagehound` with four windows:

| # | Name | What runs |
|---|------|-----------|
| 0 | redis | `redis-server` |
| 1 | backend | `uvicorn` with `--reload` on port 8001 |
| 2 | worker | Celery worker (waits for pip install to finish) |
| 3 | frontend | Vite dev server on port 5173 |

The frontend proxies `/api` and `/ws` to the backend, so `http://localhost:5173` is the only URL you need.

Press `prefix + R` inside the tmux session to restart everything cleanly.

### First run

On first run, `dev.sh` creates `backend/.env` with defaults. Edit it to set your books directory and data path:

```env
BOOKS_DIR=/path/to/your/books
DATABASE_URL=sqlite+aiosqlite:////home/you/pagehound-data/bookshelf.db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=change-me
BASE_URL=http://localhost:5173
```

The backend venv is created at `backend/.venv/` and populated automatically on first start.

---

## Production

```bash
cp .env.example .env
# edit .env

docker compose up -d
```

The stack is: FastAPI app + Celery worker + Redis + Caddy (reverse proxy serving the frontend build and proxying `/api` and `/ws`).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy async, SQLite / PostgreSQL |
| Task queue | Celery + Redis |
| Real-time | WebSockets (FastAPI native), Redis pub/sub fan-out |
| Frontend | React 18, TypeScript, Vite |
| UI | TailwindCSS, shadcn/ui (CSS token system) |
| Data fetching | TanStack Query |
| E-book parsing | ebooklib (EPUB), PyMuPDF (PDF) |
| Metadata | Google Books API, Open Library API |
| Kobo sync | Kobo store API + OPDS 1.2 |

---

## Linting and tests

```bash
# Backend
cd backend
.venv/bin/pip install -e ".[test]"
ruff check app/ tests/
.venv/bin/python3 -m pytest -q

# Frontend
cd frontend
npm run lint
npm test
npm run build   # type-check + build
```

CI runs all of the above on every push and PR via GitHub Actions.
