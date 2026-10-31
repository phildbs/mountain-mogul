import { openGame, eq, assert, SETUPS } from '../harness.mjs';
// Widening and shaping a trail: per-station widths, charging only new ground, blueprints while open,
// upkeep that follows width, saving, and a real drag on an edge dot (desktop and phone).
export default async function({browser,url}) {
 // A real drag on an edge dot, at desktop and phone sizes.
 for (const size of [{width:1280,height:900},{width:390,height:844,hasTouch:true}]) {
 const g=await openGame(browser,url,size);
 await g.click('#startBtn'); await g.wait(800); await g.ev(SETUPS.juniperStarter);
 const phone=size.width<500;

 // A real drag on an edge dot widens that station.
 const dot=await g.ev(`(()=>{const t=realTrails()[1];const m=t.samples[Math.floor(t.samples.length/2)];cam.target.set(m.x,heightAt(m.x,m.z),m.z);updateCamera();sheetSize('min');startShape(t);sheetSize('min');recomputeDraft();updateHandles();
  const c=(el)=>{const r=el.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];};
  for(const el of handleLayer.querySelectorAll('.edge')){const [x,y]=c(el);if(document.elementFromPoint(x,y)===el&&+el.dataset.side===1)return +el.dataset.k;}
  return -1;})()`);
 assert(dot>=0,'an edge dot is exposed on the map');
 await g.page.waitForTimeout(300);
 const before=await g.ev(`JSON.stringify(draft.ws)`);
 const k=dot;
 const rect=(side)=>g.ev(`(()=>{updateHandles();const r=handleLayer.querySelector('.handle.edge[data-k="${k}"][data-side="${side}"]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
 const box=await rect(1),other=await rect(-1);
 assert(box.width>0&&box.x>0&&box.y>0,'edge dot is on screen');
 const cx=box.x+box.width/2,cy=box.y+box.height/2,ox=other.x+other.width/2,oy=other.y+other.height/2;
 const dx=(cx-ox)*0.3,dy=(cy-oy)*0.3; // pull outward, away from the other edge
 const hit=await g.ev(`(e=>e?e.tagName+'.'+e.getAttribute('class')+'#'+e.id+' @${cx},${cy} of '+innerWidth+'x'+innerHeight:'none')(document.elementFromPoint(${cx},${cy}))`);
 assert(String(hit).includes('edge'),'the dot is on top at its spot: '+hit);
 if(phone){const c=await g.page.context().newCDPSession(g.page);const tp=(type,x,y)=>c.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  await tp('touchStart',cx,cy);for(let i=1;i<=6;i++)await tp('touchMove',cx+dx*i/6,cy+dy*i/6);await tp('touchEnd');}
 else{await g.page.mouse.move(cx,cy);await g.page.mouse.down();await g.page.mouse.move(cx+dx,cy+dy,{steps:6});await g.page.mouse.up();}await g.page.waitForTimeout(200);
 const after=await g.ev(`(()=>{recomputeDraft();return {ws:draft.ws,cost:draft.info.cost,label:sheet.querySelector('[data-action=shapeApply]').textContent,disabled:sheet.querySelector('[data-action=shapeApply]').disabled};})()`);
 const b=JSON.parse(before);
 assert(after.ws[k]>b[k]+0.3,`drag widened station ${k}: ${b[k]} -> ${after.ws[k]}`);
 eq(after.ws.filter((v,i)=>i!==k),b.filter((v,i)=>i!==k),'other stations unchanged');
 assert(/^Reshape · \$/.test(after.label)&&!after.disabled,'overnight button: '+after.label);
 if(process.env.SHOTS) await g.page.screenshot({path:`/tmp/shape-${phone?'phone':'desktop'}.png`});
 await g.ev(`cancelShape()`);

 eq(g.errors,[],'no runtime errors while dragging');await g.page.close();
 }
 const g=await openGame(browser,url);
 await g.click('#startBtn'); await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
 // Overnight: narrow to Medium everywhere is free (no new ground, no trees).
 const narrow=await g.ev(`(()=>{state.cash=1e7;const t=realTrails()[0];t.machine=9;t.sm={on:true,mode:'auto',target:20};select({kind:'trail',obj:t});renderSheet();
  const btn=!!sheet.querySelector('[data-action=shapeTrail]');startShape(t);recomputeDraft();
  const n=draft.ws.length,handles=handleLayer.querySelectorAll('.edge').length;
  draft.ws=draft.ws.map(()=>TRAIL_WIDTHS.medium.hw);recomputeDraft();const info=draft.info,cash=state.cash,groomWas=groomCost(t),gunsWas=gunCount(t);shapeDraft();
  return {btn,handles:handles===2*n,n,cost:info.cost,charged:cash-state.cash,width:t.width,ws:t.ws===undefined,snow:t.machine===9,groomLess:groomCost(t)<groomWas,gunsLess:gunCount(t)<gunsWas,tool:state.tool};})()`);
 eq(narrow.btn,true,'trail card offers Widen or narrow');eq(narrow.handles,true,'two edge dots per station');
 eq(narrow.cost,0,'narrowing costs nothing');eq(narrow.charged,0,'nothing charged');eq(narrow.width,'medium','an even shape is stored as its preset');
 eq(narrow.ws,true,'no per-station widths for an even trail');eq(narrow.snow,true,'snow stays');eq(narrow.groomLess,true,'narrower grooms for less');eq(narrow.gunsLess,true,'fewer guns');eq(narrow.tool,'explore','tool closes');

 // Widen one section: pays for the new strip and its trees only, and the shape is kept and saved.
 const wide=await g.ev(`(()=>{const t=realTrails()[0];startShape(t);const k=Math.floor(draft.ws.length/2);draft.ws[k]=5.5;recomputeDraft();const info=draft.info;
  const full=Math.round(t.an.len*TRAIL_WIDTHS.wide.perUnit/100)*100;const cash=state.cash,groomWas=groomCost(t);shapeDraft();
  const saved=JSON.parse(JSON.stringify(saveData(false)));const st=saved.world?saved.world.trails[0]:null;
  applySave(saved);const a=realTrails().find(o=>o.id===t.id);
  return {problems:info.problems,grading:info.grading,less:info.grading>0&&info.grading<full/2,trees:info.treeSet.size,charged:cash-state.cash===info.cost,
   ws:!!a.ws&&a.ws[k]===5.5,max:a.hwMax>=5.4,label:trailWidthText(a).startsWith('Shaped'),groomMore:groomCost(a)>groomWas};})()`);
 eq(wide.problems,[],'widening is allowed');eq(wide.less,true,`only new ground is graded (${wide.grading})`);eq(wide.charged,true,'charged the shown cost');
 eq(wide.ws,true,'the shape survives a save and reload');eq(wide.max,true,'widest point measured');eq(wide.label,true,'card says Shaped');eq(wide.groomMore,true,'wider grooms for more');

 // The same shape again changes nothing and can't be paid for twice.
 const again=await g.ev(`(()=>{const t=realTrails()[0];startShape(t);recomputeDraft();const out={changed:draft.info.changed,cost:draft.info.cost};cancelShape();return out;})()`);
 eq(again,{changed:false,cost:0},'reopening the same shape is free and unchanged');

 // While open it's a blueprint: the trail doesn't change until the night, then it's built.
 const plan=await g.ev(`(()=>{state.cash=1e7;openDay();state.speed=0;const t=realTrails()[1],ws0=JSON.stringify(t.ws||null);
  select({kind:'trail',obj:t});renderSheet();const btn=!!sheet.querySelector('[data-action=shapeTrail]')&&!sheet.querySelector('[data-action=moveTrail]');
  startShape(t);draft.ws=draft.ws.map((v,i)=>i===0?5:v);recomputeDraft();const label=sheet.querySelector('[data-action=shapeApply]').textContent;shapeDraft();
  const p=world.plans.find(p=>p.kind==='shape');const same=JSON.stringify(t.ws||null)===ws0;
  select({kind:'plan',obj:p});renderSheet();const title=sheet.querySelector('h3').textContent,change=!!sheet.querySelector('[data-action=reshapePlan]');
  const saved=JSON.parse(JSON.stringify(saveData(false)));applySave(saved);const p2=world.plans.find(p=>p.kind==='shape');
  return {btn,label,plan:!!p&&p.trail===t.id,same,title,change,kept:!!p2&&p2.ws[0]===5,id:t.id};})()`);
 eq(plan.btn,true,'open: Widen or narrow offered, Edit route not');assert(/^Plan it · /.test(plan.label),'open button: '+plan.label);
 eq(plan.plan,true,'a shape blueprint is saved');eq(plan.same,true,'the trail is unchanged until tonight');
 assert(plan.title.startsWith('Planned new width for'),'plan title: '+plan.title);eq(plan.change,true,'blueprint can be changed');eq(plan.kept,true,'blueprint survives a reload');
 await g.ev(SETUPS.finishDay); await g.ev(`nextDay()`);
 const night=await g.ev(`(()=>{const t=realTrails().find(o=>o.id===${plan.id});const p=world.plans.find(p=>p.kind==='shape');return {left:world.plans.filter(p=>p.kind==='shape').length,ws:t.ws&&t.ws[0],why:p?[p.reason,p.paused,p.short,state.phase,state.cash]:null};})()`);
 eq(night,{left:0,ws:5,why:null},'the blueprint is built overnight');

 // Edit route no longer re-charges grading for the whole trail.
 const route=await g.ev(`(()=>{if(state.phase!=='closed')return 'not closed';const t=realTrails()[0];startTrailMove(t);let info;const old=t.pts.map(p=>({...p}));
  for(const dx of [.5,-.5,1,-1]){draft.pts=old.map(p=>({...p}));draft.pts[Math.floor(old.length/2)].x+=dx;info=evalTrailMove(t,draft.pts,draft.width,false,draft.ws);if(!info.an.problems.length)break;}
  const full=Math.round(info.an.len*TRAIL_WIDTHS[t.width].perUnit/100)*100;cancelTrailMove();return {grading:info.grading,full};})()`);
 assert(route.grading<route.full/4,`small route edit grades only new ground: ${route.grading} vs full ${route.full}`);

 eq(g.errors,[],'no runtime errors');await g.page.close();
}
