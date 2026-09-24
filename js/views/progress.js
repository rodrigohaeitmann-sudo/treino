// Evolução: números da semana, progresso por exercício, frequência, séries por grupo muscular e peso corporal.
import { list, get } from '../state.js';
import { historyFor, e1rm, records, workingSets } from '../logic/progression.js';
import { volumeOf } from '../logic/session.js';
import { esc, fmtKg, fmtNum, fmtDate, fmtDuration, isoDate, weekStart } from '../logic/format.js';
import { lineChart, columnChart, hBars } from '../charts.js';
import { GROUPS } from '../seed.js';
import { $ } from '../ui.js';

const METRICS = {
  top: { label: 'Maior carga', unit: 'kg', of: sets => Math.max(...sets.map(s => s.kg || 0)) || null },
  e1rm: { label: '1RM estimado', unit: 'kg', of: sets => Math.round(Math.max(...sets.map(s => e1rm(s.kg, s.reps))) * 10) / 10 || null },
  vol: { label: 'Volume', unit: 'kg', of: sets => sets.reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0) || null },
  reps: { label: 'Repetições', unit: 'reps', of: sets => sets.reduce((a, s) => a + (s.reps || 0), 0) || null },
};

let exSel = null;
let metric = 'top';
try { exSel = localStorage.getItem('treino:progEx'); metric = localStorage.getItem('treino:progMetric') || 'top'; } catch { /* ok */ }

export function render(el) {
  const draw = () => {
    const gym = list.gym();
    const sessions = list.sessions();
    if (!gym.length && !sessions.length) {
      el.innerHTML = '<div class="empty"><p>Salve alguns treinos para ver sua evolução aqui.</p><a class="btn primary" href="#/">Começar</a></div>';
      return;
    }
    // Exercícios com histórico, do mais recente para o mais antigo
    const seen = new Map();
    for (const s of gym) for (const it of s.items) if (!seen.has(it.exerciseId) && workingSets(it.sets).length) seen.set(it.exerciseId, it.name);
    if (!exSel || !seen.has(exSel)) exSel = seen.keys().next().value || null;
    const ex = exSel ? get.exercise(exSel) : null;
    const type = ex?.type || 'weight';
    const metrics = type === 'weight' ? ['top', 'e1rm', 'vol'] : ['reps'];
    if (!metrics.includes(metric)) metric = metrics[0];

    el.innerHTML = `
      ${tiles(gym)}
      <section class="card">
        <h2 class="card-title">Evolução por exercício</h2>
        <div class="chart-filters">
          <select id="pgEx" aria-label="Exercício">${[...seen].map(([id, name]) => `<option value="${esc(id)}" ${id === exSel ? 'selected' : ''}>${esc(get.exercise(id)?.name || name)}</option>`).join('')}</select>
          <div class="chips" id="pgMetric">${metrics.map(m => `<button type="button" class="chip" data-m="${m}" aria-pressed="${m === metric}">${METRICS[m].label}</button>`).join('')}</div>
        </div>
        <div id="pgChart"></div>
        <div id="pgTable"></div>
      </section>
      <section class="card">
        <h2 class="card-title">Treinos por semana</h2>
        <p class="muted small">Musculação nas últimas 12 semanas (a última coluna é a semana atual).</p>
        <div id="pgWeeks"></div>
      </section>
      <section class="card">
        <h2 class="card-title">Séries por grupo muscular</h2>
        <p class="muted small">Últimos 7 dias. A faixa clara marca 10–20 séries semanais, referência comum para hipertrofia.</p>
        <div id="pgGroups"></div>
      </section>
      <section class="card" id="pgBwCard">
        <h2 class="card-title">Peso corporal</h2>
        <div id="pgBw"></div>
      </section>
      <section class="card" id="pgRunCard">
        <h2 class="card-title">Cardio: km por semana</h2>
        <div id="pgRun"></div>
      </section>`;

    drawExercise(el, gym);
    drawWeeks(el, gym);
    drawGroups(el, gym);
    const bw = [...sessions].reverse().filter(s => s.bodyweight);
    if (bw.length) lineChart($('#pgBw', el), bw.slice(-30).map(s => ({ label: fmtDate(s.date), y: s.bodyweight, sub: fmtDate(s.date, true) })), { unit: 'kg', fmt: v => fmtNum(v, 1) });
    else $('#pgBwCard', el).hidden = true;
    const runs = sessions.filter(s => s.kind === 'cardio' && s.distanceKm);
    if (runs.length) drawRuns(el, runs); else $('#pgRunCard', el).hidden = true;

    $('#pgEx', el).onchange = e => { exSel = e.target.value; save(); draw(); };
    $('#pgMetric', el).onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; metric = b.dataset.m; save(); draw(); };
  };
  draw();
  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(draw, 200); };
  addEventListener('resize', onResize);
  return { refresh: draw, destroy: () => removeEventListener('resize', onResize) };
}

const save = () => { try { localStorage.setItem('treino:progEx', exSel || ''); localStorage.setItem('treino:progMetric', metric); } catch { /* ok */ } };

function tiles(gym) {
  const ws = isoDate(weekStart(new Date()));
  const prevWs = isoDate(new Date(weekStart(new Date()).getTime() - 7 * 864e5));
  const vol = arr => arr.reduce((a, s) => a + volumeOf(s.items), 0);
  const thisW = gym.filter(s => s.date >= ws), lastW = gym.filter(s => s.date >= prevWs && s.date < ws);
  const v1 = vol(thisW), v0 = vol(lastW);
  const d28 = isoDate(Date.now() - 27 * 864e5);
  const m = gym.filter(s => s.date >= d28);
  const durs = m.filter(s => s.durationSec).map(s => s.durationSec);
  const d30 = isoDate(Date.now() - 29 * 864e5);
  const prs = gym.filter(s => s.date >= d30).reduce((a, s) => a + s.items.reduce((b, it) => b + it.sets.filter(x => x.pr).length, 0), 0);
  const delta = v0 ? Math.round((v1 / v0 - 1) * 100) : null;
  return `
    <div class="tiles">
      <div class="tile"><span>Treinos em 4 semanas</span><b>${m.length}</b></div>
      <div class="tile"><span>Duração média</span><b>${durs.length ? fmtDuration(durs.reduce((a, b) => a + b, 0) / durs.length) : '–'}</b></div>
      <div class="tile"><span>Volume desta semana</span><b>${fmtNum(v1, 0)} kg</b>${delta != null ? `<em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}% vs semana passada</em>` : ''}</div>
      <div class="tile"><span>Recordes em 30 dias</span><b>${prs}</b></div>
    </div>`;
}

function drawExercise(el, gym) {
  const chart = $('#pgChart', el), table = $('#pgTable', el);
  if (!exSel) { chart.innerHTML = '<p class="empty-chart">Sem registros ainda.</p>'; return; }
  const hist = historyFor(gym, exSel).slice(0, 24).reverse();
  const M = METRICS[metric];
  const ex = get.exercise(exSel);
  const best = s => s.reduce((m, x) => (e1rm(x.kg, x.reps) > e1rm(m.kg, m.reps) || (!m.reps && x.reps) ? x : m), {});
  lineChart(chart, hist.map(h => {
    const b = best(h.sets);
    return { label: fmtDate(h.date), y: M.of(h.sets), sub: `${fmtDate(h.date, true)} · melhor série ${b.kg ? `${fmtKg(b.kg)} × ` : ''}${b.reps ?? '–'}` };
  }), { unit: M.unit, fmt: v => fmtNum(v, 1) });
  const rec = records(historyFor(gym, exSel));
  const rows = hist.slice(-8).reverse();
  table.innerHTML = `
    ${rec.kg ? `<p class="muted small">Melhores marcas: ${fmtKg(rec.kg)} kg de carga · ${fmtKg(Math.round(rec.e1rm * 10) / 10)} kg de 1RM estimado.</p>` : ''}
    <table class="tbl">
      <thead><tr><th>Data</th><th>Séries</th>${ex?.type === 'weight' ? '<th class="r">1RM est.</th>' : ''}</tr></thead>
      <tbody>${rows.map(h => `<tr><td>${fmtDate(h.date, true)}</td><td>${h.sets.map(x => (x.kg ? `${fmtKg(x.kg)}×` : '×') + (x.reps ?? x.sec ?? '–')).join(', ')}</td>${ex?.type === 'weight' ? `<td class="r">${fmtNum(Math.max(...h.sets.map(x => e1rm(x.kg, x.reps))), 1)}</td>` : ''}</tr>`).join('')}</tbody>
    </table>`;
}

function drawWeeks(el, gym) {
  const ws = weekStart(new Date());
  const bars = [];
  for (let i = 11; i >= 0; i--) {
    const a = new Date(ws); a.setDate(a.getDate() - 7 * i);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    const A = isoDate(a), B = isoDate(b);
    const arr = gym.filter(s => s.date >= A && s.date < B);
    bars.push({ label: fmtDate(A), y: arr.length, sub: `semana de ${fmtDate(A)} · ${fmtDuration(arr.reduce((t, s) => t + (s.durationSec || 0), 0))} no total` });
  }
  columnChart($('#pgWeeks', el), bars, { fmt: v => `${fmtNum(v, 0)} treino${v === 1 ? '' : 's'}` });
}

function drawGroups(el, gym) {
  const since = isoDate(Date.now() - 6 * 864e5);
  const count = new Map();
  for (const s of gym.filter(x => x.date >= since)) {
    for (const it of s.items) {
      const g = get.exercise(it.exerciseId)?.group || it.group || 'Outro';
      count.set(g, (count.get(g) || 0) + workingSets(it.sets).length);
    }
  }
  const rows = GROUPS.map(g => ({ label: g.id, y: count.get(g.id) || 0 })).filter(r => r.y > 0 && r.label !== 'Potência').sort((a, b) => b.y - a.y);
  hBars($('#pgGroups', el), rows, { band: [10, 20], fmt: v => `${v} séries` });
}

function drawRuns(el, runs) {
  const ws = weekStart(new Date());
  const bars = [];
  for (let i = 11; i >= 0; i--) {
    const a = new Date(ws); a.setDate(a.getDate() - 7 * i);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    const A = isoDate(a), B = isoDate(b);
    const km = runs.filter(s => s.date >= A && s.date < B).reduce((t, s) => t + s.distanceKm, 0);
    bars.push({ label: fmtDate(A), y: Math.round(km * 10) / 10, sub: `semana de ${fmtDate(A)}` });
  }
  columnChart($('#pgRun', el), bars, { fmt: v => `${fmtNum(v, 1)} km` });
}
