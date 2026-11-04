-- Checks supabase/match-abandon.sql on a throwaway database (after the other match files and match-abandon).
create temp table ma_users(n integer primary key, id uuid default gen_random_uuid(), email text);
insert into ma_users(n, email) values (1, 'a@ma.invalid'), (2, 'b@ma.invalid'), (3, 'c@ma.invalid'), (4, 'd@ma.invalid');
insert into auth.users(id, email, is_anonymous) select id, email, false from ma_users;
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from ma_users;
create temp table ma_results(name text);
grant all on ma_users, ma_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ABANDON TEST FAILED: %', label; end if; insert into ma_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from ma_users where n = k), false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', (select id from ma_users where n = k), 'email', (select email from ma_users where n = k), 'is_anonymous', false)::text, false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
-- A running match on day 10 of 168: players 1 and 2, and an old computer resort on slot 2. A locked one for later.
insert into public.match_lobbies (name, slots, starts_at, days, day_minutes, status, day, kind) values
  ('Leave Cup', 3, now() - interval '5 hours', 168, 30, 'running', 10, 'custom'),
  ('Locked Cup', 3, now() - interval '5 hours', 168, 30, 'running', 10, 'custom'),
  ('Open Cup', 3, now() + interval '1 hour', 168, 30, 'open', 0, 'custom');
insert into public.match_lobby_keys (lobby_id, salt, hash) select id, 'pepper', public.match_key_hash('pepper', 'snow1') from public.match_lobbies where name = 'Locked Cup';
insert into public.match_players (lobby_id, slot, user_id, resort_name)
  select id, 0, (select id from ma_users where n = 1), 'First Hill' from public.match_lobbies where name = 'Leave Cup' union all
  select id, 1, (select id from ma_users where n = 2), 'Second Hill' from public.match_lobbies where name = 'Leave Cup' union all
  select id, 2, null, 'Valley View' from public.match_lobbies where name = 'Leave Cup' union all
  select id, 0, (select id from ma_users where n = 3), 'Locked Hill' from public.match_lobbies where name = 'Locked Cup' union all
  select id, 0, (select id from ma_users where n = 4), 'Waiting Hill' from public.match_lobbies where name = 'Open Cup';
create temp view ma_p as select p.* from public.match_players p join public.match_lobbies l on l.id = p.lobby_id where l.name = 'Leave Cup';
grant select on ma_p to authenticated;
set role authenticated;

-- Leaving.
select pg_temp.as_user(4);
select pg_temp.ok(pg_temp.err($$select public.match_abandon((select id from public.match_lobbies where name = 'Open Cup'))$$) = 'this match isn''t running', 'a lobby that hasn''t started is left with match_leave, not abandoned');
select pg_temp.ok(pg_temp.err($$select public.match_abandon((select id from public.match_lobbies where name = 'Leave Cup'))$$) = 'you''re not in this match', 'only a player can leave');
select pg_temp.as_user(1);
select pg_temp.ok(public.match_abandon((select id from public.match_lobbies where name = 'Leave Cup')) = 0, 'a player leaves a running match');
select pg_temp.ok((select user_id is null and abandoned and left_by = array[(select id from ma_users where n = 1)] and resort_name = 'First Hill' from ma_p where slot = 0), 'their resort stays, abandoned, remembering who left it');
select pg_temp.ok(pg_temp.err($$select public.match_abandon((select id from public.match_lobbies where name = 'Leave Cup'))$$) = 'you''re not in this match', 'leaving twice says so');
-- Late joining doesn't hand it out as a computer resort.
select pg_temp.as_user(4);
select pg_temp.ok(public.match_join_late((select id from public.match_lobbies where name = 'Leave Cup'), 'Late Hill') = 2, 'a late joiner takes the computer resort, not the abandoned one');
select pg_temp.ok((select abandoned and user_id is null from ma_p where slot = 0), 'which is still free to claim');

-- Claiming.
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 0, 'Back Again')$$) = 'you left this match, so you can''t claim a resort in it', 'you can''t claim back the resort you left');
select pg_temp.as_user(2);
select pg_temp.ok(pg_temp.err($$select public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 0, 'Two Hills')$$) = 'already in this match', 'a player already in the match can''t claim a second resort');
select pg_temp.ok(pg_temp.err($$select public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 1, 'Mine')$$) like 'already in this match', 'nor their own');
select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err($$select public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 2, 'Taken')$$) = 'that resort isn''t free to claim any more', 'a resort someone plays can''t be claimed');
select pg_temp.ok(public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 0, 'Rescue Ridge') = 0, 'another player claims it');
select pg_temp.ok((select user_id = (select id from ma_users where n = 3) and resort_name = 'Rescue Ridge' and joined_day = 10 and not abandoned and rescue_due and rescued and claimed_by = array[(select id from ma_users where n = 3)] from ma_p where slot = 0), 'under their own name, from today, with a fresh start due tonight');
select pg_temp.as_user(4);
select pg_temp.ok(pg_temp.err($$select public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 0, 'Too Slow')$$) = 'already in this match', 'nobody else can claim it now');
-- Left again: claimable again, but the fresh start only comes once.
select pg_temp.as_user(3);
select public.match_abandon((select id from public.match_lobbies where name = 'Leave Cup'));
select pg_temp.ok((select abandoned and not rescue_due and left_by @> array[(select id from ma_users where n = 3)] from ma_p where slot = 0), 'left again before its fresh start: that one is used up');
reset role;
update public.match_players set user_id = null, abandoned = true where resort_name = 'Late Hill';
set role authenticated;
select pg_temp.as_user(4);
select pg_temp.ok(public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 0, 'Third Owner') = 0, 'a third player claims it');
select pg_temp.ok((select not rescue_due and rescued from ma_p where slot = 0), 'without a second fresh start');
-- Player 3 left this match after claiming: another resort left in it can't be theirs.
reset role;
update public.match_players set user_id = null, abandoned = true where resort_name = 'Second Hill';
set role authenticated;
select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err($$select public.match_claim((select id from public.match_lobbies where name = 'Leave Cup'), 1, 'Another One')$$) = 'you left this match, so you can''t claim a resort in it', 'after leaving a match you can''t claim a neighbour''s resort in it');
select pg_temp.ok((select rescued = 1 and abandoned = 1 from public.match_record_more((select id from ma_users where n = 3))), 'profiles: player 3 rescued one resort and left one match');
select pg_temp.ok((select rescued = 0 and abandoned = 1 from public.match_record_more((select id from ma_users where n = 1))), 'player 1 left one');
select pg_temp.ok((select rescued = 1 and abandoned = 0 from public.match_record_more((select id from ma_users where n = 4))), 'player 4 rescued one');
reset role;
select pg_temp.ok((select rescued = 1 from public.match_record_more((select id from ma_users where n = 4))), 'anyone can read it, as for match_record');
set role authenticated;
-- The password, and the cut-off at three-quarters of the season.
reset role;
update public.match_players set user_id = null, abandoned = true where resort_name = 'Locked Hill';
set role authenticated;
select pg_temp.as_user(2);
select pg_temp.ok(pg_temp.err($$select public.match_claim((select id from public.match_lobbies where name = 'Locked Cup'), 0, 'No Key')$$) = 'that password isn''t right', 'a locked match needs its password');
select pg_temp.ok(pg_temp.err($$select public.match_claim_key((select id from public.match_lobbies where name = 'Locked Cup'), 0, 'Wrong Key', 'rain')$$) = 'that password isn''t right', 'the right one');
reset role;
update public.match_lobbies set day = 127 where name = 'Locked Cup';
set role authenticated;
select pg_temp.ok(pg_temp.err($$select public.match_claim_key((select id from public.match_lobbies where name = 'Locked Cup'), 0, 'Late Key', 'snow1')$$) = 'it''s too late to claim a resort in this match', 'no claims after three-quarters of the season (day 126 of 168)');
reset role;
update public.match_lobbies set day = 126 where name = 'Locked Cup';
set role authenticated;
select pg_temp.ok(public.match_claim_key((select id from public.match_lobbies where name = 'Locked Cup'), 0, 'Just In Time', ' snow1 ') = 0, 'on day 126 it''s still in time, with the password');
select pg_temp.ok(pg_temp.err($$insert into public.match_players (lobby_id, slot, user_id, resort_name) values ((select id from public.match_lobbies where name = 'Leave Cup'), 3, auth.uid(), 'Sneaky')$$) is not null, 'players can''t write the table directly');
reset role;
select 'ABANDON TESTS PASSED: ' || count(*) from ma_results;
