// Online saves rewrite the whole resort, so routine uploads (including the end of a day) wait a couple of
// minutes after the last one. Leaving the game or going to the title screen still uploads straight away.
import { openGame, eq, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.ev(`__fakeSwitch('own', 'own@example.com')`); await g.wait(1200);
  await g.click('#startBtn'); await g.wait(1500); await g.ev(`select(null)`);
  await g.ev(SETUPS.juniperStarter);
  await g.ev(`(() => { saveNow(); CLOUD.lastUp = 0; return cloudSave(false); })()`); await g.wait(800);
  // count uploads of the resort from here on
  await g.ev(`(() => {
    window.__ups = 0; const from = CLOUD.sb.from.bind(CLOUD.sb);
    CLOUD.sb.from = (t) => { const b = from(t); if (t === 'mountains') { const up = b.upsert.bind(b); b.upsert = (...a) => { window.__ups++; return up(...a); }; } return b; };
    window.playDay = () => { state.phase = 'closed'; openDay(); state.speed = 0; state.cash += 1000; endDay(); };
  })()`);
  await g.ev(`playDay()`); await g.wait(800);
  eq(await g.ev(`window.__ups`), 0, 'a day ending soon after an upload waits');
  eq(await g.ev(`!!CLOUD.upTimer`), true, 'and an upload is scheduled for later');
  await g.ev(`CLOUD.lastUp = Date.now() - CLOUD_GAP - 1; playDay()`); await g.wait(800);
  eq(await g.ev(`window.__ups`), 1, 'a day ending after the gap uploads straight away');
  await g.ev(`state.cash += 1000; cloudSaveNow()`); await g.wait(800);
  eq(await g.ev(`window.__ups`), 2, 'leaving the game still uploads straight away');
  eq(await g.ev(`CLOUD.error || ''`), '', 'no upload errors');
  eq(g.errors, [], 'no page errors');
}
