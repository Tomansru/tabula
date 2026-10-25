import { settings as S, on, save } from './store.js';
import { setLang, detectLang, applyI18n, t, getLang } from './i18n.js';
import { refreshWeather, renderWeather, sunSchedule } from './weather.js';
import { initTodos, renderTodos, reloadTodos } from './todos.js';
import { initBookmarks, renderBookmarks, reloadBookmarks } from './bookmarks.js';
import { initSearch, applySearch } from './search.js';
import { initSettings, openSettings, syncSettingsUI } from './settings.js';
import { initWeatherModal, openWeather } from './weatherModal.js';
import { startThemes, switchTheme, notifyThemes, activeTheme } from './themes/index.js';
import { sunAt, sunDk, nowHour } from './sun.js';
import { $, h, pad, ymd, isoWeek, cap } from './util.js';
import { renderCaptions } from './captions.js';

const root = document.documentElement;

/* ---------- light / dark mode ---------- */
const darkMq = matchMedia('(prefers-color-scheme: dark)');
// "sun": light by day, dark at night, switching at dusk and dawn (the sky theme fades between them).
function applyMode() {
  const owner = activeTheme();
  const dark = owner?.ownsMode ? owner.isDark()
    : S.mode === 'sun' ? sunDk(sunAt(nowHour(), sunSchedule()).e) > 0.5
    : S.mode === 'dark' || (S.mode === 'auto' && darkMq.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  // A theme that decides light/dark itself is only known after the scripts load; boot.js starts from its last answer.
  if (owner?.ownsMode) save('ink', root.dataset.theme);
  root.classList.toggle('todo-card', !!S.todoCard);
  root.classList.toggle('no-caps', !S.captions);
  root.classList.toggle('no-todos', !S.showTodos);
  root.dataset.type = S.typeset;
}
darkMq.addEventListener('change', applyMode);

/* ---------- clock & date ---------- */
const clock = $('#clock');
const hmEl = clock.querySelector('.hm'), secEl = clock.querySelector('.sec'), ampmEl = clock.querySelector('.ampm');
let timer, lastDay = '', lastMinute = -1;

function tick() {
  clearTimeout(timer);
  const now = new Date();
  let H = now.getHours();
  if (S.h24) {
    hmEl.textContent = `${pad(H)}:${pad(now.getMinutes())}`;
    ampmEl.textContent = '';
  } else {
    hmEl.textContent = `${H % 12 || 12}:${pad(now.getMinutes())}`;
    ampmEl.textContent = new Intl.DateTimeFormat(getLang(), { hour: 'numeric', hour12: true })
      .formatToParts(now).find(p => p.type === 'dayPeriod')?.value || (H < 12 ? 'AM' : 'PM');
  }
  secEl.textContent = S.seconds ? pad(now.getSeconds()) : '';
  clock.dateTime = now.toISOString();

  const day = ymd(now);
  if (day !== lastDay) {
    const first = !lastDay;
    lastDay = day;
    renderDate(now);
    if (!first) renderTodos(); // midnight: a fresh "Today" appears
  }
  const minute = now.getHours() * 60 + now.getMinutes();
  if (minute !== lastMinute) { lastMinute = minute; renderCaptions(now); }
  applyMode(); // follows the sun in the "sun" mode and in themes that set light/dark themselves
  const ms = S.seconds ? 1000 - now.getMilliseconds() : 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
  timer = setTimeout(tick, ms + 15);
}

function renderDate(now = new Date()) {
  const text = cap(new Intl.DateTimeFormat(getLang(), { weekday: 'long', day: 'numeric', month: 'long' }).format(now));
  $('#date').replaceChildren(h('span', {}, text), h('span', { class: 'wk' }, t('week', { n: isoWeek(now).week })));
}

/* ---------- weather ---------- */
const wxBtn = $('#weather');
// With a location the button opens the forecast; without one it goes straight to choosing a city.
wxBtn.addEventListener('click', () => (S.location ? openWeather() : openSettings('#sLocSearch')));

function updateWeatherUI() {
  renderWeather(wxBtn);
}

/* ---------- search ---------- */
initSearch();

const pullWeather = force => refreshWeather(force).catch(e => console.debug('[tabula] weather', e));

/* ---------- boot ---------- */
if (!S.lang) S.lang = detectLang();
setLang(S.lang);
applyMode();
applyI18n();
document.title = t('newTab');

tick();
updateWeatherUI();
initTodos($('#todos'));
initBookmarks($('#bookmarks'));
initSettings();
initWeatherModal();
startThemes();
applyMode();
pullWeather();

on('weather', () => { updateWeatherUI(); applyMode(); notifyThemes('weather'); });
on('settings', p => {
  if ('lang' in p) {
    setLang(S.lang);
    applyI18n();
    document.title = t('newTab');
    renderDate();
    renderCaptions();
    renderTodos();
    renderBookmarks();
    syncSettingsUI();
    tick();
    pullWeather(); // city names don't change, but descriptions do
    updateWeatherUI();
  }
  if ('mode' in p || 'todoCard' in p || 'showTodos' in p) { applyMode(); notifyThemes('mode'); }
  // Type and captions move the search bar, which is the sky's horizon.
  if ('typeset' in p || 'captions' in p) { applyMode(); syncSettingsUI(); dispatchEvent(new Event('resize')); }
  if ('theme' in p) { switchTheme(S.theme); applyMode(); syncSettingsUI(); }
  if ('location' in p) notifyThemes('location');
  if ('showSearch' in p) { applySearch(); syncSettingsUI(); }
  if ('bmNewTab' in p) renderBookmarks();
  if ('h24' in p || 'seconds' in p) tick();
  if ('showWeather' in p) { updateWeatherUI(); pullWeather(); }
  if ('units' in p || 'location' in p) { updateWeatherUI(); pullWeather(true); }
});

// Keep weather fresh in long-lived tabs and catch up after sleep.
setInterval(pullWeather, 5 * 60e3);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  tick();
  pullWeather();
  if (staleSettings) location.reload();
});

// Another new tab changed something: stay in sync.
let staleSettings = false;
addEventListener('storage', e => {
  if (e.key === 'tabula.todos') reloadTodos();
  else if (e.key === 'tabula.bookmarks') reloadBookmarks();
  else if (e.key === 'tabula.settings') document.hidden ? (staleSettings = true) : location.reload();
});
