# Configuración de Instagram OAuth Directo

## 🔄 Método: Instagram OAuth Directo ✅

Usamos el método directo de Instagram OAuth que abre el login de Instagram directamente, no el de Facebook. Esto permite conectar cuentas de Instagram que no están vinculadas a Facebook.

- **Redirect URI:** `https://setterapp.ai/auth/instagram/callback` (de tu app)
- **Flujo:** Usuario → Instagram login → Tu app callback (`/auth/instagram/callback`)
- El token se almacena en la base de datos de integraciones de Supabase

## ⚠️ IMPORTANTE: Configurar Redirect URI en Meta Developers

Para que el login directo de Instagram funcione, necesitas agregar el redirect URI en la configuración de tu app de Meta.

### Pasos para agregar el Redirect URI:

1. **Ve a Meta Developers**
   - https://developers.facebook.com/apps/
   - Selecciona tu app (App ID: 893993129727776)

2. **Ve a Settings → Basic**
   - Scroll hacia abajo hasta la sección **"Client OAuth Settings"** o busca **"Valid OAuth Redirect URIs"**

3. **Agrega el Redirect URI**
   En el campo **"Valid OAuth Redirect URIs"**, agrega EXACTAMENTE:
   ```
   https://setterapp.ai/auth/instagram/callback
   http://localhost:5173/auth/instagram/callback
   ```

   ⚠️ **DEBE coincidir exactamente** (mismo protocolo, dominio, path, sin trailing slash)

4. **Guarda los cambios**

### Verificar que funciona

1. Ve a la sección **"Redirect URI Validator"** en Meta Developers
2. Ingresa: `https://setterapp.ai/auth/instagram/callback`
3. Debería mostrar: ✅ **"This is a valid redirect URI for this application"**

### Si aún no funciona

1. Verifica que el **App ID** sea correcto: `893993129727776`
2. Verifica que tu app tenga el producto **"Instagram"** o **"Instagram Basic Display"** habilitado
3. Asegúrate de que el redirect URI coincida EXACTAMENTE (incluyendo protocolo https vs http)

## Configuración en el código

El redirect URI está configurado automáticamente en el código como:
- Producción: `https://setterapp.ai/auth/instagram/callback`
- Desarrollo: `http://localhost:5173/auth/instagram/callback`

Puedes sobrescribirlo con una variable de entorno si es necesario:
```env
VITE_INSTAGRAM_REDIRECT_URI=https://setterapp.ai/auth/instagram/callback
```

## Flujo de Autenticación

1. Usuario hace clic en "Conectar Instagram" en la página de Integraciones
2. Se abre una ventana popup con el login de Instagram (`instagram.com/accounts/login`)
3. Usuario autoriza la app con su cuenta de Instagram
4. Instagram redirige a `https://setterapp.ai/auth/instagram/callback` con un código
5. El callback intercambia el código por un token de acceso
6. El token se guarda en la tabla `integrations` de Supabase
7. La integración se marca como "connected"

## Scopes de Instagram Business

Los siguientes scopes se solicitan automáticamente:

- `instagram_business_basic` - Información básica de Instagram Business
- `instagram_business_manage_messages` - Gestionar mensajes de Instagram Business
- `instagram_business_manage_comments` - Gestionar comentarios
- `instagram_business_content_publish` - Publicar contenido
- `instagram_business_manage_insights` - Ver insights/estadísticas

## Ventajas del método directo

✅ **Login directo de Instagram** - No pasa por Facebook
✅ **Funciona con cuentas no vinculadas** - Puedes conectar Instagram sin Facebook
✅ **Mejor UX** - Abre en popup, el usuario no sale de tu app
✅ **Similar a competidores** - Usa el mismo método que otras apps
