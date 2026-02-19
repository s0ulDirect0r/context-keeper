---
title: 'MVC + Service Layer architecture extraction'
date: 2026-02-19
category: architecture
tags:
  [
    mvc,
    service-layer,
    next-js,
    separation-of-concerns,
    supabase,
    sse-streaming,
    strangler-fig,
    code-review,
  ]
components: [api-routes, models, services, prompts, auth, database-migrations]
severity: structural
pr: 39
---

# MVC + Service Layer Architecture Extraction

A phased refactor that introduced explicit architectural layers (Models, Services, Controllers) into a Next.js 16 app, reducing a 589-line monolith to a clean separation of concerns. Net result: **-904 lines** across 40 files while adding more structure.

## Problem Statement

The codebase had no unifying design principle. API routes mixed validation, auth, AI calls, DB persistence, and streaming in single 300+ line functions. `lib/claude.ts` was 589 lines mixing prompts, types, AI orchestration, and extraction logic. New code had no obvious home.

The deeper motivation: an AI agent (Cedar sidebar) needed the same summarization logic the web UI uses, but all business logic was entangled in HTTP request handlers. The only way to call `generateSummary` was through `/api/summarize`.

## The Migration Pattern: Strangler Fig in 6 Phases

Each commit kept the build green and all E2E tests passing. Re-export shims in the old file locations let consumers keep importing from old paths during the transition.

| Phase | Commit    | What                                                              |
| ----- | --------- | ----------------------------------------------------------------- |
| 0     | `f18c25e` | Remove dead features (tags/pearls) — simplify before extracting   |
| 1     | `9e6c0f8` | Extract models layer (types + data access), leave re-export shims |
| 2     | `0b84f89` | Extract services layer (AI operations + prompts)                  |
| 3     | `51e88f7` | Thin controllers — wire API routes to models/services             |
| 4     | `e13436f` | Delete all shim files, migrate every import                       |
| 5     | `08ad84d` | Address 15 code review findings (P1/P2/P3)                        |

**Key sequencing insight:** Removing dead features first (Phase 0) was a force multiplier. It eliminated a parallel tag extraction pipeline interleaved with SSE streaming, 3 API routes, 3 components, and ~300 lines of prompt engineering. The remaining code was dramatically simpler to extract into layers.

## Architectural Patterns Established

### Layer Structure

```
src/
  models/            # Domain types + data access (Supabase queries)
    types.ts         # Client-safe — NO server-only, pure type definitions
    summaries.ts     # import 'server-only' — Summary CRUD, row mapping
    otter.ts         # import 'server-only' — Otter connection CRUD
  services/          # Business logic + AI operations
    summarize.ts     # import 'server-only' — Generation pipeline
    prompts/         # Prompt templates
  app/api/           # Thin controllers — validation, auth, delegation
  lib/               # Utilities + infrastructure
    auth.ts          # import 'server-only' — requireAuth() helper
```

### The `server-only` Firewall

Every file in `models/` and `services/` starts with `import 'server-only'` — **except** `models/types.ts`. This creates a compile-time firewall: if a client component accidentally imports from a model or service file, Next.js fails the build immediately.

`models/types.ts` must remain pure type definitions with zero runtime imports. Client components safely import types via `import type { ... } from '@/models/types'`.

### Supabase Client Threading

Controllers create the Supabase client (which carries auth context from cookies/headers) and pass it to model/service functions. Every model function signature takes `supabase: SupabaseClient<Database>` as its first parameter.

The `requireAuth()` helper bundles this:

```typescript
// src/lib/auth.ts
export async function requireAuth(): Promise<{ supabase; user } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

// In routes:
const auth = await requireAuth();
if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
const result = await getSummaries(auth.supabase, auth.user.id, { q, limit, offset });
```

### Typed Error Returns

Model functions return `{ data, error }` with string literal error types instead of throwing. Controllers switch on these to return appropriate HTTP status codes.

```typescript
// Model
export async function deleteSummary(supabase, summaryId, userId)
  : Promise<{ error: 'not_found' | 'delete_failed' | null }>

// Controller
const result = await deleteSummary(auth.supabase, id, auth.user.id);
if (result.error === 'not_found') return NextResponse.json(..., { status: 404 });
if (result.error === 'delete_failed') return NextResponse.json(..., { status: 500 });
```

### SSE Streaming via Callbacks

The service owns the generation pipeline but doesn't know about HTTP. The route wires callbacks to SSE transport:

```typescript
// Service accepts callbacks
export async function streamAndPersistSummary(params, callbacks: {
  onSummaryChunk?: (text: string) => void;
  onSummaryDone: (summaries: string[]) => void;
  onComplete: (result) => void;
  onError: (error) => void;
}): Promise<void>

// Controller wires to SSE
const send = (event, data) =>
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
await streamAndPersistSummary(params, {
  onSummaryChunk: (text) => send('summary_chunk', { text }),
  onSummaryDone: (summaries) => send('summary_done', { summaries }),
  ...
});
```

A future Cedar agent can call the same function with WebSocket callbacks instead of SSE.

### snake_case / camelCase Boundary

Rule: snake_case exists only inside model files (Supabase column names). Model function parameters and return types use camelCase. Controllers map at the boundary:

```typescript
// Controller maps API snake_case to model camelCase
const { is_shared, ...rest } = parsed.data;
const result = await updateSummary(auth.supabase, id, auth.user.id, {
  ...rest,
  isShared: is_shared,
});
```

## Pitfalls and Lessons

### 1. Remove dead code before extracting

Killing tags/pearls before the layer extraction eliminated an entire parallel pipeline and simplified everything downstream. Don't extract messy code into layers — clean it first.

### 2. ILIKE inputs must be escaped

User search input interpolated into `.ilike('title', '%${query}%')` is vulnerable to wildcard injection. The fix:

```typescript
function escapeIlike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}
```

### 3. Don't SELECT \* on tables with large columns

`getSummaries()` was fetching multi-hundred-KB transcript blobs for every row in the listing. Define explicit column lists:

```typescript
const LISTING_COLUMNS =
  'id, user_id, title, summaries, context, share_token, is_shared, created_at, updated_at' as const;
```

### 4. Decide the error pattern before you start

`otter.ts` was throwing while `summaries.ts` returned typed errors. This inconsistency was caught in review but should have been established in Phase 1.

### 5. Use single-query patterns over fetch-then-mutate

`deleteSummary` was doing SELECT (verify ownership) then DELETE. A single `DELETE WHERE id = X AND user_id = Y` with `{ count: 'exact' }` is simpler and RLS provides defense-in-depth.

### 6. Explicit upsert conflicts

Always pass `{ onConflict: 'column_name' }` to `.upsert()`. Don't rely on implicit conflict detection.

### 7. Next.js SSR serializes Date objects to strings

`SavedSummary.createdAt: Date` gets JSON-serialized to a string when passed as server component props. Client components actually receive strings, not Date objects. Either keep dates as strings in the domain type or deserialize at the client boundary.

### 8. Unexport internal helpers

If a function is only used within the same file (`buildSearchText`, `stripBlockquoteQuotes`, `generateSummary`, `streamSummarySingle`), don't export it. Smaller public API surface = fewer things to break.

## Refactoring Checklist

### Before Starting

- [ ] Identify all files importing from modules being moved
- [ ] Plan phased re-export strategy if >10 consumers
- [ ] Decide naming convention boundary (where snake_case stops)
- [ ] Decide error return pattern (typed unions, not thrown exceptions)
- [ ] Remove dead features first to simplify extraction

### Per Phase

- [ ] Add `import 'server-only'` to every new server-side file
- [ ] Verify `models/types.ts` has zero runtime imports
- [ ] `pnpm build` clean with zero type errors
- [ ] `pnpm exec playwright test` all green
- [ ] No snake_case in model function signatures
- [ ] No `select('*')` on tables with large columns
- [ ] All `upsert()` calls have explicit `onConflict`
- [ ] All ILIKE inputs are escaped

### When Deleting Shims

- [ ] `grep -r` for every import path being removed — zero hits required
- [ ] Delete shims and update all consumer imports in the same commit
- [ ] Full build + tests after deletion
- [ ] Search for stale copy referencing removed features

## Cross-References

- **Brainstorm:** `docs/brainstorms/2026-02-18-architecture-mvc-service-layer-brainstorm.md`
- **Migration plan:** `docs/plans/2026-02-19-refactor-mvc-service-layer-migration-plan.md`
- **Strategic motivation (Cedar agent):** `docs/brainstorms/2026-02-17-agent-native-cedar-brainstorm.md`
- **Prerequisite PR #38:** Feature group components + ARCHITECTURE.md creation
- **Error handling patterns:** `docs/solutions/runtime-errors/pr-31-error-handling-logging-overhaul.md`
- **Prompt deduplication:** `docs/solutions/logic-errors/prompt-deduplication-and-next-js-navigation-patterns.md`
- **Architecture reference:** `ARCHITECTURE.md` (updated by PR #39)
- **PR #39:** https://github.com/s0ulDirect0r/context-keeper/pull/39
