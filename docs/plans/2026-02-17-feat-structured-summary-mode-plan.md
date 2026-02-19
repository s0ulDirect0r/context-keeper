---
title: 'feat: Add Structured Summary Mode'
type: feat
date: 2026-02-17
---

# feat: Add Structured Summary Mode

## Overview

Add a "Structured" summary mode alongside the existing free-form summaries. When selected, summaries follow a specific format driven by GitHub issues #19–#22 and #24: Meeting Orientation, Central Questions (with direct quotes + status labels), Breakout Rooms (if applicable), and Cedar's Meta-View (collapsible). The structured format is prompt-driven — output is still plain markdown streamed via the existing SSE pipeline.

## Problem Statement / Motivation

The PM has defined a clear vision for summary output (GitHub issues #19–#24) that is significantly more structured than the current free-form approach. The current prompt tells Claude "there is no fixed template" — the new structured mode gives Claude an explicit format with sections, quote-attribution rules, status labels on questions, and a relational dynamics analysis. This demo branch lets the PM test the structured format with real transcripts.

## Proposed Solution

**Prompt-first with minimal UI.** The summary format is almost entirely prompt-controlled (`SUMMARY_SYSTEM_PROMPT` in `claude.ts`). A new `STRUCTURED_SUMMARY_SYSTEM_PROMPT` implements the format from the GitHub issues. A RadioGroup toggle in ContextWizard lets the user choose between "Standard" and "Structured". The choice flows through the existing pipeline: `SummaryContext` → API route → prompt selection → streaming markdown → rendering. Cedar's Meta-View is rendered in a collapsible section via client-side heading detection in `EditableMarkdown`.

## Technical Approach

### Key Architectural Decisions

| Decision                         | Choice                                                              | Rationale                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where to store `summaryStyle`    | Add to `SummaryContext` type                                        | Flows through entire pipeline automatically, persists in DB `context` JSONB column, available for regeneration                                                                  |
| Output format                    | Plain markdown (`string[]`)                                         | No new structured type needed. Existing editing, copy, export all work unchanged. Sidesteps dead `StructuredSummary` type.                                                      |
| Collapsible Cedar section        | Client-side heading detection in `EditableMarkdown` render          | Raw markdown stays clean for editing. `<details>` is a render-time wrapper, not stored in markdown. No `rehype-raw` needed.                                                     |
| Missing sections                 | Prompt omits them silently                                          | Consistent with free-form approach. No "N/A" filler.                                                                                                                            |
| Streaming behavior               | Unchanged                                                           | New prompt produces differently-structured markdown, same SSE pipeline. Cedar section visible during streaming, collapses after stream completes when `SummaryView` takes over. |
| Separate mode (multi-transcript) | Each transcript gets its own structured summary + Cedar's Meta-View | Consistent with independent processing in `Promise.all`                                                                                                                         |
| Post-generation style toggle     | Not supported (MVP)                                                 | Switching styles requires regeneration. Reasonable for demo.                                                                                                                    |
| Cedar section in copy/export     | Included and expanded                                               | Paste targets (email, Slack) don't support `<details>`                                                                                                                          |

### Implementation Phases

#### Phase 1: Data Pipeline (`SummaryContext` → API → Prompt)

**Files:**

- `src/lib/claude.ts:75-78` — Add `summaryStyle?: 'standard' | 'structured'` to `SummaryContext`
- `src/lib/claude.ts` (new) — Create `STRUCTURED_SUMMARY_SYSTEM_PROMPT` (~80-120 lines)
- `src/lib/claude.ts` (new) — Create `STRUCTURED_STREAMING_SUMMARY_SYSTEM_PROMPT` (base + heading instruction)
- `src/lib/claude.ts:184-198` — Update `streamSummarySingle()` to accept and branch on `summaryStyle`
- `src/lib/claude.ts:62-150` — Update `summarizeSingle()` similarly for non-streaming path
- `src/app/api/summarize/route.ts:16-29` — Add `summaryStyle: z.enum(['standard', 'structured']).optional()` to Zod schema
- `src/app/api/summarize/route.ts` — Pass `summaryStyle` through to `streamSummarySingle()` and `generateSummary()`

**The structured prompt** implements:

1. **Meeting Orientation (#19, #24)** — Date/time, stated goal vs. actual focus, divergence detection (heuristic: <1/3 of discussion on stated goal = diverged)
2. **Central Questions (#20)** — Each question as `### heading`, speaker attribution, direct quotes under participant names, status labels: **Resolved**, **Explored**, **Surfaced**. Emergent questions in separate `## Emergent Questions` section.
3. **Breakout Rooms (#21)** — Only if detected. Share-back quotes from reporters. Explicit notes for missing content.
4. **Cedar's Meta-View (#22)** — Under `## Cedar's Read on the Room` heading. Relational dynamics analysis. Warm/observational/curious tone. Hard boundaries: no individual evaluation, no prescriptions, hedging language.

**Quote handling rules** (from #20): Pull actual words, lightly clean fillers, preserve hedging/uncertainty, use `[…]` for long excerpts. Never paraphrase or merge quotes.

**Section omission**: Prompt instructs Claude to skip sections that don't apply (e.g., no breakout rooms = no Breakout Rooms section). Only Meeting Orientation and Central Questions are always present.

#### Phase 2: UI Toggle in ContextWizard

**Files:**

- `src/components/ContextWizard.tsx` — Add RadioGroup toggle for summary style
- `src/lib/generation-reducer.ts:40-80` — No change needed if `summaryStyle` lives in `SummaryContext`
- `src/app/page.tsx:414-450` — `summaryStyle` is already in `SummaryContext` which flows through `startSummaryGeneration`

**Toggle placement:** Add the style selector to the `extraction` step in ContextWizard, below the template cards and above the extraction goal textarea. This keeps the wizard to 2 steps. The toggle uses `RadioGroup` matching `SummaryModeSelector.tsx` visual pattern.

**Default value:** `'standard'` — preserves existing behavior. Users opt into structured.

**Template interaction:** All 4 templates work with both styles. The `extractionGoal` from the template is passed to the structured prompt as an additional lens. The structured format still respects the extraction goal.

#### Phase 3: Collapsible Cedar Section in Rendering

**Files:**

- `src/components/EditableMarkdown.tsx` — Detect Cedar heading in chunk list, render with collapsible wrapper

**Approach:** In `EditableMarkdown`'s render output, detect when a chunk matches the Cedar heading pattern (`/^##\s+Cedar['']s\s+Read/i`). From that chunk onward, wrap all remaining chunks in a collapsible `<details>` / `<summary>` HTML element. The raw markdown stored in the chunk array is unchanged — the collapsible is purely a rendering concern.

```tsx
// Pseudocode for EditableMarkdown render
const cedarIndex = chunks.findIndex(c => /^##\s+Cedar[''']s\s+Read/i.test(c.trim()));

return (
  <div className="space-y-4">
    {/* Render chunks before Cedar normally */}
    {chunks.slice(0, cedarIndex === -1 ? chunks.length : cedarIndex).map(...)}

    {/* Render Cedar section in collapsible */}
    {cedarIndex !== -1 && (
      <details className="border rounded-lg p-4 mt-6">
        <summary className="cursor-pointer font-medium text-muted-foreground">
          Cedar's Read on the Room — the dynamics, tensions, and patterns
          that don't show up in a transcript.
        </summary>
        <div className="mt-4 space-y-4">
          {chunks.slice(cedarIndex + 1).map(...)}
        </div>
      </details>
    )}
  </div>
);
```

**During streaming:** `StreamingGenerationView` renders the full accumulated markdown with `react-markdown`. The Cedar heading will appear visibly during streaming — no collapsible wrapper. This is acceptable because the collapsible only engages after generation completes when `SummaryView` takes over with `EditableMarkdown`. The brief "un-collapsed" view during streaming is a natural part of watching the summary build.

**Editing:** Since the raw markdown doesn't contain `<details>` tags, chunk editing works unchanged. Editing a chunk inside the Cedar section modifies the raw markdown, and re-render re-applies the collapsible wrapper.

**Copy/export:** The copy and export functions in `SummaryView` operate on the raw markdown string, not the rendered HTML. Cedar content is included and expanded.

#### Phase 4: Regeneration Compatibility

**Files:**

- `src/components/SummaryView.tsx` — Ensure `handleRegenerate` passes `summaryStyle` from saved context

**Since `summaryStyle` is part of `SummaryContext`**, it's already persisted in the DB `context` JSONB column. When a user regenerates from a saved summary, the context (including `summaryStyle`) flows through automatically. The summary view's context editor doesn't need a style toggle — it inherits from the original generation.

**Backward compatibility for old saved summaries:** Old rows have no `summaryStyle` field in their `context` JSONB. The `optional()` type on `summaryStyle` handles this — `undefined` defaults to `'standard'`.

## Acceptance Criteria

### Functional

- [x] New RadioGroup toggle in ContextWizard: "Standard" (default) / "Structured"
- [x] Selecting "Structured" generates a summary with Meeting Orientation, Central Questions (with quotes + status labels), and Cedar's Meta-View sections
- [x] Breakout Rooms section appears only when breakout activity is detected in transcript
- [x] Central Questions section uses direct quotes, speaker attribution, and status labels (Resolved/Explored/Surfaced)
- [x] Cedar's Meta-View section is collapsed by default in the rendered summary
- [x] User can expand/collapse Cedar's section by clicking
- [x] Inline editing works within the collapsible Cedar section
- [x] Selecting "Standard" generates summaries identical to current behavior (regression)
- [x] Multi-transcript combined mode works with structured format
- [x] Multi-transcript separate mode produces individual structured summaries per transcript
- [x] Summary style persists in DB and is used on regeneration

### Non-Functional

- [x] Streaming performance unchanged (same SSE pipeline, no parsing overhead)
- [x] Existing saved summaries (no `summaryStyle` field) render correctly as standard
- [x] Copy to clipboard includes Cedar section expanded (no `<details>` tags)
- [x] Guest flow works identically to authenticated flow (minus DB persistence)

## Dependencies & Risks

**Dependencies:**

- None external. All changes are in the existing codebase.

**Risks:**

| Risk                                                                   | Likelihood | Mitigation                                                                                |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| Structured prompt produces inconsistent output across transcript types | Medium     | Test with varied transcripts: short 1-on-1, long brainstorm, Q&A, etc. Iterate on prompt. |
| Cedar heading detection breaks on prompt output variation              | Low        | Use permissive regex (`/^##\s+Cedar/i`). Include explicit heading instruction in prompt.  |
| Streaming Cedar section looks jarring (visible → collapses)            | Low        | Acceptable for demo. Could add fade-in animation later.                                   |
| `max_tokens: 6144` truncates longer structured output                  | Medium     | Monitor in testing. Increase to 8192 if needed.                                           |

## References

### Internal

- Brainstorm: `docs/brainstorms/2026-02-17-structured-summary-format-brainstorm.md`
- Prompt patterns: `docs/institutional-learnings/prompt-patterns-reference.md`
- Error handling patterns: `docs/solutions/runtime-errors/pr-31-error-handling-logging-overhaul.md`
- Existing toggle pattern: `src/components/SummaryModeSelector.tsx`
- Cedar voice: `docs/institutional-learnings/cedar-essence-findings.md`

### GitHub Issues

- #19 — Meeting orientation / divergence detection
- #20 — Central questions + direct quotes + status labels
- #21 — Breakout rooms / sub-groups
- #22 — Cedar's opt-in interpretive meta-view
- #24 — Meeting date/time display

### Files to Modify

| File                                  | Lines    | Change                                        |
| ------------------------------------- | -------- | --------------------------------------------- |
| `src/lib/claude.ts`                   | 75-78    | Add `summaryStyle` to `SummaryContext`        |
| `src/lib/claude.ts`                   | new      | `STRUCTURED_SUMMARY_SYSTEM_PROMPT`            |
| `src/lib/claude.ts`                   | new      | `STRUCTURED_STREAMING_SUMMARY_SYSTEM_PROMPT`  |
| `src/lib/claude.ts`                   | 184-198  | Branch `streamSummarySingle` on style         |
| `src/lib/claude.ts`                   | 62-150   | Branch `summarizeSingle` on style             |
| `src/app/api/summarize/route.ts`      | 16-29    | Add `summaryStyle` to Zod schema              |
| `src/app/api/summarize/route.ts`      | ~120-256 | Pass style through to generation fns          |
| `src/components/ContextWizard.tsx`    | 58-77    | Add RadioGroup toggle                         |
| `src/components/EditableMarkdown.tsx` | 256-268  | Cedar heading detection + collapsible wrapper |
