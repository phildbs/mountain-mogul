// Trail popularity: the Trails list sorts by Popular and lists glades; batch buttons close icy and thin trails and
// reopen them when the snow recovers (not ones closed by hand); the day report has a Trails page; the Traffic button
// shows the whole day's traffic, section by section, overnight. Old saves without the new fields still load.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter);
  // a glade beside the lift (as in 81-glades), so the list and report hold both kinds
  const glade = await g.ev(`(() => { state.cash = 1e8; const L = world.lifts[0];
    state.gladeThin = 'open'; openGladeTool(); clearAreaDraft(); state.brushR = 4;
    const dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
    for (let f = 0.98; f > 0.02; f -= 0.04) areaPaintAt({ x: L.a.x + dx * f + nx * 12, z: L.a.z + dz * f + nz * 12 });
    commitArea(); setTool('explore'); const A = world.areas.find(isGlade); A.signs = false;
    return { id: A.id, lines: world.trails.filter((t) => t.glade === A.id).length }; })()`);
  assert(glade.lines > 0, 'the glade has lines');
  await g.ev(SETUPS.midwinter);
  const day = await g.ev(`(() => { openDay(); ${SETUPS.finishDay}; const r = state.lastReport, d = r.trailsDay, u = state.dayUse;
    const sum = Object.values(u.runs).reduce((a, n) => a + n, 0) * AGENT;
    const bins = Object.values(u.heat);
    return { phase: state.phase, total: d.total, sum, sorted: d.top.every((x, i) => !i || d.top[i - 1].n >= x.n), top: d.top.length, of: d.of,
      trails: realTrails().length, bins: bins.length && bins.every((b) => b.length === HEAT_BINS), heatSum: bins.reduce((a, b) => a + b.reduce((x, y) => x + y, 0), 0),
      tab: !!document.querySelector('#rpBody [data-rptab=trails]'), page: document.querySelector('#rpBody [data-page=trails]')?.textContent || '',
      heatBtn: !!document.querySelector('#rpBody [data-rp=heat]') }; })()`);
  eq(day.phase, 'report', 'the day ends in a report');
  eq(day.total, day.sum, 'the report counts every run, glades included');
  assert(day.sorted && day.top >= 2 && day.of === day.trails + 1, `top trails are in order and the glade counts: ${JSON.stringify(day)}`);
  assert(day.bins && day.heatSum > 100, `where skiers were is sampled all day: ${JSON.stringify(day)}`);
  assert(day.tab && /Most skied/.test(day.page) && day.heatBtn, 'the report has a Trails page with a map button');
  // the summary view links to it
  const short = await g.ev(`(() => { localStorage.setItem('mm.rpView', 'short'); showReport(); const more = document.querySelector('#rpBody [data-rpgo=trails]'); more.click();
    return { more: !!more, full: rpView(), shown: !document.querySelector('#rpBody [data-page=trails]').hidden }; })()`);
  eq(short, { more: true, full: 'full', shown: true }, 'Busiest trails › opens the Trails page');
  // See it on the map: the next morning's planning with the whole-day traffic on
  const map = await g.ev(`(() => { document.querySelector('#rpBody [data-rp=heat]').click();
    const t = realTrails().map((t) => [t, (state.dayUse.heat[t.id] || []).reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1])[0][0];
    const col = t.mesh.geometry.attributes.color.array, painted = Array.from(col).some((v, i) => i % 4 !== 3 && Math.abs(v - t.baseCol[i]) > 0.05);
    const keep = Array.from(t.baseCol);
    setTraffic(false); const back = Array.from(t.mesh.geometry.attributes.color.array).every((v, i) => v === keep[i]);
    cycleTraffic(); const mode1 = overlay.traffic; cycleTraffic(); const mode2 = overlay.traffic;
    return { phase: state.phase, sort: listView.trails.sort, painted, back, mode1, mode2 }; })()`);
  eq(map, { phase: 'closed', sort: 'popular', painted: true, back: true, mode1: 'day', mode2: false }, 'the whole-day map paints trails and puts them back');
  // Trails list: Popular order, glade rows and batch buttons
  const list = await g.ev(`(() => { openManage('trails'); listView.trails.filter = 'all'; listView.trails.sort = 'popular'; renderSheet();
    const rows = [...document.querySelectorAll('.llist .lrow')].map((li) => ({ k: li.dataset.k, id: +li.dataset.id, txt: li.textContent }));
    const runs = rows.map((r) => r.k === 'glade' ? itemRuns(runItems().find((it) => it.kind === 'glade'), state.dayUse.runs) : (state.dayUse.runs[r.id] || 0) * AGENT);
    return { n: rows.length, glade: rows.some((r) => r.k === 'glade'), order: runs.every((n, i) => !i || runs[i - 1] >= n), last: rows.every((r) => /runs last day/.test(r.txt)),
      tab: !!document.querySelector('[data-action=listFilter][data-v=glades]') }; })()`);
  assert(list.n === day.of && list.glade && list.order && list.last && list.tab, `trails list: ${JSON.stringify(list)}`);
  const batch = await g.ev(`(() => { const [a, c] = realTrails(); const A = world.areas.find(isGlade), gl = world.trails.find((t) => t.glade === A.id);
    a.surface = 'icy'; gl.surface = 'thin'; c.open = false; renderSheet();
    const btn = document.querySelector('[data-action=bulkOpen][data-v=bad]'), label = btn && btn.textContent; btn.click();
    const closed = [!a.open, A.closed, !!a.snowClosed, !!A.snowClosed, !c.snowClosed];
    const undoable = undoStack.length;
    a.surface = 'groomed'; for (const t of world.trails.filter((t) => t.glade === A.id)) t.surface = 'powder'; renderSheet();
    const re = document.querySelector('[data-action=bulkOpen][data-v=good]'), reLabel = re && re.textContent; re.click();
    const after = [a.open, !A.closed, !a.snowClosed, c.open];
    // Close all, then Undo puts it back
    document.querySelector('[data-action=bulkOpen][data-v=close]').click(); const allShut = runItems().every((it) => !itemOpen(it));
    undoLast(); const restored = realTrails().filter((t) => t.open).length;
    return { label, closed, undoable: undoable > 0, reLabel, after, allShut, restored, total: realTrails().length }; })()`);
  eq(batch.label, 'Close icy and thin (2)', 'the button counts the icy trail and the thin glade');
  eq(batch.closed, [true, true, true, true, true], 'icy and thin ones close, marked as closed for snow; one closed by hand is not marked');
  eq(batch.reLabel, 'Reopen good ones (2)', 'reopen counts only those closed for snow');
  eq(batch.after, [true, true, true, false], 'they reopen; a trail closed by hand stays closed');
  assert(batch.undoable && batch.allShut && batch.restored === batch.total - 1, `close all and undo: ${JSON.stringify(batch)}`);
  // saves keep the last day's use and the snow marks; a save without them loads too
  const save = await g.ev(`(() => { const t = realTrails()[0]; t.open = false; t.snowClosed = true;
    const sv = JSON.parse(JSON.stringify(saveData(false))); applySave(sv); afterLoad();
    const ok = [!!state.dayUse && Object.keys(state.dayUse.heat).length > 0, realTrails()[0].snowClosed === true];
    delete sv.clock.dayUse; for (const o of sv.world.trails) delete o.snowClosed; applySave(sv); afterLoad();
    openManage('trails'); listView.trails.sort = 'popular'; renderSheet(); setTraffic('day');
    return { ok, old: [state.dayUse, realTrails().every((t) => !t.snowClosed), document.querySelectorAll('.llist .lrow').length > 0] }; })()`);
  eq(save, { ok: [true, true], old: [null, true, true] }, 'saves round-trip; old saves load with no traffic history');
  // phone: the list and the report page fit
  await g.page.setViewportSize({ width: 390, height: 844 });
  const phone = await g.ev(`(() => { openManage('trails'); renderSheet(); const sh = document.querySelector('#sheet') || document.body;
    return document.documentElement.scrollWidth <= 390; })()`);
  eq(phone, true, 'no sideways scroll on a phone');
  eq(g.errors, [], 'no page errors');
}
