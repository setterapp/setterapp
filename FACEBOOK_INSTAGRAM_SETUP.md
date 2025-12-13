# Configuración de Facebook/Instagram OAuth

## Resumen

Instagram usa la API de Facebook, por lo que necesitamos configurar Facebook OAuth en Supabase para acceder a Instagram. Esto es el método **oficial y legal** recomendado por Facebook/Instagram.

## Ventajas del OAuth vs Token Manual

✅ **Método oficial y legal** - No hay riesgo de baneo
✅ **Tokens automáticos** - No necesitas pedir tokens manualmente
✅ **Refresh automático** - Los tokens se renuevan automáticamente
✅ **Más seguro** - Los tokens se manejan de forma segura por Supabase

## Pasos de Configuración

### 1. Crear una App en Facebook Developers

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Haz clic en **"My Apps"** → **"Create App"**
3. Selecciona **"Business"** como tipo de app
4. Completa la información de la app

### 2. Configurar OAuth en Facebook App

1. En el dashboard de tu app, ve a **Settings** → **Basic**
2. **App ID:** `3441846319280367`
3. **App Secret:** `2e8287f7f99d6b4f43dd7ba918cc4ad4`
4. Agrega **App Domains**:
   ```
   faxramhdlskckwwyyqna.supabase.co
   localhost
   ```

5. En **Settings** → **Basic**, agrega **Site URL**:
   ```
   http://localhost:5173
   ```

### 3. Configurar Productos de Facebook

1. En el dashboard, ve a **Add Product**
2. Agrega **"Facebook Login"**
3. En **Facebook Login** → **Settings**, configura:
   - **Valid OAuth Redirect URIs:**
     ```
     https://faxramhdlskckwwyyqna.supabase.co/auth/v1/callback
     http://localhost:5173/auth/callback
     ```

### 4. Solicitar Permisos (Scopes)

**⚠️ IMPORTANTE:** Meta requiere hacer "API test calls" para algunos permisos antes de poder usarlos.

**Scopes básicos (funcionan inmediatamente):**
- `pages_show_list` - Listar páginas conectadas ✅
- `public_profile` - Perfil público ✅
- `email` - Email del usuario ✅

**Scopes para mensajería (DMs) - Necesarios para recibir y responder mensajes:**
- `instagram_business_manage_messages` - Gestionar mensajes de Instagram Business ✅
- `instagram_manage_messages` - Gestionar mensajes directos ✅
- `pages_read_engagement` - Leer engagement de páginas ✅ (necesario para mensajería)

**Scopes que requieren hacer 1 API test call antes de usar:**
- `instagram_basic` - Información básica del perfil ⚠️ (0 of 1 required)
- `instagram_manage_comments` - Gestionar comentarios ⚠️ (0 of 1 required)

**Scopes NO recomendados (causan errores):**
- `pages_messaging` - ❌ NO usar - causa error "Invalid Scopes"

**Cómo hacer API test calls:**
1. Ve a **App Review** → **Permissions and Features**
2. Para cada permiso que requiere test calls, haz clic en él
3. Sigue las instrucciones para hacer una llamada de prueba a la API
4. Una vez completado, el permiso estará disponible

**Nota sobre mensajería:**
- Los permisos de mensajería (`instagram_business_manage_messages`, `instagram_manage_messages`) son necesarios para:
  - Recibir mensajes directos (DMs) en tiempo real
  - Enviar respuestas automáticas
  - Integrar con la IA para responder mensajes
- Estos permisos están incluidos en el código y se solicitarán automáticamente al conectar Instagram

**Configuración del scope `email`:**

Para usar el scope `email` sin errores:

1. Ve a **Meta Developers** → Tu app
2. Ve a **Products** → **Facebook Login** → **Use Cases**
3. Haz clic en **"Edit"** en "Authentication and Account Creation"
4. Asegúrate de que **`email`** esté habilitado y configurado correctamente
5. Verifica que el estado sea **"Ready for testing"** o **"Approved"**
6. **Guarda** los cambios

**Nota:** El scope `email` está incluido en el código y funcionará correctamente una vez configurado en Meta Developers.

### 5. Configurar en Supabase (⚠️ CRÍTICO - Sin esto no funciona)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **Authentication** → **Providers**
3. Busca **Facebook** en la lista de proveedores
4. **Habilita el toggle** de Facebook (debe estar en verde/activado) ⚠️ **ESTO ES CRÍTICO**
5. Ingresa las credenciales:
   - **Client ID (App ID):** `3441846319280367`
   - **Client Secret (App Secret):** `2e8287f7f99d6b4f43dd7ba918cc4ad4`
6. **Guarda** los cambios
7. Verifica que el toggle de Facebook esté **habilitado** (verde)

**⚠️ Error común:** Si obtienes `"provider is not enabled"`, significa que no habilitaste el toggle de Facebook en Supabase.

**Redirect URL:** (automático, se genera solo)
```
https://faxramhdlskckwwyyqna.supabase.co/auth/v1/callback
```

### 6. Configurar Redirect URLs en Supabase

1. **Settings** → **Authentication** → **Redirect URLs**
2. Asegúrate de tener:
   ```
   http://localhost:5173/**
   https://tu-dominio.com/**
   ```

## Requisitos para Instagram Business

Para usar Instagram Business API, necesitas:

1. **Cuenta de Instagram Business o Creator**
   - No funciona con cuentas personales
   - Debe estar conectada a una página de Facebook

2. **Página de Facebook**
   - Tu cuenta de Instagram Business debe estar conectada a una página de Facebook
   - La página debe estar administrada por tu cuenta de Facebook

## Flujo de Autenticación

1. Usuario hace clic en "Conectar Instagram" en la página de Integraciones
2. Se redirige a Facebook OAuth
3. Usuario autoriza la app y los permisos
4. Facebook redirige a Supabase callback
5. Supabase procesa el callback y redirige a `/auth/callback?redirect_to=/dashboard/integrations&provider=facebook`
6. La app detecta el provider_token y actualiza la integración de Instagram a "connected"

## Pruebas

1. Asegúrate de tener una cuenta de Instagram Business
2. Conecta tu Instagram Business a una página de Facebook
3. En la app, ve a Integraciones
4. Activa el toggle de Instagram
5. Deberías ser redirigido a Facebook para autorizar
6. Después de autorizar, volverás a la app con Instagram conectado

## Troubleshooting

### Error: "Invalid OAuth Redirect URI"
- Verifica que la URL en Facebook Developers coincida exactamente con la de Supabase
- Asegúrate de incluir `https://` y el path completo

### Error: "App not in development mode"
- Para desarrollo, tu app debe estar en modo desarrollo
- En producción, necesitarás enviar la app para revisión de Facebook

### Error: "Facebook Login is currently unavailable for this app"

Este error ocurre cuando:

1. **La app está en modo Development sin usuarios de prueba:**
   - Ve a **Meta Developers** → Tu app → **Roles** → **Roles**
   - Agrega usuarios de prueba en **Test Users** o **Testers**
   - O cambia tu app a modo **Live** (requiere App Review)

2. **Solución rápida - Agregar usuarios de prueba:**
   - Ve a **Meta Developers** → Tu app
   - Ve a **Roles** → **Test Users** (o **Roles** → **Testers**)
   - Haz clic en **"Add Test Users"** o **"Add Testers"**
   - Agrega tu cuenta de Facebook como tester
   - O crea usuarios de prueba

3. **Solución alternativa - Usar tu cuenta como administrador:**
   - Asegúrate de estar logueado con la cuenta que creó la app
   - Esa cuenta puede usar la app automáticamente en modo Development

4. **Si necesitas que otros usuarios usen la app:**
   - Agrega sus cuentas como **Test Users** o **Testers**
   - O completa **App Review** para poner la app en modo Live

### App Review vs Business Verification

**App Review (Revisión de App):**
- ✅ **NO es necesario para desarrollo** - Puedes usar la app en modo Development sin App Review
- ⚠️ **Solo necesario para producción** - Cuando quieres que otros usuarios usen tu app
- 📝 **Revisa los permisos** - Meta verifica que uses los permisos correctamente
- ⏱️ **Puede tardar días/semanas** - No es urgente para empezar

**Business Verification (Verificación de Empresa):**
- ⚠️ **Diferente a App Review** - Es verificar que eres una empresa legítima
- 📄 **Requiere documentos** - Registro de empresa, documentos oficiales
- 🔒 **Para ciertos productos** - Algunos productos de Meta lo requieren

**Para empezar a desarrollar:**
1. ✅ Mantén tu app en **modo Development**
2. ✅ **NO necesitas App Review** para probar tú mismo
3. ✅ **NO necesitas Business Verification** para desarrollo básico
4. ✅ Puedes configurar webhooks y OAuth sin estos procesos

### Error: "Instagram Business Account not found"
- Asegúrate de que tu cuenta de Instagram sea Business o Creator
- Verifica que esté conectada a una página de Facebook
- La página debe estar administrada por tu cuenta de Facebook

### No se obtiene el token
- Verifica que los scopes estén correctamente configurados
- Algunos scopes requieren revisión de Facebook para producción

### Error: "provider is not enabled" o "Unsupported provider"
- ⚠️ **CRÍTICO:** Ve a Supabase Dashboard → **Authentication** → **Providers** → **Facebook**
- Asegúrate de que el **toggle esté habilitado** (verde/activado)
- Verifica que hayas ingresado el **Client ID** y **Client Secret** correctos
- **Guarda** los cambios después de configurar
- Recarga la página de tu app y vuelve a intentar

## Notas Importantes

⚠️ **Modo Desarrollo:** En modo desarrollo, solo tú y los administradores de la app pueden autenticarse.

⚠️ **Revisión de Facebook:** Para producción, algunos permisos requieren revisión de Facebook. Esto puede tomar varios días.

⚠️ **Cuenta Business:** Solo funciona con cuentas de Instagram Business o Creator, no con cuentas personales.

## ⚠️ Verificación de Empresa en Meta

Si Meta te pide verificar tu empresa con documentos de registro, tienes estas opciones:

### Opción 1: Usar Modo Desarrollo (Recomendado para empezar)

1. **Asegúrate de que tu app esté en modo "Development"**
   - En Meta Developers, ve a **Settings** → **Basic**
   - Verifica que el modo sea "Development"
   - En modo desarrollo, puedes usar la API sin verificación de empresa

2. **Usa solo los permisos básicos**
   - No solicites permisos que requieran verificación de empresa
   - Para desarrollo, usa solo: `instagram_basic`, `pages_show_list`

3. **Los usuarios pueden conectar sus propias cuentas**
   - Cada usuario autoriza tu app con su cuenta de Instagram Business/Creator
   - No necesitas verificar tu empresa para esto
   - Los usuarios individuales pueden tener cuentas Business o Creator sin empresa

### Opción 2: Saltarse la Verificación de Empresa (Solo Webhooks)

Si solo necesitas configurar webhooks y no otras funciones de Business API:

1. **Configura solo el webhook** (ya lo hiciste ✅)
2. **No completes la verificación de empresa** si no es estrictamente necesario
3. **Usa OAuth para que los usuarios conecten sus cuentas**
   - Los usuarios individuales pueden autorizar tu app
   - No necesitas verificar tu empresa para esto

### Opción 3: Usar Instagram Creator en lugar de Business

1. **Los usuarios pueden usar cuentas Creator** (no Business)
   - Las cuentas Creator tienen menos requisitos
   - No requieren verificación de empresa del desarrollador
   - Funcionan igual para mensajería y webhooks

### Opción 4: Verificación Simplificada (Si es necesario)

Si realmente necesitas verificar:

1. **Meta Business Verification simplificada**
   - Puedes usar tu información personal si eres desarrollador individual
   - No siempre requieren documentos de empresa
   - Puedes intentar con tu DNI/pasaporte como "empresa individual"

## Configuración de Webhooks de Instagram

Para recibir eventos en tiempo real de Instagram (mensajes, comentarios, etc.), necesitas configurar webhooks en Meta Developers.

### 1. Configurar Webhook en Meta Developers

1. Ve a tu app en [Facebook Developers](https://developers.facebook.com/apps/)
2. Ve a **Products** → **Instagram** → **Webhooks**
3. Haz clic en **"Add Callback URL"** o **"Configure"**

4. Completa los siguientes campos:

   **Callback URL:**
   ```
   https://faxramhdlskckwwyyqna.supabase.co/functions/v1/instagram-webhook
   ```

   **Verify Token:**
   ```
   d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec
   ```

5. Haz clic en **"Verify and Save"**
   - Meta enviará una solicitud GET a tu webhook para verificar que funciona
   - Si todo está correcto, verás un mensaje de éxito

### 2. Suscribirse a Eventos

Después de verificar el webhook, suscríbete a los eventos que quieres recibir:

1. En la sección de **Webhooks**, busca **"Subscribe to fields"**
2. Selecciona los eventos que necesitas:
   - `messages` - Para recibir mensajes directos
   - `messaging_postbacks` - Para recibir respuestas de botones
   - `messaging_optins` - Para recibir opt-ins
   - `messaging_deliveries` - Para recibir confirmaciones de entrega
   - `messaging_reads` - Para recibir confirmaciones de lectura
   - `story_mentions` - Para recibir menciones en stories
   - `story_replies` - Para recibir respuestas a stories

### 3. Configurar el Verify Token en Supabase

El verify token debe estar configurado como secreto en Supabase:

1. Ve a tu proyecto en Supabase Dashboard
2. **Edge Functions** → **Secrets**
3. Agrega un nuevo secreto:
   - **Name:** `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
   - **Value:** `d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec`

**Nota:** Puedes generar un nuevo token seguro con:
```bash
openssl rand -hex 32
```

### 4. Verificar que el Webhook Funciona

1. Después de configurar, Meta enviará una solicitud de verificación
2. Puedes verificar los logs en Supabase:
   - **Edge Functions** → **instagram-webhook** → **Logs**
3. Deberías ver un mensaje: `✅ Webhook verified successfully`

### 5. Probar el Webhook

Para probar que el webhook recibe eventos:

1. En Meta Developers, ve a **Webhooks** → **Test Events**
2. Selecciona un evento de prueba (ej: "messages")
3. Haz clic en **"Send Test Event"**
4. Verifica los logs en Supabase para confirmar que recibiste el evento

### Troubleshooting de Webhooks

**Error: "Verification failed"**
- Verifica que el verify token en Meta Developers coincida exactamente con el secreto en Supabase
- Asegúrate de que el secreto esté configurado correctamente

**Error: "Webhook not receiving events"**
- Verifica que tu app esté en modo "Live" o que tengas permisos de prueba
- Asegúrate de estar suscrito a los eventos correctos
- Verifica que la URL del webhook sea accesible públicamente (no localhost)

**No se reciben eventos**
- Verifica que la página de Facebook esté conectada a tu app
- Asegúrate de que la cuenta de Instagram Business esté conectada a la página
- Verifica los logs de Edge Functions en Supabase
