# Puckle — Contact and Support Page

**Implementation specification — v3 (agreed design)**  
**Scope:** Puckle public website only, including its existing Contact and Support page.  
**Status:** Ready for implementation review. No changes are authorised beyond this specification.

## 1. Goal

Make WhatsApp the most prominent way to reach Puckle, while offering clear email support and general-enquiry addresses, two country-specific numbers for calls and SMS, and the existing contact form. The page should stay compact, readable, and mobile-first. It must not imply round-the-clock availability.

## 2. Current page and what changes

The current iPhone screenshot shows:
- Puckle header and navigation.
- H1 **Contact and support**.
- Intro: **Have a question, need help or want to work with us? We'd love to hear from you.**
- A shaded **“Prefer email? Contact us directly at hello@puckleup.com.”** panel.
- Below it, an existing form starting with **Name**, **How can we contact you?**, **Email address**, **Mobile phone number**, followed by other enquiry categories and a message field further down.

**Keep** the header, H1, intro, page styling and form. **Replace only** the “Prefer email?” panel with the new compact contact panel specified below. Insert the heading **Or send us a message** above the existing form. Do not replace or redesign the form.

## 3. Exact content and hierarchy

Use a single compact contact-information panel, visually consistent with the current dark Puckle page. Within the panel, present these three groups in order, separated by subtle dividers or equivalent spacing:

### A. Technical support

- Title: **Technical support**
- Description: **Having trouble using Puckle?**
- Primary action: **WhatsApp support** — prominent WhatsApp button.
- Email address shown plainly and visibly beneath the button: **support@puckleup.com** (clickable email link).

### B. General enquiries

- Title: **General enquiries**
- Description: **Lessons, ideas, feedback or other questions.**
- Primary action: **WhatsApp Puckle** — prominent WhatsApp button.
- Email address shown plainly and visibly beneath the button: **hello@puckleup.com** (clickable email link).

### C. Call or text

- Title: **Call or text**
- Description: **For urgent technical support or general enquiries.**
- Ireland line: label **Ireland**, number **+353 85 207 6241**, actions **Call** and **Text**.
- UK line: label **UK**, number **+44 7547 196642**, actions **Call** and **Text**.

The number itself must be visible, selectable/copyable and clickable to call. The adjacent **Call** action also initiates a call; the **Text** action starts an SMS. If space is tight on mobile, wrap the buttons below the relevant number rather than squeezing, truncating or hiding content. No additional heading or promotional copy about WhatsApp is needed.

Immediately after the panel:

- Heading: **Or send us a message**
- Then the **existing form, unchanged**.

The examples above define content and ordering, not a mandate to create a new component library or change existing global styles.

## 4. Exact destinations and link semantics

| Visible element | Link or action |
| --- | --- |
| WhatsApp support | `https://wa.me/353852076241` |
| WhatsApp Puckle | `https://wa.me/353852076241` |
| support@puckleup.com | `mailto:support@puckleup.com` |
| hello@puckleup.com | `mailto:hello@puckleup.com` |
| Irish number (+353 85 207 6241) | `tel:+353852076241` |
| Ireland **Call** | `tel:+353852076241` |
| Ireland **Text** | `sms:+353852076241` |
| UK number (+44 7547 196642) | `tel:+447547196642` |
| UK **Call** | `tel:+447547196642` |
| UK **Text** | `sms:+447547196642` |

Use ordinary semantic anchors (`href`) for these actions, rather than JavaScript-only click handlers. Use actual address/number text rather than hiding details behind generic email/phone buttons. The link text should have obvious link styling, remain visible and easy to copy. WhatsApp actions should be prominent but visually restrained and consistent with the site. Neither WhatsApp link should send a message automatically or prefill unapproved text.

**Important UK account distinction:** The UK number does have a **personal** WhatsApp account, but it is **not** an official Puckle WhatsApp account. Do **not** link to WhatsApp on the UK number. Puckle's sole published/official WhatsApp Business account is the Irish number, used for customers in both countries. There is no need to describe the UK personal account on the public page.

The numbers are for calls and standard SMS, as well as the Irish WhatsApp Business account separately. On a desktop without a native call/SMS client, preserve the conventional link and let the browser/device handle it; do not add bespoke JavaScript fallbacks.

## 5. Presentation and responsive behaviour

- Preserve the current Puckle dark theme, heading typography, spacing language, and existing subtle accent treatment for the old information panel where appropriate.
- Prefer one unified panel with three clearly separated groups, **not** three large stacked cards.
- WhatsApp appears first under both **Technical support** and **General enquiries**; the respective visible email address is immediately below it.
- Email addresses are not just labels inside buttons. Visitors must see the actual addresses and be able to copy them.
- Display both full international numbers (with country labels) and distinct, accessible **Call** and **Text** actions. Avoid making the two countries look like separate WhatsApp destinations.
- Avoid overly large icons, duplicated phone numbers outside their country rows, inflated vertical spacing, and extra explanatory copy.
- On narrow mobile screens, allow phone rows/actions to wrap naturally. Never allow horizontal overflow.
- Maintain adequate touch targets, visible keyboard focus, sufficient contrast, accessible names and semantic headings/links.
- Optional icons may reuse the site's existing icon system; do not introduce a new icon dependency for this change.
- No new opening-hours or response-time claim. **“For urgent technical support or general enquiries”** identifies a contact method, not a guarantee of immediate response.

## 6. Existing contact form must be preserved

Keep the current form's:
- Name and contact fields, including its current phone-input component and country selection.
- Existing enquiry categories and message field.
- Form explanations, validation, accessibility and error handling.
- Submission endpoint, routing, notifications, anti-abuse measures and success behaviour.

No changes to form payloads, account system, registration, parental approval, mailing setup, database or backend logic are part of this task. A contact-information panel appearing above the form must not accidentally alter form nesting, layout, submit behaviour or autofill.

## 7. Contact channels and operational policy

- `support@puckleup.com` = technical support and help using Puckle.
- `hello@puckleup.com` = lessons, general enquiries, feedback, ideas and partnerships.
- `+353 85 207 6241` = Irish calls/SMS and the **only public Puckle WhatsApp Business account**; used for Irish and UK WhatsApp contacts.
- `+44 7547 196642` = UK calls/SMS; WhatsApp on that number is personal and must not be advertised as a business channel.
- If someone approaches the UK personal WhatsApp about Puckle, a quick query may be answered there; for ongoing tuition/support, encourage moving to the Irish WhatsApp Business account. This is an operational practice, **not** a webpage feature or automated redirect.
- Students, including under-16s, may initiate genuine technical-support enquiries through the public channels. Do not add marketing opt-ins or parental-permission gates to the contact links or existing form. The separately agreed parent-first approach for proactive or planned longer calls is an operational guideline, not part of this UI change.

## 8. Related references on Puckle pages

Check nearby Puckle public-facing help/contact references for obvious contradictions (for example, an instruction to email `hello@` for technical support). Use the correct labels on the Contact and Support page. If the same public contact panel is shared from one component or content constant, update that source once.

**Do not globally replace `hello@puckleup.com`**: it remains correct for general contact, business correspondence and existing mail-sending configuration. Do not make unsolicited edits to other Puckle flows or to the other website identities served by the same application. Report any additional inconsistent locations rather than expanding implementation scope without approval.

## 9. Out of scope

- Creating or migrating WhatsApp accounts.
- New phone numbers, telephone subscriptions, SMS/WhatsApp integrations or automated messaging.
- Automatic redirection from the UK personal WhatsApp account.
- Changes to communication preferences / opt-in design on Join forms.
- Changes to the contact form, its backend, emails, sender configuration or data model.
- New availability commitments (24/7, guaranteed response times).
- Rebranding, global design-system changes, or changes to Puckle Yard / Puckle Clubs / other site variants.

## 10. Acceptance criteria and verification

1. The old **“Prefer email?”** box is gone, replaced by the new panel, on the Puckle Contact and Support page only.
2. Technical support lists **WhatsApp support** first and **support@puckleup.com** visibly below.
3. General enquiries lists **WhatsApp Puckle** first and **hello@puckleup.com** visibly below.
4. Both WhatsApp actions link to **the Irish Puckle WhatsApp Business account**; neither links to the UK personal account.
5. Both country numbers are displayed accurately in international format; the visible numbers and **Call** actions use correct `tel:` links, and the **Text** actions use correct `sms:` links.
6. Email addresses are fully visible, selectable/copyable and linked using correct `mailto:` URLs.
7. The existing form appears immediately after **Or send us a message**, with its contents and behaviour preserved.
8. Page is readable without horizontal overflow on iPhone-sized widths and desktop; links work by touch and keyboard.
9. No accidental changes to the other site identities, authentication, registration, notification email or backend behaviour.
10. Run focused existing tests for this page/route if present; add or update targeted checks for the new visible copy and destinations as appropriate; run TypeScript/lint checks relevant to the touched files. Verify real iPhone behaviour manually for WhatsApp, mail, call and SMS links; automated tests cannot fully verify native app handoff.

**Delivery report:** List changed files, test/check results, any existing form checks run, and anything not verifiable locally. Do not push, merge or deploy without explicit approval; do not commit until the owner has reviewed the result and authorised it.
