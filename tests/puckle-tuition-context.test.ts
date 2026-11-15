import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTuitionContext, hidesEnquirerSelector, parseTuitionContext } from "../src/app/sites/puckle/lib/tuitionEnquiryLayout";
import type { EnquiryFormValues } from "../src/app/sites/puckle/lib/publicTuitionEnquiry";

const blank: EnquiryFormValues = { enquirerType: "", studentName: "", contactName: "", mathsCourse: "", email: "", phone: "", phoneCountryCode: "IE", preferredContactMethod: "", message: "", companyWebsite: "" };
test("malformed or incomplete context keeps the original selection flow", () => {
  for (const value of [null, undefined, "x", [], {}, { mode: "student-adult" }, { mode: "student-under-18", studentName: "" }, { mode: "admin", name: "x" }]) {
    const context = parseTuitionContext(value); assert.equal(context.mode, "unknown"); assert.equal(hidesEnquirerSelector(context), false); assert.equal(applyTuitionContext(blank, context), blank);
  }
});
test("under-18 context fills only the student's name and course, never guardian contact fields", () => {
  const context = parseTuitionContext({ mode: "student-under-18", studentName: "Aoife", mathsCourse: "gcse", email: "student@example.com", phone: "+353871234567" });
  assert.equal(hidesEnquirerSelector(context), true);
  assert.deepEqual(applyTuitionContext(blank, context), { ...blank, enquirerType: "student-under-18", studentName: "Aoife", mathsCourse: "gcse" });
});
test("adult context prefills editable contact details and never overwrites what was typed", () => {
  const context = parseTuitionContext({ mode: "student-adult", name: "Sam", mathsCourse: "bogus", email: "sam@example.com", phone: "+353871234567" });
  assert.deepEqual(applyTuitionContext(blank, context), { ...blank, enquirerType: "student-adult", contactName: "Sam", email: "sam@example.com", phone: "+353871234567" });
  const typed = applyTuitionContext({ ...blank, contactName: "Samantha", email: "other@example.com", mathsCourse: "a-level" }, context);
  assert.deepEqual([typed.contactName, typed.email, typed.mathsCourse, typed.phone], ["Samantha", "other@example.com", "a-level", "+353871234567"]);
});
