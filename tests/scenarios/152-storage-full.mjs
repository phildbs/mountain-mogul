// A full browser storage (about 5 MB per site) must not trap a player on one mountain. Playing a mountain
// that comes down from online makes room by dropping this device's copies of mountains saved online, and
// when nothing can go, the player stays put and is told why.
import { openGame, eq, assert } from '../harness.mjs';
const fill = (g) => g.page.evaluate(() => { let chunk = 'x'.repeat(256 * 1024), i = 0;
  while (chunk.length > 16) { try { localStorage.setItem('filler' + i++, chunk); } catch (e) { chunk = chunk.slice(0, chunk.length >> 1); } } });
async function setup(browser, url) {
  const g = await openGame(browser, url);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.ev(`newMountain('juniper'); startGame(null); saveNow(); CLOUD.lastUp = 0; cloudSaveNow()`); await g.wait(1500);
  // Two more mountains online: Maple, also kept on this device (a big copy), and Raven, online only.
  await g.ev(`(() => { const d = JSON.parse(localStorage.getItem('FAKE_DB')), r = d.rows.find((x) => x.id === slots.active), now = Date.now();
    const copy = (id, mt, name) => { const sv = JSON.parse(JSON.stringify(r.save)); sv.mt = mt; sv.n = -1;
      d.rows.push({ ...r, id, save: sv, summary: { ...r.summary, mt, name }, updated_at: new Date(now).toISOString() }); return sv; };
    const maple = copy('maple-1', 'maple', 'Maple Copy'); copy('raven-1', 'raven', 'Raven Online');
    localStorage.setItem('FAKE_DB', JSON.stringify(d));
    localStorage.setItem(slotKey('maple-1'), JSON.stringify({ ...maple, pad: 'p'.repeat(1500000) }));
    slots.list.push({ id: 'maple-1', owner: CLOUD.uid, mountain: 'maple', name: 'Maple Copy', when: '', savedAt: now - 1000 }); writeSlots(); })()`);
  await g.ev(`showTitle()`); await g.wait(1500);
  return g;
}
export default async function ({ browser, url }) {
  // 1. Room is made: Maple's copy here goes (it's online), and Raven opens.
  let g = await setup(browser, url);
  await fill(g);
  await g.click('[data-slot="play"][data-id="raven-1"]'); await g.reloaded(); await g.wait(1500);
  eq(await g.ev(`MOUNTAIN.id + '/' + slots.active + '/' + state.started`), 'raven/raven-1/true', 'Raven opens even with storage full');
  eq(await g.ev(`!!localStorage.getItem(slotKey('maple-1')) + '/' + !!slotById('maple-1')`), 'false/false', 'Maple’s copy here made room');
  eq(await g.ev(`slotRows().some((r) => r.id === 'maple-1' && r.online)`), true, 'Maple still listed, from online');
  assert(!g.errors.length, 'no page errors: ' + g.errors[0]);
  await g.page.close();
  // 2. Nothing can go (Maple's copy here is newer than online): stay on Juniper and say why.
  g = await setup(browser, url);
  await g.ev(`slotById('maple-1').savedAt = Date.now() + 3600000; writeSlots()`);
  await fill(g);
  const home = await g.ev(`slots.active`);
  await g.click('[data-slot="play"][data-id="raven-1"]'); await g.wait(1500);
  eq(await g.ev(`MOUNTAIN.id + '/' + (slots.active === ${JSON.stringify(home)}) + '/' + !!slotById('raven-1') + '/' + !!slotById('maple-1')`), 'juniper/true/false/true', 'stays on Juniper, nothing lost');
  assert(/storage for Mountain Mogul is full/.test(await g.ev(`$('toast').textContent`)), 'says storage is full');
  assert(!g.errors.length, 'no page errors: ' + g.errors[0]);
  await g.page.close();
}
