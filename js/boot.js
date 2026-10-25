// Runs synchronously in <head>: applies light/dark mode and the picture theme's look before first paint.
(() => {
  try {
    const r = document.documentElement;
    const s = JSON.parse(localStorage.getItem('tabula.settings') || '{}');
    // Older settings kept light/dark in `theme` and the picture in bg* keys (see migrateSettings in store.js).
    const legacy = ['auto', 'light', 'dark', 'sun'].includes(s.theme);
    const mode = s.mode || (legacy ? s.theme : 'sun');
    const pic = (s.themes && s.themes.picture)
      || (s.bgType ? { src: s.bgType, url: s.bgUrl, dim: s.bgDim, blur: s.bgBlur } : {});
    const theme = legacy ? (s.bgType === 'file' || (s.bgType === 'url' && s.bgUrl) ? 'picture' : 'sky') : (s.theme || 'daylight');

    const w = JSON.parse(localStorage.getItem('tabula.weather') || 'null');
    let dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (mode === 'sun') {
      // Same rule as js/sun.js: dark once the sun is a little below the horizon.
      const sr = w && w.sr != null ? w.sr : 6.5, ss = w && w.ss != null ? w.ss : 18.5;
      const n = new Date(), h = n.getHours() + n.getMinutes() / 60;
      const d = h >= sr && h <= ss ? (h - sr) / (ss - sr) : 1 + ((h - ss + 24) % 24) / (24 - (ss - sr));
      dark = Math.sin(Math.PI * d) < -0.055;
    }
    // The daylight theme sets light/dark from the sun; until it runs, keep what it said last time.
    const ink = JSON.parse(localStorage.getItem('tabula.ink') || 'null');
    if (theme === 'daylight' && ink) dark = ink === 'dark';
    r.dataset.theme = dark ? 'dark' : 'light';
    if (s.lang) r.lang = s.lang;
    if (s.todoCard) r.classList.add('todo-card');
    if (s.showTodos === false) r.classList.add('no-todos');
    r.dataset.type = s.typeset || 'air';
    if (s.captions === false) r.classList.add('no-caps');
    if (theme === 'picture' && (pic.src === 'file' || (pic.src === 'url' && pic.url))) r.classList.add('has-bg');
    r.style.setProperty('--dim', (pic.dim ?? 35) / 100);
    r.style.setProperty('--blur', (pic.blur ?? 0) + 'px');
  } catch {}
})();
