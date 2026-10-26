// Headless Chrome over the DevTools protocol, for the scripts that render images from real pages.
// No dependencies: Node 22+ (for the global WebSocket) and an installed Chrome.
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

export const CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
}[process.platform];

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Starts Chrome with a throwaway profile. Returns send(method, params, sessionId), once(event, sessionId) and close().
export async function launch(path = CHROME) {
  const profile = await mkdtemp(join(tmpdir(), 'tabula-chrome-'));
  const chrome = spawn(path, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
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
  const close = async () => {
    ws.close();
    chrome.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };
  return { send, once, close };
}
