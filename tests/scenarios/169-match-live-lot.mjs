// Growing the parking lot while a match day plays: the new section is drawn as a blueprint and stays shut
// until tomorrow (the server builds it tonight), also when the live day starts again after a pause.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  await m.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay(); state.cash = 3e6; })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url);
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  // Day 2 began 27 minutes ago: its skiing is over, so nothing plays until we ask.
  const match = { lobbies: [{ id: 'K1', name: 'Run Cup', map: 'match', slots: 3, starts_at: ago(87), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'K1', slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'K1', slot: s, day: 2, save, summary: { name: names[s], profit: 100 * s, guests: 300 } })), orders: [],
    days: [{ lobby_id: 'K1', day: 2, results: { wx: 'sunny', share: [100, 150, 90], resorts: [{ slot: 0, guests: 99, profit: 1000 }, { slot: 1, guests: 148, profit: 4099 }, { slot: 2, guests: 88, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=K1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=K1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  await g.wait(800);
  eq(await g.ev('[state.phase, !!matchView.replay]'), ['closed', false], 'the match is open at night, nothing playing');
  await g.ev(`matchView.lobby.starts_at = new Date(Date.now() - 65 * 60000).toISOString(); matchView.nothing = null`);
  await g.ev('startReplay(true)');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  await g.ev(`select({ kind: 'manage', obj: 'lotgrow' })`); await g.wait(300);
  await g.ev(`document.querySelector('#sheet [data-action=expandLot]').click()`); await g.wait(800);
  const look = () => g.ev(`({ secs: state.lotSections, open: lotsOpen(), replay: !!matchView.replay, mats: lotGroup.children.map((m) => m.material === LOT_MAT ? 'lot' : m.material === BLUEPRINT ? 'blue' : 'shut').join() })`);
  eq(await look(), { secs: 2, open: 1, replay: true, mats: 'lot,blue' }, 'the new section is a blueprint, shut today, and the day keeps playing');
  { const t = await g.ev(`document.getElementById('toast').textContent`); assert(/opens tomorrow morning/.test(t), `it says the spaces open tomorrow (${t})`); }
  const o = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.orders.map((x) => [x.kind, x.payload.what]));
  eq(o, [['build', 'lot']], 'and it goes to the server');
  // Pausing and coming back to the live day: the day starts again from the server's copy, and the section stays shut.
  await g.ev('stopReplay(false)'); await g.wait(1500);
  eq((await look()).mats, 'lot,lot', 'at night it looks like a lot');
  await g.ev('startReplay(true)');
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  eq(await look(), { secs: 2, open: 1, replay: true, mats: 'lot,blue' }, 'back in the live day it is still a blueprint, and no car parks there');
  eq(await g.ev(`stalls.slice(SPACES_PER_SECTION).some((s) => s.car)`), false, 'nobody parks in it');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
