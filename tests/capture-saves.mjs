// Make saves with an older version of the game, for the save-compatibility test.
// node tests/capture-saves.mjs <checkout of that release> <version>   e.g. ../mm-old/v2.11 2.11
import { writeFileSync } from 'fs';
import { gzipSync } from 'zlib';
const [root, tag] = process.argv.slice(2);
const OUT = new URL('./fixtures/saves', import.meta.url).pathname;
const { startServer, launch, openGame, SETUPS } = await import(root + '/tests/harness.mjs');
const server = await startServer(), browser = await launch();
const days = `(n) => { for (let i = 0; i < n; i++) { if (state.phase !== 'closed') break; openDay(); let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } if (typeof nextDay === 'function' && state.phase !== 'closed') nextDay(); else if (!$('report').hidden && $('rpNext')) $('rpNext').click(); } }`;
async function make(mountain, setup, extras, name) {
  const g = await openGame(browser, server.url, { mountain });
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(setup); await g.ev(SETUPS.midwinter);
  const built = await g.ev(`(() => { const out = []; ${extras}; return out; })()`);
  await g.ev(`(${days})(3)`);
  const closed = await g.ev(`JSON.stringify(saveData(true))`);
  await g.ev(`(() => { if (!$('report').hidden && $('rpNext')) $('rpNext').click(); openDay(); let k = 0; while (state.time < 690 && k < 90000) { simStep(1.5); k++; } })()`);
  const mid = await g.ev(`JSON.stringify(saveData(true))`);
  for (const [kind, json] of [['night', closed], ['midday', mid]]) {
    const f = `${OUT}/v${tag}-${name}-${kind}.json.gz`; writeFileSync(f, gzipSync(json));
    const sv = JSON.parse(json);
    console.log(f.split('/').pop(), Math.round(json.length / 1024) + 'KB', 'phase', sv.clock.phase, 'lifts', sv.world.lifts.length, 'trails', sv.world.trails.length, 'blds', sv.world.buildings.length, 'areas', (sv.world.areas || []).length);
  }
  console.log('  built', JSON.stringify(built), 'errors', g.errors);
  await g.page.close();
}
// Everything this version can build, near the base lodge.
const EXTRAS = `
  state.cash = 3e7;
  const L = world.buildings[0], near = [[8,0],[-8,0],[0,8],[12,0],[-12,0],[8,8],[-8,8],[16,2],[-16,2],[0,13],[12,10],[-12,10],[18,8],[-18,8],[20,0],[-20,0],[24,6],[-24,6]];
  for (const type of ['rental', 'school', 'restaurant', 'patrol', 'restroom', 'cafe', 'truck', 'tuning', 'store', 'gift', 'clinic', 'kids', 'hrest']) {
    if (!BTYPES[type]) continue; let ok = false;
    for (const [dx, dz] of near) { if (ok) break; for (const r of [0, 1, 2, 3]) { const b = evalBuilding(type, L.x + dx, L.z + dz, r); if (!b.problems.length) { commitBuilding(b, type, L.x + dx, L.z + dz, r); ok = true; break; } } }
    if (ok) out.push(type);
  }
  if (typeof areaPaintAt === 'function') { setTool('clear'); state.landMode = 'area'; state.brushR = 3.6; for (let z = 56; z >= 44; z -= 2) for (const x of [-12, -8, -4]) areaPaintAt({ x, z }); commitArea(); setTool('explore');
    for (const [ax, az, bx, bz] of [[-8, 54, -9, 46], [-6, 54, -7, 46], [-10, 55, -11, 47]]) { const i = evalLift({ x: ax, z: az }, { x: bx, z: bz }, 'carpet'); if (!i.problems.length) { commitLift(i, 'carpet'); out.push('area+carpet'); break; } } }
  if (LIFT_TYPES.gondola) { const i = evalLift({ x: 30, z: 58 }, { x: 34, z: -20 }, 'gondola'); if (!i.problems.length) { commitLift(i, 'gondola'); out.push('gondola'); } }
  if (typeof borrow === 'function') { try { borrow(250000); out.push('loan'); } catch (e) { out.push('loan failed ' + e.message); } }
  state.prices.food = 18; state.ticket = 72;
  computeNetwork(); syncLabels(); state.cash = Math.min(state.cash, 2.5e6);
`;
await make(undefined, SETUPS.juniperStarter, EXTRAS, 'juniper');
if (SETUPS.mapleStarter) await make('maple', SETUPS.mapleStarter, '', 'maple');
if (SETUPS.ravenStarter) await make('raven', SETUPS.ravenStarter, '', 'raven');
await browser.close(); server.close();
