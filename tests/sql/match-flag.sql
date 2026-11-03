-- Checks supabase/match-flag.sql on a throwaway database (after multiplayer.sql and match-flag.sql).
create temp table mf_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into mf_users(n, email, anon) values (0, 'phildbs@gmail.com', false), (1, 'a@mf.invalid', false), (5, 'g@mf.invalid', true);
create temp table mf_results(name text);
grant all on mf_users, mf_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FLAG TEST FAILED: %', label; end if; insert into mf_results values (label); end; $$;
create function pg_temp.as_user(n integer) returns void language plpgsql as $$
declare uid uuid; em text; an boolean;
begin select id, email, anon into uid, em, an from mf_users u where u.n = as_user.n;
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims', case when uid is null then '' else jsonb_build_object('sub', uid, 'email', em, 'is_anonymous', an)::text end, false); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into public.match_lobbies (id, name, starts_at) values ('00000000-0000-0000-0000-0000000000f1', 'Flag Cup', now() + interval '2 hours');
select pg_temp.ok((select not flag from public.match_lobbies where name = 'Flag Cup'), 'lobbies start without a flag');
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.admin_match_flag('00000000-0000-0000-0000-0000000000f1', true)$$) = 'not allowed', 'only Phil flags a lobby');
select pg_temp.as_user(5);
select pg_temp.ok(pg_temp.err($$select public.admin_match_flag('00000000-0000-0000-0000-0000000000f1', true)$$) = 'not allowed', 'not a guest with his email either');
select pg_temp.as_user(0);
select public.admin_match_flag('00000000-0000-0000-0000-0000000000f1', true);
select pg_temp.ok((select flag from public.match_lobbies where name = 'Flag Cup'), 'Phil turns the flag on');
select pg_temp.ok(pg_temp.err($$select public.admin_match_flag('00000000-0000-0000-0000-0000000000ff', true)$$) = 'no such lobby', 'a lobby that isn''t there is an error');
select public.admin_match_flag('00000000-0000-0000-0000-0000000000f1', false);
select pg_temp.ok((select not flag from public.match_lobbies where name = 'Flag Cup'), 'and off again');
set role anon;
select pg_temp.ok((select count(*) from public.match_lobbies where name = 'Flag Cup' and flag is not null) = 1, 'anyone can read it (the title screen does)');
select pg_temp.ok(pg_temp.err($$select public.admin_match_flag('00000000-0000-0000-0000-0000000000f1', true)$$) like 'permission denied%', 'signed-out visitors can''t call it at all');
reset role;
select 'FLAG TESTS PASSED: ' || count(*) from mf_results;
