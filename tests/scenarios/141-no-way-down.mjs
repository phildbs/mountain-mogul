// Guests heading home from a junction whose only open trail leads straight back to it hike out instead of
// circling all night, the day report says why, and night skiers still on the mountain can't keep the day open forever.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    for (const k of ['weekday', 'weekend', 'quiet']) { opsState().plans[k].night = 1200; opsState().plans[k].apres = 'on'; }
    for (const T of realTrails()) T.lit = true;
    state.day = 40; openDay(); schedule = [];
    const T = realTrails().find(runnable), p = T.samples[0], k = cellKey(Math.round(p.x), Math.round(p.z));
    // A junction whose only way on is a trail that ends back in it.
    const A = { id: 9999, name: 'Test Summit', set: new Set([k]), cells: [k], starts: [T], loads: [], tops: [], buildings: [], routes: new Map() }, to = T.to;
    T.to = { kind: 'hub', obj: A };
    const add = () => { const q = makeGuest({ id: null }, p.x, p.z); Object.assign(q, { leaving: true, needsRental: false, wantsLesson: false }); q.x = keyX(k); q.z = keyZ(k); guests.push(q); gById.set(q.id, q); return q; };
    state.time = 1210;
    const a = add(); hubDecision(a, A);
    const skipped = a.st === 'walk' && !(a.then && a.then.next && a.then.next.k === 'ski'); // the loop trail isn't on offer: off to the car
    // Someone who keeps landing back at the same junction gives up after a few laps.
    const b = add(); T.to = to; b.hubLoop = { aid: A.id, n: 3 }; hubDecision(b, A);
    const lapped = /No open trail down from Test Summit/.test(b.th.join(' '));
    const counted = today.noWayDown && today.noWayDown['Test Summit'];
    // A night skier stuck skiing keeps the lights on for a while, but not all night.
    guests = guests.filter((q) => q !== a && q !== b);
    const n = makeGuest({ id: null }, p.x, p.z); Object.assign(n, { night: true, st: 'ski', leaving: true }); guests.push(n);
    state.time = nightEnd() + 30; const early = dayHardEnd() > state.time;
    state.time = nightEnd() + 300; const capped = nightClearout() && dayHardEnd() <= state.time;
    return { skipped, lapped, counted, early, capped, at: [a.st, a.then && a.then.k] };
  })()`);
  assert(r.skipped && r.lapped && r.counted >= 1 && r.early && r.capped, `no way down: ${JSON.stringify(r)}`);
  eq(g.errors, [], 'no page errors'); await g.page.close();
}
