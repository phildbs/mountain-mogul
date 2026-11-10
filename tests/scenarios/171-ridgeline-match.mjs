// Ridgeline, the 4-player match map: four valleys side by side below one long ridge. The King of the Mountain
// window shows Crown Peak and Ridgeline side by side (Ridgeline tagged new), and the title card says so. Making a
// match on Ridgeline offers 2 to 4 resorts. Opening a Ridgeline match puts you on your own valley: the ridge is
// slid so it's in front, with your own land for sale, and your rivals drawn in the valleys beside you.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  // Each resort's save comes from its own valley's game (the server does the same: ridge@<slot>).
  const saves = {};
  for (const slot of [0, 2]) {
    const p = await openGame(browser, url, { query: `?matchMap=ridge@${slot}`, mountain: 'fresh' });
    saves[slot] = await p.ev(`(() => { buildStarter(true); return saveData(false); })()`);
    eq([saves[slot].mt, saves[slot].world.lifts.length > 0], [`ridge@${slot}`, true], `a starter resort on valley ${slot + 1}`);
    await p.page.close();
  }
  const g = await openGame(browser, url);
  const at = (min) => new Date(Date.now() + min * 60000).toISOString();
  const match = { lobbies: [{ id: 'RL', name: 'Ridge Cup', map: 'ridge', slots: 4, starts_at: at(-50), days: 168, day_minutes: 15, status: 'running', day: 3, kind: 'custom', created_by: 'u-x' }],
    players: [{ lobby_id: 'RL', slot: 0, user_id: 'u-x', resort_name: 'West Bowl' }, { lobby_id: 'RL', slot: 2, user_id: 'user-B', resort_name: 'Phil Peak' }],
    resorts: [{ lobby_id: 'RL', slot: 0, day: 3, save: saves[0], summary: { name: 'West Bowl', profit: 5000, guests: 400 } }, { lobby_id: 'RL', slot: 2, day: 3, save: saves[2], summary: { name: 'Phil Peak', profit: 4000, guests: 380 } }], orders: [] };
  await g.page.evaluate((mm) => { const d = JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}'); d.match = mm; d.profiles = { 'user-B': { name: 'Phil', public: true } };
    localStorage.setItem('FAKE_DB', JSON.stringify(d)); localStorage.setItem('mm.kotm.intro', '1'); }, match);
  await g.ev(`__fakeSwitch('user-B', 'b@example.com')`); await g.wait(1500);
  await g.click('#mpCard');
  await g.page.waitForSelector('[data-mp=open][data-id=RL]', { timeout: 10000, state: 'attached' });
  const w = await g.page.evaluate(() => {
    const heroes = [...document.querySelectorAll('#mpBody .mp-hero')], r = heroes.map((h) => h.getBoundingClientRect());
    return { names: heroes.map((h) => h.querySelector('b').textContent).slice(0, 2), side: Math.abs(r[0].top - r[1].top) < 2 && r[1].left > r[0].right - 1,
      card: document.querySelector('#mpBody .mp-card').innerText, pic: document.querySelector('#mpBody .mp-card img.mp-pic').getAttribute('src') };
  });
  eq([w.names, w.side], [['Crown Peak', 'Ridgeline'], true], 'the window shows the mountains side by side');
  assert(/Ridgeline · 4 resorts/.test(w.card) && w.pic === 'img/ridgeline.jpg', `a Ridgeline match says so, with its picture (${JSON.stringify(w.card.slice(0, 200))})`);
  // On a phone the two pictures still sit side by side, half each.
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(300);
  const ph = await g.page.evaluate(() => { const r = [...document.querySelectorAll('#mpBody .mp-hero')].map((h) => h.getBoundingClientRect()); const m = document.querySelector('#mpModal .modal');
    return { side: Math.abs(r[0].top - r[1].top) < 2 && Math.abs(r[0].width - r[1].width) < 2, over: m.scrollWidth - m.clientWidth }; });
  eq([ph.side, ph.over <= 1], [true, true], 'on a phone too, with no sideways scrolling');
  await g.page.setViewportSize({ width: 1280, height: 900 }); await g.wait(300);

  // Making a match from Ridgeline's picture: the form starts on Ridgeline with 4 resorts; Crown Peak caps at 3.
  // (Phil already plays in Ridge Cup, made by someone else, so he can make one of his own.)
  await g.page.click('.mp-hero[data-map=ridge]');
  await g.page.waitForSelector('#mpMake');
  const seg = () => g.page.evaluate(() => ({ map: document.querySelector('[data-mk=map][aria-pressed=true]').dataset.v, slots: [...document.querySelectorAll('[data-mk=slots]')].map((b) => b.dataset.v + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join() }));
  eq(await seg(), { map: 'ridge', slots: '2,3,4*' }, 'Ridgeline: 2, 3 or 4 resorts, starting at 4');
  await g.page.click('[data-mk=map][data-v=match]');
  eq(await seg(), { map: 'match', slots: '2,3*' }, 'Crown Peak: 2 or 3');
  await g.page.click('[data-mk=map][data-v=ridge]'); await g.page.click('[data-mk=slots][data-v="3"]');
  await g.page.fill('#mkName', 'Valley Cup'); await g.page.click('#mpMake button[type=submit]');
  await g.page.waitForFunction(() => !document.getElementById('mpMake'), null, { timeout: 10000 });
  const made = await g.page.evaluate(() => JSON.parse(localStorage.getItem('FAKE_DB')).match.lobbies.find((l) => l.name === 'Valley Cup'));
  eq([made.map, made.slots, made.kind], ['ridge', 3, 'custom'], 'a 3-resort match on Ridgeline is made');

  // Going to your resort in Ridge Cup: onto your own valley (the third), with your rival in the first.
  await g.page.evaluate(() => document.querySelector('[data-mp=open][data-id=RL]').click());
  await g.reloaded();
  await g.page.waitForFunction(() => window.__dbg('!!(matchPlay && matchView)'), null, { timeout: 30000 });
  const a = await g.ev(`({ mt: MOUNTAIN.id, name: MOUNTAIN.name, slot: matchPlay.slot, rivals: RIVAL_SKI.slices.map((s) => s.slot), drawn: matchView.drawn, lots: rivalGroup.children.filter((o) => o.material === LOT_MAT).length,
    land: PARCELS.map((p) => p.id).join(), lifts: world.lifts.length, own: inProperty(0, 50), rivalAt: (() => { const s = RIVAL_SKI.slices[0]; return s && s.lifts[0] ? [sliceAt(s.lifts[0].a.x + HALF, s.lifts[0].a.z + HALF), sliceAt(world.lifts[0].a.x + HALF, world.lifts[0].a.z + HALF)] : null; })(),
    tips: getComputedStyle($('tipsBtn')).display })`);
  eq([a.mt, a.name, a.slot, a.rivals, a.land, a.lifts > 0, a.tips], ['ridge@2', 'Ridgeline', 2, [0], 'V0,V1', true, 'none'], 'on your own valley of Ridgeline, with its land for sale and no What next?');
  assert(a.drawn >= 3 && a.lots >= 1, `your rival's lifts, trails, buildings and lot are drawn (${a.drawn}, ${a.lots})`);
  eq(a.rivalAt, [0, 2], 'their lift stands in their own valley, two along the ridge from yours');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
  // From an end valley the furthest rival is three valleys along: the ground past the map reaches that far east and
  // west, so every rival's lifts and base stand on it (Phil: "see all of your rivals on Ridgeline").
  for (const s of [0, 3]) {
    const d = await openGame(browser, url, { query: `?matchDemo=ridge@${s}`, mountain: 'fresh' });
    await d.page.waitForFunction(() => window.__dbg('typeof matchView !== "undefined" && !!matchView && matchView.drawn > 0'), null, { timeout: 60000 });
    const v = await d.ev(`(() => ({ rivals: RIVAL_SKI.slices.map((sl) => sl.slot).sort(), onGround: RIVAL_SKI.slices.map((sl) => sl.lifts.length > 0 && sl.lifts.every((L) => !farOut(L.a, 8) && !farOut(L.b, 8))),
      bases: matchView.resorts.map((r) => { const b = MOUNTAIN.bases[r.slot], x = PLAY0 + b[0] * PN - HALF, z = PLAY1 - b[1] * PN - HALF; return !farOut({ x: x - 40, z }) && !farOut({ x: x + 40, z }); }) }))()`);
    eq(v.rivals, [0, 1, 2, 3].filter((k) => k !== s), `from valley ${s + 1}, the three other valleys have rivals`);
    eq([...v.onGround, ...v.bases], Array(6).fill(true), `from valley ${s + 1}, every rival's lifts and whole valley have ground under them: ${JSON.stringify(v)}`);
    eq(d.errors, [], 'no page errors');
    await d.page.close();
  }
}
