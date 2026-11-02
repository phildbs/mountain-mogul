// The match screen: from the Multiplayer window, "Go to your resort" moves to the match map and shows your
// resort as the server saved it, read only, with both rivals' lifts, trails and buildings drawn on their slices
// (turned round the summit, never part of your resort), the match in the top bar and the standings in the
// panel. A spectator can watch, and Back to title leaves.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  // Make a match resort the way the server does: a starter on Crown Peak, saved.
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const mineSave = { ...save, clock: { ...save.clock, ticket: 55 } };

  const g = await openGame(browser, url, { keepStorage: false, render: !!process.env.SHOTS });
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const lob = { id: 'M1', name: 'Test Cup', map: 'match', slots: 3, starts_at: at(-400), days: 168, day_minutes: 30, status: 'running', day: 13, prize: 'Test Cup champion' };
  const match = { lobbies: [lob],
    players: [{ lobby_id: 'M1', slot: 0, user_id: null, resort_name: 'Summit Ridge' }, { lobby_id: 'M1', slot: 1, user_id: 'user-B', resort_name: 'Phil’s Peak' }, { lobby_id: 'M1', slot: 2, user_id: null, resort_name: 'Valley View' }],
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'M1', slot: s, day: 13, save: s === 1 ? mineSave : save, summary: { name: ['Summit Ridge', 'Phil’s Peak', 'Valley View'][s], profit: [45315, 44000, 37327][s], guests: 900 + s, computer: s !== 1 } })) };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard');
  await g.page.waitForSelector('[data-mp=open][data-id=M1]', { timeout: 10000 });
  await g.page.click('[data-mp=open][data-id=M1]');
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!(visiting && visiting.match && matchView)'), null, { timeout: 20000 });
  const s = await g.ev(`(() => {
    const own = world.lifts[0], box = new THREE.Box3(), mid = (o) => { box.setFromObject(o); const c = new THREE.Vector3(); box.getCenter(c); return c; };
    const rivals = rivalGroup.children.filter((o) => o.type === 'Group' && o.children.length);
    return { mt: MOUNTAIN.id, lifts: world.lifts.length, trails: realTrails().length, ticket: state.ticket, drawn: matchView.drawn, bar: document.getElementById('visitText').innerText,
      standings: !document.getElementById('visitLeague').hidden, ownAt: [own.a.x, own.a.z], far: rivals.map((o) => { const c = mid(o); return Math.round(Math.hypot(c.x - own.a.x, c.z - own.a.z)); }) };
  })()`);
  eq([s.mt, s.lifts, s.trails, s.ticket], ['match', 1, 2, 55], 'your own resort, as saved, on the match map');
  eq(s.drawn, 8, 'both rivals drawn: a lift, two trails and a lodge each');
  assert(s.far.length >= 4 && s.far.every((d) => d > 40), `rivals' things sit on their own slices, away from yours (${s.far})`);
  assert(/Test Cup/.test(s.bar) && /2nd of 3/.test(s.bar) && /day 13 of 168/.test(s.bar) && /next day in/.test(s.bar), `the bar shows the match (${s.bar})`);
  await g.click('#visitLeague'); await g.wait(300);
  const sheet = await g.page.evaluate(() => document.getElementById('sheet').innerText);
  assert(/Standings/i.test(sheet) && /1st · Summit Ridge \(computer\)\s*\$45,315/.test(sheet) && /2nd · Phil’s Peak/.test(sheet), `the standings panel (${sheet.slice(0, 200)})`);
  const saved = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon') && /match/.test(localStorage.getItem(k) || '') && /"mt":"match"/.test(localStorage.getItem(k) || '')));
  eq(saved, [], 'the match resort is never saved on the device');
  eq(g.errors, [], 'no page errors');
  if (process.env.SHOTS) { await g.click('#sheet .x').catch(() => {}); await g.ev('(() => { cam.viewH = 230; cam.viewGoal = null; updateCamera(); })()'); await g.wait(2500); await g.page.screenshot({ path: 'match-screen.png' }); }

  // Back to the title.
  await g.click('#visitHome');
  await g.reloaded();
  eq(await g.ev('!!matchView || !!visiting'), false, 'Back to title leaves the match');
  await g.page.close();
}
