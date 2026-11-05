-- Checks supabase/match-seasons.sql on a throwaway database (after the other match files, match-maps and match-seasons).
create temp table mm_users(n integer primary key, id uuid default gen_random_uuid(), email text);
insert into mm_users(n, email) values (1, 'a@mm.invalid'), (2, 'b@mm.invalid'), (3, 'c@mm.invalid');
insert into auth.users(id, email, is_anonymous) select id, email, false from mm_users;
insert into public.profiles(id, name, public) select id, 'Season ' || n, true from mm_users;
create temp table mm_results(name text);
grant all on mm_users, mm_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'SEASONS TEST FAILED: %', label; end if; insert into mm_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from mm_users where n = k), false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', (select id from mm_users where n = k), 'email', (select email from mm_users where n = k), 'is_anonymous', false)::text, false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
insert into public.match_lobbies (name, map, slots, starts_at, days, day_minutes) values ('Old Cup', 'match', 3, now() + interval '1 day', 168, 30);
select pg_temp.ok((select seasons = 1 from public.match_lobbies where name = 'Old Cup'), 'a match made the old way is one season');
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.match_create('Odd Cup', now() + interval '1 hour', 10, 200, 3)$$) = 'a match lasts 1, 2 or 3 whole seasons (168, 363 or 558 days)', 'a length that isn''t whole seasons is refused');
select pg_temp.ok(pg_temp.err($$select public.match_create_on('ridge', 'Odd Cup', now() + interval '1 hour', 10, 336, 3)$$) = 'a match lasts 1, 2 or 3 whole seasons (168, 363 or 558 days)', 'on Ridgeline too');
select pg_temp.ok(public.match_create('Two Winter Cup', now() + interval '1 hour', 10, 363, 3, false, null, 'First Peak') is not null, 'a two-season match is made');
select pg_temp.ok((select seasons = 2 and days = 363 from public.match_lobbies where name = 'Two Winter Cup'), 'it notes two seasons');
select pg_temp.ok(pg_temp.err($$select public.match_create('Another Cup', now() + interval '1 hour', 10, 168, 3)$$) like 'you already have a match of your own on%', 'still one of your own at a time');
select pg_temp.as_user(2);
select pg_temp.ok(public.match_create_on('ridge', 'Three Winter Cup', now() + interval '1 hour', 30, 558, 4, false, null, 'Ridge Top') is not null, 'a three-season Ridgeline match is made');
select pg_temp.ok((select seasons = 3 and days = 558 and map = 'ridge' from public.match_lobbies where name = 'Three Winter Cup'), 'it notes three seasons');
select pg_temp.as_user(3);
select pg_temp.ok(public.match_create('One Winter Cup', now() + interval '1 hour', 15, 168, 2) is not null, 'a one-season match is made as before');
select pg_temp.ok((select seasons = 1 from public.match_lobbies where name = 'One Winter Cup'), 'as one season');
select pg_temp.ok(public.match_join((select id from public.match_lobbies where name = 'Two Winter Cup'), 'Second Peak') in (0, 1, 2), 'joining a longer match works as usual');
reset role;
select pg_temp.ok(pg_temp.err($$update public.match_lobbies set seasons = 4 where name = 'One Winter Cup'$$) like '%match_lobbies_seasons_check%', 'at most three seasons');
select pg_temp.ok(public.match_seasons_in(168) = 1 and public.match_seasons_in(363) = 2 and public.match_seasons_in(558) = 3 and public.match_seasons_in(6) = 1, 'days to seasons');
select count(*) || ' seasons checks passed' from mm_results;
