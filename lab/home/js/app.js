import { settings as S, on } from './store.js?v=2';
import { setLang, detectLang, applyI18n, t, getLang } from './i18n.js?v=2';
import { refreshWeather, renderWeather, sunSchedule } from './weather.js?v=2';
import { initTodos, renderTodos, reloadTodos } from './todos.js?v=2';
import { initBookmarks, renderBookmarks, reloadBookmarks } from './bookmarks.js?v=2';
import { initSearch, applySearch } from './search.js?v=2';
import { initSettings, openSettings, syncSettingsUI } from './settings.js?v=2';
import { initWeatherModal, openWeather } from './weatherModal.js?v=2';
import { startThemes, switchTheme, notifyThemes, activeTheme } from './themes/index.js?v=2';
import { sunAt, sunDk, nowHour } from './sun.js?v=2';
import { $, h, pad, ymd, isoWeek, cap } from './util.js?v=2';

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
  root.classList.toggle('todo-card', !!S.todoCard);
}
darkMq.addEventListener('change', applyMode);

/* ---------- clock & date ---------- */
const clock = $('#clock');
const hmEl = clock.querySelector('.hm'), secEl = clock.querySelector('.sec'), ampmEl = clock.querySelector('.ampm');
let timer, lastDay = '';

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

// Weather effects on the clock are off for now (they will come back together with the sky).
function updateWeatherUI() {
  renderWeather(wxBtn);
  delete root.dataset.wx;
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
    renderTodos();
    renderBookmarks();
    syncSettingsUI();
    tick();
    pullWeather(); // city names don't change, but descriptions do
    updateWeatherUI();
  }
  if ('mode' in p || 'todoCard' in p) { applyMode(); notifyThemes('mode'); }
  if ('theme' in p) { switchTheme(S.theme); applyMode(); syncSettingsUI(); }
  if ('location' in p) notifyThemes('location');
  if ('showSearch' in p) { applySearch(); syncSettingsUI(); }
  if ('bmNewTab' in p) renderBookmarks();
  if ('h24' in p || 'seconds' in p) tick();
  if ('clockFx' in p || 'showWeather' in p) { updateWeatherUI(); pullWeather(); }
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
  if (e.key === 'tabula.home-demo.todos') reloadTodos();
  else if (e.key === 'tabula.home-demo.bookmarks') reloadBookmarks();
  else if (e.key === 'tabula.home-demo.settings') document.hidden ? (staleSettings = true) : location.reload();
});
