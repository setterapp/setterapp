#!/bin/bash

# Script para testear scopes de Instagram desde PC
# Reemplaza estos valores:
ACCESS_TOKEN="TU_ACCESS_TOKEN_AQUI"
INSTAGRAM_ID="17841478766162049"
RECIPIENT_ID="VALID_INSTAGRAM_USER_ID"  # Para mensajes

echo "🧪 Probando scopes de Instagram Business API..."
echo "=========================================="

# 1. Test public_profile
echo "1. Probando public_profile..."
curl -X GET "https://graph.instagram.com/v21.0/${INSTAGRAM_ID}?fields=id,name&access_token=${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo -e "\n=========================================="

# 2. Test instagram_manage_comments
echo "2. Probando instagram_manage_comments..."
curl -X GET "https://graph.instagram.com/v21.0/${INSTAGRAM_ID}/media?fields=id,comments&access_token=${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo -e "\n=========================================="

# 3. Test instagram_business_manage_messages
echo "3. Probando instagram_business_manage_messages..."
curl -X POST "https://graph.instagram.com/v21.0/${INSTAGRAM_ID}/messages" \
  -H "Content-Type: application/json" \
  -d "{
    \"recipient\": {
      \"id\": \"${RECIPIENT_ID}\"
    },
    \"message\": {
      \"text\": \"Test message from PC testing\"
    },
    \"access_token\": \"${ACCESS_TOKEN}\"
  }" | jq '.'

echo -e "\n✅ Tests completados. Revisa las respuestas arriba."
