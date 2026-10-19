// Runs every scenario in tests/scenarios (or the ones named on the command line).
//   cd tests && npm install && node run.mjs            # everything
//   node run.mjs loans visits                          # just those
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, launch } from './harness.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'scenarios');
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && (!only.length || only.some((o) => f.includes(o)))).sort();

const server = await startServer();
const browser = await launch();
let failed = 0;
for (const f of files) {
  const t0 = Date.now();
  const mod = await import(pathToFileURL(join(dir, f)));
  try {
    const note = await mod.default({ browser, url: server.url });
    console.log(`PASS ${f} (${((Date.now() - t0) / 1000).toFixed(0)}s)${note ? ' · ' + note : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: ${e.message.split('\n')[0]}`);
  }
  // A failed test can leave its page open, still running the game; close it so it can't slow the next ones.
  for (const ctx of browser.contexts()) for (const p of ctx.pages()) await p.close().catch(() => {});
}
await browser.close();
server.close();
console.log(failed ? `${failed} of ${files.length} failed` : `all ${files.length} passed`);
process.exit(failed ? 1 : 0);
