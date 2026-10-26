# Chrome Web Store

Everything the store listing needs. Nothing in this folder goes into the extension zip.

| File | For |
|---|---|
| [`listing.md`](listing.md) | **Store listing** tab: category, links, and the description in five languages |
| [`privacy-practices.md`](privacy-practices.md) | **Privacy practices** tab: single purpose, permission justifications, data usage, privacy policy URL |
| `screenshots/*.jpg` | Five screenshots, 1280×800 |
| `promo/small-tile-440x280.jpg` | Small promo tile |
| `promo/marquee-1400x560.jpg` | Marquee promo tile (optional) |
| `icons/icon128.png` (in the zip) | Store icon: drawn by `scripts/icons.mjs`, the art inside Chrome's 96 px safe area |
| [`capture.mjs`](capture.mjs), [`promo.html`](promo.html) | Regenerate the images |

## Submitting a version

1. Download `tabula-<version>.zip` from the GitHub release for the tag.
2. In the [developer dashboard](https://chrome.google.com/webstore/devconsole): **New item** for the first version, or **Package → Upload new package** later.
3. **Store listing**: fill it from `listing.md` and upload the images. Add the four other languages under *Localized listings*.
4. **Privacy practices**: paste from `privacy-practices.md`.
5. **Distribution**: free, public, all regions.
6. **Submit for review**.

## Regenerating the images

The screenshots are taken from the real page with demo data. The data uses generic bookmarks, so no third-party logos appear. The clock is frozen at chosen moments of 20 May 2026 in Belgrade.

```bash
node store/capture.mjs
```

The promo tiles show the icon from `docs/icon/tabula.svg`; after changing it, run `node scripts/icons.mjs` first.

The script needs Node 22+ and Google Chrome. To use another Chrome, pass its path as the first argument. It serves the repository itself on a free local port and runs Chrome headless with a throwaway profile. Edit `SHOTS` in the script to change the times, the data or what is open on screen.
