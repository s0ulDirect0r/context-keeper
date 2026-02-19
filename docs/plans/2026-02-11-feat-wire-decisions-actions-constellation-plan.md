---
title: 'feat: Wire Decisions & Actions into Constellation Sidebar'
type: feat
date: 2026-02-11
brainstorm: docs/brainstorms/2026-02-11-wire-decisions-actions-brainstorm.md
---

# Wire Decisions & Actions into Constellation Sidebar

## Overview

The Decide and Act phases of Cedar's OODA loop are fully built (API routes, AI prompts, UI components, DB tables, guest persistence) but completely disconnected from the user experience. This plan wires them into the constellation sidebar, completing the strategic loop: Seed → Summary + Pearls → Decisions → Actions.

**Orphaned code being activated:**

- `DecisionCard.tsx` — accept/edit/dismiss UI (imported by nothing)
- `ActionList.tsx` + `ActionItem.tsx` — action display + status toggle (imported by nothing)
- `POST /api/actions/generate` — AI action generation (called by nothing)
- `POST /api/actions`, `PATCH /api/actions/[id]` — action CRUD (called by nothing)
- `generateActions()` in `cedar-ai.ts` (called by nothing)
- `saveGuestActions()`, `loadGuestActions()` in `cedar-storage.ts` (called by nothing)

## Problem Statement

Users can see decision nodes in the constellation graph but cannot interact with them. There is no way to accept, edit, or dismiss decisions. There is no way to generate or manage actions. The entire Decide→Act pipeline is visualization-only. Additionally, decision and action text is double-truncated (server-side 40-char cut + CSS `line-clamp`), making even the read-only view incomplete.

## Proposed Solution

Enhance the constellation `DetailSidebar` to become interactive when viewing decision nodes, using the existing orphaned components. Add state management and mutation callbacks to `ConstellationClient`. Enrich the constellation API response with full Decision/Action/Pearl objects so the sidebar has the data it needs.

## Technical Considerations

### Data Shape: Enriched Constellation Response

The current `/api/constellation` returns `{ nodes: ConstellationNode[], edges: ConstellationEdge[] }`. The sidebar needs full Decision objects (statement, reasoning, supportingPearls) and full Action objects (contextCard).

**New response shape:**

```typescript
// src/lib/types/cedar.ts — new type
interface EnrichedConstellationResponse {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  decisions: Record<string, Decision>; // keyed by decision ID
  actions: Record<string, Action[]>; // keyed by decision ID
  pearls: Record<string, Pearl>; // keyed by pearl ID (for DecisionCard evidence display)
}
```

The constellation route and `buildConstellationData` function will be extended to return this enriched shape. Pearl cluster lazy-fetching remains unchanged (larger payload, already works).

### State Management: ConstellationClient Callbacks

All mutation state lives in `ConstellationClient.tsx`. New state:

```typescript
// Alongside existing data/loading/error/selectedNode state
const [decisions, setDecisions] = useState<Record<string, Decision>>({});
const [actions, setActions] = useState<Record<string, Action[]>>({});
const [pearls, setPearls] = useState<Record<string, Pearl>>({});
const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
```

New callbacks passed to `DetailSidebar`:

```typescript
onAcceptDecision: (decisionId: string) => void
onDismissDecision: (decisionId: string) => void
onEditDecision: (decisionId: string, updates: { statement?: string; confidence?: DecisionConfidence }) => void
onGenerateActions: (decisionId: string) => void
onActionStatusChange: (actionId: string, newStatus: ActionStatus) => void
onAddAction: (decisionId: string, description: string) => void
```

### Optimistic Updates + Background Refetch

Pattern for each mutation:

1. **Optimistic update** — modify local `decisions`/`actions` maps immediately
2. **API call** — fire the PATCH/POST in the background
3. **Graph node update** — use React Flow's `setNodes` to update node data (status, label) without relayout
4. **Background refetch** — after mutation succeeds, refetch full constellation to reconcile
5. **Rollback on failure** — revert optimistic state, show error

For new nodes (action generation), add nodes/edges to the graph at positions relative to the parent decision node, then do a targeted relayout of the affected subtree.

### Security: Auth on Generate Endpoints

The SpecFlow analysis identified that `/api/decisions/generate` and `/api/actions/generate` lack auth, meaning unauthenticated users can trigger Claude API calls. **Add auth checks to both generate endpoints.** Guests cannot generate decisions or actions via AI — they see a "Sign up to generate actions" prompt instead.

### Dismissed State: Client-Side with localStorage

Per the spec, dismissed is client-only. To prevent dismissed decisions from reappearing on reload, persist dismissed IDs in localStorage under `cedar:dismissed-decisions`. This avoids a DB migration.

### Toast Library: Sonner

No toast system exists in the codebase. Install `sonner` for the dismiss undo flow and general mutation feedback (success/error).

## Acceptance Criteria

### Decision Interactions

- [ ] Clicking a decision node in the constellation opens the sidebar with the full `DecisionCard` (statement, reasoning, evidence, confidence badge, status badge)
- [ ] Decision text is NOT truncated in the sidebar — full statement and reasoning visible
- [ ] "Accept" button on emerging decisions → status changes to active, graph node border updates, persists to DB
- [ ] "Edit" button → inline editing (statement textarea, confidence dropdown, Save/Cancel), persists on save
- [ ] "Dismiss" button → card fades, undo toast (5s), decision hidden. Persists dismissed ID to localStorage
- [ ] Dismissed decisions do NOT reappear on page reload (localStorage tracking)

### Action Generation

- [ ] "Generate Actions" button appears on active decisions that have no existing actions
- [ ] Clicking it calls `/api/actions/generate`, shows loading skeleton in ActionList area
- [ ] 1-3 actions appear in ActionList under the decision with descriptions
- [ ] Each action is individually persisted via `POST /api/actions`
- [ ] New action nodes appear in the constellation graph connected to the decision
- [ ] "Generate Actions" is disabled/hidden if actions already exist for the decision

### Action Management

- [ ] Status toggle on each action: pending → in_progress → done (visual icon changes)
- [ ] Status changes persist via `PATCH /api/actions/[id]`
- [ ] Expand chevron reveals context card (evidence quote, framing, timing, talking points)
- [ ] "Add action" button allows manual text-only action creation (no AI context card)

### Text Truncation Fix

- [ ] Remove 40-char server-side truncation in `constellation.ts` for decision labels
- [ ] Remove 40-char server-side truncation in `constellation.ts` for action labels
- [ ] Fix guest path truncation in `ConstellationClient.tsx`
- [ ] Graph nodes use CSS `line-clamp-2` for visual truncation (no data loss)
- [ ] Sidebar shows full untruncated text

### Guest Flow

- [ ] Guest users see decisions from localStorage in constellation
- [ ] Guest users can accept/dismiss decisions (localStorage persistence)
- [ ] Guest users see "Sign up to generate actions" instead of "Generate Actions"
- [ ] Guest users cannot trigger AI generation endpoints (auth added)

### Graph Synchronization

- [ ] Accepting a decision updates the graph node's border style immediately (optimistic)
- [ ] Action status changes update graph node color immediately (optimistic)
- [ ] Background refetch after mutations reconciles full state
- [ ] Graph position is preserved during node data updates (no full relayout for status changes)

## Dependencies & Risks

**Dependencies:**

- `sonner` package (toast library) — needs to be installed
- Existing Decision/Action API routes (all exist, tested)
- Existing DecisionCard/ActionList/ActionItem components (exist, orphaned)
- Existing cedar-storage.ts guest persistence (exists, partially wired)

**Risks:**

- **Graph relayout on action generation** — Adding new nodes may cause jarring position jumps. Mitigate by positioning new nodes relative to parent and using `fitView` with animation.
- **Optimistic update rollback complexity** — If a server call fails after optimistic update, reverting cleanly requires snapshot-and-restore. Keep it simple: revert to pre-mutation state, show error toast.
- **Rate limit UX** — Users hitting 10/hour rate limit on generate endpoints will see failures. Show specific rate limit error message with retry-after countdown.

## Implementation Phases

### Phase 1: Data Foundation

**Fix truncation + enrich API response. No UI changes yet.**

Files to modify:

- `src/lib/constellation.ts` — Remove `truncate(statement, 40)` calls (lines 114, 128). Pass full text as label.
- `src/app/constellation/ConstellationClient.tsx` — Remove `d.statement.slice(0, 40)` (line 53).
- `src/lib/types/cedar.ts` — Add `EnrichedConstellationResponse` type.
- `src/app/api/constellation/route.ts` — Extend response to include `decisions`, `actions`, `pearls` maps.
- `src/app/api/constellation/surface/route.ts` — Same enrichment in `buildAndReturnConstellation`.
- `src/lib/constellation.ts` — Extend `buildConstellationData` to accept and return full objects (or add a separate enrichment function).

Files to modify (security):

- `src/app/api/decisions/generate/route.ts` — Add auth check.
- `src/app/api/actions/generate/route.ts` — Add auth check.

### Phase 2: Sidebar Interactivity

**Wire DecisionCard and ActionList into DetailSidebar. Add state + callbacks to ConstellationClient.**

Files to modify:

- `src/app/constellation/ConstellationClient.tsx` — Add `decisions`, `actions`, `pearls`, `dismissedIds` state. Parse enriched response. Add mutation callback handlers. Pass to DetailSidebar.
- `src/components/constellation/DetailSidebar.tsx` — Accept new callback props. Replace inline decision view (lines 149-232) with `DecisionCard` + `ActionList`. Wire callbacks.

New props for DetailSidebar:

```typescript
interface DetailSidebarProps {
  node: ConstellationNode;
  data: ConstellationData;
  decision?: Decision; // full object when node.type === 'decision'
  actions?: Action[]; // actions for this decision
  pearls?: Record<string, Pearl>; // pearl lookup for DecisionCard evidence
  onClose: () => void;
  onAcceptDecision?: (decisionId: string) => void;
  onDismissDecision?: (decisionId: string) => void;
  onEditDecision?: (
    decisionId: string,
    updates: Partial<Pick<Decision, 'statement' | 'confidence'>>,
  ) => void;
  onGenerateActions?: (decisionId: string) => void;
  onActionStatusChange?: (actionId: string, newStatus: ActionStatus) => void;
  onAddAction?: (decisionId: string, description: string) => void;
}
```

### Phase 3: Decision Mutations

**Accept, dismiss (with undo toast), and edit.**

Install dependency:

- `sonner` — toast notifications

Files to modify:

- `src/app/layout.tsx` — Add `<Toaster />` from sonner.
- `src/app/constellation/ConstellationClient.tsx` — Implement `onAcceptDecision` (PATCH API + optimistic), `onDismissDecision` (localStorage dismissed IDs + undo toast), `onEditDecision` (PATCH API + optimistic).
- `src/components/DecisionCard.tsx` — Add `isEditing` state, inline edit form (textarea for statement, dropdown for confidence, Save/Cancel buttons).

New file:

- `src/lib/dismissed-storage.ts` — Small helper: `saveDismissedIds(ids: string[])`, `loadDismissedIds(): string[]`. Uses `cedar:dismissed-decisions` localStorage key.

### Phase 4: Action Generation & Management

**Generate Actions button, orchestration, status toggle, manual add.**

Files to modify:

- `src/components/constellation/DetailSidebar.tsx` — Add "Generate Actions" button (shown on active decisions with no actions). Add loading skeleton. Wire ActionList with status callbacks.
- `src/app/constellation/ConstellationClient.tsx` — Implement `onGenerateActions`:
  1. Call `POST /api/actions/generate` with decision + supporting pearls
  2. For each returned action, call `POST /api/actions` to persist
  3. Update local `actions` state
  4. Add new action nodes + edges to constellation graph
  5. Background refetch
- `src/app/constellation/ConstellationClient.tsx` — Implement `onActionStatusChange` (PATCH API + optimistic).
- `src/app/constellation/ConstellationClient.tsx` — Implement `onAddAction` (POST API + optimistic, no AI context card).

### Phase 5: Guest Flow & Graph Sync

**Wire guest persistence, graph node updates.**

Files to modify:

- `src/app/constellation/ConstellationClient.tsx` — Branch guest vs. auth for each mutation handler. Guest path uses `saveGuestDecisions`/`saveGuestActions` from cedar-storage.ts.
- `src/components/constellation/DetailSidebar.tsx` — Show "Sign up to generate actions" for guests instead of generate button.
- `src/app/constellation/ConstellationClient.tsx` — After optimistic updates, use React Flow `setNodes` to update node data (status, border style) without full relayout. For new nodes (actions), position relative to parent and add to graph.

## Open Questions (Resolve During Implementation)

1. **Relayout strategy for new action nodes** — Position relative to parent decision (below it, staggered) or trigger a partial Dagre relayout of just that subtree? Test both, pick what feels right.
2. **Edit scope** — The PATCH endpoint accepts `reasoning` updates too. Should edit mode include reasoning, or just statement + confidence? Start with statement + confidence only.
3. **Regeneration** — If user wants to regenerate actions for a decision that already has some, should they delete existing ones first? For now, disable the generate button if actions exist.

## What We're NOT Building

- Resolve/Revise decision transitions (active → resolved, etc.) — future work
- Action deletion — future work
- Action description editing — status toggle only
- Constellation animations/transitions on state changes
- Mobile-responsive sidebar
- Keyboard navigation of graph nodes
- Real-time collaboration on team decisions
- Deep-linking to specific decision nodes from summary page

## References

- Brainstorm: `docs/brainstorms/2026-02-11-wire-decisions-actions-brainstorm.md`
- Build spec: `CEDAR_BUILD_SPEC.md` §3d (component hierarchy), §3c (state transitions)
- Cedar spec: `CEDAR_SPEC.md` — Actions entity definition
- Existing API routes: `src/app/api/decisions/`, `src/app/api/actions/`
- Orphaned components: `src/components/DecisionCard.tsx`, `src/components/ActionList.tsx`, `src/components/ActionItem.tsx`
- Guest persistence: `src/lib/cedar-storage.ts`
- Constellation builder: `src/lib/constellation.ts`
- Cedar AI: `src/lib/cedar-ai.ts`
