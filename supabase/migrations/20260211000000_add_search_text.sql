-- Add search_text column for full-text search
ALTER TABLE summaries ADD COLUMN search_text TEXT;

-- Create GIN index for fast text search
CREATE INDEX idx_summaries_search_text_gin
ON summaries USING GIN (to_tsvector('english', COALESCE(search_text, '')));

-- Backfill existing rows with title
UPDATE summaries SET search_text = COALESCE(title, '');
