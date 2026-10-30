// Benches, picnic tables and fire pits have no line: a guest finding every seat taken sits at a free one close by,
// or carries on and rests later. Skiers facing a long mid-mountain lift line, or stuck far back in one, take a lift
// loading right beside it when its line is much shorter.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const built=await g.ev(`(() => {
    // Two mid-mountain lifts side by side, a trail from the main lift's top to the first, and trails home from both tops.
    const A=commitLift(evalLift({x:-24,z:20},{x:-24,z:-30},'double'),'double'),B=commitLift(evalLift({x:-17,z:20},{x:-17,z:-30},'quad'),'quad');computeNetwork();
    const [L0,LA,LB]=world.lifts,trail=(from,to,bends)=>{for(const s of bends){const pts=[from,{x:(from.x+to.x)/2+s,z:(from.z+to.z)/2},to].map((p)=>({x:p.x,z:p.z,y:heightAt(p.x,p.z)}));const t=evalTrail(pts,'wide');if(!t.an.problems.length){commitTrail(t,pts,'wide');computeNetwork();return true;}}return false;};
    const bends=[0,-6,6,-12,12,-18,18];
    const ok=[trail({x:LA.b.x,z:LA.b.z+3},{x:-30,z:58},bends),trail({x:LB.b.x,z:LB.b.z+3},{x:-10,z:58},bends)];
    ok.unshift(trail({x:L0.b.x-3,z:L0.b.z+2},{x:LA.a.x,z:LA.a.z+1.5},[-6,-12,-18,0,6]));
    syncLabels();
    return {ok,mid:!LA.fromBase&&!LB.fromBase,feed:world.trails.some((t)=>t.to&&t.to.kind==='lift'&&t.to.obj===LA)};
  })()`);
  eq(built,{ok:[true,true,true],mid:true,feed:true},'two mid-mountain lifts side by side, one fed by a trail');
  const lifts=await g.ev(`(() => {
    openDay();state.speed=0;let n=0;while(guests.filter((x)=>x.runs!==undefined).length<3&&n++<3000)simStep(1.5);
    const [,LA,LB]=world.lifts,T=world.trails.find((t)=>t.to&&t.to.kind==='lift'&&t.to.obj===LA);
    const beside=liftsBeside(LA).map((o)=>o.M.id);
    const skier=()=>{const x=guests.find((q)=>q.st!=='incar'&&!q.leaving&&q.ab>=1)||guests[0];x.leaving=false;x.ab=Math.max(1,x.ab);x.runs=3;x.T=T;x.s=T.len;x.qh=0.6;return x;};
    const fill=(L,k)=>{L.queue=[];for(let i=0;i<k;i++)L.queue.push({id:-1-i});L.incoming=0;LB.queue=[];LB.incoming=0;};
    // A short line: they ride the lift their trail ends at.
    fill(LA,2);let x=skier();endOfTrail(x);const shortPick=x.then&&x.then.lid;LA.incoming=0;LB.incoming=0;
    // A long one, with an empty lift beside it: they glide over.
    fill(LA,80);x=skier();endOfTrail(x);const longPick=x.then&&x.then.lid,wait=Math.round(liftWait(LA)),said=x.th[0];LA.incoming=0;LB.incoming=0;
    // Already far back in a long line: a look around moves them across.
    fill(LA,80);x=skier();x.x=LA.a.x;x.z=LA.a.z;LA.queue.push(x);x.st='queue';x.L=LA;x.qv=-1;x.qLook=0;updateGuest(x,0.01);
    const stillIn=LA.queue.includes(x),hopTo=x.then&&x.then.lid,hops=today.lineHops||0;
    // Near the front, they stay put.
    fill(LA,80);x=skier();LA.queue.splice(1,0,x);x.st='queue';x.L=LA;x.qv=-1;x.qLook=0;updateGuest(x,0.01);const frontStays=LA.queue.includes(x);
    LA.queue=[];LB.queue=[];LA.incoming=0;LB.incoming=0;
    return {beside:beside.includes(LB.id),shortPick:shortPick===LA.id,longPick:longPick===LB.id,wait,said,stillIn,hopTo:hopTo===LB.id,hops,frontStays};
  })()`);
  eq({beside:lifts.beside,shortPick:lifts.shortPick,longPick:lifts.longPick,stillIn:lifts.stillIn,hopTo:lifts.hopTo,frontStays:lifts.frontStays},
    {beside:true,shortPick:true,longPick:true,stillIn:false,hopTo:true,frontStays:true},`lift choices: ${JSON.stringify(lifts)}`);
  assert(lifts.wait>=10&&/right next to it/.test(lifts.said),`the skier says why they switched: ${JSON.stringify(lifts)}`);
  const seats=await g.ev(`(() => {
    const L0=world.lifts[0],put=(type,dx,dz)=>{for(let k=0;k<30;k++){const x=L0.a.x+dx+k%5,z=L0.a.z+dz+Math.floor(k/5),i=evalBuilding(type,x,z,0);if(i&&!i.problems?.length)return commitBuilding(i,type,x,z,0);}throw Error('no '+type+' spot');};
    const bench=put('bench',-12,-2),table=put('picnic',-6,-2),far=put('bench',-40,-30);computeNetwork();syncLabels();
    for(const B of [bench,table,far])initBldSim(B);
    const x=guests.find((q)=>q.st!=='incar'),sit=(B)=>{x.svc='rest';x.bid=B.id;x.resume={k:'base'};x.x=B.door.x;x.z=B.door.z;x.restT=-999;joinBuildingQueue(x,B);};
    // The bench is taken: they walk to the free picnic table next to it.
    bench.used.seat=poolSlots(bench,'seat');sit(bench);
    const moved=x.bid===table.id&&x.st!=='bq',benchLine=bench.q.seat.length;
    // Everything nearby is taken: no line, they carry on and sit down later.
    table.used.seat=poolSlots(table,'seat');x.avoidB=null;sit(bench);
    const r={moved,benchLine,anyLine:bench.q.seat.length+table.q.seat.length,st:x.st,restLater:Math.round(state.time-x.restT),said:x.th[0],tableDist:Math.round(distXZ(bench.door,table.door)),farDist:Math.round(distXZ(bench.door,far.door))};
    bench.used.seat=0;table.used.seat=0;return r;
  })()`);
  assert(seats.moved&&seats.benchLine===0,`a guest finding the bench taken sits at the free table nearby: ${JSON.stringify(seats)}`);
  assert(seats.anyLine===0&&seats.st!=='bq'&&seats.restLater===45&&/rest later/.test(seats.said),`with every seat taken they carry on and rest later, no line: ${JSON.stringify(seats)}`);
  // A full day with seats around: nobody stands in line for one, and lift-line switching stays sane.
  const day=await g.ev(`(() => {
    let longest=0;const os=serve;serve=(q,B)=>{if(outdoorSeat(B,q.svc))longest=Math.max(longest,state.time-q.qT);return os(q,B);};
    let n=0;while(state.phase==='open'&&n++<90000)simStep(1.5);serve=os;
    return {phase:state.phase,longest:+longest.toFixed(2),guests:state.lastReport.guests};
  })()`);
  assert(day.phase!=='open'&&day.longest<1,`seat guests sit straight down, never queue: ${JSON.stringify(day)}`);
  eq(g.errors,[],'no page errors');await g.page.close();
  return `long line ${lifts.wait} min → beside lift; seats: no line (${day.guests} guests)`;
}
