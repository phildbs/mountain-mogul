// From RowdyBreaker (Nov 8). 1) After the lifts closed, skiers in line at an upper lift with no lit trail waited there
// all evening while the lift ran empty: now a lift that isn't running for night skiing sends its line away.
// 2) A restaurant up the mountain beside a lit trail was closed for après: now, while night skiing runs, a lodge,
// restaurant, bar or fine dining beside a lit trail night skiers can reach serves après until the lights go out.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);
  // A base lift L and an upper lift M, with one trail off M's top.
  const set = await g.ev(`(() => { const i = evalLift({ x: 22, z: -8 }, { x: 25, z: -38 }, 'double'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'double'); const [L, M] = world.lifts;
    const pts = [[M.b.x + 3, M.b.z + 2], [M.b.x + 8, (M.b.z + 15) / 2], [23, 16]].map(([x, z]) => ({ x, z, y: heightAt(x, z) }));
    const t = evalTrail(pts, 'medium', false, true); if (t.an.problems.length) return t.an.problems.join('|');
    commitTrail(t, pts, 'medium'); computeNetwork(); return true; })()`);
  eq(set, true, 'lifts and trail set up');
  // 1) Only the base lift's trails are lit, so M doesn't run at night. Skiers in its line at closing go.
  const q = await g.ev(`(() => { const [L, M] = world.lifts; for (const t of realTrails()) t.lit = L.departing.includes(t); rebuildLights(); computeNetwork(); nightSetKey = '';
    for (const k of Object.keys(state.ops.plans)) state.ops.plans[k].night = 1260;
    state.day = 41; openDay(); state.speed = 0; let n = 0; while (state.time < closeTime() + 5 && n++ < 90000) simStep(1.5);
    const lit = [liftLit(L), liftLit(M)];
    for (const x of guests.filter((x) => x.st === 'ski').slice(0, 4)) { x.st = 'queue'; x.L = M; x.x = M.a.x; x.z = M.a.z; M.queue.push(x); }
    const before = M.queue.length; n = 0; while (state.time < closeTime() + 25 && n++ < 9000) simStep(1.5);
    return { lit, before, after: M.queue.length, night: nightNow() }; })()`);
  eq(q.lit, [true, false], 'the base lift runs for night skiing, the upper lift does not');
  assert(q.before > 0, `skiers were in the upper lift's line (${q.before})`);
  eq([q.night, q.after], [true, 0], 'after closing, the upper lift no longer keeps a line it will never load');
  // 2) Light M's trail too and put a restaurant beside it, up the mountain.
  const r = await g.ev(`(() => { const [L, M] = world.lifts; const up = M.departing[0]; up.lit = true; rebuildLights(); computeNetwork(); nightSetKey = '';
    const S = up.samples, mid = S[Math.floor(S.length / 2)];
    let B = null;
    for (const d of [6, 7, 8, 9, 10, 11]) for (const s of [1, -1]) for (const r of [0, Math.PI / 2]) { if (B) break;
      const x = mid.x + s * d, z = mid.z, b = evalBuilding('restaurant', x, z, r); if (!b.problems.length) { commitBuilding(b, 'restaurant', x, z, r); computeNetwork(); B = world.buildings.at(-1); } }
    if (!B) return 'no spot for the restaurant';
    runOps.apres = 'on'; runOps.night = 1260; nightSetKey = '';
    const on = { base: B.isBase, stop: up.stops.some((s) => s.B === B), lit: liftLit(M), venue: nightVenue(B), type: apresType(B), close: venueClose(B) };
    const tm = state.time; state.time = 1200; on.open8 = bldOpenNow(B); state.time = 1290; on.open930 = bldOpenNow(B); state.time = tm;
    runOps.night = 0; on.noNight = apresType(B); runOps.night = 1260;
    const P = opsState().plans.weekday; P.apres = 'on'; P.night = 1260; on.panel = apresOpsHtml(P).includes(B.name);
    // a night skier on their last run, who likes après, stops in
    const x = guests.find((x) => x.night) || guests[0]; Object.assign(x, { night: true, leaving: true, apres: true, apresDone: false, apresGuest: false });
    on.need = needs(x).includes('apres'); on.svc = svcFor(B, 'apres');
    return on; })()`);
  assert(typeof r === 'object', `restaurant placed (${r})`);
  eq([r.base, r.stop, r.lit], [false, true, true], 'the restaurant is up the mountain beside a lit trail on a night lift');
  eq([r.venue, r.type], [true, true], 'with night skiing, it counts as an après venue');
  eq(r.close, 1275, 'it serves until 15 minutes after night skiing ends');
  eq([r.open8, r.open930], [true, false], 'open at 8 PM, closed by 9:30');
  eq(r.noNight, false, 'without night skiing nobody can reach it, so no après there');
  eq(r.panel, true, 'the Evenings panel lists it');
  eq([r.need, r.svc], [true, 'apres'], 'a night skier on their last run can stop there for après');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
