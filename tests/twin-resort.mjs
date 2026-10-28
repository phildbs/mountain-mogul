// A Twin Notch resort for tests, built with the game's own checks: a quad up each summit with its trails.
export const build = `(() => {
  state.cash = 1e9; const W = (u, v) => ({ x: 160 * u - 80, z: 80 - 160 * v }), out = [];
  const lift = (a, b, type) => { for (const dz of [0, 2, -2, 4, -4]) for (const dx of [0, 2, -2, 4]) { const A = W(...a), B = W(...b); A.z += dz; A.x += dx; const i = evalLift(A, B, type); if (!i.problems.length) { commitLift(i, type); computeNetwork(); return world.lifts[world.lifts.length - 1]; } } out.push('lift failed ' + evalLift(W(...a), W(...b), type).problems[0]); return null; };
  const E = lift([0.74, 0.15], [0.76, 0.9], 'quad'), Wl = lift([0.26, 0.15], [0.25, 0.9], 'quad');
  const drawn = (name, L, pts, width) => { const P = [{ x: L.b.x + 2, z: L.b.z + 3 }, ...pts.map((p) => W(...p))]; const i = evalTrail(P, width || 'medium', false, false), ok = !i.an.problems.length;
    if (ok) { const t = commitTrail(i, P, width || 'medium'); t.name = name; computeNetwork(); }
    out.push(name + ' (drawn): ' + ['green', 'blue', 'black', 'expert'][i.an.rating] + ' (steepest ' + Math.round(i.an.maxGrade * 100) + '%)' + (ok ? '' : ' NOT BUILT: ' + i.an.problems.join(' | '))); };
  if (E) { drawn('Long Shoulder', E, [[0.86, 0.9], [0.93, 0.8], [0.95, 0.66], [0.945, 0.52], [0.935, 0.4], [0.91, 0.3], [0.86, 0.2], [0.8, 0.15], [0.76, 0.1]], 'wide'); drawn('Gemini', E, [[0.7, 0.72], [0.66, 0.52], [0.69, 0.32], [0.68, 0.08]]); drawn('Double Take', E, [[0.8, 0.7], [0.84, 0.5], [0.8, 0.3], [0.8, 0.08]]); }
  if (Wl) { drawn('Sister Ridge', Wl, [[0.31, 0.72], [0.35, 0.52], [0.32, 0.32], [0.31, 0.1]]); drawn('Saddle Run', Wl, [[0.36, 0.76], [0.4, 0.56], [0.38, 0.34], [0.36, 0.1]]); drawn('Headwall', Wl, [[0.235, 0.8], [0.21, 0.66], [0.19, 0.5], [0.2, 0.3], [0.21, 0.1]], 'narrow'); drawn('West Wall', Wl, [[0.23, 0.8], [0.16, 0.68], [0.12, 0.5], [0.12, 0.3], [0.15, 0.09]]); }
  return out; })()`;
