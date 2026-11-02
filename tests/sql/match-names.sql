-- Checks supabase/match-names.sql on a throwaway database (after all the other match files and match-names.sql):
-- an account without a player name can't join, join late, or chat; once it has one, it can.
create temp table mn_users(n integer primary key, id uuid default gen_random_uuid());
insert into mn_users(n) values (1), (2);
insert into auth.users(id, email, is_anonymous) select id, n || '@mn.invalid', false from mn_users;
create temp table mn_results(name text);
grant all on mn_users, mn_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'NAMES TEST FAILED: %', label; end if; insert into mn_results values (label); end; $$;
create function pg_temp.as_user(n integer) returns void language plpgsql as $$
declare uid uuid; begin select id into uid from mn_users u where u.n = as_user.n;
  perform set_config('request.jwt.claim.sub', uid::text, false); perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'email', n || '@mn.invalid')::text, false); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
insert into public.match_lobbies (id, name, starts_at, status, day) values ('00000000-0000-0000-0000-0000000000c1', 'Name Cup', now() + interval '1 day', 'open', 0),
  ('00000000-0000-0000-0000-0000000000c2', 'Late Name Cup', now() - interval '1 hour', 'running', 1);
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.match_join('00000000-0000-0000-0000-0000000000c1', 'No Name Hill')$$) = 'pick your player name first', 'no joining without a player name');
select pg_temp.ok(pg_temp.err($$select public.match_join_late('00000000-0000-0000-0000-0000000000c2', 'No Name Hill')$$) = 'pick your player name first', 'no late joining either');
select pg_temp.ok(pg_temp.err($$select public.match_say('00000000-0000-0000-0000-0000000000c2', 'hello')$$) = 'pick your player name first', 'and no chatting');
reset role;
insert into public.profiles (id, name, public) select id, 'Named', true from mn_users where n = 1;
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(public.match_join('00000000-0000-0000-0000-0000000000c1', 'Named Hill') >= 0, 'with a name you can join');
select pg_temp.ok(public.match_say('00000000-0000-0000-0000-0000000000c2', 'hello') > 0, 'and chat');
reset role;
select 'NAMES TESTS PASSED: ' || count(*) from mn_results;
