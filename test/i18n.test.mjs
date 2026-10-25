// Five languages stay in step: the same keys, the same {placeholders}, and every key the page asks for exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MESSAGES, LANGS, setLang, t } from '../js/i18n.js';

// setLang() also sets <html lang>; give it an element to set.
globalThis.document ??= { documentElement: {} };

const en = MESSAGES.en;
const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('every language listed in the picker has strings', () => {
  assert.deepEqual(Object.keys(MESSAGES).sort(), Object.keys(LANGS).sort());
});

for (const lang of Object.keys(MESSAGES).filter(l => l !== 'en')) {
  test(`${lang} has exactly the English keys`, () => {
    const missing = Object.keys(en).filter(k => !(k in MESSAGES[lang]));
    const extra = Object.keys(MESSAGES[lang]).filter(k => !(k in en));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
  });

  test(`${lang} keeps the same {placeholders}`, () => {
    for (const [k, s] of Object.entries(en)) {
      assert.deepEqual(placeholders(MESSAGES[lang][k]), placeholders(s), `${lang}.${k}`);
    }
  });
}

test('every data-i18n key in the page exists', () => {
  const html = readFileSync(new URL('../newtab.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-ph|-title)?="(\w+)"/g)].map(m => m[1]);
  assert.ok(keys.length > 20);
  for (const k of keys) assert.ok(k in en, `${k} is not translated`);
});

test('t() fills placeholders and falls back to English', () => {
  setLang('ru');
  assert.equal(t('dayOf', { n: 298, y: 365 }), 'День 298 из 365');
  setLang('xx');
  assert.equal(t('dayOf', { n: 1, y: 365 }), 'Day 1 of 365');
});
