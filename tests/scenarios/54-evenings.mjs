// Evenings: lamp posts and fire pits (anywhere, unlabelled, out of Operations), fire pits draw après guests
// for free, closed buildings go dark, and the Evenings panel sets après and night skiing per plan.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const made = await g.ev(`(() => {
    state.cash = 5e6; state.passPrice = 0;
    const place = (type, near, rmin, rmax) => { for (let r = rmin; r <= rmax; r += 0.5) for (let a = 0; a < 24; a++) { const x = Math.round((near.x + Math.cos(a / 24 * 6.283) * r) * 2) / 2, z = Math.round((near.z + Math.sin(a / 24 * 6.283) * r) * 2) / 2; const v = evalBuilding(type, x, z, 0, false); if (!v.problems.length) { commitBuilding(v, type, x, z, 0); computeNetwork(); return type; } } return null; };
    const lodge = world.buildings.find((B) => B.type === 'lodge');
    const bar = place('bar', lodge.door, 6, 20), school = place('school', lodge.door, 8, 30);
    const barB = world.buildings.find((B) => B.type === 'bar');
    const fire = place('firepit', barB.door, 2.5, 8), lamp = place('lamp', barB.door, 2, 8);
    // a fire pit up the mountain, by the top of the lift
    const L = world.lifts[0], top = place('firepit', L.b, 3, 10);
    syncLabels();
    return [bar, school, fire, lamp, top];
  })()`);
  eq(made, ['bar', 'school', 'firepit', 'lamp', 'firepit'], 'built a bar, school, two fire pits (one up top) and a lamp');
  eq(await g.ev(`world.buildings.filter(isDecor).map((B) => !!B.labelEl)`), [false, false, false], 'lamp posts and fire pits have no labels');
  eq(await g.ev(`realBlds().map((B) => B.type).sort()`), ['bar', 'lodge', 'school'], 'and don’t count as buildings');
  await g.ev(`(() => { opsEdit = null; openManage('ops'); opsFold.blds = true; renderSheet(); })()`);
  assert(!/Fire pit|Lamp post/.test(await g.ev(`$('sheet').textContent`)), 'not in the Operations lists');
  // Evenings panel sets après and night skiing for the plan being edited
  await g.ev(`(() => { opsEdit = 'weekday'; openManage('evenings'); })()`);
  await g.click('[data-action=opsApres][data-v=on]'); await g.wait(50);
  eq(await g.ev(`opsState().plans.weekday.apres`), 'on', 'Evenings turns après on for weekdays');
  eq(await g.ev(`opsState().plans.weekend.apres || 'off'`), 'off', 'other plans unchanged');
  await g.ev(`(() => { for (const k of ['weekday', 'weekend', 'quiet']) opsState().plans[k].apres = 'on'; select(null); })()`);
  // by day, the fire pit up top gives free warm-ups
  await g.ev(`openDay()`);
  await g.ev(`(() => { let n = 0; while (state.time < 1000 && n < 99999) { simStep(1.5); n++; } })()`);
  const fires = await g.ev(`world.buildings.filter((B) => B.type === 'firepit').map((B) => ({ visits: B.today.visits, rev: B.today.revenue }))`);
  assert(fires.some((f) => f.visits > 0) && fires.every((f) => f.rev === 0), `fire pits used, free: ${JSON.stringify(fires)}`);
  // after the lifts close: the school is dark, the bar and fire pits lit
  eq(await g.ev(`['school', 'bar', 'firepit', 'lamp'].map((t) => bldLitNow(world.buildings.find((B) => B.type === t)))`), [false, true, true, true], 'closed buildings go dark at night');
  eq(await g.ev(`(() => { updateEveningGlow(); return world.buildings.find((B) => B.type === "school").glowMat.color.getHex() === WIN_OFF; })()`), true, "school windows off");
  await g.ev(SETUPS.finishDay);
  const a = await g.ev(`state.lastReport.apres`);
  assert(a.venues.some((v) => v.type === 'firepit' && v.guests > 0), `fire pit après guests: ${JSON.stringify(a.venues)}`);
  assert(/free/.test(await g.ev(`document.querySelector('.rp-page[data-page=apres]').textContent`)), 'report shows the fire pit as free');
  // trail light poles: never on another trail's snow, and each arm reaches in over its own trail
  const poles = await g.ev(`(() => { for (const t of realTrails()) t.lit = true; rebuildLights();
    let bad = 0, wrong = 0; const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
    lampSpots.forEach((sp, i) => { lightMesh.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
      if (realTrails().some((t) => t !== sp.t && t.samples.some((q) => Math.hypot(q.x - _p.x, q.z - _p.z) < TRAIL_WIDTHS[t.width].hw))) bad++;
      const d = (x, z) => sp.t.samples.reduce((m, q) => Math.min(m, Math.hypot(q.x - x, q.z - z)), 1e9);
      if (d(sp.x, sp.z) >= d(_p.x, _p.z)) wrong++; });
    return { n: lampSpots.length, bad, wrong }; })()`);
  assert(poles.n > 6 && poles.bad === 0 && poles.wrong === 0, `light poles: ${JSON.stringify(poles)}`);
  // a trail light placed beside a trail faces it, lights up for night skiing, and adds to the night power bill
  const tl = await g.ev(`(() => {
    const T = realTrails()[0], q = T.samples[Math.floor(T.samples.length / 2)], q2 = T.samples[Math.floor(T.samples.length / 2) + 2];
    const dx = q2.x - q.x, dz = q2.z - q.z, L = Math.hypot(dx, dz), hw = TRAIL_WIDTHS[T.width].hw;
    for (const side of [1, -1]) for (const off of [hw + 0.8, hw + 1.3, hw + 2]) {
      const x = Math.round((q.x - dz / L * off * side) * 2) / 2, z = Math.round((q.z + dx / L * off * side) * 2) / 2, v = evalBuilding('tlight', x, z, 0, false);
      if (!v.problems.length) { commitBuilding(v, 'tlight', x, z, 0); computeNetwork(); const B = world.buildings.find((b) => b.type === 'tlight');
        const head = B.lightAt, d = (p) => Math.min(...T.samples.map((s) => Math.hypot(s.x - p.x, s.z - p.z)));
        return { faces: d(head) < d(B), saved: saveData().world.buildings.some((b) => b.type === 'tlight') }; }
    }
    return null; })()`);
  eq(tl, { faces: true, saved: true }, 'trail light faces its trail and is saved');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
