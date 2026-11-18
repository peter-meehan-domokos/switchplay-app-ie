import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type EnquiryRequestData,
  resolvePreferredContactMethod,
  validateTuitionEnquiry,
} from "../src/app/sites/puckle/lib/publicTuitionEnquiry";

const under18: EnquiryRequestData = {
  enquirerType: "student-under-18",
  studentName: "Aoife",
  contactName: "Mary Murphy",
  mathsCourse: "junior-cycle",
  email: "mary@example.com",
  preferredContactMethod: "email",
};
const adult: EnquiryRequestData = {
  enquirerType: "student-adult",
  contactName: "Sam Tester",
  mathsCourse: "leaving-cert",
  phone: "087 123 4567",
  phoneCountryCode: "IE",
  preferredContactMethod: "text",
};
const parent: EnquiryRequestData = {
  enquirerType: "parent-guardian",
  contactName: "Pat Parent",
  studentName: "Jamie",
  mathsCourse: "gcse",
  email: "Pat@Example.com",
  phone: "+353 87 123 4567",
  preferredContactMethod: "phone",
  message: "  Questions about Leaving Cert  ",
};

function errors(input: EnquiryRequestData) {
  const result = validateTuitionEnquiry(input);
  assert.equal(result.ok, false);
  return result.ok ? {} : result.fieldErrors;
}

test("a student under 18 is stored with the parent or guardian as the contact", () => {
  const result = validateTuitionEnquiry(under18);
  assert.ok(result.ok);
  assert.deepEqual(result.data, {
    enquirerType: "student-under-18",
    studentName: "Aoife",
    contactName: "Mary Murphy",
    contactRelationship: "parent-guardian",
    mathsCourse: "junior-cycle",
    email: "mary@example.com",
    phone: null,
    preferredContactMethod: "email",
    message: "",
  });
});

test("an adult student is both the student and the contact", () => {
  const result = validateTuitionEnquiry({ ...adult, studentName: "ignored" });
  assert.ok(result.ok);
  assert.equal(result.data.studentName, "Sam Tester");
  assert.equal(result.data.contactName, "Sam Tester");
  assert.equal(result.data.contactRelationship, "self");
  assert.equal(result.data.phone, "+353871234567");
  assert.equal(result.data.email, null);
});

test("a parent or guardian provides their own name and the student's first name", () => {
  const result = validateTuitionEnquiry(parent);
  assert.ok(result.ok);
  assert.equal(result.data.contactName, "Pat Parent");
  assert.equal(result.data.studentName, "Jamie");
  assert.equal(result.data.contactRelationship, "parent-guardian");
  assert.equal(result.data.email, "pat@example.com");
  assert.equal(result.data.phone, "+353871234567");
  assert.equal(result.data.message, "Questions about Leaving Cert");
});

test("conditional names are required for each enquirer type", () => {
  assert.ok(errors({ ...under18, studentName: "" }).studentName);
  assert.ok(errors({ ...under18, contactName: "" }).contactName);
  assert.ok(errors({ ...parent, studentName: "" }).studentName);
  assert.ok(errors({ ...parent, contactName: "" }).contactName);
  assert.ok(errors({ ...adult, contactName: "" }).contactName);
  assert.equal(errors({ ...adult, contactName: "" }).studentName, undefined);
});

test("the enquirer type is required and must be one of the three options", () => {
  assert.ok(errors({ ...adult, enquirerType: "" }).enquirerType);
  assert.ok(errors({ ...adult, enquirerType: "teacher" }).enquirerType);
});

test("email-only, mobile-only and both are accepted", () => {
  assert.ok(validateTuitionEnquiry({ ...parent, phone: "", preferredContactMethod: "email" }).ok);
  assert.ok(validateTuitionEnquiry({ ...parent, email: "", preferredContactMethod: "text" }).ok);
  assert.ok(validateTuitionEnquiry({ ...parent, preferredContactMethod: "email" }).ok);
});

test("at least one valid contact method is required", () => {
  const noContact = errors({ ...parent, email: "", phone: "" });
  assert.ok(noContact.contact);
  assert.equal(noContact.preferredContactMethod, undefined);
});

test("invalid email and phone details are rejected", () => {
  assert.ok(errors({ ...parent, email: "not-an-email" }).email);
  assert.ok(errors({ ...parent, phone: "abc" }).phone);
  assert.ok(errors({ ...parent, phone: "+1" }).phone);
  assert.ok(errors({ ...parent, phone: "1".repeat(40) }).phone);
});

test("international and Irish mobile numbers are accepted", () => {
  for (const [phone, countryCode, expected] of [
    ["087 123 4567", "IE", "+353871234567"],
    ["+44 7700 900123", "IE", "+447700900123"],
    ["(415) 555-2671", "US", "+14155552671"],
  ]) {
    const result = validateTuitionEnquiry({ ...parent, email: "", phone, phoneCountryCode: countryCode, preferredContactMethod: "text" });
    assert.ok(result.ok, phone);
    assert.equal(result.data.phone, expected);
  }
});

test("the preferred contact method must be compatible with the contact details", () => {
  assert.ok(errors({ ...parent, phone: "", preferredContactMethod: "text" }).preferredContactMethod);
  assert.ok(errors({ ...parent, phone: "", preferredContactMethod: "phone" }).preferredContactMethod);
  assert.ok(errors({ ...parent, email: "", preferredContactMethod: "email" }).preferredContactMethod);
  assert.ok(errors({ ...parent, preferredContactMethod: "carrier-pigeon" }).preferredContactMethod);
});

test("a missing preferred method is implied for a single contact detail but required for two", () => {
  const emailOnly = validateTuitionEnquiry({ ...parent, phone: "", preferredContactMethod: "" });
  assert.ok(emailOnly.ok);
  assert.equal(emailOnly.data.preferredContactMethod, "email");

  const phoneOnly = validateTuitionEnquiry({ ...parent, email: "", preferredContactMethod: "" });
  assert.ok(phoneOnly.ok);
  assert.equal(phoneOnly.data.preferredContactMethod, "text");

  assert.ok(errors({ ...parent, preferredContactMethod: "" }).preferredContactMethod);
});

test("resolvePreferredContactMethod picks a compatible default", () => {
  assert.equal(resolvePreferredContactMethod({ email: "a@b.co", phone: "", preferredContactMethod: "text" }), "email");
  assert.equal(resolvePreferredContactMethod({ email: "", phone: "+353871234567", preferredContactMethod: "email" }), "text");
  assert.equal(resolvePreferredContactMethod({ email: "", phone: "+353871234567", preferredContactMethod: "phone" }), "phone");
  assert.equal(resolvePreferredContactMethod({ email: "a@b.co", phone: "+353871234567", preferredContactMethod: "phone" }), "phone");
  assert.equal(resolvePreferredContactMethod({ email: "", phone: "", preferredContactMethod: "" }), "");
});

test("the message is optional and length limited", () => {
  assert.ok(validateTuitionEnquiry({ ...parent, message: "" }).ok);
  assert.ok(errors({ ...parent, message: "x".repeat(801) }).message);
});

test("a maths course is required and must be one of the five supported options", () => {
  for (const base of [under18, adult, parent]) {
    assert.ok(errors({ ...base, mathsCourse: "" }).mathsCourse);
    assert.ok(errors({ ...base, mathsCourse: undefined }).mathsCourse);
    assert.ok(errors({ ...base, mathsCourse: "ib-maths" }).mathsCourse);
    assert.ok(errors({ ...base, mathsCourse: "Leaving Cert maths" }).mathsCourse);
  }
});

test("each supported maths course is accepted and stored for every enquirer type", () => {
  for (const mathsCourse of ["leaving-cert", "junior-cycle", "gcse", "a-level", "other"]) {
    for (const base of [under18, adult, parent]) {
      const result = validateTuitionEnquiry({ ...base, mathsCourse });
      assert.ok(result.ok, `${base.enquirerType}/${mathsCourse}`);
      assert.equal(result.data.mathsCourse, mathsCourse);
    }
  }
});
