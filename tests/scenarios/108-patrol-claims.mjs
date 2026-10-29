import '../patrol-claims.mjs';
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  await g.ev(`(() => {
    state.cash=1e8;const base=world.buildings[0];let B;
    for(let dz=-12;dz<=16&&!B;dz+=4)for(let dx=-20;dx<=20&&!B;dx+=4){const x=base.x+dx,z=base.z+dz,i=evalBuilding('patrol',x,z,0);if(!i.problems.length)B=commitBuilding(i,'patrol',x,z,0);}
    if(!B)throw Error('No valid patrol site');window.claimHut=B.id;
    window.beginRescue=(wait,miss=false)=>{
      state.phase='closed';state.cash=1e8;openDay();state.speed=0;state.time=600;schedule=[];guests=[];gById.clear();
      const B=bldById(window.claimHut);runOps.bld[B.id]=miss?'closed':'open';
      const p=makeGuest({id:null},B.door.x,B.door.z);Object.assign(p,{ate:true,lunchAt:2000,leaveAt:2000,ab:0});
      guests.push(p);gById.set(p.id,p);injure(p,realTrails()[0]);
      // A serious tree collision, independent of the player's signs or the guest's ability.
      p.severe=true;p.glade=-108;today.glades={[-108]:{n:1,severe:1,resp:0,reached:0,unhelped:0}};
      state.time=600+wait;for(const c of B.crew)Object.assign(c,{st:'idle',target:null,x:p.x,z:p.z});
      patrolStep(0);window.claimGuest=p.id;
      return {state:p.st,logged:p.rescueLogged,outcomes:today.rescues,missed:today.unhelped};
    };
    window.finishClaims=()=>{
      // Isolate settlement expenses from grooming/other costs already paid before opening.
      for(const k of Object.keys(today.exp))today.exp[k]=0;
      const before=state.cash,random=Math.random;try{Math.random=()=>0;endDay();}finally{Math.random=random;}
      const r=state.lastReport;return{claims:r.exp.claims,review:r.rescueClaims,notes:opsNotes(r).join(' '),cash:Math.round(before-state.cash),expenses:Object.values(r.exp).reduce((a,b)=>a+b,0)};
    };
  })()`);
  for(const wait of [5,7,30,70]) {
    const pickup=await g.ev(`beginRescue(${wait})`);
    eq(pickup.state,'tow','actual crew reached the injured guest');eq(pickup.outcomes,[{wait,unhelped:false}],'response recorded at pickup');
    const report=await g.ev('finishClaims()');
    eq(report.claims,wait<=30?0:9000,`serious injury at ${wait} minutes only claims after substantial delay`);
    eq(report.cash,report.expenses,'claim expense reconciles with cash exactly once');
    if(wait>30)assert(report.notes.includes('longer than 30 minutes')&&!report.notes.includes('short-handed'),'report explains delay without guessing staffing cause');
  }
  const missed=await g.ev(`beginRescue(71,true)`);eq(missed.missed,1,'actual missed rescue recorded');
  const r=await g.ev('finishClaims()');eq([r.claims,r.review.unhelpedClaims,r.review.delayedClaims],[9000,1,0],'one claim for one missed rescue, no second roll for severe glade injury');assert(r.notes.includes('without patrol help'),'missed-help reason visible');
  await g.ev('beginRescue(7)');
  const saved=await g.ev(`(() => {
    const s=JSON.parse(JSON.stringify(saveData(true)));applySave(s);const p=gById.get(window.claimGuest),B=bldById(window.claimHut);
    state.time=680;for(const c of B.crew)Object.assign(c,{st:'idle',target:null,x:p.x,z:p.z});patrolStep(0);
    return {logged:p.rescueLogged,state:p.st,n:today.rescues.length,wait:today.rescues[0].wait};
  })()`);
  eq(saved,{logged:true,state:'tow',n:1,wait:7},'mid-rescue save/reload preserves original response without duplicate delayed outcome');
  eq((await g.ev('finishClaims()')).claims,0,'reloaded prompt rescue stays claim-free');
  await g.ev('beginRescue(7)');
  const old=await g.ev(`(() => {
    const s=JSON.parse(JSON.stringify(saveData(true)));delete s.sim.today.rescues;delete s.sim.guests[0].rescueLogged;
    applySave(s);const p=gById.get(window.claimGuest),B=bldById(window.claimHut);state.time=680;runOps.bld[B.id]='closed';patrolStep(0);
    const before=(today.rescues||[]).length;const random=Math.random;try{Math.random=()=>0;endDay();}finally{Math.random=random;}
    return {newRecords:before,claims:state.lastReport.exp.claims};
  })()`);
  eq(old,{newRecords:0,claims:0},'old towing save never invents a late rescue or second missed-rescue claim');
  eq(g.errors,[],'no page errors');await g.page.close();
}
