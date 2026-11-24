# Live Site Metrics

Collect live Core Web Vitals and related performance metrics with [Playwright](https://playwright.dev/).

Opens real pages in Chromium, Firefox, or WebKit; records LCP / CLS / INP / TTFB / FCP via `PerformanceObserver`; takes a median across runs; writes JSON and HTML reports with Google CWV bands.

Default demo target is `example.com`. Point `BASE_URL` or `METRICS_URLS` at sites you are allowed to measure.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

Edit `.env`:

```env
BASE_URL=https://example.com
```

Optional: copy `config/urls.example.json` → `config/urls.json` (or `config/pages.example.csv` → `config/pages.csv`) and set `URLS_FILE=...`.

Absolute-URL smoke without a file:

```env
METRICS_URLS=https://example.com/,https://example.com/about
```

## Run

```bash
# Measure paths under BASE_URL (median of 3, desktop Chromium)
npm run collect

# Smoke: first URL only, single run
npm run collect -- --limit 1 --runs 1

# iOS profile + WebKit
npm run collect:ios

# Quality gate on latest JSON report
npm run gate

# Run unit tests
npm test

# Rebuild HTML from an existing JSON result
npm run collect -- --from-json reports/latest.json
```

Outputs (gitignored):

- `reports/latest.json` — machine-readable results + per-run samples
- `reports/latest.html` — CWV table
- `history/<timestamp>.json` — local run archive

## Layout

```
src/cli.mjs          CLI entry
src/collector.mjs    Playwright + PerformanceObserver collector
src/bands.mjs        CWV / supporting metric thresholds
src/gate.mjs         CWV quality gate for CI/local checks
src/report.mjs       JSON + HTML report writers
src/urls.mjs         BASE_URL / METRICS_URLS / urls JSON & CSV resolver
src/profiles.mjs     desktop, mobile/android & ios viewports
config/urls.example.json
config/pages.example.csv
.env.example
```

## Notes

- Collection uses an unthrottled browser session (live navigation, not Lab-only throttling).
- Soft interactions are attempted for INP; if Event Timing never yields an `interactionId`, INP stays `null`.
- Playwright WebKit measures the Safari engine, not Safari.app on every OS.
- Missing observers stay `null`; values are never invented.

## License

MIT
