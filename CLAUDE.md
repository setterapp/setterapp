# AppSetter (setterapp.ai) - AI Context

## Project Overview
Multi-channel CRM and messaging platform with AI-powered lead classification and automated responses. Users can manage conversations from Instagram, Messenger, and WhatsApp in one place.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **AI**: OpenAI GPT-3.5-turbo (lead classification) + GPT-4o-mini (auto-replies)
- **Platforms**: Instagram, Facebook Messenger, WhatsApp Business

## Key Architecture

### Database (Supabase)
- `users` - User accounts
- `conversations` - Chat conversations with `lead_status` (cold/warm/hot/closed/not_closed)
- `messages` - Individual messages with direction (inbound/outbound)
- `contacts` - Contact profiles with CRM data
- `integrations` - Platform connections (Instagram/Messenger/WhatsApp)
- `agents` - AI agent configurations per platform

### Edge Functions (Deno)

#### Public Webhooks (NO JWT verification)
These are called by external services (Meta, WhatsApp) and use their own verification tokens:
- `instagram-webhook` - Receives Instagram messages, saves to DB, triggers AI responses + lead classification
- `messenger-webhook` - Same for Facebook Messenger
- `whatsapp-webhook` - Same for WhatsApp
- Verification: Use `VERIFY_TOKEN` environment variables specific to each platform

#### Internal Edge Functions (NO JWT verification, NO auth headers)
These are called internally by webhooks WITHOUT authentication headers:
- `check-availability` - Returns occupied calendar events for AI reasoning
- `schedule-meeting` - Creates Google Calendar events with Meet links (used by both Instagram and WhatsApp)
- `detect-lead-status` - Classifies conversation lead status using GPT-3.5-turbo
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

### Frontend Structure
- `src/pages/Conversations.tsx` - Main conversation view with split panel
- `src/hooks/useConversations.ts` - Fetches conversations with Realtime updates
- `src/hooks/useMessages.ts` - Fetches messages + calls auto-classification on new inbound messages
- `src/services/ai/leadStatusDetection.ts` - Lead classification logic (frontend + shared types)

## Lead Classification System

### How It Works
1. **Webhook receives message** → Saves to `messages` table
2. **Webhook calls** `detect-lead-status` Edge Function asynchronously
3. **Edge Function**:
   - Fetches last 12 messages from conversation
   - Sends to GPT-3.5-turbo with classification prompt
   - Updates `conversations.lead_status` and `contacts.lead_status`
4. **Frontend (if user has conversation open)**:
   - `useMessages` detects new inbound message via Realtime
   - Also calls `autoClassifyLeadStatus` (fallback/redundancy)

### Lead Statuses
- **cold** - Not interested, negative
- **warm** - Moderate interest, basic questions
- **hot** - Very interested, asks prices/dates
- **closed** - Purchase completed successfully
- **not_closed** - Closed without conversion

## Important Notes
- All webhooks run async classification to avoid blocking webhook responses
- Frontend shows lead status badges in conversation list
- Manual classification banner was removed (now fully automatic)
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
- **Modify lead classification**: Edit `detect-lead-status` Edge Function
- **Change AI prompts**: Check both Edge Function and `leadStatusDetection.ts`

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
