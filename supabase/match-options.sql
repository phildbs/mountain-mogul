-- King of the Mountain: switches for a match, from Phil (Nov 3). Run after match-custom.sql.
--   late       true: players can join after the start, until the cut-off (as before). false: nobody joins late.
--   computers  (already a column) whether computer resorts fill empty slices.
-- The player who made a match sets both when making it, and can change them until it starts; Phil sets them for
-- any lobby from stats.html. Additive only: one column (true for every existing lobby), match_join_late_key
-- replaced with the same arguments and results plus one check, and two new functions. Safe to run more than once.

alter table public.match_lobbies add column if not exists late boolean not null default true;

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

-- The maker's switches, before their match starts. Leave one out (null) to keep it.
create or replace function public.match_options(lid uuid, pcomputers boolean default null, plate boolean default null)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  update public.match_lobbies set computers = coalesce(pcomputers, computers), late = coalesce(plate, late)
    where id = lid and created_by = auth.uid() and kind = 'custom' and status = 'open';
  if not found then raise exception 'only the player who made a match can change it, before it starts'; end if;
end;
$$;
revoke all on function public.match_options(uuid, boolean, boolean) from public, anon;
grant execute on function public.match_options(uuid, boolean, boolean) to authenticated;

-- Phil: late joining on or off for any lobby.
create or replace function public.admin_match_late(lid uuid, plate boolean)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.match_lobbies set late = coalesce(plate, true) where id = lid;
  if not found then raise exception 'no such lobby'; end if;
end;
$$;
revoke all on function public.admin_match_late(uuid, boolean) from public, anon;
grant execute on function public.admin_match_late(uuid, boolean) to authenticated;
