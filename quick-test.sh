#!/bin/bash

# Test rápido de scopes - versión simplificada
# Uso: ./quick-test.sh TU_ACCESS_TOKEN

ACCESS_TOKEN="$1"
IG_BUSINESS_ACCOUNT_ID="17841478766162049"

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Falta ACCESS_TOKEN"
    echo "Uso: $0 TU_ACCESS_TOKEN"
    echo ""
    echo "Obtén el token de: https://developers.facebook.com/tools/explorer/"
    exit 1
fi

echo "🧪 Test rápido de scopes requeridos por Meta..."
echo ""

# Test 1: public_profile
echo "1. Testing public_profile..."
RESPONSE=$(curl -s "https://graph.facebook.com/v24.0/${IG_BUSINESS_ACCOUNT_ID}?fields=id,name&access_token=${ACCESS_TOKEN}")

if echo "$RESPONSE" | grep -q '"id"'; then
    NAME=$(echo "$RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    echo "✅ public_profile: OK - Cuenta: $NAME"
else
    echo "❌ public_profile: FAILED"
    echo "   Response: $RESPONSE"
fi

echo ""

# Test 2: instagram_manage_comments
echo "2. Testing instagram_manage_comments..."
RESPONSE=$(curl -s "https://graph.facebook.com/v24.0/${IG_BUSINESS_ACCOUNT_ID}/media?fields=id,comments&access_token=${ACCESS_TOKEN}")

if echo "$RESPONSE" | grep -q '"data"'; then
    COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
    echo "✅ instagram_manage_comments: OK - Media found: $COUNT"
else
    echo "❌ instagram_manage_comments: FAILED"
    echo "   Response: $RESPONSE"
fi

echo ""
echo "💡 Para instagram_business_manage_messages, necesitas un recipient ID válido."
echo "   Si tienes el ID de mimetria.agency, ejecuta:"
echo "   ./test-meta-scopes.sh $ACCESS_TOKEN ID_DE_MIMETRIA"
