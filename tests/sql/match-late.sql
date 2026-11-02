-- Checks supabase/match-late.sql on a throwaway database (after multiplayer.sql, match-chat.sql, match-late.sql).
create temp table ml_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean default false);
insert into ml_users(n, email, anon) values (0, 'phildbs@gmail.com', false), (1, 'a@ml.invalid', false), (2, 'b@ml.invalid', false), (3, 'c@ml.invalid', false), (5, 'g@ml.invalid', true);
insert into auth.users(id, email, is_anonymous) select id, email, anon from ml_users;
insert into public.profiles(id, name, public) select id, 'Player ' || n, true from ml_users where not anon;
create temp table ml_results(name text);
grant all on ml_users, ml_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'LATE TEST FAILED: %', label; end if; insert into ml_results values (label); end; $$;
create function pg_temp.as_user(n integer) returns void language plpgsql as $$
declare uid uuid; em text; an boolean;
begin select id, email, anon into uid, em, an from ml_users u where u.n = as_user.n;
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claims', case when uid is null then '' else jsonb_build_object('sub', uid, 'email', em, 'is_anonymous', an)::text end, false); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.uid(n integer) returns uuid language sql as $$ select id from ml_users where ml_users.n = uid.n $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- A running match on day 10 of 168 with one player and two computer resorts; a dormant one with one player.
insert into public.match_lobbies (id, name, starts_at, status, day, days) values ('00000000-0000-0000-0000-0000000000b1', 'Late Cup', now() - interval '5 hours', 'running', 10, 168),
  ('00000000-0000-0000-0000-0000000000b2', 'Quiet Cup', now() - interval '5 hours', 'running', 10, 168), ('00000000-0000-0000-0000-0000000000b3', 'Old Cup', now() - interval '5 days', 'running', 60, 168);
insert into public.match_players (lobby_id, slot, user_id, resort_name) values ('00000000-0000-0000-0000-0000000000b1', 0, pg_temp.uid(1), 'First Hill'),
  ('00000000-0000-0000-0000-0000000000b1', 1, null, 'Valley View'), ('00000000-0000-0000-0000-0000000000b1', 2, null, 'Summit Ridge'),
  ('00000000-0000-0000-0000-0000000000b2', 0, pg_temp.uid(1), 'First Hill');
select pg_temp.ok((select computers and keep_profit and late_days is null and late_bonus = 15000 and late_bonus_cap = 1000000 from public.match_lobbies where name = 'Late Cup'), 'lobbies default to computers, keeping profit, a 15,000 a day bonus up to a million');

set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok(pg_temp.err($$select public.admin_match_settings('00000000-0000-0000-0000-0000000000b2', false)$$) = 'not allowed', 'only Phil changes the settings');
select pg_temp.as_user(0);
select public.admin_match_settings('00000000-0000-0000-0000-0000000000b2', false, false);
select pg_temp.ok((select not computers and not keep_profit and late_bonus = 15000 from public.match_lobbies where name = 'Quiet Cup'), 'Phil turns computers and kept profit off, the rest stays');
select pg_temp.as_user(2);
select pg_temp.ok(public.match_join_late('00000000-0000-0000-0000-0000000000b1', 'Powder Palace') in (1, 2), 'a late joiner takes over a computer resort');
select pg_temp.ok(pg_temp.err($$select public.match_join_late('00000000-0000-0000-0000-0000000000b1', 'Again')$$) = 'already in this match', 'only once');
select pg_temp.ok(public.match_join_late('00000000-0000-0000-0000-0000000000b2', 'Quiet Bowl') in (1, 2), 'in a match without computers, an empty slice');
select pg_temp.ok(pg_temp.err($$select public.match_join_late('00000000-0000-0000-0000-0000000000b3', 'Too Late')$$) = 'it''s too late to join this match', 'not after the first quarter');
select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err($$select public.match_join_late('00000000-0000-0000-0000-0000000000b1', 'Shit Hill')$$) = 'please pick a friendlier resort name', 'friendly names only');
select pg_temp.ok(public.match_join_late('00000000-0000-0000-0000-0000000000b1', 'Third Peak') in (1, 2), 'the other computer resort');
select pg_temp.ok(pg_temp.err($$select public.match_join_late('00000000-0000-0000-0000-0000000000b1', 'Fourth')$$) is not null, 'then it''s full');
select pg_temp.as_user(5);
select pg_temp.ok(pg_temp.err($$select public.match_join_late('00000000-0000-0000-0000-0000000000b2', 'Guest Hill')$$) = 'sign in to play multiplayer', 'guests can''t join');
reset role;
select pg_temp.ok((select string_agg(slot || ':' || coalesce(resort_name, '') || ':' || joined_day || ':' || (user_id is not null), ',' order by slot) from public.match_players where lobby_id = '00000000-0000-0000-0000-0000000000b1') ~ '^0:First Hill:0:true,1:(Powder Palace|Third Peak):10:true,2:(Powder Palace|Third Peak):10:true$', 'takeovers are recorded with their name and day');
select pg_temp.ok((select count(*) from public.match_players where lobby_id = '00000000-0000-0000-0000-0000000000b2' and joined_day = 10) = 1, 'and so is a new slice');
select 'LATE TESTS PASSED: ' || count(*) from ml_results;
