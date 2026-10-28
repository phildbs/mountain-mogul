// Stand-in for Supabase for the tests, with the same rules as supabase/schema.sql: owners,
// the five-mountain limit, public resorts (guests' stamped as such), and only your own rows writable.
(() => {
  const db = () => JSON.parse(localStorage.getItem('FAKE_DB') || '{"rows":[],"users":{}}');
  const put = (d) => localStorage.setItem('FAKE_DB', JSON.stringify(d));
  const sess = () => JSON.parse(localStorage.getItem('FAKE_SESSION') || 'null');
  const setSess = (s) => s ? localStorage.setItem('FAKE_SESSION', JSON.stringify(s)) : localStorage.removeItem('FAKE_SESSION');
  let listeners = [];
  const mkUser = (id, anon, email) => { const d = db(); d.users[id] = { anon }; put(d); return { id, is_anonymous: anon, email: email || '', identities: anon ? [] : [{ provider: 'google', identity_data: { email } }] }; };
  const uid = () => (sess() || {}).user?.id;
  window.__fakeSwitch = (id, email) => { const s = { user: mkUser(id, false, email) }; setSess(s); listeners.forEach((f) => f('SIGNED_IN', s)); };
  function query(table) {
    const q = { filters: [], op: 'select', cols: '*' };
    const run = () => {
      const d = db(), me = uid();
      // feedback: anyone signed in (guests too) can send; nobody can read it back
      if (table === 'feedback') {
        if (q.op !== 'insert') return { data: null, error: { code: '42501', message: 'permission denied for table feedback' } };
        if (!me) return { data: null, error: { code: '42501', message: 'not signed in' } };
        const m = String(q.obj.message || '');
        if (m.length < 1 || m.length > 2000) return { data: null, error: { code: '23514', message: 'check constraint' } };
        (d.feedback || (d.feedback = [])).push({ user_id: me, message: m, context: q.obj.context, created_at: new Date().toISOString() });
        put(d); return { data: null, error: null };
      }
      // errors: crash reports, insert-only like feedback
      if (table === 'errors') {
        if (q.op !== 'insert' || !me) return { data: null, error: { code: '42501', message: 'permission denied for table errors' } };
        (d.errors || (d.errors = [])).push({ user_id: me, ...q.obj });
        put(d); return { data: null, error: null };
      }
      // likes and visits: signed-in players like someone else's public resort once; anyone counts a daily visit
      if (table === 'likes' || table === 'visits') {
        const list = d[table] || (d[table] = []);
        if (q.op === 'select') {
          if (table === 'visits') return { data: null, error: { code: '42501', message: 'permission denied' } };
          let rows = list.filter((r) => r.user_id === me);
          for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
          return { data: q.single ? rows[0] || null : rows, error: null };
        }
        if (q.op !== 'insert') return { data: null, error: { code: '42501', message: 'permission denied' } };
        const m = d.rows.find((r) => r.id === q.obj.mountain_id);
        if (!me || !m || !m.public || m.owner === me || (table === 'likes' && (d.users[me] || {}).anon)) return { data: null, error: { code: '42501', message: 'row-level security' } };
        const day = new Date().toISOString().slice(0, 10);
        if (list.some((r) => r.mountain_id === m.id && r.user_id === me && (table === 'likes' || r.day === day))) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        list.push({ mountain_id: m.id, user_id: me, day }); put(d); return { data: null, error: null };
      }
      // profiles: public ones (and your own) readable; written only through set_profile
      if (table === 'profiles') {
        if (q.op !== 'select') return { data: null, error: { code: '42501', message: 'permission denied for table profiles' } };
        let rows = Object.entries(d.profiles || {}).map(([id, p]) => ({ id, ...p })).filter((p) => p.public || p.id === me);
        for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
        return { data: q.single ? rows[0] || null : rows, error: null };
      }
      // featured: the staff picks, readable by anyone, written only by the owner (not from the game)
      if (table === 'update_reactions') {
        if (q.op !== 'upsert') return { data: null, error: null };
        d.reactions = (d.reactions || []).filter((r) => !(r.version === q.obj.version && r.user_id === me));
        d.reactions.push({ ...q.obj, user_id: me }); put(d); return { data: null, error: null };
      }
      // roadmap votes: your own rows only; one per idea, replaced or taken back
      if (table === 'roadmap_votes') {
        if (!me) return { data: null, error: { code: '42501', message: 'permission denied for table roadmap_votes' } };
        const v = d.votes || (d.votes = []);
        if (q.op === 'upsert') { if (q.obj.user_id !== me) return { data: null, error: { code: '42501', message: 'row-level security' } }; d.votes = v.filter((r) => !(r.idea === q.obj.idea && r.user_id === me)); d.votes.push({ idea: q.obj.idea, user_id: me, vote: q.obj.vote }); put(d); return { data: null, error: null }; }
        let rows = v.filter((r) => r.user_id === me);
        for (const [c, val] of q.filters) rows = rows.filter((r) => r[c] === val);
        if (q.op === 'delete') { d.votes = v.filter((r) => !rows.includes(r) && !rows.some((x) => x.idea === r.idea && x.user_id === r.user_id)); put(d); return { data: null, error: null }; }
        return { data: rows.map((r) => ({ idea: r.idea, vote: r.vote })), error: null };
      }
      if (table === 'featured') {
        if (q.op !== 'select') return { data: null, error: { code: '42501', message: 'permission denied for table featured' } };
        let rows = d.featured || [];
        for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
        return { data: rows, error: null };
      }
      if (q.op === 'upsert') {
        const o = { ...q.obj, summary: { ...(q.obj.summary || {}), guest: !!(d.users[me] || {}).anon } }, ex = d.rows.find((r) => r.id === o.id);
        if (d.referrals && Number(o.save?.clock?.referralCredit || 0) !== Number(d.referrals.balances?.[o.id] || 0)) return { data: null, error: { code: '40001', message: 'referral_save_conflict' } };
        if (ex) { if (ex.owner !== me) return { data: null, error: { code: '42501', message: 'row-level security' } }; Object.assign(ex, o); }
        else {
          if (d.rows.filter((r) => r.owner === me).length >= 5) return { data: null, error: { code: 'P0001', message: 'mountain_limit' } };
          d.rows.push({ owner: me, ...o });
        }
        put(d); return { data: null, error: null };
      }
      let rows = d.rows.filter((r) => r.public || r.owner === me);
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
      insert(o) { q.op = 'insert'; q.obj = o; return b; },
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
    from: (table) => query(table),
    // set_profile: signed-in players only; the name goes on all their resorts (blank while private)
    rpc: async (fn, args) => {
      const d = db(), me = uid();
      // Referral UI fixtures. Real authorization/qualification rules are tested in SQL.
      if (fn.startsWith('referral_') && d.referrals) {
        const r = d.referrals;
        if (r.offline) return { data: null, error: { message: 'network unavailable' } };
        if (fn === 'referral_accept') {
          (r.accepted || (r.accepted = {}))[me] ||= args.invite_code; put(d);
          return { data: { accepted: true }, error: null };
        }
        if (fn === 'referral_status') return { data: { available: true, signed_in: !(d.users[me] || {}).anon, ...(r.status || {}) }, error: null };
        if (fn === 'referral_balance') return { data: { mountain: args.mountain_id, credit: r.balances?.[args.mountain_id] || 0 }, error: null };
        if (fn === 'referral_claim') {
          const f = r.status.friends.find(f => f.id === args.invitation_id), row = d.rows.find(m => m.id === args.mountain_id && m.owner === me);
          if (!f || !f.qualified || !row) return { data: null, error: { message: 'friend_not_qualified' } };
          if (!f.claimed) {
            if (r.status.claimed >= 3) return { data: null, error: { message: 'referral_cap' } };
            f.claimed = true; r.status.claimed++;
            (r.balances || (r.balances = {}))[row.id] = (r.balances?.[row.id] || 0) + 100000;
            row.save.cash += 100000; row.save.clock.referralCredit = r.balances[row.id];
            r.claims = (r.claims || 0) + 1;
          }
          put(d);
          if (r.loseClaimResponse) return { data: null, error: { message: 'network response lost' } };
          return { data: { mountain: row.id, credit: r.balances[row.id], paid: true }, error: null };
        }
      }
      if (fn === 'social_counts') {
        return { data: d.rows.filter((r) => r.public || r.owner === me).map((r) => ({ mountain_id: r.id,
          likes: (d.likes || []).filter((l) => l.mountain_id === r.id).length, visits: (d.visits || []).filter((v) => v.mountain_id === r.id).length })), error: null };
      }
      if (fn === 'roadmap_tally') {
        const out = {}; for (const r of d.votes || []) { const t = out[r.idea] || (out[r.idea] = { up: 0, down: 0 }); if (r.vote === 1) t.up++; else t.down++; }
        return { data: out, error: null };
      }
      if (fn !== 'set_profile') return { data: null, error: { message: 'no function ' + fn } };
      if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign_in_needed' } };
      const n = String(args.pname || '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (!n) return { data: null, error: { code: '22023', message: 'name_needed' } };
      (d.profiles || (d.profiles = {}))[me] = { name: n, public: !!args.ppublic };
      for (const r of d.rows) if (r.owner === me) r.summary = { ...r.summary, creator: args.ppublic ? n : '' };
      put(d); return { data: { name: n, public: !!args.ppublic }, error: null };
    },
  }) };
})();
