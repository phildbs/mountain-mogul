// Visiting someone's resort on a shared custom mountain: from the mountain's card, from the leaderboard and from a
// link, it opens their resort (lifts, trails, date), not a blank copy of the mountain (Phil, Nov 12).
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  // Moss makes and shares a mountain, then plays it and builds a little resort, saved online and public
  const a = await openGame(browser, url, { query: '?editor=1', mountain: 'fresh' });
  await a.click('#edMaps'); await a.ev(`document.getElementById('edFrom').value = 'juniper'`); await a.click('#crisis [data-ed-new=shape]'); await a.reloaded();
  await a.ev(`__fakeSwitch('user-A', 'a@example.com')`);
  await a.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')); d.profiles = { 'user-A': { name: 'Moss', public: true }, 'user-B': { name: 'Sam', public: true } }; localStorage.setItem('FAKE_DB', JSON.stringify(d)); });
  await a.page.reload(); await a.reloaded();
  const id = await a.ev(`(async () => { ED.name = 'Visit Peak'; const doc = edDoc(), id = mapIdOf(doc); const r = await CLOUD.sb.rpc('share_mountain', { pid: id, pdoc: doc, pvertical: 1480, pallow: true }); return r.error ? r.error.message : id; })()`);
  assert(/^c:m/.test(id), `shared (${id})`);
  await a.ev(`(async () => { const S = await fetchShared('${id}'); sharedLook(S.doc, false); })()`); await a.reloaded();
  await a.click('#lkPlay'); await a.reloaded();
  eq(await a.ev(`[MOUNTAIN.id, state.started]`), [id, true], 'Moss plays it');
  const built = await a.ev(`(async () => { state.cash = 2e7; const L = LIFT_TYPES ? null : null;
    const b = lotSite(0), i = evalLift({ x: b.x, z: b.z - 12 }, { x: b.x, z: b.z - 50 }, 'double'); commitLift(i, 'double'); computeNetwork();
    state.resortName = 'Moss Ridge'; saveNow(); CLOUD.lastUp = 0; await cloudSave(false);
    const row = JSON.parse(localStorage.getItem('FAKE_DB')).rows.find((r) => r.summary && r.summary.mt === '${id}');
    return { lifts: world.lifts.length, day: state.day, row: row && { id: row.id, pub: row.public, n: row.save && row.save.n } }; })()`);
  assert(built.lifts === 1 && built.row && built.row.id, `a lift, saved online (${JSON.stringify(built)})`);
  const db = await a.page.evaluate(() => localStorage.getItem('FAKE_DB'));
  eq(a.errors, [], 'no errors for Moss'); await a.page.close();

  // Sam, signed in on Juniper Ridge, visits it from the mountain's card
  const b = await openGame(browser, url, { query: '?maps=1' });
  await b.page.evaluate((d) => localStorage.setItem('FAKE_DB', d), db);
  await b.ev(`__fakeSwitch('user-B', 'b@example.com')`); await b.page.reload(); await b.reloaded();
  await b.ev(`openSharedMountain('${id}')`); await b.wait(400);
  await b.click('#crisis .sm-resorts summary'); await b.page.waitForSelector('#smResorts [data-action=visit]', { state: 'visible', timeout: 8000 });
  await b.click('#smResorts [data-action=visit]'); await b.reloaded();
  await b.page.waitForFunction(() => window.__dbg && !!document.body.classList.contains('visiting'), null, { timeout: 15000 }).catch(() => {});
  const v = await b.ev(`({ mt: MOUNTAIN.id, visiting: !!visiting && visiting.id, lifts: world.lifts.length, day: state.day, name: $('resortName').textContent })`);
  eq(v, { mt: id, visiting: built.row.id, lifts: 1, day: built.day, name: 'Moss Ridge' }, 'Visit opens Moss’s resort on that mountain');
  eq(b.errors, [], 'no errors for Sam'); await b.page.close();

  // Sam again, having looked round the mountain first (Look around, then Back), visits from its card
  const c = await openGame(browser, url, { query: '?maps=1' });
  await c.page.evaluate((d) => localStorage.setItem('FAKE_DB', d), db);
  await c.ev(`__fakeSwitch('user-B', 'b@example.com')`); await c.page.reload(); await c.reloaded();
  await c.ev(`openSharedMountain('${id}')`); await c.wait(400); await c.click('#smLook'); await c.reloaded(); await c.wait(300);
  await c.click('#lkBack'); await c.reloaded(); await c.wait(400);
  await c.ev(`openSharedMountain('${id}')`); await c.wait(400);
  await c.click('#crisis .sm-resorts summary'); await c.page.waitForSelector('#smResorts [data-action=visit]', { state: 'visible', timeout: 8000 });
  await c.click('#smResorts [data-action=visit]'); await c.reloaded();
  await c.page.waitForFunction(() => document.body.classList.contains('visiting'), null, { timeout: 15000 }).catch(() => {});
  const w = await c.ev(`({ mt: MOUNTAIN.id, visiting: !!visiting && visiting.id, lifts: world.lifts.length, day: state.day, name: $('resortName').textContent })`);
  eq(w, { mt: id, visiting: built.row.id, lifts: 1, day: built.day, name: 'Moss Ridge' }, 'after looking round it first, too');
  eq(c.errors, [], 'no errors'); await c.page.close();

  // A resort saved before 4.9 on a mountain whose drawn road has a sharp bend: 4.9 rounds the bend, which moves the
  // forest along the road, so the save's tree count no longer matched and it opened blank, for its owner too.
  const d = await openGame(browser, url, { query: '?editor=1', mountain: 'fresh' });
  await d.click('#edMaps'); await d.ev(`document.getElementById('edFrom').value = 'juniper'`); await d.click('#crisis [data-ed-new=shape]'); await d.reloaded();
  await d.ev(`(() => { ED.name = 'Bendy'; const doc = edDoc(); doc.road = [[0.5,-0.36],[0.5,-0.1],[0.5,0.0],[0.62,0.03],[0.5,0.06],[0.5,0.09]]; sharedLook(doc, false); })()`); await d.reloaded();
  await d.click('#lkPlay'); await d.reloaded();
  const old = await d.ev(`(() => { state.cash = 2e7; const b = lotSite(0), i = evalLift({ x: b.x, z: b.z - 12 }, { x: b.x, z: b.z - 50 }, 'double'); commitLift(i, 'double'); computeNetwork(); state.resortName = 'Old Bend';
    const sv = saveData(), now = { n: trees.n, x: trees.x, cell: trees.cell, alive: trees.alive.slice() };
    // the same save as the game before 4.9 wrote it: its forest grown round the road as drawn, felled trees numbered in it
    const keep = [HT, ROADD, CREEKD, GR, HAZEV].map((a) => a.slice()), was = { ...trees }, cells = cellTrees.slice();
    generate({ ...MOUNTAIN, road: catmull(MOUNTAIN.doc.road, 6) }); const o = { n: trees.n, x: trees.x, cell: trees.cell };
    [HT, ROADD, CREEKD, GR, HAZEV].forEach((a, i) => a.set(keep[i])); for (const k of Object.keys(trees)) delete trees[k]; Object.assign(trees, was); cellTrees.set(cells);
    const dead = new Set(); for (let k = 0; k < now.n; k++) if (!now.alive[k]) dead.add(now.cell[k] + ':' + now.x[k]);
    const bytes = new Uint8Array(Math.ceil(o.n / 8)); let felled = 0; for (let k = 0; k < o.n; k++) if (dead.has(o.cell[k] + ':' + o.x[k])) { bytes[k >> 3] |= 1 << (k & 7); felled++; }
    let s = ''; for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
    localStorage.setItem(slotKey(slots.active), JSON.stringify({ ...sv, n: o.n, trees: btoa(s) }));
    return { n: now.n, oldN: o.n, felled }; })()`);
  assert(old.n !== old.oldN && old.felled > 50, `the bend moved the forest (${old.oldN} trees before, ${old.n} now; ${old.felled} felled)`);
  await d.page.reload(); await d.reloaded();
  const back = await d.ev(`(() => { const dead = new Set(); for (let k = 0; k < trees.n; k++) if (!trees.alive[k]) dead.add(k); return { lifts: world.lifts.length, name: state.resortName, felled: dead.size }; })()`);
  eq([back.lifts, back.name], [1, 'Old Bend'], 'the old save opens as the resort it was');
  assert(back.felled >= old.felled, `with its felled trees still felled (${back.felled} of ${old.felled})`);
  eq(d.errors, [], 'no errors'); await d.page.close();
}
