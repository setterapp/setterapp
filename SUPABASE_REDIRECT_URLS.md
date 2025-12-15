# Redirect URLs en Supabase Dashboard

## 📍 Dónde configurar

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Authentication**
4. Scroll hacia abajo hasta **"Redirect URLs"**

## ✅ Redirect URLs que debes agregar

Agrega estas URLs (una por línea):

```
https://setterapp.ai/**
http://localhost:5173/**
```

El `**` permite que cualquier ruta bajo ese dominio sea válida.

## 📋 Explicación

### Para producción (setterapp.ai):
```
https://setterapp.ai/**
```
Esto permite que Supabase redirija a cualquier ruta de tu app después del login/registro, por ejemplo:
- `https://setterapp.ai/auth/callback`
- `https://setterapp.ai/integrations`
- `https://setterapp.ai/analytics`
- etc.

### Para desarrollo (localhost):
```
http://localhost:5173/**
```
Esto permite redirecciones durante el desarrollo local.

## ⚠️ Importante

- ✅ Usa `**` al final para permitir todas las rutas bajo ese dominio
- ✅ Agrega tanto producción como desarrollo
- ✅ Una URL por línea

## 🔍 Nota sobre Instagram OAuth

Para Instagram OAuth directo, **NO necesitas configurar nada especial en Supabase** porque:
- Instagram redirige directamente a `https://setterapp.ai/auth/instagram/callback`
- Tu app maneja ese callback directamente (página `InstagramCallback.tsx`)
- No pasa por Supabase Auth

Las redirect URLs de Supabase son solo para:
- Login/Registro de usuarios (Google OAuth, Email, etc.)
- Cualquier otro provider de Supabase Auth

## 📝 Ejemplo completo

En Supabase → Settings → Authentication → Redirect URLs, deberías tener:

```
https://setterapp.ai/**
http://localhost:5173/**
```

Después de agregarlas, haz clic en **"Save"** o **"Guardar"**.
