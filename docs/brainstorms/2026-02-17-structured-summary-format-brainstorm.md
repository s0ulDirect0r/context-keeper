# Structured Summary Format — Brainstorm

**Date:** 2026-02-17
**Status:** Ready for planning
**GitHub Issues:** #19, #20, #21, #22, #24 (skipping #23 cross-meeting for now)

## What We're Building

A new "Structured" summary mode alongside the existing free-form summaries. When selected, summaries follow a specific format driven by GitHub issues #19–#22 and #24:

1. **Meeting Orientation (#19, #24)** — Date/time display, stated goal vs. actual focus, divergence detection
2. **Central Questions (#20)** — Questions as section headings, direct quotes grouped by speaker, status labels (Resolved/Explored/Surfaced), emergent questions section
3. **Breakout Rooms (#21)** — Sub-group detection, share-back quotes, explicit notes when content unavailable
4. **Cedar's Meta-View (#22)** — Relational dynamics, energy shifts, avoidance patterns. Generated in same pass but rendered collapsed by default (collapsible `<details>` section)

Cross-meeting pattern tracking (#23) is deferred — separate, larger feature for multi-recording mode.

## Why This Approach

**Prompt-first with minimal UI (Approach 1):**

- The summary format is almost entirely prompt-controlled (`SUMMARY_SYSTEM_PROMPT` in `claude.ts`). Changing the prompt is the highest-leverage change.
- Streaming is preserved — the new prompt produces differently-structured markdown, same SSE pipeline.
- A simple toggle in ContextWizard lets users choose between "Standard" and "Structured" modes.
- Cedar's collapsible section uses native HTML `<details>` — no new components needed.
- ~4-5 files touched, low risk to existing flow.

**Rejected alternative:** Structured JSON output via tool calls + separate Cedar API endpoint. Loses streaming UX, significantly more work, overkill for a PM demo.

## Key Decisions

1. **New mode, not a replacement** — Existing free-form summaries stay untouched. New mode is additive.
2. **Cedar meta-view in same pass, collapsed** — One Claude call generates everything. Cedar section rendered in a collapsible `<details>` element, closed by default. Approximates the opt-in UX from #22 without a second API call.
3. **Skip cross-meeting (#23)** — Only applies to multi-recording combined mode. Separate feature.
4. **Style toggle in ContextWizard** — User selects summary style before generation. Choice flows through API route to prompt selection.
5. **Detection by heading pattern** — Cedar section identified in markdown by a known heading (e.g., `## Cedar's Read on the Room`). Fragile but sufficient for demo.

## Scope

### Files to Change

| File                                                       | Change                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/lib/claude.ts`                                        | New `STRUCTURED_SUMMARY_SYSTEM_PROMPT` implementing #19-#22, #24. New `STRUCTURED_STREAMING_PROMPT`. |
| `src/app/api/summarize/route.ts`                           | Accept `summaryStyle` param, select prompt accordingly.                                              |
| `src/components/ContextWizard.tsx`                         | Add summary style toggle (Standard / Structured).                                                    |
| `src/components/EditableMarkdown.tsx` or `SummaryView.tsx` | Detect Cedar heading, wrap in `<details>` element.                                                   |
| Zod schema in route.ts                                     | Add `summaryStyle` to validation.                                                                    |

### Out of Scope

- Cross-meeting patterns (#23)
- Separate Cedar API endpoint
- New component library / structured output types
- Changes to tag or pearl extraction

## Open Questions

- Should the style choice persist per-user (localStorage/DB) or be selected each time?
- Should we expose the style toggle to guests as well, or keep it auth-only for the demo?
