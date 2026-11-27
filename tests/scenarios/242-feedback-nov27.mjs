// Adum888's and Zac's feedback (4.19): base guns don't double up on a guest area's own guns; a bare guest area
// matters; guests ski the slope, not the sign; village gondolas show riders and lines; renters find a shop with skis.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 5e6; state.reputation = 1.1`);

  // Base guns skip the squares a guest area's own guns cover.
  const guns = await g.ev(`(() => {
    state.baseSm = { mode: 'always', target: 18 };
    const bz = baseZone(), before = baseGuns(), all0 = smGunsInstalled();
    const keyOf = (k) => cellKey(k % NV - HALF, Math.floor(k / NV) - HALF);
    const A = { id: world.nextId++, name: 'Base test', kind: 'hub', cells: bz.slice(0, Math.floor(bz.length * 0.6)).map(keyOf), cost: 0 };
    addArea(A); computeNetwork();
    const noGuns = baseGuns();
    A.sm = { on: true, mode: 'always', target: 18 };
    const half = baseGuns(), all1 = smGunsInstalled(), gun = gunCount(A), run = runSnowmaking(-20);
    A.cells = bz.map(keyOf); A.set = new Set(A.cells);
    const none = baseGuns(), runNone = runSnowmaking(-20);
    select({ kind: 'manage', obj: 'snow' }); const card = $('sheet').innerText;
    removeArea ? removeArea(A) : world.areas.splice(world.areas.indexOf(A), 1); computeNetwork(); state.baseSm = null;
    return { zone: bz.length, before, noGuns, half, gun, all0, all1, none, runBase: run.base, noneBase: runNone.base, card };
  })()`);
  assert(guns.zone > 60, `the starter base has a base area (${guns.zone} squares)`);
  eq(guns.noGuns, guns.before, 'a guest area without guns leaves the base guns as they were');
  assert(guns.half < guns.before && guns.half > 0, `guns on the guest area take its squares off the base guns (${guns.before} → ${guns.half})`);
  eq(guns.all1, guns.all0 - guns.before + guns.half + guns.gun, 'the gun count adds the area once');
  eq([guns.none, guns.noneBase, guns.runBase], [0, false, true], 'a guest area covering the whole base leaves the base guns idle');
  assert(/cover the whole base area/.test(guns.card), 'the snow panel says the guest area covers it');

  // A bare guest area: guests carry their skis across, slower, and it stings once.
  const bare = await g.ev(`(() => {
    const cells = []; for (let x = -70; x <= -50; x++) for (let z = -10; z <= 10; z++) cells.push(cellKey(x, z));
    const A = { id: world.nextId++, name: 'Upper Deck', kind: 'hub', cells, cost: 0 }; addArea(A); computeNetwork();
    for (const k of cells) NS[Math.round(keyZ(k) + HALF) * NV + Math.round(keyX(k) + HALF)] = 0;
    today = newToday(); today.bareHubs = [A.id];
    const to = { x: -52, z: 8 }; A.routes.set(cellKey(to.x, to.z), hubFlood(A.set, cellKey(to.x, to.z)));
    const walk = () => { const q = { id: -5, x: -68, z: -8, then: null, sat: 80, th: [] }; walkHub(q, A, to, { k: 'test' }); return q; };
    const a = walk(), b = walk(); b.mud = 0;
    const c = (() => { const q = { id: -6, x: -68, z: -8, then: null, sat: 80, mud: 1, th: [] }; walkHub(q, A, to, { k: 'test' }); return q; })();
    today.bareHubs = []; const d = walk();
    select({ kind: 'area', obj: A }); const card = $('sheet').innerText;
    return { sat: [a.sat, c.sat, d.sat], sp: [a.then.sp, d.then.sp], n: today.complaints.hubMud, hubMud: today.hubMud[A.id], card, depth: hubDepth(A) };
  })()`);
  eq([bare.sat[0], bare.sat[1], bare.sat[2]], [76, 80, 80], 'walking across a bare area stings once a day, a snowy one not at all');
  assert(bare.sp[0] <= 1.18 * 0.75 + 0.01, `they walk slower over the dirt (${bare.sp})`);
  assert(bare.n >= 2 && bare.hubMud >= 2, 'the day counts them by area');
  assert(/Bare: it needs/.test(bare.card), 'the guest area card says it is bare');

  // Guests choose by the sign but ski the slope.
  const sign = await g.ev(`(() => {
    const T = realTrails()[0], keep = T.an.rating; T.an.rating = 2; T.sign = 1;
    today = newToday();
    const mk = () => ({ id: -7, ab: 1, pref: 1, sat: 60, seen: {}, fat: 0, vert: 0, learnLaps: 5, explore: 0, qh: 1, th: [] });
    const fresh = trailFit(T, mk()), after = mk(); runDone(after, T); const knows = trailFit(T, after);
    const steep = today.complaints.steep, mis = today.complaints.misSign;
    T.sign = 2; const honest = mk(); runDone(honest, T);
    select({ kind: 'trail', obj: T }); T.sign = 1; renderSheet(); const card = $('sheet').innerText;
    T.an.rating = keep; T.sign = null;
    return { fresh, knows, sat: after.sat, honest: honest.sat, steep, mis, card };
  })()`);
  assert(sign.fresh > 0, `a blue sign draws an intermediate (${sign.fresh})`);
  assert(sign.sat < 60 && sign.knows < 0, `the black slope under it is too steep, and they know it next time (${sign.sat}, ${sign.knows})`);
  eq([sign.steep, sign.mis], [1, 1], 'the day counts it as a mis-signed run');
  assert(sign.honest > sign.sat && sign.honest < 60, `the same black signed honestly is still too steep for them, but it stings less (${sign.honest} vs ${sign.sat})`);
  assert(/they go slower, fall more/.test(sign.card), 'the trail card warns about the sign');

  // Village gondolas count the guests riding and in line at both ends.
  const vg = await g.ev(`(() => {
    const L = { id: -77, type: 'village', xq: { a: [1, 2, 3], b: [4] } };
    guests.push({ id: -78, st: 'xride', xLid: -77 }, { id: -79, st: 'xq', xLid: -77 });
    const r = { line: liftInLine(L), up: liftRiding(L), wait: liftWaitShown(L) };
    guests.splice(-2, 2); return r; })()`);
  eq([vg.line, vg.up], [4, 1], 'a village gondola counts both lines and its riders');
  assert(vg.wait > 0, 'and shows a wait');

  // Renters head for a shop that still has skis.
  const rent = await g.ev(`(() => {
    const shops = [];
    for (const [x, z] of [[-6, 62], [30, 60], [-10, 56], [34, 54], [16, 66], [-14, 64], [28, 66], [-2, 66], [38, 60], [-18, 58]]) for (const r of [0, Math.PI / 2]) {
      if (shops.length >= 2) break; const b = evalBuilding('rental', x, z, r); if (!b.problems.length) { shops.push(commitBuilding(b, 'rental', x, z, r) || world.buildings.at(-1)); computeNetwork(); }
    }
    if (shops.length < 2) return null;
    let seed = 5; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    demandForDay = () => 900; state.phase = 'closed'; state.time = DAY_OPEN; openDay(); state.speed = 0;
    const [A, B] = shops; A.rented = Math.ceil(bspec(A).inventory / AGENT); // the first shop is out of skis
    const r0 = B.rented;
    for (let n = 0; state.phase === 'open' && state.time < 11 * 60 && n < 30000; n++) { simStep(1.5); A.rented = Math.max(A.rented, Math.ceil(bspec(A).inventory / AGENT)); }
    return { out: today.complaints.rentOut, second: B.rented - r0, noRental: today.complaints.noRental };
  })()`);
  assert(rent, 'two rental shops were built');
  assert(rent.second > 0, `renters went to the shop with skis (${rent.second})`);
  eq(rent.out, 0, 'nobody gave up on rentals while another shop had skis');
  eq(g.errors, [], 'no errors');
  await g.page.close();
  return `base guns ${guns.before} → ${guns.half}, mis-signed sat ${sign.sat}, second shop rented ${rent.second}`;
}
