// Inicialização: carrega os dados, liga cronômetros/sincronização e faz o roteamento por #hash.
import { load, state, on, saveActive } from './state.js';
import { initTimers, restLeft, keepAwake } from './timer.js';
import { initAutoSync, isConfigured, hasPending } from './sync.js';
import * as act from './actions.js';
import { clock, mmss } from './logic/format.js';
import { $, $$, icon, toast } from './ui.js';
import * as home from './views/home.js';
import * as workout from './views/workout.js';
import * as plans from './views/plans.js';
import * as exercises from './views/exercises.js';
import * as history from './views/history.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';

const ROUTES = [
  { re: /^\/?$/, render: home.render, title: 'Treino', nav: 'home' },
  { re: /^\/treino$/, render: workout.render, title: 'Treinando', nav: null, full: true },
  { re: /^\/treinos$/, render: plans.renderList, title: 'Treinos', nav: 'plans' },
  { re: /^\/treinos\/([^/]+)$/, render: plans.renderEdit, title: 'Editar treino', nav: 'plans', back: '#/treinos' },
  { re: /^\/exercicios$/, render: exercises.renderList, title: 'Exercícios', nav: 'plans' },
  { re: /^\/exercicios\/([^/]+)$/, render: exercises.renderEdit, title: 'Exercício', nav: 'plans', back: '#/exercicios' },
  { re: /^\/historico$/, render: history.renderList, title: 'Histórico', nav: 'history' },
  { re: /^\/historico\/([^/]+)$/, render: history.renderDetail, title: 'Sessão', nav: 'history', back: '#/historico' },
  { re: /^\/evolucao$/, render: progress.render, title: 'Evolução', nav: 'progress' },
  { re: /^\/ajustes$/, render: settings.render, title: 'Ajustes', nav: 'settings' },
];

const NAV = [
  ['home', '#/', 'home', 'Início'],
  ['plans', '#/treinos', 'dumbbell', 'Treinos'],
  ['history', '#/historico', 'history', 'Histórico'],
  ['progress', '#/evolucao', 'chart', 'Evolução'],
  ['settings', '#/ajustes', 'settings', 'Ajustes'],
];

let current = null; // { route, handle }

function shell() {
  document.body.innerHTML = `
    <header class="appbar" id="appbar">
      <a class="icon-btn" id="back" href="#/" hidden aria-label="Voltar">${icon('back')}</a>
      <h1 id="title">Treino</h1>
      <button type="button" class="sync-dot" id="syncDot" hidden aria-label="Sincronização">${icon('cloud')}</button>
    </header>
    <main id="view" tabindex="-1"></main>
    <a class="active-bar" id="activeBar" href="#/treino" hidden></a>
    <nav class="tabbar" id="nav" aria-label="Seções">
      ${NAV.map(([id, href, ic, label]) => `<a href="${href}" data-nav="${id}">${icon(ic)}<span>${label}</span></a>`).join('')}
    </nav>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  $('#syncDot').onclick = () => { location.hash = '#/ajustes'; setTimeout(() => $('#sync')?.scrollIntoView({ block: 'start' }), 50); };
}

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  let r = null, params = [];
  for (const cand of ROUTES) {
    const m = path.match(cand.re);
    if (m) { r = cand; params = m.slice(1).map(decodeURIComponent); break; }
  }
  if (!r) { location.replace('#/'); return; }
  if (r.full && !state.active) { location.replace('#/'); return; }

  try { current?.handle?.destroy?.(); } catch (e) { console.error(e); }
  const view = $('#view');
  view.onclick = view.oninput = null; // cada tela registra os seus
  view.replaceWith(view.cloneNode(false)); // remove listeners antigos (addEventListener)
  const el = $('#view');
  document.body.classList.toggle('mode-workout', !!r.full);
  $('#title').textContent = r.title;
  const back = $('#back');
  back.hidden = !r.back;
  if (r.back) back.href = r.back;
  $$('#nav [data-nav]').forEach(a => a.toggleAttribute('aria-current', a.dataset.nav === r.nav));
  const ctx = { setTitle: t => { $('#title').textContent = t; } };
  const handle = r.render(el, params, ctx, new URLSearchParams(qs || '')) || null;
  current = { route: r, handle };
  if (!r.full) window.scrollTo(0, 0);
  updateActiveBar();
}

let refreshTimer = 0;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => current?.handle?.refresh?.(), 60);
}

function updateActiveBar() {
  const bar = $('#activeBar');
  const s = state.active;
  const show = !!s && !current?.route.full;
  bar.hidden = !show;
  document.body.classList.toggle('has-active', show);
  if (!show) return;
  const r = s.rest;
  const rest = r && !r.endedAt ? ` · descanso ${mmss(Math.ceil(restLeft()))}` : r?.endedAt ? ' · hora da próxima série!' : '';
  bar.innerHTML = `<span class="pulse"></span><b>${s.planName}</b><span>${clock((Date.now() - s.startedAt) / 1000)}${rest}</span>${icon('next')}`;
  bar.classList.toggle('alert', !!r?.endedAt);
}

function updateSyncDot() {
  const dot = $('#syncDot');
  dot.hidden = !isConfigured();
  if (dot.hidden) return;
  const st = state.sync.status;
  const cls = st === 'syncing' ? 'busy' : state.sync.lastError ? 'bad' : hasPending() ? 'pending' : 'ok';
  dot.className = `sync-dot ${cls}`;
  dot.title = { busy: 'Sincronizando…', bad: `Erro: ${state.sync.lastError}`, pending: 'Alterações a enviar', ok: 'Sincronizado' }[cls];
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12191F' : '#1D2B36');
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Nova versão do app disponível', { ms: 10000, action: 'Atualizar', onAction: () => location.reload() });
        }
      });
    });
  }).catch(() => { /* sem service worker: o app funciona online */ });
}

async function start() {
  shell();
  try {
    await load();
  } catch (e) {
    $('#view').innerHTML = `<div class="empty"><p>Não foi possível abrir o banco de dados deste navegador.</p><p class="muted small">${String(e.message || e)}</p></div>`;
    return;
  }
  applyTheme();
  initTimers();
  initAutoSync();

  on('change', scheduleRefresh);
  on('active', () => { if (!current?.route.full) scheduleRefresh(); updateActiveBar(); });
  on('settings', applyTheme);
  on('sync', updateSyncDot);
  on('dirty', updateSyncDot);
  on('tick', updateActiveBar);
  // Série por tempo termina mesmo com outra tela aberta.
  on('work-done', w => { if (state.active) act.completeSet(w.ref[0], w.ref[1], { sec: w.sec }); });
  on('rest-end', ({ late }) => { if (!late && !current?.route.full) toast('Descanso acabou: hora da próxima série!'); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  addEventListener('hashchange', route);
  // Grava o treino antes de o sistema congelar/fechar a aba.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && state.active) saveActive({ now: true }); });
  addEventListener('pagehide', () => { if (state.active) saveActive({ now: true }); });

  if (state.active) keepAwake();
  route();
  updateSyncDot();
  registerSW();
}

start();
