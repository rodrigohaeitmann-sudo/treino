// Histórico: calendário de frequência, lista por mês e detalhe (com edição) de cada sessão.
import { state, list, get, upsert, remove } from '../state.js';
import * as act from '../actions.js';
import { stats, volumeOf } from '../logic/session.js';
import { esc, fmtKg, fmtNum, fmtDate, fmtDateLong, fmtDuration, isoDate, weekStart, num, inputVal, mmss } from '../logic/format.js';
import { groupColor } from '../seed.js';
import { cardioName } from './home.js';
import { $, icon, toast, ask } from '../ui.js';

const WEEKS = 16;

export function renderList(el) {
  const draw = () => {
    const sessions = list.sessions();
    if (!sessions.length) {
      el.innerHTML = `<div class="empty">${icon('history')}<p>Nenhum treino salvo ainda.</p><a class="btn primary" href="#/">Começar</a></div>`;
      return;
    }
    const byMonth = new Map();
    for (const s of sessions) {
      const k = s.date.slice(0, 7);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k).push(s);
    }
    el.innerHTML = `
      ${heatmap(sessions)}
      ${[...byMonth].map(([m, arr]) => `
        <h2 class="section">${esc(monthName(m))} <small class="muted">${arr.filter(s => s.kind === 'gym').length} treinos</small></h2>
        <div class="hist-list">${arr.map(itemHtml).join('')}</div>`).join('')}`;
  };
  draw();
  return { refresh: draw };
}

const monthName = ym => {
  const s = new Date(`${ym}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function heatmap(sessions) {
  const days = new Map();
  for (const s of sessions) days.set(s.date, [...(days.get(s.date) || []), s]);
  const start = weekStart(new Date());
  start.setDate(start.getDate() - 7 * (WEEKS - 1));
  const today = isoDate();
  const cols = [];
  for (let w = 0; w < WEEKS; w++) {
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + w * 7 + d);
      const iso = isoDate(dt);
      const arr = days.get(iso) || [];
      const lvl = arr.some(s => s.kind === 'gym') ? 2 : arr.length ? 1 : 0;
      const tip = `${fmtDate(iso, true)}: ${arr.length ? arr.map(s => (s.kind === 'gym' ? s.planName : cardioName(s.activity))).join(', ') : 'sem treino'}`;
      cells.push(iso > today ? '<i class="future"></i>' : `<i class="l${lvl}" title="${esc(tip)}"></i>`);
    }
    cols.push(`<div class="hm-col">${cells.join('')}</div>`);
  }
  const n = sessions.filter(s => s.kind === 'gym' && s.date >= isoDate(start)).length;
  return `
    <section class="card">
      <div class="hm" role="img" aria-label="${n} treinos de musculação nas últimas ${WEEKS} semanas">${cols.join('')}</div>
      <div class="hm-legend"><span>${n} treinos em ${WEEKS} semanas</span><span><i class="l2"></i> musculação <i class="l1"></i> cardio</span></div>
    </section>`;
}

function itemHtml(s) {
  if (s.kind === 'cardio') {
    const pace = s.activity === 'corrida' && s.distanceKm && s.durationSec ? ` · ${mmss(s.durationSec / s.distanceKm)}/km` : '';
    return `
      <a class="card hist-item" href="#/historico/${encodeURIComponent(s.id)}" style="--c:var(--power)">
        <div><b>${esc(cardioName(s.activity))}${s.distanceKm ? ` · ${fmtNum(s.distanceKm)} km` : ''}</b>
        <span class="muted small">${esc(fmtDateLong(s.date))} · ${fmtDuration(s.durationSec)}${pace}${s.rpe ? ` · RPE ${s.rpe}` : ''}</span></div>
        ${icon('next', 'muted')}
      </a>`;
  }
  const st = stats(s);
  const prs = (s.items || []).reduce((a, it) => a + it.sets.filter(x => x.pr).length, 0);
  return `
    <a class="card hist-item" href="#/historico/${encodeURIComponent(s.id)}" style="--c:var(--accent)">
      <div><b>${esc(s.planName)}${prs ? ` <span class="pr-dot" title="${prs} recorde(s)">${icon('trophy', 'tiny')} ${prs}</span>` : ''}</b>
      <span class="muted small">${esc(fmtDateLong(s.date))} · ${fmtDuration(s.durationSec)} · ${st.working} séries · ${fmtNum(st.volume, 0)} kg${s.rpe ? ` · RPE ${s.rpe}` : ''}</span></div>
      ${icon('next', 'muted')}
    </a>`;
}

// ---------- detalhe ----------
export function renderDetail(el, [id], ctx, query) {
  const s0 = get.session(id);
  if (!s0) { el.innerHTML = `<div class="empty"><p>Registro não encontrado.</p><a class="btn ghost" href="#/historico">Voltar</a></div>`; return; }
  let editing = false;
  let draft = null;
  const fresh = query.get('novo') === '1';

  const view = () => {
    const s = get.session(id);
    if (!s) return;
    ctx.setTitle(s.kind === 'gym' ? s.planName : cardioName(s.activity));
    if (s.kind === 'cardio') {
      el.innerHTML = `
        <section class="card">
          <div class="kicker">${esc(fmtDateLong(s.date))}</div>
          <h2>${esc(cardioName(s.activity))}</h2>
          <div class="stat-row three">
            <div class="stat"><b>${fmtDuration(s.durationSec)}</b><span>duração</span></div>
            <div class="stat"><b>${s.distanceKm ? fmtNum(s.distanceKm) : '–'}</b><span>km</span></div>
            <div class="stat"><b>${s.distanceKm && s.durationSec ? mmss(s.durationSec / s.distanceKm) : '–'}</b><span>ritmo /km</span></div>
          </div>
          ${s.rpe ? `<p>RPE ${s.rpe}</p>` : ''}${s.notes ? `<p class="muted">${esc(s.notes)}</p>` : ''}
        </section>
        <div class="row-btns end"><button type="button" class="btn ghost danger-text" data-act="delete">${icon('trash')} Excluir</button></div>`;
      return;
    }
    const st = stats(s);
    const prev = list.gym().find(x => x.id !== s.id && x.planId && x.planId === s.planId && (x.date < s.date || (x.date === s.date && (x.startedAt || 0) < (s.startedAt || 0))));
    const pv = prev ? volumeOf(prev.items) : 0;
    const delta = pv && st.volume ? Math.round((st.volume / pv - 1) * 100) : null;
    const prs = s.items.flatMap(it => it.sets.filter(x => x.pr).map(x => ({ it, x })));
    const start = s.startedAt ? new Date(s.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    el.innerHTML = `
      ${fresh ? `<div class="banner good">${icon('check')} Treino salvo${state.sync.url ? ' — sincronizando com a planilha' : ''}.</div>` : ''}
      <section class="card">
        <div class="kicker">${esc(fmtDateLong(s.date))}${start ? ` · ${start}` : ''}</div>
        <h2>${esc(s.planName)}</h2>
        <div class="stat-row three">
          <div class="stat"><b>${fmtDuration(s.durationSec)}</b><span>duração</span></div>
          <div class="stat"><b>${st.working}</b><span>séries</span></div>
          <div class="stat"><b>${fmtNum(st.volume, 0)}</b><span>kg de volume${delta != null ? ` <em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}%</em>` : ''}</span></div>
        </div>
        ${delta != null ? `<p class="muted small">Comparado com ${esc(prev.planName)} de ${fmtDate(prev.date)}.</p>` : ''}
        ${[s.rpe ? `RPE ${s.rpe}` : '', s.bodyweight ? `${fmtKg(s.bodyweight)} kg de peso corporal` : ''].filter(Boolean).join(' · ')}
        ${prs.length ? `<div class="box good"><b>${icon('trophy')} Recordes</b>${prs.map(p => `${esc(p.it.name)}: ${fmtKg(p.x.kg)} kg × ${p.x.reps}`).join('<br>')}</div>` : ''}
        ${s.notes ? `<p class="muted">${esc(s.notes)}</p>` : ''}
      </section>
      ${s.items.map(it => `
        <section class="card ex-done" style="--c:${groupColor(it.group)}">
          <h3>${esc(it.name)}</h3>
          <div class="set-chips">${it.sets.map(x => `<span class="set-chip ${x.kind}">${x.kind === 'warmup' ? 'Aq ' : ''}${it.type === 'time' ? `${x.sec ?? '–'} s` : `${x.kg > 0 ? `${fmtKg(x.kg)} × ` : ''}${x.reps ?? '–'}`}${x.pr ? ` ${icon('trophy', 'tiny')}` : ''}</span>`).join('')}</div>
        </section>`).join('')}
      <div class="row-btns end">
        <button type="button" class="btn ghost danger-text" data-act="delete">${icon('trash')} Excluir</button>
        <button type="button" class="btn ghost" data-act="edit">${icon('edit')} Editar</button>
        ${s.planId && get.plan(s.planId) ? `<button type="button" class="btn primary" data-act="again">${icon('play')} Fazer de novo</button>` : ''}
      </div>`;
  };

  const editView = () => {
    const s = draft;
    el.innerHTML = `
      <section class="card">
        <div class="grid2">
          <label class="field"><span>Data</span><input type="date" id="hDate" value="${esc(s.date)}"></label>
          <label class="field"><span>Duração (min)</span><input id="hDur" inputmode="numeric" value="${s.durationSec ? Math.round(s.durationSec / 60) : ''}"></label>
          <label class="field"><span>RPE</span><input id="hRpe" inputmode="numeric" value="${s.rpe ?? ''}"></label>
          <label class="field"><span>Peso corporal (kg)</span><input id="hBw" inputmode="decimal" value="${inputVal(s.bodyweight)}"></label>
        </div>
        <label class="field"><span>Notas</span><textarea id="hNotes" rows="2">${esc(s.notes || '')}</textarea></label>
      </section>
      ${s.items.map((it, i) => `
        <section class="card" data-i="${i}">
          <h3>${esc(it.name)}</h3>
          ${it.sets.map((x, k) => `
            <div class="edit-set" data-k="${k}">
              <span class="set-n">${k + 1}</span>
              ${it.type === 'reps' ? '<span></span>' : `<input class="num" inputmode="decimal" data-f="kg" value="${esc(inputVal(x.kg))}" placeholder="kg" aria-label="kg">`}
              <input class="num" inputmode="numeric" data-f="${it.type === 'time' ? 'sec' : 'reps'}" value="${esc(inputVal(it.type === 'time' ? x.sec : x.reps))}" placeholder="${it.type === 'time' ? 's' : 'reps'}" aria-label="${it.type === 'time' ? 'segundos' : 'repetições'}">
              <button type="button" class="icon-btn sm" data-act="del-set" aria-label="Apagar série">${icon('close')}</button>
            </div>`).join('')}
        </section>`).join('')}
      <div class="row-btns end sticky-actions">
        <button type="button" class="btn ghost" data-act="cancel">Cancelar</button>
        <button type="button" class="btn primary" data-act="save">Salvar alterações</button>
      </div>`;
  };

  view();
  el.oninput = e => {
    if (!editing) return;
    const t = e.target;
    const card = t.closest('[data-i]');
    if (card && t.dataset.f) {
      const set = draft.items[+card.dataset.i].sets[+t.closest('[data-k]').dataset.k];
      set[t.dataset.f] = num(t.value);
    }
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const s = get.session(id);
    switch (b.dataset.act) {
      case 'delete':
        if (await ask('Excluir este registro? Isso também remove da planilha na próxima sincronização.', { ok: 'Excluir', danger: true })) {
          await remove('sessions', id);
          toast('Registro excluído');
          location.hash = '#/historico';
        }
        break;
      case 'again': {
        const plan = get.plan(s.planId);
        if (state.active && !await ask(`Descartar o treino em andamento (${state.active.planName})?`, { ok: 'Descartar e iniciar', danger: true })) return;
        if (state.active) await act.discardSession();
        act.startSession(plan);
        location.hash = '#/treino';
        break;
      }
      case 'edit': editing = true; draft = structuredClone(s); editView(); break;
      case 'cancel': editing = false; view(); break;
      case 'del-set': {
        const i = +b.closest('[data-i]').dataset.i, k = +b.closest('[data-k]').dataset.k;
        draft.items[i].sets.splice(k, 1);
        draft.items = draft.items.filter(it => it.sets.length);
        editView();
        break;
      }
      case 'save': {
        draft.date = $('#hDate', el).value || draft.date;
        const min = num($('#hDur', el).value);
        draft.durationSec = min ? Math.round(min * 60) : null;
        draft.rpe = num($('#hRpe', el).value);
        draft.bodyweight = num($('#hBw', el).value);
        draft.notes = $('#hNotes', el).value.trim();
        await upsert('sessions', draft);
        editing = false;
        toast('Alterações salvas');
        view();
        break;
      }
    }
  };
  return { refresh: () => { if (!editing) view(); } };
}
