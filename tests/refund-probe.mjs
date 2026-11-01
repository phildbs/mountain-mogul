// Review probe: why guests who bought a ticket go home without a single lift ride.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
import { bigBuild } from './big-resort.mjs';
const s = await startServer(process.env.SRC ? { source: readFileSync(process.env.SRC, 'utf8') } : {}), b = await launch();
const g = await openGame(b, s.url, { mountain: 'juniper' }); await g.click('#startBtn'); await g.wait(200);
const SAVE = process.env.BIG_SAVE;
if (SAVE && existsSync(SAVE)) await g.ev(`applySave(${readFileSync(SAVE, 'utf8')})`);
else { console.log('built', JSON.stringify(await g.ev(bigBuild))); if (SAVE) writeFileSync(SAVE, JSON.stringify(await g.ev('saveData(false)'))); }
await g.ev(`let seed=${+(process.env.SEED || 7)};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);`);
console.log(JSON.stringify(await g.ev(`(() => {
  demandForDay = () => ${+(process.env.GUESTS || 8000)}; state.cash = 1e9; state.day = 41; openDay(); state.speed = 0;
  const born = new Map(), stHist = new Map(); const mg = makeGuest;
  makeGuest = (...a) => { const r = mg(...a); const gg = guests[guests.length - 1]; if (gg) born.set(gg.id, state.time); return r; };
  const out = []; const orf = refundGuest;
  refundGuest = (gg, why) => { const was = gg.refunded; orf(gg, why); if (!was && gg.refunded) out.push({ t: Math.round(state.time), born: Math.round(born.get(gg.id) ?? -1), leaveAt: Math.round(gg.leaveAt), ab: gg.ab, sat: Math.round(gg.sat), fat: Math.round(gg.fat), stam: Math.round(gg.stam), wo: Math.round(gg.waitOver||0), rent: gg.needsRental, lesson: gg.wantsLesson, lessoned: gg.lessoned, first: gg.first, ll: gg.learnLaps, hist: (stHist.get(gg.id)||[]).slice(-14).join(' '), th: (gg.th||[]).slice(-4).map((x) => typeof x === 'string' ? x : x.t || x.text || JSON.stringify(x)) }); };
  let n = 0;
  while (state.phase === 'open' && n++ < 200000) {
    simStep(1.5);
    if (n % 20) continue;
    for (const w of guests) { const k = w.st + (w.then ? ':' + w.then.k : ''); const h = stHist.get(w.id) || []; if (h[h.length - 1] !== k) { h.push(k); stHist.set(w.id, h); } }
  }
  const byWhy = {}; for (const r of out) { const k = r.th[r.th.length-1]; byWhy[k] = (byWhy[k]||0)+1; }
  return { refunded: today.refunded, refunds: Math.round(today.refunds), guests: today.guests ?? null, byWhy, sample: out.filter((_, i) => i % Math.max(1, Math.floor(out.length / 25)) === 0) };
})()`), null, 1));
await b.close(); s.close?.(); process.exit(0);
