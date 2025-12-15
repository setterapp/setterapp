# Métodos de OAuth para Instagram - Explicación Completa

## 🔄 Dos Métodos Diferentes

Hay **DOS formas** de conectar Instagram, y actualmente estamos usando el **Método 2**:

---

## Método 1: Supabase Auth con Facebook Provider ❌ (NO lo usamos ahora)

### Cómo funciona:
1. Configuras **Facebook** como provider en Supabase Dashboard
2. Usas `supabase.auth.signInWithOAuth({ provider: 'facebook' })`
3. Supabase maneja todo el OAuth automáticamente
4. Redirect URI: `https://afqbakvvfpebnxzjewsk.supabase.co/auth/v1/callback`
5. **Problema:** Abre el login de **Facebook**, no Instagram directamente
6. Token se guarda en `session.provider_token` de Supabase

### Configuración necesaria:
- ✅ Facebook provider habilitado en Supabase Dashboard
- ✅ Facebook App ID y Secret en Supabase
- ✅ Redirect URI de Supabase en Meta Developers

### Ventajas:
- ✅ Automático (Supabase maneja todo)
- ✅ Refresh automático de tokens
- ✅ Más simple de implementar

### Desventajas:
- ❌ Abre login de Facebook (no Instagram)
- ❌ No funciona con cuentas de Instagram no vinculadas a Facebook
- ❌ Peor UX para el usuario

---

## Método 2: Instagram Direct OAuth ✅ (Lo que usamos ahora)

### Cómo funciona:
1. **NO** necesitas configurar nada en Supabase Auth
2. El código maneja el OAuth directamente con Instagram
3. Usa `instagram.com/oauth/authorize/third_party`
4. Redirect URI: `https://setterapp.ai/auth/instagram/callback` (tu app)
5. ✅ Abre el login de **Instagram** directamente
6. Token se guarda manualmente en la tabla `integrations` de Supabase

### Configuración necesaria:
- ❌ **NO** necesitas configurar Facebook provider en Supabase
- ✅ Instagram App ID y Secret en variables de entorno
- ✅ Redirect URI de tu app en Meta Developers

### Ventajas:
- ✅ Abre login de Instagram directamente
- ✅ Funciona con cuentas no vinculadas a Facebook
- ✅ Mejor UX (popup de Instagram)
- ✅ Similar a competidores

### Desventajas:
- ❌ Tienes que manejar el OAuth manualmente
- ❌ Tienes que guardar el token manualmente
- ❌ Tienes que manejar el refresh de tokens manualmente (si es necesario)

---

## 📋 ¿Qué método estamos usando actualmente?

**Método 2: Instagram Direct OAuth**

### Código actual:
```typescript
// src/services/instagram-direct.ts
// Maneja OAuth directamente con Instagram
// NO usa Supabase Auth
```

### Token storage:
```typescript
// Guarda el token en la tabla 'integrations'
await supabase.from('integrations').insert({
  user_id: userId,
  type: 'instagram',
  config: { access_token: token }
})
```

---

## ❓ ¿Necesitas configurar Facebook en Supabase?

**NO**, porque:
1. Estamos usando el método directo de Instagram
2. No usamos `supabase.auth.signInWithOAuth({ provider: 'facebook' })`
3. El código maneja todo manualmente
4. El token se guarda en la tabla `integrations`, no en la sesión de Supabase

---

## 🔄 ¿Cuándo SÍ necesitarías Facebook en Supabase?

Solo si quisieras cambiar al **Método 1**, que:
- Usa `supabase.auth.signInWithOAuth({ provider: 'facebook' })`
- Requiere configurar Facebook provider en Supabase
- Guarda el token en `session.provider_token`
- **Pero** abre el login de Facebook (no Instagram directamente)

---

## ✅ Configuración Actual (Método 2 - Direct OAuth)

### En Supabase Dashboard:
- ❌ **NO** necesitas configurar Facebook provider
- ✅ Solo necesitas la base de datos funcionando

### En Meta Developers:
- ✅ Configurar redirect URI: `https://setterapp.ai/auth/instagram/callback`
- ✅ En la sección "Instagram Business Login"

### En tu código (.env):
- ✅ `VITE_INSTAGRAM_APP_ID=893993129727776`
- ✅ `VITE_INSTAGRAM_APP_SECRET=tu_secret`
- ✅ `VITE_INSTAGRAM_REDIRECT_URI=https://setterapp.ai/auth/instagram/callback` (opcional)

---

## 🎯 Resumen

| Aspecto | Método 1 (Supabase Auth) | Método 2 (Direct OAuth) - ACTUAL |
|---------|-------------------------|----------------------------------|
| Configuración Supabase | ✅ Facebook provider | ❌ No necesaria |
| Redirect URI | Supabase | Tu app |
| Login que abre | Facebook | Instagram ✅ |
| Token storage | `session.provider_token` | Tabla `integrations` |
| Refresh automático | ✅ Sí | ⚠️ Manual |
| Cuentas no vinculadas | ❌ No | ✅ Sí |
| UX | ⚠️ Medio | ✅ Excelente |

**Conclusión:** Estás bien con el método actual. **NO necesitas** configurar Facebook provider en Supabase para Instagram.
