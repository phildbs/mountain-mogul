// Night closing applies to upper lifts too; clearing guests retain lights beyond thirty minutes.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url);
  await g.click('#startBtn');await g.wait(300);
  await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const result=await g.ev(`(() => {
    state.cash=2e7;
    const info=evalLift({x:22,z:-8},{x:25,z:-38},'double');
    if(info.problems.length)throw Error(info.problems.join('|'));
    const M=commitLift(info,'double');
    const pts=[[M.b.x+3,M.b.z+2],[M.b.x+8,(M.b.z+15)/2],[23,16]].map(([x,z])=>({x,z,y:heightAt(x,z)}));
    const t=evalTrail(pts,'medium',false,true);
    if(t.an.problems.length)throw Error(t.an.problems.join('|'));
    commitTrail(t,pts,'medium');computeNetwork();
    for(const T of realTrails())T.lit=true;
    for(const k of ['weekday','weekend','quiet']){opsState().plans[k].night=1200;opsState().plans[k].apres='on';}
    state.day=40;openDay();schedule=[];state.time=1199;
    const L=world.lifts[0];
    const before=canLoad(L)&&canLoad(M);
    // Also check that an unlit upper lift cannot take recreational night traffic.
    for(const T of M.departing)T.lit=false;
    const unlit=!canLoad(M);
    for(const T of M.departing)T.lit=true;
    const add=(x,z)=>{const p=makeGuest({id:null},x,z);Object.assign(p,{night:true,leaveAt:1300,needsRental:false,wantsLesson:false});guests.push(p);gById.set(p.id,p);return p;};
    const q=add(M.a.x,M.a.z);Object.assign(q,{st:'queue',L:M,qStart:1199});M.queue.push(q);
    const rider=add(M.a.x,M.a.z);Object.assign(rider,{st:'ride',L:M,chair:0});M.riders[0].push(rider.id);
    state.time=1200;
    // Boarding itself must reject a late arrival even before the closing sweep runs.
    loadBottom(M,1);
    const cutoff=!canLoad(L)&&!canLoad(M)&&q.st==='queue'&&!M.riders[1].includes(q.id);
    simStep(0);
    const swept=M.queue.length===0&&q.leaving&&q.st!=='queue';
    const drainStart=M.phase;stepLift(M,1.5);
    const draining=M.phase!==drainStart;
    state.time=1245;
    const prolonged=nightLightsOn()&&liftLightOn(M)&&dayHardEnd()>state.time;
    const c0=nightCost({cost:1});today.nightClearoutMinutes=45;const c1=nightCost({cost:1});
    const billed=c1.lights>c0.lights&&c1.staff>c0.staff;
    // Already aboard: disembark normally and do not rejoin either lift queue.
    unloadTop(M,0);
    const unloaded=rider.st!=='ride'&&rider.st!=='queue'&&!M.riders[0].length;
    guests=[];for(const lift of world.lifts)for(const r of lift.riders)r.length=0;
    const empty=!nightLightsOn();
    // A guest at base does not keep mountain lighting running for a late bar visit.
    const base=add(L.a.x,L.a.z);base.st='inside';
    const baseOnly=!nightLightsOn();
    return {before,unlit,cutoff,swept,draining,prolonged,billed,unloaded,empty,baseOnly};
  })()`);
  assert(Object.values(result).every(Boolean),`night cutoff and clear-out: ${JSON.stringify(result)}`);
  eq(g.errors,[],'no page errors');await g.page.close();
}
