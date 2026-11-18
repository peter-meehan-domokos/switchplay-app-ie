# Puckle communication preferences (Join form, storage, recipient rule)

Implements the registration, storage and validation parts of `docs/design/sites/puckle/puckle-communication-preferences-spec.md`.
Account settings and a no-account manage link are **not** built yet; see Open decisions.

## Behaviour
- The Join form (student, teacher, interested party) shows a "Stay in touch with Puckle" section: four Yes | No choices for students and
  teachers, three for interested parties, with the approved titles and lines. Nothing is preselected and every choice must be answered.
  An all-No set is valid.
- A delivery box ("Receive updates and invitations by" / "Receive updates by" for interested parties) appears only while Puckle Updates,
  News and offers or the audience's invitation choice is Yes. Occasional personal contact alone never shows it. Email and Text message are
  independent, unchecked checkboxes; at least one is required. Email needs an email address, Text needs a valid mobile number.
  Clearing the last broadcast Yes clears both channels, so hidden state never lingers as consent. On the mobile-only route only Text is offered.
- Switching between student, teacher and interested clears the audience-specific invitation answer.

## Code
- `src/app/sites/puckle/lib/communicationPreferences.ts` - approved wording, stored shape, `validateCommunicationPreferences` (authoritative,
  used by every server path), `isOptedIn` (recipient filtering) and `describePreferences` (founder summary).
- `src/app/sites/puckle/lib/communicationPreferencesLayout.ts` - pure state, `with*` helpers, client validation and `buildPreferencesLayout`.
- `src/app/sites/puckle/components/CommunicationPreferences.tsx` - renders the layout. `membershipJoinLayout.ts` wires it into the Join form.

## Storage
`communicationPreferences: { answers, channels: { email, sms }, source, wordingVersion, recordedAt }` is saved on the same record as the
sign-up, in the same insert (atomic with the account transaction): `puckleMemberships` (accounts), `puckleJoinContactRequests` (mobile-only
requests) and `puckleInterestContacts` (interested parties). A missing field means unknown: never opted in, never implicitly No.
`wordingVersion` is `puckle-communication-preferences-v1`; `source` is `join-form` or `join-interest-form`. The old implied
`communication.emailUpdates` field is no longer written (legacy records keep it).

## Recipient rule
Any future optional message must use `isOptedIn(prefs, key, channel)`: an explicit Yes and a selected channel. Unknown, No, withdrawn and
missing records never match. Occasional personal contact needs only the Yes. No sending infrastructure is added.

## Founder alerts
Student, teacher, mobile-only and interest alerts end with a short "Communication choices" summary. Destinations are unchanged.

## Open decisions (not implemented)
1. **Account settings.** Puckle has no account or settings page, so there is nowhere obvious to put "Communication Preferences".
2. **Manage link for people without an account.** There is no existing unsubscribe or update link infrastructure for them. A signed-link
   approach is possible but is a new security mechanism, so it needs approval before it is built.
