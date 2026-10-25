// Small, dependency-free approximations. Angles at the public boundary are degrees.
// NOAA: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// USNO: https://aa.usno.navy.mil/faq/GAST
export const RAD = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mod = (x, n) => ((x % n) + n) % n;
export const PLACES = [
  { name: 'Белград', lat: 44.82, lon: 20.46, zone: 'Europe/Belgrade' },
  { name: 'Рейкьявик', lat: 64.15, lon: -21.94, zone: 'Atlantic/Reykjavik' },
  { name: 'Тромсё', lat: 69.65, lon: 18.96, zone: 'Europe/Oslo' },
  { name: 'Нью-Йорк', lat: 40.71, lon: -74.01, zone: 'America/New_York' },
  { name: 'Сингапур', lat: 1.35, lon: 103.82, zone: 'Asia/Singapore' },
  { name: 'Кейптаун', lat: -33.92, lon: 18.42, zone: 'Africa/Johannesburg' },
  { name: 'Сидней', lat: -33.87, lon: 151.21, zone: 'Australia/Sydney' },
];
const formatters = new Map();
export function partsAt(ms, zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }));
  return Object.fromEntries(formatters.get(zone).formatToParts(ms).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
export function dateAt(ms, zone) {
  const p = partsAt(ms, zone); return `${p.year}-${p.month}-${p.day}`;
}
export function midnight(date, zone) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let result = target;
  for (let i = 0; i < 4; i++) {
    const p = partsAt(result, zone);
    const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    result += target - local;
  }
  return result;
}
export function dayWindow(date, zone) {
  const next = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const start = midnight(date, zone), end = midnight(next, zone);
  return { start, end, minutes: (end - start) / 60000 };
}
export function solar(ms, { lat, lon }) {
  const date = new Date(ms), year = date.getUTCFullYear();
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const n = (ms - Date.UTC(year, 0, 1)) / 86400000;
  const g = 2 * Math.PI / days * (n - .5);
  const eq = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
  const dec = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const utcMinutes = mod(ms, 86400000) / 60000;
  const hourAngle = (mod(utcMinutes + eq + 4 * lon, 1440) / 4 - 180) * RAD;
  const phi = lat * RAD;
  const up = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle);
  const maxUp = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec);
  return { altitude: Math.asin(clamp(up, -1, 1)) / RAD, hourAngle, up, maxUp };
}
export function events(window, place) {
  let rise = null, set = null, noon = window.start, peak = -90, low = 90;
  let prev = solar(window.start, place).altitude + .833;
  for (let ms = window.start + 300000; ms <= window.end; ms += 300000) {
    const altitude = solar(ms, place).altitude, value = altitude + .833;
    if (altitude > peak) { peak = altitude; noon = ms; }
    low = Math.min(low, altitude);
    if ((prev < 0) !== (value < 0)) {
      let lo = ms - 300000, hi = ms;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if ((solar(mid, place).altitude + .833 < 0) === (prev < 0)) lo = mid; else hi = mid;
      }
      if (prev < 0) rise = (lo + hi) / 2; else set = (lo + hi) / 2;
    }
    prev = value;
  }
  return { rise, set, noon, polar: rise === null && set === null ? (low > -.833 ? 'day' : 'night') : null };
}
export function sidereal(ms, lon) {
  const jd = ms / 86400000 + 2440587.5, jd0 = Math.floor(jd - .5) + .5;
  const d = jd0 - 2451545, h = (jd - jd0) * 24, t = (jd - 2451545) / 36525;
  return mod(6.697375 + .065709824279 * d + 1.0027379 * h + .0000258 * t * t + lon / 15, 24) * 15 * RAD;
}
// East / north / up basis. A single sphere, not independent 2D circular orbits.
export function horizontal(ra, dec, lst, latitude) {
  const h = lst - ra, c = Math.cos(dec), s = Math.sin(dec), p = latitude * RAD;
  return { east: -c * Math.sin(h), north: s * Math.cos(p) - c * Math.cos(h) * Math.sin(p), up: s * Math.sin(p) + c * Math.cos(h) * Math.cos(p) };
}
