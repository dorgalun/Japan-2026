# Japan 2026 · Trip Journal

A self-contained trip dashboard, rebuilt automatically from a Google Sheet.

**How it works:** the sheet is the source of truth. `build.py` fetches it,
works out categories, times, map coordinates and descriptions, and writes a
single `index.html`. GitHub Actions runs that build and publishes to GitHub Pages.

```
Google Sheet  ──►  build.py  ──►  index.html  ──►  GitHub Pages
                      ▲
        lib/descriptions.py, lib/manual_data.py, data/my_maps_places.json
```

---

## Setup (one time, ~10 minutes)

### 1. Create the repo
Create a new repository on GitHub, then push these files to it.
The repo must be **public** for GitHub Pages to work on a free account.

### 2. Get the sheet's CSV URL
In Google Sheets: **File → Share → Publish to web** → select the itinerary
sheet → format **Comma-separated values (.csv)** → **Publish**.

Copy the URL. It looks like:
```
https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv
```
Do **not** use the normal `/edit#gid=0` address — that returns a web page, not data.

### 3. Add it as a secret
Repo → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `SHEET_CSV_URL`
- Value: the URL from step 2

Optionally add a *variable* (not secret) named `MY_MAPS_MID` with your My Maps
map ID if it ever changes.

### 4. Turn on Pages
Repo → **Settings → Pages → Source: GitHub Actions**

### 5. Run it
Repo → **Actions → Build and deploy trip journal → Run workflow**

Your site will be at `https://<username>.github.io/<repo-name>/`

### 6. Put it on your phone
Open that URL in Safari → Share → **Add to Home Screen**. It then behaves like
an app, and always loads the latest build.

---

## Updating

Edit the Google Sheet, then either wait for the daily rebuild or hit
**Actions → Run workflow** to publish immediately.

### When you add or rename a row

The sheet gives the build the *what* — name, time, links. Three things live in
this repo instead, and are matched to rows **by the activity text**:

| File | Holds |
|---|---|
| `lib/descriptions.py` | the "what is this place" sentence for each stop |
| `lib/manual_data.py` | coordinates for places not found in My Maps, real travel times, Hebrew translations |
| `data/my_maps_places.json` | the 397 places exported from My Maps |

So **if you rename a row, its description stops matching.** The build won't
fail — it prints a warning listing exactly which rows have no description:

```
NOTE: 2 row(s) have no description (new or renamed in the sheet):
  - Dinner - somewhere new
```

You can see that in the Actions log. To fix, add an entry to
`lib/descriptions.py` using the row's exact text as the key.

### Refreshing the My Maps places
If you add pins in My Maps, export again (⋮ → Export to KML/KMZ), unzip, and
regenerate `data/my_maps_places.json`. The map tab itself is a live embed, so
it updates on its own — this file only feeds the small "nearby saved places"
dots on each day's map.

---

## Running locally

```bash
python build.py                      # builds from data/itinerary.csv
SHEET_CSV_URL="https://..." python build.py   # builds from the live sheet
```

Then open `index.html`.

---

## Notes

- `data/itinerary.csv` is refreshed on every successful build, so the site can
  still be rebuilt if the sheet is ever unreachable.
- Times marked `~` in the app are estimates calculated from activity type and
  travel distance. Times written in the sheet are always used as-is.
- Weather comes from Open-Meteo at runtime: live forecast within ~16 days,
  otherwise a 5-year seasonal average for that date.
- Publishing the sheet to the web makes it readable by anyone who has the URL.
  The itinerary includes hotel names and friends' names — worth knowing.
