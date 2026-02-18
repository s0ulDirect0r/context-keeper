-- Vault items: user-curated highlights saved from meeting summaries
CREATE TABLE vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  excerpt_text TEXT NOT NULL,
  note TEXT,
  chunk_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vault_items_user_id_idx ON vault_items(user_id);
CREATE INDEX vault_items_summary_id_idx ON vault_items(summary_id);
CREATE INDEX vault_items_created_at_idx ON vault_items(created_at DESC);

-- Enable Row Level Security
ALTER TABLE vault_items ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage their own vault items
CREATE POLICY "Users can view own vault items" ON vault_items FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own vault items" ON vault_items FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own vault items" ON vault_items FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own vault items" ON vault_items FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
