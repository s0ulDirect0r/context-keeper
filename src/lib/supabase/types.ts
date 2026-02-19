// Supabase database types — kept here because they mirror the auto-generated schema.
// Domain types (SavedSummary, etc.) live in @/models/types.

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
          share_token?: string;
          is_shared?: boolean;
          search_text?: string | null;
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
