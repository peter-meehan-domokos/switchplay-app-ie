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
test("one common disclosure, in Puckle's name only, explains withdrawal and excludes live tuition", () => {
  assert.equal(GROUP_EXPERIENCE_SCOPE.scopeId, "shared-group-experiences");
  assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /Puckle/); assert.doesNotMatch(GROUP_EXPERIENCE_EXPLANATION.text, /switchplay|strat17/i);
  assert.equal(GROUP_EXPERIENCE_EXPLANATION.version, "shared-group-experiences-v4-draft", "reworded text carries a new version; past approvals keep what they read");
  assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /withdraw your approval at any time by replying to the email we sent you, or by emailing support@puckleup\.com\./i); assert.doesNotMatch(GROUP_EXPERIENCE_EXPLANATION.text, /hello@/); assert.doesNotMatch(GROUP_EXPERIENCE_EXPLANATION.text, /withdraw[^.]*link/i, "there is no withdrawal link"); assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /not permission for live tuition/);
  assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /one approval covers equivalent Group Learning anywhere in Puckle/i);
  assert.ok(GROUP_EXPERIENCE_EXPLANATION.version && GUARDIAN_DECLARATION.version);
  assert.match(GUARDIAN_DECLARATION.text, /parent or legal guardian/);
});
test("guardian addresses are masked in the student's summary", () => {
  assert.equal(maskEmail("parent@example.com"), "p•••••@example.com"); assert.equal(maskEmail("a@b.co"), "a•@b.co");
});

// Parents see "Group Learning" (they would not know what Group Experiences means); students see "Group Experiences".
test("terminology: everything a parent reads says Group Learning, and everything a student reads says Group Experiences", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => readFileSync(path, "utf8");
  const parentFacing = ["src/lib/accountEmailTemplates.ts", "src/lib/emailActionDocument.ts", "src/lib/parentalApprovalScope.ts"].map(read).join("\n");
  assert.match(parentFacing, /Group Learning/); assert.doesNotMatch(parentFacing, /Group Experiences/);
  const privacy = read("src/app/sites/puckle/privacy/page.tsx"), parentSection = privacy.slice(privacy.indexOf("Parent or guardian approval"));
  assert.match(parentSection, /Group Learning/); assert.doesNotMatch(parentSection.slice(0, parentSection.indexOf("</section>")), /Group Experiences/);
  const studentFacing = ["src/components/onboarding/onboardingLayout.ts", "src/app/sites/puckle/lib/membershipJoinLayout.ts"].map(read).join("\n");
  assert.match(studentFacing, /Group Experiences/); assert.doesNotMatch(studentFacing, /Group Learning|group features/i);
});
