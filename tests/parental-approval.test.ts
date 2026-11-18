import assert from "node:assert/strict";
import { test } from "node:test";
import { approvalEligibility, maskEmail } from "../src/lib/parentalApproval";
import { emailActionDocument } from "../src/lib/emailActionDocument";
import { GROUP_EXPERIENCE_EXPLANATION, GROUP_EXPERIENCE_SCOPE, GUARDIAN_DECLARATION, SUPPORT_EMAIL } from "../src/lib/parentalApprovalScope";

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
  const text = GROUP_EXPERIENCE_EXPLANATION.text;
  assert.equal(GROUP_EXPERIENCE_SCOPE.scopeId, "shared-group-experiences");
  assert.match(text, /Puckle/); assert.doesNotMatch(text, /switchplay|strat17/i); assert.doesNotMatch(text, /hello@/);
  assert.equal(GROUP_EXPERIENCE_EXPLANATION.version, "shared-group-experiences-v5-draft", "reworded text carries a new version; past approvals keep what they read");
  assert.match(text, /does not cover live tuition, which is arranged separately with you\./);
  assert.match(text, /Withdrawing approval stops future participation but does not delete your child's learning\./);
  assert.ok(GROUP_EXPERIENCE_EXPLANATION.version && GUARDIAN_DECLARATION.version);
  assert.match(GUARDIAN_DECLARATION.text, /parent or legal guardian/);
});
test("the approved explanation keeps its paragraphs and shows the three contact options as a list", () => {
  const blocks = GROUP_EXPERIENCE_EXPLANATION.text.split("\n\n");
  assert.equal(blocks.length, 6);
  assert.equal(blocks[0], "Puckle is a learning platform led by qualified and experienced secondary school maths teachers. Your child can study independently and take part in optional teacher-led activities.");
  assert.match(blocks[1], /^Group learning allows students to work through teacher-provided learning materials at their own pace/);
  assert.match(blocks[1], /Students cannot comment on each other's work, and there is no private messaging or sharing between students\. Your child's personal learning outside the group remains private\.$/);
  assert.equal(blocks[2], "Students under 16 need a parent or guardian's approval to take part in group learning. This approval does not cover live tuition, which is arranged separately with you.");
  assert.equal(blocks[3], "To discuss group learning or withdraw your approval, you can:");
  assert.deepEqual(blocks[4].split("\n"), ["- Reply to the email we sent you.", `- Email ${SUPPORT_EMAIL}.`, "- Call us on +353 85 207 6241 (Ireland) or +44 7547 196642 (UK)."]);
  assert.equal(blocks[5], "Withdrawing approval stops future participation but does not delete your child's learning.");
});
test("the parent page turns list paragraphs into lists and makes emails and phone numbers links", async () => {
  const page = await emailActionDocument().text();
  assert.match(page, /startsWith\('- '\)/); assert.match(page, /createElement\(list\?'ul':'p'\)/);
  assert.match(page, /'mailto:'\+m\[0\]/); assert.match(page, /'tel:\+'\+m\[0\]\.replace/);
  assert.match(page, /\.explanation ul\{/);
});
test("guardian addresses are masked in the student's summary", () => {
  assert.equal(maskEmail("parent@example.com"), "p•••••@example.com"); assert.equal(maskEmail("a@b.co"), "a•@b.co");
});

// Parents see "group learning" (they would not know what group experiences means). Nothing is capitalised as if it were a name.
test("terminology: everything a parent reads says group learning, and student copy never does; none is capitalised as a name", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => readFileSync(path, "utf8");
  const parentFacing = ["src/lib/accountEmailTemplates.ts", "src/lib/emailActionDocument.ts", "src/lib/parentalApprovalScope.ts"].map(read).join("\n");
  assert.match(parentFacing, /group learning/i); assert.doesNotMatch(parentFacing, /group experiences|group options/i);
  const privacy = read("src/app/sites/puckle/privacy/page.tsx"), parentSection = privacy.slice(privacy.indexOf("Parent or guardian approval"));
  assert.match(parentSection, /group learning/); assert.doesNotMatch(parentSection.slice(0, parentSection.indexOf("</section>")), /group experiences|group options/i);
  const studentFacing = ["src/components/onboarding/onboardingLayout.ts", "src/app/sites/puckle/lib/membershipJoinLayout.ts"].map(read).join("\n");
  assert.doesNotMatch(studentFacing, /group learning|group features/i);
  // Capital G only at the start of a sentence, heading or title.
  for (const file of [...["src/components/onboarding/onboardingLayout.ts", "src/app/sites/puckle/lib/membershipJoinLayout.ts", "src/app/sites/puckle/lib/communicationPreferences.ts", "src/app/sites/puckle/privacy/page.tsx"], ...["src/lib/accountEmailTemplates.ts", "src/lib/parentalApprovalScope.ts"]]) {
    for (const match of read(file).matchAll(/(.{0,3})Group (experiences?|learning|options?)/g)) assert.match(match[1], /(^|[.!?"'`>]\s*|\s")$/, `${file}: "${match[0]}" is capitalised mid-sentence`);
  }
});
