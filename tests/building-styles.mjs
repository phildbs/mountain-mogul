// Standalone geometry contract checks; uses the game's actual Kit/Three.js without WebGL.
// Run: node tests/building-styles.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), THREE = require('../vendor/three.min.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ctx = new Proxy({ measureText: () => ({ width: 50 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, p) => o[p] || (() => {}) });
const sandbox = vm.createContext({ THREE, console, document: { createElement: () => ({ getContext: () => ctx }) },
  DEV: false, W: 1280, H: 900, window: {}, scene: new THREE.Scene(), VEX: 1, heightAt: (x, z) => 0.02 * x + 0.01 * z,
  cam: { target: new THREE.Vector3() }, updateCamera() {},
  renderer: { shadowMap: {}, capabilities: { getMaxAnisotropy: () => 1 } }, CORD: new THREE.Texture(), STEEL: new THREE.MeshLambertMaterial(),
  mulberry32: () => () => 0.5 });
const data = html.slice(html.indexOf('const BTYPES ='), html.indexOf('const BORDER ='));
const art = html.slice(html.indexOf('function canvasTex('), html.indexOf('/* =====================================================================\n   BUILDINGS: placement'));
vm.runInContext(data + art, sandbox);
const result = vm.runInContext(`(() => {
  const out = [], originalDoor = door, originalSign = sign;
  let doors, signs;
  door = (...args) => { doors.push(args.slice(1, 6)); originalDoor(...args); };
  sign = (...args) => { signs.push(args.slice(1)); originalSign(...args); };
  function capture(fn, tier) {
    doors = []; signs = [];
    const k = fn(tier), bounds = new THREE.Box3();
    for (const [geo] of k.parts) { geo.computeBoundingBox(); bounds.union(geo.boundingBox); }
    const built = k.build();
    return { seats: k.seats, doors, signs, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      finite: k.parts.every(([g]) => Array.from(g.attributes.position.array).every(Number.isFinite)),
      glow: k.parts.some(([, m]) => m === BM.glow), meshes: built.children.length, stack: k.stack.length };
  }
  for (const type of Object.keys(MODELS_MODERN)) for (let tier = 0; tier < (BTYPES[type].tiers?.length || 1); tier++) {
    out.push({ type, tier, spec: BTYPES[type].tiers?.[tier] || BTYPES[type], classic: capture(MODELS[type], tier), modern: capture(MODELS_MODERN[type], tier) });
  }
  return out;
})()`, sandbox);
for (const row of result) {
  const { classic: a, modern: b, type, tier, spec } = JSON.parse(JSON.stringify(row));
  const label = `${type}/${tier}`;
  assert.deepEqual(b.seats, a.seats, `${label}: exact seat positions/yaw/order`);
  assert.deepEqual(b.doors, a.doors, `${label}: exact door calls`);
  assert.deepEqual(b.signs, a.signs, `${label}: same visible sign`);
  assert(b.finite && b.glow && b.stack === 1, `${label}: valid geometry, glow and balanced transforms`);
  for (const [axis, size] of [[0, spec.w], [2, spec.d]]) {
    assert(b.bounds.min[axis] >= Math.min(a.bounds.min[axis], -size / 2) - 0.001, `${label}: no new negative overhang`);
    assert(b.bounds.max[axis] <= Math.max(a.bounds.max[axis], size / 2) + 0.001, `${label}: no new positive overhang`);
  }
  assert(b.meshes <= a.meshes + 3, `${label}: merged, bounded material count`);
  console.log(`PASS ${label}: ${b.seats.length} exact seats; doors/signs, extents, glow, finite geometry (${b.meshes} meshes)`);
}
// Parse every inline script as well, without executing the game or touching online services.
for (const [, attrs, script] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) { if (!attrs.includes('application/ld+json')) new vm.Script(script); }
console.log('PASS inline script syntax');

assert.equal(sandbox.window.previewStyles, undefined, 'preview is not exposed outside dev mode');
assert.throws(() => vm.runInContext('previewStyles()', sandbox), /require/);
sandbox.DEV = true;
const previewResult = vm.runInContext(`(() => {
  const all = previewStyles({ focus: false });
  const first = scene.getObjectByName('__buildingStylesPreview');
  let disposed = 0;
  first.traverse((o) => { if (o.isMesh) o.geometry.addEventListener('dispose', () => disposed++); });
  const one = previewStyles({ types: ['lodge'], tier: 2 });
  const second = scene.getObjectByName('__buildingStylesPreview');
  const result = { count: all.length, one: one.length, fresh: first !== second, removed: first.parent === null, disposed,
    floor: all.every((e, i) => !(i % 2) || e.y === all[i - 1].y), finite: all.every((e) => [e.x, e.y, e.z].every(Number.isFinite)) };
  clearStylePreview(); result.cleared = !scene.getObjectByName('__buildingStylesPreview'); return result;
})()`, sandbox);
assert.equal(previewResult.count, 38, 'all ten classic/modern pairs');
assert.equal(previewResult.one, 2, 'single tier preview');
assert(previewResult.fresh && previewResult.removed && previewResult.disposed > 0 && previewResult.cleared && previewResult.floor && previewResult.finite);
assert.throws(() => vm.runInContext("previewStyles({types:['unknown']})", sandbox), /Unknown/);
assert.throws(() => vm.runInContext("previewStyles({tier:5})", sandbox), /Unknown/);
console.log('PASS dev preview: gated, 20 models, paired floors, replace/cleanup/disposal, invalid input');
if (process.env.STYLE_GEOMETRY) {
  const meshes = vm.runInContext(`(() => {
    const out = [];
    for (const type of Object.keys(MODELS_MODERN)) for (let t = 0; t < (BTYPES[type].tiers?.length || 1); t++) {
      for (const [style, fn] of [['classic', MODELS[type]], ['modern', MODELS_MODERN[type]]]) {
        const k = fn(t); out.push({ type, tier: t, style, parts: k.parts.map(([g,m]) => {
          const n = g.index ? g.toNonIndexed() : g;
          return { p: Array.from(n.attributes.position.array), color: m === BM.log ? 0x8f5a36 : m === BM.stone ? 0x92959d : m.color.getHex(), opacity: m.opacity };
        }) });
      }
    }
    return out;
  })()`, sandbox);
  writeFileSync(process.env.STYLE_GEOMETRY, JSON.stringify(meshes));
}
