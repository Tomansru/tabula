// Bakes the clouds' noise texture into js/themes/daylight/weather/noise-data.js, so a new tab decodes it
// instead of computing it. Run after changing the recipe in noise.js:
//
//   node scripts/noise.mjs
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOISE_SIZE, bakeNoise } from '../js/themes/daylight/weather/noise.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const noiseModule = () =>
  '// Baked by scripts/noise.mjs from noise.js: RGBA bytes, NOISE_SIZE × NOISE_SIZE, base64. Do not edit.\n' +
  `export const NOISE = '${Buffer.from(bakeNoise(NOISE_SIZE)).toString('base64')}';\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(root, 'js/themes/daylight/weather/noise-data.js');
  await writeFile(out, noiseModule());
  console.log(out);
}
