---
title: 'Prompt Deduplication, Next.js Same-Route Navigation, and Type Safety Patterns'
date: 2026-02-18
category: logic-errors
severity: medium
tags:
  - prompt-engineering
  - code-deduplication
  - next-js-routing
  - type-safety
  - input-validation
  - data-driven-ui
components:
  - src/lib/claude.ts
  - src/components/NavBar.tsx
  - src/components/ContextWizard.tsx
  - src/app/api/summarize/route.ts
  - src/app/page.tsx
related_pr: '#36'
related_issues: ['#33', '#19', '#20', '#21', '#22', '#24']
---

# Prompt Deduplication, Next.js Same-Route Navigation, and Type Safety Patterns

Five reusable patterns extracted from the `feat/structured-summary` branch (PR #36). Each addresses a common problem in full-stack AI apps built with Next.js.

## 1. Prompt Section Deduplication

### Problem

Multiple LLM system prompts (standard, structured, custom) each copy-pasted identical sections for quote rules and title guidance. The custom prompt's Direct Quotes section had silently drifted — missing sentences that existed in the other two. Changing one prompt required finding and updating all copies.

### Anti-Pattern

```typescript
// 6 constants, each with copy-pasted sections
const STANDARD_PROMPT = `...## Direct Quotes\n[rules]...\n## Title\n[rules]...`;
const STRUCTURED_PROMPT = `...## Direct Quotes\n[rules]...\n## Title\n[rules]...`;
const CUSTOM_PROMPT = `...## Direct Quotes\n[rules - DRIFTED]...\n## Title\n[rules]...`;
// Plus 3 streaming variants appending the same suffix
```

### Solution: Shared Constants + Factory Helper

```typescript
// Shared sections — single source of truth
const DIRECT_QUOTES_SECTION = `## Direct Quotes
When quoting speakers, follow these rules strictly:
- Pull the speaker's actual words from the transcript...
- Never mix AI-generated words with direct quotes...`;

const TITLE_SECTION = `## Title
- If title metadata is provided, use it directly.
- Otherwise, generate a concise descriptive title.`;

const STREAMING_SUFFIX = '\n\nIMPORTANT: Begin your response with a single `# Title` heading...';

// Each prompt composes shared sections via interpolation
const SUMMARY_SYSTEM_PROMPT = `You are an expert meeting analyst...
${DIRECT_QUOTES_SECTION}
...
${TITLE_SECTION}`;

// Factory helper eliminates duplicated selection ternaries
function getSystemPrompt(style: SummaryContext['summaryStyle'], streaming: boolean): string {
  const base =
    style === 'structured'
      ? STRUCTURED_SUMMARY_SYSTEM_PROMPT
      : style === 'custom'
        ? CUSTOM_SUMMARY_SYSTEM_PROMPT
        : SUMMARY_SYSTEM_PROMPT;
  return streaming ? base + STREAMING_SUFFIX : base;
}
```

### Prevention Checklist

- [ ] When adding a new prompt, check if any sections are shared with existing prompts
- [ ] Extract shared sections into named constants before they multiply
- [ ] Use a factory function for prompt selection — never duplicate ternary chains
- [ ] Grep for section headings (e.g., `## Direct Quotes`) to verify only one source exists

---

## 2. Next.js Same-Route Navigation Reset

### Problem

Clicking the "New Summary" navbar link while already on `/` did nothing. Next.js App Router doesn't re-mount a page component when navigating to the current route — `<Link href="/">` is effectively a no-op on `/`.

### Solution: Custom DOM Event Pattern

```typescript
// NavBar.tsx — dispatch event instead of navigating when on same route
const NEW_SUMMARY_EVENT = 'cedar:new-summary';

const handleNewSummary = (e: React.MouseEvent) => {
  if (pathname === '/') {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent(NEW_SUMMARY_EVENT));
  }
};

// Used on both desktop and mobile nav links
<Link href="/" onClick={handleNewSummary}>
```

```typescript
// page.tsx — listen for event and reset state
useEffect(() => {
  const handler = () => {
    streamingMarkdownRef.current = '';
    try {
      localStorage.removeItem('context-keeper-guest-edits');
    } catch {}
    dispatch({ type: 'START_OVER' });
  };
  window.addEventListener('cedar:new-summary', handler);
  return () => window.removeEventListener('cedar:new-summary', handler);
}, []);
```

### When This Applies

Any navbar/sidebar action that should trigger behavior on the **current** page. The `<Link>` handles cross-page navigation; the CustomEvent handles same-page resets.

### Prevention Checklist

- [ ] Any nav link that targets the current route needs a same-route handler
- [ ] Extract the event name as a constant (avoid string duplication)
- [ ] Always clean up event listeners in useEffect return
- [ ] Test both: navigating TO the page (Link works) and clicking WHILE on the page (event works)

---

## 3. Type-Safe Enum Handling (Replace `as` Casts)

### Problem

RadioGroup's `onValueChange` callback receives a `string`, but the state needed `'standard' | 'structured' | 'custom'`. The original code used an unsafe `as` cast: `v as 'standard' | 'structured' | 'custom'`.

### Solution: Const Array + Type Guard

```typescript
const SUMMARY_STYLES = ['standard', 'structured', 'custom'] as const;
type SummaryStyle = (typeof SUMMARY_STYLES)[number];

function isSummaryStyle(value: string): value is SummaryStyle {
  return (SUMMARY_STYLES as readonly string[]).includes(value);
}

// Safe usage — invalid values are silently rejected, not silently accepted
<RadioGroup
  onValueChange={(v) => {
    if (isSummaryStyle(v)) setSummaryStyle(v);
  }}
>
```

### Prevention Checklist

- [ ] Never use `as` to cast event handler strings to union types
- [ ] Define allowed values as `const` array, derive the type from it
- [ ] Create a type guard function for runtime validation
- [ ] Match the Zod schema at the API boundary: `z.enum(['standard', 'structured', 'custom'])`

---

## 4. Input Validation at API Boundaries

### Problem

A new `timezone` parameter was added to the `/api/summarize` route as `z.string().optional()` — no format validation. Could accept arbitrary strings including path traversal attempts or script injection.

### Solution: Regex Validation in Zod Schema

```typescript
timezone: z.string()
  .max(100)
  .regex(/^[A-Za-z_/+-]+$/, 'Invalid timezone format')
  .optional();
```

### New API Parameter Checklist

- [ ] What are the valid formats? Define a regex or use `z.enum()`
- [ ] Set a reasonable `.max()` length
- [ ] Add a descriptive error message to the constraint
- [ ] Test with: empty string, special chars, unicode, very long strings
- [ ] For enum-like values, prefer `z.enum()` over free-form `z.string()`
- [ ] For cross-field validation, use `.refine()`:
  ```typescript
  .refine(
    (ctx) => ctx.style !== 'custom' || (ctx.description ?? '').trim().length > 0,
    { message: 'Description required for custom style', path: ['description'] }
  )
  ```

---

## 5. Data-Driven UI Rendering

### Problem

Three nearly identical `<Label>` blocks for format options (Standard, Structured, Custom). Adding or changing an option required editing JSX in three places.

### Solution: Extract Data Array + `.map()`

```typescript
const FORMAT_OPTIONS = [
  { value: 'standard', label: 'Standard', description: 'Adapts to the themes' },
  { value: 'structured', label: 'Structured', description: 'Pull out central questions' },
  { value: 'custom', label: 'Custom', description: 'Describe the format you want' },
] as const;

{FORMAT_OPTIONS.map((option) => (
  <Label
    key={option.value}
    htmlFor={`style-${option.value}`}
    className={cn(
      'flex-1 flex items-start space-x-2 p-3 rounded-lg border cursor-pointer',
      summaryStyle === option.value
        ? 'ring-2 ring-primary border-primary bg-accent/30'
        : 'border-border',
    )}
  >
    <RadioGroupItem value={option.value} id={`style-${option.value}`} />
    <div className="flex-1">
      <span className="font-medium text-sm">{option.label}</span>
      <p className="text-xs text-muted-foreground">{option.description}</p>
    </div>
  </Label>
))}
```

### When to Extract

When 2+ UI blocks are identical except for data values. The signal: you're copy-pasting JSX and only changing strings.

---

## Cross-Cutting Insight

All five patterns share a root cause: **implicit duplication**. Duplicated prompt sections drift. Duplicated ternary chains diverge. Duplicated JSX blocks get out of sync. The fix is always the same: extract the shared part, name it, and reference it from a single source.

## Related Documentation

- `docs/institutional-learnings/prompt-patterns-reference.md` — Proven prompt patterns (Pattern 3: hard constraints, Pattern 5: conditional scaffolding)
- `docs/solutions/runtime-errors/pr-31-error-handling-logging-overhaul.md` — Error handling patterns
- `docs/brainstorms/2026-02-17-structured-summary-format-brainstorm.md` — Original design decisions
- `docs/plans/2026-02-18-feat-pm-feedback-structured-summary-ux-copy-plan.md` — Implementation spec
