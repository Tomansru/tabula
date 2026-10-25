// Background themes. Each theme is a module with the same shape:
//
//   id          unique id, stored in settings.theme
//   name        i18n key of its title
//   defaults    its own settings (stored in settings.themes[id], merged over these)
//   preview(el, cfg)            fill the card's thumbnail element (a static snapshot)
//   controls(el, cfg, update)   optional: render its own settings into el; update(patch) saves them
//   activate(stage, cfg)        start: add its layers to #stage, start any animation
//   update(cfg, reason)         optional: settings, light/dark mode, weather or location changed
//   deactivate()                stop and remove everything it added
//   ownsMode, isDark()          optional: the theme decides light/dark itself (the Mode setting is then locked)
//
// Adding a theme = a new file next to this one + one line in THEMES.
import { settings as S, setSetting } from '../store.js?v=2';
import sky from './sky.js?v=2';
import picture from './picture.js?v=2';
import daylight from './daylight/index.js?v=2';

export const THEMES = [sky, daylight, picture];

export const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];
export const activeTheme = () => active;
export const themeConfig = theme => ({ ...theme.defaults, ...(S.themes?.[theme.id] || {}) });

let active = null;
const stage = () => document.getElementById('stage');

export function startThemes() {
  switchTheme(S.theme);
}

export function switchTheme(id) {
  const next = themeById(id);
  if (active === next) return;
  active?.deactivate();
  stage().replaceChildren();
  active = next;
  active.activate(stage(), themeConfig(active));
}

// Save part of a theme's own settings and let it react if it is the active one.
export function updateThemeConfig(theme, patch) {
  const themes = { ...(S.themes || {}), [theme.id]: { ...(S.themes?.[theme.id] || {}), ...patch } };
  setSetting({ themes });
  if (active === theme) active.update?.(themeConfig(theme), 'config');
}

// Something outside changed (light/dark mode, weather, location): the active theme may redraw.
export function notifyThemes(reason) {
  active?.update?.(themeConfig(active), reason);
}
