-- Owner-only feedback and feature ideas for the stats page, with who sent each one and the resort they
-- were most likely playing, so the owner can visit it and see what they mean.
-- Notes don't store a resort id, so the resort is the sender's online save on the same mountain
-- (same resort name first), else their most recently played one. Run in the Supabase SQL Editor (safe to run again).
create or replace function public.admin_feedback(lim int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'phildbs@gmail.com' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'ideas', (select count(*) from feedback where message like '💡 Idea:%'),
    'notes', (select count(*) from feedback where message not like '💡 Idea:%'),
    'items', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select f.id, f.created_at, f.message, f.context - 'ua' as context,
             f.user_id as player,
             coalesce(nullif(pr.name, ''), m.creator, '') as name,
             case when u.id is null then 'gone' when coalesce(u.is_anonymous, false) then 'guest'
                  else coalesce(u.raw_app_meta_data ->> 'provider', 'email') end as via,
             (select count(*) from feedback f2 where f2.user_id = f.user_id) as sent,
             m.id as resort, m.name as resort_name, m.public as resort_public, m.season as resort_season, m.updated as resort_updated
      from (select * from feedback order by created_at desc limit greatest(1, least(coalesce(lim, 200), 500))) f
      left join auth.users u on u.id = f.user_id
      left join profiles pr on pr.id = f.user_id
      left join lateral (
        select mm.id, mm.public, mm.summary ->> 'name' as name, mm.summary ->> 'creator' as creator,
               (mm.summary ->> 'season')::int as season, mm.updated_at as updated
        from mountains mm where mm.owner = f.user_id
        order by (coalesce(mm.summary ->> 'mt', '') = coalesce(f.context ->> 'mt', '')) desc,
                 (coalesce(mm.summary ->> 'name', '') = coalesce(f.context ->> 'resort', '')) desc,
                 mm.updated_at desc
        limit 1) m on true
    ) x)
  );
end;
$$;
revoke all on function public.admin_feedback(int) from public, anon;
grant execute on function public.admin_feedback(int) to authenticated;
