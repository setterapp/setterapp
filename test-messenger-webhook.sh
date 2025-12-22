#!/usr/bin/env bash
set -euo pipefail

# Test script for Facebook Messenger webhook + Page subscription
#
# Usage:
#   export PAGE_ID="966649996531120"
#   export PAGE_ACCESS_TOKEN="EAAM..."
#   export VERIFY_TOKEN="appsetter_messenger_verify_..."
#   ./test-messenger-webhook.sh
#
# Optional:
#   export WEBHOOK_URL="https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/messenger-webhook"
#   export SEND_TO_PSID="123..."            # recipient PSID (required to send a real message)
#   export SEND_TEXT="hola desde setterapp" # optional

PAGE_ID="${PAGE_ID:-966649996531120}"
PAGE_ACCESS_TOKEN="${PAGE_ACCESS_TOKEN:-}"
VERIFY_TOKEN="${VERIFY_TOKEN:-appsetter_messenger_verify_2025_12_22_9fH2kL7qT3mV6wX1rZ8cN4pA}"
WEBHOOK_URL="${WEBHOOK_URL:-https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/messenger-webhook}"
SEND_TO_PSID="${SEND_TO_PSID:-}"
SEND_TEXT="${SEND_TEXT:-hello from test script}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load local secrets (NOT committed). Create one of these files locally:
# - .env (already gitignored in this repo)
# - .env.messenger.local (KEY=VALUE lines)
# - test-messenger-webhook.local.sh (exports)
if [[ -z "${PAGE_ACCESS_TOKEN}" ]]; then
  if [[ -f ".env" ]]; then
    # shellcheck disable=SC1091
    set -a
    source ".env"
    set +a
  elif [[ -f ".env.messenger.local" ]]; then
    # shellcheck disable=SC1091
    set -a
    source ".env.messenger.local"
    set +a
  elif [[ -f "test-messenger-webhook.local.sh" ]]; then
    # shellcheck disable=SC1091
    source "test-messenger-webhook.local.sh"
  fi
fi

# Re-read after sourcing
PAGE_ID="${PAGE_ID:-966649996531120}"
PAGE_ACCESS_TOKEN="${PAGE_ACCESS_TOKEN:-}"
VERIFY_TOKEN="${VERIFY_TOKEN:-appsetter_messenger_verify_2025_12_22_9fH2kL7qT3mV6wX1rZ8cN4pA}"
WEBHOOK_URL="${WEBHOOK_URL:-https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/messenger-webhook}"
SEND_TO_PSID="${SEND_TO_PSID:-}"
SEND_TEXT="${SEND_TEXT:-hello from test script}"

echo -e "${YELLOW}Messenger Webhook Test${NC}"
echo "Webhook URL: ${WEBHOOK_URL}"
echo "Page ID: ${PAGE_ID}"
echo ""

if [[ -z "${PAGE_ACCESS_TOKEN}" ]]; then
  echo -e "${RED}ERROR:${NC} Missing PAGE_ACCESS_TOKEN."
  echo "Set it with: export PAGE_ACCESS_TOKEN=\"EAAM...\""
  echo ""
  echo "Or create a local (gitignored) file:"
  echo "  .env.messenger.local  (recommended)"
  echo "    PAGE_ACCESS_TOKEN=\"EAAM...\""
  echo "    PAGE_ID=\"966649996531120\""
  echo "    VERIFY_TOKEN=\"${VERIFY_TOKEN}\""
  echo ""
  echo "  test-messenger-webhook.local.sh"
  echo "    export PAGE_ACCESS_TOKEN=\"EAAM...\""
  exit 1
fi

echo -e "${YELLOW}1) Verifying webhook endpoint (GET hub.challenge)${NC}"
CHALLENGE="challenge_$RANDOM$RANDOM"
VERIFY_URL="${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$VERIFY_TOKEN'''))")&hub.challenge=$CHALLENGE"

RESP="$(curl -sS -D - "$VERIFY_URL" -o /tmp/messenger_verify_body.txt || true)"
STATUS="$(echo "$RESP" | head -n 1 | awk '{print $2}')"
BODY="$(cat /tmp/messenger_verify_body.txt 2>/dev/null || true)"

if [[ "$STATUS" != "200" ]]; then
  echo -e "${RED}FAIL${NC}: webhook verify returned HTTP $STATUS"
  echo "Response headers:"
  echo "$RESP" | sed -n '1,20p'
  echo "Body:"
  echo "$BODY"
  exit 1
fi

if [[ "$BODY" != "$CHALLENGE" ]]; then
  echo -e "${RED}FAIL${NC}: expected body '$CHALLENGE' but got '$BODY'"
  exit 1
fi
echo -e "${GREEN}OK${NC}: webhook verification succeeded"
echo ""

echo -e "${YELLOW}2) Checking current Page subscription (GET /subscribed_apps)${NC}"
curl -sS "https://graph.facebook.com/v24.0/${PAGE_ID}/subscribed_apps?access_token=${PAGE_ACCESS_TOKEN}" | python3 -m json.tool || true
echo ""

echo -e "${YELLOW}3) Subscribing Page to app webhooks (POST /subscribed_apps)${NC}"
SUB_RES="$(curl -sS -X POST "https://graph.facebook.com/v24.0/${PAGE_ID}/subscribed_apps" \
  -d "subscribed_fields=messages,messaging_postbacks" \
  -d "access_token=${PAGE_ACCESS_TOKEN}" || true)"
echo "$SUB_RES" | python3 -m json.tool || echo "$SUB_RES"
echo ""

echo -e "${YELLOW}4) Sending a fake Messenger payload to the webhook (POST)${NC}"
FAKE_PAYLOAD="$(cat <<'JSON'
{
  "object": "page",
  "entry": [
    {
      "id": "966649996531120",
      "time": 0,
      "messaging": [
        {
          "sender": { "id": "1234567890123456" },
          "recipient": { "id": "966649996531120" },
          "timestamp": 1700000000000,
          "message": { "mid": "m_test_1", "text": "hello from test script" }
        }
      ]
    }
  ]
}
JSON
)"

POST_STATUS="$(curl -sS -o /tmp/messenger_post_body.txt -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  --data "$FAKE_PAYLOAD" || true)"

if [[ "$POST_STATUS" != "200" ]]; then
  echo -e "${RED}FAIL${NC}: webhook POST returned HTTP $POST_STATUS"
  cat /tmp/messenger_post_body.txt || true
  exit 1
fi

echo -e "${GREEN}OK${NC}: webhook POST returned 200"
echo "Response:"
cat /tmp/messenger_post_body.txt || true
echo ""

echo -e "${YELLOW}5) (Optional) Sending a real Messenger message via Send API${NC}"
if [[ -z "${SEND_TO_PSID}" ]]; then
  echo "Skipped: set SEND_TO_PSID to actually send a message."
  echo "Example:"
  echo "  export SEND_TO_PSID=\"<PSID>\""
  echo "  export SEND_TEXT=\"hola\""
  echo ""
  echo "Note: Messenger can only message users who have interacted with the Page (or are test users during dev)."
else
  SEND_PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "recipient": {"id": "${SEND_TO_PSID}"},
  "messaging_type": "RESPONSE",
  "message": {"text": "${SEND_TEXT}"}
}))
PY
)"
  SEND_STATUS="$(curl -sS -o /tmp/messenger_send_body.txt -w "%{http_code}" \
    -X POST "https://graph.facebook.com/v24.0/${PAGE_ID}/messages" \
    -H "Content-Type: application/json" \
    --data "$SEND_PAYLOAD" \
    -G --data-urlencode "access_token=${PAGE_ACCESS_TOKEN}" || true)"

  if [[ "$SEND_STATUS" != "200" ]]; then
    echo -e "${RED}FAIL${NC}: Send API returned HTTP $SEND_STATUS"
    cat /tmp/messenger_send_body.txt || true
    exit 1
  fi

  echo -e "${GREEN}OK${NC}: message sent"
  cat /tmp/messenger_send_body.txt || true
  echo ""
fi

echo -e "${GREEN}Done.${NC}"


