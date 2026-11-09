// Three fixes from player feedback. Hungry guests: someone eating a long restaurant lunch isn't
// counted as hungry, each hungry guest has a reason, and What next? follows the biggest one instead of
// always suggesting a café. Replant: a Landscape brush regrows cleared trees, never on trails or lift
// lines. Parking: land bought below the main lot lets it grow deeper.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  await g.ev(`state.cash = 1e8`);

  // ---- hunger
  await g.ev(`openDay()`);
  const h = await g.ev(`(() => { const mk = (o) => ({ id: 1e6 + Math.random(), th: [], sat: 70, ate: false, skipped: false, lunchAt: 600, bl: 0, blRate: 99, st: 'walk', x: 0, z: 40, ...o });
    state.time = 700; today.complaints.food = 0; today.hungry = null;
    const eating = mk({ st: 'inside', svc: 'finedine' }), lesson = mk({ st: 'lesson', svc: 'lesson' }), price = mk({ foodPrice: 1 }), line = mk({ foodLine: world.buildings[0].id }), lost = mk({});
    for (const g of [eating, lesson, price, line, lost]) updateNeeds(g, 1);
    if (today.complaints.food !== 0) throw Error('A delay is not a missed meal');
    for (const g of [price, line, lost]) recordMealOutcome(g);
    return { eating: !!eating.hungry, lesson: !!lesson.hungry, n: today.complaints.food, sum: hungerSummary(today.hungry) }; })()`);
  eq([h.eating, h.lesson, h.n], [false, false, 3], 'guests eating or in a lesson aren’t hungry yet; the three departing unfed guests count as missed meals');
  eq([h.sum.price, h.sum.lineN, h.sum.nowhereN], [1, 1, 1], 'each with its reason');
  const adv = await g.ev(`(() => { const out = []; const r = { complaints: { food: 60 }, hungry: { price: 40, late: 0, line: [], nowhere: [{ id: 'base', name: null, n: 20 }], lineN: 0, nowhereN: 20 } };
    hungerAdvice(r, (u, t, b) => out.push([t, b]));
    r.hungry = { price: 5, late: 0, line: [{ id: world.buildings.find((B) => B.type === 'lodge').id, name: 'x', n: 50 }], nowhere: [], lineN: 50, nowhereN: 5 }; hungerAdvice(r, (u, t, b) => out.push([t, b]));
    r.hungry = { price: 3, late: 0, line: [], nowhere: [{ id: String(world.lifts[0].id), name: world.lifts[0].name, n: 50 }], lineN: 0, nowhereN: 50 }; hungerAdvice(r, (u, t, b) => out.push([t, b]));
    return out; })()`);
  assert(/too expensive/.test(adv[0][0]) && adv[0][1] === 'Prices', `price-shy guests point to Prices: ${adv[0]}`);
  assert(/long lunch lines/.test(adv[1][0]) && adv[1][1] !== 'Prices', `long lines point to the lodge: ${adv[1]}`);
  assert(/nowhere to eat/.test(adv[2][0]) && adv[2][0].includes(await g.ev(`world.lifts[0].name`)), `nowhere nearby names the lift: ${adv[2]}`);
  await g.ev(SETUPS.finishDay);
  const note = await g.ev(`(() => { const r = state.lastReport; return r.complaints.food ? hungryNote(r) : 'none'; })()`);
  assert(note === 'none' || /left without eating/.test(note), `the report explains hungry guests: ${note}`);
  await g.ev(`(() => { $('report').hidden = true; nextDay(); })()`);

  // ---- replant
  const rp = await g.ev(`(() => {
    state.landMode = 'trees'; state.brushR = 6;
    const pts = []; for (let z = 0; z <= 45; z += 3) for (let x = -2; x <= 28; x += 3) pts.push(new THREE.Vector3(x, heightAt(x, z), z));
    const alive = () => trees.alive.reduce((a, v) => a + v, 0);
    const a0 = alive(); for (const p of pts) clearAt(p); const a1 = alive();
    state.landMode = 'plant'; stroke.trees = 0; stroke.cost = 0; const cash = state.cash, t0 = world.buildings.filter((B) => B.type === 'tree').length; for (const p of pts) clearAt(p); const a2 = alive(), fresh = world.buildings.filter((B) => B.type === 'tree').length - t0;
    // nothing regrew in a trail or under the lift
    let bad = 0; for (let k = 0; k < trees.n; k++) if (trees.alive[k] && trees.play[k]) { const p = { x: trees.x[k], z: trees.z[k] };
      if (realTrails().some((t) => t.samples.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < TRAIL_WIDTHS[t.width].hw - 0.3))) bad++;
      if (world.lifts.some((L) => distToSeg(p, L.a, L.b) < 1.5)) bad++; }
    for (const B of world.buildings) if (B.type === 'tree') { if (realTrails().some((t) => t.samples.some((s) => Math.hypot(s.x - B.x, s.z - B.z) < TRAIL_WIDTHS[t.width].hw - 0.3))) bad++; if (world.lifts.some((L) => distToSeg(B, L.a, L.b) < 1.5)) bad++; }
    return { cleared: a0 - a1, regrown: a2 - a1, fresh, paid: cash - state.cash, bad, saved: saveData(false).trees === encodeCleared() }; })()`);
  assert(rp.cleared > 300 && rp.regrown > rp.cleared * 0.6 && rp.regrown <= rp.cleared, `replanted most of a cleared glade: ${JSON.stringify(rp)}`);
  eq([rp.paid, rp.bad], [rp.regrown * 150 + rp.fresh * 400, 0], '$150 a tree regrown, $400 a new one on open ground, and nothing grew in a trail or under the lift');
  await g.ev(`(() => { setTool('clear'); state.landMode = 'plant'; renderSheet(); })()`);
  assert(/Plant trees/i.test(await g.ev(`$('sheet').innerText`)), 'Plant trees is in the Landscape panel');
  await g.ev(`setTool('explore')`);

  // ---- a deeper lot on land bought below it
  const lot = await g.ev(`(() => {
    const deeper = (k) => { const P = { ...parks()[0] }; P.R += k; P.z += k * PK.bay / 2; return parkCheck(P, 0).problems; }; // keeps its top edge, grows toward the valley
    let k = 1; while (k < 8 && !deeper(k).length) k++;
    const msg = deeper(k);
    state.land = ['S2', 'S3', 'S4'].map((id) => ({ id, own: 'buy', wait: 0, price: 0, rent: 0 })); applyLand();
    return { k, msg, after: deeper(k) }; })()`);
  assert(lot.k < 8 && lot.msg.some((m) => /property/.test(m)), `deeper than ${lot.k - 1} more aisles needs land below: ${lot.msg}`);
  eq(lot.after.filter((m) => /property/.test(m)), [], 'with the land below bought, it can grow there');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
