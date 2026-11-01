// Lift mid-stations: one partway up a chairlift. Trails start and end there, riders get off to ski the lower
// runs, guests get on there for the upper half, and the mid-station survives a save and reload.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 2e7`);
  // placing it: the panel offers it, the tool picks a free spot, and bad spots say why
  const p = await g.ev(`(() => { const L = world.lifts[0]; select({ kind: 'lift', obj: L });
    const offered = !!document.querySelector('[data-action="midOpen"]');
    openMidTool(L); const s = midDraft.s, ok = midInfo(L, s).problems, near = midProblems(L, 0.05), tbar = midProblems(L, 0.5, L.a, L.b, 'tbar');
    buildMid(); return { offered, s, ok, near: near.length > 0, tbar: tbar.length > 0, mid: !!L.mid, up: !!L.midUp, tool: state.tool }; })()`);
  assert(p.offered, 'the lift panel offers a mid-station');
  eq(p.ok, [], 'the chosen spot is fine');
  assert(p.near && p.tbar, `too close to an end, or on a T-bar, is refused: ${JSON.stringify(p)}`);
  assert(p.mid && p.up && p.tool === 'explore', `it is built: ${JSON.stringify(p)}`);
  // a short trail from the mid-station down to the base, and one from the top that ends at the mid-station
  const n = await g.ev(`(() => { const L = world.lifts[0], m = L.midUp.a, found = [];
    for (const sx of [-1, 1]) for (const a of [5, 8, 12]) {
      if (found.includes('down')) break;
      const pts = [[m.x + 3 * sx, m.z + 2], [m.x + a * sx, (m.z + 58) / 2], [L.a.x + 6 * sx, 58]].map(([x, z]) => ({ x, z, y: heightAt(x, z) }));
      const t = evalTrail(pts, 'medium'); if (!t.an.problems.length) { commitTrail(t, pts, 'medium'); computeNetwork(); found.push('down'); }
    }
    for (const sx of [-1, 1]) for (const a of [5, 8, 12]) {
      if (found.includes('in')) break;
      const pts = [[L.b.x + 3 * sx, L.b.z + 3], [L.b.x + a * sx, (L.b.z + m.z) / 2], [m.x + 2 * sx, m.z - 2]].map(([x, z]) => ({ x, z, y: heightAt(x, z) }));
      const t = evalTrail(pts, 'medium'); if (!t.an.problems.length) { commitTrail(t, pts, 'medium'); computeNetwork(); found.push('in'); }
    }
    return { found, off: L.midLo.departing.length, feeders: L.midUp.feeders.length, reach: L.midLo.reachable && L.midUp.reachable, ret: L.midUp.returns }; })()`);
  eq(n.found, ['down', 'in'], 'trails from and to the mid-station can be built');
  assert(n.off >= 1 && n.feeders >= 1 && n.reach && n.ret, `the network links them: ${JSON.stringify(n)}`);
  const d = await g.ev(`(() => { openDay(); let k = 0, over = 0; const L = world.lifts[0], seats = LIFT_TYPES[L.type].seats;
    while (state.time < 780 && k < 90000) { simStep(1.5); k++; for (const r of L.riders) { if (r.length > seats || new Set(r.map((id) => gById.get(id) && gById.get(id).seat)).size < r.length) over++; } }
    return { over, off: (today.midOff || {})[L.id] || 0, on: (today.midOn || {})[L.id] || 0, line: L.midUp.queue.length }; })()`);
  eq(d.over, 0, 'no chair ever holds more riders than seats, or two on one seat');
  assert(d.off > 5 && d.on > 5, `riders get off and on at the mid-station: ${JSON.stringify(d)}`);
  // a mid-day save and reload keeps the mid-station and its line
  const s = await g.ev(`(() => { saveNow(); const L = world.lifts[0]; return { q: L.midUp.queue.length, mid: L.mid.s }; })()`);
  await g.page.reload(); await g.wait(800);
  const r = await g.ev(`(() => { const L = world.lifts[0]; return { mid: L.mid && L.mid.s, up: !!L.midUp, q: L.midUp ? L.midUp.queue.length : -1, phase: state.phase }; })()`).catch((e) => ({ err: e.message }));
  assert(r.mid === s.mid && r.up, `the mid-station is still there after reloading: ${JSON.stringify({ s, r })}`);
  const e = await g.ev(`(() => { ${'let n = 0; while (state.phase === "open" && n < 90000) { simStep(1.5); n++; }'} return { phase: state.phase, line: world.lifts[0].midUp.queue.length }; })()`);
  assert(e.phase !== 'open' && e.line === 0, `the day ends with nobody left in the mid-station line: ${JSON.stringify(e)}`);
  // removing it overnight disconnects its trails, and a T-bar never offers one
  const x = await g.ev(`(() => { nextDay(); const L = world.lifts[0]; removeMid(L); return { phase: state.phase, mid: !!L.mid, up: !!L.midUp, ids: !!liftById('mu' + L.id) }; })()`);
  eq(x, { phase: 'closed', mid: false, up: false, ids: false }, 'the mid-station can be removed');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  return `${d.off * 10} got off, ${d.on * 10} got on by 1 pm`;
}
