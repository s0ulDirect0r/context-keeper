-- Pearls: distilled insights extracted from meeting transcripts
CREATE TABLE pearls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  insight TEXT NOT NULL,
  concepts TEXT[] NOT NULL DEFAULT '{}',
  quote JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pearls_user_id_idx ON pearls(user_id);
CREATE INDEX pearls_summary_id_idx ON pearls(summary_id);
CREATE INDEX pearls_created_at_idx ON pearls(created_at DESC);

-- Enable Row Level Security
ALTER TABLE pearls ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage their own pearls
CREATE POLICY "Users can view own pearls" ON pearls FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own pearls" ON pearls FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own pearls" ON pearls FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- RLS: anyone can view pearls for shared summaries
CREATE POLICY "Anyone can view pearls for shared summaries" ON pearls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM summaries
      WHERE summaries.id = pearls.summary_id
        AND summaries.is_shared = true
        AND summaries.share_token IS NOT NULL
    )
  );
