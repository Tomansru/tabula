# Privacy practices

Answers for the **Privacy practices** tab of the Chrome Web Store dashboard, checked against the code
(`js/weather.js`, `js/settings.js`, `js/bookmarks.js`, `js/search.js`). Paste them as they are.

## Single purpose

```
Tabula replaces Chrome's new tab page with a personal home screen: a clock and date, the local weather, bookmarks and a daily task list, over a background that follows the time of day.
```

## Permission justifications

**favicon**

```
Shows a bookmark's site icon from Chrome's own icon cache, with no network request. This is the default for bookmarks until the user asks for a sharper icon.
```

**search**

```
Runs a search from the search bar with the user's default Chrome search engine, when "Chrome default" is chosen as the search engine in Settings.
```

**unlimitedStorage**

```
Keeps a background image the user uploads for the "Your picture" theme in local IndexedDB storage. These images can exceed the default storage quota.
```

**Host permissions** (optional, `https://*/*` and `http://*/*`)

```
Requested at runtime, only for the one site the user acts on: when they add a bookmark with an automatic icon, or press "Improve bookmark icons" (which asks for exactly the sites in their bookmarks). The extension reads that site's page and icon to save a sharp, local copy of the icon, then removes the access immediately. No access is requested at install time and none is kept.
```

## Remote code

**Are you using remote code?** No.

All JavaScript is inside the package. The extension only fetches data (JSON from the weather service, images for bookmark icons) and never code.

## Data usage

**What user data do you plan to collect from users now or in the future?** Tick only:

- [x] **Location**: when the user sets a city or presses "Use my location", the coordinates, rounded to about 1 km, are sent to Open-Meteo (`api.open-meteo.com`) to get the weather. "Use my location" also sends them once to OpenStreetMap Nominatim (`nominatim.openstreetmap.org`) to find the city's name. The precise position is never stored or sent.

Leave everything else unticked: personally identifiable information, health, financial and payment information, authentication information, personal communications, web history, user activity and website content. Settings, bookmarks and tasks stay in the browser and are never sent to the developer or anyone else.

**Certify all three statements:**

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

```
https://github.com/Tomansru/tabula/blob/main/PRIVACY.md
```

## Notes for the reviewer (optional field on the Distribution or Submit step)

```
No account or login is needed. Open a new tab after installing. To see the weather, open Settings (bottom-left button) → Weather → search for any city. To see the only optional permission request, open Settings → General → "Improve bookmark icons": Chrome will ask for access to the bookmarked sites, and the extension gives the access back right after saving the icons.
```
