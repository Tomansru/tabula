import { RAD, clamp } from './astronomy.js?v=2';

// Rounded J2000 positions (degrees) and V magnitudes, IAU Catalog of Star Names.
// https://iauarchive.eso.org/public/themes/naming_stars/
// Snapshot: https://raw.githubusercontent.com/mirandadam/iau-starnames/master/catalog_data/IAU-CSN.txt
// IAU data: CC BY. Magnitudes are compressed for a quiet background, not photometry.
// Tint is art-directed: 0 neutral, 1 warm, 2 cool. No constellation lines or labels.
export const CATALOG = [
  ['Polaris', 'UMi', 37.9546, 89.2641, 1.97, 0],
  ['Polaris Australis', 'Oct', 317.1952, -88.9565, 5.45, 0],
  // Big Dipper: bowl and handle, not the entire Ursa Major constellation.
  ['Dubhe', 'UMa', 165.9320, 61.7510, 1.81, 1],
  ['Merak', 'UMa', 165.4603, 56.3824, 2.34, 0],
  ['Phecda', 'UMa', 178.4577, 53.6948, 2.41, 0],
  ['Megrez', 'UMa', 183.8565, 57.0326, 3.32, 0],
  ['Alioth', 'UMa', 193.5073, 55.9598, 1.76, 0],
  ['Mizar', 'UMa', 200.9814, 54.9254, 2.23, 0],
  ['Alkaid', 'UMa', 206.8852, 49.3133, 1.85, 2],
  // Orion: shoulders, belt and feet.
  ['Betelgeuse', 'Ori', 88.7929, 7.4071, .45, 1],
  ['Bellatrix', 'Ori', 81.2828, 6.3497, 1.64, 2],
  ['Alnitak', 'Ori', 85.1897, -1.9426, 1.74, 2],
  ['Alnilam', 'Ori', 84.0534, -1.2019, 1.69, 2],
  ['Mintaka', 'Ori', 83.0017, -.2991, 2.25, 2],
  ['Rigel', 'Ori', 78.6345, -8.2016, .18, 2],
  ['Saiph', 'Ori', 86.9391, -9.6696, 2.07, 2],
  // Southern Cross. Sigma Octantis stays faint; no invented bright south pole star.
  ['Acrux', 'Cru', 186.6496, -63.0991, 1.33, 2],
  ['Mimosa', 'Cru', 191.9303, -59.6888, 1.25, 2],
  ['Gacrux', 'Cru', 187.7915, -57.1132, 1.59, 1],
  ['Imai', 'Cru', 183.7863, -58.7489, 2.75, 2],
].map(([name, group, ra, dec, magnitude, tint], index) => ({
  name, group, ra: ra * RAD, dec: dec * RAD, magnitude, tint,
  // Small stylistic emphasis: Polaris is ~10% brighter than our brightest catalog star.
  brightness: name === 'Polaris' ? 1.06 : name === 'Polaris Australis' ? .4 : clamp(1 - magnitude * .11, .5, .96),
  phase: index * 2.39996,
}));

export function createStars() {
  let seed = 7391;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const cosGap = Math.cos(.8 * RAD);
  const background = Array.from({ length: 1900 }, () => ({
    ra: random() * Math.PI * 2, dec: Math.asin(random() * 2 - 1),
    brightness: .15 + .65 * random() ** 4, tint: Math.floor(random() * 3), phase: random() * 6.28,
  })).filter(star => !CATALOG.some(real =>
    Math.sin(star.dec) * Math.sin(real.dec) + Math.cos(star.dec) * Math.cos(real.dec) * Math.cos(star.ra - real.ra) > cosGap));
  // The tiny exclusion radius avoids accidental doubles on catalog stars. Done once.
  return background.concat(CATALOG);
}
