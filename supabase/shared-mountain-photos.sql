-- Shared mountain pictures (Phil, Nov 12): a small 3D picture the editor takes when a mountain is shared, shown on its
-- card in the mountain browser. Mountains without one get a picture painted from their ground by the game instead.
-- Run after shared-mountains.sql. Additive only: a new column and a new function. Safe to run more than once.

alter table public.shared_mountains add column if not exists photo text;
do $$ begin
  alter table public.shared_mountains add constraint shared_mountains_photo_ok
    check (photo is null or (octet_length(photo) < 120000 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'));
exception when duplicate_object then null; end $$;

-- The maker sets (or replaces) a mountain's picture. The game's owner may fill in a missing one (for mountains shared
-- before pictures), never replace one.
create or replace function public.set_shared_photo(pid text, pphoto text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if pphoto is null or octet_length(pphoto) >= 120000 or pphoto !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'bad_photo' using errcode = '22023';
  end if;
  update shared_mountains set photo = pphoto where id = pid and (owner = auth.uid() or (photo is null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'phildbs@gmail.com' and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)));
  if not found then raise exception 'not_yours' using errcode = '42501'; end if;
  return true;
end;
$$;
revoke all on function public.set_shared_photo(text, text) from public, anon;
grant execute on function public.set_shared_photo(text, text) to authenticated;
