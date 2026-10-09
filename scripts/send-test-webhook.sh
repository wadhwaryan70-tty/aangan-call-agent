#!/usr/bin/env bash
# Usage: VAANI_WEBHOOK_SECRET=... ./scripts/send-test-webhook.sh https://your-app.vercel.app
set -euo pipefail
URL="${1:-http://localhost:3000}"
BODY="$(cat "$(dirname "$0")/sample-webhook.json")"
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$VAANI_WEBHOOK_SECRET" | sed 's/^.* //')"
curl -sS -X POST "$URL/api/vaani/webhook" -H "Content-Type: application/json" -H "X-VaaniYantra-Signature: $SIG" --data "$BODY"
echo
