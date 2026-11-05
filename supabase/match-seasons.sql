-- King of the Mountain: matches of 1, 2 or 3 seasons (Phil, Nov 5). Run after match-season.sql and match-maps.sql.
-- Additive: a new column (every match so far is 1 season) and both ways of making a match, with the same arguments
-- and results; only their length check changes, and they note the seasons. Safe to run more than once.
-- A season is 168 game days; each later one adds a summer turn, a summer night and Nov 15 to May 26: 195 more
-- (match/market.mjs).

alter table public.match_lobbies add column if not exists seasons integer not null default 1;
-- Three seasons is 558 days; the table allowed up to 400. Only loosened, so every match already made still fits.
alter table public.match_lobbies drop constraint if exists match_lobbies_days_check;
alter table public.match_lobbies add constraint match_lobbies_days_check check (days between 1 and 600);
do $$ begin
  alter table public.match_lobbies add constraint match_lobbies_seasons_check check (seasons between 1 and 3);
exception when duplicate_object then null; end $$;

-- How many seasons a match of this many days is (1 for anything that isn't 363 or 558, as every match so far).
create or replace function public.match_seasons_in(pdays integer) returns integer language sql immutable
as $$ select case pdays when 363 then 2 when 558 then 3 else 1 end $$;

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
  if pdays is null or pdays not in (168, 363, 558) then raise exception 'a match lasts 1, 2 or 3 whole seasons (168, 363 or 558 days)'; end if;
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
  insert into public.match_lobbies (name, map, slots, starts_at, days, day_minutes, prize, kind, created_by, locked, computers, seasons)
    values (nm, 'match', pslots, st, pdays, pminutes, null, 'custom', uid, pw <> '', coalesce(pcomputers, true), public.match_seasons_in(pdays)) returning id into nid;
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

create or replace function public.match_create_on(pmap text, pname text, pstarts timestamptz, pminutes integer, pdays integer,
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
  if pdays is null or pdays not in (168, 363, 558) then raise exception 'a match lasts 1, 2 or 3 whole seasons (168, 363 or 558 days)'; end if;
  -- the map, and how many resorts it takes: Crown Peak 2 or 3, Ridgeline 2 to 4
  if pmap is null or pmap not in ('match', 'ridge') then raise exception 'pick one of the mountains'; end if;
  if pmap = 'match' and (pslots is null or pslots not in (2, 3)) then raise exception 'a match on Crown Peak has 2 or 3 resorts'; end if;
  if pmap = 'ridge' and (pslots is null or pslots not in (2, 3, 4)) then raise exception 'a match on Ridgeline has 2 to 4 resorts'; end if;
  if st is null or st < now() + interval '4 minutes' or st > now() + interval '3 days' then raise exception 'pick a start between 5 minutes and 3 days from now'; end if;
  if pw <> '' and char_length(pw) not between 4 and 30 then raise exception 'a password is 4 to 30 characters'; end if;
  perform pg_advisory_xact_lock(hashtext('match_create'));
  if exists (select 1 from public.match_lobbies where created_by = uid and kind = 'custom' and status in ('open', 'running')) then
    raise exception 'you already have a match of your own on: wait for it to finish, or cancel it before it starts'; end if;
  if (select count(*) from public.match_lobbies where kind = 'custom' and status in ('open', 'running')) >= 20 then
    raise exception 'lots of matches are being played right now: try again a bit later'; end if;
  if (select count(*) from public.match_players p join public.match_lobbies l on l.id = p.lobby_id
      where p.user_id = uid and l.status in ('open', 'running')) >= 3 then raise exception 'you are already in three matches'; end if;
  insert into public.match_lobbies (name, map, slots, starts_at, days, day_minutes, prize, kind, created_by, locked, computers, seasons)
    values (nm, pmap, pslots, st, pdays, pminutes, null, 'custom', uid, pw <> '', coalesce(pcomputers, true), public.match_seasons_in(pdays)) returning id into nid;
  if pw <> '' then
    salt := replace(gen_random_uuid()::text, '-', '');
    insert into public.match_lobby_keys (lobby_id, salt, hash) values (nid, salt, public.match_key_hash(salt, pw));
  end if;
  perform public.match_join_key(nid, coalesce(nullif(btrim(rname), ''), 'My Resort'), pw);
  return nid;
end;
$$;
revoke all on function public.match_create_on(text, text, timestamptz, integer, integer, integer, boolean, text, text) from public, anon;
grant execute on function public.match_create_on(text, text, timestamptz, integer, integer, integer, boolean, text, text) to authenticated;
