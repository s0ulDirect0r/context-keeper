# Seeds in the Constellation

> Date: 2026-02-12
> Status: Brainstorm complete
> Next: `/workflows:plan` when ready to implement

---

## What We're Building

Add Seed nodes to the constellation graph so that summaries appear as origin points with Pearls visually sprouting from them. The constellation currently shows Pearls → Decisions → Actions floating without roots. Seeds give them roots.

**The visual story becomes:** Seed → Pearls → Decisions → Actions

Each Seed is a subtle anchor node — the soil, not the flower. It shows the title and date of the original evidence, and Pearls branch outward from it. This makes the constellation tell a narrative: "I planted this evidence, and here's what grew."

## Why This Approach

**Approach chosen:** Visual Seeds from existing summaries (no database changes).

**Why not a new seeds table?** The summaries table already contains everything we need — title, content, context, timestamps. The distinction between "seed" (input) and "summary" (output) is conceptual, not structural. A dedicated `seeds` table is the right long-term move (for notes, documents, conversations), but it's unnecessary for getting Seeds into the constellation right now.

**Why not enrich the summaries table?** Adding `seed_type` and `source` columns solves a problem we don't have yet. We only support transcripts today. When we add notes/documents/conversations, we'll likely want a proper `seeds` table anyway. No point adding half-measures.

**Principle:** Ship the visual metaphor now. Refactor the data model when multi-input types arrive.

## Key Decisions

1. **Seeds = summaries, visually reframed.** No DB changes. The constellation API fetches summaries alongside pearls/decisions/actions and creates seed nodes from them.

2. **Seeds are anchor nodes, not focal points.** Smaller, subtler nodes that serve as labeled origin points. Pearls and Decisions remain the visual stars. Seeds are roots — present but quiet.

3. **Seed → Pearl edges are a new edge type.** Edges from seed nodes to their child pearls use a `'sprouts'` relationship type, visually distinct from `supports`/`contradicts`/`derives`.

4. **Layout positions seeds as origins.** In the Dagre layout, seed nodes sit at the top/left of their pearl cluster, with pearls branching downward/outward.

5. **Sidebar shows seed detail on click.** Clicking a seed node opens the detail sidebar showing: title, date, pearl count, and a link to the full summary view.

## Scope

### In scope

- `seed` node type added to constellation type system
- `SeedNode` React Flow component
- `buildConstellationData()` accepts summary rows, emits seed nodes + seed→pearl edges
- Constellation API fetches summaries for the current user
- Dagre layout treats seeds as origin/root nodes
- Detail sidebar renders seed info on click
- Enriched response includes summary metadata for sidebar

### Out of scope

- New `seeds` database table
- Multi-input type detection (notes, documents, conversations)
- "Plant a Seed" entry UX redesign
- Seed editing or deletion from the constellation
- Guest localStorage changes (seeds are derived from summaries, which guests already have)

## Open Questions

1. **Edge visual for seed → pearl.** Should it be a different color/style than other edges? Suggestion: lighter, perhaps dotted, to convey "grew from" rather than "supports."
2. **Seed node content.** Just title + date? Or also show pearl count inline? Recommendation: title + date, with pearl count visible in the sidebar on click.
3. **Seeds with no pearls.** If a summary has no pearls (user discarded all), should the seed still appear? Recommendation: yes, as a dim/faded anchor — it's still planted evidence.
