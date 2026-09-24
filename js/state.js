// Estado do app em memória + gravação no banco local + eventos de mudança.
import { db, openDb } from './db.js';
import { SEED_EXERCISES, SEED_PLANS } from './seed.js';
import { byNewest } from './logic/progression.js';
import { DEFAULT_PLATES } from './logic/plates.js';

export const DEFAULT_SETTINGS = {
  sound: true,        // bipes do descanso
  vibrate: true,      // vibração (Android)
  voice: false,       // anunciar o próximo exercício por voz
  warnSec: 5,         // aviso antes do fim do descanso
  autoRest: true,     // iniciar descanso ao concluir a série
  keepAwake: true,    // manter a tela ligada durante o treino
  volume: 0.8,
  bar: 20,
  plates: DEFAULT_PLATES,
  theme: 'auto',
};
export const DEFAULT_SYNC = { url: '', token: '', auto: true, cursor: 0, lastPushAt: 0, lastSyncAt: 0, lastError: '' };

export const state = {
  exercises: new Map(),
  plans: new Map(),
  sessions: new Map(),
  active: null,
  settings: { ...DEFAULT_SETTINGS },
  sync: { ...DEFAULT_SYNC },
  storage: '',
};

const bus = new EventTarget();
/** Assina um evento; devolve a função que cancela a assinatura. */
export function on(type, fn) {
  const h = e => fn(e.detail);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

export async function load() {
  await openDb();
  state.storage = db.kind;
  for (const c of ['exercises', 'plans', 'sessions']) {
    for (const [k, v] of await db.entries(c)) state[c].set(k, v);
  }
  const meta = new Map(await db.entries('meta'));
  state.settings = { ...DEFAULT_SETTINGS, ...(meta.get('settings') || {}) };
  state.sync = { ...DEFAULT_SYNC, ...(meta.get('sync') || {}) };
  state.active = meta.get('active') || null;

  // Exercícios novos da biblioteca padrão entram em atualizações do app; planos só na 1ª abertura.
  const missing = SEED_EXERCISES.filter(e => !state.exercises.has(e.id));
  if (missing.length) {
    missing.forEach(e => state.exercises.set(e.id, structuredClone(e)));
    await db.putMany('exercises', missing.map(e => [e.id, e]));
  }
  if (!meta.get('seeded')) {
    const plans = SEED_PLANS.filter(p => !state.plans.has(p.id));
    plans.forEach(p => state.plans.set(p.id, structuredClone(p)));
    await db.putMany('plans', plans.map(p => [p.id, p]));
    await db.put('meta', 'seeded', 1);
  }
}

const COLL = ['exercises', 'plans', 'sessions'];

/** Grava um registro (marca updatedAt para a sincronização). */
export async function upsert(coll, rec, { touch = true } = {}) {
  if (!COLL.includes(coll) || !rec?.id) throw new Error('registro inválido');
  if (touch) rec.updatedAt = Math.max(Date.now(), (rec.updatedAt || 0) + 1);
  state[coll].set(rec.id, rec);
  await db.put(coll, rec.id, rec);
  emit('change', { coll, id: rec.id });
  if (touch) emit('dirty');
  return rec;
}

/** Exclusão sincronizável: guarda só uma "lápide" com deleted = true. */
export async function remove(coll, id) {
  const cur = state[coll].get(id);
  if (!cur) return;
  const tomb = { id, deleted: true, updatedAt: cur.updatedAt };
  if (coll === 'sessions') Object.assign(tomb, { kind: cur.kind, date: cur.date });
  return upsert(coll, tomb);
}

/** Registros recebidos da planilha (não mexe no updatedAt). */
export async function applyRemote(coll, recs) {
  if (!recs.length) return;
  recs.forEach(r => state[coll].set(r.id, r));
  await db.putMany(coll, recs.map(r => [r.id, r]));
  emit('change', { coll, remote: true });
}

const alive = m => [...m.values()].filter(r => r && !r.deleted);
export const list = {
  exercises: () => alive(state.exercises).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  plans: () => alive(state.plans).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'pt-BR')),
  sessions: () => alive(state.sessions).sort(byNewest),
  gym: () => alive(state.sessions).filter(s => s.kind === 'gym').sort(byNewest),
};
export const get = {
  exercise: id => { const r = state.exercises.get(id); return r && !r.deleted ? r : null; },
  plan: id => { const r = state.plans.get(id); return r && !r.deleted ? r : null; },
  session: id => { const r = state.sessions.get(id); return r && !r.deleted ? r : null; },
};

// ---- treino em andamento (gravado a cada mudança, com pequeno atraso) ----
let activeTimer = null;
export function saveActive({ now = false } = {}) {
  clearTimeout(activeTimer);
  const write = () => (state.active ? db.put('meta', 'active', state.active) : db.del('meta', 'active')).catch(() => {});
  if (now) return write();
  activeTimer = setTimeout(write, 300);
}

export async function saveSettings() {
  await db.put('meta', 'settings', state.settings);
  emit('settings');
}
export async function saveSync() {
  await db.put('meta', 'sync', state.sync);
  emit('sync');
}

/** Apaga tudo deste aparelho (não mexe na planilha). */
export async function wipe() {
  for (const s of ['exercises', 'plans', 'sessions', 'meta']) await db.clear(s);
}
