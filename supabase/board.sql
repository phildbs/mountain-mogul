-- The leaderboard, light. The game used to download every public resort (~250 KB) and every resort's like
-- counts (~88 KB) each time it opened, though only about 1 in 10 players ever looks. Now the title screen asks
-- board_peek for just what it shows (your rank, the top 3, your likes), and the full board loads when opened.
-- Opens are counted (one row per player, day and kind) for the stats page. Safe to run again.
begin;
create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
create table if not exists analytics_private.board_opens (
  player uuid not null references auth.users(id) on delete cascade,
  day date not null,
  what text not null check (what in ('board', 'browse')),
  primary key (player, day, what)
);
alter table analytics_private.board_opens enable row level security;
create index if not exists board_opens_day on analytics_private.board_opens(day);

-- Your standing on one mountain's busiest-day board. mt: the board ('custom' for custom mountains),
-- me: your resort (left out of the list; the game adds it from what's on screen), best: its busiest day.
-- Counts only public resorts with a name, not sandboxes, like the full board in the game.
create or replace function public.board_peek(mt text, me uuid, best int)
returns jsonb language sql stable security definer set search_path = public as $$
  with b as (
    select m.id, m.summary s, coalesce((m.summary ->> 'bestGuests')::numeric, 0) g
    from mountains m
    where m.public and m.id is distinct from me
      and coalesce(m.summary ->> 'name', '') <> '' and not coalesce((m.summary ->> 'sandbox')::boolean, false)
      and (case when m.summary ->> 'mt' like 'c:%' then 'custom' else coalesce(nullif(m.summary ->> 'mt', ''), 'juniper') end) = board_peek.mt
  )
  select jsonb_build_object(
    'n', (select count(*) from b),
    'ahead', (select count(*) from b where g > coalesce(best, 0)),
    'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select id, s ->> 'name' as name, g as best from b order by g desc limit 3) t),
    -- like social_counts: only for your own resort or a public one
    'likes', (select count(*) from likes l where l.mountain_id = me
              and exists (select 1 from mountains m where m.id = me and (m.public or m.owner = auth.uid()))),
    'visits', (select count(*) from visits v where v.mountain_id = me
               and exists (select 1 from mountains m where m.id = me and (m.public or m.owner = auth.uid()))));
$$;
revoke all on function public.board_peek(text, uuid, int) from public;
grant execute on function public.board_peek(text, uuid, int) to anon, authenticated;

-- The game notes the first time each day a player opens the leaderboard or Browse. Guests count too.
create or replace function public.record_board_open(what text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or what not in ('board', 'browse') then return false; end if;
  insert into analytics_private.board_opens (player, day, what)
  values (auth.uid(), (statement_timestamp() at time zone 'UTC')::date, what) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.record_board_open(text) from public, anon;
grant execute on function public.record_board_open(text) to authenticated;

-- Owner-only, for the stats page: per day, players who opened each, and players who played (saved online).
create or replace function public.admin_board_opens(days int default 14)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since', (select min(day) from analytics_private.board_opens),
    'days', (select coalesce(jsonb_agg(r order by r.day desc), '[]'::jsonb) from (
      select d::date as day,
             (select count(*) from analytics_private.board_opens o where o.day = d::date and o.what = 'board') as board,
             (select count(*) from analytics_private.board_opens o where o.day = d::date and o.what = 'browse') as browse,
             (select count(*) from analytics_private.player_days p where p.day = d::date) as played
      from generate_series((now() at time zone 'UTC')::date - (greatest(1, least(days, 90)) - 1), (now() at time zone 'UTC')::date, interval '1 day') d) r),
    'board', (select count(distinct player) from analytics_private.board_opens where what = 'board' and day > (now() at time zone 'UTC')::date - greatest(1, least(days, 90))),
    'browse', (select count(distinct player) from analytics_private.board_opens where what = 'browse' and day > (now() at time zone 'UTC')::date - greatest(1, least(days, 90))),
    'played', (select count(distinct player) from analytics_private.player_days where day > (now() at time zone 'UTC')::date - greatest(1, least(days, 90))));
end;
$$;
revoke all on function public.admin_board_opens(int) from public, anon;
grant execute on function public.admin_board_opens(int) to authenticated;
commit;
