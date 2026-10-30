// A hungry skier reaching a lift top inside a guest area heads out for lunch instead of being sent back to the
// same spot every step (in 2.65 that loop grew all afternoon until big resorts froze).
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const r=await g.ev(`(() => {
    const L=world.lifts[0],cells=[];for(let x=Math.round(L.b.x)-7;x<=Math.round(L.b.x)+7;x++)for(let z=Math.round(L.b.z)-5;z<=Math.round(L.b.z)+7;z++)if(!hubCellProblem(x,z,hubBlocks(null)))cells.push(cellKey(x,z));
    const keep=[...hubFlood(new Set(cells),cellKey(Math.round(L.b.x),Math.round(L.b.z))).parent.keys()];
    addArea({id:world.nextId++,kind:'hub',name:'Summit test',cells:keep,cost:0});computeNetwork();syncLabels();
    openDay();state.speed=0;let n=0;while(!guests.some((x)=>x.st==='ride')&&n++<5000)simStep(1.5);
    state.time=Math.max(state.time,700);
    const x=guests.find((q)=>q.st!=='incar');
    Object.assign(x,{ab:2,leaving:false,ate:false,skipped:false,lunchAt:600,night:false,apresGuest:false,sight:false,x:L.b.x,z:L.b.z,st:'walk',tx:L.b.x,tz:L.b.z});
    x.then={k:'hubTop',lid:L.id};
    let arrivals=0;const oa=arrive;arrive=(q)=>{if(q===x)arrivals++;return oa(q);};
    for(let i=0;i<40;i++)simStep(1.5);
    arrive=oa;
    return {hubTop:L.hubTop&&L.hubTop.name,arrivals,moved:Math.round(distXZ(x,L.b)),st:x.st,wants:wantsMeal(x)||x.ate||x.st==='inside'};
  })()`);
  eq(r.hubTop,'Summit test','the lift tops out inside a guest area');
  assert(r.arrivals<=4&&(r.moved>=1||r.st==='inside'||r.st==='ski'),`the hungry skier sets off rather than looping at the top: ${JSON.stringify(r)}`);
  eq(g.errors,[],'no page errors');await g.page.close();
  return `${r.arrivals} decisions in 40 steps, ${r.moved} m from the top (${r.st})`;
}
