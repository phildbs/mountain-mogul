// Save safety net: saves made by earlier released versions (tests/fixtures/saves, made in test runs) must load
// in this version with their money, lifts, trails, buildings and loans intact, then play a full day without errors.
import { readFileSync, readdirSync } from 'fs';
import { gunzipSync } from 'zlib';
import { openGame, assert, eq, SETUPS } from '../harness.mjs';
const DIR = new URL('../fixtures/saves/', import.meta.url);
export default async function ({ browser, url }) {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json.gz')).sort();
  assert(files.length >= 10, `old saves to check (${files.length})`);
  const byMt = {};
  for (const f of files) { const sv = JSON.parse(gunzipSync(readFileSync(new URL(f, DIR)))); (byMt[sv.mt || 'juniper'] ||= []).push([f, sv]); }
  const done = [];
  for (const [mt, list] of Object.entries(byMt)) {
    const g = await openGame(browser, url, { mountain: mt === 'juniper' ? undefined : mt });
    await g.click('#startBtn'); await g.wait(300);
    for (const [f, sv] of list) {
      await g.page.evaluate((x) => { window.__fx = x; }, sv);
      const got = await g.ev(`(() => { applySave(__fx); return { cash: Math.round(state.cash), debt: Math.round(state.debt || 0), lifts: world.lifts.length, trails: world.trails.filter((t) => !t.virtual).length, blds: world.buildings.length, areas: (world.areas || []).length, phase: state.phase, day: state.day }; })()`);
      const want = { cash: Math.round(sv.cash), debt: Math.round(sv.clock.debt || 0), lifts: sv.world.lifts.length, trails: sv.world.trails.length, blds: sv.world.buildings.length, areas: (sv.world.areas || []).length, phase: sv.clock.phase, day: sv.clock.day };
      eq(got, want, `${f} loads with everything intact`);
      // play on: finish the day in progress, or open and play a full day
      const played = await g.ev(`(() => { const day = state.day; if (state.phase !== 'open') openDay(); let k = 0; while (state.phase === 'open' && k < 90000) { simStep(1.5); k++; } return { finished: state.phase !== 'open', report: !!(state.lastReport && state.lastReport.day === day), cash: state.cash }; })()`);
      assert(played.finished && played.report && Number.isFinite(played.cash), `${f} plays a full day (${JSON.stringify(played)})`);
      eq(g.errors, [], `${f}: no page errors`);
      done.push(f.replace('.json.gz', ''));
    }
    await g.page.close();
  }
  return `${done.length} old saves load and play`;
}
