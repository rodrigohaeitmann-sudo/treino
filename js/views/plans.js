// Treinos (planos): lista, criação, edição, supersets e ordem da rotação.
import { state, list, get, upsert, remove } from '../state.js';
import * as act from '../actions.js';
import { estimateMinutes, defaultTarget } from '../logic/session.js';
import { esc, range, fmtRest, relDays, num, uid, inputVal } from '../logic/format.js';
import { groupColor } from '../seed.js';
import { thumbHtml } from '../media.js';
import { pickExercise } from './workout.js';
import { $, $$, icon, toast, sheet, ask, menu } from '../ui.js';

export const PROGRESSIONS = {
  double: { label: 'Dupla', hint: 'Suba reps dentro da faixa; ao bater o topo em todas as séries, sobe a carga.' },
  linear: { label: 'Linear', hint: 'Completou todas as séries com as reps mínimas? Sobe a carga na próxima.' },
  none: { label: 'Manter', hint: 'Sem sugestão de aumento (técnica, potência, reabilitação).' },
};

export const tabs = active => `
  <div class="tabs" role="tablist">
    <a href="#/treinos" role="tab" aria-selected="${active === 'plans'}">Treinos</a>
    <a href="#/exercicios" role="tab" aria-selected="${active === 'ex'}">Exercícios</a>
  </div>`;

// ---------- lista ----------
export function renderList(el) {
  const draw = () => {
    const plans = list.plans();
    el.innerHTML = `
      ${tabs('plans')}
      <p class="muted small">A ordem define a rotação: depois do último treino feito, o app sugere o seguinte.</p>
      <div class="plan-list">
        ${plans.map((p, i) => {
          const last = list.gym().find(s => s.planId === p.id);
          return `
          <article class="card plan-card" data-id="${esc(p.id)}">
            <div class="plan-card-head">
              <div><h3>${esc(p.name)}</h3>${p.subtitle ? `<div class="muted small">${esc(p.subtitle)}</div>` : ''}</div>
              <button type="button" class="icon-btn" data-act="menu" aria-label="Opções">${icon('more')}</button>
            </div>
            <div class="chips-row">${p.items.map(it => { const e = get.exercise(it.exerciseId); return e ? `<span class="tag" style="--c:${groupColor(e.group)}">${esc(e.name)}</span>` : ''; }).join('')}</div>
            <div class="muted small">${p.items.length} exercícios · ~${estimateMinutes(p.items)} min · ${last ? `feito ${relDays(last.date)}` : 'nunca feito'}</div>
            <div class="row-btns">
              <button type="button" class="btn primary" data-act="start">${icon('play')} Iniciar</button>
              <a class="btn ghost" href="#/treinos/${encodeURIComponent(p.id)}">${icon('edit')} Editar</a>
              ${i > 0 ? `<button type="button" class="icon-btn" data-act="up" aria-label="Subir na rotação">${icon('up')}</button>` : ''}
            </div>
          </article>`;
        }).join('')}
      </div>
      <button type="button" class="btn primary block" data-act="new">${icon('plus')} Novo treino</button>`;
  };
  draw();
  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('[data-id]')?.dataset.id;
    const plan = id && get.plan(id);
    switch (b.dataset.act) {
      case 'new': location.hash = '#/treinos/novo'; break;
      case 'start':
        if (state.active && !await ask(`Descartar o treino em andamento (${state.active.planName}) e iniciar ${plan.name}?`, { ok: 'Iniciar', danger: true })) return;
        if (state.active) await act.discardSession();
        act.startSession(plan);
        location.hash = '#/treino';
        break;
      case 'up': await reorder(plan, -1); break;
      case 'menu': {
        const c = await menu(plan.name, [
          { id: 'dup', label: 'Duplicar', icon: 'copy' },
          { id: 'down', label: 'Descer na rotação', icon: 'down' },
          { id: 'del', label: 'Excluir treino', icon: 'trash', danger: true },
        ]);
        if (c === 'dup') {
          const copy = { ...structuredClone(plan), id: uid('p'), name: `${plan.name} (cópia)`, order: (list.plans().at(-1)?.order ?? 0) + 1 };
          copy.items.forEach(it => { it.id = uid('pi'); });
          await upsert('plans', copy);
          toast('Treino duplicado');
        } else if (c === 'down') await reorder(plan, 1);
        else if (c === 'del' && await ask(`Excluir ${plan.name}? O histórico dos treinos já feitos continua salvo.`, { ok: 'Excluir', danger: true })) {
          await remove('plans', plan.id);
          toast('Treino excluído');
        }
        break;
      }
    }
  };
  return { refresh: draw };
}

async function reorder(plan, dir) {
  const plans = list.plans();
  const i = plans.findIndex(p => p.id === plan.id);
  const j = i + dir;
  if (j < 0 || j >= plans.length) return;
  [plans[i], plans[j]] = [plans[j], plans[i]];
  for (let k = 0; k < plans.length; k++) {
    if (plans[k].order !== k) { plans[k].order = k; await upsert('plans', plans[k]); }
  }
}

// ---------- editor ----------
export function renderEdit(el, [id], ctx) {
  if (id === 'novo') {
    const p = { id: uid('p'), name: 'Novo treino', subtitle: '', order: (list.plans().at(-1)?.order ?? -1) + 1, items: [] };
    upsert('plans', p).then(() => location.replace(`#/treinos/${p.id}`));
    return;
  }
  const plan = get.plan(id);
  if (!plan) { el.innerHTML = `<div class="empty"><p>Treino não encontrado.</p><a class="btn ghost" href="#/treinos">Voltar</a></div>`; return; }
  ctx.setTitle(plan.name);
  let saveTimer = 0;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => upsert('plans', plan), 400); };
  const draw = () => {
    el.innerHTML = `
      <label class="field"><span>Nome</span><input id="pName" value="${esc(plan.name)}" maxlength="60"></label>
      <label class="field"><span>Descrição</span><input id="pSub" value="${esc(plan.subtitle || '')}" placeholder="ex.: foco em pernas e empurrar" maxlength="120"></label>
      <h2 class="section">Exercícios <small class="muted">~${estimateMinutes(plan.items)} min</small></h2>
      <div class="plan-items" id="pItems">
        ${plan.items.map((it, i) => itemRow(plan, it, i)).join('') || '<p class="muted">Nenhum exercício ainda.</p>'}
      </div>
      <button type="button" class="btn ghost block" data-act="add">${icon('plus')} Adicionar exercício</button>
      <div class="row-btns end">
        <button type="button" class="btn ghost danger-text" data-act="delete">${icon('trash')} Excluir</button>
        <button type="button" class="btn primary" data-act="start">${icon('play')} Iniciar este treino</button>
      </div>
      <p class="muted small">As alterações são salvas automaticamente.</p>`;
  };
  draw();
  el.oninput = e => {
    if (e.target.id === 'pName') { plan.name = e.target.value.trim() || 'Treino'; ctx.setTitle(plan.name); save(); }
    if (e.target.id === 'pSub') { plan.subtitle = e.target.value.trim(); save(); }
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = b.closest('[data-i]') ? +b.closest('[data-i]').dataset.i : null;
    switch (b.dataset.act) {
      case 'add': {
        const ex = await pickExercise();
        if (!ex) return;
        plan.items.push(defaultItem(ex));
        await upsert('plans', plan);
        draw();
        editItem(plan, plan.items.length - 1, draw);
        break;
      }
      case 'edit': editItem(plan, i, draw); break;
      case 'up': case 'down': {
        const j = i + (b.dataset.act === 'up' ? -1 : 1);
        if (j < 0 || j >= plan.items.length) return;
        [plan.items[i], plan.items[j]] = [plan.items[j], plan.items[i]];
        await upsert('plans', plan);
        draw();
        break;
      }
      case 'link': {
        const it = plan.items[i];
        it.linkNext = !it.linkNext;
        // descanso curto de troca ao ligar; volta ao padrão ao desligar
        if (it.linkNext && it.restSec > 30) { it._rest = it.restSec; it.restSec = 20; }
        else if (!it.linkNext && it._rest) { it.restSec = it._rest; delete it._rest; }
        await upsert('plans', plan);
        draw();
        break;
      }
      case 'start':
        if (state.active && !await ask(`Descartar o treino em andamento (${state.active.planName})?`, { ok: 'Descartar e iniciar', danger: true })) return;
        if (state.active) await act.discardSession();
        await upsert('plans', plan);
        act.startSession(plan);
        location.hash = '#/treino';
        break;
      case 'delete':
        if (await ask(`Excluir ${plan.name}? O histórico continua salvo.`, { ok: 'Excluir', danger: true })) {
          await remove('plans', plan.id);
          location.hash = '#/treinos';
        }
        break;
    }
  };
  return { destroy: () => { clearTimeout(saveTimer); if (get.plan(plan.id)) upsert('plans', plan); } };
}

function defaultItem(ex) {
  const { sets, repsMin, repsMax, restSec, progression } = defaultTarget(ex);
  return { id: uid('pi'), exerciseId: ex.id, sets, repsMin, repsMax, restSec, linkNext: false, progression, increment: null, note: '' };
}

function itemRow(plan, it, i) {
  const ex = get.exercise(it.exerciseId) || { name: '(exercício excluído)', group: 'Outro' };
  const unit = ex.type === 'time' ? 's' : '';
  const last = i === plan.items.length - 1;
  return `
    <div class="plan-item ${it.linkNext ? 'linked' : ''}" data-i="${i}" style="--c:${groupColor(ex.group)}">
      <button type="button" class="plan-item-main" data-act="edit">
        <span class="thumb sm">${thumbHtml(ex)}</span>
        <span><b>${esc(ex.name)}</b>
          <small>${it.sets} × ${range(it.repsMin, it.repsMax)}${unit} · ${it.linkNext ? `troca ${fmtRest(it.restSec)}` : `desc. ${fmtRest(it.restSec)}`} · ${PROGRESSIONS[it.progression]?.label || ''}${ex.videos?.length ? ` · ${icon('video', 'tiny')}` : ''}</small>
          ${it.note ? `<small class="note">${esc(it.note)}</small>` : ''}
        </span>
      </button>
      <div class="plan-item-tools">
        <button type="button" class="icon-btn sm" data-act="up" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button type="button" class="icon-btn sm" data-act="down" aria-label="Descer" ${last ? 'disabled' : ''}>${icon('down')}</button>
      </div>
    </div>
    ${last ? '' : `<button type="button" class="link-toggle ${it.linkNext ? 'on' : ''}" data-i="${i}" data-act="link">${icon('link')} ${it.linkNext ? 'Superset (toque para separar)' : 'Ligar como superset'}</button>`}`;
}

function editItem(plan, i, redraw) {
  const it = plan.items[i];
  const ex = get.exercise(it.exerciseId) || { name: '?', type: 'weight', increment: 0 };
  const time = ex.type === 'time';
  const rests = [15, 20, 30, 45, 60, 90, 120, 150, 180];
  const s = sheet({
    title: ex.name,
    body: `
      <div class="grid3">
        <label class="field"><span>Séries</span><input id="iSets" inputmode="numeric" value="${it.sets}"></label>
        <label class="field"><span>${time ? 'Seg. mín' : 'Reps mín'}</span><input id="iMin" inputmode="numeric" value="${it.repsMin ?? ''}"></label>
        <label class="field"><span>${time ? 'Seg. máx' : 'Reps máx'}</span><input id="iMax" inputmode="numeric" value="${it.repsMax ?? ''}"></label>
      </div>
      <div class="field"><span>${it.linkNext ? 'Troca para o próximo do superset' : 'Descanso depois da série'}</span>
        <div class="chips" id="iRest">${rests.map(r => `<button type="button" class="chip" data-r="${r}" aria-pressed="${r === it.restSec}">${fmtRest(r)}</button>`).join('')}</div>
        <input id="iRestC" inputmode="numeric" value="${it.restSec}" aria-label="Descanso em segundos" class="mt"></div>
      ${ex.type === 'weight' ? `
      <div class="field"><span>Progressão de carga</span>
        <div class="chips" id="iProg">${Object.entries(PROGRESSIONS).map(([k, v]) => `<button type="button" class="chip" data-p="${k}" aria-pressed="${k === it.progression}">${v.label}</button>`).join('')}</div>
        <small class="muted" id="iProgHint">${esc(PROGRESSIONS[it.progression]?.hint || '')}</small></div>
      <label class="field inline"><span>Aumento de carga (kg)</span><input id="iInc" inputmode="decimal" value="${inputVal(it.increment)}" placeholder="${inputVal(ex.increment ?? 2.5)} (padrão do exercício)"></label>` : ''}
      <label class="field"><span>Observação</span><input id="iNote" value="${esc(it.note || '')}" placeholder="ex.: 10 por lado, pausa de 1 s embaixo"></label>
      <p class="muted small">Técnica, vídeos e ajustes do aparelho ficam no exercício: <a href="#/exercicios/${encodeURIComponent(ex.id || '')}" data-close>editar ${esc(ex.name)}</a>.</p>`,
    foot: `
      <button type="button" class="btn ghost danger-text" id="iDel">${icon('trash')} Remover</button>
      <button type="button" class="btn ghost" id="iSwap">${icon('swap')} Trocar</button>
      <button type="button" class="btn primary" id="iOk">OK</button>`,
  });
  const q = sel => $(sel, s.el);
  let prog = it.progression;
  q('#iRest').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; q('#iRestC').value = b.dataset.r; $$('#iRest .chip', s.el).forEach(c => c.setAttribute('aria-pressed', c === b)); };
  q('#iProg')?.addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    prog = b.dataset.p;
    $$('#iProg .chip', s.el).forEach(c => c.setAttribute('aria-pressed', c === b));
    q('#iProgHint').textContent = PROGRESSIONS[prog].hint;
  });
  const apply = () => {
    const sets = Math.max(1, Math.min(20, num(q('#iSets').value) || it.sets));
    const lo = num(q('#iMin').value), hi = num(q('#iMax').value);
    Object.assign(it, {
      sets,
      repsMin: lo ?? it.repsMin,
      repsMax: Math.max(hi ?? lo ?? it.repsMax, lo ?? 0),
      restSec: Math.max(0, Math.min(900, num(q('#iRestC').value) ?? it.restSec)),
      progression: prog,
      increment: q('#iInc') ? num(q('#iInc').value) : it.increment,
      note: q('#iNote').value.trim(),
    });
    delete it._rest;
  };
  q('#iOk').onclick = async () => { apply(); await upsert('plans', plan); s.close(); redraw(); };
  q('#iDel').onclick = async () => { plan.items.splice(i, 1); await upsert('plans', plan); s.close(); redraw(); };
  q('#iSwap').onclick = async () => {
    apply();
    s.close();
    const nx = await pickExercise({ title: 'Trocar por…', prefer: ex.group, exclude: ex.id });
    if (nx) { it.exerciseId = nx.id; if (nx.type !== 'weight') it.progression = 'none'; }
    await upsert('plans', plan);
    redraw();
  };
}
