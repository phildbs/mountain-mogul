-- King of the Mountain: a player name before playing. Run after supabase/profiles.sql, multiplayer.sql,
-- match-chat.sql and match-late.sql. It replaces three functions with the same arguments and results, adding one
-- check to each: the account must have a player name (a profile) to join a match, join one late, or chat.
-- The game already asks for the name first; this stops anyone getting round the game. Safe to run more than once.

create or replace function public.match_join(lid uuid, rname text)
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

create or replace function public.match_join_late(lid uuid, rname text)
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

create or replace function public.match_say(lid uuid, msg text)
returns bigint language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid := auth.uid(); lob public.match_lobbies; me public.match_players; who text; b text; nid bigint;
begin
  if uid is null or not public.is_profile_user(uid) then raise exception 'sign in to chat' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = uid and btrim(p.name) <> '') then raise exception 'pick your player name first' using errcode = '42501'; end if;
  if exists (select 1 from public.match_chat_bans where user_id = uid and until > now()) then raise exception 'you can''t chat right now' using errcode = '42501'; end if;
  select * into lob from public.match_lobbies where id = lid;
  if lob.id is null or lob.status not in ('open', 'running') then raise exception 'this chat is closed'; end if;
  b := left(btrim(regexp_replace(coalesce(msg, ''), '\s+', ' ', 'g')), 200);
  if b = '' then raise exception 'write something first'; end if;
  if exists (select 1 from public.match_messages where user_id = uid and created_at > now() - interval '10 seconds') then raise exception 'slow down a little'; end if;
  if not public.match_clean(b) then raise exception 'please keep it friendly'; end if;
  select * into me from public.match_players where lobby_id = lid and user_id = uid;
  who := coalesce(me.resort_name, (select p.name from public.profiles p where p.id = uid and p.public), 'Spectator');
  insert into public.match_messages (lobby_id, user_id, slot, name, body, kind, day)
    values (lid, uid, me.slot, who, b, 'chat', lob.day) returning id into nid;
  return nid;
end;
$$;
