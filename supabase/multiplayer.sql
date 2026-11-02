-- Mountain Mogul multiplayer: official lobbies, the players in them, and what the match server writes.
-- DRAFT for Phil's approval: not run on the live database yet.
-- Additive only: new match_* tables and functions; nothing that exists is changed. Safe to run more than once.
--
-- Who writes what:
--   Phil (owner account)   creates, starts and closes lobbies, through admin_* functions.
--   Signed-in players      join or leave a lobby before it starts (match_join / match_leave), and send changes
--                          for their own resort (match_orders). Guests can't join.
--   The match server       plays each day and writes resorts, days and badges. It uses the service key, which
--                          lives only on the server, never in this repo or the game.

-- A lobby: one match on one map, set up by Phil.
create table if not exists public.match_lobbies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),   -- "Winter Cup"
  map text not null default 'match',                                -- a MATCH_MAPS id in the game
  slots integer not null default 3 check (slots between 2 and 4),
  starts_at timestamptz not null,
  days integer not null default 168 check (days between 1 and 400), -- game days; one an hour is a week
  day_minutes integer not null default 60 check (day_minutes between 5 and 240),
  status text not null default 'open' check (status in ('open', 'running', 'finished', 'closed')),
  day integer not null default 0,                                   -- the last game day the server played
  prize text,                                                       -- the winner's badge, "Winter Cup champion"
  created_at timestamptz not null default now()
);

-- Who is in each slice. user_id null = a computer-run resort filling an empty slot at the start.
create table if not exists public.match_players (
  lobby_id uuid not null references public.match_lobbies (id) on delete cascade,
  slot integer not null check (slot between 0 and 3),
  user_id uuid references auth.users (id) on delete set null,
  resort_name text not null check (char_length(resort_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (lobby_id, slot),
  unique (lobby_id, user_id)
);
create index if not exists match_players_user on public.match_players (user_id);

-- Each resort as the server last left it: the full save, and a small summary for the league table.
create table if not exists public.match_resorts (
  lobby_id uuid not null,
  slot integer not null,
  day integer not null default 0,
  save jsonb,
  summary jsonb not null default '{}'::jsonb,                       -- cash, season profit, guests, rating, prices
  updated_at timestamptz not null default now(),
  primary key (lobby_id, slot),
  foreign key (lobby_id, slot) references public.match_players (lobby_id, slot) on delete cascade,
  constraint match_save_size check (pg_column_size(save) < 2000000)
);

-- One row per game day played: the weather, how the town's skiers split, and each resort's day.
create table if not exists public.match_days (
  lobby_id uuid not null references public.match_lobbies (id) on delete cascade,
  day integer not null,
  results jsonb not null,
  created_at timestamptz not null default now(),
  primary key (lobby_id, day)
);

-- Changes a player sends for their own resort (build a lift, change prices). The server applies them in order:
-- prices straight away, new lifts and trails at the next morning.
create table if not exists public.match_orders (
  id bigint generated always as identity primary key,
  lobby_id uuid not null,
  slot integer not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('build', 'remove', 'price', 'ops', 'land', 'other')),
  payload jsonb not null check (pg_column_size(payload) < 50000),
  created_at timestamptz not null default now(),
  applied_day integer,                                              -- set by the server once applied
  error text,                                                       -- why the server couldn't apply it
  foreign key (lobby_id, slot) references public.match_players (lobby_id, slot) on delete cascade
);
create index if not exists match_orders_todo on public.match_orders (lobby_id, applied_day, id);

-- Badges for the top places, shown on profiles.
create table if not exists public.match_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  lobby_id uuid not null references public.match_lobbies (id) on delete cascade,
  place integer not null check (place between 1 and 4),
  title text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, lobby_id)
);

-- Reading: lobbies, players, league tables, days and badges are open to everyone (guests see the lobby list
-- and "Sign in to play"). Full resort saves are readable so rivals can see each other's lifts and trails.
-- Orders are private to the player who sent them. Clients write nothing directly except their own orders.
alter table public.match_lobbies enable row level security;
alter table public.match_players enable row level security;
alter table public.match_resorts enable row level security;
alter table public.match_days enable row level security;
alter table public.match_orders enable row level security;
alter table public.match_badges enable row level security;

drop policy if exists "read lobbies" on public.match_lobbies;
create policy "read lobbies" on public.match_lobbies for select using (status <> 'closed');
drop policy if exists "read players" on public.match_players;
create policy "read players" on public.match_players for select using (true);
drop policy if exists "read resorts" on public.match_resorts;
create policy "read resorts" on public.match_resorts for select using (true);
drop policy if exists "read days" on public.match_days;
create policy "read days" on public.match_days for select using (true);
drop policy if exists "read badges" on public.match_badges;
create policy "read badges" on public.match_badges for select using (true);

-- Orders: only for your own slot in a running match, and only you can read them back.
drop policy if exists "send own orders" on public.match_orders;
create policy "send own orders" on public.match_orders for insert to authenticated
  with check (user_id = auth.uid() and public.is_profile_user(auth.uid())
    and exists (select 1 from public.match_players p join public.match_lobbies l on l.id = p.lobby_id
                where p.lobby_id = match_orders.lobby_id and p.slot = match_orders.slot and p.user_id = auth.uid() and l.status = 'running'));
drop policy if exists "read own orders" on public.match_orders;
create policy "read own orders" on public.match_orders for select to authenticated using (user_id = auth.uid());

grant select on public.match_lobbies, public.match_players, public.match_resorts, public.match_days, public.match_badges to anon, authenticated;
grant select, insert on public.match_orders to authenticated;

-- Join an open lobby before it starts: signed-in players only, one slice each, at most three matches at once.
-- The slice is picked at random from the free ones. Returns the slot.
create or replace function public.match_join(lid uuid, rname text)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare lob public.match_lobbies; free integer;
begin
  if auth.uid() is null or not public.is_profile_user(auth.uid()) then raise exception 'sign in to play multiplayer' using errcode = '42501'; end if;
  select * into lob from public.match_lobbies where id = lid for update;
  if lob.id is null or lob.status <> 'open' or lob.starts_at <= now() then raise exception 'this lobby is not open'; end if;
  if exists (select 1 from public.match_players where lobby_id = lid and user_id = auth.uid()) then raise exception 'already in this lobby'; end if;
  if (select count(*) from public.match_players p join public.match_lobbies l on l.id = p.lobby_id
      where p.user_id = auth.uid() and l.status in ('open', 'running')) >= 3 then raise exception 'you are already in three matches'; end if;
  select s into free from generate_series(0, lob.slots - 1) s
    where not exists (select 1 from public.match_players where lobby_id = lid and slot = s) order by random() limit 1;
  if free is null then raise exception 'this lobby is full'; end if;
  insert into public.match_players (lobby_id, slot, user_id, resort_name)
    values (lid, free, auth.uid(), left(coalesce(nullif(trim(rname), ''), 'My Resort'), 40));
  return free;
end;
$$;
revoke all on function public.match_join(uuid, text) from public, anon;
grant execute on function public.match_join(uuid, text) to authenticated;

-- Leave a lobby that hasn't started yet.
create or replace function public.match_leave(lid uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  delete from public.match_players p using public.match_lobbies l
    where p.lobby_id = lid and p.user_id = auth.uid() and l.id = p.lobby_id and l.status = 'open';
end;
$$;
revoke all on function public.match_leave(uuid) from public, anon;
grant execute on function public.match_leave(uuid) to authenticated;

-- Phil's tools (owner account only), for the Multiplayer section of stats.html.
create or replace function public.admin_match_lobby(pname text, pstarts timestamptz, pslots integer default 3,
  pdays integer default 168, pprize text default null, pmap text default 'match')
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare nid uuid;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.match_lobbies (name, map, slots, starts_at, days, prize)
    values (pname, pmap, pslots, pstarts, pdays, coalesce(pprize, pname || ' champion')) returning id into nid;
  return nid;
end;
$$;
revoke all on function public.admin_match_lobby(text, timestamptz, integer, integer, text, text) from public, anon;
grant execute on function public.admin_match_lobby(text, timestamptz, integer, integer, text, text) to authenticated;

create or replace function public.admin_match_close(lid uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.match_lobbies set status = 'closed' where id = lid;
end;
$$;
revoke all on function public.admin_match_close(uuid) from public, anon;
grant execute on function public.admin_match_close(uuid) to authenticated;
