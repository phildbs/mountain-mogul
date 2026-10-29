// Paired browser comparison against main. No real accounts or database; renderer excluded on both sides.
import { execFileSync } from 'node:child_process';
import { startServer, launch, openGame, SETUPS, assert } from './harness.mjs';
import { build } from './twin-resort.mjs';
const baselineRef=process.env.HUNGER_BASE_REF || 'origin/main';
const baseline=execFileSync('git',['show',`${baselineRef}:index.html`],{maxBuffer:8e6,encoding:'utf8'});
const servers={main:await startServer({source:baseline}),candidate:await startServer()};
const browser=await launch();
const seedCode=seed=>`let seed=${seed};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`;
const finish=`(() => {
  const steps=[],t=performance.now();let n=0;
  while(state.phase==='open'&&n++<90000){const at=performance.now();simStep(1.5);steps.push(performance.now()-at);}
  const elapsed=performance.now()-t;steps.sort((a,b)=>a-b);const r=state.lastReport;
  if(state.phase!=='report')throw Error('Day did not finish');
  return {ms:Math.round(elapsed),worstMs:+steps.at(-1).toFixed(2),p95Ms:+steps[Math.floor(steps.length*.95)].toFixed(3),guests:r.guests,food:r.rev.food+r.rev.dining,meals:r.meals||null};
})()`;
const newPage=async(version,mountain)=>{const g=await openGame(browser,servers[version].url,{mountain});await g.click('#startBtn');await g.wait(100);return g;};
const prices=[];
try {
  // Price comparison: same seeds/settings, three independent runs at each price on each version.
  for(const seed of [11,29,47])for(const mult of [1,1.6])for(const version of ['main','candidate']){
    const g=await newPage(version,'juniper');await g.ev(`(() => {${seedCode(seed)}})()`);
    await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
    await g.ev(`state.reputation=1.6;state.prices.food*=${mult};state.prices.snack*=${mult};openDay();state.speed=0;`);
    const result=await g.ev(finish);assert(!g.errors.length,'no pricing page errors');
    prices.push({version,mult,seed,...result});console.log('PRICE '+JSON.stringify(prices.at(-1)));await g.page.close();
  }
  const table=[];
  for(const version of ['main','candidate']){
    const mean=mult=>prices.filter(r=>r.version===version&&r.mult===mult).reduce((s,r)=>s+r.food,0)/3;
    const normal=mean(1),high=mean(1.6);table.push({version,normal:Math.round(normal),high:Math.round(high),changePct:+((high/normal-1)*100).toFixed(1)});
  }
  console.log('PRICE_SUMMARY '+JSON.stringify(table));
  assert(table.find(r=>r.version==='candidate').high<table.find(r=>r.version==='candidate').normal,'higher prices must still reduce total food revenue across paired seeds');
  // Build once, using validated in-game tools. Use this exact save on both versions.
  const setup=await newPage('main','twin');await setup.ev(`(() => {${seedCode(1701)}})()`);await setup.ev(build);
  const shape=await setup.ev(`(() => {
    state.cash=1e9;state.welcomed=true;state.reputation=1.5;
    state.lotLayout=[[0,0,0],[0,1,0],[0,2,0],[0,0,1],[0,1,1],[0,2,1]];state.lotSections=6;buildLot();
    // Add forks to existing routes; every addition must pass the actual trail validator.
    for(const T of [...world.trails])for(const side of [-1,1]){
      const samples=T.samples,start=Math.floor(samples.length*.3),end=samples.length-1;
      const pts=[samples[start],...Array.from({length:4},(_,k)=>{
        const i=Math.round(start+(end-start)*(k+1)/4),p=samples[i];return {x:p.x+(k===3?0:side*2),z:p.z};
      })].map(p=>({x:p.x,z:p.z,y:heightAt(p.x,p.z)}));
      const v=evalTrail(pts,'medium',false,false);if(!v.an.problems.length){commitTrail(v,pts,'medium');computeNetwork();}
    }
    for(const [u,v]of [[.7,.16],[.3,.16]]){
      let placed=false;
      for(let dz=0;dz<14&&!placed;dz+=2)for(let dx=-12;dx<=12&&!placed;dx+=2){
        const x=160*u-80+dx,z=80-160*v-dz,info=evalBuilding('lodge',x,z,0,false,null,null,2);
        if(!info.problems.length){commitBuilding(info,'lodge',x,z,0);computeNetwork();placed=true;}
      }
      if(!placed)throw Error('No valid lodge at base '+u);
    }
    return {lifts:world.lifts.length,trails:world.trails.length,forks:world.trails.reduce((s,T)=>s+T.branches.length,0),seats:world.buildings.reduce((s,B)=>s+(bspec(B).seats||0),0)};
  })()`);
  await setup.ev(SETUPS.midwinter);const save=await setup.ev(`saveData(false)`);await setup.page.close();
  assert(shape.lifts>=2&&shape.trails>=10&&shape.forks>0,'benchmark needs a larger connected resort with forks');console.log('LARGE_SHAPE '+JSON.stringify(shape));
  const times=[];
  // Alternate order to reduce warm-up bias; first pair warms the code, three pairs are measured.
  for(let run=0;run<4;run++)for(const version of run%2?['candidate','main']:['main','candidate']){
    const g=await newPage(version,'twin');await g.ev(`applySave(${JSON.stringify(save)});(()=>{${seedCode(1900+run)}})();openDay();state.speed=0;`);
    const result=await g.ev(finish);assert(!g.errors.length,'no benchmark page errors');
    const row={version,run,...result};console.log('LARGE_DAY '+JSON.stringify(row));if(run)times.push(row);await g.page.close();
  }
  const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)],summary=[];
  for(const version of ['main','candidate']){const rows=times.filter(r=>r.version===version);summary.push({version,medianMs:median(rows.map(r=>r.ms)),worstMs:Math.max(...rows.map(r=>r.worstMs)),p95Ms:median(rows.map(r=>r.p95Ms)),guests:rows.map(r=>r.guests)});}
  const ratio=summary[1].medianMs/summary[0].medianMs;console.log('PERFORMANCE_SUMMARY '+JSON.stringify({shape,versions:summary,ratio:+ratio.toFixed(3)}));
  if(ratio>1.25)throw Error('Large resort slowed by more than 25%; optimize routing before release');
} finally {await browser.close();for(const s of Object.values(servers))s.close();}
