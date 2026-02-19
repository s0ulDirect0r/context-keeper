-- Optimize dashboard listing: user summaries ordered by creation date
CREATE INDEX IF NOT EXISTS idx_summaries_user_created
  ON summaries (user_id, created_at DESC);
