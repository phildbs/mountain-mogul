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

-- Anyone can read public resorts; you can always read your own.
drop policy if exists "read public or own" on public.mountains;
create policy "read public or own" on public.mountains
  for select using (public or auth.uid() = id);

-- You can only create, change or delete your own resort.
drop policy if exists "insert own" on public.mountains;
create policy "insert own" on public.mountains
  for insert with check (auth.uid() = id);

drop policy if exists "update own" on public.mountains;
create policy "update own" on public.mountains
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "delete own" on public.mountains;
create policy "delete own" on public.mountains
  for delete using (auth.uid() = id);

grant select on public.mountains to anon;
grant select, insert, update, delete on public.mountains to authenticated;
