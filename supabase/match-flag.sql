-- King of the Mountain: an orange flag on the game's title screen for an open lobby ("Second Beta Cup · 3 spots
-- left"). Phil turns it on per lobby from stats.html, when making a lobby or later. Off by default.
-- Additive: one column and one owner-only function. Safe to run more than once.

alter table public.match_lobbies add column if not exists flag boolean not null default false;

create or replace function public.admin_match_flag(lid uuid, pflag boolean)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.match_lobbies set flag = coalesce(pflag, false) where id = lid;
  if not found then raise exception 'no such lobby'; end if;
end;
$$;
revoke all on function public.admin_match_flag(uuid, boolean) from public, anon;
grant execute on function public.admin_match_flag(uuid, boolean) to authenticated;
