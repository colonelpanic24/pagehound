#!/usr/bin/env bash
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
SESSION="pagehound"
DATA_DIR="$HOME/.local/share/pagehound"

# Create local data dir and write a dev .env if one doesn't exist
mkdir -p "$DATA_DIR"
ENV_FILE="$REPO/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
BOOKS_DIR=$HOME/Books
DATABASE_URL=sqlite+aiosqlite:///$DATA_DIR/bookshelf.db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=dev-secret-key-change-in-prod
BASE_URL=http://localhost:5173
EOF
  echo "Created $ENV_FILE"
fi

# Kill existing session so re-running dev.sh always does a clean restart
tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -x 220 -y 50

VENV="$REPO/backend/.venv"

# ── Window 0: Redis ───────────────────────────────────────────────────────────
# If something is already listening on 6379 (e.g. the system redis service),
# skip launching our own instance and just show status.
tmux rename-window -t "$SESSION:0" "redis"
if redis-cli ping &>/dev/null; then
  tmux send-keys -t "$SESSION:0" "echo 'Redis already running — skipping start. Tailing /var/log/redis/redis-server.log (Ctrl-C to stop):' && tail -f /var/log/redis/redis-server.log 2>/dev/null || cat" Enter
elif command -v redis-server &>/dev/null; then
  tmux send-keys -t "$SESSION:0" "redis-server --loglevel warning" Enter
elif command -v docker &>/dev/null; then
  tmux send-keys -t "$SESSION:0" "docker run --rm -p 6379:6379 redis:7-alpine" Enter
else
  tmux send-keys -t "$SESSION:0" "echo 'ERROR: Redis not found. Install: sudo apt install redis-server'" Enter
  echo "WARNING: Redis not found on this machine. Install: sudo apt install redis-server"
fi

# ── Window 1: Backend (FastAPI + uvicorn --reload) ────────────────────────────
tmux new-window -t "$SESSION" -n "backend"
tmux send-keys -t "$SESSION:1" "cd '$REPO/backend' && \
  ([ ! -d .venv ] && python3 -m venv .venv; true) && \
  source .venv/bin/activate && \
  pip install -e . -q && \
  uvicorn app.main:app --reload --port 8001" Enter

# ── Window 2: Celery worker ───────────────────────────────────────────────────
# Wait for the backend window's pip install to finish before starting celery.
tmux new-window -t "$SESSION" -n "worker"
tmux send-keys -t "$SESSION:2" "cd '$REPO/backend' && \
  echo 'Waiting for venv...' && \
  until [ -x .venv/bin/celery ]; do sleep 1; done && \
  source .venv/bin/activate && \
  celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2" Enter

# ── Window 3: Frontend (Vite --host for LAN access) ──────────────────────────
tmux new-window -t "$SESSION" -n "frontend"
tmux send-keys -t "$SESSION:3" "cd '$REPO/frontend' && npm install --silent && npm run dev" Enter

# Focus the backend window on attach
tmux select-window -t "$SESSION:1"

# prefix+R to do a clean restart of everything
tmux bind-key R detach-client -E "cd '$REPO' && '$REPO/dev.sh'"

tmux attach -t "$SESSION"
