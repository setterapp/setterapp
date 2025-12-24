#!/bin/bash

# Script para ver logs de las Edge Functions en tiempo real
# Uso: ./scripts/view-function-logs.sh [function-name]

FUNCTION_NAME=${1:-"create-meeting"}

echo "📊 Monitoreando logs de: $FUNCTION_NAME"
echo "🔍 Presiona Ctrl+C para salir"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Ver logs en tiempo real
supabase functions logs $FUNCTION_NAME --follow
