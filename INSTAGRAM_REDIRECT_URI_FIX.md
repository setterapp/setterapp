# Solución al Error "Invalid redirect_uri" de Instagram

## 🔴 Error
```
Invalid Request: Request parameters are invalid: Invalid redirect_uri
```

## 🔍 Diagnóstico

El redirect URI debe coincidir **EXACTAMENTE** entre:
1. Lo que envía tu aplicación
2. Lo que está configurado en Meta Developers

### ¿Cómo saber qué redirect URI está usando tu app?

1. Abre la consola del navegador (F12 → Console)
2. Intenta conectar Instagram
3. Busca este mensaje en la consola:
   ```
   ⚠️ REDIRECT URI QUE SE ESTÁ ENVIANDO: [URL]
   ```
4. **Copia ese URI exacto** - ese es el que debes configurar en Meta Developers

## ✅ Solución Paso a Paso

### Paso 1: Identifica el Redirect URI

El redirect URI depende de dónde está hosteada tu app:

- **Producción (setterapp.ai):** `https://setterapp.ai/auth/instagram/callback`
- **Desarrollo (localhost):** `http://localhost:5173/auth/instagram/callback`
- **Otro dominio:** `https://tu-dominio.com/auth/instagram/callback`

### Paso 2: Configura en Meta Developers

1. Ve a [Meta Developers](https://developers.facebook.com/apps/)
2. Selecciona tu app (App ID: `893993129727776`)
3. Ve a **Settings** → **Basic**
4. Scroll hacia abajo hasta **"Client OAuth Settings"** o busca **"Valid OAuth Redirect URIs"**
5. En el campo de texto, agrega **EXACTAMENTE** (copia y pega):
   ```
   https://setterapp.ai/auth/instagram/callback
   ```
   - Sin espacios antes o después
   - Con `https://` (no `http://` en producción)
   - Sin trailing slash `/` al final
   - Exactamente como aparece en la consola

6. Si también usas localhost para desarrollo, agrega también:
   ```
   http://localhost:5173/auth/instagram/callback
   ```

7. Haz clic en **"Save Changes"**

### Paso 3: Verifica

1. En Meta Developers, usa la herramienta **"Redirect URI Validator"**
2. Ingresa exactamente: `https://setterapp.ai/auth/instagram/callback`
3. Debe mostrar: ✅ **"This is a valid redirect URI for this application"**

### Paso 4: Prueba de nuevo

1. Cierra y vuelve a abrir tu aplicación
2. Intenta conectar Instagram de nuevo
3. Si sigue fallando, verifica en la consola qué redirect URI se está enviando

## 🔧 Configuración Manual (Opcional)

Si quieres forzar un redirect URI específico, puedes configurarlo en tu archivo `.env`:

```env
VITE_INSTAGRAM_REDIRECT_URI=https://setterapp.ai/auth/instagram/callback
```

Luego reinicia el servidor de desarrollo o reconstruye la app.

## ⚠️ Errores Comunes

❌ **No coincide el protocolo:** `http://` vs `https://`
❌ **Trailing slash:** `https://setterapp.ai/auth/instagram/callback/` (con `/` al final)
❌ **Espacios:** `https://setterapp.ai/auth/instagram/callback ` (con espacio)
❌ **Mayúsculas/minúsculas:** Debe ser exactamente igual
❌ **Puerto:** Si usas un puerto diferente en desarrollo, debe coincidir

## 📝 Checklist

- [ ] Abrí la consola del navegador y vi qué redirect URI se está enviando
- [ ] Copié ese URI exacto
- [ ] Lo agregué en Meta Developers → Settings → Basic → Valid OAuth Redirect URIs
- [ ] Guardé los cambios
- [ ] Verifiqué con Redirect URI Validator
- [ ] Probé de nuevo la conexión
