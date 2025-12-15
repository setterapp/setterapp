# Redirect URI para Meta Developers - Instagram OAuth

## ✅ Redirect URI que DEBES agregar en Meta Developers

Agrega este redirect URI en Meta Developers → Settings → Basic → Valid OAuth Redirect URIs:

```
https://setterapp.ai/auth/instagram/callback
```

Para desarrollo (opcional), también agrega:
```
http://localhost:5173/auth/instagram/callback
```

## 📋 Pasos Exactos en Meta Developers

1. Ve a https://developers.facebook.com/apps/
2. Selecciona tu app (App ID: 893993129727776)
3. Ve a **Settings** → **Basic**
4. Scroll hacia abajo hasta encontrar **"Client OAuth Settings"** o **"Valid OAuth Redirect URIs"**
5. En el campo de texto, agrega exactamente:
   ```
   https://setterapp.ai/auth/instagram/callback
   ```
6. Si también necesitas localhost para desarrollo, agrega en una línea separada:
   ```
   http://localhost:5173/auth/instagram/callback
   ```
7. Haz clic en **"Save Changes"**

## ⚠️ IMPORTANTE

- ✅ Debe ser EXACTAMENTE: `https://setterapp.ai/auth/instagram/callback`
- ❌ NO debe tener trailing slash: `https://setterapp.ai/auth/instagram/callback/`
- ❌ NO debe tener espacios: ` https://setterapp.ai/auth/instagram/callback `
- ✅ Debe usar `https://` (no `http://` en producción)

## 🔍 Verificar

1. Usa la herramienta **"Redirect URI Validator"** en Meta Developers
2. Ingresa: `https://setterapp.ai/auth/instagram/callback`
3. Debe mostrar: ✅ **"This is a valid redirect URI for this application"**

## 📝 Nota

Este redirect URI apunta directamente a tu aplicación (setterapp.ai), NO a Supabase.
Tu aplicación maneja el callback en la página `/auth/instagram/callback`.
