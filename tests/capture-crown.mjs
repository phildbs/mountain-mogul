// Takes the Crown Peak picture for the King of the Mountain window (img/crown.jpg), like the other mountains'
// photos in img/: the bare match map from above, 720 x 450. Run again if the match map's terrain changes:
//   cd tests && node capture-crown.mjs
import { writeFileSync } from 'node:fs';
import { startServer, launch, openGame } from './harness.mjs';
const server = await startServer(), browser = await launch();
try {
  const g = await openGame(browser, server.url, { query: '?matchMap=1', mountain: 'fresh', render: true, width: 1200, height: 800 });
  await g.wait(3000);
  const url = await g.ev(`(() => {
    const width = 720, height = 450, az = 0.35, el = 0.8, R = HALF * 0.98;
    const pts = [{ x: -R, z: -R }, { x: R, z: -R }, { x: -R, z: R }, { x: R, z: R }];
    const focus = new THREE.Vector3(0, heightAt(0, 0) * 0.5, 0), shot = camera.clone();
    shot.position.copy(focus).add(new THREE.Vector3(Math.sin(az) * Math.cos(el) * 900, Math.sin(el) * 900, Math.cos(az) * Math.cos(el) * 900));
    shot.lookAt(focus); shot.updateMatrixWorld();
    const f = pts.flatMap((p) => [0, 40].map((up) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + up, p.z).applyMatrix4(shot.matrixWorldInverse)));
    const loX = Math.min(...f.map((p) => p.x)), hiX = Math.max(...f.map((p) => p.x)), loY = Math.min(...f.map((p) => p.y)), hiY = Math.max(...f.map((p) => p.y));
    const halfH = Math.max((hiY - loY) * 0.5, (hiX - loX) * 0.5 / (width / height)) * 0.95, halfW = halfH * width / height;
    shot.left = (loX + hiX) / 2 - halfW; shot.right = (loX + hiX) / 2 + halfW; shot.bottom = (loY + hiY) / 2 - halfH; shot.top = (loY + hiY) / 2 + halfH;
    shot.updateProjectionMatrix();
    const fog = scene.fog; scene.fog = null; shot.near = 1; shot.far = 3000; shot.updateProjectionMatrix();
    let view; try { view = captureSceneCanvas(shot, width, height); } finally { scene.fog = fog; }
    const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
    const ctx = cv.getContext('2d'), sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#bfd3ea'); sky.addColorStop(1, '#e8eef6'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height); ctx.drawImage(view, 0, 0);
    return cv.toDataURL('image/jpeg', 0.82);
  })()`);
  writeFileSync(new URL('../img/crown.jpg', import.meta.url), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote img/crown.jpg', g.errors);
} finally { await browser.close(); server.close(); }
