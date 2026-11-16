#!/usr/bin/env bash
# Update the research-track Worker ORIGIN secret.
# Usage: ./cloudflare/set-origin.sh https://your-upstream.example
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${CLOUDFLARE_ENV_FILE:-$ROOT/.env.cloudflare}"
ORIGIN="${1:-}"
if [[ -z "$ORIGIN" ]]; then
  echo "Usage: $0 https://upstream-host" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE (see .env.cloudflare.example)" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${CLOUDFLARE_API_TOKEN:?}" "${CLOUDFLARE_ACCOUNT_ID:?}"
SCRIPT_NAME="${WORKER_SCRIPT_NAME:-research-track}"
PAYLOAD="$(ORIGIN="$ORIGIN" python3 -c 'import json,os; print(json.dumps({"name":"ORIGIN","text":os.environ["ORIGIN"],"type":"secret_text"}))')"
curl -sS -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/secrets" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("ok" if d.get("success") else d); raise SystemExit(0 if d.get("success") else 1)'
echo "ORIGIN updated for worker ${SCRIPT_NAME}"
