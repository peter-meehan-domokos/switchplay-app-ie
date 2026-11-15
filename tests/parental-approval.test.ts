import assert from "node:assert/strict";
import { test } from "node:test";
import { approvalEligibility, maskEmail } from "../src/lib/parentalApproval";
import { GROUP_EXPERIENCE_EXPLANATION, GROUP_EXPERIENCE_SCOPE, GUARDIAN_DECLARATION } from "../src/lib/parentalApprovalScope";

test("eligibility: under 16 by Dublin calendar date; unknown DOB is never treated as 16 or over", () => {
  assert.equal(approvalEligibility("2010-11-14", "2026-11-14"), "not-required", "16th birthday today");
  assert.equal(approvalEligibility("2010-11-15", "2026-11-14"), "eligible", "the day before turning 16");
  assert.equal(approvalEligibility("2013-11-14", "2026-11-14"), "eligible");
  assert.equal(approvalEligibility("2010-02-28", "2026-02-27"), "eligible");
  assert.equal(approvalEligibility("2008-02-29", "2024-02-28"), "eligible", "leap-day birthday not reached on 28 Feb");
  assert.equal(approvalEligibility("2008-02-29", "2024-02-29"), "not-required");
  for (const unknown of [null, undefined, ""]) assert.equal(approvalEligibility(unknown, "2026-11-14"), "age-unknown");
});
test("one common disclosure covers all three websites, explains withdrawal and excludes live tuition", () => {
  assert.equal(GROUP_EXPERIENCE_SCOPE.scopeId, "shared-group-experiences");
  for (const site of ["Puckle", "Switchplay", "Strat17"]) assert.match(GROUP_EXPERIENCE_EXPLANATION.text, new RegExp(site));
  assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /withdraw/i); assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /not permission for live tuition/);
  assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /one approval covers/i);
  assert.ok(GROUP_EXPERIENCE_EXPLANATION.version && GUARDIAN_DECLARATION.version);
  assert.match(GUARDIAN_DECLARATION.text, /parent or legal guardian/);
});
test("guardian addresses are masked in the student's summary", () => {
  assert.equal(maskEmail("parent@example.com"), "p•••••@example.com"); assert.equal(maskEmail("a@b.co"), "a•@b.co");
});
