-- The new-player funnel for the stats page: of the resorts started each week, how many built a lift,
-- a trail, opened for a day and reached season 2. Owner only.
--
-- Resorts didn't record when they were started, so existing ones take their owner's sign-up date
-- (exact for a player's first resort, early for a second or third). New ones record it as they're made.
alter table public.mountains add column if not exists created_at timestamptz;
update public.mountains m set created_at = coalesce((select u.created_at from auth.users u where u.id = m.owner), m.updated_at)
  where m.created_at is null;
alter table public.mountains alter column created_at set default now();

-- unit: 'week' (default) or 'day', for watching a change land.
drop function if exists public.admin_funnel(text);
create or replace function public.admin_funnel(tz text default 'UTC', unit text default 'week')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if unit not in ('day', 'week') then unit := 'week'; end if;
  return (select coalesce(jsonb_agg(w order by w.since desc), '[]'::jsonb) from (
    select
      date_trunc(unit, m.created_at at time zone tz)::date as since,
      count(*) as started,
      count(*) filter (where coalesce((m.summary ->> 'lifts')::int, 0) > 0) as lift,
      count(*) filter (where coalesce((m.summary ->> 'trails')::int, 0) > 0) as trail,
      count(*) filter (where coalesce((m.summary ->> 'bestGuests')::int, 0) > 0) as opened,
      count(*) filter (where coalesce((m.summary ->> 'season')::int, 1) >= 2) as season2
    from mountains m
    group by 1
  ) w);
end;
$$;
revoke all on function public.admin_funnel(text, text) from public, anon;
grant execute on function public.admin_funnel(text, text) to authenticated;
