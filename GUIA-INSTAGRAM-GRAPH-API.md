# Guía: Cómo usar Instagram Graph API en Meta Developers

Esta guía te explica cómo usar la interfaz web de Meta Developers para testear mensajes de Instagram.

## 1. Graph API Explorer - Para hacer pruebas de API

### Acceder al Graph API Explorer

1. Ve a: https://developers.facebook.com/tools/explorer/
2. En la parte superior, selecciona:
   - **Tu App** (la app que creaste para Instagram)
   - **Usuario o Página** (selecciona tu página de Facebook conectada a Instagram)

### Generar un Access Token

1. Haz clic en **"Generate Access Token"**
2. Selecciona los permisos necesarios:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_manage_metadata`
   - `pages_messaging`
3. Copia el token generado (lo necesitarás para las pruebas)

### Probar endpoints de mensajes

#### Ver mensajes recibidos
```
GET /{instagram-user-id}/conversations
```
- Reemplaza `{instagram-user-id}` con tu Instagram Business Account ID
- Haz clic en **"Submit"** para ejecutar

#### Enviar un mensaje de prueba
```
POST /{instagram-user-id}/messages
```
- Método: **POST**
- Body (JSON):
```json
{
  "recipient": {
    "id": "USER_ID_DEL_RECEPTOR"
  },
  "message": {
    "text": "Mensaje de prueba"
  }
}
```

## 2. Webhooks - Para ver eventos en tiempo real

### Configurar el webhook

1. Ve a: https://developers.facebook.com/apps/
2. Selecciona tu App
3. Ve a: **Products → Webhooks**
4. Busca **"Instagram"** y haz clic en **"Configure"** o **"Set up"**

### Configurar la URL del webhook

1. **Callback URL**:
   ```
   https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook
   ```

2. **Verify Token**:
   ```
   d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec
   ```

3. Haz clic en **"Verify and Save"**

### Suscribirse a eventos

1. En la misma página de Webhooks, haz clic en **"Edit Subscription"**
2. Selecciona los campos a los que quieres suscribirte:
   - ✓ `messages` - Mensajes entrantes y salientes
   - ✓ `messaging_postbacks` - Respuestas a botones
   - ✓ `messaging_optins` - Opt-ins
   - ✓ `messaging_deliveries` - Confirmaciones de entrega
   - ✓ `messaging_reads` - Confirmaciones de lectura

3. Haz clic en **"Save"**

## 3. Testing Tool - Para simular eventos

### Acceder al Testing Tool

1. Ve a: https://developers.facebook.com/apps/
2. Selecciona tu App
3. Ve a: **Products → Webhooks → Instagram**
4. Haz clic en **"Test"** o busca la sección **"Testing"**

### Enviar un evento de prueba

1. Selecciona el tipo de evento:
   - **Messages** - Para simular un mensaje entrante

2. Completa los campos:
   - **Sender ID**: ID del usuario que envía el mensaje (puedes usar un ID de prueba)
   - **Recipient ID**: Tu Instagram Business Account ID
   - **Message Text**: El texto del mensaje de prueba

3. Haz clic en **"Send Test Event"**

4. Verifica que llegue a tu webhook:
   - Revisa los logs en Supabase Dashboard → Edge Functions → instagram-webhook
   - O verifica en tu base de datos si se creó la conversación/mensaje

## 4. Ver eventos recibidos

### En Meta Developers

1. Ve a: **Products → Webhooks → Instagram**
2. En la sección **"Recent Events"** o **"Webhook Events"** podrás ver:
   - Los últimos eventos recibidos
   - El estado (success/failed)
   - El payload del evento

### En tu aplicación

1. Revisa los logs de Supabase:
   - Supabase Dashboard → Edge Functions → instagram-webhook → Logs

2. Verifica en la base de datos:
   ```sql
   SELECT * FROM conversations WHERE platform = 'instagram' ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;
   ```

## 5. Troubleshooting común

### Los mensajes no llegan al webhook

1. **Verifica la suscripción**:
   - Ve a Webhooks → Instagram
   - Asegúrate de que esté suscrito a `messages`

2. **Verifica la URL del webhook**:
   - Debe ser exactamente: `https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook`
   - Debe estar verificada (debe aparecer un check verde)

3. **Verifica los permisos del token**:
   - El token debe tener `instagram_manage_messages`
   - Puedes verificar en Graph API Explorer → Permissions

### El webhook no responde

1. **Verifica el Verify Token**:
   - Debe coincidir exactamente con el configurado en tu Edge Function

2. **Revisa los logs**:
   - Supabase Dashboard → Edge Functions → instagram-webhook → Logs
   - Busca errores o advertencias

### Los eventos de prueba no funcionan

1. **Asegúrate de usar IDs válidos**:
   - El Sender ID debe ser un ID de Instagram válido
   - El Recipient ID debe ser tu Instagram Business Account ID

2. **Verifica que el webhook esté activo**:
   - En Meta Developers, el webhook debe mostrar estado "Active"

## 6. Recursos útiles

- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
- **Documentación de Instagram Messaging**: https://developers.facebook.com/docs/instagram-api/guides/messaging
- **Webhooks Documentation**: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
