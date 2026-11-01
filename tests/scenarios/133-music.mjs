// Music: off until the player turns it on in the menu; play/pause, next song and volume; remembered on this device,
// starts again with the first tap after a reload, and turns itself off if no song can load.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const width of [1280, 390]) {
    const g = await openGame(browser, url, { width, height: 700 });
    await g.click('#startBtn'); await g.wait(300);
    await g.ev(`state.welcomed=true; $('hint').hidden=true;`);
    eq(await g.ev(`[music.on, !!music.el, $('mMusicV').textContent, $('mMusicBox').hidden]`), [false, false, 'Off', true], 'music starts off and loads nothing');
    await g.page.locator('#badge').click();
    await g.page.locator('#mMusic').click();
    await g.page.waitForFunction(() => window.__dbg('music.el && !music.el.paused && music.el.currentTime > 0.2'), null, { timeout: 15000 });
    eq(await g.ev(`[music.on, $('mMusicV').textContent, $('mMusic').getAttribute('aria-checked'), $('mMusicBox').hidden, $('menu').hidden, JSON.parse(localStorage.getItem('mm.music')).on]`),
      [true, 'On', 'true', false, false, true], 'turning music on plays a song, shows the controls and keeps the menu open');
    assert(await g.ev(`MUSIC.some((t) => music.el.src.endsWith(t.file) && t.title === $('musName').textContent)`), 'the playing song is named');
    const fits = await g.ev(`(() => { const r = $('mMusicBox').getBoundingClientRect(), m = $('menu').getBoundingClientRect(); return r.width > 150 && r.left >= m.left && r.right <= m.right; })()`);
    assert(fits, `the music controls fit the menu at ${width}px`);
    await g.page.locator('#musVol').fill('20');
    eq(await g.ev(`[music.vol, JSON.parse(localStorage.getItem('mm.music')).vol]`), [0.2, 0.2], 'the volume slider sets and remembers the volume');
    const first = await g.ev(`music.el.src`);
    await g.page.locator('#musNext').click(); await g.wait(300);
    assert(await g.ev(`music.el.src`) !== first, 'Next song changes the song');
    await g.page.locator('#musPlay').click(); await g.wait(1000);
    eq(await g.ev(`[music.el.paused, music.held, music.on, $('musPlay').getAttribute('aria-label')]`), [true, true, true, 'Play music'], 'pause stops the song but leaves music on');
    await g.ev(`document.dispatchEvent(new Event('visibilitychange'))`); await g.wait(200);
    assert(await g.ev(`music.el.paused`), 'a song paused by hand stays paused when the tab comes back');
    await g.page.locator('#musPlay').click();
    await g.page.waitForFunction(() => window.__dbg('!music.el.paused'), null, { timeout: 5000 });
    // After a reload: still on, but silent until the first tap.
    await g.ev('saveNow()'); await g.page.reload(); await g.reloaded();
    eq(await g.ev(`[music.on, music.vol, !!music.el, $('mMusicV').textContent]`), [true, 0.2, false, 'On'], 'the choice survives a reload, waiting for a tap');
    await g.page.mouse.click(4, 690); // any tap on the title screen
    await g.page.waitForFunction(() => window.__dbg('music.el && !music.el.paused'), null, { timeout: 15000 });
    await g.click('#startBtn'); await g.wait(300);
    await g.page.locator('#badge').click(); await g.page.locator('#mMusic').click(); await g.wait(1000);
    eq(await g.ev(`[music.on, music.el.paused, $('mMusicBox').hidden, JSON.parse(localStorage.getItem('mm.music')).on]`), [false, true, true, false], 'turning music off fades it out and remembers');
    // Songs that can't load: music turns itself off with a message instead of looping on errors.
    await g.ev(`for (const t of MUSIC) t.file = 'music/missing-' + t.file.split('/').pop(); music.el.src = '';`);
    await g.page.locator('#mMusic').click(); await g.wait(2000);
    eq(await g.ev(`[music.on, $('mMusicV').textContent]`), [false, 'Off'], 'missing songs turn music off');
    assert((await g.ev(`$('toasts') ? $('toasts').textContent : document.body.textContent`)).includes('Music couldn’t load'), 'and say so');
    await g.ev(`localStorage.setItem('mm.music', 'broken')`); await g.page.reload(); await g.reloaded();
    eq(await g.ev(`[music.on, music.vol]`), [false, 0.5], 'a broken stored choice falls back to off');
    eq(g.errors, [], 'no page errors');
    await g.page.close();
  }
}
