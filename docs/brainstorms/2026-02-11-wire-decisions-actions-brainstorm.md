# Brainstorm: Wire Decisions & Actions into the Constellation UX

**Date:** 2026-02-11
**Status:** Draft

---

## What We're Building

The Decide and Act phases of Cedar's OODA loop are fully built as backend + components but completely disconnected from the user experience. We're wiring them into the constellation sidebar so users can interact with decisions (accept/edit/dismiss) and generate + manage actions — completing the strategic loop.

### The Gap Today

```
Working:     Seed → Summary + Pearls → Constellation (read-only visualization)
Missing:     Decisions are auto-surfaced but NOT interactive
             Actions are never generated, displayed, or managed
Dead code:   DecisionCard, ActionList, ActionItem — imported by nothing
             3 action API routes — called by nothing
             generateActions() in cedar-ai.ts — called by nothing
             cedar-storage.ts guest persistence — called by nothing (for actions)
```

### The Goal

```
Full loop:   Seed → Summary + Pearls → Constellation → Accept Decision → Generate Actions → Do
```

User clicks a decision node in the constellation sidebar and can:

1. **Accept** it (emerging → active) — persisted
2. **Edit** the hypothesis statement and confidence
3. **Dismiss** it (removed from view with undo toast)
4. **Generate Actions** (manual trigger, per-decision) once accepted
5. **Toggle action status** (pending → in_progress → done)
6. **Expand action context cards** (evidence, framing, timing, talking points)

---

## Why This Approach

### Constellation sidebar (not a separate page)

The constellation is already the spatial home for decisions and actions as graph nodes. Putting the interactive controls in the sidebar keeps the user in context — they can see how their decision connects to pearl clusters while acting on it. A separate page would break the visual connection.

### Manual per-decision action generation

Each "Generate Actions" click is a deliberate choice. This aligns with Cedar's philosophy — wise agency, not automated busywork. The user decides which decisions are worth acting on. It also avoids surprise API calls and costs.

### Hybrid data refresh

Optimistic local update for immediate visual feedback (new action nodes appear instantly, decision status changes immediately), followed by a background refetch to reconcile the full constellation. Best UX without sacrificing correctness.

### Both logged-in and guest flows

The guest localStorage layer (`cedar-storage.ts`) already exists with full CRUD for decisions and actions. Wiring it up ensures the "try before you sign up" experience works end-to-end. The surface endpoint is auth-gated, so guest decision surfacing will need a client-side path (call `/api/decisions/generate` directly and store in localStorage).

---

## Key Decisions

### 1. DetailSidebar becomes the interactive hub

The current `DetailSidebar` has read-only views for each node type. For decision nodes, it will render the existing `DecisionCard` component (accept/edit/dismiss) with `ActionList` + `ActionItem` below it. This replaces the current static decision display.

### 2. Data enrichment — full objects alongside graph nodes

The constellation response currently returns flat `ConstellationNode` objects with truncated labels. The sidebar needs full decision objects (statement, reasoning, supportingPearls) and full action objects (contextCard). Two options explored:

- **Enrich constellation response** — Include `decisions`, `actions`, `pearls` maps alongside `nodes`/`edges`. One fetch, everything available. Slightly larger payload but decisions/actions are small.
- **Lazy fetch on node click** — Add `GET /api/decisions/:id?include=pearls,actions`. Clean but adds latency to every click.

**Decision: Enrich constellation response.** Keep the sidebar snappy. The extra data is small (a few KB for typical users). Pearl cluster details can remain lazy-fetched since they're larger.

### 3. Edit UX — inline in sidebar

When user clicks "Edit" on a decision, the statement becomes a textarea and confidence becomes a dropdown, with Save/Cancel buttons. No modal. Keeps the user in the sidebar flow.

### 4. Dismiss UX — optimistic removal with undo toast

Dismissed decisions are removed from the sidebar immediately. A 5-second undo toast appears. If undone, the decision reappears. Dismissed decisions are NOT persisted (per spec) — they're just hidden client-side. On next constellation load they reappear as 'emerging' (this matches the spec: dismissed is client-only state).

### 5. Action generation for guests

Guests can't call the auth-gated `/api/constellation/surface` endpoint. For guest action generation:

- Call `/api/actions/generate` directly (it's rate-limited but not auth-gated)
- Store results in localStorage via `saveGuestActions()`
- Display from localStorage in the sidebar

### 6. State management lives in ConstellationClient

`ConstellationClient.tsx` already manages constellation data and sidebar selection. It gains:

- A `decisions` map (full Decision objects keyed by ID)
- An `actions` map (full Action[] keyed by decision ID)
- Callbacks passed down to DetailSidebar: `onAcceptDecision`, `onDismissDecision`, `onEditDecision`, `onGenerateActions`, `onActionStatusChange`
- Optimistic updates + background refetch logic

---

### 7. Fix double-truncated decision and action text

Decision statements and action descriptions are truncated twice:

- **Server-side** (`constellation.ts`): `truncate(statement, 40)` hard-cuts text before it leaves the API
- **Graph nodes** (`DecisionNode.tsx`, `ActionNode.tsx`): CSS `line-clamp-2` on `w-60`/`w-50` containers

The sidebar (`DetailSidebar`) displays `node.label` — which is already the 40-char truncated version. So even the detail view shows cut-off text.

**Fix:** Remove the server-side 40-char truncation. Pass full statement/description as `label`. Let CSS `line-clamp` handle visual truncation on graph nodes. The sidebar should display the full untruncated text. Also fix the guest path in `ConstellationClient.tsx:53` which does `d.statement.slice(0, 40)`.

---

## Open Questions

1. **Dismissed decisions reappearing** — Since dismissed is client-only, decisions reappear on page reload. Should we persist dismissed IDs in localStorage to prevent this? (Probably yes, small addition.)

2. **Graph animation on changes** — When an action is generated, new nodes appear in the graph. Should they animate in? React Flow supports this but needs configuration.

3. **Pearl data availability** — `DecisionCard` needs Pearl objects to display supporting evidence. These are referenced by ID in `supportingPearls`. The enriched constellation response needs to include a pearls map. The current `/api/constellation` doesn't return pearl-level detail (only cluster aggregates).

4. **"Generate Actions" loading state** — The AI call takes a few seconds. Show a skeleton in the ActionList area? A spinner on the button? Both?

---

## What We're NOT Building

- Decision editing beyond statement + confidence (no reasoning edit, no pearl re-linking)
- Action editing (description/contextCard changes) — only status toggle
- Batch action generation across all decisions
- Constellation animation/transitions
- Mobile-responsive sidebar
- Real-time collaboration on team decisions
