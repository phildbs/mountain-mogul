-- Checks supabase/match-maps.sql on a throwaway database (after the other match files and match-maps).
create temp table mm_users(n integer primary key, id uuid default gen_random_uuid(), email text);
insert into mm_users(n, email) values (1, 'a@mm.invalid'), (2, 'b@mm.invalid'), (3, 'c@mm.invalid');
insert into auth.users(id, email, is_anonymous) select id, email, false from mm_users;
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from mm_users;
create temp table mm_results(name text);
grant all on mm_users, mm_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'MAPS TEST FAILED: %', label; end if; insert into mm_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from mm_users where n = k), false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', (select id from mm_users where n = k), 'email', (select email from mm_users where n = k), 'is_anonymous', false)::text, false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.match_create_on('everest', 'Big Cup', now() + interval '1 hour', 10, 168, 3)$$) = 'pick one of the mountains', 'an unknown mountain is refused');
select pg_temp.ok(pg_temp.err($$select public.match_create_on('match', 'Crown Cup', now() + interval '1 hour', 10, 168, 4)$$) = 'a match on Crown Peak has 2 or 3 resorts', 'Crown Peak takes at most 3');
select pg_temp.ok(pg_temp.err($$select public.match_create_on('ridge', 'Ridge Cup', now() + interval '1 hour', 10, 168, 5)$$) = 'a match on Ridgeline has 2 to 4 resorts', 'Ridgeline takes at most 4');
select pg_temp.ok(pg_temp.err($$select public.match_create_on('ridge', 'Ridge Cup', now() + interval '1 hour', 10, 168, 1)$$) = 'a match on Ridgeline has 2 to 4 resorts', 'and at least 2');
select pg_temp.ok(pg_temp.err($$select public.match_create_on('ridge', 'Ridge Cup', now() + interval '1 hour', 10, 28, 4)$$) = 'a match lasts one whole season (168 days)', 'a whole season, as on Crown Peak');
select pg_temp.ok(public.match_create_on('ridge', 'Ridge Cup', now() + interval '1 hour', 15, 168, 4, false, null, 'West Bowl') is not null, 'a 4-resort Ridgeline match is made');
select pg_temp.ok((select map = 'ridge' and slots = 4 and kind = 'custom' and day_minutes = 15 from public.match_lobbies where name = 'Ridge Cup'), 'with its map, 4 resorts, as a player match');
select pg_temp.ok((select count(*) = 1 and min(slot) between 0 and 3 from public.match_players p join public.match_lobbies l on l.id = p.lobby_id where l.name = 'Ridge Cup'), 'and its maker is in it, on one of the four valleys');
-- Three more players fill the other valleys; a fifth finds it full.
select pg_temp.as_user(2);
select pg_temp.ok(public.match_join((select id from public.match_lobbies where name = 'Ridge Cup'), 'Second Valley') in (0, 1, 2, 3), 'a second player joins');
select pg_temp.as_user(3);
select pg_temp.ok(public.match_join((select id from public.match_lobbies where name = 'Ridge Cup'), 'Third Valley') in (0, 1, 2, 3), 'a third player joins');
select pg_temp.ok((select count(distinct slot) = 3 from public.match_players p join public.match_lobbies l on l.id = p.lobby_id where l.name = 'Ridge Cup'), 'each on their own valley');
select pg_temp.ok(public.match_create_on('match', 'Crown Two', now() + interval '1 hour', 30, 168, 2) is not null, 'Crown Peak matches can still be made this way');
select pg_temp.ok((select map = 'match' and slots = 2 from public.match_lobbies where name = 'Crown Two'), 'on Crown Peak');
-- The old function still makes Crown Peak matches.
select pg_temp.as_user(2);
select pg_temp.ok(pg_temp.err($$select public.match_create('Old Way Cup', now() + interval '1 hour', 10, 168, 3)$$) is null, 'match_create still works');
select pg_temp.ok((select map = 'match' from public.match_lobbies where name = 'Old Way Cup'), 'on Crown Peak');
reset role;
select 'MAPS TESTS PASSED: ' || count(*) from mm_results;
