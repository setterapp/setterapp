# Variables de Entorno para Instagram Webhook

## 🔍 Variables Necesarias

El webhook de Instagram (`supabase/functions/instagram-webhook/index.ts`) necesita estas variables de entorno en Supabase:

## 📋 Variables de Entorno Requeridas

### 1. INSTAGRAM_WEBHOOK_VERIFY_TOKEN
**Descripción:** Token de verificación para validar que las peticiones vienen de Instagram/Meta.

**Valor por defecto (en el código):** `d368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec`

**Cómo configurarlo:**
1. Ve a Supabase Dashboard → Tu proyecto
2. Ve a **Edge Functions** → **instagram-webhook**
3. Ve a **Settings** o **Environment Variables**
4. Agrega:
   - **Key:** `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
   - **Value:** Un token secreto aleatorio (o usa el que está en el código)

**⚠️ Importante:** Este mismo token debe estar configurado en Meta Developers cuando configuras el webhook.

### 2. SUPABASE_URL
**Descripción:** URL de tu proyecto de Supabase. Normalmente se configura automáticamente.

**Cómo obtenerlo:**
- Supabase Dashboard → Settings → API → Project URL

### 3. SUPABASE_SERVICE_ROLE_KEY
**Descripción:** Service Role Key de Supabase para operaciones administrativas. Normalmente se configura automáticamente.

**Cómo obtenerlo:**
- Supabase Dashboard → Settings → API → Service Role Key
- ⚠️ **NUNCA** expongas esta key en el frontend

---

## 🚀 Cómo Configurar en Supabase Dashboard

### Método 1: Desde Edge Functions (Recomendado)

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Edge Functions** en el menú lateral
4. Haz clic en **instagram-webhook**
5. Ve a la pestaña **Settings** o busca **Environment Variables**
6. Agrega las variables:
   - `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` = `[tu_token_secreto]`
   - `SUPABASE_URL` = `[se configura automáticamente normalmente]`
   - `SUPABASE_SERVICE_ROLE_KEY` = `[se configura automáticamente normalmente]`

### Método 2: Desde Project Settings

1. Ve a **Settings** → **Edge Functions**
2. Busca **Environment Variables**
3. Agrega las variables necesarias

---

## 🔑 Generar un Token Secreto

Para generar un token secreto seguro para `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`:

```bash
# Opción 1: Usar OpenSSL
openssl rand -hex 32

# Opción 2: Usar Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O simplemente usa el que está en el código como valor por defecto.

---

## ⚙️ Configuración en Meta Developers

Una vez que tengas el `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, debes usar el mismo valor en Meta Developers:

1. Ve a Meta Developers → Tu app
2. Ve a **Products** → **Instagram** → **Webhooks**
3. Cuando configures el webhook:
   - **Callback URL:** `https://[tu-proyecto].supabase.co/functions/v1/instagram-webhook`
   - **Verify Token:** El mismo valor que pusiste en `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`

---

## ✅ Verificación

Para verificar que las variables están configuradas:

1. Ve a Supabase Dashboard → Edge Functions → instagram-webhook
2. Revisa los logs cuando el webhook recibe una petición
3. Si hay errores sobre variables no definidas, las variables no están configuradas correctamente

---

## 📝 Resumen Rápido

**Variables necesarias:**
1. ✅ `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` - Token secreto (debes configurarlo)
2. ✅ `SUPABASE_URL` - Se configura automáticamente normalmente
3. ✅ `SUPABASE_SERVICE_ROLE_KEY` - Se configura automáticamente normalmente

**Ubicación en Supabase:**
- Edge Functions → instagram-webhook → Settings → Environment Variables

**Ubicación en Meta Developers:**
- Products → Instagram → Webhooks → Verify Token (debe coincidir con `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`)
