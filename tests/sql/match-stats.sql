-- Checks supabase/match-stats.sql on a throwaway database (after the other match files and match-stats).
create temp table ms_users(n integer primary key, id uuid default gen_random_uuid(), email text);
insert into ms_users(n, email) values (0, 'phildbs@gmail.com'), (1, 'a@ms.invalid'), (2, 'b@ms.invalid'), (3, 'c@ms.invalid');
insert into auth.users(id, email, is_anonymous) select id, email, false from ms_users;
insert into auth.users(email, is_anonymous) values (null, true); -- a guest: not counted as signed in
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from ms_users where n > 0;
create temp table ms_results(name text);
grant all on ms_users, ms_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'MATCH STATS TEST FAILED: %', label; end if; insert into ms_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', (select id from ms_users where n = k), 'email', (select email from ms_users where n = k), 'is_anonymous', false)::text, false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
-- A running official match with players 1 and 2 and an empty slot; a finished player match with players 1 and 3
-- (3 left it); an open lobby; a closed one that never counts.
insert into public.match_lobbies (name, slots, starts_at, days, day_minutes, status, day, kind, map) values
  ('Run Cup', 3, now() - interval '3 days', 168, 30, 'running', 40, 'official', 'match'),
  ('Done Cup', 2, now() - interval '30 days', 12, 30, 'finished', 12, 'custom', 'ridge'),
  ('Open Cup', 3, now() + interval '1 day', 168, 30, 'open', 0, 'official', 'match'),
  ('Shut Cup', 3, now() - interval '2 days', 168, 30, 'closed', 5, 'official', 'match');
create temp table ms_l as select name, id from public.match_lobbies;
insert into public.match_players (lobby_id, slot, user_id, resort_name, joined_at) values
  ((select id from ms_l where name = 'Run Cup'), 0, (select id from ms_users where n = 1), 'Aspen', now() - interval '3 days'),
  ((select id from ms_l where name = 'Run Cup'), 1, (select id from ms_users where n = 2), 'Birch', now() - interval '2 days'),
  ((select id from ms_l where name = 'Done Cup'), 0, (select id from ms_users where n = 1), 'Cedar', now() - interval '30 days'),
  ((select id from ms_l where name = 'Done Cup'), 1, null, 'Dune', now() - interval '30 days'),
  ((select id from ms_l where name = 'Shut Cup'), 0, (select id from ms_users where n = 3), 'Elm', now() - interval '2 days');
update public.match_players set left_by = array[(select id from ms_users where n = 3)], abandoned = true where resort_name = 'Dune';
insert into public.match_resorts (lobby_id, slot, summary) values ((select id from ms_l where name = 'Run Cup'), 0, '{"cash": 900000, "profit": 125000, "guests": 800, "lifts": 3, "trails": 7}');
-- Player 1 builds today and yesterday, player 2 only chats 3 days ago.
insert into public.match_orders (lobby_id, slot, user_id, kind, payload, created_at) values
  ((select id from ms_l where name = 'Run Cup'), 0, (select id from ms_users where n = 1), 'build', '{}', now() - interval '1 hour'),
  ((select id from ms_l where name = 'Run Cup'), 0, (select id from ms_users where n = 1), 'price', '{}', now() - interval '26 hours');
insert into public.match_messages (lobby_id, user_id, slot, name, body, kind, created_at) values
  ((select id from ms_l where name = 'Run Cup'), (select id from ms_users where n = 2), 1, 'Birch', 'hi', 'chat', now() - interval '3 days'),
  ((select id from ms_l where name = 'Run Cup'), null, null, 'News', 'Day 40', 'news', now());

set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err('select public.admin_match_stats(''UTC'')') ~ 'not allowed', 'only the owner can read the numbers');
select pg_temp.as_user(0);
create temp table ms_s as select public.admin_match_stats('America/New_York') as s;
select pg_temp.ok((s ->> 'signed_in')::int = 4, 'signed-in accounts, not guests: ' || (s ->> 'signed_in')) from ms_s;
select pg_temp.ok((s ->> 'players')::int = 2, 'players who joined a match that isn''t closed: ' || (s ->> 'players')) from ms_s;
select pg_temp.ok((s ->> 'new_7d')::int = 1, 'one new this week (player 1 first joined 30 days ago): ' || (s ->> 'new_7d')) from ms_s;
select pg_temp.ok((s ->> 'active_24h')::int = 1 and (s ->> 'active_7d')::int = 2, 'active today and this week, orders or chat') from ms_s;
select pg_temp.ok((s ->> 'in_running')::int = 2, 'two players in running matches') from ms_s;
select pg_temp.ok((s ->> 'sent_order')::int = 1 and (s ->> 'two_days')::int = 1 and (s ->> 'two_matches')::int = 1, 'engagement counts: ' || s::text) from ms_s;
select pg_temp.ok(s -> 'lobbies' = '{"open": 1, "running": 1, "finished": 1, "official": 2, "custom": 1, "makers": 0, "crown": 2, "ridge": 1}'::jsonb, 'lobby counts: ' || (s -> 'lobbies')::text) from ms_s;
select pg_temp.ok(s -> 'seats' = '{"filled": 3, "total": 5}'::jsonb, 'seats filled in started matches: ' || (s -> 'seats')::text) from ms_s;
select pg_temp.ok((s ->> 'left')::int = 1 and (s ->> 'rescued')::int = 0, 'left and rescued resorts') from ms_s;
select pg_temp.ok((s ->> 'chat_7d')::int = 1 and (s ->> 'chatters_7d')::int = 1, 'chat counts leave out the server''s news') from ms_s;
select pg_temp.ok(jsonb_array_length(s -> 'per_day') = 14 and (select sum((d ->> 'active')::int) from jsonb_array_elements(s -> 'per_day') d) = 3, '14 days, with active players per day') from ms_s;
select pg_temp.ok((select string_agg(m ->> 'name', ',') from jsonb_array_elements(s -> 'matches') m) = 'Run Cup,Open Cup', 'running first, then the rest from the last 14 days, closed ones left out: ' || (select string_agg(m ->> 'name', ',') from jsonb_array_elements(s -> 'matches') m)) from ms_s;
select pg_temp.ok((select p from ms_s, jsonb_array_elements(s -> 'matches' -> 0 -> 'players') p where p ->> 'resort' = 'Aspen') @> '{"player": "Player 1", "orders": 2, "orders_24h": 1, "profit": 125000, "lifts": 3}'::jsonb, 'each player''s orders and league numbers');
reset role;
select count(*) || ' match-stats checks passed' from ms_results;
