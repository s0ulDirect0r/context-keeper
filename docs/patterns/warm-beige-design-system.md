---
title: 'Warm Beige Design System: Color, Typography & Recording Picker'
date: 2026-02-17
category: design-system
tags:
  - tailwindcss-4
  - typography
  - color-palette
  - next-font
  - shadcn-ui
  - cva
  - useMemo
  - date-grouping
pr: 32
branch: style-experiment
components:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/LandingPage.tsx
  - src/components/NavBar.tsx
  - src/components/RecordingList.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
---

# Warm Beige Design System

Implementation patterns from PR #32 — replacing the default shadcn/ui gray theme with a warm beige palette, adding Fraunces serif headings, and redesigning the recording picker.

## 1. Custom Color Palette in TailwindCSS 4

Replace shadcn/ui's default oklch grayscale with hex values in the `:root` block. The `@theme inline` block maps CSS variables to Tailwind utilities.

### The Palette

| Token                                  | Hex       | Role                         |
| -------------------------------------- | --------- | ---------------------------- |
| `--background`                         | `#f5f0e8` | Warm beige page background   |
| `--foreground`                         | `#2c2418` | Dark brown text              |
| `--card`                               | `#faf6f0` | Cream card surfaces          |
| `--primary`                            | `#2c2418` | Primary actions (dark brown) |
| `--primary-foreground`                 | `#f5f0e8` | Text on primary              |
| `--secondary` / `--muted` / `--accent` | `#ebe4d8` | Light tan secondary surfaces |
| `--muted-foreground`                   | `#8a7e6e` | Subtle text (gray-tan)       |
| `--border` / `--input`                 | `#d9d0c2` | Borders and input outlines   |
| `--ring`                               | `#8a7e6e` | Focus rings                  |

### How It Works

```css
/* globals.css */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --font-serif: var(--font-fraunces);
  /* ... all semantic color mappings ... */
}

:root {
  --background: #f5f0e8;
  --foreground: #2c2418;
  --card: #faf6f0;
  /* ... */
}
```

The two-layer system: CSS variables define the palette, `@theme inline` maps them to Tailwind utilities (`bg-background`, `text-foreground`, etc.). Change one variable, all utilities update.

### Extending

To add a new semantic color (e.g., `--success`):

1. Add to `:root`: `--success: #2d6a4f;`
2. Add to `@theme inline`: `--color-success: var(--success);`
3. Use in components: `bg-success text-success-foreground`

### Watch Out For

- **Dark mode not updated** — `.dark` block still uses oklch grayscale. If adding dark mode, create matching warm-tone dark values.
- **Mixed color formats** — `--destructive` and `--chart-*` are still oklch. Fine for now, but normalize if the palette grows.
- **Turbopack cache** — CSS variable changes don't always invalidate `.next/`. Use `pnpm dev:clean` after editing `:root`. See `docs/solutions/build-errors/turbopack-stale-css-cache.md`.

---

## 2. Display Font via next/font/google

### Setup Steps

```tsx
// layout.tsx
import { Geist, Geist_Mono, Fraunces } from 'next/font/google';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
});

// Add to body className
<body className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}>
```

```css
/* globals.css — register with Tailwind */
@theme inline {
  --font-serif: var(--font-fraunces);
}

/* Apply to all headings globally */
@layer base {
  body {
    font-family: var(--font-geist-sans), sans-serif;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: var(--font-fraunces), serif;
  }
}
```

### Why This Pattern

- **Self-hosted** — `next/font/google` downloads fonts at build time. No runtime requests to Google CDN.
- **CSS variable binding** — The `variable` prop creates `--font-fraunces` automatically, decoupling definition from usage.
- **Fallback chain** — `var(--font-fraunces), serif` degrades gracefully if the variable isn't loaded.
- **Single source** — Changing the serif font means updating one import and one variable.

### Adding Another Font

Same pattern: import, initialize with `variable`, add to body className, register in `@theme inline`.

---

## 3. Typography Pairing: Serif Headings + Sans Body

**Fraunces** (display serif) for headings, brand, and card titles. **Geist** (sans-serif) for body text, form labels, and metadata.

### Where Serif Applies

| Element            | How                                  | Why                                   |
| ------------------ | ------------------------------------ | ------------------------------------- |
| All `h1`–`h6`      | Global `@layer base` rule            | Automatic — every heading gets serif  |
| `CardTitle`        | `font-serif` class in base component | Renders as `<div>`, not a heading tag |
| Nav logo ("Cedar") | `font-bold text-2xl font-serif`      | Brand presence                        |

### When to Use `font-serif` Utility vs Global Rule

- **Global rule** catches all semantic headings automatically — you don't need to remember it per-component.
- **`font-serif` utility** is for non-heading elements that should look like headings (CardTitle, brand text).
- If you add a new component that renders headings via `<h2>`, `<h3>`, etc., the serif applies automatically. No action needed.

### Semantic Heading Hierarchy

The landing page had `<p>` for the brand name and `<h1>` for the subtitle. Fixed to proper hierarchy:

```tsx
// Before — broken hierarchy
<p className="text-5xl font-bold">Cedar</p>
<h1 className="text-4xl font-bold">Turn your meeting recordings...</h1>

// After — proper document outline
<h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Cedar</h1>
<h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-snug">
  Turn your meeting recordings into clear, useful insights
</h2>
```

This matters for accessibility (screen reader navigation), SEO, and ensures the global serif rule applies correctly.

---

## 4. Nav Bar Typography

The nav bar establishes visual hierarchy through font weight and size:

```tsx
// Logo: serif, bold, 2xl — the heaviest element
<Link href="/" className="font-bold text-2xl font-serif">Cedar</Link>

// Desktop nav: default size, semibold — prominent but secondary to logo
<Button variant="ghost" size="default" className="font-semibold">
  New Summary
</Button>

// Mobile nav: sm size — compact for tight layouts
<Button variant="ghost" size="sm" className="w-full justify-start">
  New
</Button>

// Auth buttons: sm size — tertiary
<Button variant="outline" size="sm">Sign out</Button>
```

Desktop buttons were bumped from `size="sm"` to `size="default"` with `font-semibold` for better touch targets and visual weight.

---

## 5. Recording Picker: Date Grouping + Search + Sticky Footer

### Data Pipeline

```
recordings → search filter → groupByDate → render grouped sections
```

All in one `useMemo`:

```tsx
const filtered = useMemo(() => {
  const q = search.toLowerCase();
  const list = q ? recordings.filter((r) => r.title.toLowerCase().includes(q)) : recordings;
  return groupByDate(list);
}, [recordings, search]);
```

### Date Grouping Pattern

Uses `Map<string, Recording[]>` with a predefined display order:

```tsx
function groupByDate(recordings: Recording[]): GroupedRecordings[] {
  const groups = new Map<string, Recording[]>();
  const order = ['Today', 'Yesterday', 'This Week', 'Last Week', 'Older'];

  for (const rec of recordings) {
    const group = getDateGroup(rec.createdAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(rec);
  }

  return order
    .filter((label) => groups.has(label)) // Skip empty groups
    .map((label) => ({ label, recordings: groups.get(label)! }));
}
```

The `order` array controls display order and the `.filter()` skips empty groups — no need for a separate count/reduce.

### Contextual Date Formatting

Recent recordings show time-of-day; older ones show the date:

```tsx
{
  group.label === 'Today' || group.label === 'Yesterday'
    ? formatTime(recording.createdAt) // "2:30 PM"
    : formatShortDate(recording.createdAt);
} // "Mon, Feb 10"
```

This saves space and aids scanning — you already know the day from the group header.

### Sticky Footer with Dynamic CTA

```tsx
<div className="sticky bottom-0 flex items-center gap-3 pt-2 pb-4 border-t bg-background">
  <Button variant="ghost" onClick={onBack}>
    Back
  </Button>
  {selected.size > 0 && (
    <span className="text-sm text-muted-foreground">{selected.size} selected</span>
  )}
  <Button className="flex-1" onClick={handleContinue} disabled={selected.size === 0}>
    {selected.size === 0
      ? 'Select recordings above'
      : `Let\u2019s go with ${selected.size === 1 ? 'this one' : `these ${selected.size}`}`}
  </Button>
</div>
```

The CTA text changes naturally: "Select recordings above" → "Let's go with this one" → "Let's go with these 3".

### When This Pattern Breaks Down

- **1000+ recordings** — client-side grouping gets slow. Move search/filter server-side.
- **Real-time updates** — frequent re-renders recalculate the memo. Add debouncing on the search input.
- **Complex filtering** — if you add type/tag/speaker filters, consider a filter object or URL query params rather than individual state variables.

---

## Related Documentation

- `docs/solutions/build-errors/turbopack-stale-css-cache.md` — Bugs encountered during this work
- `AUDIT.md` — Original design assessment ("clean but generic")
- `docs/institutional-learnings/cedar-essence-findings.md` — Product voice decisions
