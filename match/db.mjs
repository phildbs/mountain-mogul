// Database access for the match server: the real Supabase (REST, with the service key), or an in-memory
// stand-in for tests. Both take the same calls. Filters are { column: value }, { column: ['in', [...]] }
// or { column: ['is', null] }.

export function restDb(url, key) {
  // A newer secret key (sb_secret_...) goes in apikey alone; an older service_role key (a JWT) also as the bearer.
  const base = url.replace(/\/$/, '') + '/rest/v1/', head = { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' };
  const qs = (filters = {}) => Object.entries(filters).map(([c, v]) => `${c}=${Array.isArray(v)
    ? (v[0] === 'in' ? `in.(${v[1].map(encodeURIComponent).join(',')})` : `${v[0]}.${v[1]}`)
    : `eq.${encodeURIComponent(v)}`}`).join('&');
  const call = async (method, path, body, prefer) => {
    const r = await fetch(base + path, { method, headers: { ...head, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`${method} ${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 300)}`);
    const text = await r.text(); // a write with return=minimal answers 201 with no body at all
    return text ? JSON.parse(text) : null;
  };
  return {
    select: (table, filters, order) => call('GET', `${table}?select=*${Object.keys(filters || {}).length ? '&' + qs(filters) : ''}${order ? `&order=${order}` : ''}`),
    insert: (table, rows) => call('POST', table, rows, 'return=representation'),
    upsert: (table, rows) => call('POST', table, rows, 'resolution=merge-duplicates,return=minimal'),
    update: (table, filters, patch) => call('PATCH', `${table}?${qs(filters)}`, patch, 'return=minimal'),
  };
}

// Primary keys, so upserts replace the right row.
const KEYS = { match_lobbies: ['id'], match_players: ['lobby_id', 'slot'], match_resorts: ['lobby_id', 'slot'], match_days: ['lobby_id', 'day'], match_orders: ['id'], match_badges: ['user_id', 'lobby_id'] };
export function memoryDb() {
  const t = {}, rows = (table) => (t[table] ??= []);
  const hit = (r, filters = {}) => Object.entries(filters).every(([c, v]) => (Array.isArray(v) ? (v[0] === 'in' ? v[1].includes(r[c]) : v[0] === 'is' ? r[c] == null : false) : r[c] === v));
  const same = (table, a, b) => (KEYS[table] || ['id']).every((k) => a[k] === b[k]);
  let nextId = 1;
  return {
    tables: t,
    select: async (table, filters, order) => {
      const out = rows(table).filter((r) => hit(r, filters)).map((r) => structuredClone(r));
      if (order) { const [c, dir] = order.split('.'); out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
      return out;
    },
    insert: async (table, list) => list.map((r) => { const row = { ...(table === 'match_orders' ? { id: nextId++ } : {}), ...structuredClone(r) }; rows(table).push(row); return structuredClone(row); }),
    upsert: async (table, list) => { for (const r of list) { const old = rows(table).find((x) => same(table, x, r)); if (old) Object.assign(old, structuredClone(r)); else rows(table).push(structuredClone(r)); } return null; },
    update: async (table, filters, patch) => { for (const r of rows(table)) if (hit(r, filters)) Object.assign(r, structuredClone(patch)); return null; },
  };
}
