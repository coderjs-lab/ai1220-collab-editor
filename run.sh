#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

if [[ ! -x "$VENV_DIR/bin/uvicorn" ]]; then
  "$VENV_DIR/bin/pip" install -e "$BACKEND_DIR[dev]"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  npm --prefix "$FRONTEND_DIR" install
fi

if [[ ! -f "$BACKEND_DIR/.env" && -f "$BACKEND_DIR/.env.example" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

if [[ ! -f "$FRONTEND_DIR/.env.local" && -f "$FRONTEND_DIR/.env.example" ]]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
fi

cleanup() {
  kill 0 >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

(
  cd "$BACKEND_DIR"
  "$VENV_DIR/bin/uvicorn" app.main:app --reload --host 0.0.0.0 --port 3001
) &

(
  cd "$FRONTEND_DIR"
  npm run dev
) &

wait
