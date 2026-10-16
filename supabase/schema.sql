-- Mountain Mogul database setup.
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- It is safe to run more than once.

create table if not exists public.mountains (
  id uuid primary key references auth.users (id) on delete cascade,
  public boolean not null default true,
  summary jsonb not null default '{}'::jsonb,  -- name, creator and records the leaderboards read
  save jsonb,                                  -- the full resort, for visiting and for your other devices
  updated_at timestamptz not null default now(),
  constraint save_size check (pg_column_size(save) < 2000000)
);

create index if not exists mountains_public_updated on public.mountains (public, updated_at desc);

alter table public.mountains enable row level security;

-- True when the account is a real profile (Google or email), not a guest.
-- Runs as the owner so it can look at auth.users, which players can't read.
create or replace function public.is_profile_user(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from auth.users u
                 where u.id = uid and not coalesce(u.is_anonymous, false));
$$;
revoke all on function public.is_profile_user(uuid) from public;
grant execute on function public.is_profile_user(uuid) to anon, authenticated;

-- Anyone can read public resorts saved from a real profile; you can always read your own.
drop policy if exists "read public or own" on public.mountains;
create policy "read public or own" on public.mountains
  for select using ((public and public.is_profile_user(id)) or auth.uid() = id);

-- You can only create, change or delete your own resort.
-- Guests (anonymous accounts) can save, but only signed-in players can be public.
drop policy if exists "insert own" on public.mountains;
create policy "insert own" on public.mountains
  for insert with check (auth.uid() = id and (not public or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false));

drop policy if exists "update own" on public.mountains;
create policy "update own" on public.mountains
  for update using (auth.uid() = id)
  with check (auth.uid() = id and (not public or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false));

drop policy if exists "delete own" on public.mountains;
create policy "delete own" on public.mountains
  for delete using (auth.uid() = id);

grant select on public.mountains to anon;
grant select, insert, update, delete on public.mountains to authenticated;

-- Take any guest resorts that were already public off the leaderboards.
-- Their saves are kept; they reappear if that player signs in.
update public.mountains m set public = false
from auth.users u
where u.id = m.id and u.is_anonymous and m.public;
