// Weather via Open-Meteo (no key, no cookies). Results are cached for TTL so new tabs render instantly.
import { settings, load, save, emit } from './store.js';
import { t, getLang } from './i18n.js';
import { svg, esc, ICONS } from './util.js';
import { sunLeft, localNow, duration } from './sunArc.js';

const TTL = 20 * 60e3;
let cache = load('weather', null);
let inflight = null;
// The last update failed: the weather window offers to try again instead of loading forever.
export let weatherError = false;

const matchesLocation = w => !!(w && settings.location && w.lat === settings.location.lat && w.lon === settings.location.lon);
export const currentWeather = () => (matchesLocation(cache) && cache.units === settings.units ? cache : null);

export function descKey(c) {
  if (c <= 3) return 'wx' + c;
  if (c === 45 || c === 48) return 'wx45';
  if (c <= 55) return 'wx51';
  if (c <= 57) return 'wx56';
  if (c <= 63) return 'wx61';
  if (c === 65) return 'wx65';
  if (c <= 67) return 'wx66';
  if (c <= 75) return 'wx71';
  if (c === 77) return 'wx77';
  if (c <= 82) return 'wx80';
  if (c <= 86) return 'wx85';
  if (c === 95) return 'wx95';
  return 'wx96';
}

const CLOUD = '<path d="M7.2 18.5h9.9a4.1 4.1 0 0 0 .5-8.2 5.6 5.6 0 0 0-10.7 1.6 3.3 3.3 0 0 0 .3 6.6z"/>';
const CLOUD_UP = `<g transform="translate(0 -3)">${CLOUD}</g>`;
const SUN = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
const MOON = '<path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z"/>';
const SMALL_SUN = '<path d="M16.5 2.5v1.3M21.2 4.3l-.9.9M22.8 8.8h-1.3M11.8 4.3l.9.9"/><path d="M13.2 8.6a3.4 3.4 0 0 1 6.3 2.4"/>';
const SMALL_MOON = '<path d="M21.5 9.8a4.2 4.2 0 0 1-5.4-5.4 4.4 4.4 0 0 0-2.9 4.6"/>';
const PARTLY = (night) => (night ? SMALL_MOON : SMALL_SUN) + `<g transform="translate(-1.6 1)">${CLOUD}</g>`;

export function iconFor(code, isDay) {
  let body;
  if (code <= 1) body = isDay ? SUN : MOON;
  else if (code === 2) body = PARTLY(!isDay);
  else if (code === 3) body = CLOUD;
  else if (code === 45 || code === 48) body = '<path d="M4 8h16M2.5 12h19M4 16h16M7 20h10"/>';
  else if (code <= 57) body = CLOUD_UP + '<path d="M8.5 19v1M12.5 20v1M16.5 19v1"/>';
  else if (code <= 67 || (code >= 80 && code <= 82)) body = CLOUD_UP + '<path d="M8.6 18.3l-1 2.7M12.6 18.3l-1 2.7M16.6 18.3l-1 2.7"/>';
  else if (code <= 86) body = CLOUD_UP + '<path stroke-width="2.4" d="M8 19h.01M12 18.5h.01M16 19h.01M10 21.6h.01M14 21.6h.01"/>';
  else body = CLOUD_UP + '<path d="M12.8 15.2l-2.3 3.4h3l-2.3 3.4"/>';
  return svg(body, 1.6);
}

// "2026-10-24T07:47" (already in the location's local time) → 7.78
const isoHour = s => (typeof s === 'string' && s.length >= 16 ? +s.slice(11, 13) + +s.slice(14, 16) / 60 : null);

// Used when there is no location or the forecast didn't come: a plausible mid-latitude day.
export const DEFAULT_SUN = { sr: 6.5, ss: 18.5 };

// Today's sunrise/sunset in local hours for the sky effects, with the source it came from.
// Polar day/night (no sunrise or sunset) also falls back to the default.
export function sunSchedule() {
  const w = currentWeather();
  if (w && w.sr != null && w.ss != null && w.ss > w.sr) return { sr: w.sr, ss: w.ss, source: 'weather' };
  return { ...DEFAULT_SUN, source: 'default' };
}

export const hhmm = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

export async function refreshWeather(force = false) {
  const loc = settings.location;
  if (!loc || !settings.showWeather) return null;
  // Caches from before the detailed forecast was stored count as stale.
  const fresh = currentWeather() && Date.now() - cache.ts < TTL && 'hourly' in cache;
  if (fresh && !force) return cache;
  if (inflight) return inflight;
  const p = new URLSearchParams({
    latitude: loc.lat,
    longitude: loc.lon,
    current: 'temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover',
    hourly: 'temperature_2m,weather_code,is_day,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,daylight_duration',
    timezone: 'auto',
    forecast_days: 2,
    wind_speed_unit: 'ms',
  });
  if (settings.units === 'f') {
    p.set('temperature_unit', 'fahrenheit');
    p.set('wind_speed_unit', 'mph');
    p.set('precipitation_unit', 'inch');
  }
  const units = settings.units;
  inflight = (async () => {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?' + p, { credentials: 'omit', signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('weather ' + r.status);
    const j = await r.json();
    const c = j.current;
    cache = {
      ts: Date.now(), lat: loc.lat, lon: loc.lon, units,
      temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, isDay: !!c.is_day,
      max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0],
      sr: isoHour(j.daily.sunrise?.[0]), ss: isoHour(j.daily.sunset?.[0]),
      // Details for the weather window. `now` is the location's local time of this reading.
      now: c.time, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, windDir: c.wind_direction_10m,
      gusts: c.wind_gusts_10m, pressure: c.pressure_msl, cloud: c.cloud_cover,
      uvMax: j.daily.uv_index_max?.[0], precipSum: j.daily.precipitation_sum?.[0], daylight: j.daily.daylight_duration?.[0],
      // [local time, temperature, weather code, is day, precipitation probability] for today and tomorrow
      hourly: (j.hourly?.time || []).map((time, i) => [
        time, j.hourly.temperature_2m[i], j.hourly.weather_code[i], !!j.hourly.is_day[i], j.hourly.precipitation_probability[i],
      ]),
    };
    weatherError = false;
    save('weather', cache);
    emit('weather', cache);
    return cache;
  })().catch(e => {
    weatherError = true;
    emit('weather', null);
    throw e;
  }).finally(() => { inflight = null; });
  return inflight;
}

export async function searchCity(q) {
  const p = new URLSearchParams({ name: q, count: 6, language: getLang(), format: 'json' });
  const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + p, { credentials: 'omit' });
  const j = await r.json();
  return j.results || [];
}

// Only used for "Use my location": turns rounded coordinates into a city name.
export async function reverseGeocode(lat, lon) {
  const p = new URLSearchParams({ format: 'jsonv2', lat, lon, zoom: 10, 'accept-language': getLang() });
  const r = await fetch('https://nominatim.openstreetmap.org/reverse?' + p, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  const a = j.address || {};
  return a.city || a.town || a.village || a.municipality || a.county || j.name || null;
}

// The widget in the left column. Its head is a title like the tasks' "Today"; the day's high/low sits with the place,
// so a long title in any language ("Al otro lado de tu ventana") can take two lines without pushing anything out.
export function renderWeather(btn) {
  btn.hidden = !settings.showWeather;
  if (btn.hidden) return;
  const loc = settings.location;
  const w = currentWeather();
  const r = Math.round;
  btn.removeAttribute('title');
  const head = `<span class="wx-head-row"><span class="wx-title">${esc(t('outside'))}</span></span>`;
  if (!loc || !w) {
    btn.innerHTML = head + `<span class="wx-set">${svg(ICONS.pin)}${esc(loc ? t('loadingWx') : t('setLocation'))}</span>`;
    return;
  }
  const now = `<span class="wx-now"><span class="wx-icon">${iconFor(w.code, w.isDay)}</span>`
    + `<span class="wx-temp">${r(w.temp)}°</span>`
    + `<span class="wx-meta"><span class="wx-desc">${esc(t(descKey(w.code)))}</span>`
    + `<span class="wx-sub">${esc(loc.name)} · ↑${r(w.max)}° ↓${r(w.min)}°</span></span></span>`;
  // Sunrise and sunset as one quiet line; the full sun path lives in the weather window.
  const sun = w.sr != null && w.ss != null
    ? `<span class="wx-sun"><span>${esc(t('sunrise', { t: hhmm(w.sr) }))}</span><span>${esc(t('sunset', { t: hhmm(w.ss) }))}</span></span>` : '';
  btn.innerHTML = head + now + sun;
  btn.title = [
    t('feelsLike', { t: r(w.feels) + '°' }),
    w.now && w.sr != null && w.ss != null && sunLeft(w, localNow(w).h),
    w.daylight && t('daylight', { t: duration(w.daylight / 3600) }),
  ].filter(Boolean).join(' · ');
}
