# AppSetter (setterapp.ai) - AI Context

## Project Overview
Multi-channel CRM and messaging platform with AI-powered lead classification and automated responses. Users can manage conversations from Instagram, Messenger, and WhatsApp in one place.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **AI**: OpenAI GPT-4o-mini (auto-replies)
- **Platforms**: Instagram, Facebook Messenger, WhatsApp Business

## Key Architecture

### Database (Supabase)
- `users` - User accounts
- `conversations` - Chat conversations (linked to contacts)
- `messages` - Individual messages with direction (inbound/outbound)
- `contacts` - Contact profiles with CRM data including `lead_status` (source of truth)
- `integrations` - Platform connections (Instagram/Messenger/WhatsApp)
- `agents` - AI agent configurations per platform

### Edge Functions (Deno)

#### Public Webhooks (NO JWT verification)
These are called by external services (Meta, WhatsApp) and use their own verification tokens:
- `instagram-webhook` - Receives Instagram messages, saves to DB, triggers AI responses
- `messenger-webhook` - Same for Facebook Messenger
- `whatsapp-webhook` - Same for WhatsApp
- Verification: Use `VERIFY_TOKEN` environment variables specific to each platform

#### Internal Edge Functions (NO JWT verification, NO auth headers)
These are called internally by webhooks WITHOUT authentication headers:
- `check-availability` - Returns occupied calendar events for AI reasoning
- `schedule-meeting` - Creates Google Calendar events with Meet links (used by both Instagram and WhatsApp)
- `update-contact-email` - Updates contact email in CRM
- `facebook-exchange-token`, `instagram-exchange-token` - OAuth token management

#### 🚨 CRITICAL - JWT VERIFICATION RULES 🚨
**NEVER add JWT verification OR Authorization headers to ANY edge function in this project**

Why:
1. All functions are designed to work WITHOUT authentication
2. Webhooks are publicly accessible (Meta/WhatsApp callbacks)
3. Meeting functions (check-availability, schedule-meeting) are called directly without headers
4. Adding JWT or requiring headers breaks the entire system

How functions are called:
- **Webhooks**: Platform-specific VERIFY_TOKEN (Instagram, WhatsApp, etc.)
- **Meeting functions**: Direct invocation without headers
- **Example**:
  ```typescript
  // CORRECT - No headers
  supabase.functions.invoke('check-availability', {
    body: { user_id: userId, days_ahead: 10 }
  })

  // WRONG - Don't add headers
  supabase.functions.invoke('check-availability', {
    body: {...},
    headers: { Authorization: '...' }  // ❌ NO HACER ESTO
  })
  ```

**If you're tempted to add JWT or Authorization headers, DON'T. Re-read this section.**

#### 🚨 CRITICAL - EDGE FUNCTION DEPLOYMENT 🚨

**ALWAYS use the deploy script when deploying functions:**

```bash
./deploy-functions.sh
```

**NEVER deploy manually** without the `--no-verify-jwt` flag. Supabase has a known bug where JWT verification auto-enables during deployment even if config.toml says otherwise.

**If you must deploy a single function:**
```bash
supabase functions deploy function-name --no-verify-jwt
```

**NEVER enable JWT in the Supabase dashboard after deployment.** If you do, ALL functions will break immediately.

Files:
- `supabase/config.toml` - JWT configuration (has known bug, use deploy script instead)
- `deploy-functions.sh` - Deployment script with --no-verify-jwt flags

### Frontend Structure
- `src/pages/Conversations.tsx` - Main conversation view with split panel
- `src/hooks/useConversations.ts` - Fetches conversations with Realtime updates
- `src/hooks/useMessages.ts` - Fetches messages with Realtime updates
- `src/services/ai/leadStatusDetection.ts` - Lead status types and utilities

## Lead Status System

### How It Works
- Lead status is managed **manually** by the user through dropdown in the UI
- The `contacts` table is the **single source of truth** for lead status
- Frontend reads from `contact_ref.lead_status` via conversation join
- When user changes status, only the `contacts` table is updated

### Lead Statuses
- **cold** - Not interested, negative
- **warm** - Moderate interest, basic questions
- **booked** - Meeting scheduled, high interest
- **closed** - Purchase completed successfully
- **not_closed** - Closed without conversion

## Important Notes
- Lead status badges are shown in conversation list (from contacts table)
- New contacts are created with default status 'cold'
- Instagram webhook has duplicate message detection (Meta can send same message multiple times)
- **Auto-Scheduling Enabled**: Both Instagram and WhatsApp webhooks support AI-powered meeting scheduling
  - AI uses `check_availability` to see occupied events + work hours
  - AI reasons about gaps between events to propose available times
  - Uses `schedule_meeting` to create Google Calendar events with Meet links
  - All datetime calculations use local timezone (configured in agent)
  - AI can offer multiple days/times flexibly based on lead preferences
- All webhooks support debug mode via `config.debug_webhooks` flag in integrations table
- **Facebook integration is DISABLED**: UI hidden, page_access_token code commented in webhooks, all active integrations disconnected

## Common Tasks
- **Add new platform**: Create webhook Edge Function + integration type in DB
- **Change AI prompts**: Edit agent description in the database or UI

---

## Working Guidelines

### Git Workflow
- **ALWAYS commit and push** after completing a series of instructions or finishing a task
- Use descriptive commit messages that explain what was changed and why
- Don't leave uncommitted work unless explicitly told to do so

### Token Efficiency
- **DO NOT create .md files** to explain things unless explicitly requested
- **Keep output concise** - avoid over-explaining in responses
- Focus on doing the work, not documenting every step

### Supabase MCP Usage
- **Use only necessary MCP tools** - don't waste tokens on unnecessary Supabase operations
- Prefer direct SQL queries when appropriate
- Only use MCP tools when they provide clear value over alternatives

### Code Quality
- Keep changes minimal and focused on the task at hand
- Don't add unnecessary features or refactorings
- Prioritize working solutions over perfect solutions
