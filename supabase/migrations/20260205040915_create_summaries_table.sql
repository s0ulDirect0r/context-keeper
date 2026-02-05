-- Create summaries table for storing user summaries
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summaries JSONB NOT NULL,
  themes JSONB NOT NULL DEFAULT '[]',
  context JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX summaries_user_id_idx ON summaries(user_id);
CREATE INDEX summaries_created_at_idx ON summaries(created_at DESC);

-- Enable Row Level Security
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own summaries
CREATE POLICY "Users can view own summaries" ON summaries FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own summaries" ON summaries FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own summaries" ON summaries FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own summaries" ON summaries FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
