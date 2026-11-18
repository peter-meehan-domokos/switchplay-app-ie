import assert from "node:assert/strict";
import { test } from "node:test";
import { ageOn, dublinToday, parseDateOfBirth } from "../src/lib/age";
import { parseAgeAssurance } from "../src/lib/userSafeguarding";
import { newAccountPermissions, parseUserPermissions } from "../src/lib/userPermissions";
import { GROUP_EXPERIENCE_SCOPE } from "../src/lib/parentalApprovalScope";

test("strict date parsing rejects rollover, timestamps and future dates", () => {
  for (const value of [null, 2010, "", "2010-2-03", "0000-01-01", "1900-02-29", "2024-04-31", "2020-00-01", "2020-01-00", "2020-01-01T00:00:00Z", "2020-01-01\n", " 2020-01-01"]) assert.throws(() => parseDateOfBirth(value));
  for (const value of ["2000-02-29", "2024-02-29", "0001-01-01"]) assert.equal(parseDateOfBirth(value), value);
  assert.throws(() => ageOn("2027-01-01", "2026-11-14"));
});
test("13/16/18 calendar boundaries and leap-day March-1 convention", () => {
  for (const age of [13, 16, 18]) {
    const dob = `${2026 - age}-11-14`;
    assert.equal(ageOn(dob, "2026-11-13"), age - 1);
    assert.equal(ageOn(dob, "2026-11-14"), age);
    assert.equal(ageOn(dob, "2026-11-15"), age);
  }
  assert.equal(ageOn("2012-02-29", "2025-02-28"), 12);
  assert.equal(ageOn("2012-02-29", "2025-03-01"), 13);
  assert.equal(ageOn("2012-02-29", "2028-02-28"), 15);
  assert.equal(ageOn("2012-02-29", "2028-02-29"), 16);
});
test("Dublin calendar changes at local midnight, including summer time", () => {
  assert.equal(dublinToday(new Date("2026-07-01T23:30:00Z")), "2026-07-02");
  assert.equal(dublinToday(new Date("2026-01-01T23:30:00Z")), "2026-01-01");
  assert.equal(ageOn("2013-07-02", dublinToday(new Date("2026-07-01T23:30:00Z"))), 13);
});
test("independent assurance requires distinct evidence; a source/declaration is insufficient", () => {
  assert.deepEqual(parseAgeAssurance({ verification: "none" }), { verification: "none" });
  for (const input of [{ verification: "self-declared" }, { verification: "operator-entered" }, { verification: "independent" }, { verification: "none", method: "guardian-email" }]) assert.throws(() => parseAgeAssurance(input));
  const verified = { verification: "independent", method: "reviewed-external-evidence", verifiedAt: new Date(), evidenceReference: "private-reference" };
  assert.deepEqual(parseAgeAssurance(verified), verified);
});
test("permission defaults are fresh data only and never inferred from roles/safeguarding", () => {
  const first = newAccountPermissions(); first.publicPublishing = true;
  assert.deepEqual(newAccountPermissions(), { publicPublishing: false });
  for (const value of [undefined, null, {}, { publicPublishing: "true" }, { publicPublishing: 1 }, { isAdmin: true }, { publicPublishing: false, teacher: true }]) assert.throws(() => parseUserPermissions(value));
  for (const value of [false, true]) assert.deepEqual(parseUserPermissions({ publicPublishing: value }), { publicPublishing: value });
});
test("one common scope covers all sites and excludes live tuition", () => {
  assert.deepEqual(GROUP_EXPERIENCE_SCOPE.sites, ["puckle", "switchplay", "strat17"]);
  assert.equal(GROUP_EXPERIENCE_SCOPE.scopeId, "shared-group-experiences");
  assert.equal(GROUP_EXPERIENCE_SCOPE.includesLiveTuition, false);
});
