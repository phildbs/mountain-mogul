// Bike trails (hidden until 4.0 behind ?summer=1): narrow dirt trails tapped point by point under Trails, from beside
// the top of a chairlift or gondola from the base down to a base. Riders take their bikes up a lift with bike carriers,
// lap the trails and pay a bike park ticket. Trails wear with laps and rain; the trail crew fixes them overnight.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const toSummer = `(() => { state.day = 150; state.phase = 'season'; nextDay(); })()`;
const play = (until = 99999) => `(() => { let n = 0; while (state.phase === 'open' && state.time < ${until} && n++ < 80000) simStep(1.5); })()`;
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?summer=1' });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);

  // under Trails: the bike trail button starts placing one, a point at a time
  const pick = await g.ev(`(() => { setTool('trail'); renderSheet(); const card = !!$('sheet').querySelector('[data-action=transitPick][data-v=bike]');
    $('sheet').querySelector('[data-action=transitPick][data-v=bike]').click(); const t = $('sheet').innerText;
    const L = world.lifts[0]; chainTap({ x: L.b.x + 4, z: L.b.z }); const one = $('sheet').innerText; setTool('explore');
    return { card, first: /beside the top of a chairlift or gondola/.test(t), second: /Keep (tapping|clicking) down the mountain/.test(one) }; })()`);
  eq(pick, { card: true, first: true, second: true }, 'Trails › Bike trail: start by a lift top, then point by point');

  // the rules: from a lift top, to a base, not too steep
  const rules = await g.ev(`(() => { const L = world.lifts[0], dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, d = Math.hypot(dx, dz), at = (s, o) => ({ x: L.a.x + dx / d * s - dz / d * o, z: L.a.z + dz / d * s + dx / d * o });
    const has = (v, re) => v.problems.some((p) => re.test(p)), straight = [at(d + 0.5, 4)]; for (let s = d - 8; s > 2; s -= 8) straight.push(at(s, 4)); straight.push(at(1, 6));
    return { top: has(evalChain([at(d * 0.5, 8), at(1, 8)], 'bike'), /beside the top of a chairlift/), base: has(evalChain([at(d + 0.5, 4), at(d * 0.6, 6)], 'bike'), /Finish the trail in a base/),
      steep: has(evalChain(straight, 'bike'), /Too steep for bikes/) }; })()`);
  eq(rules, { top: true, base: true, steep: true }, 'it starts at a lift top, ends at a base, and a straight line down is too steep');

  // built (free, as the preview does): a winding trail, carriers on the lift, closed in winter
  const made = await g.ev(`demoBike().map((B) => ({ type: B.type, n: B.pts.length, len: Math.round(bikeTrack(B).L), rating: bikeTrack(B).an.rating, bikes: world.lifts[0].bikes }))`);
  assert(made.length === 1 && made[0].type === 'bike' && made[0].len > 40 && made[0].bikes, `a bike trail from the top of the lift (${JSON.stringify(made)})`);
  eq(await g.ev(`world.buildings.filter(isBike).map((B) => [bldModeIn(opsState().plans.weekend, B), bspec(B).upkeep > 0])`), [['closed', true]], 'shut in winter; its upkeep is the trail crew');
  eq(await g.ev(`(() => { select({ kind: 'lift', obj: world.lifts[0] }); return /bike carriers fitted/.test($('sheet').textContent); })()`), true, 'the lift panel says it carries bikes');

  // a summer day: riders come, lap the trail and pay; a save mid-day keeps them riding
  await g.ev(toSummer);
  await g.ev(`(() => { state.sum.wx = { type: 'sumsun', hi: 80, lo: 55, snow: 0, wind: 5 }; openDay(); })()`); await g.ev(play(780));
  eq(await g.ev(`new Set(guests.map((x) => Object.keys(x).join(','))).size`), 1, 'summer guests keep one object shape, so days stay quick');
  const drawn = await g.ev(`(() => { cam.viewH = 40; drawPeople(); const by = (f) => guests.filter((x) => x.bike && f(x)).length;
    return { trail: by((x) => x.st === 'bike'), chair: by((x) => x.st === 'ride'), other: by((x) => !['bike', 'ride', 'incar', 'inside'].includes(x.st) && !x.gone), bikes: BIKE_FIG.count }; })()`);
  assert(drawn.chair > 0 && drawn.bikes === drawn.trail + drawn.chair + drawn.other, `every rider has a bike: on the trail, on the chair and walking to it; left outside while they eat (${JSON.stringify(drawn)})`);
  const mid = await g.ev(`(() => { const n = guests.filter((x) => x.st === 'bike').length; applySave(JSON.parse(JSON.stringify(saveData(true)))); return [n, guests.filter((x) => x.st === 'bike').length, state.phase, !!guestPos(guests.find((x) => x.st === 'bike') || guests[0])]; })()`);
  assert(mid[0] > 0 && mid[0] === mid[1] && mid[2] === 'open' && mid[3], `riders on the trail, and still there after a mid-day save (${mid})`);
  await g.ev(play());
  const s = await g.ev(`(() => { const r = state.lastReport, B = world.buildings.find(isBike); return { bikes: r.bikes, rev: r.rev.bikes, left: guests.length, txt: $('rpBody').textContent, wear: B.wear }; })()`);
  assert(s.bikes && s.bikes.runs > s.bikes.riders && s.left === 0, `riders lapped the trail (${JSON.stringify(s.bikes)})`);
  eq(s.rev, s.bikes.riders * 55, '$55 a bike park ticket');
  assert(/Bike park tickets/.test(s.txt) && /laps of your bike trails/.test(s.txt), 'the day report counts them');
  assert(s.wear > 0, `the laps wore the trail (${s.wear})`);

  // overnight the crew fixes it; with the crew off, it stays worn and costs nothing
  const crew = await g.ev(`(() => { const B = world.buildings.find(isBike), w = B.wear; summerNext(); const fixed = B.wear < w; B.crewOff = true; B.wear = 0.5; state.sum.wx = { ...state.sum.wx, type: 'sumsun' }; summerNext(); return [fixed, B.wear, bspec(B).upkeep]; })()`);
  eq(crew, [true, 0.5, 0], 'the trail crew fixes the wear overnight; without it the trail stays rough and costs nothing');
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(true))); applySave(sv); const B = world.buildings.find(isBike); return [B.wear, !!B.crewOff, world.lifts[0].bikes]; })()`), [0.5, true, true], 'wear, crew and carriers are saved');
  eq(await g.ev(`(() => { openManage('prices'); return /Bike park day ticket price/.test($('sheet').textContent); })()`), true, 'its price sits with the scenic ride');
  eq(g.errors, [], 'no page errors');
  return 'bike trails: under Trails, placing rules, a winding trail with carriers, shut in winter, a summer day of riders, a mid-day save, wear and the trail crew, price';
}
