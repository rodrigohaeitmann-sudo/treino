// Ações do treino em andamento (usadas pela tela de treino e pelos cronômetros).
import { state, saveActive, upsert, emit, get, list } from './state.js';
import {
  buildSession, buildItem, nextSet, restAfter, carryForward, targetReps, finalize, planFromSession, newSet, defaultTarget,
} from './logic/session.js';
import { historyFor, records, checkPR } from './logic/progression.js';
import { fmtKg, uid } from './logic/format.js';
import * as timer from './timer.js';
import { toast, vibrate } from './ui.js';
import { syncQuiet } from './sync.js';

const changed = (detail = {}) => { saveActive(); emit('active', detail); };

export function startSession(plan) {
  timer.unlockAudio();
  state.active = buildSession(plan, { exercises: state.exercises, sessions: list.gym() });
  state.active.cursor = nextSet(state.active.items);
  saveActive({ now: true });
  timer.keepAwake();
  emit('active', { started: true });
}

/** Série "da vez": a escolhida pelo usuário ou a próxima pendente. */
export function current() {
  const s = state.active;
  if (!s) return null;
  const c = s.cursor;
  if (c && s.items[c[0]]?.sets[c[1]] && !s.items[c[0]].sets[c[1]].done) return c;
  return nextSet(s.items, s.lastDone || null);
}

export function setCursor(ref) {
  state.active.cursor = ref;
  changed({ cursor: ref });
}

/** Descrição da próxima série, para o painel de descanso e para a voz. */
export function nextInfo(ref, fromItem = null) {
  const it = state.active.items[ref[0]];
  const st = it.sets[ref[1]];
  return {
    name: it.name,
    setNo: ref[1] + 1,
    of: it.sets.length,
    kg: it.type === 'weight' ? st.kg : null,
    reps: it.type === 'time' ? null : (st.reps ?? targetReps(it)),
    sec: it.type === 'time' ? (st.sec ?? targetReps(it)) : null,
    transition: fromItem != null && ref[0] !== fromItem,
  };
}

/** Marca (ou desmarca) uma série como feita e já dispara o descanso certo. */
export function completeSet(i, k, { sec = null } = {}) {
  const s = state.active;
  const it = s.items[i];
  const st = it?.sets[k];
  if (!st) return;
  if (st.done) {
    Object.assign(st, { done: false, doneAt: null, pr: null });
    s.cursor = [i, k];
    changed({ undone: [i, k] });
    return;
  }
  if (it.type === 'time') st.sec = sec ?? st.sec ?? targetReps(it);
  else if (st.reps == null) st.reps = targetReps(it);
  if (st.kg == null && k > 0 && it.sets[k - 1].kg != null) st.kg = it.sets[k - 1].kg;
  st.done = true;
  st.doneAt = Date.now();
  carryForward(it, k);

  st.pr = null;
  if (it.type !== 'time' && st.kind !== 'warmup') {
    const rec = records(historyFor(list.gym(), it.exerciseId));
    st.pr = checkPR(st, rec, it.sets.filter((x, j) => j !== k && x.done));
    if (st.pr) toast(st.pr === 'kg' ? `Recorde de carga em ${it.name}: ${fmtKg(st.kg)} kg!` : `Recorde de força estimada em ${it.name}!`, { ms: 3500 });
  }
  s.lastDone = [i, k];
  s.cursor = null;
  vibrate(30);

  const nxt = nextSet(s.items, [i, k]);
  if (!nxt) {
    timer.stopRest();
    toast('Todas as séries feitas. Finalize o treino quando quiser.', { ms: 3500 });
  } else if (state.settings.autoRest) {
    const secs = restAfter(s.items, [i, k], nxt);
    if (secs > 0) timer.startRest(secs, nextInfo(nxt, i));
  }
  changed({ done: [i, k], next: nxt });
}

/** Altera carga/reps/tempo de uma série; a carga "lembra" nas séries seguintes. */
export function editSet(i, k, field, value) {
  const it = state.active.items[i];
  const st = it.sets[k];
  st[field] = value;
  if (field === 'kg') { st.kgEdited = true; carryForward(it, k); }
  saveActive();
}

export function stepSet(i, k, field, dir) {
  const it = state.active.items[i];
  const st = it.sets[k];
  if (field === 'kg') {
    // sem carga ainda: barra olímpica começa no peso da barra; demais, no primeiro degrau
    const next = st.kg == null ? (it.barbell ? state.settings.bar : dir > 0 ? it.step : 0) : st.kg + dir * it.step;
    editSet(i, k, 'kg', Math.max(0, Math.round(next * 100) / 100));
  } else if (field === 'sec') {
    editSet(i, k, 'sec', Math.max(5, (st.sec ?? targetReps(it) ?? 30) + dir * 5));
  } else {
    editSet(i, k, 'reps', Math.max(0, (st.reps ?? targetReps(it) ?? 0) + dir));
  }
  emit('active', { edit: [i, k] });
}

export function cycleKind(i, k) {
  const st = state.active.items[i].sets[k];
  st.kind = st.kind === 'normal' ? 'warmup' : st.kind === 'warmup' ? 'drop' : 'normal';
  changed({ item: i });
}

export function addSet(i) {
  const it = state.active.items[i];
  const last = it.sets[it.sets.length - 1];
  it.sets.push(newSet(last?.kg ?? it.suggestion?.kg ?? null));
  changed({ item: i });
}

export function removeSet(i) {
  const it = state.active.items[i];
  const k = it.sets.map(s => s.done).lastIndexOf(false);
  if (k < 0) { toast('Todas as séries deste exercício já foram feitas.'); return; }
  it.sets.splice(k, 1);
  if (!it.sets.length) { removeItem(i); return; }
  changed({ item: i });
}

function fixRefsAfterRemoval(i) {
  const s = state.active;
  for (const key of ['cursor', 'lastDone']) {
    const r = s[key];
    if (!r) continue;
    if (r[0] === i) s[key] = null;
    else if (r[0] > i) s[key] = [r[0] - 1, r[1]];
  }
}

export function removeItem(i) {
  const s = state.active;
  // Quem apontava para este item como "próximo do superset" passa a apontar para o seguinte.
  if (i > 0 && s.items[i - 1].target.linkNext && !s.items[i].target.linkNext) s.items[i - 1].target.linkNext = false;
  s.items.splice(i, 1);
  fixRefsAfterRemoval(i);
  changed({ structure: true });
}

export function moveItemToEnd(i) {
  const s = state.active;
  const [it] = s.items.splice(i, 1);
  if (i > 0 && s.items[i - 1].target.linkNext && !it.target.linkNext) s.items[i - 1].target.linkNext = false;
  it.target.linkNext = false;
  s.items.push(it);
  fixRefsAfterRemoval(i);
  changed({ structure: true });
}

export function addItem(ex, target = {}) {
  const s = state.active;
  const it = buildItem(ex, { ...defaultTarget(ex), increment: ex.increment, ...target }, list.gym());
  s.items.push(it);
  changed({ structure: true });
  return s.items.length - 1;
}

/** Troca o exercício (aparelho ocupado), mantendo séries/metas; as já feitas ficam no original. */
export function swapItem(i, ex) {
  const s = state.active;
  const old = s.items[i];
  const done = old.sets.filter(x => x.done);
  const fresh = buildItem(ex, { ...old.target, increment: ex.increment }, list.gym(), { note: old.note });
  fresh.swappedFrom = old.exerciseId;
  fresh.target.linkNext = old.target.linkNext;
  const remaining = Math.max(1, old.sets.length - done.length);
  fresh.sets = fresh.sets.slice(0, 1).concat(Array.from({ length: remaining - 1 }, () => newSet(fresh.suggestion.kg)));
  if (done.length) {
    old.sets = done;
    old.target.linkNext = false;
    s.items.splice(i + 1, 0, fresh);
  } else {
    s.items[i] = fresh;
    if (s.cursor?.[0] === i) s.cursor = [i, 0];
  }
  changed({ structure: true });
}

export async function saveSetupNote(exerciseId, text) {
  const ex = get.exercise(exerciseId);
  if (!ex) return;
  ex.setup = text;
  await upsert('exercises', ex);
}

export async function finishSession({ end, rpe = null, bodyweight = null, notes = '', updatePlan = false }) {
  const s = state.active;
  const saved = finalize({ ...s, rpe, bodyweight, notes }, { end });
  saved.id = saved.id || uid('s');
  await upsert('sessions', saved);
  if (updatePlan && s.planId) {
    const plan = get.plan(s.planId);
    if (plan) { plan.items = planFromSession(s, plan); await upsert('plans', plan); }
  }
  timer.stopRest();
  timer.releaseAwake();
  state.active = null;
  await saveActive({ now: true });
  emit('active', { finished: saved.id });
  syncQuiet();
  return saved;
}

export async function discardSession() {
  timer.stopRest();
  timer.releaseAwake();
  state.active = null;
  await saveActive({ now: true });
  emit('active', { discarded: true });
}

export async function saveCardio({ activity, date, durationSec, distanceKm, rpe, notes }) {
  const now = Date.now();
  const rec = { id: uid('c'), kind: 'cardio', activity, date, startedAt: now, finishedAt: now, durationSec, distanceKm, rpe, notes };
  await upsert('sessions', rec);
  syncQuiet();
  return rec;
}
