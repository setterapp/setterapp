#!/bin/bash

# Script completo para testear los 3 scopes requeridos por Meta
# Uso: ./test-meta-scopes.sh TU_ACCESS_TOKEN
# Ejemplo: ./test-meta-scopes.sh EAAMtFP7t1yABQ...

set -e  # Salir si hay error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
IG_BUSINESS_ACCOUNT_ID="17841478766162049"
ACCESS_TOKEN="$1"
TEST_USER="mimetria.agency"  # Tu único seguidor
RECIPIENT_ID_DEFAULT="1552806385871069"  # ID del seguidor encontrado

# Función para imprimir con color
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
    esac
}

# Función para hacer requests con curl
make_request() {
    local method=$1
    local url=$2
    local data=$3

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl -s -X POST "$url" \
             -H "Content-Type: application/json" \
             -d "$data" 2>/dev/null
    else
        curl -s "$url" 2>/dev/null
    fi
}

# Función para validar respuesta JSON
validate_json_response() {
    local response=$1
    local expected_field=$2

    # Verificar si es JSON válido
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        echo "INVALID_JSON"
        return 1
    fi

    # Verificar si contiene el campo esperado
    if echo "$response" | jq -e "$expected_field" >/dev/null 2>&1; then
        echo "HAS_FIELD"
    else
        echo "MISSING_FIELD"
    fi
}

# Función para buscar ID del usuario
find_user_id() {
    local username=$1
    print_status "INFO" "Buscando ID de usuario: $username..."

    # Intentar buscar por username
    SEARCH_URL="https://graph.instagram.com/v21.0/ig_hashtag_search?user_id=${IG_BUSINESS_ACCOUNT_ID}&q=${username}&access_token=${ACCESS_TOKEN}"

    SEARCH_RESPONSE=$(make_request "GET" "$SEARCH_URL")
    USER_ID=$(echo "$SEARCH_RESPONSE" | jq -r '.data[0].id // empty' 2>/dev/null)

    if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
        echo "$USER_ID"
        return 0
    fi

    # Si no funciona, intentar con conversaciones existentes
    CONVERSATIONS_URL="https://graph.facebook.com/v24.0/${IG_BUSINESS_ACCOUNT_ID}/conversations?access_token=${ACCESS_TOKEN}"

    CONV_RESPONSE=$(make_request "GET" "$CONVERSATIONS_URL")
    USER_ID=$(echo "$CONV_RESPONSE" | jq -r '.data[0].participants.data[0].id // empty' 2>/dev/null)

    if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
        echo "$USER_ID"
        return 0
    fi

    echo ""
    return 1
}

# Verificar argumentos
if [ -z "$ACCESS_TOKEN" ]; then
    print_status "ERROR" "Falta ACCESS_TOKEN"
    echo ""
    echo "Uso: $0 TU_ACCESS_TOKEN [RECIPIENT_ID]"
    echo ""
    echo "Cómo obtener el token:"
    echo "1. Ve a: https://developers.facebook.com/tools/explorer/"
    echo "2. Selecciona tu app"
    echo "3. Generate Access Token con estos scopes:"
    echo "   - instagram_business_manage_messages"
    echo "   - public_profile"
    echo "   - instagram_manage_comments"
    echo "   - pages_read_engagement"
    echo "   - pages_show_list"
    echo "4. Copia el token completo"
    echo ""
    echo "Ejemplos:"
    echo "  $0 TU_TOKEN_COMPLETO"
    echo "  $0 TU_TOKEN_COMPLETO 17841405822304941  # Con ID específico"
    exit 1
fi

# ID de recipient opcional como segundo argumento
if [ -n "$2" ]; then
    RECIPIENT_ID="$2"
    print_status "INFO" "Usando ID de recipient específico: $RECIPIENT_ID"
fi

echo "🧪 Iniciando tests de scopes requeridos por Meta..."
echo "📱 Instagram Business Account ID: $IG_BUSINESS_ACCOUNT_ID"
echo ""

TEST_RESULTS=()

# Determinar ID del recipient
if [ -z "$RECIPIENT_ID" ]; then
    echo "📍 Usando ID conocido del seguidor '$TEST_USER'..."
    RECIPIENT_ID="$RECIPIENT_ID_DEFAULT"

    if [ -z "$RECIPIENT_ID" ]; then
        print_status "INFO" "Usando ID conocido de '$TEST_USER': $RECIPIENT_ID_DEFAULT"
        RECIPIENT_ID="$RECIPIENT_ID_DEFAULT"
    else
        print_status "OK" "ID encontrado para '$TEST_USER': $RECIPIENT_ID"
    fi
else
    print_status "INFO" "Usando ID de recipient proporcionado: $RECIPIENT_ID"
fi

echo ""

# 1. Test instagram_business_manage_messages
echo "1. Testeando instagram_business_manage_messages..."
MESSAGE_URL="https://graph.facebook.com/v24.0/${IG_BUSINESS_ACCOUNT_ID}/messages"
MESSAGE_DATA='{"recipient":{"id":"'$RECIPIENT_ID'"},"message":{"text":"Test message for scope validation"}}'

MESSAGE_RESPONSE=$(make_request "POST" "$MESSAGE_URL" "$MESSAGE_DATA")
MESSAGE_VALIDATION=$(validate_json_response "$MESSAGE_RESPONSE" '.message_id')

if [ "$MESSAGE_VALIDATION" = "HAS_FIELD" ]; then
    print_status "OK" "instagram_business_manage_messages: Test exitoso"
    TEST_RESULTS+=("instagram_business_manage_messages:PASSED")
elif echo "$MESSAGE_RESPONSE" | grep -q "Unsupported post request"; then
    print_status "WARNING" "instagram_business_manage_messages: Recipient ID inválido (cambiar recipient.id)"
    TEST_RESULTS+=("instagram_business_manage_messages:NEEDS_RECIPIENT")
else
    print_status "ERROR" "instagram_business_manage_messages: Falló"
    echo "   Respuesta: $MESSAGE_RESPONSE"
    TEST_RESULTS+=("instagram_business_manage_messages:FAILED")
fi

echo ""

# 2. Test public_profile
echo "2. Testeando public_profile..."
PROFILE_URL="https://graph.facebook.com/v24.0/${IG_BUSINESS_ACCOUNT_ID}?fields=id,name&access_token=${ACCESS_TOKEN}"

PROFILE_RESPONSE=$(make_request "GET" "$PROFILE_URL")
PROFILE_VALIDATION=$(validate_json_response "$PROFILE_RESPONSE" '.id')

if [ "$PROFILE_VALIDATION" = "HAS_FIELD" ]; then
    ACCOUNT_NAME=$(echo "$PROFILE_RESPONSE" | jq -r '.name // "N/A"')
    print_status "OK" "public_profile: Test exitoso - Cuenta: $ACCOUNT_NAME"
    TEST_RESULTS+=("public_profile:PASSED")
else
    print_status "ERROR" "public_profile: Falló"
    echo "   Respuesta: $PROFILE_RESPONSE"
    TEST_RESULTS+=("public_profile:FAILED")
fi

echo ""

# 3. Test instagram_manage_comments
echo "3. Testeando instagram_manage_comments..."
COMMENTS_URL="https://graph.facebook.com/v24.0/${IG_BUSINESS_ACCOUNT_ID}/media?fields=id,comments&access_token=${ACCESS_TOKEN}"

COMMENTS_RESPONSE=$(make_request "GET" "$COMMENTS_URL")
COMMENTS_VALIDATION=$(validate_json_response "$COMMENTS_RESPONSE" '.data')

if [ "$COMMENTS_VALIDATION" = "HAS_FIELD" ]; then
    MEDIA_COUNT=$(echo "$COMMENTS_RESPONSE" | jq '.data | length' 2>/dev/null || echo "0")
    print_status "OK" "instagram_manage_comments: Test exitoso - Media encontrada: $MEDIA_COUNT"
    TEST_RESULTS+=("instagram_manage_comments:PASSED")
else
    print_status "ERROR" "instagram_manage_comments: Falló"
    echo "   Respuesta: $COMMENTS_RESPONSE"
    TEST_RESULTS+=("instagram_manage_comments:FAILED")
fi

echo ""

# Resumen final
echo "📊 RESUMEN DE TESTS:"
echo ""

PASSED_COUNT=0
FAILED_COUNT=0
NEEDS_RECIPIENT=0

for result in "${TEST_RESULTS[@]}"; do
    scope=$(echo "$result" | cut -d: -f1)
    status=$(echo "$result" | cut -d: -f2)

    case $status in
        "PASSED")
            print_status "OK" "$scope: PASSED"
            ((PASSED_COUNT++))
            ;;
        "FAILED")
            print_status "ERROR" "$scope: FAILED"
            ((FAILED_COUNT++))
            ;;
        "NEEDS_RECIPIENT")
            print_status "WARNING" "$scope: Requiere recipient ID válido"
            ((NEEDS_RECIPIENT++))
            ;;
    esac
done

echo ""
if [ $FAILED_COUNT -eq 0 ] && [ $NEEDS_RECIPIENT -eq 0 ]; then
    print_status "OK" "🎉 TODOS LOS TESTS PASARON!"
    echo ""
    echo "🚀 Próximos pasos:"
    echo "1. Ve a Meta Developers Console"
    echo "2. App Review → Permissions and Features"
    echo "3. Haz click en 'Test' para cada scope"
    echo "4. Selecciona 'Yes, I have tested this permission'"
elif [ $NEEDS_RECIPIENT -gt 0 ]; then
    print_status "WARNING" "Algunos tests requieren configuración adicional"
    echo ""
    echo "💡 Para instagram_business_manage_messages:"
    echo "   Cambia el recipient.id por un ID válido de usuario de Instagram"
else
    print_status "ERROR" "Algunos tests fallaron - revisa el token y configuración"
fi

echo ""
print_status "INFO" "Token usado: ${ACCESS_TOKEN:0:20}..."
echo ""
echo "💡 Tips:"
echo "   - Si el token falla, genera uno nuevo en Graph API Explorer"
echo "   - Asegúrate de que tu app esté en Live Mode"
echo "   - Para mensajes: usa un ID de usuario que te siga"
