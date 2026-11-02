// The multiplayer match map, Crown Peak (?matchMap=1): three identical slices of one mountain meeting on a
// flat summit; your land is your wedge, with land for sale only in the valley in front of it, a starter resort builds and plays
// a day there, and nothing is saved on the device or online.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?matchMap=1', mountain: 'fresh' });
  const m = await g.ev(`(() => {
    const M = MOUNTAIN, [cu, cv] = CROWN.c, H = (u, v) => M.height(u, v), turn = (u, v, a) => [cu + (u - cu) * Math.cos(a) - (v - cv) * Math.sin(a), cv + (u - cu) * Math.sin(a) + (v - cv) * Math.cos(a)];
    let same = 0; for (const [u, v] of [[0.3, 0.2], [0.55, 0.45], [0.47, 0.66], [0.8, 0.3]]) for (const k of [1, 2]) same = Math.max(same, Math.abs(H(u, v) - H(...turn(u, v, k * 2 * Math.PI / 3))));
    const top = [0, 0.04, 0.08].map((r) => H(cu, cv - r)), g = (u, v) => inProperty(PLAY0 + u * PN - HALF, PLAY1 - v * PN - HALF);
    return { id: M.id, listed: !!MOUNTAINS.match, started: state.started, cloud: CLOUD.status, same, flat: Math.max(...top) - Math.min(...top), drop: H(cu, cv - 0.1) - H(cu, 0.05),
      mine: [g(0.5, 0.1), g(0.5, 0.65), g(0.3, 0.4)], theirs: [g(0.5, 0.8), g(0.15, 0.7), g(0.85, 0.7), g(0.5, 0.72)], parcels: PARCELS.length };
  })()`);
  eq([m.id, m.listed, m.started, m.cloud], ['match', false, true, 'offline'], 'the preview opens on the match map, not in the mountain list, offline');
  assert(m.same < 1e-6, `all three slices are the same ground (${m.same})`);
  assert(m.flat < 1.5 && m.drop > 20, `a flat summit (${m.flat.toFixed(2)}) well above the base (${m.drop.toFixed(1)})`);
  eq(m.mine, [true, true, true], 'your slice runs from your base up to the summit');
  eq(m.theirs, [false, false, false, false], 'the other slices and the summit cairn are not yours');
  // Land for sale: only in front of your own slice, and a bought parcel becomes yours.
  const land = await g.ev(`(() => {
    const ids = PARCELS.map((p) => p.id).sort(), S = PARCELS.find((p) => p.id === 'S2');
    const mid = { x: (S.i0 + S.i1) / 2 - HALF, z: (S.j0 + S.j1) / 2 - HALF }, before = inProperty(mid.x, mid.z);
    state.land = [{ id: 'S2', own: 'buy', wait: 0, price: 1 }]; applyLand(); const after = inProperty(mid.x, mid.z);
    state.land = []; applyLand();
    return { ids, before, after };
  })()`);
  assert(land.ids.includes('S2') && land.ids.every((id) => /^(S\d|SW|SE|W4|E4)$/.test(id)), `parcels only below your base (${land.ids})`);
  eq([land.before, land.after], [false, true], 'a bought parcel below the base becomes your land');
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const day = await g.ev(`(() => { openDay(); state.speed = 0; let n = 0; while (state.phase === 'open' && n++ < 200000) simStep(1.5); return { phase: state.phase, guests: state.lastReport && state.lastReport.guests }; })()`);
  eq(day.phase, 'report', 'a day plays to its report');
  assert(day.guests > 20, `guests came (${day.guests})`);
  await g.ev('saveNow(); nextDay(); saveNow()');
  const kept = await g.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('skiTycoon')));
  eq(kept, [], 'nothing saved on the device');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  return `${day.guests} guests on Crown Peak`;
}
