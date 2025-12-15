# 🧪 Cómo Testear los Webhooks

## ⚠️ IMPORTANTE: Desactivar JWT en los Webhooks

Los webhooks actualmente tienen JWT activado, pero Meta/Facebook no envía tokens JWT. Necesitas desactivarlo:

1. Ve a Supabase Dashboard: https://supabase.com/dashboard/project/afqbakvvfpebnxzjewsk/functions
2. Para cada webhook (`instagram-webhook` y `whatsapp-webhook`):
   - Haz clic en el webhook
   - Ve a Settings
   - **Desactiva "Verify JWT"** (o "Require JWT")
   - Guarda los cambios

## 📋 Métodos de Testing

### Opción 1: Usar el Script de Prueba

```bash
# Testear ambos webhooks
./test-webhook.sh

# Solo Instagram
./test-webhook.sh instagram

# Solo WhatsApp
./test-webhook.sh whatsapp
```

### Opción 2: Usar curl Manualmente

**Test Instagram (GET - Verificación):**
```bash
curl "https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook?hub.mode=subscribe&hub.verify_token=d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec&hub.challenge=test123"
```
Debería devolver: `test123`

**Test Instagram (POST - Mensaje):**
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

### Opción 3: Verificar en la Base de Datos

Después de enviar un mensaje de prueba, verifica:

```sql
-- Ver conversaciones
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 5;

-- Ver mensajes
SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;
```

### Opción 4: Ver Logs en Tiempo Real

1. Ve a Supabase Dashboard → Edge Functions
2. Selecciona el webhook (`instagram-webhook` o `whatsapp-webhook`)
3. Ve a la pestaña "Logs"
4. Verás todos los eventos y errores en tiempo real

### Opción 5: Verificar en la App

1. Abre tu app en el navegador
2. Ve a la página de **Conversaciones**
3. Deberías ver las conversaciones creadas por los tests
4. El contador de no leídos debería aparecer

## 🔧 Configurar Webhooks en Meta/Facebook

### Para Instagram:
1. Ve a https://developers.facebook.com/
2. Selecciona tu App
3. Webhooks → Instagram
4. Agrega la URL: `https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/instagram-webhook`
5. Verify Token: `d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec`
6. Suscríbete a: `messages`, `messaging_postbacks`

### Para WhatsApp:
1. Ve a https://developers.facebook.com/
2. Selecciona tu App
3. Webhooks → WhatsApp
4. Agrega la URL: `https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/whatsapp-webhook`
5. Verify Token: `whatsapp_verify_token_change_me` (cambia esto por uno seguro)
6. Suscríbete a: `messages`

## ✅ Checklist de Verificación

- [ ] JWT desactivado en ambos webhooks
- [ ] GET request devuelve el challenge correctamente
- [ ] POST request devuelve `{"success":true}`
- [ ] Se crea una conversación en la tabla `conversations`
- [ ] Se guarda un mensaje en la tabla `messages`
- [ ] La conversación aparece en la página de Conversaciones
- [ ] El contador de no leídos funciona

## 🐛 Troubleshooting

**Error 401 Unauthorized:**
- Verifica que JWT esté desactivado en el webhook
- Los webhooks de Meta NO envían JWT, solo verify_token

**No se guardan mensajes:**
- Verifica que tengas una integración `connected` en la tabla `integrations`
- Verifica los logs de la Edge Function
- Verifica que el `user_id` se esté obteniendo correctamente

**Conversaciones no aparecen:**
- Verifica que estés logueado con el mismo usuario que tiene la integración
- Verifica RLS policies
- Refresca la página
