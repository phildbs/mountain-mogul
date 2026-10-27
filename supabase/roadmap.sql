-- Votes on roadmap ideas: anyone with a game session (anonymous is fine) can vote an idea up or down.
-- One vote per player per idea; voting again replaces it, and it can be taken back. Players see only
-- their own rows; everyone sees the totals through roadmap_tally(). Run once in the Supabase SQL Editor (safe to run again).
create table if not exists public.roadmap_votes (
  idea text not null check (idea ~ '^[a-z0-9-]{1,40}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (idea, user_id)
);
alter table public.roadmap_votes enable row level security;
drop policy if exists "see own votes" on public.roadmap_votes;
create policy "see own votes" on public.roadmap_votes for select using (user_id = auth.uid());
drop policy if exists "vote on an idea" on public.roadmap_votes;
create policy "vote on an idea" on public.roadmap_votes for insert with check (user_id = auth.uid());
drop policy if exists "change your vote" on public.roadmap_votes;
create policy "change your vote" on public.roadmap_votes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "take back your vote" on public.roadmap_votes;
create policy "take back your vote" on public.roadmap_votes for delete using (user_id = auth.uid());
revoke all on public.roadmap_votes from anon, authenticated;
grant select, insert, update, delete on public.roadmap_votes to authenticated;

-- Totals per idea, for everyone: { "hotels": { "up": 12, "down": 1 }, ... }
create or replace function public.roadmap_tally()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(idea, jsonb_build_object('up', up, 'down', down)), '{}'::jsonb) from (
    select idea, count(*) filter (where vote = 1) as up, count(*) filter (where vote = -1) as down
    from roadmap_votes group by idea) t;
$$;
revoke all on function public.roadmap_tally() from public;
grant execute on function public.roadmap_tally() to anon, authenticated;
