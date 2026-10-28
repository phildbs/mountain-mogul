import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const width of [1280, 390]) {
    const g = await openGame(browser, url, { query: '?referralPreview=1', width, height: 844 });
    eq(await g.ev(`[REFERRAL_PREVIEW, CLOUD.ready, !!CLOUD.sb, $('referralBox').hidden]`), [true, false, false, false], 'preview starts without an online session');
    assert(await g.page.getByRole('heading', { name: 'Your mountain is worth sharing' }).isVisible(), 'invitation prompt opens');
    await g.page.locator('[data-ref=progress]').click();
    assert(await g.page.getByText('No friends yet.', { exact: false }).isVisible(), 'new invitation state');
    await g.page.locator('#refPreviewState').selectOption('progress');
    assert(await g.page.getByText('One more real day of play to qualify.').isVisible(), 'operating days alone do not qualify');
    eq(await g.page.locator('[data-ref=claim]').count(), 0, 'no premature reward button');
    const cash = await g.ev('state.cash');
    await g.page.locator('#refPreviewState').selectOption('ready');
    await g.page.locator('[data-ref=claim]').click();
    eq(await g.ev('state.cash'), cash, 'sample claim never changes real resort cash');
    assert(await g.page.getByText('$100,000 received', { exact: true }).isVisible(), 'sample claim shows received');
    eq(await g.page.locator('[data-ref=claim]').count(), 0, 'sample claim cannot be repeated');
    await g.page.locator('#refPreviewState').selectOption('complete');
    assert(await g.page.getByText('Special decoration earned', { exact: true }).isVisible(), 'third friend unlocks future decoration milestone');
    eq(await g.ev('refDemo.claimed * 100000'), 300000, 'lifetime total capped at three rewards');
    const layout = await g.page.evaluate(() => {
      const modal = document.querySelector('#referralBox .modal').getBoundingClientRect();
      const dock = document.querySelector('#refPreviewDock').getBoundingClientRect();
      return modal.left >= 0 && modal.right <= innerWidth && modal.top >= 0 && modal.bottom <= dock.top + 1 && dock.bottom <= innerHeight;
    });
    assert(layout, `dialog and sample controls fit at ${width}px`);
    eq(await g.ev(`(() => { localStorage.setItem(SLOTS_KEY, 'sentinel'); localStorage.setItem(SAVE_KEY, 'old-save'); saveNow(); writeSlots(); readSlots(); clearSave(); return [localStorage.getItem(SLOTS_KEY), localStorage.getItem(SAVE_KEY)]; })()`), ['sentinel', 'old-save'], 'preview does not overwrite or migrate saves');
    await g.page.locator('[data-ref=close]').click();
    assert(await g.page.locator('#refPreviewOpen').isVisible(), 'preview can be reopened');
    await g.page.locator('#refPreviewOpen').click();
    assert(await g.page.locator('#referralBox').isVisible(), 'preview reopens');
    eq(g.errors, [], 'no browser errors');
    await g.page.close();
  }
  const normal = await openGame(browser, url);
  eq(await normal.ev(`[REFERRAL_PREVIEW, $('refPreviewOpen').hidden, $('referralBox').hidden]`), [false, true, true], 'normal game has no sample referral UI');
  await normal.page.close();
}
