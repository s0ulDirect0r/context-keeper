---
title: 'feat: Error Handling & Logging Overhaul'
type: feat
date: 2026-02-16
brainstorm: docs/brainstorms/2026-02-16-error-handling-logging-brainstorm.md
---

# Error Handling & Logging Overhaul

## Overview

Comprehensive error handling and observability overhaul across 5 pillars: toast notifications (Sonner), error boundaries/pages, Sentry wiring, structured logger with request IDs, and validation gap closure. Currently, 23 `console.error` calls silently swallow failures, Sentry is configured but captures nothing from client-side code, and there's no user-facing error feedback beyond one `alert()` call.

## Problem Statement

A user reported a bug that was nearly impossible to trace. The root cause: zero observability. Errors are logged to console and swallowed. Sentry is configured on all runtimes but client errors never reach it. Users see no feedback when operations fail — saves, shares, copies, and pearl generation all fail silently.

## Proposed Solution

Build from the bottom up: logger → toast system → error pages → Sentry wiring → sweep all call sites → close validation gaps.

---

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Root Layout (layout.tsx)                       │
│  ├── <Toaster /> (Sonner - persists across nav) │
│  ├── AuthProvider                               │
│  │   └── AppModeProvider                        │
│  │       └── NavBar + {children}                │
│  └── Error boundaries (error.tsx per route)      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Middleware (middleware.ts)                      │
│  └── Generate X-Request-Id UUID per request     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Logger (src/lib/logger.ts)                     │
│  ├── Levels: debug, info, warn, error           │
│  ├── Context: { requestId, route, userId, ... } │
│  ├── JSON output → Vercel log drain             │
│  └── error level → auto Sentry.captureException │
└─────────────────────────────────────────────────┘
```

### Error Classification

Every current `console.error` site classified into one of three buckets:

| Bucket             | Behavior                               | Examples                                                                   |
| ------------------ | -------------------------------------- | -------------------------------------------------------------------------- |
| **Toast + Sentry** | User sees toast, error sent to Sentry  | Save failures, delete failures, share toggle, copy failures                |
| **Sentry only**    | Silent to user, captured for debugging | Tag extraction fail, pearl extraction fail, SSE stream error (server-side) |
| **Toast only**     | User warned, not worth Sentry noise    | localStorage full, clipboard API unavailable                               |

---

## Implementation Phases

### Phase 1: Foundation — Logger + Request IDs + Sonner Setup

**Goal:** Build the two primitives everything else depends on.

**Files to create:**

#### `src/lib/logger.ts` (~60 lines)

```typescript
// Lightweight structured logger
// - Levels: debug, info, warn, error
// - Context object as second arg: logger.error('msg', { route, userId, requestId })
// - JSON output in production (Vercel log drain compatible)
// - Pretty output in development
// - error level auto-forwards to Sentry.captureException()
// - Safe serialization (handles circular refs, truncates large values)
// - No child loggers (pass context per-call)

import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

function log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Production: JSON for Vercel log drain
  // Development: pretty console output
  const output =
    process.env.NODE_ENV === 'production'
      ? JSON.stringify(entry, safeReplacer())
      : `[${level.toUpperCase()}] ${message} ${context ? JSON.stringify(context, safeReplacer(), 2) : ''}`;

  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](output);

  // Auto-forward errors to Sentry
  if (level === 'error') {
    const err = error || new Error(message);
    Sentry.captureException(err, {
      tags: { route: context?.route as string },
      extra: context,
    });
  }
}

// Safe JSON replacer: handles circular refs, truncates long strings
function safeReplacer() {
  /* ... */
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext, error?: Error) => log('error', msg, ctx, error),
};
```

#### `src/middleware.ts` (new or extend existing)

```typescript
// Generate X-Request-Id header for every request
// - UUID v4 per request
// - Passed through to API routes via headers
// - Returned in response headers for client-side correlation
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  return response;
}
```

#### Sonner install + layout mount

```bash
pnpm add sonner
```

**File to modify: `src/app/layout.tsx`**

- Add `import { Toaster } from 'sonner'`
- Mount `<Toaster />` as last child of `<body>`, after providers
- Configure: `richColors`, `position="top-right"`, `closeButton`

**Acceptance criteria:**

- [x] `logger.error()` outputs structured JSON in prod, pretty in dev
- [x] `logger.error()` auto-forwards to `Sentry.captureException()` with context
- [x] `safeReplacer()` handles circular references without throwing
- [x] Every request gets a unique `X-Request-Id` header (visible in response headers)
- [x] `<Toaster />` renders and `toast.error('test')` displays in dev
- [x] Sonner toasts persist across step transitions (wizard → generating → summary)

---

### Phase 2: Error Pages + Boundaries

**Goal:** Graceful degradation when things break. Safety net below the toast system.

**Files to create:**

#### `src/app/error.tsx`

```typescript
// Route-level error boundary
// - "Something went wrong" message with app styling
// - "Try again" button (calls reset())
// - "Go home" link
// - Captures error to Sentry with route context
// - Uses Tailwind classes consistent with existing design
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  // Render: heading, error.message (dev only), retry button, go-home link
}
```

#### `src/app/not-found.tsx`

```typescript
// Custom 404 page
// - "Page not found" message
// - Link to home page
// - Link to dashboard (if logged in)
// - Clean, consistent styling
```

#### `src/app/dashboard/error.tsx`

```typescript
// Dashboard-specific error boundary
// - Handles SSR failures (Supabase down, auth issues)
// - "Try again" re-runs server component
// - "Go home" link
```

**Files to modify:**

#### `src/app/global-error.tsx`

- Fix `statusCode={0}` → remove NextError, render custom styled error
- Add `<html>` and `<body>` with Tailwind classes and font variables
- Keep `Sentry.captureException(error)` call
- Add "Reload page" button and "Go home" link

#### `src/components/StreamingGenerationView.tsx`

- Add `error` prop (string | null)
- Add `onCancel` prop (callback)
- Add `onRetry` prop (callback)
- Show error state with message + retry button when error is set
- Show cancel button alongside loading spinner

**Acceptance criteria:**

- [x] Navigating to `/nonexistent` shows custom 404 page with home link
- [x] Throwing in a server component shows `error.tsx` with retry + go home
- [x] `global-error.tsx` renders styled content (not blank page)
- [x] StreamingGenerationView shows error state when generation fails
- [x] StreamingGenerationView shows cancel button during generation

---

### Phase 3: AbortController for SSE Generation

**Goal:** Users can cancel hung generations and there's a timeout safety net.

**Files to modify:**

#### `src/app/page.tsx`

- Create `AbortController` at generation start
- Store controller ref so cancel button can call `.abort()`
- Pass `signal` to `fetch('/api/summarize', { signal })`
- Add 120-second timeout: `setTimeout(() => controller.abort('timeout'), 120_000)`
- On abort: dispatch `GENERATION_FAILED` with appropriate message
  - User cancel: "Generation cancelled"
  - Timeout: "Generation timed out. Try a shorter transcript or try again."
- Clear timeout on successful completion
- Cancel previous generation if user starts a new one (prevents interleaved SSE)

#### `src/lib/generation-reducer.ts`

- Add `GENERATION_CANCELLED` action (or reuse `GENERATION_FAILED` with different messaging)
- On cancel: return to context-wizard step (user may want to adjust context)
- On timeout: stay on generating view with retry button

#### `src/components/StreamingGenerationView.tsx`

- Wire `onCancel` prop to abort controller

**Acceptance criteria:**

- [x] Cancel button aborts the SSE fetch and returns to context wizard
- [x] Generation auto-aborts after 120 seconds with timeout message
- [x] Starting a new generation cancels any in-progress generation
- [x] Timeout error shows retry button (stays on generating view)

---

### Phase 4: The Big Sweep — Replace All console.error + Add Toasts + Sentry Captures

**Goal:** Every error site gets the right treatment based on its classification.

This is the largest phase. Each file gets specific changes based on the error classification table.

#### Server-side files (logger.error + Sentry context)

**`src/app/api/summarize/route.ts`**

- Import logger, read `x-request-id` from headers
- Replace `console.error` at line ~155 (summary save fail): `logger.error('Summary save failed', { requestId, userId, error })`
- Replace `console.error` at line ~219 (edit save fail): same pattern
- Replace `console.error` at line ~227 (stream error): `logger.error('SSE stream error', { requestId, task, error })`
- Add `saveError: true` to SSE `complete` event when DB save fails (lines 155-158)
- Add `logger.info('Generation started', { requestId, userId, transcriptLength })` at handler start
- Add `logger.info('Generation complete', { requestId, userId, duration })` at end

**`src/app/api/summaries/route.ts`**

- Replace all 4 `console.error` calls with `logger.error()` + context
- Add requestId to all log calls

**`src/app/api/summaries/[id]/route.ts`**

- Replace 2 `console.error` calls with `logger.error()` + context

**`src/app/api/otter/login/route.ts`**

- Replace `console.error` with `logger.error('Otter login failed', { requestId, error })`

**`src/app/api/otter/recordings/route.ts`**

- Replace `console.error` calls with `logger.error()`
- Log partial transcript failures: `logger.warn('Transcript fetch failed for recording', { recordingId, requestId })`

**`src/app/api/tags/route.ts`**

- Replace `console.error` with `logger.error()`

**`src/app/api/pearls/route.ts`**

- Replace 3 `console.error` calls with `logger.error()`

**`src/app/api/pearls/generate/route.ts`**

- Replace `console.error` with `logger.error()`

**`src/lib/claude.ts`**

- `extractTags` catch (line ~276): `logger.error('Tag extraction failed', { transcriptLength, error })` — Sentry only, no toast (non-critical)
- `extractPearls` catch (line ~432): `logger.error('Pearl extraction failed', { transcriptLength, error })` — Sentry only, no toast

**`src/lib/otter.ts`**

- Replace `console.error` with `logger.error()` + context

#### Client-side files (toast + Sentry.captureException)

**`src/components/SummaryView.tsx`** (7 error sites)

- Line ~161 (save fail): `toast.error('Failed to save summary')` + `Sentry.captureException(err)`
- Line ~214 (edit save fail): `toast.error('Failed to save changes')` + `Sentry.captureException(err)`
- Line ~308 (title save fail): `toast.error('Failed to save title')` + `Sentry.captureException(err)`
- Line ~376 (regeneration fail): `toast.error('Regeneration failed')` + `Sentry.captureException(err)`
- Line ~398 (enable sharing fail): `toast.error('Failed to enable sharing')` + `Sentry.captureException(err)`
- Line ~413 (toggle sharing fail): `toast.error('Failed to update sharing')` + `Sentry.captureException(err)`
- Line ~277 (copy fail): `toast.error('Failed to copy to clipboard')` — toast only, no Sentry
- Add success toasts: `toast.success('Saved')` on successful save, `toast.success('Copied!')` on copy
- Handle `saveError` in SSE `complete` event: `toast.error('Summary generated but could not be saved. Try saving manually.')`

**`src/app/dashboard/DashboardClient.tsx`** (3 error sites)

- Line ~92 (search error): `toast.error('Search failed')` + `Sentry.captureException(err)`
- Line ~120 (load more error): `toast.error('Failed to load more summaries')` + `Sentry.captureException(err)`
- Line ~133: Replace `alert('Failed to delete summary')` → `toast.error('Failed to delete summary')` + `Sentry.captureException(err)`

**`src/app/page.tsx`** (2-3 error sites)

- Line ~287 (fetch recordings fail): `toast.error('Failed to fetch recordings')` + `Sentry.captureException(err)`
- Line ~419 (generation fail): toast based on error type:
  - Rate limit: `toast.error('Rate limit reached. Try again later.', { duration: Infinity })`
  - Other: `toast.error('Summary generation failed')`
- Line ~462 (SSE error event): `toast.error(message)` + `Sentry.captureException(new Error(message))`

**`src/components/OtterLogin.tsx`**

- Keep existing inline error display (it's the good example)
- Add `Sentry.captureException(err)` to catch block

#### Sentry breadcrumbs (add to key user actions)

**`src/app/page.tsx`**

- `Sentry.addBreadcrumb({ category: 'generation', message: 'Started summary generation' })`
- `Sentry.addBreadcrumb({ category: 'otter', message: 'Connected to Otter.ai' })`

**`src/components/SummaryView.tsx`**

- `Sentry.addBreadcrumb({ category: 'summary', message: 'Saved summary' })`
- `Sentry.addBreadcrumb({ category: 'sharing', message: 'Toggled sharing' })`

**Acceptance criteria:**

- [x] Zero `console.error` calls remain in the codebase (all replaced with `logger.error` or `toast.error` + Sentry)
- [x] Every user-facing failure shows a toast notification
- [x] Every error reaches Sentry with requestId and route context
- [x] Success toasts appear for: save, copy, Otter login
- [x] SSE save failure surfaces as toast via `saveError` flag in `complete` event
- [x] Rate limit errors show duration-based message with `duration: Infinity`
- [x] No duplicate toasts from debounce-save (use Sonner's `id` param)
- [x] Key user actions create Sentry breadcrumbs

---

### Phase 5: Validation Gaps — Zod + Rate Limiting

**Goal:** Close remaining security gaps on unprotected API routes.

**Files to modify:**

#### `src/app/api/tags/route.ts`

- Add Zod schema: `{ transcript: z.string().max(MAX_TRANSCRIPT_BYTES), context: z.object({ extractionGoal: z.string().min(1).max(1000) }) }`
- Add rate limiting: 30/hr per IP (per-category, independent from summarize's 10/hr)
- Replace manual truthiness check with `schema.safeParse(body)`
- Return `{ error, details }` on validation failure (consistent with other routes)
- Use `logger.error()` for failures

#### `src/app/api/pearls/generate/route.ts`

- Add Zod schema: `{ transcript: z.string().max(MAX_TRANSCRIPT_BYTES), summaryMarkdown: z.string().max(100_000), context: z.object({ ... }) }`
- Add rate limiting: 30/hr per IP
- Replace manual check with `schema.safeParse(body)`
- Use `logger.error()` for failures

#### `src/app/api/pearls/route.ts`

- Add Zod schema for pearl shape: `{ pearls: z.array(pearlSchema).min(1).max(50), summaryId: z.string().uuid() }`
- Validate pearl fields: insight max length, concept constraints, quote text limits
- Add rate limiting: 30/hr per IP
- Use `logger.error()` for failures

**Acceptance criteria:**

- [x] `POST /api/tags` rejects invalid input with 400 + Zod details
- [x] `POST /api/tags` returns 429 after 30 requests/hr
- [x] `POST /api/pearls/generate` rejects invalid input with 400 + Zod details
- [x] `POST /api/pearls/generate` returns 429 after 30 requests/hr
- [x] `POST /api/pearls` validates pearl shape and rejects oversized content
- [x] All three routes use `logger.error()` for failure logging

---

## Error Response Schema (Standardized)

All API routes should return errors in this shape:

```typescript
// Validation error
{ error: "Validation failed", details: string[], requestId: string }

// Rate limit error
{ error: "Rate limit exceeded", retryAfter: number, requestId: string }

// Auth error
{ error: "Authentication required", requestId: string }

// Server error
{ error: "Internal server error", requestId: string }
// (never expose internal error details to client)
```

The `requestId` field enables client-side Sentry correlation and future support-channel debugging.

---

## Files Changed Summary

| File                                         | Action                                           | Phase |
| -------------------------------------------- | ------------------------------------------------ | ----- |
| `src/lib/logger.ts`                          | **Create**                                       | 1     |
| `src/middleware.ts`                          | **Create**                                       | 1     |
| `src/app/layout.tsx`                         | Modify (add Toaster)                             | 1     |
| `src/app/error.tsx`                          | **Create**                                       | 2     |
| `src/app/not-found.tsx`                      | **Create**                                       | 2     |
| `src/app/dashboard/error.tsx`                | **Create**                                       | 2     |
| `src/app/global-error.tsx`                   | Modify (fix rendering)                           | 2     |
| `src/components/StreamingGenerationView.tsx` | Modify (error + cancel UI)                       | 2     |
| `src/app/page.tsx`                           | Modify (AbortController, toasts, Sentry, logger) | 3, 4  |
| `src/lib/generation-reducer.ts`              | Modify (cancel/timeout actions)                  | 3     |
| `src/app/api/summarize/route.ts`             | Modify (logger, saveError SSE)                   | 4     |
| `src/app/api/summaries/route.ts`             | Modify (logger)                                  | 4     |
| `src/app/api/summaries/[id]/route.ts`        | Modify (logger)                                  | 4     |
| `src/app/api/otter/login/route.ts`           | Modify (logger)                                  | 4     |
| `src/app/api/otter/recordings/route.ts`      | Modify (logger)                                  | 4     |
| `src/app/api/tags/route.ts`                  | Modify (logger, Zod, rate limit)                 | 4, 5  |
| `src/app/api/pearls/route.ts`                | Modify (logger, Zod, rate limit)                 | 4, 5  |
| `src/app/api/pearls/generate/route.ts`       | Modify (logger, Zod, rate limit)                 | 4, 5  |
| `src/lib/claude.ts`                          | Modify (logger)                                  | 4     |
| `src/lib/otter.ts`                           | Modify (logger)                                  | 4     |
| `src/components/SummaryView.tsx`             | Modify (toasts, Sentry)                          | 4     |
| `src/app/dashboard/DashboardClient.tsx`      | Modify (toasts, Sentry)                          | 4     |
| `src/components/OtterLogin.tsx`              | Modify (Sentry capture)                          | 4     |
| `package.json`                               | Modify (add sonner)                              | 1     |

**New files: 5** | **Modified files: 19** | **Total: 24**

---

## Dependencies & Prerequisites

- Sonner package (`pnpm add sonner`)
- Existing Sentry configuration (already in place)
- Existing rate-limit.ts utility (reuse for new routes)
- Existing Zod patterns (reuse from summarize/login routes)

## Risk Analysis

| Risk                                       | Likelihood | Mitigation                                                                                                       |
| ------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Logger breaks in edge runtime              | Medium     | Test that `@sentry/nextjs` import works in middleware. If not, generate request ID without logger in middleware. |
| Sonner SSR hydration mismatch              | Low        | Mount `<Toaster />` with `suppressHydrationWarning` or dynamic import with `ssr: false`                          |
| Sentry auto-forward creates noise          | Medium     | Only forward `error` level. Review Sentry dashboard after deploy.                                                |
| Rate limit shared state lost on cold start | Known      | Already accepted (in-memory limiter). Upgrade to Upstash if this matters.                                        |
| Middleware adds latency                    | Low        | UUID generation is <1ms. Middleware matcher can exclude static assets.                                           |

## Success Metrics

- Zero `console.error` calls remaining in codebase
- Every user-facing failure shows a toast notification
- Every error has a request ID in Sentry
- All API routes have rate limiting and input validation
- Custom error pages for 404 and server errors

## References

- **Brainstorm:** `docs/brainstorms/2026-02-16-error-handling-logging-brainstorm.md`
- **VTT silent failure patterns:** `docs/solutions/logic-errors/silent-failure-vtt-upload.md`
- **Existing rate limiter:** `src/lib/rate-limit.ts`
- **Existing Zod patterns:** `src/app/api/summarize/route.ts`, `src/app/api/otter/login/route.ts`
- **Sentry config:** `sentry.server.config.ts`, `sentry.client.config.ts`
