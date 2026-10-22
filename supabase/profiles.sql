-- Creator profiles: one per signed-in account, with a name shown on all its resorts and a choice of
-- whether it's public. Run this once in the Supabase SQL Editor (it is safe to run again).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  public boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read public or own profile" on public.profiles;
create policy "read public or own profile" on public.profiles for select using (public or auth.uid() = id);
grant select on public.profiles to anon, authenticated;

-- Saves your profile and puts the name on every one of your resorts (blank while the profile is private),
-- so the boards always show the current name. Guests can't have a profile.
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
  insert into profiles (id, name, public, updated_at) values (uid, n, ppublic, now())
  on conflict (id) do update set name = excluded.name, public = excluded.public, updated_at = now();
  update mountains set summary = summary || jsonb_build_object('creator', case when ppublic then n else '' end)
  where owner = uid;
  return jsonb_build_object('name', n, 'public', ppublic);
end;
$$;
revoke all on function public.set_profile(text, boolean) from public, anon;
grant execute on function public.set_profile(text, boolean) to authenticated;
