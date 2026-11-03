-- Checks supabase/match-custom.sql on a throwaway database (after schema, profiles, multiplayer, match-chat,
-- match-late, match-names, match-flag and match-custom). Synthetic users only.
create temp table mc_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into mc_users(n, email, anon) values (0, 'phildbs@gmail.com', false), (1, 'a@mc.invalid', false), (2, 'b@mc.invalid', false), (3, 'c@mc.invalid', false),
  (4, 'd@mc.invalid', false), (5, 'g@mc.invalid', true);
insert into auth.users(id, email, is_anonymous) select id, email, anon from mc_users;
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from mc_users where not anon;
insert into public.match_blocked_words values ('shit') on conflict do nothing;
create temp table mc_results(name text);
grant all on mc_users, mc_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'CUSTOM TEST FAILED: %', label; end if; insert into mc_results values (label); end; $$;
create function pg_temp.as_user(n integer) returns void language plpgsql as $$
declare uid uuid; em text; an boolean;
begin select id, email, anon into uid, em, an from mc_users u where u.n = as_user.n;
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims', case when uid is null then '' else jsonb_build_object('sub', uid, 'email', em, 'is_anonymous', an)::text end, false); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.uid(n integer) returns uuid language sql as $$ select id from mc_users where mc_users.n = uid.n $$;
create temp table mc_ids(k text primary key, id uuid);
grant all on mc_ids to anon, authenticated;
grant execute on all functions in schema pg_temp to anon, authenticated;

set role authenticated;
-- Making a match: signed-in players with a name, sensible settings.
select pg_temp.as_user(5);
select pg_temp.ok(pg_temp.err($$select public.match_create('Guest Cup', now() + interval '1 hour', 15, 28)$$) = 'sign in to play multiplayer', 'guests can''t make matches');
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.match_create('Fast Cup', now() + interval '1 hour', 20, 28)$$) = 'a turn is 10, 15 or 30 minutes', 'turns are 10, 15 or 30 minutes');
select pg_temp.ok(pg_temp.err($$select public.match_create('Fast Cup', now() + interval '1 hour', 15, 30)$$) = 'pick one of the match lengths', 'only the listed lengths');
select pg_temp.ok(pg_temp.err($$select public.match_create('Fast Cup', now() + interval '1 hour', 15, 28, 4)$$) = 'a match has 2 or 3 resorts', '2 or 3 resorts');
select pg_temp.ok(pg_temp.err($$select public.match_create('Fast Cup', now() + interval '1 minute', 15, 28)$$) = 'pick a start between 5 minutes and 3 days from now', 'not starting straight away');
select pg_temp.ok(pg_temp.err($$select public.match_create('Fast Cup', now() + interval '4 days', 15, 28)$$) = 'pick a start between 5 minutes and 3 days from now', 'not too far ahead');
select pg_temp.ok(pg_temp.err($$select public.match_create('Shit Cup', now() + interval '1 hour', 15, 28)$$) = 'please pick a friendlier match name', 'friendly names only');
select pg_temp.ok(pg_temp.err($$select public.match_create('Fast Cup', now() + interval '1 hour', 15, 28, 3, true, 'abc')$$) = 'a password is 4 to 30 characters', 'passwords of 4 or more');
insert into mc_ids select 'pub', public.match_create('  Fast   Cup ', now() + interval '1 hour 20 seconds', 15, 28, 2, false, null, 'First Hill');
select pg_temp.ok((select kind = 'custom' and created_by = pg_temp.uid(1) and not locked and name = 'Fast Cup' and day_minutes = 15 and days = 28 and slots = 2 and not computers
  and prize is null and extract(second from starts_at) = 0 from public.match_lobbies where id = (select id from mc_ids where k = 'pub')), 'a public player match, on a whole minute');
select pg_temp.ok((select resort_name = 'First Hill' from public.match_players where lobby_id = (select id from mc_ids where k = 'pub') and user_id = pg_temp.uid(1)), 'the maker is in it');
select pg_temp.ok(pg_temp.err($$select public.match_create('Second Cup', now() + interval '1 hour', 15, 28)$$) like 'you already have a match of your own on%', 'one match of your own at a time');

-- A locked match: the password is needed to join, and never readable.
select pg_temp.as_user(2);
insert into mc_ids select 'priv', public.match_create('Friends Cup', now() + interval '2 hours', 10, 7, 3, true, ' Powder42 ', 'Second Hill');
select pg_temp.ok((select locked from public.match_lobbies where id = (select id from mc_ids where k = 'priv')), 'locked shows on the lobby');
select pg_temp.ok(pg_temp.err($$select * from public.match_lobby_keys$$) like 'permission denied%', 'passwords can''t be read');
select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err(format('select public.match_join(%L, %L)', (select id from mc_ids where k = 'priv'), 'Third Hill')) = 'that password isn''t right', 'no password, no join');
select pg_temp.ok(pg_temp.err(format('select public.match_join_key(%L, %L, %L)', (select id from mc_ids where k = 'priv'), 'Third Hill', 'powder42')) = 'that password isn''t right', 'capitals count');
select pg_temp.ok(public.match_join_key((select id from mc_ids where k = 'priv'), 'Third Hill', 'Powder42') in (0, 1, 2), 'the right password joins');
select pg_temp.ok(public.match_join((select id from mc_ids where k = 'pub'), 'Third Hill') in (0, 1), 'a public match needs no password');

-- Cancelling: only the maker, only before it starts.
select pg_temp.ok(pg_temp.err(format('select public.match_cancel(%L)', (select id from mc_ids where k = 'pub'))) like 'only the player who made a match%', 'only the maker cancels');
select pg_temp.as_user(1);
select public.match_cancel((select id from mc_ids where k = 'pub'));
reset role;
select pg_temp.ok((select status = 'closed' from public.match_lobbies where id = (select id from mc_ids where k = 'pub')), 'cancelled');
set role authenticated;
select pg_temp.ok(public.match_create('Second Cup', now() + interval '1 hour', 30, 168) is not null, 'after cancelling, a new one');

-- Phil's lobbies stay official; he can change the turn length before they start.
select pg_temp.as_user(0);
insert into mc_ids select 'off', public.admin_match_lobby('Winter Cup', now() + interval '3 hours');
select pg_temp.ok((select kind = 'official' and created_by is null from public.match_lobbies where id = (select id from mc_ids where k = 'off')), 'Phil''s lobbies are official');
select public.admin_match_turn((select id from mc_ids where k = 'off'), 10);
select pg_temp.ok((select day_minutes = 10 from public.match_lobbies where id = (select id from mc_ids where k = 'off')), 'Phil sets 10-minute turns');
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err(format('select public.admin_match_turn(%L, 15)', (select id from mc_ids where k = 'off'))) = 'not allowed', 'only Phil');

-- Played and won: finished matches only; a win needs two real players.
reset role;
insert into public.match_lobbies (id, name, starts_at, status, days, kind) values ('00000000-0000-0000-0000-0000000000c1', 'Done Two', now() - interval '2 days', 'finished', 7, 'custom'),
  ('00000000-0000-0000-0000-0000000000c2', 'Done Solo', now() - interval '2 days', 'finished', 7, 'custom'), ('00000000-0000-0000-0000-0000000000c3', 'Old Cup', now() - interval '5 days', 'finished', 7, 'official');
insert into public.match_players (lobby_id, slot, user_id, resort_name, place) values ('00000000-0000-0000-0000-0000000000c1', 0, pg_temp.uid(4), 'Four', 1),
  ('00000000-0000-0000-0000-0000000000c1', 1, pg_temp.uid(3), 'Three', 2), ('00000000-0000-0000-0000-0000000000c2', 0, pg_temp.uid(4), 'Four', 1),
  ('00000000-0000-0000-0000-0000000000c2', 1, null, 'Valley View', 2), ('00000000-0000-0000-0000-0000000000c3', 0, pg_temp.uid(4), 'Four', null),
  ('00000000-0000-0000-0000-0000000000c3', 1, pg_temp.uid(2), 'Two', null);
insert into public.match_badges (user_id, lobby_id, place, title) values (pg_temp.uid(4), '00000000-0000-0000-0000-0000000000c3', 1, 'Old Cup champion');
set role anon;
select pg_temp.ok((select played = 3 and won = 2 from public.match_record(pg_temp.uid(4))), 'played 3, won 2 (the solo win doesn''t count; an old win from its badge does)');
select pg_temp.ok((select played = 1 and won = 0 from public.match_record(pg_temp.uid(3))), 'played 1, won 0');
reset role;

select 'CUSTOM TESTS PASSED: ' || count(*) from mc_results;
