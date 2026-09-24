import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSession, chainsOf, executionOrder, nextSet, restAfter, carryForward, finalize,
  smartEnd, nextPlan, planFromSession, differsFromPlan, estimateMinutes, stats, defaultTarget,
} from '../js/logic/session.js';
import { SEED_EXERCISES, SEED_PLANS } from '../js/seed.js';

const exercises = new Map(SEED_EXERCISES.map(e => [e.id, e]));
const planA = SEED_PLANS[0];

const mk = (sets, restSec, linkNext = false) => ({ target: { restSec, linkNext }, sets: Array.from({ length: sets }, () => ({ done: false })) });

test('supersets viram cadeias e alternam série a série', () => {
  const items = [mk(2, 60), mk(2, 20, true), mk(3, 90), mk(1, 45)];
  assert.deepEqual(chainsOf(items), [[0], [1, 2], [3]]);
  assert.deepEqual(executionOrder(items), [[0, 0], [0, 1], [1, 0], [2, 0], [1, 1], [2, 1], [2, 2], [3, 0]]);
});

test('linkNext no último item é ignorado', () => {
  assert.deepEqual(chainsOf([mk(1, 60), mk(1, 60, true)]), [[0], [1]]);
});

test('próxima série segue a ordem e volta ao início para pegar pendentes', () => {
  const items = [mk(2, 60), mk(2, 60)];
  items[0].sets[0].done = true;
  assert.deepEqual(nextSet(items, [0, 0]), [0, 1]);
  items[1].sets[0].done = true;
  assert.deepEqual(nextSet(items, [1, 0]), [1, 1]);
  items[1].sets[1].done = true;
  assert.deepEqual(nextSet(items, [1, 1]), [0, 1]); // ficou uma pendente lá atrás
  items[0].sets[1].done = true;
  assert.equal(nextSet(items, [0, 1]), null);
});

test('descanso: troca curta dentro do superset, descanso cheio ao fechar a rodada', () => {
  const items = [mk(3, 20, true), mk(3, 90)];
  assert.equal(restAfter(items, [0, 0], [1, 0]), 20);
  assert.equal(restAfter(items, [1, 0], [0, 1]), 90);
  // B acabou antes: A → A usa o descanso cheio do grupo
  assert.equal(restAfter(items, [0, 2], [0, 2]), 90);
});

test('memória de carga: propaga para as séries seguintes não editadas', () => {
  const it = { sets: [{ kg: 15 }, { kg: null }, { kg: 10, kgEdited: true }, { kg: 12, done: true }] };
  carryForward(it, 0);
  assert.deepEqual(it.sets.map(s => s.kg), [15, 15, 10, 12]);
});

test('sessão a partir do plano: pré-preenche carga sugerida pelo histórico', () => {
  const past = {
    id: 'old', kind: 'gym', date: '2026-09-10', startedAt: 1,
    items: [{ exerciseId: 'agachamento', sets: [60, 60, 60].map(kg => ({ kg, reps: 6, done: true, kind: 'normal' })) }],
  };
  const s = buildSession(planA, { exercises, sessions: [past], now: Date.parse('2026-09-12T10:00:00') });
  assert.equal(s.items.length, planA.items.length);
  const ag = s.items.find(i => i.exerciseId === 'agachamento');
  assert.equal(ag.suggestion.trend, 'up');
  assert.deepEqual(ag.sets.map(x => x.kg), [65, 65, 65]);
  assert.equal(ag.prev.length, 3);
  assert.equal(s.date, '2026-09-12');
});

test('finalizar mantém só séries feitas e calcula duração', () => {
  const s = buildSession(planA, { exercises, sessions: [], now: 0 });
  s.items[1].sets[0] = { ...s.items[1].sets[0], kg: 40, reps: 6, done: true, doneAt: 1000 };
  const f = finalize(s, { end: 30 * 60e3 });
  assert.equal(f.items.length, 1);
  assert.equal(f.items[0].sets.length, 1);
  assert.equal(f.durationSec, 1800);
  assert.equal('cursor' in f, false);
  assert.equal(stats(f).volume, 240);
});

test('término inteligente: treino esquecido aberto usa a hora da última série', () => {
  const s = { items: [{ sets: [{ doneAt: 1000 }, { doneAt: 5000 }] }] };
  assert.equal(smartEnd(s, 5000 + 60 * 60e3), 5000);
  assert.equal(smartEnd(s, 5000 + 60e3), 5000 + 60e3);
});

test('rotação: próximo treino depois do último feito', () => {
  assert.equal(nextPlan(SEED_PLANS, []).id, 'plan-a');
  assert.equal(nextPlan(SEED_PLANS, [{ kind: 'gym', planId: 'plan-a', date: '2026-09-10' }]).id, 'plan-b');
  assert.equal(nextPlan(SEED_PLANS, [{ kind: 'gym', planId: 'plan-b', date: '2026-09-10' }, { kind: 'gym', planId: 'plan-a', date: '2026-09-08' }]).id, 'plan-a');
});

test('atualizar o plano com o que foi feito', () => {
  const s = buildSession(planA, { exercises, sessions: [], now: 0 });
  s.items.forEach(it => it.sets.forEach(x => { x.done = true; x.reps = 8; }));
  assert.equal(differsFromPlan(s, planA), false);
  s.items[1].sets.push({ done: true, reps: 5, kind: 'normal' });
  assert.equal(differsFromPlan(s, planA), true);
  const items = planFromSession(s, planA);
  assert.equal(items[1].sets, 4);
  assert.equal(items[1].id, 'a2');
});

test('meta padrão depende do tipo de exercício', () => {
  const ex = id => exercises.get(id);
  assert.deepEqual([defaultTarget(ex('prancha')).repsMin, defaultTarget(ex('prancha')).repsMax], [30, 60]);
  assert.equal(defaultTarget(ex('agachamento')).restSec, 120);
  assert.equal(defaultTarget(ex('rosca_alternada')).repsMax, 12);
});

test('estimativa de duração do treino A fica numa faixa plausível', () => {
  const m = estimateMinutes(planA.items);
  assert.ok(m > 20 && m < 60, `estimativa ${m} min`);
});
