# Puckle — Membership, Registration and Tuition Enquiry Specification

**Status:** Product scope and independently reviewed implementation proposal, revised 14 November 2026; implementation requires separate approval.  
**Implementation:** Existing shared Next.js application, users collection and authentication.  
**Engineering plan:** [Membership engineering plan](../../../engineering/sites/puckle/membership-engineering-plan.md).

## 1. Purpose, principles and shared architecture

Puckle is a maths learning platform with optional expert tuition. Students may join, use available learning content, complete cards, record progress and communicate their learning needs without purchasing tuition. Teachers are welcome to explore and help shape the platform; other interested people can register for contact and updates without receiving application accounts.

There is one free student membership at launch. Tuition customers, independent learners and students attending introductory sessions do not receive different membership categories or privileges. No payment/subscription, voting system, guaranteed requested-content turnaround, classroom administration or extensive-library promise is part of this project.

Puckle, Switchplay (basketball) and Strat17 (general learning) share the same ordinary user accounts and authentication. They do not have separate identity systems or fundamentally different user types.

### Authoritative shared account

The existing users collection owns account ID, username, email, password credentials, standard account/security metadata and an explicit permissions record. Optional shared safeguarding information holds DOB where known, its source, independent age-verification status/method/evidence, DOB correction history and parental-approval scope/status/history/explanation version/timestamps.

Age is derived from DOB; it is not a stored counter. Shared safeguarding fields are optional. Puckle student registration requires DOB, but global authentication, Switchplay, Strat17, teacher registration and existing users do not acquire mandatory Puckle student fields.

### Site-specific profile

puckleMemberships links an existing ordinary account to its Puckle first name/name, student/teacher category, optional mobile contact, maths course/level, optional teacher introduction, welcome acknowledgement and Puckle source/provisioning metadata. It contains no authoritative DOB/age-assurance/parental-approval copy and no credentials or learning data. Student/teacher category describes registration intent, never permission or administration status.

Use targeted database updates. No profile, correction, approval or backfill operation may replace a user document or erase credentials, learning arrays, ownership or private data. Do not build a generic multisite profile framework.

### Ordinary capabilities and explicitly granted permissions

Every user has an explicit users.permissions record. The initial grant is permissions.publicPublishing: true or false. Ordinary personal learning and private Card, Deck and Info Card creation/publication continue under existing ownership and application rules; they do not require public-publishing approval. No generic roles/permission-table framework is introduced.

New self-registered students and teachers receive publicPublishing: false. Teacher category, isAdmin, age or parental approval never implicitly grants it. The backend checks the current grant whenever an operation would create a public version, including updates to already-public content and automatic Deck publication through Copy. Private drafts and private publication remain available. Staging a public visibility choice is not publication and cannot bypass the eventual server check.

The founder grants or revokes the boolean directly in MongoDB; no management API, approval component or administration UI is built. Missing/invalid values fail closed for public publication. Revocation prevents subsequent public publications without deleting, hiding or making existing public content private. Existing public content remains governed by the current permanent-public rules. Exact checks and feedback are specified in the engineering plan.

Before those checks are enabled, review existing accounts explicitly: preserve publishing for a founder-approved list of genuinely trusted account IDs, assign false to other accounts, and refuse unreviewed/conflicting changes. Account creation date alone is not evidence of trust. This permission preparation covers all existing shared accounts; the educational/safeguarding backfill remains limited to explicitly selected users.

Public-publishing permission is separate from group experience age eligibility and parental approval. This project does not enforce group experience permissions.

### Current scope

Implement direct registration, email ownership verification, password recovery, no-email contact requests, interest contacts, independent tuition enquiries, shared parental-approval emails/records, one isolated onboarding component, minimum public-publishing permission enforcement and a reviewed one-time backfill.

There are no membership invitations, activation pages/tokens, provisional memberships or public existing-account profile-linking journeys. A failed email challenge or no-email contact request is not an account. Future personal/admin invitations and manually arranging accounts for no-email visitors are separate authorised work. The existing seed:user script remains untouched.

## 2. Public navigation and Join interface

Keep Join in the Puckle header and Request a free session in Expert tuition, with the existing tuition enquiry section. Do not place competing Join and tuition buttons side by side on the homepage.

Join opens /join directly with heading **Join Puckle.** and these in-place options:

1. **I'm here to learn** — selected by default.
2. **I'm a teacher**.
3. **I'm interested in Puckle**.

No intermediate category-selection screen. Switching changes the displayed form without navigating away. Each category displays its mobile number field immediately, not only after another selection. Preserve one-action cross-links between Join and the existing /#early-access tuition form.

Request a free session opens that existing form, including when selected in onboarding. It never opens a second tuition form inside the application or overlay.

## 3. Contact details, email and the no-email route

### Common presentation

Every Join category displays email and mobile fields from the outset. Mobile is optional when valid email is provided. Use a straightforward international phone input and the existing phone-formatting patterns; the number is an unverified contact detail, not a login identity.

Below email, display **Don't have an email address?** Selecting it permits a mobile-only submission and makes mobile required. The visitor can return to the email route. Clearly show which kind of submission will result.

### Student/teacher email route

Collect the category's required information, chosen username, email and password, with optional mobile. Verify the email before creating an account. A successful final Join creates the ordinary account/profile and automatically signs the person in.

### Student/teacher no-email route

Collect the appropriate first name/name, category, mobile, student DOB/course/level where applicable, and optional teacher introduction. Student age validation remains at least 13. Hide and clear credential controls when changing to this route: do not request/store a password, invent an email, reserve a username or create an account/profile.

Save a distinct no-email Join contact request, notify the founder and confirm that Puckle will contact the person. It grants no authenticated learning access and is not a provisional membership. Any future account arrangement is a separate process requiring authorisation and the intended user's participation.

Record the category and explicit no-email reason so the team can count how often this route is used without adding personal data to analytics. The saved request can preserve the submitted DOB/educational context as contact-submission history; it is not a second shared account authority and is not automatically converted or synchronised into users.

### Interest contacts

Interested visitors may submit email, mobile or both. At least one is required; the no-email link makes the mobile-only option clear. They never receive an application account from this form, including when email is supplied. An email code is not needed to create a contact record; account-email verification is a separate flow.

Submitting a number permits relevant personal follow-up about the request, not promotional SMS. No SMS authentication, verification, phone login or promotional-SMS feature is included.

## 4. Student registration and education fields

### Required student information

Email-based student Join collects first name, user-chosen username, email/password, DOB, maths course and applicable level; mobile is displayed and optional. No-email student requests collect the educational/contact fields described in section 3, without credentials.

Use day/month/year DOB inputs. Reject impossible/future dates and students younger than 13 server-side. Prevent casual DOB/category changes through public payloads. Provide a reviewed support correction process with history and invalidation of assurance tied to an old DOB.

The authoritative DOB belongs in users.safeguarding after account creation. Record DOB source separately from independent verification: a new student has dobSource: self-declared and ageAssurance.verification: none, with recording time. Operator-entered is a source, not verification. Independent verification requires its own method, timestamp and justified evidence reference; unknown DOB remains absent. Email ownership and parental declaration do not verify student age. No third-party verifier or identity-document collection is introduced.

### Course and level map

| Course | Level behaviour |
| --- | --- |
| Leaving Cert maths | Required: Higher, Ordinary, Foundation, Other, Don't know |
| Junior Cycle maths | Required: Higher, Ordinary, Other, Don't know |
| GCSE maths | Required: Higher tier, Foundation tier, Other, Don't know |
| A-level maths | Disable Level; no selection required; store level: null, meaning not applicable |
| Other | Require course text and a level answer: Other with text, or Don't know |
| Don't know | Explicit course answer; require a level answer: Other with text, or Don't know |

Other course/level selections reveal required explanatory text. Do not assume common level terminology across qualifications. Changing course clears incompatible level values and their custom text. Switching to A-level clears level/levelOther and stores null; switching away requires a new applicable answer. Server validation enforces the same rule, including deliberately permitting A-level null. Do not ask an A-level student to select A-level again, or add exam-board questionnaires.

Registration-only choices must not change the existing tuition form's course requirements/options.

### Ordinary account and membership

After successful verified registration, the student receives the existing ordinary account and application, including Library, My Decks, available learning cards, progress/confidence, private reflections and media. Those functions are reused; the only learning-related changes in this project are the minimum public-publishing permission checks and existing error feedback described above. No tuition purchase or parental approval at initial signup is required for ages 13–15 private learning, subject to the pre-launch legal/privacy review.

Student questions and learning difficulties may influence future content. Do not promise fulfilment or special content-request priority for any membership tier.

## 5. Teacher registration

Teachers receive normal accounts with ordinary private application functionality and publicPublishing: false, like self-registered students. No teacher verification, elevated role, classroom dashboard or separate library/application is added.

Email-based registration collects name, chosen username, email/password, immediately visible optional mobile and a prominent, optional introduction. No mandatory student DOB/course/level. Suggested label:

**Tell us a little about yourself and how you'd like to use Puckle.**

Encourage what/who they teach, intended use and ideas for developing Puckle, without a structured school questionnaire. Blank introduction must succeed. After verified registration, establish the normal session, confirm that Puckle will be in touch and notify the founder for personal follow-up.

No-email teachers submit a mobile contact request instead, with no account/password. They receive a personal-follow-up confirmation. Registering as a teacher does not establish adulthood. Teacher/false-DOB bypass concerns belong to separate age-assurance and group experience safeguarding work.

## 6. General-interest registration and communication permission

Collect name, email and/or mobile, reason/relationship and optional message. Explain:

**Follow Puckle as it grows. Hear about new learning experiences, features and opportunities to get involved.**

Clearly distinguish contact registration from joining the learning application. Store interest contacts separately from users and active Puckle profiles. Preserve public browsing/demonstrations without authenticated access.

Use an unchecked, optional email-updates opt-in, for example: **Email me occasional Puckle updates and opportunities to get involved. I can unsubscribe at any time.** Record the choice, wording version and timestamp. A visitor may decline and still request relevant personal follow-up. Do not infer updates permission from account signup, tuition enquiry or a supplied mobile number.

For mobile-only contacts, email updates are unavailable/not opted in; explain this alongside the contact option. Do not substitute promotional SMS permission. Future communications must honour recorded choices; no campaign/sending system is built here.

For the small initial population, notify the founder of each saved interest registration using the same minimal notification mechanism, with database retrieval as the fallback. A no-email interest contact is therefore also visible for personal follow-up.

## 7. Account verification, credentials and recovery

### New email-based accounts

1. Visitor completes Join details.
2. Send a verification code to the normalised email; lifetime ten minutes.
3. Visitor enters the code and submits final Join.
4. Verify email ownership and the complete current category form server-side.
5. Prepare the account ID, password hash and signed normal session before the transaction; create account and Puckle profile together and consume the proof once. Initialise cardsData: [] and decksData: [] so existing personal learning works immediately, and permissions.publicPublishing: false.
6. Establish the normal session and open the authenticated application automatically.

No active/incomplete user or membership is created while the code is pending. Do not store registration passwords or full student profiles in email-challenge records. Changing email requires a new proof. Codes do not reserve the email or username. Code requests show the same neutral on-screen response whether an account exists. For an existing email, send its owner sign-in/recovery guidance instead of a new-account code. A final duplicate-email race returns neutral sign-in/recovery guidance; a username conflict identifies the editable field. Neither consumes an otherwise valid proof on transaction rollback, overwrites an account or signs into an existing account from an email proof. Correcting only a username does not require another code while the original proof is valid.

### Agreed new-credential rules

- Username: 3–30 ASCII letters/digits/underscore/hyphen; case-sensitive; no @. Trim surrounding input consistently with login.
- Email: trim and lowercase consistently with existing authentication; no provider-specific alias rewriting.
- Password: at least 12 characters, no unnecessary composition rules, no trimming and no silent bcrypt truncation; maximum 72 UTF-8 bytes.
- Verify new account email before creation. Do not impose new verification or strength rules on existing login credentials.

Unique shared-user email/username indexes are approved. Existing users are confirmed duplicate-free; preparation inspects indexes and reports unexpected errors without renaming, merging or modifying existing identities.

### Forgot password

Provide a minimal shared email-based reset flow. Send a single-use reset link to the account's stored email, valid for 30 minutes. The user chooses a password meeting the new-password rules; update the same account and invalidate previously issued sessions with a backward-compatible session-security mechanism. Then offer ordinary sign-in. Do not recreate accounts or change IDs, email/username or learning data.

Existing accounts need not pass a new registration verification step to log in or request recovery. Reset-link completion proves access to the stored email at that time; do not invent historical verification. A wrong/unavailable legacy address requires reviewed support, not automatic account reassignment.

Use purpose-bound, expiring proofs, lightweight request/attempt limits and neutral reset-request responses. Bind a login session version to the exact password snapshot that passed verification so a concurrent reset cannot validate an old-password login. Preserve existing login responses and credential rules. No new auth provider or general account-management product.

## 8. Independent tuition enquiries

Reuse the current Request a free session form, endpoint, puckleTuitionEnquiries collection, field/contact validation, honeypot and success behaviour. The session remains a free 20–30 minute online introduction. Membership and tuition are independent.

Anonymous visitors retain the existing choices: student under 18, adult student, parent/guardian. Keep current appropriate names, course, email/mobile, preferred contact method and optional message. Never expand this form to collect registration credentials/DOB/level.

For an authenticated Puckle student with a known shared DOB, automatically choose the existing under-18/adult form, hide the three-way selector and prefill appropriate known names/course/contact information. The student can initiate their own enquiry. Under-18 fields still require guardian information; do not put the student's login email/mobile into guardian fields. The backend reloads DOB and enforces the correct age path even against a forged adult payload. Unknown student DOB/no Puckle student profile retains the original selection flow.

After a parent enquiry: save it, notify the founder, and let the founder contact the parent to arrange the session. The website need not know the child's email/username/DOB. The child may already be a member, join later or never join. No account, profile, provisional membership or invitation is generated.

An adult self-enquiry may offer direct Join after success. Reuse safe same-tab client form state where convenient, without a database claim token, credential storage or treating prefill as identity proof. Declining Join never affects the saved enquiry.

Link an authenticated student's own request to their account where established. A guardian contact match does not identify the student; siblings can share contact details. Later operator-established associations may be recorded without inventing anonymous identity-matching rules or a public linking flow. Tuition requests do not rewrite membership origin.

Parental permission before live tuition under 18 remains an independent human operational requirement. This project adds no scheduling or automated session-arrangement system.

## 9. Shared safeguarding and one cross-site group experience approval

### Age information

Store one authoritative DOB/assurance record per ordinary shared account. Derive age using Europe/Dublin calendar dates, with 29 February birthdays treated as reached on 1 March in non-leap years, subject to necessary legal correction. Record event timestamps in UTC. Unknown DOB never means adult or independently verified.

DOB corrections require review, reason, actor, timestamp and previous/new value. Invalidate assurance tied to the old value rather than transferring it silently. Keep accurate history without collecting identity documents by default. Account permission changes, including the handling of corrected under-13 age, belong to the separate safeguarding process; do not delete learning data here.

### One shared activity scope

**One parental approval covers equivalent group experience participation across Puckle, Switchplay and Strat17.** These sites use the same underlying group experience functionality with different learning content. No extra approval is required merely for changing websites.

The explanation must explicitly describe all three websites, the shared activity, actual visibility/sharing conditions and withdrawal. Store the common activity scope, accepted explanation version, decision/declaration and timestamps in the shared account's approval record/history. The sending website is provenance/branding, not a separate approval key.

If activity materially expands/diverges later, a further approval may be needed for that expanded scope. Do not broaden accepted scope automatically or require renewed approval merely because the website changes. Group experience approval is not live-tuition permission.

### Required records and workflow

Support not-requested, pending, approved, declined and withdrawn. Withdrawal is the guardian rescinding an approval; a reviewed operator invalidation/revocation is recorded as a withdrawn decision with distinct actor/reason/history, not silently erased or confused with a founder public-publishing permission. Sending a request and obtaining a decision are separate events. Store delivery outcome separately from approval state; pending does not prove delivery. Preserve the accepted historical explanation/version, scope, timestamps and withdrawal evidence.

The student submits optional guardian email to send the request automatically. Parent receives an email link valid seven days, reads the explanation and explicitly declares parental/guardian responsibility before approving or declining. After approval, send a distinct purpose-bound withdrawal/management link and support renewal to the recorded guardian for expired management links. Consuming the original request proof must not remove withdrawal access. An expired capability cannot approve anything; after any permitted renewal lookup has been cleaned up, provide safe support/new-request guidance. The parent need not have an application account and gains no private learning-data access.

Request/resend is explicit, with approximately a one-minute cooldown and lightweight recipient/requester limits. Do not repeatedly email automatically. Replaced/expired links explain the situation and permit an appropriate renewal; GET/mail previews never make a decision. Failure/delay leaves personal learning available and accurately reports that delivery failed or is uncertain.

Guardian email ownership plus declaration is recorded as such, not as independent student-age or parental-responsibility verification. Fuller assurance remains an external safeguarding review.

### External enforcement boundary

Under-16 group experience participation requires parental approval, including private groups, creation/joining and perspectives. Applying that requirement server-side is entirely separate backlog work. This project only records/exposes facts; it changes no group experience creation, permissions, perspectives, data or media operation. Withdrawal and turning 16 update facts/reminders here, not group access.

The active group implementation need not be present to complete membership work. Before a public under-16 experience exposes groups, the separate enforcement and legal/safeguarding checks must be complete. Ages 13–15 private learning without initial approval remains subject to the agreed legal/privacy review.

## 10. One independent onboarding component

### First student experience

The authenticated application is available behind the welcome. Main choices:

- **Request a free session** — opens the existing public tuition form.
- **Explore Puckle** — dismisses and reveals the normal application.

No introductory My Decks copy, payment or additional login. For ages 13–15, this same first welcome also contains optional guardian email/setup. Submitting that section sends the approval request automatically. Skipping it leaves Explore and private learning immediately available. Do not postpone this initial offer to another login or confuse it with requesting tuition.

Persist the one-time welcome acknowledgement when actually presented. Later logins do not repeat a successfully acknowledged welcome. Welcome takes priority over a recurring reminder; only one onboarding panel is active.

### Later reminders and timing

Show a small dismissible reminder, preferably bottom-left, when appropriate: not-requested offers setup; pending offers status/resend; approved suppresses; declined/withdrawn shows truthful status with an explicit re-request option. Do not pressure repeated requests or alter a decision on dismissal. Stop the under-16 reminder at 16 without changing the separate under-18 tuition rule.

Onboarding is eligible only on exactly /decks and /library, not Creator, Progress, detail routes, Step Visuals or public pages. Expanded welcome can appear when its content arrives if the visitor has not yet interacted outside onboarding. There is no two-second deadline: a slow connection alone must not suppress the first offer. If outside pointer, keyboard or wheel interaction has already begun, offer a quiet collapsed control that opens the same welcome/setup on explicit request. Never auto-expand over active learning.

Defer expanded panels and suppress the small control while an expanded Deck introduction, native/non-native modal or fullscreen media owns the interaction. Route restrictions alone are insufficient; the new host checks actual presentation state without changing existing learning handlers. Verify stacking and mobile behaviour in the real application.

### Isolation and lifecycle

One lightweight client host mounts as a sibling of the existing subtree in src/app/layout.tsx, with no server authentication/site/database lookup in the root. It is reusable across all three sites, initially returning Puckle content only. Render directly in its own fixed container, with a CSS module, explicit local style resets, independent API requests/state and a local error boundary. No Shadow DOM, portal, second React root, global onboarding provider/store, learning props or global CSS edits are needed for the inspected styles. No selector in the new module may style application elements.

Use a small same-tab authentication-change CustomEvent from AuthScreen.tsx, LogoutButton.tsx and OverviewMenu.tsx, plus new registration/recovery code where relevant. Revalidate on eligible entry, authentication changes, focus and pageshow, including back/forward-cache restoration. This detects relevant cross-tab changes when returning to the tab, without BroadcastChannel, storage-event handling, polling, registration hints, session-expiry timeouts or midnight timers. Shared accounts do not imply cross-domain session cookies or a new single-sign-on system.

Ordinary blur/app switching preserves the partially entered guardian email and local panel state. On return, conceal/disable sensitive content while confirming identity, then restore the draft only for the same valid account. Clear it on logout/account change or confirmed invalid session; an indeterminate network failure leaves onboarding unavailable without exposing a previous user's data. Server mutations always verify the current session and expected actor. Focus/pageshow revalidation updates state quietly and never reopens a dismissed expanded panel.

Onboarding state changes must not re-render learning components, reload application state, interfere with gestures/keyboard/touch/wheel/media or steal modal/fullscreen focus. Panel event containment cannot undo document capture handlers; test the actual handlers and suppress the new panel wherever safe coexistence cannot be demonstrated. It fails away independently if its endpoint/module/rendering fails. Existing database-dependent functions are not promised to survive a general database outage; onboarding adds no new server-render dependency.

## 11. Founder notifications and operations

Notify the configured founder after saved tuition enquiries, teacher registrations and no-email student/teacher contact requests. For the MVP, use the same minimal notification for interest contacts, including mobile-only contacts. Ordinary student registration does not require founder approval.

Persistence/account creation succeeds independently of notification delivery. Save pending status with the source record, return success promptly and use Next.js after() in the submitting Route Handler to attempt founder delivery after the response. This is a bounded best-effort attempt, not a durable queue; an interrupted process may leave pending status for manual recovery. Record submission/profile ID, outcome (pending/sent/failed/unknown), attempt time and sanitised error/provider reference so an operator can identify and manually retry failures. Do not make a user resubmit a saved request because an optional notification failed. Provider acceptance is not proof of inbox delivery.

Document authorised date/ID-based database retrieval and checking pending/failed notification records. This supplies a fallback if email fails, not an admin dashboard/CRM. The founder handles calls, email discussions and session arrangements personally. No queue, campaign manager or automated tuition scheduling.

## 12. One-time existing-account backfill

Near implementation completion, use a reviewed manifest and a one-time script for selected profile/safeguarding updates and an explicit publishing-permission disposition for every existing shared account. The founder identifies trusted users by exact account ID and personal review, with existing content only supporting evidence; do not grant publishing automatically to all older accounts. It can add known shared DOB/assurance information and Puckle category/education/contact/provisioning details. Missing information stays unknown; existing users need not complete a public Join/linking journey.

Preserve account IDs, usernames, email, password hashes, learning data and any true historical source. Separate known-account provisioning metadata from original origin; do not invent past Join activity. Operator-entered DOB is not independently verified or necessarily self-declared without evidence.

Require dry-run/report, explicit apply, conflict refusal, unique account/profile association, field-targeted writes and safe reruns. It never creates accounts, sends invitations or modifies seed:user. Rehearse and apply reviewed permission records before enabling enforcement, so trusted users retain publishing without a temporary loss of access; do not expose public Join until enforcement and this checkpoint pass. It is distinct from a reusable administrative onboarding tool.

## 13. Email security and shared infrastructure

Use one small shared email utility with trusted site-specific sender/origin configuration and Puckle templates initially. The common approval disclosure covers all three websites irrespective of sender branding. No generic notification platform/background-job system.

Verification codes expire in ten minutes; reset links in 30 minutes; approval links in seven days. Apply attempt limits and approximately one-minute resend cooldown, with lightweight cross-account recipient limits. Do not log codes, raw tokens, passwords or sensitive form payloads; keep them out of analytics and referrers.

Use one small self-contained HTML action document returned by a Route Handler, bypassing RootLayout, Analytics and third-party resources. Put the token in the email-link fragment; remove it immediately with history.replaceState, keep it only in page memory, and submit it in a purpose-specific POST body. Render reset/parent review and actions within that same document: no context exchange, action cookie or extra React action pages. Reload after fragment removal requires reopening the email. The backend derives target/scope from the token and rechecks expiry/generation/current state; independent tabs cannot overwrite a shared action context. Use no-store, no-referrer and restrictive CSP; explicit parent declaration/approval/decline/withdrawal and password changes require user POST actions. GET/mail scanners cannot decide anything. Never alter an unrelated application session.

Retain safeguarding/approval evidence according to a justified, documented purpose-based policy, not an arbitrary universal duration. Expired transient security records can be cleaned separately; never TTL-delete a whole user/profile/history record.

## 14. Implementation phases and strict boundary

The engineering plan has eight implementation phases:

1. Shared safeguarding/profile data and indexes.
2. Shared account security and email, with a mandatory public-publishing enforcement checkpoint before exposing registration.
3. Direct Join and interest registration, including mobile/no-email requests.
4. Existing tuition enquiry integration and founder notifications.
5. Shared parental-approval workflow.
6. Isolated onboarding and auth notifications.
7. Reviewed existing-account permission preparation and selected profile/safeguarding backfill.
8. Final production-mode, multisite and mobile verification.

Existing shared authenticated infrastructure changes are limited to auth.ts helpers/projections, the now-approved login-route password/session binding, root client mount, AuthScreen notification/recovery entry and successful logout notifications in LogoutButton/OverviewMenu. Preserve current login/logout/navigation/cleanup behaviour and all three sites' authentication.

The expressly agreed publishing exception permits only actual public-publication checks in Card/Deck and Info Card repositories and minimum feedback in existing error presenters. The engineering plan identifies exact files for review before implementation. No Creator/Library redesign, extra administration screen, publishing approval API, media limit or rendering restriction is included. The unused username-directory endpoint is a separate removal recommendation under REQUIRES EXPLICIT APPROVAL, not already authorised.

No other changes to My Decks, Creator, CardData/DeckData operations, learning progress/confidence/reflections, media, Step Visuals, groups, existing navigation/gestures or global styles. Tests may exercise these. Teacher age-bypass protections, stronger age verification and group experience enforcement remain separate work. Any further unavoidable existing runtime edit requires exact file/change/reason and explicit approval.

## 15. Acceptance and pre-launch review

The final engineering checklist must verify:

- All Join categories show mobile immediately; normal email registrations work with optional mobile; no-email mode requires mobile, saves a contact request and sends founder notification without credentials/account/profile.
- Student validation enforces >=13, DOB/course/applicable level; A-level disables/clears level and accepts/stores null client- and server-side. Other/Don't know work without altering enquiry validation.
- Email verification precedes new account creation; code expiry/attempts/resends, duplicate races and automatic session work. Existing credentials/login/API response shapes remain valid across all three websites.
- Password reset is single-use/30 minutes, preserves the account/data and invalidates old sessions without signing other accounts in or changing permissions.
- Every existing account has an explicit permissions record; founder-reviewed trusted users retain publishing, new students/teachers default false, missing flags deny public publication and revocation stops new public versions through every route, including Copy. Private publication/learning and existing public content remain intact.
- Teacher introduction is optional; teacher privileges remain normal; interest contacts never receive accounts or implicit email/SMS marketing permission.
- Tuition remains one independent form; known-DOB students skip category selection, under-18 guardian requirements resist forgery, and founder follow-up does not depend on membership.
- One shared group experience approval is visible through authorised backend facts for all three sites with its accepted scope/version/history, without separate per-site approval or implemented group enforcement.
- The first welcome includes optional 13–15 parent setup; later reminders, expiry/withdrawal and age transitions are correct; under-16 and under-18 rules remain distinct.
- Production public static/dynamic classification and relevant caching remain unchanged; no gesture-driven onboarding requests or learning-component re-renders occur. Network/module failure, same-URL auth changes, cross-tab changes on return, preserved drafts across blur, long-lived sessions without expiry timers, expanded introductions/dialogs/fullscreen media and mobile/keyboard/touch interactions are verified.
- Founder notification failure preserves saved records and is operationally retrievable. No-email usage can be counted without PII analytics.
- Backfill dry-run/apply/rerun/conflict tests preserve identities, credentials, provenance and all learning data; reviewed publishing assignments precede enforcement/public registration and cover every existing account without blanket trust.

Before public launch, complete the legal/privacy review for private learning by children, proportionate DOB/guardian assurance, children's notices and justified retention; finalise the actual common group experience disclosure and separate enforcement readiness. Confirm the operational under-18 live-tuition permission process. Do not silently alter the agreed policy to resolve an external review issue.

Remaining implementation approvals/configuration are identified in the engineering plan. This specification describes the approved product direction; editing it does not authorise implementation, database writes or deployment.
