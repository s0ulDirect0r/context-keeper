---
title: Agent-Native Cedar Sidebar
type: feat
date: 2026-02-17
---

# Agent-Native Cedar Sidebar

## Overview

Transform Context Keeper from a stateless summary pipeline into an agent-native application where Cedar is an always-available intelligence layer. Two phases: (1) context-aware generation that remembers user history, and (2) a Cedar chat sidebar accessible from the navbar with tools to query past meetings, track threads, and surface cross-session connections.

## Problem Statement

Every summary generation starts from zero. The AI doesn't know what the user cared about last time or what threads are ongoing. Summaries are siloed per-session — they never connect across meetings. The user re-explains context every time.

## Proposed Solution

### Phase 1: Context-Aware Generation

Inject the user's meeting history into Claude's system prompt during summary generation. The ContextWizard opens with Cedar's suggested extraction goal instead of a blank slate.

### Phase 2: Cedar Sidebar Agent

An always-available chat drawer in the navbar. Cedar has tools to query the user's accumulated meeting intelligence — past summaries, topic threads, and patterns. Multi-turn agent loop using Claude's tool_use.

---

## Technical Approach

### Phase 1: Context-Aware Generation

#### 1a. Context injection function

New file: `src/lib/cedar-context.ts`

```typescript
interface CedarContext {
  recentMeetings: Array<{
    id: string;
    title: string;
    date: string;
    extractionGoal: string;
    tags: string[];
  }>;
  recurringThemes: Array<{ tag: string; count: number }>;
  suggestedGoal: string | null;
}

export async function buildContextInjection(
  userId: string,
  supabase: SupabaseClient,
): Promise<CedarContext>;
```

**Queries:**

1. Last 10 summaries for the user (titles, dates, `context->extractionGoal`, `selected_tags`)
2. `selected_tags` aggregated by frequency across all user summaries (`unnest(selected_tags) GROUP BY tag ORDER BY count DESC LIMIT 20`)

**Suggested goal generation:** Algorithmic, not AI-generated. Based on:

- Most frequent extraction goal pattern (if user always asks for "decisions and blockers," suggest that)
- Recurring tags from `selected_tags`
- If insufficient data (< 3 summaries), return `null`

This avoids an additional Claude API call and keeps Phase 1 fast and cheap.

#### 1c. Modify system prompt construction

In `src/lib/claude.ts`, modify `buildUserMessage()` to accept an optional `CedarContext` and append a context block:

```
## Context from Your Meeting History
You have 12 meetings in your history. Key patterns:
- Recurring tags: trust (7 meetings), timeline (5), hiring (4)
- You typically focus on: decisions, blockers, and action items

Recent meetings:
- "API Redesign Review" (Feb 14) — focused on technical decisions
- "Sprint Planning" (Feb 16) — focused on capacity and timeline
```

This is appended to the user message, not the system prompt, so it's visible to the model alongside the transcript.

#### 1c. ContextWizard suggestion UX

Modify `src/components/ContextWizard.tsx`:

- Add a `useEffect` that calls a new API endpoint or server action to fetch `CedarContext` on mount (only for authenticated users with history)
- If `suggestedGoal` is non-null, render a highlighted "Cedar suggests" card above the four template cards
- Card shows the suggestion text with a brief rationale ("Based on your last 5 meetings...")
- Clicking it populates the extraction goal textarea (same as clicking any template)
- If the user ignores it and picks a template, the suggestion is simply discarded
- No suggestion for guests or users with < 3 summaries

**API endpoint:** `GET /api/cedar/context` — returns `CedarContext` for the authenticated user. Rate limited at 30/hr (lightweight query, not AI call).

---

### Phase 2: Cedar Sidebar Agent

#### 2a. Cedar agent API route

New file: `src/app/api/cedar/chat/route.ts`

**Request:**

```typescript
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  // Full conversation history for multi-turn
}
```

**Response:** SSE stream using the same `ReadableStream` + `send()` pattern from `/api/summarize`.

**Events:**

- `thinking` — Cedar is processing (optional, for UX feedback)
- `tool_call` — Cedar is using a tool (name + brief description for UI)
- `tool_result` — Tool returned data (optional, for transparency)
- `text_chunk` — Streaming text response
- `done` — Response complete
- `error` — Something went wrong

**Agent loop (server-side):**

```typescript
const messages = [...userMessages]; // conversation history
const tools = cedarToolDefinitions;
const systemPrompt = buildCedarSystemPrompt(cedarContext);

let response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001', // fast + cheap for chat
  max_tokens: 2048,
  system: systemPrompt,
  messages,
  tools,
});

// Agent loop: keep going while Claude wants to use tools
while (response.stop_reason === 'tool_use') {
  const toolBlocks = response.content.filter((b) => b.type === 'tool_use');

  for (const toolCall of toolBlocks) {
    send('tool_call', { name: toolCall.name });
    const result = await executeCedarTool(toolCall, userId, supabase);
    messages.push(
      { role: 'assistant', content: response.content },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolCall.id, content: result }],
      },
    );
  }

  response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
    tools,
  });
}

// Final text response — stream it
const textContent = response.content.find((b) => b.type === 'text');
send('text_chunk', { text: textContent.text });
send('done', {});
```

**Note on streaming:** The inner loop uses non-streaming `messages.create()` for tool iterations (fast, small responses). Only the final text response could use streaming for progressive rendering. For the prototype, batch the final response — streaming adds complexity with minimal UX benefit given Haiku's speed.

**Rate limit:** 30 messages/hour per user, separate from summary generation's 10/hr limit.

**Auth:** Required. Return 401 for unauthenticated requests.

**Safety:** All tool execution happens server-side with the authenticated user's Supabase client, inheriting RLS. No risk of cross-user data access.

#### 2b. Cedar tool definitions

New file: `src/lib/cedar-tools.ts`

Five read-only tools (summaries-only, no pearl queries):

**`search_meetings`**

```typescript
{
  name: 'search_meetings',
  description: 'Search past meetings by topic, date range, or keyword. Returns titles, dates, and key highlights.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (topic, keyword, or phrase)' },
      days_back: { type: 'number', description: 'Limit to meetings within this many days. Default 30.' },
      limit: { type: 'number', description: 'Max results. Default 5, max 10.' }
    },
    required: ['query']
  }
}
```

**Implementation:** Full-text search on `search_text` column (existing GIN index), filtered by date range, returns: `{ id, title, created_at, extractionGoal, selectedTags, summaryExcerpt }`. Summary excerpt is first 500 chars of the first summary string.

**`get_meeting_detail`**

```typescript
{
  name: 'get_meeting_detail',
  description: 'Get full details of a specific meeting including its complete summary content.',
  input_schema: {
    type: 'object',
    properties: {
      meeting_id: { type: 'string', description: 'The meeting/summary UUID' }
    },
    required: ['meeting_id']
  }
}
```

**Implementation:** Query `summaries` by id. Returns full summary markdown (truncated to 4000 chars if longer), title, date, extraction goal, selected tags. Scoped to authenticated user via RLS.

**`find_speaker_mentions`**

```typescript
{
  name: 'find_speaker_mentions',
  description: 'Find meetings where a specific person was mentioned or participated. Searches summary content for the speaker name.',
  input_schema: {
    type: 'object',
    properties: {
      speaker_name: { type: 'string', description: 'Name of the person to search for' },
      limit: { type: 'number', description: 'Max meetings to return. Default 5, max 10.' }
    },
    required: ['speaker_name']
  }
}
```

**Implementation:** Full-text search on `search_text` for the speaker name, falling back to `ILIKE '%name%'` on `search_text` if no GIN match. Returns: `{ meetings: [{ id, title, date, tags, summaryExcerpt }] }`. Less precise than pearl-based speaker attribution but surfaces relevant meetings.

**`get_topic_thread`**

```typescript
{
  name: 'get_topic_thread',
  description: 'Track how a topic has evolved across meetings by searching summary content and tags.',
  input_schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'The topic or concept to track' },
      limit: { type: 'number', description: 'Max meetings to include. Default 5.' }
    },
    required: ['topic']
  }
}
```

**Implementation:** Two-pronged: (1) summaries where `selected_tags` contains the topic (`selected_tags @> ARRAY['{topic}']`), (2) full-text search on `search_text` as fallback. Combines and deduplicates. Returns chronological thread: `{ meetings: [{ id, title, date, tags, summaryExcerpt }] }`.

**`get_recent_activity`**

```typescript
{
  name: 'get_recent_activity',
  description: 'Get a summary of recent meeting activity.',
  input_schema: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'How many days back to look. Default 7.' }
    }
  }
}
```

**Implementation:** Summaries from last N days: `{ totalMeetings, meetings: [{ id, title, date, tags, extractionGoal }], topTagsOverall }`. Tags aggregated from `selected_tags` across results.

#### 2c. Cedar system prompt

New constant in `src/lib/cedar-tools.ts` or `src/lib/cedar-prompt.ts`:

```
You are Cedar, a meeting intelligence agent. You help users understand their
meeting history, prepare for upcoming conversations, and surface patterns
they might miss.

## About This User
{injected from buildContextInjection() — themes, speakers, meeting count}

## Your Tools
You have tools to search meetings, track topics across sessions, and view
recent activity. Use them to ground your responses in actual data.

## Your Character
- **Scout**: Notice patterns across meetings — "trust has come up in 4 of
  your last 6 meetings"
- **Mirror**: Reflect what the evidence suggests — "based on these quotes,
  the team seems concerned about timeline"
- **Sage**: Be honest about confidence — "I only have 2 data points on this,
  so take this with a grain of salt"

## Guidelines
- Always ground claims in specific meetings, quotes, or data
- When you don't have enough data, say so plainly
- Keep responses concise — the user wants signal, not prose
- Reference meetings by title and date so the user can find them
- Use direct quotes from pearls when they're available and relevant
- If a question requires data you don't have, suggest what the user could
  do to help ("If you process your Thursday meeting, I'll have more to work with")
```

#### 2d. Sidebar UI component

New file: `src/components/CedarSidebar.tsx`

**Component structure:**

```
<CedarSidebarProvider>       // React context in layout.tsx
  <CedarSidebarTrigger />    // Button in NavBar
  <CedarSidebarPanel />      // The actual drawer
    <CedarMessageList />     // Scrollable message area
    <CedarInput />           // Text input + send button
</CedarSidebarProvider>
```

**Implementation approach:** Use Radix UI's `Sheet` component (or a custom fixed-position panel). The sidebar renders as an overlay on the right side of the viewport, not a layout-shifting flex container. This avoids reflows in existing page content.

```tsx
// CedarSidebarPanel.tsx — simplified structure
<div
  className={cn(
    'fixed top-14 right-0 bottom-0 w-[400px] z-40',
    'bg-background border-l shadow-lg',
    'flex flex-col',
    'transform transition-transform duration-200',
    isOpen ? 'translate-x-0' : 'translate-x-full',
  )}
>
  <header className="flex items-center justify-between p-4 border-b">
    <h2>Cedar</h2>
    <Button variant="ghost" onClick={close}>
      ×
    </Button>
  </header>

  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {messages.map((msg) => (
      <CedarMessage key={msg.id} message={msg} />
    ))}
    {isThinking && <CedarThinkingIndicator />}
  </div>

  <footer className="p-4 border-t">
    <CedarInput onSend={sendMessage} disabled={isThinking} />
  </footer>
</div>
```

**Key details:**

- `top-14` positions below the navbar (h-14)
- `z-40` sits below the navbar's `z-50` but above page content
- CSS transform for open/close animation (no layout reflow)
- `w-[400px]` on desktop, `w-full` on mobile (full-screen overlay)
- On mobile (`< lg`): add a backdrop overlay and make the panel full-width

#### 2e. Sidebar state management

New file: `src/lib/cedar-sidebar-context.tsx`

```typescript
interface CedarSidebarState {
  isOpen: boolean;
  messages: CedarMessage[];
  isThinking: boolean;
  currentToolCall: string | null; // e.g., "Searching meetings..."
}

interface CedarMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; result?: string }>;
  timestamp: Date;
}
```

Managed via `useReducer` in a React context provider, placed in `layout.tsx`.

**Conversation persistence:** localStorage for the prototype. Save messages to `context-keeper:cedar-conversation` on each message. Restore on mount. Clear after 24 hours or on explicit "New conversation" action.

#### 2f. Navbar integration

Modify `src/components/NavBar.tsx`:

- Add a Cedar icon button (visible only for authenticated users)
- Icon: a simple tree/leaf icon, or a chat bubble with a Cedar label
- Clicking toggles `CedarSidebarProvider.toggle()`
- Visual indicator when sidebar is open (highlighted icon)

#### 2g. SSE consumption in sidebar

Reuse `src/lib/sse.ts`'s `consumeSSE` utility. The sidebar's `sendMessage` function:

1. Appends the user message to state
2. POSTs to `/api/cedar/chat` with full conversation history
3. Consumes SSE events:
   - `tool_call` → set `currentToolCall` state (shows "Searching meetings..." in UI)
   - `text_chunk` → accumulate into assistant message
   - `done` → finalize message, clear thinking state
   - `error` → show error in chat with retry option

---

## Implementation Phases

### Phase 1: Context-Aware Generation

| Step | Files                                | Description                                          |
| ---- | ------------------------------------ | ---------------------------------------------------- |
| 1a   | `src/lib/cedar-context.ts`           | Context injection function (queries summaries table) |
| 1b   | `src/app/api/cedar/context/route.ts` | API endpoint for context                             |
| 1c   | `src/lib/claude.ts`                  | Modify `buildUserMessage()` to accept context        |
| 1d   | `src/components/ContextWizard.tsx`   | Suggestion card UX                                   |

### Phase 2: Cedar Sidebar Agent

| Step | Files                               | Description                  |
| ---- | ----------------------------------- | ---------------------------- |
| 2a   | `src/lib/cedar-tools.ts`            | Tool definitions + execution |
| 2b   | `src/app/api/cedar/chat/route.ts`   | Agent loop API route         |
| 2c   | `src/lib/cedar-sidebar-context.tsx` | Sidebar state provider       |
| 2d   | `src/components/CedarSidebar.tsx`   | Sidebar panel component      |
| 2e   | `src/components/CedarMessage.tsx`   | Message display component    |
| 2f   | `src/components/CedarInput.tsx`     | Chat input component         |
| 2g   | `src/components/NavBar.tsx`         | Cedar icon trigger           |
| 2h   | `src/app/layout.tsx`                | Add CedarSidebarProvider     |

**Build order:** 2a → 2b (can test via curl) → 2c → 2d/2e/2f (parallel) → 2g → 2h

---

## Acceptance Criteria

### Phase 1

- [ ] Authenticated user with 3+ summaries sees "Cedar suggests" card in ContextWizard
- [ ] Suggestion is based on actual meeting history (extraction goal patterns, recurring themes)
- [ ] Users with < 3 summaries or guests see no suggestion (standard wizard)
- [ ] Clicking the suggestion card populates the extraction goal textarea
- [ ] Context block is injected into the user message sent to Claude
- [ ] No additional Claude API calls are made for context injection (algorithmic only)
- [ ] No pearl queries — context derived entirely from summaries table

### Phase 2

- [ ] Cedar icon visible in navbar for authenticated users, hidden for guests
- [ ] Clicking Cedar icon opens a sidebar panel on the right
- [ ] User can type a message and receive a streaming response
- [ ] Cedar uses tools to query real meeting data (summaries, pearls, speakers)
- [ ] Tool usage is visible in the UI ("Searching meetings...")
- [ ] Sidebar persists across navigation (stays open when changing pages)
- [ ] Conversation survives page refresh (localStorage persistence)
- [ ] Sidebar works on mobile as a full-screen overlay
- [ ] Rate limited at 30 messages/hr per user
- [ ] All data queries scoped to authenticated user (RLS enforced)

---

## Key Decisions

| Decision                                | Choice                                         | Rationale                                                                      |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Model for Cedar chat                    | Haiku 4.5                                      | Fast + cheap. Chat doesn't need Opus/Sonnet quality.                           |
| Sidebar positioning                     | Fixed overlay (not flex layout)                | No layout reflow, no impact on existing pages                                  |
| Context injection approach              | Algorithmic (not AI-generated)                 | No extra Claude call, fast, cheap, deterministic                               |
| Tool results size                       | Bounded (5-10 results, 500-3000 char excerpts) | Keeps context window manageable                                                |
| Conversation persistence                | localStorage, 24hr TTL                         | Good enough for prototype, no new DB tables                                    |
| Guest access                            | Hidden — authenticated only                    | Cedar's value is accumulated data; guests have none                            |
| Read/write scope                        | Read-only tools                                | Safety first; write tools are a future addition                                |
| Streaming                               | Batch final response (not token-by-token)      | Haiku is fast enough; simplifies implementation                                |
| Relationship to Cedar Essence dashboard | Complementary                                  | Sidebar = conversational access, dashboard = structured view. Same data layer. |

---

## Dependencies and Risks

| Risk                                    | Mitigation                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Context window overflow for power users | Tool results are bounded; Cedar system prompt is <1K tokens; conversation history truncated after 20 messages  |
| Cost per conversation                   | Haiku is ~20x cheaper than Opus; bounded tool results keep input tokens low; rate limit of 30/hr caps exposure |
| Topic matching quality                  | Full-text search + tag array matching; can upgrade to trigram similarity (`pg_trgm`) or embeddings if needed   |
| Sidebar conflicts with PearlsSidebar    | PearlsSidebar is inline (flex layout), not fixed-position. Both can coexist — Cedar overlays on top.           |
| Agentic loop hangs                      | Max 5 tool iterations per message; 30-second timeout on the API route; AbortController on client               |

---

## Not In Scope (Prototype)

- Pearl queries (pearls excluded from prototype scope)
- Speaker quote attribution (only summary-text mentions, no pearl-level quotes)
- Proactive suggestions (Cedar initiates, not just responds)
- Write tools (Cedar modifying data)
- MCP server / external API surface
- Calendar integration
- Embedding/vector search (pgvector)
- Server-side conversation persistence
- Decision/action entity types (from Cedar Essence spec)
- Briefing generation

---

## References

- Brainstorm: `docs/brainstorms/2026-02-17-agent-native-cedar-brainstorm.md`
- Cedar Essence: `docs/brainstorms/2026-02-14-cedar-essence-brainstorm.md`
- Cedar Spec: `CEDAR_SPEC.md` (AI character, cross-seed intelligence)
- Prompt patterns: `docs/institutional-learnings/prompt-patterns-reference.md`
- SSE pattern: `src/app/api/summarize/route.ts` (lines 120-290)
- Existing sidebar layout: `src/components/SummaryView.tsx` (lines 847-893)
- Tool schemas: `src/lib/claude.ts` (lines 53-71, 358-384, 471-520)
