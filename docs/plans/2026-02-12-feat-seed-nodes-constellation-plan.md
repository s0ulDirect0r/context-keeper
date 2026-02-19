---
title: 'feat: Add Seed Nodes to Constellation'
type: feat
date: 2026-02-12
brainstorm: docs/brainstorms/2026-02-12-seeds-constellation-brainstorm.md
---

# Add Seed Nodes to Constellation

## Overview

Add Seed nodes to the constellation graph so that summaries appear as subtle origin/anchor points with Pearls visually sprouting from them. The constellation currently shows Pearls → Decisions → Actions without roots. Seeds give everything a visible starting point.

**Visual story:** Seed → Pearls → Decisions → Actions

## Problem Statement

The constellation shows evidence (Pearls), hypotheses (Decisions), and next steps (Actions) — but not where any of it came from. There's no visual connection between "I processed this meeting" and "these insights grew from it." Seeds close that gap by making the input visible alongside the output.

## Proposed Solution

Treat each summary row as a Seed. No new database table — the `summaries` table already has everything needed (`id`, `title`, `created_at`). Create seed nodes in the constellation graph, connect them to their child pearls via a new `sprouts` edge type, and render them as subtle anchor nodes.

### Design Decisions

| Decision                 | Choice                              | Rationale                                                                                   |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Data source              | Existing `summaries` table          | No DB migration needed. Each summary IS a seed.                                             |
| Node visual              | Subtle anchor (smaller than pearls) | Seeds are roots, not flowers. Pearl/Decision cards remain the focus.                        |
| Edge type                | `sprouts` (new)                     | Visually distinct from `supports`/`contradicts`/`derives`. Lighter, dotted.                 |
| Seed fields on node      | `summaryTitle`, `summaryDate`       | Minimal — sidebar lookup for full detail.                                                   |
| Guest experience         | Seeds are auth-only                 | Guest localStorage doesn't store summary metadata. Accept this gap; guest prompt unchanged. |
| Orphan seeds (no pearls) | Show at reduced opacity             | Still valid planted evidence. Dim/faded via CSS opacity.                                    |
| Seed dismissal           | Not dismissable                     | Dismissing a seed would orphan its subtree. Prevent confusion.                              |
| Team mock data           | Add mock seeds                      | Keep personal/team views consistent.                                                        |
| Highlight param          | Auto-select seed after surfacing    | `/constellation?highlight={summaryId}` focuses the new seed.                                |

## Technical Approach

### Files to Modify (10 total)

| File                                                 | Change                                                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/types/cedar.ts`                             | Add `'seed'` to `ConstellationNodeType`, add seed fields to `ConstellationNode`, add `'sprouts'` to edge type, add `summaries` to `EnrichedConstellationResponse` |
| `src/lib/constellation.ts`                           | Add `SummaryRow` interface, extend `PearlRow` with `summary_id`, update `buildConstellationData()` and `buildEnrichedResponse()` signatures                       |
| `src/lib/constellation-layout.ts`                    | Add `seed` to `NODE_DIMENSIONS`, add `sprouts` edge styling to `toReactFlowEdge()`                                                                                |
| `src/components/constellation/nodes/SeedNode.tsx`    | **New file** — seed anchor node component                                                                                                                         |
| `src/components/constellation/ConstellationFlow.tsx` | Import + register `SeedNode` in `nodeTypes`                                                                                                                       |
| `src/components/constellation/DetailSidebar.tsx`     | Add seed detail section + header label                                                                                                                            |
| `src/app/api/constellation/route.ts`                 | Add summaries fetch, pass to build functions                                                                                                                      |
| `src/app/api/constellation/surface/route.ts`         | Add summaries fetch to `buildAndReturnConstellation()`                                                                                                            |
| `src/app/constellation/ConstellationClient.tsx`      | Destructure + store summaries from enriched response, pass to sidebar                                                                                             |
| `src/lib/mock-team-data.ts`                          | Add mock seed nodes + sprouts edges                                                                                                                               |

### Phase 1: Type System + Data Layer

Update types and the constellation builder to support seeds.

- [x] **`src/lib/types/cedar.ts`** — Type system changes
  - Add `'seed'` to `ConstellationNodeType` union (line 78)
  - Add seed-specific optional fields to `ConstellationNode`: `summaryTitle?: string`, `summaryDate?: string`
  - Add `'sprouts'` to `ConstellationEdge.type` union (line 107)
  - Add `summaries: Record<string, SeedSummary>` to `EnrichedConstellationResponse`
  - Define `SeedSummary` interface: `{ id: string; title: string; createdAt: string; pearlCount: number }`

- [x] **`src/lib/constellation.ts`** — Builder changes
  - Add `SummaryRow` interface: `{ id: string; title: string; created_at: string }`
  - Add `summary_id: string` to `PearlRow` interface (line 17)
  - Update `buildConstellationData()` signature to accept `summaries: SummaryRow[]` as first param
  - Create seed nodes from summary rows (`type: 'seed'`, `size: 10`, recency computed)
  - Build `sprouts` edges: for each pearl, create edge from `pearl.summary_id` → `pearl.id`
  - Update `buildEnrichedResponse()` to accept and include summary metadata
  - Compute `pearlCount` per summary for the enriched response

### Phase 2: Layout + Visual

Add seed dimensions to the layout engine and style the new edge type.

- [x] **`src/lib/constellation-layout.ts`** — Layout changes
  - Add `seed: { width: 200, height: 60 }` to `NODE_DIMENSIONS` (compact: title + date only)
  - Add `sprouts` case to `toReactFlowEdge()`: light gray (`#d1d5db`), dotted stroke, `strokeWidth: 1`, `opacity: 0.5`
  - Dagre `rankdir: 'TB'` already positions parent nodes above children — seeds naturally sit at top

- [x] **`src/components/constellation/nodes/SeedNode.tsx`** — New component
  - Props: `{ data: ConstellationNode; selected: boolean }` (standard pattern)
  - Renders: compact card with `data.summaryTitle` + formatted `data.summaryDate`
  - Color: muted earth tone — `border-stone-300` / `bg-stone-50` (warm gray, soil metaphor)
  - Selected state: `border-stone-500 ring-2 ring-stone-200`
  - Orphan seeds (no pearls): `opacity-50` class when `data.pearlCount === 0` (faded but present)
  - Handles: `Target` top (invisible), `Source` bottom (invisible)
  - Width: `w-50` (~200px)

- [x] **`src/components/constellation/ConstellationFlow.tsx`** — Register node type
  - Import `SeedNode` from `./nodes/SeedNode`
  - Add `seed: SeedNode` to `nodeTypes` map (line 25)

### Phase 3: API + Client

Wire up data fetching and sidebar rendering.

- [x] **`src/app/api/constellation/route.ts`** — Add summaries fetch
  - Add to the parallel `Promise.all`: `supabase.from('summaries').select('id, title, created_at').eq('user_id', user.id)`
  - Add `summary_id` to the pearls select: `select('id, concepts, insight, quote, summary_id, created_at')`
  - Pass summary rows to `buildConstellationData()` and `buildEnrichedResponse()`

- [x] **`src/app/api/constellation/surface/route.ts`** — Same changes
  - Update `buildAndReturnConstellation()` (or equivalent) to fetch summaries
  - Pass to builder functions

- [x] **`src/app/constellation/ConstellationClient.tsx`** — Client changes
  - Destructure `summaries` from enriched response alongside decisions/actions/pearls
  - Store in state: `const [summaries, setSummaries] = useState<Record<string, SeedSummary>>({})`
  - Pass `summaries` to `DetailSidebar` as prop

- [x] **`src/components/constellation/DetailSidebar.tsx`** — Seed detail
  - Add `summaries` prop (optional `Record<string, SeedSummary>`)
  - Add `'Seed'` to the header label ternary chain
  - Add seed detail block: title, creation date (formatted), pearl count, "View summary →" link
  - No dismiss button on seed nodes (seeds are not dismissable)

### Phase 4: Team Mock Data + Polish

- [x] **`src/lib/mock-team-data.ts`** — Add mock seeds
  - Add 2-3 seed nodes to `MOCK_TEAM_CONSTELLATION` with contributor names
  - Add `sprouts` edges connecting mock seeds to existing mock pearl nodes
  - Ensure mock pearl nodes get a `summary_id`-style reference back to mock seeds

- [x] **Build verification** — `pnpm build` passes, no type errors
- [ ] **Manual verification** — Create summary → visit constellation → see seed node → click → sidebar detail → pearls sprout from seed

## Acceptance Criteria

### Functional

- [ ] Each user summary appears as a seed node in the constellation
- [ ] Pearls connect to their parent seed via `sprouts` edges
- [ ] Seed nodes render as subtle anchor cards (title + date, earth-tone color)
- [ ] Clicking a seed opens the detail sidebar with title, date, pearl count, and summary link
- [ ] Seeds with no pearls appear faded but present
- [ ] Seeds cannot be dismissed
- [ ] Team view shows mock seed nodes
- [ ] Surfacing flow highlights the new seed after completion
- [ ] Graph hierarchy is Seed → Pearl → Decision → Action (top to bottom)

### Non-Functional

- [ ] No database migration required
- [ ] `pnpm build` passes with no type errors
- [ ] Constellation API response remains performant (summaries fetch adds only `id, title, created_at`)
- [ ] Guest constellation works without regression (no seeds, no errors)

## Edge Cases

| Case                                           | Expected Behavior                                             |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Summary with 0 pearls                          | Seed appears faded (`opacity-50`), isolated node              |
| Summary with 30+ pearls                        | Dagre lays out wide tree; accept default layout               |
| Decision linked to pearls from different seeds | Cross-tree edges render normally                              |
| 20+ summaries                                  | Horizontal spread; fitView on mount; MiniMap for navigation   |
| Guest user                                     | No seed nodes; constellation shows decisions only (unchanged) |
| Deleted summary (cascade)                      | Pearls cascade-delete; seed disappears on next fetch          |
| Surface route                                  | Returns constellation with seed nodes included                |

## Dependencies

No new packages required. Uses existing:

- `@xyflow/react` — React Flow graph
- `@dagrejs/dagre` — Layout engine

## References

- Brainstorm: `docs/brainstorms/2026-02-12-seeds-constellation-brainstorm.md`
- Constellation redesign plan: `docs/plans/2026-02-11-feat-constellation-react-flow-redesign-plan.md`
- Type definitions: `src/lib/types/cedar.ts:78-123`
- Builder functions: `src/lib/constellation.ts:70-226`
- Layout config: `src/lib/constellation-layout.ts:6-11`
- Node components: `src/components/constellation/nodes/`
- API route: `src/app/api/constellation/route.ts`
- Detail sidebar: `src/components/constellation/DetailSidebar.tsx`
- CEDAR vision spec: `CEDAR_SPEC.md:51-58` (Seeds section)
- CEDAR build spec: `CEDAR_BUILD_SPEC.md:19` (Seeds as v2 note)
