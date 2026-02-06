import type { SummaryContext, Theme, Speaker } from '@/lib/claude';
import type { SummaryContent } from '@/lib/summary-types';

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
          transcripts: Json | null;
          speakers: Json;
          share_token: string | null;
          is_shared: boolean;
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
          transcripts?: Json | null;
          speakers?: Json;
          share_token?: string;
          is_shared?: boolean;
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
          transcripts?: Json | null;
          speakers?: Json;
          share_token?: string;
          is_shared?: boolean;
          created_at?: string;
          updated_at?: string;
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
  themes: Theme[];
  context: SummaryContext;
  transcripts: string[] | null;
  speakers: Speaker[];
  shareToken: string | null;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toSavedSummary(row: Database['public']['Tables']['summaries']['Row']): SavedSummary {
  return {
    id: row.id,
    title: row.title,
    summaries: row.summaries as unknown as SummaryContent,
    themes: row.themes as unknown as Theme[],
    context: row.context as unknown as SummaryContext,
    transcripts: (row.transcripts as unknown as string[] | null) ?? null,
    speakers: (row.speakers as unknown as Speaker[]) ?? [],
    shareToken: row.share_token ?? null,
    isShared: row.is_shared ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
