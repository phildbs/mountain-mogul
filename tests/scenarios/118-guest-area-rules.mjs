// Guest areas: 15 free acres per resort then a price per acre; ground over 30% shows as steep but can still be painted
// (guests walk up it slowly), with optional leveling (trails and lifts never move); base-only buildings may go in an
// area that touches the base.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const cost=await g.ev(`(() => {
    state.cash=1e8;state.landMode='hub';
    // Gentle, unbuilt ground for the allowance check: two separate connected patches of 400 squares.
    const blocks=hubBlocks(null),ok=(k)=>{const x=keyX(k),z=keyZ(k);return !hubCellProblem(x,z,blocks)&&!hubSteep(k)&&!world.trails.some((t)=>t.samples.some((p)=>distXZ(p,{x,z})<4));};
    const grow=(seed,n,skip)=>{const out=[seed],seen=new Set([seed]);for(let i=0;i<out.length&&out.length<n;i++)for(const d of HUB_STEPS){const k=out[i]+d;if(seen.has(k)||skip.has(k)||!ok(k))continue;seen.add(k);out.push(k);if(out.length>=n)break;}return out;};
    const draft=(cells,old)=>{areaDraft={cells:new Set(cells),erase:false,editId:old?old.id:null};return areaDraftInfo();};
    const a=grow(cellKey(-60,60),400,new Set()),infoA=draft(a);commitHub(infoA);
    const b=grow(cellKey(40,60),400,new Set(a)),infoB=draft(b);
    return {free:HUB_FREE_CELLS,sizes:[a.length,b.length],firstCost:infoA.cost,firstConnected:!infoA.problems.length&&!infoB.problems.length,secondCost:infoB.cost,expect:hubCellCost(400+400-HUB_FREE_CELLS),freeLeft:infoB.freeLeft,perAcre:hubCellCost(Math.round(4046.86/100))};
  })()`);
  eq({ok:cost.firstConnected,sizes:cost.sizes},{ok:true,sizes:[400,400]},'the allowance fixture is two connected, gentle patches');
  eq(cost.firstCost,0,'the first 400 squares (under 15 acres) are free');
  eq(cost.secondCost,cost.expect,'only the squares beyond the free 15 acres are charged');
  eq(cost.freeLeft,0,'no free acres remain once the allowance is spent');
  assert(cost.perAcre>=4900&&cost.perAcre<=5100,`about $5,000 an acre: ${cost.perAcre}`);

  const steep=await g.ev(`(() => {
    openHubTool();
    // The steepest open 9x9 patch away from the existing trails and lift.
    let best=null;for(let x=-70;x<=62;x+=4)for(let z=-70;z<=50;z+=4){const cells=[];let n=0;for(let i=0;i<9;i++)for(let j=0;j<9;j++){const k=cellKey(x+i,z+j);if(hubCellProblem(x+i,z+j,hubBlocks(null)))continue;cells.push(k);if(hubSteep(k))n++;}
      if(cells.length===81&&!world.trails.some((t)=>t.samples.some((p)=>distXZ(p,{x:x+4,z:z+4})<14))&&!world.lifts.some((L)=>distXZ(L.a,{x:x+4,z:z+4})<14||distXZ(L.b,{x:x+4,z:z+4})<14)&&(!best||n>best.n))best={cells,n};}
    areaDraft={cells:new Set(best.cells),erase:false,editId:null};const info=areaDraftInfo();renderSheet();
    const button=!!document.querySelector('[data-action=hubLevel]'),blocked=document.querySelector('[data-action=areaBuild]').disabled;
    const trailH=world.trails.flatMap((t)=>t.samples.map((p)=>trueY(p.x,p.z))),liftH=world.lifts.map((L)=>[trueY(L.a.x,L.a.z),trueY(L.b.x,L.b.z)]);
    const G0=Float32Array.from(GR),inside=new Set(best.cells.map((k)=>(keyZ(k)+HALF)*NV+keyX(k)+HALF));
    // Walking pace: up the steepest square's slope slower the steeper it is, full pace downhill.
    const k0=best.cells.reduce((a,k)=>GR[(keyZ(k)+HALF)*NV+keyX(k)+HALF]>GR[(keyZ(a)+HALF)*NV+keyX(a)+HALF]?k:a),x0=keyX(k0),z0=keyZ(k0),gr=GR[(z0+HALF)*NV+x0+HALF];
    let up=null;for(let a=0;a<Math.PI*2;a+=Math.PI/16){const p={x:x0+Math.cos(a)*0.5,z:z0+Math.sin(a)*0.5};if(!up||trueY(p.x,p.z)>trueY(up.x,up.z))up=p;}
    const pace=(tx,tz)=>climbPace({x:x0,z:z0,tx,tz});
    const climb={grade:+gr.toFixed(2),up:+pace(x0+(up.x-x0)*8,z0+(up.z-z0)*8).toFixed(2),down:pace(x0-(up.x-x0)*8,z0-(up.z-z0)*8),expect:+(1/(1+2.3*gr)).toFixed(2)};
    const est=hubLevel(areaDraft.cells,true),cash=state.cash;
    document.querySelector('[data-action=hubLevel]').click();
    const after=areaDraftInfo();
    return {steepBefore:info.steep.length,said:document.body.textContent.includes('walk up steep ground slowly'),problems:info.problems,button,blocked,climb,est:est.cost,paid:cash-state.cash,
      steepAfter:after.steep.length,left:est.left,canBuild:!after.problems.length,
      // The bank around it is no steeper than a natural embankment, or than the slope already was.
      bankOk:best.cells.every((k)=>{const ci=keyX(k)+HALF,cj=keyZ(k)+HALF;for(let j=cj-8;j<=cj+8;j++)for(let i=ci-8;i<=ci+8;i++){const v=j*NV+i;if(!inside.has(v)&&GR[v]>Math.max(0.9,G0[v])+0.05)return false;}return true;}),
      trailsKept:world.trails.flatMap((t)=>t.samples.map((p)=>trueY(p.x,p.z))).every((h,i)=>Math.abs(h-trailH[i])<1e-6),
      liftsKept:world.lifts.every((L,i)=>Math.abs(trueY(L.a.x,L.a.z)-liftH[i][0])<1e-6&&Math.abs(trueY(L.b.x,L.b.z)-liftH[i][1])<1e-6)};
  })()`);
  assert(steep.steepBefore>=10,`the fixture has real steep ground: ${JSON.stringify(steep)}`);
  eq({said:steep.said,button:steep.button,blocked:steep.blocked,problems:steep.problems},{said:true,button:true,blocked:false,problems:[]},'steep ground is explained and offers leveling, but painting it is allowed');
  assert(steep.climb.down===1&&steep.climb.up<0.75&&Math.abs(steep.climb.up-steep.climb.expect)<0.15,`guests walk up steep ground slowly and down it at full pace: ${JSON.stringify(steep.climb)}`);
  assert(steep.est>0&&steep.paid===steep.est,`leveling charges exactly its estimate: ${JSON.stringify(steep)}`);
  eq({after:steep.steepAfter,canBuild:steep.canBuild},{after:steep.left,canBuild:true},'leveling leaves only the squares it said it could not ease');
  assert(steep.steepAfter<=steep.steepBefore*0.1,`leveling eases nearly all steep ground: ${steep.steepBefore} → ${steep.steepAfter}`);
  eq({trails:steep.trailsKept,lifts:steep.liftsKept},{trails:true,lifts:true},'trails and lift stations keep their height');
  eq(steep.bankOk,true,'the bank outside the area is no steeper than a natural embankment or the original slope');

  const base=await g.ev(`(() => {
    clearAreaDraft();
    // A guest area from the base up past the natural base edge; a lodge spot inside it but above the base.
    const L=world.lifts[0],cells=[];for(let z=20;z<=62;z++)for(let x=-40;x<=6;x++)if(!hubCellProblem(x,z,hubBlocks(null)))cells.push(cellKey(x,z));
    const keep=[...hubFlood(new Set(cells),cells[cells.length-1]).parent.keys()];
    let spot=null;for(const k of keep){const p={x:keyX(k),z:keyZ(k)};if(isBase(p))continue;if(isBase({x:p.x,z:p.z+4})||isBase({x:p.x,z:p.z-4})||isBase({x:p.x+4,z:p.z})||isBase({x:p.x-4,z:p.z}))continue;const i=evalBuilding('rental',p.x,p.z,0);if(i.problems.some((q)=>q.includes('belongs in the base'))){spot=p;break;}}
    if(!spot)throw Error('no rental-shop spot above the natural base');
    addArea({id:world.nextId++,kind:'hub',name:'Base test',cells:keep,cost:0});computeNetwork();
    const inArea=evalBuilding('rental',spot.x,spot.z,0).problems.filter((q)=>q.includes('belongs in the base'));
    const mid={x:12,z:-6},midArea=[];for(let x=8;x<=16;x++)for(let z=-10;z<=-2;z++)if(!hubCellProblem(x,z,hubBlocks(null)))midArea.push(cellKey(x,z));
    addArea({id:world.nextId++,kind:'hub',name:'Mid test',cells:midArea,cost:0});computeNetwork();
    return {inArea,based:!!areaById(world.areas.at(-2).id).basePoint,midProblems:evalBuilding('rental',mid.x,mid.z,0).problems.some((p)=>p.includes('belongs in the base'))};
  })()`);
  eq(base.based,true,'the fixture area touches the base');
  eq(base.inArea,[],'a rental shop can go in a guest area that touches the base');
  eq(base.midProblems,true,'a mid-mountain guest area still does not take base-only buildings');
  eq(g.errors,[],'no page errors');await g.page.close();
  return `allowance ${cost.free} squares; steep ${steep.steepBefore} → ${steep.steepAfter} for $${steep.paid}; ${Math.round(steep.climb.grade*100)}% climb at ${Math.round(steep.climb.up*100)}% pace`;
}
