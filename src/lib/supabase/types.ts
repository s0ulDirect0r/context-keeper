import type { SummaryContext, ThemeQuote } from '@/lib/claude';
import type { SummaryContent } from '@/lib/summary-types';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      summaries: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          summaries: Json;
          context: Json;
          transcripts: Json | null;
          selected_tags: string[] | null;
          share_token: string | null;
          is_shared: boolean;
          search_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          summaries: Json;
          context: Json;
          transcripts?: Json | null;
          selected_tags?: string[] | null;
          share_token?: string;
          is_shared?: boolean;
          search_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          summaries?: Json;
          context?: Json;
          transcripts?: Json | null;
          selected_tags?: string[] | null;
          share_token?: string;
          is_shared?: boolean;
          search_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pearls: {
        Row: {
          id: string;
          user_id: string;
          summary_id: string;
          insight: string;
          concepts: string[];
          quote: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          summary_id: string;
          insight: string;
          concepts?: string[];
          quote?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          summary_id?: string;
          insight?: string;
          concepts?: string[];
          quote?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      otter_connections: {
        Row: {
          id: string;
          user_id: string;
          otter_email: string;
          otter_user_id: string;
          cookies: string;
          csrf_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          otter_email: string;
          otter_user_id: string;
          cookies: string;
          csrf_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          otter_email?: string;
          otter_user_id?: string;
          cookies?: string;
          csrf_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface SavedSummary {
  id: string;
  title: string;
  summaries: SummaryContent;
  context: SummaryContext;
  transcripts: string[] | null;
  selectedTags: string[] | null;
  shareToken: string | null;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedPearl {
  id: string;
  summaryId: string;
  insight: string;
  concepts: string[];
  quote: ThemeQuote | null;
  createdAt: Date;
}

export function toSavedPearl(row: Database['public']['Tables']['pearls']['Row']): SavedPearl {
  return {
    id: row.id,
    summaryId: row.summary_id,
    insight: row.insight,
    concepts: row.concepts ?? [],
    quote: row.quote as unknown as ThemeQuote | null,
    createdAt: new Date(row.created_at),
  };
}

export function toSavedSummary(
  row: Database['public']['Tables']['summaries']['Row'],
): SavedSummary {
  return {
    id: row.id,
    title: row.title,
    summaries: row.summaries as unknown as SummaryContent,
    context: row.context as unknown as SummaryContext,
    transcripts: (row.transcripts as unknown as string[] | null) ?? null,
    selectedTags: row.selected_tags ?? null,
    shareToken: row.share_token ?? null,
    isShared: row.is_shared ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
