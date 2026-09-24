// Tela do treino em andamento.
// Em cima: lista de exercícios (edição livre). Embaixo, no alcance do polegar: o "painel da vez",
// que mostra a série atual com botões −/+ e vira cronômetro de descanso ao concluir.
import { state, list, get, on } from '../state.js';
import * as act from '../actions.js';
import * as timer from '../timer.js';
import { targetReps, stats, smartEnd, differsFromPlan, volumeOf } from '../logic/session.js';
import { platesFor, warmupFor } from '../logic/plates.js';
import { esc, fmtKg, fmtNum, num, inputVal, clock, mmss, range, fmtRest, fmtDuration, fmtDate, norm } from '../logic/format.js';
import { historyFor, records } from '../logic/progression.js';
import { groupColor } from '../seed.js';
import { thumbHtml, openMedia } from '../media.js';
import { $, $$, icon, toast, sheet, ask, menu } from '../ui.js';

let root = null;
let off = [];
let dockMin = false;
try { dockMin = localStorage.getItem('treino:dockMin') === '1'; } catch { /* sem storage */ }

export function render(el) {
  root = el;
  const s = state.active;
  if (!s) { location.replace('#/'); return; }
  el.innerHTML = `
    <header class="wk-head">
      <a class="icon-btn" href="#/" aria-label="Voltar ao início">${icon('back')}</a>
      <div class="wk-title"><b>${esc(s.planName)}</b><span id="wkCount"></span></div>
      <div class="wk-clock" id="wkClock" aria-label="Tempo total de treino">0:00</div>
      <button type="button" class="btn primary sm" id="wkFinish">Finalizar</button>
    </header>
    <div class="progress" aria-hidden="true"><i id="wkProg"></i></div>
    <div id="wkList" class="wk-list"></div>
    <div class="wk-more">
      <button type="button" class="btn ghost" id="wkAdd">${icon('plus')} Adicionar exercício</button>
    </div>
    <section class="dock" id="dock" aria-live="polite"></section>`;
  renderList();
  renderDock();
  updateHead();
  bind();
  const cur = act.current();
  if (cur) setTimeout(() => scrollToSet(cur, 'auto'), 30);
  return { destroy };
}

function destroy() { off.forEach(f => f()); off = []; root = null; }

// ---------- lista ----------
function renderList() {
  const s = state.active;
  const cur = act.current();
  $('#wkList', root).innerHTML = s.items.length
    ? s.items.map((it, i) => cardHtml(it, i, cur)).join('')
    : `<div class="empty">${icon('dumbbell')}<p>Treino vazio. Adicione exercícios da biblioteca.</p></div>`;
}

function renderCard(i) {
  const el = $(`#card-${i}`, root);
  if (el) el.outerHTML = cardHtml(state.active.items[i], i, act.current());
}

function cardHtml(it, i, cur) {
  const ex = get.exercise(it.exerciseId) || { name: it.name, group: it.group };
  const s = state.active;
  const linkedFromPrev = i > 0 && s.items[i - 1].target.linkNext;
  const done = it.sets.length && it.sets.every(x => x.done);
  const sug = it.suggestion || {};
  const unit = it.type === 'time' ? 's' : 'reps';
  const rows = it.sets.map((st, k) => rowHtml(it, i, st, k, cur)).join('');
  const setup = ex.setup || '';
  return `
  <article class="card ex-card ${done ? 'complete' : ''}" id="card-${i}" data-i="${i}" style="--c:${groupColor(it.group)}">
    ${linkedFromPrev ? `<div class="link-tag">${icon('link')} superset com o anterior</div>` : ''}
    <div class="ex-top">
      <button type="button" class="thumb" data-act="media" aria-label="Como fazer ${esc(it.name)}">${thumbHtml(ex)}</button>
      <div class="ex-meta">
        <div class="kicker">${esc(it.group || '')}${it.perSide ? ' · carga por halter/lado' : ''}</div>
        <h3>${esc(it.name)}</h3>
        <div class="muted small">${it.sets.length} × ${range(it.target.repsMin, it.target.repsMax)} ${unit} · ${it.target.linkNext ? `troca em ${fmtRest(it.target.restSec)}` : `desc. ${fmtRest(it.target.restSec)}`}</div>
      </div>
      <button type="button" class="icon-btn" data-act="menu" aria-label="Opções de ${esc(it.name)}">${icon('more')}</button>
    </div>
    ${it.note ? `<div class="ex-note">${esc(it.note)}</div>` : ''}
    ${setup ? `<button type="button" class="ex-setup" data-act="setup">${icon('wrench')}<span>${esc(setup)}</span></button>` : ''}
    <div class="ex-sug ${sug.trend || ''}">${sug.trend === 'up' ? icon('up') : sug.trend === 'down' ? icon('down') : ''}<span>${esc(sug.text || '')}</span></div>
    <div class="ex-extra" id="extra-${i}">${extraHtml(it)}</div>
    <div class="sets" role="table" aria-label="Séries de ${esc(it.name)}">
      <div class="set-head" role="row"><span>Série</span><span>Anterior</span><span>${it.type === 'weight' ? 'kg' : it.type === 'time' ? 'kg' : ''}</span><span>${it.type === 'time' ? 'seg' : 'reps'}</span><span></span></div>
      ${rows}
    </div>
    <div class="ex-foot">
      <button type="button" class="link-btn" data-act="add-set">${icon('plus')} Série</button>
      <button type="button" class="link-btn" data-act="history">${icon('history')} Histórico</button>
    </div>
  </article>`;
}

function setLabel(it, k) {
  const st = it.sets[k];
  if (st.kind === 'warmup') return 'Aq';
  const n = it.sets.slice(0, k + 1).filter(x => x.kind !== 'warmup').length;
  return st.kind === 'drop' ? `${n}D` : String(n);
}

function prevTxt(it, k) {
  const working = it.sets.slice(0, k).filter(x => x.kind !== 'warmup').length;
  const p = it.sets[k].kind === 'warmup' ? null : it.prev?.[working];
  if (!p) return '—';
  if (it.type === 'time') return p.sec != null ? `${p.sec}s` : '—';
  return p.kg > 0 ? `${fmtKg(p.kg)}×${p.reps ?? '–'}` : `×${p.reps ?? '–'}`;
}

function rowHtml(it, i, st, k, cur) {
  const isNow = cur && cur[0] === i && cur[1] === k;
  const f2 = it.type === 'time' ? 'sec' : 'reps';
  const ph = targetReps(it);
  const kgCell = it.type === 'reps'
    ? `<span class="muted small center">—</span>`
    : `<input class="num" inputmode="decimal" enterkeyhint="done" data-f="kg" data-k="${k}" value="${esc(inputVal(st.kg))}" placeholder="kg" aria-label="Carga da série ${k + 1}">`;
  return `
    <div class="set-row ${isNow ? 'now' : ''} ${st.done ? 'done' : ''} ${st.kind}" role="row" id="row-${i}-${k}" data-k="${k}">
      <button type="button" class="set-n" data-act="kind" aria-label="Tipo da série (normal, aquecimento, drop)">${setLabel(it, k)}</button>
      <button type="button" class="set-prev" data-act="prev" title="Usar valores da última vez">${prevTxt(it, k)}</button>
      ${kgCell}
      <input class="num" inputmode="numeric" enterkeyhint="done" data-f="${f2}" data-k="${k}" value="${esc(inputVal(st[f2]))}" placeholder="${ph ?? ''}" aria-label="${f2 === 'sec' ? 'Segundos' : 'Repetições'} da série ${k + 1}">
      <button type="button" class="tick" data-act="tick" aria-pressed="${st.done}" aria-label="Concluir série ${k + 1}">${icon('check')}</button>
      ${st.pr ? `<div class="pr">${icon('trophy')} ${st.pr === 'kg' ? 'Recorde de carga' : 'Recorde de força estimada'}</div>` : ''}
    </div>`;
}

function extraHtml(it) {
  if (!it.barbell) return '';
  const pending = it.sets.find(x => !x.done) || it.sets[it.sets.length - 1];
  const kg = pending?.kg;
  if (!kg) return '';
  const bar = state.settings.bar ?? 20;
  const p = platesFor(kg, bar, state.settings.plates);
  const bits = [];
  if (p) bits.push(`<span>Anilhas por lado: <b>${p.perSide.length ? p.perSide.map(x => fmtKg(x)).join(' + ') : 'só a barra'}${p.rest ? ` (+${fmtKg(p.rest)})` : ''}</b></span>`);
  const w = warmupFor(kg, bar);
  if (w.length && !it.sets.some(x => x.done)) bits.push(`<span>Aquecimento: <b>${w.map(x => `${fmtKg(x.kg)}×${x.reps}`).join(', ')}</b></span>`);
  return bits.join('');
}

// ---------- painel inferior ----------
function renderDock() {
  const s = state.active;
  const d = $('#dock', root);
  if (!d) return;
  const r = s.rest, w = s.work;
  d.className = 'dock';
  if (w) {
    const it = s.items[w.ref[0]];
    d.classList.add('dock-work');
    d.innerHTML = `
      <div class="dock-row">
        <div><div class="dock-kicker" id="dkLbl">Prepare-se</div><div class="dock-big" id="dkBig">0:00</div></div>
        <div class="dock-next"><div class="dock-kicker">Série por tempo</div><b>${esc(it.name)}</b><span>série ${w.ref[1] + 1} · ${w.sec} s</span></div>
      </div>
      <div class="bar"><i id="dkBar"></i></div>
      <div class="dock-btns one"><button type="button" class="btn ghost-inv" data-dock="stop-work">Parar</button></div>`;
    tickDock();
    return;
  }
  if (r) {
    const n = r.next || {};
    d.classList.add('dock-rest');
    d.innerHTML = `
      <div class="dock-row">
        <div><div class="dock-kicker" id="dkLbl">${n.transition ? 'Troca de exercício' : 'Descanso'}</div><div class="dock-big" id="dkBig">${mmss(timer.restLeft())}</div></div>
        <div class="dock-next"><div class="dock-kicker">Próximo</div><b>${esc(n.name || '')}</b>
          <span>${nextTxt(n)}</span></div>
      </div>
      <div class="bar"><i id="dkBar"></i></div>
      <div class="dock-btns">
        <button type="button" class="btn ghost-inv" data-dock="minus">−15 s</button>
        <button type="button" class="btn ghost-inv" data-dock="plus">+15 s</button>
        <button type="button" class="btn ghost-inv" data-dock="skip">${icon('skip')} Pular</button>
      </div>`;
    tickDock();
    return;
  }
  const cur = act.current();
  if (!cur) {
    d.classList.add('dock-done');
    d.innerHTML = s.items.length ? `
      <div class="dock-done-msg">${icon('trophy')}<div><b>Todas as séries concluídas</b><span>${fmtDuration((Date.now() - s.startedAt) / 1000)} de treino</span></div></div>
      <button type="button" class="btn go big" data-dock="finish">${icon('check')} Finalizar treino</button>` : `
      <button type="button" class="btn go big" data-dock="add">${icon('plus')} Adicionar exercício</button>`;
    return;
  }
  const [i, k] = cur;
  const it = s.items[i], st = it.sets[k];
  const f2 = it.type === 'time' ? 'sec' : 'reps';
  const v2 = st[f2] ?? targetReps(it);
  d.classList.toggle('min', dockMin);
  d.innerHTML = `
    <button type="button" class="dock-grip" data-dock="min" aria-label="${dockMin ? 'Expandir' : 'Recolher'} painel"><span></span></button>
    <div class="dock-top">
      <div><div class="dock-kicker">Série ${k + 1} de ${it.sets.length}${st.kind === 'warmup' ? ' · aquecimento' : ''}</div><b class="dock-name">${esc(it.name)}</b></div>
      <button type="button" class="icon-btn inv" data-dock="media" aria-label="Ver execução">${icon('video')}</button>
    </div>
    <div class="dock-steppers ${it.type === 'reps' ? 'single' : ''}">
      ${it.type === 'reps' ? '' : stepper('kg', st.kg, it.type === 'time' ? 'kg extra' : (it.perSide ? 'kg (cada)' : 'kg'))}
      ${stepper(f2, v2, f2 === 'sec' ? 'segundos' : 'reps', st[f2] == null)}
    </div>
    <div class="dock-min-line"><b>${esc(it.name)}</b> · S${k + 1} · ${it.type !== 'reps' && st.kg != null ? `${fmtKg(st.kg)} kg × ` : ''}${v2 ?? '–'}</div>
    ${it.type === 'time'
      ? `<button type="button" class="btn go big" data-dock="work">${icon('timer')} Iniciar ${v2 || 30} s</button>`
      : `<button type="button" class="btn go big" data-dock="done">${icon('check')} Concluir série</button>`}`;
}

function nextTxt(n) {
  const load = n.sec ? `${n.sec} s` : n.kg != null ? `${fmtKg(n.kg)} kg × ${n.reps ?? '–'}` : n.reps ? `${n.reps} reps` : '';
  return `série ${n.setNo}${n.of ? ` de ${n.of}` : ''}${load ? ` · ${load}` : ''}`;
}

function stepper(f, v, label, placeholder = false) {
  const txt = v == null ? '–' : f === 'kg' ? fmtKg(v) : fmtNum(v, 0);
  return `
    <div class="stepper">
      <button type="button" data-step="${f}" data-dir="-1" aria-label="Diminuir ${label}">${icon('minus')}</button>
      <div class="stepper-val"><b class="${placeholder ? 'ph' : ''}">${txt}</b><small>${label}</small></div>
      <button type="button" data-step="${f}" data-dir="1" aria-label="Aumentar ${label}">${icon('plus')}</button>
    </div>`;
}

function tickDock() {
  const s = state.active;
  if (!s || !root) return;
  const big = $('#dkBig', root), bar = $('#dkBar', root), d = $('#dock', root);
  if (s.work && big) {
    const now = Date.now(), w = s.work;
    const prep = now < w.prepEnd;
    const left = prep ? (w.prepEnd - now) / 1000 : (w.endAt - now) / 1000;
    $('#dkLbl', root).textContent = prep ? 'Prepare-se' : 'Vai!';
    big.textContent = prep ? String(Math.ceil(left)) : mmss(Math.ceil(left));
    bar.style.width = `${prep ? 100 : Math.max(0, Math.min(100, left / w.sec * 100))}%`;
    return;
  }
  const r = s.rest;
  if (r && big) {
    if (r.endedAt) {
      d.classList.add('ended');
      $('#dkLbl', root).textContent = 'Hora da próxima série';
      big.textContent = 'Vai!';
      bar.style.width = '0%';
      return;
    }
    const left = timer.restLeft();
    big.textContent = mmss(Math.ceil(left));
    bar.style.width = `${Math.max(0, Math.min(100, left / r.total * 100))}%`;
    d.classList.toggle('warn', state.settings.warnSec > 0 && left <= state.settings.warnSec);
  }
}

// ---------- cabeçalho ----------
function updateHead() {
  const s = state.active;
  if (!s || !root) return;
  const st = stats(s);
  $('#wkClock', root).textContent = clock((Date.now() - s.startedAt) / 1000);
  $('#wkCount', root).textContent = `${st.done}/${st.total} séries${st.volume ? ` · ${fmtNum(st.volume, 0)} kg` : ''}`;
  $('#wkProg', root).style.width = `${st.total ? (st.done / st.total) * 100 : 0}%`;
}

function scrollToSet(ref, behavior = 'smooth') {
  const row = $(`#row-${ref[0]}-${ref[1]}`, root);
  if (!row) return;
  const r = row.getBoundingClientRect();
  const dockH = $('#dock', root)?.offsetHeight || 0;
  if (r.top < 90 || r.bottom > innerHeight - dockH - 10) row.scrollIntoView({ behavior, block: 'center' });
}

// ---------- eventos ----------
function bind() {
  off.push(
    onEvt('tick', () => { updateHead(); tickDock(); }),
    onEvt('timer', () => renderDock()),
    onEvt('rest-end', () => renderDock()),
    onEvt('active', detail => {
      if (!state.active) return;
      if (detail?.structure || detail?.undone || detail?.item != null) renderList();
      else if (detail?.cursor) markNow();
      else if (detail?.done) {
        renderCard(detail.done[0]);
        if (detail.next && detail.next[0] !== detail.done[0]) renderCard(detail.next[0]);
        if (detail.next) setTimeout(() => scrollToSet(detail.next), 120);
      } else if (detail?.edit) syncRow(detail.edit[0], detail.edit[1]);
      renderDock();
      updateHead();
    }),
  );

  const list_ = $('#wkList', root);
  list_.addEventListener('input', e => {
    const t = e.target;
    if (!t.dataset.f) return;
    const i = +t.closest('.ex-card').dataset.i, k = +t.dataset.k;
    const v = num(t.value);
    act.editSet(i, k, t.dataset.f, v);
    const it = state.active.items[i];
    if (t.dataset.f === 'kg') {
      // "memória": atualiza na tela as séries seguintes que herdaram a carga
      it.sets.forEach((st, j) => {
        if (j <= k) return;
        const inp = $(`#row-${i}-${j} input[data-f="kg"]`, root);
        if (inp && inp !== document.activeElement) inp.value = inputVal(st.kg);
      });
      const ex = $(`#extra-${i}`, root);
      if (ex) ex.innerHTML = extraHtml(it);
    }
    const cur = act.current();
    if (cur && cur[0] === i) renderDock();
  });
  list_.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });
  list_.addEventListener('focusin', e => {
    if (!e.target.matches('input.num')) return;
    setTimeout(() => e.target.select(), 0);
    // editar uma série pendente a torna a "série da vez" no painel
    const i = +e.target.closest('.ex-card').dataset.i, k = +e.target.dataset.k;
    const cur = act.current();
    if (!state.active.items[i].sets[k].done && !(cur && cur[0] === i && cur[1] === k)) act.setCursor([i, k]);
  });
  list_.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    const card = e.target.closest('.ex-card');
    if (!card) return;
    const i = +card.dataset.i;
    const it = state.active.items[i];
    const row = e.target.closest('.set-row');
    const k = row ? +row.dataset.k : null;
    if (!b) {
      // tocar numa linha pendente a torna a "série da vez"
      if (row && !it.sets[k].done && !e.target.matches('input')) act.setCursor([i, k]);
      return;
    }
    switch (b.dataset.act) {
      case 'tick': act.completeSet(i, k); break;
      case 'kind': act.cycleKind(i, k); break;
      case 'prev': usePrev(i, k); break;
      case 'media': media(i); break;
      case 'setup': editSetup(i); break;
      case 'add-set': act.addSet(i); break;
      case 'history': showHistory(it); break;
      case 'menu': itemMenu(i); break;
    }
  });

  $('#dock', root).addEventListener('click', e => {
    const step = e.target.closest('[data-step]');
    const cur = act.current();
    if (step && cur) { act.stepSet(cur[0], cur[1], step.dataset.step, +step.dataset.dir); return; }
    const b = e.target.closest('[data-dock]');
    if (!b) return;
    switch (b.dataset.dock) {
      case 'done': if (cur) act.completeSet(cur[0], cur[1]); break;
      case 'work': if (cur) { const it = state.active.items[cur[0]]; timer.startWork(it.sets[cur[1]].sec ?? targetReps(it) ?? 30, cur); } break;
      case 'stop-work': timer.stopWork(); break;
      case 'minus': timer.adjustRest(-15); break;
      case 'plus': timer.adjustRest(15); break;
      case 'skip': timer.stopRest(); break;
      case 'media': if (cur) media(cur[0]); break;
      case 'finish': finish(); break;
      case 'add': addExercise(); break;
      case 'min':
        dockMin = !dockMin;
        try { localStorage.setItem('treino:dockMin', dockMin ? '1' : '0'); } catch { /* ok */ }
        renderDock();
        break;
    }
  });
  $('#wkFinish', root).onclick = finish;
  $('#wkAdd', root).onclick = addExercise;
}

const onEvt = (type, fn) => on(type, d => { if (root) fn(d); });

/** Move o destaque da "série da vez" sem redesenhar a lista. */
function markNow() {
  $$('.set-row.now', root).forEach(r => r.classList.remove('now'));
  const cur = act.current();
  if (cur) $(`#row-${cur[0]}-${cur[1]}`, root)?.classList.add('now');
}

/** Atualiza só os inputs de uma linha (sem redesenhar e perder o foco). */
function syncRow(i, k) {
  const it = state.active.items[i];
  it.sets.forEach((st, j) => {
    if (j < k) return;
    const row = $(`#row-${i}-${j}`, root);
    if (!row) return;
    for (const inp of $$('input[data-f]', row)) if (inp !== document.activeElement) inp.value = inputVal(st[inp.dataset.f]);
  });
  const ex = $(`#extra-${i}`, root);
  if (ex) ex.innerHTML = extraHtml(it);
}

function usePrev(i, k) {
  const it = state.active.items[i];
  const working = it.sets.slice(0, k).filter(x => x.kind !== 'warmup').length;
  const p = it.prev?.[working];
  if (!p || it.sets[k].done) return;
  if (p.kg != null) act.editSet(i, k, 'kg', p.kg);
  if (p.reps != null) act.editSet(i, k, 'reps', p.reps);
  if (p.sec != null) act.editSet(i, k, 'sec', p.sec);
  renderCard(i);
  renderDock();
}

function media(i) {
  const it = state.active.items[i];
  const ex = get.exercise(it.exerciseId);
  if (!ex) return;
  openMedia(ex, { target: { ...it.target, sets: it.sets.length }, note: it.note, onEdit: () => { location.hash = `#/exercicios/${ex.id}`; } });
}

async function editSetup(i) {
  const it = state.active.items[i];
  const ex = get.exercise(it.exerciseId);
  if (!ex) return;
  const s = sheet({
    title: 'Ajustes do aparelho', cls: 'small',
    body: `<p class="muted small">Fica salvo no exercício e aparece em todos os treinos. Ex.: “banco na posição 4, pino 3, pegada aberta”.</p>
      <label class="field"><span>${esc(ex.name)}</span><textarea id="setupTxt" rows="3">${esc(ex.setup || '')}</textarea></label>`,
    foot: `<button type="button" class="btn primary" id="setupOk">Salvar</button>`,
  });
  const ta = $('#setupTxt', s.el);
  ta.focus();
  $('#setupOk', s.el).onclick = async () => { await act.saveSetupNote(ex.id, ta.value.trim()); s.close(); renderList(); toast('Ajuste salvo'); };
}

function showHistory(it) {
  const all = historyFor(list.gym(), it.exerciseId);
  const hist = all.slice(0, 8);
  const rec = records(all);
  const fmtSet = x => it.type === 'time' ? `${x.sec ?? '–'}s` : `${x.kg > 0 ? `${fmtKg(x.kg)}×` : '×'}${x.reps ?? '–'}`;
  sheet({
    title: it.name, cls: 'small',
    body: hist.length ? `
      ${rec.kg ? `<div class="stat-row"><div class="stat"><b>${fmtKg(rec.kg)} kg</b><span>maior carga</span></div><div class="stat"><b>${fmtKg(Math.round(rec.e1rm * 10) / 10)} kg</b><span>1RM estimado</span></div></div>` : ''}
      <ul class="plain">${hist.map(h => `<li><b>${fmtDate(h.date, true)}</b> <span>${h.sets.map(fmtSet).join(', ')}</span></li>`).join('')}</ul>`
      : '<p class="muted">Ainda não há registros deste exercício.</p>',
  });
}

async function itemMenu(i) {
  const it = state.active.items[i];
  const choice = await menu(it.name, [
    { id: 'media', label: 'Ver execução', icon: 'video' },
    { id: 'setup', label: 'Ajustes do aparelho', icon: 'wrench', hint: 'banco, pino, pegada…' },
    { id: 'swap', label: 'Trocar exercício', icon: 'swap', hint: 'aparelho ocupado' },
    { id: 'add', label: 'Adicionar série', icon: 'plus' },
    { id: 'remove-set', label: 'Remover série pendente', icon: 'minus' },
    { id: 'later', label: 'Fazer depois (mover para o fim)', icon: 'down' },
    { id: 'remove', label: 'Tirar do treino de hoje', icon: 'trash', danger: true },
  ]);
  switch (choice) {
    case 'media': media(i); break;
    case 'setup': editSetup(i); break;
    case 'swap': {
      const ex = await pickExercise({ title: 'Trocar por…', prefer: it.group, exclude: it.exerciseId, hint: get.exercise(it.exerciseId)?.alternatives });
      if (ex) { act.swapItem(i, ex); toast(`Trocado por ${ex.name}`); }
      break;
    }
    case 'add': act.addSet(i); break;
    case 'remove-set': act.removeSet(i); break;
    case 'later': act.moveItemToEnd(i); toast('Movido para o fim'); break;
    case 'remove':
      if (!it.sets.some(x => x.done) || await ask(`Tirar ${it.name} do treino de hoje? As séries feitas dele serão descartadas.`, { ok: 'Tirar', danger: true })) act.removeItem(i);
      break;
  }
}

/** Seletor de exercício da biblioteca (com busca). */
export async function pickExercise({ title = 'Adicionar exercício', prefer = '', exclude = null, hint = '' } = {}) {
  const all = list.exercises().filter(e => e.id !== exclude);
  const s = sheet({
    title,
    body: `
      ${hint ? `<p class="muted small">Sugestão do exercício: ${esc(hint)}</p>` : ''}
      <label class="search">${icon('search')}<input type="search" id="pkQ" placeholder="Buscar exercício" autocomplete="off"></label>
      <div class="pick-list" id="pkList"></div>
      <a class="btn ghost" href="#/exercicios/novo" data-close>${icon('plus')} Criar exercício novo</a>`,
  });
  const draw = q => {
    const nq = norm(q);
    const items = all.filter(e => !nq || norm(`${e.name} ${e.group} ${e.muscles} ${e.equipment}`).includes(nq))
      .sort((a, b) => (b.group === prefer) - (a.group === prefer));
    $('#pkList', s.el).innerHTML = items.map(e => `
      <button type="button" class="pick" data-id="${esc(e.id)}" style="--c:${groupColor(e.group)}">
        <span class="thumb sm">${thumbHtml(e)}</span>
        <span><b>${esc(e.name)}</b><small>${esc(e.group)} · ${esc(e.equipment || '')}</small></span>
      </button>`).join('') || '<p class="muted">Nada encontrado.</p>';
  };
  draw('');
  $('#pkQ', s.el).addEventListener('input', e => draw(e.target.value));
  $('#pkList', s.el).addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) s.close(get.exercise(b.dataset.id)); });
  return s.result;
}

async function addExercise() {
  const ex = await pickExercise();
  if (!ex) return;
  const i = act.addItem(ex);
  setTimeout(() => $(`#card-${i}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ---------- finalizar ----------
async function finish() {
  const s = state.active;
  const st = stats(s);
  if (!st.done) {
    if (await ask('Nenhuma série foi concluída. Descartar este treino?', { ok: 'Descartar', danger: true })) {
      await act.discardSession();
      location.hash = '#/';
    }
    return;
  }
  const end = smartEnd(s);
  const plan = s.planId ? get.plan(s.planId) : null;
  const prevSame = list.gym().find(x => x.planId && x.planId === s.planId);
  const prevVol = prevSame ? volumeOf(prevSame.items) : 0;
  const delta = prevVol && st.volume ? Math.round((st.volume / prevVol - 1) * 100) : null;
  const prs = s.items.flatMap(it => it.sets.filter(x => x.pr).map(x => ({ it, x })));
  const idle = end < Date.now() - 60e3;
  const sh = sheet({
    title: 'Finalizar treino',
    body: `
      <div class="stat-row three">
        <div class="stat"><b id="finDur">${fmtDuration((end - s.startedAt) / 1000)}</b><span>duração</span></div>
        <div class="stat"><b>${st.working}</b><span>séries</span></div>
        <div class="stat"><b>${fmtNum(st.volume, 0)}</b><span>kg de volume${delta != null ? ` <em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}%</em>` : ''}</span></div>
      </div>
      ${idle ? `<p class="muted small">O treino ficou aberto depois da última série; a duração usa o horário dela. Ajuste se precisar.</p>` : ''}
      <label class="field inline"><span>Duração (min)</span><input id="finMin" inputmode="numeric" value="${Math.max(1, Math.round((end - s.startedAt) / 60000))}"></label>
      ${prs.length ? `<div class="box good"><b>${icon('trophy')} Recordes de hoje</b>${prs.map(p => `${esc(p.it.name)}: ${fmtKg(p.x.kg)} kg × ${p.x.reps}`).join('<br>')}</div>` : ''}
      <div class="field"><span>Esforço geral (RPE)</span><div class="chips rpe" id="finRpe">${[5, 6, 7, 8, 9, 10].map(v => `<button type="button" class="chip" data-v="${v}" aria-pressed="false">${v}</button>`).join('')}</div></div>
      <label class="field inline"><span>Peso corporal (kg)</span><input id="finBw" inputmode="decimal" placeholder="opcional"></label>
      <label class="field"><span>Notas</span><textarea id="finNotes" rows="2" placeholder="Como se sentiu, dores, ajustes">${esc(s.notes || '')}</textarea></label>
      ${plan && differsFromPlan(s, plan) ? `<label class="check"><input type="checkbox" id="finPlan"> <span>Atualizar o <b>${esc(plan.name)}</b> com as mudanças de hoje (exercícios, ordem e nº de séries)</span></label>` : ''}`,
    foot: `
      <button type="button" class="btn primary big wide" id="finSave">${icon('check')} Salvar treino</button>
      <button type="button" class="btn ghost danger-text" id="finDiscard">Descartar</button>
      <button type="button" class="btn ghost" data-close>Continuar treinando</button>`,
  });
  let rpe = null;
  $('#finRpe', sh.el).onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    rpe = +b.dataset.v;
    $$('#finRpe .chip', sh.el).forEach(c => c.setAttribute('aria-pressed', c === b));
  };
  $('#finDiscard', sh.el).onclick = async () => {
    if (!await ask('Descartar este treino? As séries não serão salvas.', { ok: 'Descartar', danger: true })) return;
    sh.close();
    await act.discardSession();
    location.hash = '#/';
  };
  $('#finSave', sh.el).onclick = async () => {
    const min = num($('#finMin', sh.el).value);
    const endAt = min ? s.startedAt + min * 60000 : end;
    const saved = await act.finishSession({
      end: endAt, rpe, bodyweight: num($('#finBw', sh.el).value), notes: $('#finNotes', sh.el).value.trim(),
      updatePlan: !!$('#finPlan', sh.el)?.checked,
    });
    sh.close();
    location.hash = `#/historico/${saved.id}?novo=1`;
  };
}
