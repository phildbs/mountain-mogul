-- Checks supabase/match-fast-turns.sql on a throwaway database (after the other match files).
create temp table mm_users(n integer primary key, id uuid default gen_random_uuid(), email text);
insert into mm_users(n, email) values (1, 'f1@mm.invalid'), (2, 'f2@mm.invalid');
insert into auth.users(id, email, is_anonymous) select id, email, false from mm_users;
insert into public.profiles(id, name, public) select id, 'Fast ' || n, true from mm_users;
create temp table mm_results(name text);
grant all on mm_users, mm_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FAST TURNS TEST FAILED: %', label; end if; insert into mm_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from mm_users where n = k), false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', (select id from mm_users where n = k), 'email', (select email from mm_users where n = k), 'is_anonymous', false)::text, false);
end; $$;
create function pg_temp.as_email(e text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('email', e, 'is_anonymous', false)::text, false); end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.match_create('Odd Cup', now() + interval '1 hour', 7, 168, 3)$$) = 'a turn is 5, 10, 15 or 30 minutes', 'a turn of another length is refused');
select pg_temp.ok(public.match_create('Fast Cup', now() + interval '1 hour', 5, 363, 2) is not null, 'a 5-minute match is made');
select pg_temp.ok((select day_minutes = 5 and seasons = 2 from public.match_lobbies where name = 'Fast Cup'), 'with 5-minute turns, and its seasons');
select pg_temp.as_user(2);
select pg_temp.ok(public.match_create_on('ridge', 'Fast Ridge', now() + interval '1 hour', 5, 168, 4) is not null, 'on Ridgeline too');
select pg_temp.as_email('phildbs@gmail.com');
select pg_temp.ok(public.admin_match_lobby('Fast Official', now() + interval '1 day', 3, 168) is not null, 'an official lobby');
select public.admin_match_turn((select id from public.match_lobbies where name = 'Fast Official'), 5);
select pg_temp.ok((select day_minutes = 5 from public.match_lobbies where name = 'Fast Official'), 'can have 5-minute turns');
select count(*) || ' fast turns checks passed' from mm_results;
