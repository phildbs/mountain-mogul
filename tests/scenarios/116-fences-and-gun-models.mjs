// Guest areas lost their boundary fence in 3.0 (placed mesh fences replaced it): an old save's fence draws
// nothing and the bulldozer finds no sections. Bulldoze still hides one snow gun model without disabling snowmaking.
import {openGame,eq,assert,SETUPS} from '../harness.mjs';
export default async function({browser,url}) {
  const g=await openGame(browser,url,{width:390,height:844,hasTouch:true});await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
  const initial=await g.ev(`(() => {
    const T=realTrails()[0],p=T.samples[Math.floor(T.samples.length/2)],cells=[];
    for(let x=Math.round(p.x)-13;x<=Math.round(p.x)+13;x++)for(let z=Math.round(p.z)-13;z<=Math.round(p.z)+13;z++)cells.push(cellKey(x,z));
    const A={id:world.nextId++,name:'Fence test',kind:'hub',cells,cost:0,fenced:true,sm:{on:true,mode:'always',target:18}};
    addArea(A);T.sm={on:true,mode:'always',target:30};computeNetwork();syncLabels();
    window.__fenceTest={aid:A.id,tid:T.id};
    return {sections:A.fenceSections.length,drawn:A.fence.children.length};
  })()`);
  eq(initial,{sections:0,drawn:0},'an old guest area with its fence on draws no fence');
  await g.ev(`(() => {state.landMode='doze';setTool('clear');hover.touch=true;})()`);
  const tap=async(p)=>g.ev(`(() => {cam.target.set(${p.x},${p.y},${p.z});updateCamera();const p=project(${p.x},${p.y},${p.z});const hit=dozeTarget(p.x,p.y);dozeAt(p.x,p.y);return hit.kind;})()`);
  const gun=await g.ev(`(() => {const q=gunSpots.find(q=>q.t.id===__fenceTest.tid),T=q.t;return {key:q.key,x:q.x,z:q.z,y:q.y+.66,models:gunMesh.count,spots:gunSpots.length,sm:JSON.stringify(T.sm),count:gunCount(T),cost:snowmakingCost(T),run:runSnowmaking(-20).cost,machine:T.machine};})()`);
  eq(await tap(gun),'gun','bulldozer can target the snow gun model');
  const after=await g.ev(`(() => {const T=trailById(__fenceTest.tid),run=runSnowmaking(-20);return {models:gunMesh.count,spots:gunSpots.length,hidden:world.noGuns,sm:JSON.stringify(T.sm),count:gunCount(T),cost:snowmakingCost(T),run:run.cost,making:T.machine>${gun.machine}};})()`);
  eq(after,{models:gun.models-1,spots:gun.spots,hidden:[gun.key],sm:gun.sm,count:gun.count,cost:gun.cost,run:gun.run,making:true},'only the model disappears; snowmaking, gun coverage and costs keep working');
  await g.ev('saveNow()');await g.page.reload();await g.reloaded();await g.click('#startBtn');
  eq(await g.ev(`({gun:world.noGuns,models:gunMesh.count})`),{gun:[gun.key],models:gun.models-1},'gun-model removals survive a real reload');
  const undoGun=await g.ev(`(() => {const n=gunMesh.count,q=gunSpots.find(q=>!q.hidden);pushUndo('hiding a snow gun model');world.noGuns.push(q.key);rebuildGuns();const removed=gunMesh.count===n-1;undoLast();return removed&&gunMesh.count===n;})()`);
  eq(undoGun,true,'Undo restores a snow gun model');
  eq(g.errors,[],'no page errors');await g.page.close();
}
