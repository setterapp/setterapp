# Debug: Mensajes de Instagram no llegan a la base de datos

## Problema identificado

El webhook está recibiendo eventos (veo POST 200 en los logs), pero:
1. La integración NO tiene `page_id` guardado
2. El webhook necesita el `page_id` para hacer match con la integración
3. Cuando Instagram envía el webhook, envía un `page_id` en `entry.id`, pero no coincide con nada guardado

## Solución paso a paso

### Paso 1: Ver los logs detallados del webhook

1. Ve a Supabase Dashboard → Edge Functions → instagram-webhook
2. Haz clic en "Logs"
3. Busca los logs más recientes (cuando enviaste el mensaje)
4. Busca líneas que digan:
   - `📨 Instagram webhook event received:`
   - `📨 Processing entry with pageId:`
   - `⚠️ No matching pageId found`

### Paso 2: Obtener el page_id que envía Instagram

En los logs, busca algo como:
```
📨 Processing entry with pageId: 123456789012345
```

Ese es el `page_id` que Instagram está enviando.

### Paso 3: Obtener el page_id de tu página de Facebook

1. Ve a Graph API Explorer: https://developers.facebook.com/tools/explorer/
2. Selecciona tu App y tu Página
3. Genera un Page Access Token
4. Ejecuta:

```
GET /{page-id}?fields=id,name,instagram_business_account{id}
```

Anota el `id` de la página (ese es el `page_id`).

### Paso 4: Actualizar la integración con el page_id

Ejecuta esto en Supabase SQL Editor:

```sql
-- Reemplaza 'TU_PAGE_ID_AQUI' con el page_id que obtuviste
UPDATE integrations
SET config = jsonb_set(
  config,
  '{page_id}',
  '"TU_PAGE_ID_AQUI"'
)
WHERE type = 'instagram'
  AND status = 'connected'
  AND user_id = 'bc58a3bf-b487-4b62-9192-dceab3169aef';
```

O si prefieres actualizar también `instagram_page_id`:

```sql
UPDATE integrations
SET config = jsonb_set(
  jsonb_set(
    config,
    '{page_id}',
    '"TU_PAGE_ID_AQUI"'
  ),
  '{instagram_page_id}',
  '"TU_PAGE_ID_AQUI"'
)
WHERE type = 'instagram'
  AND status = 'connected';
```

### Paso 5: Verificar que coincida

Después de actualizar, verifica:

```sql
SELECT
  id,
  user_id,
  config->>'page_id' as page_id,
  config->>'instagram_page_id' as instagram_page_id,
  config->>'instagram_user_id' as instagram_user_id
FROM integrations
WHERE type = 'instagram' AND status = 'connected';
```

El `page_id` debe coincidir con el que aparece en los logs del webhook.

### Paso 6: Probar de nuevo

1. Envía otro mensaje desde marcos.pozzetti a setterapp.ai
2. Revisa los logs del webhook
3. Deberías ver: `✅ Found integration matching pageId: ...`
4. Verifica en la base de datos:

```sql
SELECT * FROM conversations
WHERE platform = 'instagram'
ORDER BY created_at DESC
LIMIT 1;

SELECT * FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE platform = 'instagram'
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY created_at DESC;
```

## Verificación rápida

### Ver qué page_id está recibiendo el webhook:

1. Ve a Supabase Dashboard → Edge Functions → instagram-webhook → Logs
2. Busca la línea más reciente que diga: `📨 Processing entry with pageId:`
3. Anota ese `page_id`

### Ver qué page_id tiene guardado:

```sql
SELECT config->>'page_id' as page_id
FROM integrations
WHERE type = 'instagram' AND status = 'connected';
```

Si son diferentes, ese es el problema. Actualiza la integración con el `page_id` correcto.

## Troubleshooting adicional

### Si el webhook no está recibiendo eventos:

1. Verifica en Meta Developers → Webhooks → Instagram
2. Asegúrate de que esté suscrito a `messages`
3. Verifica que la URL del webhook sea correcta
4. Prueba enviando un evento de prueba desde Meta Developers

### Si el page_id no coincide:

El `page_id` que envía Instagram en el webhook es el ID de la **Página de Facebook**, no el Instagram Business Account ID.

Para obtenerlo:
1. Ve a tu Página de Facebook
2. Ve a Configuración → Información de la página
3. O usa Graph API: `GET /me/accounts` (con un User Token que tenga `pages_show_list`)

### Si aún no funciona:

Revisa los logs del webhook para ver si hay errores:
- `❌ Could not find user_id for pageId:`
- `❌ Error finding integrations:`
- `❌ Error creating conversation:`
