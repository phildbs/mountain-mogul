-- Checks supabase/shared-mountains-admin.sql on a throwaway database (after schema.sql, profiles.sql,
-- profile-names.sql, multiplayer.sql, match-chat.sql, shared-mountains.sql and shared-mountains-admin.sql).
create temp table sa_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into sa_users(n, email, anon) values (0, 'phildbs@gmail.com', false), (1, 'maker@sa.invalid', false), (2, 'other@sa.invalid', false), (3, 'guest@sa.invalid', true);
insert into auth.users(id, email, is_anonymous) select id, email, anon from sa_users;
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from sa_users where n in (1, 2);
create temp table sa_results(name text);
grant all on sa_users, sa_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'SHARED ADMIN TEST FAILED: %', label; end if; insert into sa_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce((select id::text from sa_users where n = k), ''), false);
  perform set_config('request.jwt.claims', coalesce((select jsonb_build_object('sub', id, 'email', email, 'is_anonymous', anon)::text from sa_users where n = k), ''), false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
insert into public.match_blocked_words (word) values ('shit') on conflict do nothing;
set role authenticated;

select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m00000000000bad', '{"v":1,"name":"Shit Hill","h":"A"}', 0, true)$$) = 'name_not_allowed', 'a blocked word in the name is refused');
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m00000000000bad', '{"v":1,"name":"S h i t Peak","h":"A"}', 0, true)$$) = 'name_not_allowed', 'spaced out too');
select pg_temp.ok((public.share_mountain('c:m0000000000good', '{"v":1,"name":"Scunthorpe Bowl","h":"A"}', 900, true) ->> 'creator') = 'Player 1', 'a fine name shares');
select pg_temp.as_user(2);
insert into public.shared_mountain_reports (mountain_id, reason) values ('c:m0000000000good', 'rude shape');
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_reports (mountain_id) values ('c:m0000000000good')$$) is not null, 'one report each');
insert into public.shared_mountain_likes (mountain_id) values ('c:m0000000000good');
select pg_temp.ok(pg_temp.err($$select public.admin_shared_mountains()$$) like '%not allowed%', 'players can''t read the owner''s list');
select pg_temp.ok(pg_temp.err($$select public.admin_shared_remove('c:m0000000000good')$$) like '%not allowed%', 'or remove mountains');
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_reports (mountain_id) values ('c:m0000000000good')$$) is not null, 'no reporting your own');
select pg_temp.ok((select count(*) = 0 from public.shared_mountain_reports), 'reports are private to whoever made them');
select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_reports (mountain_id) values ('c:m0000000000good')$$) is not null, 'guests can''t report');
reset role;
insert into public.mountains (owner, summary) values ((select id from sa_users where n = 2), '{"mt":"c:m0000000000good","lifts":2}'), ((select id from sa_users where n = 2), '{"mt":"c:m00000000000zzz"}');
set role authenticated;
select pg_temp.as_user(0);
select pg_temp.ok((select (d -> 'totals' ->> 'shared')::int = 1 and (d -> 'totals' ->> 'likes')::int = 1 and (d -> 'totals' ->> 'reports')::int = 1
  and (d -> 'totals' ->> 'hand_resorts')::int = 2 and (d -> 'totals' ->> 'hand_resorts_built')::int = 1 and (d -> 'totals' ->> 'shared_resorts')::int = 1 from public.admin_shared_mountains() d), 'Phil sees the totals');
select pg_temp.ok((select d -> 'mountains' -> 0 ->> 'reports' = '1' and d -> 'mountains' -> 0 -> 'reasons' ->> 0 = 'rude shape' and d -> 'mountains' -> 0 ->> 'resorts' = '1' from public.admin_shared_mountains() d), 'and each mountain with its reports and reasons');
select pg_temp.ok(public.admin_shared_remove('c:m0000000000good'), 'Phil removes it');
select pg_temp.ok((select count(*) = 0 from public.shared_mountain_reports) and (select count(*) = 0 from public.shared_mountains), 'with its reports');
reset role;
select 'SHARED ADMIN TESTS PASSED: ' || count(*) from sa_results;
