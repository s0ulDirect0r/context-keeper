# Agent-Native Cedar — Brainstorm

> Date: 2026-02-17
> Status: Draft
> Origin: Exploring what agent-native architecture means for Context Keeper
> Builds on: [Cedar Essence Brainstorm](2026-02-14-cedar-essence-brainstorm.md)

---

## What We're Building

An always-available Cedar agent that lives in the application, knows your meeting history, and gets smarter with every session. Today Context Keeper is a stateless pipeline — every generation starts from zero, insights are siloed, and there's no continuity. The agent-native version accumulates intelligence and makes it queryable from anywhere.

**The shift:** From "tool that processes transcripts" to "agent that knows your meetings."

**Two-phase prototype:**

1. **Context-aware generation** — Cedar remembers your history and pre-populates context
2. **Cedar sidebar agent** — Always-available chat interface with tools, accessible from the navbar

---

## Why This Approach

The agent-native architecture guide describes four principles: parity, granularity, composability, and emergent capability. For Context Keeper, the highest-leverage principle is **composability** — new features as new prompts, not new code. But composability requires a foundation:

- The agent needs **memory** (cross-session intelligence) to compose intelligently
- The agent needs **tools** (atomic primitives) to act on that memory
- The agent needs **presence** (UI surface) to be available when the user needs it

Starting with the internal agent (not MCP/external API) because the in-app intelligence layer is the prerequisite. Once Cedar has a rich knowledge layer and well-defined tools, exposing them externally via MCP is straightforward.

---

## Phase 1: Context-Aware Generation

### What changes

Before generating a summary, Cedar queries the user's history and injects context into the system prompt. The ContextWizard opens with suggestions instead of a blank slate.

### Context injection content

```
## What I Know About You
- You've generated 12 summaries over the past 3 weeks
- Recurring speakers: Sarah Chen (8 meetings), Mike Torres (6), Priya Patel (5)
- Topics that keep surfacing: API redesign, Q2 timeline, hiring pipeline
- You typically ask for: decisions, blockers, and action items

## Relevant History
- "API Redesign Review" (3 days ago) — decisions about REST vs GraphQL, Sarah raised budget concerns
- "Sprint Planning" (yesterday) — the team discussed capacity, Mike flagged timeline risk

## My Suggestion
Based on the speakers I see in this transcript (Sarah, Mike) and your history,
I'd suggest focusing on: "Decisions and open questions about the API redesign,
with attention to budget concerns Sarah has raised before."
```

### Data requirements

No new tables needed. Query existing data:

- `summaries` table: titles, dates, context (extraction goals), selected_tags
- `pearls` table: quotes with speaker attribution, concepts
- Speaker names: extracted from pearls' quote.speaker field

Aggregate into a context block via a `buildContextInjection(userId)` function.

### UX changes

- ContextWizard step 1 shows Cedar's suggested extraction goal (editable)
- Small "Cedar suggests" label with the rationale
- User can accept, modify, or ignore the suggestion
- If no history exists (cold start), behaves exactly as today

---

## Phase 2: Cedar Sidebar Agent

### The UX

A **chat drawer/sidebar** accessible from a Cedar icon in the navbar:

- Click the icon → sidebar slides open from the right
- Persistent across navigation (doesn't close when you change pages)
- Conversational interface — natural language input, structured responses
- Can be minimized back to the navbar icon
- Streaming responses (reuse existing SSE patterns)

### Cedar's tools (internal, not MCP)

These are Claude API tool definitions that Cedar can invoke during a conversation:

| Tool                   | Purpose                                                | Maps to                         |
| ---------------------- | ------------------------------------------------------ | ------------------------------- |
| `search_meetings`      | Find past meetings by topic, speaker, date range       | Query summaries table           |
| `get_meeting_detail`   | Full summary + pearls + context for a specific meeting | Join summaries + pearls         |
| `get_speaker_history`  | What has a person discussed, decided, committed to?    | Query pearls by speaker         |
| `get_topic_thread`     | How has a topic evolved across meetings?               | Query by tags/concepts          |
| `get_recent_activity`  | What's happened in the last N days?                    | Recent summaries                |
| `get_user_preferences` | What does this user typically care about?              | Aggregate past extraction goals |

### What Cedar can do

**Query past meetings:**

- "What decisions were made last week?"
- "What has the team said about hiring?"
- "Show me every action item from the last month."

**Prep for upcoming meetings:**

- "I have a 1:1 with Sarah tomorrow — what should I bring up?"
- "Summarize the open threads from the last 3 product reviews."

**Proactive suggestions:**

- "You have 3 unresolved topics from your last meeting with Mike."
- "Budget concerns have come up in 4 of your last 6 meetings — this seems important."

**Cross-session connections:**

- "The API redesign decision from 2 weeks ago was revisited today — here's what changed."
- "Sarah and Mike disagree about the timeline. Here's the evidence from 3 meetings."

### Agent execution model

Cedar runs as a multi-turn agent loop:

```
User message
  → System prompt (with injected context: user history summary, capabilities list)
  → Claude decides: respond directly or use a tool
  → If tool: execute query, return results, Claude continues
  → Loop until Claude responds to the user
  → Stream response to the sidebar
```

This is standard Claude tool_use — no custom agent framework needed. The "loop" is just: keep calling Claude with tool results until it produces a text response.

### System prompt structure

```
You are Cedar, a meeting intelligence agent. You have access to the user's
meeting history and can query it using your tools.

## About This User
{injected from buildContextInjection()}

## Your Capabilities
- Search across all past meetings
- Look up what specific people have discussed
- Track how topics evolve across meetings
- Identify unresolved threads and recurring themes

## Your Character
- Scout: surface patterns the user hasn't noticed
- Mirror: reflect back what the evidence suggests
- Sage: honest about confidence, no manufactured urgency

## Guidelines
- Ground everything in specific meetings and quotes
- Say "I don't have enough data for that" when you don't
- Proactively surface connections when you see them
- Be concise — the user wants signal, not prose
```

---

## Key Decisions Made

1. **Internal agent first, not MCP.** Build the in-app intelligence layer. External API surface comes later.
2. **Sidebar, not command palette.** Chat drawer from the navbar — persistent, conversational, not transient.
3. **Structured DB queries first.** No vector search / embeddings in the prototype. Query existing tables (summaries, pearls, tags). Graduate to pgvector when keyword matching isn't enough.
4. **Two-phase build.** Phase 1 (context injection) is independently valuable and validates the data layer. Phase 2 (sidebar agent) builds on it.
5. **Cedar is always-on.** Not just during generation — accessible from any page. This is what makes it feel agent-native vs. a smarter wizard.
6. **Tools are read-only in prototype.** Cedar queries but doesn't write (no "create a summary" or "delete a pearl" tools yet). Writing tools come when we're confident in the read layer.
7. **No new tables in Phase 1.** Aggregate existing data. Phase 2 may need a `conversations` table for Cedar chat history persistence.

---

## Open Questions

1. **Cedar chat persistence** — Should conversations with Cedar be saved? If so, per-session or accumulated? A persistent Cedar conversation could itself be a form of memory.

2. **Streaming architecture** — The sidebar needs streaming responses. Reuse the existing SSE pattern from summarize, or switch to a different approach (WebSocket, Server Components streaming)?

3. **Context window management** — When Cedar queries 20 meetings' worth of data, how much fits in the context window? May need summarization of historical data or a retrieval step that ranks relevance.

4. **Cedar during generation** — When the user is generating a summary, should Cedar be aware of that? Can you ask Cedar questions about the transcript while it's being processed?

5. **Mobile/responsive** — Sidebar works on desktop. What happens on mobile? Full-screen overlay? Bottom sheet?

6. **Authentication for Cedar** — Cedar queries user data. Guests with localStorage have no query surface. Cedar agent is authenticated-users-only, or do we build a guest-compatible layer?

---

## What This Is NOT

- **Not a chatbot.** Cedar has specific tools and domain knowledge. It's not a general-purpose assistant.
- **Not autonomous.** Cedar doesn't take actions without being asked (no auto-emailing, no auto-creating tasks in external tools). It surfaces intelligence; the user acts on it.
- **Not MCP (yet).** The external API surface is a future layer. This prototype is about the internal experience.
- **Not a full knowledge graph.** No new entity types (speakers, topics, decisions as first-class objects) in the prototype. Use existing tables and let the queries simulate a knowledge graph.

---

## Next Step

Run `/workflows:plan` to turn this into an implementation plan. Key planning questions:

- Phase 1 data queries: what SQL aggregations produce useful context injection?
- Phase 2 sidebar: component architecture, state management, streaming pattern
- Cedar tool definitions: exact schemas for each tool
- How does the sidebar interact with the existing page layout?
