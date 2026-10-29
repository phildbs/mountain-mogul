// The original shared-summit geometry fails tests/express-routing.mjs before the fix.
import '../express-routing.mjs';
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const fixture=await g.ev(`(() => {
    state.cash=1e8;const lower=world.lifts[0];
    const ui=evalLift({x:22,z:-8},{x:25,z:-38},'double');
    if(ui.problems.length)throw Error('Upper lift: '+ui.problems.join('|'));
    const upper=commitLift(ui,'double');
    const pts=[[upper.b.x+3,upper.b.z+2],[upper.b.x+8,(upper.b.z+15)/2],[23,16]].map(([x,z])=>({x,z,y:heightAt(x,z)}));
    const ti=evalTrail(pts,'medium',false,true);if(ti.an.problems.length)throw Error('Summit trail: '+ti.an.problems.join('|'));
    const summit=commitTrail(ti,pts,'medium');computeNetwork();
    // The east-facing summit candidates used originally sit on a >50% slope.
    // These nearby sites were checked against the real Juniper height/grade grids.
    let express=null;const rejected=[];
    for(const [dx,dz] of [[0,4],[-0.5,4],[-1,4],[-1.5,4],[-2,4],[-2.5,4],[-2,3.5],[-2.5,3.5]]) {
      const b={x:upper.b.x+dx,z:upper.b.z+dz};
      if(!liftTrailMode({type:'hsq',b},summit))continue;
      for(const [x,z] of [[24,56],[28,56],[22,60],[30,62],[18,64]]) {
        const i=evalLift({x,z},b,'hsq');
        if(!i.problems.length&&i.fromBase){express=commitLift(i,'hsq');break;}
        rejected.push({a:{x,z},b,base:i.fromBase,problems:i.problems});
      }
      if(express)break;
    }
    if(!express)throw Error('No valid shared-summit express placement: '+JSON.stringify(rejected));
    computeNetwork();window.routeFixture={lower:lower.id,upper:upper.id,express:express.id,summit:summit.id,base:realTrails().find(t=>t!==summit).id};
    return {shared:upper.departing.includes(summit)&&express.departing.includes(summit),canonical:summit.from.obj===upper,panel:liftSheet(express).includes(summit.name),reachable:summit.reachable&&express.reachable&&express.returns};
  })()`);
  assert(Object.values(fixture).every(Boolean),'shared entrance is recognized in network and card without rewriting the trail owner');
  await g.ev(`openDay();state.speed=0;state.time=600;schedule=[];`);
  const result=await g.ev(`(() => {
    const {lower:lid,upper:uid,express:eid,summit:tid,base:bid}=window.routeFixture,L=liftById(lid),U=liftById(uid),E=liftById(eid),T=trailById(tid),B=trailById(bid);
    const random=Math.random;let seed=107107;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const guest=(p)=>{const q=makeGuest({id:null},p.x,p.z);Object.assign(q,{ab:3,pref:2,first:false,leaving:false,leaveAt:2000,fat:0,stam:10000,bl:0,ate:true,skipped:false,lunchAt:2000,needsRental:false,wantsLesson:false,wantsGear:false,wantsTune:false,shopper:false,family:false,warmed:true,explore:0,seenLift:{[lid]:true,[uid]:true,[eid]:true}});return q;};
    const clear=()=>{for(const X of world.lifts){X.queue=[];X.incoming=0;}};
    try {
      // Isolate the existing explicit lift-end connection (rather than a generic base end).
      B.to={kind:'lift',obj:L};
      clear();const q=guest(B.samples.at(-1));q.T=B;E.open=false;
      const fallback=world.lifts.filter(canLoad).map(x=>x.id);
      // With only the express available, an old trail's endpoint must not trap a skier on its original lift.
      L.open=false;U.open=false;E.open=true;endOfTrail(q);
      const reselected=q.L===E&&q.then?.k==='queue';
      clear();const p=guest(E.b);const gotTrail=topDecision(p,E,true)&&p.then?.tid===tid;
      if(gotTrail){moveToward(p,p.st==='walk'?WALK:GLIDE,100000);arrive(p);}
      const skiing=p.T===T&&p.st==='ski'&&p.onSkis;
      L.open=U.open=true;E.open=false;clear();
      const back=guest(B.samples.at(-1));back.T=B;endOfTrail(back);
      const closedExcluded=back.L!==E;
      E.open=true;E.windHold=true;clear();const held=guest(B.samples.at(-1));held.T=B;endOfTrail(held);
      const windExcluded=held.L!==E;E.windHold=false;
      // A walk from a shared summit becomes skiing only after the trailhead is reached.
      const mode=liftTrailMode(E,T);clear();
      const measured=liftRideMinutes(E),expected=E.upLen*10*PACE/(LIFT_TYPES[E.type].speed*60);
      return {reselected,gotTrail,skiing,closedExcluded,windExcluded,validApproach:['walk','glide'].includes(mode),rideCorrect:Math.abs(measured-expected)<1e-9,fallback:fallback.length>0};
    } finally {Math.random=random;clear();}
  })()`);
  assert(Object.values(result).every(Boolean),`actual trail exit, shared summit skiing and closures work: ${JSON.stringify(result)}`);
  // Reload an ordinary save to ensure aliases are recomputed, not serialized into circular references.
  const reload=await g.ev(`(() => {state.phase='closed';const save=JSON.parse(JSON.stringify(saveData(false)));applySave(save);const F=window.routeFixture,E=liftById(F.express),U=liftById(F.upper),T=trailById(F.summit);return E.departing.includes(T)&&U.departing.includes(T)&&E.returns;})()`);
  assert(reload,'existing save format rebuilds shared entrances');eq(g.errors,[],'no page errors');await g.page.close();
}
