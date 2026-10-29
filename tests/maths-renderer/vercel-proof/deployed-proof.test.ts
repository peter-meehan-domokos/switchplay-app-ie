import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name: string) => JSON.parse(readFileSync(`${import.meta.dirname}/evidence/${name}.json`, "utf8"));
const deployed = read("deployed-results"), local = read("local-results"), target = read("deployment");

test("Linux evidence belongs to the approved protected Preview with an inert retained bootstrap", () => {
  assert.equal(target.environment, "preview"); assert.equal(target.targetVerifiedBeforeMeasurements, true);
  assert.equal(target.bootstrapRetained, true); assert.equal(target.productionProjectModified, false);
  assert.equal(deployed.origin, `https://${target.url}`); assert.equal(deployed.passed, true);
  const bootstrap = read("bootstrap-deployment"), preparation = read("bootstrap-preparation");
  assert.equal(bootstrap.target, "production"); assert.equal(bootstrap.retainedDuringTesting, true);
  assert.equal(preparation.functions, 0); assert.equal(preparation.applicationCode, false);
  assert.equal(preparation.browserRuntime, false); assert.equal(preparation.measurementAPI, false);
  assert.equal(preparation.databaseConnection, false);
  assert(bootstrap.checks.every((check: { authorised: boolean; status: number }) => check.authorised ? check.status === 404 : check.status === 302));
  assert(deployed.guards.every((guard: { status: number }) => guard.status !== 200));
});

test("the existing public renderer callback measured all controlled cases in the exact Linux font/browser profile", () => {
  assert.equal(deployed.measurements.length, 42);
  const sources = [...readFileSync("src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx", "utf8").matchAll(/content:\s*String\.raw`([^`]+)`/g)].map(match => match[1]);
  for (const measurement of deployed.measurements) {
    assert.equal(measurement.platform, "linux"); assert.equal(measurement.arch, "x64");
    assert.match(measurement.node, /^v24\./); assert.equal(measurement.chromium, "153.0.8010.0");
    assert.equal(measurement.executableSha256, "53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0");
    assert.equal(measurement.browserVersion.revision, "@86cee6df69e0463a839c0cc8435c9d4c259434d3");
    if (measurement.scenario.startsWith("review-")) assert.equal(measurement.job.content, sources[Number(measurement.scenario[7]) - 1]);
    if (measurement.result.status === "ready") {
      assert.equal(measurement.observation.fontProfileVerified, true);
      assert.equal(measurement.profile.arraystretch, "2.3125");
      assert.equal(measurement.observation.mathSize, "9.5px");
      assert.equal(measurement.observation.overflow, "visible");
      assert.equal(measurement.result.fits, !measurement.result.layout.overflowX && !measurement.result.layout.overflowY);
      const reference = local.measurements.find((entry: { scenario: string }) => entry.scenario === measurement.scenario);
      assert.equal(measurement.result.fits, reference.result.fits);
      assert.equal(measurement.result.layout.height, reference.result.layout.height);
      for (const probe of measurement.observation.actualFonts) for (const font of probe.fonts) {
        assert(font.isCustomFont); assert(/^(Liberation (Sans|Serif)|KaTeX_)/.test(font.familyName));
      }
    }
  }
});

test("Linux failures and concurrent invocations fail closed or use independently cleaned-up browsers", () => {
  assert.equal(deployed.failures.length, 8);
  for (const entry of [...deployed.requests, ...deployed.concurrent.flatMap((entry: { result?: unknown }) => entry.result ? [entry.result] : [])]) {
    if (entry.result?.status !== "ready") assert.equal(entry.readyAndFits, false);
    assert.deepEqual(entry.cleanup, { browserConnected: false, browserProcessAlive: false, contexts: 0 });
    assert(entry.memory.maximumCombinedTreeRSSMiB >= entry.memory.maximumNodeMiB);
  }
  for (const entry of deployed.concurrent) assert([200, 503].includes(entry.status));
  assert(deployed.concurrent.some((entry: { status: number }) => entry.status === 200));
});
