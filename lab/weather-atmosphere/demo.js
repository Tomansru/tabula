import { PLACES, clamp, dayWindow, dateAt, events, partsAt, mix } from './astronomy.js';
import { Sky } from './sky.js';
import { Weather, PRESETS, WEATHER_KEYS } from './weather.js?v=2';

const $ = id => document.getElementById(id);
const defaults = { sunStyle: 'atmospheric', sharpness: .45, warmth: .85, horizon: .68, starlight: .8, bearing: 'pole' };
const state = { ...defaults, place: PLACES[0], starPlace: null, date: dateAt(Date.now(), PLACES[0].zone), playing: false, live: false, speed: 720 };
try { if (localStorage.getItem('tabula.weather-atmosphere.sunStyle') === 'atmospheric') state.sunStyle = 'atmospheric'; } catch {}
const sky = new Sky($('atmosphere'), $('stars'));
const weather = new Weather($('weatherField'), $('precipitation'));
weather.effects.attachClock($('clock'));
let weatherMotion = true, weatherPreset = 'clouds';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let windowOfDay, sunEvents, instant, timer, last = performance.now(), visualTime = 0;
let lastUI = '', activeMoment = 'sunset';

function updateCalendar() {
  windowOfDay = dayWindow(state.date, state.place.zone);
  sunEvents = events(windowOfDay, state.place);
  $('date').value = state.date;
  $('timeline').max = windowOfDay.minutes - .01;
  // The timeline measures elapsed time, so DST days keep a continuous sky (23 / 25 h).
  const ticks = document.querySelectorAll('.ticks span');
  ticks.forEach((el, i) => { el.textContent = i === 4 ? '24:00' : formatTime(windowOfDay.start + (windowOfDay.end - windowOfDay.start) * i / 4); });
  $('sunTimes').textContent = sunEvents.polar === 'day' ? 'Полярный день' : sunEvents.polar === 'night' ? 'Полярная ночь' : `↑ ${sunEvents.rise ? formatTime(sunEvents.rise) : '—'}   ·   ↓ ${sunEvents.set ? formatTime(sunEvents.set) : '—'}`;
  for (const button of $('moments').children) button.disabled = momentTime(button.dataset.moment) === null;
}
function formatTime(ms) {
  const p = partsAt(ms, state.place.zone); return `${p.hour}:${p.minute}`;
}
function momentTime(name) {
  const { rise, set, noon } = sunEvents;
  return { night: windowOfDay.start + 2 * 3600000, dawn: rise === null ? null : rise - 30 * 60000,
    sunrise: rise === null ? null : rise + 3 * 60000, noon,
    sunset: set === null ? null : set - 8 * 60000, blue: set === null ? null : set + 36 * 60000 }[name];
}
function phase(sun) {
  const e = sun.altitude, rising = sun.hourAngle < 0;
  if (e < -15) return ['Тихая ночь', 'Никуда не спешить'];
  if (e < -6) return ['Синий час', rising ? 'Мир ещё спит' : 'День становится тише'];
  if (e < -.8) return [rising ? 'Рассвет' : 'Послесвечение', rising ? 'Скоро новый день' : 'Сохранить немного тепла'];
  if (e < 6) return [rising ? 'Восход' : 'Закат', rising ? 'Пусть день будет добрым' : 'Побыть в этом мгновении'];
  if (e < 14) return ['Золотой час', rising ? 'Время для нового' : 'У света есть своё время'];
  return ['Дневной свет', 'Место для ваших мыслей'];
}
function syncUI(sun) {
  const time = formatTime(instant), p = phase(sun);
  const key = [time, p[0], state.place.name, state.date, state.live, state.playing, activeMoment].join('|');
  if (key !== lastUI) {
    weather.effects.setClock(time, weather.current.wind, weatherMotion && !reducedMotion.matches, weather.time); $('clock').dateTime = new Date(instant).toISOString();
    $('timeLabel').textContent = time; $('phaseLabel').textContent = p[0]; $('greeting').textContent = p[1];
    $('dateLabel').textContent = new Intl.DateTimeFormat('ru', { timeZone: state.place.zone, weekday: 'long', day: 'numeric', month: 'long' }).format(instant);
    $('placeLabel').textContent = state.place.name;
    $('play').textContent = state.playing ? 'Ⅱ Остановить время' : '▶ Прожить день';
    $('play').setAttribute('aria-pressed', String(state.playing)); $('live').setAttribute('aria-pressed', String(state.live));
    for (const button of $('moments').children) button.setAttribute('aria-pressed', String(button.dataset.moment === activeMoment));
    lastUI = key;
  }
  $('timeline').value = (instant - windowOfDay.start) / 60000;
  $('timeline').setAttribute('aria-valuetext', time);
  // Keep white type on dusk / night, dark type on the pale day. No grey-on-grey fade.
  const day = weather.useDarkInk(sun.altitude);
  document.documentElement.style.setProperty('--ink', day ? '39,54,65' : '242,236,231');
  document.documentElement.style.setProperty('--line', day ? '49,64,70' : '255,255,255');
  document.documentElement.style.setProperty('--glass', day ? '255,251,238' : '24,28,40');
  document.documentElement.style.setProperty('--accent', day ? '#8d6141' : '#eac39b');
}
function frame() {
  clearTimeout(timer);
  if (document.hidden) { weather.effects.stopAnimations(); return; }
  const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
  if (state.live) {
    instant = Date.now();
    const date = dateAt(instant, state.place.zone);
    if (date !== state.date) { state.date = date; updateCalendar(); }
  } else if (state.playing) {
    instant += dt * state.speed * 1000;
    if (instant >= windowOfDay.end) { state.date = dateAt(instant, state.place.zone); updateCalendar(); }
  }
  const moving = weatherMotion && !reducedMotion.matches;
  if (!reducedMotion.matches && (state.playing || state.live || moving)) visualTime += dt;
  weather.advance(dt, moving);
  const sun = sky.draw(instant, state, visualTime);
  syncUI(sun); weather.draw(sun, state);
  $('weatherStatus').textContent = weather.transitioning ? 'Меняется атмосфера' : moving && weather.active ? 'Медленное движение' : 'Неподвижное небо';
  // Air evolves in real seconds, independently of accelerated solar time.
  if (state.playing || state.live || (moving && weather.active)) {
    const fps = state.playing ? 30 : moving && weather.active ? (weather.current.rain + weather.current.snow + weather.current.thunder > .001 ? 24 : 12) : 1;
    timer = setTimeout(frame, 1000 / fps);
  }
}
function redraw() { last = performance.now(); frame(); }
function stop() { state.playing = state.live = false; activeMoment = ''; }
function jump(name) {
  const at = momentTime(name); if (at === null) return;
  stop(); activeMoment = name; instant = clamp(at, windowOfDay.start, windowOfDay.end - 1); redraw();
}

for (const [index, place] of PLACES.entries()) {
  for (const id of ['location', 'starLocation']) {
    const option = document.createElement('option'); option.value = index;
    option.textContent = `${place.name} · ${Math.abs(place.lat).toFixed(1)}° ${place.lat < 0 ? 'ю. ш.' : 'с. ш.'}`;
    $(id).append(option);
  }
}
$('location').addEventListener('change', e => {
  const elapsed = (instant - windowOfDay.start) / (windowOfDay.end - windowOfDay.start);
  state.place = PLACES[+e.target.value];
  const moment = activeMoment; stop(); updateCalendar();
  instant = mix(windowOfDay.start, windowOfDay.end - 1, elapsed);
  if (moment && momentTime(moment) !== null) jump(moment); else redraw();
});
$('starLocation').addEventListener('change', e => { state.starPlace = e.target.value === 'same' ? null : PLACES[+e.target.value]; redraw(); });
$('bearing').addEventListener('change', e => { state.bearing = e.target.value; redraw(); });
function syncSunStyle(save = false) {
  $('sunStyle').value = state.sunStyle;
  $('sunStyleNote').textContent = state.sunStyle === 'atmospheric'
    ? 'У горизонта — светящийся диск и красноватая дымка. К полудню диск растворяется в заполняющем свете.'
    : 'Мягкий диск сохраняется в течение дня.';
  if (save) try { localStorage.setItem('tabula.weather-atmosphere.sunStyle', state.sunStyle); } catch {}
}
$('sunStyle').addEventListener('change', e => { state.sunStyle = e.target.value; syncSunStyle(true); redraw(); });
$('date').addEventListener('change', e => {
  if (!e.target.value || !e.target.checkValidity()) { e.target.value = state.date; return; }
  const fraction = (instant - windowOfDay.start) / (windowOfDay.end - windowOfDay.start), moment = activeMoment;
  stop(); state.date = e.target.value; updateCalendar(); instant = mix(windowOfDay.start, windowOfDay.end - 1, fraction);
  if (moment && momentTime(moment) !== null) jump(moment); else redraw();
});
function syncSliders() {
  for (const key of ['sharpness', 'warmth', 'horizon', 'starlight']) {
    $(key).value = state[key];
    $(key + 'Out').value = key === 'horizon' ? `${Math.round((1 - state[key]) * 100)}% от низа` : `${Math.round(state[key] * 100)}%`;
  }
}
for (const key of ['sharpness', 'warmth', 'horizon', 'starlight']) $(key).addEventListener('input', e => { state[key] = +e.target.value; syncSliders(); redraw(); });
$('reset').addEventListener('click', () => { Object.assign(state, defaults); $('bearing').value = 'pole'; syncSunStyle(true); syncSliders(); redraw(); });
$('timeline').addEventListener('input', e => { stop(); instant = windowOfDay.start + +e.target.value * 60000; redraw(); });
$('moments').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) jump(b.dataset.moment); });
$('play').addEventListener('click', () => { state.playing = !state.playing; state.live = false; activeMoment = ''; redraw(); });
$('live').addEventListener('click', () => { state.live = !state.live; state.playing = false; activeMoment = ''; redraw(); });
$('speed').addEventListener('change', e => { state.speed = +e.target.value; });
$('hideUI').addEventListener('click', () => {
  const hidden = document.body.classList.toggle('sky-only');
  weather.effects.enabled = !hidden && $('typeInteraction').checked;
  weather.effects.invalidate();
  $('hideUI').textContent = hidden ? 'Вернуть часы' : 'Только небо'; $('hideUI').setAttribute('aria-pressed', String(hidden));
});
$('settingsButton').addEventListener('click', () => $('settings').showModal());
$('closeSettings').addEventListener('click', () => $('settings').close());
$('settings').addEventListener('click', e => { if (e.target === $('settings') && e.clientX < $('settings').getBoundingClientRect().left) $('settings').close(); });
addEventListener('resize', () => { sky.resize(); weather.resize(); redraw(); });
document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (document.hidden) weather.effects.stopAnimations(); else redraw(); });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stop(); syncWeatherMotion(); redraw(); });
function syncWeatherMotion() {
  const moving = weatherMotion && !reducedMotion.matches;
  $('weatherMotion').setAttribute('aria-pressed', String(moving));
  $('weatherMotion').textContent = moving ? 'Ⅱ Замереть' : '▶ Движение воздуха';
  $('weatherMotion').disabled = reducedMotion.matches;
  $('lightningPreview').disabled = weather.target.thunder < .05 || !moving;
  if (!moving) weather.effects.stopAnimations();
  $('weatherMotion').title = reducedMotion.matches ? 'Движение отключено системной настройкой' : '';
}
function syncWeatherControls() {
  for (const key of WEATHER_KEYS) {
    $(key).value = weather.target[key];
    $(key + 'Out').value = key === 'wind'
      ? `${weather.target.wind < 0 ? '←' : weather.target.wind > 0 ? '→' : '·'} ${Math.round(Math.abs(weather.target.wind) * 100)}%`
      : `${Math.round(weather.target[key] * 100)}%`;
  }
  $('weatherPreset').value = weatherPreset;
  $('lightningPreview').disabled = weather.target.thunder < .05 || reducedMotion.matches || !weatherMotion;
  $('weatherDescription').textContent = PRESETS[weatherPreset]?.note || 'Свой баланс облаков, видимости и осадков. Переключите готовую погоду, чтобы вернуться к пресету.';
}
for (const [id, preset] of Object.entries(PRESETS)) {
  const option = document.createElement('option'); option.value = id; option.textContent = preset.name;
  $('weatherPreset').append(option);
}
const custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = 'Свой вариант'; custom.disabled = true;
$('weatherPreset').append(custom);
$('weatherPreset').addEventListener('change', e => {
  weatherPreset = e.target.value;
  weather.set(PRESETS[weatherPreset], !weatherMotion || reducedMotion.matches);
  syncWeatherControls(); redraw();
});
for (const key of WEATHER_KEYS) $(key).addEventListener('input', e => {
  weatherPreset = 'custom';
  weather.set({ ...weather.target, [key]: +e.target.value }, !weatherMotion || reducedMotion.matches);
  syncWeatherControls(); redraw();
});
$('weatherMotion').addEventListener('click', () => { weatherMotion = !weatherMotion; syncWeatherMotion(); redraw(); });
$('typeInteraction').addEventListener('change', e => { weather.effects.enabled = e.target.checked && !document.body.classList.contains('sky-only'); weather.effects.invalidate(); redraw(); });
$('lightningPreview').addEventListener('click', () => { weather.effects.triggerLightning(weather.time); redraw(); });
$('gustPreview').addEventListener('click', () => { stop(); instant+=60000; if(instant>=windowOfDay.end) {state.date=dateAt(instant,state.place.zone);updateCalendar();} redraw(); });
document.fonts?.ready.then(() => { weather.effects.invalidate(); redraw(); });
syncWeatherControls(); syncWeatherMotion();
// Kept separate from extension settings. Sky.draw(ms, options) is the integration boundary.
updateCalendar(); syncSliders(); syncSunStyle();
instant = sunEvents.noon; activeMoment = 'noon';
redraw();
