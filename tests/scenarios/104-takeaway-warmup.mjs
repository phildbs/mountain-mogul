import { openGame, eq, assert, SETUPS } from '../harness.mjs';

export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => {
    state.cash = 2e7;
    const lodge = world.buildings[0];
    let placed = false;
    for (let z = -20; z <= 20 && !placed; z += 3) for (let x = -24; x <= 24 && !placed; x += 3) {
      const info = evalBuilding('truck', lodge.x + x, lodge.z + z, 0);
      if (!info.problems.length) { commitBuilding(info, 'truck', lodge.x + x, lodge.z + z, 0); placed = true; }
    }
    if (!placed) throw Error('No truck site');
    openDay(); state.time = 720; schedule = []; guests = []; gById.clear();
  })()`);
  const flow = await g.ev(`(() => {
    const B = world.buildings.find(B => B.type === 'truck'), L = world.buildings.find(B => B.type === 'lodge');
    // Controlled nearby doors isolate the sequence from terrain and random placement choices.
    B.door = { ...L.door, x: L.door.x + 2 };
    const p = makeGuest({id:null}, B.door.x, B.door.z), T = world.trails[0];
    Object.assign(p, { fat:70, stam:100, sat:80, warmed:false, ate:false, skipped:false, lunchAt:680,
      leaveAt:1000, leaving:false, night:false, apresGuest:false, sight:false, spend:1000,
      svc:'snack', bid:B.id, resume:{k:'ski', tid:T.id, s:5}, st:'bq', qT:state.time });
    guests.push(p); gById.set(p.id,p);
    B.used.seat = poolSlots(B,'seat'); B.counterFree = state.time; B.q.seat = [p];
    const emptyWait = estWait(B,'snack');
    bldStep(B);
    const servedWhileFull = p.st === 'inside' && B.used.seat > poolSlots(B,'seat') && !p.ate && p.bid === B.id;
    const revenue = B.today.revenue, cogs = B.today.cogs;
    const next = makeGuest({id:null}, B.door.x,B.door.z);
    Object.assign(next,{svc:'snack',bid:B.id,st:'bq',qT:state.time,pat:100}); B.q.seat.push(next);
    bldStep(B);
    const counterLimited = next.st === 'bq' && B.today.revenue === revenue;
    B.q.seat = [];
    state.time = p.until; finishVisit(p);
    const ateThenWarm = p.ate && p.snacked && !p.warmed && p.bid === L.id && p.svc === 'warm'
      && p.resume.k === 'ski' && p.resume.tid === T.id && B.used.seat === poolSlots(B,'seat');
    const mealChargedOnce = B.today.revenue === revenue && B.today.cogs === cogs && B.today.visits === AGENT;
    joinBuildingQueue(p,L); bldStep(L);
    const warming = p.st === 'inside' && L.today.services.warm === AGENT && !p.warmed;
    state.time = p.until; finishVisit(p);
    const resumed = p.warmed && p.ate && p.bid === null && p.svc === null && p.then.k === 'ski' && p.then.tid === T.id;
    return {servedWhileFull,counterLimited,ateThenWarm,mealChargedOnce,warming,resumed,emptyWait,
      noFakeCap: !bldLive(B).includes('of 10'), snackVisits:B.today.services.snack,
      warmRevenue:L.today.revenue, unit:AGENT};
  })()`);
  for (const key of ['servedWhileFull','counterLimited','ateThenWarm','mealChargedOnce','warming','resumed','noFakeCap']) assert(flow[key], key);
  assert(flow.emptyWait < 1, 'occupied eating spaces do not inflate the truck wait');
  eq(flow.snackVisits, flow.unit, 'one paid meal is one snack visit');
  assert(flow.warmRevenue > 0, 'the separate hot drink keeps its existing price');

  const guards = await g.ev(`(() => {
    const B = world.buildings.find(B => B.type === 'truck'), L = world.buildings.find(B => B.type === 'lodge');
    const person = () => Object.assign(makeGuest({id:null}, B.door.x,B.door.z), {
      fat:70,stam:100,sat:80,warmed:false,ate:true,leaveAt:1000,leaving:false,night:false,
      apresGuest:false,sight:false,spend:1000,pat:20,resume:{k:'ski',tid:world.trails[0].id,s:5}
    });
    const blocked = (extra) => !warmAfterMeal(Object.assign(person(),extra),B);
    const warmed = blocked({warmed:true}), leaving = blocked({leaving:true}), apres = blocked({apresGuest:true});
    const departure = blocked({leaveAt:state.time-1});
    const oldHi = state.wx.days[0].hi;
    state.wx.days[0].hi = 35; const refreshed = blocked({fat:0}), tired = warmAfterMeal(person(),B);
    state.wx.days[0].hi = 10; const cold = warmAfterMeal(Object.assign(person(),{fat:0}),B);
    state.wx.days[0].hi = oldHi;
    const oldDoor = {...L.door}; L.door = {...B.door,x:B.door.x+40};
    const distant = blocked({}); L.door = oldDoor;
    const oldMode = runOps.bld[L.id]; runOps.bld[L.id] = 'closed';
    const closed = blocked({});
    if (oldMode === undefined) delete runOps.bld[L.id]; else runOps.bld[L.id] = oldMode;
    const oldUsed = L.used.seat, oldQueue = L.q.seat;
    L.used.seat = poolSlots(L,'seat'); L.q.seat = Array.from({length:1000},()=>({}));
    const slow = blocked({}); L.used.seat = oldUsed; L.q.seat = oldQueue;
    return {warmed,leaving,apres,departure,refreshed,tired,cold,distant,closed,slow};
  })()`);
  eq(guards, {warmed:true,leaving:true,apres:true,departure:true,refreshed:true,tired:true,cold:true,distant:true,closed:true,slow:true}, 'warm-ups respect need, nearby access, opening hours, queues and departure');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
