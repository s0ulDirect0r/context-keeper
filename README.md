# Cedar

**Turn your meeting recordings into orientation.**

Cedar takes a meeting transcript and produces a summary aimed at a *specific reader* — not a generic recap. You tell it who needs to know what and why, and it writes to that goal.

The premise: on most teams, someone is the connective tissue. They don't just attend meetings, they track the room — who needs to know what, what it meant, what happens next. That's a context gap held together by memory and a busy schedule. Cedar is built for that gap.

> The repo is named `context-keeper`; the shipped product is Cedar.

---

## How it works

Three steps, one tailored summary.

1. **Bring a transcript** — connect [Otter.ai](https://otter.ai) and pull recordings, or paste/enter text directly.
2. **Say what you need out of it** — a multi-step wizard collects your audience, priorities, and purpose. Cedar asks rather than guessing.
3. **Generate** — the summary streams in as it's written, then stays editable.

## What it does

- **Three input paths** — Otter.ai import, paste, or manual entry
- **Goal-directed summarization** — output is shaped by a stated extraction goal and audience, not a fixed template
- **Standard, structured, or custom formats** — structured mode returns a typed document with key moments, Q&A pairs, emerging themes, key insights, momentum items, and an observer's perspective, with quotes attributed to speakers and timestamped
- **Streaming generation** — served over SSE, rendered as tokens arrive
- **Editable output** — summaries are editable markdown after generation, and edits persist
- **Share links** — publish a summary to a public tokenized URL
- **Export** — download as Markdown or PDF
- **Works signed in or as a guest** — signed-in users auto-save to Supabase; guests fall back to `localStorage`
- **Saved summaries** — dashboard with history and search

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Radix UI · Supabase (Postgres + auth) · Anthropic Claude SDK · Zod · Playwright · Sentry

## Architecture

Layered, with enforced boundaries — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full rules and the API route table.

```
src/
  models/      # domain types + Supabase data access
  services/    # AI operations and prompt templates
  app/api/     # thin controllers — validate, authorize, delegate
  lib/         # AI client, Supabase factories, rate limiting, logging, export
  components/  # React components grouped by feature
```

The constraints worth knowing:

- `models/types.ts` is client-safe — pure types, no `server-only`, so client components can import them
- `models/summaries.ts`, `models/otter.ts`, and `services/summarize.ts` sit behind a `server-only` firewall
- API routes never inline Supabase queries; they delegate to model functions and pass the client down
- Client components never touch Supabase for data mutations — that goes through API routes. Direct Supabase access is limited to server components and auth state.
- Both `summaries` and `otter_connections` enforce Row Level Security for user-only access

## Running locally

Requires Node and [pnpm](https://pnpm.io). Local Supabase needs Docker.

```bash
pnpm install
cp .env.local.example .env.local   # then fill it in
pnpm dev                            # http://localhost:3000
```

You'll need an [Anthropic API key](https://console.anthropic.com) and a Supabase project — or run one locally:

```bash
supabase start      # local Supabase
supabase db reset   # reset and re-run migrations
```

Sentry is optional; error monitoring stays off without its variables.

## Testing

Playwright end-to-end, covering the landing page, auth dialog, guest flow, summary view, and edit persistence.

```bash
pnpm test        # headless
pnpm test:ui     # interactive
```

## Development

```bash
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm type-check    # tsc --noEmit
```

Husky and lint-staged run on pre-commit.

## Notes

Otter.ai integration uses their unofficial API; credentials are stored per-user in Supabase (or `localStorage` for guests).

## Status

Working prototype — import, contextualize, generate, edit, share, and export run end to end. Not currently deployed publicly.
