#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -e "$BACKEND_DIR[dev]"
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
