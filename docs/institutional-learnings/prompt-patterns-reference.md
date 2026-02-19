# Prompt Engineering Patterns — Cedar Reference

> Quick reference for AI prompt design patterns proven in context-keeper codebase
> Based on: `src/lib/claude.ts` (Summary, Tag, Pearl extraction)

---

## Pattern 1: Progressive Multi-Pass Extraction

### How It Works

Process the same input through **multiple specialized prompts**, each building on prior outputs:

```
Input (transcript)
  ↓
Pass 1: SUMMARY_SYSTEM_PROMPT
  → Audience-tailored narrative (free-form markdown)
  ↓
Pass 2: TAG_EXTRACTION_PROMPT
  → Concept tags (10-15 single-word abstract themes)
  ↓
Pass 3: PEARL_EXTRACTION_PROMPT (constrained by tags)
  → Grounded observations (3-7 quote-anchored insights)
```

### Why This Works

- **Each pass has focused constraints** — tag extraction doesn't try to extract pearls; pearl extraction uses tags as guidance
- **Isolation prevents prompt bloat** — the tag prompt is simple because pearls are separate
- **Quality improves with scaffolding** — knowing "trust" is a theme makes pearl extraction more coherent
- **Reusable for different inputs** — same three passes work for transcripts, notes, documents

### When to Use

- Extracting multiple semantic types from the same input
- Quality matters more than latency (you're calling Claude 3 times per seed)
- Each output feeds into the next (tags → pearls, pearls → decisions)

### Cost Trade-off

Three API calls per seed. On Context Keeper: ~$0.09 per seed (1x summary + 1x tags + 1x pearls at Sonnet-4 pricing). Acceptable for strategic intelligence.

---

## Pattern 2: Voice Specification + Tone Guard

### Pearl Extraction Example

```markdown
## Voice

The user message will tell you who the reader is (or that they're not a speaker).
Follow those instructions for voice:

- When the reader IS a speaker: use "you" for pearls about them,
  use the speaker's name (third person) for pearls about others.
- When the reader is NOT a speaker: use the quoted speaker's name
  as the subject for all pearls. Never use "you."

The tone is a reflective mirror: gentle, observational, not prescriptive.
You surface what's there — you don't tell them what to do about it.
```

### Why This Works

- **Explicit voice instruction prevents AI drift** — without this, Claude might default to cheerleader or stern coach
- **Reader perspective matters** — changing "you" vs. "they" changes who experiences the insight
- **"Reflective mirror" is more concrete than "neutral"** — it gives Claude a specific character to embody

### For Cedar Briefing

Adapt for Sage character:

```markdown
## Voice

You are the Sage character: observational, grounded in evidence, honest about
uncertainty. You surface what's actually there — what the evidence suggests —
without manufacturing urgency.

- When confidence is high: "This is now clear from your evidence..."
- When evidence is mixed: "Your evidence on this is split..."
- When something is emerging: "This pattern is beginning to show..."
- When no action is needed: "This may be worth sitting with."

Tone: warm, direct, no corporate speak. You're having a conversation, not writing a report.
```

---

## Pattern 3: Hard Constraints on Output

### Example: Pearl Insight Length

```markdown
Insights must be **short and punchy — 6 to 12 words.** Think caption, not commentary.

- GOOD: "You extend trust before it's earned."
- GOOD: "You pull back when Alex raises timelines."
- BAD (too long): "There's a pattern of you extending trust early — something that seems
  to come naturally"
- BAD (prescriptive): "You should be more careful with trust"
```

### Example: Tag Format

```markdown
Extract 10-15 concept tags that represent the key themes, dynamics, and patterns
in this conversation. These tags should be:

- EXACTLY ONE WORD each, matching the regex /^\S+$/ — no spaces, no exceptions.
```

### Why This Works

- **Regex enforcement is precise** — Claude can validate its own output against the pattern
- **Examples prevent bad outputs** — showing GOOD vs. BAD is more effective than describing constraints
- **Constraints force clarity** — forcing 6-12 words makes Claude drop filler

### For Cedar Briefing

Apply hard constraints:

```markdown
BRIEFING STRUCTURE:

- Paragraph 1: What changed since last briefing (new evidence, shifted confidence)
- Paragraph 2: Active decisions requiring attention (3-4 max)
- Paragraph 3: Recurring themes + frequency (if 2+ summaries with evidence)
- Paragraph 4: No action needed items (if applicable)

CONSTRAINT: Each paragraph max 3 sentences. Each sentence max 20 words.
Brevity is good. Rambling is bad.

Do NOT:

- Invent urgency that isn't in the evidence
- Use hedging language ("might," "could," "perhaps")
- Apologize for gaps in evidence
```

---

## Pattern 4: Tool-Based Structured Output

### Why Use Tools Instead of Parsing Text

```typescript
const PEARL_EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_pearls',
  description: 'Submit field observations — evidence of patterns and dynamics from the meeting.',
  input_schema: {
    type: 'object',
    properties: {
      pearls: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            insight: { type: 'string' },
            concepts: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
            quote: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                speaker: { type: 'string' },
                is_user: { type: 'boolean' },
              },
              required: ['text'],
            },
          },
          required: ['id', 'insight', 'concepts', 'quote'],
        },
        minItems: 3,
        maxItems: 7,
      },
    },
    required: ['pearls'],
  },
};
```

### Benefits

- **Guaranteed structure** — Claude outputs valid JSON or fails gracefully (returns empty array)
- **Validation built-in** — the schema enforces min/max items, required fields
- **Type-safe in code** — the TypeScript type matches the tool schema exactly
- **Easier to debug** — structured output = easier to see where extraction went wrong

### For Cedar Briefing

Define a BRIEFING_TOOL:

```typescript
const BRIEFING_TOOL = {
  name: 'generate_briefing',
  input_schema: {
    type: 'object',
    properties: {
      briefing_markdown: {
        type: 'string',
        description: 'The briefing narrative (markdown, 3-4 paragraphs, max 500 words)',
      },
      key_insight: {
        type: 'string',
        description: 'One-liner summary of the most important change or pattern',
      },
      confidence_notes: {
        type: 'object',
        properties: {
          well_founded_claims: { type: 'array', items: { type: 'string' } },
          emerging_patterns: { type: 'array', items: { type: 'string' } },
          mixed_evidence: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['briefing_markdown', 'key_insight'],
  },
};
```

This lets the briefing **expose its confidence reasoning** back to the UI (show badge colors for well-founded vs. emerging).

---

## Pattern 5: Conditional Input Scaffolding

### Pearl Extraction Example

```typescript
let userIdentityNote = '';
if (speakerIdentity?.userName) {
  userIdentityNote = `\n\n**The person reading this is "${speakerIdentity.userName}"
    in the transcript.** For pearls about this speaker, use "you"...`;
} else {
  userIdentityNote = `\n\n**The reader is NOT one of the speakers in this conversation.**
    Do not use "you" in insight text...`;
}

let tagFocusNote = '';
if (selectedTags && selectedTags.length > 0) {
  tagFocusNote = `\n\n**Focus your observations on these concept areas:**
    ${selectedTags.join(', ')}...`;
}

const userMessage = `...${userIdentityNote}${tagFocusNote}...`;
```

### Why This Works

- **Prompt adapts to context** — the AI gets different instructions depending on whether the reader is a speaker
- **Optional scaffolding** — if no tags selected, the focus note is omitted (simpler prompt)
- **No prompt duplication** — conditional text insertion beats maintaining separate prompts

### For Cedar Briefing

Adapt based on:

```typescript
// Brief user context
const userContextNote = user.role
  ? `**Your role:** ${user.role}. Emphasize decisions and risks most relevant to that perspective.`
  : '';

// Time window
const timeWindowNote = lastBriefingDate
  ? `**Since last briefing (${daysSince} days ago):** ${daysSince > 7 ? 'weekly' : 'ongoing'} update.`
  : '**First briefing.** Synthesizing all available evidence.';

// Scope
const scopeNote = `**Evidence in scope:** ${recentSeedCount} recent inputs,
  ${totalPearlCount} total pearls, ${decisionCount} active decisions.`;
```

---

## Pattern 6: Error Handling — Non-Critical Extraction

### Current Code Pattern

```typescript
export async function extractPearls(...): Promise<Pearl[]> {
  try {
    const response = await client.messages.create({...});
    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (toolBlock && toolBlock.type === 'tool_use') {
      const input = toolBlock.input as { pearls?: RawPearl[] };
      return (input.pearls || []).map(normalizePearl);
    }
    return [];
  } catch (error) {
    // Pearl extraction is non-critical — log and return empty
    console.error('Pearl extraction failed:', error);
    return [];
  }
}
```

### Why This Pattern

- **Extraction failure doesn't block the summary** — user gets summary + decisions even if pearls fail
- **Graceful degradation** — return empty array, don't crash
- **Logged for monitoring** — we know extraction is failing (Sentry integration)

### For Cedar Briefing

Briefing generation is **more critical** — may warrant different handling:

```typescript
export async function generateBriefing(
  user: User,
  recentPearls: Pearl[],
  decisions: Decision[],
  actions: Action[],
): Promise<{ briefing: string; error?: string }> {
  try {
    if (recentPearls.length < 3) {
      return { briefing: COLD_START_MESSAGE }; // Explicit cold-start instead of API call
    }

    const response = await client.messages.create({...});
    // ... extract briefing from response ...
    return { briefing };
  } catch (error) {
    // Log for Sentry, but return degraded briefing (don't lose context)
    console.error('Briefing generation failed:', error);
    Sentry.captureException(error);
    return {
      briefing: `Could not generate briefing (${error.message}).
                 Try again or contact support.`,
      error: error.message,
    };
  }
}
```

**Don't fail silently on briefing.** Show the error to the user.

---

## Pattern 7: Type Normalization (snake_case ↔ camelCase)

### Current Code

```typescript
/** Raw pearl shape from Claude's tool response (uses snake_case) */
interface RawPearl {
  id: string;
  insight: string;
  concepts: string[];
  quote?: { text: string; speaker?: string; is_user?: boolean };
}

/** Normalize snake_case tool response to camelCase Pearl type */
function normalizePearl(raw: RawPearl): Pearl {
  const pearl: Pearl = {
    id: raw.id,
    insight: raw.insight,
    concepts: raw.concepts,
  };
  if (raw.quote) {
    pearl.quote = {
      text: raw.quote.text,
      speaker: raw.quote.speaker,
      isUser: raw.quote.is_user ?? false, // snake_case → camelCase
    };
  }
  return pearl;
}
```

### Why This Matters

- **Tool schema is snake_case** (JSON convention, matches Python/Node libs)
- **TypeScript code is camelCase** (JS convention)
- **Normalization layer prevents snake_case leaking into domain code**

### For Cedar

When adding briefing and other new tools, maintain the same pattern:

```typescript
interface RawBriefing {
  briefing_markdown: string;
  key_insight: string;
  confidence_notes?: {
    well_founded_claims: string[];
    emerging_patterns: string[];
    mixed_evidence: string[];
  };
}

function normalizeBriefing(raw: RawBriefing): Briefing {
  return {
    markdown: raw.briefing_markdown,
    keyInsight: raw.key_insight,
    confidenceNotes: raw.confidence_notes
      ? {
          wellFoundedClaims: raw.confidence_notes.well_founded_claims,
          emergingPatterns: raw.confidence_notes.emerging_patterns,
          mixedEvidence: raw.confidence_notes.mixed_evidence,
        }
      : undefined,
  };
}
```

---

## Summary: Patterns for Cedar Implementation

| Pattern                     | When to Use                                      | Cedar Application                                    |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| **Multi-pass extraction**   | Multiple semantic types from same input          | Summary → Tags → Pearls → Decisions → Briefing       |
| **Voice specification**     | AI character consistency matters                 | Sage voice in briefing                               |
| **Hard constraints**        | Output format must be precise                    | Briefing length, decision confidence, action status  |
| **Tool-based output**       | JSON structure is critical                       | Briefing tool, decision tool, action tool            |
| **Conditional scaffolding** | Prompt adapts to context                         | User role, time window, scope                        |
| **Graceful degradation**    | Extraction can fail without crashing             | Briefing generation retries, cold-start messaging    |
| **Type normalization**      | Convention mismatch between tool schema and code | Raw{X} interface → normalize → camelCase domain type |

---

## Concrete Examples for Briefing Prompt

Based on these patterns, here's a rough briefing prompt skeleton:

```markdown
You are the Cedar briefing writer — a character we call the Sage. Your job is to
write a weekly strategic briefing that helps ${user.name} see what their evidence
actually suggests.

## Voice

- Observational, not prescriptive. Surface what's there.
- Grounded in evidence. Every claim traces back to a pearl quote.
- Honest about confidence. "This is clear" vs. "This is emerging" vs. "Evidence is mixed."
- No manufactured urgency. The evidence determines importance, not you.

## Your Input

You have:

- ${recentPearls.length} recent pearls (extracted from this week's meetings/notes)
- ${decisions.length} active decisions (with confidence levels)
- ${actions.length} open actions (with status)
- User context: ${user.role}, cares about ${user.priorities.join(', ')}

## Your Output

Write a briefing (3-4 paragraphs, ~300 words):

1. What changed since the last briefing?
2. Which active decisions need attention?
3. What themes are recurring?
4. What doesn't need action right now?

CONSTRAINT: Max 20 words per sentence. No hedging ("might," "could," "perhaps").
Each paragraph should be scannable in 30 seconds.

Use the pearls and decisions provided. Cite them specifically.
```

This skeleton follows all the patterns above. Implement it, iterate against mock data, and Cedar's briefing engine is real.
