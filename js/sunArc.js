// The day's sun path in the weather window (helpers shared with the weather widget):
// a gentle dome (a segment of a large circle), the part already travelled lit warm, the sun where it is now.
import { t } from './i18n.js';

// Forecast times are the location's local time; treat them as UTC to do plain arithmetic.
export const asMs = local => Date.parse(local + 'Z');

// "Now" at the weather location: milliseconds, hour of day and the date string.
export function localNow(w) {
  const ms = asMs(w.now) + (Date.now() - w.ts);
  return { ms, h: (ms % 864e5) / 36e5, day: new Date(ms).toISOString().slice(0, 10) };
}

const r = Math.round;
export const duration = hours => {
  const m = r(hours * 60);
  return t('dur', { h: Math.floor(m / 60), m: m % 60 });
};

// "Sunset in …" by day, "Sunrise in …" by night.
export function sunLeft(w, h) {
  const day = h >= w.sr && h <= w.ss;
  return day ? t('untilSunset', { t: duration(w.ss - h) })
    : t('untilSunrise', { t: duration(h < w.sr ? w.sr - h : 24 - h + w.sr) });
}

let uid = 0;
export function sunArc(w, h) {
  const f = (h - w.sr) / (w.ss - w.sr);
  const day = f >= 0 && f <= 1;
  const k = Math.min(1, Math.max(0, f));
  const cx = 160, cy = 74, half = 138, rise = 54;
  const R = (half * half + rise * rise) / (2 * rise), oy = cy - rise + R;
  const span = Math.asin(half / R), a = -span + 2 * span * k;
  const px = (cx + R * Math.sin(a)).toFixed(1), py = (oy - R * Math.cos(a)).toFixed(1), rr = R.toFixed(1);
  // Each svg needs its own gradient ids: a url(#id) pointing into a closed dialog does not paint.
  const id = 'arc' + ++uid;
  const done = `M${cx - half} ${cy} A${rr} ${rr} 0 0 1 ${px} ${py}`;
  // Everything is clipped at the horizon (round caps, the glow), so the line cuts the arc off cleanly.
  return `<svg class="sun-arc" viewBox="0 0 320 84" aria-hidden="true">
    <defs>
      <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#ff9a5c"/><stop offset=".5" stop-color="#ffcf6b"/><stop offset="1" stop-color="#ff9a5c"/></linearGradient>
      <linearGradient id="${id}f" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffc65c" stop-opacity=".22"/><stop offset="1" stop-color="#ffc65c" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}c"><rect x="0" y="-20" width="320" height="${cy + 20}"/></clipPath>
    </defs>
    <g clip-path="url(#${id}c)">
      ${k > 0 ? `<path d="${done} L${px} ${cy} Z" fill="url(#${id}f)"/>` : ''}
      <path d="M${cx - half} ${cy} A${rr} ${rr} 0 0 1 ${cx + half} ${cy}" class="arc-path"/>
      ${k > 0 ? `<path d="${done}" class="arc-done" stroke="url(#${id}s)"/>` : ''}
      ${day ? `<circle cx="${px}" cy="${py}" r="12" class="arc-glow"/><circle cx="${px}" cy="${py}" r="6.5" class="arc-sun"/>` : ''}
    </g>
    <line x1="4" y1="${cy}" x2="316" y2="${cy}" class="arc-horizon"/>
  </svg>`;
}
