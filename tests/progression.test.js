import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, historyFor, records, checkPR, e1rm } from '../js/logic/progression.js';

const S = (kg, reps, extra = {}) => ({ kg, reps, done: true, kind: 'normal', ...extra });
const H = (date, sets) => ({ date, sessionId: date, sets });
const target = { sets: 3, repsMin: 8, repsMax: 10, progression: 'double' };

test('primeira vez: sem carga sugerida', () => {
  const r = suggest({ type: 'weight', target, increment: 2, history: [] });
  assert.equal(r.kg, null);
  assert.equal(r.trend, 'first');
});

test('progressão dupla: topo da faixa em todas as séries → sobe a carga', () => {
  const r = suggest({ type: 'weight', target, increment: 2, history: [H('2026-09-10', [S(20, 10), S(20, 10), S(20, 10)])] });
  assert.equal(r.kg, 22);
  assert.equal(r.reps, 8);
  assert.equal(r.trend, 'up');
  assert.match(r.text, /suba para 22 kg/);
});

test('progressão dupla: ainda não bateu o topo → mantém carga e pede +1 rep', () => {
  const r = suggest({ type: 'weight', target, increment: 2, history: [H('2026-09-10', [S(20, 10), S(20, 9), S(20, 8)])] });
  assert.equal(r.kg, 20);
  assert.equal(r.reps, 9);
  assert.equal(r.trend, 'same');
});

test('não sobe se fez menos séries que o planejado', () => {
  const r = suggest({ type: 'weight', target, increment: 2, history: [H('2026-09-10', [S(20, 10), S(20, 10)])] });
  assert.equal(r.kg, 20);
});

test('progressão linear: completou o mínimo → sobe', () => {
  const t = { sets: 3, repsMin: 5, repsMax: 5, progression: 'linear' };
  const r = suggest({ type: 'weight', target: t, increment: 5, history: [H('2026-09-10', [S(60, 5), S(60, 5), S(60, 5)])] });
  assert.equal(r.kg, 65);
});

test('duas sessões abaixo do mínimo com a mesma carga → deload ~10%', () => {
  const hist = [H('2026-09-12', [S(60, 5), S(60, 4), S(60, 4)]), H('2026-09-10', [S(60, 6), S(60, 5), S(60, 4)])];
  const r = suggest({ type: 'weight', target: { sets: 3, repsMin: 6, repsMax: 8 }, increment: 5, step: 2.5, history: hist });
  assert.equal(r.trend, 'down');
  assert.equal(r.kg, 55);
});

test('manter: nunca sobe', () => {
  const r = suggest({ type: 'weight', target: { ...target, progression: 'none' }, increment: 2, history: [H('2026-09-10', [S(20, 10), S(20, 10), S(20, 10)])] });
  assert.equal(r.kg, 20);
  assert.equal(r.trend, 'same');
});

test('carga não registrada (histórico antigo) → pede para registrar', () => {
  const r = suggest({ type: 'weight', target, increment: 2, history: [H('2026-09-10', [S(null, 8), S(null, 8), S(null, 8)])] });
  assert.equal(r.kg, null);
  assert.match(r.text, /Registre a carga/);
});

test('peso corporal: meta de reps sobe 1', () => {
  const r = suggest({ type: 'reps', target: { sets: 2, repsMin: 8, repsMax: 12 }, history: [H('2026-09-10', [S(null, 9), S(null, 8)])] });
  assert.equal(r.reps, 9);
});

test('peso corporal com "manter" (pliometria): não pede carga', () => {
  const r = suggest({ type: 'reps', target: { sets: 3, repsMin: 3, repsMax: 3, progression: 'none' }, history: [H('2026-09-10', [S(null, 3), S(null, 3), S(null, 3)])] });
  assert.equal(r.trend, 'same');
  assert.equal(r.reps, 3);
  assert.doesNotMatch(r.text, /carga/);
});

test('tempo: meta +5 s', () => {
  const r = suggest({ type: 'time', target: { sets: 3, repsMin: 30, repsMax: 60 }, history: [H('2026-09-10', [{ sec: 40, done: true }, { sec: 35, done: true }])] });
  assert.equal(r.reps, 40);
});

test('historyFor ignora aquecimento, séries não feitas, sessões excluídas e cardio; mais recente primeiro', () => {
  const sessions = [
    { id: 'a', kind: 'gym', date: '2026-09-01', items: [{ exerciseId: 'x', sets: [S(10, 10), S(5, 10, { kind: 'warmup' })] }] },
    { id: 'b', kind: 'gym', date: '2026-09-05', items: [{ exerciseId: 'x', sets: [S(12, 8), { kg: 12, reps: 8, done: false }] }] },
    { id: 'c', kind: 'gym', date: '2026-09-07', deleted: true, items: [{ exerciseId: 'x', sets: [S(99, 1)] }] },
    { id: 'd', kind: 'cardio', date: '2026-09-08' },
    { id: 'e', kind: 'gym', date: '2026-09-09', items: [{ exerciseId: 'y', sets: [S(1, 1)] }] },
  ];
  const h = historyFor(sessions, 'x');
  assert.deepEqual(h.map(x => x.sessionId), ['b', 'a']);
  assert.equal(h[0].sets.length, 1);
  assert.equal(h[1].sets.length, 1);
});

test('recordes: carga e 1RM estimado', () => {
  const rec = records([H('2026-09-10', [S(20, 10), S(22, 6)])]);
  assert.equal(rec.kg, 22);
  assert.ok(Math.abs(rec.e1rm - e1rm(20, 10)) < 1e-9);
  assert.equal(checkPR(S(24, 5), rec), 'kg');
  assert.equal(checkPR(S(20, 12), rec), 'e1rm');
  assert.equal(checkPR(S(20, 8), rec), null);
  // não repete o recorde se uma série anterior da sessão já foi maior
  assert.equal(checkPR(S(24, 5), rec, [S(25, 5)]), null);
  // sem histórico não há recorde
  assert.equal(checkPR(S(24, 5), records([])), null);
});
