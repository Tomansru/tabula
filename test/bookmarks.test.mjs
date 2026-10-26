// "Improve bookmark icons" when no site can be read (offline here; Gmail without signing in, in real life).
import test from 'node:test';
import assert from 'node:assert/strict';

// Just enough of a page for discover(): every request fails and pages parse to nothing.
globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
// Node has no localStorage and every request fails here; keep the expected warnings out of the output.
console.debug = console.warn = () => {};
globalThis.DOMParser = class { parseFromString() { return { querySelectorAll: () => [], querySelector: () => null }; } };

const { plainIconCount, improveIcons, freshFavicon, pruneFavicons } = await import('../js/bookmarks.js');

test('sites whose icon cannot be read are named and not offered again', async () => {
  assert.equal(plainIconCount(), 4);
  const result = await improveIcons();
  assert.deepEqual(result, { done: 0, total: 4, failed: ['YouTube', 'GitHub', 'ChatGPT', 'Claude'] });
  assert.equal(plainIconCount(), 0, 'the button has nothing left to offer');
});

test('worked-out Chrome icons are reused: a week for sharp ones, a day for "no icon"', () => {
  const now = Date.parse('2026-10-26T12:00:00Z'), day = 864e5;
  const cache = {
    a: { kind: 'sharp', src: 'data:', t: now - 6 * day },
    b: { kind: 'sharp', src: 'data:', t: now - 8 * day },
    c: { kind: 'globe', t: now - 2 * 36e5 },
    d: { kind: 'globe', t: now - 2 * day },
    e: { kind: 'native', t: now - 3 * day },
  };
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map(u => !!freshFavicon(cache, u, now)), [true, false, true, false, true]);
  assert.equal(freshFavicon(cache, 'unknown', now), null);
});

test('icons of removed bookmarks, or ones with their own icon now, are dropped', () => {
  const cache = { x: { kind: 'sharp', t: 1 }, y: { kind: 'native', t: 1 }, z: { kind: 'globe', t: 1 } };
  const list = [{ url: 'x', icon: { type: 'favicon' } }, { url: 'y', icon: { type: 'img', value: 'data:' } }];
  assert.deepEqual(Object.keys(pruneFavicons(cache, list)), ['x']);
});
