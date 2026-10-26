-- Owner-only list of signed-in players (Google or email accounts, not guests) and their resorts,
-- for the stats page. Run in the Supabase SQL Editor.
create or replace function public.admin_players()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(p order by p.last_seen desc nulls last), '[]'::jsonb) from (
    select
      coalesce(pr.name, '') as name,
      coalesce(pr.public, true) as public,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email') as via,
      u.created_at as joined,
      greatest(u.last_sign_in_at, (select max(m.updated_at) from mountains m where m.owner = u.id)) as last_seen,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id, 'name', m.summary ->> 'name', 'creator', m.summary ->> 'creator', 'mt', m.summary ->> 'mt', 'public', m.public, 'updated', m.updated_at,
          'season', (m.summary ->> 'season')::int, 'guests', (m.summary ->> 'totalVisitors')::int, 'best', (m.summary ->> 'bestGuests')::int,
          'stars', (m.summary ->> 'stars')::int, 'trails', (m.summary ->> 'trails')::int, 'lifts', (m.summary ->> 'lifts')::int)
        order by m.updated_at desc), '[]'::jsonb) from mountains m where m.owner = u.id) as mountains
    from auth.users u
    left join profiles pr on pr.id = u.id
    where not coalesce(u.is_anonymous, false)
  ) p);
end;
$$;
revoke all on function public.admin_players() from public, anon;
grant execute on function public.admin_players() to authenticated;
