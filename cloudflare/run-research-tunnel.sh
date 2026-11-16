#!/usr/bin/env bash
# Run a Cloudflare quick tunnel to the local Research Track Next.js app.
# Then refresh the Worker ORIGIN secret:
#   ./cloudflare/set-origin.sh https://<printed-trycloudflare-host>
set -euo pipefail
exec cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate
