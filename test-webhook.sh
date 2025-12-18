#!/bin/bash

# Script para testear el webhook de Instagram
# Uso: ./test-webhook.sh

SUPABASE_URL="https://afqbakvvfpebnxzjewsk.supabase.co"
INSTAGRAM_VERIFY_TOKEN="d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec"

echo "🧪 Testing Instagram Webhook"
echo "============================"
echo ""

echo "📱 Testing Instagram Webhook (GET - Verification)"
echo "---------------------------------------------------"
curl -s "${SUPABASE_URL}/functions/v1/instagram-webhook?hub.mode=subscribe&hub.verify_token=${INSTAGRAM_VERIFY_TOKEN}&hub.challenge=test123"
echo ""
echo ""

echo "📱 Testing Instagram Webhook (POST - Message)"
echo "---------------------------------------------------"
curl -X POST "${SUPABASE_URL}/functions/v1/instagram-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "test_page_id",
      "messaging": [{
        "sender": {"id": "123456789"},
        "recipient": {"id": "987654321"},
        "timestamp": '$(date +%s)',
        "message": {
          "mid": "msg_test_'$(date +%s)'",
          "text": "Hola, este es un mensaje de prueba de Instagram"
        }
      }]
    }]
  }'
echo ""
echo ""

echo "✅ Tests completados"
echo ""
echo "💡 Verifica los resultados:"
echo "   1. El GET debe devolver el challenge (test123)"
echo "   2. El POST debe devolver {\"success\":true}"
echo "   3. Revisa los logs en Supabase Dashboard"
echo "   4. Verifica en la base de datos: SELECT * FROM conversations; SELECT * FROM messages;"
