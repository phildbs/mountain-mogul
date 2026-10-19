// Gear and retail: a rental and tuning center, a ski store and a gift kiosk at the base.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const placed = await g.ev(`(() => { const out = [], L = world.buildings[0];
    const near = [[8,0],[-8,0],[0,8],[12,0],[-12,0],[8,8],[-8,8],[16,2],[-16,2],[0,13],[12,10],[-12,10],[18,8],[-18,8]];
    for (const type of ['tuning', 'store']) {
      let ok = false;
      for (const [dx, dz] of near) { if (ok) break; for (const r of [0, 1, 2, 3]) {
        const b = evalBuilding(type, L.x + dx, L.z + dz, r);
        if (!b.problems.length) { commitBuilding(b, type, L.x + dx, L.z + dz, r); computeNetwork(); syncLabels(); out.push(type); ok = true; break; } } }
    }
    // a kiosk where guests pass with no store nearby: the top of the lift
    const top = world.lifts[0].b;
    for (const [dx, dz] of [[0,-5],[1,-5],[-1,-5],[0,-6],[2,-6],[-2,-6]]) { let ok = false; for (const r of [0, 1, 2, 3]) {
      const b = evalBuilding('gift', top.x + dx, top.z + dz, r);
      if (!b.problems.length) { commitBuilding(b, 'gift', top.x + dx, top.z + dz, r); computeNetwork(); syncLabels(); out.push('gift'); ok = true; break; } } if (ok) break; }
    return out; })()`);
  eq(placed, ['tuning', 'store', 'gift'], 'tuning center and store at the base, gift kiosk at the lift top');
  await g.ev(`state.wx.days[0].hi = 8; refreshSnowState(todayWx())`); // a cold day: more guests want goggles and gloves
  await g.ev(`openDay()`); await g.ev(SETUPS.finishDay);
  const r = await g.ev(`(() => { const by = (t) => world.buildings.find((B) => B.type === t).yday; return { tuning: by('tuning'), store: by('store'), gift: by('gift'), rev: state.lastReport.rev, noRental: state.lastReport.complaints.noRental }; })()`);
  assert(r.tuning.visits > 20, `the tuning center fitted rentals and tuned skis (${r.tuning.visits})`);
  eq(r.noRental, 0, 'no one had to rent in town');
  assert(r.store.revenue > 0 && r.gift.revenue > 0, `the store and kiosk sold things (${r.store.revenue}, ${r.gift.revenue})`);
  assert(r.rev.retail === r.store.revenue + r.gift.revenue, 'shop sales are their own revenue line');
  assert(/Shops/.test(await g.ev(`$('rpBody').innerText`)), 'the day report shows shop sales');
  eq(await g.ev(`[svcRef('tune'), svcRef('gear'), svcRef('shop')]`), [35, 60, 14], 'guests compare against $35 tunes, $60 gear and $14 souvenirs');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
