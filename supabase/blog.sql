-- Dev blog (blog.html): comments and emoji reactions on Phil's posts. The posts themselves live in the page,
-- each with a data-post id; these tables are keyed by that id, so never change one once it's published.
-- Comments: players with a name (a signed-in account with a profile) only, under that name, through
-- blog_comment, which checks the words (match_clean, from match-chat.sql) and the pace. Chat bans
-- (match_chat_bans) cover the blog too. Reactions: anyone with a game session (guests too), once per emoji per post.
-- Run after profiles.sql and match-chat.sql. Additive only. Safe to run more than once.

create table if not exists public.blog_comments (
  id bigint generated always as identity primary key,
  post text not null check (post ~ '^[a-z0-9-]{1,60}$'),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  body text not null check (char_length(body) between 1 and 1000),
  dev boolean not null default false,          -- written by Phil: the page marks it Developer
  hidden boolean not null default false,       -- taken down by its writer or by Phil
  created_at timestamptz not null default now()
);
create index if not exists blog_comments_post on public.blog_comments (post, id);
create index if not exists blog_comments_user on public.blog_comments (user_id, created_at desc);

create table if not exists public.blog_reactions (
  post text not null check (post ~ '^[a-z0-9-]{1,60}$'),
  emoji text not null check (emoji in ('heart', 'thumbs', 'party', 'laugh', 'wow', 'ski')),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post, emoji, user_id)
);

alter table public.blog_comments enable row level security;
alter table public.blog_reactions enable row level security;

-- Anyone can read the comments that are up. New ones only through blog_comment.
drop policy if exists "read comments" on public.blog_comments;
create policy "read comments" on public.blog_comments for select using (not hidden);
revoke all on public.blog_comments from anon, authenticated;
grant select on public.blog_comments to anon, authenticated;

-- Your own reactions only; everyone sees the totals through blog_tally().
drop policy if exists "see own reactions" on public.blog_reactions;
create policy "see own reactions" on public.blog_reactions for select using (user_id = auth.uid());
drop policy if exists "react to a post" on public.blog_reactions;
create policy "react to a post" on public.blog_reactions for insert with check (user_id = auth.uid());
drop policy if exists "take back a reaction" on public.blog_reactions;
create policy "take back a reaction" on public.blog_reactions for delete using (user_id = auth.uid());
revoke all on public.blog_reactions from anon, authenticated;
grant select, insert, delete on public.blog_reactions to authenticated;

-- Totals for everyone: { "hello-players": { "reactions": { "heart": 12, "ski": 3 }, "comments": 4 }, ... }
create or replace function public.blog_tally()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(post, jsonb_build_object('reactions', reactions, 'comments', comments)), '{}'::jsonb) from (
    select p.post,
      coalesce((select jsonb_object_agg(emoji, n) from (select emoji, count(*) as n from blog_reactions r where r.post = p.post group by emoji) e), '{}'::jsonb) as reactions,
      (select count(*) from blog_comments c where c.post = p.post and not c.hidden) as comments
    from (select post from blog_reactions union select post from blog_comments) p) t;
$$;
revoke all on function public.blog_tally() from public;
grant execute on function public.blog_tally() to anon, authenticated;

-- Post a comment under your player name. Returns the new comment's id.
create or replace function public.blog_comment(ppost text, pbody text)
returns bigint language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid := auth.uid(); who text; b text; nid bigint;
  boss boolean := lower(coalesce(auth.jwt() ->> 'email', '')) = 'phildbs@gmail.com' and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if uid is null or not public.is_profile_user(uid) then raise exception 'sign_in_needed' using errcode = '42501'; end if;
  select p.name into who from public.profiles p where p.id = uid;
  if coalesce(btrim(who), '') = '' then raise exception 'name_needed' using errcode = '22023'; end if;
  if exists (select 1 from public.match_chat_bans where user_id = uid and until > now()) then raise exception 'not_now' using errcode = '42501'; end if;
  if coalesce(ppost, '') !~ '^[a-z0-9-]{1,60}$' then raise exception 'no_such_post' using errcode = '22023'; end if;
  -- tidy spaces, keep paragraph breaks (at most one empty line)
  b := regexp_replace(regexp_replace(replace(coalesce(pbody, ''), E'\r', ''), '[ \t]+', ' ', 'g'), E' ?\n ?', E'\n', 'g');
  b := left(btrim(regexp_replace(b, E'\n{3,}', E'\n\n', 'g'), E' \n'), 1000);
  if b = '' then raise exception 'empty' using errcode = '22023'; end if;
  if not boss then
    if exists (select 1 from public.blog_comments where user_id = uid and created_at > now() - interval '20 seconds') then raise exception 'slow_down'; end if;
    if (select count(*) from public.blog_comments where user_id = uid and created_at > now() - interval '1 day') >= 20 then raise exception 'slow_down'; end if;
    if not public.match_clean(b) then raise exception 'not_friendly' using errcode = '22023'; end if;
  end if;
  insert into public.blog_comments (post, user_id, name, body, dev) values (ppost, uid, left(btrim(who), 24), b, boss) returning id into nid;
  return nid;
end;
$$;
revoke all on function public.blog_comment(text, text) from public, anon;
grant execute on function public.blog_comment(text, text) to authenticated;

-- Take a comment down: your own, or any of them for Phil. True if it was up.
create or replace function public.blog_delete(pid bigint)
returns boolean language plpgsql security definer set search_path = public, auth
as $$
declare boss boolean := lower(coalesce(auth.jwt() ->> 'email', '')) = 'phildbs@gmail.com' and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if auth.uid() is null then raise exception 'sign_in_needed' using errcode = '42501'; end if;
  update public.blog_comments set hidden = true where id = pid and not hidden and (user_id = auth.uid() or boss);
  return found;
end;
$$;
revoke all on function public.blog_delete(bigint) from public, anon;
grant execute on function public.blog_delete(bigint) to authenticated;
