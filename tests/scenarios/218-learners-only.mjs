// Learners only: a switch on a magic carpet or T-bar keeps it for beginners. Strong skiers used carpets below the
// base area as a shortcut from the lot and crowded out the learning area (player feedback, Nov 11).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev(`state.cash = 5e6`);
  // a learning area and its carpet, as in scenario 28
  const ok = await g.ev(`(() => { setTool('clear'); state.landMode = 'area'; state.brushR = 3.6;
    for (let z = 56; z >= 40; z -= 2) for (const x of [-12, -8, -4, -1]) areaPaintAt({ x, z });
    commitArea(); const i = evalLift({ x: -6, z: 54 }, { x: -7, z: 44 }, 'carpet'); if (i.problems.length) return i.problems.join('|');
    commitLift(i, 'carpet'); computeNetwork(); syncLabels(); setTool('explore'); return true; })()`);
  eq(ok, true, 'a learning area and its carpet were built');
  // the switch on the carpet's panel, and none on a chairlift
  await g.ev(`select({ kind: 'lift', obj: world.lifts.find((L) => L.type === 'carpet') })`);
  eq(await g.ev(`$('sheet').querySelector('[data-action=learnLift]').getAttribute('aria-checked')`), 'false', 'a carpet has a Learners only switch, off to start');
  await g.click('[data-action=learnLift]');
  eq(await g.ev(`[world.lifts.find((L) => L.type === 'carpet').learn, $('sheet').querySelector('[data-action=learnLift]').getAttribute('aria-checked'), /learners only/.test($('sheet').textContent)]`),
    [true, 'true', true], 'switching it on keeps the carpet for learners, and the panel says so');
  await g.ev(`select({ kind: 'lift', obj: world.lifts.find((L) => L.type !== 'carpet') })`);
  eq(await g.ev(`!!$('sheet').querySelector('[data-action=learnLift]')`), false, 'a chairlift has no such switch');
  // it survives a reload
  await g.ev(`select(null); saveNow()`); await g.page.reload(); await g.reloaded();
  await g.ev(`$('startBtn').click()`); await g.wait(400);
  eq(await g.ev(`world.lifts.filter((L) => L.learn).map((L) => L.type)`), ['carpet'], 'the switch survives a reload');
  // a day: beginners still ride it; nobody else even joins its line
  await g.ev(SETUPS.midwinter);
  const d = await g.ev(`(() => { openDay(); const C = world.lifts.find((L) => L.type === 'carpet'); let n = 0, others = 0, mine = 0;
    while (state.phase === 'open' && n < 90000) { simStep(1.5); n++; for (const q of C.queue) { if (q.ab > 0) others++; else mine++; } }
    return { phase: state.phase, others, mine, learners: state.lastReport.learners }; })()`);
  eq([d.phase, d.others], ['report', 0], 'no stronger skier lines up for a learners-only carpet');
  assert(d.mine > 0 && d.learners > 0, `beginners still ride it and lap the learning area (${d.mine}, ${d.learners})`);
  // with every other lift stopped, skiers who'd take the carpet anyway are turned away only while the switch is on
  const pick = await g.ev(`(() => { nextDay(); openDay(); for (let i = 0; i < 2000 && guests.filter((q) => q.ab >= 2).length < 20; i++) simStep(1.5);
    const C = world.lifts.find((L) => L.type === 'carpet'); for (const L of world.lifts) if (L !== C) L.open = false;
    const strong = guests.filter((q) => q.ab >= 2).slice(0, 20), out = {};
    for (const on of [false, true]) {
      C.learn = on || undefined; let n = 0;
      for (const q of strong) { const was = { ...q }; q.L = null; q.leaving = false; q.ate = true; baseDecision(q); if (q.L === C) n++; if (q.L === C) C.incoming = Math.max(0, C.incoming - 1); Object.assign(q, was); }
      out[on] = n;
    }
    return { n: strong.length, off: out.false, on: out.true, phase: state.phase, all: guests.length }; })()`);
  assert(pick.n > 5, `enough strong skiers to try (${JSON.stringify(pick)})`);
  assert(pick.off > 0, `with the switch off, some head for the carpet (${pick.off} of ${pick.n})`);
  eq(pick.on, 0, 'with it on, none do');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
