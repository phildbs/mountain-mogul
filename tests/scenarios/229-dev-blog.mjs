// The dev blog (blog.html): a title card with a New post tag until you've read the newest post; emoji reactions
// for anyone (guests too, once per emoji, tap again to take it back); comments for players with a name, which they
// can delete, Phil marked Developer and able to hide any; and a page that still reads fine before blog.sql is run.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  const check = async () => { await g.ev(`(async () => { blogAt = 0; await checkBlog(); })()`); return g.ev(`[$('blogNew').hidden, $('blogNew').textContent, $('mBlog').classList.contains('isnew')]`); };
  eq(await g.ev(`[!$('title').hidden, $('blogCard').getAttribute('href'), $('blogCard').offsetHeight > 20]`), [true, 'blog.html', true], 'a Dev blog card on the title screen');
  eq(await check(), [false, 'New post', true], 'tagged New post before you read it');

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage(), errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('dialog', (d) => d.accept());
  const ev = (c) => p.evaluate(c);
  const load = async () => { await p.goto(url + 'blog.html'); await p.waitForFunction(() => !/Loading/.test(document.querySelector('.cform').textContent)); };
  const reacts = () => ev(`[...document.querySelectorAll('[data-post=hello-players] .react')].map((b) => b.dataset.e + ' ' + b.querySelector('.n').textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''))`);
  const form = () => ev(`document.querySelector('[data-post=hello-players] .cform').textContent.replace(/\\s+/g, ' ').trim()`);
  const said = () => ev(`[...document.querySelectorAll('[data-post=hello-players] .clist li')].map((li) => [li.querySelector('b').textContent, li.querySelector('p').textContent, !!li.querySelector('.dev'), (li.querySelector('.del') || {}).textContent || ''])`);
  const settle = () => p.waitForTimeout(150);
  await load();
  eq(await ev(`[...document.querySelectorAll('.post')].map((a) => [a.dataset.post, a.querySelector('h2').textContent])`), [['hello-players', 'Hello players!']], 'the first post');
  assert(/One month ago, I started Mountain Mogul/.test(await ev(`document.querySelector('.post .body').textContent`)), 'Phil’s words');
  eq(await reacts(), ['heart 0', 'thumbs 0', 'party 0', 'laugh 0', 'wow 0', 'ski 0'], 'six emoji, none yet');
  eq(await ev(`document.querySelector('.support a.coffee').href`), 'https://buymeacoffee.com/mossquake', 'a coffee link');
  assert(/sign in from the game’s title screen/.test(await form()), `a guest is told how to comment: ${await form()}`);

  // reactions: a guest session, once per emoji, tap again to take it back, kept after a reload
  await p.click('[data-post=hello-players] .react[data-e=heart]'); await settle();
  eq((await reacts())[0], 'heart 1*', 'a heart');
  eq(await ev(`JSON.parse(localStorage.getItem('FAKE_SESSION')).user.is_anonymous`), true, 'as a guest');
  await p.click('[data-post=hello-players] .react[data-e=heart]'); await settle();
  eq((await reacts())[0], 'heart 0', 'tap again takes it back');
  await p.click('[data-post=hello-players] .react[data-e=heart]'); await settle();
  await p.click('[data-post=hello-players] .react[data-e=ski]'); await settle();
  await load();
  eq(await reacts(), ['heart 1*', 'thumbs 0', 'party 0', 'laugh 0', 'wow 0', 'ski 1*'], 'more than one emoji, kept after a reload');

  // the game's tag clears once the newest post has been seen (the blog keeps it where the game looks)
  const seen = await ev(`localStorage.getItem('mm.blogSeen')`);
  eq(seen, 'hello-players', 'the blog remembers the newest post read');
  await g.ev(`localStorage.setItem('mm.blogSeen', ${JSON.stringify(seen)})`);
  eq(await check(), [true, 'New post', false], 'read: no tag');

  // a signed-in player without a name picks one, then comments
  await ev(`__fakeSwitch('u-snowy', 'snowy@example.invalid')`); await load();
  assert(/Pick a player name/.test(await form()), `asked for a name: ${await form()}`);
  eq(await reacts(), ['heart 1', 'thumbs 0', 'party 0', 'laugh 0', 'wow 0', 'ski 1'], 'someone else sees the totals, not as theirs');
  await p.fill('.pname', '  Snowy  '); await p.click('.nameform button'); await settle();
  assert(/Commenting as Snowy/.test(await form()), `then the comment box: ${await form()}`);
  await p.click('.cmform button'); await settle();
  eq(await ev(`document.querySelector('.cmform .msg').textContent`), 'Write something first.', 'an empty comment');
  await p.fill('.cmform textarea', 'Love   the game!\n\n\n\nKeep going'); await p.click('.cmform button'); await settle();
  eq(await said(), [['Snowy', 'Love the game!\n\nKeep going', false, 'Delete']], 'posted under the name, tidied, with Delete');
  eq(await ev(`document.querySelector('[data-post=hello-players] .comments h3').textContent`), 'Comments (1)', 'counted');
  await p.fill('.cmform textarea', 'Again'); await p.click('.cmform button'); await settle();
  eq(await ev(`document.querySelector('.cmform .msg').textContent`), 'Slow down a little, then try again.', 'not twice in a row');
  await ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.blogComments.forEach((c) => { c.created_at = new Date(Date.now() - 60000).toISOString(); }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`);
  await p.fill('.cmform textarea', 'Second thought'); await p.click('.cmform button'); await settle();
  await p.click('[data-post=hello-players] .clist li:last-child .del'); await settle();
  eq((await said()).map((c) => c[1]), ['Love the game!\n\nKeep going'], 'deleted your own');

  // Phil: marked Developer, and can hide anyone's
  await ev(`__fakeSwitch('u-phil', 'phildbs@gmail.com')`); await load();
  eq((await said())[0][3], 'Hide', 'Phil can hide anyone’s');
  await p.fill('.pname', 'Phil'); await p.click('.nameform button'); await settle();
  await p.fill('.cmform textarea', 'Thanks Snowy!'); await p.click('.cmform button'); await settle();
  eq(await said(), [['Snowy', 'Love the game!\n\nKeep going', false, 'Hide'], ['Phil', 'Thanks Snowy!', true, 'Delete']], 'Phil marked Developer, Hide on others');
  await p.click('[data-post=hello-players] .clist li:first-child .del'); await settle();
  eq((await said()).map((c) => c[0]), ['Phil'], 'hidden');
  await ev(`localStorage.removeItem('FAKE_SESSION')`); await load();
  eq(await said(), [['Phil', 'Thanks Snowy!', true, '']], 'a visitor sees what’s up, with no buttons');
  eq(await ev(`document.documentElement.scrollWidth`), 390, 'fits a phone');

  // before blog.sql is run: the post still reads, and reacting says it isn't open yet
  await ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.noBlog = true; localStorage.setItem('FAKE_DB', JSON.stringify(d)); })()`); await load();
  await p.click('[data-post=hello-players] .react[data-e=wow]'); await settle();
  eq([(await reacts())[4], await ev(`document.querySelector('.reacts .note').textContent`)], ['wow 0', 'Reactions aren’t open yet.'], 'not open yet');
  eq(errors, [], 'no errors on the blog');

  // the menu item opens it too
  eq(await g.ev(`$('mBlog').textContent`), 'Dev blog', 'Dev blog in the menu');
  eq(g.errors, [], 'no page errors');
  await ctx.close(); await g.page.close();
}
