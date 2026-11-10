-- Looking after shared mountains (Phil, Nov 10), before the editor's release. Run after shared-mountains.sql and
-- match-chat.sql (it uses match_clean, chat's word filter). Additive only: share_mountain is replaced with the same
-- arguments and results plus one check; a new reports table; new owner-only functions for stats.html. Safe to run twice.

-- 1. Names: a mountain whose name the chat filter would block can't be shared.
create or replace function public.share_mountain(pid text, pdoc jsonb, pvertical integer, pallow boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n text;
  mine public.shared_mountains;
begin
  if uid is null or not public.is_profile_user(uid) then raise exception 'sign_in_needed' using errcode = '42501'; end if;
  select btrim(name) into n from profiles where id = uid;
  if coalesce(n, '') = '' then raise exception 'name_needed' using errcode = '22023'; end if;
  if pid !~ '^c:m[0-9a-z]{14}$' or jsonb_typeof(pdoc) <> 'object' or pdoc ->> 'v' <> '1' or coalesce(pdoc ->> 'h', '') = ''
    or char_length(btrim(coalesce(pdoc ->> 'name', ''))) not between 1 and 28 or octet_length(pdoc::text) >= 400000 then
    raise exception 'bad_mountain' using errcode = '22023';
  end if;
  if not public.match_clean(pdoc ->> 'name') then raise exception 'name_not_allowed' using errcode = '22023'; end if;
  select * into mine from shared_mountains where id = pid;
  if found then
    if mine.owner <> uid then raise exception 'shared_by_another' using errcode = '42501'; end if;
    update shared_mountains set allow_copy = coalesce(pallow, true) where id = pid;
  else
    if (select count(*) from shared_mountains where owner = uid) >= 30 then raise exception 'share_limit' using errcode = 'P0001'; end if;
    insert into shared_mountains (id, owner, creator, name, doc, vertical, allow_copy)
    values (pid, uid, left(n, 24), btrim(pdoc ->> 'name'), pdoc, greatest(0, least(20000, coalesce(pvertical, 0))), coalesce(pallow, true));
  end if;
  return jsonb_build_object('id', pid, 'creator', left(n, 24), 'allow_copy', coalesce(pallow, true));
end;
$$;
revoke all on function public.share_mountain(text, jsonb, integer, boolean) from public, anon;
grant execute on function public.share_mountain(text, jsonb, integer, boolean) to authenticated;

-- 2. Reports: a signed-in player reports another player's shared mountain once, with an optional reason.
create table if not exists public.shared_mountain_reports (
  mountain_id text not null references public.shared_mountains (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (mountain_id, user_id)
);
alter table public.shared_mountain_reports enable row level security;
drop policy if exists "own reports" on public.shared_mountain_reports;
create policy "own reports" on public.shared_mountain_reports for select using (user_id = auth.uid());
drop policy if exists "report others' mountains" on public.shared_mountain_reports;
create policy "report others' mountains" on public.shared_mountain_reports for insert with check (user_id = auth.uid() and public.is_profile_user(auth.uid())
  and not exists (select 1 from public.shared_mountains m where m.id = mountain_id and m.owner = auth.uid()));
grant select, insert on public.shared_mountain_reports to authenticated;

-- 3. The owner's page: totals, and every shared mountain with its numbers and reports (reported first).
create or replace function public.admin_shared_mountains()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'admin_shared_mountains: not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'shared', (select count(*) from shared_mountains),
      'makers', (select count(distinct owner) from shared_mountains),
      'shared_7d', (select count(*) from shared_mountains where created_at > now() - interval '7 days'),
      'likes', (select count(*) from shared_mountain_likes),
      'ratings', (select count(*) from shared_mountain_ratings),
      'stars', (select round(avg(stars), 1) from shared_mountain_ratings),
      'hand_resorts', (select count(*) from mountains where summary ->> 'mt' like 'c:m%'),
      'hand_resorts_built', (select count(*) from mountains where summary ->> 'mt' like 'c:m%' and coalesce((summary ->> 'lifts')::int, 0) > 0),
      'shared_resorts', (select count(*) from mountains x join shared_mountains m on m.id = x.summary ->> 'mt'),
      'reports', (select count(*) from shared_mountain_reports)),
    'mountains', coalesce((select jsonb_agg(row_to_json(t) order by t.reports desc, t.created_at desc) from (
      select m.id, m.name, m.creator, m.owner, m.created_at, m.vertical, m.allow_copy,
        (select count(*) from shared_mountain_likes l where l.mountain_id = m.id) likes,
        (select count(*) from shared_mountain_ratings r where r.mountain_id = m.id) ratings,
        (select round(avg(stars), 1) from shared_mountain_ratings r where r.mountain_id = m.id) rating,
        (select count(*) from mountains x where x.summary ->> 'mt' = m.id) resorts,
        (select count(*) from shared_mountain_reports p where p.mountain_id = m.id) reports,
        (select jsonb_agg(p.reason order by p.created_at desc) from shared_mountain_reports p where p.mountain_id = m.id and coalesce(p.reason, '') <> '') reasons
      from shared_mountains m) t), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_shared_mountains() from public, anon;
grant execute on function public.admin_shared_mountains() to authenticated;

-- Removes a shared mountain (its link stops working; its likes, ratings and reports go with it; resorts on it still play).
create or replace function public.admin_shared_remove(pid text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'admin_shared_remove: not allowed' using errcode = '42501';
  end if;
  delete from shared_mountains where id = pid;
  return found;
end;
$$;
revoke all on function public.admin_shared_remove(text) from public, anon;
grant execute on function public.admin_shared_remove(text) to authenticated;
