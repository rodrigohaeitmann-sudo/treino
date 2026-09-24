// Animações esquemáticas (vista lateral) herdadas do artefato original.
// Servem de ilustração offline quando o exercício ainda não tem vídeo escolhido.

const G = 160; // chão
const LEN = {trunk:48, neck:7, head:9, ua:26, fa:24, th:40, sh:40, foot:13};
const P = (x, y) => [x, y];
function ik(a, t, l1, l2, sign){
  let dx = t[0]-a[0], dy = t[1]-a[1]; let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.01;
  if (d > max) { const k = max / d; t = [a[0]+dx*k, a[1]+dy*k]; dx*=k; dy*=k; d = max; }
  const x = (l1*l1 - l2*l2 + d*d) / (2*d); const h = Math.sqrt(Math.max(0, l1*l1 - x*x));
  const ux = dx/d, uy = dy/d;
  return [[a[0] + ux*x + (-uy)*h*sign, a[1] + uy*x + ux*h*sign], t];
}
function skeleton(p){
  const r = Math.PI/180, t = p.t*r;
  const hip = p.hip, sh = [hip[0] + Math.sin(t)*LEN.trunk, hip[1] - Math.cos(t)*LEN.trunk];
  const hc = [sh[0] + Math.sin(t)*(LEN.neck+LEN.head), sh[1] - Math.cos(t)*(LEN.neck+LEN.head)];
  const handOf = (h, hr) => h || [sh[0] + hr[0], sh[1] + hr[1]];
  const footOf = (f, fr) => f || [hip[0] + fr[0], hip[1] + fr[1]];
  const arm = (hand, s) => { const [el, hd] = ik(sh, hand, LEN.ua, LEN.fa, s); return {el, hd}; };
  const leg = (foot, s) => { const [kn, an] = ik(hip, foot, LEN.th, LEN.sh, s); return {kn, an}; };
  const out = {hip, sh, hc,
    a1: arm(handOf(p.hand, p.handRel || [0, 50]), p.es ?? 1),
    l1: leg(footOf(p.foot, p.footRel || [0, 80]), p.ks ?? -1)};
  if (p.hand2 || p.hand2Rel) out.a2 = arm(handOf(p.hand2, p.hand2Rel), p.es2 ?? p.es ?? 1);
  if (p.foot2 || p.foot2Rel) out.l2 = leg(footOf(p.foot2, p.foot2Rel), p.ks2 ?? p.ks ?? -1);
  out.toe = p.toe; out.toe2 = p.toe2; out.p = p;
  return out;
}
const lerp = (a, b, k) => typeof a === 'number' ? a + (b-a)*k : Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : a;
function mix(a, b, k){ const o = {}; for (const key in a) o[key] = (key in b) ? lerp(a[key], b[key], k) : a[key]; return o; }
const L = (a, b, w, c) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
function drawFigure(s){
  const ink = 'var(--ink)', far = 'var(--muted)';
  let g = '';
  const footLine = (an, toe, col) => g += L(an, toe || [an[0] + LEN.foot, an[1] + 1], 5, col);
  if (s.l2) { g += L(s.hip, s.l2.kn, 8, far) + L(s.l2.kn, s.l2.an, 7, far); footLine(s.l2.an, s.toe2, far); }
  if (s.a2) g += L(s.sh, s.a2.el, 6, far) + L(s.a2.el, s.a2.hd, 5, far);
  g += L(s.hip, s.l1.kn, 8, ink) + L(s.l1.kn, s.l1.an, 7, ink); footLine(s.l1.an, s.toe, ink);
  g += L(s.hip, s.sh, 11, ink);
  g += `<circle cx="${s.hc[0].toFixed(1)}" cy="${s.hc[1].toFixed(1)}" r="${LEN.head}" fill="${ink}"/>`;
  g += L(s.sh, s.a1.el, 6, ink) + L(s.a1.el, s.a1.hd, 5, ink);
  return g;
}
// adereços
const PROP = {
  plate: s => `<line x1="${s.a1.hd[0]-3}" y1="${s.a1.hd[1]}" x2="${s.a1.hd[0]+3}" y2="${s.a1.hd[1]}" stroke="var(--ink)" stroke-width="3"/><circle cx="${s.a1.hd[0]}" cy="${s.a1.hd[1]}" r="15" fill="none" stroke="var(--accent)" stroke-width="6"/>`,
  db: s => `<rect x="${s.a1.hd[0]-9}" y="${s.a1.hd[1]-4}" width="18" height="8" rx="2" fill="var(--accent)"/>`,
  wheel: s => `<circle cx="${s.a1.hd[0]}" cy="${s.a1.hd[1]}" r="8" fill="none" stroke="var(--accent)" stroke-width="4"/>`,
  cable: (s, from) => `<line x1="${from[0]}" y1="${from[1]}" x2="${s.a1.hd[0]}" y2="${s.a1.hd[1]}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 3"/><circle cx="${from[0]}" cy="${from[1]}" r="4" fill="var(--accent)"/>`,
  rect: (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="var(--line)"/>`,
  bench: (x1, x2, y) => `<rect x="${x1}" y="${y}" width="${x2-x1}" height="7" rx="2" fill="var(--line)"/><rect x="${x1+6}" y="${y+7}" width="5" height="${G-y-7}" fill="var(--line)"/><rect x="${x2-11}" y="${y+7}" width="5" height="${G-y-7}" fill="var(--line)"/>`
};

export const ANIM = {
  agachamento: {dur:1400, props: s => PROP.plate(s), frames:[
    {hip:P(100,80), t:4, foot:P(100,G-1), handRel:P(-4,6), es:-1},
    {hip:P(70,118), t:42, foot:P(100,G-1), handRel:P(-4,6), es:-1}]},
  supino: {dur:1300, back: () => PROP.bench(18, 112, 126), props: s => PROP.plate(s), frames:[
    {hip:P(88,120), t:-90, foot:P(126,G-1), ks:1, hand:P(44,72), es:-1},
    {hip:P(88,120), t:-90, foot:P(126,G-1), ks:1, hand:P(46,104), es:-1}]},
  remada_halter: {dur:1300, back: () => PROP.bench(100, 170, 128), props: s => PROP.db(s), frames:[
    {hip:P(66,96), t:80, foot:P(60,G-1), hand:P(118,136), hand2:P(140,127), es:1, es2:1},
    {hip:P(66,96), t:80, foot:P(60,G-1), hand:P(90,104), hand2:P(140,127), es:1, es2:1}]},
  desenvolvimento: {dur:1300, back: () => PROP.bench(60, 118, 112), props: s => PROP.db(s), frames:[
    {hip:P(90,108), t:0, foot:P(130,G-1), ks:-1, handRel:P(6,-4), es:1},
    {hip:P(90,108), t:0, foot:P(130,G-1), ks:-1, handRel:P(4,-49), es:1}]},
  puxada: {dur:1300, back: () => PROP.bench(60, 118, 112) + PROP.rect(112, 88, 22, 8), props: s => PROP.cable(s, [104,-28]) + `<line x1="${s.a1.hd[0]-14}" y1="${s.a1.hd[1]}" x2="${s.a1.hd[0]+14}" y2="${s.a1.hd[1]}" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>`, frames:[
    {hip:P(90,108), t:-6, foot:P(130,G-1), handRel:P(10,-48), es:1},
    {hip:P(90,108), t:-14, foot:P(130,G-1), handRel:P(14,-2), es:1}]},
  pallof: {dur:1600, props: s => PROP.cable(s, [14,56]), frames:[
    {hip:P(110,80), t:0, foot:P(106,G-1), foot2:P(122,G-1), handRel:P(14,20), es:1},
    {hip:P(110,80), t:0, foot:P(106,G-1), foot2:P(122,G-1), handRel:P(48,18), es:1}]},
  panturrilha: {dur:1100, back: () => PROP.rect(96, 150, 34, 10) + PROP.rect(140, -10, 8, 170), frames:[
    {hip:P(100,62), t:0, foot:P(100,142), toe:P(116,150), hand:P(140,60), es:1},
    {hip:P(101,50), t:0, foot:P(102,130), toe:P(116,150), hand:P(140,54), es:1}]},
  panturrilha_uni: {dur:1100, back: () => PROP.rect(96, 150, 34, 10), props: s => PROP.db(s), frames:[
    {hip:P(100,62), t:0, foot:P(100,142), toe:P(116,150), handRel:P(-2,50), foot2Rel:P(-26,58), toe2:P(64,128), ks2:-1},
    {hip:P(101,50), t:0, foot:P(102,130), toe:P(116,150), handRel:P(-2,50), foot2Rel:P(-26,58), toe2:P(64,116), ks2:-1}]},
  boxjump: {dur:900, restart:true, back: () => PROP.rect(118, 124, 60, 36), frames:[
    {hip:P(46,112), t:38, foot:P(58,G-1), handRel:P(-26,34)},
    {hip:P(96,52), t:8, foot:P(98,96), handRel:P(18,-42)},
    {hip:P(140,98), t:34, foot:P(150,123), handRel:P(30,26)},
    {hip:P(146,44), t:2, foot:P(148,123), handRel:P(2,50)}]},
  broadjump: {dur:900, restart:true, frames:[
    {hip:P(30,112), t:40, foot:P(42,G-1), handRel:P(-26,34)},
    {hip:P(96,66), t:28, foot:P(84,122), handRel:P(26,-30)},
    {hip:P(160,114), t:40, foot:P(176,G-1), handRel:P(34,22)},
    {hip:P(166,82), t:4, foot:P(172,G-1), handRel:P(2,50)}]},
  terra_romeno: {dur:1500, props: s => PROP.plate(s), frames:[
    {hip:P(100,80), t:0, foot:P(100,G-1), handRel:P(4,48)},
    {hip:P(78,88), t:78, foot:P(100,G-1), handRel:P(0,48)}]},
  barra_fixa: {dur:1400, back: () => `<line x1="40" y1="-12" x2="170" y2="-12" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/>`, frames:[
    {hip:P(98,90), t:2, hand:P(106,-12), footRel:P(-14,70), ks:1, es:1},
    {hip:P(100,58), t:4, hand:P(106,-12), footRel:P(-14,70), ks:1, es:1}]},
  supino_inclinado: {dur:1300, back: () => `<line x1="100" y1="132" x2="24" y2="80" stroke="var(--line)" stroke-width="8" stroke-linecap="round"/><rect x="92" y="132" width="6" height="28" fill="var(--line)"/>`, props: s => PROP.db(s), frames:[
    {hip:P(88,122), t:-58, foot:P(132,G-1), ks:1, hand:P(58,90), es:-1},
    {hip:P(88,122), t:-58, foot:P(132,G-1), ks:1, hand:P(66,46), es:-1}]},
  bulgaro: {dur:1400, back: () => PROP.bench(14, 58, 120), props: s => PROP.db(s), frames:[
    {hip:P(96,76), t:6, foot:P(122,G-1), foot2:P(44,114), toe2:P(30,119), ks2:1, handRel:P(0,50)},
    {hip:P(88,112), t:14, foot:P(122,G-1), foot2:P(44,114), toe2:P(30,119), ks2:1, handRel:P(0,50)}]},
  remada_baixa: {dur:1400, back: () => PROP.rect(40, 130, 60, 10) + PROP.rect(160, 110, 10, 50), props: s => PROP.cable(s, [196,118]), frames:[
    {hip:P(70,126), t:30, foot:P(158,132), toe:P(160,118), ks:1, handRel:P(46,20), es:1},
    {hip:P(70,126), t:-8, foot:P(158,132), toe:P(160,118), ks:1, handRel:P(22,38), es:1}]},
  roda: {dur:1800, props: s => PROP.wheel(s), frames:[
    {hip:P(66,112), t:48, foot:P(22,G-3), toe:P(12,G-1), ks:1, hand:P(104,152), es:1},
    {hip:P(84,130), t:78, foot:P(34,G-3), toe:P(24,G-1), ks:1, hand:P(164,152), es:1}]}
};

export function animSvg(id, k){
  const a = ANIM[id]; if (!a) return '';
  const f = a.frames, segs = f.length - 1;
  const x = Math.min(Math.max(k, 0), 0.9999) * segs, i = Math.floor(x), e = x - i;
  const ease = e < .5 ? 2*e*e : 1 - Math.pow(-2*e + 2, 2)/2;
  const s = skeleton(mix(f[i], f[i+1], ease));
  return `<line x1="0" y1="${G}" x2="220" y2="${G}" stroke="var(--line)" stroke-width="3"/>` + (a.back ? a.back() : '') + drawFigure(s) + (a.props ? a.props(s) : '');
}



/** Anima o movimento dentro de um <svg> (ida e volta). Devolve função para parar. */
export function playAnim(svg, id) {
  const a = ANIM[id];
  if (!a || !svg) return () => {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { svg.innerHTML = animSvg(id, 1); return () => {}; }
  const t0 = performance.now(), dur = a.dur, hold = 350;
  const cycle = a.restart ? dur + hold * 2 : (dur + hold) * 2;
  let raf = 0;
  const frame = now => {
    const t = Math.max(0, now - t0) % cycle; // o 1º quadro pode vir com horário anterior a t0
    let k;
    if (a.restart) k = t < hold ? 0 : t < hold + dur ? (t - hold) / dur : 1;
    else if (t < dur) k = t / dur; else if (t < dur + hold) k = 1; else if (t < dur * 2 + hold) k = 1 - (t - dur - hold) / dur; else k = 0;
    svg.innerHTML = animSvg(id, k);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export const animThumb = id => (ANIM[id] ? `<svg viewBox="5 -30 210 192" aria-hidden="true">${animSvg(id, 0.55)}</svg>` : '');
export const ANIM_VIEWBOX = '0 -40 220 205';
