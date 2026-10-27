#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { collectLive } from "./collector.mjs";
import { loadTargets } from "./urls.mjs";
import { writeHtml, writeJson } from "./report.mjs";
import { annotateBands } from "./bands.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

loadEnv({ path: resolve(ROOT, ".env") });

function parseArgs(argv) {
  const out = {
    profile: process.env.PROFILE || "desktop",
    browser: process.env.BROWSER || "chromium",
    runs: Number(process.env.RUNS || 3) || 3,
    headed: process.env.HEADED === "1" || process.env.HEADED === "true",
    urlsFile: process.env.URLS_FILE || "config/urls.example.json",
    outJson: "reports/latest.json",
    outHtml: "reports/latest.html",
    history: true,
    fromJson: null,
    limit: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--profile") out.profile = argv[++i];
    else if (a === "--browser") out.browser = argv[++i];
    else if (a === "--runs") out.runs = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--headed") out.headed = true;
    else if (a === "--urls-file") out.urlsFile = argv[++i];
    else if (a === "--json") out.outJson = argv[++i];
    else if (a === "--html") out.outHtml = argv[++i];
    else if (a === "--no-history") out.history = false;
    else if (a === "--from-json") out.fromJson = argv[++i];
    else if (a === "--limit") out.limit = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`Live Site Metrics — Playwright live CWV collector

Usage:
  npm run collect -- [options]
  node src/cli.mjs [options]

Options:
  --profile desktop|mobile   Viewport profile (default: desktop)
  --browser chromium|firefox|webkit
  --runs N                   Median of N navigations (default: 3)
  --urls-file PATH           JSON list of {path,label} or absolute urls
  --limit N                  Only first N URLs (smoke)
  --headed                   Show browser window
  --json PATH                Write JSON report (default: reports/latest.json)
  --html PATH                Write HTML report (default: reports/latest.html)
  --from-json PATH           Rebuild HTML from an existing JSON result
  --no-history               Skip history/<timestamp>.json copy

Env (see .env.example):
  BASE_URL                   Origin for relative paths
  METRICS_URLS               Comma-separated absolute URLs
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  let result;
  if (args.fromJson) {
    const p = resolve(ROOT, args.fromJson);
    result = JSON.parse(readFileSync(p, "utf8"));
  } else {
    let targets = loadTargets({
      baseUrl: process.env.BASE_URL,
      urlsFile: args.urlsFile,
      metricsUrls: process.env.METRICS_URLS,
      root: ROOT,
    });
    if (args.limit) targets = targets.slice(0, args.limit);

    const navTimeoutMs = Number(process.env.NAV_TIMEOUT_MS || 60000) || 60000;
    result = await collectLive({
      targets,
      profile: args.profile,
      browserName: args.browser,
      runs: args.runs,
      headed: args.headed,
      navTimeoutMs,
    });
  }

  result.pages = (result.pages || []).map(annotateBands);

  const jsonPath = resolve(ROOT, args.outJson);
  const htmlPath = resolve(ROOT, args.outHtml);
  writeJson(jsonPath, result);
  writeHtml(htmlPath, result);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${htmlPath}`);

  if (args.history && !args.fromJson) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const histDir = resolve(ROOT, "history");
    mkdirSync(histDir, { recursive: true });
    const histPath = resolve(histDir, `${stamp}.json`);
    copyFileSync(jsonPath, histPath);
    const indexPath = resolve(histDir, "index.json");
    let index = [];
    if (existsSync(indexPath)) {
      try {
        index = JSON.parse(readFileSync(indexPath, "utf8"));
      } catch {
        index = [];
      }
    }
    index.unshift({
      file: `${stamp}.json`,
      generated_at: result.generated_at,
      profile: result.profile,
      browser: result.browser,
      pages: (result.pages || []).length,
    });
    writeFileSync(indexPath, JSON.stringify(index.slice(0, 50), null, 2), "utf8");
    console.log(`History ${histPath}`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
