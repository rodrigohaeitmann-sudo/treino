// Regras de sincronização: cada registro tem id, updatedAt (ms) e deleted.
// Vence a versão mais recente (last-writer-wins) — suficiente para um usuário com poucos aparelhos.

export const COLLECTIONS = ['exercises', 'plans', 'sessions'];

/** Registros de cada coleção alterados depois de `since`. */
export function pendingChanges(maps, since = 0) {
  const out = {};
  for (const c of COLLECTIONS) {
    out[c] = [...(maps[c]?.values() || [])].filter(r => (r.updatedAt || 0) > since);
  }
  return out;
}

export const countChanges = ch => COLLECTIONS.reduce((a, c) => a + (ch[c]?.length || 0), 0);

/** Quais registros recebidos devem substituir os locais. */
export function mergeIncoming(local, incoming) {
  const apply = [];
  for (const rec of incoming || []) {
    if (!rec || typeof rec.id !== 'string' || !rec.id) continue;
    const cur = local.get(rec.id);
    if (!cur || (Number(rec.updatedAt) || 0) > (Number(cur.updatedAt) || 0)) apply.push(rec);
  }
  return apply;
}
