import '../rescue-reputation.mjs';
import {openGame, eq, assert, SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  await g.ev(`(() => {
    state.cash=1e8;const base=world.buildings[0];let B;
    for(let dz=-12;dz<=16&&!B;dz+=4)for(let dx=-20;dx<=20&&!B;dx+=4){const x=base.x+dx,z=base.z+dz,i=evalBuilding('patrol',x,z,0);if(!i.problems.length)B=commitBuilding(i,'patrol',x,z,0);}
    if(!B)throw Error('No patrol site');
    window.settleCoverage=(injured,missed,glade,roll=1,rep=1,sat=66)=>{
      state.phase='closed';state.cash=1e8;state.reputation=rep;openDay();state.speed=0;
      Object.assign(today,{injuries:injured,unhelped:missed,rescues:[],satN:1,satSum:sat,leftLines:0});
      today.glades=glade?{[-110]:{n:injured,severe:injured,resp:0,reached:injured-missed,unhelped:missed}}:{};
      const random=Math.random;try{Math.random=()=>roll;endDay();}finally{Math.random=random;}
      return {rep:state.reputation,breakdown:state.lastReport.rescueRep,claims:state.lastReport.exp.claims};
    };
  })()`);
  const normal=await g.ev('settleCoverage(100,20,false)');
  assert(Math.abs(normal.rep-.99)<1e-10,'20% missed reduces reputation by .01');
  const glade=await g.ev('settleCoverage(100,20,true,0)');
  assert(glade.claims>0,'forced claim settlement still charges money');
  eq(glade.rep,normal.rep,'glade injury and claims do not add another reputation penalty');
  const large=await g.ev('settleCoverage(1000,200,true)');eq(large.rep,normal.rep,'larger resort with same coverage loses the same amount');
  const capped=await g.ev('settleCoverage(1000,1000,true,0)');assert(Math.abs(capped.rep-.95)<1e-10,'one catastrophic day cannot cost more than .05 rescue reputation');
  const floor=await g.ev('settleCoverage(100,100,true,0,.5)');eq([floor.rep,floor.breakdown.applied],[.5,0],'reputation floor and actual reported loss agree');
  const recovery=await g.ev('settleCoverage(100,0,false,1,1,96)');assert(recovery.rep>1,'satisfaction still improves reputation separately');
  await g.ev('settleCoverage(100,20,true)');
  const text=await g.ev(`$('rpBody').innerText`);
  assert(text.includes('20 of 100 injured')&&text.includes('1.00 points')&&text.includes('daily limit is 5 points'),'real report explains the coverage penalty');
  const before=await g.ev('state.lastReport.rescueRep');
  await g.ev('saveNow()');await g.page.reload();await g.reloaded();
  eq(await g.ev('state.lastReport.rescueRep'),before,'report explanation survives reload without changing its result');
  const old=await g.ev(`(() => { const r=JSON.parse(JSON.stringify(state.lastReport));delete r.rescueRep;return rescueReputationNote(r); })()`);eq(old,'','historical reports do not invent a new penalty');
  eq(g.errors,[],'no page errors');await g.page.close();
}
