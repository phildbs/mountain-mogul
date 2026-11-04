// Watching a match you're not in: it opens on the whole mountain, and you can follow any resort (Next resort, or
// Follow in the standings). The one you follow takes its numbers, and the view turns with the mountain so it stays put.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const at = (min) => new Date(Date.now() + min * 60000).toISOString(), names = ['Summit Ridge', 'Pine Hollow', 'Valley View'];
  const lob = { id: 'M1', name: 'Test Cup', map: 'match', slots: 3, starts_at: at(-400), days: 168, day_minutes: 30, status: 'running', day: 13 };
  const match = { lobbies: [lob],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'M1', slot: s, user_id: null, resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'M1', slot: s, day: 13, save: { ...save, clock: { ...save.clock, ticket: [50, 55, 70][s] } }, summary: { name: names[s], profit: [3, 2, 1][s] * 10000, guests: 900, computer: true } })) };
  const g = await openGame(browser, url, { keepStorage: false });
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard');
  await g.page.waitForSelector('[data-mp=open][data-id=M1]', { timeout: 10000, state: 'attached' });
  eq(await g.ev(`document.querySelector('[data-mp=open][data-id=M1]').className`), 'btn go', 'Watch is the orange button');
  await g.page.evaluate(() => document.querySelector('[data-mp=open][data-id=M1]').click());
  await g.reloaded();
  // The loading screen stays up while the match loads, so the title doesn't flash up in between.
  assert(await g.ev(`!!document.querySelector('#loading[data-match]') || !!matchView`), 'the loading screen stays up until the match is on screen');
  await g.page.waitForFunction(() => window.__dbg('!!(visiting && matchView)'), null, { timeout: 20000 });
  eq(await g.ev(`[!!document.getElementById('loading'), document.getElementById('title').hidden]`), [false, true], 'then it goes, with the match showing, not the title');
  await g.wait(500);
  const a = await g.ev(`(() => { const cz = PLAY1 - CROWN.c[1] * PN - HALF; return { me: matchView.me, slot: matchView.slot, ticket: state.ticket, sw: !document.getElementById('visitSwitch').hidden, over: Math.abs(cam.target.x) < 2 && Math.abs(cam.target.z - cz - 10) < 2 && cam.viewH > 200, bar: document.getElementById('visitText').innerText }; })()`);
  eq([a.me, a.slot, a.ticket, a.sw, a.over], [false, 0, 50, true, true], 'a spectator sees the whole mountain, following the first resort, with a Next resort button');
  assert(/following Summit Ridge, 1st of 3/.test(a.bar), `the bar says whose resort (${a.bar})`);
  // New chat flashes the match button for spectators too, whichever icon it shows.
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.match.messages = [...(d.match.messages || []), { id: 7, lobby_id: 'M1', user_id: 'u-x', slot: 0, name: 'Summit Ridge', body: 'Hello watchers', kind: 'chat', day: 13, hidden: false, created_at: new Date().toISOString() }]; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await g.ev('mcLoad()'); await g.wait(300);
  const fl = await g.ev(`({ on: document.getElementById('mpFab').classList.contains('unread'), anim: getComputedStyle(document.getElementById('mpFab')).animationName, icon: [...document.querySelectorAll('#mpFab svg')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.getAttribute('class')).join() })`);
  console.log('  spectator icon:', fl.icon);
  eq([fl.on, fl.anim], [true, 'mpflash'], `a spectator’s match button flashes orange for new chat (${fl.icon})`);
  await g.click('#visitChat'); await g.wait(300); await g.ev('select(null)');
  // Where Pine Hollow's lodge is on screen, before and after following it.
  const spot = (pre) => g.ev(`(() => { const B = world.buildings.find((b) => b.type === 'lodge'), cx = PLAY0 + CROWN.c[0] * PN - HALF, cz = PLAY1 - CROWN.c[1] * PN - HALF, phi = ${pre} * 2 * Math.PI / 3;
    const x = cx + (B.x - cx) * Math.cos(phi) - (B.z - cz) * Math.sin(phi), z = cz + (B.x - cx) * Math.sin(phi) + (B.z - cz) * Math.cos(phi);
    updateCamera(); camera.updateMatrixWorld(); const v = new THREE.Vector3(x, heightAt(x, z), z).project(camera); return [Math.round(v.x * 500), Math.round(v.y * 500)]; })()`);
  const before = await spot(1);
  await g.ev(`document.getElementById('visitSwitch').click()`); await g.wait(500);
  const after = await spot(0);
  const b = await g.ev(`({ slot: matchView.slot, ticket: state.ticket, name: document.getElementById('resortName').textContent, bar: document.getElementById('visitText').innerText, rivals: RIVAL_SKI.slices.map((s) => s.slot).sort() })`);
  eq([b.slot, b.ticket, b.name, b.rivals], [1, 55, 'Pine Hollow', [0, 2]], 'Next resort follows Pine Hollow: its numbers, with the other two drawn as rivals');
  assert(/following Pine Hollow, 2nd of 3/.test(b.bar), `the bar follows (${b.bar})`);
  assert(Math.hypot(before[0] - after[0], before[1] - after[1]) < 4, `the view stays put as the mountain turns (${before} → ${after})`);
  // Follow in the standings.
  await g.click('#visitLeague'); await g.wait(300);
  eq(await g.ev(`document.querySelectorAll('#sheet [data-action=matchSlot]').length`), 2, 'Follow beside the other two resorts');
  await g.ev(`document.querySelector('#sheet [data-action=matchSlot][data-slot="2"]').click()`); await g.wait(500);
  eq(await g.ev(`[matchView.slot, state.ticket]`), [2, 70], 'Follow in the standings switches to Valley View');
  eq(await g.ev(`[getComputedStyle($('tipsBtn')).display, !!matchPlay]`), ['none', false], 'watching a match: no What next? button');
  // Watching: the buildings list can be sorted and the profit map shown (both only change the view).
  const pv = await g.ev(`(() => { select({ kind: 'manage', obj: 'blds' }); renderSheet(); const s0 = listView.blds.sort;
    document.querySelector('#sheet [data-action=bldSort]').click(); const s1 = listView.blds.sort;
    document.querySelector('#sheet [data-action=profitMap]').click(); const m = overlay.profit; setProfitMap('off'); select(null);
    return [s1 !== s0, m]; })()`);
  eq(pv, [true, 'all'], 'watching a match, building sort and the profit map work');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  // A match with an empty first slice (one player, in slot 1): watching follows the resort that's there.
  const one = { lobbies: [{ ...lob, id: 'M2', name: 'New Cup' }], players: [{ lobby_id: 'M2', slot: 1, user_id: 'u-x', resort_name: 'Lone Peak' }],
    resorts: [{ lobby_id: 'M2', slot: 1, day: 13, save: { ...save, clock: { ...save.clock, ticket: 61 } }, summary: { name: 'Lone Peak', profit: 5000, guests: 400 } }] };
  const h = await openGame(browser, url, { keepStorage: false });
  await h.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, one);
  await h.ev(`__fakeSwitch('user-B', 'b@example.com')`); await h.wait(1500);
  await h.click('#mpCard');
  await h.page.waitForSelector('[data-mp=open][data-id=M2]', { timeout: 10000, state: 'attached' });
  await h.page.evaluate(() => document.querySelector('[data-mp=open][data-id=M2]').click());
  await h.reloaded();
  await h.page.waitForFunction(() => window.__dbg('!!(visiting && matchView)'), null, { timeout: 20000 });
  eq(await h.ev(`[matchView.slot, state.ticket, document.getElementById('resortName').textContent]`), [1, 61, 'Lone Peak'], 'a match with an empty first slice opens on the resort that is there');
  // You joined late on that empty first slice: until the server plays the next day there's no resort yet, so it says when.
  await h.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.match.players.push({ lobby_id: 'M2', slot: 0, user_id: 'user-B', resort_name: 'Phil Peak' }); localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await h.ev(`openMatch('M2')`); await h.wait(800);
  const said = await h.ev(`document.getElementById('toast').textContent`);
  assert(/Your resort opens when day 14 starts, in /.test(said), `a late joiner opens the empty slice and is told when their resort is ready (${said})`);
  eq(h.errors, [], 'no page errors (one-resort match)');
  await h.page.close();
}
