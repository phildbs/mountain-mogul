// Condo sales in a watched match day: the server already sold today's homes (they're in the save), so the live day
// doesn't roll its own sales on top (they used to show "Sold a home", count up, then vanish overnight with no cash).
// It shows the server's own sales instead, with the morning's money.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const m = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  await m.ev(SETUPS.juniperStarter); await m.ev(SETUPS.midwinter);
  const id = await m.ev(`(() => { state.cash = 1e7;
    for (let z = 57; z <= 75; z++) for (let x = -30; x <= 40; x++) for (const r of [0, 1, 2, 3]) {
      const b = evalBuilding('condo', x, z, r, false, null, null, 2); if (b.problems.length) continue;
      const C = commitBuilding(b, 'condo', x, z, r, 'modern'); computeNetwork(); return C.id; }
    return null; })()`);
  assert(id, 'a row of townhomes at the base');
  await m.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); nextDay();
    const C = bldById(${id}); C.sold = 1; C.sales = 250000; C.keep = false; state.lastReport.condo = { ...(state.lastReport.condo || {}), sold: 1, sales: 250000 }; })()`);
  const save = await m.page.evaluate(() => window.__dbg('saveData')(false));
  await m.page.close();
  const g = await openGame(browser, url, {});
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString(), names = ['Summit Ridge', 'Phil’s Peak', 'Rival Run'];
  const match = { lobbies: [{ id: 'K1', name: 'Condo Cup', map: 'match', slots: 3, starts_at: ago(61), days: 168, day_minutes: 30, status: 'running', day: 2, prize: null }],
    players: [0, 1, 2].map((s) => ({ lobby_id: 'K1', slot: s, user_id: [null, 'user-B', null][s], resort_name: names[s] })),
    resorts: [0, 1, 2].map((s) => ({ lobby_id: 'K1', slot: s, day: 2, save, summary: { name: names[s], profit: 100 * s, guests: 300 } })), orders: [],
    days: [{ lobby_id: 'K1', day: 2, results: { wx: 'sunny', share: [100, 150, 90], resorts: [{ slot: 0, guests: 99, profit: 1000 }, { slot: 1, guests: 148, profit: 260000, cash0: save.cash - 260000, debt0: 0 }, { slot: 2, guests: 88, profit: -200 }] } }] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard'); await g.page.waitForSelector('[data-mp=open][data-id=K1]', { timeout: 10000 }); await g.page.click('[data-mp=open][data-id=K1]');
  await g.reloaded(); await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 20000 });
  await g.page.waitForFunction(() => window.__dbg("state.phase === 'open' && !!matchView.replay"), null, { timeout: 30000 });
  const r = await g.ev(`({ sold: bldById(${id}).sold, sales: bldById(${id}).sales, toast: $('toast').textContent, sim: matchView.replay.sim, shown: cashNow(), morning: state.cash - 260000 })`);
  eq([r.sold, r.sales], [1, 250000], 'no extra homes sold in the watched day: the count stays the server’s');
  assert(/Sold a condo home for \$250,000 this morning/.test(r.toast), `the server’s own sale is announced (${r.toast})`);
  assert(r.sim > 240000 && r.shown > r.morning + 240000, `and its money is in the figure shown from the morning (${JSON.stringify(r)})`);
  // Even with every roll a sale, a watched morning sells nothing.
  const again = await g.ev(`(() => { const rnd = Math.random, keep = state.cash; Math.random = () => 0.001; try { today.hotelOut = []; condoMorning(1000, false); } finally { Math.random = rnd; } const out = [bldById(${id}).sold, state.cash - keep]; state.cash = keep; return out; })()`);
  eq(again[0], 1, 'condoMorning sells nothing while a match day is watched');
}
