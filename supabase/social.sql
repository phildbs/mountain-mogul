-- Likes and visit counts. Run this once in the Supabase SQL Editor (it is safe to run again).
-- Likes: signed-in players only, one per player per resort, only on someone else's public resort.
create table if not exists public.likes (
  mountain_id uuid not null references public.mountains (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mountain_id, user_id)
);
alter table public.likes enable row level security;
drop policy if exists "see own likes" on public.likes;
create policy "see own likes" on public.likes for select using (user_id = auth.uid());
drop policy if exists "like others public resorts when signed in" on public.likes;
create policy "like others public resorts when signed in" on public.likes for insert with check (
  user_id = auth.uid() and public.is_profile_user(auth.uid())
  and exists (select 1 from public.mountains m where m.id = mountain_id and m.public and m.owner <> auth.uid()));
grant select, insert on public.likes to authenticated;

-- Visits: one per visitor per resort per day, counted for someone else's public resort.
create table if not exists public.visits (
  mountain_id uuid not null references public.mountains (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null default current_date,
  primary key (mountain_id, user_id, day)
);
alter table public.visits enable row level security;
drop policy if exists "count a visit to someone elses public resort" on public.visits;
create policy "count a visit to someone elses public resort" on public.visits for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.mountains m where m.id = mountain_id and m.public and m.owner <> auth.uid()));
grant insert on public.visits to authenticated;

-- Like and visit counts for every public resort, and for your own.
create or replace function public.social_counts()
returns table (mountain_id uuid, likes int, visits int)
language sql stable security definer set search_path = public
as $$
  select m.id,
         (select count(*) from likes l where l.mountain_id = m.id)::int,
         (select count(*) from visits v where v.mountain_id = m.id)::int
  from mountains m where m.public or m.owner = auth.uid();
$$;
revoke all on function public.social_counts() from public;
grant execute on function public.social_counts() to anon, authenticated;
