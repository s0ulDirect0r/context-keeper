# Constellation UI Redesign

**Date:** 2026-02-11
**Status:** Ready for planning

## What We're Building

Replace the current D3 force-directed graph constellation with a tldraw-based infinite canvas. Nodes become rich HTML cards (not circles) arranged in deterministic tree layouts (not physics-floaty). Users can zoom, pan, rearrange nodes, and eventually annotate. Pearl clusters show preview content on the card and full detail (insights, quotes) in a sidebar.

## Why This Approach

### Problems with current implementation

- **Floaty physics** — nodes drift, settle, bounce. Feels imprecise and toy-like.
- **Empty circles** — no content on nodes. You have to click to see anything.
- **Pearl clusters don't surface content** — clicking a pearl cluster shows connected decisions but never the actual insights or quotes that make pearls valuable.
- **No user agency** — can't rearrange, annotate, or interact beyond clicking.

### Why tldraw SDK

- Full infinite canvas UX (zoom, pan, minimap, selection) out of the box
- Custom shapes render arbitrary React content — cards with badges, text, quotes
- Users can rearrange nodes and potentially draw connections/annotations
- Active, well-maintained open source with strong React integration
- Aligns with "thinking tool" vision — constellation as a workspace, not just a display

### Why trees (hybrid with cross-links)

- Hierarchy is real: pearls feed decisions, decisions spawn actions
- Tree layout communicates the causal flow clearly
- Cross-connections (pearl from Meeting A supports Decision B) shown as secondary edges between trees
- Deterministic layout — no simulation, nodes appear where they belong

## Key Decisions

1. **tldraw over React Flow** — tldraw provides the full canvas + drawing experience. React Flow is lighter but doesn't support annotation/drawing.

2. **Renderer-agnostic data layer** — Layout computation (Dagre) and the node/edge data model live in a separate module from tldraw rendering. Both tldraw and React Flow consume the same `{nodes: [{id, position, data}], edges: [{source, target}]}` shape. This makes swapping renderers feasible if we want to explore React Flow later.

3. **Deterministic tree layout via Dagre** — No physics simulation. Dagre computes hierarchical positions. Nodes are placed once and stay put. Users can manually drag to override.

4. **Rich card nodes** — Each node type (pearl-cluster, decision, action) gets a custom tldraw shape rendered as a card:
   - **Pearl cluster card:** Concept label, pearl count badge, top 1-2 insight previews
   - **Decision card:** Statement text, confidence badge, status indicator
   - **Action card:** Description, status badge, assignee (team view)

5. **Detail on click: card preview + sidebar full detail** — Cards show summary content. Clicking opens sidebar with complete data (all insights, all quotes, all linked nodes).

6. **Pearl sidebar must show insights and quotes** — The current sidebar shows connected decisions but never the pearl content itself. This is the most critical UX gap to fix.

7. **Cross-tree edges** — Secondary dotted/curved lines connecting nodes across different summary trees. Lower visual weight than tree edges.

## Architecture Sketch

```
src/lib/constellation-layout.ts    # Dagre tree layout computation (renderer-agnostic)
  Input:  ConstellationData (nodes + edges)
  Output: LayoutResult { nodes: [{id, x, y, width, height, data}], edges: [{...}] }

src/components/constellation/
  TldrawCanvas.tsx                 # tldraw <Tldraw> wrapper, registers custom shapes
  shapes/
    PearlClusterShape.tsx          # Custom tldraw shape: pearl cluster card
    DecisionShape.tsx              # Custom tldraw shape: decision card
    ActionShape.tsx                # Custom tldraw shape: action card
  DetailSidebar.tsx                # Richer sidebar — shows insights, quotes, connections
  Graph.tsx                        # DELETE (replaced by TldrawCanvas)
```

## Data Flow

1. `ConstellationClient` fetches `ConstellationData` from API (unchanged)
2. `constellation-layout.ts` computes tree positions via Dagre
3. `TldrawCanvas` receives positioned nodes, creates tldraw shapes
4. User interacts (click, drag, zoom, pan)
5. Click fires → updates sidebar with full node detail
6. Manual repositioning persisted in tldraw's internal store (ephemeral, not saved to DB yet)

## Open Questions

- **Should user-rearranged positions persist across sessions?** Could save layout to localStorage or DB. Not needed for v1 but worth considering.
- **How should team view work on the canvas?** Contributor badges on cards? Color-coded borders? Separate spatial regions?
- **tldraw bundle size impact** — Need to measure. If too heavy, could lazy-load the constellation page.
- **Pearl data in API response** — Current `/api/constellation` returns pearl clusters (concept + count) but not individual pearl insights/quotes. Sidebar needs richer data — either expand the API response or fetch on click.

## Alternatives Considered

| Option               | Why not                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| React Flow           | Lighter, but no drawing/annotation. Doesn't fulfill "thinking tool" vision. Kept as fallback via renderer-agnostic data layer.    |
| tldraw + ELKjs       | Best layout engine for complex hierarchies, but over-engineered for current data volume. Can swap in Dagre → ELK later if needed. |
| Keep D3, fix physics | Doesn't address the core issues: empty circles, no card content, no user manipulation.                                            |

## Success Criteria

- Nodes are cards with readable content (not empty circles)
- Layout is deterministic tree — no settling/drifting
- Pearl clusters show insights and quotes when clicked
- Users can pan, zoom, rearrange nodes
- Cross-tree connections are visible but visually secondary
- Swapping to React Flow renderer is possible without rewriting data/layout layer
