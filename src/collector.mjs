/**
 * Live metrics collector via Playwright.
 * Injects PerformanceObserver for LCP / CLS / INP / TTFB / FCP.
 * Never invents values — missing observers stay null.
 */
import { chromium, firefox, webkit } from "playwright";
import { PROFILES } from "./profiles.mjs";

const SETTLE_MS = 5000;
const LCP_POLL_MS = 10000;
const LCP_POLL_STEP_MS = 250;
const INP_WAIT_MS = 3500;

const LAUNCHERS = { chromium, firefox, webkit };

/** In-page collector — runs before any page scripts via addInitScript. */
const COLLECTOR_INIT = `(() => {
  if (window.__lsmInstalled) return;
  window.__lsmInstalled = true;
  window.__lsm = { lcp: null, cls: 0, inp: null, ttfb: null, fcp: null, errors: [] };
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav && typeof nav.responseStart === "number") {
      window.__lsm.ttfb = nav.responseStart;
    }
  } catch (e) {
    window.__lsm.errors.push(String(e));
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === "largest-contentful-paint") window.__lsm.lcp = e.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {
    window.__lsm.errors.push("lcp:" + String(e));
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.name === "first-contentful-paint") window.__lsm.fcp = e.startTime;
      }
    }).observe({ type: "paint", buffered: true });
  } catch (e) {
    window.__lsm.errors.push("fcp:" + String(e));
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__lsm.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    window.__lsm.errors.push("cls:" + String(e));
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const id = typeof e.interactionId === "number" ? e.interactionId : 0;
        const delay = e.duration;
        if (id > 0 && typeof delay === "number") {
          if (window.__lsm.inp == null || delay > window.__lsm.inp) window.__lsm.inp = delay;
        }
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch (e) {
    window.__lsm.errors.push("inp:" + String(e));
  }
})();`;

function median(nums) {
  const xs = nums.filter((n) => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForLcp(page, maxMs = LCP_POLL_MS) {
  const deadline = Date.now() + maxMs;
  let softScrolled = false;
  while (Date.now() < deadline) {
    const lcp = await page.evaluate(() => {
      if (!window.__lsm) return null;
      if (typeof window.__lsm.lcp === "number") return window.__lsm.lcp;
      try {
        const entries = performance.getEntriesByType("largest-contentful-paint");
        if (entries?.length) {
          const last = entries[entries.length - 1];
          if (last && typeof last.startTime === "number") {
            window.__lsm.lcp = last.startTime;
            return last.startTime;
          }
        }
      } catch {
        /* ignore */
      }
      return null;
    });
    if (typeof lcp === "number" && Number.isFinite(lcp)) return lcp;
    if (!softScrolled) {
      softScrolled = true;
      try {
        await page.evaluate(() => {
          window.scrollBy(0, Math.min(400, Math.floor(window.innerHeight * 0.35)));
        });
      } catch {
        /* ignore */
      }
    }
    await sleep(LCP_POLL_STEP_MS);
  }
  return null;
}

async function softInteract(page, conf) {
  const w = conf.viewport.width;
  const h = conf.viewport.height;
  try {
    await page.mouse.click(Math.floor(w / 2), Math.floor(h / 3), { delay: 40 });
    await sleep(300);
    await page.evaluate(() => {
      window.scrollBy(0, Math.min(600, Math.floor(window.innerHeight * 0.6)));
    });
    await sleep(300);
    await page.keyboard.press("Tab");
    await sleep(INP_WAIT_MS);
  } catch {
    /* INP is optional */
  }
}

async function measureOnce(browser, profileName, url, navTimeoutMs) {
  const conf = PROFILES[profileName];
  const context = await browser.newContext({
    viewport: conf.viewport,
    deviceScaleFactor: conf.deviceScaleFactor,
    isMobile: conf.isMobile,
    hasTouch: conf.hasTouch,
    userAgent: conf.userAgent,
  });
  const page = await context.newPage();
  const result = {
    url,
    lcp_ms: null,
    cls: null,
    inp_ms: null,
    ttfb_ms: null,
    fcp_ms: null,
    error: null,
    method: "playwright-live",
    throttling: "none",
  };

  try {
    await page.addInitScript(COLLECTOR_INIT);
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: navTimeoutMs,
    });
    if (response && response.status() >= 400) {
      result.error = `HTTP ${response.status()}`;
    }
    await sleep(SETTLE_MS);
    await waitForLcp(page);
    await softInteract(page, conf);

    const snap = await page.evaluate(() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav && window.__lsm && window.__lsm.ttfb == null) {
          window.__lsm.ttfb = nav.responseStart;
        }
        if (window.__lsm && window.__lsm.fcp == null) {
          const paints = performance.getEntriesByType("paint");
          const fcp = paints.find((p) => p.name === "first-contentful-paint");
          if (fcp) window.__lsm.fcp = fcp.startTime;
        }
      } catch {
        /* ignore */
      }
      return window.__lsm || {};
    });

    result.lcp_ms = typeof snap.lcp === "number" ? snap.lcp : null;
    result.cls = typeof snap.cls === "number" ? snap.cls : null;
    result.inp_ms = typeof snap.inp === "number" ? snap.inp : null;
    result.ttfb_ms = typeof snap.ttfb === "number" ? snap.ttfb : null;
    result.fcp_ms = typeof snap.fcp === "number" ? snap.fcp : null;
  } catch (err) {
    result.error = String(err?.message || err);
  } finally {
    await context.close().catch(() => {});
  }
  return result;
}

/**
 * @param {object} opts
 * @param {Array<{url:string,path?:string,label?:string}>} opts.targets
 * @param {string} [opts.profile]
 * @param {string} [opts.browserName]
 * @param {number} [opts.runs]
 * @param {boolean} [opts.headed]
 * @param {number} [opts.navTimeoutMs]
 * @param {(msg:string)=>void} [opts.log]
 */
export async function collectLive(opts) {
  const {
    targets,
    profile = "desktop",
    browserName = "chromium",
    runs = 3,
    headed = false,
    navTimeoutMs = 60000,
    log = console.log,
  } = opts;

  if (!PROFILES[profile]) {
    throw new Error(`Unknown profile "${profile}". Use: ${Object.keys(PROFILES).join(", ")}`);
  }
  const launcher = LAUNCHERS[browserName];
  if (!launcher) {
    throw new Error(`Unknown browser "${browserName}". Use: ${Object.keys(LAUNCHERS).join(", ")}`);
  }

  const browser = await launcher.launch({ headless: !headed });
  const pages = [];

  try {
    for (const target of targets) {
      log(`Measuring ${target.url} (${profile} × ${runs})…`);
      const samples = [];
      for (let i = 0; i < runs; i++) {
        const once = await measureOnce(browser, profile, target.url, navTimeoutMs);
        samples.push(once);
        if (once.error) log(`  run ${i + 1}: error — ${once.error}`);
        else log(`  run ${i + 1}: LCP=${fmt(once.lcp_ms)} CLS=${fmtCls(once.cls)} INP=${fmt(once.inp_ms)}`);
      }

      const ok = samples.filter((s) => !s.error);
      const pool = ok.length ? ok : samples;
      pages.push({
        path: target.path || "",
        label: target.label || target.path || target.url,
        url: target.url,
        profile,
        browser: browserName,
        runs: samples.length,
        ok_runs: ok.length,
        lcp_ms: median(pool.map((s) => s.lcp_ms)),
        cls: median(pool.map((s) => s.cls)),
        inp_ms: median(pool.map((s) => s.inp_ms)),
        ttfb_ms: median(pool.map((s) => s.ttfb_ms)),
        fcp_ms: median(pool.map((s) => s.fcp_ms)),
        error: ok.length ? null : samples.map((s) => s.error).filter(Boolean)[0] || "all runs failed",
        samples,
      });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return {
    generated_at: new Date().toISOString(),
    profile,
    browser: browserName,
    runs,
    throttling: "none",
    method: "playwright-live",
    pages,
  };
}

function fmt(ms) {
  return ms == null ? "n/a" : `${Math.round(ms)}ms`;
}
function fmtCls(v) {
  return v == null ? "n/a" : v.toFixed(3);
}
