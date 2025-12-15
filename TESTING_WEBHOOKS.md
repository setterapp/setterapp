# Guía de Testing de Webhooks

## URLs de los Webhooks

- **Instagram Webhook**: `https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook`
- **WhatsApp Webhook**: `https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/whatsapp-webhook`

## Métodos de Testing

### 1. Verificar que los Webhooks Responden (GET - Verificación)

Los webhooks deben responder a las peticiones GET de verificación de Meta:

```bash
# Instagram
curl "https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook?hub.mode=subscribe&hub.verify_token=d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec&hub.challenge=test123"

# WhatsApp
curl "https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=whatsapp_verify_token_change_me&hub.challenge=test123"
```

**Respuesta esperada**: Debe devolver el `challenge` (test123) con status 200

### 2. Simular un Mensaje de Instagram (POST)

```bash
curl -X POST https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "test_page_id",
      "messaging": [{
        "sender": {"id": "123456789"},
        "recipient": {"id": "987654321"},
        "timestamp": 1234567890,
        "message": {
          "mid": "msg_123",
          "text": "Hola, este es un mensaje de prueba"
        }
      }]
    }]
  }'
```

### 3. Simular un Mensaje de WhatsApp (POST)

```bash
curl -X POST https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "test_phone_number_id",
      "changes": [{
        "value": {
          "messages": [{
            "from": "1234567890",
            "id": "wamid.123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Hola, este es un mensaje de prueba de WhatsApp"
            }
          }],
          "contacts": [{
            "profile": {
              "name": "Usuario de Prueba"
            }
          }]
        }
      }]
    }]
  }'
```

### 4. Verificar en la Base de Datos

Después de enviar un mensaje de prueba, verifica que se guardó:

```sql
-- Ver conversaciones
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 5;

-- Ver mensajes
SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;

-- Ver conversaciones con conteo de mensajes
SELECT 
  c.id,
  c.contact,
  c.platform,
  c.unread_count,
  c.last_message_at,
  COUNT(m.id) as total_messages
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id
ORDER BY c.last_message_at DESC;
```

### 5. Ver Logs en Tiempo Real

Los logs de las Edge Functions están disponibles en:
- Supabase Dashboard → Edge Functions → [nombre-funcion] → Logs
- O usando la CLI: `supabase functions logs instagram-webhook --follow`

### 6. Verificar en la App

1. Ve a la página de **Conversaciones** en tu app
2. Deberías ver las conversaciones creadas
3. El contador de no leídos debería aparecer

## Configurar Webhooks en Meta/Facebook

### Instagram:
1. Ve a [Meta Developers](https://developers.facebook.com/)
2. Selecciona tu App
3. Webhooks → Instagram
4. Agrega la URL: `https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook`
5. Verify Token: `d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec`
6. Suscríbete a: `messages`, `messaging_postbacks`

### WhatsApp:
1. Ve a [Meta Developers](https://developers.facebook.com/)
2. Selecciona tu App
3. Webhooks → WhatsApp
4. Agrega la URL: `https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/whatsapp-webhook`
5. Verify Token: `whatsapp_verify_token_change_me` (cambia esto por uno seguro)
6. Suscríbete a: `messages`

## Problemas Comunes

### Error 401 Unauthorized
- **Causa**: El webhook tiene `verify_jwt: true` pero Meta no envía JWT
- **Solución**: Los webhooks deben tener JWT desactivado (ya está configurado)

### No se guardan mensajes
- Verifica que la integración esté `connected` en la tabla `integrations`
- Verifica los logs de la Edge Function
- Verifica que el `user_id` se esté obteniendo correctamente

### Conversaciones no aparecen
- Verifica que estés logueado con el mismo usuario que tiene la integración
- Verifica RLS policies en las tablas
- Refresca la página de conversaciones

