# Live Site Metrics

Portfolio toolkit for **live** Core Web Vitals and supporting performance metrics, driven by [Playwright](https://playwright.dev/).

Open real pages in Chromium, Firefox, or WebKit, collect LCP / CLS / INP / TTFB / FCP via `PerformanceObserver`, take a median across runs, and emit JSON + HTML reports with Google CWV bands.

No company URLs, credentials, or proprietary page lists are included. Point `BASE_URL` (or `METRICS_URLS`) at any site you are allowed to measure.

## What this showcases

| Capability | Why it matters |
| --- | --- |
| Playwright multi-browser live collection | Real navigations, not synthetic-only Lab scores |
| Honest nulls | Missing observers stay `null` — values are never invented |
| Desktop / mobile profiles | Unthrottled viewports + UA, labeled clearly |
| Median of N runs | Reduces one-off noise before you call a regression |
| Self-contained HTML report | Shareable CWV bands for LCP / CLS / INP (+ TTFB / FCP) |
| Env-driven URL lists | Secrets and real targets stay in `.env` (gitignored) |

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

Optional: copy `config/urls.example.json` → `config/urls.json` and set `URLS_FILE=config/urls.json`.

For a quick absolute-URL smoke without a file:

```env
METRICS_URLS=https://example.com/,https://example.com/about
```

## Run

```bash
# Measure example paths under BASE_URL (median of 3, desktop Chromium)
npm run collect

# Smoke: first URL only, single run
npm run collect -- --limit 1 --runs 1

# Mobile profile + WebKit
npm run collect -- --profile mobile --browser webkit

# Rebuild HTML from an existing JSON result
npm run collect -- --from-json reports/latest.json
```

Outputs (gitignored):

- `reports/latest.json` — machine-readable results + per-run samples
- `reports/latest.html` — team-friendly CWV table
- `history/<timestamp>.json` — local run archive

## Layout

```
src/cli.mjs          CLI entry
src/collector.mjs    Playwright + PerformanceObserver live collector
src/bands.mjs        CWV / supporting metric thresholds
src/report.mjs       JSON + HTML report writers
src/urls.mjs         BASE_URL / METRICS_URLS / urls JSON resolver
src/profiles.mjs     desktop & mobile viewports
config/urls.example.json
.env.example
```

## Design notes

- **Live first.** Collection uses an unthrottled browser session. This is closer to “open the site and feel it” than simulated Lab throttling.
- **INP is optional.** Soft interactions are attempted; if Event Timing never yields an `interactionId`, INP stays `null`.
- **WebKit honesty.** Measuring with Playwright WebKit is the Safari *engine*, not a claim that you ran Safari.app on every OS.
- **Generic demo only.** Config uses `example.com` placeholders — put real URL lists in `.env` / a local urls file (gitignored patterns).

## License

MIT
