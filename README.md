# gha-view-enhancer

A Chrome extension (Manifest V3) that adds a filter toolbar to GitHub Actions
**run summary** pages, letting you hide/show matrix job rows by status so large
matrices (e.g. 4 × 40 = 160 jobs) are easier to read.

## Features

- **Filter by status**: Success, Failure, Skipped, Cancelled, In progress — all visible by default.
- **"Only failures"** shortcut button — instantly shows only failed jobs.
- **"Show all"** reset button — restores full visibility.
- Selections are persisted via `chrome.storage.local` and survive SPA navigations.
- Uses a `MutationObserver` to re-apply filters as matrix rows are lazily loaded.
- Toolbar adapts to GitHub's light and dark themes.
- Works on **github.com and GitHub Enterprise Server** (any hostname).

## Installation (unpacked / developer mode)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the root folder of this repository
   (the directory that contains `manifest.json`).
5. Navigate to any GitHub Actions run summary page on **github.com or your
   GitHub Enterprise instance** (e.g. `https://github.xyz.de/<owner>/<repo>/actions/runs/<run_id>`).
6. The filter toolbar will appear at the top of the jobs list.

## Usage

- **Check / uncheck** a status checkbox to show or hide jobs with that status.
- Click **Only failures** to uncheck everything except "Failure".
- Click **Show all** to restore all statuses.

## CI / Build (local)

Requires Node.js ≥ 18.

```bash
npm install           # install dev dependencies (ESLint)
npm run lint          # lint src/ with ESLint
npm run validate-manifest  # verify manifest.json is valid MV3
npm run package       # creates gha-view-enhancer.zip
```

The GitHub Actions workflow (`.github/workflows/build.yml`) runs these steps
automatically on every push and pull request to `main`, and uploads
`gha-view-enhancer.zip` as a workflow artifact.

## ⚠️ Status detection & maintenance note

GitHub's DOM markup is **not a public API** and changes without notice.
Status detection relies on `aria-label` attributes, SVG icon titles, and
visible text — all of which GitHub may update at any time.

If the filter stops working after a GitHub UI change, open
[`src/statusDetector.js`](src/statusDetector.js) — all selector and
string-matching logic is centralised there with comments explaining what to
look for and how to update it.

## File structure

```
manifest.json          # MV3 extension manifest
src/
  statusDetector.js    # centralised status-detection / selector logic ⚠️
  filter.js            # apply/reset filtering over job rows
  toolbar.js           # builds & injects the filter UI, wires events
  content.js           # entry: sets up MutationObserver, handles SPA nav
styles.css             # toolbar + hidden-row styling (light/dark aware)
icons/                 # placeholder extension icons (16/48/128 px)
scripts/
  validate-manifest.js # Node script used by CI to validate manifest.json
  package.js           # Node script to zip distributable files
.github/workflows/
  build.yml            # CI: validate → lint → package → upload artifact
```
