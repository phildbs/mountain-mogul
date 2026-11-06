// Two fixes from Snowy (Nov 5). (1) A hotel with a trail running past its door is ski-in, ski-out, as a condo is;
// it used to need the trail to end there. (2) Removing a parking section asks first, and a tap on Remove right as
// the box opens (the second tap of a quick double tap) is ignored. The match server presses Remove with no ask.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  // A door beside the middle of a trail, well away from any base lift and the trail's end.
  const spot = await g.ev(`(() => {
    for (const t of realTrails()) { const S = t.samples, e = S[S.length - 1];
      for (let i = 4; i < S.length - 4; i++) { const p = S[i], door = { x: p.x + trailHW(t) + 2, z: p.z };
        if (distXZ(door, e) < SKI_IN_R + 2 || world.lifts.some((L) => distXZ(L.a, door) < SKI_IN_R + 2)) continue;
        if (realTrails().some((o) => o !== t && o.samples.some((q) => distXZ(q, door) < trailHW(o) + CONDO_REACH))) continue;
        return { ski: skiInOut({ door }), far: skiInOut({ door: { x: door.x + 40, z: door.z } }) }; } }
    return null; })()`);
  assert(spot, 'found a spot beside the middle of a trail');
  eq([spot.ski, spot.far], [true, false], 'a door beside a trail running past is ski-in, ski-out; 400 m away it isn’t');

  // Parking: two sections, then Remove asks first.
  await g.ev(`(() => { state.cash = 1e6; growLot(0, 0); growLot(0, 0); select({ kind: 'manage', obj: 'parking' }); })()`);
  const n0 = await g.ev(`state.lotSections`);
  assert(n0 >= 3, `three sections (${n0})`);
  const ask = await g.ev(`(() => { sheetAct({ dataset: { action: 'shrinkLotAsk' }, disabled: false }); const d = document.createElement('div'); d.innerHTML = parkingPanel();
    const box = d.querySelector('.confirm-box'); sheetAct({ dataset: { action: 'shrinkLot' }, disabled: false }); // the second tap of a double tap
    return { box: !!box && /Remove the newest parking section/.test(box.textContent), btn: !!(box && box.querySelector('[data-action=shrinkLot]')), n: state.lotSections }; })()`);
  eq([ask.box, ask.btn, ask.n], [true, true, n0], 'Remove a section opens a confirm box, and a tap straight away removes nothing');
  await g.wait(650);
  eq(await g.ev(`(() => { sheetAct({ dataset: { action: 'shrinkLot' }, disabled: false }); return [state.lotSections, lotAsk]; })()`), [n0 - 1, 0], 'Remove in the box removes one section');
  eq(await g.ev(`(() => { sheetAct({ dataset: { action: 'shrinkLotAsk' }, disabled: false }); sheetAct({ dataset: { action: 'shrinkLotNo' }, disabled: false }); return [state.lotSections, lotAsk]; })()`), [n0 - 1, 0], 'Keep it keeps it');
  // The match server presses Remove itself, with no ask.
  eq(await g.ev(`(() => { sheetAct({ dataset: { action: 'shrinkLot' }, disabled: false }); return state.lotSections; })()`), n0 - 2, 'pressed with no ask (the match server), it removes');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
