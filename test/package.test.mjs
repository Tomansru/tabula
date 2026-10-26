// The extension as Chrome loads it: the manifest, its translations and every file the page pulls in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const exists = p => existsSync(join(root, p));
const manifest = json('manifest.json');

const walk = dir => readdirSync(join(root, dir)).flatMap(name => {
  const p = join(dir, name);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

test('manifest is MV3 with a semver version and a new tab page', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(exists(manifest.chrome_url_overrides.newtab), 'newtab page is missing');
  for (const icon of Object.values(manifest.icons)) assert.ok(exists(icon), `icon ${icon} is missing`);
});

test('every locale is valid JSON with the name and a store-sized description', () => {
  const locales = readdirSync(join(root, '_locales'));
  assert.ok(locales.includes(manifest.default_locale));
  const keys = [manifest.name, manifest.description].map(s => s.match(/^__MSG_(\w+)__$/)[1]);
  for (const l of locales) {
    const m = json(`_locales/${l}/messages.json`);
    for (const k of keys) assert.ok(m[k]?.message, `${l}: ${k} is missing`);
    // Chrome rejects a manifest description longer than 132 characters.
    assert.ok(m.extDescription.message.length <= 132, `${l}: description is too long`);
  }
});

test('every script and stylesheet the page loads exists', () => {
  const html = read(manifest.chrome_url_overrides.newtab);
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 4);
  for (const ref of refs) assert.ok(exists(ref), `${ref} is missing`);
});

test('every relative import between modules resolves', () => {
  for (const file of walk('js').filter(f => f.endsWith('.js'))) {
    for (const [, spec] of read(file).matchAll(/^\s*import\s[^'"]*['"](\.[^'"]+)['"]/gm)) {
      const target = relative(root, join(root, dirname(file), spec));
      assert.ok(exists(target), `${file} imports ${spec}, which does not exist`);
    }
  }
});

test('icons match the manifest sizes and the drawing script', async () => {
  const { iconSvg } = await import('../scripts/icons.mjs');
  for (const [size, file] of Object.entries(manifest.icons)) {
    const png = readFileSync(join(root, file));
    assert.equal(png.toString('ascii', 1, 4), 'PNG', `${file} is not a PNG`);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [+size, +size], `${file} is not ${size}×${size}`);
  }
  assert.equal(read('docs/icon/tabula.svg'), iconSvg(128), 'docs/icon/tabula.svg is out of date: run node scripts/icons.mjs');
  assert.equal(read('docs/icon/tabula-mark.svg'), iconSvg(128, { crop: true }), 'docs/icon/tabula-mark.svg is out of date: run node scripts/icons.mjs');
});
