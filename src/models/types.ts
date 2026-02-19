// Domain types — safe to import from client components.
// Zero server-only or heavy SDK imports.

// ── Summary generation context ─────────────────────────────────────

export interface SummaryContext {
  extractionGoal: string;
  additionalContext?: string;
  summaryStyle?: 'standard' | 'structured' | 'custom';
  customFormatDescription?: string;
  timezone?: string;
}

export interface SummaryMetadata {
  titles?: string[];
  dates?: string[];
}

export interface GeneratedSummary {
  title: string;
  markdown: string;
}

// ── Structured summary format ──────────────────────────────────────

export interface AttributedQuote {
  text: string;
  speaker: string;
  timestamp?: string;
}

export interface QuestionAnswer {
  question: string;
  questionSpeaker?: string;
  answer?: string;
  answerSpeaker?: string;
  unanswered?: boolean;
}

export interface EmergingTheme {
  label: string;
  bullets: string[];
}

export interface MomentumItem {
  text: string;
}

export interface StructuredSummary {
  formatVersion: 2;
  title?: string;
  date?: string;
  keyMoments?: { moments: AttributedQuote[] };
  questionsAndAnswers?: { items: QuestionAnswer[] };
  emergingThemes?: { themes: EmergingTheme[] };
  keyInsights?: { insights: AttributedQuote[] };
  momentum?: { items: MomentumItem[] };
  observersPerspective?: { content: string };
}

export type SummaryContent = string[] | StructuredSummary[];

export function isStructuredSummary(s: SummaryContent): s is StructuredSummary[] {
  return (
    Array.isArray(s) &&
    s.length > 0 &&
    typeof s[0] === 'object' &&
    s[0] !== null &&
    'formatVersion' in s[0] &&
    (s[0] as StructuredSummary).formatVersion === 2
  );
}

// ── Persisted summary ──────────────────────────────────────────────

export interface SavedSummary {
  id: string;
  title: string;
  summaries: SummaryContent;
  context: SummaryContext;
  transcripts: string[] | null;
  shareToken: string | null;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Otter connection ───────────────────────────────────────────────

export interface OtterConnection {
  email: string;
  userId: string;
  cookies: string;
  csrfToken?: string;
}
