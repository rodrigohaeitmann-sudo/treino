// Montagem e andamento de uma sessão de treino (puro, sem DOM).
import { historyFor, suggest, workingSets, byNewest } from './progression.js';
import { uid, isoDate } from './format.js';

export const DEFAULT_TARGET = { sets: 3, repsMin: 8, repsMax: 12, restSec: 90, linkNext: false, progression: 'double' };

/** Meta padrão ao incluir um exercício num treino, conforme o tipo. */
export function defaultTarget(ex) {
  if (ex.type === 'time') return { ...DEFAULT_TARGET, repsMin: 30, repsMax: 60, restSec: 60, progression: 'none' };
  if (ex.type === 'reps') return { ...DEFAULT_TARGET, repsMin: 8, repsMax: 15, progression: 'double' };
  if (ex.barbell) return { ...DEFAULT_TARGET, repsMin: 5, repsMax: 8, restSec: 120 };
  return { ...DEFAULT_TARGET };
}

/** Menor salto de carga usado nos botões −/+ do exercício. */
export function stepFor(ex) {
  if (!ex) return 2.5;
  if (ex.barbell) return 2.5;
  return ex.increment > 0 ? ex.increment : 1;
}

/** Cria um item de sessão (exercício + séries pré-preenchidas com a sugestão). */
export function buildItem(ex, target, sessions, { note = '' } = {}) {
  const t = { ...DEFAULT_TARGET, ...target };
  const increment = t.increment ?? ex.increment ?? 0;
  const history = historyFor(sessions, ex.id);
  const sug = suggest({ type: ex.type, target: t, increment, step: stepFor(ex), history });
  const n = Math.max(1, t.sets | 0);
  return {
    uid: uid('i'),
    exerciseId: ex.id,
    name: ex.name,
    group: ex.group || '',
    type: ex.type || 'weight',
    perSide: !!ex.perSide,
    barbell: !!ex.barbell,
    step: stepFor(ex),
    target: { ...t, increment },
    note,
    suggestion: { kg: sug.kg, reps: sug.reps, trend: sug.trend, text: sug.text },
    prev: prevSets(history),
    sets: Array.from({ length: n }, () => newSet(sug.kg)),
  };
}

export const newSet = (kg = null) => ({ kg: kg ?? null, reps: null, sec: null, done: false, doneAt: null, kind: 'normal', kgEdited: false, pr: null });

/** Séries da última vez, para a coluna "Anterior". */
function prevSets(history) {
  const last = history[0];
  return last ? last.sets.map(s => ({ kg: s.kg ?? null, reps: s.reps ?? null, sec: s.sec ?? null })) : [];
}

/** Cria a sessão a partir de um plano (ou vazia, para treino livre). */
export function buildSession(plan, { exercises, sessions, now = Date.now() }) {
  const items = [];
  for (const pi of plan?.items || []) {
    const ex = exercises.get(pi.exerciseId);
    if (!ex || ex.deleted) continue;
    items.push(buildItem(ex, pi, sessions, { note: pi.note || '' }));
  }
  return {
    id: uid('s'),
    kind: 'gym',
    planId: plan?.id || null,
    planName: plan?.name || 'Treino livre',
    date: isoDate(now),
    startedAt: now,
    finishedAt: null,
    durationSec: null,
    items,
    cursor: null,
    rest: null,
    bodyweight: null,
    rpe: null,
    notes: '',
  };
}

/** Grupos de itens encadeados (superset/circuito) → [[0], [1, 2], [3]] */
export function chainsOf(items) {
  const out = [];
  let cur = [];
  items.forEach((it, i) => {
    cur.push(i);
    if (!(it.target?.linkNext && i < items.length - 1)) { out.push(cur); cur = []; }
  });
  return out;
}

/** Ordem de execução: supersets alternam série a série (A1 → B1 → A2 → B2 …). */
export function executionOrder(items) {
  const out = [];
  for (const chain of chainsOf(items)) {
    const n = Math.max(...chain.map(i => items[i].sets.length));
    for (let k = 0; k < n; k++) for (const i of chain) if (k < items[i].sets.length) out.push([i, k]);
  }
  return out;
}

const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

/** Próxima série pendente depois de `after` (ou a primeira pendente). */
export function nextSet(items, after = null) {
  const o = executionOrder(items);
  let start = 0;
  if (after) { const p = o.findIndex(r => same(r, after)); if (p >= 0) start = p + 1; }
  for (let j = 0; j < o.length; j++) {
    const [i, k] = o[(start + j) % o.length];
    if (!items[i].sets[k].done) return [i, k];
  }
  return null;
}

/**
 * Descanso depois de concluir `done` indo para `next`.
 * Dentro de um superset, trocar de exercício usa o descanso curto do item concluído;
 * ao fechar a rodada usa o maior descanso do grupo.
 */
export function restAfter(items, done, next) {
  const chain = chainsOf(items).find(c => c.includes(done[0])) || [done[0]];
  const it = items[done[0]];
  if (next && next[0] !== done[0] && chain.includes(next[0]) && chain.indexOf(next[0]) > chain.indexOf(done[0])) {
    return it.target?.restSec ?? 0;
  }
  return Math.max(...chain.map(i => items[i].target?.restSec ?? 0));
}

/** "Memória": a carga usada numa série vale para as próximas que o usuário ainda não mexeu. */
export function carryForward(item, from) {
  const kg = item.sets[from]?.kg;
  if (kg == null) return;
  for (let j = from + 1; j < item.sets.length; j++) {
    const s = item.sets[j];
    if (!s.done && !s.kgEdited) s.kg = kg;
  }
}

/** Repetições alvo exibidas como sugestão na série. */
export const targetReps = item => item.suggestion?.reps ?? item.target?.repsMax ?? item.target?.repsMin ?? null;

/** Volume (kg × reps) das séries válidas. */
export function volumeOf(items) {
  let v = 0;
  for (const it of items || []) for (const s of workingSets(it.sets)) v += (s.kg || 0) * (s.reps || 0);
  return Math.round(v);
}

export function stats(session) {
  const items = session?.items || [];
  const all = items.flatMap(it => it.sets);
  const done = all.filter(s => s.done);
  return {
    total: all.length,
    done: done.length,
    working: items.reduce((a, it) => a + workingSets(it.sets).length, 0),
    volume: volumeOf(items),
    reps: done.reduce((a, s) => a + (s.reps || 0), 0),
  };
}

/** Hora de término "inteligente": se o treino ficou esquecido aberto, usa a última série. */
export function smartEnd(session, now = Date.now(), idleMs = 20 * 60e3) {
  const last = Math.max(0, ...(session.items || []).flatMap(it => it.sets.map(s => s.doneAt || 0)));
  if (last && now - last > idleMs) return last;
  return now;
}

/** Sessão finalizada, só com séries feitas (exercícios sem séries ficam de fora). */
export function finalize(session, { end = Date.now() } = {}) {
  const items = session.items
    .map(it => ({ ...it, sets: it.sets.filter(s => s.done).map(({ kgEdited, ...s }) => s) }))
    .filter(it => it.sets.length)
    .map(({ prev, ...it }) => it);
  const { cursor, rest, ...base } = session;
  return {
    ...base,
    items,
    finishedAt: end,
    durationSec: Math.max(0, Math.round((end - session.startedAt) / 1000)),
  };
}

/** Atualiza a estrutura de um plano com o que foi feito na sessão (exercícios, ordem, nº de séries). */
export function planFromSession(session, plan) {
  const old = new Map((plan?.items || []).map(pi => [pi.exerciseId, pi]));
  return session.items
    .filter(it => it.sets.some(s => s.done))
    .map(it => {
      const base = old.get(it.exerciseId) || old.get(it.swappedFrom) || {};
      const sets = workingSets(it.sets).length || it.target.sets;
      return {
        id: base.id || uid('pi'),
        exerciseId: it.exerciseId,
        sets,
        repsMin: it.target.repsMin,
        repsMax: it.target.repsMax,
        restSec: it.target.restSec,
        linkNext: !!it.target.linkNext,
        progression: it.target.progression,
        increment: base.increment ?? null,
        note: it.note || base.note || '',
      };
    });
}

/** A estrutura da sessão difere do plano? (para oferecer "atualizar o treino"). */
export function differsFromPlan(session, plan) {
  if (!plan) return false;
  const done = session.items.filter(it => it.sets.some(s => s.done));
  const a = done.map(it => `${it.exerciseId}:${workingSets(it.sets).length}`).join('|');
  const b = (plan.items || []).map(pi => `${pi.exerciseId}:${pi.sets}`).join('|');
  return a !== b;
}

/** Próximo treino na rotação (depois do último feito). */
export function nextPlan(plans, sessions) {
  const list = plans.filter(p => !p.deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!list.length) return null;
  const last = [...sessions].filter(s => !s.deleted && s.kind === 'gym' && s.planId).sort(byNewest)[0];
  if (!last) return list[0];
  const i = list.findIndex(p => p.id === last.planId);
  return i < 0 ? list[0] : list[(i + 1) % list.length];
}

/** Estimativa de duração do plano em minutos (≈40 s por série + descansos). */
export function estimateMinutes(items) {
  let sec = 0;
  const fake = (items || []).map(pi => ({ target: pi, sets: Array.from({ length: pi.sets || 0 }, () => ({})) }));
  const order = executionOrder(fake);
  order.forEach((r, j) => {
    sec += 40;
    if (j < order.length - 1) sec += restAfter(fake, r, order[j + 1]);
  });
  return Math.round(sec / 60);
}
