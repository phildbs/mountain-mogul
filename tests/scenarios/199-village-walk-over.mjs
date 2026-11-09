// A lift near the middle of the valley counts as the far base. With a village gondola, guests parked at the near base
// rode it away from that lift, then walked all the way back across the base (Adum888, Ridgeback). Now they walk
// straight over when that's shorter; the gondola still carries guests between the two ends of the valley.
import { openGame, assert, eq, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { mountain: 'ridgeback' });
  await g.click('#startBtn'); await g.wait(300);
  const s = await g.ev(`(() => {
    state.cash = 5e7;
    state.parks = [{ R: 3, a: Math.PI, n: 96, x: -66.5, z: 67, id: 1, ents: [{ s: 0, t: 7 }], name: 'Main lot' }, { R: 3, a: 0, n: 96, x: 66.5, z: 39, id: 2, ents: [{ s: 2, t: 0.45 }], name: 'East lot' }];
    netChanged(); buildLot();
    const lift = (a, b, t) => { const i = evalLift(a, b, t); if (i.problems.length) throw new Error(t + ': ' + i.problems); commitLift(i, t); computeNetwork(); return world.lifts[world.lifts.length - 1]; };
    const trail = (w) => { const pts = w.map(([x, z]) => ({ x, z, y: heightAt(x, z) })), t = evalTrail(pts, 'wide'); if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide'); computeNetwork(); };
    lift({ x: -51.1, z: 51.8 }, { x: -53, z: -4 }, 'gondola'); lift({ x: 59.3, z: 25.5 }, { x: 42.8, z: -14.8 }, 'six');
    const M = lift({ x: -1.2, z: 45.9 }, { x: 16.3, z: -7.5 }, 'six'); // the middle: the main base's, just
    trail([[-50, -2], [-60, 15], [-55, 30], [-48, 48]]); trail([[40, -12], [30, 5], [45, 20], [57, 27]]); trail([[16, -5], [5, 15], [0, 30], [-2, 43]]);
    const V = lift({ x: 42.44, z: 54.83 }, { x: -39.87, z: 78.32 }, 'village');
    computeNetwork();
    return { mid: baseOf(M.a), ends: [baseOf(V.a), baseOf(V.b)], mid2: M.id, v: V.id };
  })()`);
  eq([s.mid, s.ends], [0, [1, 0]], 'the middle lift counts as the main base; the gondola joins the East base to the main one');
  await g.ev(SETUPS.midwinter);
  await g.ev(`openDay()`);
  const d = await g.ev(`(() => {
    const off = new Map(); let back = 0, rode = 0, n = 0;
    const orig = crossDone; crossDone = function (g) { off.set(g.id, state.time); return orig(g); };
    while (state.phase === 'open' && n < 90000) { simStep(1.5); n++;
      for (const g of guests) { const t = off.get(g.id); if (t === undefined) continue; off.delete(g.id); rode++;
        if (g.then && g.then.k === 'queue' && g.then.lid === ${s.mid2} && baseOf(g) === 0 && g.x < -30) back++; } } // off at the west end, heading back to the middle lift
    crossDone = orig;
    return { back, rode, mid: today.liftRiders[${s.mid2}] || 0, guests: state.lastReport.guests };
  })()`);
  assert(d.rode > 50, `guests still ride the village gondola between the ends of the valley (${d.rode})`);
  eq(d.back, 0, 'nobody rides it away from the middle lift and walks back');
  assert(d.mid > 50, `the middle lift is busy (${d.mid} riders)`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
