-- Gardens and garden membership for GardenFS

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  drive_folder_id text not null,
  created_at timestamptz not null default now()
);

create table public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

create index idx_garden_members_user_id on public.garden_members(user_id);
create index idx_gardens_owner_id on public.gardens(owner_id);

-- Helper function to check garden membership without triggering RLS recursion.
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS on the
-- garden_members table when called from other RLS policies.
create or replace function public.user_garden_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select garden_id from public.garden_members where user_id = uid;
$$;

-- RLS
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;

-- Gardens: users can see gardens they are a member of
create policy "Users can view their gardens"
  on public.gardens for select
  using (id in (select public.user_garden_ids(auth.uid())));

create policy "Users can create gardens"
  on public.gardens for insert
  with check (owner_id = auth.uid());

create policy "Owners can update their gardens"
  on public.gardens for update
  using (owner_id = auth.uid());

create policy "Owners can delete their gardens"
  on public.gardens for delete
  using (owner_id = auth.uid());

-- Garden members: users can see members of gardens they belong to
create policy "Members can view garden memberships"
  on public.garden_members for select
  using (garden_id in (select public.user_garden_ids(auth.uid())));

-- Garden members: only garden owner can add members
create policy "Owners can add members"
  on public.garden_members for insert
  with check (
    garden_id in (select id from public.gardens where owner_id = auth.uid())
  );

-- Garden members: owners can remove members, members can remove themselves
create policy "Owners can remove members or self-remove"
  on public.garden_members for delete
  using (
    user_id = auth.uid()
    or garden_id in (select id from public.gardens where owner_id = auth.uid())
  );

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

-- Enable Realtime on garden_members for sharing notifications
alter publication supabase_realtime add table public.garden_members;
