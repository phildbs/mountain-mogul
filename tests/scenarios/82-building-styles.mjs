// Browser integration for every classic/modern pair. No production styles are switched.
// Screenshots are slow (full 3D rendering without a graphics card), so they're taken only when asked for:
//   SHOTS=1 node run.mjs building-styles
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const shots = !!process.env.SHOTS, dir = shots ? mkdtempSync(join(tmpdir(), 'mm-building-styles-')) : null;
  const g = await openGame(browser, url, { query: '?dev', render: shots });
  await g.click('#startBtn');
  const checks = await g.ev(`(() => {
    const rows = [];
    for (const type of Object.keys(MODELS_MODERN)) for (let tier = 0; tier < (BTYPES[type].tiers?.length || 1); tier++) {
      const a = MODELS[type](tier), b = MODELS_MODERN[type](tier);
      rows.push({ type, tier, seats: JSON.stringify(a.seats) === JSON.stringify(b.seats), glow: b.parts.some(([,m]) => m === BM.glow) });
    }
    return rows;
  })()`);
  eq(checks.length, 19, 'all requested model variants');
  assert(checks.every((c) => c.seats && (c.type === 'shuttle' ? !c.glow : c.glow)), 'exact seat contracts and shared glow');
  const before = await g.ev(`JSON.stringify({ buildings: world.buildings.length, cash: state.cash })`);
  const all = await g.ev('previewStyles()');
  eq(all.length, 38, 'all classic/modern pairs');
  eq(await g.ev(`JSON.stringify({ buildings: world.buildings.length, cash: state.cash })`), before, 'preview does not place or charge buildings');
  for (const { type, tier } of checks) {
    await g.ev(`previewStyles({ types: ['${type}'], tier: ${tier} })`);
    if (shots) { await g.wait(250); await g.page.screenshot({ path: join(dir, `${type}-${tier}-desktop.png`) }); }
  }
  await g.ev('clearStylePreview()');
  eq(await g.ev(`!!scene.getObjectByName('__buildingStylesPreview')`), false, 'cleanup');
  eq(g.errors, [], 'no runtime errors');
  await g.page.close();
  const phone = await openGame(browser, url, { query: '?dev', render: shots, width: 390, height: 844 });
  await phone.click('#startBtn');
  await phone.ev("previewStyles({ types: ['lodge'], tier: 2 })");
  assert(await phone.ev('cam.viewH * (W / H) >= 18'), 'phone camera fits both models');
  if (shots) { await phone.wait(250); await phone.page.screenshot({ path: join(dir, 'lodge-2-phone.png') }); }
  eq(phone.errors, [], 'no phone runtime errors');
  await phone.page.close();
  return shots ? `screenshots: ${dir}` : 'no screenshots (SHOTS=1 to take them)';
}
