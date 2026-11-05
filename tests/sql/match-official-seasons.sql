-- Checks supabase/match-official-seasons.sql on a throwaway database (after the other match files and match-seasons).
create temp table mm_results(name text);
grant all on mm_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'OFFICIAL SEASONS TEST FAILED: %', label; end if; insert into mm_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_email(e text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('email', e, 'is_anonymous', false)::text, false); end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
set role authenticated;
select pg_temp.as_email('phildbs@gmail.com');
select pg_temp.ok(public.admin_match_lobby('Big Cup', now() + interval '1 day', 3, 363) is not null, 'an official lobby of 363 days is made');
select pg_temp.ok(pg_temp.err($$select public.admin_match_seasons((select id from public.match_lobbies where name = 'Big Cup'), 4)$$) = 'a match is 1, 2 or 3 seasons', 'at most three seasons');
select public.admin_match_seasons((select id from public.match_lobbies where name = 'Big Cup'), 2);
select pg_temp.ok((select seasons = 2 and days = 363 from public.match_lobbies where name = 'Big Cup'), 'two seasons, 363 days');
select public.admin_match_seasons((select id from public.match_lobbies where name = 'Big Cup'), 3);
select pg_temp.ok((select seasons = 3 and days = 558 from public.match_lobbies where name = 'Big Cup'), 'three seasons sets 558 days');
select public.admin_match_seasons((select id from public.match_lobbies where name = 'Big Cup'), 1);
select pg_temp.ok((select seasons = 1 and days = 168 from public.match_lobbies where name = 'Big Cup'), 'and back to one');
select pg_temp.as_email('someone@mm.invalid');
select pg_temp.ok(pg_temp.err($$select public.admin_match_seasons((select id from public.match_lobbies where name = 'Big Cup'), 2)$$) = 'not allowed', 'only Phil');
reset role;
update public.match_lobbies set status = 'running' where name = 'Big Cup';
set role authenticated;
select pg_temp.as_email('phildbs@gmail.com');
select pg_temp.ok(pg_temp.err($$select public.admin_match_seasons((select id from public.match_lobbies where name = 'Big Cup'), 2)$$) = 'only a lobby that hasn''t started', 'not once it has started');
select count(*) || ' official seasons checks passed' from mm_results;
