-- One player name per player (Phil, Nov 4): no two profiles can share a name, ignoring capitals and spaces at the
-- ends ("Moss" and " moss " are the same name). Run after profiles.sql. Additive only: a unique index, and set_profile
-- replaced with the same arguments and results plus one check, so a taken name says so plainly. On Nov 4 the live
-- database had 28 profiles and 28 different names, so the index builds without changing anyone's name.
-- Safe to run more than once.

create unique index if not exists profiles_name_unique on public.profiles (lower(btrim(name)));

create or replace function public.set_profile(pname text, ppublic boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n text := left(btrim(regexp_replace(coalesce(pname, ''), '\s+', ' ', 'g')), 24);
begin
  if uid is null or not public.is_profile_user(uid) then
    raise exception 'sign_in_needed' using errcode = '42501';
  end if;
  if n = '' then raise exception 'name_needed' using errcode = '22023'; end if;
  if exists (select 1 from profiles where lower(btrim(name)) = lower(n) and id <> uid) then
    raise exception 'name_taken' using errcode = '23505';
  end if;
  insert into profiles (id, name, public, updated_at) values (uid, n, ppublic, now())
  on conflict (id) do update set name = excluded.name, public = excluded.public, updated_at = now();
  update mountains set summary = summary || jsonb_build_object('creator', case when ppublic then n else '' end)
  where owner = uid;
  return jsonb_build_object('name', n, 'public', ppublic);
end;
$$;
revoke all on function public.set_profile(text, boolean) from public, anon;
grant execute on function public.set_profile(text, boolean) to authenticated;
