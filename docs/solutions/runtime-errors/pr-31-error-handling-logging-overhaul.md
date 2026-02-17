---
title: 'Error Handling & Logging Overhaul: Structured Observability and User Feedback'
date: 2026-02-17
category: runtime-errors
tags:
  - error-handling
  - logging
  - observability
  - sentry
  - user-feedback
  - validation
  - rate-limiting
  - abort-controller
  - toast-notifications
severity: high
component:
  - src/lib/logger.ts
  - src/middleware.ts
  - src/app/error.tsx
  - src/app/not-found.tsx
  - src/app/global-error.tsx
  - src/components/StreamingGenerationView.tsx
  - src/app/page.tsx
  - src/app/api/* (all routes)
symptom: |
  Codebase had zero observability: 23 console.error calls swallowed failures silently,
  Sentry was configured but client-side errors never reached it, users received no feedback
  when operations failed (summary saves, pearl generation, recording fetches all failed silently),
  and there was only one alert() call for error UX with no error boundaries or custom error pages.
  API routes lacked input validation and rate limiting on tags and pearls endpoints, making debugging
  production issues nearly impossible and leaving the application vulnerable to abuse.
---

# PR #31: Error Handling & Logging Overhaul

PR #31 (`feat/error-handling-logging`) implements a 5-phase bottom-up overhaul of error handling, logging, and user feedback across the entire codebase. 7 commits, 28 files changed, ~1,291 insertions.

## The Problem

Before this PR, the codebase had **zero user-facing error feedback** and poor observability:

| Problem                                                   | Impact                                                   |
| --------------------------------------------------------- | -------------------------------------------------------- |
| 23 `console.error` calls scattered across codebase        | Errors swallowed silently; no tracing                    |
| Sentry configured but client-side errors never reached it | Blind to production failures                             |
| No user notifications on failure                          | Saves, deletes, copies, generation — all failed silently |
| No error boundaries or custom error pages                 | Blank page on crash; default Next.js 404                 |
| No generation timeout or cancellation                     | SSE streams could hang indefinitely                      |
| Validation gaps on tags/pearls routes                     | Vulnerable to abuse; no rate limiting                    |

**Concrete impact:** A user reported a bug that was nearly impossible to trace — errors went to console only, no correlation IDs, no observability into partial failures.

## Solution Architecture

```
Client: Toast Notifications (Sonner)
  - User-facing feedback for all errors
        |
Error Boundaries (error.tsx, global-error.tsx)
  - Catches uncaught exceptions
  - Graceful fallback UI + Sentry capture
        |
Logger (src/lib/logger.ts)
  - Structured JSON in production
  - Auto-forwards errors to Sentry
  - Request context (requestId, userId, route)
        |
Request IDs (middleware.ts)
  - Unique UUID per request
  - End-to-end correlation
        |
Generation Control (AbortController)
  - User cancellation + 120s timeout
  - Prevents hung streams
```

## The 5 Phases

### Phase 1: Foundation — Logger + Request IDs + Sonner

Built the infrastructure everything else depends on.

**Structured logger** (`src/lib/logger.ts`, ~86 lines):

- 4 levels: debug, info, warn, error
- JSON output in production (Vercel log drain compatible), pretty in dev
- `logger.error()` auto-forwards to Sentry with route tags and context
- Safe serialization (circular refs, truncation)

**Request ID tracing** (`src/middleware.ts`):

- UUID generated per request via `crypto.randomUUID()`
- Injected into request headers, attached to response headers
- Available to all API routes via `request.headers.get('x-request-id')`

**Toast system** (Sonner):

- `<Toaster />` mounted in root layout
- Non-intrusive, dismissible, persistent across navigation
- Deduplication via toast IDs for rapid operations

### Phase 2: Error Pages & Boundaries

- `src/app/error.tsx` — Route-level error boundary with retry + go-home
- `src/app/not-found.tsx` — Custom 404 page
- `src/app/global-error.tsx` — App-level crash page (inline styles, renders outside layout)
- `src/app/dashboard/error.tsx` — Dashboard-specific error boundary
- `StreamingGenerationView` — Error/cancel/timeout UI during generation

### Phase 3: AbortController for Generation

```typescript
const controller = new AbortController();
abortControllerRef.current = controller;

// 120-second timeout safety net
generationTimeoutRef.current = setTimeout(() => {
  controller.abort('timeout');
}, 120_000);

const response = await fetch('/api/summarize', {
  signal: controller.signal,
  // ...
});
```

- Cancel button aborts SSE fetch mid-stream
- 120s timeout with automatic abort
- Distinguishes user cancellation (`'user_cancel'`) from timeout (`'timeout'`) via `signal.reason`
- Cleanup on unmount prevents stale dispatches

### Phase 4: The Big Sweep — Replace All console.error

Every error classified into one of three buckets:

| Classification | Behavior                               | Example                                  |
| -------------- | -------------------------------------- | ---------------------------------------- |
| Toast + Sentry | User sees toast; error sent to Sentry  | Save failures, delete failures           |
| Sentry only    | Silent to user; captured for debugging | Tag extraction fail, SSE stream error    |
| Toast only     | User warned; not worth Sentry noise    | localStorage full, clipboard unavailable |

**Result:** 23 `console.error` calls → 0. All replaced with `logger.error()`, `toast.error()`, `Sentry.captureException()`, or combinations.

### Phase 5: Validation Gaps Closed

- Zod validation on `/api/tags`, `/api/pearls`, `/api/pearls/generate`
- Rate limiting (30/hr) on all three routes
- Standardized error response format with `requestId`

## Key Decisions

### Custom Logger Over Pino

~90 lines with built-in Sentry integration. Edge runtime compatible, zero config, no external deps. The app is simple enough that this is a strength.

### Sonner for Toasts

Persists across navigation (critical for wizard → generating → summary flow). Rich API with deduplication, promise support, stacking.

### AbortController Pattern

Standard Web API, automatic cleanup through fetch signal chain. Abort reason stored in `signal.reason` to distinguish timeout from user cancel — enables different UI responses.

### Atomic Generation Reducer Actions

`GENERATION_FAILED` action sets both step and error atomically, preventing race conditions where step clears before error is set. `stayOnGenerating` flag keeps user on generating view for timeouts (retry button) vs navigating away for cancellations.

### Error Classification Framework

Classifying errors upfront into toast/Sentry/both prevents toast spam and Sentry noise. Each new error site requires a conscious decision about user impact.

## Post-Review Fixes (commit bd5a7c3)

8 automated review agents identified 7 additional issues:

1. **Middleware `setAll` drops `x-request-id`** — Cookie refresh recreated response with bare `request`, losing injected headers. Fixed: pass `{ headers: requestHeaders }`.
2. **No unmount cleanup** — Timeout/abort controller leaked on navigation. Fixed: cleanup `useEffect`.
3. **Error message leakage** — 5 routes forwarded raw `error.message` to clients (CWE-209). Fixed: generic strings.
4. **SSE race condition** — `complete` event dispatched before `AbortError` catch. Fixed: abort signal guard in `handleSSEEvent`.
5. **"Go back" no-op after timeout** — `cancelGeneration()` was no-op when refs already nulled. Fixed: also dispatch `SET_STEP`.
6. **Double error display** — Top-level banner + StreamingGenerationView both showed error. Fixed: step check on banner.
7. **global-error.tsx unstyled** — Tailwind classes don't apply outside layout. Fixed: inline styles.

## Verification

- Build passes (TypeScript, ESLint clean)
- 18/18 Playwright E2E tests pass
- 7 commits from `0786cd0` (foundation) to `bd5a7c3` (review fixes)

## Best Practices Going Forward

### New API Route Checklist

```typescript
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  // 1. Rate limit (before any processing)
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter, requestId },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // 2. Validate input (Zod)
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message), requestId },
      { status: 400 },
    );
  }

  // 3. Process
  try {
    const result = await doWork(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    // 4. Log full error server-side, return generic message to client
    logger.error('Operation failed', { requestId, route: '/api/path' }, error);
    return NextResponse.json({ error: 'Failed to complete operation', requestId }, { status: 500 });
  }
}
```

### Client-Side Error Handling

- **Always** use `toast.error()` for user-facing failures
- **Always** use `Sentry.captureException()` for unexpected errors
- **Never** expose `error.message` from API responses to users
- **Always** check `response.ok` before processing fetch results
- **Always** add cleanup `useEffect` when using timers or AbortController
- **Always** guard SSE event handlers with `signal.aborted` check

### Logger Usage

| Level            | When                                                 | Sentry?    |
| ---------------- | ---------------------------------------------------- | ---------- |
| `logger.debug()` | Development diagnostics                              | No         |
| `logger.info()`  | Successful checkpoints (generation started/complete) | No         |
| `logger.warn()`  | Degraded but recoverable behavior                    | No         |
| `logger.error()` | Failures requiring investigation                     | Yes (auto) |

### Common Mistakes

1. **Exposing internals:** `{ error: error.message }` → use generic string
2. **Logging without context:** `logger.error('Failed')` → include requestId, route, userId
3. **Validating after processing:** Check Zod before auth/DB queries
4. **Toast spam:** Use `{ id: 'unique-key' }` to deduplicate
5. **Silent swallowing:** Every catch needs toast, Sentry, or both — never empty

## Related

- [Error handling overhaul plan](../../plans/2026-02-16-feat-error-handling-logging-overhaul-plan.md)
- [Error handling brainstorm](../../brainstorms/2026-02-16-error-handling-logging-brainstorm.md)
- [Review findings plan](../../plans/2026-02-17-fix-review-findings.md)
- [VTT upload silent failure](../logic-errors/silent-failure-vtt-upload.md) — established root-cause pattern analysis
- [AUDIT.md](../../AUDIT.md) — Full product audit that motivated this work
- [PR #31](https://github.com/s0ulDirect0r/context-keeper/pull/31) — The PR itself
- [PR #6](https://github.com/s0ulDirect0r/context-keeper/pull/6) — Original security hardening (rate limiting, CSP, Sentry config)
