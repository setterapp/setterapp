# AppSetter

Aplicación web minimalista para gestionar agentes de IA y automatizar conversaciones en WhatsApp Business e Instagram.

## Características

- 🤖 **Agentes de IA**: Crea y gestiona agentes de IA personalizados
- 💬 **Integraciones**: Conecta con WhatsApp Business, Instagram y Google Calendar
- 📊 **Analíticas**: Visualiza métricas y estadísticas de conversaciones
- 💭 **Conversaciones**: Gestiona y revisa todas tus conversaciones

## Tecnologías

- React + TypeScript
- Vite
- Supabase
- React Router

## Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build
```

## Configuración

1. Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. El archivo `.env` ya está configurado con las credenciales de Supabase y Google. Si necesitas cambiarlas, edita el archivo `.env`.

3. Las credenciales de Google también deben configurarse en Supabase Dashboard (Authentication → Providers → Google).

**Nota:** El archivo `.env` está en `.gitignore` y no se subirá al repositorio por seguridad.
# setterapp
