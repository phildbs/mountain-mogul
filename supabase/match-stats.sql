-- Owner-only King of the Mountain numbers for the stats page: how many players try it, whether they keep
-- playing, how full matches get, and how each running match is doing. Read-only; run in the Supabase SQL Editor
-- after the other match files. "Active" means a player sent the server a change (built, priced, planned) or
-- wrote in the chat; just watching isn't recorded anywhere.
create or replace function public.admin_match_stats(tz text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  z text := case when exists (select 1 from pg_timezone_names where name = tz) then tz else 'UTC' end;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (
    with seats as (  -- every real player's seat, with when they first joined any match
      select p.lobby_id, p.user_id, p.joined_at, l.status, l.kind,
             min(p.joined_at) over (partition by p.user_id) as first_join
      from match_players p join match_lobbies l on l.id = p.lobby_id
      where p.user_id is not null and l.status <> 'closed'),
    acts as (  -- one row per thing a player did: an order, or a chat message
      select user_id, lobby_id, created_at from match_orders
      union all
      select user_id, lobby_id, created_at from match_messages where kind = 'chat' and user_id is not null),
    per_player as (
      select s.user_id, count(distinct s.lobby_id) as matches,
             (select count(distinct (a.created_at at time zone z)::date) from acts a where a.user_id = s.user_id) as days_active,
             (select count(*) from match_orders o where o.user_id = s.user_id) as orders
      from seats s group by s.user_id),
    lob as (select * from match_lobbies where status <> 'closed'),
    signed as (select count(*) as n from auth.users where not coalesce(is_anonymous, false))
    select jsonb_build_object(
      'generated', now(),
      'signed_in', (select n from signed),
      'players', (select count(*) from per_player),
      'new_7d', (select count(distinct user_id) from seats where first_join > now() - interval '7 days'),
      'active_24h', (select count(distinct user_id) from acts where created_at > now() - interval '24 hours'),
      'active_7d', (select count(distinct user_id) from acts where created_at > now() - interval '7 days'),
      'in_running', (select count(distinct user_id) from seats where status = 'running'),
      'sent_order', (select count(*) from per_player where orders > 0),
      'two_days', (select count(*) from per_player where days_active >= 2),
      'five_days', (select count(*) from per_player where days_active >= 5),
      'two_matches', (select count(*) from per_player where matches >= 2),
      'lobbies', (select jsonb_build_object(
          'open', count(*) filter (where status = 'open'), 'running', count(*) filter (where status = 'running'),
          'finished', count(*) filter (where status = 'finished'),
          'official', count(*) filter (where kind is distinct from 'custom'), 'custom', count(*) filter (where kind = 'custom'),
          'makers', count(distinct created_by) filter (where kind = 'custom'),
          'crown', count(*) filter (where map is distinct from 'ridge'), 'ridge', count(*) filter (where map = 'ridge')) from lob),
      -- Started matches only: how many of their seats real players hold now, out of the seats there are.
      'seats', (select jsonb_build_object('filled', (select count(*) from seats where status in ('running', 'finished')), 'total', coalesce(sum(slots), 0))
                from lob where status in ('running', 'finished')),
      'left', (select count(*) from match_players where coalesce(array_length(left_by, 1), 0) > 0),
      'rescued', (select count(*) from match_players where coalesce(array_length(claimed_by, 1), 0) > 0),
      'chat_7d', (select count(*) from match_messages where kind = 'chat' and created_at > now() - interval '7 days'),
      'chatters_7d', (select count(distinct user_id) from match_messages where kind = 'chat' and user_id is not null and created_at > now() - interval '7 days'),
      'per_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'active', d.active, 'joined', d.joined, 'new', d.new) order by d.day), '[]'::jsonb) from (
          select g.day::date as day,
                 (select count(distinct a.user_id) from acts a where (a.created_at at time zone z)::date = g.day::date) as active,
                 (select count(*) from seats s where (s.joined_at at time zone z)::date = g.day::date) as joined,
                 (select count(distinct s.user_id) from seats s where (s.first_join at time zone z)::date = g.day::date) as new
          from generate_series((now() at time zone z)::date - 13, (now() at time zone z)::date, interval '1 day') g(day)) d),
      'matches', (select coalesce(jsonb_agg(m order by m.status = 'running' desc, m.starts_at desc), '[]'::jsonb) from (
          select l.id, l.name, l.status, l.kind, l.map, l.slots, l.day, l.days, l.day_minutes, l.starts_at,
            (select coalesce(jsonb_agg(jsonb_build_object(
                'slot', p.slot, 'resort', p.resort_name, 'player', pr.name, 'real', p.user_id is not null, 'left', coalesce(p.abandoned, false),
                'joined_day', p.joined_day,
                'orders', (select count(*) from match_orders o where o.lobby_id = l.id and o.user_id = p.user_id),
                'orders_24h', (select count(*) from match_orders o where o.lobby_id = l.id and o.user_id = p.user_id and o.created_at > now() - interval '24 hours'),
                'chats', (select count(*) from match_messages c where c.lobby_id = l.id and c.user_id = p.user_id and c.kind = 'chat'),
                'last_seen', (select max(a.created_at) from acts a where a.lobby_id = l.id and a.user_id = p.user_id),
                'cash', (r.summary ->> 'cash')::numeric, 'profit', (r.summary ->> 'profit')::numeric, 'guests', (r.summary ->> 'guests')::numeric,
                'lifts', (r.summary ->> 'lifts')::int, 'trails', (r.summary ->> 'trails')::int)
              order by p.slot), '[]'::jsonb)
             from match_players p left join profiles pr on pr.id = p.user_id
             left join match_resorts r on r.lobby_id = p.lobby_id and r.slot = p.slot
             where p.lobby_id = l.id) as players
          from lob l where l.status in ('open', 'running') or l.starts_at > now() - interval '14 days') m)
    ));
end;
$$;
revoke all on function public.admin_match_stats(text) from public, anon;
grant execute on function public.admin_match_stats(text) to authenticated;
