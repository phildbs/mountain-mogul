// The mountain browser (title screen): shared mountains with their likes, ratings and
// resorts started on them, sorted and searched; signed-in players like and rate other players' mountains.
import { openGame, eq, assert } from '../harness.mjs';
const dlg = (g) => g.ev(`document.getElementById('crisis').hidden ? '' : document.getElementById('crBody').textContent.replace(/\\s+/g, ' ')`);
export default async function ({ browser, url }) {
  // Moss shares two mountains from the editor
  const a = await openGame(browser, url, { query: '?editor=1', mountain: 'fresh' });
  await a.click('#edMaps'); await a.ev(`document.getElementById('edFrom').value = 'juniper'`); await a.click('#crisis [data-ed-new=shape]'); await a.reloaded();
  await a.ev(`__fakeSwitch('user-A', 'a@example.com')`);
  await a.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.profiles = { 'user-A': { name: 'Moss', public: true }, 'user-B': { name: 'Sam', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await a.page.reload(); await a.reloaded();
  const share = (name) => a.ev(`(async () => { ED.name = ${JSON.stringify(name)}; const doc = edDoc(), id = mapIdOf(doc); const r = await CLOUD.sb.rpc('share_mountain', { pid: id, pdoc: doc, pvertical: 1480, pallow: true }); return r.error ? r.error.message : id; })()`);
  await a.ev(`(() => { const p = { x: -30, z: 10 }; ED.tool = 'flatten'; ED.r = 14; ED.k = 10; edStrokeStart(p); for (let i = 0; i < 40; i++) edBrush(p, 0.05); edStrokeEnd(); ED.tool = 'pond'; ED.r = 5; edStrokeStart({ x: -33, z: 10 }); for (let x = -33; x <= -27; x++) edDrawTo({ x, z: 10 }); edStrokeEnd(); })()`);
  const first = await share('First Peak');
  await a.ev(`(() => { const p = { x: 0, z: -40 }; ED.tool = 'raise'; edStrokeStart(p); for (let i = 0; i < 5; i++) edBrush(p, 0.05); edStrokeEnd(); })()`);
  const second = await share('Second Bowl');
  assert(/^c:m/.test(first) && /^c:m/.test(second) && first !== second, `two shared (${first}, ${second})`);
  // two resorts started on the first
  await a.page.evaluate((id) => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); for (const n of [1, 2]) d.rows.push({ id: 'r' + n, owner: 'x' + n, public: true, summary: { name: 'R' + n, mt: id } }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, first);
  const db = await a.page.evaluate(() => localStorage.getItem('FAKE_DB'));
  // Sam, signed in, on the title screen
  const b = await openGame(browser, url, { query: '?maps=1' });
  await b.page.evaluate((d) => localStorage.setItem('FAKE_DB', d), db);
  await b.ev(`__fakeSwitch('user-B', 'b@example.com')`); await b.page.reload(); await b.reloaded();
  assert(await b.ev(`!document.getElementById('mapsCard').hidden`), 'the Custom mountains card is on the title screen');
  await b.click('#mapsCard'); await b.wait(400);
  const names = () => b.ev(`[...document.querySelectorAll('#mbList .mb-row b')].map((x) => x.textContent)`);
  eq(await names(), ['Second Bowl', 'First Peak'], 'newest first');
  await b.click('#crisis [data-mb-sort=resorts]'); await b.wait(300);
  eq(await names(), ['First Peak', 'Second Bowl'], 'most played first');
  assert((await dlg(b)).includes('2 resorts'), 'with the resorts started on each');
  // open the second: like it and give it five stars, then back to the list
  await b.ev(`document.querySelector('#mbList [data-mb-open="${second}"]').click()`); await b.wait(400);
  assert((await dlg(b)).includes('Made by Moss') && await b.ev(`!!document.querySelector('#crisis [data-like]')`), 'a mountain’s card, with Like and stars');
  await b.click('#crisis [data-like]'); await b.wait(200); await b.click('#crisis [data-star="5"]'); await b.wait(200);
  eq(await b.ev(`[document.querySelector('#crisis [data-like]').textContent, document.querySelectorAll('#crisis .mb-stars .on').length]`), ['❤ Liked', 5], 'liked, and rated five stars');
  await b.click('#crisis [data-like]'); await b.wait(200); await b.click('#crisis [data-like]'); await b.wait(200); // unlike and like again
  await b.click('#crisis [data-star="4"]'); await b.wait(200); // changing the rating
  // report it: once, with a reason, sent to the owner
  await b.click('#crisis [data-report]'); await b.page.fill('#crisis .mb-reportbox input', 'Rude name'); await b.click('#crisis [data-report-send]'); await b.wait(300);
  assert((await dlg(b)).includes('Reported. Thanks'), 'Report: sent, and the card says so');
  const sd = await b.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')));
  eq([sd.sLikes.length, sd.sRatings.length, sd.sRatings[0].stars, sd.sReports.length, sd.sReports[0].reason], [1, 1, 4, 1, 'Rude name'], 'one like, one rating (changeable) and one report each');
  await b.click('#crNo'); await b.wait(300);
  assert(await b.ev(`!!document.getElementById('mbList')`), 'Back to the list');
  await b.click('#crisis [data-mb-sort=likes]'); await b.wait(300);
  eq(await names(), ['Second Bowl', 'First Peak'], 'most liked first');
  await b.click('#crisis [data-mb-sort=rating]'); await b.wait(300);
  eq(await names(), ['Second Bowl', 'First Peak'], 'top rated first');
  assert((await dlg(b)).includes('★ 4.0'), 'with its rating');
  await b.page.fill('#mbSearch', 'first'); await b.wait(600);
  eq(await names(), ['First Peak'], 'search by name');
  await b.page.fill('#mbSearch', 'moss'); await b.wait(600);
  eq((await names()).length, 2, 'or by maker');
  // Look around: the mountain in 3D, read only, with its maker, totals, Like and stars, Play and Copy to edit
  await b.page.fill('#mbSearch', ''); await b.wait(600);
  await b.ev(`document.querySelector('#mbList [data-mb-open="${first}"]').click()`); await b.wait(400);
  await b.click('#smLook'); await b.reloaded(); await b.wait(300);
  eq(await b.ev(`[LOOK, MOUNTAIN.id, NO_SAVE, document.body.classList.contains('look'), document.getElementById('title').hidden, world.ponds.length, world.ponds[0] && world.ponds[0].free]`), ['${first}', '${first}', true, true, true, 1, true].map((x) => (x === '${first}' ? first : x)), 'Look around opens the mountain read only, with its pond dug');
  assert((await b.ev(`document.getElementById('lkBy').textContent`)).includes('Made by Moss') && await b.ev(`!document.getElementById('lkCopy').hidden && !!document.querySelector('#lkRate [data-like]')`), 'its maker, Copy to edit, and Like and stars');
  await b.click('#lkRate [data-star="3"]'); await b.wait(300);
  eq(await b.page.evaluate((id) => JSON.parse(localStorage.getItem('FAKE_DB')).sRatings.find((r) => r.mountain_id === id).stars, first), 3, 'rated from Look around');
  await b.click('#edSlope'); assert(await b.ev('overlay.slope'), 'Steepness shows');
  await b.click('#lkBack'); await b.reloaded(); await b.wait(400);
  assert(await b.ev(`!!document.getElementById('mbList')`), 'Back returns to the custom mountains list');
  await b.ev(`document.querySelector('#mbList [data-mb-open="${first}"]').click()`); await b.wait(400); await b.click('#smLook'); await b.reloaded();
  await b.click('#lkPlay'); await b.reloaded();
  eq(await b.ev(`[MOUNTAIN.id, state.started, !LOOK, world.ponds.length]`), [first, true, true, 1], 'Play from Look around starts a resort on it');
  // the owner's stats page: totals, the reported mountain first with its reason, and Remove
  await b.page.evaluate(() => localStorage.setItem('FAKE_SESSION', JSON.stringify({ user: { id: 'owner', is_anonymous: false, email: 'phildbs@gmail.com' } })));
  await b.page.goto(url + 'stats.html?owner#custom'); await b.page.waitForSelector('#custom table', { timeout: 10000 });
  const st = await b.page.innerText('#custom');
  assert(/shared\s*2/i.test(st) && /Second Bowl[\s\S]*Moss[\s\S]*Rude name[\s\S]*First Peak/.test(st) && (await b.page.innerText('#cBadge')) === '1', `stats: totals, the reported one first with its reason, a badge (${st.slice(0, 400)})`);
  await b.click(`[data-cremove="${second}"]`); await b.click(`[data-cremove="${second}"]`); await b.wait(500);
  eq(await b.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).shared.map((m) => m.name)), ['First Peak'], 'Remove takes it off');
  assert(!/Second Bowl/.test(await b.page.innerText('#custom')), 'and off the list');
  eq(b.errors, [], 'no errors'); await b.page.close();
  // a Look around link opened on its own goes to the mountain's card, which fetches it
  const e = await openGame(browser, url);
  await e.page.evaluate((d) => localStorage.setItem('FAKE_DB', d), db); await e.page.goto(url + '?look=' + first.slice(3)); await e.reloaded(); await e.wait(500);
  assert(await e.ev(`!LOOK && (document.getElementById('crBody').textContent || '').includes('First Peak')`), 'a bare Look around link opens the card instead');
  eq(e.errors, [], 'no errors'); await e.page.close();
  // Moss can't like or rate their own
  await a.ev(`openSharedMountain('${first}')`); await a.wait(400);
  assert((await dlg(a)).includes('This is your mountain') && !(await a.ev(`!!document.querySelector('#crisis [data-like]')`)), 'no liking your own');
  eq(a.errors, [], 'no errors for the maker');
  // a guest sees it all, and is asked to sign in to rate
  const c = await openGame(browser, url, { query: '?maps=1' });
  await c.page.evaluate((d) => localStorage.setItem('FAKE_DB', d), db); await c.page.reload(); await c.reloaded();
  await c.click('#mapsCard'); await c.wait(400);
  await c.ev(`document.querySelector('#mbList [data-mb-open]').click()`); await c.wait(400);
  assert((await dlg(c)).includes('Sign in on the title screen to like and rate'), 'guests are asked to sign in to rate');
  eq(c.errors, [], 'no errors for a guest'); await c.page.close();
  // shipped: the card is on every title screen, and the new-mountain list's Make your own opens the editor
  const d = await openGame(browser, url);
  assert(await d.ev(`!document.getElementById('mapsCard').hidden`), 'the Custom mountains card is on the title screen');
  await d.click('[data-slot=new]'); await d.wait(100); await d.click('[data-slot=editor]'); await d.reloaded();
  assert(await d.ev('EDITOR && !!document.getElementById("edAskName")'), 'Make your own in the new-mountain list opens the editor, asking for a name');
  eq(d.errors, [], 'no errors'); await d.page.close();
}
