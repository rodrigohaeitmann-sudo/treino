import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScript } from './helpers/fake-apps-script.js';

const session = (id, updatedAt, extra = {}) => ({
  id, kind: 'gym', date: '2026-09-20', planName: 'Treino A', startedAt: 1000, finishedAt: 61000, durationSec: 3600, updatedAt,
  items: [
    { exerciseId: 'agachamento', name: 'Agachamento livre', group: 'Pernas', sets: [
      { kg: 20, reps: 10, done: true, kind: 'warmup' },
      { kg: 60, reps: 6, done: true, kind: 'normal' },
      { kg: 60, reps: 5, done: true, kind: 'normal' },
    ] },
  ],
  ...extra,
});

test('recusa token errado ou ausente', () => {
  const { post } = loadAppsScript();
  assert.match(post({ action: 'ping', token: 'x' }).error, /Token/);
  assert.match(post('não é json').error, /JSON/);
  const semToken = loadAppsScript({ token: null });
  assert.match(semToken.post({ action: 'ping', token: '' }).error, /setup/);
});

test('setup cria as abas e gera um token', () => {
  const { ctx, ss, props } = loadAppsScript({ token: null });
  const t = ctx.setup();
  assert.equal(props.get('TOKEN'), t);
  assert.deepEqual([...ss.sheets.keys()].sort(), ['Exercicios', 'Series', 'Sessoes', 'Treinos']);
});

test('sincronização completa entre dois aparelhos', () => {
  const { post, ss } = loadAppsScript();
  const token = 'segredo';

  // Aparelho 1 envia uma sessão e um plano
  const r1 = post({ token, action: 'sync', since: 0, changes: { sessions: [session('s1', 100)], plans: [{ id: 'p1', name: 'Treino A', order: 0, items: [], updatedAt: 50 }] } });
  assert.equal(r1.ok, true);
  assert.equal(r1.changes.sessions.length, 1);
  const sess = ss.rows('Sessoes');
  assert.equal(sess.length, 1);
  assert.equal(sess[0].series, 2);          // aquecimento não conta
  assert.equal(sess[0].volume_kg, 660);
  assert.equal(sess[0].duracao_min, 60);
  assert.equal(ss.rows('Series').length, 3);

  // Aparelho 2 (nunca sincronizou) recebe tudo
  const r2 = post({ token, action: 'sync', since: 0, changes: {} });
  assert.equal(r2.changes.sessions[0].id, 's1');
  assert.equal(r2.changes.plans[0].id, 'p1');

  // Nada novo desde o último cursor
  const r3 = post({ token, action: 'sync', since: r2.cursor, changes: {} });
  assert.equal(r3.changes.sessions.length, 0);

  // Edição mais nova substitui a linha e reescreve as séries (sem duplicar)
  const edited = session('s1', 200, { notes: '=HYPERLINK("x")' });
  edited.items[0].sets.pop();
  post({ token, action: 'sync', since: r3.cursor, changes: { sessions: [edited] } });
  assert.equal(ss.rows('Sessoes').length, 1);
  assert.equal(ss.rows('Series').length, 2);
  assert.equal(ss.rows('Sessoes')[0].notas, `'=HYPERLINK("x")`); // não vira fórmula

  // Versão antiga chegando atrasada é ignorada
  post({ token, action: 'sync', since: 0, changes: { sessions: [session('s1', 150)] } });
  assert.equal(JSON.parse(ss.rows('Sessoes')[0].json).updatedAt, 200);
  assert.equal(ss.rows('Series').length, 2);

  // Exclusão: lápide na aba Sessoes e séries removidas
  const r4 = post({ token, action: 'sync', since: 0, changes: { sessions: [{ id: 's1', deleted: true, updatedAt: 300 }] } });
  assert.equal(ss.rows('Sessoes')[0].deleted, true);
  assert.equal(ss.rows('Series').length, 0);
  assert.equal(r4.changes.sessions.find(s => s.id === 's1').deleted, true);
});

test('séries de várias sessões: apagar uma não mexe nas outras', () => {
  const { post, ss } = loadAppsScript();
  const token = 'segredo';
  post({ token, action: 'sync', since: 0, changes: { sessions: [session('a', 1), session('b', 1), session('c', 1)] } });
  assert.equal(ss.rows('Series').length, 9);
  post({ token, action: 'sync', since: 0, changes: { sessions: [{ id: 'b', deleted: true, updatedAt: 2 }] } });
  assert.deepEqual([...new Set(ss.rows('Series').map(r => r.sessao_id))], ['a', 'c']);
});
