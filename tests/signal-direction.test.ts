import assert from "node:assert/strict";
import { test } from "node:test";
import { getSignalGestureAxis } from "../src/components/decks/BackCardFaceContent";

test("signal arbitration retains its current small horizontal recognition and dead zone", () => {
  assert.equal(getSignalGestureAxis(8, 0), null);
  for (const x of [-12, 12]) assert.equal(getSignalGestureAxis(x, 0), "horizontal");
});

test("both vertical directions resolve from total displacement despite an initial horizontal sample", () => {
  for (const y of [-180, 180]) {
    assert.equal(getSignalGestureAxis(12, 0), "horizontal");
    assert.equal(getSignalGestureAxis(12, y), "vertical");
  }
});

test("diagonal ambiguity stays unresolved until either direction is clear", () => {
  for (const sign of [-1, 1]) {
    assert.equal(getSignalGestureAxis(8, 7 * sign), null);
    assert.equal(getSignalGestureAxis(14, 20 * sign), null);
    assert.equal(getSignalGestureAxis(16, 60 * sign), "vertical");
    assert.equal(getSignalGestureAxis(50, 50 * sign), null);
  }
});

test("provisional horizontal feedback can yield vertically, while firmly established editing stays horizontal", async () => {
  const { getSignalGestureDecision } = await import("../src/components/decks/BackCardFaceContent");
  const preview = getSignalGestureDecision(12, 0);
  assert.deepEqual(preview, { axis: "horizontal", horizontalLocked: false });
  for (const y of [-180, 180]) assert.equal(getSignalGestureDecision(12, y, preview.horizontalLocked).axis, "vertical");
  const firm = getSignalGestureDecision(30, 0);
  assert.deepEqual(firm, { axis: "horizontal", horizontalLocked: true });
  assert.deepEqual(getSignalGestureDecision(30, 180, firm.horizontalLocked), firm);
  assert.equal(getSignalGestureDecision(50, 50, false).axis, null);
});
