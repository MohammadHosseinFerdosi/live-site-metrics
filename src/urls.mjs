import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Resolve measurement targets from env / file.
 * Never embeds company URLs — BASE_URL + relative paths, or absolute METRICS_URLS.
 */
export function loadTargets({ baseUrl, urlsFile, metricsUrls, root }) {
  if (metricsUrls && String(metricsUrls).trim()) {
    return String(metricsUrls)
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url, path: new URL(url).pathname, label: new URL(url).pathname }));
  }

  const file = resolve(root, urlsFile || "config/urls.example.json");
  if (!existsSync(file)) {
    throw new Error(`URL list not found: ${file}`);
  }

  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error(`URL list is empty: ${file}`);
  }

  const origin = (baseUrl || "").replace(/\/$/, "");
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
