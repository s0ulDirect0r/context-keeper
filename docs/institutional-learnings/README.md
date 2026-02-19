# Institutional Learnings — Cedar Essence

This directory contains distilled institutional knowledge relevant to implementing Cedar Essence. The learnings come from the codebase audit, existing prompt engineering patterns, and prior brainstorms.

## Documents

### 1. **cedar-essence-findings.md** (Main Reference)

Comprehensive findings from institutional knowledge research. Start here for:

- **Executive summary** of Cedar Essence vs. original Cedar spec
- **AI prompt engineering patterns** used in existing codebase + implications for briefing
- **Cross-seed intelligence** architectural options with trade-offs
- **Data model** — what exists, what needs wiring
- **Mock data strategy** — why and how
- **Audit findings** — what still matters
- **Open questions** requiring decisions
- **Recommended phasing** for implementation

**Read this before planning.** It answers 80% of the technical questions.

### 2. **prompt-patterns-reference.md** (Implementation Guide)

Quick reference for prompt engineering patterns proven in context-keeper.

Topics:

- Progressive multi-pass extraction (summary → tags → pearls)
- Voice specification + tone guarding (Sage character)
- Hard constraints on output (forcing structure)
- Tool-based structured output (JSON reliability)
- Conditional input scaffolding (adaptive prompts)
- Graceful error handling
- Type normalization (snake_case ↔ camelCase)

**Read this while implementing briefing prompt and new Claude calls.**

## Key Insights at a Glance

### What Changed Between Cedar Spec → Cedar Essence

| Aspect                      | Cedar Spec                           | Cedar Essence                                        |
| --------------------------- | ------------------------------------ | ---------------------------------------------------- |
| **Primary Interface**       | Constellation (force-directed graph) | Briefing + Dashboard                                 |
| **Team Features**           | Real team auth, multi-user           | Mock data only                                       |
| **Seeds Table**             | New table, separate entity           | Reuse summaries table                                |
| **Cross-Seed Intelligence** | Noted as important but v2            | **Core v1 feature**                                  |
| **Onboarding**              | Elaborate with demo constellation    | Honest cold-start (1 input = summary, 5+ = briefing) |

**Bottom line:** Cedar Essence is **smaller scope, same or better value.** By cutting UI complexity (constellation, team features, elaborate onboarding), we focus engineering on the core magic: **cross-seed intelligence + briefing generation.**

### Critical Technical Decisions

1. **Cross-Seed Intelligence Approach**
   - **Recommendation:** Start with structured DB queries (approach A: concept + speaker overlap)
   - **Fallback:** Add pgvector embeddings (approach B) if A shows too many semantic misses
   - **Timeline:** A is ready today, B can be added later

2. **Briefing Generation Frequency**
   - **Needs decision:** On-demand? Periodic (daily/weekly)? Event-triggered? Cached?
   - **Trade-off:** On-demand is flexible but expensive. Periodic is cheaper but may feel stale.
   - **Recommendation for planning:** On-demand with 24h cache (refresh on user action)

3. **Mock Data First or Pipeline First?**
   - **Recommendation:** Mock data first (1-2 weeks)
   - **Reason:** Validate UX before wiring full pipeline. Demos have substance.

4. **Persistent User Context**
   - **Options:** Onboarding wizard? Settings page? Inferred from inputs? Simple form?
   - **Recommendation for v1:** Simple single-page form (role, priorities). Defer to v2.

### Cost of Implementation

**Multi-pass extraction cost per seed:**

- Summary: ~$0.03 (Sonnet-4, 6K tokens)
- Tags: ~$0.015 (2K tokens)
- Pearls: ~$0.04 (4K tokens)
- **Total:** ~$0.085 per seed (transcript + tags + pearls)

**Briefing generation cost:**

- One API call per briefing (depends on context window)
- Estimate: ~$0.015-0.03 per briefing (with smart retrieval)
- **Much cheaper if cached** (weekly briefing = ~$0.10/week per user)

### Audit Findings Still Relevant

✅ Fixed in Week 1:

- Rate limiting
- Input validation
- Security headers
- Markdown table rendering
- Sentry integration

⚠️ Still matters for Cedar:

- Zero test coverage (E2E tests needed before Cedar v1)
- No pagination (Cedar loads years of data, pagination is critical)
- No CI/CD (already fixed, keep it)

### Data Model (Minimal Changes)

Existing tables all we need:

- `summaries` (treat each row as a Seed)
- `decisions` (create if not exist, wire into flow)
- `actions` (create if not exist, wire into flow)
- `pearls` (created during summary generation)

New columns needed:

- `summaries.briefing_markdown` (cached briefing)
- `summaries.briefing_generated_at`
- `summaries.requires_briefing_refresh`

No new tables required.

## Recommended Reading Order

1. **cedar-essence-findings.md** — Full context (30 min read)
2. **prompt-patterns-reference.md** — Implementation patterns (15 min read)
3. **Specific sections** as needed during planning/implementation

## Questions to Answer Before Planning

These are from the Cedar Essence brainstorm and should inform the `/workflows:plan` output:

1. Briefing generation: on-demand, periodic, or event-triggered?
2. Mock data: how many weeks? What persona?
3. Persistent user context: wizard, settings, or form?
4. Cross-seed approach: commit to A (structured) for v1?
5. Phasing: mock data first or pipeline first?

## Next Step

When ready to plan implementation, run:

```bash
/workflows:plan "Cedar Essence Implementation"
```

Reference these documents during planning for context and recommendations.

---

## Document Metadata

| Document                     | Author              | Date       | Status   |
| ---------------------------- | ------------------- | ---------- | -------- |
| cedar-essence-findings.md    | Claude Code (Haiku) | 2026-02-15 | Complete |
| prompt-patterns-reference.md | Claude Code (Haiku) | 2026-02-15 | Complete |
| README.md                    | Claude Code (Haiku) | 2026-02-15 | Complete |

Based on:

- AUDIT.md (2026-02-10)
- CEDAR_SPEC.md (vision)
- CEDAR_BUILD_SPEC.md (spec)
- cedar-essence-brainstorm.md (2026-02-14)
- src/lib/claude.ts (existing prompts)
- .claude/MEMORY.md (project context)
