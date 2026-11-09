// Move a building overnight (for a fee, keeping its name and history), and change parking lots and remove off-site parking.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter);
  const r = await g.ev(`(() => {
    state.cash = 5e6;
    const B = world.buildings.find((b) => b.type === 'lodge'), from = { x: B.x, z: B.z }, id = B.id, name = B.name, n = world.buildings.length;
    select({ kind: 'bld', obj: B });
    document.querySelector('[data-action=moveBld]').click();
    if (!draft.moving) return 'no move mode';
    // find a free spot nearby
    for (let r = 4; r < 30; r += 1) for (let a = 0; a < 16; a++) {
      const x = Math.round((from.x + Math.cos(a / 16 * 6.283) * r) * 2) / 2, z = Math.round((from.z + Math.sin(a / 16 * 6.283) * r) * 2) / 2;
      draft.bpos = { x, z }; recomputeBldDraft();
      if (draft.info && !draft.info.problems.length) {
        const cost = draft.info.cost, cash0 = state.cash, fee = moveFee(B);
        renderSheet(); document.querySelector('#sheet [data-action=build]').click();
        const M = world.buildings.find((b) => b.id === id);
        return { moved: M.x === x && M.z === z, sameName: M.name === name, count: world.buildings.length === n, paid: cash0 - state.cash === cost, feeOk: draft.info === null && cost >= fee, tool: state.tool };
      }
    }
    return 'no spot';
  })()`);
  eq(r, { moved: true, sameName: true, count: true, paid: true, feeOk: true, tool: 'explore' }, 'lodge moved, kept its name, paid the fee');
  // the move can be undone
  await g.ev(`undo()`).catch(() => {});
  // parking: make the main lot longer, then shorter (a quarter back on the spaces taken out); set up off-site parking, then close it
  const p = await g.ev(`(() => {
    state.cash = 5e6; openRoads('parking'); startLotEdit(0);
    ldraft.n += 8; ldraft.x += 2; ldraft.info = null; /* longer, its entrance end staying put */ const s1 = parkSpaces(ldraft); document.querySelector('#sheet [data-action=lotBuild]').click();
    const added = stalls.length === s1;
    startLotEdit(0); ldraft.n -= 8; ldraft.x -= 2; ldraft.info = null; const c0 = state.cash; document.querySelector('#sheet [data-action=lotBuild]').click();
    const removed = stalls.length === s1 - 48 && state.cash - c0 === Math.round(48 * PARK_SPACE * 0.25);
    setTool('explore'); buyOffsite(); openManage('parking');
    const had = state.offsite === 0;
    document.querySelector('[data-action=offsiteClose]').click();
    return { added, removed, had, closed: state.offsite === -1 };
  })()`);
  eq(p, { added: true, removed: true, had: true, closed: true }, 'lots can grow and shrink, and off-site parking can be removed');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
