-- Run inside a transaction AFTER supabase/referrals.sql, then ROLLBACK.
-- Synthetic users and resorts only; no existing player is read or altered.
create temp table ref_test_users(n integer primary key,id uuid default gen_random_uuid(),code uuid);
insert into ref_test_users(n) select generate_series(1,9);
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous,created_at,updated_at)
select id,'authenticated','authenticated',id::text||'@referral-test.invalid',
  case when n=5 then null else now() end,n=5,now(),now() from ref_test_users;
update auth.users set created_at=now()-interval '2 days' where id=(select id from ref_test_users where n=7);
create temp table ref_test_results(name text);
create function pg_temp.ref_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'REFERRAL TEST FAILED: %',label; end if;
  insert into ref_test_results values(label);
end; $$;
create function pg_temp.ref_user(n integer) returns uuid language plpgsql as $$
declare uid uuid;
begin
  select id into uid from ref_test_users u where u.n=ref_user.n;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  return uid;
end; $$;

do $$
#variable_conflict use_variable
declare
  code uuid; othercode uuid; inviter uuid; invited uuid; inv uuid; m uuid:=gen_random_uuid(); m2 uuid:=gen_random_uuid();
  outsider uuid:=gen_random_uuid(); result jsonb; i integer; balance numeric;
begin
  inviter:=pg_temp.ref_user(1);
  result:=public.referral_status(); code:=(result->>'code')::uuid;
  perform pg_temp.ref_assert(code is not null and result->>'claimed'='0','verified account receives stable invitation code');
  perform pg_temp.ref_assert(public.referral_status()->>'code'=code::text,'invitation code stays stable');
  perform pg_temp.ref_assert(not (public.referral_accept(code)->>'accepted')::boolean,'self invitation rejected');
  perform pg_temp.ref_user(2); othercode:=(public.referral_status()->>'code')::uuid;
  perform pg_temp.ref_user(7);
  perform pg_temp.ref_assert(public.referral_accept(code)->>'reason'='existing_player','old account rejected');
  perform pg_temp.ref_user(8);
  insert into public.mountains(id,owner,public,save) values(outsider,auth.uid(),false,'{"cash":1000,"clock":{"phase":"closed"}}');
  perform pg_temp.ref_assert(public.referral_accept(code)->>'reason'='existing_player','existing resort player rejected');
  for i in 3..6 loop
    invited:=pg_temp.ref_user(i);
    perform pg_temp.ref_assert((public.referral_accept(code)->>'accepted')::boolean,'new player accepts invitation '||i);
    perform public.referral_accept(othercode);
    perform pg_temp.ref_assert((select r.inviter=inviter from referral_private.invitations r where invitee=invited),'attribution cannot be replaced '||i);
    select id into inv from referral_private.invitations where invitee=invited;
    insert into public.mountains(id,owner,public,save) values(gen_random_uuid(),invited,false,'{"cash":1000,"clock":{"phase":"closed","season":1}}') returning id into m2;
    -- Deliberately forged client UTC dates never become the ledger's real date.
    for j in 1..7 loop
      update public.mountains set save=jsonb_build_object('cash',1000,'clock',jsonb_build_object('phase','report','season',1,'day',j,'lastReport',jsonb_build_object('season',1,'day',j,'guests',40,'real_day','2000-01-01'))) where id=m2;
    end loop;
    perform pg_temp.ref_assert((select count(*)=7 and count(distinct real_day)=1 and min(real_day)=(statement_timestamp() at time zone 'UTC')::date from referral_private.operating_days where invitation=inv),'deduplicated operating days use server UTC '||i);
    update public.mountains set save=save where id=m2;
    perform pg_temp.ref_assert((select count(*)=7 from referral_private.operating_days where invitation=inv),'resaving does not count again '||i);
    perform pg_temp.ref_assert((select qualified_at is null from referral_private.invitations where id=inv),'seven operating days on one real day do not qualify '||i);
    -- Server-only test fixture simulates the previous two real days of play.
    update referral_private.operating_days set real_day=real_day-1 where invitation=inv and game_day in (1,2);
    update referral_private.operating_days set real_day=real_day-2 where invitation=inv and game_day in (3,4);
  end loop;
  perform pg_temp.ref_user(1);
  result:=public.referral_status();
  perform pg_temp.ref_assert(result->>'qualified'='3','qualified friend count capped at three');
  perform pg_temp.ref_assert((result->>'decoration')::boolean,'three qualifying friends persist decoration milestone');
  perform pg_temp.ref_assert((select qualified_at is null from referral_private.invitations where invitee=(select id from ref_test_users where n=5)),'unconfirmed guest does not qualify');
  update auth.users set is_anonymous=false,email_confirmed_at=now() where id=(select id from ref_test_users where n=5);
  perform public.referral_status();
  perform pg_temp.ref_assert((select qualified_at is not null from referral_private.invitations where invitee=(select id from ref_test_users where n=5)),'confirming account qualifies previous recorded play');
  perform pg_temp.ref_assert(not (result::text like '%@referral-test.invalid%') and not (result::text like '%invitee%'),'status omits emails and private invitee identity');
  insert into public.mountains(id,owner,public,save) values(m,inviter,false,'{"cash":1000,"clock":{"phase":"closed","season":1}}');
  select id into inv from referral_private.invitations where invitee=(select id from ref_test_users where n=3);
  result:=public.referral_claim(inv,m);
  perform pg_temp.ref_assert(result->>'credit'='100000','claim returns cumulative credit');
  perform pg_temp.ref_assert((select save->>'cash'='101000' and save->'clock'->>'referralCredit'='100000' from public.mountains where id=m),'claim commits cash and watermark atomically');
  perform public.referral_claim(inv,m);
  perform pg_temp.ref_assert((select save->>'cash'='101000' from public.mountains where id=m),'retry cannot duplicate cash');
  begin
    update public.mountains set save='{"cash":1000,"clock":{"phase":"closed"}}' where id=m;
    raise exception 'stale save unexpectedly allowed';
  exception when serialization_failure then null; end;
  perform pg_temp.ref_assert((select save->>'cash'='101000' from public.mountains where id=m),'stale save cannot erase reward');
  select id into inv from referral_private.invitations where invitee=(select id from ref_test_users where n=4);
  perform public.referral_claim(inv,m);
  m2:=gen_random_uuid();
  insert into public.mountains(id,owner,public,save) values(m2,inviter,false,'{"cash":5000,"clock":{"phase":"closed","season":1}}');
  select id into inv from referral_private.invitations where invitee=(select id from ref_test_users where n=5);
  perform public.referral_claim(inv,m2);
  perform pg_temp.ref_assert(public.referral_balance(m)->>'credit'='200000' and public.referral_balance(m2)->>'credit'='100000','reward delivery is tracked per resort');
  select id into inv from referral_private.invitations where invitee=(select id from ref_test_users where n=6);
  begin
    perform public.referral_claim(inv,m2);
    raise exception 'fourth claim unexpectedly allowed';
  exception when raise_exception then if sqlerrm <> 'referral_cap' then raise; end if; end;
  perform pg_temp.ref_assert((select count(*)=3 from referral_private.rewards where referral_private.rewards.inviter=inviter),'lifetime cap across multiple resorts');
  delete from public.mountains where id=m2;
  perform pg_temp.ref_assert(public.referral_status()->>'claimed'='3','deleting resort cannot reset lifetime cap');
  perform pg_temp.ref_user(2);
  perform pg_temp.ref_assert(public.referral_status()->'friends'='[]'::jsonb,'other account cannot see invitations');
  begin
    perform public.referral_balance(m); raise exception 'foreign mountain unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  perform pg_temp.ref_assert(true,'another account cannot read reward balance');
  perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.referral_status(); raise exception 'unauthenticated call unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  perform pg_temp.ref_assert(true,'missing auth rejected inside privileged API');
  perform pg_temp.ref_assert(not has_function_privilege('anon','public.referral_claim(uuid,uuid)','execute'),'anon cannot call claim wrapper');
  perform pg_temp.ref_assert(not has_table_privilege('authenticated','referral_private.rewards','select,insert,update,delete'),'client cannot read or write reward ledger');
  perform pg_temp.ref_assert(not has_table_privilege('authenticated','referral_private.invitations','select,insert,update,delete'),'client cannot read or write private attribution');
end;
$$;
select pg_temp.ref_user(9);
set local role authenticated;
do $$
begin
  if public.referral_status()->>'code' is null then raise exception 'authenticated RPC wrapper failed'; end if;
  begin
    perform count(*) from referral_private.rewards;
    raise exception 'private ledger unexpectedly readable';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select pg_temp.ref_assert(true,'authenticated wrapper works with private tables inaccessible');
select count(*) as passed,array_agg(name) as checks from ref_test_results;
