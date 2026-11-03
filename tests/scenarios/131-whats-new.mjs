// What's new: folded by day for the last week and by week before, newest group and update open, fixes folded together,
// and King of the Mountain-only changes in their own folded section at the end, never headlining.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { width: 390, height: 844 });
  eq(await g.ev(`new Date(wnWeekOf('Nov 1, 2026') * 86400000).toISOString().slice(0, 10)`), '2026-10-26', 'a Sunday belongs to the week starting Monday');
  eq(await g.ev(`wnWeekOf('Oct 26, 2026') === wnWeekOf('Nov 1, 2026') && wnWeekOf('Oct 25, 2026') !== wnWeekOf('Oct 26, 2026')`), true, 'weeks run Monday to Sunday');
  const n = await g.ev(`wnDayOf('Nov 1, 2026')`);
  eq(await g.ev(`[wnGroupOf('Oct 26, 2026', ${n}), wnGroupOf('Oct 25, 2026', ${n})].map((k) => wnGroupLabel(k))`), ['Mon, Oct 26', 'Week of Oct 19'], 'last 7 days by day, older by week');
  await g.ev(`openWhatsNew()`); await g.wait(200);
  const r = await g.ev(`(() => { const L = $('wnList'), weeks = [...L.querySelectorAll('.wn-week:not(.wn-kotm)')], k = L.querySelector('.wn-kotm');
    return { weeks: weeks.length, want: new Set(GENERAL.map((c) => wnGroupOf(c.date, wnDayOf(GENERAL[0].date)))).size,
      kotm: k ? [k.open, k.querySelectorAll('.wn-small').length, KOTM_CHANGES.length, L.lastElementChild.previousElementSibling === k, /King of the Mountain: |in King of the Mountain, /.test(k.textContent)] : null,
      leaks: [...L.querySelectorAll('.wn-week:not(.wn-kotm) summary')].some((x) => KOTM_CHANGES.some((c) => x.textContent.includes(c.title))),
      open: weeks.map((w) => w.open), firstOpen: [...L.querySelectorAll('.wn-up:not(.wn-fixes)')].map((d) => d.open).indexOf(true),
      shownOpen: [...L.querySelectorAll('.wn-up:not(.wn-fixes)')].filter((d) => d.open).length,
      ups: L.querySelectorAll('.wn-up:not(.wn-fixes)').length, fixes: L.querySelectorAll('.wn-week:not(.wn-kotm) .wn-small').length,
      bigs: GENERAL.filter((c) => !c.small).length, smalls: GENERAL.filter((c) => c.small).length,
      top: L.querySelector('.wn-up summary').textContent, firstTitle: latestBig().title,
      height: L.scrollHeight, foldsPerWeek: weeks.every((w) => w.querySelectorAll(':scope > div > .wn-fixes').length <= 1) }; })()`);
  eq(r.weeks, r.want, 'one fold per group');
  eq(r.open, r.open.map((_, i) => i === 0), 'only the newest group is open');
  eq([r.firstOpen, r.shownOpen], [0, 1], 'only the newest update is open');
  eq([r.ups, r.fixes], [r.bigs, r.smalls], 'every update and fix is listed once');
  assert(r.kotm && r.kotm[2] > 0, 'King of the Mountain changes are tagged');
  eq(r.kotm, [false, r.kotm[2], r.kotm[2], true, false], 'they sit in their own closed section at the end, each once, without repeating the mode’s name');
  eq(r.leaks, false, 'and nowhere else');
  assert(!(await g.ev('latestBig().kotm')), 'a match-only change never headlines');
  assert(r.top.startsWith(r.firstTitle), `newest update first: ${r.top}`);
  assert(r.foldsPerWeek, 'one fixes fold per group at most');
  assert(r.height < 1400, `closed groups keep it short (${r.height}px)`);
  // opening an older week shows its titles
  await g.ev(`$('wnList').querySelectorAll('.wn-week')[1].open = true`);
  assert(await g.ev(`$('wnList').querySelectorAll('.wn-week')[1].querySelector('.wn-up summary').offsetHeight > 0`), 'an older group opens to its titles');
  return `${r.weeks} groups, ${r.bigs} updates and ${r.smalls} fixes in ${r.height}px`;
}
