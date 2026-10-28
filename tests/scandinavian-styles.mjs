// Geometry and gameplay contract for every Scandinavian building and lodge size.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), THREE = require('../vendor/three.min.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ctx = new Proxy({ measureText: () => ({ width: 50 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, p) => o[p] || (() => {}) });
const sandbox = vm.createContext({ THREE, console, document: { createElement: () => ({ getContext: () => ctx }) },
  DEV: false, W: 1280, H: 900, window: {}, scene: new THREE.Scene(), VEX: 1, heightAt: () => 0,
  cam: { target: new THREE.Vector3() }, updateCamera() {}, renderer: { shadowMap: {}, capabilities: { getMaxAnisotropy: () => 1 } },
  CORD: new THREE.Texture(), STEEL: new THREE.MeshLambertMaterial(), mulberry32: () => () => 0.5 });
vm.runInContext(html.slice(html.indexOf('const BTYPES ='), html.indexOf('const BORDER =')) +
  html.slice(html.indexOf('function canvasTex('), html.indexOf('/* =====================================================================\n   BUILDINGS: placement')), sandbox);
const rows = vm.runInContext(`(() => {
  const out = [], oldDoor = door, oldSign = sign;
  let doors, signs;
  door = (...a) => { doors.push(a.slice(1, 6)); oldDoor(...a); };
  sign = (...a) => { signs.push(a.slice(1)); oldSign(...a); };
  function capture(fn, tier) {
    doors = []; signs = [];
    const k = fn(tier), box = new THREE.Box3();
    for (const [geo] of k.parts) { geo.computeBoundingBox(); box.union(geo.boundingBox); }
    return { seats: k.seats, doors, signs, min: box.min.toArray(), max: box.max.toArray(),
      valid: k.stack.length === 1 && k.parts.every(([geo]) => Array.from(geo.attributes.position.array).every(Number.isFinite)),
      meshes: k.build().children.length };
  }
  for (const type of Object.keys(MODELS_SCANDINAVIAN)) for (let tier = 0; tier < (BTYPES[type].tiers?.length || 1); tier++)
    out.push({ type, tier, spec: BTYPES[type].tiers?.[tier] || BTYPES[type], old: capture(MODELS[type], tier), themed: capture(MODELS_SCANDINAVIAN[type], tier) });
  return out;
})()`, sandbox);
assert.equal(rows.length, 19, 'all 17 types and three lodge sizes');
for (const row of rows) {
  const { type, tier, spec, old: a, themed: b } = JSON.parse(JSON.stringify(row)), label = `${type}/${tier}`;
  assert.deepEqual(b.seats, a.seats, `${label}: seats and orientation`);
  assert.deepEqual(b.doors, a.doors, `${label}: doors`);
  assert.deepEqual(b.signs, a.signs, `${label}: sign`);
  assert(b.valid && b.meshes <= a.meshes + 6, `${label}: finite geometry and bounded materials`);
  for (const [axis, size] of [[0, spec.w], [2, spec.d]]) {
    assert(b.min[axis] >= Math.min(a.min[axis], -size / 2) - 0.001, `${label}: negative overhang`);
    assert(b.max[axis] <= Math.max(a.max[axis], size / 2) + 0.001, `${label}: positive overhang`);
  }
  console.log(`PASS ${label}`);
}
assert.equal(sandbox.window.previewScandinavian, undefined, 'preview gated outside developer mode');
sandbox.DEV = true;
const preview = vm.runInContext(`(() => {
  const all = previewScandinavian({ focus: false });
  const one = previewScandinavian({ types: ['transit'], focus: false });
  clearScandinavianPreview();
  return [all.length, one.length, !scene.getObjectByName('__scandinavianPreview')];
})()`, sandbox);
assert.deepEqual(Array.from(preview), [38, 2, true], 'all pairs, focused preview and cleanup');
console.log('PASS Scandinavian registry and preview');
