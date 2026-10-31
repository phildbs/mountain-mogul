// Guest areas: guests walk around buildings (in through the door, not through the walls), a full seat never sends a
// guest to a seat outside their area, and a guest who ends a stop just off the area steps back on instead of
// "hiking out" down the mountain (a player saw summit guests drift to the base after sitting on nearby benches).
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const r=await g.ev(`(() => {
    state.cash=1e8;const cells=[];for(let x=-70;x<=-50;x++)for(let z=-10;z<=10;z++)cells.push(cellKey(x,z));
    const A={id:world.nextId++,name:'Test area',kind:'hub',cells,cost:0};addArea(A);
    const put=(type,x,z)=>{const i=evalBuilding(type,x,z,0);if(i.problems.length)throw Error(type+': '+i.problems);return commitBuilding(i,type,x,z,0);};
    const cafe=put('cafe',-60,0),inBench=put('bench',-56,6),outBench=put('bench',-47,6);
    computeNetwork();
    const box=boxOf(cafe,-0.3),inside=(p)=>p.x>box.x0&&p.x<box.x1&&p.z>box.z0&&p.z<box.z1;
    const walk=(from,to)=>{const q={x:from.x,z:from.z,then:null};if(!walkHub(q,A,to,{k:'test'}))return null;const pts=[from,{x:q.tx,z:q.tz},...q.then.path.map(([x,z])=>({x,z}))];
      let through=false;for(let i=1;i<pts.length;i++)for(let f=0;f<=1;f+=0.05)if(inside({x:pts[i-1].x+(pts[i].x-pts[i-1].x)*f,z:pts[i-1].z+(pts[i].z-pts[i-1].z)*f}))through=true;return {pts,through,end:pts.at(-1)};};
    const across=[];for(let i=0;i<10;i++)across.push(walk({x:-60,z:-8},{x:-60,z:8}));
    const toDoor=walk({x:-68,z:-8},cafe.door);
    return {
      across:across.every((w)=>w&&!w.through&&w.end.x===-60&&w.end.z===8),
      door:!!toDoor&&!toDoor.through&&distXZ(toDoor.end,cafe.door)<0.01,
      inArea:hubAt(inBench.door)===A,outArea:hubAt(outBench.door)!==A&&distXZ(outBench.door,inBench.door)<15,
      ids:[inBench.id,outBench.id,A.id]
    };
  })()`);
  eq(r.across,true,'walks across the area go around the café, never through it');
  eq(r.door,true,'the café door is still reached exactly, without cutting through the building');
  eq([r.inArea,r.outArea],[true,true],'one bench in the area, another just outside it within reach');
  const [inId,outId,aid]=r.ids;
  const seat=await g.ev(`(() => {
    openDay();state.speed=0;let n=0;while(!guests.length&&n++<4000)simStep(1.5);
    const gg=guests[0],B=bldById(${inId}),A=areaById(${aid});
    B.used.seat=poolSlots(B,'seat'); // the bench in the area is full
    gg.x=B.door.x;gg.z=B.door.z;gg.svc='rest';gg.resume={k:'hub',aid:A.id};gg.bid=B.id;
    seatTaken(gg,B);
    const went=gg.bid;
    // A guest finishing a stop just off the area (as an older save could hold) walks back on, not down the mountain.
    const h=guests[1]||gg,O=bldById(${outId}),stranded=today.complaints.stranded;
    h.x=O.door.x;h.z=O.door.z;h.resume={k:'hub',aid:A.id};h.bid=null;h.svc=null;resumeGuest(h);
    const back=h.then&&h.then.k,onArea=hubAt({x:h.tx,z:h.tz})===A,lost=today.complaints.stranded-stranded;
    return {went,out:${outId},back,onArea,stranded:lost};
  })()`);
  assert(seat.went!==seat.out,`a full bench in the area never sends the guest to the bench outside it: ${JSON.stringify(seat)}`);
  eq([seat.back,seat.onArea,seat.stranded],['hubBack',true,0],'off the area, the guest walks back onto it and nobody hikes out');
  eq(g.errors,[],'no runtime errors');await g.page.close();
}
