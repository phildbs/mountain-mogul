// Takes the Willow Valley picture for the King of the Mountain window and title card (img/willow.jpg), like
// capture-crown.mjs: the bare map (the map viewer, lines and labels hidden), looking down the valley from the east end, 720 x 450.
// Run again if the map's terrain changes:   cd tests && node capture-willow.mjs
import { writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
const server = await startServer(), browser = await launch();
try {
  const g = await openGame(browser, server.url, { query: '?mapView=valley', mountain: 'fresh', render: true, width: 1200, height: 800 });
  await g.page.waitForFunction(() => !!document.getElementById('mapView'), null, { timeout: 60000 });
  await g.wait(3000);
  const url = await g.ev(`(() => {
    for (const k of ['lines']) mapViewer[k].visible = false;
    for (const k of ['runs', 'parcels', 'lots']) mapViewer[k].grp.visible = false;
    const width = 720, height = 450, az = ${Number(process.env.AZ || 1.25)}, el = ${Number(process.env.EL || 0.5)};
    const pts = [[-0.3, -0.5], [1.4, -0.5], [-0.3, 1.5], [1.4, 1.5]].map(uvWorld);
    const c = uvWorld([0.545, 0.5]), focus = new THREE.Vector3(c.x, heightAt(c.x, c.z), c.z), shot = camera.clone();
    shot.position.copy(focus).add(new THREE.Vector3(Math.sin(az) * Math.cos(el) * 900, Math.sin(el) * 900, Math.cos(az) * Math.cos(el) * 900));
    shot.lookAt(focus); shot.updateMatrixWorld();
    const f = pts.flatMap((p) => [0, 30].map((up) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + up, p.z).applyMatrix4(shot.matrixWorldInverse)));
    const loX = Math.min(...f.map((p) => p.x)), hiX = Math.max(...f.map((p) => p.x)), loY = Math.min(...f.map((p) => p.y)), hiY = Math.max(...f.map((p) => p.y));
    const halfH = Math.max((hiY - loY) * 0.5, (hiX - loX) * 0.5 / (width / height)) * 0.97, halfW = halfH * width / height;
    shot.left = (loX + hiX) / 2 - halfW; shot.right = (loX + hiX) / 2 + halfW; shot.bottom = (loY + hiY) / 2 - halfH; shot.top = (loY + hiY) / 2 + halfH;
    const fog = scene.fog; scene.fog = null; shot.near = 1; shot.far = 3000; shot.updateProjectionMatrix();
    let view; try { view = captureSceneCanvas(shot, width, height); } finally { scene.fog = fog; }
    const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
    const ctx = cv.getContext('2d'), sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#bfd3ea'); sky.addColorStop(1, '#e8eef6'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height); ctx.drawImage(view, 0, 0);
    return cv.toDataURL('image/jpeg', 0.82);
  })()`);
  writeFileSync(new URL('../img/willow.jpg', import.meta.url), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote img/willow.jpg', g.errors);
} finally { await browser.close(); server.close(); }
