-- Checks supabase/match-season.sql on a throwaway database (after the other match files and match-season).
create temp table ms_users(n integer primary key, id uuid default gen_random_uuid(), email text);
insert into ms_users(n, email) values (1, 'a@ms.invalid');
insert into auth.users(id, email, is_anonymous) select id, email, false from ms_users;
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from ms_users;
create temp table ms_results(name text);
grant all on ms_users, ms_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'SEASON TEST FAILED: %', label; end if; insert into ms_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
select set_config('request.jwt.claim.sub', (select id::text from ms_users), false);
select set_config('request.jwt.claims', jsonb_build_object('sub', (select id from ms_users), 'email', 'a@ms.invalid', 'is_anonymous', false)::text, false);
set role authenticated;
select pg_temp.ok(pg_temp.err($$select public.match_create('Short Cup', now() + interval '1 hour', 10, 28)$$) = 'a match lasts one whole season (168 days)', 'shorter than a season is refused');
select pg_temp.ok(pg_temp.err($$select public.match_create('Long Cup', now() + interval '1 hour', 10, 336)$$) = 'a match lasts one whole season (168 days)', 'two seasons waits for now');
select pg_temp.ok(public.match_create('Season Cup', now() + interval '1 hour', 10, 168) is not null, 'one season is made');
reset role;
select 'SEASON TESTS PASSED: ' || count(*) from ms_results;
