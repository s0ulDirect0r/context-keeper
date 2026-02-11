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
3. **Summary Generation** → Claude API generates summaries + extracts themes in parallel
4. **Persistence** → Logged-in users get auto-save to Supabase; guests use localStorage

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components (Radix UI wrappers in `ui/`)
- `src/lib/` - Utilities: `claude.ts` (AI), `otter.ts` (API client), `supabase/` (DB)
- `supabase/migrations/` - Database schema migrations

### API Routes

| Route                        | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `POST /api/summarize`        | Generate summaries via Claude, extract themes, auto-save |
| `POST /api/otter/login`      | Authenticate with Otter.ai                               |
| `GET /api/otter/recordings`  | Fetch user's Otter recordings                            |
| `POST /api/otter/recordings` | Get transcripts for selected recordings                  |

### Database Tables

- **summaries** - Stores summaries, themes, and context (JSONB columns)
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
- **Parallel processing:** Summary generation and theme extraction run concurrently
- **Theme extraction:** Returns abstract conceptual themes with supporting quotes, not surface-level topics
