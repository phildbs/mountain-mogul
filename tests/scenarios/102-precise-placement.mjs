import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const touch of [false, true]) {
    const g = await openGame(browser, url, touch ? { width: 390, height: 844, hasTouch: true } : {});
    await g.click('#startBtn'); await g.wait(300);
    await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
    await g.ev(`state.cash=1e8;window.findPlacement=(type,deg=37)=>{for(let z=45;z<80;z+=1)for(let x=-35;x<35;x+=1){const v=evalBuilding(type,x,z,deg/90);if(!v.problems.length)return {x,z};}throw Error('No spot for '+type);}`);
    const press = async (selector) => touch ? g.page.locator(selector).tap() : g.click(selector);
    for (const type of ['bench', 'picnic', 'lodge']) {
      const before = await g.ev(`({cash:state.cash,n:world.buildings.length})`);
      await g.ev(`pickBuilding('${type}');setDraftDegrees(37);draftTap(window.findPlacement('${type}'));recomputeDraft()`);
      eq(await g.ev(`({cash:state.cash,n:world.buildings.length})`), before, `${type}: map tap only previews (${touch?'touch':'mouse'})`);
      // A real input event updates the ghost without replacing a slider mid-gesture.
      eq(await g.ev(`(() => {const el=sheet.querySelector('[data-rotation=range]');el.value='38';el.dispatchEvent(new Event('input',{bubbles:true}));const kept=el===sheet.querySelector('[data-rotation=range]');el.dispatchEvent(new Event('change',{bubbles:true}));return [kept,Math.round(draft.rot*90),world.buildings.length];})()`), [true,38,before.n], 'slider is stable and still only previews');
      await g.ev(`(() => {const el=sheet.querySelector('[data-rotation=number]');el.value='37';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await press('[data-action=rotB][data-d="1"]');
      eq(await g.ev(`Math.round(draft.rot*90)`),127,'quarter turn preserves the fine angle');
      await press('[data-action=rotB][data-d="-1"]');
      const cost = await g.ev(`draft.info.cost`);
      assert(await g.ev(`!draft.info.problems.length`), `${type} preview is valid`);
      await press('#sheet [data-action=build]');
      const placed = await g.ev(`(() => {const B=world.buildings.at(-1),s=bspec(B),local=modelFor(B.type,B.style)(B.tier,B,true).seats,door=toWorld(B,0,s.d/2+0.35);return {id:B.id,type:B.type,rot:B.rot,n:world.buildings.length,cash:state.cash,door:Math.hypot(B.door.x-door.x,B.door.z-door.z)<1e-8,seats:B.seatsW.every((p,i)=>{const q=toWorld(B,local[i].x,local[i].z);return Math.hypot(p.x-q.x,p.z-q.z)<1e-8&&Math.abs(p.yaw-local[i].yaw-B.rot*Math.PI/2)<1e-8;}),ready:draft.bpos===null};})()`);
      eq([placed.type,Math.round(placed.rot*90),placed.n,placed.cash,placed.door,placed.seats,placed.ready],[type,37,before.n+1,before.cash-cost,true,true,true], 'confirmed once, charged once, rotated door and seats, ready for another');
      await g.click('#sheet [data-action=build]');
      eq(await g.ev(`world.buildings.length`),before.n+1,'double confirmation cannot place another');
      if(type==='bench') {
        // Repeat-placement tap also waits; cancel spends nothing and creates nothing.
        const cash=await g.ev(`state.cash`);
        await g.ev(`draftTap(window.findPlacement('bench'));recomputeDraft()`);
        await press('[data-action=exitTool]');
        eq(await g.ev(`[state.cash,world.buildings.length]`),[cash,before.n+1],'canceling another preview is harmless');
      }
      if(type==='picnic') {
        await g.ev(`setTool('explore');select({kind:'bld',obj:bldById(${placed.id})})`);
        await press('[data-action=turnBld]');
        eq(await g.ev(`sheet.querySelector('[data-action=build]').disabled`),true,'unchanged rotation cannot be charged');
        const prior=await g.ev(`({rot:bldById(${placed.id}).rot,cash:state.cash,x:draft.bpos.x,z:draft.bpos.z})`);
        await g.ev(`setDraftDegrees(143);draftTap({x:0,z:0})`);
        eq(await g.ev(`[draft.bpos.x,draft.bpos.z,bldById(${placed.id}).rot,state.cash,draft.info.build]`),[prior.x,prior.z,prior.rot,prior.cash,0],'rotation preview stays put, has no turn fee, and leaves original intact');
        await press('[data-action=exitTool]');
        eq(await g.ev(`[bldById(${placed.id}).rot,state.cash,bldById(${placed.id}).group.visible]`),[prior.rot,prior.cash,true],'cancel restores the original model without spending');
        await g.ev(`startMove(bldById(${placed.id}),true);setDraftDegrees(143)`);
        assert(await g.ev(`!draft.info.problems.length`),'turned table still fits');
        await press('#sheet [data-action=build]');
        eq(await g.ev(`[Math.round(bldById(${placed.id}).rot*90),state.cash]`),[143,prior.cash],'table rotated for free');
        await g.ev(`undoLast()`);
        eq(await g.ev(`Math.round(bldById(${placed.id}).rot*90)`),37,'undo restores exact previous angle');
      }
    }
    eq(await g.ev(`(() => {const sv=JSON.parse(JSON.stringify(saveData(false))),before=sv.world.buildings.map(b=>[b.id,b.rot]);applySave(sv);return JSON.stringify(before)===JSON.stringify(world.buildings.map(b=>[b.id,b.rot]));})()`),true,'fractional angles and older integer angles survive save/load');
    // Angled footprints contain every corner, and cannot overlap another preview or a real building.
    eq(await g.ev(`(() => {const B=world.buildings.at(-1),bb=boxOf(B),s=bspec(B);return [-1,1].every(x=>[-1,1].every(z=>{const p=toWorld(B,x*s.w/2,z*s.d/2);return p.x>=bb.x0-1e-8&&p.x<=bb.x1+1e-8&&p.z>=bb.z0-1e-8&&p.z<=bb.z1+1e-8;}))&&validateBuilding('bench',0,B.x,B.z,0).problems.some(p=>p.includes('Too close'));})()`),true,'rotated geometry is enclosed and collision checked');
    await g.ev(`setTool('explore');openDay();state.speed=0;pickBuilding('bench');setDraftDegrees(219);draftTap(window.findPlacement('bench',219));recomputeDraft()`);
    const n = await g.ev(`world.plans.length`);
    eq(await g.ev(`world.plans.length`),n,'open-day preview creates no blueprint');
    await press('#sheet [data-action=build]');
    eq(await g.ev(`[world.plans.length,Math.round(world.plans.at(-1).rot*90)]`),[n+1,219],'confirm saves an angled blueprint during the day');
    eq(await g.ev(`(() => {const sv=JSON.parse(JSON.stringify(saveData(true)));applySave(sv);return Math.round(world.plans.at(-1).rot*90);})()`),219,'blueprint angle survives mid-day save/load');
    eq(await g.ev(`(() => {setTool('explore');const B=world.buildings.at(-1);startMove(B,true);return draft.moving===null&&!bldSheet(B).includes('data-action="turnBld"');})()`),true,'existing buildings cannot turn during service');
    eq(await g.ev(`(() => {state.phase='closed';visiting=true;const B=world.buildings.at(-1),r=B.rot,c=state.cash;startMove(B,true);setDraftDegrees(99);buildBuildingDraft();const ok=B.rot===r&&state.cash===c&&!bldSheet(B).includes('data-action="turnBld"');visiting=false;return ok;})()`),true,'visited resorts stay read only');
    eq(await g.ev(`['shuttle','transit','tree','tlight'].every(k=>!canTurn(k))`),true,'bus bays and automatic tree/trail-light orientation keep their rules');
    eq(g.errors,[],'no page errors');await g.page.close();
  }
}
