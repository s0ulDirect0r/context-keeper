# Architecture: MVC + Service Layer — Brainstorm

> Date: 2026-02-18
> Status: Decision made
> Origin: Conversation about system design legibility, context engineering for AI agents, and establishing a coherent architectural theory for Context Keeper

---

## What We're Building

An architectural theory for Context Keeper that provides:

- **Clarity** — every new piece of code has an obvious home
- **Reusability** — the same business logic serves the web UI, Cedar agent, and future surfaces
- **Legibility** — an agent (or human) picking up the codebase cold can understand the system from the structure alone

**The architecture: MVC + Service Layer** — the most widely-used production architecture, adapted for an AI-native Next.js application.

---

## Why This Approach

### The Problem

Context Keeper's code is clean in isolation, but has no unifying design principle. API routes mix validation, auth, AI calls, DB persistence, and streaming in single 300+ line functions. The AI processing logic — the core differentiator — has no dedicated home. It's split between `lib/claude.ts` (prompts) and API routes (orchestration).

This matters because:

1. The product is evolving toward an agent (Cedar sidebar) that needs the same business logic the web UI uses
2. AI agents working in the codebase can't infer the architecture from the structure — they need docs to compensate
3. New features don't have a "where does this go?" answer

### Why MVC + Service Layer

Context Keeper isn't a CRUD app. The core business logic isn't data access — it's **AI operations** (summarization, tag extraction, pearl extraction, future briefings). Standard MVC doesn't have a home for this. The Service layer provides one.

This is not novel or exotic — MVC + Service layer is arguably the most common architecture in production software. We're choosing an established pattern with decades of proven use, not inventing something custom.

### First Principles Applied

Four principles guided this decision:

1. **Separation of Concerns** — Group things that change for the same reason. Prompts change for AI strategy reasons. DB queries change for data model reasons. Request handling changes for API reasons. Different reasons → different layers.

2. **Dependency Direction** — Dependencies point toward stability. Domain types (rarely change) ← Services (change when capabilities change) ← Controllers/Views (change when UI/API changes).

3. **Boundaries** — Each layer is a boundary that limits blast radius. Changing a prompt doesn't affect request handling. Changing the DB schema doesn't affect the UI.

4. **Cohesion** — Things that change together live together. The Claude prompt + response parser + streaming logic for summarization all live in one Service function, not spread across `lib/claude.ts` and `app/api/summarize/route.ts`.

---

## The Four Layers

### Controllers (`src/app/api/`)

**What they do:** Handle HTTP requests. Validate input, check auth, call a Service, return a response.

**What they know about:** `Request`/`Response` objects, Zod schemas, rate limiting, auth checks.

**What they don't know about:** How summaries are generated, how the database is structured, what Claude's API looks like.

**Target size:** ~30 lines per route handler. Thin wiring.

### Views (`src/components/`)

**What they do:** Render UI. Display data, handle user interactions, call Services or fetch from Controllers.

**Already organized by feature:** `auth/`, `generation/`, `summary/`, `ui/`.

**Future addition:** `agent/` for Cedar sidebar — another View surface calling the same Services.

### Services (`src/services/`)

**What they do:** The actual work. Business logic, AI operations, orchestration.

**What they know about:** Domain concepts, Models (for data access), external AI APIs.

**What they don't know about:** HTTP, React, request/response objects.

**This is where Context Keeper's core value lives:**

| Service                | Purpose                                      | Consumes                             |
| ---------------------- | -------------------------------------------- | ------------------------------------ |
| `summarize.ts`         | Generate a summary from transcript + context | Models (save), Claude API (generate) |
| `extract-tags.ts`      | Extract concept tags from content            | Claude API                           |
| `extract-pearls.ts`    | Extract pearls from content for given tags   | Models (save), Claude API            |
| `prompts/`             | Prompt templates and construction logic      | Domain types                         |
| `briefing.ts` (future) | Generate cross-session briefing              | Models (query), Claude API           |
| `context.ts` (future)  | Build context injection for Cedar            | Models (aggregate)                   |

**The key insight:** When Cedar agent needs to generate a summary, it calls `services/summarize.ts` — the same function the API route uses. The business logic lives in one place.

### Models (`src/models/`)

**What they do:** Define domain types and data access. Query and persist data.

**What they know about:** Database structure (via Supabase), domain invariants.

**What they don't know about:** Why you're asking for data, what happens after.

| Model                  | Purpose                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `types.ts`             | Summary, Pearl, Tag, Note — domain type definitions                        |
| `summaries.ts`         | `getSummaries()`, `saveSummary()`, `searchSummaries()`, `getSummaryById()` |
| `pearls.ts`            | `savePearls()`, `getPearlsBySummary()`, `getPearlsByTag()`                 |
| `tags.ts`              | `saveTags()`, `getTagsForUser()`                                           |
| `notes.ts`             | `saveNote()`, `getUserNotes()`                                             |
| `speakers.ts` (future) | `getSpeakerHistory()` — aggregated from pearls                             |

### Infrastructure (`src/lib/`)

**What it does:** External service wiring. Supabase client, rate limiter, logger, Otter API client.

**Stays mostly as-is.** The current `src/lib/` is already infrastructure. The main change is that `claude.ts` gets broken up — prompts move to `services/prompts/`, orchestration moves to individual service functions, and only the raw Claude API client helper (if needed) stays in `lib/`.

---

## Before / After

### Before (current)

```
src/app/api/summarize/route.ts     ←── 311 lines: validation + auth +
                                        AI streaming + tag extraction +
                                        title parsing + DB persistence +
                                        SSE encoding + error handling

src/lib/claude.ts                  ←── 590 lines: all prompts + all AI
                                        call logic in one file

src/lib/supabase/                  ←── client setup only, no query
                                        functions (queries inline in routes)
```

### After (MVC + Service)

```
src/app/api/summarize/route.ts     ←── ~30 lines: validate → call
                                        summarize service → stream result

src/services/summarize.ts          ←── generateSummary() — prompt
                                        construction, Claude streaming,
                                        parallel tag extraction, title
                                        parsing, persistence via Models

src/services/prompts/summary.ts    ←── summary prompt template

src/models/summaries.ts            ←── saveSummary(), getSummaries()
```

---

## Dependency Direction

```
Controllers ──→ Services ──→ Models ──→ Infrastructure
Views ────────→ Services ──→ Models ──→ Infrastructure
[Cedar Agent] → Services ──→ Models ──→ Infrastructure
```

All arrows point right. Never left.

Controllers can also call Models directly for simple CRUD (listing summaries, deleting a note) that doesn't need AI processing.

---

## Where Does New Code Go?

| "I need to..."              | Layer                   | Example                     |
| --------------------------- | ----------------------- | --------------------------- |
| Handle an HTTP request      | Controller (`app/api/`) | New API endpoint            |
| Display something in the UI | View (`components/`)    | New React component         |
| Make the AI do something    | Service (`services/`)   | Briefing generation         |
| Query or persist data       | Model (`models/`)       | Speaker history aggregation |
| Connect to an external API  | Infrastructure (`lib/`) | New transcript source       |
| Add a Cedar agent tool      | View (`agent/`)         | `search_meetings` tool      |

The agent tools are just another View surface — they call the same Services and Models as the web UI.

---

## Key Decisions Made

1. **MVC + Service Layer, not Hexagonal.** Hexagonal adds formal ports/adapters ceremony that doesn't pay off at this scale. Standard MVC + Service layer gives the same benefits with less indirection.

2. **Standard naming.** Controllers, Views, Services, Models, Infrastructure. No custom vocabulary. Any developer (human or AI) recognizes these immediately.

3. **Services own AI operations.** The Service layer is where Context Keeper's differentiator lives. Prompts, streaming, extraction logic — all in Services. This is the main departure from vanilla MVC.

4. **Models are data access, not just types.** Models own both the TypeScript types AND the query/persistence functions. No more inline Supabase calls in API routes.

5. **Incremental adoption.** This doesn't require a big-bang refactor. Extract one route at a time, starting with the most complex (`/api/summarize`).

---

## Open Questions

1. **State management layer?** The `generation-reducer.ts` is currently in `lib/`. It's not a Model, Service, or Controller. Likely stays in `lib/` as application state infrastructure, or moves to a `state/` directory.

2. **Shared validation schemas?** Zod schemas are currently defined inline in routes. Should they move to Models (near the types they validate) or stay in Controllers (near the routes that use them)?

3. **SSE streaming ownership.** Is the SSE encoding (ReadableStream construction, event formatting) a Controller concern (transport) or a Service concern (it's part of the generation pipeline)? Likely: Service returns a ReadableStream, Controller just pipes it to the Response.

---

## Relation to Product Direction

This architecture directly supports the Cedar agent roadmap:

- **Phase 1 (context-aware generation):** `services/context.ts` builds context injection by calling Model query functions. Used by the Controller (for the wizard) and later by the agent.

- **Phase 2 (Cedar sidebar):** Agent tools like `search_meetings`, `get_speaker_history` call Model functions directly. Agent intelligence operations (briefing, prep briefs) call Services. The sidebar UI is a View.

- **Future (MCP/external API):** MCP tool handlers are just another Controller layer — thin wiring that calls the same Services.

Each phase adds a new surface in the Controller/View layer. Services and Models stay the same.

---

## Next Step

Run `/workflows:plan` to create a concrete migration plan. Key planning questions:

1. Which route to extract first (recommend `/api/summarize` — biggest win)
2. How to split `claude.ts` into service functions + prompt templates
3. What Model functions to extract from inline route code
4. Testing strategy for the extracted Services (unit-testable without HTTP)
