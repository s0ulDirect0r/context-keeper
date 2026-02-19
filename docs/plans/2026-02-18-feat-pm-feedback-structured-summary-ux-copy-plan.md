---
title: 'PM Feedback: Structured Summary Formatting + UX Copy Tweaks'
type: feat
date: 2026-02-18
---

# PM Feedback: Structured Summary Formatting + UX Copy Tweaks

## Overview

Batch of PM-requested changes across two areas: (A) structured summary output formatting improvements and (B) wizard UX copy polish. All changes have exact specifications — no ambiguity.

## Changes

### A. Structured Summary Prompt (`src/lib/claude.ts`)

#### A1. Meeting Orientation formatting (lines ~218-229)

**Current template:**

```
Meeting took place on [date], at [time] [timezone]
Participants: [name], [name], [name]

Stated goal: [goal]
What else happened: [inference]
```

**Desired template:**

```
**Meeting took place on** Sunday, 15th February 2026 at 6.26pm

**Participants:** [name], [name], [name]

**Stated goal:** [goal]

**What else happened:** [inference]
```

Specific changes:

- [x] Bold all labels: "Meeting took place on", "Participants", "Stated goal", "What else happened"
- [x] Date format: `[Day of week], [Ordinal day] [Month name] [Year] at [h.mm][am/pm]`
- [x] Each field on its own line with blank line between each (already mostly there, but "What else happened" needs separation from "Stated goal")
- [x] Add timezone instruction: display in user's local timezone

**Timezone approach:** Pass `Intl.DateTimeFormat().resolvedOptions().timeZone` from client → API → prompt. Add to `buildUserMessage()` as `**User's timezone:** America/New_York`. Add formatting instruction to the structured prompt: "Format the meeting date using the user's timezone. Use format: [Day of week], [Ordinal day] [Month] [Year] at [h.mm][am/pm]."

Files:

- `src/app/page.tsx` — Send `timezone` in the summarize API call body (~line 384)
- `src/app/api/summarize/route.ts` — Accept `timezone` param, pass to `buildUserMessage()`
- `src/lib/claude.ts` — Update `buildUserMessage()` to include timezone, update structured prompt template with formatting instructions and bolded labels

#### A2. Central Questions formatting (lines ~233-261)

**Current:**

```
## [Central Question]

*Raised by [Speaker]*

### [Participant]
> quote

**Status:** Resolved / Explored / Surfaced
```

**Desired:**

```
## [Central Question]

*Raised by [Speaker]*

[1-2 sentence factual summary of how this question was engaged with]

### [Participant]
> quote
```

Changes:

- [x] Add prompt instruction: "For each central question, provide a 1-2 sentence factual summary of how the question was engaged with. No exaggeration — plain facts giving a quick overview. Place this summary after 'Raised by' and before participant quotes."
- [x] Remove the `**Status:** Resolved / Explored / Surfaced` line and its explanation from the prompt

File: `src/lib/claude.ts` — Edit `STRUCTURED_SUMMARY_SYSTEM_PROMPT` (~lines 233-261)

### B. UX Copy Tweaks (`src/components/ContextWizard.tsx`)

All string replacements in one file.

#### B1. Wizard Screen 1 — Template Selection

| Element                          | Current                                                                                                | New                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Title (line ~122)                | "What would you like help with here?"                                                                  | "What can I help you with?"                                 |
| "Catch me up" subtitle           | "What happened and what do I need to know"                                                             | "What happened and what matters most"                       |
| "Get everyone aligned" label     | "Get everyone aligned"                                                                                 | "Summarise for others"                                      |
| "Get everyone aligned" subtitle  | "Same page, shared next steps"                                                                         | "Shared context and clear next steps"                       |
| "Help me read the room" subtitle | "Give me the warm data, the vibe, and the relational dynamics"                                         | "The dynamics, tensions, and unspoken signals"              |
| "Help me remember" subtitle      | "I want to reconnect with what happened"                                                               | "Key moments, insights and quotes"                          |
| Placeholder text                 | `'e.g., "Catch my cofounder up on the investor call", "Help me remember the details for my proposal"'` | `'e.g., "Catch my developer up on the user feedback call"'` |

- [x] Update all Screen 1 copy per table above

#### B2. Wizard Screen 2 — Format Selection

| Element                | Current                                                     | New                              |
| ---------------------- | ----------------------------------------------------------- | -------------------------------- |
| Title (line ~123)      | "How should the summary look?"                              | "Choose a summary format."       |
| Subtitle (line ~128)   | "Pick a style, or describe your own format."                | "Not sure? Start with Standard." |
| Standard description   | "Free-form, adapts to meeting shape"                        | "Adapts to the themes"           |
| Structured description | "Sections for orientation, questions, quotes, and dynamics" | "Pull out central questions"     |
| Custom description     | Keep as-is                                                  | Keep as-is                       |

- [x] Update all Screen 2 copy per table above

## Acceptance Criteria

- [ ] Structured summaries use bolded labels in Meeting Orientation
- [ ] Meeting date displays in user's local timezone with format "Sunday, 15th February 2026 at 6.26pm"
- [ ] Each Meeting Orientation field is on its own line
- [ ] Central questions include 1-2 sentence engagement summary before quotes
- [ ] No "Status" field appears in central question sections
- [ ] All wizard copy matches PM specifications exactly
- [ ] Manual transcript paste (no Otter date) still works gracefully — Claude infers from transcript or omits date
- [ ] Existing `standard` and `custom` summary modes are unaffected

## Implementation Order

1. **B1 + B2** — UX copy (pure string replacements, zero risk, instant)
2. **A2** — Central questions prompt (prompt-only change, no plumbing)
3. **A1** — Meeting Orientation + timezone (requires client → API → prompt plumbing)

## References

- `src/lib/claude.ts:210-261` — Structured summary prompt
- `src/lib/claude.ts:172-200` — `buildUserMessage()`
- `src/components/ContextWizard.tsx:16-44` — TEMPLATES array
- `src/components/ContextWizard.tsx:120-229` — Wizard screen rendering
- `src/app/page.tsx:349,384` — Date extraction and API call
- `src/app/api/summarize/route.ts:90,211` — Date handling in API route
- `docs/institutional-learnings/prompt-patterns-reference.md` — Proven prompt patterns
