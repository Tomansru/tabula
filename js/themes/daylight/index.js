// Theme "Breathing sky" (from the daylight study in the lab branch): an atmosphere painted from the real solar altitude
// for your location and season, a soft sun disc, and a star sphere with real catalogue stars at night.
// It owns the background completely, so it also decides light/dark: dark text by day, light text at dusk and night.
import { settings as S } from '../../store.js';
import { t, getLang } from '../../i18n.js';
import { h } from '../../util.js';
import { PLACES, solar } from './astronomy.js';
import { currentWeather, refreshWeather } from '../../weather.js';
import { Sky } from './sky.js';
import { CONDITIONS, conditionById, targetDials, readForecast } from './weather/conditions.js';
import { SkyWeather } from './weather/index.js';

const PLACE_EN = { 'Белград': 'Belgrade', 'Рейкьявик': 'Reykjavík', 'Тромсё': 'Tromsø', 'Нью-Йорк': 'New York', 'Сингапур': 'Singapore', 'Кейптаун': 'Cape Town', 'Сидней': 'Sydney' };
const placeName = p => (getLang() === 'ru' ? p.name : PLACE_EN[p.name] || p.name);

// The sun follows the weather location; without one, a mid-latitude guess at the browser's time-zone longitude.
function sunPlace() {
  const loc = S.location;
  if (loc) return { name: loc.name, lat: loc.lat, lon: loc.lon };
  return { name: '', lat: 48, lon: -new Date().getTimezoneOffset() / 4 };
}

const LOOK = { sunStyle: 'atmospheric', sharpness: 0.8, haze: 0.5, tint: 0, warmth: 1, horizon: 0.68, starlight: 1, bearing: 'pole', starPlace: 'same' };
// weather: 'off', 'live' (the forecast for your location), or the id of one condition that stays.
const DEFAULTS = { ...LOOK, weather: 'off', weatherStrength: 1 };
// "Back to soft light" restores the original demo's gentler look; it is about the light, so the weather stays as it is.
const SOFT = { ...LOOK, sunStyle: 'soft', sharpness: 0.45, warmth: 0.85, starlight: 0.8 };

function stateOf(cfg) {
  return {
    sunStyle: cfg.sunStyle, sharpness: cfg.sharpness, haze: cfg.haze, tint: cfg.tint, warmth: cfg.warmth, horizon: cfg.horizon,
    starlight: cfg.starlight, bearing: cfg.bearing,
    place: sunPlace(),
    starPlace: cfg.starPlace === 'same' ? null : PLACES[+cfg.starPlace] || null,
  };
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
let sky = null, cfgNow = DEFAULTS, timer = 0, visualTime = 0, last = 0;
let weather = null, grain = null, skyCanvas = null, weatherLayers = [], rafId = 0, softId = 0;

const sunIsLow = () => solar(Date.now(), sunPlace()).altitude <= 5;

// Real time needs one frame per second (the atmosphere itself repaints only when its inputs change).
function frame() {
  clearTimeout(timer);
  if (!sky || document.hidden) return;
  timer = setTimeout(frame, 1000);
  const now = performance.now();
  if (!reducedMotion.matches) visualTime += Math.min(1, (now - last) / 1000);
  last = now;
  const state = stateOf(cfgNow), sun = sky.draw(Date.now(), state, visualTime);
  if (weather) {
    weather.observe(sun, state);
    weather.step(now);
    armPump();
  }
}

/* ---------- weather: everything here runs only while the setting is on ---------- */

// What the settings ask for right now, as dials. Until a forecast is known the sky stays as it is.
function weatherGoal(cfg) {
  const strength = cfg.weatherStrength;
  if (cfg.weather !== 'live') return targetDials(conditionById(cfg.weather), { strength });
  const w = currentWeather();
  if (!w) return targetDials(conditionById('clear'), { strength });
  const toMs = S.units === 'f' ? 0.44704 : 1;
  const { condition, force, wind } = readForecast(w.code, w.wind * toMs, w.gusts * toMs);
  return targetDials(condition, { strength, force, wind });
}

function startWeather() {
  const clouds = h('canvas', { id: 'weatherSky', 'aria-hidden': 'true' }), falling = h('canvas', { id: 'falling', 'aria-hidden': 'true' });
  grain.before(clouds, falling);
  weatherLayers = [clouds, falling];
  weather = new SkyWeather(clouds, falling, skyCanvas);
}

function stopWeather() {
  cancelAnimationFrame(rafId); clearTimeout(softId);
  rafId = softId = 0;
  weather?.destroy();
  weather = null;
  weatherLayers.forEach(c => c.remove());
  weatherLayers = [];
}

function syncWeather(cfg, instant) {
  if (cfg.weather === 'off') {
    if (weather) { stopWeather(); root.dataset.theme = sunIsLow() ? 'dark' : 'light'; }
    return;
  }
  if (!weather) startWeather();
  weather.setGoal(weatherGoal(cfg), instant);
}

// The sky wants the forecast even when the weather widget is hidden.
const pullForecast = () => refreshWeather(false, true).catch(e => console.debug('[tabula] weather', e));

// Between the theme's frames: every display frame while something falls, a slower beat for clouds alone, nothing on a still sky.
function pump(now) {
  rafId = softId = 0;
  if (!weather || document.hidden) return;
  weather.step(now ?? performance.now());
  armPump();
}
function armPump() {
  if (rafId || softId || !weather || document.hidden) return;
  const pace = weather.pace;
  if (pace === 'full') rafId = requestAnimationFrame(pump);
  else if (pace === 'soft') softId = setTimeout(pump, 48);
}

const onResize = () => { sky?.resize(); weather?.resize(); frame(); };
const onVisible = () => {
  if (document.hidden) return;
  last = performance.now();
  // With many tabs open Chrome takes the GPU from the oldest ones: start again with a fresh one.
  if (weather?.lost) { stopWeather(); syncWeather(cfgNow, true); }
  weather?.wake();
  frame();
};

export default {
  id: 'daylight',
  name: 'themeDaylight',
  defaults: DEFAULTS,

  // Light text over the dark sky, dark text over the pale day: the same threshold as the demo.
  ownsMode: true,
  // Under weather the clouds have a say in that too.
  isDark() {
    return weather?.inkDark ?? sunIsLow();
  },
  wantsWeather() {
    return cfgNow.weather === 'live';
  },

  preview(el, cfg) {
    el.replaceChildren();
    const w = el.clientWidth || 320, hh = el.clientHeight || 76;
    const a = h('canvas'), s = h('canvas', { class: 'over' });
    el.append(a, s);
    new Sky(a, s, { w, h: hh }).draw(Date.now(), stateOf(cfg), 0);
  },

  controls(el, cfg, update) {
    const field = (label, control, out) => h('label', { class: 'range' }, h('span', {}, h('span', {}, label), out), control);
    const select = (key, options) => {
      const sel = h('select', {}, options.map(([v, text]) => h('option', { value: v }, text)));
      sel.value = String(cfg[key]);
      sel.addEventListener('change', () => { cfg[key] = sel.value; update({ [key]: sel.value }); after(key); });
      return sel;
    };
    const slider = (key, min, max, fmt, only) => {
      const out = h('output', {}, fmt(cfg[key]));
      const input = h('input', { type: 'range', min, max, step: 0.01 });
      input.value = cfg[key];
      input.addEventListener('input', () => { cfg[key] = +input.value; out.value = fmt(cfg[key]); update({ [key]: cfg[key] }); });
      sliders.push([key, input, out, fmt]);
      const row = field(t(key === 'horizon' ? 'horizonHeight' : key), input, out);
      if (only) styled.push([only, row]);
      return row;
    };
    const pct = v => Math.round(v * 100) + '%';
    const sliders = [], styled = [];
    // Yellow ↔ red, with the drawn colours in the middle.
    const hue = v => Math.abs(v) < .03 ? t('tintNatural') : t(v < 0 ? 'tintYellow' : 'tintRed', { n: Math.round(Math.abs(v) * 100) });
    const note = h('p', { class: 'note' });
    const after = key => {
      if (key === 'weather') {
        strengthRow.hidden = cfg.weather === 'off';
        weatherNote.hidden = cfg.weather === 'off';
        weatherNote.textContent = cfg.weather === 'off' ? '' : t(cfg.weather !== 'live' ? 'skyWeatherFixedNote' : S.location ? 'skyWeatherLiveNote' : 'skyWeatherNoCity');
        return;
      }
      if (key !== 'sunStyle') return;
      note.textContent = t(cfg.sunStyle === 'atmospheric' ? 'sunAtmoNote' : 'sunSoftNote');
      for (const [only, row] of styled) row.hidden = only !== cfg.sunStyle;
      style.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === cfg.sunStyle)));
    };
    const style = h('div', { class: 'seg wide', role: 'group' }, [['soft', t('sunSoft')], ['atmospheric', t('sunAtmo')]].map(([v, text]) =>
      h('button', { type: 'button', 'data-v': v, onclick: () => { cfg.sunStyle = v; update({ sunStyle: v }); after('sunStyle'); } }, text)));
    after('sunStyle');

    const resetTo = (label, values) => {
      const b = h('button', { type: 'button', class: 'btn ghost' }, t(label));
      b.addEventListener('click', () => {
        Object.assign(cfg, values);
        update({ ...values });
        after('sunStyle');
        weatherSel.value = cfg.weather;
        after('weather');
        starSel.value = cfg.starPlace; bearingSel.value = cfg.bearing;
        for (const [key, input, out, fmt] of sliders) { input.value = cfg[key]; out.value = fmt(cfg[key]); }
      });
      return b;
    };

    const starSel = select('starPlace', [['same', t('starSame')], ...PLACES.map((p, i) => [String(i), `${placeName(p)} · ${Math.abs(p.lat).toFixed(0)}°${p.lat < 0 ? 'S' : 'N'}`])]);
    const bearingSel = select('bearing', [['pole', t('bearPole')], ['0', t('north')], ['90', t('east')], ['180', t('south')], ['270', t('west')]]);
    const weatherSel = select('weather', [['off', t('skyWeatherOff')], ['live', t('skyWeatherLive')], ...CONDITIONS.map(c => [c.id, t(c.label)])]);
    const weatherNote = h('p', { class: 'note' });
    const strengthRow = slider('weatherStrength', 0.3, 1.3, pct);
    after('weather');

    el.append(
      h('label', { class: 'field' }, h('span', {}, t('skyWeather')), weatherSel), weatherNote, strengthRow,
      h('div', { class: 'field' }, h('span', {}, t('sunLabel')), style), note,
      slider('sharpness', 0, 1, pct, 'soft'),
      slider('haze', 0, 1, pct, 'atmospheric'),
      slider('tint', -1, 1, hue, 'atmospheric'),
      slider('warmth', 0.3, 1.3, pct),
      slider('horizon', 0.55, 0.78, v => t('fromBottom', { n: Math.round((1 - v) * 100) })),
      h('label', { class: 'field' }, h('span', {}, t('starSky')), starSel),
      h('label', { class: 'field' }, h('span', {}, t('bearing')), bearingSel),
      slider('starlight', 0.2, 1.3, pct),
      h('p', { class: 'note' }, t('starsNote')),
      h('div', { class: 'stack' }, resetTo('resetDefaults', DEFAULTS), resetTo('resetLight', SOFT)),
    );
    after('sunStyle');
  },

  activate(stage, cfg) {
    cfgNow = cfg;
    const a = h('canvas', { id: 'atmosphere', 'aria-hidden': 'true' });
    const s = h('canvas', { id: 'stars', 'aria-hidden': 'true' });
    grain = h('div', { class: 'grain', 'aria-hidden': 'true' });
    stage.append(a, s, grain);
    sky = new Sky(a, s);
    skyCanvas = a;
    last = performance.now();
    addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisible);
    syncWeather(cfg, true); // the first frame already shows the weather
    if (cfg.weather === 'live') pullForecast();
    frame();
  },

  update(cfg) {
    const wasLive = cfgNow.weather === 'live';
    cfgNow = cfg;
    syncWeather(cfg, false);
    if (cfg.weather === 'live' && !wasLive) pullForecast();
    frame();
  },

  deactivate() {
    clearTimeout(timer);
    removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisible);
    stopWeather();
    sky = null;
  },
};
