# Configuración de Instagram OAuth Directo

## ⚠️ IMPORTANTE: Configurar Redirect URI en Meta Developers

Para que el login directo de Instagram funcione, necesitas agregar el redirect URI en la configuración de Instagram de tu app de Meta.

### Pasos para agregar el Redirect URI:

1. **Ve a Meta Developers**
   - https://developers.facebook.com/apps/
   - Selecciona tu app (App ID: 893993129727776)

2. **Ve a Settings → Basic**
   - Scroll hacia abajo hasta la sección **"Client OAuth Settings"** o **"Instagram Basic Display"**

3. **Agrega el Redirect URI**
   En el campo **"Valid OAuth Redirect URIs"**, agrega EXACTAMENTE:
   ```
   https://setterapp.ai/auth/instagram/callback
   http://localhost:5173/auth/instagram/callback
   ```
   
   ⚠️ **DEBE coincidir exactamente** (mismo protocolo, dominio, path, sin trailing slash)

4. **Guarda los cambios**

### Alternativa: Si tu app tiene producto "Instagram" separado

Si tu app tiene un producto "Instagram" separado (además de Facebook Login):

1. Ve a **Products** → **Instagram** → **Basic Display** (o **Instagram Graph API**)
2. En **Settings**, busca **"Valid OAuth Redirect URIs"**
3. Agrega:
   ```
   https://setterapp.ai/auth/instagram/callback
   http://localhost:5173/auth/instagram/callback
   ```

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
