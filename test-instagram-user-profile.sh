#!/bin/bash

# Script para probar Instagram User Profile API
# Requiere: Page Access Token y Instagram Scoped User ID (IGSID)

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Instagram User Profile API - Test Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Solicitar Instagram Scoped User ID (IGSID)
echo -e "${YELLOW}📝 Ingresa el Instagram Scoped User ID (IGSID):${NC}"
echo -e "${YELLOW}   (El ID que viene en el webhook, ejemplo: 1234567890)${NC}"
read -p "IGSID: " IGSID

if [ -z "$IGSID" ]; then
  echo -e "${RED}❌ Error: IGSID no puede estar vacío${NC}"
  exit 1
fi

# Solicitar Page Access Token
echo ""
echo -e "${YELLOW}🔑 Ingresa el Page Access Token:${NC}"
echo -e "${YELLOW}   (Lo puedes obtener de la base de datos o de Facebook Graph API Explorer)${NC}"
read -p "Token: " PAGE_TOKEN

if [ -z "$PAGE_TOKEN" ]; then
  echo -e "${RED}❌ Error: Page Access Token no puede estar vacío${NC}"
  exit 1
fi

# Construir URL
API_VERSION="v24.0"
BASE_URL="https://graph.facebook.com"
FIELDS="name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user"
URL="${BASE_URL}/${API_VERSION}/${IGSID}?fields=${FIELDS}&access_token=${PAGE_TOKEN}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 Ejecutando petición...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📍 Endpoint:${NC} ${BASE_URL}/${API_VERSION}/${IGSID}"
echo -e "${YELLOW}📋 Fields:${NC} ${FIELDS}"
echo ""

# Hacer la petición
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$URL")

# Separar body y status code
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📥 Respuesta:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Status Code:${NC} ${HTTP_CODE}"
echo ""

# Formatear JSON si está disponible jq
if command -v jq &> /dev/null; then
  echo -e "${YELLOW}Response Body (formatted):${NC}"
  echo "$HTTP_BODY" | jq '.'
else
  echo -e "${YELLOW}Response Body:${NC}"
  echo "$HTTP_BODY"
  echo ""
  echo -e "${YELLOW}💡 Tip: Instala 'jq' para ver el JSON formateado (brew install jq)${NC}"
fi

echo ""

# Verificar si fue exitoso
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Petición exitosa!${NC}"

  # Extraer datos específicos si jq está disponible
  if command -v jq &> /dev/null; then
    USERNAME=$(echo "$HTTP_BODY" | jq -r '.username // "N/A"')
    NAME=$(echo "$HTTP_BODY" | jq -r '.name // "N/A"')

    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📊 Datos obtenidos:${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Username:${NC} ${USERNAME}"
    echo -e "${YELLOW}Name:${NC} ${NAME}"
  fi
else
  echo -e "${RED}❌ Error en la petición${NC}"

  # Mostrar mensaje de error si existe
  if command -v jq &> /dev/null; then
    ERROR_MSG=$(echo "$HTTP_BODY" | jq -r '.error.message // "No error message"')
    ERROR_CODE=$(echo "$HTTP_BODY" | jq -r '.error.code // "N/A"')
    ERROR_TYPE=$(echo "$HTTP_BODY" | jq -r '.error.type // "N/A"')

    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}🚨 Detalles del error:${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Error Code:${NC} ${ERROR_CODE}"
    echo -e "${YELLOW}Error Type:${NC} ${ERROR_TYPE}"
    echo -e "${YELLOW}Message:${NC} ${ERROR_MSG}"

    # Consejos según el error
    if [ "$ERROR_CODE" = "190" ]; then
      echo ""
      echo -e "${YELLOW}💡 Error 190 significa:${NC}"
      echo -e "   - Token inválido o expirado"
      echo -e "   - Token de tipo incorrecto (necesitas Page Access Token)"
      echo -e "   - Permisos insuficientes"
    elif [ "$ERROR_CODE" = "100" ]; then
      echo ""
      echo -e "${YELLOW}💡 Error 100 significa:${NC}"
      echo -e "   - IGSID inválido"
      echo -e "   - Usuario no encontrado"
      echo -e "   - No tienes permiso para acceder a este usuario"
    fi
  fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Fin del test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
