-- King of the Mountain: official matches (Phil's, from stats.html) of 1, 2 or 3 seasons. Run after match-seasons.sql.
-- Additive: one new function, like admin_match_turn. stats.html makes the lobby with admin_match_lobby, then sets its
-- seasons with this before it starts; the length goes with it (168 days, then 195 more a season: match/market.mjs).
-- Safe to run more than once.
create or replace function public.admin_match_seasons(lid uuid, pseasons integer)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if pseasons is null or pseasons not between 1 and 3 then raise exception 'a match is 1, 2 or 3 seasons'; end if;
  update public.match_lobbies set seasons = pseasons, days = 168 + (pseasons - 1) * 195 where id = lid and status = 'open';
  if not found then raise exception 'only a lobby that hasn''t started'; end if;
end;
$$;
revoke all on function public.admin_match_seasons(uuid, integer) from public, anon;
grant execute on function public.admin_match_seasons(uuid, integer) to authenticated;
