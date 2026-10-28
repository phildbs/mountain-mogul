// Adjustable patrol teams and the actual lift boarding/unloading path, without guest ride-stat inflation.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const team = await g.ev(`(() => {
    state.cash = 2e7;
    const base = world.buildings[0]; let B;
    for (let dz = -12; dz <= 16 && !B; dz += 4) for (let dx = -20; dx <= 20 && !B; dx += 4) {
      const x = base.x + dx, z = base.z + dz, info = evalBuilding('patrol', x, z, 0);
      if (!info.problems.length) B = commitBuilding(info, 'patrol', x, z, 0);
    }
    if (!B) throw Error('No patrol site');
    window.__patrolId = B.id;
    const original = B.crew.length, footprint = [bspec(B).w, bspec(B).d];
    setPatrolStaff(B, 1); setPatrolStaff(B, 1); const four = B.crew.length;
    setPatrolStaff(B, 1); setPatrolStaff(B, 1); const six = B.crew.length;
    const saved = serializeWorld().buildings.find(b => b.id === B.id);
    return { original, four, six, staff: saved.patrollers, footprint, after: [bspec(B).w, bspec(B).d], upkeep: bspec(B).upkeep };
  })()`);
  eq(team, { original: 2, four: 4, six: 6, staff: 6, footprint: [2.6, 2.2], after: [2.6, 2.2], upkeep: 2650 }, 'teams resize in place and persist their size');
  const lift = await g.ev(`(() => {
    openDay(); state.time = 600; schedule = []; guests = []; gById.clear();
    const B = bldById(window.__patrolId), L = world.lifts[0];
    B.door = { x: L.b.x + (bspec(B).crew - 1) / 2 * 0.35, z: L.b.z }; initBldSim(B);
    const c = B.crew[0]; Object.assign(c, { st: 'back', x: L.a.x, z: L.a.z });
    patrolReturn(c, B, 0); const choseLift = c.st === 'returnwalk' && c.lift === L.id;
    patrolReturn(c, B, 1); const queued = c.st === 'returnqueue';
    const before = today.liftRiders[L.id] || 0;
    loadBottom(L, 0); const boarded = c.st === 'returnride';
    const pose = guestPos({ st: 'ride', L, chair: c.chair, seat: c.seat });
    const statsUnchanged = (today.liftRiders[L.id] || 0) === before;
    unloadTop(L, 0); const arrived = c.st === 'back' && c.x === L.b.x && c.z === L.b.z;
    patrolReturn(c, B, 60); const home = c.st === 'idle';
    Object.assign(c, { st: 'back', x: L.a.x, z: L.a.z }); L.open = false;
    patrolReturn(c, B, 60); const closed = c.st === 'idle' && c.x === L.a.x && c.z === L.a.z;
    return { choseLift, queued, boarded, statsUnchanged, visible: Number.isFinite(pose.y), arrived, home, closed };
  })()`);
  assert(Object.values(lift).every(Boolean), `patrol returns on a chair and stays at base if lifts close: ${JSON.stringify(lift)}`);
  const duty = await g.ev(`(() => {
    const B = bldById(window.__patrolId); initBldSim(B); runOps.patrol = 'skeleton';
    guests = Array.from({length: 6}, (_, i) => ({id: 90000+i, st:'hurt', x:B.door.x+10, z:B.door.z, hurtAt:state.time}));
    guests.forEach(g => gById.set(g.id,g)); patrolStep(0);
    return B.crew.filter(c => c.st === 'go').length;
  })()`);
  eq(duty, 3, 'skeleton staffing dispatches half of a six-person team');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
