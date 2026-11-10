// The title screen fits on desktops and tablets: only your mountains scroll, the one you'll play (and New mountain)
// is always whole, and the sign-in card sits in the right-hand column. Phones keep one scrolling column.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 1440, height: 900 });
  await g.ev(SETUPS.juniperStarter); await g.ev(`saveNow()`);
  for (let k = 0; k < 3; k++) { // more mountains than fit
    await g.click('[data-slot=new]'); await g.wait(150);
    await g.click('[data-slot=pick][data-mt=maple]'); await g.wait(500);
    await g.ev(`saveNow(); $('mTitle').onclick()`); await g.wait(400);
  }
  const look = () => g.ev(`(() => {
    const T = $('title'), S = $('titleSlots'), r = (el) => el.getBoundingClientRect(), s = r(S);
    const go = S.querySelector('.scard.on .btn'), nw = S.querySelector('[data-slot=new]');
    const inside = (el) => { const b = r(el); return b.top >= s.top - 1 && b.bottom <= s.bottom + 1; };
    return { fits: T.scrollHeight <= T.clientHeight + 1, listScrolls: S.scrollHeight > S.clientHeight + 4, go: inside(go), nw: inside(nw),
      acctRight: !!$('titleAcct').closest('.tside'), footer: r(document.querySelector('.tfoot')).bottom <= innerHeight + 1 };
  })()`);
  for (const [w, h] of [[1440, 900], [1280, 720], [1024, 768], [820, 1180]]) {
    await g.page.setViewportSize({ width: w, height: h }); await g.wait(300);
    const L = await look();
    eq([L.fits, L.go, L.nw, L.acctRight, L.footer], [true, true, true, true, true], `${w}×${h}: everything in view, your mountain's Continue and New mountain whole, sign-in on the right`);
    if (w === 1280) assert(L.listScrolls, 'with 4 mountains on a laptop, the list scrolls on its own');
  }
  // the list scrolls, New mountain stays in reach
  await g.ev(`$('titleSlots').scrollTop = 9999`); await g.wait(100);
  eq((await look()).nw, true, 'New mountain still in view at the end of the list');
  // phones: one column, the sign-in card back under your mountains
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(300);
  eq(await g.ev(`[!!$('titleAcct').closest('.tside'), $('titleSlots').style.minHeight, $('title').scrollHeight > $('title').clientHeight]`), [false, '', true], 'a phone: sign-in back in the column, which scrolls as before');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
