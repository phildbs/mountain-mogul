// Patrol headcount is exact; wages are paid once, outside general staffing multipliers.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const delta = await g.ev(`(() => {
    state.cash=2e7; state.day=37;
    const P=blankPlan(), before=planCosts(P), base=world.buildings[0]; let B;
    for(let dz=-12;dz<=16&&!B;dz+=4) for(let dx=-20;dx<=20&&!B;dx+=4){
      const x=base.x+dx,z=base.z+dz,info=evalBuilding('patrol',x,z,0);
      if(!info.problems.length) B=commitBuilding(info,'patrol',x,z,0);
    }
    if(!B)throw Error('No patrol site'); window.__payHut=B.id;
    B.patrollers=1; resetPatrolCrew(B);
    const after=planCosts(P);
    openManage('ops'); opsEdit='weekday'; renderSheet();
    return [after.staff-before.staff,after.upkeep-before.upkeep,planRunCost(P)-(before.staff+before.lifts+before.upkeep+before.parking+before.shuttles)];
  })()`);
  eq(delta,[425,100,525],'one patroller adds only wages and hut upkeep, with no extra building staff');
  eq(await g.ev(`[document.querySelectorAll('[data-action="opsPatrol"]').length, document.querySelectorAll('[data-action="opsStaff"]').length]`),[0,3],'old patrol controls gone; other staffing controls retained');
  const matrix=await g.ev(`(() => {
    const B=bldById(__payHut), rows=[];
    for(const staff of ['lean','normal','extra']) for(let n=1;n<=6;n++){
      const P={...blankPlan(),staff,patrolCount:n,patrol:'skeleton'},c=planCosts(P);
      rows.push({staff,n,pay:c.patrol,other:c.other,total:c.staff,upkeep:c.upkeep});
    }
    const P={...blankPlan(),patrolCount:6,bld:{[B.id]:'closed'}};
    return {rows,closed:planCosts(P).patrol,hut:bldUpkeep(B,'closed',P),cost:patrolDailyCost(B,P)};
  })()`);
  assert(matrix.rows.every(r=>r.pay===r.n*425&&r.total===r.other+r.pay),'all six counts have exact wages independent of staffing or legacy skeleton');
  assert(['lean','normal','extra'].every(staff=>new Set(matrix.rows.filter(r=>r.staff===staff).map(r=>r.other)).size===1),'changing patrol count cannot change other payroll');
  assert(matrix.rows[0].other<matrix.rows[6].other&&matrix.rows[6].other<matrix.rows[12].other,'lean/normal/extra still affects other employees');
  eq([matrix.closed,matrix.hut,matrix.cost],[0,100,100],'closed hut pays upkeep and no patroller wages');
  const ledger=await g.ev(`(() => {
    const B=bldById(__payHut); B.patrollers=4;
    const P=opsState().plans.weekday; P.staff='extra';P.patrolCount=3;P.patrol='skeleton';
    openDay(); schedule=[];
    const duty=patrolDuty(B), crew=B.crew.length, snapshot=planCosts(runOps,0);
    for(const k of Object.keys(today.exp))today.exp[k]=0;
    today.injuries=2;today.helped=2;today.unhelped=0;today.glades={};
    const cash=state.cash;endDay();const r=state.lastReport;
    return {duty,crew,staff:r.exp.staff,expected:snapshot.staff,pay:r.payroll.patrol,other:r.payroll.other,
      cash:Math.round(cash-state.cash),expenses:Object.values(r.exp).reduce((a,b)=>a+b,0),claims:r.exp.claims,
      hutProfit:B.yday.profit,report:/Patroller wages/.test($('rpBody').textContent)};
  })()`);
  eq([ledger.duty,ledger.crew,ledger.pay,ledger.claims],[3,3,1275,0],'exact crew and pay; legacy skeleton cannot create claims for rescued guests');
  eq(ledger.staff,ledger.expected,'actual payroll matches the plan estimate with zero guests');
  eq(ledger.staff,ledger.pay+ledger.other,'payroll breakdown reconciles');
  eq(ledger.cash,ledger.expenses,'cash deduction equals every reported expense exactly once');
  eq(ledger.hutProfit,-1375,'hut financial panel includes its wages and upkeep once');
  assert(ledger.report,'day report shows patrol payroll separately');
  const missed=await g.ev(`(() => {
    state.phase='closed';state.day=37;openDay();schedule=[];
    today.injuries=1;today.helped=0;today.unhelped=1;today.glades={};
    const random=Math.random;try { Math.random=()=>0;endDay(); } finally { Math.random=random; }
    return state.lastReport.exp.claims;
  })()`);
  eq(missed,9000,'one missed rescue can produce one claim, without a skeleton flag or double-counting the injury');
  eq(g.errors,[],'no page errors');await g.page.close();
}
