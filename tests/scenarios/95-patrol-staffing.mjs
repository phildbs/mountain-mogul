// One build-menu entry, actual staffing buttons, save migration, costs and permissions.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  eq(await g.ev(`(() => { setTool('bld'); draft.btype = null; renderSheet(); return document.querySelectorAll('[data-action="pickB"][data-v="patrol"]').length; })()`), 1, 'one patrol building choice');
  await g.ev(`(() => {
    state.cash = 2e7;
    const base = world.buildings[0]; let B;
    for (let dz = -12; dz <= 16 && !B; dz += 4) for (let dx = -20; dx <= 20 && !B; dx += 4) {
      const x = base.x + dx, z = base.z + dz, info = evalBuilding('patrol', x, z, 0);
      if (!info.problems.length) B = commitBuilding(info, 'patrol', x, z, 0);
    }
    if (!B) throw Error('No patrol site');
    window.__staffId = B.id; window.__staffCash = state.cash;
    setTool('explore'); select({ kind: 'bld', obj: B });
  })()`);
  await g.click('[data-action="patrolStaff"][data-d="-1"]');
  eq(await g.ev(`(() => { const B = bldById(__staffId); return [patrolSize(B), B.crew.length, bspec(B).upkeep, state.cash === __staffCash, document.querySelector('[data-action="patrolStaff"][data-d="-1"]').disabled]; })()`), [1, 1, 525, true, true], 'one-person minimum and no expansion fee');
  eq(await g.ev(`(() => { undoLast(); const B = bldById(__staffId); select({ kind: 'bld', obj: B }); return [patrolSize(B), B.crew.length]; })()`), [2, 2], 'undo restores staffing');
  await g.click('[data-action="patrolStaff"][data-d="-1"]');
  for (let i = 0; i < 5; i++) await g.click('[data-action="patrolStaff"][data-d="1"]');
  eq(await g.ev(`(() => { const B = bldById(__staffId); return [patrolSize(B), B.crew.length, bspec(B).upkeep, document.querySelector('[data-action="patrolStaff"][data-d="1"]').disabled]; })()`), [6, 6, 2650, true], 'six-person maximum updates team and upkeep');
  eq(await g.ev(`(() => {
    const saved = serializeWorld(); rebuildWorld(saved);
    const B = bldById(__staffId); return [B.patrollers, B.crew.length, bspec(B).upkeep];
  })()`), [6, 6, 2650], 'selected team survives save/rebuild');
  eq(await g.ev(`(() => {
    const B = bldById(__staffId), data = serializeWorld(), template = data.buildings.find(b => b.id === B.id);
    data.buildings = data.buildings.filter(b => b.id !== B.id);
    for (let tier = 0; tier < 3; tier++) { const old = { ...template, id: data.nextId++, tier }; delete old.patrollers; data.buildings.push(old); }
    rebuildWorld(data);
    return world.buildings.filter(b => b.type === 'patrol').map(b => [b.tier, patrolSize(b), b.crew.length]);
  })()`), [[0, 2, 2], [0, 4, 4], [0, 6, 6]], 'old teams keep their staffing with one building type');
  eq(await g.ev(`(() => {
    const B = world.buildings.find(b => b.type === 'patrol');
    visiting = true; setPatrolStaff(B, 1); const visit = patrolSize(B); visiting = false;
    openDay(); setPatrolStaff(B, 1); const open = patrolSize(B);
    runOps.patrol = 'skeleton'; B.patrollers = 3;
    return [visit, open, patrolDuty(B), bspec(B).upkeep];
  })()`), [2, 2, 2, 1375], 'visits and open days cannot resize; odd teams round duty up');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
