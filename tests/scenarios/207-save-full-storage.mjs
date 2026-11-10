// A full browser (Adum888, Nov 10): a save that doesn't fit used to leave an old copy on the device while the
// mountain's card said "saved just now". Going back to the title loaded that old copy, and the next upload sent it
// over the newer one online. Now only a write that went in counts, the player is told storage is full, a load picks
// the newer online copy, and an old state on screen is never uploaded over newer progress.
import { openGame, eq, assert, SETUPS } from '../harness.mjs';
export default async function ({ browser, url }) {
  const g = await openGame(browser, url);
  await g.click('#startBtn'); await g.wait(300);
  await g.ev(SETUPS.juniperStarter); await g.ev(SETUPS.midwinter);
  const r = await g.ev(`(() => {
    const s = activeSlot(); saveNow(); const ok = { localAt: !!s.localAt, fresh: Date.now() - s.localAt < 5000 };
    // the browser is full: the save doesn't go in
    const real = Storage.prototype.setItem, key = saveKey(), before = s.localAt; let warned = '';
    const realToast = toast; toast = (m) => { warned = m; };
    Storage.prototype.setItem = function (k, v) { if (k === key) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); };
    s.localAt = before - 3600e3; const stale = s.localAt;
    try { saveNow(); } finally { Storage.prototype.setItem = real; toast = realToast; }
    const full = { kept: s.localAt === stale, warned: /storage is full/.test(warned), savedAt: Date.now() - s.savedAt < 5000 };
    // meanwhile a newer copy went online (from this device, before the old copy was loaded)
    CLOUD.own = [{ id: s.id, updatedAt: Date.now() - 600e3 }];
    const pick = { loadOnline: onlineIsNewer(s) };
    // the old copy is loaded anyway (an older page, say): saving it again doesn't make it new
    applySave({ ...saveData(true), savedAt: stale }); saveNow();
    const guard = { ahead: onlineIsAhead(s) };
    // a fresh upload of this device's own state is not "newer elsewhere"
    s.baseAt = Date.now(); CLOUD.own = [{ id: s.id, updatedAt: Date.now() }];
    return { ok, full, pick, guard, ownUpload: onlineIsAhead(s) };
  })()`);
  eq(r.ok, { localAt: true, fresh: true }, 'a save that goes in is noted as this device’s copy');
  eq(r.full, { kept: true, warned: true, savedAt: true }, 'a save that doesn’t fit leaves the note alone, and says storage is full');
  eq(r.pick.loadOnline, true, 'the newer online copy is the one loaded');
  eq(r.guard.ahead, true, 'an old state on screen is never uploaded over newer progress, however often it saves');
  eq(r.ownUpload, false, 'your own latest upload isn’t mistaken for newer progress elsewhere');
  eq(g.errors, [], 'no page errors');
  return 'full storage: no false “saved”, a warning, the newer online copy loads, no uploading an old state over a newer one';
}
