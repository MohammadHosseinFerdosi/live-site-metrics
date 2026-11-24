/** Google Core Web Vitals / related metric bands. */

export function bandLcp(ms) {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  const s = ms / 1000;
  if (s <= 2.5) return "good";
  if (s <= 4.0) return "needs-improvement";
  return "poor";
}

export function bandCls(v) {
  if (v == null || !Number.isFinite(v)) return "n/a";
  if (v <= 0.1) return "good";
  if (v <= 0.25) return "needs-improvement";
  return "poor";
}

export function bandInp(ms) {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  if (ms <= 200) return "good";
  if (ms <= 500) return "needs-improvement";
  return "poor";
}

export function bandTtfb(ms) {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  if (ms <= 800) return "good";
  if (ms <= 1800) return "needs-improvement";
  return "poor";
}

export function bandFcp(ms) {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  if (ms <= 1800) return "good";
  if (ms <= 3000) return "needs-improvement";
  return "poor";
}

export const THRESHOLDS = {
  lcp_ms: "good ≤ 2.5s · needs-improvement ≤ 4s · poor > 4s",
  cls: "good ≤ 0.1 · needs-improvement ≤ 0.25 · poor > 0.25",
  inp_ms: "good ≤ 200ms · needs-improvement ≤ 500ms · poor > 500ms",
  ttfb_ms: "good ≤ 800ms · needs-improvement ≤ 1800ms · poor > 1800ms (supporting)",
  fcp_ms: "good ≤ 1.8s · needs-improvement ≤ 3s · poor > 3s (supporting)",
};

export function annotateBands(row) {
  return {
    ...row,
    bands: {
      lcp: bandLcp(row.lcp_ms),
      cls: bandCls(row.cls),
      inp: bandInp(row.inp_ms),
      ttfb: bandTtfb(row.ttfb_ms),
      fcp: bandFcp(row.fcp_ms),
    },
  };
}
