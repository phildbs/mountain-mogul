// Seeing the business: a row per open day feeds four season charts in Money; the day report opens
// with why the day went the way it did; and while open, chips on the map point at long lift lines,
// a full lot and slow building lines.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(400);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);

  // three real days
  for (let i = 0; i < 3; i++) {
    await g.ev(`(() => { if (state.phase === 'closed') openDay(); })()`); await g.ev(SETUPS.finishDay);
    if (i < 2) await g.ev(`(() => { $('report').hidden = true; nextDay(); })()`);
  }
  const rows = await g.ev(`seasonDaily()`);
  eq(rows.length, 3, 'one row per open day');
  assert(rows.every((r) => r.g > 0 && typeof r.p === 'number' && r.s > 0 && r.c > 0 && r.t > 0) && rows[0].d < rows[1].d, `rows hold guests, profit, satisfaction, cash and ticket: ${JSON.stringify(rows)}`);
  eq(await g.ev(`saveData(false).clock.seasonStats.daily.length`), 3, 'and they are saved');

  // the report explains the day
  const why = await g.ev(`(document.querySelector('#report .rp-why') || {}).textContent || ''`);
  assert(/^Why today \d[\d,]* guests, /.test(why), `the report opens with why: ${why}`);
  // a made-up day: half again as many guests as the week before, on fresh powder, with a full lot
  const made = await g.ev(`(() => { const st = state.seasonStats, keep = st.daily, last = keep[keep.length - 1];
    st.daily = Array.from({ length: 7 }, (_, i) => ({ d: last.d - 7 + i, g: 100, p: 0, s: 70, c: 0, t: 60 })).concat([{ d: last.d, g: 150, p: 0, s: 70, c: 0, t: 60 }]);
    const r = { ...state.lastReport, day: last.d, guests: 150, wx: { type: 'cloudy', snow: 8, hi: 25 }, event: null, holds: [], trailsOpen: 4, trailsTotal: 4, ops: { hours: 'full' },
      turnedAway: 40, leftLines: 5, refunded: 0, offsite: null, complaints: {}, rev: { passes: 0 }, profit: 1000 };
    const out = whyToday(r); st.daily = keep; return out.replace(/<[^>]+>/g, ''); })()`);
  assert(/^Why today 150 guests, 50% more than your recent average, thanks to an 8″ powder day/.test(made), `credits the powder: ${made}`);
  assert(/Biggest leak: the lot filled and 40 guests were turned away\.$/.test(made), `names the biggest leak: ${made}`);

  // the Money panel charts the season, and hovering reads a day
  await g.ev(`(() => { $('report').hidden = true; nextDay(); openManage('money'); })()`); await g.wait(200);
  eq(await g.ev(`[...document.querySelectorAll('#sheet .schart')].map((f) => f.dataset.k)`), ['g', 'p', 's', 'c'], 'four season charts');
  eq(await g.ev(`document.querySelectorAll('#sheet .schart[data-k=g] rect').length`), 3, 'a bar per day');
  const box = await (await g.page.$('#sheet .schart[data-k=g] svg')).boundingBox();
  await g.page.mouse.move(box.x + 2, box.y + box.height / 2); await g.wait(50);
  eq(await g.ev(`document.querySelector('#sheet .schart[data-k=g] [data-out]').textContent`), rows[0].g.toLocaleString('en-US'), 'hovering the first day reads its guests');

  // chips: a long lift line shows on the map while open, and taps through to the lift
  await g.ev(`(() => { select(null); openDay(); let n = 0; while (state.time < 600 && n < 9999) { simStep(1.5); n++; } })()`);
  const chip = await g.ev(`(() => { const L = world.lifts[0]; for (let i = 0; i < 40; i++) L.queue.push({}); L.incoming = 400; chipAt = -99; updateChips();
    const c = chipList.find((x) => x.key === 'L' + L.id); const el = chipEls.get('L' + L.id); const out = { text: c && c.text, sev: c && c.sev, el: !!el };
    if (el) el.click(); out.sel = !!(selected && selected.obj === L); L.queue.length -= 40; L.incoming = 0; return out; })()`);
  assert(chip.el && /min line$/.test(chip.text) && chip.text.startsWith(await g.ev(`world.lifts[0].name`)), `a lift-line chip: ${JSON.stringify(chip)}`);
  assert(chip.sev === 2 && chip.sel, 'a very long line is the urgent kind, and tapping opens the lift');
  eq(await g.ev(`(() => { setLabelKinds({ chip: false }); updateChips(); const n = chipLayer.children.length; setLabelKinds({ chip: true }); return n; })()`), 0, 'turned off in Map labels');
  await g.ev(SETUPS.finishDay);
  eq(await g.ev(`(() => { updateChips(); return chipLayer.children.length; })()`), 0, 'gone once the day ends');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
