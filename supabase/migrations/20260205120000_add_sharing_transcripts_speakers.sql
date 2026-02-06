-- Transcript storage for re-generation
ALTER TABLE summaries ADD COLUMN transcripts JSONB;

-- Speaker data
ALTER TABLE summaries ADD COLUMN speakers JSONB NOT NULL DEFAULT '[]';

-- Sharing support
ALTER TABLE summaries ADD COLUMN share_token TEXT UNIQUE;
ALTER TABLE summaries ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX summaries_share_token_idx ON summaries(share_token) WHERE share_token IS NOT NULL;

-- Public read policy for shared summaries
CREATE POLICY "Anyone can view shared summaries" ON summaries FOR SELECT
  USING (is_shared = true AND share_token IS NOT NULL);
