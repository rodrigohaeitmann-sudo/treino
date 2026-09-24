// Utilidades puras de formatação e datas (sem DOM) — testáveis em Node.

/** Converte texto digitado ("12,5", "12.5", " 20 ") em número; vazio/ inválido → null. */
export function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Número no padrão pt-BR, com até `d` casas decimais. */
export function fmtNum(n, d = 1) {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: d });
}

export const fmtKg = n => fmtNum(n, 2);

/** Valor para preencher um <input> (vírgula decimal, vazio se nulo). */
export const inputVal = n => (n == null ? '' : String(n).replace('.', ','));

/** 83 → "1:23" */
export function mmss(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Cronômetro total: 754 → "12:34", 3754 → "1:02:34" */
export function clock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = x => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** Duração legível: 3900 → "1h05", 2520 → "42 min" */
export function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '–';
  const m = Math.round(sec / 60);
  if (m < 1) return sec > 0 ? '<1 min' : '0 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

/** "1:30" → 90, "90" → 90, "1:02:03" → 3723; inválido → null */
export function parseClock(s) {
  s = String(s ?? '').trim();
  if (!s) return null;
  const p = s.split(':').map(x => Number(x));
  if (p.some(x => !Number.isFinite(x) || x < 0)) return null;
  return p.reduce((acc, x) => acc * 60 + x, 0);
}

/** Data local no formato AAAA-MM-DD. */
export function isoDate(d = new Date()) {
  const x = new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** AAAA-MM-DD → Date ao meio-dia local (evita problemas de fuso). */
export const dateOf = iso => new Date(`${iso}T12:00:00`);

/** "2026-09-12" → "12/09" (ou "12/09/26" com ano) */
export function fmtDate(iso, withYear = false) {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return withYear ? `${d}/${m}/${y.slice(2)}` : `${d}/${m}`;
}

/** "2026-09-12" → "sáb., 12 de set." */
export function fmtDateLong(iso) {
  return dateOf(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Quantos dias entre duas datas ISO (b - a). */
export function daysBetween(a, b) {
  return Math.round((dateOf(b) - dateOf(a)) / 864e5);
}

/** "há 3 dias", "hoje", "ontem" */
export function relDays(iso, today = isoDate()) {
  const d = daysBetween(iso, today);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  const w = Math.floor(d / 7);
  if (d < 30) return w === 1 ? 'há 1 semana' : `há ${w} semanas`;
  const mo = Math.floor(d / 30);
  return mo === 1 ? 'há 1 mês' : `há ${mo} meses`;
}

/** Segunda-feira da semana de `d` (00:00 local). */
export function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Arredonda para o múltiplo de `step` mais próximo (step ≤ 0 → sem arredondar). */
export function roundTo(v, step) {
  if (!step || step <= 0) return v;
  return Math.round(Math.round(v / step) * step * 1000) / 1000;
}

/** Escapa texto para inserir em HTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Id curto, único o bastante para um usuário em vários aparelhos. */
export function uid(prefix = '') {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

/** Remove acentos e caixa para buscas. */
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** "a–b" ou "a" quando iguais */
export const range = (lo, hi) => (lo == null ? '' : lo === hi || hi == null ? String(lo) : `${lo}–${hi}`);

/** 90 → "90 s", 120 → "2 min", 150 → "2:30" */
export function fmtRest(sec) {
  if (!sec) return 'sem descanso';
  if (sec < 60) return `${sec} s`;
  return sec % 60 ? `${mmss(sec)} min` : `${sec / 60} min`;
}
