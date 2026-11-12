// Players' feedback, Nov 11 (summer is behind ?summer=1): a zip line can start at a lift's mid-station; bike trails can
// branch off and run into each other, and have room for 80 points; and the map's colour button steps through
// steepness, snow depth and night skiing.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const toSummer = `(() => { state.day = 150; state.phase = 'season'; nextDay(); })()`;
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?summer=1' });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev('state.cash = 2e7');

  // 1) The map's colours: steepness, snow depth, night skiing, off. Trails take the snow and night colours.
  const m = await g.ev(`(() => { const out = [], T = realTrails()[0]; T.lit = true;
    for (let k = 0; k < 4; k++) { cycleMapView(); out.push({ slope: overlay.slope, snow: overlay.snow, lit: overlay.lit, legend: !$('legend').hidden,
      which: ['lgSlope', 'lgSnow', 'lgLit'].filter((id) => !$(id).hidden), trail: '#' + T.mesh.material.color.getHexString() }); }
    T.lit = false; return out; })()`);
  eq(m.map((x) => [x.slope, x.snow, x.lit, x.legend]), [[true, false, false, true], [false, true, false, true], [false, false, true, true], [false, false, false, false]], 'steepness → snow depth → night skiing → off');
  eq(m.slice(0, 3).map((x) => x.which), [['lgSlope'], ['lgSnow'], ['lgLit']], 'each with its own key');
  eq(m[2].trail, '#ffc23d', 'a lit trail shows gold on the night skiing map');
  assert(['#4f86e0', '#e0a23a', '#d2452f'].includes(m[1].trail), `a trail shows its base on the snow depth map (${m[1].trail})`);

  // 2) Bike trails: 80 points; a branch off one trail that runs back into it further down.
  await g.ev(toSummer);
  const b = await g.ev(`(() => { const [A] = demoBike(); if (!A) return 'no trail'; const S = bikeTrack(A).S, n = S.length;
    const i1 = Math.floor(n * 0.25), i2 = Math.floor(n * 0.7); let v = null;
    for (const off of [2.2, -2.2, 1.6, -1.6, 1, -1, 0.5]) { const pts = [];
      for (let i = i1; i <= i2; i += 12) { const a = S[i], q = S[Math.min(n - 1, i + 1)], dx = q.x - a.x, dz = q.z - a.z, d = Math.hypot(dx, dz) || 1, o = i === i1 ? 0 : off; pts.push({ x: a.x - dz / d * o, z: a.z + dx / d * o }); }
      pts.push({ x: S[i2].x, z: S[i2].z }); const w = evalChain(pts, 'bike'); if (!w.problems.length) { v = w; break; } v = v || w; }
    if (v.problems.length) return v.problems.join(' | ');
    const B = commitBuilding(v, 'bike', v.x, v.z, 0), J = bikeNet(), ja = J.get(A.id), jb = J.get(B.id);
    select({ kind: 'bld', obj: B }); const card = $('sheet').innerText;
    // a rider on the first trail, just above the branch, turns onto it (chance forced), then merges back in
    state.sum.wx = { type: 'sumsun', hi: 80, lo: 55, snow: 0, wind: 5 }; openDay(); state.speed = 0;
    const rnd = Math.random; Math.random = () => 0;
    const r = guests[0] || makeGuest({ id: -1, ab: 2, members: [] }, S[0].x, S[0].z); r.ab = 2; r.bike = true; r.st = 'bike'; r.bkB = A.id; r.bs = ja.br[0].s - 0.05; r.bikeRuns = 0; r.seen = {};
    const dbg = { mode: bldMode(B), rate: bikeRateDown(B), ab: r.ab, s0: r.bs, brs: ja.br[0].s };
    for (let k = 0; k < 200 && r.bkB === A.id && r.bs <= ja.br[0].s + 0.5; k++) bikeMove(r, 0.5);
    dbg.s1 = r.bs; dbg.k = r.bkB; const turned = r.bkB === B.id; if (!turned) return JSON.stringify(dbg);
    let k = 0; while (r.bkB === B.id && k++ < 5000) bikeMove(r, 0.5);
    Math.random = rnd;
    return { max: CHAIN.bike.max, branches: ja.br.map((x) => x.id), into: jb.into && jb.into.id, at: jb.into && Math.abs(jb.into.s - i2 * 0.5) < 1.5, turned, back: r.bkB === A.id, s: r.bs > ja.br[0].s,
      card: /branches off/.test(card) && /runs into/.test(card) }; })()`);
  assert(typeof b === 'object', `branch built (${b})`);
  eq([b.max, b.branches.length, !!b.into, b.at, b.turned, b.back, b.s, b.card], [80, 1, true, true, true, true, true, true], 'a branch off the trail that runs back into it: riders turn onto it, then carry on down the first trail');
  const rule = await g.ev(`(() => { const L = world.lifts[0], v = evalChain([{ x: L.a.x + 30, z: L.a.z - 30 }, { x: L.a.x + 31, z: L.a.z - 20 }], 'bike'); return v.problems.join(' | '); })()`);
  assert(/or on another bike trail/.test(rule), `the rules say a trail can start or end on another bike trail: ${rule}`);

  // 3) A zip line from a lift's mid-station.
  const z = await g.ev(`(() => { const L = world.lifts[0]; let mid = null;
    for (const s of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65]) if (!L.mid && addMid(L, s, false)) mid = s;
    if (!L.midUp) return 'no mid-station';
    const M = L.midUp.a, dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, d = Math.hypot(dx, dz); let ok = null;
    for (const side of [3, -3, 4, -4]) for (const back of [-10, -14, -18, -8]) for (const o of [-8, 8, -11, 11, 14, -14]) {
      if (ok) break; const t = { x: M.x - dz / d * side, z: M.z + dx / d * side }, bot = { x: L.a.x + dx / d * back - dz / d * o, z: L.a.z + dz / d * back + dx / d * o };
      if (!isBase(bot)) continue; const v = evalChain([t, bot], 'zip'); if (!v.problems.length) ok = v; }
    if (!ok) return 'no zip spot: ' + evalChain([{ x: M.x + 3, z: M.z }, L.a], 'zip').problems.join(' | ');
    return { mid, lift: !!zipLiftAt({ x: M.x, z: M.z }), built: !!commitBuilding(ok, 'zip', ok.x, ok.z, 0) }; })()`);
  assert(typeof z === 'object', `zip at the mid-station (${z})`);
  eq([z.lift, z.built], [true, true], 'a zip line can start beside a mid-station');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
