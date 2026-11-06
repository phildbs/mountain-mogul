// A guest area painted round a lift's top station but missing the square the station stands on (Snowy, Ridgeline,
// Nov 6): the trails start in the area, so they no longer left the station, and the lift said "No trails leave the
// top station". The station's square now joins an area that comes within two squares of it. And an edit that only
// erases squares costs nothing, so the match's change check missed it and the order never went: it counts squares now.
import { openGame, eq, assert } from '../harness.mjs';
const CELLS = [-20578,-28769,-24673,-20577,-16481,-12385,-32864,-28768,-24672,-20576,-16480,-12384,-8288,-32863,-28767,-24671,-20575,-16479,-12383,-8287,-32862,-28766,-24670,-20574,-16478,-12382,-8286,-32861,-28765,-24669,-20573,-16477,-12381,-8285,-28764,-24668,-20572,-16476,-12380,-24667,-20571,-24674,-16482,-12386,-8289,-28770,-20579,-16483,-8290,-24675,-32865,-12387,-28771,-32866,-36961,-36960,-32867,-36959,-36962,-36958,-41056,-41057,-41055,-36963,-41058,-28772,-32868,-41059,-41054,-45153,-45152,-45154,-45151,-36957,-36964,-45155,-49249,-49248,-45150,-49250,-49247,-41060,-49251,-45156,-53345,-53344,-53346,-49246,-49252,-53347,-53343,-57441,-57442,-57440,-53342,-49245,-45149,-41053,-57439,-53341,-45148,-41052,-49244,-36956,-32860,-45147,-41051,-53340,-36955,-49243,-32859,-57438,-57437,-53339,-45146,-41050,-49242,-36954,-28763,-16475,-28762,-24666,-20570,-12379,-16474,-32858,-24665,-32857,-28761,-20569,-36953,-12378,-8284,-8283,-4189,-4190,-4188,-8282,-4187,-4191,-93,-94,-92,-4186,-91,-95,-4192,4003,-96,4002,-4193,4001,-97,-4194,4000,-98,3999,-8291,-4195,-99,3998,-8292,-12388,-16484,-20580,-24676,-53348,-57443,-57444,-57436,-53338,-57435,-45145,-41049,-49241];
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?matchMap=ridge@1', mountain: 'fresh' });
  const r = await g.ev(`(() => { state.cash = 1e8;
    const i = evalLift({ x: -0.796, z: 54.39 }, { x: -3.419, z: -89.42 }, 'hsq'); commitLift(i, 'hsq');
    for (const P of [[[-7.04, -90.44], [-4.43, 56.3]], [[-1.62, -91.65], [12.33, -73.43], [-5.07, -66.07]]]) { const pts = P.map(([x, z]) => ({ x, z, y: heightAt(x, z) })); commitTrail(evalTrail(pts, 'medium'), pts, 'medium'); }
    computeNetwork(); const L = world.lifts[0], before = L.departing.length, top = cellKey(Math.round(L.b.x), Math.round(L.b.z));
    const missing = !${JSON.stringify(CELLS)}.includes(top);
    matchDo('land', { ds: { action: 'areaBuild' }, area: { mode: 'hub', thin: null, cells: ${JSON.stringify(CELLS)} } });
    computeNetwork(); const A = world.areas.find(isHub);
    const s0 = matchSig(); A.cells = A.cells.filter((k) => k !== A.cells[5]); A.set = new Set(A.cells); const s1 = matchSig();
    return { missing, before, after: L.departing.length, inArea: A.set.has(top), hubTop: L.hubTop === A, starts: A.starts.length, reach: realTrails().every((t) => t.reachable), sig: s0 !== s1 }; })()`);
  assert(r.missing && r.before === 2, 'the painted area leaves out the top station’s own square, and two trails leave the top');
  eq([r.inArea, r.hubTop, r.after, r.starts, r.reach], [true, true, 2, 2, true], 'the station joins the area: its trails still leave the top, and every trail is reachable');
  eq(r.sig, true, 'erasing a square of an area counts as a change in a match');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
