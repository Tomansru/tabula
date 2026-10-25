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
  const { mode, theme, showSearch, searchEngine, bmNewTab, captions, typeset, todoCard, showWeather, showTodos } = settings;
  assert.deepEqual(
    { mode, theme, showSearch, searchEngine, bmNewTab, captions, typeset, todoCard, showWeather, showTodos },
    { mode: 'sun', theme: 'daylight', showSearch: true, searchEngine: 'google', bmNewTab: true, captions: true, typeset: 'air', todoCard: false, showWeather: true, showTodos: true },
  );
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
