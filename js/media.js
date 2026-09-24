// Como executar: vídeo do YouTube (trecho em loop, sem som) ou a animação, mais passos e dicas.
import { esc, fmtRest, range, mmss } from './logic/format.js';
import { thumbUrl, embedUrl, searchUrl, watchUrl } from './logic/youtube.js';
import { ANIM, animThumb, playAnim, ANIM_VIEWBOX } from './anim.js';
import { groupColor } from './seed.js';
import { sheet, icon } from './ui.js';

/** Miniatura do exercício: vídeo > animação > inicial do nome. */
export function thumbHtml(ex) {
  const v = ex?.videos?.[0];
  if (v) return `<img src="${thumbUrl(v.id)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="thumb-play">${icon('play')}</span>`;
  if (ex?.anim && ANIM[ex.anim]) return animThumb(ex.anim);
  return `<span class="thumb-letter" style="--c:${groupColor(ex?.group)}">${esc((ex?.name || '?').slice(0, 1))}</span>`;
}

let ytReady = null;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytReady) return ytReady;
  ytReady = new Promise((ok, fail) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); ok(window.YT); };
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api';
    sc.onerror = () => { ytReady = null; fail(new Error('YouTube indisponível')); };
    document.head.append(sc);
    setTimeout(() => fail(new Error('YouTube demorou')), 8000);
  });
  return ytReady;
}

/** Monta o player no elemento. Repete o trecho [start, end] em loop. Devolve função para destruir. */
export function mountVideo(host, v) {
  host.innerHTML = '<div class="video-slot"></div>';
  const slot = host.firstChild;
  let player = null, dead = false;
  if (!navigator.onLine) {
    host.innerHTML = `<div class="video-off">${icon('video')}<p>Sem internet: o vídeo não carrega agora. Os passos abaixo continuam disponíveis.</p></div>`;
    return () => {};
  }
  loadYT().then(YT => {
    if (dead) return;
    player = new YT.Player(slot, {
      host: 'https://www.youtube-nocookie.com',
      videoId: v.id,
      playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1, start: v.start || 0, ...(v.end ? { end: v.end } : {}) },
      events: {
        onReady: e => { e.target.mute(); e.target.playVideo(); },
        onStateChange: e => { if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(v.start || 0, true); e.target.playVideo(); } },
      },
    });
  }).catch(() => {
    if (dead) return;
    // Sem a API: incorpora direto (sem loop do trecho).
    slot.outerHTML = `<iframe src="${esc(embedUrl(v))}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  });
  return () => { dead = true; try { player?.destroy(); } catch { /* ok */ } };
}

/**
 * Painel "como fazer".
 * @param {object} ex  exercício da biblioteca
 * @param {{target?:object, note?:string, onEdit?:Function}} opts
 */
export function openMedia(ex, { target = null, note = '', onEdit = null } = {}) {
  const vids = ex.videos || [];
  const hasAnim = ex.anim && ANIM[ex.anim];
  const dose = target ? `${target.sets} × ${range(target.repsMin, target.repsMax)}${ex.type === 'time' ? ' s' : ''} · descanso ${fmtRest(target.restSec)}` : '';
  const body = `
    <div class="media-kicker" style="--c:${groupColor(ex.group)}">${esc(ex.group || '')}${ex.muscles ? ` · ${esc(ex.muscles)}` : ''}</div>
    <div class="media-stage" id="mStage">
      ${vids.length ? '' : hasAnim ? `<svg id="mAnim" viewBox="${ANIM_VIEWBOX}" role="img" aria-label="Animação do movimento"></svg>` : `<div class="video-off">${icon('video')}<p>Nenhum vídeo escolhido para este exercício.</p></div>`}
    </div>
    ${vids.length > 1 ? `<div class="chips" id="mChips">${vids.map((v, i) => `<button type="button" class="chip" data-v="${i}" aria-pressed="${i === 0}">${esc(v.title || `Vídeo ${i + 1}`)}${v.start ? ` · ${mmss(v.start)}` : ''}</button>`).join('')}</div>` : ''}
    <div class="media-links">
      ${vids.length ? `<a class="btn ghost sm" id="mOpen" href="${esc(watchUrl(vids[0].id, vids[0].start))}" target="_blank" rel="noopener">${icon('external')} Abrir no YouTube</a>` : ''}
      <a class="btn ghost sm" href="${esc(searchUrl(`${ex.name} execução correta`))}" target="_blank" rel="noopener">${icon('search')} Buscar vídeos</a>
      ${onEdit ? `<button type="button" class="btn ghost sm" id="mEdit">${icon('edit')} ${vids.length ? 'Editar vídeos' : 'Escolher vídeo'}</button>` : ''}
    </div>
    ${dose || note ? `<div class="box"><b>Meta</b>${esc(dose)}${note ? `<br>${esc(note)}` : ''}</div>` : ''}
    ${ex.setup ? `<div class="box"><b>${icon('wrench')} Ajustes do aparelho</b>${esc(ex.setup)}</div>` : ''}
    ${ex.steps?.length ? `<ol class="steps">${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${ex.mistakes ? `<div class="box"><b>Erro comum</b>${esc(ex.mistakes)}</div>` : ''}
    ${ex.alternatives ? `<div class="box"><b>Aparelho ocupado? Troque por</b>${esc(ex.alternatives)}</div>` : ''}`;
  let stop = () => {};
  const s = sheet({ title: ex.name, body, cls: 'media', onClose: () => stop() });
  const stage = s.el.querySelector('#mStage');
  const show = i => {
    stop();
    stop = mountVideo(stage, vids[i]);
    const open = s.el.querySelector('#mOpen');
    if (open) open.href = watchUrl(vids[i].id, vids[i].start);
  };
  if (vids.length) show(0);
  else if (hasAnim) stop = playAnim(s.el.querySelector('#mAnim'), ex.anim);
  s.el.querySelector('#mChips')?.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    s.el.querySelectorAll('#mChips .chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    show(+b.dataset.v);
  });
  s.el.querySelector('#mEdit')?.addEventListener('click', () => { s.close(); onEdit(); });
  return s;
}
