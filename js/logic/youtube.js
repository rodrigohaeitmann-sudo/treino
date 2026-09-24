// Links do YouTube: extrai o id do vídeo e o tempo de início; monta URLs de miniatura/busca.

const ID = /^[A-Za-z0-9_-]{11}$/;

/** "90", "90s", "1m30s", "1h2m3s", "1:30" → segundos (ou null) */
export function parseTime(t) {
  if (t == null || t === '') return null;
  t = String(t).trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d+(:\d{1,2}){1,2}$/.test(t)) return t.split(':').reduce((a, x) => a * 60 + Number(x), 0);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

/**
 * Aceita: id puro, youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID,
 * m.youtube.com, youtube-nocookie.com, com ?t= / &start= opcionais.
 * @returns {{id:string, start:number|null}|null}
 */
export function parseYouTube(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (ID.test(raw)) return { id: raw, start: null };
  let url;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  if (!id || !ID.test(id)) return null;
  const start = parseTime(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return { id, start };
}

export const thumbUrl = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const watchUrl = (id, start) => `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`;
export const searchUrl = q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/** URL de incorporação sem cookies, em loop no trecho escolhido. */
export function embedUrl({ id, start = null, end = null }, { autoplay = true, mute = true } = {}) {
  const p = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1', enablejsapi: '1' });
  if (autoplay) p.set('autoplay', '1');
  if (mute) p.set('mute', '1');
  if (start) p.set('start', String(start));
  if (end) p.set('end', String(end));
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
}
