// Three fixes from player feedback. Hungry guests: someone eating a long restaurant lunch isn't
// counted as hungry, each hungry guest has a reason, and What next? follows the biggest one instead of
// always suggesting a café. Replant: a Landscape brush regrows cleared trees, never on trails or lift
// lines. Parking: once the lot can't grow along the road, land bought below it takes a second row.
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
    state.landMode = 'plant'; stroke.trees = 0; stroke.cost = 0; const cash = state.cash; for (const p of pts) clearAt(p); const a2 = alive();
    // nothing regrew in a trail or under the lift
    let bad = 0; for (let k = 0; k < trees.n; k++) if (trees.alive[k] && trees.play[k]) { const p = { x: trees.x[k], z: trees.z[k] };
      if (realTrails().some((t) => t.samples.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < TRAIL_WIDTHS[t.width].hw - 0.3))) bad++;
      if (world.lifts.some((L) => distToSeg(p, L.a, L.b) < 1.5)) bad++; }
    return { cleared: a0 - a1, regrown: a2 - a1, paid: cash - state.cash, bad, saved: saveData(false).trees === encodeCleared() }; })()`);
  assert(rp.cleared > 300 && rp.regrown > rp.cleared * 0.6 && rp.regrown <= rp.cleared, `replanted most of a cleared glade: ${JSON.stringify(rp)}`);
  eq([rp.paid, rp.bad], [rp.regrown * 150, 0], '$150 a tree, and nothing grew in a trail or under the lift');
  await g.ev(`(() => { setTool('clear'); state.landMode = 'plant'; renderSheet(); })()`);
  assert(/Replant/i.test(await g.ev(`$('sheet').innerText`)), 'Replant is in the Landscape panel');
  await g.ev(`setTool('explore')`);

  // ---- a second row of parking
  const lot = await g.ev(`(() => {
    const add = () => { if (mainLotBlock()) return false; const b = document.createElement('button'); b.dataset.action = 'expandLot'; sheet.appendChild(b); b.click(); b.remove(); return true; };
    let n = 0; while (n < 30 && add()) n++;
    const row0 = rowLen(0), msg = mainLotBlock();
    state.land = ['S2', 'S3', 'S4'].map((id) => ({ id, own: 'buy', wait: 0, price: 0, rent: 0 })); applyLand();
    let m = 0; while (m < 30 && add()) m++;
    return { row0, msg, row1: rowLen(1), sections: state.lotSections, cap: lotCapacity(), stalls: stalls.length, layout: state.lotLayout.slice(-2) }; })()`);
  assert(/Buy the land below it/.test(lot.msg), `the full lot says to buy the land below: ${lot.msg}`);
  eq([lot.row1, lot.sections, lot.cap, lot.stalls], [lot.row0, lot.row0 * 2, lot.row0 * 2 * 96, lot.row0 * 2 * 96], 'then a second row, one section under each');
  const car = await g.ev(`(() => { const first = rowLen(0) * 96; openDay(); for (let i = 0; i < first; i++) stalls[i].car = -1; spawnCar(2); const c = cars[cars.length - 1]; for (let i = 0; i < first; i++) stalls[i].car = null; return { row: stalls[c.stall].row, path: c.path.length }; })()`);
  eq(car.row, 1, 'with the first row full, cars park in the second');
  eq(await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); return [state.lotSections, rowLen(1), stalls.length]; })()`), [lot.sections, lot.row1, lot.stalls], 'the layout is saved');
  // choosing the direction: 3 across and 2 down
  const dir = await g.ev(`(() => {
    state.lotSections = 1; state.lotLayout = null; buildLot(); openManage('parking'); renderSheet();
    const press = (row) => { const b = document.querySelector('#sheet [data-action=expandLot][data-row="' + row + '"]'); if (b && !b.disabled) b.click(); renderSheet(); };
    press(0); press(0); press(1); press(1); press(1); press(1);
    const chip = document.querySelector('#sheet .chip');
    return { layout: state.lotLayout, below: lotGrowBlock(1), pos: chip && getComputedStyle(chip).position }; })()`);
  eq(dir.layout, [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], 'two along the road, then a row below: 3 across, 2 down');
  assert(/Add along the road first/.test(dir.below), 'the row below stops at the first row’s length');
  assert(dir.pos !== 'absolute', `panel chips stay in the panel (map markers have their own class): ${dir.pos}`);
  // choosing on the map: Grow the main lot puts a + on each spot, and tapping one adds a section there
  const pick = await g.ev(`(() => { state.lotSections = 1; state.lotLayout = null; buildLot(); openManage('lotgrow'); updateLotMarks();
    const tags = [...document.querySelectorAll('#lotTags button')].map((b) => b.textContent);
    [...document.querySelectorAll('#lotTags button')].find((b) => /Below/.test(b.textContent)).click(); updateLotMarks();
    return { tags, layout: state.lotLayout, after: [...document.querySelectorAll('#lotTags button')].map((b) => b.textContent) }; })()`);
  eq(pick.tags, ['+ Along the road · $75k', '+ Below · $75k'], 'a + along the road and one below');
  eq(pick.layout, [[0, 0], [1, 0]], 'tapping + Below adds a section under the first');
  eq(pick.after, ['+ Along the road · $75k'], 'then only along the road, until the first row is longer');
  eq(await g.ev(`(() => { select(null); updateLotMarks(); return document.querySelectorAll('#lotTags button').length; })()`), 0, 'gone when the panel closes');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
