# Puckle — Communication Preferences

**Implementation specification v1.0 — approved wording and design, pending codebase verification**  
**Scope:** Puckle registration, preference storage, account settings and opt-out handling  
**Separate from:** Puckle Contact and Support page specification

## 1. Purpose and boundaries

Allow students, teachers and other interested parties to choose which **optional** communications Puckle may send them. The choices must be visible, explicit, accurately recorded and changeable later.

This is an MVP implementation of preferences, **not** a campaign manager, scheduled mailing system, automated SMS or WhatsApp marketing integration. Retain the existing registration, account verification, parental-approval and enquiry flows unless a narrowly necessary change is documented below.

The design in Sections 2–4 is a **product requirement**, not illustrative inspiration: implement the same compact structure, wording, order and interactions using the site's existing design language.

## 2. Exact registration design (shared component)

### Visual structure

A single compact section headed **Stay in touch with Puckle**, embedded in each relevant Join/sign-up form near the existing contact details and before final submission. Keep the surrounding form and its established visual styling.

Each choice is displayed as a row/section with:

1. The **bold preference title** on the left.
2. A compact two-option **Yes | No** segmented control on the right.
3. The supplied **muted, smaller explanatory line** directly below.
4. A subtle divider between successive choices.

Neither Yes nor No is selected initially. All choices should have equally prominent Yes and No controls. The layout should be compact on desktop and mobile; on narrow screens, allow the title/control to wrap or stack rather than clipping text or shrinking the control. Do not expand the section into large cards, large paragraphs or a Yes/No questionnaire with multiple stages.

### Student form: exact four choices, in this order

| Title | Exact supporting line |
|---|---|
| **Puckle Updates** | A fortnightly roundup of new maths content and activities. |
| **News and offers** | Major new features, special offers and promotions. |
| **Occasional personal contact** | We may get in touch to offer help or ask for feedback. |
| **Guided maths invitations** | Receive invitations to teacher-led maths programmes, from short revision activities to longer projects, where you progress at your own pace as part of a group. |

**Important meaning of the fourth choice:** it opts the student into **receiving invitations**, not joining an activity. The activities are teacher-led *asynchronous Group Experiences* built around a Deck. Students can progress independently while participating in a group; these are **not scheduled live group lessons**. They may be short revision activities or longer projects. Do not replace the approved wording with “small-group sessions”, “live classes”, “join now” or equivalent.

### Teacher form: exact four choices, in this order

The first three titles and supporting lines are identical to the student form.

Fourth choice:

- **Teacher collaboration invitations**
- *Opportunities to observe student learning, collaborate on teaching resources or explore professional development.*

This covers invitations to observe student Group Experiences, to work with other teachers on teaching resources and to join professional-learning activities. Do not imply that formal/accredited CPD is currently offered.

**Retain** the existing teacher-specific registration wording (including the message that Puckle will be in touch), teacher interest questions and submission behaviour.

### Other interested parties: three choices

Use only the **first three shared choices** (Puckle Updates, News and offers, Occasional personal contact) in the same order and design. Do not show guided maths or teacher collaboration invitations for this audience.

This sign-up may not create an authenticated account; inspect the current interested-party flow before choosing how to persist or edit preferences.

## 3. Conditional email and text controls

After the entire set of Yes/No choices, show **one** compact, subtly shaded channel-selection box **only if** at least one applicable category for *broadcast updates or invitations* is Yes:

**Receive updates and invitations by**  
☐ **Email**   ☐ **Text message**

For interested parties without a fourth invitation category, the same box may read **Receive updates by** (the categories available to that form contain no invitations).

Rules:

- The channel selector appears when **Puckle Updates = Yes** OR **News and offers = Yes** OR, for students/teachers, the corresponding **invitations = Yes**.
- **Occasional personal contact = Yes by itself does not reveal the channel box.** That is separate permission for occasional individual contact, by available email, SMS or phone as appropriate.
- Email and Text message are **independent checkboxes**, **both unchecked initially**, so either or both may be chosen.
- At least one delivery method is required if any broadcast/invitation category is Yes.
- All selected channels apply to **every enabled broadcast/invitation category**; there is no per-category channel picker in this version.
- Text message requires a valid usable mobile number. Reuse the app's existing international phone-input component and validation where present. Only request additional phone input if needed; do not unnecessarily force everyone to provide a mobile number.
- If all broadcast/invitation categories are No, hide the channel box and persist no enabled broadcast channels. Do not mistake an invisible previously selected channel for subscription consent.
- The channel selector **does not** opt users into WhatsApp marketing. WhatsApp remains a separate incoming support/contact method, not an update-delivery option in this feature.

## 4. Decisions and validation

- On **new registrations**, each applicable Yes/No decision begins **unanswered**. The user must explicitly choose either **Yes** or **No** for every one before submission. None can be preselected.
- A full set of **No** choices is perfectly valid and must not inhibit signup.
- Keep the exact same ability and visual prominence to select **No** as **Yes**; never label one as the recommended/default choice.
- When a user tries to submit with unanswered decisions or a missing required channel/mobile number, present a succinct **inline error near the relevant control**, keep their entered data, and focus/announce errors accessibly.
- If a parent/guardian approval step or existing sign-up step separates user entry from final account creation, maintain the choices through that flow. Do not bypass or alter approval requirements.
- Existing members with no saved preferences are **unknown/unanswered**, not opted in and not implicitly “No”. They may continue using their account without completing this new section at login.

## 5. Meaning and scope of the four preferences

### Puckle Updates

A fortnightly bulletin about new maths content, upcoming activities and developments at Puckle. The **proposed editorial cadence** is **every second Thursday at 5 pm, Irish time**. This is a single roundup, not an alert every time an individual Card or Deck changes. **Do not implement an automated schedule in this work.**

### News and offers

Occasional major features, new services, offers and promotions. It is a separate opt-in: consent to Puckle Updates is not blanket permission for unrelated promotions. Respect the distinction when compiling any message lists or content.

### Occasional personal contact

Permission for Puckle to **initiate** occasional individual contact, such as offering help or asking for ideas/feedback. This may happen through available email, SMS or telephone contact details where appropriate. It is **not** permission for routine, repeated unsolicited contact, and it is not a prerequisite for answering an enquiry the person initiated.

### Guided maths invitations / Teacher collaboration invitations

Permission to send individual or group invitations to the corresponding opportunities described above. This choice is **not** acceptance of an invitation, enrolment into a Group Experience, booking or consent to paid tuition. Sending an invitation should be governed by the selected Email/Text message delivery channels.

## 6. Contact, support and teacher enquiries are separate

Regardless of these optional choices, retain essential service communications needed to operate accounts, including verification, password/account recovery, relevant parental-approval correspondence, important service notices, and responses to help requests.

- A teacher who describes an interest when registering can receive a **relevant reply to that expressed interest**, including where Occasional personal contact is No. Their existing “we'll be in touch” copy stays.
- The same distinction applies to a student or other interested party asking for assistance or information: Puckle can respond to that enquiry without treating it as an opt-in for future unrelated outreach.
- Users may initiate technical support through the contact form, `support@puckleup.com`, the published numbers or official Puckle WhatsApp Business; these support actions are not controlled by marketing preferences.
- Do not silently add communications preferences to the separate Contact and Support enquiry form.

## 7. Students under 16

Preserve the agreed practical safeguarding distinction:

- A student can initiate ordinary help requests; Puckle may respond to the request without first obtaining permission for each routine support interaction.
- A student opting into Occasional personal contact is **not by itself parental authorisation** for an outbound, planned or extended one-to-one telephone conversation. For proactive or extended one-to-one calls, contact the parent/guardian first and obtain agreement.
- Do not automatically notify a parent after every short routine support interaction.
- Do not change the existing parental-approval requirements, screens, email content, or account-access rules in this feature.

**Compliance checkpoint:** The product serves children in Ireland and the UK. Before sending optional promotional messages, the operator should confirm the applicable electronic-marketing and children's-data requirements, parental involvement where necessary, and the privacy copy. Claude should **flag** any gap it discovers rather than inventing a new consent/parental approval workflow or declaring every Yes response legally sufficient. This checkpoint is not permission for a broad compliance redesign.

## 8. Data model and server-side validation

Inspect the existing user/member models, Join routes/APIs and other-interested-party submission storage before choosing field names. Reuse appropriate existing records rather than inventing a marketing platform.

Conceptual data to persist:

- `puckleUpdates`: Yes / No / unanswered
- `newsAndOffers`: Yes / No / unanswered
- `occasionalPersonalContact`: Yes / No / unanswered
- `guidedMathsInvitations` **for students** or `teacherCollaborationInvitations` **for teachers**: Yes / No / unanswered
- Shared delivery channels: email selected, SMS selected
- Recorded/updated timestamp(s), and sufficient provenance to establish the preferences' source and wording/version (lightweight, not a full audit platform)

These are **conceptual names only**, not instructions to rename existing schema fields. Keep data scoped to Puckle rather than inadvertently modifying the other site identities.

Server-side requirements:

1. Validate the correct number of answered decisions for new sign-ups by audience (four or three).
2. Enforce the dependent email/SMS and mobile-number constraints, not merely in the browser.
3. Never infer opt-in from a missing value or from an older account.
4. Save preferences atomically with the relevant registration/interest record when practicable; do not create an orphan subscription if registration fails.
5. Validate updates to preferences and ensure only the correct account or authorised token holder can edit them.
6. Disabling a category or channel must take effect for future recipient selection.
7. Do not add a general-purpose campaign service, event bus or duplicated subscriber database unless the existing code genuinely requires it. If so, explain before changing scope.

## 9. Updating choices after registration

**Signed-in students and teachers:** Add a **Communication Preferences** section in the existing appropriate account/settings area, matching the same titles, supporting lines, Yes/No appearance and conditional channel box. Saved Yes/No values are pre-populated **here** because these are *editing screens*, unlike new registration. Save changes clearly and persist them.

**Other interested parties:** Since they may not have an account, provide a minimal secure way to change or withdraw choices without requiring account creation. Prefer reuse of existing unsubscribe/update link infrastructure; if absent, propose a small, safe signed-link/token approach that does not expose the record or other users' details. Confirm the actual storage/notification flow before choosing an implementation.

**Existing users:** Never migrate missing choices to opted-in values. They retain normal access and can set their preferences via account settings, without a forced sign-in interruption. Do not require an elaborate migration or onboarding flow.

**Opt-out handling:** Future optional emails/texts must honour withdrawals. Provide a clear unsubscribe/preference-change path on optional messages when sending is introduced; if no sending infrastructure yet exists, ensure stored choices and recipient filtering can support that process. An opted-out person still receives requested replies and essential service communications.

## 10. Founder notifications and future recipient use

- Continue existing founder/administrative notifications on each registration or interest submission.
- Include a small, legible summary of the saved communication selections **without changing unrelated notification delivery or destinations**.
- If any existing tools generate mailing or outreach lists, update or design the filtering so each category requires explicit Yes and a selected permitted channel; exclude unknown, No, and withdrawn preferences.
- This feature does **not** send an immediate welcome marketing message, an automated bulletin, SMS or WhatsApp campaign simply because someone selected Yes.

## 11. Privacy, content and terminology

- Review Puckle's registration disclosures and Privacy page for accuracy about the four purposes, delivery channels, how to change preferences, and the difference between essential support/account messages and optional outreach.
- Preserve teacher-specific wording and existing parent-related copy except where a precise communications disclosure is necessary; report material text changes.
- Keep the exact user-facing titles/descriptions from Section 2. Do not substitute internal “Group Experience” terminology in the Join form, and do not call asynchronous guided maths activities “live sessions”.
- Use `programmes` spelling (as approved).

## 12. Implementation locations to inspect and update

The final changed-file list must be based on the repository, not assumed paths. Inspect at minimum:

1. Student Join page/form and submission route.
2. Teacher Join page/form and submission route.
3. Other interested-party form (including storage and notification route).
4. Existing shared form controls, international phone input and any current consent-related UI.
5. Member schema, registration model and existing interest-submission schema.
6. Account/settings UI and its relevant API(s).
7. Founder registration/enquiry notifications.
8. Relevant privacy/disclosure text.
9. Existing tests for all three registration flows and account settings.

Reuse shared UI where genuinely useful without coupling different site branding or introducing a large new framework.

## 13. Acceptance tests and manual checks

**Automated, focused coverage**:

- Student: four controls with exact labels/copy; teacher: correct teacher-specific fourth; other: only three.
- No preselected answers on new registration; Yes and No both work; all No is accepted.
- Submission blocks missing answers and surfaces a clear inline error.
- Channel box appears when either update category or corresponding invitation category is Yes; personal-contact Yes alone does not show it.
- Channel box supports Email, Text, or both; neither is prechecked; none selected when required is an error.
- SMS requires a valid mobile number; changing selections does not result in stale hidden consent.
- API rejects fabricated or contradictory preference payloads.
- Saved preferences survive registration and the existing verification/guardian flow.
- Account-settings edits persist, including opting out; existing users remain opted out/unknown unless they answer.
- Interest-party choices persist with the right record and can be withdrawn without an account.
- Founder notifications show the correct choices.
- No regressions in Join submission, teacher interest fields, email verification, parental approval or Contact and Support enquiries.

**Manual browser review**: both desktop and iPhone-size widths (~390 px), long fourth description, control wrapping, keyboard/touch accessibility, validation focus and changing preferences in settings. Run only relevant existing test suites plus TypeScript/lint; report other unrelated failing tests rather than broadening scope automatically.

## 14. Explicitly excluded

- Changes to the separately specified Contact and Support page.
- A second WhatsApp Business identity or marketing over WhatsApp.
- Automated SMS provider integration, scheduled emails, a bulk-mail campaign dashboard or campaign analytics.
- Group Experience creation, joining, payment, entitlement or membership logic.
- Changes to post-login learning experiences, authentication rules, current parent/guardian approvals or unrelated site identities.
- Automatic changes to consent defaults, pre-selected Yes answers, forced marketing consent, or marketing messages sent merely by registering.

## 15. Delivery and review expectations

Before editing, Claude must inspect existing implementation, identify reuse opportunities and flag any **material** incompatibilities or unsettled legal/product decisions. Do not replace approved product decisions with agent preferences. Implement as directly as practicable once existing paths are verified. Add relevant tests first where feasible and report the results and any actual blockers. **No commit, push, merge or deploy without explicit approval.**

