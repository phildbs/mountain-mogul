// Restroom fees (4.8, Adum888's idea): restrooms and heated restrooms are free unless you set a price, on their card
// or under Prices. Paying stings a little (less for a heated one); at a high price some guests hold on for a free
// one at a lodge. Fees show as their own line on the day report. Old saves stay free.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter); await g.ev('state.cash = 2e7');

  const a = await g.ev(`(() => { const L = world.lifts[0]; let R = null, H = null;
    for (let dz = -14; dz <= 14 && !(R && H); dz += 2) for (let dx = -16; dx <= 16 && !(R && H); dx += 2) { const x = L.a.x + dx, z = L.a.z + dz;
      if (!R) { const e = evalBuilding('restroom', x, z, 0); if (!e.problems.length) { R = commitBuilding(e, 'restroom', x, z, 0); continue; } }
      if (!H) { const e = evalBuilding('hrest', x, z, 0); if (!e.problems.length) H = commitBuilding(e, 'hrest', x, z, 0); } }
    if (!R || !H) return 'not built';
    select({ kind: 'bld', obj: R }); const card = $('sheet').innerText; openManage('prices'); const prices = $('sheet').innerHTML;
    return { free: [state.prices.restroom, state.prices.hrest, rrPrice(R), rrPrice(H)], stepper: /Restroom price/i.test(card) && /normal free/i.test(card), panel: /Heated restroom price/.test(prices),
      lodgeFree: rrPrice(world.buildings.find((B) => B.type === 'lodge')), R: R.id, H: H.id }; })()`);
  assert(typeof a === 'object', `restrooms built (${a})`);
  eq([a.free, a.stepper, a.panel, a.lodgeFree], [[0, 0, 0, 0], true, true, 0], 'free to start; a price on its card and under Prices; a lodge’s restrooms stay free');

  // A day where everyone needs the restroom: at $2 most pay; at $5 a lot more hold on for the lodge.
  const day = (price) => `(() => { state.prices.restroom = ${price}; state.prices.hrest = ${price}; const R = bldById(${a.R}), H = bldById(${a.H});
    openDay(); state.speed = 0; let n = 0, said = 0; const real = thought; thought = (x, t) => { if (/to use the restroom/.test(t)) said++; real(x, t); };
    while (state.phase === 'open' && n++ < 200000) { simStep(1.5); if (n % 40 === 0) for (const x of guests) if (x.st === 'ski' && Math.random() < 0.05) x.bl = 1; }
    thought = real; const r = state.lastReport, pay = (r.rev.restrooms || 0);
    const txt = (() => { showReport(r); return $('rpBody') ? $('rpBody').textContent : ''; })();
    if (state.phase === 'report') nextDay();
    return { pay, said, paid: pay / ${price}, refuse: said / Math.max(1, said + pay / ${price}), rr: (R.yday && R.yday.visits || 0) + (H.yday && H.yday.visits || 0), line: /Restroom fees/.test(txt) }; })()`;
  const cheap = await g.ev(day(2)), dear = await g.ev(day(5));
  assert(cheap.pay > 0 && cheap.line, `at $2 the fees come in and show on the report (${JSON.stringify(cheap)})`);
  assert(dear.refuse > cheap.refuse + 0.1 && cheap.refuse < 0.4, `at $5 a bigger share won’t pay (${cheap.refuse.toFixed(2)} → ${dear.refuse.toFixed(2)})`);
  assert(dear.paid < cheap.paid, `and fewer pay at all: more go to the lodge (${cheap.paid} → ${dear.paid})`);

  // An old save's prices (no restroom keys) load as free.
  const old = await g.ev(`(() => { const sv = JSON.parse(JSON.stringify(saveData(false))); delete sv.clock.prices.restroom; delete sv.clock.prices.hrest; applySave(sv); return [state.prices.restroom, state.prices.hrest]; })()`);
  eq(old, [0, 0], 'older saves: restrooms free');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
