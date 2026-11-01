// What's new: folded by day for the last week and by week before, newest group and update open, fixes folded together.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  eq(await g.ev(`new Date(wnWeekOf('Nov 1, 2026') * 86400000).toISOString().slice(0, 10)`), '2026-10-26', 'a Sunday belongs to the week starting Monday');
  eq(await g.ev(`wnWeekOf('Oct 26, 2026') === wnWeekOf('Nov 1, 2026') && wnWeekOf('Oct 25, 2026') !== wnWeekOf('Oct 26, 2026')`), true, 'weeks run Monday to Sunday');
  const n = await g.ev(`wnDayOf('Nov 1, 2026')`);
  eq(await g.ev(`[wnGroupOf('Oct 26, 2026', ${n}), wnGroupOf('Oct 25, 2026', ${n})].map((k) => wnGroupLabel(k))`), ['Mon, Oct 26', 'Week of Oct 19'], 'last 7 days by day, older by week');
  await g.ev(`openWhatsNew()`); await g.wait(200);
  const r = await g.ev(`(() => { const L = $('wnList'), weeks = [...L.querySelectorAll('.wn-week')];
    return { weeks: weeks.length, want: new Set(CHANGES.map((c) => wnGroupOf(c.date, wnDayOf(CHANGES[0].date)))).size,
      open: weeks.map((w) => w.open), firstOpen: [...L.querySelectorAll('.wn-up:not(.wn-fixes)')].map((d) => d.open).indexOf(true),
      shownOpen: [...L.querySelectorAll('.wn-up:not(.wn-fixes)')].filter((d) => d.open).length,
      ups: L.querySelectorAll('.wn-up:not(.wn-fixes)').length, fixes: L.querySelectorAll('.wn-small').length,
      bigs: CHANGES.filter((c) => !c.small).length, smalls: CHANGES.filter((c) => c.small).length,
      top: L.querySelector('.wn-up summary').textContent, firstTitle: CHANGES.find((c) => !c.small).title,
      height: L.scrollHeight, foldsPerWeek: weeks.every((w) => w.querySelectorAll(':scope > div > .wn-fixes').length <= 1) }; })()`);
  eq(r.weeks, r.want, 'one fold per group');
  eq(r.open, r.open.map((_, i) => i === 0), 'only the newest group is open');
  eq([r.firstOpen, r.shownOpen], [0, 1], 'only the newest update is open');
  eq([r.ups, r.fixes], [r.bigs, r.smalls], 'every update and fix is listed once');
  assert(r.top.startsWith(r.firstTitle), `newest update first: ${r.top}`);
  assert(r.foldsPerWeek, 'one fixes fold per group at most');
  assert(r.height < 1400, `closed groups keep it short (${r.height}px)`);
  // opening an older week shows its titles
  await g.ev(`$('wnList').querySelectorAll('.wn-week')[1].open = true`);
  assert(await g.ev(`$('wnList').querySelectorAll('.wn-week')[1].querySelector('.wn-up summary').offsetHeight > 0`), 'an older group opens to its titles');
  return `${r.weeks} groups, ${r.bigs} updates and ${r.smalls} fixes in ${r.height}px`;
}
