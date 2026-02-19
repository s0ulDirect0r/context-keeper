-- Rename vault_items table to notes

ALTER TABLE vault_items RENAME TO notes;

-- Rename indexes
ALTER INDEX vault_items_user_id_idx RENAME TO notes_user_id_idx;
ALTER INDEX vault_items_summary_id_idx RENAME TO notes_summary_id_idx;
ALTER INDEX vault_items_created_at_idx RENAME TO notes_created_at_idx;
ALTER INDEX vault_items_tags_idx RENAME TO notes_tags_idx;

-- Rename RLS policies
ALTER POLICY "Users can view own vault items" ON notes RENAME TO "Users can view own notes";
ALTER POLICY "Users can insert own vault items" ON notes RENAME TO "Users can insert own notes";
ALTER POLICY "Users can update own vault items" ON notes RENAME TO "Users can update own notes";
ALTER POLICY "Users can delete own vault items" ON notes RENAME TO "Users can delete own notes";
