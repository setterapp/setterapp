# Solución: "Invalid platform app" al generar token de Instagram

Este error ocurre cuando tu app de Meta no está configurada correctamente para Instagram. Sigue estos pasos:

## Paso 1: Agregar el producto de Instagram a tu App

1. Ve a: https://developers.facebook.com/apps/
2. Selecciona tu App
3. En el dashboard, busca la sección **"Add Products"** o **"Products"**
4. Busca **"Instagram"** en la lista de productos
5. Haz clic en **"Set Up"** o **"Add"** en el producto Instagram
6. Sigue el asistente de configuración

## Paso 2: Configurar Instagram Basic Display (si es necesario)

1. En tu App, ve a: **Products → Instagram → Basic Display**
2. Configura:
   - **Valid OAuth Redirect URIs**: Agrega tu redirect URI
     - Ejemplo: `https://tu-dominio.com/auth/instagram/callback`
     - O: `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`
   - **Deauthorize Callback URL**: (opcional)
   - **Data Deletion Request URL**: (opcional)

## Paso 3: Configurar Instagram Graph API (para mensajes)

1. En tu App, ve a: **Products → Instagram → Graph API**
2. Asegúrate de que esté habilitado
3. Configura los permisos necesarios:
   - Ve a **App Review → Permissions and Features**
   - Busca y solicita:
     - `instagram_basic`
     - `instagram_manage_messages`
     - `pages_manage_metadata`
     - `pages_messaging`

## Paso 4: Conectar una cuenta de Instagram Business

1. En tu App, ve a: **Products → Instagram → Basic Display**
2. Haz clic en **"Create New App"** o **"Add Instagram App ID"** si es necesario
3. Conecta tu cuenta de Instagram Business:
   - Asegúrate de que tu cuenta de Instagram sea una **Instagram Business Account**
   - Si no lo es, conviértela en Configuración de Instagram → Cuenta → Cambiar a cuenta profesional

## Paso 5: Verificar que tu App esté en modo correcto

1. Ve a: **Settings → Basic**
2. Verifica:
   - **App Mode**: Debe estar en **"Development"** o **"Live"** (no en "Test")
   - **App ID**: Debe estar visible
   - **App Secret**: Debe estar configurado

## Paso 6: Generar el token correctamente

1. Ve a: https://developers.facebook.com/tools/explorer/
2. En la parte superior:
   - **Selecciona tu App** (la que acabas de configurar)
   - **Usuario o Página**: Selecciona tu **Página de Facebook** (no tu perfil personal)
     - ⚠️ IMPORTANTE: Debe ser una Página, no un perfil personal
     - La página debe estar conectada a tu Instagram Business Account
3. Haz clic en **"Generate Access Token"**
4. Selecciona los permisos:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_manage_metadata`
   - `pages_messaging`
5. Haz clic en **"Generate Access Token"**

## Paso 7: Si aún no funciona - Verificar configuración

### Verificar que Instagram esté agregado como producto:

1. Ve a tu App → **Dashboard**
2. Debe aparecer **"Instagram"** en la lista de productos instalados
3. Si no aparece, agrégalo desde **"Add Products"**

### Verificar que tengas una Página conectada:

1. Ve a: https://www.facebook.com/pages/
2. Asegúrate de tener una Página de Facebook
3. Conecta tu Instagram Business Account a esa página:
   - Ve a la configuración de tu Página
   - Busca "Instagram" en el menú lateral
   - Conecta tu cuenta de Instagram Business

### Verificar permisos de la App:

1. Ve a: **App Review → Permissions and Features**
2. Verifica que tengas estos permisos (pueden estar en "Standard Access" o necesitar aprobación):
   - `instagram_basic` - Standard Access
   - `instagram_manage_messages` - Puede requerir aprobación
   - `pages_manage_metadata` - Standard Access
   - `pages_messaging` - Puede requerir aprobación

## Alternativa: Usar un token de larga duración

Si necesitas un token que no expire:

1. Genera un token de corta duración en Graph API Explorer
2. Ve a: https://developers.facebook.com/tools/debug/accesstoken/
3. Pega tu token
4. Haz clic en **"Extend Access Token"** o **"Extend Token"**
5. Esto generará un token de 60 días

## Troubleshooting adicional

### Error: "App not setup"

- Asegúrate de haber completado el setup de Instagram en tu App
- Ve a **Products → Instagram** y completa todos los pasos

### Error: "Invalid OAuth redirect URI"

- Verifica que el redirect URI en tu App coincida exactamente con el que usas
- Debe incluir protocolo (https://), dominio completo y path

### Error: "User not authorized"

- Asegúrate de estar usando una Página, no un perfil personal
- La página debe estar conectada a Instagram Business Account
- Debes ser administrador de la página

## Verificación rápida

Ejecuta esta query en Graph API Explorer para verificar tu configuración:

```
GET /me/accounts?fields=id,name,instagram_business_account
```

Si esto funciona, deberías ver tus páginas y sus Instagram Business Accounts conectados.
