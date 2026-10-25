# Tabula · next

A standalone copy of the home screen for the next round of design work, with the good parts of
`lab/home` brought over. Every change is made here first; the main extension in the repository root stays as it is.

## Running it

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

- Screen: http://127.0.0.1:8765/lab/next/index.html
- Brand book: http://127.0.0.1:8765/lab/next/brand.html

The folder also has its own `manifest.json`, so it can be loaded as a separate unpacked extension.

## Isolation

- localStorage: only `tabula.next.*`.
- IndexedDB: the `tabula-next` database.
- On the first run the demo copies settings, tasks, bookmarks and weather from the main screen's `tabula.*` keys
  on the same origin. After that it never reads or writes them again.

## What changed compared to the main screen

| Area | What | Files |
|---|---|---|
| Frame | Captions in three corners. Top left: one of the phrases ("Your time. Your pace." / "One small step is enough to begin."), chosen at random and changing every 15 minutes with a fade. Top right: the day of the year. Bottom right: how much of the day is left. Bottom left: the settings button. | `index.html`, `js/captions.js`, `css/style.css` (frame & layout) |
| Composition | Three columns of equal width: weather, clock, tasks. No captions above the columns: the weather card, the clock and the task card all start on `--top`. | `css/style.css` (frame & layout) |
| Weather | The widget moved to the left column. It is the same card as the tasks: an "Outside your window" head in the "Today" style with high/low where the count is, then the weather now, then sunrise and sunset as one line with no arc. | `js/weather.js` |
| Weather window | Twice as wide, with the summary and the arc side by side and no box behind the arc. The horizon line cuts the arc off. A failed update offers "Try again" (from `lab/home`). | `js/weatherModal.js`, `js/sunArc.js` |
| Clock and date | Nothing above the clock. The date sits `--s-5` below it, the week is set off by a hairline, not a pill, and HH:MM is centred optically. | `css/tokens.css`, `css/style.css` |
| Typography | "Airy" preset (thin digits, uppercase micro captions) and "Classic". Settings → Look. | `css/tokens.css` |
| Captions | One switch hides every caption without shifting the grid. | Settings → Look |
| Cards | "Cards behind widgets" now applies to both weather and tasks. | |
| Ink | Three text levels tuned for the sky, a warm accent and `--halo` under small text (from `lab/home`). | `css/style.css`, `css/tokens.css` |
| Settings | Floating panel with section chips (from `lab/home`). | `index.html`, `js/settings.js` |
| Brand book | Tokens for spacing, corners, type, motion and the frame, with rules, plus a page that reads live values from them. | `css/tokens.css`, `brand.html` |

New settings: `typeset`, `captions` and `showTodos`. Defaults: the Breathing sky theme with the atmospheric sun, the Sun mode, Google, bookmarks in a new tab, Airy type, captions on, cards off, weather and tasks shown.

All of this has been moved into the main screen. Anything new is tried here first, then carried over.
