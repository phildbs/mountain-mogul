// Mountain coaster and zip line (hidden until 4.0 behind ?summer=1). Both are drawn as chains: the coaster from its
// station at the base up the mountain, the zip line from a tower by a lift's top down to a base. The coaster runs all
// year (skiers take a break on it), the zip line only in summer. Riders pay each ride.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const toSummer = `(() => { state.day = 150; state.phase = 'season'; nextDay(); })()`;
const play = (until = 99999) => `(() => { let n = 0; while (state.phase === 'open' && state.time < ${until} && n++ < 80000) simStep(1.5); })()`;
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?summer=1' });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  eq(await g.ev(`BGROUPS.find((x) => x[0] === 'summer')[2]`), ['pavilion', 'coaster', 'zip'], 'the rides sit under Build › Summer');

  // the rules
  const rules = await g.ev(`(() => { const L = world.lifts[0], dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, d = Math.hypot(dx, dz), at = (s, o) => ({ x: L.a.x + dx / d * s - dz / d * o, z: L.a.z + dz / d * s + dx / d * o });
    const has = (v, re) => v.problems.some((p) => re.test(p));
    return {
      upFirst: has(evalChain([at(d - 4, 9), at(d - 8, 9)], 'coaster'), /base area|dips/),
      short: has(evalChain([at(1, 9), at(4, 9)], 'coaster'), /climb at least/),
      zipBottom: has(evalChain([at(d + 1, 4), at(d * 0.6, 12)], 'zip'), /bottom tower has to be in a base/),
      zipTop: has(evalChain([at(d * 0.5, 12), at(1, 12)], 'zip'), /top tower beside the top/),
    }; })()`);
  eq(rules, { upFirst: true, short: true, zipBottom: true, zipTop: true }, 'the coaster starts at the base and climbs; the zip line runs from a lift top to a base');

  // drawing one in the build menu: tap the station, then up the mountain; each tap adds a point
  const draw = await g.ev(`(() => { const L = world.lifts[0], dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, d = Math.hypot(dx, dz), at = (s, o) => ({ x: L.a.x + dx / d * s - dz / d * o, z: L.a.z + dz / d * s + dx / d * o });
    setTool('bld'); sheetAct({ dataset: { action: 'pickB', v: 'coaster' }, disabled: false });
    const first = $('sheet').innerText; chainTap(at(1, 9)); const one = $('sheet').innerText; chainTap(at(5, 9)); chainTap(at(30, 9));
    const n = draft.chain.length; draftUndo(); const after = draft.chain.length; const txt = $('sheet').innerText; setTool('explore');
    return { first: /station goes, in a base area/.test(first), one: /Tap up the mountain|up the mountain/.test(one), n, after, cost: /\$/.test(txt) }; })()`);
  eq(draw, { first: true, one: true, n: 2, after: 1, cost: true }, 'drawing a coaster: station first, a tap too far is refused, undo takes a point off');
  // built beside the lift (free, as the preview does); the ground stays as it was
  const h0 = await g.ev(`(() => { const L = world.lifts[0]; return Math.round(heightAt(L.a.x - 6, L.a.z) * 100); })()`);
  const made = await g.ev(`demoRides().map((B) => [B.type, B.pts.length, Math.round(rideTrack(B).L)])`);
  eq(made.map((m) => m[0]), ['coaster', 'zip'], 'a coaster and a zip line');
  assert(made[0][1] >= 5 && made[0][2] > 20, `the coaster's track runs up the mountain (${JSON.stringify(made)})`);
  const ground = await g.ev(`world.buildings.filter(isRide).map((B) => Math.abs(rideY0(B) - heightAt(B.x, B.z)) < 1.5 && heightAt(B.x, B.z) > 1)`);
  eq(ground, [true, true], 'rides sit on the ground, which isn’t dug out');
  eq(await g.ev(`world.buildings.filter(isRide).map((B) => bldModeIn(opsState().plans.weekend, B))`), ['open', 'closed'], 'in winter the coaster runs and the zip line is shut');

  // a winter day: skiers take a coaster break
  await g.ev(`(() => { openDay(); })()`); await g.ev(play());
  const w = await g.ev(`(() => { const r = state.lastReport; return { rides: r.rides, rev: r.rev.rides, left: guests.length, txt: $('rpBody').textContent }; })()`);
  assert(w.rides && w.rides.coaster > 0 && w.rides.zip === 0, `skiers rode the coaster in winter (${JSON.stringify(w.rides)})`);
  eq(w.rev, w.rides.coaster * 15, 'each ride paid $15');
  assert(/Coaster and zip line/.test(w.txt) && /rides on the mountain coaster/.test(w.txt), 'the day report counts them');
  eq(g.errors, [], 'no page errors on a winter day');
  await g.ev(`nextDay()`);

  // a summer day: both run; a save in the middle keeps riders where they are
  await g.ev(toSummer);
  await g.ev(`(() => { state.sum.wx = { type: 'sumsun', hi: 80, lo: 55, snow: 0, wind: 5 }; openDay(); })()`); await g.ev(play(790));
  const mid = await g.ev(`(() => { const c = {}; for (const x of guests) c[x.st] = (c[x.st] || 0) + 1; return c; })()`);
  assert((mid.coast || 0) + (mid.zip || 0) + (mid.rq || 0) > 0, `summer guests are on the rides (${JSON.stringify(mid)})`);
  eq(await g.ev(`new Set(guests.map((x) => Object.keys(x).join(','))).size`), 1, 'summer guests (riders, sightseers) keep one object shape, so days stay quick');
  const saved = await g.ev(`(() => { const n = guests.filter((x) => ['coast', 'zip', 'rq'].includes(x.st)).length; applySave(JSON.parse(JSON.stringify(saveData(true)))); return [n, guests.filter((x) => ['coast', 'zip', 'rq'].includes(x.st)).length, state.phase]; })()`);
  eq([saved[0] === saved[1], saved[2]], [true, 'open'], 'a mid-day save keeps riders on the rides');
  await g.ev(play());
  const s = await g.ev(`(() => { const r = state.lastReport; return { rides: r.rides, rev: r.rev.rides, left: guests.length }; })()`);
  assert(s.rides && s.rides.coaster > 0 && s.rides.zip > 0 && s.left === 0, `both rides ran in summer (${JSON.stringify(s)})`);
  eq(s.rev, s.rides.coaster * 15 + s.rides.zip * 35, 'coaster $15 and zip line $35 a ride');
  // their prices sit with the scenic ride
  eq(await g.ev(`(() => { openManage('prices'); const t = $('sheet').textContent; return /Mountain coaster ride price/.test(t) && /Zip line ride price/.test(t); })()`), true, 'their prices are under Scenic rides');
  eq(g.errors, [], 'no page errors');
  return 'coaster and zip line: placing rules, built without digging the ground, coaster rides in winter, both in summer, a mid-day save, prices';
}
