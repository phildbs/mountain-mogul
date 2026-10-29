// Shared logic checks for the browser scenario and renderer-free runner.
export function hungerCases() {
  const saved = { buildings: world.buildings, lifts: world.lifts, trails: world.trails, time: state.time, cash: state.cash, prices: { ...state.prices }, today, random: Math.random, resumeGuest, runOps };
  const check = (ok, msg) => { if (!ok) throw Error(msg); };
  const guest = (extra = {}) => ({ id: 999999, x: 0, z: 0, ab: 0, spend: 1, qh: 0.3, pat: 6, fancy: false, ate: false, skipped: false, lunchAt: 700, sat: 70, bl: 0, blRate: 200, th: [], seen: {}, st: 'walk', ...extra });
  let id = 990000;
  const bld = (type, x = 0, z = 0) => {
    const B = { id: id++, type, tier: type === 'lodge' ? 2 : 0, name: 'Test ' + type, rot: 0, door: { x, z }, seatsW: [], isBase: true };
    initBldSim(B); world.buildings.push(B); return B;
  };
  try {
    world.buildings = []; world.lifts = []; world.trails = []; today = newToday();
    runOps = { ...runOps, bld: {}, lifts: {}, staff: 'normal', hours: 'normal' };
    Math.random = () => 0.999; resumeGuest = () => {}; state.time = 930;
    const L = bld('lodge'), R = bld('restaurant', 2), C = bld('truck', -2), p = guest({spend:0});
    check(needs(p).includes('lunch') && bldOpenNow(L), 'hungry guests still seek meals at 3:30 PM');
    runOps.bld[L.id] = 'lunch'; check(!bldOpenNow(L), 'lunch-only hours still respected');
    runOps.bld[L.id] = 'closed'; check(!bldOpenNow(L), 'deliberately closed stays closed');
    runOps.bld[R.id]='closed';runOps.bld[C.id]='closed';
    const shut=guest({svc:'food',bid:L.id});joinBuildingQueue(shut,L);
    check(L.q.seat.length===0 && L.today.visits===0,'arriving after closing cannot start a meal');
    L.q.seat=[guest({svc:'food',bid:L.id,st:'bq'})];bldStep(L);
    check(L.q.seat.length===0 && L.today.visits===0,'a queue is released when the venue closes');
    runOps.bld[L.id]='open';runOps.bld[R.id]='open';runOps.bld[C.id]='open';
    for (const [B, svc] of [[R,'dine'],[L,'food'],[C,'snack']]) {
      Object.assign(p, {svc, bid:B.id}); serve(p,B);
      check(!p.ate && !p.skipped && needs(p).includes('lunch'), 'rejecting ' + svc + ' does not end meal search');
    }
    check(bestVisit(p,L.door,14,true,world.buildings,['lunch']) === null, 'rejects are respected for a short break');
    state.prices.food -= 1; check(!rejectedMeal(p,'food'), 'a price cut permits an immediate retry'); state.prices.food += 1;
    state.time += 31; check(!rejectedMeal(p,'food'), 'reconsiders a price after 30 minutes');
    state.time = 720;
    check(needs(guest({ate:true, skipped:true})).includes('lunch'), 'older saves with skipped lunch can retry');
    // A genuine missed meal is counted at departure, not when hunger first develops.
    today = newToday(); state.time = 800;
    const late = guest(); updateNeeds(late,1);
    check(late.hungry && today.complaints.food === 0, 'hunger alone is not a missed meal');
    late.ate = true; late.mealAt = 800; recordMealOutcome(late); recordMealOutcome(late);
    recordMealOutcome(guest({ate:true,mealAt:720}));
    recordMealOutcome(guest({foodPrice:R.id,foodReason:'price'}));
    recordMealOutcome(guest({night:true})); recordMealOutcome(guest({lunchAt:900}));
    check(today.meals.onTime===1 && today.meals.delayed===1 && today.meals.missed===1 && today.complaints.food===1, 'meal outcomes reconcile and do not double count');
    check(today.hungry.price===1, 'only an actual missed meal adds its reason');
    const report = hungryNote({meals:today.meals,complaints:today.complaints,hungry:hungerSummary(today.hungry)});
    check(report.includes('1 ate after a long delay') && report.includes('1 left without eating'), 'report distinguishes late meals and missed meals');
    // A slow counter must not reset the original lunch clock.
    today = newToday(); state.time=800; initBldSim(L); L.used.seat=poolSlots(L,'seat');
    const waiting=guest({svc:'food',bid:L.id,st:'bq',qT:770,qLook:900}); L.q.seat=[waiting]; bldStep(L);
    check(waiting.lunchAt===700 && waiting.foodReason==='line' && !waiting.ate, 'giving up a queue preserves lunch time and hunger');
    // Directed graph: the fun lap loops back to the upper lift; the exit reaches the base lodge.
    world.buildings=[]; const lodge=bld('lodge',0,100); state.time=720;
    const lift={id:id++,type:'double',open:true,fromBase:false,a:{x:0,z:20},b:{x:0,z:0},upLen:20,queue:[],incoming:0,stats:{cap:1200},transfers:[],departing:[]};
    world.lifts=[lift];
    const trail=(name,end,to)=>({id:id++,name,open:true,sign:0,width:'wide',len:end,an:{rating:0},samples:Array.from({length:end*2+1},(_,i)=>({x:0,z:i/2})),stops:[],branches:[],to,joinIdx:0});
    const lap=trail('Loop',20,{kind:'lift',obj:lift}), exit=trail('Food route',100,{kind:'base'});
    lift.departing=[lap,exit]; world.trails=[lap,exit];
    const skier=guest(); let route=mealRoute(skier,{k:'top',L:lift});
    check(route?.B===lodge && route.first.tid===exit.id, 'hungry skier chooses the route to the lodge instead of the upper loop');
    exit.sign=3; check(mealRoute(skier,{k:'top',L:lift})===null, 'food trip never requires terrain above ability');
    exit.sign=0; exit.open=false; check(mealRoute(skier,{k:'top',L:lift})===null, 'closed trail is not a food route'); exit.open=true;
    lift.departing=[lap]; lap.branches=[{at:20,trail:exit}];
    check(mealRoute(skier,{k:'trail',T:exit,s:0})?.cost < mealRoute(skier,{k:'trail',T:lap,s:11})?.cost, 'fork lookahead favors food now over another loop');
    runOps.bld[lodge.id]='lunch'; state.time=835;
    check(mealRoute(skier,{k:'trail',T:exit,s:0})===null,'does not route toward lunch-only service that will close before arrival');
    runOps.bld[lodge.id]='open'; state.time=930;
    check(mealRoute(skier,{k:'trail',T:exit,s:0})?.B===lodge,'open food remains reachable after 3 PM');
    // A real operating lift edge can lead to an upper venue; a stopped lift cannot.
    state.time=720; world.buildings=[]; const upper=bld('cafe',100,0); upper.isBase=false;
    const next={...lift,id:id++,a:{x:5,z:0},b:{x:100,z:0},upLen:100,departing:[],transfers:[]};
    world.lifts=[lift,next]; lift.departing=[]; lift.transfers=[next];
    route=mealRoute(skier,{k:'top',L:lift});
    check(route?.B===upper && route.first.k==='transfer','food search can use a connected operating lift');
    next.open=false; check(mealRoute(skier,{k:'top',L:lift})===null,'stopped lift breaks that food route');
    return {lateSearch:true,priceRetries:true,outcomes:true,safeRoutes:true};
  } finally {
    world.buildings=saved.buildings;world.lifts=saved.lifts;world.trails=saved.trails;state.time=saved.time;state.cash=saved.cash;state.prices=saved.prices;
    today=saved.today;Math.random=saved.random;resumeGuest=saved.resumeGuest;runOps=saved.runOps;
  }
}
