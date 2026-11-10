// Willow Valley, the third match map: a valley with two resorts each side, facing each other. Each resort's game puts
// its own slice in front: the north side's slid along, the far side's turned round as well (valley@2, valley@3). So a
// rival's lifts must stand on the same ground in your game as in theirs, and their lot, drawn from yours, mirrored when
// theirs grows the other way, must sit on their base. Every slice gets the same land: area, trees, lot room, parcels.
// The window offers it as a third mountain; until supabase/match-valley.sql is run, it says it isn't switched on.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  // A starter resort on each side (the server does the same: valley@<slot>), and the ground under its first lift.
  const saves = {}, ground = {}, fair = [];
  for (const slot of [1, 2]) {
    const p = await openGame(browser, url, { query: `?matchMap=valley@${slot}`, mountain: 'fresh' });
    const r = await p.ev(`(() => {
      let cells = 0, n = 0; for (let j = 0; j < WN; j++) for (let i = 0; i < WN; i++) if (inArea(i + 0.5, j + 0.5)) cells++;
      for (let k = 0; k < trees.n; k++) if (trees.alive[k] && inArea(trees.x[k] + HALF, trees.z[k] + HALF)) n++;
      const fair = { cells, trees: n, parcels: PARCELS.map((P) => P.name).join(), acres: PARCELS.map((P) => (P.i1 - P.i0) * (P.j1 - P.j0)).join(), lotWest: !!MOUNTAIN.lotWest,
        lot: (() => { state.lotSections = 4; state.lotLayout = [[0, 0], [0, 1], [0, 2], [0, 3]]; reserveKey = ''; const n = nextLotSlot(), room = lotReserve().length; state.lotSections = 1; state.lotLayout = null; reserveKey = ''; return [n.row, n.col, n.land, room]; })() };
      buildStarter(true); const a = world.lifts[0].a;
      return { save: saveData(false), a: { x: a.x, z: a.z, y: heightAt(a.x, a.z) }, fair }; })()`);
    saves[slot] = r.save; ground[slot] = r.a; fair.push(r.fair);
    eq([r.save.mt, r.save.world.lifts.length > 0, p.errors], [`valley@${slot}`, true, []], `a starter resort on slice ${slot + 1}`);
    await p.page.close();
  }
  eq(fair[0].cells, fair[1].cells, 'both sides get the same area');
  assert(Math.abs(fair[0].trees - fair[1].trees) < 0.02 * fair[0].trees, `and about the same trees to clear (${fair[0].trees}, ${fair[1].trees})`);
  eq(fair.map((f) => f.acres), [fair[0].acres, fair[0].acres], 'the same land for sale');
  assert(/^West valley,East valley,Far east lower,Far east middle,Far east upper$/.test(fair[0].parcels) && /^West valley,East valley,Far west lower,Far west middle,Far west upper$/.test(fair[1].parcels), `named as each owner sees it (${fair.map((f) => f.parcels)})`);
  eq(fair.map((f) => f.lotWest), [false, true], 'slice 2’s lot grows east, slice 3’s west, each toward its own shoulder');
  eq(fair.map((f) => [f.lot[0], f.lot[1], f.lot[2], f.lot[3]]), [[0, 4, 'the creek is just past it', 0], [0, 4, 'the creek is just past it', 0]], 'every main lot stops at 4 sections a row (Phil: 4 + 4)');

  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [{ id: 'WV', name: 'Willow Cup', map: 'valley', slots: 4, starts_at: at(-50), days: 168, day_minutes: 15, status: 'running', day: 3, kind: 'custom', created_by: 'u-x' }],
    players: [{ lobby_id: 'WV', slot: 1, user_id: 'u-x', resort_name: 'North Bowl' }, { lobby_id: 'WV', slot: 2, user_id: 'user-B', resort_name: 'Phil Peak' }],
    resorts: [{ lobby_id: 'WV', slot: 1, day: 3, save: saves[1], summary: { name: 'North Bowl', profit: 5000, guests: 400 } }, { lobby_id: 'WV', slot: 2, day: 3, save: saves[2], summary: { name: 'Phil Peak', profit: 4000, guests: 380 } }], orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.noValley = true; d.profiles = { 'user-B': { name: 'Phil', public: true } };
    localStorage.setItem('FAKE_DB', JSON.stringify(d)); localStorage.setItem('mm.kotm.intro', '1'); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  eq(await g.ev(`document.querySelector('#mpCard .mh-tag').textContent`), 'New valley', 'the title card tags the valley new');
  await g.click('#mpCard');
  await g.page.waitForSelector('[data-mp=open][data-id=WV]', { timeout: 10000, state: 'attached' });
  const w = await g.page.evaluate(() => { const h = [...document.querySelectorAll('#mpBody .mp-hero')], r = h.map((x) => x.getBoundingClientRect());
    return { names: h.map((x) => x.querySelector('b').textContent), tag: (h[2].querySelector('.mp-new') || {}).textContent, row: r.every((q) => Math.abs(q.top - r[0].top) < 2), card: document.querySelector('#mpBody .mp-card').innerText }; });
  eq([w.names, w.tag, w.row], [['Crown Peak', 'Ridgeline', 'Willow Valley'], 'New', true], 'the window shows the three mountains in a row, Willow Valley tagged new');
  assert(/Willow Valley · 4 resorts/.test(w.card), `a Willow Valley match says so (${JSON.stringify(w.card.slice(0, 160))})`);
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(300);
  const ph = await g.page.evaluate(() => { const r = [...document.querySelectorAll('#mpBody .mp-hero')].map((h) => h.getBoundingClientRect()), m = document.querySelector('#mpModal .modal');
    return { row: r.every((q) => Math.abs(q.top - r[0].top) < 2 && Math.abs(q.width - r[0].width) < 2), over: m.scrollWidth - m.clientWidth }; });
  eq([ph.row, ph.over <= 1], [true, true], 'on a phone too, a third each, with no sideways scrolling');
  await g.page.setViewportSize({ width: 1280, height: 900 }); await g.wait(300);
  // Making a match from its picture: 2 to 4 resorts, starting at 4. Before the SQL is run, it says so.
  await g.page.click('.mp-hero[data-map=valley]'); await g.page.waitForSelector('#mpMake');
  const seg = () => g.page.evaluate(() => ({ map: document.querySelector('[data-mk=map][aria-pressed=true]').dataset.v, slots: [...document.querySelectorAll('[data-mk=slots]')].map((b) => b.dataset.v + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join() }));
  eq(await seg(), { map: 'valley', slots: '2,3,4*' }, 'Willow Valley: 2, 3 or 4 resorts, starting at 4');
  await g.page.fill('#mkName', 'Valley Cup'); await g.page.click('#mpMake button[type=submit]'); await g.wait(800);
  assert(/Making matches on Willow Valley isn’t switched on yet/.test(await g.ev(`$('mpBody').innerText`)), 'before match-valley.sql is run, it says it isn’t switched on yet');
  await g.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); delete d.noValley; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await g.page.click('#mpMake button[type=submit]');
  await g.page.waitForFunction(() => !document.getElementById('mpMake'), null, { timeout: 10000 });
  const made = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.name === 'Valley Cup'));
  eq([made.map, made.slots], ['valley', 4], 'then a 4-resort match on Willow Valley is made');

  // Going to your resort in Willow Cup: the far side (slice 3), turned round, with your rival across the valley.
  await g.page.evaluate(() => document.querySelector('[data-mp=open][data-id=WV]').click());
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 30000 });
  const a = await g.ev(`(() => { const s = RIVAL_SKI.slices[0], L = s && s.lifts[0], b = MOUNTAIN.bases[1], bx = PLAY0 + b[0] * PN - HALF, bz = PLAY1 - b[1] * PN - HALF;
    const lots = rivalGroup.children.filter((o) => o.material === LOT_MAT).map((o) => { o.geometry.computeBoundingBox(); const c = o.geometry.boundingBox.getCenter(new THREE.Vector3()); return Math.hypot(c.x - bx, c.z - bz); });
    return { mt: MOUNTAIN.id, slot: matchPlay.slot, rivals: RIVAL_SKI.slices.map((x) => x.slot), land: PARCELS.map((p) => p.id).join(), tips: getComputedStyle($('tipsBtn')).display,
      at: L ? [sliceAt(L.a.x + HALF, L.a.z + HALF), sliceAt(world.lifts[0].a.x + HALF, world.lifts[0].a.z + HALF)] : null, y: L ? heightAt(L.a.x, L.a.z) : null, far: L ? farOut(L.a, 4) : null, lots, sheet: matchSheet() }; })()`);
  eq([a.mt, a.slot, a.rivals, a.land, a.tips], ['valley@2', 2, [1], 'V0,V1,V2,V3,V4', 'none'], 'on your own slice of Willow Valley, with its land for sale and no What next?');
  eq([a.at, a.far], [[1, 2], false], 'your rival’s lift stands on their slice, across the valley, on drawn ground');
  assert(Math.abs(a.y - ground[1].y) < 0.6, `on the same ground as in their own game (height ${a.y.toFixed(2)} here, ${ground[1].y.toFixed(2)} there)`);
  assert(a.lots.length >= 1 && a.lots.every((d) => d < 16), `their lot sits on their base (${a.lots.map((d) => d.toFixed(1))})`);
  assert(/beside yours and across the valley/.test(a.sheet), 'the standings say where your rivals are');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  // From each corner, every pretend rival's lifts stand on their own slice, on drawn ground, their lots on their bases.
  for (const s of [0, 3]) {
    const d = await openGame(browser, url, { query: `?matchDemo=valley@${s}`, mountain: 'fresh' });
    await d.page.waitForFunction(() => window.__dbg('typeof matchView !== "undefined" && !!matchView && matchView.drawn > 0'), null, { timeout: 60000 });
    const v = await d.ev(`(() => RIVAL_SKI.slices.map((sl) => { const b = MOUNTAIN.bases[sl.slot], bx = PLAY0 + b[0] * PN - HALF, bz = PLAY1 - b[1] * PN - HALF;
      return [sl.slot, sl.lifts.length > 0 && sl.lifts.every((L) => !farOut(L.a, 4) && sliceAt(L.a.x + HALF, L.a.z + HALF) === sl.slot), sl.stalls.length > 0 && sl.stalls.every((p) => Math.hypot(p.x - bx, p.z - bz) < 45)]; }).sort((x, y) => x[0] - y[0]))()`);
    eq(v, [0, 1, 2, 3].filter((k) => k !== s).map((k) => [k, true, true]), `from slice ${s + 1}, every rival stands on their own slice with their lot at their base`);
    eq(d.errors, [], 'no page errors');
    await d.page.close();
  }
}
