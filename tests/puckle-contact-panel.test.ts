import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildContactPanelLayout } from "../src/app/sites/puckle/lib/contactPanelLayout";

const layout = buildContactPanelLayout();

test("groups appear in order with their titles and descriptions", () => {
  assert.deepEqual(layout.groups.map(g => [g.title, g.text, g.whatsapp.label, g.email.address]), [
    ["Technical support", "Having trouble using Puckle?", "WhatsApp support", "support@puckleup.com"],
    ["General enquiries", "Lessons, ideas, feedback or other questions.", "WhatsApp Puckle", "hello@puckleup.com"],
  ]);
  assert.deepEqual([layout.phone.title, layout.phone.text], ["Call or text", "For urgent technical support or general enquiries."]);
});
test("both WhatsApp buttons use the Irish business account only, with no prefilled text", () => {
  for (const g of layout.groups) assert.equal(g.whatsapp.href, "https://wa.me/353852076241");
  const all = JSON.stringify(layout);
  assert.ok(!all.includes("wa.me/44") && !all.includes("?text="));
});
test("email addresses link with mailto", () => {
  assert.deepEqual(layout.groups.map(g => g.email.href), ["mailto:support@puckleup.com", "mailto:hello@puckleup.com"]);
});
test("both numbers are shown in international format with tel and sms links", () => {
  assert.deepEqual(layout.phone.rows.map(r => [r.country, r.display, r.callHref, r.textHref]), [
    ["Ireland", "+353 85 207 6241", "tel:+353852076241", "sms:+353852076241"],
    ["UK", "+44 7547 196642", "tel:+447547196642", "sms:+447547196642"],
  ]);
});
test("the contact page replaces the old panel and puts the heading directly above the unchanged form", () => {
  const page = readFileSync("src/app/sites/puckle/contact/page.tsx", "utf8");
  assert.ok(!page.includes("Prefer email"));
  assert.ok(page.indexOf("<ContactPanel />") < page.indexOf("Or send us a message"));
  assert.ok(page.indexOf("Or send us a message") < page.indexOf("<ContactSupportForm />"));
});
