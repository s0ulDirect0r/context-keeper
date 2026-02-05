import type { SummaryContext, Theme } from '@/lib/claude';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      summaries: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          summaries: Json;
          themes: Json;
          context: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          summaries: Json;
          themes?: Json;
          context: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          summaries?: Json;
          themes?: Json;
          context?: Json;
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
  summaries: string[];
  themes: Theme[];
  context: SummaryContext;
  createdAt: Date;
  updatedAt: Date;
}

export function toSavedSummary(row: Database['public']['Tables']['summaries']['Row']): SavedSummary {
  return {
    id: row.id,
    title: row.title,
    summaries: row.summaries as unknown as string[],
    themes: row.themes as unknown as Theme[],
    context: row.context as unknown as SummaryContext,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
