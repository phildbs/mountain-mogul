-- Mountain Mogul database setup.
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- It is safe to run more than once, and upgrades older setups in place.

-- One row per resort. Each account can keep up to five.
create table if not exists public.mountains (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  public boolean not null default true,
  summary jsonb not null default '{}'::jsonb,  -- name, creator and records the leaderboards read
  save jsonb,                                  -- the full resort, for visiting and for your other devices
  updated_at timestamptz not null default now(),
  constraint save_size check (pg_column_size(save) < 2000000)
);

-- Upgrade from one resort per account, where a resort's id was its owner's id.
alter table public.mountains add column if not exists owner uuid references auth.users (id) on delete cascade;
update public.mountains set owner = id where owner is null;
alter table public.mountains alter column owner set default auth.uid();
alter table public.mountains alter column owner set not null;
alter table public.mountains drop constraint if exists mountains_id_fkey;
alter table public.mountains alter column id set default gen_random_uuid();

create index if not exists mountains_public_updated on public.mountains (public, updated_at desc);
create index if not exists mountains_owner on public.mountains (owner);

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

-- Anyone can read public resorts (guests' included: the leaderboards mark those "Guest"); you can always read your own.
drop policy if exists "read public or own" on public.mountains;
create policy "read public or own" on public.mountains
  for select using (public or auth.uid() = owner);

-- You can only create, change or delete your own resorts.
drop policy if exists "insert own" on public.mountains;
create policy "insert own" on public.mountains
  for insert with check (auth.uid() = owner);

drop policy if exists "update own" on public.mountains;
create policy "update own" on public.mountains
  for update using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- Every save is stamped with whether its owner is a guest, from the account itself, so the
-- leaderboards can say so and a client can't claim otherwise.
create or replace function public.mountains_guest_flag()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.summary := coalesce(new.summary, '{}'::jsonb) || jsonb_build_object('guest', not public.is_profile_user(new.owner));
  return new;
end;
$$;
drop trigger if exists mountains_guest_flag on public.mountains;
create trigger mountains_guest_flag before insert or update on public.mountains
  for each row execute function public.mountains_guest_flag();

drop policy if exists "delete own" on public.mountains;
create policy "delete own" on public.mountains
  for delete using (auth.uid() = owner);

grant select on public.mountains to anon;
grant select, insert, update, delete on public.mountains to authenticated;

-- At most five resorts per account. Saving over an existing resort is always fine
-- (an upsert runs this check before it knows the row already exists).
create or replace function public.mountains_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.mountains where id = new.id) then return new; end if;
  if (select count(*) from public.mountains where owner = new.owner) >= 5 then
    raise exception 'mountain_limit' using hint = 'Each account can keep 5 mountains.';
  end if;
  return new;
end;
$$;
drop trigger if exists mountains_limit on public.mountains;
create trigger mountains_limit before insert on public.mountains
  for each row execute function public.mountains_limit();


-- Player feedback from the in-game form: a note plus a snapshot of the game.
-- Players (guests included) can send it but never read it; read it in the dashboard.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 1 and 2000),
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) < 8000)
);
alter table public.feedback enable row level security;
drop policy if exists "send feedback" on public.feedback;
create policy "send feedback" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
grant insert on public.feedback to authenticated;

-- At most 10 notes an hour from one player, so the form can't be used to flood the table.
create or replace function public.feedback_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'feedback_limit';
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_limit on public.feedback;
create trigger feedback_limit before insert on public.feedback
  for each row execute function public.feedback_limit();
