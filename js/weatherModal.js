// The weather window: current conditions, the day's sun arc, the rest of the day hour by hour, and details.
import { settings as S, on } from './store.js';
import { t, getLang } from './i18n.js';
import { currentWeather, refreshWeather, weatherError, iconFor, descKey, hhmm } from './weather.js';
import { sunArc, sunLeft, localNow, duration, asMs } from './sunArc.js';
import { $, h, svg, ICONS } from './util.js';
import { openSettings } from './settings.js';

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
const compass = deg => t('compass').split(',')[r(((deg % 360) + 360) % 360 / 45) % 8];
const uvLevel = uv => t(['uvLow', 'uvMod', 'uvHigh', 'uvVHigh', 'uvExt'][uv < 3 ? 0 : uv < 6 ? 1 : uv < 8 ? 2 : uv < 11 ? 3 : 4]);
const metric = () => S.units !== 'f';

function render() {
  const w = currentWeather();
  const body = $('#wxBody');
  const close = () => h('button', { type: 'button', class: 'ibtn round', title: t('close'), 'aria-label': t('close'), html: svg(ICONS.x), onclick: () => dlg.close() });
  const settingsBtn = () => h('button', { type: 'button', class: 'btn ghost', onclick: () => { dlg.close(); openSettings('#sLocSearch'); } }, t('weatherSettings'));
  if (!w || !w.hourly) {
    // Still loading, or the last attempt failed: the window stays closable and can try again.
    body.replaceChildren(
      h('header', { class: 'wx-head' }, h('div', { class: 'wx-place' }, h('span', { html: svg(ICONS.pin) }), S.location?.name || t('weather')), close()),
      h('div', { class: 'wx-loading', role: 'status' }, weatherError ? t('wxError') : t('loadingWx'),
        weatherError ? h('button', { type: 'button', class: 'btn', onclick: () => { refreshWeather(true).catch(() => {}); } }, t('retry')) : null),
      h('footer', { class: 'wx-foot' }, h('span'), settingsBtn()));
    return;
  }
  const loc = S.location;
  const { ms: nowMs, h: nowH, day: today } = localNow(w);

  // Header: place, big temperature, condition.
  const head = h('header', { class: 'wx-head' },
    h('div', { class: 'wx-place' }, h('span', { html: svg(ICONS.pin) }), loc.name), close());
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
    sun = h('section', { class: 'wx-sun-block' },
      h('div', { class: 'wx-arc-wrap', html: sunArc(w, nowH) }),
      h('div', { class: 'wx-sun-row' },
        h('span', {}, h('small', {}, t('sunriseWord')), hhmm(w.sr)),
        h('span', { class: 'wx-sun-mid' }, h('b', {}, sunLeft(w, nowH)), w.daylight ? t('daylight', { t: duration(w.daylight / 3600) }) : ''),
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
    settingsBtn());

  // The summary and the sun side by side, then the hours, the details and the source.
  const top = h('div', { class: 'wx-top' }, hero, sun);
  body.replaceChildren(head, top, hourly, details, foot);
  // Start the hour strip at "now" even when the window is reopened after scrolling.
  strip.scrollLeft = 0;
}
