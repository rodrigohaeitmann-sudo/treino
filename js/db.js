// Persistência local: IndexedDB (com localStorage de reserva se o navegador bloquear o IndexedDB).
// Todas as coleções são carregadas em memória na abertura — os dados de um atleta cabem folgados.

const DB_NAME = 'treino';
const DB_VERSION = 1;
export const STORES = ['exercises', 'plans', 'sessions', 'meta'];

let backend = null;

function idbBackend(db) {
  const tx = (store, mode) => db.transaction(store, mode).objectStore(store);
  const req = r => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
  return {
    kind: 'indexeddb',
    async entries(store) {
      const os = tx(store, 'readonly');
      const [keys, values] = await Promise.all([req(os.getAllKeys()), req(os.getAll())]);
      return keys.map((k, i) => [k, values[i]]);
    },
    put: (store, key, value) => req(tx(store, 'readwrite').put(value, key)),
    putMany(store, pairs) {
      return new Promise((ok, fail) => {
        const t = db.transaction(store, 'readwrite');
        const os = t.objectStore(store);
        for (const [k, v] of pairs) os.put(v, k);
        t.oncomplete = () => ok();
        t.onerror = () => fail(t.error);
      });
    },
    del: (store, key) => req(tx(store, 'readwrite').delete(key)),
    clear: store => req(tx(store, 'readwrite').clear()),
  };
}

function lsBackend() {
  const k = (store, key) => `treino:${store}:${key}`;
  const prefix = store => `treino:${store}:`;
  return {
    kind: 'localstorage',
    async entries(store) {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(prefix(store))) {
          try { out.push([key.slice(prefix(store).length), JSON.parse(localStorage.getItem(key))]); } catch { /* ignora registro corrompido */ }
        }
      }
      return out;
    },
    async put(store, key, value) { localStorage.setItem(k(store, key), JSON.stringify(value)); },
    async putMany(store, pairs) { for (const [key, v] of pairs) localStorage.setItem(k(store, key), JSON.stringify(v)); },
    async del(store, key) { localStorage.removeItem(k(store, key)); },
    async clear(store) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith(prefix(store))) keys.push(key); }
      keys.forEach(key => localStorage.removeItem(key));
    },
  };
}

function openIdb() {
  return new Promise((ok, fail) => {
    if (!('indexedDB' in globalThis)) { fail(new Error('sem IndexedDB')); return; }
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
    r.onblocked = () => fail(new Error('IndexedDB bloqueado'));
  });
}

export async function openDb() {
  if (backend) return backend;
  try { backend = idbBackend(await openIdb()); } catch { backend = lsBackend(); }
  // Pede ao navegador para não apagar os dados quando faltar espaço.
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
  return backend;
}

export const db = {
  entries: (s) => backend.entries(s),
  put: (s, k, v) => backend.put(s, k, v),
  putMany: (s, pairs) => backend.putMany(s, pairs),
  del: (s, k) => backend.del(s, k),
  clear: (s) => backend.clear(s),
  get kind() { return backend?.kind; },
};
