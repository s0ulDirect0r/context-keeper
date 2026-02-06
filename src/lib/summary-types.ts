// Shared types for structured summaries — safe to import from client components.
// Kept separate from claude.ts to avoid pulling the Anthropic SDK into the browser bundle.

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
