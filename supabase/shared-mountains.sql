-- Shared mountains (Phil, Nov 10): a hand-shaped mountain from the editor, published so anyone with its link can play
-- it, guests included. Only signed-in players with a player name can share; the name shows on the mountain. A shared
-- mountain never changes (its id is a fingerprint of the mountain itself, made by the game: mapIdOf), so resorts built
-- on it are safe; its maker can stop sharing it (delete), and choose whether others may copy it into their own editor.
-- The mountain browser (Phil, Nov 10): signed-in players like and rate (1 to 5 stars) other players' shared mountains,
-- once each, and shared_mountain_list sorts them by newest, likes, rating or the number of resorts started on them.
-- Run after schema.sql and profiles.sql. Additive only: new tables, an index and new functions. Safe to run more than once.

create table if not exists public.shared_mountains (
  id text primary key check (id ~ '^c:m[0-9a-z]{14}$'),
  owner uuid not null references auth.users (id) on delete cascade,
  creator text not null check (char_length(creator) between 1 and 24),
  name text not null check (char_length(name) between 1 and 28),
  doc jsonb not null check (octet_length(doc::text) < 400000),
  vertical integer not null default 0 check (vertical between 0 and 20000),
  allow_copy boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists shared_mountains_owner on public.shared_mountains (owner, created_at desc);
alter table public.shared_mountains enable row level security;
drop policy if exists "anyone reads shared mountains" on public.shared_mountains;
create policy "anyone reads shared mountains" on public.shared_mountains for select using (true);
drop policy if exists "makers delete their own" on public.shared_mountains;
create policy "makers delete their own" on public.shared_mountains for delete using (owner = auth.uid());
grant select on public.shared_mountains to anon, authenticated;
grant delete on public.shared_mountains to authenticated;
-- (no insert or update grants: sharing and the copy setting go through the functions below)

-- Shares a mountain: signed in, with a player name (the name it shows), at most 30 shared at once. Sharing the same
-- mountain again only changes whether it can be copied.
create or replace function public.share_mountain(pid text, pdoc jsonb, pvertical integer, pallow boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n text;
  mine public.shared_mountains;
begin
  if uid is null or not public.is_profile_user(uid) then raise exception 'sign_in_needed' using errcode = '42501'; end if;
  select btrim(name) into n from profiles where id = uid;
  if coalesce(n, '') = '' then raise exception 'name_needed' using errcode = '22023'; end if;
  if pid !~ '^c:m[0-9a-z]{14}$' or jsonb_typeof(pdoc) <> 'object' or pdoc ->> 'v' <> '1' or coalesce(pdoc ->> 'h', '') = ''
    or char_length(btrim(coalesce(pdoc ->> 'name', ''))) not between 1 and 28 or octet_length(pdoc::text) >= 400000 then
    raise exception 'bad_mountain' using errcode = '22023';
  end if;
  select * into mine from shared_mountains where id = pid;
  if found then
    if mine.owner <> uid then raise exception 'shared_by_another' using errcode = '42501'; end if;
    update shared_mountains set allow_copy = coalesce(pallow, true) where id = pid;
  else
    if (select count(*) from shared_mountains where owner = uid) >= 30 then raise exception 'share_limit' using errcode = 'P0001'; end if;
    insert into shared_mountains (id, owner, creator, name, doc, vertical, allow_copy)
    values (pid, uid, left(n, 24), btrim(pdoc ->> 'name'), pdoc, greatest(0, least(20000, coalesce(pvertical, 0))), coalesce(pallow, true));
  end if;
  return jsonb_build_object('id', pid, 'creator', left(n, 24), 'allow_copy', coalesce(pallow, true));
end;
$$;
revoke all on function public.share_mountain(text, jsonb, integer, boolean) from public, anon;
grant execute on function public.share_mountain(text, jsonb, integer, boolean) to authenticated;

-- Lets the maker turn copying on or off.
create or replace function public.set_shared_copy(pid text, pallow boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update shared_mountains set allow_copy = coalesce(pallow, true) where id = pid and owner = auth.uid();
  if not found then raise exception 'not_yours' using errcode = '42501'; end if;
  return coalesce(pallow, true);
end;
$$;
revoke all on function public.set_shared_copy(text, boolean) from public, anon;
grant execute on function public.set_shared_copy(text, boolean) to authenticated;

-- Likes and ratings: one of each per signed-in player and mountain, never on your own. Readable only by their writer;
-- the totals come from shared_mountain_list.
create table if not exists public.shared_mountain_likes (
  mountain_id text not null references public.shared_mountains (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mountain_id, user_id)
);
create table if not exists public.shared_mountain_ratings (
  mountain_id text not null references public.shared_mountains (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (mountain_id, user_id)
);
alter table public.shared_mountain_likes enable row level security;
alter table public.shared_mountain_ratings enable row level security;
drop policy if exists "own likes" on public.shared_mountain_likes;
create policy "own likes" on public.shared_mountain_likes for select using (user_id = auth.uid());
drop policy if exists "like others' mountains" on public.shared_mountain_likes;
create policy "like others' mountains" on public.shared_mountain_likes for insert with check (user_id = auth.uid() and public.is_profile_user(auth.uid())
  and not exists (select 1 from public.shared_mountains m where m.id = mountain_id and m.owner = auth.uid()));
drop policy if exists "unlike" on public.shared_mountain_likes;
create policy "unlike" on public.shared_mountain_likes for delete using (user_id = auth.uid());
drop policy if exists "own ratings" on public.shared_mountain_ratings;
create policy "own ratings" on public.shared_mountain_ratings for select using (user_id = auth.uid());
drop policy if exists "rate others' mountains" on public.shared_mountain_ratings;
create policy "rate others' mountains" on public.shared_mountain_ratings for insert with check (user_id = auth.uid() and public.is_profile_user(auth.uid())
  and not exists (select 1 from public.shared_mountains m where m.id = mountain_id and m.owner = auth.uid()));
drop policy if exists "change own rating" on public.shared_mountain_ratings;
create policy "change own rating" on public.shared_mountain_ratings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.shared_mountain_likes to authenticated;
grant select, insert, update on public.shared_mountain_ratings to authenticated;

-- Resorts started on a mountain: counted from the resorts table by the mountain id in their summary.
create index if not exists mountains_summary_mt on public.mountains ((summary ->> 'mt'));

-- The browser's list: every shared mountain with its totals (no ground: that's fetched when one is opened), sorted
-- 'new', 'likes', 'rating' (average, with two pretend 3-star votes so one 5-star vote doesn't top the list) or
-- 'resorts', optionally only names containing psearch. At most 60 at a time.
create or replace function public.shared_mountain_list(psort text default 'new', psearch text default '', plimit integer default 60, poffset integer default 0)
returns table (id text, owner uuid, creator text, name text, vertical integer, allow_copy boolean, created_at timestamptz,
  likes integer, rating numeric, ratings integer, resorts integer)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.owner, m.creator, m.name, m.vertical, m.allow_copy, m.created_at,
    coalesce(l.n, 0)::integer, round(r.avg, 1), coalesce(r.n, 0)::integer, coalesce(x.n, 0)::integer
  from shared_mountains m
  left join (select mountain_id, count(*) n from shared_mountain_likes group by 1) l on l.mountain_id = m.id
  left join (select mountain_id, count(*) n, avg(stars) avg, sum(stars) total from shared_mountain_ratings group by 1) r on r.mountain_id = m.id
  left join (select summary ->> 'mt' mt, count(*) n from mountains where summary ->> 'mt' like 'c:m%' group by 1) x on x.mt = m.id
  where coalesce(psearch, '') = '' or m.name ilike '%' || replace(replace(replace(psearch, '\', '\\'), '%', '\%'), '_', '\_') || '%' or m.creator ilike '%' || replace(replace(replace(psearch, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by
    case when psort = 'likes' then coalesce(l.n, 0) when psort = 'resorts' then coalesce(x.n, 0) else 0 end desc,
    case when psort = 'rating' then (coalesce(r.total, 0) + 6.0) / (coalesce(r.n, 0) + 2) else 0 end desc,
    m.created_at desc
  limit least(greatest(coalesce(plimit, 60), 1), 60) offset greatest(coalesce(poffset, 0), 0);
$$;
revoke all on function public.shared_mountain_list(text, text, integer, integer) from public;
grant execute on function public.shared_mountain_list(text, text, integer, integer) to anon, authenticated;
