# Architecture

## Layer Structure

```
src/
  models/            # Domain types + data access (Supabase queries)
    types.ts         # All domain types — client-safe (no server-only)
    summaries.ts     # Summary CRUD, search, row mapping
    otter.ts         # Otter connection CRUD
  services/          # Business logic + AI operations
    summarize.ts     # Summary generation, streaming, orchestration
    prompts/         # Prompt templates
      shared.ts      # Shared prompt sections
      summary.ts     # Summary-specific prompts + tool definition
  app/api/           # Thin controllers — validation, auth, delegation
  lib/               # Utilities + infrastructure
    ai-client.ts     # Anthropic SDK singleton
    supabase/        # Supabase client factories + Database types
    rate-limit.ts    # In-memory rate limiter
    logger.ts        # Structured logging
    otter.ts         # Otter.ai API client
  components/        # React components grouped by feature
```

### Import Rules

- `models/types.ts` is **client-safe** — no `server-only`, pure type definitions
- `models/summaries.ts`, `models/otter.ts`, `services/summarize.ts` have `import 'server-only'`
- Client components import types via `import type { ... } from '@/models/types'`
- API routes delegate to model/service functions — no inline Supabase queries
- Supabase client is created in controllers and passed down to models

## Component Organization

Components are grouped by feature under `src/components/`:

```
src/components/
  auth/             # Authentication & session mode
    AuthProvider     # Supabase auth context (user, loading, signOut)
    AuthDialog       # Sign-in / sign-up modal
    AppModeProvider  # Guest vs app mode toggle
  generation/        # Transcript input & summary generation
    InputMethodPicker
    OtterLogin
    RecordingList
    ManualTranscript
    PasteTranscript
    ContextWizard
    SummaryModeSelector
    StreamingGenerationView
  summary/           # Summary display & editing
    SummaryView
    EditableMarkdown
  ui/                # Radix UI primitives (button, card, input, etc.)
  NavBar.tsx         # Cross-cutting — used by layout
  LandingPage.tsx    # Standalone — marketing / hero
  LoadingState.tsx   # Generic utility
```

### Dependency Graph (feature groups)

```
auth/ ← layout.tsx, NavBar, page.tsx, summary/SummaryView
generation/ ← page.tsx (main orchestrator)
summary/ ← page.tsx, summary/[id]/page.tsx, share/[token]/page.tsx
```

`summary/SummaryView` imports from `auth/` (AuthDialog, AuthProvider).
No other cross-group dependencies exist.

## Data Access Rules

| Layer                    | Pattern                                       | When to use                                                            |
| ------------------------ | --------------------------------------------- | ---------------------------------------------------------------------- |
| API route (controller)   | `fetch('/api/...')` from client components    | All mutations (create, update, delete). All AI calls.                  |
| Model functions (server) | `getSummaries()`, `saveSummary()`, etc.       | Server components and API routes. Accepts Supabase client as argument. |
| Direct Supabase (client) | `createClient()` from `@/lib/supabase/client` | Auth state only (`AuthProvider`). Never for data mutations.            |

**Rule:** Client components must never call Supabase directly for data operations. All data mutations go through API routes, which handle validation, rate limiting, auth checks, and ownership verification.

## API Routes

> See also: CLAUDE.md "API Routes" table (keep both in sync when adding routes).

| Route                   | Method | Purpose                                         | Auth                       | Rate limit |
| ----------------------- | ------ | ----------------------------------------------- | -------------------------- | ---------- |
| `/api/summarize`        | POST   | Generate summaries via Claude (SSE stream)      | Optional (saves if authed) | 10/hr      |
| `/api/summaries`        | GET    | List/search user's summaries                    | Required                   | 30/min     |
| `/api/summaries`        | POST   | Save a summary                                  | Required                   | —          |
| `/api/summaries/[id]`   | PATCH  | Update summary fields (title, content, sharing) | Required + ownership       | 30/min     |
| `/api/summaries/[id]`   | DELETE | Delete summary                                  | Required + ownership       | 30/min     |
| `/api/otter/login`      | POST   | Authenticate with Otter.ai                      | —                          | 5/min      |
| `/api/otter/recordings` | GET    | Fetch user's Otter recordings                   | —                          | —          |
| `/api/otter/recordings` | POST   | Get transcripts for selected recordings         | —                          | —          |
| `/api/otter/connection` | GET    | Get user's saved Otter connection               | Required                   | —          |
| `/api/otter/connection` | PUT    | Save/update Otter connection credentials        | Required                   | —          |
| `/api/otter/connection` | DELETE | Remove saved Otter connection                   | Required                   | —          |

## State Management

- **Auth state:** React context via `AuthProvider` (wraps Supabase `onAuthStateChange`)
- **App mode:** React context via `AppModeProvider` (guest vs authenticated flow)
- **Generation flow:** `useReducer` in `page.tsx` via `generationReducer` — manages the multi-step wizard state machine
- **Summary editing:** Local component state in `SummaryView` with debounced auto-save to API
- **Persistence:** Logged-in users save to Supabase; guests use `localStorage`

## Key Libraries

| Library                         | Purpose                                            |
| ------------------------------- | -------------------------------------------------- |
| `@anthropic-ai/sdk`             | Claude API for summary generation                  |
| `@supabase/ssr`                 | Server-side Supabase client with cookie-based auth |
| `zod`                           | Request validation on API routes                   |
| `sonner`                        | Toast notifications                                |
| `react-markdown` + `remark-gfm` | Markdown rendering with GFM tables                 |
| `lucide-react`                  | Icons                                              |
| `@sentry/nextjs`                | Error tracking (no-op without DSN)                 |
