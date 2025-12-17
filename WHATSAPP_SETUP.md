# Configuración de WhatsApp Business

## ✅ Integración Automática con OAuth

La integración de WhatsApp Business ahora funciona completamente con **OAuth de Facebook**, sin necesidad de que el cliente ingrese tokens manualmente. El proceso es simple:

1. El usuario hace clic en "Conectar" en la página de Integraciones
2. Se redirige a Facebook para autorizar la aplicación
3. Automáticamente se obtiene y guarda toda la información necesaria
4. ¡Listo! WhatsApp Business está conectado

## 📋 Requisitos Previos

Para que la integración funcione correctamente, el usuario necesita tener:

### 1. Página de Facebook
- El usuario debe tener una **Página de Facebook** creada
- La página debe estar conectada a su cuenta de Facebook Business

### 2. WhatsApp Business Account
- La página de Facebook debe tener una **cuenta de WhatsApp Business** conectada
- Esto se hace desde **Facebook Business Manager** o desde la configuración de la página

### 3. Permisos de la App de Facebook
La aplicación debe tener los siguientes permisos (scopes) configurados en Facebook Developers:

**Permisos Mínimos Requeridos:**
- `whatsapp_business_management` ⭐ - Gestionar WhatsApp Business (cuentas, números, templates, webhooks)
- `whatsapp_business_messaging` ⭐ - Enviar y recibir mensajes de WhatsApp
- `business_management` ⭐ - Acceder a Business Manager API

**Permisos Opcionales (pero recomendados):**
- `pages_show_list` - Listar páginas conectadas (útil como método alternativo)

> 📖 Ver `FACEBOOK_PERMISSIONS_GUIDE.md` para más detalles sobre cómo solicitar estos permisos.

## 🔧 Configuración en Facebook Developers

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación
3. Ve a **Settings > Basic** y asegúrate de tener configurado:
   - **App Domains**: Tu dominio
   - **Valid OAuth Redirect URIs**: `https://tu-dominio.com/auth/callback`
4. Ve a **Products > WhatsApp** y configura:
   - **Webhook URL**: `https://tu-proyecto.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token**: El mismo que está en `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - **Webhook Fields**: Suscríbete a `messages`

## 🔄 Flujo de Conexión

1. Usuario hace clic en "Conectar WhatsApp" en `/integrations`
2. Se redirige a Facebook OAuth con los scopes necesarios
3. Usuario autoriza la aplicación
4. Callback (`/auth/callback`) recibe el token
5. Automáticamente se obtiene:
   - `pageId` - ID de la página de Facebook
   - `whatsappBusinessAccountId` - ID de la cuenta de WhatsApp Business
   - `phoneNumberId` - ID del número de teléfono de WhatsApp
6. Esta información se guarda en la tabla `integrations` en el campo `config`
7. La integración se marca como `connected`

## 📱 Enviar Mensajes

Una vez conectado, puedes enviar mensajes usando:

```typescript
import { whatsappService } from './services/facebook/whatsapp'

// El phoneNumberId se obtiene automáticamente desde la configuración guardada
await whatsappService.sendMessage({
  to: '1234567890', // Número de teléfono del destinatario (sin +)
  message: 'Hola, este es un mensaje de prueba'
})
```

## 🔔 Recibir Mensajes (Webhook)

Los mensajes entrantes se procesan automáticamente en:
- `supabase/functions/whatsapp-webhook/index.ts`

El webhook:
1. Recibe eventos de WhatsApp Business API
2. Crea o actualiza conversaciones en la base de datos
3. Guarda los mensajes en la tabla `messages`
4. Actualiza contadores de mensajes no leídos

## ⚠️ Errores Comunes

### "No tienes páginas de Facebook conectadas"
- El usuario debe crear una página de Facebook primero
- La página debe estar conectada a su cuenta

### "Esta página no tiene una cuenta de WhatsApp Business conectada"
- El usuario debe conectar su número de WhatsApp Business a la página
- Esto se hace desde Facebook Business Manager

### "No se pudo obtener el Phone Number ID"
- Verifica que la página tenga WhatsApp Business configurado
- Verifica que los permisos de la app incluyan `whatsapp_business_management`

## 🔐 Seguridad

- Los tokens de acceso se almacenan de forma segura en Supabase Auth
- Los tokens se refrescan automáticamente cuando expiran
- El webhook verifica el token de verificación antes de procesar eventos

## 📚 Recursos

- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [Supabase Auth OAuth](https://supabase.com/docs/guides/auth/social-login/auth-facebook)
