# Privacy policy

*Tabula, a new tab page for Chrome. Last updated: October 25, 2026.*

Tabula does not collect, sell or share personal data. It has no accounts, no analytics, no ads and no trackers, and the developer receives nothing from your browser.

## What stays in your browser

Everything you enter is stored locally in your browser: settings, bookmarks, tasks and their history, the last weather forecast, and a background image if you upload one. This data is never sent to the developer. Removing the extension deletes it. You can export it to a JSON file and import it again from Settings → Data.

## What leaves your browser, and why

Tabula only makes the requests below, and only when the feature needs them. All of them are sent without cookies.

| When | To | What is sent |
| --- | --- | --- |
| Showing the weather, at most every 20 minutes | Open-Meteo (`api.open-meteo.com`) | The coordinates of the place you chose, rounded to 0.01° (about 1 km), and your units |
| Searching for a city in Settings | Open-Meteo (`geocoding-api.open-meteo.com`) | The text you type and your language |
| Clicking "Use my location", once | OpenStreetMap Nominatim (`nominatim.openstreetmap.org`) | Your coordinates rounded to 0.01°, to turn them into a city name |
| Adding a bookmark with an automatic icon | The bookmarked site itself | A request for that site's page and icon |
| Searching from the search bar | The search engine you chose (Google by default) | Your search, as a normal visit to that engine |

Your precise location is never stored or sent. Your browser asks for permission before "Use my location" can read it, and Tabula rounds it to about 1 km before saving it.

These services have their own privacy policies:
- [Open-Meteo](https://open-meteo.com/en/terms)
- [OpenStreetMap Foundation](https://osmfoundation.org/wiki/Privacy_Policy)

## Permissions

- **`favicon`**: shows a site's icon from Chrome's own cache when the site's own icon cannot be fetched.
- **`search`**: searches with your default search engine when you pick "Chrome default" as the search engine.
- **`unlimitedStorage`**: keeps a large background image in local storage.
- **Optional access to a single site**: requested only when you add a bookmark with an automatic icon, to download that site's icon. The access is given back as soon as the icon is saved.

## Contact

Questions and requests: open an issue in this repository.
