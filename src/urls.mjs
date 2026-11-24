import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";

/**
 * Resolve measurement targets from env / file (.json or .csv).
 * Never embeds company URLs — BASE_URL + relative paths, or absolute METRICS_URLS.
 */
export function loadTargets({ baseUrl, urlsFile, metricsUrls, root }) {
  if (metricsUrls && String(metricsUrls).trim()) {
    return String(metricsUrls)
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url, path: pathOf(url), label: pathOf(url) }));
  }

  const file = resolve(root, urlsFile || "config/urls.example.json");
  if (!existsSync(file)) {
    throw new Error(`URL list not found: ${file}`);
  }

  const origin = (baseUrl || "").replace(/\/$/, "");
  if (extname(file).toLowerCase() === ".csv") {
    return loadCsvTargets(readFileSync(file, "utf8"), file, origin);
  }

  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error(`URL list is empty: ${file}`);
  }

  return raw.map((row, i) => {
    if (typeof row === "string") {
      const url = absolute(row, origin);
      return { url, path: pathOf(url), label: pathOf(url) || `url-${i + 1}` };
    }
    const path = row.path || row.url || "";
    const url = absolute(row.url || path, origin);
    return {
      url,
      path: row.path || pathOf(url),
      label: row.label || row.path || pathOf(url) || `url-${i + 1}`,
    };
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line.charAt(i + 1) === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function loadCsvTargets(text, file, origin) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error(`CSV URL list is empty: ${file}`);
  }
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const iPath = header.indexOf("path");
  const iUrl = header.indexOf("url");
  const iLabel = header.indexOf("label");
  const iEndpoint = header.indexOf("endpoint");
  const iCwv = header.indexOf("cwv");
  const iStatus = header.indexOf("expect_status");

  if (iPath < 0 && iUrl < 0) {
    throw new Error(`CSV must have a "path" or "url" column: ${file}`);
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (iCwv >= 0 && (cols[iCwv] || "").trim() === "0") continue;
    if (iStatus >= 0) {
      const status = Number((cols[iStatus] || "").trim());
      if (Number.isFinite(status) && status >= 400) continue;
    }
    const rawTarget = (iUrl >= 0 ? cols[iUrl] : "") || (iPath >= 0 ? cols[iPath] : "");
    if (!String(rawTarget || "").trim()) continue;
    const url = absolute(rawTarget, origin);
    const pathVal = iPath >= 0 && (cols[iPath] || "").trim() ? cols[iPath].trim() : pathOf(url);
    const label =
      (iLabel >= 0 && (cols[iLabel] || "").trim()) ||
      (iEndpoint >= 0 && (cols[iEndpoint] || "").trim()) ||
      pathVal ||
      `url-${out.length + 1}`;
    out.push({ url, path: pathVal, label });
  }
  if (!out.length) {
    throw new Error(`No active targets in CSV: ${file}`);
  }
  return out;
}

function absolute(value, origin) {
  const v = String(value || "").trim();
  if (!v) throw new Error("Empty URL/path in list");
  if (/^https?:\/\//i.test(v)) return v;
  if (!origin) {
    throw new Error(
      `Relative path "${v}" needs BASE_URL (set in .env). Example: BASE_URL=https://example.com`,
    );
  }
  return `${origin}${v.startsWith("/") ? v : `/${v}`}`;
}

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
