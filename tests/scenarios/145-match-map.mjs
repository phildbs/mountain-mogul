// The multiplayer match range (?matchMap=1): faces meet seamlessly at the property lines, a starter resort
// builds and plays a day there, and nothing is saved on the device or online.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  const m = await g.ev(`(() => {
    const M = MOUNTAIN, H = (u, v) => M.height(u, v), seam = [];
    for (const v of [0.2, 0.5, 0.8, 1]) seam.push(Math.abs(H(-1e-6, v) - H(1e-6, v)), Math.abs(H(1 - 1e-6, v) - H(1 + 1e-6, v)));
    return { id: M.id, listed: !!MOUNTAINS.match, started: state.started, seam: Math.max(...seam), same: Math.abs(H(0.3, 0.6) - H(-0.3, 0.6)) + Math.abs(H(0.3, 0.6) - H(1.7, 0.6)), cloud: CLOUD.status };
  })()`);
  eq([m.id, m.listed, m.started, m.cloud], ['match', false, true, 'offline'], 'the preview opens on the match range, not in the mountain list, offline');
  assert(m.seam < 1e-3, `faces meet at the property lines (${m.seam})`);
  assert(m.same < 1e-9, `the faces either side mirror yours (${m.same})`);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const day = await g.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); return { phase: state.phase, guests: state.lastReport && state.lastReport.guests }; })()`);
  eq(day.phase, 'report', 'a day plays to its report');
  assert(day.guests > 20, `guests came (${day.guests})`);
  await g.ev('saveNow(); nextDay(); saveNow()');
  const kept = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon')));
  eq(kept, [], 'nothing saved on the device');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  return `${day.guests} guests on the match range`;
}
