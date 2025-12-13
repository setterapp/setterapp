# Configuración Rápida de Facebook/Instagram OAuth

## ✅ Credenciales de Meta

- **App ID:** `3441846319280367`
- **App Secret:** `2e8287f7f99d6b4f43dd7ba918cc4ad4`

## Pasos Rápidos

### 1. En Facebook Developers (Meta for Developers)

1. Ve a tu app en [Facebook Developers](https://developers.facebook.com/apps/)
2. **Settings** → **Basic**:
   - **App Domains:** Agrega:
     ```
     faxramhdlskckwwyyqna.supabase.co
     localhost
     ```
   - **Site URL:** `http://localhost:5173`

3. **Products** → **Facebook Login** → **Settings**:
   - **Valid OAuth Redirect URIs:** Agrega:
     ```
     https://faxramhdlskckwwyyqna.supabase.co/auth/v1/callback
     http://localhost:5173/auth/callback
     ```

### 2. En Supabase Dashboard (⚠️ IMPORTANTE - Hacer esto primero)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **Authentication** → **Providers**
3. Busca **Facebook** en la lista de proveedores
4. **Habilita el toggle** de Facebook (debe estar en verde/activado)
5. Ingresa las credenciales:
   - **Client ID (App ID):** `3441846319280367`
   - **Client Secret (App Secret):** `2e8287f7f99d6b4f43dd7ba918cc4ad4`
6. **Guarda** los cambios
7. Verifica que el toggle de Facebook esté **habilitado** (verde)

**⚠️ Si no habilitas Facebook aquí, obtendrás el error: "provider is not enabled"**

### 3. Verificar Redirect URLs en Supabase

1. **Settings** → **Authentication** → **Redirect URLs**
2. Asegúrate de tener:
   ```
   http://localhost:5173/**
   ```

## ¡Listo!

Ahora los usuarios pueden:
1. Ir a **Integraciones** en tu app
2. Activar el toggle de **Instagram**
3. Ser redirigidos a Facebook para autorizar
4. Conectar su cuenta de Instagram Business automáticamente

## Notas Importantes

⚠️ **Modo Desarrollo:** Tu app de Facebook debe estar en modo desarrollo para probar. Solo tú y los administradores pueden autenticarse.

⚠️ **Error "Facebook Login is currently unavailable":**
- Si ves este error, agrega usuarios de prueba:
  1. Ve a **Meta Developers** → Tu app → **Roles** → **Test Users**
  2. Haz clic en **"Add Test Users"** o agrega tu cuenta como tester
  3. O asegúrate de estar logueado con la cuenta que creó la app

⚠️ **Cuenta Business:** Los usuarios necesitan una cuenta de Instagram Business o Creator conectada a una página de Facebook.

⚠️ **Permisos:** Algunos permisos pueden requerir revisión de Facebook para producción.
