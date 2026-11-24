import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { annotateBands, THRESHOLDS } from "./bands.mjs";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtCls(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(3);
}

function chip(band) {
  const cls =
    band === "good" ? "good" : band === "needs-improvement" ? "ni" : band === "poor" ? "poor" : "na";
  return `<span class="chip ${cls}">${esc(band)}</span>`;
}

/**
 * Build a self-contained HTML report from a collectLive() result.
 */
export function buildHtmlReport(result) {
  const rows = (result.pages || []).map(annotateBands);
  const good = rows.filter((r) => r.bands.lcp === "good" && !r.error).length;
  const poor = rows.filter((r) => r.bands.lcp === "poor" || r.error).length;

  const body = rows
    .map((r) => {
      const err = r.error ? `<div class="err">${esc(r.error)}</div>` : "";
      return `<tr>
        <td>
          <div class="label">${esc(r.label)}</div>
          <div class="path">${esc(r.path || r.url)}</div>
          ${err}
        </td>
        <td>${fmtMs(r.lcp_ms)} ${chip(r.bands.lcp)}</td>
        <td>${fmtCls(r.cls)} ${chip(r.bands.cls)}</td>
        <td>${fmtMs(r.inp_ms)} ${chip(r.bands.inp)}</td>
        <td>${fmtMs(r.ttfb_ms)} ${chip(r.bands.ttfb)}</td>
        <td>${fmtMs(r.fcp_ms)} ${chip(r.bands.fcp)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Live Site Metrics</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a222c;
      --text: #e7eef7;
      --muted: #8b9bb0;
      --line: #2a3544;
      --good: #1f8a5b;
      --ni: #b8860b;
      --poor: #c23b3b;
      --accent: #3d8bfd;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: radial-gradient(1200px 600px at 10% -10%, #1c2a3d, var(--bg));
      color: var(--text);
      line-height: 1.45;
    }
    main { max-width: 1100px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 1.75rem; margin: 0 0 0.35rem; letter-spacing: -0.02em; }
    .sub { color: var(--muted); margin-bottom: 1.75rem; }
    .meta {
      display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem;
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 10px; padding: 1rem 1.15rem; margin-bottom: 1.5rem;
      font-size: 0.92rem;
    }
    .meta strong { color: var(--accent); font-weight: 600; }
    table {
      width: 100%; border-collapse: collapse; background: var(--panel);
      border: 1px solid var(--line); border-radius: 10px; overflow: hidden;
    }
    th, td { text-align: left; padding: 0.85rem 0.9rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); background: #151c25; }
    tr:last-child td { border-bottom: none; }
    .label { font-weight: 600; }
    .path { color: var(--muted); font-size: 0.85rem; word-break: break-all; }
    .err { color: #ff8d8d; font-size: 0.82rem; margin-top: 0.35rem; }
    .chip {
      display: inline-block; margin-left: 0.35rem; padding: 0.1rem 0.45rem;
      border-radius: 999px; font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
    }
    .chip.good { background: color-mix(in srgb, var(--good) 25%, transparent); color: #7ddeb4; }
    .chip.ni { background: color-mix(in srgb, var(--ni) 25%, transparent); color: #f0d27a; }
    .chip.poor { background: color-mix(in srgb, var(--poor) 25%, transparent); color: #ff9b9b; }
    .chip.na { background: #2a3544; color: var(--muted); }
    footer { margin-top: 1.5rem; color: var(--muted); font-size: 0.85rem; }
    footer code { color: #c5d4e8; }
    ul.thresholds { margin: 0.5rem 0 0; padding-left: 1.1rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <main>
    <h1>Live Site Metrics</h1>
    <p class="sub">Playwright live collection · Core Web Vitals bands · no invented values</p>
    <div class="meta">
      <div>Generated <strong>${esc(result.generated_at)}</strong></div>
      <div>Profile <strong>${esc(result.profile)}</strong></div>
      <div>Browser <strong>${esc(result.browser)}</strong></div>
      <div>Runs / URL <strong>${esc(String(result.runs))}</strong></div>
      <div>Pages <strong>${rows.length}</strong> · LCP good <strong>${good}</strong> · poor/error <strong>${poor}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>LCP</th>
          <th>CLS</th>
          <th>INP</th>
          <th>TTFB</th>
          <th>FCP</th>
        </tr>
      </thead>
      <tbody>
        ${body || `<tr><td colspan="6">No pages measured.</td></tr>`}
      </tbody>
    </table>
    <footer>
      <div>Thresholds (field CWV + supporting):</div>
      <ul class="thresholds">
        <li>LCP — ${esc(THRESHOLDS.lcp_ms)}</li>
        <li>CLS — ${esc(THRESHOLDS.cls)}</li>
        <li>INP — ${esc(THRESHOLDS.inp_ms)}</li>
        <li>TTFB — ${esc(THRESHOLDS.ttfb_ms)}</li>
        <li>FCP — ${esc(THRESHOLDS.fcp_ms)}</li>
      </ul>
      <p>Method: <code>${esc(result.method || "playwright-live")}</code> · throttling: <code>${esc(result.throttling || "none")}</code></p>
    </footer>
  </main>
</body>
</html>`;
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

export function writeHtml(path, result) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buildHtmlReport(result), "utf8");
}
