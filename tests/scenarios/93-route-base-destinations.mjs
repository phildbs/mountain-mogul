// Lookahead must use the base where a trail ends, including the actual way back to a guest's car.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { build } from '../twin-resort.mjs';
export default async function ({ browser, url }) {
  const g=await openGame(browser,url,{mountain:'twin'});
  await g.click('#startBtn');await g.wait(300);await g.ev(build);await g.ev(SETUPS.midwinter);
  const result=await g.ev(`(() => {
    state.lotLayout=[[0,0,0],[0,0,1]];state.lotSections=2;buildLot();openDay();state.time=600;schedule=[];
    const E=world.lifts.find(L=>baseOf(L.a)===0),W=world.lifts.find(L=>baseOf(L.a)===1);
    if(!E||!W)throw Error('Need a lift at each base');
    const spot=stalls.findIndex(s=>s.lot===1);cars=[{id:990001,stall:spot,members:[]}];
    const p=makeGuest({id:990001},W.a.x,W.a.z);Object.assign(p,{ab:2,pref:2,leaveAt:1000,stam:1000,leaving:false});
    E.open=false;
    const disconnected=crossCost(0,1)===Infinity;
    const eastValue=vBase(p,0,new Map(),E.a),westValue=vBase(p,0,new Map(),W.a);
    p.leaving=true;
    const home=vEnd({to:{kind:'base'},samples:[W.a]},p,0,new Map());
    const wrong=vEnd({to:{kind:'base'},samples:[E.a]},p,0,new Map());
    E.open=true;const wrongLift=vLift(E,p,0,new Map());
    p.bus=true;p.car=null;const bus=vBase(p,0,new Map(),E.a);p.bus=false;p.car=990001;
    const P=(u,v)=>({x:160*u-80,z:80-160*v});let village;
    for(const dz of [2,4,-6,-8,0]){
      const a=P(.62,.14),b=P(.34,.14);a.z+=dz;b.z+=dz;
      const i=evalLift(a,b,'village');if(!i.problems.length){village=commitLift(i,'village');computeNetwork();break;}
    }
    if(!village)throw Error('No valid village connection');
    const linked=vBase(p,0,new Map(),E.a),cost=crossCost(0,1);
    village.open=false;const stopped=vBase(p,0,new Map(),E.a);
    return {disconnected,eastValue,westValue,home,wrong,wrongLift,bus,linked,cost,stopped};
  })()`);
  assert(result.disconnected && result.eastValue===-20 && result.westValue>result.eastValue, `an isolated base cannot borrow the other side's open lift: ${JSON.stringify(result)}`);
  eq([result.home,result.wrong,result.wrongLift,result.bus],[25,-40,-47,25],'homebound car guests avoid a disconnected foreign base; guests without a parked car keep their exit option');
  assert(result.cost<Infinity && result.linked===25-result.cost && result.linked>result.wrong && result.linked<result.home, 'an operating crossing makes the other base reachable with its transfer cost');
  eq(result.stopped,-40,'a stopped village gondola is not a route home');
  eq(g.errors,[],'no page errors');await g.page.close();
}
