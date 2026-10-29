// Test harness: serves a debug build of the game and drives it in a headless browser.
//
// The debug build is index.html with two additions, made on the fly (the real file is
// never changed): fake-supabase.js stands in for the online database, and window.__dbg
// evaluates code inside the game's scope so tests can read and poke at its state.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function debugBuild(source) {
  let s = source ?? readFileSync(join(ROOT, 'index.html'), 'utf8');
  const boot = 'window.claude?.hot?.ready ? window.claude.hot.ready(boot)';
  const sb = '<script src="vendor/supabase.js"></script>';
  if (!s.includes(boot) || !s.includes(sb)) throw new Error('index.html changed shape; update tests/harness.mjs');
  s = s.replace(boot, 'window.__dbg = (c) => eval(c);\n' + boot);
  // Tests run without drawing the 3D view (much faster with no graphics card) unless the URL asks for ?render.
  const noRender = '<script>window.__mmNoRender = !/[?&]render\\b/.test(location.search);</script>';
  return s.replace(sb, sb + '\n<script src="tests/fake-supabase.js"></script>\n' + noRender);
}

export async function startServer({ source } = {}) {
  const page = debugBuild(source);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    if (path === '/roadmap.html') { // the roadmap's votes go to the stand-in database too
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(readFileSync(join(ROOT, 'roadmap.html'), 'utf8').replace('<script src="vendor/supabase.js"></script>', '<script src="vendor/supabase.js"></script>\n<script src="tests/fake-supabase.js"></script>')); return;
    }
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

export async function launch() {
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
}

// A fresh game page. Options: query ('?dev'), mountain ('raven'), mobile, keepStorage, and render
// (draw the 3D view, as players see it; slow on a machine without a graphics card, so off by default).
export async function openGame(browser, url, { query = '', mountain: asked, width = 1280, height = 900, keepStorage = false, render = false } = {}) {
  // Tests build on Juniper Ridge unless they say otherwise ('fresh' is a first visit, left to pick its own).
  const mountain = asked === 'fresh' ? undefined : asked ?? (keepStorage ? undefined : 'juniper');
  if (render) query += (query ? '&' : '?') + 'render';
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultNavigationTimeout(120000); // this machine can be slow to start the 3D view
  await page.route('https://accounts.google.com/**', (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (!keepStorage || mountain) {
    await page.goto(url);
    await page.evaluate(({ keepStorage, mountain }) => {
      if (!keepStorage) { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mm.rpView', 'full'); } // tests read the full day report unless they pick the summary
      if (mountain) sessionStorage.setItem('skiTycoon.juniperRidge.v1.boot', JSON.stringify({ mt: mountain }));
    }, { keepStorage, mountain });
  }
  await page.goto(url + query);
  await waitReady(page);
  const g = {
    page, errors,
    ev: (code) => page.evaluate((c) => window.__dbg(c), code),
    click: (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error('no element ' + s); el.click(); }, sel),
    wait: (ms) => page.waitForTimeout(ms),
    // Wait for a page load that the game triggers itself (switching mountains, visits).
    reloaded: async () => { await page.waitForLoadState('load'); await waitReady(page); },
  };
  return g;
}
async function waitReady(page) {
  await page.waitForFunction(() => window.__dbg && !document.getElementById('loading'), null, { timeout: 60000 });
  await page.waitForTimeout(1500); // the online stand-in signs in shortly after start
}

// Shared setups, run inside the game.
export const SETUPS = {
  // Juniper Ridge: one double chair, two trails back to the base and a lodge.
  juniperStarter: `(() => {
    const i = evalLift({x:14,z:56},{x:12,z:-10},'double'); commitLift(i,'double');
    const L = world.lifts[0];
    for (const path of [[[L.b.x+3, L.b.z+2],[22,15],[24,40],[22,58]], [[L.b.x-3, L.b.z+2],[4,15],[2,40],[8,58]]]) {
      const pts = path.map(([x,z]) => ({x, z, y: heightAt(x,z)})); const t = evalTrail(pts,'wide');
      if (t.an.problems.length) throw new Error('trail: ' + t.an.problems); commitTrail(t, pts, 'wide');
    }
    computeNetwork();
    for (const [x,z] of [[4,60],[0,56],[26,62],[-4,52]]) for (const r of [0, Math.PI/2]) {
      const b = evalBuilding('lodge', x, z, r);
      if (!b.problems.length) { commitBuilding(b,'lodge',x,z,r); computeNetwork(); syncLabels(); return Math.round(state.cash); }
    }
    throw new Error('no lodge spot');
  })()`,
  // Raven Peak: a double chair to mid-mountain, the two gentlest trails back down, and a lodge.
  ravenStarter: `(() => {
    const i = evalLift({x:0,z:56},{x:-5,z:-10},'double'); commitLift(i,'double'); computeNetwork();
    const L = world.lifts[0], found = [];
    for (const sx of [-1, 1]) for (const a of [6, 10, 14, 18, 24]) for (const b of [4, 10, 16, 22, 28]) for (const m of [8, 20, 30]) {
      const pts = [[L.b.x + 3 * sx, L.b.z + 2], [L.b.x + a * sx, m], [L.a.x + b * sx, 40], [L.a.x + 4 * sx, 58]].map(([x,z]) => ({x, z, y: heightAt(x,z)}));
      const t = evalTrail(pts, 'wide');
      if (!t.an.problems.length) found.push({ sx, t, pts });
    }
    for (const sx of [-1, 1]) { const best = found.filter((f) => f.sx === sx).sort((p, q) => p.t.an.rating - q.t.an.rating || p.t.an.maxGrade - q.t.an.maxGrade)[0]; if (best) { commitTrail(best.t, best.pts, 'wide'); computeNetwork(); } }
    for (const [x,z] of [[10,62],[-12,62],[12,56],[-14,56],[6,66],[-8,66]]) for (const r of [0, Math.PI/2]) {
      const b = evalBuilding('lodge', x, z, r);
      if (!b.problems.length) { commitBuilding(b,'lodge',x,z,r); computeNetwork(); syncLabels(); return Math.round(state.cash); }
    }
    throw new Error('no lodge spot');
  })()`,
  // Maple Notch: a double chair up the main face, the two gentlest trails back down, and a lodge.
  mapleStarter: `(() => {
    let lift = null;
    for (const [ax, az, bx, bz] of [[0,56,-2,-10],[6,56,0,-12],[-6,56,-4,-8],[10,56,6,-6],[0,60,0,0]]) {
      const i = evalLift({x:ax,z:az},{x:bx,z:bz},'double');
      if (!i.problems.length && i.fromBase) { commitLift(i,'double'); lift = i; break; }
    }
    if (!lift) throw new Error('no lift line');
    computeNetwork();
    const L = world.lifts[0], found = [];
    for (const sx of [-1, 1]) for (const a of [6, 10, 14, 18, 24]) for (const b of [4, 10, 16, 22, 28]) for (const m of [8, 20, 30]) {
      const pts = [[L.b.x + 3 * sx, L.b.z + 2], [L.b.x + a * sx, m], [L.a.x + b * sx, 40], [L.a.x + 4 * sx, 58]].map(([x,z]) => ({x, z, y: heightAt(x,z)}));
      const t = evalTrail(pts, 'wide');
      if (!t.an.problems.length) found.push({ sx, t, pts });
    }
    for (const sx of [-1, 1]) { const best = found.filter((f) => f.sx === sx).sort((p, q) => p.t.an.rating - q.t.an.rating || p.t.an.maxGrade - q.t.an.maxGrade)[0]; if (best) { commitTrail(best.t, best.pts, 'wide'); computeNetwork(); } }
    if (!world.trails.length) throw new Error('no trails');
    for (const [x,z] of [[10,62],[-12,62],[12,56],[-14,56],[6,66],[-8,66],[16,60],[-18,60]]) for (const r of [0, Math.PI/2]) {
      const b = evalBuilding('lodge', x, z, r);
      if (!b.problems.length) { commitBuilding(b,'lodge',x,z,r); computeNetwork(); syncLabels(); return Math.round(state.cash); }
    }
    throw new Error('no lodge spot');
  })()`,
  // Snow everywhere and a mid-January date, so days can open.
  midwinter: `(() => { for (let k = 0; k < NV*NV; k++) NS[k] = 50; state.day = 40; refreshSnowState(todayWx()); })()`,
  // Run the open day to its end.
  finishDay: `(() => { let n = 0; while (state.phase === 'open' && n < 90000) { simStep(1.5); n++; } return state.phase; })()`,
};

export function assert(cond, msg) { if (!cond) throw new Error('assertion failed: ' + msg); }
export function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
