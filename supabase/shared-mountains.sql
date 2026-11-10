-- Shared mountains (Phil, Nov 10): a hand-shaped mountain from the editor, published so anyone with its link can play
-- it, guests included. Only signed-in players with a player name can share; the name shows on the mountain. A shared
-- mountain never changes (its id is a fingerprint of the mountain itself, made by the game: mapIdOf), so resorts built
-- on it are safe; its maker can stop sharing it (delete), and choose whether others may copy it into their own editor.
-- Run after schema.sql and profiles.sql. Additive only: a new table and new functions. Safe to run more than once.

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
