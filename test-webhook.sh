#!/bin/bash

# Script para testear los webhooks
# Uso: ./test-webhook.sh [instagram|whatsapp]

SUPABASE_URL="https://afqbakvvfpebnxzjewsk.supabase.co"
INSTAGRAM_VERIFY_TOKEN="d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec"
WHATSAPP_VERIFY_TOKEN="whatsapp_verify_token_change_me"

echo "🧪 Testing Webhooks"
echo "==================="
echo ""

if [ "$1" == "instagram" ] || [ -z "$1" ]; then
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
fi

if [ "$1" == "whatsapp" ] || [ -z "$1" ]; then
  echo "💬 Testing WhatsApp Webhook (GET - Verification)"
  echo "---------------------------------------------------"
  curl -s "${SUPABASE_URL}/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=test123"
  echo ""
  echo ""
  
  echo "💬 Testing WhatsApp Webhook (POST - Message)"
  echo "---------------------------------------------------"
  curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-webhook" \
    -H "Content-Type: application/json" \
    -d '{
      "object": "whatsapp_business_account",
      "entry": [{
        "id": "test_phone_number_id",
        "changes": [{
          "value": {
            "messages": [{
              "from": "1234567890",
              "id": "wamid_test_'$(date +%s)'",
              "timestamp": "'$(date +%s)'",
              "type": "text",
              "text": {
                "body": "Hola, este es un mensaje de prueba de WhatsApp"
              }
            }],
            "contacts": [{
              "profile": {
                "name": "Usuario de Prueba"
              }
            }]
          }
        }]
      }]
    }'
  echo ""
  echo ""
fi

echo "✅ Tests completados"
echo ""
echo "💡 Verifica los resultados:"
echo "   1. Los GET deben devolver el challenge (test123)"
echo "   2. Los POST deben devolver {\"success\":true}"
echo "   3. Revisa los logs en Supabase Dashboard"
echo "   4. Verifica en la base de datos: SELECT * FROM conversations; SELECT * FROM messages;"

