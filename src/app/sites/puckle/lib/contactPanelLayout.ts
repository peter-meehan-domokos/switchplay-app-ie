import { CONTACT_EMAIL, PHONE_LINES, SUPPORT_EMAIL, WHATSAPP_URL } from "../siteInfo";

export type ContactEmailGroup = Readonly<{ id: string; title: string; text: string; whatsapp: Readonly<{ label: string; href: string }>; email: Readonly<{ address: string; href: string }> }>;
export type ContactPhoneRow = Readonly<{ country: string; display: string; callHref: string; textHref: string; callLabel: string; textLabel: string }>;
export type ContactPanelLayout = Readonly<{
  groups: readonly ContactEmailGroup[];
  phone: Readonly<{ id: string; title: string; text: string; rows: readonly ContactPhoneRow[] }>;
}>;

const emailGroup = (id: string, title: string, text: string, whatsappLabel: string, address: string): ContactEmailGroup => ({
  id, title, text, whatsapp: { label: whatsappLabel, href: WHATSAPP_URL }, email: { address, href: `mailto:${address}` },
});

/** Pure projection of the contact details. Links are plain hrefs: nothing is prefilled or sent automatically. */
export function buildContactPanelLayout(): ContactPanelLayout {
  return {
    groups: [
      emailGroup("contact-technical", "Technical support", "Having trouble using Puckle?", "WhatsApp support", SUPPORT_EMAIL),
      emailGroup("contact-general", "General enquiries", "Lessons, ideas, feedback or other questions.", "WhatsApp Puckle", CONTACT_EMAIL),
    ],
    phone: {
      id: "contact-phone", title: "Call or text", text: "For urgent technical support or general enquiries.",
      rows: PHONE_LINES.map(line => ({
        country: line.country, display: line.display, callHref: `tel:${line.e164}`, textHref: `sms:${line.e164}`,
        callLabel: `Call ${line.country} number`, textLabel: `Text ${line.country} number`,
      })),
    },
  };
}
