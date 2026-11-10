-- Checks supabase/shared-mountains.sql on a throwaway database (after schema.sql, profiles.sql, profile-names.sql and
-- shared-mountains.sql). Synthetic users only.
create temp table sm_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into sm_users(n, email, anon) values (1, 'maker@sm.invalid', false), (2, 'other@sm.invalid', false), (3, 'noname@sm.invalid', false), (4, 'guest@sm.invalid', true);
insert into auth.users(id, email, is_anonymous) select id, email, anon from sm_users;
insert into public.profiles(id, name, public) select id, case n when 1 then 'Moss' else 'Sam' end, n <> 2 from sm_users where n in (1, 2); -- Sam's profile is private
create temp table sm_results(name text);
grant all on sm_users, sm_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'SHARED TEST FAILED: %', label; end if; insert into sm_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce((select id::text from sm_users where n = k), ''), false);
  perform set_config('request.jwt.claims', coalesce((select jsonb_build_object('sub', id, 'email', email, 'is_anonymous', anon)::text from sm_users where n = k), ''), false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
set role authenticated;

select pg_temp.as_user(1);
select pg_temp.ok((public.share_mountain('c:m0000000aaaaaaa', '{"v":1,"name":"Stony Top","from":"juniper","h":"AAAA"}', 1480, true) ->> 'creator') = 'Moss', 'a named player shares a mountain, under their name');
select pg_temp.ok((select vertical = 1480 and allow_copy and name = 'Stony Top' from public.shared_mountains where id = 'c:m0000000aaaaaaa'), 'with its name, vertical and copying on');
select pg_temp.ok((public.share_mountain('c:m0000000aaaaaaa', '{"v":1,"name":"Stony Top","from":"juniper","h":"AAAA"}', 1480, false) ->> 'allow_copy') = 'false', 'sharing it again only changes copying');
select pg_temp.ok((select count(*) = 1 from public.shared_mountains), 'still one');
select pg_temp.ok(public.set_shared_copy('c:m0000000aaaaaaa', true), 'the maker turns copying back on');
select pg_temp.ok(pg_temp.err($$select public.share_mountain('nope', '{"v":1,"name":"X","h":"A"}', 0, true)$$) = 'bad_mountain', 'a bad id is refused');
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m0000000bbbbbbb', '{"v":1,"name":"","h":"A"}', 0, true)$$) = 'bad_mountain', 'a mountain with no name is refused');
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountains (id, owner, creator, name, doc) values ('c:m0000000ccccccc', auth.uid(), 'Moss', 'X', '{}')$$) is not null, 'no writing the table directly');

select pg_temp.as_user(2);
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m0000000aaaaaaa', '{"v":1,"name":"Mine now","h":"A"}', 0, true)$$) = 'shared_by_another', 'someone else can''t take it over');
select pg_temp.ok(pg_temp.err($$select public.set_shared_copy('c:m0000000aaaaaaa', false)$$) = 'not_yours', 'or change its copying');
delete from public.shared_mountains where id = 'c:m0000000aaaaaaa';
select pg_temp.ok((select count(*) = 1 from public.shared_mountains), 'or delete it');
select pg_temp.ok((public.share_mountain('c:m0000000ddddddd', '{"v":1,"name":"Sams Hill","h":"A"}', 600, true) ->> 'creator') = 'Sam', 'a private profile shares under its name too');

select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m0000000eeeeeee', '{"v":1,"name":"Nameless","h":"A"}', 0, true)$$) = 'name_needed', 'no player name, no sharing');
select pg_temp.as_user(4);
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m0000000eeeeeee', '{"v":1,"name":"Guesty","h":"A"}', 0, true)$$) = 'sign_in_needed', 'guests can''t share');

reset role; set role anon; select pg_temp.as_user(0);
select pg_temp.ok((select count(*) = 2 from public.shared_mountains), 'anyone can read shared mountains, signed out too');
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m0000000fffffff', '{"v":1,"name":"Anon","h":"A"}', 0, true)$$) is not null, 'but not share');
reset role; set role authenticated;

select pg_temp.as_user(1);
select count(public.share_mountain('c:m' || lpad(g::text, 14, '0'), '{"v":1,"name":"Many","h":"A"}', 0, true)) from generate_series(1, 29) g;
select pg_temp.ok((select count(*) = 30 from public.shared_mountains where owner = auth.uid()), 'thirty shared');
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m0000000ggggggg', '{"v":1,"name":"One more","h":"A"}', 0, true)$$) = 'share_limit', 'at most 30 shared at once');
delete from public.shared_mountains where id = 'c:m0000000aaaaaaa';
select pg_temp.ok((select count(*) = 29 from public.shared_mountains where owner = auth.uid()), 'the maker deletes their own');
select pg_temp.ok(pg_temp.err($$select public.share_mountain('c:m0000000ggggggg', '{"v":1,"name":"One more","h":"A"}', 0, true)$$) is null, 'which frees a place');
reset role;

-- The browser: likes, ratings and resorts started on each, and the sorts.
delete from public.shared_mountains where id like 'c:m00000000000%';
set role authenticated;
select pg_temp.as_user(2);
insert into public.shared_mountain_likes (mountain_id) values ('c:m0000000ggggggg');
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_likes (mountain_id) values ('c:m0000000ggggggg')$$) is not null, 'one like each');
insert into public.shared_mountain_ratings (mountain_id, stars) values ('c:m0000000ggggggg', 4);
update public.shared_mountain_ratings set stars = 5 where mountain_id = 'c:m0000000ggggggg';
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_ratings (mountain_id, stars) values ('c:m0000000ggggggg', 6)$$) is not null, 'five stars at most');
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_likes (mountain_id) values ('c:m0000000ddddddd')$$) is not null, 'no liking your own');
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_ratings (mountain_id, stars) values ('c:m0000000ddddddd', 5)$$) is not null, 'or rating it');
select pg_temp.as_user(1);
select pg_temp.ok((select count(*) = 0 from public.shared_mountain_likes), 'likes are private to whoever gave them');
insert into public.shared_mountain_ratings (mountain_id, stars) values ('c:m0000000ddddddd', 2);
select pg_temp.as_user(4);
select pg_temp.ok(pg_temp.err($$insert into public.shared_mountain_likes (mountain_id) values ('c:m0000000ddddddd')$$) is not null, 'guests can''t like');
reset role;
insert into public.mountains (owner, summary) select (select id from sm_users where n = 3), jsonb_build_object('mt', 'c:m0000000ddddddd', 'name', 'R' || g) from generate_series(1, 3) g;
set role anon; select pg_temp.as_user(0);
select pg_temp.ok((select likes = 1 and rating = 5.0 and ratings = 1 and resorts = 0 from public.shared_mountain_list('new') where id = 'c:m0000000ggggggg'), 'the list has the totals');
select pg_temp.ok((select resorts = 3 and rating = 2.0 from public.shared_mountain_list('new') where id = 'c:m0000000ddddddd'), 'and the resorts started on each, read by anyone');
select pg_temp.ok((select id from public.shared_mountain_list('likes') limit 1) = 'c:m0000000ggggggg', 'most liked first');
select pg_temp.ok((select id from public.shared_mountain_list('resorts') limit 1) = 'c:m0000000ddddddd', 'most played first');
select pg_temp.ok((select id from public.shared_mountain_list('rating') limit 1) = 'c:m0000000ggggggg', 'top rated first');
select pg_temp.ok((select count(*) = 1 from public.shared_mountain_list('new', 'sams')), 'search by name');
select pg_temp.ok((select count(*) = 1 from public.shared_mountain_list('new', 'sam') where creator = 'Sam'), 'or by maker');
select pg_temp.ok((select count(*) = 0 from public.shared_mountain_list('new', '%')), 'a % in the search is just a character');
reset role;
delete from public.shared_mountains where id = 'c:m0000000ggggggg';
select pg_temp.ok((select count(*) = 0 from public.shared_mountain_likes), 'stopping sharing takes its likes too');
select 'SHARED TESTS PASSED: ' || count(*) from sm_results;
