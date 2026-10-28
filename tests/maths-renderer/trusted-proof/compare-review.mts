// Compatibility comparison only. Does not restart or configure the review server.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright-core";
import type { MathsResult } from "../../../src/components/maths-renderer/types";

const directory = resolve(import.meta.dirname, "../evidence/trusted-proof");
const proof = JSON.parse(await readFile(`${directory}/results.json`, "utf8"));
assert(proof.passed);
const report = [];
for (const [name, engine] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]] as const) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
    const response = await page.goto("http://127.0.0.1:4181/dev/maths-renderer");
    assert.equal(response!.status(), 200);
    await page.waitForFunction(() => [...document.querySelectorAll("[data-explanation-result]")].length === 5 && [...document.querySelectorAll("[data-explanation-result]")].every(node => JSON.parse(node.textContent!)?.status === "ready"));
    const results = await page.locator("[data-explanation-result]").evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent!))) as MathsResult[];
    const comparisons = results.map((result, index) => {
      const canonical = proof.proof.measurements.find((entry: { id: string }) => entry.id === `review-${index + 1}-plain`).result;
      assert(result.status === "ready");
      if (name === "chromium") {
        assert.equal(result.fits, canonical.fits);
        assert(Math.abs(result.layout.height - canonical.layout.height) < .01, "Current review and production host must agree in the canonical local engine");
      }
      return { example: index + 1, result, canonicalHeight: canonical.layout.height, differencePx: result.layout.height - canonical.layout.height };
    });
    report.push({ name, version: browser.version(), comparisons });
  } finally { await browser.close(); }
}
await writeFile(`${directory}/review-comparison.json`, JSON.stringify(report, null, 2) + "\n");
console.log("Same current explanations verified in Chromium, Firefox and WebKit; Chromium agrees with the production proof.");
