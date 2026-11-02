-- Mountain Mogul multiplayer chat: one message board per match, for the players in it and signed-in spectators,
-- with the server's match news in the same feed, emoji reactions, reports, mutes and Phil's moderation tools.
-- Run after supabase/multiplayer.sql. Additive only; safe to run more than once.
--
-- Rules: signed-in accounts only (no guests); up to 200 characters; one message every 10 seconds; a word filter on
-- messages and on resort names; no private messages. Finished matches keep their chat as a record (readable, closed
-- to new messages). Phil can hide a message, ban an account from chat and read reports.

-- Words that aren't allowed, matched as whole words after undoing common tricks (sh1t, a$$, f.u.c.k).
-- The list lives only in the database, so Phil can add to it in the SQL editor without changing the repo:
--   insert into public.match_blocked_words (word) values ('newword') on conflict do nothing;
create table if not exists public.match_blocked_words (word text primary key check (word = lower(word)));
alter table public.match_blocked_words enable row level security; -- no policies: players can't read or change it
insert into public.match_blocked_words (word) values ('fuck'), ('fucking'), ('fucker'), ('shit'), ('cunt'), ('bitch'), ('asshole'),
  ('dick'), ('pussy'), ('bastard'), ('whore'), ('slut'), ('wank'), ('wanker'), ('twat'), ('cock'), ('motherfucker'), ('retard'), ('nazi')
  on conflict do nothing;

-- True when the text is friendly enough to show.
create or replace function public.match_clean(t text)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare n text; squashed text; words text[]; joined text := ' '; run text := ''; w text;
begin
  n := translate(lower(coalesce(t, '')), '013457@$!|', 'oieastasii');
  squashed := regexp_replace(n, '[^a-z]', '', 'g');
  -- Whole words only (so "class" and "Scunthorpe" are fine), with runs of single letters joined up: f.u.c.k -> fuck.
  words := regexp_split_to_array(btrim(regexp_replace(n, '[^a-z]+', ' ', 'g')), ' ');
  foreach w in array words loop
    if char_length(w) = 1 then run := run || w;
    else if run <> '' then joined := joined || run || ' '; run := ''; end if; joined := joined || w || ' '; end if;
  end loop;
  if run <> '' then joined := joined || run || ' '; end if;
  return not exists (select 1 from public.match_blocked_words b
    where position(' ' || b.word || ' ' in joined) > 0
       or (char_length(b.word) >= 5 and position(b.word in squashed) > 0)); -- longer words also when run into others
end;
$$;
revoke all on function public.match_clean(text) from public, anon;
grant execute on function public.match_clean(text) to authenticated;

create table if not exists public.match_messages (
  id bigint generated always as identity primary key,
  lobby_id uuid not null references public.match_lobbies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,  -- null for the server's news
  slot integer,                                                  -- the writer's slice; null for spectators and news
  name text not null check (char_length(name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 200),
  kind text not null default 'chat' check (kind in ('chat', 'news')),
  day integer,                                                   -- the game day it was written on
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists match_messages_lobby on public.match_messages (lobby_id, id);
create index if not exists match_messages_user on public.match_messages (user_id, created_at desc);

create table if not exists public.match_reactions (
  message_id bigint not null references public.match_messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '😂', '🔥', '😮', '❄️', '🏆')),
  primary key (message_id, user_id, emoji)
);
create table if not exists public.match_reports (
  message_id bigint not null references public.match_messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create table if not exists public.match_mutes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  muted uuid not null references auth.users (id) on delete cascade,
  primary key (user_id, muted)
);
create table if not exists public.match_chat_bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,
  reason text
);

alter table public.match_messages enable row level security;
alter table public.match_reactions enable row level security;
alter table public.match_reports enable row level security;
alter table public.match_mutes enable row level security;
alter table public.match_chat_bans enable row level security; -- no policies: only Phil's tools touch it

-- Anyone can read a match's chat and reactions (guests too, so the match screen can show it); hidden messages and
-- closed lobbies drop out. New messages only through match_say, which checks everything.
drop policy if exists "read chat" on public.match_messages;
create policy "read chat" on public.match_messages for select
  using (not hidden and exists (select 1 from public.match_lobbies l where l.id = lobby_id and l.status <> 'closed'));
drop policy if exists "read reactions" on public.match_reactions;
create policy "read reactions" on public.match_reactions for select using (true);
drop policy if exists "react" on public.match_reactions;
create policy "react" on public.match_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_profile_user(auth.uid())
    and exists (select 1 from public.match_messages m join public.match_lobbies l on l.id = m.lobby_id where m.id = message_id and l.status in ('open', 'running')));
drop policy if exists "take back a reaction" on public.match_reactions;
create policy "take back a reaction" on public.match_reactions for delete to authenticated using (user_id = auth.uid());
drop policy if exists "report" on public.match_reports;
create policy "report" on public.match_reports for insert to authenticated with check (user_id = auth.uid() and public.is_profile_user(auth.uid()));
drop policy if exists "own mutes" on public.match_mutes;
create policy "own mutes" on public.match_mutes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.match_messages, public.match_reactions to anon, authenticated;
grant insert, delete on public.match_reactions to authenticated;
grant insert on public.match_reports to authenticated;
grant select, insert, delete on public.match_mutes to authenticated;

-- Post a message. Players write under their resort's name; spectators under their public profile name (or
-- "Spectator"). Returns the new message's id.
create or replace function public.match_say(lid uuid, msg text)
returns bigint language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid := auth.uid(); lob public.match_lobbies; me public.match_players; who text; b text; nid bigint;
begin
  if uid is null or not public.is_profile_user(uid) then raise exception 'sign in to chat' using errcode = '42501'; end if;
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
revoke all on function public.match_say(uuid, text) from public, anon;
grant execute on function public.match_say(uuid, text) to authenticated;

-- Resort names go through the same filter when you join.
create or replace function public.match_join(lid uuid, rname text)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare lob public.match_lobbies; free integer;
begin
  if auth.uid() is null or not public.is_profile_user(auth.uid()) then raise exception 'sign in to play multiplayer' using errcode = '42501'; end if;
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

-- Phil's moderation tools (owner account only).
create or replace function public.admin_chat_reports()
returns jsonb language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('message', m.id, 'lobby', l.name, 'name', m.name, 'author', m.user_id, 'body', m.body, 'hidden', m.hidden,
      'reports', (select count(*) from public.match_reports r where r.message_id = m.id),
      'reasons', (select jsonb_agg(r.reason) from public.match_reports r where r.message_id = m.id and r.reason is not null)) order by m.id desc)
    from public.match_messages m join public.match_lobbies l on l.id = m.lobby_id
    where exists (select 1 from public.match_reports r where r.message_id = m.id)), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_chat_reports() from public, anon;
grant execute on function public.admin_chat_reports() to authenticated;

create or replace function public.admin_chat_hide(mid bigint, hide boolean default true)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.match_messages set hidden = hide where id = mid;
end;
$$;
revoke all on function public.admin_chat_hide(bigint, boolean) from public, anon;
grant execute on function public.admin_chat_hide(bigint, boolean) to authenticated;

-- Ban an account from chat for some days (0 lifts it). They can still play.
create or replace function public.admin_chat_ban(uid uuid, days integer default 7, why text default null)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.match_chat_bans (user_id, until, reason) values (uid, now() + make_interval(days => days), why)
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
end;
$$;
revoke all on function public.admin_chat_ban(uuid, integer, text) from public, anon;
grant execute on function public.admin_chat_ban(uuid, integer, text) to authenticated;

-- New messages arrive in the game within a second or two (Supabase's live updates), instead of the game asking.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_messages') then
    alter publication supabase_realtime add table public.match_messages;
  end if;
end $$;
