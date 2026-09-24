// Utilidades de interface: seletores, ícones, avisos (toast) e painéis (dialog).
import { esc } from './logic/format.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  skip: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  cloud: '<path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 8.5 4.5 4.5 0 0 1 17.5 18z"/>',
  weight: '<path d="M6 8h12l2 12H4z"/><circle cx="12" cy="5" r="2"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

// ---- toast ----
let toastTimer = 0;
export function toast(msg, { ms = 2600, action = '', onAction = null } = {}) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action && onAction) t.querySelector('button').onclick = () => { t.classList.remove('on'); onAction(); };
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

// ---- painéis (bottom sheet no celular, janela centralizada no computador) ----
/**
 * Abre um painel. `body` é HTML confiável (já escapado por quem chama).
 * @returns {{el: HTMLDialogElement, close: (v?:any)=>void, result: Promise<any>}}
 */
export function sheet({ title = '', body = '', foot = '', cls = '', onClose = null } = {}) {
  const d = document.createElement('dialog');
  d.className = `sheet ${cls}`;
  d.innerHTML = `
    <div class="sheet-head">
      <h2>${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('close')}</button>
    </div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
  document.body.append(d);
  let value;
  const result = new Promise(ok => d.addEventListener('close', () => {
    onClose?.();
    ok(value);
    setTimeout(() => d.remove(), 250);
  }));
  const close = v => { value = v; if (d.open) d.close(); };
  d.addEventListener('click', e => {
    if (e.target === d) close();
    if (e.target.closest('[data-close]')) close();
  });
  d.showModal();
  return { el: d, close, result };
}

/** Confirmação. */
export async function ask(msg, { title = 'Confirmar', ok = 'Confirmar', cancel = 'Cancelar', danger = false } = {}) {
  const s = sheet({
    title, cls: 'small',
    body: `<p class="lead">${esc(msg)}</p>`,
    foot: `<button type="button" class="btn ghost" data-v="0">${esc(cancel)}</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button>`,
  });
  s.el.querySelector('.sheet-foot').onclick = e => { const b = e.target.closest('[data-v]'); if (b) s.close(b.dataset.v === '1'); };
  return !!(await s.result);
}

/** Lista de ações (menu). items: [{id, label, icon, danger, hint}] */
export async function menu(title, items) {
  const s = sheet({
    title, cls: 'small',
    body: `<div class="menu">${items.map(it => `
      <button type="button" class="menu-item ${it.danger ? 'danger' : ''}" data-id="${esc(it.id)}">
        ${icon(it.icon || 'next')}<span>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span>
      </button>`).join('')}</div>`,
  });
  s.el.querySelector('.menu').onclick = e => { const b = e.target.closest('[data-id]'); if (b) s.close(b.dataset.id); };
  return s.result;
}

/** Download de um arquivo gerado no app. */
export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const vibrate = p => { try { navigator.vibrate?.(p); } catch { /* sem suporte (iPhone) */ } };
