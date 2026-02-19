---
title: 'refactor: Migrate to MVC + Service Layer architecture'
type: refactor
date: 2026-02-19
brainstorm: docs/brainstorms/2026-02-18-architecture-mvc-service-layer-brainstorm.md
---

# Migrate to MVC + Service Layer Architecture

## Overview

Extract business logic from monolithic API routes and `lib/claude.ts` into a layered architecture: Controllers (thin API routes) / Services (AI operations + orchestration) / Models (domain types + data access). Simultaneously remove dead features (tags, pearls) that add complexity and API cost without user-facing value.

## Problem Statement

Context Keeper's business logic is tangled in API routes and a 589-line monolith (`lib/claude.ts`). The `/api/summarize` route alone is 311 lines mixing validation, auth, AI streaming, parallel extraction, DB persistence, and SSE encoding. There's no way for a future Cedar agent to call the same logic without going through HTTP. Domain types live in a server-only module (`claude.ts`), making client component imports fragile.

Additionally, tags and pearls are dead features — disabled in the UI, not displayed to users, yet the tag extraction pipeline runs on every summary generation (wasting a Claude API call per generation). The codebase carries ~300 lines of tag/pearl prompt engineering, extraction logic, API routes, and DB operations for features that are not in use.

## Proposed Solution

Two interleaved changes: (1) remove dead code (tags/pearls), (2) extract remaining business logic into layers.

```
src/
  services/           ← AI operations + orchestration
    summarize.ts      ← generateSummary(), streamAndPersist()
    prompts/          ← prompt constants + factory
      summary.ts
      shared.ts       ← DIRECT_QUOTES_SECTION, TITLE_SECTION
  models/             ← domain types + data access
    types.ts          ← SummaryContext, GeneratedSummary, etc.
    summaries.ts      ← saveSummary(), getSummaries(), searchSummaries()
    notes.ts          ← saveNote(), getNotes(), updateNote(), deleteNote()
    otter.ts          ← getConnection(), saveConnection(), deleteConnection()
```

`lib/claude.ts` gets deleted. Summary generation logic moves to `services/summarize.ts`. Domain types merge into `models/types.ts`. Tag/pearl code, routes, and DB tables are removed.

## Technical Considerations

### Import Path Migration

15+ files import types from `@/lib/claude`. After migration, they import from `@/models/types`. This is a mechanical find-and-replace but must be done atomically per phase to keep the build green.

**Client component safety:** Types like `SummaryContext` must stay in `models/types.ts` (which has zero server-only imports). The Anthropic SDK import (`@anthropic-ai/sdk`) only appears in service files, never in models or types.

**Server-only firewall:** Add `import 'server-only'` to every file in `src/models/` and `src/services/` _except_ `models/types.ts`. This creates a compile-time firewall — if a client component accidentally imports from a model/service file (not just types), Next.js will fail the build immediately rather than silently shipping server code to the browser. The `models/types.ts` file must remain pure type definitions with zero runtime imports.

### SSE Streaming Boundary

The SSE `ReadableStream` construction currently lives inside `/api/summarize/route.ts`. With tags removed, the streaming pipeline simplifies dramatically — no more parallel tag extraction interleaved with summary streaming.

**Decision: Service uses callbacks.** The `streamAndPersistSummary()` service function accepts callbacks: `{ onSummaryChunk, onSummaryDone, onError }`. The route wires these to its SSE `send()` helper. This keeps SSE encoding (HTTP concern) in the controller while the service owns the generation pipeline. Cedar agent could use the same function with different callbacks.

### Supabase Client Creation

Every route currently calls `createClient()` inline. The service/model layer needs a Supabase client too.

**Decision: Pass the client down.** Controller creates the client, passes to service/model functions. This keeps the auth context (cookies/headers) consistent and avoids multiple client instantiations per request.

### Anthropic Client Singleton

`claude.ts` creates a singleton `const client = new Anthropic()` at module scope, shared by all AI functions.

**Decision: Extract to `src/lib/ai-client.ts`.** A 3-line file exporting the initialized Anthropic client. Service files import from it.

### Duplicated Logic to Consolidate

- `deriveTitle()` — identical in `/api/summarize/route.ts:60` and `/api/summaries/route.ts:36` → moves to `models/summaries.ts`. The summarize route's title-override step (Claude-extracted title replaces derived title) stays in `services/summarize.ts`.
- Summary save — three variants consolidate into `models/summaries.saveSummary()` which accepts `{ userId, title, summaries, context, transcripts }` and internally computes `search_text`.
- `stripBlockquoteQuotes()` → moves to `services/summarize.ts` (text transform is part of the generation pipeline)

### Dead Feature Removal (Tags & Pearls)

Tags and pearls are disabled in the UI and not displayed to users. Removing them:

**Code to delete:**

- `extractTags()` function and `TAG_EXTRACTION_PROMPT`, `TAG_EXTRACTION_TOOL` from `claude.ts`
- `extractPearls()`, `normalizePearl()`, `PEARL_EXTRACTION_PROMPT`, `PEARL_EXTRACTION_TOOL` from `claude.ts`
- `Pearl`, `ThemeQuote`, `ConceptTag`, `SpeakerIdentity` types from `claude.ts`
- `/api/tags/route.ts` — entire route
- `/api/pearls/route.ts` — entire route (save curated pearls)
- `/api/pearls/generate/route.ts` — entire route (generate pearls)
- `PearlsSidebar.tsx` component
- `TagSelector.tsx` component
- Parallel tag extraction in `/api/summarize/route.ts` (lines 142-148, SSE events `tags_extracting`, `tags_done`)

**DB changes:**

- [ ] Migration to drop `pearls` table
- [ ] Remove `selected_tags` column from `summaries` table (used for pearl generation)

**Client-side cleanup:**

- Remove tag/pearl-related state from `generation-reducer.ts`
- Remove tag/pearl SSE event handlers from summary generation flow
- Remove pearl/tag imports from `SummaryView.tsx` and other components

**Impact:** Saves one Claude API call per generation. Simplifies the summarize route by ~50 lines. Removes ~300 lines of prompt engineering and extraction code from `claude.ts`.

## Implementation Phases

### Phase 0: Remove dead features (tags & pearls)

Strip out all tag and pearl code before extracting into layers. This simplifies everything downstream.

**Files to delete:**

- [ ] `src/app/api/tags/route.ts`
- [ ] `src/app/api/pearls/route.ts`
- [ ] `src/app/api/pearls/generate/route.ts`
- [ ] `src/components/summary/PearlsSidebar.tsx`
- [ ] `src/components/summary/TagSelector.tsx`

**Files to update:**

- [ ] `src/app/api/summarize/route.ts` — Remove parallel tag extraction (`extractTags` call, `tags_extracting`/`tags_done` SSE events, `tagPromise`, `resolvedTags`). Remove `selected_tags` from save. Remove `tags` from `complete` event.
- [ ] `src/lib/claude.ts` — Remove `extractTags()`, `extractPearls()`, `normalizePearl()`, tag/pearl prompt constants, tool definitions, and types (`Pearl`, `ThemeQuote`, `ConceptTag`, `SpeakerIdentity`)
- [ ] `src/lib/supabase/types.ts` — Remove `SavedPearl`, `toSavedPearl()`, pearl-related DB types
- [ ] `src/components/summary/SummaryView.tsx` — Remove pearl/tag imports and rendering
- [ ] `src/lib/generation-reducer.ts` — Remove tag/pearl state and actions
- [ ] Client components importing `Pearl`, `ConceptTag`, `ThemeQuote` — remove imports

**DB migration:**

- [ ] `supabase/migrations/YYYYMMDD_remove_pearls_and_tags.sql` — Drop `pearls` table, remove `selected_tags` column from summaries

**E2E tests:**

- [ ] Update tests that reference tags/pearls SSE events or UI elements

**Verification:** `pnpm build` succeeds. E2E tests pass (with updates). No tag/pearl imports remain anywhere.

### Phase 1: Models — Extract domain types and data access

Create `src/models/` with types and query functions. Keep `lib/claude.ts` intact (now smaller after Phase 0) — just re-export types from the new location so existing imports still work during transition.

**Files to create:**

- [ ] `src/models/types.ts` — Move `SummaryContext`, `SummaryMetadata`, `GeneratedSummary` from `lib/claude.ts`. Merge in `SummaryContent`, `StructuredSummary`, etc. from `lib/summary-types.ts`. Move `SavedSummary`, `SavedVaultItem` and their mappers from `lib/supabase/types.ts`.
- [ ] `src/models/summaries.ts` — `import 'server-only'`. `saveSummary()`, `getSummaries()`, `getSummaryById()`, `updateSummary()`, `deleteSummary()`, `searchSummaries()`, `deriveTitle()`, `buildSearchText()` (absorbs `lib/search-text.ts`)
- [ ] `src/models/notes.ts` — `import 'server-only'`. `saveNote()`, `getNotes()`, `updateNote()`, `deleteNote()` (maps to `notes` table, renamed from `vault_items` on the notes sidebar branch)
- [ ] `src/models/otter.ts` — `import 'server-only'`. `getOtterConnection()`, `saveOtterConnection()`, `deleteOtterConnection()`

**Files to update:**

- [ ] `lib/claude.ts` — Re-export types from `models/types.ts` for backwards compatibility
- [ ] `lib/summary-types.ts` — Re-export from `models/types.ts`
- [ ] `lib/supabase/types.ts` — Keep `Database` interface, `Json` type. Move domain types + mappers to `models/types.ts`

**Verification:** `pnpm build` succeeds with zero type errors. All existing tests pass. No behavior change.

### Phase 2: Services — Extract AI operations from claude.ts

Create `src/services/` with the summarization service. After Phase 0 removed tags/pearls, the only AI operation left is summary generation.

**Files to create:**

- [ ] `src/lib/ai-client.ts` — Anthropic client singleton (`new Anthropic()`), imported by service files
- [ ] `src/services/prompts/shared.ts` — `DIRECT_QUOTES_SECTION`, `TITLE_SECTION`, `STREAMING_SUFFIX`
- [ ] `src/services/prompts/summary.ts` — `SUMMARY_SYSTEM_PROMPT`, `STRUCTURED_SUMMARY_SYSTEM_PROMPT`, `CUSTOM_SUMMARY_SYSTEM_PROMPT`, `SUMMARY_TOOL`, `getSystemPrompt()`, `buildUserMessage()`
- [ ] `src/services/summarize.ts` — `import 'server-only'`. `generateSummary()`, `summarizeSingle()`, `streamSummarySingle()`, `stripBlockquoteQuotes()` (from `claude.ts` + `summarize/route.ts`). Also `streamAndPersistSummary()` — the orchestration function that combines streaming, title extraction, and persistence (much simpler now without tag interleaving).

**Files to update:**

- [ ] `lib/claude.ts` — Reduce to re-exports from services for backwards compat
- [ ] All routes importing from `lib/claude` — Switch to `services/` imports for functions, `models/types` for types

**Verification:** `pnpm build` succeeds. All existing tests pass. No behavior change.

### Phase 3: Controllers — Thin down API routes

Now that Services and Models exist, rewrite route handlers to be thin controllers.

**Files to update:**

- [ ] `src/app/api/summarize/route.ts` — The big win. From 311 → ~40 lines. Validate → auth → call `streamAndPersistSummary()` → return Response
- [ ] `src/app/api/summaries/route.ts` — GET calls `models/summaries.getSummaries()`. POST calls `models/summaries.saveSummary()`
- [ ] `src/app/api/summaries/[id]/route.ts` — PATCH/DELETE call model functions directly
- [ ] `src/app/api/notes/route.ts` — GET/POST call `models/notes` functions
- [ ] `src/app/api/notes/[id]/route.ts` — PATCH/DELETE call `models/notes` functions
- [ ] `src/app/api/otter/connection/route.ts` — GET/PUT/DELETE call model functions

**Routes that are already thin (no change needed):**

- `src/app/api/otter/login/route.ts` — Already delegates to `lib/otter.ts`
- `src/app/api/otter/recordings/route.ts` — Already delegates to `lib/otter.ts`

**Verification:** All E2E tests pass. API contracts unchanged.

### Phase 4: Cleanup

- [ ] Delete `lib/claude.ts` (all re-exports should now point to services/models)
- [ ] Delete `lib/summary-types.ts` (merged into `models/types.ts`)
- [ ] Delete `lib/search-text.ts` (absorbed into `models/summaries.ts`)
- [ ] Update `lib/supabase/types.ts` — Remove domain types and mappers that moved to `models/types.ts`. Keep only `Database`, `Json`, and Supabase client utilities
- [ ] Update all remaining import paths across components and pages
- [ ] Update `ARCHITECTURE.md` to reflect the new layer structure
- [ ] Update `CLAUDE.md` project instructions to describe the new architecture

**Verification:** `pnpm build` clean. All E2E tests pass. `git diff --stat` confirms no untracked old files.

## Acceptance Criteria

### Functional

- [ ] All existing E2E tests pass (with updates for removed tag/pearl features)
- [ ] API contracts unchanged for remaining endpoints (same request/response shapes, same SSE events minus `tags_extracting`/`tags_done`)
- [ ] No import from `@/lib/claude` remains anywhere in the codebase
- [ ] No inline Supabase queries remain in API route handlers (except auth `getUser()` which is controller-layer)
- [ ] All domain types importable from `@/models/types` without pulling in server-only dependencies
- [ ] No tag or pearl code remains anywhere in the codebase
- [ ] `pearls` table dropped, `selected_tags` column removed from summaries

### Structural

- [ ] `src/services/` exists with AI operation functions
- [ ] `src/models/` exists with domain types and data access functions
- [ ] No API route handler exceeds ~60 lines
- [ ] `ARCHITECTURE.md` accurately describes the new layer structure

### Non-regression

- [ ] `pnpm build` succeeds with zero warnings
- [ ] `pnpm exec playwright test` all green
- [ ] CI pipeline (type-check + lint + build + E2E) passes

## Dependencies & Risks

**Dependency: `feat/notes-sidebar` should merge first.** The notes sidebar branch should rename `vault_items` → `notes` table and `/api/vault/` → `/api/notes/` routes before this refactor begins. This way `models/notes.ts` maps cleanly to the `notes` table. Without this, the refactor would create `models/notes.ts` wrapping a `vault_items` table — a naming mismatch.

**Low risk:** This is a pure internal refactor + dead code removal. No new dependencies. Every phase keeps the build green.

**Risk: Import path breakage.** 15+ files import from `lib/claude.ts`. Mitigated by Phase 1 using re-exports for backwards compatibility, then migrating imports in Phase 2-3.

**Risk: SSE streaming regression.** The `/api/summarize` streaming logic is complex and only partially tested. The E2E test mocks the SSE response entirely. Mitigated by: keeping the streaming logic intact (just moving it to `services/summarize.ts`), not rewriting it. Removing tag interleaving actually _reduces_ streaming complexity.

**Risk: Client bundle bloat.** If `models/types.ts` accidentally imports from a service file (which imports the Anthropic SDK), the server-only SDK leaks into the client bundle. Mitigated by: keeping `models/types.ts` as pure type definitions with zero runtime imports, and adding `import 'server-only'` to all model/service files except `models/types.ts`.

**Risk: Tag/pearl removal breaks client.** Components may reference tag/pearl state or UI elements. Mitigated by: doing removal as Phase 0 (first) so all downstream phases work with the simplified codebase.

## References

- **Brainstorm:** `docs/brainstorms/2026-02-18-architecture-mvc-service-layer-brainstorm.md`
- **Error handling patterns:** `docs/solutions/runtime-errors/pr-31-error-handling-logging-overhaul.md`
- **Prompt patterns:** `docs/institutional-learnings/prompt-patterns-reference.md`
- **Code deduplication:** `docs/solutions/logic-errors/prompt-deduplication-and-next-js-navigation-patterns.md`
- **Agent-native principles:** https://every.to/guides/agent-native (validates atomic service design)
- Current route complexity: `/api/summarize/route.ts` (311 lines), `lib/claude.ts` (589 lines)
