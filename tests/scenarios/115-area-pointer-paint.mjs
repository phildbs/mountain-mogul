// Use the real canvas pointer path, not just the painting function, on phone and desktop.
import {openGame,eq,assert} from '../harness.mjs';
export default async function({browser,url}) {
  for(const [width,height] of [[390,844],[1280,900]]) {
    const g=await openGame(browser,url,{width,height,hasTouch:width===390});await g.click('#startBtn');
    await g.ev(`openHubTool();sheetSize('min');cam.target.set(0,heightAt(0,10),10);updateCamera();`);
    const p=await g.ev(`(() => {const p=project(0,heightAt(0,10),10);return {x:p.x,y:p.y,canvas:document.elementFromPoint(p.x,p.y)===canvas};})()`);
    assert(p.canvas,'the painting spot is exposed on the real canvas');
    const before=await g.ev('undoStack.length');
    if(width===390) await g.page.touchscreen.tap(p.x,p.y);
    else {await g.page.mouse.move(p.x,p.y);await g.page.mouse.down();await g.page.mouse.move(p.x+24,p.y+8,{steps:8});await g.page.mouse.up();}
    assert(await g.ev(`areaDraft && areaDraft.cells.size>0 && !stroke.active && !areaDraftInfo().problems.length`),'real pointer stroke paints valid connected cells without an error');
    eq(await g.ev(`undoStack.length`),before,'draft strokes avoid unnecessary whole-resort save snapshots');
    eq(await g.ev(`areaDraftMesh.isLineSegments`),true,'draft is an outline, leaving the ground visible');
    await g.click('[data-action=hubUndo]');eq(await g.ev('areaDraft.cells.size'),0,'real pointer stroke can be undone');
    eq(g.errors,[],'no browser errors during actual painting');await g.page.close();
  }
}
