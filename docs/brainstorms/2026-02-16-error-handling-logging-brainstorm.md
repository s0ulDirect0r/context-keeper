# Error Handling & Logging Overhaul

**Date:** 2026-02-16
**Status:** Brainstorm complete
**Motivation:** No visibility into production errors, silent failures throughout, no user-facing error UX

---

## What We're Building

A comprehensive error handling and logging system across four pillars:

1. **Toast notification system** (Sonner) — consistent, non-intrusive error/success feedback for users
2. **Error boundaries + error pages** — graceful degradation when things break (error.tsx, not-found.tsx, global-error.tsx)
3. **Sentry wiring** — actually capture client-side errors, add domain context, stop relying on global handler alone
4. **Structured logger** — lightweight wrapper around console.\* with levels, context fields, and auto Sentry forwarding

---

## Why This Approach

### Sonner for toasts

- Lightweight, great defaults, popular in Next.js ecosystem
- Replaces the lone `alert()` in DashboardClient and fills the gap where 7+ error states are silently logged
- Minimal setup: `<Toaster />` in layout, `toast.error()` at call sites

### Lightweight logger over Pino

- Vercel already captures console.\* output and makes it searchable via Runtime Logs
- Log drain support means structured JSON gets picked up by Datadog/Axiom/etc. with zero infra
- ~50 lines of code, zero deps, same API shape as Pino for future migration
- Pino's value (structured JSON → aggregator) is redundant on Vercel

### Fix Sentry, don't replace it

- Sentry is already configured on server/client/edge — it's just not being used at call sites
- Client-side fetch errors in SummaryView, DashboardClient never reach Sentry
- Pearl save failures (API route) only go to console.error
- Fix = add `Sentry.captureException()` in catch blocks + add domain context via tags/breadcrumbs

### Functional error pages

- Clean, helpful error UX consistent with existing design
- Retry buttons, clear messaging, navigation back to safety
- Not over-designed — functional and clean

---

## Key Decisions

| Decision          | Choice                       | Rationale                                                                       |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| Toast library     | Sonner                       | Lightweight, great DX, Next.js App Router compatible                            |
| Logging approach  | Lightweight wrapper + Sentry | Zero deps, Vercel log drain handles aggregation                                 |
| Error page polish | Functional + clean           | Helpful UX without over-designing                                               |
| Scope             | Full sweep tonight           | All four pillars — user-facing + observability                                  |
| Request IDs       | Yes                          | Per-request UUID in all logs + error responses. Low cost, real debugging value. |
| Child loggers     | No (for now)                 | Pass context per-call. Routes are short. Easy to add later.                     |
| Zod + rate limits | Yes, include                 | Already touching these files; closes remaining security gaps                    |

---

## Scope of Work

### Pillar 1: Toast System (Sonner)

- Install Sonner
- Add `<Toaster />` to root layout
- Replace `alert()` in DashboardClient with `toast.error()`
- Add toast feedback to: SummaryView save operations, tag operations, pearl generation, recording fetches
- Add success toasts for: summary save, pearl save, Otter login

### Pillar 2: Error Boundaries + Pages

- Create `src/app/error.tsx` — route-level error boundary with retry + go home
- Create `src/app/not-found.tsx` — custom 404 with helpful navigation
- Improve `src/app/global-error.tsx` — fix statusCode=0, add recovery UX
- Add error state UI to StreamingGenerationView (currently only has loading spinner)

### Pillar 3: Sentry Wiring

- Add `Sentry.captureException()` in client-side catch blocks (SummaryView, DashboardClient)
- Add `Sentry.captureException()` for pearl save failures in API routes
- Add Sentry context: user ID, route, operation type as tags
- Add breadcrumbs for key user actions (start generation, save summary, connect Otter)

### Pillar 4: Structured Logger + Request IDs

- Create `src/lib/logger.ts` — levels (debug/info/warn/error), context fields, JSON output
- Auto-forward error level to `Sentry.captureException()`
- Generate per-request UUID at API route entry, include in all logs and error responses
- Replace all 23 `console.error` calls across the codebase with `logger.error()` + context
- Add info-level logging for key operations (summary generation start/complete, Otter auth, save)

### Pillar 5: Validation Gaps

- Add Zod validation to `/api/tags` and `/api/pearls/generate`
- Add rate limiting to `/api/pearls` and `/api/pearls/generate`

---

## Current State (Audit Findings)

### What exists

- API routes have try-catch + Zod validation on key routes
- Sentry configured on all three runtimes (server/client/edge)
- SSE error propagation works in summarize route
- OtterLogin has inline error display (the one good example)
- Global error boundary exists but shows blank page

### What's broken

- **23 console.error calls** with no structure, no context
- **0 toast notifications** — 1 browser `alert()`, everything else silent
- **0 error boundaries** at route level
- **Sentry is a shell** — configured but client errors don't reach it
- **Silent failures:** pearl saves, tag extraction, SummaryView operations
- **Missing pages:** no error.tsx, no not-found.tsx, auth-code-error referenced but doesn't exist
- **Missing validation:** /api/tags and /api/pearls/generate lack Zod
- **Missing rate limits:** /api/pearls and /api/pearls/generate unprotected

---

## Resolved Questions

- **Zod + rate limiting on unprotected routes?** → Yes, include it. Already touching these files.
- **Request ID system?** → Yes. Real user reported a bug that was hard to trace — exactly the problem request IDs solve. Low implementation cost.
- **Child loggers?** → No. Pass context per-call. Routes are short (1-3 log calls). Add later if needed.

---

## Next Step

Run `/workflows:plan` to create the implementation plan.
