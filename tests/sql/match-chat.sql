-- Checks the rules in supabase/match-chat.sql. Run on a throwaway database after supabase/multiplayer.sql and
-- supabase/match-chat.sql (or inside a transaction, then ROLLBACK). Synthetic users only.
create temp table mc_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into mc_users(n, email, anon) values (0, 'phildbs@gmail.com', false), (1, 'a@mc-test.invalid', false), (2, 'b@mc-test.invalid', false),
  (3, 'spec@mc-test.invalid', false), (4, 'quiet@mc-test.invalid', false), (5, 'guest@mc-test.invalid', true);
insert into auth.users(id, email, is_anonymous) select id, email, anon from mc_users;
insert into public.profiles(id, name, public) select id, case n when 3 then 'Snowfan' else 'Player ' || n end, n <> 4 from mc_users where not anon; -- player 4's name is private
create temp table mc_results(name text);
grant all on mc_users, mc_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'CHAT TEST FAILED: %', label; end if;
  insert into mc_results values (label);
end; $$;
create function pg_temp.as_user(n integer) returns void language plpgsql as $$
declare uid uuid; em text; an boolean;
begin
  select id, email, anon into uid, em, an from mc_users u where u.n = as_user.n;
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims', case when uid is null then '' else jsonb_build_object('sub', uid, 'email', em, 'is_anonymous', an)::text end, false);
end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$
begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.uid(n integer) returns uuid language sql as $$ select id from mc_users where mc_users.n = uid.n $$;
-- the 10-second limit, wound back so the next message can be tested at once
create function pg_temp.later() returns void language sql as $$ update public.match_messages set created_at = created_at - interval '1 minute' $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- A running match with two players, and a finished one.
insert into public.match_lobbies (id, name, starts_at, status) values ('00000000-0000-0000-0000-0000000000a1', 'Chat Cup', now(), 'running'),
  ('00000000-0000-0000-0000-0000000000a2', 'Old Cup', now() - interval '9 days', 'finished'), ('00000000-0000-0000-0000-0000000000a3', 'Gone Cup', now(), 'closed');
insert into public.match_players (lobby_id, slot, user_id, resort_name) values ('00000000-0000-0000-0000-0000000000a1', 0, pg_temp.uid(1), 'Aspen Bowl'),
  ('00000000-0000-0000-0000-0000000000a1', 1, pg_temp.uid(2), 'Birch Hollow');
insert into public.match_messages (lobby_id, name, body, kind) values ('00000000-0000-0000-0000-0000000000a2', 'Old Cup', 'Old Cup is over.', 'news'),
  ('00000000-0000-0000-0000-0000000000a3', 'Gone', 'gone', 'news');

-- The word filter.
select pg_temp.ok(public.match_clean('Nice gondola!'), 'friendly words pass');
select pg_temp.ok(public.match_clean('What a class act, see you in Scunthorpe'), 'words inside other words pass');
select pg_temp.ok(not public.match_clean('this is shit'), 'a blocked word is caught');
select pg_temp.ok(not public.match_clean('SH1T'), 'number tricks are caught');
select pg_temp.ok(not public.match_clean('f.u.c.k off'), 'spaced-out words are caught');
select pg_temp.ok(not public.match_clean('youbitch'), 'longer words run together are caught');

-- Players and spectators.
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(public.match_say('00000000-0000-0000-0000-0000000000a1', '  Good luck   everyone! ') > 0, 'a player can post');
select pg_temp.ok(pg_temp.err($$select public.match_say('00000000-0000-0000-0000-0000000000a1', 'again')$$) = 'slow down a little', 'one message every 10 seconds');
reset role; select pg_temp.later(); set role authenticated;
select pg_temp.ok(pg_temp.err($$select public.match_say('00000000-0000-0000-0000-0000000000a1', 'you are shit')$$) = 'please keep it friendly', 'rude messages are refused');
select pg_temp.ok(pg_temp.err($$select public.match_say('00000000-0000-0000-0000-0000000000a1', repeat('x', 300))$$) is null, 'a long message is cut to 200');
reset role; select pg_temp.later(); set role authenticated;
select pg_temp.as_user(3);
select pg_temp.ok(public.match_say('00000000-0000-0000-0000-0000000000a1', 'Watching from the valley') > 0, 'a signed-in spectator can post');
select pg_temp.as_user(4);
select pg_temp.ok(public.match_say('00000000-0000-0000-0000-0000000000a1', 'Hello') > 0, 'a spectator with a private name can post');
select pg_temp.as_user(5);
select pg_temp.ok(pg_temp.err($$select public.match_say('00000000-0000-0000-0000-0000000000a1', 'hi')$$) = 'sign in to chat', 'guests cannot post');
select pg_temp.ok(pg_temp.err($$insert into public.match_messages (lobby_id, name, body) values ('00000000-0000-0000-0000-0000000000a1', 'x', 'fake news')$$) is not null, 'nobody writes messages directly');
reset role;
select pg_temp.ok((select string_agg(name || ':' || coalesce(slot::text, '-') || ':' || char_length(body), ',' order by id) from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a1')
  = 'Aspen Bowl:0:19,Aspen Bowl:0:200,Snowfan:-:24,Spectator:-:5', 'players post as their resort, spectators as their profile or Spectator, spaces tidied');
select pg_temp.later();

-- Finished and closed matches.
set role anon; select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a1') = 4, 'anyone can read a match''s chat');
select pg_temp.ok((select count(*) from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a2') = 1, 'a finished match keeps its chat');
select pg_temp.ok((select count(*) from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a3') = 0, 'a closed lobby''s chat is gone');
reset role; set role authenticated; select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.match_say('00000000-0000-0000-0000-0000000000a2', 'late')$$) = 'this chat is closed', 'no new messages once a match is finished');

-- Reactions, reports and mutes.
select pg_temp.as_user(2);
insert into public.match_reactions (message_id, emoji) select min(id), '🔥' from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.ok((select count(*) from public.match_reactions) = 1, 'you can react');
select pg_temp.ok(pg_temp.err($$insert into public.match_reactions (message_id, emoji) select min(id), '💩' from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a1'$$) is not null, 'only the six reactions');
select pg_temp.ok(pg_temp.err($$insert into public.match_reactions (message_id, emoji) select min(id), '👍' from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a2'$$) is not null, 'no reactions in a finished match');
insert into public.match_reports (message_id, reason) select max(id), 'spam' from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.match_mutes (muted) values (pg_temp.uid(4));
select pg_temp.ok((select count(*) from public.match_mutes) = 1, 'you can mute someone');
select pg_temp.as_user(1);
select pg_temp.ok((select count(*) from public.match_mutes) = 0, 'mutes are private');
select pg_temp.ok(pg_temp.err($$select public.admin_chat_reports()$$) = 'not allowed', 'players cannot read reports');
select pg_temp.ok(pg_temp.err(format('select public.admin_chat_ban(%L, 7)', pg_temp.uid(2))) = 'not allowed', 'players cannot ban');

-- Phil's tools.
select pg_temp.as_user(0);
select pg_temp.ok(jsonb_array_length(public.admin_chat_reports()) = 1, 'Phil sees the reported message');
select public.admin_chat_hide((select max(id) from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a1'));
select public.admin_chat_ban(pg_temp.uid(2), 7, 'test');
select pg_temp.as_user(2);
select pg_temp.ok((select count(*) from public.match_messages where lobby_id = '00000000-0000-0000-0000-0000000000a1') = 3, 'a hidden message disappears');
select pg_temp.ok(pg_temp.err($$select public.match_say('00000000-0000-0000-0000-0000000000a1', 'let me back')$$) = 'you can''t chat right now', 'a banned account cannot chat');

-- Resort names use the same filter.
reset role;
insert into public.match_lobbies (id, name, starts_at) values ('00000000-0000-0000-0000-0000000000a4', 'Name Cup', now() + interval '1 day');
set role authenticated; select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err($$select public.match_join('00000000-0000-0000-0000-0000000000a4', 'Shit Peak')$$) = 'please pick a friendlier resort name', 'rude resort names are refused');
select pg_temp.ok(public.match_join('00000000-0000-0000-0000-0000000000a4', 'Powder Peak') >= 0, 'friendly ones are fine');
reset role;
select 'CHAT TESTS PASSED: ' || count(*) from mc_results;
