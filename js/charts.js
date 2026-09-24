// Gráficos em SVG, uma série por gráfico e um único eixo Y.
// Linha: 2px, marcadores com anel na cor da superfície, cursor que "gruda" no ponto mais próximo.
// Colunas: até 24px, topo arredondado, dica ao passar o dedo/mouse.
import { fmtNum } from './logic/format.js';

const NS = 'http://www.w3.org/2000/svg';

function niceTicks(lo, hi, count = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function frame(el, height) {
  el.innerHTML = '';
  el.classList.add('chart');
  const W = Math.max(280, Math.round(el.clientWidth || 340));
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(height));
  svg.setAttribute('tabindex', '0');
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  el.append(svg, tip);
  return { svg, tip, W };
}

const add = (parent, tag, attrs, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  parent.append(n);
  return n;
};

function showTip(el, tip, x, lead, sub) {
  tip.replaceChildren();
  const b = document.createElement('b'); b.textContent = lead;
  const s = document.createElement('span'); s.textContent = sub;
  tip.append(b, s);
  tip.hidden = false;
  const w = tip.offsetWidth, W = el.clientWidth;
  tip.style.left = `${Math.max(0, Math.min(W - w, x - w / 2))}px`;
}

function yAxis(svg, ticks, ys, W, L, R, fmt) {
  for (const t of ticks) {
    const y = ys(t);
    add(svg, 'line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' });
    add(svg, 'text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'axis' }, fmt(t));
  }
}

function xLabels(svg, labels, xs, H) {
  const n = labels.length;
  const every = Math.max(1, Math.ceil(n / 5));
  labels.forEach((l, i) => {
    if (i % every === 0 || i === n - 1) {
      if (i !== n - 1 && n - 1 - i < every) return; // evita colar no último rótulo
      add(svg, 'text', { x: xs(i), y: H - 6, 'text-anchor': 'middle', class: 'axis' }, l);
    }
  });
}

/**
 * @param {HTMLElement} el
 * @param {{label:string, y:number, sub?:string}[]} pts
 */
export function lineChart(el, pts, { fmt = v => fmtNum(v), unit = '', height = 190, zero = false } = {}) {
  pts = pts.filter(p => p.y != null && Number.isFinite(p.y));
  if (!pts.length) { el.innerHTML = '<p class="empty-chart">Sem registros ainda.</p>'; return; }
  const { svg, tip, W } = frame(el, height);
  const L = 44, R = 14, T = 12, B = 24, H = height;
  const vals = pts.map(p => p.y);
  const lo = zero ? 0 : Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1;
  const ticks = niceTicks(zero ? 0 : lo - pad, hi + pad);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const ys = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const n = pts.length;
  const xs = i => (n === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (n - 1));
  yAxis(svg, ticks, ys, W, L, R, fmt);
  xLabels(svg, pts.map(p => p.label), xs, H);
  if (n > 1) {
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join('');
    add(svg, 'path', { d: `${d}L${xs(n - 1)},${ys(y0)}L${xs(0)},${ys(y0)}Z`, class: 'area' });
    add(svg, 'path', { d, class: 'line' });
  }
  pts.forEach((p, i) => add(svg, 'circle', { cx: xs(i), cy: ys(p.y), r: 4, class: 'dot' }));
  // rótulo só no último ponto
  const lastX = xs(n - 1), lastY = ys(pts[n - 1].y);
  add(svg, 'text', { x: Math.min(lastX, W - R), y: lastY - 10, 'text-anchor': n > 1 ? 'end' : 'middle', class: 'val' }, `${fmt(pts[n - 1].y)}${unit ? ` ${unit}` : ''}`);

  const cross = add(svg, 'line', { x1: 0, x2: 0, y1: T, y2: H - B, class: 'cross', visibility: 'hidden' });
  const hot = add(svg, 'circle', { r: 6, class: 'dot hot', visibility: 'hidden' });
  let cur = -1;
  const pick = i => {
    cur = Math.max(0, Math.min(n - 1, i));
    const p = pts[cur], x = xs(cur);
    cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
    hot.setAttribute('cx', x); hot.setAttribute('cy', ys(p.y)); hot.setAttribute('visibility', 'visible');
    showTip(el, tip, (x / W) * el.clientWidth, `${fmt(p.y)}${unit ? ` ${unit}` : ''}`, p.sub || p.label);
  };
  const clear = () => { cross.setAttribute('visibility', 'hidden'); hot.setAttribute('visibility', 'hidden'); tip.hidden = true; cur = -1; };
  const idxAt = e => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    return n === 1 ? 0 : Math.round((x - L) / ((W - L - R) / (n - 1)));
  };
  svg.addEventListener('pointermove', e => pick(idxAt(e)));
  svg.addEventListener('pointerdown', e => pick(idxAt(e)));
  svg.addEventListener('pointerleave', clear);
  svg.addEventListener('blur', clear);
  svg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { pick(cur + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { pick(cur < 0 ? n - 1 : cur - 1); e.preventDefault(); }
  });
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Gráfico com ${n} pontos; último ${fmt(pts[n - 1].y)} ${unit}`);
}

/** Colunas verticais (ex.: treinos por semana). */
export function columnChart(el, bars, { fmt = v => fmtNum(v, 0), height = 170, highlightLast = true } = {}) {
  if (!bars.length) { el.innerHTML = '<p class="empty-chart">Sem registros ainda.</p>'; return; }
  const { svg, tip, W } = frame(el, height);
  const L = 30, R = 8, T = 16, B = 24, H = height;
  const max = Math.max(1, ...bars.map(b => b.y));
  const ticks = niceTicks(0, max, Math.min(4, Math.ceil(max)));
  const top = ticks[ticks.length - 1];
  const ys = v => T + (H - T - B) * (1 - v / top);
  const n = bars.length, band = (W - L - R) / n;
  const bw = Math.min(24, band * 0.6);
  const xs = i => L + band * (i + 0.5);
  yAxis(svg, ticks, ys, W, L, R, v => fmtNum(v, 1));
  xLabels(svg, bars.map(b => b.label), xs, H);
  bars.forEach((b, i) => {
    const x = xs(i) - bw / 2, y = ys(b.y), h = ys(0) - y;
    if (h > 0) {
      const r = Math.min(4, h, bw / 2);
      add(svg, 'path', { d: `M${x},${ys(0)}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${ys(0)}Z`, class: `bar${highlightLast && i === n - 1 ? ' last' : ''}` });
    }
    const hit = add(svg, 'rect', { x: xs(i) - band / 2, y: T, width: band, height: H - T - B, class: 'hit' });
    hit.addEventListener('pointerenter', () => showTip(el, tip, (xs(i) / W) * el.clientWidth, fmt(b.y), b.sub || b.label));
    hit.addEventListener('pointerdown', () => showTip(el, tip, (xs(i) / W) * el.clientWidth, fmt(b.y), b.sub || b.label));
  });
  const last = bars[n - 1];
  // rótulo curto (só o número) no topo da coluna atual; a unidade fica na dica
  if (last.y > 0) add(svg, 'text', { x: xs(n - 1), y: ys(last.y) - 5, 'text-anchor': 'middle', class: 'val' }, fmtNum(last.y, 1));
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${n} colunas; última ${fmt(last.y)}`);
}

/** Barras horizontais com valor na ponta (HTML, sem SVG). band = faixa de referência [min, max]. */
export function hBars(el, rows, { fmt = v => fmtNum(v, 0), band = null } = {}) {
  if (!rows.length) { el.innerHTML = '<p class="empty-chart">Sem registros ainda.</p>'; return; }
  const max = Math.max(1, ...rows.map(r => r.y), band ? band[1] : 0);
  el.innerHTML = `<div class="hbars">${rows.map(r => `
    <div class="hbar-row">
      <span class="hbar-label">${escapeText(r.label)}</span>
      <span class="hbar-track">
        ${band ? `<i class="hbar-band" style="left:${(band[0] / max) * 100}%;width:${((band[1] - band[0]) / max) * 100}%"></i>` : ''}
        <i class="hbar-fill" style="width:${(r.y / max) * 100}%"></i>
      </span>
      <span class="hbar-val">${fmt(r.y)}</span>
    </div>`).join('')}</div>`;
}

const escapeText = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
