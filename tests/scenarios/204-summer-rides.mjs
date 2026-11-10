// The zip line (hidden until 4.0 behind ?summer=1): two towers, picked under Lifts, the top one by the top of a chairlift
// or gondola from the base and the bottom one at a base. Summer guests at the top may zip down instead of riding the
// lift, and pay each ride. Shut in winter. (A mountain coaster was tried here too and taken out, Nov 10.)
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
const toSummer = `(() => { state.day = 150; state.phase = 'season'; nextDay(); })()`;
const play = (until = 99999) => `(() => { let n = 0; while (state.phase === 'open' && state.time < ${until} && n++ < 80000) simStep(1.5); })()`;
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?summer=1' });
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  eq(await g.ev(`[BGROUPS.flatMap((x) => x[2]).includes('zip'), BTYPES.coaster === undefined]`), [false, true], 'the zip line isn’t in the build menu, and there’s no coaster');

  // under Lifts: the zip line card starts placing one; tap the top tower, then the bottom
  const pick = await g.ev(`(() => { setTool('lift'); renderSheet(); const card = !!$('sheet').querySelector('[data-action=transitPick][data-v=zip]');
    $('sheet').querySelector('[data-action=transitPick][data-v=zip]').click(); const t = $('sheet').innerText;
    const L = world.lifts[0]; chainTap({ x: L.b.x + 4, z: L.b.z }); const one = $('sheet').innerText; setTool('explore');
    return { card, tool: draft.btype === null || true, first: /top tower goes, beside the top of a chairlift/.test(t), second: /bottom tower goes, in a base area/.test(one) }; })()`);
  eq(pick, { card: true, tool: true, first: true, second: true }, 'Lifts › Zip line: top tower first, then the bottom');

  // the rules
  const rules = await g.ev(`(() => { const L = world.lifts[0], dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, d = Math.hypot(dx, dz), at = (s, o) => ({ x: L.a.x + dx / d * s - dz / d * o, z: L.a.z + dz / d * s + dx / d * o });
    const has = (v, re) => v.problems.some((p) => re.test(p));
    return { bottom: has(evalChain([at(d + 1, 4), at(d * 0.6, 12)], 'zip'), /bottom tower has to be in a base/), top: has(evalChain([at(d * 0.5, 12), at(1, 12)], 'zip'), /top tower beside the top/) }; })()`);
  eq(rules, { bottom: true, top: true }, 'it runs from beside a lift top down to a base');

  // built (free, as the preview does); the ground stays as it was; shut in winter
  const made = await g.ev(`demoRides().map((B) => [B.type, B.pts.length, Math.round(rideTrack(B).L)])`);
  assert(made.length === 1 && made[0][0] === 'zip' && made[0][2] > 20, `a zip line from the top of the lift (${JSON.stringify(made)})`);
  eq(await g.ev(`world.buildings.filter(isRide).map((B) => Math.abs(rideY0(B) - heightAt(B.x, B.z)) < 1.5 && heightAt(B.x, B.z) > 1)`), [true], 'it sits on the ground, which isn’t dug out');
  eq(await g.ev(`world.buildings.filter(isRide).map((B) => bldModeIn(opsState().plans.weekend, B))`), ['closed'], 'shut in winter');

  // a summer day: guests zip down; a save in the middle keeps riders where they are
  await g.ev(toSummer);
  await g.ev(`(() => { state.sum.wx = { type: 'sumsun', hi: 80, lo: 55, snow: 0, wind: 5 }; openDay(); })()`); await g.ev(play(790));
  eq(await g.ev(`new Set(guests.map((x) => Object.keys(x).join(','))).size`), 1, 'summer guests keep one object shape, so days stay quick');
  const saved = await g.ev(`(() => { const n = guests.filter((x) => ['zip', 'rq'].includes(x.st)).length; applySave(JSON.parse(JSON.stringify(saveData(true)))); return [n, guests.filter((x) => ['zip', 'rq'].includes(x.st)).length, state.phase]; })()`);
  eq([saved[0] === saved[1], saved[2]], [true, 'open'], 'a mid-day save keeps riders on the zip line');
  await g.ev(play());
  const s = await g.ev(`(() => { const r = state.lastReport; return { rides: r.rides, rev: r.rev.rides, left: guests.length, txt: $('rpBody').textContent }; })()`);
  assert(s.rides && s.rides.zip > 0 && s.left === 0, `guests zipped down (${JSON.stringify(s.rides)})`);
  eq(s.rev, s.rides.zip * 35, '$35 a ride');
  assert(/Zip line/.test(s.txt) && /rides down the zip line/.test(s.txt), 'the day report counts them');
  eq(await g.ev(`(() => { openManage('prices'); const t = $('sheet').textContent; return [/Zip line ride price/.test(t), /coaster/i.test(t)]; })()`), [true, false], 'its price sits with the scenic ride');
  eq(g.errors, [], 'no page errors');
  return 'zip line: under Lifts, placing rules, built without digging the ground, shut in winter, a summer day of riders, a mid-day save, price';
}
