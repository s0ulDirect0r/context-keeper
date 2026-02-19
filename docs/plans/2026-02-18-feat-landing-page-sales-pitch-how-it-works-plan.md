---
title: 'feat: Add sales pitch section and update How it works copy'
type: feat
date: 2026-02-18
---

# Add Sales Pitch Section and Update How It Works Copy

## Overview

Add a new "mini sales pitch" section between the hero and "How it works" on the landing page, and update the "How it works" step copy. The goal is to make the landing page feel more alive — show we understand the target user and care about the product even in beta.

## File to Modify

`src/components/LandingPage.tsx` — this is the only file that needs changes.

## Section 1: Sales Pitch (NEW — insert between hero and HowItWorksSection)

### Title Options (PM provided three — pick one or combine)

The PM listed these as a group:

- "For the ones who manage context"
- "Memory has limits. Meaning doesn't."
- "Built for the gap"

**Recommended approach:** Use "For the ones who manage context" as the `h2` heading, "Memory has limits. Meaning doesn't." as the tagline/subtitle, and let "Built for the gap" inform the closing line (Cedar is built for that gap — already in the body copy).

### Body Copy (preserve the rhythm — each line is intentional)

```
We know the challenge of being the person who exists between various contexts.
The weaver, the space-holder, the context artist.
The connective tissue.
You're someone who not only participates in meetings but also tracks the room.
Who looks back, who sits with what happened, who tries to understand what it meant.
You're the one who's managing the context gap.
You know who needs to be briefed, who might need to be filled in, or what needs to be remembered.
You're also the one with limited memory, energy and a busy schedule.
Cedar is built for that gap.
It's an external memory that thinks like you so you can quickly get to the relevant information from each meeting.
For yourself or for others so that the meaning doesn't have to live only in your imperfect recollection of it.
```

### Implementation Notes

- [x] Create `SalesPitchSection` component (private, like `HowItWorksSection`)
- [x] Use `<section className="py-12 px-4">` to match existing section rhythm
- [x] Constrain width: `max-w-2xl mx-auto` (match hero, not the wider `max-w-3xl` of How it works)
- [x] Heading: `h2` with `text-2xl font-bold tracking-tight` (Fraunces auto-applies via globals)
- [x] Tagline: `text-lg text-muted-foreground` for "Memory has limits. Meaning doesn't."
- [x] Body: Each line rendered as its own element for breathing room — use a `space-y-1` or `space-y-2` container with `<p>` elements
- [x] Body text style: `text-sm text-muted-foreground leading-relaxed` for the gentle, readable pace
- [x] The closing 2 lines ("Cedar is built for that gap" and "It's an external memory...") should have slightly stronger emphasis — `text-foreground` instead of `text-muted-foreground`
- [x] No background color difference from page — let it breathe as clean text on `bg-background`
- [x] Center-aligned to match hero section

### Heading Hierarchy

Current page: `h1` (Cedar) → `h2` (Turn your meeting...) → `h2` (How it works)

New: `h1` (Cedar) → `h2` (Turn your meeting...) → `h2` (For the ones who manage context) → `h2` (How it works)

This is semantically correct — parallel `h2` sections under the page title.

## Section 2: How It Works (UPDATE existing copy)

Update the `steps` array at the top of the file:

```typescript
const steps = [
  {
    icon: FileText,
    title: 'Import',
    description: 'Paste a transcript or connect with your Otter.ai',
  },
  {
    icon: Users,
    title: 'Add context',
    description: 'Tell Cedar what you want to get from the meeting and why',
  },
  {
    icon: Sparkles,
    title: 'Get a summary',
    description: 'Shaped in the way that is most useful to you and share-able with others',
  },
] as const;
```

Changes from current:

- Step 1 description: "Paste a transcript or connect Otter.ai" → "Paste a transcript or connect with your Otter.ai"
- Step 2 title: "Tell us who it's for" → "Add context"
- Step 2 description: "Pick a template or describe your audience" → "Tell Cedar what you want to get from the meeting and why"
- Step 3 title: "Get your summary" → "Get a summary"
- Step 3 description: "Tailored to exactly what they need" → "Shaped in the way that is most useful to you and share-able with others"

## Acceptance Criteria

- [x] New sales pitch section appears between hero CTA buttons and "How it works"
- [x] Sales pitch copy matches PM text exactly (line-by-line rhythm preserved)
- [x] "How it works" step titles and descriptions updated to new copy
- [x] Styling uses design system tokens only (no hardcoded colors/fonts)
- [x] Responsive: reads well on mobile (single column, appropriate text sizes)
- [x] Semantic heading hierarchy maintained (`h2` for section titles)
- [x] No regressions to existing landing page behavior (CTA buttons still work)

## Design System Reference

- Color tokens: `text-foreground` (#2c2418), `text-muted-foreground` (#8a7e6e), `bg-muted/30` (#ebe4d8 at 30%)
- Typography: Fraunces (serif) auto-applies to headings, Geist Sans for body
- Spacing: `py-12 px-4` for section padding, `space-y-{n}` for vertical rhythm
- Full reference: `docs/patterns/warm-beige-design-system.md`
