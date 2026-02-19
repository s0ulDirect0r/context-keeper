# Cedar Essence — Brainstorm

> Date: 2026-02-14
> Status: Draft
> Origin: Distilling CEDAR_SPEC.md and CEDAR_BUILD_SPEC.md to their essence

---

## What We're Building

Cedar is a **personal strategic intelligence system**. It accumulates context from meetings, notes, and observations and builds a compounding picture of your strategic landscape. It doesn't just tell you what happened — it tells you what the evidence suggests you should do, tracks whether you did it, and connects dots you'd miss.

**The one-liner:** An AI that builds and maintains your strategic picture from everything you feed it.

**What makes it different:**

| vs.              | Cedar's edge                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Notion/Obsidian  | Active, not passive. Synthesizes and connects, doesn't just store.                       |
| ChatGPT sessions | Persistent, compounding context. Every input makes the next output smarter.              |
| Otter/Fireflies  | They transcribe. Cedar _thinks_.                                                         |
| To-do apps       | Actions carry lineage — not "what to do" but "what to do and why, grounded in evidence." |

---

## The Core Loop

```
Evidence → Pearls → Decisions → Actions → New Evidence
```

Users see: "here's what happened, here's what it suggests, here's what to do about it." The OODA framework shapes the design but never appears in the UI.

**Cross-seed intelligence is essential, not a v2 feature.** The AI must connect meeting A to note B to decision C. Without this, there's no accumulation — just a series of disconnected summaries. See "Cross-Seed Intelligence" section below for approach.

---

## The Product Shape: Briefing + Dashboard

When you open Cedar, you see:

### Top: The Briefing (AI-written narrative)

> "This week: your Q2 timeline decision got stronger evidence from Thursday's meeting. Sarah's budget concerns are escalating — 3 mentions across 2 weeks. You have 2 open actions that need attention: the numbers Sarah asked for, and the team capacity conversation with Marcus."

The briefing is the **entry point** — effortless, read-and-go. It updates as you add evidence. It embodies the Sage character: no manufactured urgency, honest about what needs attention and what doesn't.

### Below: The Dashboard (structured data)

- **Active Decisions** — hypothesis statements with confidence levels (low/med/high), linked evidence, status (emerging/active/resolved/revised)
- **Open Actions** — lightweight descriptions with expandable context cards showing full lineage (pearl quote → decision → suggested framing)
- **Recurring Themes** — concepts that keep surfacing across inputs (trust, budget, timeline, hiring) with frequency and recency
- **Key Relationships** _(stretch)_ — people who appear across your evidence, with trajectory. This is effectively a CRM feature and may be significant scope — include if cross-seed intelligence supports it naturally, don't force it.

Click any decision → see the evidence chain. Click any action → see the full lineage. The dashboard is scannable but deep.

---

## Input Methods

Three ways to feed Cedar:

1. **Meeting transcript** (existing) — Otter integration or manual paste. Full processing pipeline.
2. **Manual paste** (existing) — Drop in any text. Cedar detects shape and adapts.
3. **Quick note** (new) — Text box with minimal structure:
   - The note itself (freeform)
   - Optional: who is this about? (relationship linking)
   - Optional: which decision does this relate to? (decision linking)
   - Optional: concept tags (theme linking)

All inputs enter the same pipeline: summarize → extract pearls → surface decisions → suggest actions → connect to existing landscape.

---

## What We're Keeping from the Spec

### Pearls (already built)

The foundation. Quote-anchored, insight-bearing, concept-tagged evidence units. Everything traces back to pearls.

### Decisions as Hypotheses

Not commitments — testable predictions grounded in evidence. Confidence tracks evidence strength, not gut feeling. "No action needed" is a valid output.

### Actions with Lineage

Every action carries WHY. The expand-for-context-card UX is the killer feature: pearl quote, parent decision, suggested framing, timing, talking points.

### AI Character: Scout / Mirror / Sage

- **Scout** — "This theme appeared in 4 of your last 6 inputs"
- **Mirror** — "Your evidence suggests you believe the team needs more autonomy"
- **Sage** — "No action needed here. This is still forming."

Especially critical for the briefing. No manufactured urgency.

### Persistent User Context

Role, priorities, key relationships, custom context. Set once, applies to every input. Makes every summary, decision, and briefing smarter without user effort.

### Decision Confidence Tracking

Confidence evolves as evidence accumulates. New supporting evidence → confidence rises. Contradicting evidence → confidence drops. The AI tracks this explicitly.

---

## What We're Cutting

| Cut                                      | Why                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Constellation** (force-directed graph) | Wrong form factor. Briefing + Dashboard delivers the same value with better UX and less engineering cost. |
| **Team features**                        | No users yet. Build for one person. Team is a v-later conversation.                                       |
| **Seeds as separate entity**             | The existing summaries table IS the seed. Don't add a layer of abstraction that doesn't earn its keep.    |
| **Elaborate onboarding**                 | Demo constellation with pre-built data → replaced by mock data strategy (see below).                      |
| **Timeline scrubber**                    | Interesting but not core. The briefing handles "what changed" narratively.                                |
| **Loop closure** (actions → new seeds)   | Premature. Track action status, but don't automate the feedback loop yet.                                 |
| **Four distinct seed types**             | One pipeline. AI detects input shape implicitly. Don't make the user classify their evidence.             |

---

## Key Decisions Made

1. **Accumulated intelligence IS the product.** Individual summaries are input, not output.
2. **Briefing-first entry.** AI narrative at top, structured dashboard below.
3. **Cross-seed intelligence is v1.** The briefing requires it; without it, there's no accumulation.
4. **Heavy mock data strategy.** Build the UX first, populate with weeks of realistic mock data, validate the destination before wiring the full pipeline.
5. **Building for yourself.** Anansi is the user. Dogfood everything.

---

## Cross-Seed Intelligence: Likely Approach

The briefing and dashboard require connecting dots across inputs. Four approaches, in order of complexity:

| Approach                          | How it works                                                                                      | Pros                                                    | Cons                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **A: Structured DB queries**      | Query for pearls with overlapping concepts, same speakers, related decisions. Pass as AI context. | Cheap, fast, no new infra                               | Only finds connections the schema can express. "Budget" matches "budget" but not "financial pressure." |
| **B: Embeddings + vector search** | Embed pearls into pgvector. Retrieve semantically similar history for each new input.             | Finds connections keyword matching misses. Scales well. | Requires pgvector setup. Retrieval quality depends on embedding model.                                 |
| **C: Full context window**        | Load all user pearls into the AI prompt. AI sees everything.                                      | Highest quality connections.                            | Expensive per call. Stops scaling at ~150-200 pearls.                                                  |
| **D: Structured + embeddings**    | DB queries for obvious connections, embeddings for semantic discovery.                            | Best of both.                                           | More complex. Two retrieval paths.                                                                     |

**Likely path:** Start with **A** (structured queries) because it works today with zero new infrastructure — pearl concepts already exist, speakers are tracked. Graduate to **B** (add pgvector) when keyword matching isn't enough. **C** may be useful for briefing generation specifically, where the AI needs a holistic view and the call is infrequent.

**Minimum viable cross-seed must:**

- Detect when new evidence relates to an existing decision (concept overlap + speaker matching)
- Surface recurring themes by aggregating pearl concepts across inputs
- Provide enough context for the briefing AI to write a coherent narrative about what changed

---

## Cold Start

The product's value comes from accumulation, but every user starts at zero. The briefing with one input isn't a briefing — it's a summary.

**Handle this honestly, not with fake data:**

- **1 input:** No briefing. Show the summary + pearls + decisions from that input. Message: "Add more evidence to build your strategic picture."
- **2-3 inputs:** Lightweight briefing. The AI can start noting connections. "Budget concerns appeared in both your Monday 1:1 and Wednesday standup."
- **5+ inputs:** Real briefing. Enough data for themes, evolving decisions, and meaningful synthesis.

The cold start is a ramp, not a cliff. Cedar gets more valuable with every input — and that's part of the pitch, not a problem to hide.

---

## The Mock Data Strategy

Before wiring real cross-seed processing, build the UX and populate it with **rich, realistic mock data** — multiple weeks of:

- Meeting transcripts (1:1s, standups, strategy sessions, cross-functional)
- Personal notes and reflections
- Evolving decisions with shifting confidence
- Actions in various states (pending, in progress, done)
- Recurring themes that emerge across inputs
- Relationship dynamics that evolve over time
- Contradicting evidence that creates tension in decisions

This lets us:

- See what the briefing looks like when Cedar "knows" a lot
- Test the dashboard UX with realistic density
- Validate that the data model supports the intelligence layer
- Ship a demo that shows the vision, not just the pipeline

---

## Open Questions

1. **Briefing generation mechanics** — Periodic (daily/weekly)? On-demand? Event-triggered (after new input)? Some combination? What does the AI need in its context window to write a good briefing?

2. **Mock data scope** — How many weeks of data? What persona(s)? What domain? The mock data should feel like Anansi's actual work life.

3. **Persistent user context setup** — Onboarding wizard? Settings page? Inferred from first few inputs? Simple form?

4. **Current summary page fate** — Still accessible from dashboard as "view this input"? Or does the summary view become the detail view when you click a seed in the dashboard?

5. **Queryable brain (v-next)** — The ability to ask Cedar questions ("What have I learned about Sarah?") was compelling. Stub the interface now or defer entirely?

---

## Next Step

Run `/workflows:plan` to turn this into an implementation plan. Key planning questions:

- Phasing: mock data first or pipeline first?
- Cross-seed intelligence: what's the technical approach?
- How much of the existing codebase do we restructure vs. extend?
- What's the right graph/library for the dashboard components?
