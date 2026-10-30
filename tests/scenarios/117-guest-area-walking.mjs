// Guests cross painted areas freely: straight over open ground, each in a lane of their own and at their own
// pace, yet never over unpainted ground, and a walk survives a mid-day save.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const r=await g.ev(`(() => {
    const area=(name,test)=>{const cells=[];for(let x=-70;x<=-30;x++)for(let z=-10;z<=30;z++)if(test(x,z))cells.push(cellKey(x,z));const A={id:world.nextId++,name,kind:'hub',cells,cost:0};addArea(A);return A;};
    const open=area('Open',(x,z)=>x>=-70&&x<=-50&&z>=-10&&z<=10);
    // A U: two arms joined at the bottom, so the straight line between the arm tops crosses unpainted ground.
    const U=area('Bend',(x,z)=>z>=14&&z<=30&&((x>=-46&&x<=-42)||(x>=-34&&x<=-30)||z>=26));
    computeNetwork();
    const fresh=(x,z)=>({x,z,then:null}); // walkHub only needs where the guest stands
    const plan=(A,from,to)=>{A.routes.set(cellKey(to.x,to.z),hubFlood(A.set,cellKey(to.x,to.z)));const q=fresh(from.x,from.z);if(!walkHub(q,A,to,{k:'test'}))throw Error('no walk');
      const pts=[from,{x:q.tx,z:q.tz},...q.then.path.map(([x,z])=>({x,z}))];let len=0,inside=true;
      for(let i=1;i<pts.length;i++){len+=distXZ(pts[i],pts[i-1]);if(!hubSees(A,pts[i-1],pts[i])||hubAt(pts[i])!==A)inside=false;}
      return {q,pts,len,inside,end:pts.at(-1)};};
    const a={x:-68,z:-8},b={x:-52,z:8},straight=distXZ(a,b),walks=[];for(let i=0;i<12;i++)walks.push(plan(open,a,b));
    const mids=new Set(walks.map((w)=>w.pts.slice(1,-1).map((p)=>p.x.toFixed(1)+','+p.z.toFixed(1)).join('|')));
    const paces=walks.map((w)=>w.q.then.sp);
    const u=plan(U,{x:-44,z:15},{x:-32,z:15});
    return {inside:walks.every((w)=>w.inside),exactEnd:walks.every((w)=>w.end.x===b.x&&w.end.z===b.z),shortest:Math.max(...walks.map((w)=>w.len/straight)),
      maxPoints:Math.max(...walks.map((w)=>w.pts.length)),routes:mids.size,paces:Math.min(...paces)>=0.82&&Math.max(...paces)<=1.18&&new Set(paces).size>3,
      uInside:u.inside,uAround:u.len>2*distXZ({x:-44,z:15},{x:-32,z:15})};
  })()`);
  eq({inside:r.inside,exactEnd:r.exactEnd,uInside:r.uInside,uAround:r.uAround},{inside:true,exactEnd:true,uInside:true,uAround:true},'walks stay on painted ground, reach the exact spot and go around a U');
  assert(r.shortest<1.25&&r.maxPoints<=5,`open ground is crossed nearly straight, not square by square: ${JSON.stringify(r)}`);
  assert(r.routes>=8,`guests from one spot to one lift spread over different lines: ${r.routes} of 12 differ`);
  assert(r.paces,'each guest walks at a pace of their own');
  // A real day: guests walking in an area keep their route and pace through a save and reload.
  const day=await g.ev(`(() => {
    const L=world.lifts[0],cells=[];for(let x=Math.round(L.a.x)-12;x<=Math.round(L.a.x)+12;x++)for(let z=Math.round(L.a.z)-12;z<=Math.round(L.a.z)+8;z++)if(!hubCellProblem(x,z,hubBlocks(null)))cells.push(cellKey(x,z));
    const keep=[...hubFlood(new Set(cells),cellKey(Math.round(L.a.x),Math.round(L.a.z))).parent.keys()];
    addArea({id:world.nextId++,name:'Base test',kind:'hub',cells:keep,cost:0});computeNetwork();syncLabels();
    openDay();state.speed=0;let n=0,seen=0,out=0;
    while(state.time<660&&state.phase==='open'&&n++<90000){simStep(1.5);for(const x of guests)if(x.st==='walk'&&x.then&&x.then.k==='hubWalk'){seen++;if(!hubAt(x))out++;}}
    const w=guests.find((x)=>x.st==='walk'&&x.then&&x.then.k==='hubWalk');
    return {seen,out,walker:w&&{id:w.id,sp:w.then.sp,n:w.then.path.length}};
  })()`);
  assert(day.seen>0&&day.walker,`guests walk inside the base area during a real day: ${JSON.stringify(day)}`);
  eq(day.out,0,'no walking guest is ever outside the painted area');
  await g.ev('saveNow()');await g.page.reload();await g.reloaded();await g.click('#startBtn');
  const back=await g.ev(`(() => {const w=guests.find((x)=>x.id===${day.walker.id});return w&&w.then?{id:w.id,sp:w.then.sp,n:w.then.path.length}:null;})()`);
  eq(back,day.walker,'a guest mid-walk keeps their route and pace through a save and reload');
  eq(g.errors,[],'no page errors');await g.page.close();
  return `${r.routes}/12 distinct routes, longest ${r.shortest.toFixed(2)}× straight, ${day.seen} walker samples all inside`;
}
