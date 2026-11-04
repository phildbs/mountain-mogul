// Mesh fence (3.0): a decor chain of tapped posts like string lights, with see-through mesh between, a cost per post
// and per length, upkeep per post, a colour picked on its card (saved, remembered for the next fence), blueprints,
// the bulldozer, and match orders that carry the posts and colour (the server builds the same fence).
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
import { pageOrders } from '../../match/market.mjs';
export default async function ({ browser, url }) {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const g = await openGame(browser, url, { width, height, hasTouch: width < 600 });
    await g.click('#startBtn'); await g.wait(300);
    await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
    if (width < 600) { // the phone: the Decor tab offers it and its card fits
      const tab = await g.ev(`(() => { showFeature('decor'); return !!document.querySelector('#sheet [data-action=pickB][data-v=mfence]'); })()`);
      eq(tab, true, 'Mesh fence is in the Decor tab');
      await g.ev(`pickBuilding('mfence')`);
      assert(await g.ev(`$('sheet').scrollWidth <= $('sheet').clientWidth + 1 && /first post/.test($('sheet').textContent)`), 'its placing card fits a phone and asks for the first post');
      await g.ev(`setTool('explore')`); eq(g.errors, [], 'no page errors'); await g.page.close(); continue;
    }
    const placed = await g.ev(`(() => {
      state.cash = 1e7;
      const L = world.buildings.find((b) => b.type === 'lodge');
      for (let r = 3; r < 12; r += 0.5) for (let a = 0; a < 16; a++) {
        const o = { x: L.door.x + Math.cos(a / 16 * 6.283) * r, z: L.door.z + Math.sin(a / 16 * 6.283) * r }, dx = Math.cos(a / 16 * 6.283 + 1.57), dz = Math.sin(a / 16 * 6.283 + 1.57);
        pickBuilding('mfence'); for (const k of [0, 1, 2, 3]) chainTap({ x: o.x + dx * 3 * k, z: o.z + dz * 3 * k });
        if (draft.chain.length !== 4 || draft.info.problems.length) continue;
        const msgs = []; const t0 = toast; toast = (m) => msgs.push(m);
        chainTap({ x: o.x + dx * 20, z: o.z + dz * 20 }); toast = t0;
        const info = draft.info, cash = state.cash; buildBuildingDraft(); setTool('explore');
        const F = world.buildings.find((b) => b.type === 'mfence'), mesh = F.group.children.find((m) => m.material.map === FENCE_TEX);
        return { id: F.id, posts: F.pts.length, far: msgs[0], build: info.build, want: 4 * BTYPES.mfence.cost + Math.round(9 * CHAIN.mfence.perUnit / 50) * 50,
          paid: Math.round(cash - state.cash) === Math.round(info.cost), upkeep: bspec(F).upkeep, transparent: !!(mesh && mesh.material.transparent), shadow: mesh && mesh.castShadow,
          colour: mesh && mesh.material.color.getHex() === FENCE_COLS[0].hex, decor: isDecor(F), doze: DOZE_TYPES.includes('mfence') };
      }
      return null;
    })()`);
    assert(placed, 'a four-post fence fits by the lodge');
    eq({ ...placed, id: 0 }, { id: 0, posts: 4, far: 'Posts can be up to 131 ft apart. Tap a little closer to the last one.', build: placed.want, want: placed.want, paid: true, upkeep: 4, transparent: true, shadow: false, colour: true, decor: true, doze: true },
      'posts tapped one by one make one fence, priced per post and per length, with see-through orange mesh');

    // The card's colour picker: free, saved, and the next fence starts in the same colour.
    await g.ev(`select({ kind: 'bld', obj: bldById(${placed.id}) })`);
    assert(await g.ev(`/Colour · Orange/.test($('sheet').textContent)`), 'the card shows its colour');
    const cash = await g.ev('state.cash');
    await g.click('#sheet [data-action=bulbHue][data-v="1"]');
    eq(await g.ev(`(() => { const F = bldById(${placed.id}); return [F.hue, fencePick, state.cash === ${cash}, F.group.children.some((m) => m.material.map === FENCE_TEX && m.material.color.getHex() === FENCE_COLS[1].hex), /Colour · Blue/.test($('sheet').textContent)]; })()`),
      [1, 1, true, true, true], 'picking blue recolours it for free and remembers the pick');
    await g.ev('saveNow()'); await g.page.reload(); await g.reloaded(); await g.click('#startBtn');
    eq(await g.ev(`(() => { const F = world.buildings.find((b) => b.type === 'mfence'); return [F.pts.length, F.hue, F.group.children.some((m) => m.material.map === FENCE_TEX && m.material.color.getHex() === FENCE_COLS[1].hex)]; })()`),
      [4, 1, true], 'posts and colour survive a reload');

    // A blueprint while open keeps the colour it was planned in; built overnight.
    const plan = await g.ev(`(() => {
      fencePick = 3; state.cash = 1e7;
      const L = world.buildings.find((b) => b.type === 'lodge');
      openDay(); state.speed = 0;
      for (let r = 4; r < 14; r += 0.5) for (let k = 0; k < 16; k++) {
        const o = { x: L.door.x + Math.cos(k / 16 * 6.283) * r, z: L.door.z + Math.sin(k / 16 * 6.283) * r };
        pickBuilding('mfence'); chainTap(o); chainTap({ x: o.x + 2, z: o.z });
        if (!draft.info || draft.info.problems.length) continue;
        buildBuildingDraft(); setTool('explore');
        const p = world.plans.find((q) => q.type === 'mfence'); if (!p) continue;
        while (state.phase === 'open') simStep(1.5);
        nextDay();
        return { hue: p.hue, built: world.buildings.filter((b) => b.type === 'mfence').map((b) => b.hue || 0).sort() };
      }
      return null;
    })()`);
    eq(plan, { hue: 3, built: [1, 3] }, 'a fence blueprint is built overnight in the colour it was planned in');

    // The bulldozer takes away the whole fence.
    eq(await g.ev(`(() => { const F = world.buildings.find((b) => b.type === 'mfence' && b.hue === 1); dozeApply({ kind: 'bld', B: F }); return world.buildings.filter((b) => b.type === 'mfence').length; })()`), 1, 'the bulldozer removes a fence');

    // In a match the build order carries the posts and colour, and the server's order code builds the same fence.
    const order = await g.ev(`(() => {
      const F = world.buildings.find((b) => b.type === 'mfence'), sent = [], mo = matchOrder, mp = matchPlay, mv = matchView;
      const info = evalChain(F.pts.map(([lx, lz]) => ({ x: F.x + lx + 0.5, z: F.z + lz + 0.5 })), 'mfence'); removeBuilding(F);
      matchOrder = (kind, payload) => sent.push({ kind, payload }); matchPlay = { lobby: 'x', slot: 0 }; matchView = { quiet: false, soon: [], pend: new Set() }; fencePick = 2;
      try { commitBuilding(info, 'mfence', info.x, info.z, 0); } finally { matchOrder = mo; matchPlay = mp; matchView = mv; }
      const p = sent[0] && sent[0].payload; removeBuilding(world.buildings.find((b) => b.type === 'mfence'));
      return p && { what: p.what, type: p.type, posts: p.pts.length, hue: p.hue, x: p.x, z: p.z, pts: p.pts };
    })()`);
    eq({ ...order, x: 0, z: 0, pts: 0 }, { what: 'building', type: 'mfence', posts: 2, hue: 2, x: 0, z: 0, pts: 0 }, 'a match build order carries the posts and the colour');
    const server = await g.ev(`(() => { state.cash = 1e7; const out = ${pageOrders([{ kind: 'build', payload: order }])}; const F = world.buildings.find((b) => b.type === 'mfence'); return { out, posts: F && F.pts.length, hue: F && F.hue }; })()`);
    eq({ posts: server.posts, hue: server.hue }, { posts: 2, hue: 2 }, `the server builds the same fence (${JSON.stringify(server.out)})`);

    eq(g.errors, [], 'no page errors');
    await g.page.close();
  }
}
