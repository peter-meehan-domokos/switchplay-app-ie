import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

const base = "tests/maths-renderer/vercel-proof";
const read = (path: string) => readFileSync(path, "utf8");
const result = JSON.parse(read(`${base}/evidence/local-results.json`));
const preparation = JSON.parse(read(`${base}/evidence/preparation.json`));

test("the actual proof refuses Production-classified Vercel builds before Next compilation", () => {
  const guard = `${base}/template/check-environment.mjs`;
  assert.equal(spawnSync(process.execPath, [guard], { env: { ...process.env, VERCEL: "1", VERCEL_ENV: "production" } }).status, 1);
  assert.equal(spawnSync(process.execPath, [guard], { env: { ...process.env, VERCEL: "1", VERCEL_ENV: "preview" } }).status, 0);
  assert.equal(spawnSync(process.execPath, [guard], { env: { ...process.env, VERCEL: "", VERCEL_ENV: "" } }).status, 0);
});

test("the production proof copied unchanged renderer sources and the eight approved, licensed font assets", () => {
  assert.equal(result.passed, true);
  for (const input of preparation.inputs) assert.equal(createHash("sha256").update(readFileSync(input.source)).digest("hex"), input.sha256, input.source);
  assert.equal(preparation.fonts.filter((font: { file: string }) => font.file.endsWith(".ttf")).length, 8);
  assert(preparation.fonts.some((font: { file: string }) => font.file === "Liberation-LICENSE.txt"));
  assert(!preparation.inputs.some((input: { source: string }) => /info-cards|src\/lib\//.test(input.source)));
  assert.equal(result.routeTrace.includes.filter((file: string) => /public\/fonts\/.*\.ttf$/.test(file)).length, 8);
  assert(result.routeTrace.includes.some((file: string) => file.endsWith("chromium.br")));
});

test("all five unchanged explanations use public renderer callbacks, supplied heights, and actual custom fonts", () => {
  const sources = [...read("src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx").matchAll(/content:\s*String\.raw`([^`]+)`/g)].map(match => match[1]);
  assert.equal(sources.length, 5);
  for (const measurement of result.measurements) {
    assert.equal(measurement.execution, "complete");
    if (measurement.scenario.startsWith("review-")) assert.equal(measurement.job.content, sources[Number(measurement.scenario[7]) - 1]);
    if (measurement.result.status === "ready") {
      assert.equal(measurement.observation.fontProfileVerified, true);
      assert.equal(measurement.result.layout.available.height, measurement.job.height);
      assert.equal(measurement.result.layout.available.width, measurement.job.width);
      for (const probe of measurement.observation.actualFonts) for (const font of probe.fonts) {
        assert(font.isCustomFont); assert(/^(Liberation (Sans|Serif)|KaTeX_)/.test(font.familyName));
      }
    }
  }
  const currency = result.measurements.find((measurement: { scenario: string }) => measurement.scenario.startsWith("currency:"));
  const euros = currency.observation.actualFonts.filter((probe: { text: string }) => probe.text === "€");
  assert.equal(euros.length, 4);
  assert(euros.every((probe: { fonts: { familyName: string }[] }) => probe.fonts.every(font => font.familyName === "Liberation Serif")));
});

test("invalid, unavailable and failed executions cannot become fits, and every owned browser is released", () => {
  for (const measurement of [...result.measurements, ...result.failureCases]) {
    if (measurement.result?.status !== "ready") assert.equal(measurement.readyAndFits, false);
    assert.deepEqual(measurement.cleanup, { browserConnected: false, browserProcessAlive: false, contexts: 0 });
  }
  assert.deepEqual(result.concurrent.statuses.slice().sort(), [200, 503]);
  assert.equal(result.externalDeployment, false); assert.equal(result.linuxExecution, false);
  assert.equal(result.localServerStopped, true);
});
