-- Install before publishing the referral client. Additive; safe to run again.
-- No private invitation/account/day/reward table is exposed through the Data API.
-- Operating days are client game reports, deduplicated and dated by the server.
-- This is not a server-authoritative simulation or proof of distinct human beings.
begin;
create schema if not exists referral_private;
revoke all on schema referral_private from public, anon, authenticated;
grant usage on schema referral_private to authenticated;

create table if not exists referral_private.accounts (
  owner uuid primary key references auth.users(id) on delete cascade,
  code uuid not null unique default gen_random_uuid(),
  decoration_earned boolean not null default false
);
create table if not exists referral_private.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter uuid not null references auth.users(id) on delete cascade,
  invitee uuid unique references auth.users(id) on delete set null,
  accepted_at timestamptz not null default statement_timestamp(),
  mountain uuid, -- first real resort after accepting; deletion cannot reset progress
  qualified_at timestamptz,
  constraint no_self_invitation check(inviter <> invitee)
);
create index if not exists invitations_inviter on referral_private.invitations(inviter, accepted_at, id);
create table if not exists referral_private.operating_days (
  invitation uuid not null references referral_private.invitations(id) on delete cascade,
  season integer not null check(season > 0),
  game_day integer not null check(game_day between -16 and 365),
  real_day date not null default (statement_timestamp() at time zone 'UTC')::date,
  primary key(invitation, season, game_day)
);
create table if not exists referral_private.rewards (
  inviter uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null check(ordinal between 1 and 3),
  invitation uuid not null unique references referral_private.invitations(id),
  mountain uuid not null, -- intentionally survives resort deletion
  paid_at timestamptz not null default statement_timestamp(),
  primary key(inviter, ordinal)
);
create index if not exists rewards_mountain on referral_private.rewards(mountain, inviter);
alter table referral_private.accounts enable row level security;
alter table referral_private.invitations enable row level security;
alter table referral_private.operating_days enable row level security;
alter table referral_private.rewards enable row level security;
revoke all on all tables in schema referral_private from public, anon, authenticated;

create or replace function referral_private.verified(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false)
    and (email_confirmed_at is not null or phone_confirmed_at is not null));
$$;
revoke all on function referral_private.verified(uuid) from public, anon, authenticated;

-- Prevent an old device, old client or undo snapshot from erasing a credited payout.
-- A client reconciles the immutable balance into its local save before retrying.
create or replace function referral_private.guard_balance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
  if auth.uid() is distinct from new.owner then return new; end if;
  select count(*)::integer * 100000 into total from referral_private.rewards
    where inviter=new.owner and mountain=new.id;
  if coalesce(new.save->'clock'->>'referralCredit','0') <> total::text then
    raise exception 'referral_save_conflict' using errcode='40001';
  end if;
  return new;
end;
$$;
revoke all on function referral_private.guard_balance() from public, anon, authenticated;
drop trigger if exists referral_balance_guard on public.mountains;
create trigger referral_balance_guard before insert or update of save on public.mountains
for each row execute function referral_private.guard_balance();

create or replace function referral_private.record_day()
returns trigger language plpgsql security definer set search_path = '' as $$
declare inv referral_private.invitations; r jsonb; s integer; d integer;
begin
  if auth.uid() is distinct from new.owner or new.save is null
    or coalesce(new.save->'clock'->>'sandbox','false') <> 'false'
    or coalesce(new.save->'clock'->>'devRun','false') <> 'false' then return new; end if;
  select * into inv from referral_private.invitations where invitee=new.owner for update;
  if not found or inv.qualified_at is not null then return new; end if;
  -- A restored/imported old resort cannot become the invited player's new resort.
  if inv.mountain is null then
    if tg_op <> 'INSERT' then return new; end if;
    update referral_private.invitations set mountain=new.id where id=inv.id;
    inv.mountain := new.id;
  end if;
  if inv.mountain <> new.id then return new; end if;
  r := new.save->'clock'->'lastReport';
  if coalesce(r->>'season','') !~ '^[0-9]{1,6}$' or coalesce(r->>'day','') !~ '^-?[0-9]{1,3}$'
    or coalesce(r->>'guests','') !~ '^[0-9]{1,9}$' then return new; end if;
  s := (r->>'season')::integer; d := (r->>'day')::integer;
  if s < 1 or d < -16 or d > 365 or (r->>'guests')::integer < 1
    or new.save->'clock'->>'season' is distinct from s::text
    or coalesce(new.save->'clock'->>'phase','') not in ('report','closed','season') then return new; end if;
  insert into referral_private.operating_days(invitation,season,game_day) values(inv.id,s,d)
    on conflict do nothing;
  if referral_private.verified(new.owner) and
    (select count(*) >= 7 and count(distinct real_day) >= 3 from referral_private.operating_days where invitation=inv.id) then
    update referral_private.invitations set qualified_at=statement_timestamp() where id=inv.id;
  end if;
  return new;
end;
$$;
revoke all on function referral_private.record_day() from public, anon, authenticated;
drop trigger if exists referral_record_day on public.mountains;
create trigger referral_record_day after insert or update of save on public.mountains
for each row execute function referral_private.record_day();

-- All privileged operations are here; public RPCs below are invoker-only wrappers.
create or replace function referral_private.api(action text, token uuid default null, mid uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); a referral_private.accounts; inv referral_private.invitations;
  reward referral_private.rewards; m public.mountains; total integer; paid integer;
  friends jsonb; signed boolean; created timestamptz; balance integer;
begin
  if uid is null then raise exception 'sign_in_needed' using errcode='42501'; end if;
  signed := referral_private.verified(uid);
  if action='accept' then
    -- Lock the invitee's user row: concurrent links and first acceptance cannot win twice.
    select created_at into created from auth.users where id=uid for update;
    if exists(select 1 from referral_private.invitations where invitee=uid) then
      return jsonb_build_object('accepted',true);
    end if;
    select * into a from referral_private.accounts where code=token;
    if not found or a.owner=uid or not referral_private.verified(a.owner) then
      return jsonb_build_object('accepted',false,'reason','invalid');
    end if;
    if created < statement_timestamp()-interval '24 hours'
      or exists(select 1 from public.mountains where owner=uid) then
      return jsonb_build_object('accepted',false,'reason','existing_player');
    end if;
    insert into referral_private.invitations(inviter,invitee) values(a.owner,uid);
    return jsonb_build_object('accepted',true);
  end if;
  if action='balance' then
    if exists(select 1 from public.mountains where id=mid and owner<>uid) then
      raise exception 'not_your_mountain' using errcode='42501';
    end if;
    select count(*)::integer*100000 into balance from referral_private.rewards where inviter=uid and mountain=mid;
    return jsonb_build_object('mountain',mid,'credit',balance);
  end if;
  if action not in ('status','claim') then raise exception 'invalid_action'; end if;
  if not signed then
    if action='claim' then raise exception 'sign_in_needed' using errcode='42501'; end if;
    return jsonb_build_object('available',true,'signed_in',false,'friends','[]'::jsonb,'claimed',0,'qualified',0,'decoration',false);
  end if;
  insert into referral_private.accounts(owner) values(uid) on conflict do nothing;
  -- One account lock serializes all reward claims, including claims to different resorts.
  select * into a from referral_private.accounts where owner=uid for update;
  -- An invitee may have confirmed their account since their last completed day.
  update referral_private.invitations i set qualified_at=statement_timestamp()
    where i.inviter=uid and i.qualified_at is null and referral_private.verified(i.invitee)
    and (select count(*)>=7 and count(distinct real_day)>=3 from referral_private.operating_days d where d.invitation=i.id);
  select least(count(*)::integer,3) into total from referral_private.invitations where inviter=uid and qualified_at is not null;
  if total>=3 and not a.decoration_earned then
    update referral_private.accounts set decoration_earned=true where owner=uid;
    a.decoration_earned := true;
  end if;
  select count(*)::integer into paid from referral_private.rewards where inviter=uid;
  if action='claim' then
    select * into reward from referral_private.rewards where invitation=token and inviter=uid;
    if found then
      select count(*)::integer*100000 into balance from referral_private.rewards where inviter=uid and mountain=reward.mountain;
      return jsonb_build_object('mountain',reward.mountain,'credit',balance,'paid',true);
    end if;
    if paid>=3 then raise exception 'referral_cap'; end if;
    select * into inv from referral_private.invitations where id=token and inviter=uid and qualified_at is not null;
    if not found then raise exception 'friend_not_qualified'; end if;
    select * into m from public.mountains where id=mid and owner=uid for update;
    if not found then raise exception 'save_mountain_first'; end if;
    if m.save is null or coalesce(m.save->'clock'->>'phase','') not in ('closed','report','season')
      or coalesce(m.save->'clock'->>'sandbox','false') <> 'false'
      or coalesce(m.save->'clock'->>'devRun','false') <> 'false'
      or coalesce(m.save->'clock'->>'bankrupt','false') <> 'false' then raise exception 'choose_playable_mountain'; end if;
    insert into referral_private.rewards(inviter,ordinal,invitation,mountain) values(uid,paid+1,inv.id,mid);
    select count(*)::integer*100000 into balance from referral_private.rewards where inviter=uid and mountain=mid;
    m.save := jsonb_set(m.save,'{cash}',to_jsonb((m.save->>'cash')::numeric+100000));
    m.save := jsonb_set(m.save,'{clock,referralCredit}',to_jsonb(balance));
    update public.mountains set save=m.save, summary=jsonb_set(m.summary,'{cash}',to_jsonb(round((m.save->>'cash')::numeric))), updated_at=statement_timestamp() where id=mid;
    return jsonb_build_object('mountain',mid,'credit',balance,'paid',true);
  end if;
  select coalesce(jsonb_agg(x.doc order by x.accepted_at,x.id),'[]'::jsonb) into friends from (
    select i.id,i.accepted_at,jsonb_build_object('id',i.id,'days',least(count(d.*),7),
      'real_days',least(count(distinct d.real_day),3),'qualified',i.qualified_at is not null,
      'claimed',exists(select 1 from referral_private.rewards r where r.invitation=i.id)) as doc
    from (select * from referral_private.invitations where inviter=uid order by qualified_at desc nulls last,accepted_at,id limit 50) i
    left join referral_private.operating_days d on d.invitation=i.id group by i.id,i.accepted_at,i.qualified_at
  ) x;
  return jsonb_build_object('available',true,'signed_in',true,'code',a.code,'friends',friends,
    'qualified',total,'claimed',paid,'decoration',a.decoration_earned);
end;
$$;
revoke all on function referral_private.api(text,uuid,uuid) from public, anon, authenticated;
grant execute on function referral_private.api(text,uuid,uuid) to authenticated;
create or replace function public.referral_status() returns jsonb language sql security invoker set search_path='' as $$
  select referral_private.api('status');
$$;
create or replace function public.referral_accept(invite_code uuid) returns jsonb language sql security invoker set search_path='' as $$
  select referral_private.api('accept',invite_code);
$$;
create or replace function public.referral_balance(mountain_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select referral_private.api('balance',null,mountain_id);
$$;
create or replace function public.referral_claim(invitation_id uuid,mountain_id uuid) returns jsonb language sql security invoker set search_path='' as $$
  select referral_private.api('claim',invitation_id,mountain_id);
$$;
revoke all on function public.referral_status(), public.referral_accept(uuid), public.referral_balance(uuid), public.referral_claim(uuid,uuid) from public, anon;
grant execute on function public.referral_status(), public.referral_accept(uuid), public.referral_balance(uuid), public.referral_claim(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
