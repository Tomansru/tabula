// The weather window: current conditions, the day's sun arc, the rest of the day hour by hour, and details.
import { settings as S, on } from './store.js?v=2';
import { t, getLang } from './i18n.js?v=2';
import { currentWeather, refreshWeather, weatherError, iconFor, descKey, hhmm } from './weather.js?v=2';
import { $, h, svg, ICONS } from './util.js?v=2';
import { openSettings } from './settings.js?v=2';

let dlg;

export function initWeatherModal() {
  dlg = $('#wxDialog');
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  on('weather', () => { if (dlg.open) render(); });
}

export function openWeather() {
  render();
  dlg.showModal();
  refreshWeather().catch(() => {});
}

const r = Math.round;
const duration = hours => {
  const m = r(hours * 60);
  return t('dur', { h: Math.floor(m / 60), m: m % 60 });
};
const compass = deg => t('compass').split(',')[r(((deg % 360) + 360) % 360 / 45) % 8];
const uvLevel = uv => t(['uvLow', 'uvMod', 'uvHigh', 'uvVHigh', 'uvExt'][uv < 3 ? 0 : uv < 6 ? 1 : uv < 8 ? 2 : uv < 11 ? 3 : 4]);
const metric = () => S.units !== 'f';

// Times from the forecast are the location's local time; treat them as UTC to do plain arithmetic.
const asMs = local => Date.parse(local + 'Z');

function sunArc(w, nowH) {
  const f = (nowH - w.sr) / (w.ss - w.sr);
  const day = f >= 0 && f <= 1;
  const k = Math.min(1, Math.max(0, f));
  // A gentle dome: a segment of a large circle (half-width 138, height 54), not a half-ellipse,
  // so the path meets the horizon at a soft angle instead of standing up vertically.
  const cx = 160, cy = 74, half = 138, rise = 54;
  const R = (half * half + rise * rise) / (2 * rise), oy = cy - rise + R;
  const span = Math.asin(half / R), a = -span + 2 * span * k;
  const px = cx + R * Math.sin(a), py = oy - R * Math.cos(a);
  return `<svg class="wx-arc" viewBox="0 0 320 84" aria-hidden="true">
    <defs><linearGradient id="wxArc" x1="0" x2="1"><stop offset="0" stop-color="#ff9a5c"/><stop offset=".5" stop-color="#ffcf6b"/><stop offset="1" stop-color="#ff9a5c"/></linearGradient></defs>
    <line x1="6" y1="${cy}" x2="314" y2="${cy}" class="wx-horizon"/>
    <path d="M${cx - half} ${cy} A${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${cx + half} ${cy}" class="wx-path"/>
    ${k > 0 ? `<path d="M${cx - half} ${cy} A${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}" class="wx-path-done"/>` : ''}
    ${day ? `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="12" class="wx-sun-glow"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6.5" class="wx-sun"/>` : ''}
  </svg>`;
}

function render() {
  const w = currentWeather();
  const body = $('#wxBody');
  if (!w || !w.hourly) {
    const errors = {
      ru: ['Не удалось обновить погоду', 'Повторить'], en: ['Weather could not be updated', 'Try again'],
      de: ['Wetter konnte nicht geladen werden', 'Erneut versuchen'], es: ['No se pudo actualizar el tiempo', 'Reintentar'],
      fr: ['La météo n’a pas pu être actualisée', 'Réessayer'],
    };
    const copy = errors[getLang()] || errors.en;
    body.replaceChildren(
      h('header', { class: 'wx-head' }, h('span', {}, S.location?.name || t('weather')),
        h('button', { type: 'button', class: 'ibtn', 'aria-label': t('close'), html: svg(ICONS.x), onclick: () => dlg.close() })),
      h('div', { class: 'wx-loading', role: 'status' }, weatherError ? copy[0] : t('loadingWx'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => {
          refreshWeather(true).catch(() => {}); render();
        } }, copy[1])),
      h('footer', { class: 'wx-foot' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => { dlg.close(); openSettings('#sLocSearch'); } }, t('weatherSettings'))));
    return;
  }
  const loc = S.location;
  const nowMs = asMs(w.now) + (Date.now() - w.ts);
  const nowH = (nowMs % 864e5) / 36e5;
  const today = new Date(nowMs).toISOString().slice(0, 10);

  // Header: place, big temperature, condition.
  const head = h('header', { class: 'wx-head' },
    h('div', { class: 'wx-place' }, h('span', { html: svg(ICONS.pin) }), loc.name),
    h('button', { type: 'button', class: 'ibtn', title: t('close'), 'aria-label': t('close'), html: svg(ICONS.x), onclick: () => dlg.close() }));
  const hero = h('div', { class: 'wx-hero' },
    h('span', { class: 'wx-hero-icon', html: iconFor(w.code, w.isDay) }),
    h('span', { class: 'wx-hero-temp' }, `${r(w.temp)}°`),
    h('div', { class: 'wx-hero-meta' },
      h('b', {}, t(descKey(w.code))),
      h('span', {}, t('feelsLike', { t: r(w.feels) + '°' })),
      h('span', {}, `↑${r(w.max)}°  ↓${r(w.min)}°`)));

  // Sun: today's arc with the sun where it is now.
  let sun = null;
  if (w.sr != null && w.ss != null && w.ss > w.sr) {
    const isDay = nowH >= w.sr && nowH <= w.ss;
    const left = isDay ? t('untilSunset', { t: duration(w.ss - nowH) })
      : t('untilSunrise', { t: duration(nowH < w.sr ? w.sr - nowH : 24 - nowH + w.sr) });
    sun = h('section', { class: 'wx-sun-block' },
      h('div', { class: 'wx-arc-wrap', html: sunArc(w, nowH) }),
      h('div', { class: 'wx-sun-row' },
        h('span', {}, h('small', {}, t('sunriseWord')), hhmm(w.sr)),
        h('span', { class: 'wx-sun-mid' }, h('b', {}, left), w.daylight ? t('daylight', { t: duration(w.daylight / 3600) }) : ''),
        h('span', { class: 'end' }, h('small', {}, t('sunsetWord')), hhmm(w.ss))));
  }

  // Hours: from now to the end of the day, at least eight of them (running into tomorrow late in the evening).
  const startMs = Math.floor(nowMs / 36e5) * 36e5;
  const ahead = w.hourly.filter(([time]) => asMs(time) >= startMs);
  const restOfDay = ahead.filter(([time]) => time.startsWith(today)).length;
  const hours = ahead.slice(0, Math.max(restOfDay, 8));
  const strip = h('div', { class: 'wx-hours', role: 'list' });
  hours.forEach(([time, temp, code, isDay, pop], i) => {
    if (i > 0 && !time.startsWith(today) && hours[i - 1][0].startsWith(today)) {
      strip.append(h('div', { class: 'wx-day-sep', role: 'presentation' }, t('tomorrow')));
    }
    strip.append(h('div', { class: 'wx-hour' + (i === 0 ? ' now' : ''), role: 'listitem' },
      h('span', { class: 'wx-h-time' }, i === 0 ? t('now') : time.slice(11, 16)),
      h('span', { class: 'wx-h-icon', html: iconFor(code, isDay) }),
      h('span', { class: 'wx-h-temp' }, `${r(temp)}°`),
      h('span', { class: 'wx-h-pop' + (pop >= 30 ? ' wet' : '') }, pop > 0 ? `${pop}%` : '')));
  });
  const hourly = h('section', { class: 'wx-block' }, h('h3', {}, t('hourly')), strip);

  // Details.
  const tile = (label, value, sub, extra) => h('div', { class: 'wx-tile' },
    h('span', { class: 'wx-t-label' }, label), h('span', { class: 'wx-t-value' }, value, extra || null), sub ? h('span', { class: 'wx-t-sub' }, sub) : null);
  const windUnit = metric() ? t('unitMs') : 'mph';
  const arrow = h('span', { class: 'wx-wind-arrow', html: svg('<path d="M12 4v16M6 14l6 6 6-6"/>', 2) });
  arrow.style.rotate = `${w.windDir}deg`; // points where the wind blows to
  const pressure = getLang() === 'ru' ? `${r(w.pressure * 0.750062)} ${t('unitMmHg')}` : `${r(w.pressure)} hPa`;
  const precip = metric() ? `${(w.precipSum ?? 0).toFixed(1)} ${t('unitMm')}` : `${(w.precipSum ?? 0).toFixed(2)} in`;
  const details = h('section', { class: 'wx-tiles' },
    tile(t('humidity'), `${r(w.humidity)}%`),
    tile(t('wind'), `${r(w.wind)} ${windUnit}`, `${compass(w.windDir)} · ${t('gusts', { v: `${r(w.gusts)} ${windUnit}` })}`, arrow),
    tile(t('pressure'), pressure),
    tile(t('uv'), w.uvMax != null ? String(r(w.uvMax)) : '—', w.uvMax != null ? uvLevel(w.uvMax) : ''),
    tile(t('precipToday'), precip),
    tile(t('cloudCover'), `${r(w.cloud)}%`));

  const updated = new Intl.DateTimeFormat(getLang(), { hour: '2-digit', minute: '2-digit' }).format(w.ts);
  const foot = h('footer', { class: 'wx-foot' },
    h('span', {}, `Open-Meteo · ${t('updated', { t: updated })}`),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { dlg.close(); openSettings('#sLocSearch'); } }, t('weatherSettings')));

  body.replaceChildren(head, hero, ...(sun ? [sun] : []), hourly, details, foot);
  // Start the hour strip at "now" even when the window is reopened after scrolling.
  strip.scrollLeft = 0;
}
