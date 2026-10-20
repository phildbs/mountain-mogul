-- Owner-only stats for mtmogul.com/stats.html.
-- Returns visitor and progress counts, but only to the owner's signed-in account; everyone else gets an error.
-- Days are counted in the time zone the page passes in (the viewer's own).
-- Run this once in the Supabase SQL Editor (it is safe to run again).
drop function if exists public.admin_stats();
create or replace function public.admin_stats(tz text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me text := coalesce(auth.jwt() ->> 'email', '');
begin
  if lower(me) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generated', now(),
    'visitors', (select count(*) from auth.users),
    'signed_in', (select count(*) from auth.users where not is_anonymous),
    'new_24h', (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'per_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
                from (select (created_at at time zone tz)::date d, count(*) n from auth.users
                      where created_at > now() - interval '30 days' group by 1) x),
    'started', (select count(distinct owner) from mountains),
    'mountains', (select count(*) from mountains),
    'built_lift', (select count(distinct owner) from mountains where coalesce((summary->>'lifts')::int, 0) > 0),
    'opened', (select count(distinct owner) from mountains where coalesce((summary->>'totalVisitors')::int, 0) > 0),
    'goals3', (select count(distinct owner) from mountains where coalesce((summary->>'stars')::int, 0) >= 3),
    'season2', (select count(distinct owner) from mountains where coalesce((summary->>'season')::int, 1) >= 2),
    'played_24h', (select count(distinct owner) from mountains where updated_at > now() - interval '24 hours'),
    'played_7d', (select count(distinct owner) from mountains where updated_at > now() - interval '7 days'),
    'by_mountain', (select coalesce(jsonb_agg(jsonb_build_object('mt', mt, 'n', n) order by n desc), '[]'::jsonb)
                    from (select coalesce(summary->>'mt', '') mt, count(*) n from mountains group by 1) x),
    'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select summary->>'name' as name, summary->>'mt' as mt, summary->>'when' as "when",
                     coalesce((summary->>'lifts')::int, 0) as lifts, coalesce((summary->>'trails')::int, 0) as trails,
                     coalesce((summary->>'bestGuests')::int, 0) as best_guests, coalesce((summary->>'cash')::bigint, 0) as cash,
                     coalesce((summary->>'stars')::int, 0) as stars, updated_at
              from mountains order by coalesce((summary->>'bestGuests')::int, 0) desc, updated_at desc limit 10) t),
    'feedback_count', (select count(*) from feedback),
    'feedback', (select coalesce(jsonb_agg(f), '[]'::jsonb) from (
                   select created_at, message from feedback order by created_at desc limit 10) f)
  );
end;
$$;
revoke all on function public.admin_stats(text) from public, anon;
grant execute on function public.admin_stats(text) to authenticated;
