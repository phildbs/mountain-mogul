// The rating shown while drawing a trail is the rating it gets once built: drawn uphill or down,
// graded downhill or not, with or without a bridge. (Player report: shown green, built black.)
import { openGame, eq, assert } from '../harness.mjs';
export default async function ({ browser, url }) {
  for (const mt of ['juniper', 'raven']) {
    const g = await openGame(browser, url, { mountain: mt });
    await g.click('#startBtn'); await g.wait(400);
    const r = await g.ev(`(() => {
      state.cash = 1e9; let rnd = 11; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
      const out = { n: 0, graded: 0, reversed: 0, bad: [] }, snap = JSON.stringify(saveData(false));
      for (let k = 0; k < 90; k++) {
        const x0 = LAND.i0 - HALF + 10 + R() * (LAND.i1 - LAND.i0 - 20), z0 = LAND.j0 - HALF + 10 + R() * (LAND.j1 - LAND.j0 - 20);
        const pts = []; let x = x0, z = z0; for (let i = 0; i < 3 + Math.floor(R() * 3); i++) { pts.push({ x, z }); x += (R() - 0.5) * 30; z += (R() - 0.5) * 30; }
        const width = ['narrow', 'medium', 'wide'][k % 3];
        for (const grade of [false, true]) {
          const info = evalTrail(pts, width, false, grade);
          if (info.an.problems.some((p) => !/Start the trail|Finish at|leads back|doesn’t lead|No trail from/.test(p)) || (grade && !info.earth)) continue;
          const t = commitTrail(info, pts, width);
          out.n++; if (grade) out.graded++; if (info.reversed) out.reversed++;
          if (t.an.rating !== info.an.rating || Math.abs(t.an.maxGrade - info.an.maxGrade) > 1e-9) out.bad.push({ grade, shown: info.an.rating, built: t.an.rating });
          applySave(JSON.parse(snap));
        }
      }
      return out; })()`);
    assert(r.n > 60 && r.graded > 20 && r.reversed > 10, `${mt}: enough trails tried: ${JSON.stringify(r)}`);
    eq(r.bad, [], `${mt}: every trail built with the rating it showed`);
    eq(await g.ev(`(() => { const sum = () => HT.reduce((a, v, i) => a + v * ((i % 97) + 1), 0), before = sum(); let graded = 0; let rnd = 5; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 40; k++) { const x = LAND.i0 - HALF + 10 + R() * 100, z = LAND.j0 - HALF + 10 + R() * 100; const info = evalTrail([{ x, z }, { x: x + 20 * (R() - 0.5), z: z + 25 }, { x: x + 20 * (R() - 0.5), z: z + 50 }], 'wide', false, true); if (info.earth) graded++; }
      return graded > 0 && sum() === before; })()`), true, 'previewing graded trails leaves the ground as it was');
    eq(g.errors, [], 'no page errors');
    await g.page.close();
  }
}
