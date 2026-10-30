// Painted junctions join distant endpoints on the actual terrain; all movement uses the live guest code.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const network=await g.ev(`(() => {
    state.cash=1e8;
    // Fixed network fixtures deliberately separate endpoints by more than the old station radius.
    const L=world.lifts[0], a={x:-30,z:15}, b={x:8,z:-68}, info=evalLift(a,b,'double');
    if(info.problems.length)throw Error('Upper lift fixture: '+info.problems.join('; '));
    commitLift(info,'double');const U=world.lifts.at(-1);
    const patch=(name,x0,x1,z0,z1)=>{const cells=[];for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)cells.push(cellKey(x,z));const A={id:world.nextId++,kind:'hub',name,cells,cost:0};addArea(A);return A;};
    const mid=patch('Mid test',-31,4,14,16),top=patch('Summit test',7,39,-70,-66),base=patch('Base test',-4,-2,28,65);
    const path=(name,pts)=>{const T={id:world.nextId++,name,pts:pts.map(([x,z])=>({x,z})),width:'narrow',open:true,sign:0};addTrail(T);return T;};
    const incoming=path('Into mid',[[L.b.x+2,L.b.z+2],[4,4],[3,15]]),home=path('From summit',[[38,-68],[38,-30],[14,0],[-3,28]]);
    computeNetwork();syncLabels();refreshSnowState(todayWx());
    window.__hubIds={mid:mid.id,top:top.id,base:base.id,incoming:incoming.id,home:home.id,upper:U.id};
    return {kind:incoming.to.kind,mid:incoming.to.obj===mid,far:distXZ(incoming.samples.at(-1),U.a)>TRANSFER_R,upper:U.reachable,home:home.reachable,returns:incoming.returns&&home.returns,base:!!base.basePoint,endAboveBase:!isBase(home.samples.at(-1)),top:U.hubTop===top,topNamed:hubName(top.set)==='Summit area',entranceFar:distXZ(U.b,home.samples[0])>STATION_R,learning:world.trails.filter(t=>t.virtual&&!t.glade).length};
  })()`);
  assert(Object.entries(network).every(([k,v])=>k==='kind'?v==='hub':k==='learning'?v===0:v===true),`mid, summit and base form a returning network without fake learning runs: ${JSON.stringify(network)}`);
  const walking=await g.ev(`(() => {
    openDay();state.speed=0;state.time=600;schedule=[];
    const ids=window.__hubIds,A=areaById(ids.mid),S=areaById(ids.top),U=liftById(ids.upper),T=trailById(ids.incoming),H=trailById(ids.home);
    // Keep every unrelated need quiet so this checks the actual trail/lift decisions.
    const fresh=(p)=>{const c={id:99000,ab:2,members:[]},g=makeGuest(c,p.x,p.z);Object.assign(g,{ab:3,pref:0,first:false,ate:true,warmed:true,wantsGear:false,shopper:false,wantsTune:false,family:false,bl:0,stam:1e8,leaveAt:2000,sat:90,runs:2,fat:0,sight:false,leaving:false});return g;};
    const finish=(g)=>{for(let n=0;g.then&&g.then.k==='hubWalk'&&n<5000;n++){if(hubAt({x:g.tx,z:g.tz})!==hubAt(g))throw Error('walk left painted cells');g.x=g.tx;g.z=g.tz;arrive(g);}return g;};
    const p=T.samples.at(-1),q=fresh(p);q.T=T;endOfTrail(q);const midWalk=q.st==='walk'&&q.then?.k==='hubWalk';finish(q);const midQueue=q.then?.k==='queue'&&q.then.lid===U.id;
    const r=fresh(U.b);topDecision(r,U);const topWalk=r.st==='walk'&&r.then?.k==='hubWalk';finish(r);const topSki=r.st==='ski'&&r.T===H;
    // A concave patch takes the long way around its unpainted middle.
    const cells=new Set([cellKey(0,0),cellKey(1,0),cellKey(2,0),cellKey(2,1),cellKey(2,2),cellKey(1,2),cellKey(0,2)]),bent=hubFlood(cells,cellKey(0,2));
    return {midWalk,midQueue,topWalk,topSki,bend:bent.distance.get(cellKey(0,0))};
  })()`);
  eq(walking,{midWalk:true,midQueue:true,topWalk:true,topSki:true,bend:6},'skiers finish at mid, walk to a distant lift, then walk from summit to a distant entrance');
  const snow=await g.ev(`(() => {
    // Isolate the area costs from existing trail/base equipment; a cold night must add ground snow.
    const A=areaById(__hubIds.mid),S=areaById(__hubIds.top);A.sm={on:true,mode:'always',target:18};S.sm={on:true,mode:'off',target:18};
    const small={kind:'hub',cells:A.cells.slice(0,30)},big={kind:'hub',cells:A.cells.slice(0,90)};
    const before=hubDepth(A),one=runSnowmaking(-20),depth=hubDepth(A);A.sm.mode='off';S.sm.mode='always';const two=runSnowmaking(-20);S.sm.mode='off';
    // Running costs flow through nextDay -> smAcc -> today's report, like trail guns.
    endDay();nextDay();A.sm.mode='always';const accumulated=state.smAcc||0;nextDay();const paid=state.smAcc-accumulated;openDay();state.speed=0;endDay();
    return {install:snowmakingCost(big)>snowmakingCost(small),nightly:two.cost>one.cost,ground:depth>before,paid:paid>0,report:state.lastReport.exp.snowmaking===accumulated+paid,lines:state.lastReport.exp.snowmaking};
  })()`);
  assert(snow.install&&snow.nightly&&snow.ground&&snow.paid&&snow.report,`size-based snowmaking adds ground snow and reaches the report: ${JSON.stringify(snow)}`);
  const saved=await g.ev(`JSON.parse(JSON.stringify(serializeWorld().areas))`);
  await g.ev('saveNow()');await g.page.reload();await g.reloaded();await g.click('#startBtn');
  eq(await g.ev(`JSON.parse(JSON.stringify(serializeWorld().areas))`),saved,'area shapes, names and equipment survive a real reload');
  const restored=await g.ev(`({n:world.areas.filter(isHub).length,ret:world.trails.find(t=>t.name==='Into mid').returns})`);
  eq(restored,{n:3,ret:true},'network is rebuilt from the saved painted cells');
  eq(g.errors,[],'no page errors');await g.page.close();
  return 'mid-to-lift, summit-to-trail, base return, snowmaking report and saved areas';
}
