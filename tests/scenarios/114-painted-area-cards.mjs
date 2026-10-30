// The real build/detail cards stay usable at phone and desktop sizes. Slow 3D captures are opt-in.
import {mkdirSync} from 'node:fs';
import {openGame,eq,assert} from '../harness.mjs';
export default async function({browser,url}) {
  for(const [width,height] of [[390,844],[1280,900]]) {
    const g=await openGame(browser,url,{width,height,hasTouch:width===390,render:!!process.env.SHOTS});await g.click('#startBtn');
    await g.click('#tTrail');await g.click('[data-action=trailMode][data-v=hub]');
    eq(await g.ev(`state.landMode`),'hub','Guest area is in the real Trail build tool');
    assert(await g.ev(`$('sheet').textContent.includes('Free for now')`),'launch offer is visible');
    const draft=await g.ev(`(() => {
      state.brushR=2;const before=state.cash;areaPaintAt({x:0,z:10});const cells=[...areaDraft.cells];
      areaDraft.history=[cells];areaPaintAt({x:20,z:10});const disconnected=areaDraftInfo().problems.some(s=>s.includes('connected'));
      renderSheet();return {disconnected,before,n:cells.length};
    })()`);
    eq(draft.disconnected,true,'disconnected patches cannot be committed as one area');
    await g.click('[data-action=hubUndo]');
    eq(await g.ev('areaDraft.cells.size'),draft.n,'Undo restores the preceding paint stroke');
    await g.ev(`sheetSize('min')`);
    assert(await g.page.locator('[data-action=hubUndo]').isVisible(),'Undo stays available when minimized');
    assert(await g.page.locator('[data-action=areaClear]').isVisible(),'Clear stays available when minimized');
    await g.ev(`sheetSize('full')`);
    assert(await g.ev(`$('sheet').scrollWidth <= $('sheet').clientWidth+1`),'paint card has no horizontal overflow');
    if(process.env.SHOTS){mkdirSync('/tmp/painted-area-shots',{recursive:true});await g.page.screenshot({path:'/tmp/painted-area-shots/paint-'+width+'.png'});}
    await g.page.locator('[data-action=areaBuild]').click();
    eq(await g.ev(`({n:world.areas.length,kind:world.areas[0].kind,cash:state.cash})`),{n:1,kind:'hub',cash:draft.before},'painting commits a real area and costs nothing');
    eq(await g.ev(`selected.kind`),'area','new area opens its real detail card');
    await g.page.locator('#nameInput').fill('My guest area');await g.page.locator('#nameInput').blur();
    eq(await g.ev(`world.areas[0].name`),'My guest area','players can rename the area');
    assert(await g.ev(`$('sheet').scrollWidth <= $('sheet').clientWidth+1`),'detail card fits');
    await g.ev(`state.cash=1e8`);await g.page.locator('[data-action=smInstall]').click();
    assert(await g.ev(`world.areas[0].sm.on && gunSpots.length>0`),'paid equipment is placed in the real world');
    await g.click('[data-action=smMode][data-v=off]');eq(await g.ev(`world.areas[0].sm.mode`),'off','area snowmaking can be switched off');
    if(process.env.SHOTS){await g.ev(`sheetSize('full')`);await g.page.screenshot({path:'/tmp/painted-area-shots/area-'+width+'.png'});await g.ev(`state.time=1000;applyWeatherLook();`);await g.wait(300);await g.page.screenshot({path:'/tmp/painted-area-shots/night-'+width+'.png'});}
    await g.page.locator('[data-action=editArea]').click();await g.click('[data-action=areaClear]');
    eq(await g.ev(`selected.obj.name`),'My guest area','canceling an edit restores the area card');
    const readOnly=await g.ev(`(() => {visiting=true;const n=world.areas.length;openHubTool();return state.tool==='explore'&&world.areas.length===n;})()`);
    eq(readOnly,true,'visitors cannot paint');
    eq(g.errors,[],'no page errors');await g.page.close();
  }
  return '390×844 and 1280×900: paint, undo, clear, rename, edit, snowmaking, no overflow';
}
