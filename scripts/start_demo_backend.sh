#!/usr/bin/env bash
# Start a demo backend instance pointed at the demo data directory.
# Runs on port 8002 so it doesn't conflict with the real dev backend on 8001.
# Also builds the frontend and copies it into backend/static so the demo server
# can serve the full app on a single port.
#
# Usage:
#   scripts/start_demo_backend.sh
#
# Override the demo data dir:
#   DEMO_DATA_DIR=/tmp/pagehound-demo scripts/start_demo_backend.sh

set -e

DEMO_DATA_DIR="${DEMO_DATA_DIR:-$HOME/.local/share/pagehound-demo}"
PORT=8002

cd "$(dirname "$0")/.."

export DATABASE_URL="sqlite+aiosqlite:////$DEMO_DATA_DIR/pagehound.db"
export BOOKS_DIR="$DEMO_DATA_DIR"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export BASE_URL="http://localhost:$PORT"

# Build frontend and copy into backend/static so the demo server can serve it
echo "Building frontend..."
(cd frontend && npm run build --silent)
rm -rf backend/static
cp -r frontend/dist backend/static
echo "Frontend built."
echo ""

echo "Starting demo backend on http://localhost:$PORT"
echo "  DATABASE_URL=$DATABASE_URL"
echo "  BOOKS_DIR=$BOOKS_DIR"
echo ""
echo "Press Ctrl+C to stop."
echo ""

backend/.venv/bin/python3 -m uvicorn app.main:app \
    --host 127.0.0.1 \
    --port "$PORT" \
    --app-dir backend \
    --no-access-log
