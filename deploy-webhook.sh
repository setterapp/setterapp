#!/bin/bash

# Script para desplegar el webhook de Instagram con todas las configuraciones necesarias
# Ejecuta: ./deploy-webhook.sh

set -e  # Exit on error

echo "🚀 Desplegando Instagram Webhook con IA"
echo "========================================"
echo ""

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ No se encontró archivo .env"
    exit 1
fi

PROJECT_REF="afqbakvvfpebnxzjewsk"

echo "📦 Proyecto: $PROJECT_REF"
echo ""

# Verificar que supabase CLI esté instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI no está instalado"
    echo "Instala con: brew install supabase/tap/supabase"
    exit 1
fi

# Verificar autenticación
echo "🔐 Verificando autenticación..."

# Si no hay SUPABASE_ACCESS_TOKEN, intentar login
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    if ! supabase projects list &> /dev/null; then
        echo ""
        echo "⚠️  No estás autenticado en Supabase"
        echo ""
        echo "Opción 1: Ejecutar login interactivo"
        echo "  supabase login"
        echo ""
        echo "Opción 2: Usar access token (recomendado para scripts)"
        echo "  1. Ve a https://supabase.com/dashboard/account/tokens"
        echo "  2. Genera un nuevo token"
        echo "  3. Ejecuta: export SUPABASE_ACCESS_TOKEN=tu_token_aqui"
        echo "  4. Vuelve a ejecutar este script"
        echo ""
        exit 1
    fi
fi

echo "✅ Autenticado correctamente"
echo ""

# Configurar secret de OPENAI_API_KEY
echo "🔑 Configurando OPENAI_API_KEY..."
if [ -z "$VITE_OPENAI_API_KEY" ]; then
    echo "❌ VITE_OPENAI_API_KEY no está configurado en .env"
    exit 1
fi

supabase secrets set OPENAI_API_KEY="$VITE_OPENAI_API_KEY" --project-ref "$PROJECT_REF"
echo "✅ Secret configurado"
echo ""

# Desplegar función
echo "📤 Desplegando función instagram-webhook..."
supabase functions deploy instagram-webhook --project-ref "$PROJECT_REF" --no-verify-jwt

echo ""
echo "✅ Deployment completado exitosamente!"
echo ""
echo "🧪 Para probar el webhook, ejecuta:"
echo "   ./test-webhook.sh"
echo ""
