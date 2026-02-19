# Architecture

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
  summary/           # Summary display, editing & pearls
    SummaryView
    EditableMarkdown
    PearlsSidebar
    PearlsGeneratingView
    TagSelector
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
| API route                | `fetch('/api/...')` from client components    | All mutations (create, update, delete). All AI calls.                  |
| Direct Supabase (server) | `createClient()` from `@/lib/supabase/server` | Server components loading data for SSR (e.g. `summary/[id]/page.tsx`). |
| Direct Supabase (client) | `createClient()` from `@/lib/supabase/client` | Auth state only (`AuthProvider`). Never for data mutations.            |

**Rule:** Client components must never call Supabase directly for data operations. All data mutations go through API routes, which handle validation, rate limiting, auth checks, and ownership verification.

## API Routes

| Route                   | Method | Purpose                                         | Auth                       | Rate limit |
| ----------------------- | ------ | ----------------------------------------------- | -------------------------- | ---------- |
| `/api/summarize`        | POST   | Generate summaries via Claude (SSE stream)      | Optional (saves if authed) | 10/hr      |
| `/api/summaries`        | GET    | List/search user's summaries                    | Required                   | —          |
| `/api/summaries`        | POST   | Save a summary                                  | Required                   | —          |
| `/api/summaries/[id]`   | PATCH  | Update summary fields (title, content, sharing) | Required + ownership       | —          |
| `/api/summaries/[id]`   | DELETE | Delete summary and associated data              | Required + ownership       | —          |
| `/api/pearls`           | POST   | Save curated pearls for a summary               | Required                   | —          |
| `/api/pearls/generate`  | POST   | Generate pearls via Claude for selected tags    | Required                   | —          |
| `/api/tags`             | POST   | Extract concept tags from summary content       | Required                   | —          |
| `/api/otter/login`      | POST   | Authenticate with Otter.ai                      | —                          | 5/min      |
| `/api/otter/recordings` | GET    | Fetch user's Otter recordings                   | —                          | —          |
| `/api/otter/recordings` | POST   | Get transcripts for selected recordings         | —                          | —          |

## State Management

- **Auth state:** React context via `AuthProvider` (wraps Supabase `onAuthStateChange`)
- **App mode:** React context via `AppModeProvider` (guest vs authenticated flow)
- **Generation flow:** `useReducer` in `page.tsx` via `generationReducer` — manages the multi-step wizard state machine
- **Summary editing:** Local component state in `SummaryView` with debounced auto-save to API
- **Persistence:** Logged-in users save to Supabase; guests use `localStorage`

## Key Libraries

| Library                         | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `@anthropic-ai/sdk`             | Claude API for summary generation and theme extraction |
| `@supabase/ssr`                 | Server-side Supabase client with cookie-based auth     |
| `zod`                           | Request validation on API routes                       |
| `sonner`                        | Toast notifications                                    |
| `react-markdown` + `remark-gfm` | Markdown rendering with GFM tables                     |
| `lucide-react`                  | Icons                                                  |
| `@sentry/nextjs`                | Error tracking (no-op without DSN)                     |
