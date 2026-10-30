// A base village painted up the hill: its lift counts as a base lift, and guests from the lot walk up through the
// painted area to it (and back down to their cars) instead of cutting straight through the trees.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const setup=await g.ev(`(() => {
    state.cash=1e9;const old=world.lifts[0];
    // An L: up the far west side from the natural base, then across to the village, so the straight line from the
    // base to the village lift would cross about 30 units of unpainted forest.
    const cells=[];for(let x=-62;x<=-4;x++)for(let z=6;z<=68;z++)if((x<=-50||z<=16)&&!hubCellProblem(x,z,hubBlocks(null)))cells.push(cellKey(x,z));
    const keep=[...hubFlood(new Set(cells),cells[cells.length-1]).parent.keys()];
    addArea({id:world.nextId++,kind:'hub',name:'Village',cells:keep,cost:0});computeNetwork();
    const A=world.areas.at(-1);
    // Its own lift starts in the strip, above the natural base.
    let L=null;for(let z=14;z>=8&&!L;z-=2)for(let x=-8;x>=-30&&!L;x-=2){const a={x,z};if(isBase(a)||hubAt(a)!==A)continue;for(const dz of [55,60,65,50])for(const dx of [0,-4,4]){const b={x:x+dx,z:z-dz},i=evalLift(a,b,'quad');if(!i.problems.length){commitLift(i,'quad');L=world.lifts.at(-1);break;}}}
    if(!L)throw Error('no village lift site');
    const pts=[{x:L.b.x+2,z:L.b.z+3},{x:L.b.x+6,z:(L.b.z+L.a.z)/2},{x:L.a.x+3,z:L.a.z-2}],i=evalTrail(pts,'medium',false,false);
    if(i.an.problems.length)throw Error('village trail: '+i.an.problems.join('; '));
    commitTrail(i,pts,'medium');computeNetwork();syncLabels();
    old.open=false; // only the village lift runs, so every arrival has to get up there
    return {aboveBase:!isBase(L.a),blocked:(()=>{let o=0;for(let f=0;f<=1;f+=0.02){const x=L.a.x,z=L.a.z+(44-L.a.z)*f;if(!hubAt({x,z})&&!isBase({x,z}))o++;}return o>20;})(),fromBase:L.fromBase,reachable:L.reachable,lift:L.id,climb:Math.round(trueY(L.a.x,L.a.z)-MOUNTAIN.baseH),villageTrailReturns:world.trails.at(-1).returns};
  })()`);
  eq(setup,{...setup,aboveBase:true,blocked:true,fromBase:true,reachable:true,villageTrailReturns:true},'a lift starting up in the painted village is a base lift');
  const day=await g.ev(`(() => {
    openDay();state.speed=0;
    // Walks starting on the base or painted ground; an injured skier out on a trail still heads straight down.
    const ok=(x,z)=>!!hubAt({x,z})||isBase({x,z});let off=0,worst=0,moves=0;const orig=setMove;
    setMove=(gg,p,mode,then)=>{if((mode==='walk'||mode==='glide')&&gg.x!=null){moves++;const d=Math.hypot(p.x-gg.x,p.z-gg.z),n=Math.ceil(d/0.5);let o=0;for(let i=1;i<n;i++){const f=i/n;if(!ok(gg.x+(p.x-gg.x)*f,gg.z+(p.z-gg.z)*f))o+=d/n;}if(o>3&&ok(gg.x,gg.z)){off++;worst=Math.max(worst,o);}}return orig(gg,p,mode,then);};
    let n=0;while(state.phase==='open'&&n++<90000)simStep(1.5);setMove=orig;
    const r=state.lastReport;return {moves,off,worst:Math.round(worst),rides:r.liftRides[${setup.lift}]||0,guests:r.guests,phase:state.phase};
  })()`);
  assert(day.rides>50&&day.guests>50,`guests ride the village lift all day: ${JSON.stringify(day)}`);
  eq({off:day.off,phase:day.phase},{off:0,phase:'report'},'nobody walks across unpainted ground between the lot and the village, and the day ends');
  eq(g.errors,[],'no page errors');await g.page.close();
  return `${day.guests} guests, ${day.rides} rides from a village ${setup.climb} m above the base; ${day.moves} walks and glides, none off the paths`;
}
