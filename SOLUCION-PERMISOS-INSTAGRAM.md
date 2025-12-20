# Solución: "Application does not have the capability to make this API call"

Este error significa que tu app no tiene los permisos necesarios o estás usando el endpoint/token incorrecto.

## Solución 1: Usar el endpoint correcto según tu token

### Si tienes un token de Página (Page Token):

En lugar de `/me/accounts`, usa directamente el ID de tu página:

```
GET /{page-id}?fields=id,name,instagram_business_account
```

Reemplaza `{page-id}` con el ID de tu página de Facebook.

### Si tienes un token de Usuario:

Primero necesitas obtener las páginas a las que tienes acceso:

```
GET /me?fields=accounts{id,name,instagram_business_account}
```

O si tienes permisos de administrador:

```
GET /me/accounts?fields=id,name,instagram_business_account
```

Pero para esto necesitas permisos específicos (ver abajo).

## Solución 2: Verificar y agregar permisos necesarios

### Permisos requeridos:

1. Ve a tu App → **App Review → Permissions and Features**

2. Necesitas estos permisos (algunos son "Standard Access", otros requieren aprobación):

   **Standard Access (no requieren aprobación):**
   - `pages_read_engagement` - Para leer páginas
   - `pages_show_list` - Para listar páginas del usuario
   - `instagram_basic` - Para acceso básico a Instagram

   **Requieren aprobación (App Review):**
   - `pages_manage_metadata` - Para gestionar metadata de páginas
   - `pages_messaging` - Para enviar/recibir mensajes
   - `instagram_manage_messages` - Para gestionar mensajes de Instagram

### Agregar permisos en Graph API Explorer:

1. Ve a: https://developers.facebook.com/tools/explorer/
2. Selecciona tu App
3. Haz clic en **"Generate Access Token"**
4. En la ventana de permisos, selecciona:
   - ✓ `pages_read_engagement`
   - ✓ `pages_show_list`
   - ✓ `instagram_basic`
5. Genera el token

## Solución 3: Obtener un Page Access Token

Para trabajar con Instagram, necesitas un **Page Access Token**, no un User Access Token.

### Método 1: Desde Graph API Explorer

1. Ve a: https://developers.facebook.com/tools/explorer/
2. Selecciona tu **App**
3. En "User or Page", selecciona tu **Página de Facebook** (no tu perfil)
4. Genera el token
5. Este será un Page Access Token

### Método 2: Obtenerlo programáticamente

Si tienes un User Access Token con permisos de páginas:

```
GET /me/accounts?access_token={user-access-token}
```

Esto te dará un array con tus páginas y sus Page Access Tokens:

```json
{
  "data": [
    {
      "id": "PAGE_ID",
      "name": "Nombre de la Página",
      "access_token": "PAGE_ACCESS_TOKEN",
      "instagram_business_account": {
        "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID"
      }
    }
  ]
}
```

## Solución 4: Usar el endpoint correcto para Instagram

Una vez que tengas el Page Access Token, puedes hacer:

### Obtener información de Instagram Business Account:

```
GET /{page-id}?fields=instagram_business_account{id,username}
```

O directamente con el Instagram Business Account ID:

```
GET /{instagram-business-account-id}?fields=id,username
```

### Ver conversaciones de Instagram:

```
GET /{instagram-business-account-id}/conversations
```

### Enviar un mensaje:

```
POST /{instagram-business-account-id}/messages
```

## Verificación paso a paso

### Paso 1: Verificar que tengas acceso a páginas

Con un User Access Token que tenga `pages_show_list`:

```
GET /me?fields=name,accounts{id,name}
```

Si esto funciona, verás tus páginas.

### Paso 2: Obtener el Instagram Business Account ID

Con un Page Access Token:

```
GET /{page-id}?fields=instagram_business_account
```

O si ya conoces tu Instagram Business Account ID:

```
GET /{instagram-business-account-id}?fields=id,username
```

### Paso 3: Probar mensajes

```
GET /{instagram-business-account-id}/conversations
```

## Troubleshooting

### "Invalid OAuth access token"

- El token expiró (los User Tokens expiran rápido)
- Usa un Page Access Token de larga duración
- O extiende el token: https://developers.facebook.com/tools/debug/accesstoken/

### "Insufficient permissions"

- Agrega los permisos necesarios en App Review
- Algunos permisos requieren aprobación de Meta
- Para desarrollo, puedes agregar usuarios de prueba en Roles → Roles

### "Page not found"

- Asegúrate de usar el ID de la página, no el nombre
- Verifica que la página esté conectada a Instagram Business Account
- Debes ser administrador de la página

## Resumen rápido

1. **Usa un Page Access Token**, no un User Token
2. **Selecciona tu Página** en Graph API Explorer, no tu perfil
3. **Agrega permisos**: `pages_show_list`, `pages_read_engagement`, `instagram_basic`
4. **Usa el endpoint correcto**: `/{page-id}` o `/{instagram-business-account-id}`
