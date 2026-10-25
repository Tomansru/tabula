// Takes the Chrome Web Store screenshots (1280×800) and promo images from the real page, with demo data.
//
//   node store/capture.mjs [path-to-chrome]
//
// Serves the repository on a local port, starts Chrome headless with an empty profile, freezes the clock at a
// chosen moment in Belgrade, seeds settings, weather, tasks and bookmarks, and saves JPEGs (the store wants no alpha).
// No dependencies: Node 22+ (for the global WebSocket) and an installed Chrome.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'store');
const CHROME = process.argv[2] || {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
}[process.platform];

/* ---------- demo data ---------- */

const ZONE = 'Europe/Belgrade';
const DAY = '2026-05-20'; // a Wednesday in late spring: sunrise 04:58, sunset 20:12
const SR = 4 + 58 / 60, SS = 20 + 12 / 60;
const at = hhmm => Date.parse(`${DAY}T${hhmm}:00+02:00`); // CEST
const pad = n => String(n).padStart(2, '0');
const day = offset => { const d = new Date(Date.parse(DAY + 'T12:00:00Z') + offset * 864e5); return d.toISOString().slice(0, 10); };

const settings = {
  lang: 'en', mode: 'sun', theme: 'daylight', themes: {}, h24: false, seconds: false,
  showWeather: true, units: 'c', showTodos: true, todoCard: false, typeset: 'air', captions: true,
  bmNewTab: true, showSearch: true, searchEngine: 'google',
  location: { name: 'Belgrade', lat: 44.82, lon: 20.46 },
};

// Generic bookmarks: emoji and letters, no third-party logos.
const bookmarks = [
  ['https://mail.example.com/', 'Mail', '📬'], ['https://calendar.example.com/', 'Calendar', '📅'],
  ['https://music.example.com/', 'Music', '🎵'], ['https://maps.example.com/', 'Maps', '🗺️'],
  ['https://notes.example.com/', 'Notes', null],
].map(([url, title, emoji], i) => ({ id: 'b' + i, url, title, icon: emoji ? { type: 'emoji', value: emoji } : { type: 'letter' } }));

const todo = (text, date, done = false) => ({ id: Math.random().toString(36).slice(2), text, done, date, ts: Date.parse(date + 'T09:00:00Z') });
const todos = [
  todo('Book train tickets to Vienna', DAY), todo('Call Anna about the weekend', DAY, true),
  todo('Water the plants', DAY), todo('Finish the quarterly review', DAY),
  todo('Pick up the parcel', day(-1), true), todo('Renew the gym card', day(-1)),
  todo('Send the invoice', day(-2), true),
  todo('Plan the summer trip', day(-14), true), todo('Back up the photos', day(-15), true),
  todo('Fix the bike light', day(-40), true),
];

// A mild spring day, consistent with the frozen clock: hour by hour for today and tomorrow.
const tempAt = h => Math.round(15 + 9 * Math.sin(((h - 9) / 24) * 2 * Math.PI));
const codeAt = h => (h >= 13 && h <= 16 ? 2 : h >= 21 || h < 6 ? 0 : 1);
function weather(ms) {
  const local = new Date(ms + 2 * 36e5).toISOString().slice(0, 16); // CEST wall clock
  const h = +local.slice(11, 13) + +local.slice(14, 16) / 60;
  const hourly = [];
  for (const d of [DAY, day(1)]) for (let i = 0; i < 24; i++) {
    hourly.push([`${d}T${pad(i)}:00`, tempAt(i), codeAt(i), i >= SR && i < SS, i >= 15 && i <= 18 && d === DAY ? 20 : 0]);
  }
  return {
    ts: ms, lat: 44.82, lon: 20.46, units: 'c',
    temp: tempAt(h), feels: tempAt(h) - 1, code: codeAt(Math.floor(h)), isDay: h >= SR && h < SS,
    max: 24, min: 9, sr: SR, ss: SS, now: local,
    humidity: 52, wind: 3, windDir: 300, gusts: 6, pressure: 1016, cloud: 25,
    uvMax: 7, precipSum: 0.4, daylight: (SS - SR) * 3600, hourly,
  };
}

// Runs before the page's own scripts: a frozen clock, a fixed random sequence, the demo data.
function preload(ms, extra = {}) {
  const seed = { settings: { ...settings, ...extra }, bookmarks, todos, weather: weather(ms), todoOpen: { ['d:' + day(-1)]: true } };
  return `(() => {
    const D = Date, offset = ${ms} - D.now();
    function FakeDate(...a) {
      if (!new.target) return new D(D.now() + offset).toString();
      return Reflect.construct(D, a.length ? a : [D.now() + offset], new.target);
    }
    FakeDate.prototype = D.prototype;
    Object.setPrototypeOf(FakeDate, D);
    FakeDate.now = () => D.now() + offset;
    window.Date = FakeDate;
    let s = 7;
    Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const data = ${JSON.stringify(seed)};
    for (const [k, v] of Object.entries(data)) localStorage.setItem('tabula.' + k, JSON.stringify(v));
  })();`;
}

const SHOTS = [
  { file: 'screenshots/1-morning.jpg', time: '10:40' },
  { file: 'screenshots/2-night.jpg', time: '23:20' },
  // Opened by a script rather than a click, the dialog would show a keyboard focus ring on its close button.
  { file: 'screenshots/3-weather.jpg', time: '15:20', run: `document.querySelector('#weather').click(); document.activeElement.blur()` },
  { file: 'screenshots/4-themes.jpg', time: '19:35', run: `document.querySelector('#openSettings').click();
      document.querySelectorAll('#sMain > section')[4].scrollIntoView({ block: 'start' })` },
  { file: 'screenshots/5-evening-cards.jpg', time: '20:30', extra: { todoCard: true } },
];
const PROMOS = [
  { file: 'promo/small-tile-440x280.jpg', w: 440, h: 280 },
  { file: 'promo/marquee-1400x560.jpg', w: 1400, h: 560 },
];

/* ---------- a static server for the repository ---------- */

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(root)) throw new Error('outside');
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

/* ---------- Chrome over the DevTools protocol ---------- */

const profile = await mkdtemp(join(tmpdir(), 'tabula-capture-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank']);
const wsUrl = await new Promise((resolve, reject) => {
  let log = '';
  chrome.stderr.on('data', d => { log += d; const m = log.match(/ws:\/\/\S+/); if (m) resolve(m[0]); });
  chrome.on('exit', code => reject(new Error(`Chrome exited (${code}):\n${log}`)));
});
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map(), listeners = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  else listeners.forEach(fn => fn(m));
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const once = (method, sessionId) => new Promise(r => {
  const fn = m => { if (m.method === method && m.sessionId === sessionId) { listeners.splice(listeners.indexOf(fn), 1); r(m.params); } };
  listeners.push(fn);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function capture({ url, w, h, script, run, file, settle = 1800 }) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await s('Emulation.setTimezoneOverride', { timezoneId: ZONE });
  await s('Emulation.setLocaleOverride', { locale: 'en-US' });
  if (script) await s('Page.addScriptToEvaluateOnNewDocument', { source: script });
  const loaded = once('Page.loadEventFired', sessionId);
  await s('Page.navigate', { url });
  await loaded;
  await sleep(settle);
  if (run) { await s('Runtime.evaluate', { expression: run }); await sleep(900); }
  const { data } = await s('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  await mkdir(dirname(join(out, file)), { recursive: true });
  await writeFile(join(out, file), Buffer.from(data, 'base64'));
  await send('Target.closeTarget', { targetId });
  console.log('saved', file);
}

try {
  for (const shot of SHOTS) {
    await capture({ url: `${base}/newtab.html`, w: 1280, h: 800, script: preload(at(shot.time), shot.extra), run: shot.run, file: shot.file });
  }
  for (const p of PROMOS) {
    await capture({ url: `${base}/store/promo.html?w=${p.w}&h=${p.h}`, w: p.w, h: p.h, file: p.file, settle: 800 });
  }
} finally {
  ws.close();
  chrome.kill();
  server.close();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
