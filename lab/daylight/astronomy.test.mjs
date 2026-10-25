import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, RAD, dayWindow, events, solar, sidereal, horizontal, dateAt } from './astronomy.js';

test('Belgrade DST days contain 23 and 25 real hours', () => {
  assert.equal(dayWindow('2026-03-29', 'Europe/Belgrade').minutes, 1380);
  assert.equal(dayWindow('2026-10-25', 'Europe/Belgrade').minutes, 1500);
  assert.equal(dayWindow('2026-10-24', 'Europe/Belgrade').minutes, 1440);
});
test('calendar rolls over leap days and year boundaries', () => {
  for (const [date, expected] of [['2024-02-29', '2024-03-01'], ['2026-12-31', '2027-01-01']]) {
    const day = dayWindow(date, 'Pacific/Auckland');
    assert.equal(dateAt(day.end, 'Pacific/Auckland'), expected);
    assert.equal(day.minutes, 1440);
  }
});
test('Tromsø has no fabricated sunrise in polar summer or winter', () => {
  const place = PLACES.find(p => p.name === 'Тромсё');
  for (const [date, expected] of [['2026-06-21', 'day'], ['2026-12-21', 'night']]) {
    const e = events(dayWindow(date, place.zone), place);
    assert.equal(e.polar, expected); assert.equal(e.rise, null); assert.equal(e.set, null);
  }
});
test('Belgrade winter day is shorter than summer and crosses horizon in correct order', () => {
  const place = PLACES[0];
  const winter = events(dayWindow('2026-12-21', place.zone), place);
  const summer = events(dayWindow('2026-06-21', place.zone), place);
  assert.ok(summer.set - summer.rise > winter.set - winter.rise);
  for (const e of [summer, winter]) {
    assert.ok(e.rise < e.noon && e.noon < e.set);
    assert.ok(Math.abs(solar(e.rise, place).altitude + .833) < .001);
    assert.ok(solar(e.rise - 60000, place).altitude < solar(e.rise + 60000, place).altitude);
    assert.ok(solar(e.set - 60000, place).altitude > solar(e.set + 60000, place).altitude);
  }
});
test('solar position is continuous across UTC midnight', () => {
  const ms = Date.parse('2026-06-21T00:00:00Z');
  for (const place of PLACES) assert.ok(Math.abs(solar(ms - 100, place).altitude - solar(ms + 100, place).altitude) < .002);
});
test('GMST at J2000 noon is about 18.6974 hours', () => {
  const hours = sidereal(Date.parse('2000-01-01T12:00:00Z'), 0) / RAD / 15;
  assert.ok(Math.abs(hours - 18.697375) < .0001);
});
test('a sidereal day returns the stellar sphere, a solar day does not', () => {
  const ms = Date.parse('2026-10-24T00:00:00Z');
  assert.ok(Math.abs(sidereal(ms + 86164091, 20) - sidereal(ms, 20)) < .00001);
  assert.ok(Math.abs(sidereal(ms + 86400000, 20) - sidereal(ms, 20)) > .01);
});
test('celestial poles have the expected altitude and all transformed vectors stay unit length', () => {
  for (const lat of [-90, -44, 0, 44, 90]) {
    for (const lst of [0, 1, 4]) {
      const p = horizontal(0, Math.PI / 2, lst, lat);
      assert.ok(Math.abs(p.up - Math.sin(lat * RAD)) < 1e-10);
      const v = horizontal(1.3, -.4, lst, lat);
      assert.ok(Math.abs(Math.hypot(v.east, v.north, v.up) - 1) < 1e-10);
    }
  }
});
