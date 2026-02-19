-- Evolve vault_items into a notes system with tags.
-- Allow notes without excerpts (free-form notes) and add tagging.

-- Make excerpt_text nullable (notes without highlighted text)
ALTER TABLE vault_items ALTER COLUMN excerpt_text DROP NOT NULL;

-- Add tags array column
ALTER TABLE vault_items ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

-- Index for tag filtering
CREATE INDEX vault_items_tags_idx ON vault_items USING GIN (tags);
