// Fork choices must value both remaining runs; nearby uphill lift connections use walking movement.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g=await openGame(browser,url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev('state.cash=2e7; openDay(); state.time=600; schedule=[];');
  const fork=await g.ev(`(() => {
    const original=realTrails()[0], at=Math.floor(original.samples.length*2/3);
    const blue={...original,id:-9202,sign:1,an:{...original.an,len:40},surface:'packed',branches:[],stops:[],to:{kind:'base'},open:true,snowOk:true};
    const black={...original,id:-9201,sign:2,an:{...original.an,len:160},surface:'packed',branches:[{at,trail:blue}],stops:[],to:{kind:'lift',obj:world.lifts[0]},open:true,snowOk:true};
    const savedRandom=Math.random;let seed=92929;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    try {
      const group=(ab,pref,n)=>{
        let branch=0,stay=0;
        for(let i=0;i<n;i++){
          const p=makeGuest({id:null},0,0);Object.assign(p,{ab,pref,explore:1,first:false,seen:{},leaving:false,leaveAt:1000,fat:0,stam:1000});
          startSki(p,black,at*0.5);updateSki(p,0);
          if(p.T===blue)branch++;else if(p.T===black)stay++;
        }
        return {branch,stay};
      };
      const experts=group(2,2,200),blueFans=group(2,1,200),intermediates=group(1,1,100);
      blue.open=false;const closed=group(2,1,100);
      return {experts,blueFans,intermediates,closed};
    }finally{Math.random=savedRandom;}
  })()`);
  assert(fork.experts.stay>150, `black-preferring advanced skiers usually continue: ${JSON.stringify(fork)}`);
  assert(fork.blueFans.branch>30 && fork.blueFans.stay>30, 'equally attractive routes have a mix of choices');
  eq(fork.intermediates,{branch:100,stay:0},'skiers out of their depth can still take the easier escape');
  eq(fork.closed,{branch:0,stay:100},'closed branches are never chosen');
  // A controlled ten-percent station approach isolates walking from the natural terrain's steeper grades.
  // Keep the established upper-lift/return-trail layout used by scenario 30.
  const transfer=await g.ev(`(() => {
    state.phase='closed';const L=world.lifts[0],y=trueY(L.b.x,L.b.z);
    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const x=i-HALF,z=j-HALF;
      if(x>=L.b.x-1&&x<=L.b.x+11&&Math.abs(z-L.b.z)<=2)HT[j*NV+i]=y+(x-L.b.x)*0.1;
    }
    for(let j=1;j<WN;j++)for(let i=1;i<WN;i++){
      const dx=(HT[j*NV+i+1]-HT[j*NV+i-1])/2,dz=(HT[(j+1)*NV+i]-HT[(j-1)*NV+i])/2;
      GR[j*NV+i]=Math.hypot(dx,dz);
    }
    const a={x:L.b.x+10,z:L.b.z};
    const info=evalLift(a,{x:25,z:-38},'double');
    if(info.problems.length)throw Error('Upper lift fixture: '+info.problems.join('|'));
    const M=commitLift(info,'double');
    const pts=[[M.b.x+3,M.b.z+2],[M.b.x+8,(M.b.z+15)/2],[23,16]].map(([x,z])=>({x,z,y:heightAt(x,z)}));
    const t=evalTrail(pts,'medium',false,true);
    if(t.an.problems.length)throw Error('Upper return fixture: '+t.an.problems.join('|'));
    commitTrail(t,pts,'medium');
    computeNetwork();refreshSnowState(todayWx());
    const connected=L.transfers.includes(M)&&M.transferFrom.includes(L)&&M.reachable;
    const oldRejected=trueY(M.a.x,M.a.z)>trueY(L.b.x,L.b.z)+0.6;
    const panel=liftSheet(L).includes('walk over');
    openDay();state.time=600;schedule=[];
    for(const T of L.departing)T.open=false;
    const p=makeGuest({id:null},L.b.x,L.b.z);Object.assign(p,{leaveAt:1000,fat:0,stam:1000,ab:2,pref:2});
    const chose=topDecision(p,L,true)&&p.L===M&&p.st==='walk'&&!p.onSkis;
    if(chose){moveToward(p,WALK,100000);arrive(p);}
    const queued=p.st==='queue'&&M.queue.includes(p);
    M.open=false;
    const q=makeGuest({id:null},L.b.x,L.b.z);Object.assign(q,{leaveAt:1000,fat:0,stam:1000});
    const closed=topDecision(q,L,true)===false;
    const far=liftTransferMode(L,{type:'double',fromBase:false,a:{x:L.b.x+TRANSFER_R+1,z:L.b.z}})===null;
    return {connected,oldRejected,panel,chose,queued,closed,far};
  })()`);
  assert(Object.values(transfer).every(Boolean), `uphill transfers link, walk and queue while closed/far lifts are excluded: ${JSON.stringify(transfer)}`);
  eq(g.errors,[],'no page errors');
  await g.page.close();
}
