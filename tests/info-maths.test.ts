import assert from "node:assert/strict";
import { test } from "node:test";
import { mathsHostToken, validMathsHostToken } from "../src/lib/infoCards/mathsHostAuth";
import { assertInfoDraft } from "../src/lib/infoCards/domain";
import { InfoMathsError } from "../src/lib/infoCards/mathsValidation";

test("private maths host rejects missing, forged, malformed, expired and future tokens", () => {
  const prior = process.env.SESSION_SECRET; process.env.SESSION_SECRET = "isolated-test-secret";
  try {
    const token = mathsHostToken(); assert(validMathsHostToken(token));
    for (const value of [null, "", "forged", token + ".extra", `${Date.now()}.${"é".repeat(64)}`, `${Date.now() - 61000}.${token.split(".")[1]}`, `${Date.now() + 61000}.${token.split(".")[1]}`]) assert.equal(validMathsHostToken(value), false);
    process.env.SESSION_SECRET = "other"; assert.equal(validMathsHostToken(token), false);
    delete process.env.SESSION_SECRET; assert.equal(validMathsHostToken(token), false); assert.throws(mathsHostToken);
  } finally { if (prior === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prior; }
});

test("format marker is optional for legacy source and rejects unknown formats without rewriting source", () => {
  const draft = { title: "Maths", body: String.raw`Price \$5; $x=\frac{1}{2}$`, seriesId: "s", mediaItem: null };
  assertInfoDraft(draft); assertInfoDraft({ ...draft, bodyFormat: "latex-v1" });
  assert.throws(() => assertInfoDraft({ ...draft, bodyFormat: "other" }));
  assert.equal(new InfoMathsError().code, "INFO_MATHS_UNAVAILABLE");
});
