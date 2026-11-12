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
    const q = { filters: [], ins: [], op: 'select', cols: '*' };
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
        for (const [c, v] of q.ins || []) rows = rows.filter((r) => v.includes(r[c]));
        return { data: q.single ? rows[0] || null : rows, error: null };
      }
      // shared mountains (supabase/shared-mountains.sql): anyone reads; written through share_mountain; makers delete
      // their own. d.noShared: before that file is run, the table isn't there.
      if (table === 'shared_mountains') {
        if (d.noShared) return { data: null, error: { code: '42P01', message: 'relation "public.shared_mountains" does not exist' } };
        let rows = d.shared || [];
        for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
        for (const [c, v] of q.ins || []) rows = rows.filter((r) => v.includes(r[c]));
        if (q.op === 'delete') { const gone = new Set(rows.filter((r) => r.owner === me)); d.shared = (d.shared || []).filter((r) => !gone.has(r)); put(d); return { data: null, error: null }; }
        if (q.op !== 'select') return { data: null, error: { code: '42501', message: 'permission denied for table shared_mountains' } };
        const cols = q.cols === '*' ? null : q.cols.split(',').map((c) => c.trim());
        if (d.noPhotos && cols && cols.includes('photo')) return { data: null, error: { code: '42703', message: 'column shared_mountains.photo does not exist' } };
        const data = rows.map((r) => (cols ? Object.fromEntries(cols.map((c) => [c, r[c] ?? null])) : { ...r }));
        return { data: q.single ? data[0] || null : data, error: null };
      }
      // a shared mountain's likes and ratings: your own rows only; one each; never on your own mountain; no guests
      if (table === 'shared_mountain_likes' || table === 'shared_mountain_ratings' || table === 'shared_mountain_reports') {
        if (d.noShared || (table === 'shared_mountain_reports' && d.noSharedAdmin)) return { data: null, error: { code: '42P01', message: 'relation does not exist' } };
        const key = { shared_mountain_likes: 'sLikes', shared_mountain_ratings: 'sRatings', shared_mountain_reports: 'sReports' }[table], list = d[key] || (d[key] = []);
        let rows = list.filter((r) => r.user_id === me);
        for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
        if (q.op === 'select') return { data: rows.map((r) => ({ ...r })), error: null };
        if (q.op === 'delete') { d[key] = list.filter((r) => !rows.includes(r)); put(d); return { data: null, error: null }; }
        const m = (d.shared || []).find((x) => x.id === q.obj.mountain_id);
        if (!me || (d.users[me] || {}).anon || !m || m.owner === me) return { data: null, error: { code: '42501', message: 'row-level security' } };
        if (key === 'sRatings' && !(q.obj.stars >= 1 && q.obj.stars <= 5)) return { data: null, error: { code: '23514', message: 'check constraint' } };
        const ex = list.find((r) => r.mountain_id === m.id && r.user_id === me);
        if (ex && q.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key' } };
        if (ex) ex.stars = q.obj.stars; else list.push({ mountain_id: m.id, user_id: me, ...(key === 'sRatings' ? { stars: q.obj.stars } : {}), ...(key === 'sReports' ? { reason: q.obj.reason || null } : {}) });
        put(d); return { data: null, error: null };
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
      // multiplayer: lobbies, players and resorts are readable by anyone (closed lobbies aside); written only
      // by the match server and match_join / match_leave, as in supabase/multiplayer.sql
      if (table.startsWith('match_')) {
        const m = d.match || (d.match = {});
        // chat: messages are written only through match_say; reactions, reports and mutes are your own rows
        if (['match_messages', 'match_reactions', 'match_reports', 'match_mutes'].includes(table)) {
          const key = { match_messages: 'messages', match_reactions: 'reactions', match_reports: 'reports', match_mutes: 'mutes' }[table], list = m[key] || (m[key] = []);
          const pick = (rows) => { for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v); for (const [c, v] of q.ins) rows = rows.filter((r) => v.includes(r[c])); return rows; };
          if (q.op === 'select') {
            let rows = table === 'match_mutes' ? list.filter((r) => r.user_id === me) : table === 'match_reports' ? [] : list.filter((r) => !r.hidden);
            return { data: pick(rows), error: null };
          }
          if (!me || (d.users[me] || {}).anon || table === 'match_messages') return { data: null, error: { code: '42501', message: 'row-level security' } };
          if (q.op === 'insert') {
            const row = { ...q.obj, user_id: me };
            if (table === 'match_reactions') {
              const msg = (m.messages || []).find((x) => x.id === row.message_id), L = msg && (m.lobbies || []).find((l) => l.id === msg.lobby_id);
              if (!L || !['open', 'running'].includes(L.status) || !['👍', '😂', '🔥', '😮', '❄️', '🏆'].includes(row.emoji)) return { data: null, error: { code: '42501', message: 'row-level security' } };
              if (list.some((r) => r.message_id === row.message_id && r.user_id === me && r.emoji === row.emoji)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
            }
            if (table === 'match_reports' && list.some((r) => r.message_id === row.message_id && r.user_id === me)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
            list.push(row); put(d); return { data: null, error: null };
          }
          if (q.op === 'delete') { const gone = new Set(pick(list.filter((r) => r.user_id === me))); m[key] = list.filter((r) => !gone.has(r)); put(d); return { data: null, error: null }; }
        }
        if (table === 'match_orders') { // your own slice of a running match only; you read back only your own
          const o = m.orders || (m.orders = []);
          if (q.op === 'insert') {
            const L = (m.lobbies || []).find((l) => l.id === q.obj.lobby_id), P = (m.players || []).find((p) => p.lobby_id === q.obj.lobby_id && p.slot === q.obj.slot);
            if (!me || (d.users[me] || {}).anon || !L || L.status !== 'running' || !P || P.user_id !== me) return { data: null, error: { code: '42501', message: 'row-level security' } };
            o.push({ id: o.length + 1, user_id: me, applied_day: null, error: null, ...q.obj }); put(d); return { data: null, error: null };
          }
          let rows = o.filter((r) => r.user_id === me);
          for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
          for (const [c, v] of q.ins) rows = rows.filter((r) => v.includes(r[c]));
          return { data: rows, error: null };
        }
        if (q.op !== 'select') return { data: null, error: { code: '42501', message: 'permission denied for table ' + table } };
        const key = { match_lobbies: 'lobbies', match_players: 'players', match_resorts: 'resorts', match_days: 'days', match_badges: 'badges' }[table];
        let rows = (m[key] || []).filter((r) => table !== 'match_lobbies' || r.status !== 'closed');
        for (const [c, v] of q.filters) rows = rows.filter((r) => r[c] === v);
        for (const [c, v] of q.ins) rows = rows.filter((r) => v.includes(r[c]));
        if (table === 'match_resorts' && !q.cols.split(',').includes('save')) rows = rows.map(({ save, ...r }) => r); // only the columns asked for, like the real one
        return { data: q.single ? rows[0] || null : rows, error: null };
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
      for (const [c, v] of q.ins) rows = rows.filter((r) => v.includes(r[c]));
      if (q.op === 'delete') { const ids = new Set(rows.filter((r) => r.owner === me).map((r) => r.id)); d.rows = d.rows.filter((r) => !ids.has(r.id)); put(d); return { data: null, error: null }; }
      const cols = q.cols.split(',').map((c) => c.trim());
      const inSave = (c) => /^\w+:save->>\w+$/.test(c) && c.split(/:|->>/); // alias:save->>field, like the real one
      for (const c of cols) if (c !== '*' && !inSave(c) && !['id', 'owner', 'summary', 'public', 'updated_at', 'save', 'photo'].includes(c)) return { data: null, error: { code: '42703', message: 'column mountains.' + c + ' does not exist' } };
      const data = rows.map((r) => Object.fromEntries(cols.map((c) => { const j = inSave(c); return j ? [j[0], r.save?.[j[2]] ?? null] : [c, r[c] ?? (c === 'photo' ? null : undefined)]; })));
      return { data: q.single ? data[0] || null : data, error: null };
    };
    const b = {
      select(c) { q.cols = c; return b; }, eq(c, v) { q.filters.push([c, v]); return b; }, in(c, v) { q.ins.push([c, v]); return b; }, is(c, v) { q.filters.push([c, v]); return b; }, order() { return b; }, limit() { return b; },
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
    // Like the real client, rpc results can be filtered with .eq (e.g. social_counts for one resort).
    rpc: (fn, args) => {
      // .or('likes.gt.0,visits.gt.0') keeps rows matching any term. Like the real server, a list comes back at most
      // maxRows long (1,000 by default), after the filters.
      const sub = (r, f) => (Array.isArray(r.data) ? { ...r, data: r.data.filter(f) } : r);
      const any = (s) => (x) => s.split(',').some((t) => { const [c, op, n] = t.split('.'); return op === 'gt' && x[c] > +n; });
      const cap = (r) => (Array.isArray(r.data) ? { ...r, data: r.data.slice(0, db().maxRows || 1000) } : r);
      const filt = (p) => ({ eq: (k, v) => filt(p.then((r) => sub(r, (x) => x[k] === v))), or: (s) => filt(p.then((r) => sub(r, any(s)))),
        then: (res, rej) => p.then(cap).then(res, rej) });
      return filt(rpcCall(fn, args));
    },
  }) };
  async function rpcCall(fn, args) {
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
            row.save.cash += 100000; row.save.clock.referralCredit = r.balances[row.id]; row.updated_at = new Date().toISOString(); // as the real one (statement_timestamp)
            r.claims = (r.claims || 0) + 1;
          }
          put(d);
          if (r.loseClaimResponse) return { data: null, error: { message: 'network response lost' } };
          return { data: { mountain: row.id, credit: r.balances[row.id], paid: true }, error: null };
        }
      }
      // record_source: one row per account, kept from the first call (the real one also skips old accounts)
      if (fn === 'record_source') {
        if (!me) return { data: null, error: { code: '42501', message: 'not signed in' } };
        const src = d.sources || (d.sources = {});
        if (!src[me]) { src[me] = { ...args, src: String(args.src || '').toLowerCase() }; put(d); }
        return { data: true, error: null };
      }
      if (fn === 'social_counts') {
        return { data: d.rows.filter((r) => r.public || r.owner === me).map((r) => ({ mountain_id: r.id,
          likes: (d.likes || []).filter((l) => l.mountain_id === r.id).length, visits: (d.visits || []).filter((v) => v.mountain_id === r.id).length })), error: null };
      }
      if (fn === 'board_peek') { // your standing on one board, as supabase/board.sql works it out
        const bo = (mt) => (String(mt || '').startsWith('c:') ? 'custom' : mt || 'juniper');
        const b = d.rows.filter((r) => r.public && r.id !== args.me && r.summary && r.summary.name && !r.summary.sandbox && bo(r.summary.mt) === args.mt)
          .map((r) => ({ id: r.id, name: r.summary.name, best: r.summary.bestGuests || 0 }));
        const mineOk = d.rows.some((r) => r.id === args.me && (r.public || r.owner === me));
        d.peeks = (d.peeks || 0) + 1; put(d);
        return { data: { n: b.length, ahead: b.filter((r) => r.best > (args.best || 0)).length, top: b.sort((x, y) => y.best - x.best).slice(0, 3),
          likes: mineOk ? (d.likes || []).filter((l) => l.mountain_id === args.me).length : 0, visits: mineOk ? (d.visits || []).filter((v) => v.mountain_id === args.me).length : 0 }, error: null };
      }
      if (fn === 'record_board_open') {
        if (!me) return { data: false, error: null };
        const o = d.boardOpens || (d.boardOpens = []), day = new Date().toISOString().slice(0, 10);
        if (!o.some((r) => r.player === me && r.day === day && r.what === args.what)) o.push({ player: me, day, what: args.what });
        put(d); return { data: true, error: null };
      }
      if (fn === 'roadmap_tally') {
        const out = {}; for (const r of d.votes || []) { const t = out[r.idea] || (out[r.idea] = { up: 0, down: 0 }); if (r.vote === 1) t.up++; else t.down++; }
        return { data: out, error: null };
      }
      // the owner's tools (stats.html): only the owner's email, as in the SQL
      const owner = ((sess() || {}).user || {}).email === 'phildbs@gmail.com';
      if (/^admin_/.test(fn) && !owner) return { data: null, error: { code: '42501', message: 'not allowed' } };
      if (fn === 'admin_stats') return { data: { generated: new Date().toISOString(), per_day: [], visitors: 3, started: 2, built_lift: 1, opened: 1, goals3: 0, season2: 0, mountains: 1, mountains_built: 1, by_mountain: [], by_mountain_built: [], top: [], top_built: [], new_24h: 1, new_7d: 2, played_24h: 1, played_7d: 1, signed_in: 1, invited_joined: 0, feedback: [], feedback_count: 0 }, error: null };
      if (fn === 'admin_shared_mountains' || fn === 'admin_shared_remove') {
        if (d.noSharedAdmin) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
        if (fn === 'admin_shared_remove') { const n = (d.shared || []).length; d.shared = (d.shared || []).filter((m) => m.id !== args.pid); for (const k of ['sLikes', 'sRatings', 'sReports']) d[k] = (d[k] || []).filter((r) => r.mountain_id !== args.pid); put(d); return { data: d.shared.length < n, error: null }; }
        const of = (k, id) => (d[k] || []).filter((r) => r.mountain_id === id), sh = d.shared || [];
        const list = sh.map((m) => { const rs = of('sRatings', m.id); return { id: m.id, name: m.name, creator: m.creator, owner: m.owner, created_at: m.created_at, vertical: m.vertical, allow_copy: m.allow_copy,
          likes: of('sLikes', m.id).length, ratings: rs.length, rating: rs.length ? Math.round(rs.reduce((a, r) => a + r.stars, 0) / rs.length * 10) / 10 : null,
          resorts: d.rows.filter((r) => r.summary && r.summary.mt === m.id).length, reports: of('sReports', m.id).length, reasons: of('sReports', m.id).map((r) => r.reason).filter(Boolean) }; })
          .sort((a, b) => b.reports - a.reports || String(b.created_at).localeCompare(String(a.created_at)));
        return { data: { totals: { shared: sh.length, makers: new Set(sh.map((m) => m.owner)).size, shared_7d: sh.length, likes: (d.sLikes || []).length, ratings: (d.sRatings || []).length, stars: null,
          hand_resorts: d.rows.filter((r) => String((r.summary || {}).mt || '').startsWith('c:m')).length, hand_resorts_built: 0, shared_resorts: d.rows.filter((r) => sh.some((m) => m.id === (r.summary || {}).mt)).length,
          reports: (d.sReports || []).length }, mountains: list }, error: null };
      }
      if (['admin_errors', 'admin_reactions', 'admin_players', 'admin_feedback', 'admin_retention', 'admin_funnel', 'admin_sources', 'admin_board_opens'].includes(fn)) return { data: null, error: { message: 'no function ' + fn } };
      if (fn.startsWith('admin_match') || fn.startsWith('admin_chat')) {
        const m = d.match || (d.match = {}), L = m.lobbies || (m.lobbies = []);
        if (fn === 'admin_match_lobby') {
          const t = new Date(args.pstarts); const r = new Date(Math.ceil(t.getTime() / 1800000) * 1800000);
          const row = { id: 'L' + (L.length + 1), name: args.pname, map: args.pmap || 'match', slots: args.pslots, starts_at: r.toISOString(), days: args.pdays, day_minutes: 30, status: 'open', day: 0, prize: args.pprize || args.pname + ' champion', flag: false, computers: true, keep_profit: true, late_days: null, late_bonus: 15000, late_bonus_cap: 1000000 };
          L.push(row); put(d); return { data: row.id, error: null };
        }
        if (fn === 'admin_match_settings') { const l = L.find((x) => x.id === args.lid); if (l) { if (args.pcomputers != null) l.computers = args.pcomputers; if (args.pkeep != null) l.keep_profit = args.pkeep; if (args.plate_days != null) l.late_days = args.plate_days; } put(d); return { data: null, error: null }; }
        if (fn === 'admin_match_flag') { const l = L.find((x) => x.id === args.lid); if (!l) return { data: null, error: { message: 'no such lobby' } }; l.flag = !!args.pflag; put(d); return { data: null, error: null }; }
        if (fn === 'admin_match_late') { const l = L.find((x) => x.id === args.lid); if (!l) return { data: null, error: { message: 'no such lobby' } }; l.late = args.plate !== false; put(d); return { data: null, error: null }; }
        if (fn === 'admin_match_seasons') { if (d.noOfficialSeasons) return { data: null, error: { message: 'Could not find the function public.admin_match_seasons' } }; const l = L.find((x) => x.id === args.lid && x.status === 'open'); if (!l) return { data: null, error: { message: 'only a lobby that hasn\'t started' } }; l.seasons = args.pseasons; l.days = 168 + (args.pseasons - 1) * 195; put(d); return { data: null, error: null }; }
        if (fn === 'admin_match_turn') { const l = L.find((x) => x.id === args.lid && x.status === 'open'); if (!l) return { data: null, error: { message: 'only a lobby that hasn\'t started' } }; l.day_minutes = args.pminutes; put(d); return { data: null, error: null }; }
        if (fn === 'admin_match_stats') return m.stats ? { data: m.stats, error: null } : { data: null, error: { message: 'Could not find the function public.admin_match_stats(tz)' } };
        if (fn === 'admin_match_close') { const l = L.find((x) => x.id === args.lid); if (l) l.status = 'closed'; put(d); return { data: null, error: null }; }
        const msgs = m.messages || [], reps = m.reports || [];
        if (fn === 'admin_chat_reports') return { data: msgs.filter((x) => reps.some((r) => r.message_id === x.id)).map((x) => ({ message: x.id, lobby: (L.find((l) => l.id === x.lobby_id) || {}).name, name: x.name, author: x.user_id, body: x.body, hidden: !!x.hidden, reports: reps.filter((r) => r.message_id === x.id).length, reasons: [] })), error: null };
        if (fn === 'admin_chat_hide') { const x = msgs.find((y) => y.id === args.mid); if (x) x.hidden = args.hide !== false; put(d); return { data: null, error: null }; }
        if (fn === 'admin_chat_ban') { (m.bans || (m.bans = [])).push({ user_id: args.uid, days: args.days }); put(d); return { data: null, error: null }; }
      }
      if (fn === 'match_say') {
        const m = d.match || (d.match = {}), L = (m.lobbies || []).find((l) => l.id === args.lid), list = m.messages || (m.messages = []);
        if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign in to chat' } };
        if (!L || !['open', 'running'].includes(L.status)) return { data: null, error: { message: 'this chat is closed' } };
        const b = String(args.msg || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (!b) return { data: null, error: { message: 'write something first' } };
        if (list.some((x) => x.user_id === me && Date.now() - Date.parse(x.created_at) < 10000)) return { data: null, error: { message: 'slow down a little' } };
        if (/\bshit\b/i.test(b)) return { data: null, error: { message: 'please keep it friendly' } };
        const p = (m.players || []).find((x) => x.lobby_id === L.id && x.user_id === me), prof = (d.profiles || {})[me];
        const row = { id: (list.reduce((a, x) => Math.max(a, x.id), 0) || 0) + 1, lobby_id: L.id, user_id: me, slot: p ? p.slot : null, name: p ? p.resort_name : prof && prof.public ? prof.name : 'Spectator', body: b, kind: 'chat', day: L.day, hidden: false, created_at: new Date().toISOString() };
        list.push(row); put(d); return { data: row.id, error: null };
      }
      // Player matches and passwords (supabase/match-custom.sql). Passwords stay in m.keys, which no select reads.
      // match_create_on (supabase/match-maps.sql): the same, on a mountain, with its own number of resorts
      if (fn === 'match_create_on') {
        // (Willow Valley: supabase/match-valley.sql; d.noValley stands for a database it hasn't been run on yet)
        if (!['match', 'ridge', ...(d.noValley ? [] : ['valley'])].includes(args.pmap)) return { data: null, error: { message: 'pick one of the mountains' } };
        if (args.pmap === 'match' && ![2, 3].includes(args.pslots)) return { data: null, error: { message: 'a match on Crown Peak has 2 or 3 resorts' } };
        if (args.pmap === 'ridge' && ![2, 3, 4].includes(args.pslots)) return { data: null, error: { message: 'a match on Ridgeline has 2 to 4 resorts' } };
        if (args.pmap === 'valley' && ![2, 3, 4].includes(args.pslots)) return { data: null, error: { message: 'a match on Willow Valley has 2 to 4 resorts' } };
      }
      if (fn === 'match_create' || fn === 'match_create_on') {
        const m = d.match || (d.match = {}), L = m.lobbies || (m.lobbies = []), pw = String(args.ppassword || '').trim();
        if (fn === 'match_create' && ![2, 3].includes(args.pslots)) return { data: null, error: { message: 'a match has 2 or 3 resorts' } };
        if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign in to play multiplayer' } };
        if (/\bshit\b/i.test(args.pname || '')) return { data: null, error: { message: 'please pick a friendlier match name' } };
        // 1, 2 or 3 seasons (supabase/match-seasons.sql); d.oneSeason stands in for the database before that file is run
        if (d.oneSeason ? args.pdays !== 168 : ![168, 363, 558].includes(args.pdays)) return { data: null, error: { message: d.oneSeason ? 'a match lasts one whole season (168 days)' : 'a match lasts 1, 2 or 3 whole seasons (168, 363 or 558 days)' } };
        if (!(d.slowTurns ? [10, 15, 30] : [5, 10, 15, 30]).includes(args.pminutes)) return { data: null, error: { message: d.slowTurns ? 'a turn is 10, 15 or 30 minutes' : 'a turn is 5, 10, 15 or 30 minutes' } }; // d.slowTurns: before match-fast-turns.sql
        if (pw && (pw.length < 4 || pw.length > 30)) return { data: null, error: { message: 'a password is 4 to 30 characters' } };
        if (L.some((l) => l.created_by === me && l.kind === 'custom' && ['open', 'running'].includes(l.status))) return { data: null, error: { message: 'you already have a match of your own on: wait for it to finish, or cancel it before it starts' } };
        const row = { id: 'C' + (L.length + 1), name: String(args.pname).replace(/\s+/g, ' ').trim(), map: args.pmap || 'match', slots: args.pslots, starts_at: new Date(Math.ceil(Date.parse(args.pstarts) / 60000) * 60000).toISOString(), days: args.pdays, day_minutes: args.pminutes, status: 'open', day: 0, prize: null, flag: false, computers: args.pcomputers !== false, keep_profit: true, late_days: null, late_bonus: 15000, late_bonus_cap: 1000000, kind: 'custom', created_by: me, locked: !!pw, late: true, ...(d.oneSeason ? {} : { seasons: { 363: 2, 558: 3 }[args.pdays] || 1 }) };
        L.push(row); if (pw) (m.keys || (m.keys = {}))[row.id] = pw;
        (m.players || (m.players = [])).push({ lobby_id: row.id, slot: 0, user_id: me, resort_name: String(args.rname || 'My Resort').slice(0, 40) });
        put(d); return { data: row.id, error: null };
      }
      if (fn === 'match_options') {
        const m = d.match || (d.match = {}), l = (m.lobbies || []).find((x) => x.id === args.lid && x.created_by === me && x.status === 'open');
        if (!l) return { data: null, error: { message: 'only the player who made a match can change it, before it starts' } };
        if (args.pcomputers != null) l.computers = args.pcomputers; if (args.plate != null) l.late = args.plate; put(d); return { data: null, error: null };
      }
      if (fn === 'match_cancel') {
        const m = d.match || (d.match = {}), l = (m.lobbies || []).find((x) => x.id === args.lid && x.created_by === me && x.status === 'open');
        if (!l) return { data: null, error: { message: 'only the player who made a match can cancel it, before it starts' } };
        l.status = 'closed'; put(d); return { data: null, error: null };
      }
      if (fn === 'match_record_more') {
        const P = (d.match || {}).players || [];
        return { data: [{ rescued: P.filter((p) => (p.claimed_by || []).includes(args.uid)).length, abandoned: new Set(P.filter((p) => (p.left_by || []).includes(args.uid)).map((p) => p.lobby_id)).size }], error: null };
      }
      if (fn === 'match_record') {
        const m = d.match || {}, mine = (m.players || []).filter((p) => p.user_id === args.uid && ((m.lobbies || []).find((l) => l.id === p.lobby_id) || {}).status === 'finished');
        const real = (lid) => (m.players || []).filter((p) => p.lobby_id === lid && p.user_id).length;
        return { data: [{ played: mine.length, won: mine.filter((p) => p.place === 1 && real(p.lobby_id) >= 2).length }], error: null };
      }
      // Leaving a running match and claiming a left resort (supabase/match-abandon.sql)
      if (fn === 'match_abandon') {
        const m = d.match || (d.match = {}), L = (m.lobbies || []).find((l) => l.id === args.lid), p = (m.players || []).find((q) => q.lobby_id === args.lid && q.user_id === me);
        if (!L || L.status !== 'running') return { data: null, error: { message: 'this match isn\'t running' } };
        if (!me || !p) return { data: null, error: { message: 'you\'re not in this match' } };
        Object.assign(p, { user_id: null, abandoned: true, rescue_due: false, left_by: [...(p.left_by || []), me] }); put(d); return { data: p.slot, error: null };
      }
      if (fn === 'match_claim' || fn === 'match_claim_key') {
        const m = d.match || (d.match = {}), L = (m.lobbies || []).find((l) => l.id === args.lid), P = m.players || [], p = P.find((q) => q.lobby_id === args.lid && q.slot === args.pslot);
        const want = (m.keys || {})[args.lid];
        if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign in to play multiplayer' } };
        if (!L || L.status !== 'running') return { data: null, error: { message: 'this match isn\'t running' } };
        if (L.day > Math.floor(L.days * 3 / 4)) return { data: null, error: { message: 'it\'s too late to claim a resort in this match' } };
        if (P.some((q) => q.lobby_id === L.id && q.user_id === me)) return { data: null, error: { message: 'already in this match' } };
        if (want && String(args.pkey || '').trim() !== want) return { data: null, error: { message: 'that password isn\'t right' } };
        if (P.some((q) => q.lobby_id === L.id && (q.left_by || []).includes(me))) return { data: null, error: { message: 'you left this match, so you can\'t claim a resort in it' } };
        if (!p || p.user_id || !p.abandoned) return { data: null, error: { message: 'that resort isn\'t free to claim any more' } };
        Object.assign(p, { user_id: me, resort_name: String(args.rname).slice(0, 40), joined_day: L.day, abandoned: false, rescue_due: !p.rescued, rescued: true, claimed_by: [...(p.claimed_by || []), me] }); put(d);
        return { data: p.slot, error: null };
      }
      if (fn === 'match_join_key' || fn === 'match_join_late_key' || ((fn === 'match_join' || fn === 'match_join_late') && ((d.match || {}).keys || {})[args.lid])) {
        const want = ((d.match || {}).keys || {})[args.lid];
        if (want && String(args.pkey || '').trim() !== want) return { data: null, error: { message: 'that password isn\'t right' } };
        fn = fn.replace('_key', '');
      }
      if (fn === 'match_join_late') { // take over a computer resort, or an empty slice, before the cut-off
        const m = d.match || (d.match = {}), L = (m.lobbies || []).find((l) => l.id === args.lid), P = m.players || (m.players = []);
        if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign in to play multiplayer' } };
        if (!L || L.status !== 'running') return { data: null, error: { message: 'this match isn\'t running' } };
        if (L.late === false) return { data: null, error: { message: 'this match doesn\'t take late joiners' } };
        if (L.day > (L.late_days ?? Math.floor(L.days / 4))) return { data: null, error: { message: 'it\'s too late to join this match' } };
        if (P.some((p) => p.lobby_id === L.id && p.user_id === me)) return { data: null, error: { message: 'already in this match' } };
        const comp = P.find((p) => p.lobby_id === L.id && !p.user_id && !p.abandoned);
        if (comp) { Object.assign(comp, { user_id: me, resort_name: String(args.rname).slice(0, 40), joined_day: L.day }); put(d); return { data: comp.slot, error: null }; }
        const free = [...Array(L.slots).keys()].filter((s) => !P.some((p) => p.lobby_id === L.id && p.slot === s));
        if (!free.length) return { data: null, error: { message: 'this match is full' } };
        P.push({ lobby_id: L.id, slot: free[0], user_id: me, resort_name: String(args.rname).slice(0, 40), joined_day: L.day }); put(d);
        return { data: free[0], error: null };
      }
      if (fn === 'match_join' || fn === 'match_leave') {
        const m = d.match || (d.match = {}), L = (m.lobbies || []).find((l) => l.id === args.lid), P = m.players || (m.players = []);
        if (fn === 'match_leave') { m.players = P.filter((p) => !(p.lobby_id === args.lid && p.user_id === me && L && L.status === 'open')); put(d); return { data: null, error: null }; }
        if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign in to play multiplayer' } };
        if (/\bshit\b/i.test(args.rname || '')) return { data: null, error: { message: 'please pick a friendlier resort name' } };
        if (!L || L.status !== 'open' || Date.parse(L.starts_at) <= Date.now()) return { data: null, error: { message: 'this lobby is not open' } };
        if (P.some((p) => p.lobby_id === L.id && p.user_id === me)) return { data: null, error: { message: 'already in this lobby' } };
        if (P.filter((p) => p.user_id === me && ['open', 'running'].includes((m.lobbies.find((l) => l.id === p.lobby_id) || {}).status)).length >= 3) return { data: null, error: { message: 'you are already in three matches' } };
        const free = [...Array(L.slots).keys()].filter((s) => !P.some((p) => p.lobby_id === L.id && p.slot === s));
        if (!free.length) return { data: null, error: { message: 'this lobby is full' } };
        P.push({ lobby_id: L.id, slot: free[0], user_id: me, resort_name: String(args.rname).slice(0, 40) }); put(d);
        return { data: free[0], error: null };
      }
      if (fn === 'shared_mountain_list') { // as supabase/shared-mountains.sql: totals, sorts and search
        if (d.noShared) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
        const q = String(args.psearch || '').toLowerCase();
        const rows = (d.shared || []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.creator.toLowerCase().includes(q)).map((m) => {
          const rs = (d.sRatings || []).filter((r) => r.mountain_id === m.id), tot = rs.reduce((a, r) => a + r.stars, 0);
          return { id: m.id, owner: m.owner, creator: m.creator, name: m.name, vertical: m.vertical, allow_copy: m.allow_copy, created_at: m.created_at,
            likes: (d.sLikes || []).filter((l) => l.mountain_id === m.id).length, rating: rs.length ? Math.round(tot / rs.length * 10) / 10 : null, ratings: rs.length,
            resorts: d.rows.filter((r) => r.summary && r.summary.mt === m.id).length, _r: (tot + 6) / (rs.length + 2) };
        });
        const k = args.psort;
        rows.sort((a, b) => (k === 'likes' ? b.likes - a.likes : k === 'resorts' ? b.resorts - a.resorts : k === 'rating' ? b._r - a._r : 0) || String(b.created_at).localeCompare(String(a.created_at)));
        return { data: rows.slice(0, 60).map(({ _r, ...r }) => r), error: null };
      }
      if (fn === 'set_shared_photo') { // as supabase/shared-mountain-photos.sql (d.noPhotos: before it's run)
        const ex = (d.shared || []).find((r) => r.id === args.pid);
        if (d.noShared || d.noPhotos) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(args.pphoto || '') || args.pphoto.length >= 120000) return { data: null, error: { code: '22023', message: 'bad_photo' } };
        if (!ex || ex.owner !== me) return { data: null, error: { code: '42501', message: 'not_yours' } };
        ex.photo = args.pphoto; put(d); return { data: true, error: null };
      }
      if (fn === 'share_mountain' || fn === 'set_shared_copy') { // as supabase/shared-mountains.sql
        if (d.noShared) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
        const list = d.shared || (d.shared = []), ex = list.find((r) => r.id === args.pid), allow = args.pallow !== false;
        if (fn === 'set_shared_copy') { if (!ex || ex.owner !== me) return { data: null, error: { code: '42501', message: 'not_yours' } }; ex.allow_copy = allow; put(d); return { data: allow, error: null }; }
        if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign_in_needed' } };
        const n = ((d.profiles || {})[me] || {}).name;
        if (!n) return { data: null, error: { code: '22023', message: 'name_needed' } };
        const doc = args.pdoc || {};
        if (!/^c:m[0-9a-z]{14}$/.test(args.pid) || doc.v !== 1 || !doc.h || !String(doc.name || '').trim()) return { data: null, error: { code: '22023', message: 'bad_mountain' } };
        if (!d.noSharedAdmin && /\bshit\b/i.test(doc.name)) return { data: null, error: { code: '22023', message: 'name_not_allowed' } }; // shared-mountains-admin.sql (match_clean; one word stands in for its list)
        if (ex) { if (ex.owner !== me) return { data: null, error: { code: '42501', message: 'shared_by_another' } }; ex.allow_copy = allow; }
        else {
          if (list.filter((r) => r.owner === me).length >= 30) return { data: null, error: { code: 'P0001', message: 'share_limit' } };
          list.push({ id: args.pid, owner: me, creator: n, name: String(doc.name).trim(), doc, vertical: args.pvertical || 0, allow_copy: allow, created_at: new Date().toISOString() });
        }
        put(d); return { data: { id: args.pid, creator: n, allow_copy: allow }, error: null };
      }
      if (fn !== 'set_profile') return { data: null, error: { message: 'no function ' + fn } };
      if (!me || (d.users[me] || {}).anon) return { data: null, error: { code: '42501', message: 'sign_in_needed' } };
      const n = String(args.pname || '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (!n) return { data: null, error: { code: '22023', message: 'name_needed' } };
      if (Object.entries(d.profiles || {}).some(([id, p]) => id !== me && p.name.trim().toLowerCase() === n.toLowerCase())) return { data: null, error: { code: '23505', message: 'name_taken' } }; // supabase/profile-names.sql
      (d.profiles || (d.profiles = {}))[me] = { name: n, public: !!args.ppublic };
      for (const r of d.rows) if (r.owner === me) r.summary = { ...r.summary, creator: args.ppublic ? n : '' };
      put(d); return { data: { name: n, public: !!args.ppublic }, error: null };
  }
})();
