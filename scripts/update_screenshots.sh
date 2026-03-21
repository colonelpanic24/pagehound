#!/usr/bin/env bash
# Generate README screenshots.
#
# 1. Seeds a demo database with fictional library data.
# 2. Builds the frontend.
# 3. Starts a demo backend on port 8002.
# 4. Installs Playwright (if needed) and captures screenshots.
# 5. Kills the demo backend.
#
# Prerequisites:
#   - Redis must be running (redis-server on localhost:6379)
#   - backend/.venv/ must exist (run dev.sh at least once)
#
# Usage (from repo root):
#   scripts/update_screenshots.sh

set -e
cd "$(dirname "$0")/.."

DEMO_DATA_DIR="${DEMO_DATA_DIR:-$HOME/.local/share/pagehound-demo}"
PORT=8002
VENV="backend/.venv/bin/python3"
PIP="backend/.venv/bin/pip"

echo "==> Seeding demo database..."
DEMO_DATA_DIR="$DEMO_DATA_DIR" "$VENV" scripts/seed_screenshots.py

echo ""
echo "==> Building frontend..."
(cd frontend && npm run build --silent)
rm -rf backend/static
cp -r frontend/dist backend/static
echo "    Frontend built."

echo ""
echo "==> Starting demo backend on port $PORT..."
DEMO_DATA_DIR="$DEMO_DATA_DIR" \
DATABASE_URL="sqlite+aiosqlite:////$DEMO_DATA_DIR/pagehound.db" \
BOOKS_DIR="$DEMO_DATA_DIR" \
BASE_URL="http://localhost:$PORT" \
    "$VENV" -m uvicorn app.main:app \
        --host 127.0.0.1 \
        --port "$PORT" \
        --app-dir backend \
        --no-access-log &
BACKEND_PID=$!

# Give the backend time to start
sleep 3

# Ensure backend gets killed on exit
trap "kill $BACKEND_PID 2>/dev/null || true; rm -rf backend/static" EXIT

echo ""
echo "==> Installing Playwright (if needed)..."
"$PIP" install playwright --quiet
"$VENV" -m playwright install chromium --quiet

echo ""
echo "==> Capturing screenshots..."
PAGEHOUND_URL="http://localhost:$PORT" "$VENV" scripts/capture_screenshots.py

echo ""
echo "Screenshots written to docs/screenshots/"
