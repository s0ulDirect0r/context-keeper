# Vault: Personal Highlight Collection

**Date:** 2026-02-18
**Status:** Brainstorm complete
**Feature:** Allow users to save specific sentences from summaries into a persistent personal collection

---

## What We're Building

A **sidebar clipboard** that lets users highlight text in summaries and save it to a personal vault. The vault is a chronological collection of excerpts that resonated — a personal highlight reel across meetings.

**Core interaction:** While reading a summary, select text → it appears in the sidebar → add an optional note about why it resonated → save. The sidebar is a persistent panel on the right side of the summary view (reusing the space currently occupied by the disabled pearls sidebar).

**Collection view:** A "Vault" tab on the dashboard shows all saved highlights in reverse-chronological order, grouped by meeting/summary.

## Why This Approach

### User Research Signals

1. **PM feedback:** "I only want to save specific sentences that resonate... I wish I had a text window on the right where I could paste the sentences I want to keep." In the absence of this, they open Apple Notes.

2. **User feedback:** Felt the urge to annotate summaries with personal reactions. Used to annotate meeting transcripts with thoughts. Wanted a tool for that.

3. **Self-reflection moment:** "The way that it's written is allowing me to explore the things we were talking about more deeply." The act of reading a summary can become a moment for self-reflection — the vault supports that by encouraging intentional selection of what matters.

### Why Sidebar Clipboard (Approach B)

- Matches the PM's mental model: "text window on the right"
- Pearls sidebar is currently disabled — reuse that layout slot
- Everything visible at once: summary on left, your highlights on right
- Easy to review what you've saved for this meeting before moving on
- Avoids fiddly floating tooltip UX from inline selection approaches

### Relationship to Pearls

Vault and pearls **coexist separately**:

- **Pearls** = AI-generated insights (system finds what's interesting)
- **Vault** = User-curated highlights (you save what resonates)

Different purposes, different sources. Pearls are currently disabled but not removed — they can be re-enabled alongside the vault in the future if desired.

## Key Decisions

| Decision                | Choice                               | Rationale                                                    |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------ |
| Core need               | Cherry-pick + collect (not annotate) | Primary value is saving excerpts, not commenting             |
| Pearls relationship     | Coexist separately                   | Different purposes: AI insight vs personal curation          |
| Entry interaction       | Sidebar clipboard                    | Matches PM mental model, reuses pearls layout slot           |
| Collection organization | Chronological stream                 | Start simple. Grouping/tagging can come later based on usage |
| Collection location     | Dashboard tab                        | Keeps vault discoverable without new nav entries             |
| Auth requirement        | Auth-only                            | Clean boundary, natural upgrade nudge for guests             |
| Optional note           | Yes, on each highlight               | Capture "why this resonated" for self-reflection value       |

## Scope (V1)

**In scope:**

- Sidebar panel on summary view for adding highlights
- Text selection → appears in sidebar workflow
- Optional note per highlight
- Save highlights to database (new table)
- Dashboard "Vault" tab with chronological feed grouped by meeting
- Click a vault item to navigate back to its source summary

**Out of scope (future):**

- Concept tag grouping / cross-meeting pattern detection
- Manual folders or user-defined tags
- Search within vault
- Guest/localStorage support
- Annotation mode (inline comments on summaries)
- AI-powered vault insights ("themes across your highlights")
- Export vault contents

## Open Questions

1. **Highlight deduplication** — Can the same text be saved twice from the same summary? Probably yes (with different notes), but worth confirming during implementation.
2. **Editing after save** — Can users edit highlight text or notes after saving? Probably yes for notes, probably no for the excerpt itself.
3. **Delete flow** — Swipe/button to remove vault items? Needs a simple affordance.
4. **Empty states** — What does the vault tab show when empty? Opportunity for onboarding copy.
5. **Sidebar toggle** — Is the vault sidebar always visible when viewing a summary, or toggled on/off?

## Data Model (Sketch)

```
vault_items
  id          UUID PK
  user_id     UUID FK -> auth.users ON DELETE CASCADE
  summary_id  UUID FK -> summaries ON DELETE CASCADE
  excerpt     TEXT NOT NULL       -- the highlighted text
  note        TEXT                -- optional user note
  created_at  TIMESTAMPTZ
```

RLS: users can only access their own vault items.
