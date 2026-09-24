// Biblioteca de exercícios e editor (técnica, ajustes do aparelho e vídeos do YouTube).
import { list, get, upsert, remove } from '../state.js';
import { esc, norm, num, uid, mmss, parseClock, inputVal } from '../logic/format.js';
import { parseYouTube, thumbUrl, searchUrl } from '../logic/youtube.js';
import { GROUPS, EQUIPMENT, groupColor } from '../seed.js';
import { thumbHtml, openMedia } from '../media.js';
import { tabs } from './plans.js';
import { $, icon, toast, ask } from '../ui.js';

const TYPES = { weight: 'Carga × repetições', reps: 'Só repetições (peso corporal)', time: 'Tempo (isometria)' };

export function renderList(el) {
  let q = '';
  const draw = () => {
    const nq = norm(q);
    const all = list.exercises().filter(e => !nq || norm(`${e.name} ${e.group} ${e.muscles} ${e.equipment}`).includes(nq));
    const groups = GROUPS.map(g => [g.id, all.filter(e => e.group === g.id)]).filter(([, a]) => a.length);
    const orphan = all.filter(e => !GROUPS.some(g => g.id === e.group));
    if (orphan.length) groups.push(['Outro', orphan]);
    el.querySelector('#exGroups').innerHTML = groups.map(([g, arr]) => `
      <h2 class="section">${esc(g)} <small class="muted">${arr.length}</small></h2>
      <div class="pick-list">${arr.map(e => `
        <a class="pick" href="#/exercicios/${encodeURIComponent(e.id)}" style="--c:${groupColor(e.group)}">
          <span class="thumb sm">${thumbHtml(e)}</span>
          <span><b>${esc(e.name)}</b><small>${esc(e.equipment || '')}${e.videos?.length ? ` · ${e.videos.length} vídeo${e.videos.length > 1 ? 's' : ''}` : ''}${e.setup ? ' · ajuste salvo' : ''}</small></span>
          ${icon('next', 'muted')}
        </a>`).join('')}</div>`).join('') || '<p class="muted">Nada encontrado.</p>';
  };
  el.innerHTML = `
    ${tabs('ex')}
    <label class="search">${icon('search')}<input type="search" id="exQ" placeholder="Buscar por nome, músculo ou aparelho" autocomplete="off"></label>
    <div id="exGroups"></div>
    <a class="btn primary block" href="#/exercicios/novo">${icon('plus')} Novo exercício</a>`;
  draw();
  $('#exQ', el).addEventListener('input', e => { q = e.target.value; draw(); });
  return { refresh: draw };
}

export function renderEdit(el, [id], ctx) {
  const isNew = id === 'novo';
  const src = isNew ? null : get.exercise(id);
  if (!isNew && !src) { el.innerHTML = `<div class="empty"><p>Exercício não encontrado.</p><a class="btn ghost" href="#/exercicios">Voltar</a></div>`; return; }
  const ex = src ? structuredClone(src) : {
    id: uid('ex'), name: '', group: 'Peito', equipment: 'Halter', type: 'weight', perSide: false, barbell: false, increment: 2,
    muscles: '', setup: '', steps: [], mistakes: '', alternatives: '', videos: [], anim: null,
  };
  ctx.setTitle(isNew ? 'Novo exercício' : ex.name);
  let dirty = false;

  const videosHtml = () => ex.videos.map((v, i) => `
    <div class="video-row" data-v="${i}">
      <button type="button" class="video-thumb" data-act="preview" aria-label="Ver vídeo"><img src="${thumbUrl(v.id)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="thumb-play">${icon('play')}</span></button>
      <div class="video-fields">
        <input data-vf="title" value="${esc(v.title || '')}" placeholder="Título (ex.: técnica, erros)" aria-label="Título do vídeo">
        <div class="grid2">
          <label class="field tight"><span>Início</span><input data-vf="start" inputmode="numeric" value="${v.start ? mmss(v.start) : ''}" placeholder="0:00"></label>
          <label class="field tight"><span>Fim</span><input data-vf="end" inputmode="numeric" value="${v.end ? mmss(v.end) : ''}" placeholder="até o fim"></label>
        </div>
      </div>
      <div class="video-tools">
        <button type="button" class="icon-btn sm" data-act="vup" aria-label="Usar como principal" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button type="button" class="icon-btn sm" data-act="vdel" aria-label="Remover vídeo">${icon('trash')}</button>
      </div>
    </div>`).join('') || '<p class="muted small">Nenhum vídeo ainda.</p>';

  el.innerHTML = `
    <label class="field"><span>Nome</span><input id="eName" value="${esc(ex.name)}" maxlength="60" placeholder="ex.: Supino reto"></label>
    <div class="grid2">
      <label class="field"><span>Grupo muscular</span><select id="eGroup">${GROUPS.map(g => `<option ${g.id === ex.group ? 'selected' : ''}>${esc(g.id)}</option>`).join('')}</select></label>
      <label class="field"><span>Equipamento</span><select id="eEquip">${EQUIPMENT.map(g => `<option ${g === ex.equipment ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Registro</span><select id="eType">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === ex.type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="field"><span>Aumento de carga (kg)</span><input id="eInc" inputmode="decimal" value="${inputVal(ex.increment)}"></label>
      <label class="field"><span>Músculos</span><input id="eMusc" value="${esc(ex.muscles || '')}" placeholder="ex.: peitoral, tríceps"></label>
    </div>
    <label class="check"><input type="checkbox" id="eSide" ${ex.perSide ? 'checked' : ''}> <span>Carga por halter / por lado</span></label>
    <label class="check"><input type="checkbox" id="eBar" ${ex.barbell ? 'checked' : ''}> <span>Barra olímpica (mostra anilhas por lado e aquecimento)</span></label>

    <h2 class="section">${icon('video')} Vídeos de execução</h2>
    <p class="muted small">Busque no YouTube, copie o link do vídeo (ou do Short) e cole aqui. Defina início e fim para o app repetir só o trecho da execução, sem som.</p>
    <div class="row-btns">
      <a class="btn ghost" id="eSearch" href="${esc(searchUrl(`${ex.name || 'exercício'} execução correta`))}" target="_blank" rel="noopener">${icon('search')} Buscar no YouTube</a>
    </div>
    <div class="paste">
      <input id="eUrl" inputmode="url" placeholder="Cole o link do YouTube" autocomplete="off">
      <button type="button" class="btn primary" data-act="vadd">Adicionar</button>
    </div>
    <div id="eVideos">${videosHtml()}</div>

    <h2 class="section">${icon('wrench')} Ajustes do aparelho</h2>
    <label class="field"><textarea id="eSetup" rows="2" placeholder="ex.: banco na posição 4, pino 3, pegada aberta">${esc(ex.setup || '')}</textarea></label>

    <h2 class="section">Como executar</h2>
    <label class="field"><span>Passos (um por linha)</span><textarea id="eSteps" rows="5">${esc((ex.steps || []).join('\n'))}</textarea></label>
    <label class="field"><span>Erro comum</span><textarea id="eErr" rows="2">${esc(ex.mistakes || '')}</textarea></label>
    <label class="field"><span>Alternativas (aparelho ocupado)</span><input id="eAlt" value="${esc(ex.alternatives || '')}"></label>

    <div class="row-btns end sticky-actions">
      ${isNew ? '' : `<button type="button" class="btn ghost danger-text" data-act="delete">${icon('trash')} Excluir</button>`}
      <button type="button" class="btn ghost" data-act="preview-all">${icon('play')} Ver</button>
      <button type="button" class="btn primary" data-act="save">Salvar</button>
    </div>`;

  const q = sel => $(sel, el);
  const readForm = () => {
    Object.assign(ex, {
      name: q('#eName').value.trim(),
      group: q('#eGroup').value,
      equipment: q('#eEquip').value,
      type: q('#eType').value,
      increment: num(q('#eInc').value) ?? 0,
      muscles: q('#eMusc').value.trim(),
      perSide: q('#eSide').checked,
      barbell: q('#eBar').checked,
      setup: q('#eSetup').value.trim(),
      steps: q('#eSteps').value.split('\n').map(s => s.trim()).filter(Boolean),
      mistakes: q('#eErr').value.trim(),
      alternatives: q('#eAlt').value.trim(),
    });
  };
  const redrawVideos = () => { q('#eVideos').innerHTML = videosHtml(); };

  el.oninput = e => {
    dirty = true;
    if (e.target.id === 'eName') q('#eSearch').href = searchUrl(`${e.target.value.trim() || 'exercício'} execução correta`);
    const vf = e.target.dataset.vf;
    if (vf) {
      const v = ex.videos[+e.target.closest('[data-v]').dataset.v];
      if (vf === 'title') v.title = e.target.value.trim();
      else v[vf] = parseClock(e.target.value) || null;
    }
  };
  q('#eUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addVideo(); } });
  const addVideo = () => {
    const p = parseYouTube(q('#eUrl').value);
    if (!p) { toast('Link do YouTube não reconhecido'); return; }
    if (ex.videos.some(v => v.id === p.id)) { toast('Esse vídeo já está na lista'); return; }
    ex.videos.push({ id: p.id, start: p.start, end: null, title: '' });
    q('#eUrl').value = '';
    dirty = true;
    redrawVideos();
  };
  const save = async () => {
    readForm();
    if (!ex.name) { toast('Dê um nome ao exercício'); q('#eName').focus(); return false; }
    const cur = get.exercise(ex.id);
    await upsert('exercises', cur ? Object.assign(cur, ex) : ex);
    dirty = false;
    return true;
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const vi = b.closest('[data-v]') ? +b.closest('[data-v]').dataset.v : null;
    switch (b.dataset.act) {
      case 'vadd': addVideo(); break;
      case 'vdel': ex.videos.splice(vi, 1); dirty = true; redrawVideos(); break;
      case 'vup': ex.videos.unshift(...ex.videos.splice(vi, 1)); dirty = true; redrawVideos(); break;
      case 'preview': readForm(); openMedia({ ...ex, videos: [ex.videos[vi]] }); break;
      case 'preview-all': readForm(); openMedia(ex); break;
      case 'save':
        if (await save()) {
          toast('Exercício salvo');
          if (isNew) history.back(); else ctx.setTitle(ex.name);
        }
        break;
      case 'delete': {
        const used = list.plans().filter(p => p.items.some(it => it.exerciseId === ex.id)).map(p => p.name);
        const msg = used.length ? `${ex.name} está em: ${used.join(', ')}. Excluir mesmo assim? (Ele sai desses treinos.)` : `Excluir ${ex.name}? O histórico continua salvo.`;
        if (!await ask(msg, { ok: 'Excluir', danger: true })) return;
        for (const p of list.plans()) {
          if (p.items.some(it => it.exerciseId === ex.id)) { p.items = p.items.filter(it => it.exerciseId !== ex.id); await upsert('plans', p); }
        }
        await remove('exercises', ex.id);
        dirty = false;
        location.hash = '#/exercicios';
        break;
      }
    }
  };
  // Sai da tela com alterações: salva sozinho (se tiver nome).
  return {
    destroy: () => {
      if (!dirty) return;
      readForm();
      if (ex.name) upsert('exercises', Object.assign(get.exercise(ex.id) || ex, ex));
    },
  };
}
