import { openGame, eq, assert, SETUPS } from '../harness.mjs';

export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => {
    state.cash = 2e7; const base = world.buildings[0];
    for (const type of ['cafe','truck','restaurant']) {
      let placed = false;
      for (let z = -24; z <= 24 && !placed; z += 3) for (let x = -30; x <= 30 && !placed; x += 3) {
        const info = evalBuilding(type, base.x+x, base.z+z, 0);
        if (!info.problems.length) { commitBuilding(info,type,base.x+x,base.z+z,0); placed = true; }
      }
      if (!placed) throw Error('No site for '+type);
    }
    computeNetwork(); openDay(); state.speed=0; state.time=720; schedule=[]; guests=[]; gById.clear();
  })()`);
  const result = await g.ev(`(() => {
    const T=world.trails[0], C=world.buildings.find(B=>B.type==='cafe'),
      F=world.buildings.find(B=>B.type==='truck'), R=world.buildings.find(B=>B.type==='restaurant'),
      lodge=world.buildings.find(B=>B.type==='lodge'), anchor=T.samples[20];
    // Isolate a cluster from placement randomness; all three have registered stops on this trail.
    C.door={x:anchor.x+.1,z:anchor.z}; F.door={x:anchor.x+.15,z:anchor.z};
    R.door={x:anchor.x+.2,z:anchor.z}; lodge.door={...anchor};
    const stops=[{at:20,B:C},{at:21,B:F},{at:22,B:R}];
    T.stops=stops; T.branches=[];
    C.used.seat=poolSlots(C,'seat'); C.q.seat=Array.from({length:100},()=>({}));
    F.counterFree=state.time; F.q.seat=Array.from({length:1000},()=>({}));
    const person=()=>Object.assign(makeGuest({id:null},anchor.x,anchor.z), {
      st:'ski',T,s:10,ns:0,nb:0,onSkis:true,lane:0,ab:1,bl:0,fat:0,stam:100,
      ate:false,skipped:false,warmed:false,leaving:false,lunchAt:700,leaveAt:1000,
      night:false,apresGuest:false,sight:false,pat:8,qh:.5,fancy:false,spend:1000,sat:80
    });
    const pick=(extra={})=>{const p=Object.assign(person(),extra);updateSki(p,0);return p;};
    const p=pick(), chosen=p.bid===R.id && p.svc==='dine';
    const resumeAtChosenStop=p.resume.s===12 && p.resume.tid===T.id;
    joinBuildingQueue(p,R); bldStep(R);
    const paidMeal=p.st==='inside' && R.today.services.dine===AGENT && R.today.revenue>0 && R.today.cogs>0;
    state.time=p.until; finishVisit(p);
    const fedAndResumed=p.ate && p.then.k==='ski' && p.then.tid===T.id && p.then.s===12;
    state.time=720;
    runOps.bld[R.id]='closed'; const closed=pick().bid!==R.id; delete runOps.bld[R.id];
    const rejected=pick({pricedOut:['dine'],priceRetry:{dine:{price:svcPrice('dine')}}}).bid!==R.id;
    const oldDoor={...R.door}; R.door={x:C.door.x+40,z:C.door.z};
    const distant=pick().bid!==R.id; R.door=oldDoor;
    T.stops=stops.filter(s=>s.B!==R);
    const disconnected=pick().bid!==R.id; T.stops=stops;
    let steepPoint=null;
    for (let dx=-18;dx<=18&&!steepPoint;dx+=3) for (let dz=-18;dz<=18&&!steepPoint;dz+=3) {
      const d={x:C.door.x+dx,z:C.door.z+dz};
      if (distXZ(d,C.door)<=20 && Math.abs(trueY(d.x,d.z)-trueY(C.door.x,C.door.z))>APRES_CLIMB) steepPoint=d;
    }
    if (!steepPoint) throw Error('No steep nearby point for access guard');
    R.door=steepPoint; const steep=pick().bid!==R.id; R.door=oldDoor;
    // The lodge is even closer but has no stop on this trail, so it is never a candidate.
    const noUnregisteredVenue=pick().bid!==lodge.id;
    const noBacktrack=pick({s:13}).resume.s>=13;
    return {chosen,resumeAtChosenStop,paidMeal,fedAndResumed,closed,rejected,distant,disconnected,steep,noUnregisteredVenue,noBacktrack,
      cafeWait:estWait(C,'snack'),restaurantWait:estWait(R,'dine')};
  })()`);
  for (const key of ['chosen','resumeAtChosenStop','paidMeal','fedAndResumed','closed','rejected','distant','disconnected','steep','noUnregisteredVenue','noBacktrack']) assert(result[key], key);
  assert(result.cafeWait>20 && result.restaurantWait===0, 'the restaurant takes overflow from a genuinely slow café');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
