# Tabula lab

Design studies and demos behind the extension. This branch is `main` plus this folder: the extension
itself is identical, and nothing here ships in the extension zip.

## Running

From the repository root:

```sh
python3 -m http.server 8765
```

Then open a demo, for example <http://localhost:8765/lab/next/index.html>. Opening the files directly
(`file://`) can block ES modules. `npm test` on this branch runs the lab tests together with the extension's.

## What is here

| Demo | What it is |
|---|---|
| [`next/`](next/) | A standalone copy of the home screen, where the next round is tried before it moves into the extension. It keeps its own storage (`tabula.next.*`) and has its own brand book page. |
| [`home/`](home/) | An alternative home screen study. Its weather widget, captions and ink colours were carried over into the extension. |
| [`daylight.html`](daylight.html), [`daylight/`](daylight/) | "Breathing sky": real solar altitude, an atmospheric sun and a rotating star sphere. Became the extension's default theme. Has tests. |
| [`weather-atmosphere.html`](weather-atmosphere.html), [`weather-atmosphere/`](weather-atmosphere/) | The daylight sky with weather layered on top. Has tests. |
| [`time-of-day.html`](time-of-day.html) | Morning, noon, evening and night effects for the clock and the background. |
| [`clock-effects.html`](clock-effects.html) | Earlier weather effects on the clock digits. |
| [`sky-study/`](sky-study/), [`weather-study/`](weather-study/) | Early sky and weather prototypes. |
