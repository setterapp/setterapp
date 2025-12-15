# Configuración de Instagram Business Login - Redirect URI

## 🔑 Ubicación Crítica del Redirect URI

Según la documentación oficial de Chatwoot (método recomendado para Instagram Business Login), el redirect URI debe configurarse específicamente en la sección **"Instagram Business Login"**.

## 📋 Pasos Exactos

### Paso 1: Ve a Meta Developers
1. Ve a https://developers.facebook.com/apps/
2. Selecciona tu app (App ID: 893993129727776)

### Paso 2: Agrega el Producto Instagram (si no lo tienes)
1. Ve a **Products** (Productos) en el menú lateral
2. Haz clic en **"Add Product"** o **"+"**
3. Busca **"Instagram"** y haz clic en **"Set Up"**

### Paso 3: Configura Instagram Business Login
1. Ve a **Products** → **Instagram**
2. En el menú lateral de Instagram, busca **"Instagram Business Login"** o **"Basic Display"**
3. Busca la sección **"Redirect URL"** o **"Valid OAuth Redirect URIs"**
4. Agrega exactamente:

```
https://setterapp.ai/auth/instagram/callback
```

Para desarrollo (opcional):
```
http://localhost:5173/auth/instagram/callback
```

5. Haz clic en **"Save Changes"** o **"Guardar cambios"**

## ⚠️ Error Común: "Invalid redirect_uri"

Si aún ves el error después de configurarlo, también verifica:

### 1. Frontend URL
Según la documentación, este error también puede ocurrir si el **Frontend URL** no coincide con la URL de autorización.

1. Ve a **Settings** → **Basic**
2. Busca **"Site URL"** o **"App Domains"**
3. Asegúrate de tener configurado:
   - **Site URL:** `https://setterapp.ai`
   - **App Domains:** `setterapp.ai` (sin https://)

### 2. Verifica en Multiple Ubicaciones
El redirect URI puede necesitar estar configurado en múltiples lugares:

#### Ubicación 1: Instagram Business Login (CRÍTICO)
- **Products** → **Instagram** → **Instagram Business Login** → **Redirect URL**

#### Ubicación 2: Client OAuth Settings
- **Settings** → **Basic** → **Client OAuth Settings** → **Valid OAuth Redirect URIs**

#### Ubicación 3: Facebook Login Settings
- **Products** → **Facebook Login** → **Settings** → **Valid OAuth Redirect URIs**

Agrega el redirect URI en **TODAS** estas ubicaciones para estar seguro:

```
https://setterapp.ai/auth/instagram/callback
```

## ✅ Verificación

1. Usa el **"Redirect URI Validator"** en Meta Developers
2. Ingresa: `https://setterapp.ai/auth/instagram/callback`
3. Debe mostrar: ✅ **"This is a valid redirect URI for this application"**

## 🔄 Después de Configurar

1. Espera 2-3 minutos para que los cambios se propaguen
2. Cierra y vuelve a abrir tu navegador (o usa modo incógnito)
3. Intenta conectar Instagram de nuevo

## 📝 Resumen

**Redirect URI que debes usar:**
```
https://setterapp.ai/auth/instagram/callback
```

**Dónde configurarlo (en orden de importancia):**
1. ✅ **Products** → **Instagram** → **Instagram Business Login** → **Redirect URL** (MÁS IMPORTANTE)
2. ✅ **Settings** → **Basic** → **Client OAuth Settings** → **Valid OAuth Redirect URIs**
3. ✅ **Products** → **Facebook Login** → **Settings** → **Valid OAuth Redirect URIs**

**También verifica:**
- ✅ **Settings** → **Basic** → **Site URL** = `https://setterapp.ai`
- ✅ **Settings** → **Basic** → **App Domains** = `setterapp.ai`
