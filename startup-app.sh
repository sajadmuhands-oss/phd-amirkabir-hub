#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export BASE_PATH="${BASE_PATH:-/sajad_phd}"
export PORT="${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
