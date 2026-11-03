-- Checks supabase/match-options.sql on a throwaway database (after the other match files and match-options).
create temp table mo_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into mo_users(n, email, anon) values (0, 'phildbs@gmail.com', false), (1, 'a@mo.invalid', false), (2, 'b@mo.invalid', false);
insert into auth.users(id, email, is_anonymous) select id, email, anon from mo_users;
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from mo_users;
create temp table mo_results(name text);
create temp table mo_ids(k text primary key, id uuid);
grant all on mo_users, mo_results, mo_ids to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'OPTIONS TEST FAILED: %', label; end if; insert into mo_results values (label); end; $$;
create function pg_temp.as_user(n integer) returns void language plpgsql as $$
declare uid uuid; em text; an boolean;
begin select id, email, anon into uid, em, an from mo_users u where u.n = as_user.n;
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims', case when uid is null then '' else jsonb_build_object('sub', uid, 'email', em, 'is_anonymous', an)::text end, false); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

set role authenticated;
select pg_temp.as_user(1);
insert into mo_ids select 'm', public.match_create('Switch Cup', now() + interval '1 hour', 10, 7, 3, true, null, 'One Hill');
select pg_temp.ok((select late and computers from public.match_lobbies where id = (select id from mo_ids)), 'late joining and computers on to begin with');
select public.match_options((select id from mo_ids), false, false);
select pg_temp.ok((select not late and not computers from public.match_lobbies where id = (select id from mo_ids)), 'the maker turns both off');
select public.match_options((select id from mo_ids), null, true);
select pg_temp.ok((select late and not computers from public.match_lobbies where id = (select id from mo_ids)), 'leaving one out keeps it');
select pg_temp.as_user(2);
select pg_temp.ok(pg_temp.err(format('select public.match_options(%L, true, true)', (select id from mo_ids))) like 'only the player who made a match%', 'only the maker');
select pg_temp.ok(pg_temp.err(format('select public.admin_match_late(%L, false)', (select id from mo_ids))) = 'not allowed', 'only Phil uses his switch');

-- No late joining: a running match refuses late joiners.
select pg_temp.as_user(0);
select public.admin_match_late((select id from mo_ids), false);
reset role;
update public.match_lobbies set status = 'running', day = 1 where id = (select id from mo_ids);
set role authenticated;
select pg_temp.as_user(2);
select pg_temp.ok(pg_temp.err(format('select public.match_join_late(%L, %L)', (select id from mo_ids), 'Two Hill')) = 'this match doesn''t take late joiners', 'late joining off: nobody joins after the start');
select pg_temp.as_user(0);
select public.admin_match_late((select id from mo_ids), true);
select pg_temp.as_user(2);
select pg_temp.ok(public.match_join_late((select id from mo_ids), 'Two Hill') in (0, 1, 2), 'late joining on: they can');
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err(format('select public.match_options(%L, true, true)', (select id from mo_ids))) like 'only the player who made a match%', 'no changes once it has started');
reset role;
select 'OPTIONS TESTS PASSED: ' || count(*) from mo_results;
