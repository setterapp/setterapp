# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Appsetter is a React-based SaaS platform for managing AI agents and integrations with social media platforms (Instagram, WhatsApp, Facebook) and Google Calendar. The application uses Supabase for backend services and is deployed on Vercel.

## Development Commands

```bash
# Development
npm run dev              # Start Vite dev server

# Build & Deployment
npm run build            # TypeScript compilation + Vite build
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
```

## Architecture

### Frontend Stack
- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7 with protected/public route wrappers
- **Styling**: Tailwind CSS with Neobrutalism design system (offset shadows, bold borders)
- **UI Components**: Radix UI primitives + custom components in `src/components/ui/`
- **Charts**: Recharts library
- **Internationalization**: i18next with Spanish (default) and English translations

### Backend & Services
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Serverless Functions**: Supabase Edge Functions in `supabase/functions/`:
  - `instagram-exchange-token`: Handles Instagram OAuth token exchange
  - `instagram-webhook`: Processes Instagram webhooks
  - `whatsapp-webhook`: Processes WhatsApp webhooks
- **Hosting**: Vercel with SPA routing configuration

### Authentication Flow
- Public routes: Landing, Login, Register, Privacy Policy
- Protected routes: Analytics, Conversations, Contacts, Agents, Integrations, Settings
- OAuth callbacks:
  - `/auth/callback`: Supabase OAuth callback
  - `/auth/instagram/callback`: Instagram direct OAuth callback (uses localStorage for state management)

### Key Directory Structure
```
src/
├── components/           # React components
│   ├── ui/              # Radix-based UI primitives (button, card, table, etc.)
│   ├── charts/          # Recharts chart components
│   ├── Auth.tsx         # Authentication component
│   ├── ProtectedRoute.tsx / PublicRoute.tsx
│   └── ConversationList.tsx
├── pages/               # Route page components
├── services/            # External service integrations
│   ├── facebook/        # Instagram & WhatsApp services
│   ├── google/          # Google Calendar service
│   ├── instagram-direct.ts
│   ├── openai.ts
│   └── cache.ts
├── hooks/               # Custom React hooks
│   ├── useAgents.ts
│   ├── useConversations.ts
│   ├── useIntegrations.ts
│   └── useMessages.ts
├── lib/                 # Core libraries (Supabase client)
├── locales/             # i18n translation files (es.json, en.json)
├── utils/               # Utility functions
└── styles/              # Global CSS styles
```

### Environment Configuration
Required environment variables in `.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_SECRET=
VITE_INSTAGRAM_APP_ID=
VITE_INSTAGRAM_REDIRECT_URI=  # Optional, defaults to {origin}/auth/instagram/callback
```

### OAuth Integration Notes

**Instagram Direct OAuth**:
- Uses direct Instagram OAuth (not Supabase OAuth provider)
- Redirect URI must match exactly in Meta Developers → Settings → Basic → Valid OAuth Redirect URIs
- State parameter stored in localStorage (not sessionStorage) to work with popup windows
- Cross-Origin-Opener-Policy header set to `same-origin-allow-popups` in `vercel.json`

**Meta App Configuration**:
- Configure redirect URIs in Meta Developers console
- App secret only used in Edge Functions, not client-side

### TypeScript Configuration
- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled with comprehensive linting rules
- Target: ES2022 with DOM libraries

### Styling System
- **Design**: Neobrutalism with Catppuccin Light palette
- **Shadows**: Offset shadows (neo, neo-sm, neo-lg, neo-xl) instead of soft shadows
- **Borders**: Bold 3px borders (`border-neo`)
- **Colors**: Primary blue (#89b4fa), with semantic colors for success, warning, danger
- **Responsive**: Mobile-first with sidebar overlay for small screens

### State Management
- Custom hooks in `src/hooks/` for data fetching and state
- Supabase real-time subscriptions for live data
- localStorage for user preferences (language, OAuth state)

### Important Patterns
1. Always use the `@/` path alias for imports from src
2. OAuth flows must handle popup communication via localStorage
3. All protected pages must be wrapped in `<ProtectedRoute>`
4. Use Radix UI primitives from `src/components/ui/` for consistency
5. Follow Neobrutalism design patterns (bold borders, offset shadows)

## Workflow

**IMPORTANT**: After completing any request or task, ALWAYS commit and push changes to the repository:
1. Stage all relevant changes with `git add`
2. Create a commit with a descriptive message
3. Push to the remote repository with `git push`

This ensures all work is immediately saved and synchronized.

## Documentation Policy

**DO NOT create .md files** unless explicitly requested by the user. This includes:
- README files
- Documentation files
- Setup guides
- Instruction files
- Testing guides

Keep all documentation in code comments or this CLAUDE.md file when necessary.
