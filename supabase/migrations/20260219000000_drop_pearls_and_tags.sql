-- Remove pearls table and selected_tags column (features disabled, dead code removed)

drop table if exists public.pearls;

alter table public.summaries drop column if exists selected_tags;
