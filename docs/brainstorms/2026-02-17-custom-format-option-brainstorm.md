# Custom Format Option — Brainstorm

**Date:** 2026-02-17
**Status:** Ready for planning
**Branch:** feat/structured-summary (ships with structured mode)

## What We're Building

A third summary format option — "Custom" — alongside Standard and Structured. When selected, a textarea appears where the user describes the output format they want in natural language (e.g., "bullet points grouped by speaker", "a table with action items and owners", "email draft for my manager").

The user's format description gets full control over output structure. No baked-in quality guardrails — if they say "just bullet points", that's what they get.

## Why This Approach

- **User request:** Friend asked about overriding prompts with specific formatting needs
- **Natural extension:** The branch already introduced format selection (Standard vs Structured). A third "describe it yourself" option completes the spectrum from guided → opinionated → freeform
- **Keeps it simple:** Same radio group, no new wizard steps, no new pages

## Key Decisions

| Decision            | Choice                                      | Rationale                                                                                  |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Control level       | Describe the format (natural language)      | Accessible to all users, not just prompt engineers                                         |
| UI placement        | Third radio in existing format radio group  | No new steps, reveals textarea on selection                                                |
| Guardrails          | Full freedom — none                         | User's format description controls everything                                              |
| Prompt architecture | Thin wrapper system prompt                  | Minimal "you're summarizing a transcript" role + user's format description in user message |
| Placeholder text    | Minimal — "Describe the format you want..." | Let users figure it out, don't over-guide                                                  |
| Branch              | Same branch (feat/structured-summary)       | Natural extension of format choices                                                        |

## Architecture Notes

Current flow: `summaryStyle` is `'standard' | 'structured'` → selects between two system prompts.

New flow adds `'custom'`:

- New state: `customFormatDescription` (string, required when style is `'custom'`)
- API: Zod schema adds `'custom'` to the enum + optional `customFormatDescription` field
- Prompt layer: When `summaryStyle === 'custom'`, use a thin wrapper system prompt + inject format description into user message
- Streaming: Same streaming path, just different system prompt selection

## Open Questions

None — design is clear enough to proceed to planning.
