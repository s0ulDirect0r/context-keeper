# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context Keeper is an AI-powered meeting summary generator that creates tailored summaries for specific audiences. Users can import transcripts from Otter.ai or paste them manually, answer contextual questions about their audience, and receive summaries optimized for their needs.

## Commands

```bash
# Development
pnpm dev              # Start dev server at localhost:3000
pnpm build            # Production build
pnpm start            # Run production server

# Testing (Playwright E2E)
pnpm exec playwright test                    # Run all tests
pnpm exec playwright test tests/example.spec.ts  # Run single test file
pnpm exec playwright test --ui               # Interactive test UI

# Supabase (local development)
supabase start        # Start local Supabase (requires Docker)
supabase db reset     # Reset local DB and run migrations
supabase migration new <name>  # Create new migration
```

## Architecture

### Data Flow

1. **Input** → User selects Otter.ai recordings or pastes transcript manually
2. **Context Gathering** → Multi-step wizard collects audience, priorities, and purpose
3. **Summary Generation** → Claude API generates tailored summaries via streaming
4. **Persistence** → Logged-in users get auto-save to Supabase; guests use localStorage

### Key Directories

- `src/models/` - Domain types (`types.ts`) and data access (`summaries.ts`, `otter.ts`)
- `src/services/` - AI operations (`summarize.ts`) and prompt templates (`prompts/`)
- `src/app/` - Next.js App Router pages and thin API route controllers
- `src/components/` - React components organized by feature group:
  - `auth/` - Authentication & session mode (AuthProvider, AuthDialog, AppModeProvider)
  - `generation/` - Transcript input & summary generation pipeline
  - `summary/` - Summary display & editing
  - `ui/` - Radix UI primitives (button, card, input, etc.)
- `src/lib/` - Utilities: `ai-client.ts` (Anthropic singleton), `otter.ts` (API client), `supabase/` (DB types + client)
- `supabase/migrations/` - Database schema migrations

### API Routes

> Full table with auth & rate-limit details: see ARCHITECTURE.md.

| Route                   | Method | Purpose                                               |
| ----------------------- | ------ | ----------------------------------------------------- |
| `/api/summarize`        | POST   | Generate summaries via Claude (SSE stream), auto-save |
| `/api/summaries`        | GET    | List/search user's summaries                          |
| `/api/summaries`        | POST   | Save a summary                                        |
| `/api/summaries/[id]`   | PATCH  | Update summary fields (title, content, sharing)       |
| `/api/summaries/[id]`   | DELETE | Delete summary                                        |
| `/api/otter/login`      | POST   | Authenticate with Otter.ai                            |
| `/api/otter/recordings` | GET    | Fetch user's Otter recordings                         |
| `/api/otter/recordings` | POST   | Get transcripts for selected recordings               |
| `/api/otter/connection` | GET    | Get user's saved Otter connection                     |
| `/api/otter/connection` | PUT    | Save/update Otter connection credentials              |
| `/api/otter/connection` | DELETE | Remove saved Otter connection                         |

### Database Tables

- **summaries** - Stores summaries and context (JSONB columns)
- **otter_connections** - Persists Otter.ai credentials per user

Both tables have Row Level Security enforcing user-only access.

## Environment Variables

Required in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Styling:** TailwindCSS 4 with Radix UI components
- **Database:** Supabase (PostgreSQL) with RLS
- **AI:** Claude API via @anthropic-ai/sdk
- **Testing:** Playwright for E2E

## Key Patterns

- **Auth modes:** Logged-in users (Supabase) and guests (localStorage) are both supported
- **Otter integration:** Uses unofficial API; credentials stored per-user in Supabase or localStorage for guests
- **MVC + Service Layer:** Models (`src/models/`) handle types + data access, services (`src/services/`) handle AI operations, API routes are thin controllers
- **server-only firewall:** `models/summaries.ts`, `models/otter.ts`, `services/summarize.ts` use `import 'server-only'`. `models/types.ts` is client-safe.
- **Data access rule:** Client components must never call Supabase directly for data mutations — all data ops go through API routes. Direct Supabase is only for server components (SSR) and auth state (`AuthProvider`).
