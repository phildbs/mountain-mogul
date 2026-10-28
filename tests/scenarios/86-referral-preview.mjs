import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const width of [1280, 390]) {
    const g = await openGame(browser, url, { query: '?referralPreview=1', width, height: 844 });
    const tap = async (selector) => {
      try { await g.page.locator(selector).click({ timeout: 5000 }); }
      catch (error) {
        const hit = await g.page.locator(selector).evaluate((el) => { const b = el.getBoundingClientRect(); return { box: b.toJSON(), hit: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.outerHTML.slice(0, 400) }; });
        throw new Error(selector + ' click: ' + JSON.stringify(hit) + ' ' + error.message.replace(/\n/g, ' '));
      }
    };
    eq(await g.ev(`[REFERRAL_PREVIEW, CLOUD.ready, !!CLOUD.sb, $('referralBox').hidden]`), [true, false, false, false], 'preview starts without an online session');
    assert(await g.page.getByRole('heading', { name: 'Your mountain is worth sharing' }).isVisible(), 'invitation prompt opens');
    await g.page.locator('.ref-photo img').evaluate(img => img.decode());
    const photo = await g.page.locator('.ref-photo img').evaluate(img => {
      const c = document.createElement('canvas'); c.width = 48; c.height = 24;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 1200, 540, 0, 0, 48, 24);
      const px = ctx.getImageData(0, 0, 48, 24).data, colors = new Set();
      for (let i = 0; i < px.length; i += 4) colors.add(`${px[i]},${px[i+1]},${px[i+2]}`);
      return [img.naturalWidth, img.naturalHeight, colors.size > 20];
    });
    eq(photo, [1200, 630, true], 'share image includes a real rendered mountain, not just the footer or empty canvas');
    const firstPhoto = await g.ev('refPhoto');
    await tap('[data-ref=photo]');
    assert(await g.page.getByRole('button', { name: 'Use this view for my photo' }).isVisible(), 'player can choose the camera view');
    await g.ev('cam.az += 0.5; cam.azGoal = cam.az; updateCamera();');
    await tap('#refPreviewOpen');
    assert(await g.ev('refPhoto') !== firstPhoto, 'new camera angle produces a new photograph');
    eq(await g.ev('renderer.getRenderTarget()'), null, 'snapshot restores the screen render target');
    const download = g.page.waitForEvent('download');
    await tap('[data-ref=download]');
    assert((await download).suggestedFilename().endsWith('-mountain.jpg'), 'mountain photo can be saved for sharing');
    await tap('[data-ref=progress]');
    assert(await g.page.getByText('No friends yet.', { exact: false }).isVisible(), 'new invitation state');
    await g.page.locator('#refPreviewState').selectOption('progress');
    assert(await g.page.getByText('One more real day of play to qualify.').isVisible(), 'operating days alone do not qualify');
    eq(await g.page.locator('[data-ref=claim]').count(), 0, 'no premature reward button');
    const cash = await g.ev('state.cash');
    await g.page.locator('#refPreviewState').selectOption('ready');
    await tap('[data-ref=claim]');
    eq(await g.ev('state.cash'), cash, 'sample claim never changes real resort cash');
    assert(await g.page.getByText('$100,000 received', { exact: true }).isVisible(), 'sample claim shows received');
    eq(await g.page.locator('[data-ref=claim]').count(), 0, 'sample claim cannot be repeated');
    await g.page.locator('#refPreviewState').selectOption('complete');
    assert(await g.page.getByText('Special decoration earned', { exact: true }).isVisible(), 'third friend unlocks future decoration milestone');
    eq(await g.ev('refDemo.claimed * 100000'), 300000, 'lifetime total capped at three rewards');
    const layout = await g.page.evaluate(() => {
      const modal = document.querySelector('#referralBox .modal').getBoundingClientRect();
      const dock = document.querySelector('#refPreviewDock').getBoundingClientRect();
      const body = document.querySelector('#refBody').getBoundingClientRect();
      return modal.left >= 0 && modal.right <= innerWidth && modal.top >= 0 && modal.bottom <= innerHeight && dock.top >= body.bottom;
    });
    assert(layout, `dialog and sample controls fit at ${width}px`);
    eq(await g.ev(`(() => { localStorage.setItem(SLOTS_KEY, 'sentinel'); localStorage.setItem(SAVE_KEY, 'old-save'); saveNow(); writeSlots(); readSlots(); clearSave(); return [localStorage.getItem(SLOTS_KEY), localStorage.getItem(SAVE_KEY)]; })()`), ['sentinel', 'old-save'], 'preview does not overwrite or migrate saves');
    await tap('.x[data-ref=close]');
    assert(await g.page.locator('#refPreviewOpen').isVisible(), 'preview can be reopened');
    await tap('#refPreviewOpen');
    assert(await g.page.locator('#referralBox').isVisible(), 'preview reopens');
    await tap('.x[data-ref=close]');
    eq(await g.ev('state.referralPromptSeason'), 1, 'automatic prompt records the game season');
    await g.ev('maybeReferralPrompt()');
    eq(await g.ev("$('referralBox').hidden"), true, 'dismissed prompt stays closed this season');
    eq(await g.ev('saveData(false).clock.referralPromptSeason'), 1, 'prompt marker is included in resort saves');
    eq(await g.ev(`(() => { const day = state.day; const result = [18,19,61,89,90].map(n => { state.day = n; return referralWindow(); }); state.day = day; return result; })()`), [false,true,true,true,false], 'window runs from Dec 20 through end of February');
    await g.ev("state.season = 2; state.day = 19; maybeReferralPrompt()");
    eq(await g.ev("[state.referralPromptSeason, $('referralBox').hidden]"), [2,false], 'new season can show the prompt again');
    await tap('.x[data-ref=close]');
    await g.ev('state.day = 110;');
    await tap('#badge');
    await tap('#mInvite');
    assert(await g.page.locator('#referralBox').isVisible(), 'dropdown opens invitations outside winter prompt window');
    eq(g.errors, [], 'no browser errors');
    await g.page.close();
  }
  const normal = await openGame(browser, url);
  eq(await normal.ev(`[REFERRAL_PREVIEW, $('refPreviewOpen').hidden, $('referralBox').hidden]`), [false, true, true], 'normal game has no sample referral UI');
  await normal.page.close();
}
