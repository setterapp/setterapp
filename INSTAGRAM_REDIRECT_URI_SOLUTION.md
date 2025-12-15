# Solución al Error "Invalid redirect_uri" de Instagram

## 🔍 Información Importante

Basado en documentación y casos similares, el redirect URI para Instagram OAuth puede ser prácticamente cualquier URL válida, siempre y cuando:

1. ✅ Esté configurado exactamente igual en Meta Developers
2. ✅ Sea una URL válida con protocolo `https://` (o `http://` para desarrollo)
3. ✅ No tenga trailing slash (a menos que así esté configurado)

## ✅ Redirect URI Correcto para tu App

Para tu aplicación, el redirect URI que debes usar es:

```
https://setterapp.ai/auth/instagram/callback
```

## 📋 Configuración en Meta Developers

### Paso 1: Ve a Meta Developers
- https://developers.facebook.com/apps/
- Selecciona tu app (App ID: 893993129727776)

### Paso 2: Configura el Redirect URI

Hay **varias ubicaciones** donde puedes configurarlo. Intenta en TODAS estas:

#### Opción 1: Settings → Basic → Client OAuth Settings
1. Ve a **Settings** → **Basic**
2. Scroll hacia abajo hasta **"Client OAuth Settings"**
3. En **"Valid OAuth Redirect URIs"**, agrega:
   ```
   https://setterapp.ai/auth/instagram/callback
   ```

#### Opción 2: Products → Facebook Login → Settings
1. Ve a **Products** → **Facebook Login**
2. Ve a **Settings**
3. En **"Valid OAuth Redirect URIs"**, agrega:
   ```
   https://setterapp.ai/auth/instagram/callback
   ```

#### Opción 3: Products → Instagram → Settings
1. Ve a **Products** → **Instagram** (si está disponible)
2. Ve a **Settings**
3. Busca **"Valid OAuth Redirect URIs"** o **"Instagram Basic Display"**
4. Agrega:
   ```
   https://setterapp.ai/auth/instagram/callback
   ```

### Paso 3: Verifica con Redirect URI Validator
1. Busca la herramienta **"Redirect URI Validator"** en Meta Developers
2. Ingresa: `https://setterapp.ai/auth/instagram/callback`
3. Debe mostrar: ✅ **"This is a valid redirect URI for this application"**

## ⚠️ Errores Comunes

❌ **Espacios:** ` https://setterapp.ai/auth/instagram/callback `
✅ **Correcto:** `https://setterapp.ai/auth/instagram/callback`

❌ **Trailing slash:** `https://setterapp.ai/auth/instagram/callback/`
✅ **Correcto:** `https://setterapp.ai/auth/instagram/callback`

❌ **Protocolo incorrecto:** `http://setterapp.ai/auth/instagram/callback` (en producción)
✅ **Correcto:** `https://setterapp.ai/auth/instagram/callback`

❌ **Mayúsculas/minúsculas:** Debe coincidir exactamente

## 🔄 Después de Configurar

1. Espera 2-3 minutos para que los cambios se propaguen
2. Cierra completamente tu navegador (o usa modo incógnito)
3. Vuelve a intentar conectar Instagram
4. Si aún falla, verifica en la consola del navegador qué redirect URI se está enviando exactamente

## 🐛 Debug

Para ver qué redirect URI se está enviando:

1. Abre la consola del navegador (F12 → Console)
2. Intenta conectar Instagram
3. Busca este mensaje:
   ```
   ⚠️ REDIRECT URI QUE SE ESTÁ ENVIANDO: [URL]
   ```
4. Asegúrate de que ese URI exacto esté en Meta Developers

## 📝 Nota Importante

Según documentación y casos similares, Instagram OAuth acepta prácticamente cualquier URL válida como redirect URI, siempre y cuando:
- Esté configurada en Meta Developers
- Sea accesible (aunque no necesariamente tenga que responder)

El redirect URI que estás usando (`https://setterapp.ai/auth/instagram/callback`) es completamente válido, solo necesitas asegurarte de que esté configurado correctamente en Meta Developers.
