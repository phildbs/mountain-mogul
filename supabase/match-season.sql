-- King of the Mountain: every match a player makes lasts one whole season, 168 game days (Phil, Nov 4).
-- Run after match-custom.sql and match-options.sql. Replaces match_create with the same arguments and results;
-- only its length check changes (it allowed 7 to 168 days). Two seasons waits for a server test of the summer.
-- Safe to run more than once.

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
  if pdays is null or pdays <> 168 then raise exception 'a match lasts one whole season (168 days)'; end if;
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

