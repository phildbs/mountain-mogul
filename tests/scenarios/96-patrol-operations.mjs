// Plan-wide staffing overrides preserve manual hut teams and today's frozen plan.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => {
    state.cash = 2e7; const base = world.buildings[0], huts = [];
    for (let dz = -12; dz <= 20 && huts.length < 2; dz += 4) for (let dx = -24; dx <= 24 && huts.length < 2; dx += 4) {
      const x = base.x + dx, z = base.z + dz, info = evalBuilding('patrol', x, z, 0);
      if (!info.problems.length) huts.push(commitBuilding(info, 'patrol', x, z, 0));
    }
    if (huts.length !== 2) throw Error('Need two legal patrol sites');
    window.__opsHuts = huts.map(B => B.id);
    huts[0].patrollers = 1; huts[1].patrollers = 4; huts.forEach(resetPatrolCrew);
    openManage('ops'); opsEdit = planFor(state.day); renderSheet();
  })()`);
  eq(await g.ev(`__opsHuts.map(id => bldById(id)).map(B => B.crew.length)`), [1, 4], 'manual mode starts with independent teams');
  await g.click('[data-action="opsPatrolOverride"]');
  for (let i = 0; i < 3; i++) await g.click('[data-action="opsPatrolCount"][data-d="1"]');
  eq(await g.ev(`__opsHuts.map(id => bldById(id)).map(B => [patrolSize(B), B.crew.length, bspec(B).upkeep])`), [[1, 5, 2225], [4, 5, 2225]], 'override staffs every hut without replacing manual choices');
  assert(await g.ev(`(() => { const P = opsState().plans[opsEdit]; return planRunCost(P) > planRunCost({...P, patrolCount: null}); })()`), 'plan estimates use the override count');
  await g.ev(`select({kind:'bld', obj:bldById(__opsHuts[0])})`);
  await g.click('[data-action="patrolStaff"][data-d="1"]');
  eq(await g.ev(`(() => { const B=bldById(__opsHuts[0]); return [patrolSize(B),B.crew.length,/Operations overrides this hut/.test(sheet.textContent)]; })()`), [2,5,true], 'hut panel can save a manual choice while explaining the override');
  await g.ev(`openManage('ops'); renderSheet()`);
  await g.click('[data-action="opsPatrolOverride"]');
  eq(await g.ev(`__opsHuts.map(id => bldById(id)).map(B => B.crew.length)`), [2,4], 'turning override off restores each team');
  eq(await g.ev(`(() => {
    const P=opsState().plans[opsEdit]; P.patrolCount=6;
    const other=OPS_KINDS.find(([k])=>k!==opsEdit)[0];
    const B=bldById(__opsHuts[0]);
    const distinct=[patrolTeamSize(B,P),patrolTeamSize(B,opsState().plans[other])];
    const saved=saveData(false); applySave(saved);
    const restored=patrolTeamSize(bldById(__opsHuts[0]));
    openDay(); const active=runOps.kind, before=bldById(__opsHuts[0]).crew.length;
    opsEdit=active; opsAction('opsPatrolCount',{dataset:{d:'-1'}});
    const unchanged=[patrolTeamSize(bldById(__opsHuts[0])),bldById(__opsHuts[0]).crew.length];
    const sim=serializeSim(); restoreSim(sim);
    const afterLoad=[patrolTeamSize(bldById(__opsHuts[0])),bldById(__opsHuts[0]).crew.length];
    const next=opsState().plans[active].patrolCount;
    visiting=true; opsAction('opsPatrolOverride',{dataset:{}}); visiting=false;
    return {distinct,restored,before,unchanged,afterLoad,next,visit:opsState().plans[active].patrolCount};
  })()`), {distinct:[6,2],restored:6,before:6,unchanged:[6,6],afterLoad:[6,6],next:5,visit:5}, 'plan isolation, save/reload, tomorrow-only changes and visit protection');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
