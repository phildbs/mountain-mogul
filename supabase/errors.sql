-- Crash reports: when the game hits an error on a player's device it sends a short, anonymous report
-- (the error, the game version and the kind of device). Players can only add reports; nobody can read them
-- except through admin_errors(), which only answers the owner's account.
-- Run this once in the Supabase SQL Editor (it is safe to run again).
create table if not exists public.errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  version text not null check (char_length(version) <= 20),
  message text not null check (char_length(message) between 1 and 500),
  source text check (char_length(source) <= 1500),
  device text check (char_length(device) <= 200),
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) < 2000)
);
alter table public.errors enable row level security;
drop policy if exists "players add their own error reports" on public.errors;
create policy "players add their own error reports" on public.errors
  for insert to authenticated with check (user_id = auth.uid());
revoke all on public.errors from anon;
grant insert on public.errors to authenticated;

create or replace function public.admin_errors()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'last_24h', (select count(*) from errors where created_at > now() - interval '24 hours'),
    'last_7d', (select count(*) from errors where created_at > now() - interval '7 days'),
    'players_7d', (select count(distinct user_id) from errors where created_at > now() - interval '7 days'),
    'groups', (select coalesce(jsonb_agg(g order by g.last_seen desc), '[]'::jsonb) from (
      select version, message, count(*) as n, count(distinct user_id) as players, max(created_at) as last_seen,
             (array_agg(source order by created_at desc))[1] as source, (array_agg(device order by created_at desc))[1] as device
      from errors where created_at > now() - interval '14 days'
      group by version, message order by max(created_at) desc limit 40) g)
  );
end;
$$;
revoke all on function public.admin_errors() from public, anon;
grant execute on function public.admin_errors() to authenticated;
