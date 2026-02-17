---
title: 'feat: Structured Summary Mode + Universal Direct Quote Formatting'
type: feat
date: 2026-02-17
supersedes: docs/plans/2026-02-17-feat-structured-summary-mode-plan.md
github_issues: '#33, #19, #20, #21, #22, #24'
---

# feat: Structured Summary Mode + Universal Direct Quote Formatting

## Overview

Two related changes driven by GitHub issue #33:

1. **Universal direct quote formatting** — Update the existing free-form `SUMMARY_SYSTEM_PROMPT` with strict quote-handling rules (pull actual words, clean fillers, preserve hedging, use `[...]` for trimmed excerpts, never paraphrase or merge). This applies to ALL summaries.
2. **New "Structured" summary mode** — A second summary style with explicit sections: Meeting Orientation (when/who/format), Central Questions (with speaker-attributed quotes), Breakout Rooms (if detected), and Cedar's Meta-View (collapsible). Activated via a RadioGroup toggle in ContextWizard.

Both changes are prompt-driven. The rendering pipeline (SSE streaming → react-markdown) is unchanged. No DB migration needed.

## Problem Statement / Motivation

Issue #33 defines precise rules for how direct quotes should appear in summaries — speaker attribution, filler cleanup, hedging preservation, `[...]` for excerpts. The current prompt says "use verbatim quotes liberally" but lacks these specific formatting rules. The user's directive is clear: **these quote rules apply to ALL summaries, not just structured mode**.

Issue #33 also defines structured sections (When & Who, What Was the Format, Central Questions, Breakout Rooms) that map to the "Structured" mode from the existing brainstorm, combining requirements from issues #19-#22 and #24.

## Proposed Solution

**Prompt-first with minimal UI.** Two prompt changes, one UI toggle, one rendering enhancement.

## Technical Approach

### Key Architectural Decisions

| Decision                    | Choice                                                                         | Rationale                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quote rules scope           | Update BOTH `SUMMARY_SYSTEM_PROMPT` AND new `STRUCTURED_SUMMARY_SYSTEM_PROMPT` | User directive: "quotes apply to ALL summaries"                                                                                                                                                                        |
| Where `summaryStyle` lives  | `SummaryContext` type (`claude.ts:75-78`)                                      | Auto-persists in DB `context` JSONB, flows through pipeline, available for regeneration                                                                                                                                |
| Output format               | Plain markdown `string[]`                                                      | No new types. Existing editing, copy, export unchanged. Avoids dead `StructuredSummary` legacy type.                                                                                                                   |
| Collapsible Cedar section   | Client-side heading detection in `EditableMarkdown` render                     | Raw markdown stays clean. `<details>` is render-time only.                                                                                                                                                             |
| Pull quote styling          | CSS on `blockquote` elements via react-markdown                                | Prompt outputs `> "quote" — *Speaker*` format. Style via Tailwind on `<blockquote>`.                                                                                                                                   |
| Timestamps in quotes        | Best-effort from transcript                                                    | Otter provides `start_offset`/`end_offset` per transcript segment. Prompt instructed to include timestamps when available in the transcript text. Pasted transcripts may lack timestamps.                              |
| Missing sections            | Prompt omits silently                                                          | No "N/A" filler. Only Meeting Orientation + Central Questions are always present in structured mode.                                                                                                                   |
| Editable date/time/speakers | Not in MVP                                                                     | #33 mentions these fields should be editable, but the current inline editing (`EditableMarkdown`) operates on markdown chunks. Dedicated editable metadata fields would require new UI components. Defer to follow-up. |

### Implementation Phases

#### Phase 1: Universal Quote Formatting Rules (applies to ALL summaries)

**Files:**

- `src/lib/claude.ts:10-39` — Update `SUMMARY_SYSTEM_PROMPT`

**Change:** Add a `## Direct Quotes` section to the existing free-form prompt with the rules from #33:

```
## Direct Quotes

When quoting speakers, follow these rules strictly:

- **Pull the speaker's actual words from the transcript.** Format quotes as blockquotes with attribution:
  > "Quote text here" — *Speaker Name*
- **Never mix AI-generated words with direct quotes.** Quotes must be clearly separated from your analysis.
- **Lightly clean for readability:** Remove filler words ("um," "like," "you know"), false starts, and repeated words.
- **Do not paraphrase, merge two separate remarks into one quote, or trim out hedging and uncertainty that changes the speaker's tone.** If someone said "I'm not sure, but maybe we should…" keep the tentativeness.
- **If a speaker's response was long,** excerpt the most substantive portion. Use "[…]" to indicate where material was trimmed. Never trim in a way that changes the meaning.
- **Include timestamps when available** in the transcript (e.g., "[12:34]").
```

This replaces the current bullet: `Use verbatim quotes liberally. When someone said something important, use their exact words. Always attribute quotes to the speaker.`

**Impact:** Every summary generated from this point forward — standard or structured — uses these quote rules.

#### Phase 2: Structured Summary Prompt + API Plumbing

**Files:**

- `src/lib/claude.ts:75-78` — Add `summaryStyle?: 'standard' | 'structured'` to `SummaryContext`
- `src/lib/claude.ts` (new block) — Create `STRUCTURED_SUMMARY_SYSTEM_PROMPT` (~100-130 lines)
- `src/lib/claude.ts` (new block) — Create `STRUCTURED_STREAMING_SUMMARY_SYSTEM_PROMPT` (base + heading instruction)
- `src/lib/claude.ts:177-197` — Update `streamSummarySingle()` to branch on `summaryStyle`
- `src/lib/claude.ts:113-149` — Update `summarizeSingle()` to branch on `summaryStyle`
- `src/app/api/summarize/route.ts:15-28` — Add `summaryStyle` to Zod schema inside `context`
- `src/app/api/summarize/route.ts` — Pass `summaryStyle` through to generation functions

**The structured prompt implements these sections:**

**1. Meeting Orientation (#19, #24)**

```
## Meeting Orientation

Meeting took place on [date], at [time] [timezone]
Participants: [name], [name], [name]

Stated goal: [goal from facilitator's opening remarks or agenda, verbatim or near-verbatim]
What else happened: [inference of additional focuses if meeting diverged]
```

Divergence detection heuristic (from #33): A meeting has "diverged" when less than roughly a third of the substantive conversation addresses the stated goal. If the group returns after a detour, note both. When in doubt, describe what happened rather than labelling it. Use neutral language: "The meeting's stated purpose was [X]. In practice, the conversation moved toward [Y]."

If no goal was stated, infer the focus from what the group oriented around once greetings and logistics were done.

**2. Central Questions (#20, #33)**

```
## [Central Question as Heading]

*Raised by [Speaker]*

### [Participant Name]
- > "Direct quote response" — *Speaker* [timestamp if available]
- > "Another quote" — *Speaker*

### [Another Participant]
- > "Their response" — *Speaker*

**Status:** Resolved / Explored / Surfaced
```

How to identify central questions (priority order from #33):

1. A question the facilitator framed for the group
2. A question from the agenda or pre-meeting materials
3. A question a participant asked that drew responses from 2+ others
4. If none apply but the group oriented around a topic, infer the question

Emergent questions (not originally posed) go in a separate `## Emergent Questions` section, same format.

**3. Breakout Rooms (#21)** — Only if detected

```
## Breakout Rooms

### [Sub-group name or number]
Participants: [if known]

> "Share-back quote" — *Reporter Name*

*Note: [explicit statement if content was not captured or not reported back]*
```

Detection heuristic from #33: Look for facilitator saying "let's break into groups," followed by parallel audio tracks or a sudden drop in participants, followed by reconvening. If sub-groups reported back, capture the synthesis as quotes. If no report-back: "This sub-group's work was not brought back to main meeting." If not recorded: "Breakout room content was not captured."

**4. Cedar's Meta-View (#22)**

```
## Cedar's Read on the Room

[Relational dynamics, energy shifts, avoidance patterns. Warm/observational/curious tone.
No individual evaluation. No prescriptions. Hedging language where appropriate.]
```

Generated in the same Claude call. Rendered collapsed by default (Phase 4).

**Quote handling rules** (same as Phase 1, included in structured prompt too):

- Pull actual words, blockquote format with attribution
- Clean fillers, preserve hedging
- Use `[...]` for trimmed excerpts
- Never paraphrase or merge quotes

**Section omission:** Prompt instructs Claude to skip sections that don't apply. Only Meeting Orientation and Central Questions are always present.

**Zod schema change:**

```typescript
context: z.object({
  extractionGoal: z.string().min(1).max(1000),
  additionalContext: z.string().max(2000).optional(),
  summaryStyle: z.enum(['standard', 'structured']).optional(),
}),
```

**Branching logic in `streamSummarySingle()`:**

```typescript
const systemPrompt =
  context.summaryStyle === 'structured'
    ? STRUCTURED_STREAMING_SUMMARY_SYSTEM_PROMPT
    : STREAMING_SUMMARY_SYSTEM_PROMPT;
```

Same pattern for `summarizeSingle()`.

#### Phase 3: UI Toggle in ContextWizard

**Files:**

- `src/components/ContextWizard.tsx` — Add RadioGroup toggle for summary style

**Toggle placement:** In the `extraction` step, below the template cards and above the extraction goal textarea. Uses Radix `RadioGroup` matching the visual pattern from `SummaryModeSelector.tsx`.

**Options:**

- **Standard** (default) — Free-form, adapts to meeting shape
- **Structured** — Sections for orientation, questions, quotes, and dynamics

**Default:** `'standard'` — preserves existing behavior.

**The toggle value is stored in `SummaryContext.summaryStyle`** which already flows through the entire pipeline (page.tsx → API route → claude.ts → DB).

#### Phase 4: Collapsible Cedar Section in Rendering

**Files:**

- `src/components/EditableMarkdown.tsx:233-269` — Detect Cedar heading, render with collapsible wrapper

**Approach:** In `EditableMarkdown`'s render, detect when a chunk matches `/^##\s+Cedar[''']s\s+Read/i`. From that chunk onward, wrap remaining chunks in `<details>/<summary>`.

```tsx
const cedarIndex = chunks.findIndex((c) => /^##\s+Cedar[''']s\s+Read/i.test(c.trim()));

// Before Cedar: render normally
// Cedar onward: wrap in <details>
{
  cedarIndex !== -1 && (
    <details className="border rounded-lg p-4 mt-6">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        Cedar's Read on the Room
      </summary>
      <div className="mt-4 space-y-4">{chunks.slice(cedarIndex + 1).map(renderChunk)}</div>
    </details>
  );
}
```

**During streaming:** `StreamingGenerationView` renders raw markdown — Cedar heading is visible during streaming. Collapses only after generation completes when `SummaryView` takes over with `EditableMarkdown`. Acceptable for demo.

**Editing:** Raw markdown unchanged. Chunk editing inside Cedar section works normally. Re-render re-applies collapsible wrapper.

**Copy/export:** Operates on raw markdown string. Cedar content included and expanded.

#### Phase 5: Pull Quote CSS Styling

**Files:**

- `src/app/globals.css` — Add blockquote styling for pull-quote appearance

**Approach:** The prompts output quotes as markdown blockquotes (`> "quote" — *Speaker*`). `react-markdown` renders these as `<blockquote>`. Style them as pull quotes via CSS:

```css
/* Pull quote styling for direct quotes */
.prose blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1rem;
  font-style: italic;
  margin: 1rem 0;
}
```

This is a CSS-only change — no react-markdown custom components needed. Applies to both standard and structured summaries since both use the same blockquote format.

## Acceptance Criteria

### Functional

- [x] **Universal quotes:** Standard summaries use the new direct quote formatting rules (blockquote format, filler cleanup, hedging preservation, `[...]` excerpts)
- [x] **Style toggle:** RadioGroup in ContextWizard with "Standard" / "Structured" options
- [x] **Meeting Orientation:** Structured summaries show date/time, participants, stated goal vs actual focus
- [x] **Divergence detection:** If meeting diverged from stated goal, neutral language describes the shift
- [x] **Central Questions:** Each question as section heading, speaker attribution, direct quotes grouped by participant
- [x] **Emergent Questions:** Questions that emerged (not originally posed) in separate section
- [x] **Breakout Rooms:** Detected when present, explicit notes when content unavailable
- [x] **Cedar's Meta-View:** Collapsed by default, expandable, warm/observational tone
- [x] **Standard mode regression:** Selecting "Standard" produces summaries identical to current behavior (plus improved quote formatting)
- [x] **Multi-transcript modes:** Combined and separate modes both work with structured format
- [x] **Style persists:** `summaryStyle` saved in DB `context` JSONB, used on regeneration

### Non-Functional

- [x] Streaming performance unchanged (same SSE pipeline)
- [x] Old saved summaries (no `summaryStyle`) render correctly as standard
- [x] Copy to clipboard includes Cedar section expanded
- [x] Guest flow works identically (minus DB persistence)

## Deferred (Out of Scope)

- **Editable date/time/speakers fields** (#33 mentions these should be editable) — requires new UI components beyond `EditableMarkdown` chunk editing. Follow-up issue.
- **Cross-meeting patterns** (#23) — separate feature for multi-recording mode
- **Post-generation style toggle** — switching styles requires regeneration. Reasonable for demo.
- **Separate Cedar API endpoint** — single-pass generation is sufficient
- **Timestamp enrichment** — Otter provides `start_offset`/`end_offset` per segment but current transcript formatting (`otter.ts:196-210`) drops timestamps. Enriching transcript text with timestamps would improve quote attribution but is a separate enhancement.

## Dependencies & Risks

| Risk                                                                                                   | Likelihood | Mitigation                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured prompt produces inconsistent output across transcript types                                 | Medium     | Test with varied transcripts: short 1-on-1, long brainstorm, Q&A. Iterate prompt.                                                                   |
| Quote formatting rules conflict with free-form prompt's "let the meeting dictate structure" philosophy | Low        | Quote rules are additive guidance, not structural constraint. Tested by generating a few standard summaries after prompt update.                    |
| Cedar heading detection breaks on prompt variation                                                     | Low        | Permissive regex + explicit heading instruction in prompt.                                                                                          |
| `max_tokens: 6144` truncates longer structured output                                                  | Medium     | Monitor in testing. Increase to 8192 if structured summaries are longer.                                                                            |
| Pasted transcripts lack timestamps/speaker names                                                       | Medium     | Prompt instructed to use "if available" language. Graceful degradation — quotes attributed when speaker names present, omit timestamps when absent. |

## Files to Modify

| File                                  | Lines           | Change                                                    |
| ------------------------------------- | --------------- | --------------------------------------------------------- |
| `src/lib/claude.ts`                   | 10-39           | Add `## Direct Quotes` section to `SUMMARY_SYSTEM_PROMPT` |
| `src/lib/claude.ts`                   | 75-78           | Add `summaryStyle` to `SummaryContext`                    |
| `src/lib/claude.ts`                   | new             | `STRUCTURED_SUMMARY_SYSTEM_PROMPT` (~100-130 lines)       |
| `src/lib/claude.ts`                   | new             | `STRUCTURED_STREAMING_SUMMARY_SYSTEM_PROMPT`              |
| `src/lib/claude.ts`                   | 177-197         | Branch `streamSummarySingle` on style                     |
| `src/lib/claude.ts`                   | 113-149         | Branch `summarizeSingle` on style                         |
| `src/app/api/summarize/route.ts`      | 15-28           | Add `summaryStyle` to Zod context schema                  |
| `src/app/api/summarize/route.ts`      | ~120-234        | Pass style through to generation fns                      |
| `src/components/ContextWizard.tsx`    | extraction step | Add RadioGroup toggle                                     |
| `src/components/EditableMarkdown.tsx` | 233-269         | Cedar heading detection + collapsible wrapper             |
| `src/app/globals.css`                 | new             | Blockquote pull-quote styling                             |

## References

### Internal

- Brainstorm: `docs/brainstorms/2026-02-17-structured-summary-format-brainstorm.md`
- Previous plan (superseded): `docs/plans/2026-02-17-feat-structured-summary-mode-plan.md`
- Prompt patterns: `docs/institutional-learnings/prompt-patterns-reference.md`
- Existing toggle pattern: `src/components/SummaryModeSelector.tsx`
- Cedar voice: `docs/institutional-learnings/cedar-essence-findings.md`

### GitHub Issues

- #33 — Structured summary with direct quote formatting (primary)
- #19 — Meeting orientation / divergence detection
- #20 — Central questions + direct quotes + status labels
- #21 — Breakout rooms / sub-groups
- #22 — Cedar's opt-in interpretive meta-view
- #24 — Meeting date/time display
