import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, mmss, clock, fmtDuration, parseClock, roundTo, fmtRest, relDays } from '../js/logic/format.js';
import { platesFor, warmupFor } from '../js/logic/plates.js';
import { parseYouTube, parseTime, embedUrl } from '../js/logic/youtube.js';
import { mergeIncoming, pendingChanges } from '../js/logic/sync-merge.js';
import { parseBackup, setsCsv, makeBackup } from '../js/logic/backup.js';
import { SEED_EXERCISES, SEED_PLANS } from '../js/seed.js';

test('números digitados em pt-BR', () => {
  assert.equal(num('12,5'), 12.5);
  assert.equal(num(' 20 '), 20);
  assert.equal(num(''), null);
  assert.equal(num('abc'), null);
});

test('formatação de tempo', () => {
  assert.equal(mmss(83), '1:23');
  assert.equal(clock(3754), '1:02:34');
  assert.equal(clock(754), '12:34');
  assert.equal(fmtDuration(2520), '42 min');
  assert.equal(fmtDuration(3900), '1h05');
  assert.equal(parseClock('1:30'), 90);
  assert.equal(parseClock('x'), null);
  assert.equal(fmtRest(120), '2 min');
  assert.equal(fmtRest(90), '1:30 min');
  assert.equal(fmtRest(45), '45 s');
  assert.equal(roundTo(54, 2.5), 55);
  assert.equal(relDays('2026-09-20', '2026-09-24'), 'há 4 dias');
});

test('anilhas por lado', () => {
  assert.deepEqual(platesFor(62.5), { perSide: [20, 1.25], rest: 0 });
  assert.deepEqual(platesFor(20), { perSide: [], rest: 0 });
  assert.equal(platesFor(15), null);
  assert.deepEqual(platesFor(61, 20, [20, 10, 5, 2.5]), { perSide: [20], rest: 0.5 });
});

test('aquecimento', () => {
  assert.deepEqual(warmupFor(100), [{ kg: 20, reps: 10 }, { kg: 50, reps: 5 }, { kg: 75, reps: 3 }]);
  assert.deepEqual(warmupFor(30), []);
});

test('links do YouTube', () => {
  const id = 'dQw4w9WgXcQ';
  assert.deepEqual(parseYouTube(`https://www.youtube.com/watch?v=${id}&t=1m30s`), { id, start: 90 });
  assert.deepEqual(parseYouTube(`https://youtu.be/${id}?t=42`), { id, start: 42 });
  assert.deepEqual(parseYouTube(`https://youtube.com/shorts/${id}?feature=share`), { id, start: null });
  assert.deepEqual(parseYouTube(`m.youtube.com/watch?v=${id}`), { id, start: null });
  assert.deepEqual(parseYouTube(`https://www.youtube-nocookie.com/embed/${id}?start=10`), { id, start: 10 });
  assert.deepEqual(parseYouTube(id), { id, start: null });
  assert.equal(parseYouTube('https://vimeo.com/123'), null);
  assert.equal(parseYouTube('https://youtube.com/watch?v=curto'), null);
  assert.equal(parseTime('1:05'), 65);
  assert.match(embedUrl({ id, start: 5, end: 20 }), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*start=5.*end=20/);
});

test('sincronização: vence o mais recente; ignora lixo', () => {
  const local = new Map([['a', { id: 'a', updatedAt: 10 }], ['b', { id: 'b', updatedAt: 10 }]]);
  const apply = mergeIncoming(local, [{ id: 'a', updatedAt: 5 }, { id: 'b', updatedAt: 11 }, { id: 'c', updatedAt: 1 }, null, { updatedAt: 3 }]);
  assert.deepEqual(apply.map(r => r.id), ['b', 'c']);
  const ch = pendingChanges({ exercises: new Map([['x', { id: 'x', updatedAt: 0 }]]), plans: new Map(), sessions: local }, 10);
  assert.deepEqual(ch, { exercises: [], plans: [], sessions: [] });
});

test('importa os treinos salvos no artefato antigo', () => {
  const ctx = { exercises: new Map(SEED_EXERCISES.map(e => [e.id, e])), plans: new Map(SEED_PLANS.map(p => [p.id, p])) };
  const legacy = [
    { id: 'g1', kind: 'gym', workout: 'B', date: '2026-09-18', ts: 1789816758693, durMin: 7209, rpe: null, bw: null, notes: '',
      sets: { terra_romeno: [{ kg: 20, reps: 8, done: true }, { kg: 20, reps: 8, done: true }], broadjump: [{ kg: null, reps: 3, done: true }] } },
    { id: 'c1', kind: 'run', date: '2026-09-19', ts: 1789900000000, km: 5, sec: 1800 },
  ];
  const r = parseBackup(JSON.stringify(legacy), ctx);
  assert.equal(r.legacy, true);
  const [gym, run] = r.sessions;
  assert.equal(gym.planId, 'plan-b');
  assert.equal(gym.durationSec, null); // 7209 min descartado
  assert.deepEqual(gym.items.map(i => i.exerciseId), ['broadjump', 'terra_romeno']); // ordem do plano
  assert.equal(gym.items[1].sets[0].kg, 20);
  assert.equal(run.kind, 'cardio');
  assert.equal(run.distanceKm, 5);
  assert.match(setsCsv(r.sessions), /2026-09-18,Treino B,Terra romeno,1,normal,20,8,,160/);
});

test('backup no formato atual ida e volta', () => {
  const b = makeBackup({ exercises: SEED_EXERCISES, plans: SEED_PLANS, sessions: [] }, 0);
  const r = parseBackup(JSON.stringify(b));
  assert.equal(r.exercises.length, SEED_EXERCISES.length);
  assert.equal(r.plans.length, 2);
  assert.throws(() => parseBackup('{"x":1}'), /não reconhecido/);
  assert.throws(() => parseBackup('nope'), /JSON/);
});

test('seed: todo item de plano aponta para um exercício existente', () => {
  const ids = new Set(SEED_EXERCISES.map(e => e.id));
  for (const p of SEED_PLANS) for (const it of p.items) assert.ok(ids.has(it.exerciseId), it.exerciseId);
  assert.equal(ids.size, SEED_EXERCISES.length, 'ids duplicados');
});
