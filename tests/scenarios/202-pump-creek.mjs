// A pond painted right beside the creek keeps its pumphouse up on the bank, not down in the creek bed;
// a saved pond whose pumphouse stood in the creek moves it out when loaded.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`state.cash = 5e6; updateCash(false)`);
  // open ground beside the creek: a patch where the squares on the creek side are as close as a pond may go
  const spot = await g.ev(`(() => { const blocks = areaBlocks(null);
    for (let z = 80; z > -90; z -= 1) for (let x = -90; x < 90; x += 1) {
      const d = creekDist(x, z); if (d < 1.8 || d > 2.4) continue;
      let ok = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (!pondCellProblem(x + dx, z + dz, blocks)) ok++;
      if (ok >= 30) return [x, z]; } return null; })()`);
  assert(spot, 'found ground beside the creek for a pond');
  const [x, z] = spot;
  await g.ev(`openLandscape()`); await g.wait(50);
  await g.click('[data-action=landMode][data-v=pond]'); await g.wait(50);
  await g.ev(`(() => { state.brushR = 3.6; stroke.active = true; strokeTo(new THREE.Vector3(${x}, heightAt(${x}, ${z}), ${z})); endStroke(); })()`);
  eq(await g.ev(`areaDraftInfo().problems`), [], 'a pond may go right beside the creek');
  await g.click('[data-action=areaBuild]'); await g.wait(100);
  const P = await g.ev(`(() => { const P = world.ponds[0]; return { creek: creekDist(P.pump.x, P.pump.z), near: Math.min(...P.cells.map((k) => creekDist(keyX(k), keyZ(k)))) }; })()`);
  assert(P.near < 2.6, `the pond reaches the creek's edge (${P.near.toFixed(2)})`);
  assert(P.creek >= 2.6, `its pumphouse stands clear of the creek bed (${P.creek.toFixed(2)} from the middle)`);

  // an old save with the pumphouse down in the creek
  await g.ev(`(() => { const P = world.ponds[0]; let b = null, bd = Infinity; for (const [idx, v] of P.mask) { const x = (idx % NV) - HALF, z = Math.floor(idx / NV) - HALF, d = creekDist(x, z); if (d < bd) { bd = d; b = { x, z }; } }
    P.pump = { ...b, rot: 0 }; saveNow(); })()`);
  await g.page.reload(); await g.reloaded();
  const after = await g.ev(`creekDist(world.ponds[0].pump.x, world.ponds[0].pump.z)`);
  assert(after >= 2.6, `loaded, the pumphouse moved out of the creek (${after.toFixed(2)})`);
}
