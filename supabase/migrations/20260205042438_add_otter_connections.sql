-- Store Otter.ai connections per user
CREATE TABLE otter_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  otter_email TEXT NOT NULL,
  otter_user_id TEXT NOT NULL,
  cookies TEXT NOT NULL,
  csrf_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user can only have one Otter connection
CREATE INDEX otter_connections_user_id_idx ON otter_connections(user_id);

-- Enable Row Level Security
ALTER TABLE otter_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own Otter connection
CREATE POLICY "Users can view own otter connection" ON otter_connections FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own otter connection" ON otter_connections FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own otter connection" ON otter_connections FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own otter connection" ON otter_connections FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
