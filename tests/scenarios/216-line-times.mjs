// The line warning over a building goes by what the guests in line came for (a lodge's lunch line isn't timed as if
// everyone ordered a long evening drink), names a restroom line, and a big lodge's counter keeps its pace when the
// game runs in large steps. From a player's feedback (Nov 10): 30 minute lines with most seats empty.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    openDay(); state.speed = 0; state.time = 720;
    const B = world.buildings.find((b) => b.type === 'lodge'), seats = poolSlots(B, 'seat');
    const line = (n, svc) => Array.from({ length: n }, () => { const p = makeGuest({ id: null }, B.door.x, B.door.z); p.svc = svc; p.bid = B.id; p.st = 'bq'; p.qT = state.time; p.pat = 999; return p; });
    const chip = () => (computeChips().find((c) => c.key === 'B' + B.id) || {}).text || '';
    // a full lodge with a lunch line: seats turn over about every half hour
    B.used.seat = seats; B.q.seat = line(Math.round(seats / 30 * 15), 'food');
    const lunch = [Math.round(lineWait(B, 'seat')), Math.round(estWait(B, 'drinks')), chip()];
    // seats free: only the counter holds the line up
    B.used.seat = Math.round(seats * 0.3);
    const counter = lineWait(B, 'seat') * bspec(B).counter / B.q.seat.length;
    // a restroom line, with nobody waiting for a table
    B.q.seat = []; B.q.rr = line(poolSlots(B, 'rr') * 5, 'rr');
    const rr = chip();
    // a large lodge's counter, stepped as fast-forward does
    B.q.rr = []; B.tier = 2; B.used.seat = 0; B.counterFree = 0; B.q.seat = line(300, 'food');
    const rate = bspec(B).counter; let n0 = B.q.seat.length;
    for (let k = 0; k < 80; k++) { state.time += 1.5 / 60; bldStep(B, 1.5); }
    return { lunch, counter, rr, rate, served: (n0 - B.q.seat.length) / 2, name: B.name };
  })()`);
  eq(r.lunch.slice(0, 2), [15, 26], 'a lunch line is timed by lunch, not by the long drinks the lodge also serves');
  eq(r.lunch[2], `${r.name} · 15 min line`, 'the warning shows the lunch wait');
  assert(Math.abs(r.counter - 1) < 0.01, `with seats free, the wait is the counter's pace (${r.counter})`);
  eq(r.rr, `${r.name} · 20 min restroom line`, 'a restroom line is named');
  assert(Math.abs(r.served - r.rate) <= 1, `a large lodge serves about ${r.rate} a minute in big steps (${r.served})`);
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
