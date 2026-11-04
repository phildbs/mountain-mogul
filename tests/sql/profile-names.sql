-- Checks supabase/profile-names.sql on a throwaway database (after schema.sql, profiles.sql and profile-names.sql).
create temp table pn_users(n integer primary key, id uuid default gen_random_uuid(), email text);
insert into pn_users(n, email) values (1, 'a@pn.invalid'), (2, 'b@pn.invalid');
insert into auth.users(id, email, is_anonymous) select id, email, false from pn_users;
create temp table pn_results(name text);
grant all on pn_users, pn_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'NAMES TEST FAILED: %', label; end if; insert into pn_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from pn_users where n = k), false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', (select id from pn_users where n = k), 'email', (select email from pn_users where n = k), 'is_anonymous', false)::text, false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
set role authenticated;
select pg_temp.as_user(1);
select pg_temp.ok((public.set_profile('Moss Quake', true) ->> 'name') = 'Moss Quake', 'a player picks a name');
select pg_temp.ok((public.set_profile('moss quake', true) ->> 'name') = 'moss quake', 'and can change its capitals');
select pg_temp.as_user(2);
select pg_temp.ok(pg_temp.err($$select public.set_profile('Moss Quake', true)$$) = 'name_taken', 'another player can''t take it');
select pg_temp.ok(pg_temp.err($$select public.set_profile('  MOSS   quake ', false)$$) = 'name_taken', 'whatever the capitals and spaces');
select pg_temp.ok((public.set_profile('Moss Quake 2', true) ->> 'name') = 'Moss Quake 2', 'a different name is fine');
reset role;
select pg_temp.ok(pg_temp.err($$insert into public.profiles (id, name) values ((select id from pn_users where n = 2), 'MOSS QUAKE') on conflict (id) do update set name = excluded.name$$) is not null, 'the database itself refuses a repeat');
select 'NAMES TESTS PASSED: ' || count(*) from pn_results;
