// Sincronização com a planilha Google (Apps Script publicado como App da Web).
// O app funciona 100% offline; quando há internet, envia o que mudou e recebe o que veio de outros aparelhos.
import { state, applyRemote, saveSync, emit, on } from './state.js';
import { COLLECTIONS, pendingChanges, mergeIncoming, countChanges } from './logic/sync-merge.js';

let running = null;
let timer = null;

export const isConfigured = () => !!(state.sync.url && state.sync.token);

async function call(payload, { timeoutMs = 45000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // text/plain evita o "preflight" de CORS, que o Apps Script não responde.
    const res = await fetch(state.sync.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, token: state.sync.token }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error(/<html/i.test(text) ? 'A URL não respondeu JSON. Confira se a implantação é "App da Web" com acesso "Qualquer pessoa".' : 'Resposta inválida da planilha.');
    }
    if (!data.ok) throw new Error(data.error || 'Erro na planilha.');
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('A planilha demorou demais para responder.');
    if (e instanceof TypeError) throw new Error('Sem conexão com a planilha (offline ou URL incorreta).');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Testa a conexão e devolve quantos registros há na planilha. */
export const ping = () => call({ action: 'ping' });

/**
 * Envia alterações locais e recebe as remotas.
 * @returns {Promise<{sent:number, received:number}>}
 */
export function syncNow() {
  if (!isConfigured()) return Promise.resolve({ sent: 0, received: 0, skipped: true });
  if (running) return running;
  running = (async () => {
    state.sync.status = 'syncing';
    emit('sync');
    const startedAt = Date.now();
    const changes = pendingChanges(state, state.sync.lastPushAt);
    try {
      const res = await call({ action: 'sync', since: state.sync.cursor || 0, changes });
      let received = 0;
      for (const c of COLLECTIONS) {
        const apply = mergeIncoming(state[c], res.changes?.[c]);
        received += apply.length;
        await applyRemote(c, apply);
      }
      Object.assign(state.sync, { cursor: res.cursor, lastPushAt: startedAt, lastSyncAt: Date.now(), lastError: '', status: 'ok' });
      await saveSync();
      return { sent: countChanges(changes), received };
    } catch (e) {
      Object.assign(state.sync, { lastError: e.message, status: 'error' });
      await saveSync();
      throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sincroniza sem incomodar (erros ficam no indicador). */
export function syncQuiet() {
  if (!isConfigured() || !state.sync.auto || !navigator.onLine) return;
  syncNow().catch(() => {});
}

/** Agenda uma sincronização alguns segundos depois de uma edição. */
export function initAutoSync() {
  on('dirty', () => { clearTimeout(timer); timer = setTimeout(syncQuiet, 5000); });
  addEventListener('online', syncQuiet);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncQuiet(); });
  syncQuiet();
}

export const hasPending = () => countChanges(pendingChanges(state, state.sync.lastPushAt)) > 0;
