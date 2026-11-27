// The rush to the fire pit when the lifts close (Adum888, Nov 27): guests counted only those already by the fire,
// so hundreds chose the same one at once, walked across the base and found it full. Now everyone already on the
// way counts too, and nobody sets off for a fire pit that's already spoken for.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    state.cash = 2e7; state.reputation = 1.3;
    let F = null;
    for (const [x, z] of [[16, 60], [-8, 60], [20, 54], [-10, 66], [24, 64], [12, 68]]) { const b = evalBuilding('firepit', x, z, 0); if (!b.problems.length) { F = commitBuilding(b, 'firepit', x, z, 0) || world.buildings.at(-1); computeNetwork(); break; } }
    if (!F) return null;
    for (const T of realTrails()) T.lit = true;
    for (const k of ['weekday', 'weekend', 'quiet']) { opsState().plans[k].night = 1200; opsState().plans[k].apres = 'on'; }
    let seed = 11; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    demandForDay = () => 1200; state.day = 41; state.phase = 'closed'; state.time = DAY_OPEN; openDay(); state.speed = 0;
    let full = 0; const st = seatTaken; seatTaken = function (q, B) { if (B === F) full++; return st(q, B); };
    let peak = 0, n = 0, chose = 0;
    while (state.phase === 'open' && state.time < closeTime() + 90 && n++ < 99999) {
      simStep(1.5);
      if (state.time >= closeTime() - 5) { const w = F.used.seat + F.q.seat.length + guests.filter((x) => x.bid === F.id && (x.st === 'walk' || x.st === 'glide')).length; peak = Math.max(peak, w); }
    }
    seatTaken = st;
    return { seats: poolSlots(F, 'seat'), peak, full, used: F.today ? F.today.visits || 0 : 0 };
  })()`);
  assert(r, 'a fire pit was built by the base');
  assert(r.peak <= r.seats + 2, `around closing, no more guests by or heading to the fire than it seats (${r.peak} for ${r.seats})`);
  assert(r.full <= 3, `hardly anyone walks over to find it full (${r.full})`);
  eq(g.errors, [], 'no errors');
  await g.page.close();
  return `peak ${r.peak} for ${r.seats} seats, ${r.full} found it full`;
}
