// Fence gaps follow whole trails; Bulldoze removes one saved section or gun model without disabling snowmaking.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url,{width:390,height:844,hasTouch:true});await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const initial=await g.ev(`(() => {
    const T=realTrails()[0],p=T.samples[Math.floor(T.samples.length/2)],cells=[];
    for(let x=Math.round(p.x)-13;x<=Math.round(p.x)+13;x++)for(let z=Math.round(p.z)-13;z<=Math.round(p.z)+13;z++)cells.push(cellKey(x,z));
    const A={id:world.nextId++,name:'Fence test',kind:'hub',cells,cost:0,fenced:true,sm:{on:true,mode:'always',target:18}};
    addArea(A);T.sm={on:true,mode:'always',target:30};computeNetwork();syncLabels();
    window.__fenceTest={aid:A.id,tid:T.id};
    const clear=()=>A.fenceSections.every(q=>realTrails().every(t=>t.samples.every(p=>distXZ(q,p)>TRAIL_WIDTHS[t.width].hw+.2)));
    if(!A.fenceSections.length)throw Error('No fence fixture sections');
    const q=A.fenceSections[0],key=q.key,N={id:world.nextId++,name:'Crossing fence',pts:[{x:q.x-8,z:q.z},{x:q.x+8,z:q.z}],width:'narrow',open:false,sign:0};
    addTrail(N);computeNetwork();const newGap=!A.fenceSections.some(s=>s.key===key);removeTrail(N);computeNetwork();
    return {clear:clear(),newGap,restored:A.fenceSections.some(s=>s.key===key)};
  })()`);
  eq(initial,{clear:true,newGap:true,restored:true},'fences leave every trail ribbon clear, including a newly built crossing');
  const fence=await g.ev(`(() => {state.landMode='doze';setTool('clear');hover.touch=true;const A=areaById(__fenceTest.aid),q=A.fenceSections[0];return {key:q.key,n:A.fenceSections.length,x:q.x,z:q.z,y:heightAt(q.x,q.z)+.3,cash:state.cash};})()`);
  const tap=async(p)=>g.ev(`(() => {cam.target.set(${p.x},${p.y},${p.z});updateCamera();const p=project(${p.x},${p.y},${p.z});const hit=dozeTarget(p.x,p.y);dozeAt(p.x,p.y);return hit.kind;})()`);
  eq(await tap(fence),'fence','phone-sized hit test chooses the fence section');
  eq(await g.ev(`({n:areaById(__fenceTest.aid).fenceSections.length,gone:areaById(__fenceTest.aid).noFence,cash:state.cash})`),{n:fence.n-1,gone:[fence.key],cash:fence.cash},'one free tap removes exactly one section');
  const gun=await g.ev(`(() => {const q=gunSpots.find(q=>q.t.id===__fenceTest.tid),T=q.t;return {key:q.key,x:q.x,z:q.z,y:q.y+.66,models:gunMesh.count,spots:gunSpots.length,sm:JSON.stringify(T.sm),count:gunCount(T),cost:snowmakingCost(T),run:runSnowmaking(-20).cost,machine:T.machine};})()`);
  eq(await tap(gun),'gun','bulldozer can target the snow gun model');
  const after=await g.ev(`(() => {const T=trailById(__fenceTest.tid),run=runSnowmaking(-20);return {models:gunMesh.count,spots:gunSpots.length,hidden:world.noGuns,sm:JSON.stringify(T.sm),count:gunCount(T),cost:snowmakingCost(T),run:run.cost,making:T.machine>${gun.machine}};})()`);
  eq(after,{models:gun.models-1,spots:gun.spots,hidden:[gun.key],sm:gun.sm,count:gun.count,cost:gun.cost,run:gun.run,making:true},'only the model disappears; snowmaking, gun coverage and costs keep working');
  await g.ev('saveNow()');await g.page.reload();await g.reloaded();await g.click('#startBtn');
  eq(await g.ev(`({fence:world.areas.find(a=>a.name==='Fence test').noFence,gun:world.noGuns,models:gunMesh.count})`),{fence:[fence.key],gun:[gun.key],models:gun.models-1},'fence and gun-model removals survive a real reload');
  // Test Undo using a fresh removal, since sessions deliberately do not retain undo history.
  const undone=await g.ev(`(() => {const A=world.areas.find(a=>a.name==='Fence test'),before=A.fenceSections.length;pushUndo('removing a fence section');A.noFence.push(A.fenceSections[0].key);refreshAreaMesh(A);undoLast();return world.areas.find(a=>a.name==='Fence test').fenceSections.length===before;})()`);
  eq(undone,true,'Undo restores a fence section');
  const undoGun=await g.ev(`(() => {const n=gunMesh.count,q=gunSpots.find(q=>!q.hidden);pushUndo('hiding a snow gun model');world.noGuns.push(q.key);rebuildGuns();const removed=gunMesh.count===n-1;undoLast();return removed&&gunMesh.count===n;})()`);
  eq(undoGun,true,'Undo restores a snow gun model');
  eq(g.errors,[],'no page errors');await g.page.close();
}
