-- Create a garden and add the caller as owner in one atomic operation.
-- SECURITY DEFINER bypasses RLS so the INSERT...RETURNING works without
-- needing a garden_members row to exist first (chicken-and-egg problem).
create or replace function public.create_garden(garden_name text, folder_id text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_id uuid;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.gardens (name, owner_id, drive_folder_id)
  values (garden_name, caller, folder_id)
  returning id into new_id;

  insert into public.garden_members (garden_id, user_id, role)
  values (new_id, caller, 'owner');

  return new_id;
end;
$$;
