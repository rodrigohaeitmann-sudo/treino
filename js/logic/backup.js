// Backup em JSON (exportar/importar) e migração do artefato antigo ("Diário de treino").
import { isoDate } from './format.js';

export const BACKUP_APP = 'treino';
export const BACKUP_VERSION = 1;

export function makeBackup({ exercises, plans, sessions }, now = Date.now()) {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), exercises, plans, sessions };
}

const LEGACY_PLAN = { A: 'plan-a', B: 'plan-b' };
const LEGACY_CARDIO = { run: 'corrida', volei: 'volei' };

/**
 * Converte registros do artefato antigo para o formato atual.
 * @param {Array} docs  registros no formato {id, kind:'gym'|'run'|'volei', ...}
 * @param {{exercises: Map, plans: Map}} ctx  biblioteca e planos atuais (para nomes e metas)
 */
export function fromLegacy(docs, { exercises, plans }) {
  const out = [];
  for (const d of docs || []) {
    if (!d || !d.id || !d.date) continue;
    // O artefato não guardava o horário real (ts = meio-dia + hora do salvamento, às vezes no dia seguinte):
    // o início fica ao meio-dia da data do treino.
    const noon = new Date(`${d.date}T12:00:00`).getTime();
    const ts = Number(d.ts) || noon;
    const base = { id: `legacy-${d.id}`, date: d.date, startedAt: noon, rpe: d.rpe ?? null, notes: d.notes || '', updatedAt: ts, deleted: false };
    if (d.kind === 'gym') {
      const planId = LEGACY_PLAN[d.workout] || null;
      const plan = plans.get(planId);
      const order = (plan?.items || []).map(pi => pi.exerciseId);
      const ids = Object.keys(d.sets || {}).sort((a, b) => rank(order, a) - rank(order, b));
      const items = ids.map((exId, n) => {
        const ex = exercises.get(exId) || { id: exId, name: exId, type: 'weight' };
        const pi = plan?.items.find(p => p.exerciseId === exId) || {};
        return {
          uid: `legacy-${d.id}-${n}`,
          exerciseId: exId,
          name: ex.name,
          group: ex.group || '',
          type: ex.type || 'weight',
          perSide: !!ex.perSide,
          barbell: !!ex.barbell,
          target: { sets: pi.sets ?? 3, repsMin: pi.repsMin ?? 8, repsMax: pi.repsMax ?? 12, restSec: pi.restSec ?? 90, linkNext: !!pi.linkNext, progression: pi.progression || 'double', increment: ex.increment ?? 0 },
          note: '',
          sets: (d.sets[exId] || []).map(s => ({ kg: numOrNull(s.kg), reps: numOrNull(s.reps), sec: null, done: true, doneAt: null, kind: 'normal', pr: null })),
        };
      }).filter(it => it.sets.length);
      // O artefato antigo às vezes guardava durações de dias (rascunho esquecido aberto).
      const dur = Number(d.durMin) > 0 && Number(d.durMin) <= 300 ? Number(d.durMin) * 60 : null;
      out.push({ ...base, kind: 'gym', planId, planName: plan?.name || `Treino ${d.workout || ''}`.trim(), finishedAt: dur ? noon + dur * 1000 : noon, durationSec: dur, items, bodyweight: numOrNull(d.bw) });
    } else if (LEGACY_CARDIO[d.kind]) {
      const durationSec = d.kind === 'run' ? numOrNull(d.sec) : (numOrNull(d.min) ?? 0) * 60 || null;
      out.push({ ...base, kind: 'cardio', activity: LEGACY_CARDIO[d.kind], distanceKm: d.kind === 'run' ? numOrNull(d.km) : null, durationSec, finishedAt: noon });
    }
  }
  return out;
}

const rank = (order, id) => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
function numOrNull(v) { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) ? null : n; }

/**
 * Lê um arquivo de backup (formato atual) ou uma lista do artefato antigo.
 * @returns {{exercises:Array, plans:Array, sessions:Array, legacy:boolean}}
 */
export function parseBackup(text, ctx) {
  let data;
  try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('Arquivo não é um JSON válido.'); }
  if (data && data.app === BACKUP_APP) {
    const arr = k => (Array.isArray(data[k]) ? data[k].filter(r => r && typeof r.id === 'string') : []);
    return { exercises: arr('exercises'), plans: arr('plans'), sessions: arr('sessions'), legacy: false };
  }
  const docs = Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : null;
  if (docs && docs.some(d => d && d.date && ['gym', 'run', 'volei'].includes(d.kind))) {
    return { exercises: [], plans: [], sessions: fromLegacy(docs, ctx), legacy: true };
  }
  throw new Error('Formato de backup não reconhecido.');
}

/** CSV com uma linha por série (bom para abrir no Sheets/Excel). */
export function setsCsv(sessions) {
  const head = ['data', 'treino', 'exercicio', 'serie', 'tipo', 'kg', 'reps', 'segundos', 'volume_kg'];
  const rows = [head];
  for (const s of [...sessions].filter(s => !s.deleted && s.kind === 'gym').sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const it of s.items || []) {
      it.sets.forEach((st, i) => rows.push([s.date, s.planName, it.name, i + 1, st.kind || 'normal', st.kg ?? '', st.reps ?? '', st.sec ?? '', st.kind === 'warmup' ? 0 : (st.kg || 0) * (st.reps || 0)]));
    }
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export const backupFileName = (now = Date.now()) => `treino-backup-${isoDate(now)}.json`;
