# Editing & Sharing Bugs — Brainstorm

**Date:** 2026-02-16
**Trigger:** User report from James Baker — edits not persisting to share links, "Save as New" broken, format changes unexpectedly.

## What's Broken

Three bugs, all interconnected:

### Bug 1: "Save as New" is fundamentally broken

`handleRegenerate('new')` in SummaryView.tsx calls `response.json()` on `/api/summarize`, but that endpoint returns SSE streams (`text/event-stream`), not JSON. The call silently fails. James sees stale data because regeneration never actually completes.

**Files:** `src/components/SummaryView.tsx:290-301`, `src/app/api/summarize/route.ts:236-242`

### Bug 2: Share page serves stale data

The share page (`/share/[token]/page.tsx`) has no cache control directives. After edits persist via the 800ms debounce, the share URL can still serve cached old content.

**Files:** `src/app/share/[token]/page.tsx:18-23`

### Bug 3: Edits lost on navigation

If the user navigates away within 800ms of an edit, the debounce timer gets cleared on unmount and the edit is never saved to the database.

**Files:** `src/components/SummaryView.tsx:189-211`

### Bonus: Format changes on regeneration

Regeneration guesses `combined` vs `separate` mode from output count (`summaries.length > 1`) instead of preserving the original mode. This causes unexpected format switches.

**Files:** `src/components/SummaryView.tsx:296`

## Why Can't We Reproduce

- Bug 1 fails silently (no error toast, no console error visible to non-dev)
- Bug 2 is timing-dependent (cache behavior varies by environment, CDN state)
- Bug 3 requires navigating away quickly after editing (natural user behavior, not natural test behavior)

## Key Decisions

### 1. Inline edits and regeneration stay separate

- Inline edits = human refinement of AI output
- Regeneration = ask the AI to try again
- Different intent, different UX, different code paths

### 2. Share links are always live

- Share link is a window into the current state of the summary
- Edits should appear on the share link after saving
- No "frozen snapshot" or "publish" step — keep it simple

### 3. Auto-save with visible state indicator

- Keep the auto-save debounce pattern
- Add a visible "Saving..." / "Saved" / "Error" indicator (Google Docs model)
- Flush pending saves on blur/navigation to prevent data loss (fixes Bug 3)

### 4. Fix regeneration SSE parsing

- Make `handleRegenerate` properly consume the SSE stream, consistent with initial generation
- Preserve original summary mode in the regeneration request (fixes format change)

## What We're Building

### Fix 1: Share page cache busting

Add `export const dynamic = 'force-dynamic'` to the share page to ensure fresh data on every request. Minimal change, immediate impact.

### Fix 2: Save state indicator

Add a visual indicator to SummaryView showing save state:

- "Saving..." during debounce/fetch
- "All changes saved" after successful PATCH
- "Failed to save" with retry on error
  This gives users confidence their edits persisted.

### Fix 3: Flush saves on navigation/blur

- Call `persistSavedEdits.flush()` (or equivalent) on `beforeunload` and route change
- Ensures edits aren't lost when navigating away quickly

### Fix 4: Fix regeneration SSE consumption

- Refactor `handleRegenerate` to use the same SSE consumption pattern as initial summary generation
- Store and pass original `summaryMode` to preserve formatting

## Open Questions

1. **Debounce timing** — 800ms feels long. Should we reduce to 300-500ms? Lower = faster persistence, higher = fewer network requests.
2. **Error recovery** — If a save fails, should we retry automatically? Queue failed saves?
3. **Regeneration UX** — When "Save as New" works, where does the user land? New summary page? Same page with updated content?

## Not Doing (YAGNI)

- Version history / undo — not needed yet, adds significant complexity
- Optimistic UI for share page — server-rendered is fine if cache is busted
- Real-time collaboration — single-user editing is the use case
- Separate regeneration API endpoint — reuse existing SSE pattern instead
