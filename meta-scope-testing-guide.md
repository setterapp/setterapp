# Guía Oficial para Testear Scopes Requeridos por Meta

## Scopes que necesitas testear:
1. `instagram_business_manage_messages`
2. `public_profile`
3. `instagram_manage_comments`

## Método de Testing: Graph API Explorer

### 1. `instagram_business_manage_messages`
**Endpoint:** `POST /{ig-business-account-id}/messages`
**Propósito:** Enviar mensajes a través de Instagram

**Cuerpo de la petición:**
```json
{
  "recipient": {
    "id": "VALID_INSTAGRAM_USER_ID"
  },
  "message": {
    "text": "Test message for scope validation"
  }
}
```

**Para obtener un VALID_INSTAGRAM_USER_ID:**
- Usa el ID de tu propia cuenta de Instagram
- O crea un Test User en Meta Developers Console

**Respuesta esperada:** 200 OK con message_id

### 2. `public_profile`
**Endpoint:** `GET /{ig-business-account-id}?fields=id,name`
**Propósito:** Acceder a información básica del perfil

**Nota:** NO uses el campo `username` (está deprecated)

**Respuesta esperada:**
```json
{
  "id": "17841478766162049",
  "name": "Account Name"
}
```

### 3. `instagram_manage_comments`
**Endpoint:** `GET /{ig-business-account-id}/media?fields=id,comments`
**Propósito:** Gestionar comentarios en publicaciones

**Respuesta esperada:**
```json
{
  "data": [
    {
      "id": "post_id",
      "comments": {
        "data": [...]
      }
    }
  ]
}
```

## Pasos después del testing:

1. Ve a Meta Developers Console
2. App Review → Permissions and Features
3. Haz click en "Test" para cada scope
4. Selecciona "Yes, I have tested this"
5. Espera confirmación de Meta

## Notas importantes:

- Necesitas un access token válido con los scopes
- La app debe estar en Live Mode
- Para mensajes: el recipient debe existir y ser contactable
- Para comentarios: necesitas tener publicaciones con comentarios
