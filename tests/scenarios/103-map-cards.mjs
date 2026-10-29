import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const phone of [false, true]) {
    const g = await openGame(browser, url, phone ? { width:390, height:844, hasTouch:true } : {});
    await g.click('#startBtn'); await g.ev(SETUPS.juniperStarter);
    await g.ev(`setTool('trail');draftTap({x:12,z:-8});recomputeDraft()`);
    eq(await g.ev('sheetMode'), phone ? 'compact' : 'full', 'phone drawing shrinks automatically');
    const before = await g.ev(`JSON.stringify({pts:draft.pts,cash:state.cash,tool:state.tool})`);
    await g.click('#sheet [data-sheet=min]');
    eq(await g.ev('sheetMode'), 'min', 'minimized');
    await g.ev('renderSheet();renderSheet()');
    eq(await g.ev('sheetMode'), 'min', 'updates keep minimized mode');
    eq(await g.ev(`JSON.stringify({pts:draft.pts,cash:state.cash,tool:state.tool})`),before,'minimizing preserves unfinished work');
    assert(!await g.page.locator('#sheet [data-action=build]').isVisible(),'build hidden when minimized');
    await g.click('#sheet [data-sheet=expand]');
    if(phone) {
      eq(await g.ev('sheetMode'),'compact','first expansion is compact');
      assert(await g.page.locator('#sheet [data-action=build]').isVisible(),'compact build visible');
      assert(await g.page.locator('#sheet [data-action=undo]').isVisible(),'compact undo visible');
      await g.click('#sheet [data-sheet=expand]');
    }
    eq(await g.ev('sheetMode'),'full','full expansion restores settings');
    if(!phone) {
      const box=await g.page.locator('#sheet .sheet-title h3').boundingBox();
      await g.page.mouse.move(box.x+10,box.y+8);await g.page.mouse.down();
      await g.page.mouse.move(180,230,{steps:6});await g.page.mouse.up();
      const r=await g.page.locator('#sheet').boundingBox();
      assert(r.x<400,'drag moves desktop card');
      await g.page.setViewportSize({width:700,height:500});
      const q=await g.page.locator('#sheet').boundingBox();
      assert(q.x>=0 && q.x+q.width<=700 && q.y>=0 && q.y+q.height<=500,'resizing keeps card reachable');
    } else {
      // Exercise the same pointer-capture path as a finger swipe on the header.
      const box=await g.page.locator('#sheet .sheet-title h3').boundingBox();
      await g.page.mouse.move(box.x+8,box.y+8);await g.page.mouse.down();
      await g.page.mouse.move(box.x+8,box.y+65,{steps:5});await g.page.mouse.up();
      eq(await g.ev('sheetMode'),'compact','header down swipe shrinks');
      await g.page.locator('#sheet [data-sheet=min]').tap();
      await g.page.locator('#sheet [data-sheet=expand]').tap();
      eq(await g.ev('sheetMode'),'compact','touch buttons resize without closing');
    }
    await g.ev(`setTool('explore');select({kind:'lift',obj:world.lifts[0]})`);
    eq(await g.ev('sheetMode'),'full','new selection opens fully');
    await g.click('#sheet [data-sheet=min]');
    eq(await g.ev(`selected.obj.id`),await g.ev('world.lifts[0].id'),'selection stays active');
    for (const tool of ['trail', 'lift']) {
      await g.ev(`setTool('${tool}');draftTap({x:12,z:-8});recomputeDraft()`);
      await g.click('#sheet [data-sheet=min]');
      for (const action of ['undo', 'cancel']) assert(await g.page.locator(`#sheet [data-action=${action}]`).isVisible(), `${tool}: ${action} visible when minimized`);
      const press = async action => phone ? g.page.locator(`#sheet [data-action=${action}]`).tap() : g.page.locator(`#sheet [data-action=${action}]`).click();
      await press('undo');
      eq(await g.ev('draft.pts.length'),0,`${tool}: minimized undo removes point`);
      await g.ev('recomputeDraft();renderSheet()');
      eq(await g.ev('sheetMode'),'min','undo leaves card minimized');
      assert(await g.page.locator('#sheet [data-action=undo]').isDisabled(),'undo disabled with no points');
      await g.ev('draftTap({x:12,z:-8});recomputeDraft();renderSheet()');
      await press('cancel');
      eq(await g.ev('[draft.pts.length,sheetMode,state.tool]'),[0,'min',tool],'clear resets points without expanding or leaving tool');
      assert(await g.page.locator('#sheet [data-action=cancel]').isVisible(),'clear stays visible after clearing');
    }
    await g.ev(`pickBuilding('bench')`);
    if(phone) {
      eq(await g.ev('sheetMode'),'compact','building placement shrinks');
      assert(await g.page.locator('#sheet .b-rotation').isVisible(),'precise rotation stays available');
      assert(await g.page.locator('#sheet [data-action=build]').isVisible(),'confirmation stays available');
    }
    eq(g.errors,[],'no page errors');await g.page.close();
  }
}
