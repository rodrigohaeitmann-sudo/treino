// Cronômetros do treino: descanso (com toque de aviso e bipe final), séries por tempo,
// voz opcional e tela sempre ligada.
//
// Os bipes são agendados direto no relógio do áudio (AudioContext) no momento em que o descanso
// começa. Assim eles tocam na hora certa mesmo que o navegador atrase os timers de JavaScript.
import { state, saveActive, emit } from './state.js';
import { vibrate } from './ui.js';

let ctx = null;
let scheduled = [];

/** Precisa ser chamado dentro de um toque do usuário (regra dos navegadores para áudio). */
export function unlockAudio() {
  try {
    const fresh = !ctx;
    if (fresh) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    // App reaberto no meio de um descanso: agenda os bipes que faltam.
    const r = state.active?.rest;
    if (fresh && r && !r.endedAt) scheduleRest(r);
  } catch { /* sem áudio */ }
}

const PATTERNS = {
  warn: [[0, 880, 0.2]],                                        // um toque: faltam N segundos
  go: [[0, 988, 0.16], [0.22, 988, 0.16], [0.44, 1319, 0.34]],  // acabou o descanso
  start: [[0, 1319, 0.25]],                                     // começou a série por tempo
};

function tone(at, freq, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
  return g;
}

function play(pattern, atMs = Date.now()) {
  if (!state.settings.sound || !ctx) return [];
  const base = ctx.currentTime + Math.max(0, (atMs - Date.now()) / 1000);
  const vol = (state.settings.volume ?? 0.8) * 0.7;
  return PATTERNS[pattern].map(([d, f, len]) => tone(base + d, f, len, vol));
}

function cancelScheduled() {
  for (const g of scheduled) { try { g.disconnect(); } catch { /* já tocou */ } }
  scheduled = [];
}

function scheduleRest(r) {
  cancelScheduled();
  const now = Date.now(), warn = state.settings.warnSec;
  if (warn > 0 && r.endAt - warn * 1000 > now + 150) scheduled.push(...play('warn', r.endAt - warn * 1000));
  if (r.endAt > now) scheduled.push(...play('go', r.endAt));
}

export function testSound() {
  unlockAudio();
  setTimeout(() => { play('warn'); play('go', Date.now() + 900); }, 60);
}

// ---- voz ----
export function speak(text) {
  if (!state.settings.voice || !('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* sem voz */ }
}

// ---- descanso ----
/** @param {number} sec  @param {{name:string, setNo:number, kg:number|null, reps:number|null, transition:boolean}} next */
export function startRest(sec, next) {
  const a = state.active;
  if (!a || !(sec > 0)) return;
  a.rest = { endAt: Date.now() + sec * 1000, total: sec, next, warned: false, endedAt: null };
  scheduleRest(a.rest);
  saveActive();
  emit('timer');
}

export function adjustRest(delta) {
  const r = state.active?.rest;
  if (!r) return;
  const now = Date.now();
  if (r.endedAt) {
    if (delta <= 0) return;
    Object.assign(r, { endAt: now + delta * 1000, total: delta, endedAt: null, warned: false });
  } else {
    r.endAt = Math.max(now, r.endAt + delta * 1000);
    r.total = Math.max(r.total, Math.ceil((r.endAt - now) / 1000));
    if (r.endAt - now > state.settings.warnSec * 1000) r.warned = false;
  }
  scheduleRest(r);
  saveActive();
  emit('timer');
}

export function stopRest() {
  cancelScheduled();
  if (state.active) state.active.rest = null;
  saveActive();
  emit('timer');
}

export const restLeft = () => { const r = state.active?.rest; return r && !r.endedAt ? Math.max(0, (r.endAt - Date.now()) / 1000) : 0; };

// ---- série por tempo (prancha etc.): 5 s para se posicionar, depois a contagem ----
export const PREP_SEC = 5;
export function startWork(sec, ref) {
  const a = state.active;
  if (!a) return;
  unlockAudio();
  stopRest();
  const now = Date.now();
  a.work = { ref, prepEnd: now + PREP_SEC * 1000, endAt: now + (PREP_SEC + sec) * 1000, sec };
  cancelScheduled();
  scheduled.push(...play('warn', now), ...play('start', a.work.prepEnd), ...play('go', a.work.endAt));
  saveActive();
  emit('timer');
}
export function stopWork() {
  cancelScheduled();
  if (state.active) state.active.work = null;
  saveActive();
  emit('timer');
}

// ---- laço do relógio ----
function tick() {
  const a = state.active;
  if (a) {
    const now = Date.now();
    const r = a.rest;
    if (r && !r.endedAt) {
      const left = r.endAt - now;
      const warn = state.settings.warnSec;
      if (!r.warned && warn > 0 && left <= warn * 1000) {
        r.warned = true;
        if (left > 0) {
          if (state.settings.vibrate) vibrate(160);
          const n = r.next;
          if (n) speak(`Prepare-se. ${n.name}${n.kg ? `, ${String(n.kg).replace('.', ',')} quilos` : ''}.`);
        }
        saveActive();
      }
      if (left <= 0) {
        r.endedAt = now;
        const late = -left > 3000; // voltou ao app muito depois: não faz alarde
        if (!late && state.settings.vibrate) vibrate([260, 120, 260]);
        saveActive();
        emit('rest-end', { late });
      }
    } else if (r && r.endedAt && now - r.endedAt > 3500) {
      a.rest = null;
      saveActive();
      emit('timer');
    }
    const w = a.work;
    if (w && now >= w.endAt) {
      a.work = null;
      if (state.settings.vibrate) vibrate([260, 120, 260]);
      saveActive();
      emit('work-done', w);
    }
  }
  emit('tick');
}

// ---- tela ligada ----
let lock = null;
export async function keepAwake() {
  if (!state.settings.keepAwake || !('wakeLock' in navigator) || lock) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch { /* negado ou sem suporte */ }
}
export function releaseAwake() {
  try { lock?.release(); } catch { /* já liberado */ }
  lock = null;
}

export function initTimers() {
  setInterval(tick, 250);
  // Qualquer toque destrava o áudio (iOS/Chrome só liberam som depois de interação).
  document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.active) return;
    keepAwake();
    unlockAudio();
    const r = state.active.rest;
    if (r && !r.endedAt) scheduleRest(r); // o navegador pode ter suspendido o áudio em segundo plano
  });
}
