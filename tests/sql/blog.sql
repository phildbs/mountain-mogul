-- Checks supabase/blog.sql on a throwaway database (after Supabase stubs, schema.sql, profiles.sql, profile-names.sql,
-- multiplayer.sql, match-chat.sql and blog.sql).
create temp table bl_users(n integer primary key, id uuid default gen_random_uuid(), email text, anon boolean);
insert into bl_users(n, email, anon) values (1, 'a@bl.invalid', false), (2, 'b@bl.invalid', false), (3, '', true), (4, 'phildbs@gmail.com', false), (5, 'c@bl.invalid', false);
insert into auth.users(id, email, is_anonymous) select id, email, anon from bl_users;
insert into public.match_blocked_words(word) values ('badword') on conflict do nothing;
create temp table bl_results(name text);
grant all on bl_users, bl_results to anon, authenticated;
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'BLOG TEST FAILED: %', label; end if; insert into bl_results values (label); end; $$;
create function pg_temp.err(sql text) returns text language plpgsql as $$ begin execute sql; return null; exception when others then return sqlerrm; end; $$;
create function pg_temp.as_user(k integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce((select id::text from bl_users where n = k), ''), false);
  perform set_config('request.jwt.claims', coalesce(jsonb_build_object('sub', (select id from bl_users where n = k), 'email', (select email from bl_users where n = k), 'is_anonymous', (select anon from bl_users where n = k)), '{}')::text, false);
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
set role authenticated;
select pg_temp.as_user(1); select public.set_profile('Snowy', true);
select pg_temp.as_user(2); select public.set_profile('Quiet One', false);
select pg_temp.as_user(4); select public.set_profile('Phil', true);

-- comments
select pg_temp.as_user(3);
select pg_temp.ok(pg_temp.err($$select public.blog_comment('hello-players', 'hi')$$) = 'sign_in_needed', 'a guest can''t comment');
select pg_temp.as_user(5);
select pg_temp.ok(pg_temp.err($$select public.blog_comment('hello-players', 'hi')$$) = 'name_needed', 'an account without a name can''t comment');
select pg_temp.as_user(1);
select pg_temp.ok(public.blog_comment('hello-players', E'  Love   the game!\r\n\n\n\nKeep going  ') > 0, 'a named player comments');
select pg_temp.ok((select body from public.blog_comments where name = 'Snowy') = E'Love the game!\n\nKeep going', 'spaces tidied, one empty line kept');
select pg_temp.ok(pg_temp.err($$select public.blog_comment('hello-players', 'again')$$) = 'slow_down', 'not twice in 20 seconds');
reset role; update public.blog_comments set created_at = now() - interval '1 minute' where name = 'Snowy'; set role authenticated;
select pg_temp.ok(pg_temp.err($$select public.blog_comment('hello-players', 'what a BADWORD')$$) = 'not_friendly', 'rude words refused');
select pg_temp.ok(pg_temp.err($$select public.blog_comment('hello-players', E'  \n ')$$) = 'empty', 'empty refused');
select pg_temp.ok(pg_temp.err($$select public.blog_comment('Bad Post!', 'hi')$$) = 'no_such_post', 'post ids checked');
select public.blog_comment('hello-players', repeat('a', 1500));
select pg_temp.ok((select max(char_length(body)) from public.blog_comments) = 1000, 'long comments cut to 1,000');
select pg_temp.ok(pg_temp.err($$insert into public.blog_comments (post, user_id, name, body) values ('hello-players', auth.uid(), 'Snowy', 'x')$$) is not null, 'no writing the table directly');
select pg_temp.as_user(2);
select public.blog_comment('hello-players', 'Nice');
select pg_temp.ok((select count(*) from public.blog_comments where name = 'Quiet One') = 1, 'a private profile still comments under its name');
select pg_temp.ok((select dev from public.blog_comments where name = 'Quiet One') = false, 'players aren''t marked Developer');
select pg_temp.as_user(4);
select public.blog_comment('hello-players', 'Thanks!');
select pg_temp.ok((select dev from public.blog_comments where body = 'Thanks!') = true, 'Phil is marked Developer');
select pg_temp.ok(public.blog_comment('hello-players', 'And again') > 0, 'Phil isn''t slowed down');

-- reading and taking down
set role anon; select pg_temp.as_user(0);
select pg_temp.ok((select count(*) from public.blog_comments) = 5, 'anyone reads the comments');
set role authenticated; select pg_temp.as_user(2);
select pg_temp.ok(public.blog_delete((select id from public.blog_comments where name = 'Snowy' order by id limit 1)) = false, 'not someone else''s');
select pg_temp.ok(public.blog_delete((select id from public.blog_comments where name = 'Quiet One')) = true, 'your own comes down');
select pg_temp.ok((select count(*) from public.blog_comments where name = 'Quiet One') = 0, 'and drops out of view');
select pg_temp.as_user(4);
select pg_temp.ok(public.blog_delete((select id from public.blog_comments where name = 'Snowy' order by id limit 1)) = true, 'Phil takes any down');

-- bans
reset role;
insert into public.match_chat_bans (user_id, until) select id, now() + interval '1 day' from bl_users where n = 1;
set role authenticated; select pg_temp.as_user(1);
reset role; update public.blog_comments set created_at = now() - interval '1 minute' where name = 'Snowy'; set role authenticated;
select pg_temp.ok(pg_temp.err($$select public.blog_comment('hello-players', 'hi')$$) = 'not_now', 'a chat ban covers the blog');

-- reactions: anyone, guests too, once per emoji
select pg_temp.as_user(3);
insert into public.blog_reactions (post, emoji, user_id) values ('hello-players', 'heart', auth.uid()), ('hello-players', 'ski', auth.uid());
select pg_temp.ok(pg_temp.err($$insert into public.blog_reactions (post, emoji, user_id) values ('hello-players', 'heart', auth.uid())$$) is not null, 'once per emoji');
select pg_temp.ok(pg_temp.err($$insert into public.blog_reactions (post, emoji, user_id) values ('hello-players', 'poop', auth.uid())$$) is not null, 'only the offered emoji');
select pg_temp.ok(pg_temp.err($$insert into public.blog_reactions (post, emoji, user_id) values ('hello-players', 'wow', (select id from bl_users where n = 1))$$) is not null, 'not for someone else');
select pg_temp.as_user(1);
insert into public.blog_reactions (post, emoji, user_id) values ('hello-players', 'heart', auth.uid());
select pg_temp.ok((select count(*) from public.blog_reactions) = 1, 'you see only your own');
delete from public.blog_reactions where post = 'hello-players' and emoji = 'heart';
insert into public.blog_reactions (post, emoji, user_id) values ('hello-players', 'heart', auth.uid());
set role anon; select pg_temp.as_user(0);
select pg_temp.ok(public.blog_tally() = '{"hello-players": {"comments": 3, "reactions": {"ski": 1, "heart": 2}}}'::jsonb, 'totals for everyone: ' || public.blog_tally()::text);
select pg_temp.ok(pg_temp.err($$insert into public.blog_reactions (post, emoji) values ('hello-players', 'wow')$$) is not null, 'no reactions without a session');
reset role;
select 'BLOG TESTS PASSED: ' || count(*) from bl_results;
