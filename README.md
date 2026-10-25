# Tabula

A calm, fast new tab page for Chrome. No frameworks, no build step, no trackers.

The screen is a frame of three columns: weather on the left, the clock in the centre and today's tasks on the
right, all starting on one top line. Small captions sit in the corners: a phrase that changes at random (top left),
the day of the year (top right) and how far the day has got (bottom right: the share left until sunset, the share passed after it). The settings button has the bottom-left corner.
Spacing, corners, type and colour follow a small brand book: [`docs/brand.html`](docs/brand.html), with the values in `css/tokens.css`.

- **Themes** for the background, picked from cards with a live preview in Settings. Each theme keeps its own settings.
  - **Sky**: a sky that follows the time of day. The sun rises from the horizon (the search bar) on one side, crosses over the clock and sets on the other, using today's real sunrise and sunset from the forecast (06:30–18:30 without a location). Twilight comes in stages: night, blue hour, a dawn band on the horizon, then the sun. At night stars turn slowly around the celestial pole, whose height follows your latitude (Polaris in the north).
- **Mode**: Auto (system) / Light / Dark / Sun — the last one is light by day and dark at night, fading between them at dusk and dawn.
- **Search bar** with Google by default; DuckDuckGo, Bing, Yandex, Ecosia, Startpage or Chrome's default engine can be chosen in Settings. Addresses open directly.
- **Date with ISO week number** under the clock.
- **Weather** from [Open-Meteo](https://open-meteo.com) (no API key, no cookies) for a city you search, or your current location (rounded to ~1 km). The widget on the left shows the weather now and today's sunrise and sunset. Clicking it opens the forecast: the rest of the day hour by hour, the sun's path across the day, humidity, wind, pressure, UV, precipitation and cloud cover.
- **Look**: *Airy* (thin digits, small uppercase captions) or *Classic* typography, captions on or off, optional cards behind the weather and task widgets.
- **Bookmarks** with crisp site icons: on save the extension briefly asks for access to that one site, reads its `apple-touch-icon` / web-manifest / SVG icons, stores the best one as a 128 px image and immediately gives the access back. You can also use an emoji or a coloured letter. Drag tiles to reorder; drop a link from the address bar onto the grid to add it.
- **Daily TODOs** on the right (can be hidden). Every day starts with a fresh *Today* list. History collapses by age: days of the current week → weeks of the current month → months of the current year → years. Empty days are not shown. Unfinished items from the past can be moved to today in one click. Double-click to edit.
  - **Breathing sky** (grown from the daylight study in the [`lab` branch](https://github.com/Tomansru/tabula/tree/lab)): an atmosphere painted from the real solar altitude for your location and season (NOAA formulas), a soft or atmospheric sun disc, and at night a star sphere with real catalogue stars (Polaris, the Big Dipper, Orion, the Southern Cross) turning with local sidereal time. Its own settings: sun style, disc sharpness, light strength, horizon height, starry sky location, looking direction, starlight. It sets light/dark by itself.
  - **Your picture**: any image (upload or URL) with *Dim* and *Blur* sliders so text stays readable; no animation.
- **Languages**: English, Русский, Deutsch, Español, Français.
- **Export / import** of settings, bookmarks and TODOs as JSON.

Defaults for a new install: the *Breathing sky* theme with the atmospheric sun, the *Sun* mode, Google search, bookmarks open in a new tab, *Airy* type, captions on, widget cards off, weather and tasks shown.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. **Load unpacked** → choose this folder.
4. Open a new tab.

On first run you get YouTube, GitHub, ChatGPT and Claude bookmarks and one sample TODO for today. No site logos are bundled: the bookmarks start with the icons Chrome already has cached (a coloured letter for sites you have never visited), and *Settings → Improve bookmark icons* fetches each site's own sharp icon in one click.

Chrome (138+) adds its own footer with a "Customize Chrome" button to any extension-provided new tab. Extensions can't remove it, but you can: right-click the footer → *Hide footer*, or Customize Chrome → *Footer* → turn off *Show footer on New Tab page*.

## Privacy

Everything lives in the browser (`localStorage`, the background image in IndexedDB). Network requests:

(The full policy, also used for the Chrome Web Store listing, is in [PRIVACY.md](PRIVACY.md).)

| When | Where | What is sent |
| --- | --- | --- |
| Weather refresh (≤ every 20 min) | `api.open-meteo.com` | coordinates rounded to 0.01° |
| Searching a city | `geocoding-api.open-meteo.com` | the search text |
| "Use my location" | `nominatim.openstreetmap.org` | rounded coordinates, once |
| Adding a bookmark icon | the bookmarked site itself | a cookieless request for its page and icon |

Permissions: `favicon` (Chrome's own icon cache as a fallback), `search` (search with your default engine), `unlimitedStorage` (large background images), optional per-site host access (only while fetching an icon).

Weather effects on the clock are switched off for now; they will return redesigned together with the sky.

Design studies and demos are kept out of `main`. The day/night sky, clock effects, weather studies and `lab/next`, where the next round of the home screen is tried first, live in the [`lab` branch](https://github.com/Tomansru/tabula/tree/lab).

## Development

Plain ES modules, nothing to build. To preview outside the extension:

```bash
python3 -m http.server 8765
```

then open <http://localhost:8765/newtab.html> (extension-only features such as icon permissions fall back gracefully).

```
manifest.json      MV3 manifest, overrides the new tab
newtab.html        markup + dialogs
css/tokens.css     brand-book tokens: space, corners, type, frame, motion, typography presets
css/style.css      light/dark colours, layout and components
js/boot.js         sync pre-paint: light/dark, typography, captions, background
js/app.js          clock, date, wiring
js/captions.js     corner captions
js/weather.js      Open-Meteo, the weather widget, sunrise/sunset schedule
js/weatherModal.js the forecast window
js/sunArc.js       the day's sun path in the forecast window
js/sun.js          sun position from sunrise/sunset, "sun" theme rule
js/themes/         background themes: index.js (registry), sky.js, picture.js, daylight/ (astronomy, stars, painter)
js/todos.js        daily list and collapsing history
js/bookmarks.js    tiles, drag & drop, high-res icon discovery
js/settings.js     settings drawer, export/import
js/i18n.js         translations
docs/brand.html    the brand book, reading live values from css/tokens.css
test/              node:test checks: package and manifest, translations, pure logic
scripts/pack.sh    builds dist/tabula-<version>.zip with only the extension's files
store/             Chrome Web Store listing: texts in five languages, privacy answers, screenshots and promo tiles
```

### Tests and packaging

Node 22 or newer, no dependencies to install:

```bash
npm test          # package integrity, the same keys in all five languages, dates, sun, settings, bookmarks
npm run pack      # dist/tabula-<version>.zip, the file uploaded to the Chrome Web Store
```

GitHub Actions (`.github/workflows/ci.yml`) runs a syntax check, the tests and the packaging on every push and pull request,
and keeps the zip as a build artifact.

### Releasing

1. Raise `version` in `manifest.json`.
2. Push a tag with the same version: `git tag v1.0.1 && git push origin v1.0.1`.
3. CI checks that the tag matches the manifest, then creates a GitHub release with the zip attached.
4. Upload that zip in the Chrome Web Store dashboard (see [store/README.md](store/README.md)).

### Adding a theme

Create `js/themes/<name>.js` exporting an object with `id`, `name` (an i18n key), `defaults`, `preview(el, cfg)`, `activate(stage, cfg)` and `deactivate()`; optionally `controls(el, cfg, update)` for its own settings and `update(cfg, reason)`. Add it to `THEMES` in `js/themes/index.js` and its name to `js/i18n.js`. The settings list, storage and switching pick it up automatically.

## License

[MIT](LICENSE)
