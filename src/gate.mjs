/**
 * Standalone CWV quality gate for CI/local verification.
 * Evaluates pages against Google Core Web Vitals thresholds (or env overrides).
 */
export function evaluateGate(result, env = process.env) {
  const maxLcpMs = Number(env.CWV_GATE_LCP_MS || 4000);
  const maxCls = Number(env.CWV_GATE_CLS || 0.25);
  const maxInpMs = Number(env.CWV_GATE_INP_MS || 500);

  const pages = Array.isArray(result?.pages) ? result.pages : [];
  const failures = [];

  for (const page of pages) {
    const reasons = [];
    if (page.error) reasons.push(`error: ${page.error}`);
    if (typeof page.lcp_ms === "number" && page.lcp_ms > maxLcpMs) {
      reasons.push(`LCP ${Math.round(page.lcp_ms)}ms > ${maxLcpMs}ms`);
    }
    if (typeof page.cls === "number" && page.cls > maxCls) {
      reasons.push(`CLS ${page.cls.toFixed(3)} > ${maxCls}`);
    }
    if (typeof page.inp_ms === "number" && page.inp_ms > maxInpMs) {
      reasons.push(`INP ${Math.round(page.inp_ms)}ms > ${maxInpMs}ms`);
    }
    if (reasons.length) {
      failures.push({
        url: page.url,
        label: page.label || page.url,
        reasons,
      });
    }
  }

  return {
    status: pages.length === 0 ? "warn" : failures.length === 0 ? "pass" : "fail",
    checked_pages: pages.length,
    failed_pages: failures.length,
    thresholds: { lcp_ms: maxLcpMs, cls: maxCls, inp_ms: maxInpMs },
    failures,
  };
}
