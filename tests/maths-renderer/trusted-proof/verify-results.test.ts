// Acceptance assertions on the fresh, actual-browser evidence from run.mts.
// No measurement algorithm or alternative capacity estimator is introduced.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";

const evidence = JSON.parse(readFileSync("tests/maths-renderer/evidence/trusted-proof/results.json", "utf8"));
const proof = evidence.proof;

test("proof used current, unchanged renderer and authored sources in a production Next build", () => {
  assert(evidence.passed && proof.passed && evidence.guardedFilesUnchanged && evidence.scratchRemoved && evidence.serverStopped);
  for (const [path, expected] of Object.entries(evidence.rendererHashes)) assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), expected);
  assert.equal(createHash("sha256").update(readFileSync("src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx")).digest("hex"), evidence.fixtureSourceHash);
  assert.equal(proof.chromium, "145.0.7632.6");
});

test("five real explanations fit without media; media reservation produces the expected vertical overflows", () => {
  assert.equal(proof.measurements.length, 28);
  assert.deepEqual(proof.budgets.map((budget: { width: number; height: number }) => [budget.width, budget.height]), [[214, 110.015625], [214, 74.015625]]);
  for (let n = 1; n <= 5; n++) for (const media of [false, true]) {
    const entry = proof.measurements.find((entry: { id: string }) => entry.id === `review-${n}-${media ? "media" : "plain"}`);
    assert.equal(entry.result.status, "ready"); assert.equal(entry.result.fits, !media || n === 5);
    assert.equal(entry.result.layout.overflowX, false); assert.equal(entry.result.layout.overflowY, media && n < 5);
    assert.equal(entry.observation.mathSize, 9.5); assert.equal(entry.observation.overflow, "visible");
  }
});

test("invalid, unmatched, unsafe and excessive expansion inputs cannot become successful fits", () => {
  for (const id of ["invalid", "incomplete", "unsafe", "expensive"]) for (const kind of ["plain", "media"]) {
    const entry = proof.measurements.find((entry: { id: string }) => entry.id === `${id}-${kind}`);
    assert.equal(entry.result.status, "invalid-input"); assert(!("fits" in entry.result));
    assert(entry.result.diagnostics.some((issue: { severity: string }) => issue.severity === "error"));
  }
  for (const kind of ["plain", "media"]) {
    const wide = proof.measurements.find((entry: { id: string }) => entry.id === `oversized-${kind}`);
    const tall = proof.measurements.find((entry: { id: string }) => entry.id === `large-${kind}`);
    assert(wide.result.layout.overflowX && !wide.result.fits);
    assert(tall.result.layout.overflowY && !tall.result.fits);
  }
});

test("font inspection verifies actual Arial and mathematical bold/italic fonts rather than CSS declarations alone", () => {
  assert(proof.referenceFonts.some((font: { postScriptName: string }) => font.postScriptName === "ArialMT"));
  const bold = proof.measurements.find((entry: { id: string }) => entry.id === "review-3-plain");
  assert(bold.observation.mathFonts.some((font: { actual: { postScriptName: string }[] }) => font.actual.some(actual => actual.postScriptName === "KaTeX_Math-BoldItalic")));
  const annotation = proof.measurements.find((entry: { id: string }) => entry.id === "review-2-plain");
  assert(annotation.observation.mathFonts.some((font: { actual: { postScriptName: string }[] }) => font.actual.some(actual => actual.postScriptName === "KaTeX_Main-Italic")));
  const euro = proof.measurements.find((entry: { id: string }) => entry.id === "currency-plain");
  assert.equal(euro.result.status, "ready"); assert(euro.result.diagnostics.every((issue: { severity: string }) => issue.severity === "warning"));
});

test("font failures, timeouts, exceptions and stale generations fail closed and release resources", () => {
  for (const entry of proof.failureCases) {
    assert(entry.contextClosed);
    if (entry.id !== "scaled") assert(entry.result === null || entry.result.status === "measurement-unavailable");
  }
  assert(proof.failureCases.some((entry: { id: string }) => entry.id === "missing-prose-font"));
  assert.equal(proof.staleReplacement.current.id, "current"); assert.equal(proof.staleReplacement.current.result.status, "invalid-input");
  assert(proof.concurrent.results.every((entry: { result: { status: string }; contextClosed: boolean }) => entry.result.status === "ready" && entry.contextClosed));
  assert.deepEqual(proof.cleanup, { browserConnected: false, browserProcessAlive: false, contexts: 0 });
});
