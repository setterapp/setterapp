# Verificar por qué no devuelve datos de Instagram

## Paso 1: Verificar qué devuelve exactamente

Prueba estos endpoints uno por uno:

### 1. Ver información básica de la página:

```
GET /{page-id}?fields=id,name
```

Si esto funciona, deberías ver el ID y nombre de tu página.

### 2. Ver si tiene Instagram Business Account:

```
GET /{page-id}?fields=id,name,instagram_business_account
```

Si `instagram_business_account` es `null` o no aparece, significa que:
- La página no tiene una cuenta de Instagram Business conectada
- O el token no tiene permisos para verlo

### 3. Ver todos los campos disponibles:

```
GET /{page-id}?fields=*
```

Esto te mostrará todos los campos disponibles (puede ser mucho texto).

## Paso 2: Verificar conexión de Instagram Business Account

### Desde Facebook:

1. Ve a tu Página de Facebook: https://www.facebook.com/pages/
2. Selecciona tu página
3. Ve a **Configuración** → **Instagram** (en el menú lateral)
4. Verifica que tengas una cuenta de Instagram Business conectada
5. Si no está conectada:
   - Haz clic en **"Conectar cuenta"**
   - Sigue los pasos para conectar tu Instagram Business Account

### Verificar desde Graph API:

```
GET /{page-id}?fields=connected_instagram_account
```

O:

```
GET /{page-id}/?fields=instagram_business_account{id,username}
```

## Paso 3: Verificar permisos del token

### Ver qué permisos tiene tu token:

1. Ve a: https://developers.facebook.com/tools/debug/accesstoken/
2. Pega tu token
3. Haz clic en **"Debug"**
4. Verifica que tenga estos permisos:
   - `pages_read_engagement`
   - `pages_show_list`
   - `instagram_basic`

### Si faltan permisos:

1. Ve a Graph API Explorer
2. Genera un nuevo token
3. Selecciona estos permisos:
   - `pages_read_engagement`
   - `pages_show_list`
   - `instagram_basic`
   - `pages_manage_metadata` (si está disponible)

## Paso 4: Probar endpoints alternativos

### Si tienes el Instagram Business Account ID directamente:

```
GET /{instagram-business-account-id}?fields=id,username
```

Para obtener el ID, puedes:
1. Ir a tu perfil de Instagram Business
2. Ver el ID en la URL o en la configuración
3. O usar la API de Instagram Basic Display

### Verificar desde el usuario:

```
GET /me?fields=accounts{id,name,instagram_business_account{id,username}}
```

## Paso 5: Verificar que tu cuenta de Instagram sea Business

1. Abre la app de Instagram en tu teléfono
2. Ve a tu perfil
3. Toca el menú (☰)
4. Ve a **Configuración** → **Cuenta**
5. Si ves **"Cambiar a cuenta profesional"**, significa que aún es una cuenta personal
6. Cámbiala a cuenta profesional/business

## Paso 6: Conectar Instagram Business a la Página de Facebook

### Desde Facebook:

1. Ve a tu Página de Facebook
2. **Configuración** → **Instagram**
3. Si no está conectada:
   - Haz clic en **"Conectar cuenta"**
   - Inicia sesión con tu cuenta de Instagram Business
   - Autoriza la conexión

### Desde Instagram:

1. Abre Instagram en tu teléfono
2. Ve a tu perfil
3. **Configuración** → **Cuenta** → **Cambiar a cuenta profesional**
4. Si ya es profesional, ve a **Configuración** → **Cuenta** → **Página de Facebook**
5. Conecta tu página de Facebook

## Paso 7: Verificar respuesta completa

Cuando hagas la consulta, verifica la respuesta completa. Puede que devuelva:

```json
{
  "id": "123456789",
  "name": "Mi Página",
  "instagram_business_account": null
}
```

O puede que no incluya el campo `instagram_business_account` en absoluto.

## Troubleshooting común

### "instagram_business_account" es null:

- La página no tiene Instagram Business conectado
- Conecta Instagram Business a tu página de Facebook

### El campo no aparece en la respuesta:

- El token no tiene permisos para verlo
- Agrega permisos: `pages_read_engagement`, `instagram_basic`

### La página no aparece en /me/accounts:

- No eres administrador de la página
- O el token no tiene `pages_show_list`
- Verifica en Facebook que seas admin de la página

### Todo parece correcto pero no funciona:

- Prueba con un token nuevo
- Verifica que la página esté publicada (no en borrador)
- Asegúrate de que Instagram Business Account esté activa

## Consulta de verificación rápida

Ejecuta esto en Graph API Explorer para ver todo:

```
GET /{page-id}?fields=id,name,instagram_business_account{id,username},connected_instagram_account
```

Si `instagram_business_account` aparece con datos, entonces está conectado correctamente.
