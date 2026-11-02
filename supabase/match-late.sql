-- King of the Mountain: joining a match that has already started. Run after supabase/multiplayer.sql and
-- supabase/match-chat.sql. Additive only; safe to run more than once.
--
-- Each lobby has three settings Phil chooses:
--   computers    true: empty slices are run by computer resorts until a player takes one over.
--                false: empty slices stay empty land, with nothing on them, until someone joins.
--   keep_profit  true: a player who takes over a computer resort keeps its season profit so far.
--                false: their profit starts at $0 on the day they join.
--   late_days    the last game day anyone can join (empty = the first quarter of the match).
-- A late joiner gets a one-off catch-up investment in cash (not profit): late_bonus for each day missed, up to
-- late_bonus_cap. The match server pays it overnight and posts it in the match chat.

alter table public.match_lobbies add column if not exists computers boolean not null default true;
alter table public.match_lobbies add column if not exists keep_profit boolean not null default true;
alter table public.match_lobbies add column if not exists late_days integer check (late_days between 0 and 400);
alter table public.match_lobbies add column if not exists late_bonus integer not null default 15000 check (late_bonus between 0 and 1000000);
alter table public.match_lobbies add column if not exists late_bonus_cap integer not null default 1000000 check (late_bonus_cap between 0 and 100000000);
alter table public.match_players add column if not exists joined_day integer not null default 0;

-- Join a running match before its cut-off: take over a computer resort if there is one, otherwise an empty
-- slice. Signed-in players only, at most three matches at once, and a friendly resort name. Returns the slot.
create or replace function public.match_join_late(lid uuid, rname text)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare lob public.match_lobbies; s integer; nm text := left(coalesce(nullif(trim(rname), ''), 'My Resort'), 40);
begin
  if auth.uid() is null or not public.is_profile_user(auth.uid()) then raise exception 'sign in to play multiplayer' using errcode = '42501'; end if;
  if not public.match_clean(nm) then raise exception 'please pick a friendlier resort name'; end if;
  select * into lob from public.match_lobbies where id = lid for update;
  if lob.id is null or lob.status <> 'running' then raise exception 'this match isn''t running'; end if;
  if lob.day > coalesce(lob.late_days, lob.days / 4) then raise exception 'it''s too late to join this match'; end if;
  if exists (select 1 from public.match_players where lobby_id = lid and user_id = auth.uid()) then raise exception 'already in this match'; end if;
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
revoke all on function public.match_join_late(uuid, text) from public, anon;
grant execute on function public.match_join_late(uuid, text) to authenticated;

-- Phil's lobby settings (owner account only). Leave an argument out to keep it as it is.
create or replace function public.admin_match_settings(lid uuid, pcomputers boolean default null, pkeep boolean default null,
  plate_days integer default null, pbonus integer default null, pcap integer default null)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.match_lobbies set computers = coalesce(pcomputers, computers), keep_profit = coalesce(pkeep, keep_profit),
    late_days = coalesce(plate_days, late_days), late_bonus = coalesce(pbonus, late_bonus), late_bonus_cap = coalesce(pcap, late_bonus_cap)
    where id = lid;
end;
$$;
revoke all on function public.admin_match_settings(uuid, boolean, boolean, integer, integer, integer) from public, anon;
grant execute on function public.admin_match_settings(uuid, boolean, boolean, integer, integer, integer) to authenticated;
