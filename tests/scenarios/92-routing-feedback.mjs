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
  // Build an upper lift at a real gentle uphill walking site that the old six-meter gate rejected.
  const transfer=await g.ev(`(() => {
    state.phase='closed';const L=world.lifts[0];let info;
    for(let dx=-9;dx<=9&&!info;dx+=0.5)for(let dz=-9;dz<=9&&!info;dz+=0.5){
      const a={x:L.b.x+dx,z:L.b.z+dz},M={a,type:'double',fromBase:false};
      if(liftTransferMode(L,M)!=='walk')continue;
      for(const offset of [0,6,-6]){
        const candidate=evalLift(a,{x:a.x+offset,z:a.z-30},'double');
        if(!candidate.problems.length){info=candidate;break;}
      }
    }
    if(!info)throw Error('No legal gentle uphill transfer fixture');
    const M=commitLift(info,'double');let built=false;
    for(const offset of [6,-6,10,-10]){
      const pts=[[M.b.x+3,M.b.z+2],[M.b.x+offset,0],[L.a.x+8,30],[L.a.x+3,L.a.z+2]].map(([x,z])=>({x,z,y:heightAt(x,z)}));
      const t=evalTrail(pts,'medium',false,true);
      if(!t.an.problems.length){commitTrail(t,pts,'medium');built=true;break;}
    }
    if(!built)throw Error('No valid upper return trail');
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
