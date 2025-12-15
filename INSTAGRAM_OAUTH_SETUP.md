# Configuración de Instagram OAuth con Supabase

## 🔄 Método: Facebook OAuth (pasando por Supabase) ✅

Usamos **Supabase Auth** para manejar el OAuth de Instagram a través de Facebook.

- **Redirect URI:** `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback` (de Supabase)
- **Flujo:** Usuario → Facebook → **Supabase** → Tu app (`/auth/callback`)
- Supabase maneja todo el OAuth automáticamente
- El token se almacena automáticamente en la sesión de Supabase

## ⚠️ IMPORTANTE: Configurar Redirect URI en Meta Developers

Para que Instagram OAuth funcione, necesitas agregar el redirect URI de Supabase en la configuración de Facebook de tu app de Meta.

### Pasos para agregar el Redirect URI:

1. **Ve a Meta Developers**
   - https://developers.facebook.com/apps/
   - Selecciona tu app (App ID: 893993129727776)

2. **Ve a Products → Facebook Login → Settings**
   - Busca la sección **"Valid OAuth Redirect URIs"**

3. **Agrega el Redirect URI de Supabase**
   En el campo **"Valid OAuth Redirect URIs"**, agrega EXACTAMENTE:
   ```
   https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback
   http://localhost:5173/auth/callback
   ```

   ⚠️ **DEBE coincidir exactamente** (mismo protocolo, dominio, path)

4. **Guarda los cambios**

### Verificar que funciona

1. Ve a la sección **"Redirect URI Validator"** en Meta Developers
2. Ingresa: `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`
3. Debería mostrar: ✅ **"This is a valid redirect URI for this application"**

## Configuración en Supabase

### 1. Habilitar Facebook Provider

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **Authentication** → **Providers**
3. Busca **Facebook** en la lista de proveedores
4. **Habilita el toggle** de Facebook (debe estar en verde/activado) ⚠️ **ESTO ES CRÍTICO**
5. Ingresa las credenciales:
   - **Client ID (App ID):** `893993129727776`
   - **Client Secret (App Secret):** Tu secret de Meta
6. **Guarda** los cambios

### 2. Configurar Redirect URLs en Supabase

1. **Settings** → **Authentication** → **Redirect URLs**
2. Asegúrate de tener:
   ```
   http://localhost:5173/**
   https://setterapp.ai/**
   ```

## Scopes de Instagram Business

Los siguientes scopes se solicitan automáticamente:

- `pages_show_list` - Listar páginas de Facebook conectadas
- `pages_read_engagement` - Leer engagement (necesario para mensajería)
- `instagram_business_basic` - Información básica de Instagram Business
- `instagram_business_manage_messages` - Gestionar mensajes de Instagram Business
- `instagram_business_manage_comments` - Gestionar comentarios
- `instagram_business_content_publish` - Publicar contenido
- `instagram_business_manage_insights` - Ver insights/estadísticas

## Flujo de Autenticación

1. Usuario hace clic en "Conectar Instagram" en la página de Integraciones
2. Se redirige a Facebook OAuth (a través de Supabase)
3. Usuario autoriza la app y los permisos de Instagram Business
4. Facebook redirige a Supabase callback: `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`
5. Supabase procesa el callback y redirige a `/auth/callback?redirect_to=/integrations&provider=facebook&integration=instagram`
6. La app detecta el `provider_token` en la sesión y actualiza la integración de Instagram a "connected"

## Troubleshooting

### Error: "Invalid OAuth Redirect URI"
- Verifica que hayas agregado `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback` en Meta Developers
- Verifica que coincida exactamente (sin trailing slash, mismo protocolo)

### Error: "provider is not enabled"
- Verifica que el toggle de Facebook esté habilitado en Supabase Dashboard
- Verifica que las credenciales (App ID y Secret) sean correctas

### Error: "App not active"
- Tu app de Meta debe estar en modo desarrollo para probar
- Agrega usuarios de prueba en Meta Developers → Roles → Test Users
