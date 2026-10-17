// Stand-in for Supabase for the tests, with the same rules as supabase/schema.sql: owners,
// the three-mountain limit, public resorts from guests hidden, and only your own rows writable.
(() => {
  const db = () => JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}');
  const put = (d) => localStorage.setItem('FAKE_DB', JSON.stringify(d));
  const sess = () => JSON.parse(localStorage.getItem('FAKE_SESSION') || 'null');
  const setSess = (s) => s ? localStorage.setItem('FAKE_SESSION', JSON.stringify(s)) : localStorage.removeItem('FAKE_SESSION');
  let listeners = [];
  const mkUser = (id, anon, email) => { const d = db(); d.users[id] = { anon }; put(d); return { id, is_anonymous: anon, email: email || '', identities: anon ? [] : [{ provider: 'google', identity_data: { email } }] }; };
  const uid = () => (sess() || {}).user?.id;
  window.__fakeSwitch = (id, email) => { const s = { user: mkUser(id, false, email) }; setSess(s); listeners.forEach((f) => f('SIGNED_IN', s)); };
  function query() {
    const q = { filters: [], op: 'select', cols: '*' };
    const run = () => {
      const d = db(), me = uid();
      if (q.op === 'upsert') {
        const o = q.obj, ex = d.rows.find((r) => r.id === o.id);
        if (ex) { if (ex.owner !== me) return { data: null, error: { code: '42501', message: 'row-level security' } }; Object.assign(ex, o); }
        else {
          if (d.rows.filter((r) => r.owner === me).length >= 3) return { data: null, error: { code: 'P0001', message: 'mountain_limit' } };
          d.rows.push({ owner: me, ...o });
        }
        put(d); return { data: null, error: null };
      }
      let rows = d.rows.filter((r) => (r.public && !(d.users[r.owner] || {}).anon) || r.owner === me);
      for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
      if (q.op === 'delete') { const ids = new Set(rows.filter((r) => r.owner === me).map((r) => r.id)); d.rows = d.rows.filter((r) => !ids.has(r.id)); put(d); return { data: null, error: null }; }
      const cols = q.cols.split(',').map((c) => c.trim());
      for (const c of cols) if (c !== '*' && !['id', 'owner', 'summary', 'public', 'updated_at', 'save'].includes(c)) return { data: null, error: { code: '42703', message: 'column mountains.' + c + ' does not exist' } };
      const data = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
      return { data: q.single ? data[0] || null : data, error: null };
    };
    const b = {
      select(c) { q.cols = c; return b; }, eq(c, v) { q.filters.push([c, v]); return b; }, order() { return b; }, limit() { return b; },
      maybeSingle() { q.single = true; return b; }, upsert(o) { q.op = 'upsert'; q.obj = o; return b; }, delete() { q.op = 'delete'; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return b;
  }
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: sess() } }),
      signInAnonymously: async () => { const s = { user: mkUser('anon-' + Math.random().toString(36).slice(2, 8), true) }; setSess(s); return { data: { session: s }, error: null }; },
      signOut: async () => { setSess(null); return { error: null }; },
      onAuthStateChange: (f) => { listeners.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
      linkIdentity: async () => ({ error: { message: 'no' } }), signInWithIdToken: async () => ({ error: { message: 'no' } }),
      signInWithOAuth: async () => ({ error: { message: 'no' } }), updateUser: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }),
    },
    from: () => query(),
  }) };
})();
