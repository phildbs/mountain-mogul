import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const counts = await g.ev(`(() => {
    state.cash = 2e7; const base = world.buildings[0];
    for (const type of ['cafe', 'truck', 'firepit', 'fine']) {
      let placed = false;
      for (let z = -20; z <= 20 && !placed; z += 4) for (let x = -28; x <= 28 && !placed; x += 4) {
        const info = evalBuilding(type, base.x + x, base.z + z, 0);
        if (!info.problems.length) { commitBuilding(info, type, base.x + x, base.z + z, 0); placed = true; }
      }
      if (!placed) throw Error('No site for ' + type);
    }
    openDay(); state.time = 720; schedule = []; guests = []; gById.clear();
    const C = world.buildings.find(B => B.type === 'cafe');
    for (const svc of ['snack', 'warm', 'rr']) {
      const p = makeGuest({id:null}, C.door.x, C.door.z);
      Object.assign(p, {svc, bid:C.id, spend:1000}); guests.push(p); gById.set(p.id,p); serve(p,C);
    }
    const before = { services: {...C.today.services}, visits:C.today.visits, revenue:C.today.revenue };
    restoreSim(JSON.parse(JSON.stringify(serializeSim())));
    return { before, after: { services:C.today.services, visits:C.today.visits, revenue:C.today.revenue }, unit:AGENT,
      text: bldServiceBreakdown(C,C.today,true) };
  })()`);
  eq(counts.before, counts.after, 'service counts, total visits and revenue survive a mid-day reload');
  eq(counts.after.services, {snack:counts.unit,warm:counts.unit,rr:counts.unit}, 'a cafe counts snacks, hot drinks and restrooms separately');
  eq(counts.after.visits, counts.unit*3, 'service rows reconcile to the venue total');
  assert(['Snacks','Hot drinks','Restroom stops'].every(x=>counts.text.includes(x)), 'the venue panel shows each service');
  const queues = await g.ev(`(() => {
    const C = world.buildings.find(B => B.type === 'cafe'), F = world.buildings.find(B => B.type === 'firepit');
    F.used.seat = poolSlots(F,'seat');
    const p = makeGuest({id:null}, F.door.x, F.door.z); p.spend=1000;
    const full = bestVisit(p,F.door,Infinity,false,[F],['warm']) === null;
    const alternative = bestVisit(p,C.door,Infinity,false,[F,C],['warm']).B === C;
    Object.assign(p,{svc:'warm',bid:F.id,resume:{k:'top',lid:world.lifts[0].id}});
    joinBuildingQueue(p,F);
    const noLine = F.q.seat.length===0 && p.bid!==F.id && !p.warmed;
    const results = [];
    for (const [type,svc] of [['truck','snack'],['fine','finedine']]) {
      const B = world.buildings.find(B=>B.type===type); B.door={...C.door}; B.used.seat=poolSlots(B,'seat');
      const q = makeGuest({id:null},B.door.x,B.door.z);
      Object.assign(q,{svc,bid:B.id,st:'bq',qT:state.time-6,pat:100,qLook:0,resume:{k:'top',lid:world.lifts[0].id}});
      B.q.seat=[q]; bldStep(B);
      results.push(B.q.seat.length===0 && q.bid!==B.id && q.avoidB===B.id);
    }
    return {full,alternative,noLine,results};
  })()`);
  eq(queues, {full:true,alternative:true,noLine:true,results:[true,true]}, 'full fires do not queue warm-ups; snack and fine-dining guests can switch to a faster venue');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
