#!/usr/bin/env bash
set -euo pipefail

# Sends a FAKE Messenger webhook payload (object=page) to your Supabase Edge Function.
#
# Usage:
#   export WEBHOOK_URL="https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/messenger-webhook"
#   export PAGE_ID="966649996531120"
#   export SENDER_ID="1234567890123456"
#   export TEXT="hola desde payload fake"
#   ./test-messenger-webhook-payload.sh

WEBHOOK_URL="${WEBHOOK_URL:-https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/messenger-webhook}"
PAGE_ID="${PAGE_ID:-966649996531120}"
SENDER_ID="${SENDER_ID:-1234567890123456}"
TEXT="${TEXT:-hello from fake webhook payload}"
TIMESTAMP_MS="${TIMESTAMP_MS:-1700000000000}"

MID="${MID:-m_test_$(date +%s)}"

echo "POST -> ${WEBHOOK_URL}"
echo "page_id=${PAGE_ID}"
echo "sender_id=${SENDER_ID}"
echo "mid=${MID}"
echo "timestamp_ms=${TIMESTAMP_MS}"
echo "text=${TEXT}"
echo ""

PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "object": "page",
  "entry": [
    {
      "id": str("${PAGE_ID}"),
      "time": int(int("${TIMESTAMP_MS}")/1000),
      "messaging": [
        {
          "sender": { "id": str("${SENDER_ID}") },
          "recipient": { "id": str("${PAGE_ID}") },
          "timestamp": int("${TIMESTAMP_MS}"),
          "message": { "mid": str("${MID}"), "text": str("${TEXT}") }
        }
      ]
    }
  ]
}))
PY
)"

HTTP_STATUS="$(curl -sS -o /tmp/messenger_webhook_payload_resp.json -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD")"

echo "HTTP ${HTTP_STATUS}"
cat /tmp/messenger_webhook_payload_resp.json || true
echo ""

if [[ "${HTTP_STATUS}" != "200" ]]; then
  exit 1
fi


