#!/bin/bash

# Script de diagnóstico para Instagram Webhook + IA
# Verifica que todo esté configurado correctamente

set -e

echo "🔍 DIAGNÓSTICO DE INSTAGRAM WEBHOOK + IA"
echo "========================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
WEBHOOK_URL="https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook"
VERIFY_TOKEN="d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec"
INSTAGRAM_USER_ID="25615450914733984"

echo "📋 CONFIGURACIÓN ACTUAL:"
echo "  Webhook URL: $WEBHOOK_URL"
echo "  Instagram User ID: $INSTAGRAM_USER_ID"
echo ""

# Test 1: Verificar que el webhook responde
echo "1️⃣ Verificando que el webhook responde..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=test123")

if [ "$RESPONSE" -eq 200 ]; then
    echo -e "  ${GREEN}✅ Webhook responde correctamente${NC}"
else
    echo -e "  ${RED}❌ Webhook NO responde (código: $RESPONSE)${NC}"
fi

echo ""

# Test 2: Simular mensaje de Instagram
echo "2️⃣ Simulando mensaje de Instagram..."
TEST_MESSAGE=$(cat <<EOF
{
  "object": "instagram",
  "entry": [{
    "id": "$INSTAGRAM_USER_ID",
    "time": $(date +%s),
    "messaging": [{
      "sender": {"id": "test_sender_123"},
      "recipient": {"id": "$INSTAGRAM_USER_ID"},
      "timestamp": $(date +%s)000,
      "message": {
        "mid": "test_message_id_$(date +%s)",
        "text": "Hola! Este es un mensaje de prueba"
      }
    }]
  }]
}
EOF
)

RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$TEST_MESSAGE")

echo -e "  ${GREEN}✅ Mensaje enviado al webhook${NC}"
echo "  Respuesta: $RESPONSE"
echo ""

# Verificar logs en Supabase
echo "3️⃣ Para ver los logs del webhook:"
echo "  supabase functions logs instagram-webhook --project-ref afqbakvvfpebnxzjewsk"
echo ""

# Instrucciones para Meta
echo "⚠️  PROBLEMA COMÚN: Webhooks solo funcionan en modo TEST"
echo ""
echo -e "${YELLOW}Si el curl funciona pero mensajes reales NO llegan:${NC}"
echo ""
echo "CAUSA: Tu app de Meta está en modo DESARROLLO y solo recibe mensajes de TESTERS"
echo ""
echo "SOLUCIÓN 1: Agregar usuarios como testers (rápido)"
echo "  1. Ve a https://developers.facebook.com/apps"
echo "  2. Selecciona tu app"
echo "  3. Ve a 'Roles' → 'Roles de Prueba'"
echo "  4. Agrega las cuentas de Instagram como testers"
echo "  5. Acepta la invitación en cada cuenta"
echo ""
echo "SOLUCIÓN 2: Mover app a PRODUCCIÓN (requiere revisión)"
echo "  1. Ve a https://developers.facebook.com/apps"
echo "  2. Selecciona tu app"
echo "  3. Ve a 'Configuración de la App' → 'Básico'"
echo "  4. Cambia el modo de la app de 'Desarrollo' a 'Producción'"
echo "  ⚠️  NOTA: Requiere que Meta revise y apruebe tu app"
echo ""
echo "VERIFICAR TAMBIÉN:"
echo "  ✅ Webhook URL configurada en Meta:"
echo "     https://developers.facebook.com/apps → Tu App → Webhooks"
echo "     URL: $WEBHOOK_URL"
echo "     Verify Token: $VERIFY_TOKEN"
echo ""
echo "  ✅ Suscripciones activas:"
echo "     - messages (obligatorio)"
echo "     - messaging_postbacks (opcional)"
echo ""
echo "  ✅ Permisos aprobados:"
echo "     - instagram_business_basic"
echo "     - instagram_business_manage_messages"
echo ""

# Verificar si hay agente de Instagram
echo "4️⃣ Verificando agente de Instagram..."
echo "  Para que la IA responda automáticamente, necesitas:"
echo "  1. Ir a la página 'Agentes' en tu app"
echo "  2. Crear un agente nuevo"
echo "  3. Asignarle la plataforma 'Instagram'"
echo "  4. Configurar su personalidad y respuestas"
echo ""

echo "✅ Diagnóstico completado!"
echo ""
echo "📚 Referencias útiles:"
echo "  - Meta Webhooks Setup: https://developers.facebook.com/docs/graph-api/webhooks/getting-started"
echo "  - Instagram Messaging: https://developers.facebook.com/docs/messenger-platform/instagram"
echo ""
