-- King of the Mountain: leaving a running match, and claiming a resort someone left (Phil, Nov 4).
-- Run after match-custom.sql and match-options.sql (it replaces match_join_late_key from match-options.sql).
-- Additive only: five columns (false or empty for every existing player), three new functions and two password
-- versions, and match_join_late_key with the same arguments and results plus one check (it no longer hands out a
-- left resort as if it were a computer one). Safe to run more than once.
--
--   match_abandon(lid)            a player leaves a running match. Their resort stays on the mountain, shut, marked
--                                 abandoned, until someone claims it. It no longer counts as one of their matches.
--   match_claim(lid, slot, name)  a signed-in player takes over an abandoned resort, until three-quarters of the way
--                                 through the season. Not in a match they left themselves.
--   match_record_more(uid)        for profiles: how many resorts a player has rescued (claimed) and matches they left.
-- The match server shuts an abandoned resort (no skiers, no costs), and the night after a claim gives it a fresh
-- start, once per resort per match: its debt written off, cash topped up to at least $500,000, season losses back
-- to $0 (gains kept), reputation back to at least a new resort's. A badge or a win only counts for a player who ran
-- the resort for at least half the season.

alter table public.match_players add column if not exists abandoned boolean not null default false;  -- left, free to claim
alter table public.match_players add column if not exists left_by uuid[] not null default '{}';     -- who left it: they can't claim it back
alter table public.match_players add column if not exists rescue_due boolean not null default false; -- claimed: fresh start tonight
alter table public.match_players add column if not exists rescued boolean not null default false;    -- had its fresh start this match
alter table public.match_players add column if not exists claimed_by uuid[] not null default '{}';  -- who claimed it, for their profiles

-- Leave a running match. (Before it starts, match_leave still takes you out of the lobby.)
create or replace function public.match_abandon(lid uuid)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare s integer;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.match_lobbies where id = lid and status = 'running') then raise exception 'this match isn''t running'; end if;
  update public.match_players set user_id = null, abandoned = true, rescue_due = false, left_by = array_append(left_by, auth.uid())
    where lobby_id = lid and user_id = auth.uid() returning slot into s;
  if s is null then raise exception 'you''re not in this match'; end if;
  return s;
end;
$$;
revoke all on function public.match_abandon(uuid) from public, anon;
grant execute on function public.match_abandon(uuid) to authenticated;

-- Claim an abandoned resort. Returns its slot.
create or replace function public.match_claim_key(lid uuid, pslot integer, rname text, pkey text)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare lob public.match_lobbies; p public.match_players; nm text := left(coalesce(nullif(trim(rname), ''), 'My Resort'), 40);
begin
  if auth.uid() is null or not public.is_profile_user(auth.uid()) then raise exception 'sign in to play multiplayer' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and btrim(pr.name) <> '') then raise exception 'pick your player name first' using errcode = '42501'; end if;
  if not public.match_clean(nm) then raise exception 'please pick a friendlier resort name'; end if;
  select * into lob from public.match_lobbies where id = lid for update;
  if lob.id is null or lob.status <> 'running' then raise exception 'this match isn''t running'; end if;
  if lob.day > lob.days * 3 / 4 then raise exception 'it''s too late to claim a resort in this match'; end if;
  if exists (select 1 from public.match_players where lobby_id = lid and user_id = auth.uid()) then raise exception 'already in this match'; end if;
  if not public.match_key_ok(lid, pkey) then raise exception 'that password isn''t right'; end if;
  if (select count(*) from public.match_players q join public.match_lobbies l on l.id = q.lobby_id
      where q.user_id = auth.uid() and l.status in ('open', 'running')) >= 3 then raise exception 'you are already in three matches'; end if;
  -- Not after leaving this match: you could sink your own resort, leave, and take a neighbour's fresh start.
  if exists (select 1 from public.match_players where lobby_id = lid and auth.uid() = any(left_by)) then raise exception 'you left this match, so you can''t claim a resort in it'; end if;
  select * into p from public.match_players where lobby_id = lid and slot = pslot for update;
  if p.lobby_id is null or p.user_id is not null or not p.abandoned then raise exception 'that resort isn''t free to claim any more'; end if;
  update public.match_players set user_id = auth.uid(), resort_name = nm, joined_day = lob.day, abandoned = false,
    rescue_due = not p.rescued, rescued = true, claimed_by = array_append(claimed_by, auth.uid())
    where lobby_id = lid and slot = pslot;
  return pslot;
end;
$$;
revoke all on function public.match_claim_key(uuid, integer, text, text) from public, anon;
grant execute on function public.match_claim_key(uuid, integer, text, text) to authenticated;

create or replace function public.match_claim(lid uuid, pslot integer, rname text)
returns integer language sql security definer set search_path = public, auth
as $$ select public.match_claim_key(lid, pslot, rname, null) $$;
revoke all on function public.match_claim(uuid, integer, text) from public, anon;
grant execute on function public.match_claim(uuid, integer, text) to authenticated;

-- A player's profile: resorts they rescued (claimed after someone left) and matches they left. match_record stays as it is.
create or replace function public.match_record_more(uid uuid)
returns table (rescued integer, abandoned integer) language sql stable security definer set search_path = public
as $$
  select (select count(*) from public.match_players p join public.match_lobbies l on l.id = p.lobby_id where uid = any(p.claimed_by) and l.status <> 'closed')::integer,
    (select count(distinct p.lobby_id) from public.match_players p join public.match_lobbies l on l.id = p.lobby_id where uid = any(p.left_by) and l.status <> 'closed')::integer
$$;
revoke all on function public.match_record_more(uuid) from public;
grant execute on function public.match_record_more(uuid) to anon, authenticated;

-- Joining late, as in match-options.sql, except a resort someone left isn't taken as a computer one: that's
-- match_claim's job, with its own cut-off and fresh start.
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
  if not lob.late then raise exception 'this match doesn''t take late joiners'; end if;
  if lob.day > coalesce(lob.late_days, lob.days / 4) then raise exception 'it''s too late to join this match'; end if;
  if exists (select 1 from public.match_players where lobby_id = lid and user_id = auth.uid()) then raise exception 'already in this match'; end if;
  if not public.match_key_ok(lid, pkey) then raise exception 'that password isn''t right'; end if;
  if (select count(*) from public.match_players p join public.match_lobbies l on l.id = p.lobby_id
      where p.user_id = auth.uid() and l.status in ('open', 'running')) >= 3 then raise exception 'you are already in three matches'; end if;
  -- A computer resort first (it's already built), then an empty slice.
  select slot into s from public.match_players where lobby_id = lid and user_id is null and not abandoned order by random() limit 1;
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
