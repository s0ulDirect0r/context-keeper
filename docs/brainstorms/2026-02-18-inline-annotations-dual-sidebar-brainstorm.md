---
topic: Vault Evolution — Notes Panel with Tags
date: 2026-02-18
status: decided
supersedes: vault-highlight-collection brainstorm (same date)
---

# Vault Evolution — Notes Panel with Tags

## Context Shift

Started brainstorming dual-sidebar drag annotations. After PM feedback, the actual need is simpler: **a free-form notes panel next to the summary with tagging**. The PM wants to take notes while reading and tag them for later retrieval. Not annotations on specific text — just a scratchpad.

## What We're Building

Evolve the vault sidebar from structured excerpt cards into a **notes panel**:

- **Free-form entries**: Each note is a small text entry, not a structured excerpt card
- **Excerpt capture**: Selecting text in the summary creates a new note pre-filled with the excerpt (existing vault behavior, but fluid)
- **Fresh notes**: Can also create blank notes by just typing (no selection required)
- **Tags**: Each note can have zero or more tags (simple strings/labels)
- **Per-summary**: Notes live on the summary view, attached to a specific summary
- **Cross-summary browsing**: Dashboard tab shows all notes, filterable by tag
- **Auth-only**: Same as current vault — logged-in users only

## Why This Approach

PM feedback: "she really just wants to take notes and tag them in the summary view." The dual-sidebar drag concept was overengineered for the actual need. The vault infrastructure is 90% there — evolving it avoids throwaway work.

The core value: the moment of reading a summary becomes a **moment for self-reflection**. Notes capture the human reaction that the AI summary can't.

## Key Decisions

| Decision               | Choice                                       | Rationale                                                                             |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Data model             | Evolve vault_items table                     | Add tags column. Existing excerpt + note structure is close enough.                   |
| UI                     | Replace vault sidebar cards with notes panel | Free-form, scratchpad feel instead of structured CRUD cards                           |
| Notes without excerpts | Yes, allow blank notes                       | Not every note needs a highlighted excerpt — sometimes you just want to jot a thought |
| Tags                   | TEXT[] column on vault_items                 | Simple array, no separate tags table. Filter in dashboard.                            |
| Shared visibility      | Not yet                                      | Keep notes private for V1. Revisit when annotations/shared commentary becomes a need. |
| Pearls                 | Still disabled                               | Notes panel takes the sidebar slot                                                    |

## Open Questions

1. **Tag UX**: Free-text tag input? Autocomplete from existing tags? Predefined set?
2. **Dashboard filtering**: Tag filter chips? Search? Both?
3. **Note ordering**: Chronological? Or can the user reorder?
4. **Rename "Vault"?**: Should the UI say "Notes" now instead of "Vault"?

## User Research Quotes

> "I wish I had a text window on the right where I could paste the sentences I want to keep"

> "Felt the urge to make comments on the summary — something like 'oh no, that's not what I felt'"

> "The way that it's written is allowing me to explore the things we were talking about more deeply — she felt the potential for the moment of reading the summary to become a moment for self-reflection"
