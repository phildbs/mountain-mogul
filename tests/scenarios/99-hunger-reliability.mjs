import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { hungerCases } from '../hunger-cases.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`openDay(); state.speed = 0`);
  eq(await g.ev(`(${hungerCases.toString()})()`), {lateSearch:true,priceRetries:true,outcomes:true,safeRoutes:true}, 'late meals, retries, reporting and safe connected routes');
  // Real map, real movement: the skier takes a connected run toward the base lodge.
  const path = await g.ev(`(() => {
    state.time=740; schedule=[];
    const L=world.lifts[0], B=world.buildings.find(B=>B.type==='lodge'); B.tier=2;
    const p=makeGuest({id:null},L.b.x,L.b.z); Object.assign(p,{ab:3,pref:3,spend:10,lunchAt:700,ate:false,leaveAt:1000,stam:10000,fat:0});
    const plan=mealRoute(p,{k:'top',L});
    const chosen=topDecision(p,L); guests.push(p); gById.set(p.id,p);
    let n=0; while(!p.ate && !p.gone && state.time<900 && n++<20000) simStep(1.5);
    return {planned:!!plan,chosen,ate:p.ate,meals:B.today.services.food||0,complaint:today.complaints.food};
  })()`);
  assert(path.planned && path.chosen && path.ate && path.meals>0, `hungry skier actually reaches and eats at the lodge: ${JSON.stringify(path)}`);
  // These fields ride in the existing mid-day save, including retry times and settled totals.
  const restored = await g.ev(`(() => {
    const p=guests.find(p=>p.ate); p.priceRetry={food:{price:state.prices.food}}; p.pricedOut=['food'];
    recordMealOutcome(p); const before={meals:{...today.meals},retry:p.priceRetry,recorded:p.mealRecorded};
    const id=p.id; restoreSim(JSON.parse(JSON.stringify(serializeSim()))); const q=gById.get(id); recordMealOutcome(q);
    return {before,after:{meals:today.meals,retry:q.priceRetry,recorded:q.mealRecorded}};
  })()`);
  eq(restored.after,restored.before,'reload preserves retry state and does not double-count settled meals');
  // Older saves have no outcome fields and used ate+skipped for a rejected meal.
  eq(await g.ev(`(() => { const sv=JSON.parse(JSON.stringify(serializeSim())); delete sv.today.meals;
    sv.today.complaints.food=99; sv.today.hungry={price:99,line:{},nowhere:{},late:0};
    const p=sv.guests[0]; p.ate=true;p.skipped=true;p.lunchAt=700;p.leaving=false;delete p.mealRecorded;
    restoreSim(sv);return [today.complaints.food,today.hungry,needs(guests[0]).includes('lunch')]; })()`),[0,null,true],'old delay counters do not become missed meals and skipped guests can retry');
  eq(g.errors, [], 'no page errors'); await g.page.close();

  const t=await openGame(browser,url,{mountain:'twin'}); await t.click('#startBtn'); await t.wait(300);
  const isolated=await t.ev(`(() => {
    openDay();state.speed=0;state.time=720;
    const a={x:lotSite(0).x,z:lotSite(0).z},b={x:lotSite(1).x,z:lotSite(1).z};
    const B={id:999991,type:'lodge',tier:2,name:'Other base',door:b,seatsW:[],isBase:true};initBldSim(B);
    const p=makeGuest({id:null},a.x,a.z);p.lunchAt=700;
    return bestVisit(p,a,1,true,[B],['lunch'])===null;
  })()`);
  assert(isolated,'base-wide food search does not walk straight across to the other base');
  eq(t.errors, [], 'no twin-base page errors'); await t.page.close();
}
