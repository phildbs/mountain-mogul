-- Checks the rules in supabase/multiplayer.sql. Run it on a throwaway database (or inside a transaction, then
-- ROLLBACK) after supabase/multiplayer.sql. Synthetic users only; no existing player is read or altered.
-- Every check raises 'MULTIPLAYER TEST FAILED: ...' on failure; the last line prints how many passed.
create temp table mp_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into mp_users(n, email, anon) values (0, 'phildbs@gmail.com', false), (1, 'a@mp-test.invalid', false), (2, 'b@mp-test.invalid', false),
  (3, 'c@mp-test.invalid', false), (4, 'd@mp-test.invalid', false), (5, 'guest@mp-test.invalid', true);
insert into auth.users(id, email, is_anonymous) select id, email, anon from mp_users;
create temp table mp_results(name text);
grant all on mp_users, mp_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'MULTIPLAYER TEST FAILED: %', label; end if;
  insert into mp_results values (label);
end; $$;
-- Act as player n (or as a guest with no account when n is null).
create function pg_temp.as_user(n integer) returns void language plpgsql as $$
declare uid uuid; em text; an boolean;
begin
  select id, email, anon into uid, em, an from mp_users u where u.n = as_user.n;
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims', case when uid is null then '' else jsonb_build_object('sub', uid, 'email', em, 'is_anonymous', an)::text end, false);
end; $$;
-- True when running sql raises an error.
create function pg_temp.fails(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Phil makes two lobbies; nobody else can.
select pg_temp.as_user(0);
set role authenticated;
create temp table mp_lobby as select public.admin_match_lobby('Test Cup', now() + interval '1 day', 3, 7) as id;
insert into mp_lobby select public.admin_match_lobby('Second Cup', now() + interval '1 day', 2, 7);
grant all on mp_lobby to anon, authenticated, postgres;
reset role;
select pg_temp.ok((select count(*) from public.match_lobbies where name in ('Test Cup', 'Second Cup')) = 2, 'Phil can make lobbies');
select pg_temp.ok((select prize from public.match_lobbies where name = 'Test Cup') = 'Test Cup champion', 'a lobby gets a default prize');
select pg_temp.ok((select extract(minute from starts_at) in (0, 30) and extract(second from starts_at) = 0 and starts_at >= now() + interval '1 day' and day_minutes = 30 from public.match_lobbies where name = 'Test Cup'), 'a lobby starts on the next hour or half hour, with half-hour days');
select pg_temp.as_user(1);
set role authenticated;
select pg_temp.ok(pg_temp.fails($$select public.admin_match_lobby('Sneaky Cup', now() + interval '1 day')$$), 'a player cannot make a lobby');
select pg_temp.ok(pg_temp.fails($$insert into public.match_lobbies (name, starts_at) values ('Sneaky Cup', now())$$), 'a player cannot write lobbies directly');

-- Joining.
select pg_temp.ok(public.match_join((select id from mp_lobby limit 1), 'Aspen Bowl') >= 0, 'a signed-in player joins and gets a slice');
select pg_temp.ok(pg_temp.fails(format('select public.match_join(%L, %L)', (select id from mp_lobby limit 1), 'Again')), 'you cannot join the same lobby twice');
select pg_temp.ok(pg_temp.fails(format('insert into public.match_players (lobby_id, slot, user_id, resort_name) values (%L, 3, auth.uid(), %L)', (select id from mp_lobby limit 1), 'X')), 'a player cannot write the player list directly');
reset role;
select pg_temp.as_user(5);
set role authenticated;
select pg_temp.ok(pg_temp.fails(format('select public.match_join(%L, %L)', (select id from mp_lobby limit 1), 'Guest Hill')), 'a guest cannot join');
reset role;
select pg_temp.as_user(null);
set role anon;
select pg_temp.ok((select count(*) from public.match_lobbies where name = 'Test Cup') = 1, 'anyone can see the lobby list');
select pg_temp.ok(pg_temp.fails(format('select public.match_join(%L, %L)', (select id from mp_lobby limit 1), 'Nobody')), 'no account, no joining');
reset role;
do $$ begin
  for k in 2..3 loop perform pg_temp.as_user(k); set local role authenticated; perform public.match_join((select id from mp_lobby limit 1), 'Resort ' || k); reset role; end loop;
end $$;
select pg_temp.ok((select count(distinct slot) from public.match_players where lobby_id = (select id from mp_lobby limit 1)) = 3, 'three players get three different slices');
select pg_temp.as_user(4);
set role authenticated;
select pg_temp.ok(pg_temp.fails(format('select public.match_join(%L, %L)', (select id from mp_lobby limit 1), 'Late')), 'a full lobby turns you away');
reset role;

-- Leaving before the start frees the slice.
select pg_temp.as_user(3);
set role authenticated;
select public.match_leave((select id from mp_lobby limit 1));
reset role;
select pg_temp.ok((select count(*) from public.match_players where lobby_id = (select id from mp_lobby limit 1)) = 2, 'you can leave before the start');

-- Three matches at most: player 1 is in one; two more are fine, a fourth is not.
do $$ declare l uuid; begin
  perform pg_temp.as_user(0); set local role authenticated;
  for k in 1..3 loop l := public.admin_match_lobby('Extra ' || k, now() + interval '1 day', 2, 7); insert into mp_lobby values (l); end loop;
  reset role;
end $$;
select pg_temp.as_user(1);
set role authenticated;
select public.match_join((select id from public.match_lobbies where name = 'Second Cup'), 'Two');
select public.match_join((select id from public.match_lobbies where name = 'Extra 1'), 'Three');
select pg_temp.ok(pg_temp.fails(format('select public.match_join(%L, %L)', (select id from public.match_lobbies where name = 'Extra 2'), 'Four')), 'at most three matches at once');
reset role;

-- Orders: only for your own slice, and only once the match is running. The server (no role switch here)
-- starts the match.
select pg_temp.as_user(1);
set role authenticated;
select pg_temp.ok(pg_temp.fails(format($q$insert into public.match_orders (lobby_id, slot, kind, payload) values (%L, (select slot from public.match_players where lobby_id = %L and user_id = auth.uid()), 'price', '{"ticket": 55}')$q$,
  (select id from mp_lobby limit 1), (select id from mp_lobby limit 1))), 'no orders before the match starts');
reset role;
update public.match_lobbies set status = 'running' where name = 'Test Cup';
set role authenticated;
insert into public.match_orders (lobby_id, slot, kind, payload)
  select lobby_id, slot, 'price', '{"ticket": 55}' from public.match_players where lobby_id = (select id from mp_lobby limit 1) and user_id = auth.uid();
select pg_temp.ok((select count(*) from public.match_orders) = 1, 'you can send an order for your own resort');
select pg_temp.ok(pg_temp.fails(format($q$insert into public.match_orders (lobby_id, slot, kind, payload) values (%L, (select slot from public.match_players where lobby_id = %L and user_id <> auth.uid() limit 1), 'price', '{"ticket": 5}')$q$,
  (select id from mp_lobby limit 1), (select id from mp_lobby limit 1))), 'you cannot send orders for a rival');
reset role;
select pg_temp.as_user(2);
set role authenticated;
select pg_temp.ok((select count(*) from public.match_orders) = 0, 'you cannot read a rival''s orders');
select pg_temp.ok(pg_temp.fails($$insert into public.match_resorts (lobby_id, slot) select lobby_id, slot from public.match_players where user_id = auth.uid() limit 1$$), 'players cannot write resorts (only the server)');
select pg_temp.ok(pg_temp.fails(format('select public.match_leave(%L); select pg_temp.ok((select count(*) from public.match_players where user_id = auth.uid() and lobby_id = %L) = 1, %L)',
  (select id from mp_lobby limit 1), (select id from mp_lobby limit 1), 'x')) is not null, 'leaving a running match is ignored');
reset role;
select pg_temp.ok((select count(*) from public.match_players where lobby_id = (select id from mp_lobby limit 1)) = 2, 'nobody leaves a running match');

-- Phil closes a lobby: it drops out of the list.
select pg_temp.as_user(0);
set role authenticated;
select public.admin_match_close((select id from public.match_lobbies where name = 'Extra 3'));
reset role;
select pg_temp.as_user(1);
set role authenticated;
select pg_temp.ok((select count(*) from public.match_lobbies where name = 'Extra 3') = 0, 'a closed lobby leaves the list');
reset role;
select 'MULTIPLAYER TESTS PASSED: ' || count(*) from mp_results;
