import { mkdirSync } from 'node:fs';
import { startServer, launch, openGame, SETUPS, assert } from './harness.mjs';
const server=await startServer(),browser=await launch();mkdirSync('placement-screenshots',{recursive:true});
try {
  for(const [name,width,height,hasTouch] of [['desktop',1280,900,false],['phone',390,844,true]]) {
    const g=await openGame(browser,server.url,{render:true,width,height,hasTouch});await g.click('#startBtn');await g.wait(300);
    await g.ev(SETUPS.juniperStarter);await g.ev(SETUPS.midwinter);
    await g.ev(`state.cash=1e8;window.findPlacement=(type)=>{for(let z=50;z<78;z++)for(let x=-30;x<30;x++){const v=evalBuilding(type,x,z,37/90);if(!v.problems.length)return{x,z};}throw Error('No spot');}`);
    for(const dark of [false,true]) {
      if(dark)await g.ev(`setTool('explore');openDay();state.speed=0;state.time=1000`);
      for(const type of ['lodge','bench','picnic']) {
        await g.ev(`pickBuilding('${type}');setDraftDegrees(37);draftTap(window.findPlacement('${type}'));recomputeDraft();flyTo(draft.bpos.x,draft.bpos.z)`);await g.wait(700);
        const layout=await g.page.locator('#sheet').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,controls:[...el.querySelectorAll('.b-rotation input,[data-action=rotB],[data-action=build]')].map(b=>{const r=b.getBoundingClientRect();return{width:r.width,height:r.height};})}));
        assert(layout.scroll<=layout.width+1&&layout.controls.every(b=>b.width>=30&&b.height>=30),`${name} ${type} controls fit: ${JSON.stringify(layout)}`);
        assert(await g.ev(`!draft.info.problems.length&&!!ghost&&world.buildings.filter(B=>B.type==='${type}').length===${type==='lodge'?1:0}`),'valid preview, no accidental placement');
        await g.page.screenshot({path:`placement-screenshots/${name}-${dark?'night':'day'}-${type}.png`});
        console.log('VISUAL '+JSON.stringify({name,dark,type,layout}));
      }
    }
    assert(!g.errors.length,'no rendering errors');await g.page.close();
  }
}finally{await browser.close();server.close();}
