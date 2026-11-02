-- Where new players come from, for the stats page. The game sends it once, on a player's first visit:
-- a tag on the link (?src= or utm_source), the site that linked them (host name only), and whether it
-- was a friend invitation. Players can add their own row but never read any. Safe to run again.
begin;
create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
create table if not exists analytics_private.player_sources (
  player uuid primary key references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  src text not null default '' check (char_length(src) <= 40),
  campaign text not null default '' check (char_length(campaign) <= 60),
  host text not null default '' check (char_length(host) <= 80),
  invite boolean not null default false,
  app boolean not null default false
);
alter table analytics_private.player_sources enable row level security;

-- Only a new account counts: one more than two days old was already playing before it arrived here.
create or replace function public.record_source(src text, campaign text, host text, invite boolean, app boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from auth.users u where u.id = auth.uid() and u.created_at > now() - interval '2 days') then return false; end if;
  insert into analytics_private.player_sources (player, src, campaign, host, invite, app)
  values (auth.uid(), left(lower(coalesce(src, '')), 40), left(coalesce(campaign, ''), 60), left(lower(coalesce(host, '')), 80),
          coalesce(invite, false), coalesce(app, false))
  on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.record_source(text, text, text, boolean, boolean) from public, anon;
grant execute on function public.record_source(text, text, text, boolean, boolean) to authenticated;

-- Owner-only: players per source and how far they got. returned: came back on a later day, out of old_enough
-- (players who arrived over a day ago). days: only players who arrived in the last N days (null for all).
create or replace function public.admin_sources(days int default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since', (select min(recorded_at) from analytics_private.player_sources),
    -- New accounts since tracking began with no source: the game couldn't connect, or an older version.
    'unrecorded', (select count(*) from auth.users u
                   where u.created_at >= coalesce((select min(recorded_at) from analytics_private.player_sources), now())
                     and (days is null or u.created_at > now() - days * interval '1 day')
                     and not exists (select 1 from analytics_private.player_sources s where s.player = u.id)),
    'groups', (select coalesce(jsonb_agg(g order by g.players desc), '[]'::jsonb) from (
      select s.src, s.campaign, s.host, s.invite, count(*) as players,
             count(*) filter (where s.app) as app,
             count(*) filter (where exists (select 1 from mountains m where m.owner = s.player and coalesce((m.summary ->> 'lifts')::int, 0) > 0)) as lift,
             count(*) filter (where exists (select 1 from mountains m where m.owner = s.player and coalesce((m.summary ->> 'totalVisitors')::int, 0) > 0)) as opened,
             count(*) filter (where exists (select 1 from mountains m where m.owner = s.player and coalesce((m.summary ->> 'season')::int, 1) >= 2)) as season2,
             count(*) filter (where s.recorded_at < now() - interval '1 day' and exists (select 1 from analytics_private.player_days d where d.player = s.player and d.day > (s.recorded_at at time zone 'UTC')::date)) as returned,
             count(*) filter (where s.recorded_at < now() - interval '1 day') as old_enough,
             count(*) filter (where u.id is not null and not coalesce(u.is_anonymous, false)) as signed_in
      from analytics_private.player_sources s
      left join auth.users u on u.id = s.player
      where days is null or s.recorded_at > now() - days * interval '1 day'
      group by 1, 2, 3, 4) g)
  );
end;
$$;
revoke all on function public.admin_sources(int) from public, anon;
grant execute on function public.admin_sources(int) to authenticated;
commit;
