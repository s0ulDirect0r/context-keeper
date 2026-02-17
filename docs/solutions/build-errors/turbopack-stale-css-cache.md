---
title: 'Turbopack Stale CSS Cache & Style Redesign Pitfalls'
date: 2026-02-17
category: build-errors
tags:
  - turbopack
  - css-variables
  - tailwindcss-4
  - cva
  - shadcn-ui
  - component-consistency
  - code-review
severity: medium
components:
  - src/app/globals.css
  - src/components/ui/button.tsx
  - src/components/RecordingList.tsx
  - package.json
pr: 32
branch: style-experiment
---

# Turbopack Stale CSS Cache & Style Redesign Pitfalls

Four issues encountered during PR #32 (warm beige theme + recording picker redesign). The Turbopack cache issue is the most novel and broadly applicable.

## Problem 1: Turbopack Stale CSS Cache (Primary)

### Symptom

Changed CSS variables in `globals.css` `:root` block from default white (`#fff`) to warm beige (`#f5f0e8`). Dev server running, hard refresh done, server restarted — still showed old white theme.

### Investigation

Used Chrome DevTools to inspect computed styles on `document.documentElement`:

- `--background` resolved to `lab(100% 0 0)` (pure white), not `#f5f0e8`
- `--color-background` (Tailwind theme mapping) was empty
- Enumerated all stylesheet rules — the compiled CSS at `_next/static/chunks/[root-of-the-server]__*.css` contained `:root { --background: #fff }` (old defaults)
- Our `#f5f0e8` values were **completely absent** from the compiled output
- Source `globals.css` had the correct values — the compilation was stale

### Root Cause

Turbopack (Next.js 16's bundler) caches compiled CSS in `.next/`. Changes to CSS custom properties in `:root` don't always invalidate this cache. Simply restarting `pnpm dev` doesn't clear `.next/` — the stale compiled output persists.

### Fix

```bash
rm -rf .next && pnpm dev
```

Added a convenience script to `package.json`:

```json
"dev:clean": "rm -rf .next && next dev"
```

### When to Use `dev:clean`

- After changing CSS variables in `:root` or `.dark` blocks
- After modifying `@theme inline` mappings
- After updating font imports in `layout.tsx`
- Whenever visual changes in `globals.css` don't appear after hard refresh

For normal component/page changes, regular `pnpm dev` is fine.

### Detection Tip

If styles look wrong, open DevTools and check computed CSS variables on `document.documentElement`:

```js
getComputedStyle(document.documentElement).getPropertyValue('--background');
```

If the value doesn't match your source CSS, it's a stale cache.

---

## Problem 2: CVA Button Variant Inheritance

### Symptom

Changed base button font from `text-sm` to `text-base` in CVA config. All `size="sm"` buttons (~25 across the app) rendered at 16px in `h-8` containers instead of 14px.

### Root Cause

The `sm` size variant in CVA didn't have an explicit `text-sm` class — it inherited from the base. When the base changed to `text-base`, the `sm` variant silently grew.

### Fix

Added explicit `text-sm` to the `sm` size variant:

```tsx
sm: 'h-8 rounded-md gap-1.5 px-3 text-sm has-[>svg]:px-2.5',
```

### Rule

When modifying CVA base styles, audit all variants for implicit inheritance. Size-specific variants should explicitly declare font-size, padding, and any property that the base change affects.

---

## Problem 3: Raw HTML vs Component Library

### Symptom

`RecordingList.tsx` used a raw `<input>` with hand-rolled focus styles, inconsistent with the `<Input>` component used everywhere else.

### Fix

```tsx
// Before: raw input with manual styling
<input className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card
  text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2
  focus:ring-ring/50" />

// After: component library primitive
<Input type="text" placeholder="Search recordings..." className="pl-10 bg-card" />
```

### Rule

Always use `<Input>`, `<Button>`, `<Select>` from `@/components/ui/` instead of raw HTML elements. The component handles focus rings, aria-invalid states, dark mode, and consistent sizing.

---

## Problem 4: Redundant Computation

### Symptom

```tsx
const totalFiltered = filtered.reduce((sum, g) => sum + g.recordings.length, 0);
// Used as: totalFiltered === 0
```

### Root Cause

`groupByDate()` already filters out empty groups during construction. An array with `length === 0` directly indicates no results.

### Fix

```tsx
// Removed the reduce entirely
if (filtered.length === 0) {
  /* show empty state */
}
```

### Rule

Check upstream functions before adding aggregation. If the data is pre-filtered, a `.length` check suffices over `.reduce()`, `.some()`, or `.filter()`.

---

## Prevention Strategies

| Issue                   | Prevention                                    | Detection                             |
| ----------------------- | --------------------------------------------- | ------------------------------------- |
| Turbopack stale cache   | Use `pnpm dev:clean` for CSS variable changes | Check computed styles in DevTools     |
| CVA variant inheritance | Explicit overrides in all size variants       | Visual regression tests per variant   |
| Component inconsistency | Always import from `@/components/ui/`         | Code review checklist                 |
| Redundant computation   | Check upstream filtering before aggregating   | Code review: "Can this be `.length`?" |

## Related Files

- `src/app/globals.css` — TailwindCSS 4 theme variables
- `src/components/ui/button.tsx` — CVA button variants
- `src/components/ui/input.tsx` — Standardized Input component
- `postcss.config.mjs` — TailwindCSS 4 PostCSS plugin
- `next.config.ts` — No Turbopack-specific cache settings available

## Related Documentation

- `docs/institutional-learnings/cedar-essence-findings.md` — Architectural patterns
- `AUDIT.md` — Full project audit
