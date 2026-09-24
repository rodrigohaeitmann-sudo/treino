// Início: continuar treino aberto, próximo treino da rotação, resumo da semana e cardio rápido.
import { state, list, get } from '../state.js';
import * as act from '../actions.js';
import { nextPlan, estimateMinutes, stats, smartEnd } from '../logic/session.js';
import { esc, isoDate, relDays, fmtDate, fmtDateLong, weekStart, fmtDuration, clock, range, num, parseClock, mmss, fmtNum } from '../logic/format.js';
import { groupColor } from '../seed.js';
import { $, icon, toast, sheet, ask } from '../ui.js';

export function render(el) {
  const draw = () => { el.innerHTML = html(); };
  draw();
  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'start': await start(get.plan(id)); break;
      case 'free': await start(null); break;
      case 'resume': location.hash = '#/treino'; break;
      case 'close-old': await closeOld(); draw(); break;
      case 'cardio': cardio(); break;
    }
  };
  return { refresh: draw };
}

async function start(plan) {
  if (state.active) {
    const go = await ask(`Há um treino em andamento (${state.active.planName}). Descartá-lo e começar ${plan ? plan.name : 'um treino livre'}?`, { ok: 'Descartar e começar', danger: true });
    if (!go) return;
    await act.discardSession();
  }
  act.startSession(plan);
  location.hash = '#/treino';
}

async function closeOld() {
  const s = state.active;
  if (!stats(s).done) { await act.discardSession(); toast('Treino vazio descartado'); return; }
  const saved = await act.finishSession({ end: smartEnd(s) });
  toast('Treino salvo com o horário da última série');
  location.hash = `#/historico/${saved.id}`;
}

function html() {
  const plans = list.plans();
  const sessions = list.sessions();
  const next = nextPlan(plans, list.gym());
  const today = isoDate();
  return `
    <p class="hello">${esc(fmtDateLong(today))}</p>
    ${activeCard()}
    ${!state.active && next ? planCard(next, true) : ''}
    ${weekCard(sessions)}
    ${plans.filter(p => p.id !== next?.id || state.active).length ? `
      <h2 class="section">${state.active ? 'Treinos' : 'Ou escolha outro'}</h2>
      <div class="plan-grid">${plans.filter(p => state.active || p.id !== next?.id).map(p => planCard(p, false)).join('')}</div>` : ''}
    <div class="row-btns">
      <button type="button" class="btn ghost" data-act="free">${icon('plus')} Treino livre</button>
      <button type="button" class="btn ghost" data-act="cardio">${icon('pulse')} Registrar cardio</button>
    </div>
    ${!plans.length ? `<div class="empty">${icon('dumbbell')}<p>Nenhum treino ainda.</p><a class="btn primary" href="#/treinos">Criar treino</a></div>` : ''}`;
}

function activeCard() {
  const s = state.active;
  if (!s) return '';
  const st = stats(s);
  const lastAct = Math.max(s.startedAt, ...s.items.flatMap(it => it.sets.map(x => x.doneAt || 0)));
  const stale = Date.now() - lastAct > 3 * 3600e3;
  return `
    <section class="card hero active-hero">
      <div class="kicker">${stale ? 'Treino esquecido aberto' : 'Treino em andamento'}</div>
      <h2>${esc(s.planName)}</h2>
      <p class="muted">${stale ? `Iniciado em ${fmtDate(s.date, true)}.` : `${clock((Date.now() - s.startedAt) / 1000)} de treino.`} ${st.done}/${st.total} séries feitas.</p>
      <div class="row-btns">
        <button type="button" class="btn primary big" data-act="resume">${icon('play')} Continuar</button>
        ${stale ? `<button type="button" class="btn ghost" data-act="close-old">${st.done ? 'Salvar e encerrar' : 'Descartar'}</button>` : ''}
      </div>
    </section>`;
}

function planCard(p, hero) {
  const last = list.gym().find(s => s.planId === p.id);
  const ex = p.items.map(it => get.exercise(it.exerciseId)).filter(Boolean);
  const mins = estimateMinutes(p.items);
  if (!hero) {
    return `
      <button type="button" class="card plan-mini" data-act="start" data-id="${esc(p.id)}">
        <b>${esc(p.name)}</b>
        <span class="muted small">${p.items.length} exercícios · ~${mins} min</span>
        <span class="muted small">${last ? `feito ${relDays(last.date)}` : 'nunca feito'}</span>
      </button>`;
  }
  return `
    <section class="card hero">
      <div class="kicker">Próximo treino</div>
      <h2>${esc(p.name)}</h2>
      ${p.subtitle ? `<p class="muted">${esc(p.subtitle)}</p>` : ''}
      <ul class="ex-preview">
        ${p.items.map(it => {
          const e = get.exercise(it.exerciseId);
          return e ? `<li style="--c:${groupColor(e.group)}"><span>${esc(e.name)}</span><span class="muted">${it.sets}×${range(it.repsMin, it.repsMax)}${it.linkNext ? ` ${icon('link', 'tiny')}` : ''}</span></li>` : '';
        }).join('')}
      </ul>
      <p class="muted small">${ex.length} exercícios · ~${mins} min${last ? ` · última vez ${relDays(last.date)}` : ''}</p>
      <button type="button" class="btn primary big" data-act="start" data-id="${esc(p.id)}">${icon('play')} Iniciar ${esc(p.name)}</button>
    </section>`;
}

function weekCard(sessions) {
  const ws = weekStart(new Date());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return isoDate(d); });
  const byDay = new Map();
  for (const s of sessions) if (days.includes(s.date)) byDay.set(s.date, [...(byDay.get(s.date) || []), s]);
  const d28 = isoDate(Date.now() - 27 * 864e5);
  const last28 = sessions.filter(s => s.kind === 'gym' && s.date >= d28);
  const avgMin = last28.filter(s => s.durationSec).map(s => s.durationSec / 60);
  const today = isoDate();
  const names = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return `
    <section class="card">
      <div class="week">
        ${days.map((d, i) => {
          const list_ = byDay.get(d) || [];
          const gym = list_.some(s => s.kind === 'gym'), cardio = list_.some(s => s.kind === 'cardio');
          const tip = list_.map(s => s.kind === 'gym' ? s.planName : cardioName(s.activity)).join(', ');
          return `<div class="day ${d === today ? 'today' : ''}" title="${esc(tip || 'sem treino')}">
            <span>${names[i]}</span><i class="${gym ? 'gym' : cardio ? 'cardio' : ''}">${gym || cardio ? icon('check') : ''}</i></div>`;
        }).join('')}
      </div>
      <div class="mini-stats">
        <div><b>${last28.length}</b><span>treinos em 4 semanas</span></div>
        <div><b>${avgMin.length ? fmtDuration(avgMin.reduce((a, b) => a + b, 0) / avgMin.length * 60) : '–'}</b><span>duração média</span></div>
        <div><b>${streakWeeks(sessions)}</b><span>semanas seguidas</span></div>
      </div>
    </section>`;
}

/** Semanas consecutivas (até a atual) com pelo menos um treino de musculação. */
function streakWeeks(sessions) {
  const weeks = new Set(sessions.filter(s => s.kind === 'gym').map(s => isoDate(weekStart(new Date(`${s.date}T12:00:00`)))));
  let n = 0;
  const d = weekStart(new Date());
  if (!weeks.has(isoDate(d))) d.setDate(d.getDate() - 7); // semana atual ainda pode ganhar treino
  while (weeks.has(isoDate(d))) { n++; d.setDate(d.getDate() - 7); }
  return n;
}

export const CARDIO = [
  { id: 'corrida', label: 'Corrida', dist: true },
  { id: 'caminhada', label: 'Caminhada', dist: true },
  { id: 'bike', label: 'Bike', dist: true },
  { id: 'volei', label: 'Vôlei', dist: false },
  { id: 'outro', label: 'Outro', dist: false },
];
export const cardioName = id => CARDIO.find(c => c.id === id)?.label || 'Cardio';

function cardio() {
  let kind = 'corrida', rpe = null;
  const s = sheet({
    title: 'Registrar cardio',
    body: `
      <div class="chips" id="cdKind">${CARDIO.map(c => `<button type="button" class="chip" data-k="${c.id}" aria-pressed="${c.id === kind}">${c.label}</button>`).join('')}</div>
      <label class="field inline"><span>Data</span><input type="date" id="cdDate" value="${isoDate()}"></label>
      <label class="field inline"><span>Duração (min ou h:mm:ss)</span><input id="cdDur" inputmode="numeric" placeholder="36:30"></label>
      <label class="field inline" id="cdDistF"><span>Distância (km)</span><input id="cdKm" inputmode="decimal" placeholder="6,0"></label>
      <p class="muted small" id="cdPace"></p>
      <div class="field"><span>Esforço (RPE)</span><div class="chips rpe" id="cdRpe">${[5, 6, 7, 8, 9, 10].map(v => `<button type="button" class="chip" data-v="${v}" aria-pressed="false">${v}</button>`).join('')}</div></div>
      <label class="field"><span>Notas</span><textarea id="cdNotes" rows="2" placeholder="Percurso, sensação, clima"></textarea></label>`,
    foot: `<button type="button" class="btn primary" id="cdSave">Salvar</button>`,
  });
  const q = sel => $(sel, s.el);
  const durSec = () => { const v = q('#cdDur').value.trim(); if (!v) return null; return v.includes(':') ? parseClock(v) : (num(v) || 0) * 60; };
  const pace = () => {
    const km = num(q('#cdKm').value), sec = durSec();
    q('#cdPace').textContent = kind === 'corrida' && km && sec ? `Ritmo: ${mmss(sec / km)} /km` : '';
  };
  q('#cdKind').onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    kind = b.dataset.k;
    q('#cdKind').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    q('#cdDistF').hidden = !CARDIO.find(c => c.id === kind).dist;
    pace();
  };
  q('#cdRpe').onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    rpe = +b.dataset.v;
    q('#cdRpe').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
  };
  q('#cdDur').oninput = pace;
  q('#cdKm').oninput = pace;
  q('#cdSave').onclick = async () => {
    const sec = durSec();
    if (!sec) { toast('Informe a duração'); return; }
    const km = CARDIO.find(c => c.id === kind).dist ? num(q('#cdKm').value) : null;
    await act.saveCardio({ activity: kind, date: q('#cdDate').value || isoDate(), durationSec: sec, distanceKm: km, rpe, notes: q('#cdNotes').value.trim() });
    s.close();
    toast(`${cardioName(kind)} salvo${km ? `: ${fmtNum(km)} km` : ''}`);
  };
}
