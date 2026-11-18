# Puckle communication preferences (Join form, storage, recipient rule)

Implements the registration, storage and validation parts of `docs/design/sites/puckle/puckle-communication-preferences-spec.md`.
Account settings and a no-account manage link are **not** built yet; see Open decisions.

## Behaviour
- The Join form shows a "Stay in touch with Puckle" section. Students and teachers answer two Yes | No questions (Puckle Updates, with
  audience wording, and Occasional personal contact); interested parties answer three (Puckle Updates, News and offers, Occasional personal
  contact). Nothing is preselected and every question must be answered. An all-No set is valid.
- Presentation only: for students and teachers, Puckle Updates sets puckleUpdates, newsAndOffers and the audience invitation answer together
  (`withUpdatesAnswer` in the layout, so state, validation and payload keep all four stored preferences). The server contract, validator and
  stored shape are unchanged. Settings (`variant: "settings"`) shows the same stored preferences individually: New maths content, News and
  offers and the invitation preference nested under Puckle Updates with the delivery choice, and Occasional personal contact under
  Personal contact. The no-account manage page keeps the plain list.
- A delivery box ("Receive updates and invitations by" / "Receive updates by" for interested parties) appears only while Puckle Updates,
  News and offers or the audience's invitation choice is Yes. Occasional personal contact alone never shows it. Email and Text message are
  independent, unchecked checkboxes; at least one is required. Email needs an email address, Text needs a valid mobile number.
  Clearing the last broadcast Yes clears both channels, so hidden state never lingers as consent. On the mobile-only route only Text is offered.
- Switching between student and teacher keeps the derived answers in step with Puckle Updates; switching to interested party clears them.

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

## Changing choices later
- **Signed-in students and teachers: Settings.** The Puckle app menu has a **Settings** item (shown only on Puckle, through
  `SettingsLinkProvider`, so the other websites' menus are unchanged). `/settings` (`src/app/sites/puckle/settings`) holds one section,
  Communication Preferences, which is a section on a simple page so more settings can be added later. It uses the same layout, controls
  and validator as Join, with saved answers pre-populated (members with nothing saved see every choice unanswered). Saving calls
  `POST /api/account/communication-preferences`, which edits only the signed-in account's own membership. Text needs a mobile number; if
  none is on file the page asks for one and saves it with the choices. An existing number is never replaced there. Source: `account-settings`.
- **Interested parties with an email address: signed management link.** After sign-up the confirmation shows a link to
  `/preferences/manage#<token>`. The token is `<record id>.<HMAC>` (HMAC-SHA256 with `ACCOUNT_EMAIL_SECRET` over a fixed label, the
  collection and the id), compared in constant time. It opens only that one record's choices. It sits in the URL fragment, so it is never
  part of a page request, and is removed from the address bar once read. The page can change choices or unsubscribe from everything,
  with no account, through `POST /api/public/puckle/preferences` (origin-checked like the other public posts). Source: `preferences-link`.
  `manageLink(id)` is the helper any future optional email should put in its footer. No email is sent for this today.
- **Mobile-only sign-ups.** They have no link. Their confirmation says to text Puckle on +353 85 207 6241 (Ireland) or +44 7547 196642 (UK)
  to change or withdraw their choices. This stays a manual process; there is no automated SMS handling.

## Notes
- Pre-launch members cannot reach `/api/account/...` (the pre-launch gate blocks it) and do not see the app menu, so Settings is for
  fully launched members. No special pre-launch handling was added.
- The management link does not expire (like a conventional unsubscribe link) and is rate limited only by being unguessable.
