// "Improve bookmark icons" when no site can be read (offline here; Gmail without signing in, in real life).
import test from 'node:test';
import assert from 'node:assert/strict';

// Just enough of a page for discover(): every request fails and pages parse to nothing.
globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
// Node has no localStorage and every request fails here; keep the expected warnings out of the output.
console.debug = console.warn = () => {};
globalThis.DOMParser = class { parseFromString() { return { querySelectorAll: () => [], querySelector: () => null }; } };

const { plainIconCount, improveIcons } = await import('../js/bookmarks.js');

test('sites whose icon cannot be read are named and not offered again', async () => {
  assert.equal(plainIconCount(), 4);
  const result = await improveIcons();
  assert.deepEqual(result, { done: 0, total: 4, failed: ['YouTube', 'GitHub', 'ChatGPT', 'Claude'] });
  assert.equal(plainIconCount(), 0, 'the button has nothing left to offer');
});
