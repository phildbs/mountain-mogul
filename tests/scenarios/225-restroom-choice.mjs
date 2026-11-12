// Guests stuck in a slow restroom line (a café has only 2 stalls) walk to a restroom close by with a shorter line,
// don't come straight back to a line they gave up on, and skiers stopping at a trailside café compare restrooms a
// short walk away even when those sit just off the trail.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';

export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn');
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`(() => {
    state.cash = 2e7; const base = world.buildings[0];
    for (const type of ['cafe','restroom']) {
      let placed = false;
      for (let z = -24; z <= 24 && !placed; z += 3) for (let x = -30; x <= 30 && !placed; x += 3) {
        const info = evalBuilding(type, base.x+x, base.z+z, 0);
        if (!info.problems.length) { commitBuilding(info,type,base.x+x,base.z+z,0); placed = true; }
      }
      if (!placed) throw Error('No site for '+type);
    }
    computeNetwork(); openDay(); state.speed=0; state.time=720; schedule=[]; guests=[]; gById.clear();
  })()`);
  const r = await g.ev(`(() => {
    const T=world.trails[0], C=world.buildings.find(B=>B.type==='cafe'), W=world.buildings.find(B=>B.type==='restroom'),
      lodge=world.buildings.find(B=>B.type==='lodge'), anchor=T.samples[20];
    // The café sits on the trail; the restrooms are next door, 6 units further from it (not a stop on this trail).
    C.door={x:anchor.x+.1,z:anchor.z}; W.door={x:anchor.x+6,z:anchor.z}; lodge.door={x:anchor.x+400,z:anchor.z};
    const flat=Math.abs(trueY(W.door.x,W.door.z)-trueY(C.door.x,C.door.z))<=APRES_CLIMB;
    const person=(extra={})=>Object.assign(makeGuest({id:null},anchor.x,anchor.z), {
      st:'ski',T,s:10,ns:0,nb:0,onSkis:true,lane:0,ab:1,bl:1.2,fat:0,stam:100,ate:true,skipped:false,warmed:true,leaving:false,
      lunchAt:700,leaveAt:1000,night:false,apresGuest:false,sight:false,pat:8,qh:.5,fancy:false,spend:1,sat:80
    },extra);
    const fill=(B,k)=>{B.used.rr=poolSlots(B,'rr');B.q.rr=Array.from({length:k},()=>({svc:'rr',qT:state.time,pat:999}));};
    // 1. Skiing past the café with a long restroom line there: they stop at the restrooms next door.
    T.stops=[{at:20,B:C}]; T.branches=[]; fill(C,40); W.used.rr=0; W.q.rr=[];
    let p=person(); updateSki(p,0); const trailPick=p.bid===W.id&&p.svc==='rr', resumeOnTrail=p.resume&&p.resume.tid===T.id;
    // With no line at the café they still use the café's, since it's right there.
    C.q.rr=[]; C.used.rr=0; p=person(); updateSki(p,0); const shortLineStays=p.bid===C.id;
    // 2. Already far back in the café's line: a look around sends them next door.
    fill(C,40); p=person({st:'bq',svc:'rr',bid:C.id,resume:{k:'base'},qT:state.time-5,qLook:0,x:C.door.x,z:C.door.z}); C.q.rr.push(p);
    bldStep(C,0); const hopped=!C.q.rr.includes(p)&&p.bid===W.id&&/restroom line/.test(p.th[0]||'');
    // Near the front, they stay put.
    fill(C,40); p=person({st:'bq',svc:'rr',bid:C.id,resume:{k:'base'},qT:state.time-5,qLook:0}); C.q.rr.unshift(p);
    bldStep(C,0); const frontStays=C.q.rr.includes(p); C.q.rr=[];
    // With the restrooms just as busy, they stay in the café's line.
    fill(C,40); fill(W,400); p=person({st:'bq',svc:'rr',bid:C.id,resume:{k:'base'},qT:state.time-5,qLook:0}); C.q.rr.push(p);
    bldStep(C,0); const busyStays=C.q.rr.includes(p); C.q.rr=[]; W.q.rr=[]; W.used.rr=0;
    // 3. Giving up on a line: they avoid that building for a while.
    fill(C,40); W.used.rr=poolSlots(W,'rr'); W.q.rr=Array.from({length:400},()=>({svc:'rr',qT:state.time,pat:999}));
    p=person({st:'bq',svc:'rr',bid:C.id,resume:{k:'base'},qT:state.time-60,qLook:state.time+99,pat:8}); C.q.rr.push(p);
    bldStep(C,0); const avoids=!C.q.rr.includes(p)&&p.avoidB===C.id&&p.avoidUntil>state.time;
    C.q.rr=[]; W.q.rr=[]; C.used.rr=0; W.used.rr=0;
    return {flat,trailPick,resumeOnTrail,shortLineStays,hopped,frontStays,busyStays,avoids,cafeWait:Math.round(lineWait(C,'rr'))};
  })()`);
  assert(r.flat, 'the restrooms are on level ground with the café');
  eq({ trailPick: r.trailPick, resumeOnTrail: r.resumeOnTrail, shortLineStays: r.shortLineStays, hopped: r.hopped, frontStays: r.frontStays, busyStays: r.busyStays, avoids: r.avoids },
    { trailPick: true, resumeOnTrail: true, shortLineStays: true, hopped: true, frontStays: true, busyStays: true, avoids: true }, `restroom choices: ${JSON.stringify(r)}`);
  eq(g.errors, [], 'no page errors'); await g.page.close();
  return 'café restroom line → restrooms next door';
}
