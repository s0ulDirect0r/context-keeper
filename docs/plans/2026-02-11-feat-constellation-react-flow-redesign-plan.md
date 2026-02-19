---
title: 'feat: Constellation React Flow Redesign'
type: feat
date: 2026-02-11
brainstorm: docs/brainstorms/2026-02-11-constellation-redesign-brainstorm.md
---

# Constellation React Flow Redesign

## Overview

Replace the D3 force-directed graph constellation with a React Flow node graph. Nodes become rich HTML cards arranged in deterministic tree layouts via Dagre. Pearl clusters show insight previews on cards and full detail (insights, quotes) in sidebar. Users can zoom, pan, and rearrange nodes.

## Problem Statement

The current constellation has four UX problems:

1. **Floaty physics** — nodes drift, settle, bounce. Feels imprecise.
2. **Empty circles** — no content on nodes. Must click to see anything.
3. **Pearl clusters don't surface content** — clicking shows connected decisions but never the actual insights or quotes.
4. **No user agency** — can't rearrange or interact beyond clicking.

## Proposed Solution

- **React Flow** (`@xyflow/react`) for the node graph canvas (zoom, pan, selection, drag)
- **Dagre** (`@dagrejs/dagre`) for deterministic top-down tree layout
- **Custom React Flow nodes** for pearl cluster, decision, and action cards
- **Renderer-agnostic layout module** — layout computed separately, fed to React Flow
- **New pearl detail endpoint** for lazy-loading insights/quotes on click
- **MIT licensed** — no watermark, no commercial license concerns

## Technical Approach

### Architecture

```
src/lib/constellation-layout.ts       # Dagre layout (renderer-agnostic)
  Input:  ConstellationData
  Output: LayoutResult { nodes: [{id, position, data}], edges: [{id, source, target}] }

src/components/constellation/
  ConstellationFlow.tsx                # React Flow wrapper + layout orchestration
  nodes/
    PearlClusterNode.tsx               # Custom node: concept + count + insight preview
    DecisionNode.tsx                   # Custom node: statement + confidence + status
    ActionNode.tsx                     # Custom node: description + status
  DetailSidebar.tsx                    # Enhanced sidebar — lazy-loads pearl insights/quotes
  Graph.tsx                            # DELETE after migration

src/app/api/constellation/
  route.ts                             # GET — existing (expand pearl select)
  surface/route.ts                     # POST — existing, unchanged
  cluster/[concept]/route.ts           # GET — NEW: individual pearls for a concept
```

### Data Flow

```
ConstellationClient fetches ConstellationData (unchanged)
  ↓
constellation-layout.ts computes Dagre tree positions
  ↓
ConstellationFlow renders React Flow with positioned nodes + edges
  ↓
User clicks card → onNodeClick → sidebar opens with node detail
  ↓
Pearl sidebar lazy-loads detail via GET /api/constellation/cluster/{concept}
```

### Key Design Decisions

| Decision              | Choice                           | Rationale                                                           |
| --------------------- | -------------------------------- | ------------------------------------------------------------------- |
| Graph library         | React Flow (`@xyflow/react`)     | MIT, ~150KB, purpose-built for node UIs, custom nodes with React    |
| Layout engine         | Dagre (`@dagrejs/dagre`)         | Simple, fast (<50ms for 200 nodes), handles disconnected trees      |
| Pearl detail loading  | Lazy on click                    | Keeps initial payload small; sidebar fetches on demand              |
| Sidebar behavior      | Overlay (not push)               | Avoids layout shifts with user-positioned cards                     |
| Drag persistence      | Ephemeral (session only)         | Positions reset on reload. Avoids persistence layer for v1.         |
| Layout re-application | Dagre on initial load only       | User drags preserved until reload. "Reset layout" button available. |
| Guest surfacing       | Show "sign in" message           | Don't attempt client-side workaround                                |
| Code splitting        | `next/dynamic` with `ssr: false` | React Flow needs DOM; isolates bundle from other routes             |

### React Flow Integration Pattern

```tsx
// ConstellationFlow.tsx (simplified)
'use client';

import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PearlClusterNode } from './nodes/PearlClusterNode';
import { DecisionNode } from './nodes/DecisionNode';
import { ActionNode } from './nodes/ActionNode';

const nodeTypes = {
  'pearl-cluster': PearlClusterNode,
  decision: DecisionNode,
  action: ActionNode,
};

export function ConstellationFlow({ data, onNodeClick }) {
  const { nodes, edges } = computeLayout(data); // Dagre positions

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      minZoom={0.2}
      maxZoom={4}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

```tsx
// nodes/PearlClusterNode.tsx (simplified)
import { Handle, Position } from '@xyflow/react';

export function PearlClusterNode({ data }) {
  return (
    <div className="rounded-xl border-2 border-amber-400 bg-white dark:bg-zinc-900 p-4 shadow-sm w-56">
      <Handle type="target" position={Position.Top} className="invisible" />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-600 font-semibold">{data.concept}</span>
        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">
          {data.pearlCount} pearls
        </span>
      </div>
      {data.insights?.slice(0, 2).map((insight, i) => (
        <p key={i} className="text-xs text-muted-foreground truncate">
          {insight}
        </p>
      ))}
      <Handle type="source" position={Position.Bottom} className="invisible" />
    </div>
  );
}
```

### Implementation Phases

#### Phase 1: Foundation — React Flow + Dagre + Basic Cards

Set up the graph infrastructure and get nodes rendering in tree layout.

**Tasks:**

- [ ] Install `@xyflow/react` and `@dagrejs/dagre` + `@types/dagre`
- [ ] Remove D3 dependencies: `d3-force`, `d3-selection`, `d3-zoom`, `d3-drag`, `d3-transition` and their `@types/*`
- [ ] Create `src/lib/constellation-layout.ts` — renderer-agnostic Dagre layout
  - Input: `ConstellationData` (existing type)
  - Output: React Flow-compatible `{ nodes: Node[], edges: Edge[] }` with Dagre positions
  - Handle disconnected trees (multiple summaries) with component separation + gap
  - Convert Dagre center coords to top-left for React Flow
  - Pure function, no side effects
- [ ] Create `src/components/constellation/nodes/PearlClusterNode.tsx`
  - Custom React Flow node component
  - Renders: concept label, pearl count badge, 2-line insight preview (placeholder for now)
  - Amber border/accent, Handles for edge connections (invisible but functional)
- [ ] Create `src/components/constellation/nodes/DecisionNode.tsx`
  - Renders: statement text (truncated), confidence badge, status indicator
  - Blue border/accent; dashed border for low confidence
- [ ] Create `src/components/constellation/nodes/ActionNode.tsx`
  - Renders: description text, status badge (pending/in_progress/done)
  - Color varies by status (gray/amber/green)
- [ ] Create `src/components/constellation/ConstellationFlow.tsx`
  - `'use client'` component wrapping `<ReactFlow>`
  - Registers custom node types
  - Computes Dagre layout from `ConstellationData` prop
  - `onNodeClick` callback for sidebar integration
  - Includes `<Background>`, `<Controls>`, `<MiniMap>`
  - Preserve `data-testid="constellation-graph"` on container for test compat
- [ ] Update `src/app/constellation/ConstellationClient.tsx`
  - Replace `Graph` import with dynamic import of `ConstellationFlow`
  - `next/dynamic` with `{ ssr: false, loading: () => <Loader2 /> }`
  - Wire `onNodeClick` to existing `selectedNode` state
- [ ] Delete `src/components/constellation/Graph.tsx`

**Success criteria:** Constellation renders cards in tree layout. Nodes are positioned, not floating. Zoom/pan works. No D3 code remains.

#### Phase 2: Rich Cards + Sidebar Enhancement

Make cards informative and the sidebar useful.

**Tasks:**

- [ ] Create `src/app/api/constellation/cluster/[concept]/route.ts`
  - `GET` — returns individual pearls for a concept cluster
  - Auth required (RLS), rate limited
  - Response: `{ pearls: [{ id, insight, quote, concepts, created_at }] }`
  - Zod validation on concept param
- [ ] Expand `ConstellationNode` type: add optional `insights?: string[]` for clusters
- [ ] Update `src/lib/constellation.ts` — `buildConstellationData()`
  - Accept pearl rows with `insight` field (currently only `id, concepts, created_at`)
  - Populate `insights` array on cluster nodes (first 2 per concept, sorted by recency)
- [ ] Update `GET /api/constellation` route
  - Add `insight` to the pearl select query: `select('id, concepts, insight, created_at')`
  - Pass enriched pearl rows to `buildConstellationData()`
- [ ] Update pearl cluster card to show top 2 insight lines from data
- [ ] Enhance `DetailSidebar.tsx` for pearl clusters
  - On pearl cluster click: fetch `GET /api/constellation/cluster/{concept}`
  - Show all insights with quotes and speaker attributions
  - Loading state while fetching
  - Connected decisions (existing behavior, keep)
- [ ] Enhance decision card rendering
  - Show supporting pearl count badge
  - Status color coding on card border
- [ ] Enhance action card rendering
  - Show parent decision label
  - Status-based background tint
- [ ] Team view contributor badges on cards
  - Render contributor name/initials in card header when `contributor` field present

**Success criteria:** Pearl cluster cards show insight previews. Clicking a pearl cluster shows all insights + quotes in sidebar. Decision and action cards show rich metadata.

#### Phase 3: States, Flows, and Tests

Wire up all application states and ensure test coverage.

**Tasks:**

- [ ] Empty state — show "Your constellation is empty" + CTA (existing markup, render outside React Flow)
- [ ] Loading state — spinner while data fetches (existing, adjust for dynamic import loading)
- [ ] Error state — error message + retry button (existing)
- [ ] Surfacing flow — banner during `POST /api/constellation/surface`, nodes appear after
  - Clean URL params after surfacing completes (`router.replace`)
- [ ] Guest constellation — decision cards from localStorage, "Sign up to save" banner
- [ ] Guest surfacing — show "Sign in to surface decisions" message instead of silent failure
- [ ] Team view toggle — swap data, re-layout
  - Pass new `ConstellationData` to `ConstellationFlow`, Dagre re-computes
- [ ] "Reset layout" button — re-applies Dagre layout, clearing user drag positions
- [ ] Dark mode — card styles respect `dark:` theme (TailwindCSS classes)
- [ ] Edge styling
  - `supports` edges: solid, light gray
  - `contradicts` edges: dashed, red
  - `derives` edges: solid, light gray
  - Cross-tree edges: dotted, lower opacity
- [ ] Update all Playwright tests in `tests/constellation.spec.ts`
  - Preserve existing test semantics, update selectors if needed
  - Test card content visibility (insight text on pearl cards)
  - Test sidebar pearl detail loading
- [ ] Add test: pearl cluster sidebar shows insights and quotes
- [ ] Add test: decision card shows confidence badge
- [ ] Verify: `pnpm build` passes (no type errors)
- [ ] Verify: full Playwright suite passes

**Success criteria:** All existing constellation tests pass. New tests cover card content and sidebar detail. Build clean. All states work.

## Acceptance Criteria

### Functional Requirements

- [ ] Constellation renders cards (not circles) in a tree layout
- [ ] Pearl cluster cards show concept, count, and top insight previews
- [ ] Decision cards show statement, confidence badge, and status
- [ ] Action cards show description and status badge
- [ ] Clicking a pearl cluster opens sidebar with all insights, quotes, and connected decisions
- [ ] Clicking a decision opens sidebar with confidence, status, supporting pearls, and actions
- [ ] Clicking an action opens sidebar with status and parent decision
- [ ] Users can zoom and pan the canvas
- [ ] Users can drag cards to rearrange (ephemeral, session-only)
- [ ] "Reset layout" button re-applies Dagre tree layout
- [ ] Empty state, loading state, and error state all render correctly
- [ ] Surfacing flow works end-to-end for authenticated users
- [ ] Guest users see decision cards from localStorage + "sign up" prompt
- [ ] Team view shows contributor badges on cards
- [ ] Cross-tree edges render as secondary lines between trees

### Non-Functional Requirements

- [ ] React Flow bundle is code-split via `next/dynamic` — does not affect other routes
- [ ] Layout computation completes in <100ms for 200 nodes
- [ ] Graph renders smoothly with 100+ cards
- [ ] `pnpm build` passes with no type errors
- [ ] All existing Playwright tests pass (updated selectors where needed)

### Quality Gates

- [ ] Full Playwright test suite green
- [ ] New tests for pearl sidebar detail, card content visibility
- [ ] Manual verification: create summary → curate pearls → save → visit constellation → see cards with content

## Dependencies & Prerequisites

### Libraries to Add

| Package          | Version       | Purpose                    | Size Impact    |
| ---------------- | ------------- | -------------------------- | -------------- |
| `@xyflow/react`  | Latest stable | React Flow node graph      | ~150KB gzipped |
| `@dagrejs/dagre` | `^1.1.4`      | Tree layout computation    | ~30KB          |
| `@types/dagre`   | `^0.7.44`     | TypeScript types for dagre | Dev only       |

### Libraries to Remove

| Package                    | Reason                 |
| -------------------------- | ---------------------- |
| `d3-force`                 | Replaced by Dagre      |
| `d3-selection`             | Replaced by React Flow |
| `d3-zoom`                  | Replaced by React Flow |
| `d3-drag`                  | Replaced by React Flow |
| `d3-transition`            | Replaced by React Flow |
| `@types/d3-*` (5 packages) | No longer needed       |

### New Patterns Introduced

- `next/dynamic` with `{ ssr: false }` — first usage in codebase
- React Flow custom node components — React components as graph nodes

## Risk Analysis & Mitigation

| Risk                                        | Likelihood | Impact | Mitigation                                                                                |
| ------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------- |
| React Flow performance at 100+ custom nodes | Low        | Medium | React Flow is optimized for this. Test early. Custom nodes are standard React components. |
| Dagre layout quality for cross-tree edges   | Low        | Low    | Cross-tree edges render as simple lines. Acceptable for v1; ELKjs upgrade path exists.    |
| Next.js dynamic import hydration issues     | Low        | Low    | React Flow works with `ssr: false`. Well-documented pattern.                              |
| React Flow API changes                      | Low        | Low    | Stable, semver-compliant library with good docs.                                          |

## Future Considerations

- **Position persistence** — save user-arranged layouts to localStorage or DB
- **tldraw migration** — if annotation/drawing features are needed, renderer-agnostic layout layer makes swap feasible
- **Filtering** — show/hide node types, filter by date range or confidence
- **Search** — find and zoom to a specific decision or concept
- **ELKjs upgrade** — if layout quality needs improvement for dense cross-linked graphs
- **Keyboard navigation** — React Flow supports accessible keyboard interactions

## References & Research

### Internal References

- Current Graph component: `src/components/constellation/Graph.tsx` (243 lines, to be deleted)
- DetailSidebar: `src/components/constellation/DetailSidebar.tsx` (207 lines)
- Constellation types: `src/lib/types/cedar.ts:76-109`
- Data builder: `src/lib/constellation.ts:43-149` (`buildConstellationData`)
- API route: `src/app/api/constellation/route.ts`
- Surface route: `src/app/api/constellation/surface/route.ts`
- Tests: `tests/constellation.spec.ts` (9 tests), `tests/api/constellation-surface.spec.ts` (5 tests)
- Brainstorm: `docs/brainstorms/2026-02-11-constellation-redesign-brainstorm.md`

### External References

- React Flow docs: https://reactflow.dev
- React Flow custom nodes: https://reactflow.dev/learn/customization/custom-nodes
- React Flow + Dagre layout: https://reactflow.dev/examples/layout/dagre
- Dagre wiki: https://github.com/dagrejs/dagre/wiki
- @dagrejs/dagre npm: https://www.npmjs.com/package/@dagrejs/dagre

### Key Implementation Patterns

- Custom node: function component receiving `{ data }` prop, renders JSX with `<Handle>` components
- Layout: compute Dagre positions → map to React Flow `Node[]` with `position: { x, y }` → pass to `<ReactFlow>`
- Edge types: React Flow built-in edge types (`default`, `straight`, `step`, `smoothstep`) or custom
- Selection: `onNodeClick={(event, node) => setSelectedNode(node)}` callback
- Fit view: `<ReactFlow fitView>` auto-fits on mount
- Dagre coords: `node.x, node.y` are center; subtract `width/2, height/2` for React Flow top-left position
