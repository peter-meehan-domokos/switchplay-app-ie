import assert from "node:assert/strict";
import { test } from "node:test";
import { measureInfoCapacity } from "../src/lib/infoCards/capacity";
import { CreatorRequestError } from "../src/components/creator/creatorRequest";
import { infoCardError } from "../src/components/info-cards/infoCardErrors";

test("suppress only capacity messages already shown at current fields", () => {
  const capacity = measureInfoCapacity({ title: "W".repeat(50), body: "Line\n".repeat(50), seriesTitle: "Basics", hasMedia: false });
  const error = new CreatorRequestError(422, "INFO_CAPACITY_EXCEEDED", { capacity });
  assert.equal(infoCardError(error, capacity.fieldIssues), "");
  assert.equal(infoCardError(error, capacity.fieldIssues.slice(0, 1)), capacity.fieldIssues[1].message);
  assert.equal(infoCardError(error), capacity.issues.join(" "));
  assert.notEqual(infoCardError(new CreatorRequestError(409, "STALE_INFO_REVISION"), capacity.fieldIssues), "");
  const mixed = { ...capacity, issues: [...capacity.issues, "Remove unsupported control characters."] };
  assert.equal(infoCardError(new CreatorRequestError(422, "INFO_CAPACITY_EXCEEDED", { capacity: mixed }), capacity.fieldIssues), "Remove unsupported control characters.");
  assert.equal(infoCardError(new CreatorRequestError(422, "INFO_CAPACITY_EXCEEDED", { capacity: { issues: ["Legacy issue"] } }), capacity.fieldIssues), "Legacy issue");
});
