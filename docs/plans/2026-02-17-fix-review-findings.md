---
title: 'fix: Address PR #31 code review findings'
type: fix
date: 2026-02-17
pr: 31
branch: feat/error-handling-logging
---

# Fix PR #31 Code Review Findings

8 review agents analyzed PR #31. This document captures the actionable fixes, prioritized for implementation.

## Before Merge (P1 + high-impact P2)

### 1. Middleware `setAll` drops `x-request-id` (P1 — 4/8 agents flagged)

**File:** `src/middleware.ts`, line 29

When Supabase refreshes session cookies, `setAll` recreates the response using bare `request` instead of `{ headers: requestHeaders }`, losing the injected request ID.

**Fix:** Change line 29 from:

```typescript
supabaseResponse = NextResponse.next({ request });
```

to:

```typescript
supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
```

### 2. No abort/timeout cleanup on unmount (P1)

**File:** `src/app/page.tsx`, after the ref declarations (~line 114)

If user navigates away mid-generation, timeout keeps ticking and dispatch fires on unmounted component. Burns Claude API credits.

**Fix:** Add cleanup useEffect:

```typescript
useEffect(() => {
  return () => {
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      generationTimeoutRef.current = null;
    }
    abortControllerRef.current?.abort('unmount');
    abortControllerRef.current = null;
  };
}, []);
```

### 3. Error message leakage to clients (P1 — 3/8 agents flagged)

Several older routes forward raw `error.message` to client responses. Should return generic messages.

**Files to fix (replace `error.message` forwarding with generic string):**

- `src/app/api/summarize/route.ts` ~line 265: SSE error event sends `err.message`. Change to `'Failed to generate summary'`
- `src/app/api/summaries/route.ts` ~lines 113, 208: Replace `error.message` with `'Failed to process request'`
- `src/app/api/summaries/[id]/route.ts` ~line 117: Replace `error.message` with `'Failed to update summary'`
- `src/app/api/otter/login/route.ts` ~line 52: Replace `error.message` with `'Login failed'`
- `src/app/api/otter/recordings/route.ts` ~lines 39, 69, 87: Replace `error.message` with generic strings

### 4. Race: SSE `complete` dispatched before AbortError catch (P2)

**File:** `src/app/page.tsx`, in `handleSSEEvent` function

Cancel can cause summary to flash briefly then vanish.

**Fix:** Add at the top of `handleSSEEvent`:

```typescript
if (abortControllerRef.current?.signal.aborted) return;
```

### 5. "Go back" from error state does nothing (P2)

**File:** `src/app/page.tsx`, where StreamingGenerationView's `onCancel` is wired

After timeout, `cancelGeneration()` is a no-op (refs already nulled). Need to also navigate away.

**Fix:** Change the `onCancel` prop to:

```typescript
onCancel={() => {
  cancelGeneration();
  dispatch({ type: 'SET_STEP', step: 'context-wizard' });
}}
```

### 6. Double error display on timeout (P2)

**File:** `src/app/page.tsx`, the top-level error banner (~line 580)

Error shows in both top-level banner AND StreamingGenerationView.

**Fix:** Add step check:

```typescript
{state.error && state.step !== 'generating' && (
```

### 7. `global-error.tsx` Tailwind classes won't apply (P2)

**File:** `src/app/global-error.tsx`

Renders outside layout, so `globals.css` isn't loaded. Tailwind classes produce no styling.

**Fix:** Replace Tailwind classes with inline `style` attributes for the ~5 elements.

## Follow-up PR (P2 consistency + P3)

These can be a separate PR after merge:

- [ ] Standardize `requestId` extraction: all routes should use `const requestId = request.headers.get('x-request-id') ?? 'unknown'` at top
- [ ] Add `requestId` to all error response bodies (5 older route files)
- [ ] Standardize rate limit messages to `"Rate limit exceeded"` with `retryAfter` and `requestId`
- [ ] Extract shared `MAX_TRANSCRIPT_BYTES` constant to `src/lib/constants.ts`
- [ ] Extract shared context Zod schema (used in 4 routes)
- [ ] Extract `deriveTitle()` to shared utility
- [ ] Add `.max()` bounds to `selectedTags` (`.max(50)`) and `userName` (`.max(200)`) in pearl Zod schemas
- [ ] Simplify `safeReplacer()` to try/catch around `JSON.stringify` (YAGNI)
- [ ] Rename `MAX_DEPTH` to `MAX_STACK_FRAMES`
- [ ] Fix `Error | unknown` type annotations to just `unknown`
- [ ] Add doc comment to `logger.error` warning against double Sentry capture
- [ ] Normalize `Response.json` to `NextResponse.json` in `summarize/route.ts`

## How to Execute

```bash
# Start fresh session on the branch
git checkout feat/error-handling-logging

# Run: /workflows:work docs/plans/2026-02-17-fix-review-findings.md
# Focus on "Before Merge" section only
# Commit as: fix: address code review findings for PR #31
# Then force-push to update PR #31
```
