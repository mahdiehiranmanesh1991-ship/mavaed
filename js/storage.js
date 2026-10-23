// All data stays on this device (localStorage). Nothing is ever sent over the network.
const KEY = 'mavaed.v1';
export const SCHEMA = 'mavaed-backup';
const empty = () => ({ cases: [], settings: { thursdayOff: false, eNoticeShift: false, residence: 'inside' } });

export function createStore(backend = globalThis.localStorage) {
  const load = () => {
    try {
      const raw = backend.getItem(KEY);
      if (!raw) return empty();
      const d = JSON.parse(raw);
      return { ...empty(), ...d, settings: { ...empty().settings, ...(d.settings || {}) }, cases: Array.isArray(d.cases) ? d.cases : [] };
    } catch { return empty(); }
  };
  let state = load();
  const save = () => backend.setItem(KEY, JSON.stringify(state));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return {
    get state() { return state; },
    settings: () => state.settings,
    setSetting(k, v) { state.settings[k] = v; save(); },
    listCases: () => state.cases.slice(),
    addCase(c) { const item = { id: uid(), done: false, createdAt: new Date().toISOString(), ...c }; state.cases.push(item); save(); return item; },
    updateCase(id, patch) { const c = state.cases.find((x) => x.id === id); if (!c) return null; Object.assign(c, patch, { updatedAt: new Date().toISOString() }); save(); return c; },
    deleteCase(id) { state.cases = state.cases.filter((x) => x.id !== id); save(); },
    exportJSON() { return JSON.stringify({ schema: SCHEMA, version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2); },
    importJSON(text, { merge = false } = {}) {
      const d = JSON.parse(text);
      if (d.schema !== SCHEMA || !Array.isArray(d.cases)) throw new Error('فایل پشتیبان معتبر نیست');
      const valid = d.cases.filter((c) => c && typeof c.id === 'string' && typeof c.lastKey === 'string');
      if (merge) {
        const ids = new Set(state.cases.map((c) => c.id));
        state.cases.push(...valid.filter((c) => !ids.has(c.id)));
      } else {
        state = { ...empty(), settings: { ...empty().settings, ...(d.settings || {}) }, cases: valid };
      }
      save();
      return valid.length;
    },
  };
}
