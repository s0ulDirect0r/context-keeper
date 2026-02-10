-- Store user-selected concept tags per summary for tag-first pearl workflow
ALTER TABLE summaries ADD COLUMN selected_tags TEXT[] DEFAULT NULL;
