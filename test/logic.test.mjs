// Pure logic that runs without a page: dates, the sun, the sun arc and stored settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { isoWeek, startOfWeek, ymd } from '../js/util.js';
import { sunAt, sunDk } from '../js/sun.js';
import { sunArc, sunLeft, localNow } from '../js/sunArc.js';
import { setLang } from '../js/i18n.js';
import { dayCaption } from '../js/captions.js';
import { settings, migrateSettings } from '../js/store.js';
import { CONDITIONS, DIALS, conditionById, targetDials, readForecast } from '../js/themes/daylight/weather/conditions.js';
import { apca, apcaY, pickInk, haloFor } from '../js/themes/daylight/weather/ink.js';

// setLang() also sets <html lang>; give it an element to set.
globalThis.document ??= { documentElement: {} };

test('ISO weeks across year boundaries', () => {
  assert.deepEqual(isoWeek(new Date(2026, 9, 25)), { year: 2026, week: 43 });
  assert.deepEqual(isoWeek(new Date(2021, 0, 3)), { year: 2020, week: 53 });
  assert.deepEqual(isoWeek(new Date(2024, 11, 30)), { year: 2025, week: 1 });
});

test('weeks start on Monday', () => {
  assert.equal(ymd(startOfWeek(new Date(2026, 9, 25))), '2026-10-19'); // Sunday
  assert.equal(ymd(startOfWeek(new Date(2026, 9, 19))), '2026-10-19'); // Monday
});

test('the sun is on the horizon at sunrise and sunset, highest between them, below at night', () => {
  const day = { sr: 6, ss: 18 };
  assert.ok(Math.abs(sunAt(6, day).e) < 1e-9);
  assert.ok(Math.abs(sunAt(18, day).e) < 1e-9);
  assert.ok(Math.abs(sunAt(12, day).e - 1) < 1e-9);
  assert.ok(sunAt(0, day).e < 0);
  assert.ok(sunDk(sunAt(12, day).e) < 0.01, 'noon is light');
  assert.ok(sunDk(sunAt(0, day).e) > 0.99, 'midnight is dark');
});

// A day in the weather cache: times are the location's local time.
const weather = { sr: 6.5, ss: 18.5, now: '2026-10-25T12:30', ts: Date.now() };
const pathEnds = svg => [...svg.matchAll(/d="M(\S+) (\S+) A/g)].map(m => [+m[1], +m[2]]);

test('the sun arc starts and ends on the horizon and is clipped at it', () => {
  const svg = sunArc(weather, 12.5);
  const horizon = +svg.match(/<line x1="\S+" y1="(\S+)"/)[1];
  for (const [, y] of pathEnds(svg)) assert.equal(y, horizon);
  const clip = svg.match(/<rect x="0" y="(\S+)" width="\S+" height="(\S+)"/);
  assert.equal(+clip[1] + +clip[2], horizon, 'the clip ends exactly at the horizon line');
  assert.match(svg, /class="arc-sun"/, 'the sun is drawn by day');
  assert.doesNotMatch(sunArc(weather, 22), /class="arc-sun"/, 'and not at night');
});

test('each arc gets its own gradient ids', () => {
  const id = s => s.match(/linearGradient id="(\w+)"/)[1];
  assert.notEqual(id(sunArc(weather, 9)), id(sunArc(weather, 9)));
});

test('time to sunset by day, to sunrise at night', () => {
  setLang('en');
  assert.equal(sunLeft(weather, 12.5), 'Sunset in 6 h 0 min');
  assert.equal(sunLeft(weather, 20.5), 'Sunrise in 10 h 0 min');
  assert.equal(localNow(weather).day, '2026-10-25');
});

test('the day caption: left until sunset, passed after it', () => {
  setLang('ru');
  const sunset = 16 + 50 / 60;
  const at = (h, m) => dayCaption(new Date(2026, 9, 25, h, m), sunset).text;
  assert.equal(at(0, 0), 'Осталось 100% дня');
  assert.equal(at(8, 0), 'Осталось 67% дня');
  assert.equal(at(16, 49), 'Осталось 30% дня');
  assert.equal(at(16, 50), 'Прошло 70% дня');
  assert.equal(at(23, 41), 'Прошло 98% дня');
  assert.equal(at(23, 59), 'Прошло 99% дня', 'never 100% before midnight');
});

test('defaults for a new install', () => {
  const { mode, theme, showSearch, searchEngine, bmNewTab, captions, typeset, todoCard, showWeather, showTodos, weatherFx } = settings;
  assert.deepEqual(
    { mode, theme, showSearch, searchEngine, bmNewTab, captions, typeset, todoCard, showWeather, showTodos, weatherFx },
    { mode: 'sun', theme: 'daylight', showSearch: true, searchEngine: 'google', bmNewTab: true, captions: true, typeset: 'air', todoCard: false, showWeather: true, showTodos: true, weatherFx: false },
  );
});

test('weather effects move to the main settings; the theme keeps only which weather', () => {
  const had = migrateSettings({ themes: { daylight: { weather: 'snow', sunStyle: 'soft' } } });
  assert.equal(had.weatherFx, true);
  assert.equal(had.themes.daylight.weather, 'snow');
  const off = migrateSettings({ themes: { daylight: { weather: 'off', sunStyle: 'soft' } } });
  assert.equal(off.weatherFx, false);
  assert.deepEqual(off.themes.daylight, { sunStyle: 'soft' }, 'the theme falls back to the live forecast');
  assert.ok(!('weatherFx' in migrateSettings({ mode: 'sun' })), 'a new install gets the default');
  // Once moved, the main switch is the user's own: an old value in the theme no longer decides it.
  assert.equal(migrateSettings({ weatherFx: false, themes: { daylight: { weather: 'rain' } } }).weatherFx, false);
});

test('default bookmarks use Chrome\'s cached icons; no site logos are bundled', async () => {
  console.warn = () => {}; // Node has no localStorage to save the first-run bookmarks into
  const { plainIconCount } = await import('../js/bookmarks.js');
  assert.equal(plainIconCount(), 4);
  assert.ok(!existsSync(new URL('../icons/sites', import.meta.url)));
});

test('old settings move to the mode and the picture theme', () => {
  assert.deepEqual(migrateSettings({ theme: 'dark' }), { mode: 'dark' });
  const s = migrateSettings({ theme: 'light', bgType: 'url', bgUrl: 'https://example.com/a.jpg', bgDim: 40, bgBlur: 2 });
  assert.equal(s.mode, 'light');
  assert.equal(s.theme, 'picture');
  assert.deepEqual(s.themes.picture, { src: 'url', url: 'https://example.com/a.jpg', dim: 40, blur: 2 });
  assert.ok(!('bgType' in s));
});

test('every WMO code Open-Meteo can send has weather for the sky', () => {
  const expected = { 0: 'clear', 1: 'fair', 2: 'cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'drizzle', 57: 'drizzle', 61: 'rain', 67: 'rain', 80: 'rain', 82: 'rain', 71: 'snow', 77: 'snow', 85: 'snow', 86: 'snow', 95: 'storm', 96: 'storm', 99: 'storm' };
  for (const [code, id] of Object.entries(expected)) assert.equal(readForecast(+code, 2, 3).condition.id, id, `code ${code}`);
  assert.equal(readForecast(1234).condition.id, 'clear'); // a code that does not exist yet leaves the sky alone
});

test('snow in a strong wind is a blizzard, rain in a strong wind is still rain', () => {
  assert.equal(readForecast(73, 4, 8).condition.id, 'snow');
  assert.equal(readForecast(73, 11, 14).condition.id, 'blizzard');
  assert.equal(readForecast(73, 6, 17).condition.id, 'blizzard');
  assert.equal(readForecast(63, 20, 30).condition.id, 'rain');
});

test('a forecast from an older cache, without wind, still works', () => {
  const { condition, force, wind } = readForecast(63, NaN, NaN);
  assert.equal(condition.id, 'rain');
  assert.equal(wind, null);
  assert.equal(targetDials(condition, { force, wind }).wind, condition.wind);
});

test('no dial goes over 1, whatever the strength and the forecast: drops and flakes are a fixed set', () => {
  for (const c of CONDITIONS) {
    for (const d of Object.values(targetDials(c, { strength: 1.3, force: 1.3, wind: 40 }))) assert.ok(d >= 0 && d <= 1, c.id);
    assert.ok(targetDials(c, { strength: 1.3 }).veil <= .94, `${c.id} keeps a touch of sky`);
    assert.deepEqual(Object.keys(targetDials(c)), DIALS);
  }
});

test('heavier readings of the same weather bring more of it, but the same clouds', () => {
  const rain = conditionById('rain');
  const light = targetDials(rain, { force: readForecast(61).force }), heavy = targetDials(rain, { force: readForecast(65).force });
  assert.ok(light.rain < heavy.rain);
  assert.equal(light.cover, heavy.cover);
});

test('the real wind leans the sky', () => {
  const rain = conditionById('rain');
  assert.ok(targetDials(rain, { wind: 14 }).wind > targetDials(rain, { wind: 1 }).wind);
});

/* ---------- the ink over a clouded sky ---------- */
const grey = (g, need = 60, weight = 1) => ({ ys: Float64Array.of(apcaY([g, g, g])), rgb: [g, g, g], need, weight });

test('APCA contrast matches its reference values', () => {
  assert.equal(apca(apcaY([0, 0, 0]), apcaY([1, 1, 1])).toFixed(2), '106.04');
  assert.equal(apca(apcaY([1, 1, 1]), apcaY([0, 0, 0])).toFixed(2), '-107.88');
  assert.equal(apca(.5, .5), 0);
});

test('dark text on a pale sky, light text on a dark one, and no help needed when it reads well', () => {
  const pale = pickInk([grey(.85)]), dark = pickInk([grey(.3)]);
  assert.equal(pale.lightText, false);
  assert.equal(dark.lightText, true);
  assert.equal(pale.hard, 0);
  assert.equal(dark.hard, 0);
  assert.ok(pickInk([grey(.6)]).hard > .5, 'a mid-grey sky is the hard one');
});

test('on a mid-grey sky the time of day settles it, and the ink does not flicker', () => {
  assert.equal(pickInk([grey(.61)], null, false).lightText, false);
  assert.equal(pickInk([grey(.61)], null, true).lightText, true);
  // Once chosen, it stays until the other ink is clearly better.
  assert.equal(pickInk([grey(.6)], false).lightText, false);
  assert.equal(pickInk([grey(.62)], true).lightText, true);
  assert.equal(pickInk([grey(.85)], true).lightText, false);
});

test('one caption over a dark cloud is not outvoted by a bright patch behind the clock', () => {
  const zones = [grey(.66, 45, 1), grey(.66, 60, 1), grey(.32, 55, 1)];
  assert.equal(pickInk(zones).lightText, true);
});

test('the halo is the sky a step away from the ink, not a white glow on grey', () => {
  const sky = [.58, .62, .66];
  assert.equal(haloFor(false, sky, 0, 0), '0 1px 10px rgb(255 255 255 / 0.45), 0 0 3px rgb(255 255 255 / 0.00)');
  assert.equal(haloFor(true, sky, 0, 0), '0 1px 12px rgb(8 12 28 / 0.45), 0 0 2px rgb(8 12 28 / 0.00)');
  const [r, g, b] = haloFor(false, sky, .5, 1).match(/rgb\((\d+) (\d+) (\d+)/).slice(1).map(Number);
  assert.ok(r < 240 && r < g && g < b, 'paler than the sky, still its own blue-grey');
  assert.ok(r > sky[0] * 255, 'and lighter than the sky behind dark text');
});
