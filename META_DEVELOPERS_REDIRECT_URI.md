# Configuración de Redirect URI en Meta Developers para Instagram

## ✅ Redirect URI que debes agregar

Basado en la URL que estás usando, agrega este redirect URI en Meta Developers:

```
https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback
```

## 📋 Pasos Exactos

### 1. Ve a Meta Developers
- https://developers.facebook.com/apps/
- Selecciona tu app (Client ID: `1206229924794990`)

### 2. Ve a Settings → Basic
- En la parte inferior, busca la sección **"Client OAuth Settings"**
- O busca **"Valid OAuth Redirect URIs"**

### 3. Agrega el Redirect URI
En el campo de texto **"Valid OAuth Redirect URIs"**, agrega:

```
https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback
```

**Importante:**
- ✅ Copia y pega exactamente (sin espacios)
- ✅ Sin trailing slash al final
- ✅ Con `https://` (no `http://`)
- ✅ Exactamente como aparece arriba

### 4. Si también usas localhost para desarrollo, agrega también:
```
http://localhost:5173/auth/callback
```

### 5. Guarda los cambios
- Haz clic en **"Save Changes"** o **"Guardar cambios"**
- Espera a que se guarde (puede tardar unos segundos)

### 6. Verifica
1. Busca la herramienta **"Redirect URI Validator"** en Meta Developers
2. Ingresa: `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`
3. Debe mostrar: ✅ **"This is a valid redirect URI for this application"**

## 🔍 Dónde encontrar "Valid OAuth Redirect URIs"

La ubicación exacta puede variar según la versión de Meta Developers:

**Opción 1: Settings → Basic**
- Scroll hacia abajo
- Busca **"Client OAuth Settings"** o **"Valid OAuth Redirect URIs"**

**Opción 2: Products → Facebook Login → Settings**
- Ve a **Products** en el menú lateral
- Haz clic en **Facebook Login**
- Ve a **Settings**
- Busca **"Valid OAuth Redirect URIs"**

**Opción 3: Products → Instagram → Settings**
- Si tu app tiene el producto Instagram
- Ve a **Products** → **Instagram**
- Busca la sección de redirect URIs

## ⚠️ Errores Comunes

❌ **Espacios antes o después:** ` https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback `
✅ **Correcto:** `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`

❌ **Trailing slash:** `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback/`
✅ **Correcto:** `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`

❌ **Protocolo incorrecto:** `http://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`
✅ **Correcto:** `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`

❌ **Mayúsculas:** `https://Afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`
✅ **Correcto:** `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`

## 🔄 Después de agregar el Redirect URI

1. Espera 1-2 minutos para que los cambios se propaguen
2. Cierra y vuelve a abrir tu aplicación
3. Intenta conectar Instagram de nuevo
4. El error "Invalid redirect_uri" debería desaparecer

## 📝 Notas

- El Client ID en tu URL es: `1206229924794990` (diferente al App ID `893993129727776`)
- Este redirect URI es de Supabase, que maneja el OAuth automáticamente
- Una vez que el usuario autoriza, Supabase redirige a tu app con el token
