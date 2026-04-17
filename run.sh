#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -x ".venv/bin/uvicorn" ]]; then
  echo "Backend dependencies are missing."
  echo "Create a virtualenv and install them with:"
  echo "  python3 -m venv .venv"
  echo "  .venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

if [[ ! -d "frontend/node_modules" ]]; then
  echo "Frontend dependencies are missing."
  echo "Install them with:"
  echo "  npm --prefix frontend install"
  exit 1
fi

if [[ ! -f "backend/.env" && -f "backend/.env.example" ]]; then
  cp backend/.env.example backend/.env
fi

if [[ ! -f "frontend/.env.local" && -f "frontend/.env.example" ]]; then
  cp frontend/.env.example frontend/.env.local
fi

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

.venv/bin/uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

npm --prefix frontend run dev -- --host 127.0.0.1
