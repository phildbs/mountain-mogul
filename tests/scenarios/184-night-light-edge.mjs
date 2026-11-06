// The night light map on a match map (Phil, Nov 6): it covered only your own square, so the ground past it, your
// rivals' valleys, took the map's edge, smeared into long bright stripes, and their own lights fell off it. Now it
// covers all the drawn ground at the same detail, and ground outside it is never lit by it.
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url, { query: '?matchMap=ridge@0', mountain: 'fresh' });
  const r = await g.ev(`(() => {
    const b = MM_LIGHT.box.value, covers = b.x <= -HALF - FAR_X + 0.01 && b.x + b.z >= HALF + FAR_X - 0.01 && b.y <= -HALF - FAR_Z + 0.01 && b.y + b.w >= HALF + FAR_Z - 0.01;
    const detail = LM_K >= Math.min(1024 / (2 * HALF), 4096 / (2 * Math.max(LM_X, LM_Z))) - 1e-9;
    // a lit rival lamp far past your own square lands on the map
    // (a fire pit always glows; drawn the way a rival's lights are, at a spot on the map)
    const far = { x: HALF + FAR_X * 0.6, z: 10 }, pit = { type: 'firepit', x: far.x, z: far.z };
    world.buildings.push(pit); try { drawLightMap(); } finally { world.buildings.pop(); }
    const px = (p) => Array.from(lmCtx.getImageData(Math.round((p.x + LM_X) * LM_K), Math.round((p.z + LM_Z) * LM_K), 1, 1).data).slice(0, 3);
    let src = ''; const m = new THREE.MeshLambertMaterial(); nightLit(m); const sh = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );' }; m.onBeforeCompile(sh, null); src = sh.fragmentShader;
    return { covers, detail, size: [lmCanvas.width, lmCanvas.height], lamp: px(far), dark: px({ x: far.x + 30, z: 10 }), masked: /step\\(abs/.test(src) };
  })()`);
  eq([r.covers, r.detail], [true, true], `the light map covers all the ground, rivals’ valleys too (${r.size})`);
  assert(r.lamp[0] > 100 && r.dark[0] < 10, `a light far along the ridge lights its own spot, and only there (${r.lamp} / ${r.dark})`);
  eq(r.masked, true, 'ground outside the map takes no light from it');
  eq(g.errors, [], 'no page errors');
  await g.page.close();
}
