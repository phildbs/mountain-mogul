// Guests use the rental shop, tuning center, ski school, kids' camp and clinic nearest to them, not the first one built.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // two of each, one at each end of the base area
  const built = await g.ev(`(() => {
    state.cash = 1e9;
    const out = {};
    for (const type of ['rental', 'tuning', 'school', 'kids', 'clinic']) {
      out[type] = [];
      for (const xs of [[-40, -10], [50, 20]]) {
        let done = false;
        for (let x = xs[0]; Math.abs(x - xs[1]) > 0 && !done; x += Math.sign(xs[1] - xs[0]) * 2) for (let z = 50; z < 72 && !done; z += 2) for (const r of [0, 1]) {
          const v = evalBuilding(type, x, z, r, false);
          if (!v.problems.length) { commitBuilding(v, type, x, z, r); computeNetwork(); out[type].push(world.buildings.filter((o) => o.type === type && !out[type].includes(o.id)).sort((a, b) => b.id - a.id)[0].id); done = true; break; }
        }
      }
    }
    syncLabels();
    return out;
  })()`);
  for (const [type, ids] of Object.entries(built)) eq(ids.length, 2, `two ${type} buildings`);
  await g.ev(`openDay()`);
  // a guest standing next to the second building of each kind goes there, even though the first was built first
  const picks = await g.ev(`(() => {
    const B = (id) => bldById(id), out = {};
    const at = (id) => { const d = B(id).door; return { x: d.x + 1, z: d.z + 1 }; };
    for (const [type, svc] of [['rental', 'rent'], ['tuning', 'tune'], ['school', 'lesson']]) {
      const ids = ${JSON.stringify(built)}[type];
      out[type] = [nearestOpen(type === 'rental' ? RENTS : [type], at(ids[0]), svc).id === ids[0] || (type === 'rental' && RENTS.includes(nearestOpen(RENTS, at(ids[0]), svc).type)), nearestOpen(type === 'rental' ? ['rental'] : [type], at(ids[1]), svc).id === ids[1]];
    }
    const k = ${JSON.stringify(built)}.kids, c = ${JSON.stringify(built)}.clinic;
    out.kids = [nearestOpen(['kids'], at(k[0])).id === k[0], nearestOpen(['kids'], at(k[1])).id === k[1]];
    out.clinic = [openClinic(at(c[0])).id === c[0], openClinic(at(c[1])).id === c[1]];
    return out;
  })()`);
  for (const [k, v] of Object.entries(picks)) eq(v, [true, true], `${k}: nearest one chosen`);
  // and in the sim: arriving guests who want a tune split between the two tuning centers by where they parked
  await g.ev(`(() => { let n = 0; while (state.time < 660 && n < 99999) { simStep(1.5); n++; } })()`);
  const t = built.tuning, used = await g.ev(`[${t[0]}, ${t[1]}].map((id) => bldById(id).today.visits)`);
  assert(used[0] + used[1] > 0, 'some guests got a tune');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
