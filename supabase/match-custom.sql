-- King of the Mountain: matches any signed-in player can make, public or locked with a password, with turns of
-- 10, 15 or 30 minutes. Phil's lobbies from stats.html stay the official tournaments, the only ones with badges.
-- Run after multiplayer.sql, match-chat.sql, match-late.sql, match-names.sql and match-flag.sql.
-- Additive only: new columns (old lobbies read as official), one private table, new functions, and match_join /
-- match_join_late replaced with the same arguments and results plus one password check. Safe to run more than once.

alter table public.match_lobbies add column if not exists kind text not null default 'official';
alter table public.match_lobbies drop constraint if exists match_lobby_kind;
alter table public.match_lobbies add constraint match_lobby_kind check (kind in ('official', 'custom'));
alter table public.match_lobbies add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.match_lobbies add column if not exists locked boolean not null default false;  -- has a password
-- Where each player finished, set by the match server at the end (1 = won). Empty for matches finished before.
alter table public.match_players add column if not exists place integer check (place between 1 and 4);
create index if not exists match_lobbies_maker on public.match_lobbies (created_by) where created_by is not null;

-- Passwords: salted hashes, never readable by players (row level security on, no policies, no grants).
create table if not exists public.match_lobby_keys (
  lobby_id uuid primary key references public.match_lobbies (id) on delete cascade,
  salt text not null,
  hash text not null
);
alter table public.match_lobby_keys enable row level security;
revoke all on public.match_lobby_keys from public, anon, authenticated;

create or replace function public.match_key_hash(salt text, pw text)
returns text language sql immutable set search_path = public
as $$ select encode(sha256(convert_to(salt || ':' || btrim(coalesce(pw, '')), 'UTF8')), 'hex') $$;
revoke all on function public.match_key_hash(text, text) from public, anon, authenticated;

-- True when the lobby has no password, or pw is it (capital letters count; spaces round it don't).
create or replace function public.match_key_ok(lid uuid, pw text)
returns boolean language sql stable security definer set search_path = public
as $$ select not exists (select 1 from public.match_lobby_keys k where k.lobby_id = lid and k.hash <> public.match_key_hash(k.salt, pw)) $$;
revoke all on function public.match_key_ok(uuid, text) from public, anon, authenticated;

-- Joining, with the password for a locked lobby. match_join (no password) keeps working for every other lobby.
create or replace function public.match_join_key(lid uuid, rname text, pkey text)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare lob public.match_lobbies; free integer;
begin
  if auth.uid() is null or not public.is_profile_user(auth.uid()) then raise exception 'sign in to play multiplayer' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and btrim(p.name) <> '') then raise exception 'pick your player name first' using errcode = '42501'; end if;
  if not public.match_clean(rname) then raise exception 'please pick a friendlier resort name'; end if;
  select * into lob from public.match_lobbies where id = lid for update;
  if lob.id is null or lob.status <> 'open' or lob.starts_at <= now() then raise exception 'this lobby is not open'; end if;
  if exists (select 1 from public.match_players where lobby_id = lid and user_id = auth.uid()) then raise exception 'already in this lobby'; end if;
  if not public.match_key_ok(lid, pkey) then raise exception 'that password isn''t right'; end if;
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
revoke all on function public.match_join_key(uuid, text, text) from public, anon;
grant execute on function public.match_join_key(uuid, text, text) to authenticated;

create or replace function public.match_join(lid uuid, rname text)
returns integer language sql security definer set search_path = public, auth
as $$ select public.match_join_key(lid, rname, null) $$;
revoke all on function public.match_join(uuid, text) from public, anon;
grant execute on function public.match_join(uuid, text) to authenticated;

create or replace function public.match_join_late_key(lid uuid, rname text, pkey text)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare lob public.match_lobbies; s integer; nm text := left(coalesce(nullif(trim(rname), ''), 'My Resort'), 40);
begin
  if auth.uid() is null or not public.is_profile_user(auth.uid()) then raise exception 'sign in to play multiplayer' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and btrim(p.name) <> '') then raise exception 'pick your player name first' using errcode = '42501'; end if;
  if not public.match_clean(nm) then raise exception 'please pick a friendlier resort name'; end if;
  select * into lob from public.match_lobbies where id = lid for update;
  if lob.id is null or lob.status <> 'running' then raise exception 'this match isn''t running'; end if;
  if lob.day > coalesce(lob.late_days, lob.days / 4) then raise exception 'it''s too late to join this match'; end if;
  if exists (select 1 from public.match_players where lobby_id = lid and user_id = auth.uid()) then raise exception 'already in this match'; end if;
  if not public.match_key_ok(lid, pkey) then raise exception 'that password isn''t right'; end if;
  if (select count(*) from public.match_players p join public.match_lobbies l on l.id = p.lobby_id
      where p.user_id = auth.uid() and l.status in ('open', 'running')) >= 3 then raise exception 'you are already in three matches'; end if;
  -- A computer resort first (it's already built), then an empty slice.
  select slot into s from public.match_players where lobby_id = lid and user_id is null order by random() limit 1;
  if s is not null then
    update public.match_players set user_id = auth.uid(), resort_name = nm, joined_day = lob.day where lobby_id = lid and slot = s and user_id is null;
    return s;
  end if;
  select g into s from generate_series(0, lob.slots - 1) g
    where not exists (select 1 from public.match_players where lobby_id = lid and slot = g) order by random() limit 1;
  if s is null then raise exception 'this match is full'; end if;
  insert into public.match_players (lobby_id, slot, user_id, resort_name, joined_day) values (lid, s, auth.uid(), nm, lob.day);
  return s;
end;
$$;
revoke all on function public.match_join_late_key(uuid, text, text) from public, anon;
grant execute on function public.match_join_late_key(uuid, text, text) to authenticated;

create or replace function public.match_join_late(lid uuid, rname text)
returns integer language sql security definer set search_path = public, auth
as $$ select public.match_join_late_key(lid, rname, null) $$;
revoke all on function public.match_join_late(uuid, text) from public, anon;
grant execute on function public.match_join_late(uuid, text) to authenticated;

-- A player makes a match and joins it. One of their own at a time (until it finishes or is cancelled), and at
-- most 20 player matches waiting or running at once, so the match server keeps up. It starts on a whole minute,
-- between 5 minutes and 3 days from now. Returns the new lobby's id.
create or replace function public.match_create(pname text, pstarts timestamptz, pminutes integer, pdays integer,
  pslots integer default 3, pcomputers boolean default true, ppassword text default null, rname text default null)
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid := auth.uid(); nm text := btrim(regexp_replace(coalesce(pname, ''), '\s+', ' ', 'g')); pw text := btrim(coalesce(ppassword, ''));
  st timestamptz := date_trunc('minute', pstarts) + case when pstarts > date_trunc('minute', pstarts) then interval '1 minute' else interval '0' end;
  nid uuid; salt text;
begin
  if uid is null or not public.is_profile_user(uid) then raise exception 'sign in to play multiplayer' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = uid and btrim(p.name) <> '') then raise exception 'pick your player name first' using errcode = '42501'; end if;
  if char_length(nm) not between 3 and 40 then raise exception 'give your match a name of 3 to 40 letters'; end if;
  if not public.match_clean(nm) then raise exception 'please pick a friendlier match name'; end if;
  if pminutes is null or pminutes not in (10, 15, 30) then raise exception 'a turn is 10, 15 or 30 minutes'; end if;
  if pdays is null or pdays not in (7, 14, 28, 56, 84, 168) then raise exception 'pick one of the match lengths'; end if;
  if pslots is null or pslots not in (2, 3) then raise exception 'a match has 2 or 3 resorts'; end if;
  if st is null or st < now() + interval '4 minutes' or st > now() + interval '3 days' then raise exception 'pick a start between 5 minutes and 3 days from now'; end if;
  if pw <> '' and char_length(pw) not between 4 and 30 then raise exception 'a password is 4 to 30 characters'; end if;
  perform pg_advisory_xact_lock(hashtext('match_create'));
  if exists (select 1 from public.match_lobbies where created_by = uid and kind = 'custom' and status in ('open', 'running')) then
    raise exception 'you already have a match of your own on: wait for it to finish, or cancel it before it starts'; end if;
  if (select count(*) from public.match_lobbies where kind = 'custom' and status in ('open', 'running')) >= 20 then
    raise exception 'lots of matches are being played right now: try again a bit later'; end if;
  if (select count(*) from public.match_players p join public.match_lobbies l on l.id = p.lobby_id
      where p.user_id = uid and l.status in ('open', 'running')) >= 3 then raise exception 'you are already in three matches'; end if;
  insert into public.match_lobbies (name, map, slots, starts_at, days, day_minutes, prize, kind, created_by, locked, computers)
    values (nm, 'match', pslots, st, pdays, pminutes, null, 'custom', uid, pw <> '', coalesce(pcomputers, true)) returning id into nid;
  if pw <> '' then
    salt := replace(gen_random_uuid()::text, '-', '');
    insert into public.match_lobby_keys (lobby_id, salt, hash) values (nid, salt, public.match_key_hash(salt, pw));
  end if;
  perform public.match_join_key(nid, coalesce(nullif(btrim(rname), ''), 'My Resort'), pw);
  return nid;
end;
$$;
revoke all on function public.match_create(text, timestamptz, integer, integer, integer, boolean, text, text) from public, anon;
grant execute on function public.match_create(text, timestamptz, integer, integer, integer, boolean, text, text) to authenticated;

-- The maker cancels their match before it starts. It leaves the game for everyone.
create or replace function public.match_cancel(lid uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  update public.match_lobbies set status = 'closed' where id = lid and created_by = auth.uid() and kind = 'custom' and status = 'open';
  if not found then raise exception 'only the player who made a match can cancel it, before it starts'; end if;
end;
$$;
revoke all on function public.match_cancel(uuid) from public, anon;
grant execute on function public.match_cancel(uuid) to authenticated;

-- A player's record for their profile: finished matches played, and won. A win only counts when at least two
-- real players took part, so beating computer resorts alone doesn't add up. Matches finished before places were
-- kept count a win from the winner's badge.
create or replace function public.match_record(uid uuid)
returns table (played integer, won integer) language sql stable security definer set search_path = public
as $$
  select count(*)::integer,
    count(*) filter (where (p.place = 1 or exists (select 1 from public.match_badges b where b.user_id = uid and b.lobby_id = l.id and b.place = 1))
      and (select count(*) from public.match_players q where q.lobby_id = l.id and q.user_id is not null) >= 2)::integer
  from public.match_players p join public.match_lobbies l on l.id = p.lobby_id
  where p.user_id = uid and l.status = 'finished'
$$;
revoke all on function public.match_record(uuid) from public;
grant execute on function public.match_record(uuid) to anon, authenticated;

-- Phil: the turn length of an official lobby, before it starts (10, 15 or 30 minutes).
create or replace function public.admin_match_turn(lid uuid, pminutes integer)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if pminutes is null or pminutes not in (10, 15, 30) then raise exception 'a turn is 10, 15 or 30 minutes'; end if;
  update public.match_lobbies set day_minutes = pminutes where id = lid and status = 'open';
  if not found then raise exception 'only a lobby that hasn''t started'; end if;
end;
$$;
revoke all on function public.admin_match_turn(uuid, integer) from public, anon;
grant execute on function public.admin_match_turn(uuid, integer) to authenticated;
