// Histórico por exercício, sugestão de carga (progressão) e detecção de recordes.
// Tudo puro: recebe dados, devolve dados.
import { fmtKg, fmtNum, fmtDate, roundTo } from './format.js';

/** 1RM estimado (Epley). */
export function e1rm(kg, reps) {
  if (!(kg > 0) || !(reps > 0)) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/** Séries válidas (feitas e que não são aquecimento). */
export const workingSets = sets => (sets || []).filter(s => s && s.done && s.kind !== 'warmup');

/** Ordena sessões da mais recente para a mais antiga. */
export function byNewest(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.startedAt || 0) - (a.startedAt || 0);
}

/**
 * Histórico de um exercício: [{date, sessionId, sets}] do mais recente ao mais antigo,
 * só com sessões de musculação finalizadas que tenham ao menos uma série válida.
 */
export function historyFor(sessions, exerciseId, { excludeId = null } = {}) {
  const out = [];
  for (const s of [...sessions].sort(byNewest)) {
    if (!s || s.deleted || s.kind !== 'gym' || s.id === excludeId) continue;
    const sets = (s.items || []).filter(it => it.exerciseId === exerciseId).flatMap(it => workingSets(it.sets));
    if (sets.length) out.push({ date: s.date, sessionId: s.id, sets });
  }
  return out;
}

const maxKg = sets => {
  const kgs = sets.map(s => s.kg).filter(k => k != null && Number.isFinite(k));
  return kgs.length ? Math.max(...kgs) : null;
};
const minOf = (sets, f) => {
  const v = sets.map(s => s[f]).filter(x => x != null && Number.isFinite(x));
  return v.length ? Math.min(...v) : null;
};
const setsTxt = (sets, type) => sets.map(s => {
  if (type === 'time') return `${fmtNum(s.sec, 0)}s`;
  const r = s.reps ?? '–';
  return s.kg > 0 ? `${fmtKg(s.kg)}×${r}` : `×${r}`; // carga 0 = só o peso do corpo
}).join(', ');

/**
 * Sugestão para a próxima sessão.
 * @param {object} p
 * @param {'weight'|'reps'|'time'} p.type
 * @param {{sets:number, repsMin:number, repsMax:number, progression:'double'|'linear'|'none'}} p.target
 * @param {number} p.increment  kg a somar quando progredir
 * @param {number} p.step       menor variação possível de carga (para arredondar deload)
 * @param {Array} p.history     saída de historyFor()
 * @returns {{kg:number|null, reps:number|null, trend:'first'|'up'|'same'|'down', text:string, lastDate:string|null, lastSets:Array}}
 */
export function suggest({ type = 'weight', target, increment = 0, step = 0, history = [] }) {
  const t = { sets: 3, repsMin: 8, repsMax: 12, progression: 'double', ...target };
  if (t.repsMax == null || t.repsMax < t.repsMin) t.repsMax = t.repsMin;
  const last = history[0];
  if (!last) {
    const text = type === 'weight'
      ? 'Primeira vez: escolha uma carga que deixe 2–3 repetições sobrando.'
      : type === 'time' ? 'Primeira vez: registre quanto tempo aguentou com boa técnica.' : 'Primeira vez: registre as repetições com boa técnica.';
    return { kg: null, reps: t.repsMax, trend: 'first', text, lastDate: null, lastSets: [] };
  }
  const sets = last.sets;
  const lastTxt = `Última (${fmtDate(last.date)}): ${setsTxt(sets, type)}`;
  const base = { lastDate: last.date, lastSets: sets };

  if (type === 'time') {
    const lo = minOf(sets, 'sec');
    const goal = lo == null ? t.repsMax : Math.min(t.repsMax || Infinity, lo + 5);
    return { ...base, kg: maxKg(sets), reps: goal, trend: 'same', text: `${lastTxt}. Meta: ${fmtNum(goal, 0)} s por série.` };
  }

  const top = maxKg(sets);
  const lowReps = minOf(sets, 'reps');
  const enough = sets.length >= t.sets;
  const allAtMax = enough && sets.every(s => (s.reps || 0) >= t.repsMax);
  const allAtMin = enough && sets.every(s => (s.reps || 0) >= t.repsMin);
  const beatReps = lowReps == null ? t.repsMin : Math.min(t.repsMax, Math.max(t.repsMin, lowReps + 1));

  // Sem carga registrada (exercício de peso corporal, ou carga não anotada).
  if (type === 'reps' || top == null || top === 0) {
    if (t.progression === 'none') {
      return { ...base, kg: top, reps: t.repsMax, trend: 'same', text: `${lastTxt}. Mantenha: ${t.repsMax} reps com qualidade máxima.` };
    }
    const extra = type === 'weight' && top == null ? ' Registre a carga desta vez para receber sugestões.' : '';
    if (allAtMax && type === 'reps') {
      return { ...base, kg: top, reps: t.repsMax, trend: 'up', text: `${lastTxt}. Topo da faixa em todas as séries: adicione carga ou use uma variação mais difícil.` };
    }
    return { ...base, kg: top, reps: beatReps, trend: 'same', text: `${lastTxt}. Meta: ${beatReps} reps por série.${extra}` };
  }

  const inc = increment > 0 ? increment : 0;
  const prog = t.progression;

  if (prog !== 'none' && inc) {
    const success = prog === 'linear' ? allAtMin : allAtMax;
    if (success) {
      const kg = roundTo(top + inc, 0.01);
      const why = prog === 'linear' ? `completou ${t.sets}×${t.repsMin}` : `bateu ${t.repsMax} reps em todas as séries`;
      return { ...base, kg, reps: t.repsMin, trend: 'up', text: `${lastTxt}. Você ${why}: suba para ${fmtKg(kg)} kg.` };
    }
    // Estagnação: duas sessões seguidas abaixo do mínimo com a mesma carga → deload ~10%.
    const prev = history[1];
    const failed = h => maxKg(h.sets) === top && h.sets.some(s => (s.reps || 0) < t.repsMin);
    if (prev && failed(last) && failed(prev)) {
      const kg = Math.max(0, roundTo(top * 0.9, step || 1));
      return { ...base, kg, reps: t.repsMax, trend: 'down', text: `${lastTxt}. Duas sessões abaixo de ${t.repsMin} reps com ${fmtKg(top)} kg: reduza para ${fmtKg(kg)} kg e reconstrua.` };
    }
  }
  const goal = prog === 'linear' ? t.repsMin : beatReps;
  const tip = prog === 'none' ? 'Mantenha a carga.' : `Mantenha ${fmtKg(top)} kg e busque ${goal} reps por série.`;
  return { ...base, kg: top, reps: goal, trend: 'same', text: `${lastTxt}. ${tip}` };
}

/** Melhores marcas históricas de um exercício. */
export function records(history) {
  let bestE = 0, bestKg = 0;
  for (const h of history) for (const s of h.sets) {
    bestE = Math.max(bestE, e1rm(s.kg, s.reps));
    if (s.kg > 0 && s.reps > 0) bestKg = Math.max(bestKg, s.kg);
  }
  return { e1rm: bestE, kg: bestKg };
}

/**
 * Verifica se a série é recorde frente ao histórico e às séries já feitas na sessão.
 * @returns {'kg'|'e1rm'|null}  'kg' = maior carga já usada; 'e1rm' = maior força estimada.
 */
export function checkPR(set, rec, earlier = []) {
  if (!set || !set.done || set.kind === 'warmup' || !(set.kg > 0) || !(set.reps > 0)) return null;
  if (!rec || (!rec.kg && !rec.e1rm)) return null; // sem histórico, não há recorde a bater
  const prior = workingSets(earlier);
  const sessKg = Math.max(0, ...prior.filter(s => s.reps > 0).map(s => s.kg || 0));
  const sessE = Math.max(0, ...prior.map(s => e1rm(s.kg, s.reps)));
  if (set.kg > rec.kg && set.kg > sessKg) return 'kg';
  const e = e1rm(set.kg, set.reps);
  if (e > rec.e1rm + 0.05 && e > sessE + 0.05) return 'e1rm';
  return null;
}
