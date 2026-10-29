import { mkdirSync } from 'node:fs';
import { startServer, launch, openGame, SETUPS, assert } from './harness.mjs';
const server=await startServer(),browser=await launch();mkdirSync('asset-card-screenshots',{recursive:true});
try {
  for(const [name,width,height] of [['desktop',1280,900],['phone',390,844]]){
    const g=await openGame(browser,server.url,{render:true,width,height});await g.click('#startBtn');await g.wait(300);
    await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
    for(const dark of [false,true]){
      if(dark)await g.ev(`openDay();state.speed=0;state.time=1000`);
      for(const kind of ['bld','lift']){
        await g.ev(`select({kind:'${kind}',obj:world.${kind==='bld'?'buildings':'lifts'}[0]})`);await g.wait(250);
        if(kind==='lift')await g.click('[data-action=liftColor][aria-label=Teal]');
        const layout=await g.page.locator('#sheet').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,controls:[...el.querySelectorAll('.asset-plans button,.lift-colors button')].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height};})}));
        assert(layout.scroll<=layout.width+1&&layout.controls.every(b=>b.width>=26&&b.height>=30),`${name} ${kind} controls fit: ${JSON.stringify(layout)}`);
        await g.page.screenshot({path:`asset-card-screenshots/${name}-${dark?'night':'day'}-${kind}.png`});
        console.log('VISUAL '+JSON.stringify({name,width,height,dark,kind,layout}));
      }
    }
    assert(!g.errors.length,'no rendering errors');await g.page.close();
  }
}finally{await browser.close();server.close();}
