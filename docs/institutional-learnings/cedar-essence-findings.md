# Cedar Essence — Institutional Learnings & Findings

> Date: 2026-02-15
> Origin: Institutional knowledge search across AUDIT.md, CEDAR_SPEC.md, CEDAR_BUILD_SPEC.md, prompt engineering codebase, and existing brainstorms
> Status: Research complete, ready for planning phase

---

## Executive Summary

The Cedar Essence brainstorm (2026-02-14) represents a significant refinement of the earlier Cedar vision. It **distills a sprawling multi-feature spec into a focused briefing-first system** that compounds intelligence from accumulated evidence.

**Key insight:** The brainstorm cuts complexity (constellation → dashboard, eliminates team features, removes seeds layer) while **keeping cross-seed intelligence at v1** — this is the make-or-break feature that transforms Cedar from "meeting summarizer" to "wisdom engine."

**Critical dependencies for execution:**

1. Cross-seed intelligence implementation (likely structured DB queries, optionally upgraded to embeddings)
2. Briefing prompt engineering (requires different AI framing than existing summary/pearl extraction)
3. Mock data strategy (validates UX before wiring full pipeline)
4. Data model evolution (summit/decision/action tables exist but are disconnected from main flow)

---

## Part 1: AI Prompt Engineering — Existing Patterns & Implications

### Current Strength: Modular, Progressive Extraction

The existing claude.ts architecture extracts evidence through **multiple passes over the transcript**, each with distinct voice and constraints:

| Stage                | Purpose                       | Model    | Constraints                                    | Output Type      |
| -------------------- | ----------------------------- | -------- | ---------------------------------------------- | ---------------- |
| **Summary**          | Audience-tailored narrative   | sonnet-4 | Free-form markdown, detects meeting shape      | GeneratedSummary |
| **Tag Extraction**   | Identify thematic axes        | sonnet-4 | 10-15 single-word tags, abstract & reusable    | ConceptTag[]     |
| **Pearl Extraction** | Surface grounded observations | sonnet-4 | 3-7 pearls, quote-anchored, 6-12 word insights | Pearl[]          |

**Key pattern:** Each prompt is **isolated but builds on prior outputs** (tags inform pearl focus, summary frames the inquiry). This works because the AI is processing a single meeting.

### Implication for Cedar Essence: Briefing Requires Different Framing

The briefing is fundamentally different — it must:

- **See across multiple inputs** (accumulated evidence from weeks of meetings/notes)
- **Track evidence evolution** (what's new, what's stronger, what contradicts)
- **Narrate without being prescriptive** (Sage voice: report what the evidence suggests, don't manufacture urgency)
- **Handle cold start gracefully** (1 input → no briefing, 2-3 inputs → lightweight, 5+ inputs → real briefing)

**Existing prompts won't directly transfer.** The briefing prompt will need:

1. A **context window strategy** (what goes into the prompt window for a user with 20+ inputs?)
2. **Confidence signals from the AI** (which observations are well-grounded vs. speculative?)
3. **Change detection** (what's new since last briefing?)

### Existing Prompt Strengths to Preserve

- **Reflective mirror voice** — The pearl extraction prompt's tone ("You extend trust before it's earned") is exactly the Sage energy Cedar wants. Don't change the voice, apply it to briefing writing.
- **Quote-anchoring** — Pearls are grounded in verbatim evidence. Briefing narratives should similarly root claims in pearl quotes where possible.
- **Adaptive structure** — The summary prompt recognizes meeting shape (Q&A, brainstorm, decision) and adapts format. Briefing should similarly adapt to the user's strategic landscape (lots of decisions → focus on evidence. Few decisions → surface emerging themes).

### Recommendation for Briefing Prompt

Create a new **BRIEFING_SYSTEM_PROMPT** that:

1. Takes as input: recent pearls (7-14), active decisions with confidence, open actions, user role/priorities
2. Outputs: 3-4 paragraph narrative with specific quotes/references to back each major claim
3. Uses the same "mirror, not prescriber" voice — "Here's what the evidence suggests" not "You should do"
4. Explicitly handles confidence: "This is well-established" vs. "This is emerging"
5. Flags tension: "Evidence on this is mixed" when contradicting pearls exist

---

## Part 2: Cross-Seed Intelligence — Architecture Implications

### Four Approaches, Real Trade-offs

The Cedar Essence brainstorm identifies four possible approaches. This is the **most critical technical decision for v1:**

| Approach                     | Implementation                                                           | When It Works                                                        | When It Fails                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **A: Structured DB**         | Query for overlapping concepts, speakers, decisions. Pass as AI context. | Keywords match exactly ("budget" → "budget"). Fast, cheap, no infra. | "Financial pressure" doesn't match "budget." Semantic misses are silent.                            |
| **B: Embeddings (pgvector)** | Embed pearls. Vector search for semantic similarity.                     | Finds synonyms, related concepts. Scales to 100s of pearls.          | Requires pgvector extension. Embedding quality varies by model. Cold start: zero embedding history. |
| **C: Full context window**   | Load all user pearls into prompt. Let AI see everything.                 | Highest quality connections. AI can reason about nuance.             | Expensive per call. Breaks at ~150-200 pearls. Briefing only, not per-summary.                      |
| **D: Hybrid (A + B)**        | DB queries for obvious, embeddings for semantic.                         | Best of both worlds. Structured + semantic.                          | More complex. Two retrieval paths to maintain.                                                      |

### Recommendation: Start with A, Graduate to B

**For Cedar Essence MVP:**

- **Implement A (structured DB queries)** — Pearl concepts already exist. Speaker matching is built. Zero new infrastructure.
- Minimum viable cross-seed must:
  - Detect when new evidence relates to existing decision (concept overlap + speaker)
  - Surface recurring themes by aggregating pearl concepts
  - Provide enough context for briefing AI

**For follow-up (if A shows limitations):**

- Add **pgvector** for semantic discovery
- Reuse the same pearl query interface (embeddings as an additional retrieval path)

**Why not jump to B immediately?**

- A works today. B is blocked on pgvector extension (requires Supabase setup).
- The constraint "does approach A feel like it misses too many real connections?" can only be answered after watching real usage.
- If A feels limited, B is a clean add-on (doesn't require refactoring the structured queries).

### Cold Start + Accumulation Strategy

The briefing's value comes from accumulation, but every user starts empty:

```
1 input:   No briefing. Show summary + pearls + decisions.
           Message: "Add more evidence to build your strategic picture."

2-3 inputs: Lightweight briefing. AI notes overlaps.
            "Budget appeared in both Monday 1:1 and Wednesday standup."

5+ inputs:  Real briefing. Themes, evolving decisions, synthesis.
```

This is **honest, not fake-data.** Cedar gets better with every input, and users understand why.

---

## Part 3: Data Model — What Exists, What Needs Wiring

### Current Tables (From AUDIT.md)

```sql
summaries (
  id UUID PRIMARY KEY,
  user_id UUID,
  title TEXT,
  summaries JSONB,        -- Array of markdown strings
  context JSONB,          -- { extractionGoal, additionalContext }
  transcripts JSONB,      -- For re-generation (critical for accumulation)
  share_token TEXT UNIQUE,
  is_shared BOOLEAN,
  created_at, updated_at
)

otter_connections (
  id UUID PRIMARY KEY,
  user_id UUID,
  otter_email, otter_user_id, cookies, csrf_token,
  created_at, updated_at
)
```

**Existing in codebase but not surfaced:**

- Decision rows exist (API routes exist, components exist, but orphaned)
- Action rows exist (API routes exist, components exist, but orphaned)
- Pearl rows exist (extracted during summary generation, persisted to DB)

### What Cedar Essence Needs (No New Tables)

The Cedar Essence brainstorm says: **Don't add complexity.** Use what exists:

- Treat each `summaries` row as a "Seed" (don't add a seeds table)
- Decisions link to pearls they're grounded in
- Actions link to decisions they serve
- User context (role, priorities) stored as JSONB in a future `preferences` table (not in v1)

**No constellation node table needed.** The constellation is a computed view:

```
SELECT aggregated pearls + their decisions + their actions
BUILD the tree layout in-memory (Dagre)
RETURN the positioned nodes + edges
```

### Missing for Briefing

To build and serve briefings, add these minimal columns to `summaries`:

```sql
-- Add to summaries table:
briefing_markdown TEXT,         -- Cached briefing narrative
briefing_generated_at TIMESTAMPTZ,
requires_briefing_refresh BOOLEAN DEFAULT true,

-- Or create lightweight briefing_history table:
briefing_history (
  id UUID PRIMARY KEY,
  user_id UUID,
  generated_at TIMESTAMPTZ,
  markdown TEXT,
  seed_count INT,               -- How many seeds were in scope?
  context JSONB                 -- {newSeedId, pearls_used, decisions_referenced}
)
```

**Don't over-architect.** The briefing is expensive (AI call), but infrequent (weekly?). A simple cached markdown column on summaries is fine for v1.

---

## Part 4: Mock Data Strategy — Why It Matters

### The Gap: Real Pipeline vs. Demo Experience

Building the cross-seed pipeline is hard. Building the UI is fast. The problem:

- Without multi-week accumulated data, **the briefing looks mediocre** (cold start)
- **The dashboard density is unclear** (do 3 themes look sparse or right?)
- **We can't see what brilliant looks like before wiring the pipeline**

### Cedar Essence's Answer: Mock Data First

Load the UX with **rich, realistic mock data:**

- 3-4 weeks of meetings (standups, 1:1s, strategy sessions)
- Recurring themes that emerge (trust, timeline, budget pressure)
- Decisions that evolve (confidence increases as supporting evidence accumulates)
- Actions in various states (pending, in progress, done)
- Contradicting evidence that creates tension

This lets us:

1. **Validate the UX shape** — Does the briefing feel compelling? Is the dashboard useful?
2. **See what "good" looks like** — Before shipping, we know the destination
3. **Ship with context** — Demos have substance, not empty skeletons
4. **Iterate on narrative** — The briefing prompt can be refined against real-looking data

### Practical Implementation

Mock data lives in version control as **JSON fixtures** (not hardcoded):

```
src/lib/mock-data/
  user-profile.json          -- Role, priorities, relationships
  seeds/
    week1-meetings.json
    week2-meetings.json
    week3-meetings.json
  pearls-extracted.json      -- Pre-computed pearl extraction
  decisions-evolved.json     -- Decisions with confidence evolution
  actions-lifecycle.json     -- Actions in various states
```

A **toggle in dev mode** switches to mock data. Production uses real user data.

**Benefit:** The team can see the Cedar vision _right now_, before the pipeline is wired. Demos are credible. Iteration is fast.

---

## Part 5: Constellation → Briefing + Dashboard

### Why Cut Constellation

The Cedar Essence brainstorm **deliberately replaces the constellation (force-directed graph) with briefing + dashboard.** The earlier 2026-02-11 constellation brainstorm proposed tldraw with deterministic tree layout. Cedar Essence says: too much UX work, less value than a briefing.

**What we lose:**

- Visual graph of pearls, decisions, actions
- Spatial thinking about strategic landscape
- Ability to draw annotations

**What we keep (and improve):**

- All the same data (pearls → decisions → actions)
- Cross-seed connections (briefing makes them explicit)
- Structured dashboard (scannable, deep on click)
- Less engineering work → more time on briefing/intelligence

### The Dashboard Pattern

Cedar Essence specifies:

```
TOP: Briefing (AI-written narrative, updates as you add evidence)

MIDDLE: Active Decisions
  - Hypothesis statement
  - Confidence badge
  - Status (emerging/active/resolved/revised)
  - Linked evidence count

BOTTOM: Open Actions
  - Lightweight description
  - Expandable context card (pearl → decision → framing)
  - Status toggle (pending → in progress → done)

SIDEBAR: Recurring Themes
  - Concept name
  - Frequency + recency
  - List of pearls
```

**This is more dense and actionable than a graph.** And it's faster to build.

---

## Part 6: Audit Findings — What Still Matters

The 2026-02-10 audit identified critical security gaps (now fixed in Week 1). But it also surfaced product problems that Cedar Essence addresses:

### The Core Problem: Differentiation is Invisible (SOLVED)

**Audit quote:** "The context wizard is the core differentiator, and it's 2 blank textareas. No templates, no audience presets, no examples."

**Cedar Essence answer:** The audience-tailored summary becomes the **briefing** — showing how the same evidence produces different insights for different readers. This makes differentiation visceral.

### Still Relevant from Audit

| Finding                               | Impact on Cedar                              | Recommendation                                             |
| ------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Markdown table rendering was broken   | Pearls/decisions must render well            | Verify markdown handling in all components                 |
| Zero test coverage                    | Critical before Cedar v1                     | Plan E2E tests for briefing generation, cross-seed display |
| No error monitoring (pre-Sentry fix)  | Briefing generation is an expensive API call | Monitor Claude API failures, briefing generation latency   |
| Dashboard pagination missing          | At scale, loading 100+ summaries breaks      | Implement pagination early (Cedar may load years of data)  |
| No CI/CD                              | Manual deploys risky                         | Already fixed (Week 1), keep it                            |
| Otter session cookies in localStorage | XSS risk                                     | Already fixed (Week 1), briefing won't worsen this         |

---

## Part 7: AI Prompt Notes — Specific Patterns to Apply

### Summary Prompt Strength: Audience Tailoring

The existing SUMMARY_SYSTEM_PROMPT uses this key instruction:

> "Write for the specific recipient. The user will tell you what they care about — tailor the summary to that lens."

**Apply this to briefing:** The briefing should emphasize what _this specific user's role_ cares about (if we have persistent user context). Product manager? Lead with risks and decisions. Executive? Lead with timeline/budget implications.

### Pearl Prompt Strength: Grounding in Evidence

The PEARL_EXTRACTION_PROMPT has:

> "Every pearl must have a grounding quote. No exceptions. The quote is the anchor — the insight explains why it matters."

**Apply this to briefing:** Every claim in the briefing should reference at least one pearl. "This week you shifted on timeline" should quote a pearl from this week.

### Pearl Prompt Strength: Voice (Reflective Mirror)

The Pearl prompt:

> "The tone is a reflective mirror: gentle, observational, not prescriptive. You surface what's there — you don't tell them what to do about it."

**Apply this to briefing:** This is the Sage character. The briefing should be honest about what's emerging, what's well-founded, what's in tension. No manufactured urgency.

### Insight Constraint: 6-12 Words

Pearls enforce punchy insights (6-12 words). Briefing should enforce similar discipline:

- **Bad:** "There's evidence that financial pressure is becoming more acute and may require strategic attention to capacity planning."
- **Good:** "Budget pressure is escalating. Sarah raised it in 3 separate conversations this week."

---

## Part 8: Technical Debt Implications

### No New Complexity for v1

Cedar Essence **explicitly cuts complexity from the earlier spec:**

✅ **Kept:**

- Pearl extraction (already works)
- Decision generation (orphaned code, already exists)
- Action generation (orphaned code, already exists)
- Cross-seed intelligence (core feature, structured DB approach)
- Briefing generation (new prompt, not new infra)

❌ **Cut:**

- Constellation force-directed graph
- Team features (uses mock data only)
- Seeds table (reuse summaries)
- Timeline scrubber
- Elaborate onboarding
- Seed type classification (AI detects implicitly)

### What Gets Wired Up

1. **Decision generation** — Activate existing `/api/decisions/generate`
2. **Action generation** — Activate existing `/api/actions/generate`
3. **Cross-seed queries** — Build SQL for concept + speaker matching
4. **Briefing generation** — New prompt + caching logic
5. **Dashboard rendering** — Layout for briefing + decisions + actions + themes

---

## Part 9: Open Questions Requiring Decisions

These are from the Cedar Essence brainstorm and need resolution during planning:

1. **Briefing generation frequency:**
   - Periodic (daily/weekly digest)?
   - On-demand (when user opens dashboard)?
   - Event-triggered (after every new input)?
   - Hybrid (refresh on demand, cache for 24h)?

2. **Mock data scope:**
   - How many weeks?
   - What persona(s)?
   - What domain (Anansi's actual work)?
   - Should it include different input types (transcripts + manual notes)?

3. **Persistent user context:**
   - Onboarding wizard (feels heavy)?
   - Settings page (added friction)?
   - Inferred from first few inputs (implicit)?
   - Simple single-page form?

4. **Summary view fate:**
   - Still accessible from dashboard as "view this seed"?
   - Replaced by detail view when clicking a pearl in dashboard?
   - Both (toggle)?

5. **Queryable brain (v-next):**
   - Should we stub "Ask Cedar" interface now or defer?
   - How does this interact with briefing intelligence?

---

## Part 10: Phasing Recommendations

Based on the learnings above, proposed phasing:

### Phase 1: Briefing UI + Mock Data (1-2 weeks)

- Build briefing component (top of dashboard)
- Build decisions + actions dashboard
- Load with mock data
- **Goal:** Validate UX shape before wiring AI

### Phase 2: Cross-Seed Intelligence (1 week)

- Implement structured DB queries (approach A)
- Wire pearl aggregation
- Test with real user data

### Phase 3: Briefing Generation (1 week)

- Design briefing prompt
- Integrate with Claude API
- Build caching/refresh logic
- Test against mock data, then real data

### Phase 4: Decision/Action Activation (3-5 days)

- Wire up orphaned decision/action code
- Add to dashboard flow
- Test generation + persistence

### Phase 5: Polish + Testing (1 week)

- E2E tests for critical flows
- Cold start messaging
- Error handling

---

## Summary of Key Insights

| Topic                       | Learning                                                                                                                        | Implication                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Prompt architecture**     | Multi-pass extraction (summary → tags → pearls) works. Each pass is isolated but builds on prior.                               | Briefing needs different framing. Can't reuse summary/pearl prompts directly.                             |
| **Cross-seed intelligence** | Four approaches exist with real trade-offs. Start simple (A: structured queries), graduate to semantic (B: embeddings).         | Don't over-architect. Structured queries work today. Embeddings can be added later if needed.             |
| **Differentiation**         | "Audience-tailored summaries" is a real insight but was invisible in UI.                                                        | Cedar Essence makes this visible by building briefing around evidence + how it shifts with audience/role. |
| **Cold start**              | Accumulation magic requires volume. Honest about it (1 input = summary, 5+ inputs = briefing).                                  | Don't fake it with mock data in production. Use mock for dev/demo, real ramp for users.                   |
| **Complexity cutting**      | Earlier spec had constellation, seeds table, team features, elaborate onboarding. Cedar Essence cuts these, keeps intelligence. | V1 is smaller scope, same or better value. Constellation can return as v2 if warranted.                   |
| **Data model**              | Tables exist (summaries, decisions, actions). Just disconnected.                                                                | Minimal DB work. Mostly wiring + prompt engineering.                                                      |
| **Voice consistency**       | Existing prompts use "Sage" energy (observational, grounded, honest).                                                           | Apply this to briefing. No manufactured urgency. Surface what's actually there.                           |

---

## Recommended Next Step

Run `/workflows:plan` to convert Cedar Essence brainstorm into an implementation plan. Key planning inputs:

1. **Phasing choice:** Mock data first or pipeline first?
2. **Cross-seed approach:** Commit to structured queries (A) for v1?
3. **Briefing mechanics:** On-demand vs. periodic generation?
4. **Cold start:** Accept the honest ramp, or add demo/onboarding?
5. **Integration scope:** Does briefing replace constellation entirely, or coexist?

**Estimated timeline:** 4-5 weeks for full Cedar Essence v1 (briefing + dashboard + cross-seed intelligence).
