# Guía de Permisos de Facebook para WhatsApp Business

## ✅ Permisos Mínimos Requeridos

Para que la integración de WhatsApp Business funcione, necesitas solicitar estos **3 permisos esenciales** en Facebook Developers:

### 1. `whatsapp_business_management` ⭐ REQUERIDO
- **Qué hace**: Permite gestionar cuentas de WhatsApp Business, números de teléfono, templates de mensajes, códigos QR y suscripciones de webhooks.
- **Estado**: Debe estar en "Ready for testing" o "Approved"
- **Por qué lo necesitas**: Para obtener el `whatsappBusinessAccountId` y `phoneNumberId`

### 2. `whatsapp_business_messaging` ⭐ REQUERIDO
- **Qué hace**: Permite enviar y recibir mensajes de WhatsApp, subir/descargar medios, y gestionar el perfil de WhatsApp Business.
- **Estado**: Debe estar en "Ready for testing" o "Approved"
- **Por qué lo necesitas**: Para enviar mensajes a través de la API

### 3. `business_management` ⭐ REQUERIDO
- **Qué hace**: Permite leer y escribir con la Business Manager API.
- **Estado**: Debe estar en "Ready for testing" o "Approved"
- **Por qué lo necesitas**: Para acceder a la información de Business Manager y las cuentas de WhatsApp Business

## 📋 Permisos Opcionales (pero recomendados)

### `pages_show_list` (Opcional)
- **Qué hace**: Permite listar las páginas de Facebook del usuario
- **Por qué es útil**: Si el método directo de obtener WhatsApp Business Accounts falla, podemos obtener la información desde las páginas

### `pages_read_engagement` (Opcional)
- **Qué hace**: Leer métricas de engagement de páginas
- **Por qué es útil**: Para obtener información adicional de las páginas

### `pages_messaging` (Opcional)
- **Qué hace**: Enviar mensajes desde páginas
- **Por qué es útil**: Si quieres integrar también Messenger

## 🚫 Permisos que NO necesitas

- `whatsapp_business_manage_events` - Solo si quieres enviar eventos de conversión (purchases, add-to-cart, etc.)
- `email` - No necesario para WhatsApp Business
- `public_profile` - Se otorga automáticamente
- `manage_app_solution` - Solo para apps que gestionan otras apps

## 📝 Cómo Solicitar los Permisos

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación
3. Ve a **App Review > Permissions and Features**
4. Busca cada permiso en la lista
5. Haz clic en **"Request"** o **"Request Advanced Access"** para cada uno
6. Completa el formulario explicando:
   - **Cómo usarás el permiso**: "Para permitir que los usuarios conecten su cuenta de WhatsApp Business y envíen/reciban mensajes a través de nuestra plataforma"
   - **Por qué lo necesitas**: "Los usuarios necesitan gestionar conversaciones de WhatsApp Business desde nuestra aplicación"

## ⚠️ Estados de los Permisos

- **Ready for testing**: ✅ Puedes usarlo en modo desarrollo
- **Approved**: ✅ Aprobado para producción
- **In development**: ⏳ Aún en revisión
- **Not requested**: ❌ No solicitado aún

## 🔍 Verificar Permisos en el Código

Los permisos están definidos en `src/services/facebook/whatsapp.ts`:

```typescript
const WHATSAPP_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'business_management',
]
```

## 🧪 Probar los Permisos

1. Asegúrate de que los 3 permisos estén en "Ready for testing" o "Approved"
2. Agrega usuarios de prueba en **Roles > Roles** (si están en modo desarrollo)
3. Intenta conectar WhatsApp desde la página de Integraciones
4. Verifica que se obtenga correctamente el `phoneNumberId` y `whatsappBusinessAccountId`

## 📚 Recursos

- [WhatsApp Business API Permissions](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Facebook App Review Process](https://developers.facebook.com/docs/app-review)
- [Business Manager API](https://developers.facebook.com/docs/business-manager-api)

