// Building themes: chosen in the build menu, kept with each building (and its blueprint), saved, and changeable
// overnight from the building's panel. Types without a themed model fall back to the classic one.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);
  // the menu shows the theme picker on tabs with themed buildings only
  const menu = await g.ev(`(() => { setTool('bld'); draft.btype = null; setBTab('food'); renderSheet(); const food = !!document.querySelector('#sheet [data-action=bTheme]');
    sheetAct({ dataset: { action: 'transitPick', v: 'shuttle' }, disabled: false }); const tr = !!document.querySelector('#sheet [data-action=bTheme]'); setTool('explore'); return [food, tr]; })()`);
  eq(menu, [true, true], 'Theme shows for food, and for a station picked under Roads › Transit');
  eq(await g.ev(`(() => { setBTheme('modern'); setTool('bld'); draft.btype = null; setBTab('food'); renderSheet();
    const only = [...document.querySelectorAll('#sheet .bpick:not([hidden]) button')].filter((b) => b.querySelector('.only')).map((b) => b.dataset.v);
    setBTheme('classic'); setTool('explore'); return only; })()`), ['truck'], 'buildings without a modern look say “Classic look only”');
  eq(await g.ev(`(() => { setBTheme('scandi'); setTool('bld'); draft.btype = null;
    const out = ['food', 'shops', 'services'].map((tab) => { setBTab(tab); renderSheet();
      return [...document.querySelectorAll('#sheet .bpick:not([hidden]) button')].filter((b) => b.querySelector('.only')).map((b) => b.dataset.v); });
    setBTheme('classic'); setTool('explore'); return out; })()`), [['truck'], [], []], 'only food trucks lack the Scandinavian look'); // stations are under Roads › Transit now
  eq(await g.ev(`(() => { setBTheme('retro'); setTool('bld'); draft.btype = null;
    const out = ['food', 'shops', 'services', 'stay'].map((tab) => { setBTab(tab); renderSheet();
      return [...document.querySelectorAll('#sheet .bpick:not([hidden]) button')].filter((b) => b.querySelector('.only')).map((b) => b.dataset.v); });
    setBTheme('classic'); setTool('explore'); return out; })()`), [['truck'], [], [], []], 'only food trucks lack the Retro look');
  // every retro model seats guests exactly like the classic one, in every size, and lights its windows at night
  const retro = await g.ev(`Object.keys(MODELS_RETRO).flatMap((t) => Array.from({ length: BTYPES[t].tiers?.length || 1 }, (_, i) => {
    const a = MODELS[t](i), b = MODELS_RETRO[t](i); return { t, seats: JSON.stringify(a.seats) === JSON.stringify(b.seats), glow: b.parts.some(([, m]) => m === BM.glow) }; }))`);
  eq(retro.length, 34, 'every retro model and size');
  assert(retro.every((r) => r.seats), 'retro seats match classic');
  assert(retro.every((r) => r.glow || ['restroom', 'shuttle'].includes(r.t)), 'retro windows light up');
  const r = await g.ev(`(() => { state.cash = 1e8; const L = world.lifts[0], out = {};
    const put = (type, theme, dx) => { for (let k = 0; k < 60; k++) { const x = L.a.x + dx + (k % 6) * 1.5, z = L.a.z - 6 + Math.floor(k / 6) * 1.5, v = evalBuilding(type, x, z, 0, false); if (!v.problems.length) return commitBuilding(v, type, x, z, 0, theme); } };
    const a = put('cafe', 'modern', -20), b = put('truck', 'scandi', -30), c = put('bar', 'scandi', -12);
    out.styles = [a.style, b.style || null, c.style];
    out.seats = [a.seatsW.length === buildingVisual({ ...a, style: undefined }).seats.length, c.seatsW.length === buildingVisual({ ...c, style: undefined }).seats.length];
    // a blueprint keeps its theme and lodge size
    addPlan({ kind: 'bld', type: 'lodge', tier: 2, x: L.a.x - 40, z: L.a.z + 8, rot: 0, cost: 1, style: 'modern' });
    const d = JSON.parse(JSON.stringify(saveData(false))); applySave(d);
    out.after = world.buildings.filter((B) => ['cafe', 'truck', 'bar'].includes(B.type)).map((B) => B.style || null);
    const pl = world.plans.find((p) => p.kind === 'bld' && p.type === 'lodge'); out.plan = pl ? [pl.tier, pl.style] : null;
    return out; })()`);
  eq(r.styles, ['modern', null, 'scandi'], 'themes are kept; a type without that theme stays classic');
  eq(r.seats, [true, true], 'themed models seat as many guests as classic ones');
  eq(r.after, ['modern', null, 'scandi'], 'themes survive save and load');
  eq(r.plan, [2, 'modern'], 'a blueprint keeps its lodge size and theme');
  // changing it overnight from the panel
  eq(await g.ev(`(() => { const B = world.buildings.find((x) => x.type === 'cafe'); select({ kind: 'bld', obj: B }); document.querySelector('#sheet [data-action=bldTheme][data-v=scandi]').click(); return [B.style, !!B.group.parent, B.winLights.length > 0]; })()`), ['scandi', true, true], 'a building can change theme overnight');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  const gallery = await browser.newPage(), galleryErrors = [];
  gallery.on('pageerror', (error) => galleryErrors.push(error.message));
  await gallery.goto(new URL('scandinavian-preview.html', url).href);
  await gallery.waitForFunction(() => document.querySelector('#pick')?.options.length === 10);
  eq(await gallery.locator('#pick option').count(), 10, 'gallery shows all nine new Scandinavian buildings');
  eq(galleryErrors, [], 'gallery has no page errors');
  await gallery.close();
  // the building styles viewer borrows the game's own models, so a change to index.html can't quietly break it
  const viewer = await browser.newPage(), viewerErrors = [];
  viewer.on('pageerror', (error) => viewerErrors.push(error.message));
  await viewer.goto(new URL('building-preview.html?b=lodge&t=classic,modern,scandi,retro', url).href);
  await viewer.waitForFunction(() => window.viewer || document.getElementById('err').style.display === 'block');
  eq(await viewer.evaluate(() => document.getElementById('err').textContent), '', 'viewer loads the models');
  eq(await viewer.evaluate(() => window.viewer.rows), 12, 'viewer shows three lodge sizes in four themes');
  eq(await viewer.locator('#themes button').count(), 4, 'viewer offers every theme');
  await viewer.click('#eve'); await viewer.selectOption('#pick', 'all');
  eq(viewerErrors, [], 'viewer has no page errors');
  await viewer.close();
}
