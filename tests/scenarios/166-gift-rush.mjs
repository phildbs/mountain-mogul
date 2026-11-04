// Souvenir shoppers spread out over the day instead of all heading to the gift kiosks at 10:30.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    state.cash = 2e7; const base = world.buildings[0]; let placed = false;
    for (let z = -20; z <= 20 && !placed; z += 4) for (let x = -28; x <= 28 && !placed; x += 4) {
      const info = evalBuilding('gift', base.x + x, base.z + z, 0);
      if (!info.problems.length) { commitBuilding(info, 'gift', base.x + x, base.z + z, 0); placed = true; }
    }
    openDay();
    const ps = Array.from({ length: 400 }, () => makeGuest({ id: null }, base.door.x, base.door.z)).filter((p) => p.shopper);
    const at = (t) => { state.time = t; return ps.filter((p) => needs(p).includes('shop')).length / ps.length; };
    const early = at(640), late = at(890);
    let peak = 0, n = 0; state.time = 480;
    const K = world.buildings.find((B) => B.type === 'gift');
    while (state.phase === 'open' && n < 90000) { simStep(1.5); n++; peak = Math.max(peak, K.q.seat.length * AGENT); }
    return { placed, early, late, peak, wait: Math.round(estWait(K, 'shop')) };
  })()`);
  assert(r.placed, 'a gift kiosk was placed');
  assert(r.early < 0.15, `only a few shoppers want a souvenir right after 10:30 (${(r.early * 100).toFixed(0)}%)`);
  assert(r.late > 0.85, `by 2:50 nearly every shopper has wanted one (${(r.late * 100).toFixed(0)}%)`);
  assert(r.peak < 40, `the kiosk line stays short all day (peak ${r.peak})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
