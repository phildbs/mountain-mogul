import { mkdirSync } from 'node:fs';
import { startServer, launch, openGame, SETUPS, assert } from './harness.mjs';
const server=await startServer(),browser=await launch();mkdirSync('card-screenshots',{recursive:true});
try {
  for(const [name,width,height] of [['desktop',1280,900],['phone',390,844]]) {
    const g=await openGame(browser,server.url,{render:true,width,height,hasTouch:name==='phone'});
    await g.click('#startBtn');await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
    for(const dark of [false,true]) {
      if(dark)await g.ev(`setTool('explore');openDay();state.speed=0;state.time=1000`);
      for(const kind of ['trail','lift','bld']) {
        await g.ev(kind==='bld'?`pickBuilding('bench')`:`setTool('${kind}');draftTap({x:12,z:-8});recomputeDraft()`);
        for(const mode of ['full','compact','min']) {
          await g.ev(`sheetSize('${mode}')`);await g.wait(200);
          const r=await g.page.locator('#sheet').boundingBox();
          assert(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,'card fits viewport');
          await g.page.screenshot({path:`card-screenshots/${name}-${dark?'night':'day'}-${kind}-${mode}.png`});
        }
      }
    }
    assert(!g.errors.length,'no rendering errors');await g.page.close();
  }
}finally{await browser.close();server.close();}
