import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTargets } from "../src/urls.mjs";
import { annotateBands } from "../src/bands.mjs";
import { PROFILES } from "../src/profiles.mjs";
import { evaluateGate } from "../src/gate.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("loadTargets loads JSON and CSV lists", () => {
  const jsonTargets = loadTargets({
    baseUrl: "https://example.com",
    urlsFile: "config/urls.example.json",
    root: ROOT,
  });
  assert.equal(jsonTargets.length, 3);
  assert.equal(jsonTargets[0].url, "https://example.com/");

  const csvTargets = loadTargets({
    baseUrl: "https://example.com",
    urlsFile: "config/pages.example.csv",
    root: ROOT,
  });
  assert.equal(csvTargets.length, 3);
  assert.equal(csvTargets[1].url, "https://example.com/about");
  assert.equal(csvTargets[1].label, "About");
});

test("profiles include desktop, mobile, android, and ios", () => {
  for (const name of ["desktop", "mobile", "android", "ios"]) {
    assert.ok(PROFILES[name], `missing profile ${name}`);
    assert.ok(PROFILES[name].viewport.width > 0);
  }
});

test("annotateBands and evaluateGate classify metrics", () => {
  const good = annotateBands({
    url: "https://example.com/",
    lcp_ms: 1500,
    cls: 0.02,
    inp_ms: 80,
    ttfb_ms: 200,
    fcp_ms: 900,
  });
  assert.equal(good.bands.lcp, "good");
  assert.equal(good.bands.cls, "good");
  assert.equal(good.bands.inp, "good");

  const poor = {
    url: "https://example.com/slow",
    lcp_ms: 5200,
    cls: 0.3,
    inp_ms: 600,
  };
  const gate = evaluateGate({ pages: [good, poor] });
  assert.equal(gate.status, "fail");
  assert.equal(gate.failed_pages, 1);
  assert.equal(gate.failures[0].url, "https://example.com/slow");
});
