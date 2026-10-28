-- Daily online-save activity. No historical activity is inferred from latest saves.
-- Run once in the SQL Editor before publishing stats.html. Safe to run again.
begin;
create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
create table if not exists analytics_private.retention_start (
  id boolean primary key default true check(id), installed_at timestamptz not null default now()
);
insert into analytics_private.retention_start(id) values(true) on conflict do nothing;
create table if not exists analytics_private.player_days (
  player uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key(player, day)
);
alter table analytics_private.player_days enable row level security;
alter table analytics_private.retention_start enable row level security;
create index if not exists player_days_day on analytics_private.player_days(day, player);
create or replace function analytics_private.record_player_day()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = new.owner then
    insert into analytics_private.player_days(player,day)
    values(new.owner,(statement_timestamp() at time zone 'UTC')::date) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function analytics_private.record_player_day() from public, anon, authenticated;
drop trigger if exists retention_save_day on public.mountains;
create trigger retention_save_day after insert or update of save on public.mountains
for each row execute function analytics_private.record_player_day();
create or replace function public.admin_retention()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> 'phildbs@gmail.com'
     or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'not allowed' using errcode='42501';
  end if;
  with params as (
    select (installed_at at time zone 'UTC')::date + 1 as since,
           (now() at time zone 'UTC')::date as today
    from analytics_private.retention_start where id
  ), cohorts as (
    select id,(created_at at time zone 'UTC')::date as joined
    from auth.users,params where (created_at at time zone 'UTC')::date >= since
  ), rates as (
    select n as day, count(c.id) as eligible,
      count(a.player) as returned
    from params cross join (values(1),(7),(30)) offsets(n)
    left join cohorts c on c.joined + n < params.today
    left join analytics_private.player_days a on a.player=c.id and a.day=c.joined+n
    group by n
  ), daily as (
    select d::date as day, count(a.player) as active,
      count(a.player) filter(where (u.created_at at time zone 'UTC')::date=d::date) as new,
      count(a.player) filter(where (u.created_at at time zone 'UTC')::date<d::date) as returning
    from params cross join lateral generate_series(greatest(since,today-29),today,interval '1 day') d
    left join analytics_private.player_days a on a.day=d::date
    left join auth.users u on u.id=a.player group by d
  ) select jsonb_build_object('since',(select since from params),'timezone','UTC',
    'rates',(select coalesce(jsonb_agg(r order by day),'[]') from rates r),
    'daily',(select coalesce(jsonb_agg(d order by day),'[]') from daily d)) into result;
  return result;
end;
$$;
revoke all on function public.admin_retention() from public, anon;
grant execute on function public.admin_retention() to authenticated;
commit;
