import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseVisualGuestCredential, visualGuestExpiry, VISUAL_GUEST_DURATION_SECONDS } from "../src/lib/visualLearningRecords/guestCredentials";

test("guest credentials require a high-entropy secret, never treat the public handle as proof and retain only a hash", () => {
  const id = randomUUID(), secret = "a".repeat(43), token = `${id}.${secret}`, parsed = parseVisualGuestCredential(token)!;
  assert.equal(parsed.guestId, id); assert.match(parsed.credentialHash, /^[a-f0-9]{64}$/); assert.ok(!JSON.stringify(parsed).includes(secret));
  for (const invalid of [undefined, id, `${id}.short`, `${id}.${"a".repeat(44)}`, `${id}.${"!".repeat(43)}`, `${token}.extra`, "x".repeat(10000)]) assert.equal(parseVisualGuestCredential(invalid), null);
  const now = new Date("2026-10-30T00:00:00.000Z");
  assert.equal(visualGuestExpiry(now).getTime() - now.getTime(), VISUAL_GUEST_DURATION_SECONDS * 1000);
  assert.equal(visualGuestExpiry(now).toISOString(), "2027-01-28T00:00:00.000Z");
});
