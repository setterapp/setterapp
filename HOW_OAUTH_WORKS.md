# ¿Cómo funciona OAuth para múltiples usuarios?

## ✅ SÍ, cada usuario puede conectar su propia cuenta

### Cómo funciona:

1. **Usuario A se registra en tu app**
   - Crea cuenta con email/password o Google
   - Obtiene su propia sesión en Supabase
   - Su `user_id` es único (ej: `user_123`)

2. **Usuario A conecta Instagram**
   - Hace clic en "Conectar Instagram"
   - Se redirige a Facebook OAuth
   - Autoriza tu app con SU cuenta de Facebook/Instagram
   - Facebook devuelve un token de acceso
   - **Supabase guarda ese token en la sesión del Usuario A**
   - El token está vinculado a `user_123`

3. **Usuario B se registra en tu app**
   - Crea su propia cuenta
   - Obtiene su propia sesión
   - Su `user_id` es diferente (ej: `user_456`)

4. **Usuario B conecta Instagram**
   - Hace clic en "Conectar Instagram"
   - Se redirige a Facebook OAuth
   - Autoriza con SU propia cuenta de Facebook/Instagram
   - Facebook devuelve un token diferente
   - **Supabase guarda ese token en la sesión del Usuario B**
   - El token está vinculado a `user_456`

### Resultado:

- ✅ **Usuario A** tiene su token de Instagram → La IA responde mensajes de SU Instagram
- ✅ **Usuario B** tiene su token de Instagram → La IA responde mensajes de SU Instagram
- ✅ **Cada usuario solo ve y gestiona sus propias integraciones**
- ✅ **Completamente legal** - Es el método oficial de Facebook/Instagram
- ✅ **Sin tokens manuales** - Todo automático con OAuth

## Seguridad y Privacidad

### ¿Cómo se asegura que cada usuario solo acceda a su cuenta?

1. **Sesiones separadas:**
   - Cada usuario tiene su propia sesión en Supabase
   - Los tokens se guardan en `session.provider_token`
   - Cada sesión es independiente

2. **Filtrado por usuario:**
   - Todas las consultas a la base de datos filtran por `user_id`
   - Ejemplo: `.eq('user_id', session.user.id)`
   - Un usuario no puede ver las integraciones de otro

3. **Row Level Security (RLS):**
   - Supabase tiene políticas de seguridad
   - Cada usuario solo puede leer/escribir sus propios datos
   - Incluso si alguien intenta hackear, no puede acceder a datos de otros

## Flujo Completo

```
Usuario A:
1. Se registra → Sesión creada (user_id: user_123)
2. Conecta Instagram → OAuth con SU cuenta de Facebook
3. Token guardado en sesión de user_123
4. IA usa token de user_123 → Responde mensajes de Instagram de Usuario A

Usuario B:
1. Se registra → Sesión creada (user_id: user_456)
2. Conecta Instagram → OAuth con SU cuenta de Facebook (diferente)
3. Token guardado en sesión de user_456
4. IA usa token de user_456 → Responde mensajes de Instagram de Usuario B
```

## Ventajas del OAuth

✅ **Legal y oficial** - Método aprobado por Facebook/Instagram
✅ **Sin riesgo de baneo** - Cumple con todas las políticas
✅ **Automático** - No necesitas pedir tokens manualmente
✅ **Seguro** - Tokens manejados por Supabase de forma segura
✅ **Multi-usuario** - Cada usuario tiene su propio token
✅ **Refresh automático** - Los tokens se renuevan automáticamente

## Requisitos para los usuarios

Para que un usuario pueda conectar Instagram, necesita:

1. **Cuenta de Instagram Business o Creator**
   - No funciona con cuentas personales
   - Debe estar conectada a una página de Facebook

2. **Página de Facebook**
   - Su Instagram Business debe estar conectado a una página de Facebook
   - La página debe estar administrada por su cuenta de Facebook

3. **Autorizar tu app**
   - Cuando hacen clic en "Conectar", autorizan tu app
   - Dan permisos para acceder a su Instagram
   - Esto es completamente legal y seguro

## ¿Qué pasa cuando un usuario cierra sesión?

- El token se limpia automáticamente
- Si vuelve a iniciar sesión, necesita reconectar Instagram
- Esto es por seguridad

## ¿Qué pasa si un usuario tiene múltiples cuentas de Instagram?

- Solo puede conectar una cuenta a la vez
- Si quiere cambiar de cuenta, debe desconectar y reconectar
- El token siempre corresponde a la última cuenta autorizada

