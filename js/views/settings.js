// Ajustes: treino (som, aviso, voz), carga, planilha Google, backup e aparência.
import { state, saveSettings, saveSync, list, upsert, wipe, DEFAULT_SYNC } from '../state.js';
import { ping, syncNow, isConfigured } from '../sync.js';
import { testSound } from '../timer.js';
import { makeBackup, parseBackup, setsCsv, backupFileName } from '../logic/backup.js';
import { mergeIncoming } from '../logic/sync-merge.js';
import { SEED_PLANS } from '../seed.js';
import { esc, num, fmtKg, isoDate, inputVal } from '../logic/format.js';
import { $, icon, toast, ask, download } from '../ui.js';

const REPO_DOCS = 'https://github.com/rodrigohaeitmann-sudo/treino#sincronizar-com-o-google-sheets';

export function render(el) {
  const st = state.settings;
  const sy = state.sync;
  const toggle = (id, label, on, hint = '') => `
    <label class="switch-row"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
      <input type="checkbox" role="switch" id="${id}" ${on ? 'checked' : ''}></label>`;
  el.innerHTML = `
    <section class="card">
      <h2 class="card-title">${icon('timer')} Durante o treino</h2>
      ${toggle('sAuto', 'Iniciar descanso ao concluir a série', st.autoRest)}
      ${toggle('sSound', 'Bipes do descanso', st.sound, 'Um toque antes do fim e um bipe triplo quando acaba')}
      <div class="field inline"><span>Aviso antes do fim do descanso</span>
        <div class="chips" id="sWarn">${[0, 3, 5, 10].map(v => `<button type="button" class="chip" data-v="${v}" aria-pressed="${st.warnSec === v}">${v ? `${v} s` : 'sem aviso'}</button>`).join('')}</div></div>
      <label class="field inline"><span>Volume dos bipes</span><input type="range" id="sVol" min="0.1" max="1" step="0.1" value="${st.volume}"></label>
      <button type="button" class="btn ghost sm" id="sTest">${icon('sound')} Testar som</button>
      ${toggle('sVib', 'Vibrar', st.vibrate, 'Android; o iPhone não permite vibração pelo navegador')}
      ${toggle('sVoice', 'Anunciar o próximo exercício por voz', st.voice, 'No aviso de fim do descanso: “Prepare-se. Supino, 40 quilos.”')}
      ${toggle('sAwake', 'Manter a tela ligada durante o treino', st.keepAwake)}
    </section>

    <section class="card">
      <h2 class="card-title">${icon('weight')} Barra e anilhas</h2>
      <div class="grid2">
        <label class="field"><span>Peso da barra (kg)</span><input id="sBar" inputmode="decimal" value="${inputVal(st.bar)}"></label>
        <label class="field"><span>Anilhas disponíveis (kg)</span><input id="sPlates" value="${esc(st.plates.map(p => fmtKg(p)).join('; '))}"></label>
      </div>
      <p class="muted small">Usado na calculadora “anilhas por lado” e no aquecimento dos exercícios com barra.</p>
    </section>

    <section class="card" id="sync">
      <h2 class="card-title">${icon('cloud')} Google Sheets</h2>
      <p class="muted small">Opcional. Os treinos ficam sempre salvos neste aparelho; com a planilha você ganha backup, acesso em outros aparelhos e uma aba “Series” pronta para análises. <a href="${REPO_DOCS}" target="_blank" rel="noopener">Como configurar</a>.</p>
      <label class="field"><span>URL do App da Web (termina em /exec)</span><input id="sUrl" inputmode="url" value="${esc(sy.url)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
      <label class="field"><span>Token</span><input id="sTok" value="${esc(sy.token)}" autocomplete="off" spellcheck="false"></label>
      ${toggle('sAutoSync', 'Sincronizar automaticamente', sy.auto)}
      <div class="row-btns">
        <button type="button" class="btn ghost" id="sPing">Testar conexão</button>
        <button type="button" class="btn primary" id="sSyncNow">${icon('sync')} Sincronizar agora</button>
      </div>
      <p class="small ${sy.lastError ? 'bad' : 'muted'}" id="sSyncInfo">${syncInfo()}</p>
    </section>

    <section class="card">
      <h2 class="card-title">${icon('download')} Backup</h2>
      <div class="row-btns">
        <button type="button" class="btn ghost" id="sExport">${icon('download')} Exportar JSON</button>
        <button type="button" class="btn ghost" id="sCsv">${icon('download')} Séries em CSV</button>
        <label class="btn ghost">${icon('upload')} Importar<input type="file" id="sImport" accept=".json,application/json" hidden></label>
      </div>
      <p class="muted small">A importação aceita backups deste app e também os dados do artefato antigo (“Diário de treino”).</p>
    </section>

    <section class="card">
      <h2 class="card-title">Aparência</h2>
      <div class="chips" id="sTheme">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${st.theme === v}">${l}</button>`).join('')}</div>
    </section>

    <section class="card">
      <h2 class="card-title">Dados</h2>
      <p class="muted small">${list.sessions().length} registros · ${list.plans().length} treinos · ${list.exercises().length} exercícios · armazenamento: ${state.storage === 'indexeddb' ? 'IndexedDB' : 'localStorage'}</p>
      <div class="row-btns">
        <button type="button" class="btn ghost" id="sSeed">Restaurar Treinos A e B</button>
        <button type="button" class="btn ghost danger-text" id="sWipe">${icon('trash')} Apagar dados deste aparelho</button>
      </div>
    </section>`;

  const q = s => $(s, el);
  const set = async (k, v) => { st[k] = v; await saveSettings(); };
  q('#sAuto').onchange = e => set('autoRest', e.target.checked);
  q('#sSound').onchange = e => set('sound', e.target.checked);
  q('#sVib').onchange = e => set('vibrate', e.target.checked);
  q('#sVoice').onchange = e => { set('voice', e.target.checked); if (e.target.checked && !('speechSynthesis' in window)) toast('Este navegador não tem voz'); };
  q('#sAwake').onchange = e => set('keepAwake', e.target.checked);
  q('#sVol').oninput = e => set('volume', +e.target.value);
  q('#sTest').onclick = testSound;
  q('#sWarn').onclick = e => chip(e, 'sWarn', v => set('warnSec', +v));
  q('#sTheme').onclick = e => chip(e, 'sTheme', v => set('theme', v));
  q('#sBar').onchange = e => { const v = num(e.target.value); if (v != null && v >= 0) set('bar', v); };
  q('#sPlates').onchange = e => {
    const arr = e.target.value.split(/[;\s]+/).map(num).filter(v => v > 0).sort((a, b) => b - a);
    if (arr.length) set('plates', [...new Set(arr)]);
  };

  const saveConn = async () => {
    sy.url = q('#sUrl').value.trim();
    sy.token = q('#sTok').value.trim();
    await saveSync();
  };
  q('#sUrl').onchange = async () => { const changed = state.sync.url !== q('#sUrl').value.trim(); await saveConn(); if (changed) resetCursor(); };
  q('#sTok').onchange = saveConn;
  q('#sAutoSync').onchange = async e => { sy.auto = e.target.checked; await saveSync(); };
  q('#sPing').onclick = async () => {
    await saveConn();
    if (!isConfigured()) { toast('Preencha a URL e o token'); return; }
    const b = q('#sPing'); b.disabled = true;
    try {
      const r = await ping();
      toast(`Conectado! Planilha com ${r.counts?.sessions ?? 0} registros de treino.`, { ms: 4000 });
    } catch (err) { toast(err.message, { ms: 5000 }); }
    b.disabled = false;
  };
  q('#sSyncNow').onclick = async () => {
    await saveConn();
    if (!isConfigured()) { toast('Preencha a URL e o token'); return; }
    const b = q('#sSyncNow'); b.disabled = true;
    try {
      const r = await syncNow();
      toast(`Sincronizado: ${r.sent} enviados, ${r.received} recebidos`);
    } catch (err) { toast(err.message, { ms: 5000 }); }
    b.disabled = false;
    q('#sSyncInfo').textContent = syncInfo();
    q('#sSyncInfo').className = `small ${state.sync.lastError ? 'bad' : 'muted'}`;
  };

  q('#sExport').onclick = () => {
    const all = c => [...state[c].values()];
    download(backupFileName(), JSON.stringify(makeBackup({ exercises: all('exercises'), plans: all('plans'), sessions: all('sessions') }), null, 1));
  };
  q('#sCsv').onclick = () => download(`treino-series-${isoDate()}.csv`, setsCsv(list.sessions()), 'text/csv');
  q('#sImport').onchange = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = parseBackup(await f.text(), { exercises: state.exercises, plans: state.plans });
      const n = data.exercises.length + data.plans.length + data.sessions.length;
      if (!n) { toast('Nada para importar'); return; }
      if (!await ask(`Importar ${data.sessions.length} registros de treino${data.plans.length ? `, ${data.plans.length} treinos` : ''}${data.exercises.length ? ` e ${data.exercises.length} exercícios` : ''}? Registros mais novos já existentes são mantidos.`, { ok: 'Importar' })) return;
      for (const c of ['exercises', 'plans', 'sessions']) {
        const apply = mergeIncoming(state[c], data[c]);
        // importados precisam ir para a planilha: marca como alterados agora
        for (const r of apply) await upsert(c, r);
      }
      toast(`Importação concluída${data.legacy ? ' (dados do artefato antigo)' : ''}`);
    } catch (err) { toast(err.message, { ms: 5000 }); }
  };

  q('#sSeed').onclick = async () => {
    if (!await ask('Recriar os Treinos A e B originais? Se existirem, voltam à versão original.', { ok: 'Restaurar' })) return;
    for (const p of SEED_PLANS) await upsert('plans', structuredClone(p));
    toast('Treinos restaurados');
  };
  q('#sWipe').onclick = async () => {
    if (!await ask('Apagar todos os treinos, exercícios e histórico deste aparelho? A planilha não é alterada. Faça um backup antes.', { ok: 'Apagar tudo', danger: true })) return;
    await wipe();
    location.reload();
  };
  return {};
}

function chip(e, groupId, fn) {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  b.parentElement.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
  fn(b.dataset.v);
}

async function resetCursor() {
  // Outra planilha: recomeça a sincronização do zero (envia tudo, recebe tudo).
  Object.assign(state.sync, { cursor: DEFAULT_SYNC.cursor, lastPushAt: DEFAULT_SYNC.lastPushAt, lastSyncAt: 0, lastError: '' });
  await saveSync();
}

function syncInfo() {
  const s = state.sync;
  if (!s.url) return 'Não configurado.';
  if (s.lastError) return `Erro na última tentativa: ${s.lastError}`;
  if (!s.lastSyncAt) return 'Ainda não sincronizado.';
  return `Última sincronização: ${new Date(s.lastSyncAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`;
}
