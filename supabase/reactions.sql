-- Reactions to updates: after an update, players in a resort can give it a thumbs up or down.
-- One per player per version (changing your mind replaces it). Players see only their own;
-- the owner sees the totals through admin_reactions(). Run once in the Supabase SQL Editor (safe to run again).
create table if not exists public.update_reactions (
  version text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reaction smallint not null check (reaction in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (version, user_id)
);
alter table public.update_reactions enable row level security;
drop policy if exists "see own reactions" on public.update_reactions;
create policy "see own reactions" on public.update_reactions for select using (user_id = auth.uid());
drop policy if exists "react to an update" on public.update_reactions;
create policy "react to an update" on public.update_reactions for insert with check (user_id = auth.uid());
drop policy if exists "change your reaction" on public.update_reactions;
create policy "change your reaction" on public.update_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.update_reactions from authenticated;
grant select, insert, update on public.update_reactions to authenticated;

create or replace function public.admin_reactions()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(r order by r.latest desc), '[]'::jsonb) from (
    select version, count(*) filter (where reaction = 1) as up, count(*) filter (where reaction = -1) as down, max(created_at) as latest
    from update_reactions group by version order by max(created_at) desc limit 20) r);
end;
$$;
revoke all on function public.admin_reactions() from public, anon;
grant execute on function public.admin_reactions() to authenticated;
