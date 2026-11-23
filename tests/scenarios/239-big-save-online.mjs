// A big resort stopped saving online (Elk Basin, Nov 23): each of its 14 kept day reports listed all 683 buildings,
// 492 of them planted trees, so the save grew past the database's size check and every upload failed quietly. Signing
// out then deleted the browser's copy, and the week-old online copy came back. Now decor is one entry per kind in a
// report (old reports packed on load), an online copy too big leaves out its oldest reports, a refusal is said out
// loud, and signing out keeps a mountain whose newest progress isn't online.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.ev(`__fakeSwitch('user-J', 'j@example.com')`); await g.wait(800);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);

  // old reports listing 500 planted trees and a fence one by one
  const pack = await g.ev(`(() => {
    const tree = (i) => ({ id: 1000 + i, name: 'Tree ' + i, type: 'tree', mode: 'open', visits: 0, profit: 0, full: 0 });
    const rep = (d) => ({ day: d, guests: 100, sat: 80, profit: 1000, rev: {}, exp: {}, rep: 1, ops: { kind: 'weekday', dayKind: 'weekday', hours: 'full', staff: 'normal', patrolCount: null, lifts: [],
      blds: [{ id: 1, name: 'Main Lodge', type: 'lodge', mode: 'open', visits: 40, profit: 500, full: 300 }, ...Array.from({ length: 500 }, (_, i) => tree(i)), { id: 2, name: 'Mesh fence', type: 'mfence', mode: 'open', visits: 0, profit: 0, full: 1 }, { id: 3, name: 'Ski rack', type: 'rack', mode: 'open', visits: 9, profit: 0, full: 2 }],
      lots: { open: 1, total: 1, peak: 0, away: 0 }, saved: 0, letdown: 0, claims: 0, repHit: 0 } });
    state.history = Array.from({ length: 14 }, (_, i) => rep(30 + i)); state.lastReport = rep(43);
    const before = JSON.stringify(saveData(false)).length;
    applySave(saveData(true));
    const b = state.history[0].ops.blds, html = opsReportHtml(state.history[0]);
    return { before, after: JSON.stringify(saveData(false)).length, kinds: b.map((x) => x.type + ':' + (x.n || 1)).join(' '), last: state.lastReport.ops.blds.length,
      trees: /Planted trees <em>× 500<\\/em>/.test(html), fence: /Mesh fences <em>× 1<\\/em>/.test(html), lodge: /Main Lodge/.test(html), rack: /Ski rack/.test(html) };
  })()`);
  eq(pack.kinds, 'lodge:1 tree:500 mfence:1 rack:1', 'old reports pack their decor on load: one entry per kind, racks one by one');
  eq(pack.last, 4, 'the last report is packed too');
  assert(pack.after < pack.before / 5, `a save with 14 such reports shrinks a lot (${pack.before} → ${pack.after})`);
  eq([pack.trees, pack.fence, pack.lodge, pack.rack], [true, true, true, true], 'the report still reads “Planted trees × 500”, fences as one line, the rest by name');

  // buildings save compactly and come back exactly as they were (decor places to a thousandth)
  const round = await g.ev(`(() => {
    const L = world.buildings.find((B) => !BTYPES[B.type].decor) || world.buildings[0];
    addBuilding({ id: world.nextId++, type: 'tree', tier: 0, x: L.x + 6.123456, z: L.z + 4.987654, rot: 0, name: 'Tree', spent: 400, padY: null, yday: { visits: 0, services: {}, revenue: 0, profit: 0 } });
    addBuilding({ id: world.nextId++, type: 'mfence', tier: 0, x: L.x + 8.5, z: L.z + 4, rot: 1, name: 'Mesh fence 2', spent: 120, padY: null, yday: { visits: 0, services: {}, revenue: 0, profit: -1 } });
    if (L.yday == null) L.yday = { visits: 12, services: { food: 12 }, revenue: 340, profit: 90 };
    const pick = (B) => JSON.stringify({ id: B.id, type: B.type, tier: B.tier, x: BTYPES[B.type].decor ? r3(B.x) : B.x, z: BTYPES[B.type].decor ? r3(B.z) : B.z, rot: B.rot, name: B.name, spent: B.spent, yday: B.yday, padY: B.padY ?? null });
    const before = world.buildings.map(pick), sv = saveData(true), tree = sv.world.buildings.find((B) => B.type === 'tree');
    applySave(sv);
    const after = world.buildings.map(pick);
    return { same: JSON.stringify(before) === JSON.stringify(after), n: before.length, tree: JSON.stringify(tree).length, diff: before.find((b, i) => b !== after[i]) || '', to: after.find((b, i) => b !== before[i]) || '' };
  })()`);
  eq([round.same, round.diff, round.to], [true, '', ''], `${round.n} buildings come back exactly as saved`);
  assert(round.tree < 80, `a planted tree is small in the save (${round.tree} characters)`);

  // a save still too big for the database: the online copy leaves out its oldest reports, this device keeps them all
  const fit = await g.ev(`(async () => {
    state.history = Array.from({ length: 14 }, (_, i) => ({ day: 30 + i, guests: 1, sat: 80, profit: 0, rev: {}, exp: {}, note: 'x'.repeat(150000) }));
    const s = activeSlot(); CLOUD.lastUp = 0; CLOUD.sentJson = ''; await cloudSave(true);
    const row = JSON.parse(localStorage.getItem('FAKE_DB')).rows.find((r) => r.id === s.id);
    return { err: CLOUD.error, online: row && row.save.clock.history.length, first: row && row.save.clock.history[0].day, kept: state.history.length, len: row && JSON.stringify(row.save).length };
  })()`);
  eq(fit.err, '', 'it saves online');
  assert(fit.online > 0 && fit.online < 14 && fit.first > 30, `the online copy leaves out the oldest reports (${fit.online} kept, from day ${fit.first})`);
  assert(fit.len <= 1300000, 'and fits the database');
  eq(fit.kept, 14, 'this device keeps every report');

  // the database refuses it anyway: said out loud, not only in the online panel
  const refused = await g.ev(`(async () => {
    const realFit = fitSave, realToast = toast; let told = '';
    fitSave = () => 0; toast = (m) => { told = m; };
    state.history = Array.from({ length: 14 }, (_, i) => ({ day: 30 + i, note: 'x'.repeat(150000) }));
    try { CLOUD.lastUp = 0; CLOUD.sentJson = ''; CLOUD.bigWarned = null; await cloudSave(false); } finally { fitSave = realFit; toast = realToast; }
    return { err: CLOUD.error, told };
  })()`);
  eq(refused.err, 'Your resort is too big to save online right now.', 'the database’s size refusal reads as too big');
  assert(/too big to save online/.test(refused.told) && /Don’t sign out/.test(refused.told), 'and the player is told straight away');

  // uploads failing for over an hour, for any reason: said once, and the mountain's card says so too
  const lag = await g.ev(`(async () => {
    const s = activeSlot(), realToast = toast; let told = [];
    toast = (m) => told.push(m);
    try {
      s.pendSince = Date.now() - 30 * 60000; behindWarned = null; saveNow(); const early = told.length;
      s.pendSince = Date.now() - 2 * 3600000; saveNow(); saveNow();
      const row = slotRows().find((r) => r.id === s.id);
      const badge = (() => { $('mTitle').onclick(); return document.querySelector('.sc-badge.warn')?.textContent || ''; })();
      return { early, told: told.length, msg: told[0] || '', behind: row.behind, badge };
    } finally { toast = realToast; }
  })()`);
  eq([lag.early, lag.told, lag.behind], [0, 1, true], 'progress waiting over an hour to go online is told once, not before');
  assert(/hasn’t saved online since/.test(lag.msg) && /too big/.test(lag.msg), 'with the reason: ' + lag.msg);
  eq(lag.badge, 'Newest progress only on this device', 'and the mountain’s card on the title screen says so');
  await g.click('#startBtn'); await g.wait(500);
  const cleared = await g.ev(`(async () => {
    state.history = []; const s = activeSlot(); CLOUD.lastUp = 0; CLOUD.sentJson = ''; await cloudSave(true);
    return { err: CLOUD.error, pend: s.pendSince || 0 };
  })()`);
  eq(cleared, { err: '', pend: 0 }, 'a save that goes online clears it');

  // newer progress that can't go online: signing out keeps it here, and signing in again carries on with it
  const out = await g.ev(`(async () => {
    const s = activeSlot(), id = s.id; await new Promise((r) => setTimeout(r, 30));
    state.cash = 12345678; saveNow();
    const realFit = fitSave; fitSave = () => 2e6;
    try { await signOut(); } finally { fitSave = realFit; }
    return { id, kept: slots.list.map((x) => x.id), owner: (slots.list[0] || {}).owner, local: !!localStorage.getItem(slotKey(id)), msg: CLOUD.authMsg, guest: CLOUD.guest };
  })()`);
  eq(out.kept, [out.id], 'signing out keeps the mountain whose newest progress isn’t online');
  eq([out.owner, out.local, out.guest], ['user-J', true, true], 'still yours, still in this browser, while a guest plays');
  assert(/hasn’t saved online yet/.test(out.msg), 'and says so: ' + out.msg);
  await g.ev(`__fakeSwitch('user-J', 'j@example.com')`); await g.wait(1200);
  await g.ev(`$('mTitle').onclick()`); await g.wait(500);
  await g.click(await g.ev(`document.querySelector('[data-slot=play][data-id="${out.id}"]') ? '[data-slot=play][data-id="${out.id}"]' : '#startBtn'`)); await g.wait(800);
  const back = await g.ev(`({ id: slots.active, cash: state.cash })`);
  eq(back, { id: out.id, cash: 12345678 }, 'signing in again opens it with the newest progress');

  // once it's online, signing out clears it as before
  const clean = await g.ev(`(async () => {
    if (!state.started) { $('startBtn').click(); await new Promise((r) => setTimeout(r, 300)); }
    await signOut(); return slots.list.length;
  })()`);
  eq(clean, 0, 'a mountain safely online leaves the device on sign-out');
  eq(g.errors, [], 'no page errors');
  return 'decor packed in reports, oversize online copies trimmed and announced, sign-out keeps unsaved progress';
}
