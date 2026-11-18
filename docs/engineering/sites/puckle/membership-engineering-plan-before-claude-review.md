# Puckle membership — final engineering implementation plan

**Status:** Documentation only; complete proposal for final implementation approval.  
**Revised:** 14 November 2026.  
**Source of truth:** [Membership design specification](../../../design/sites/puckle/membership-spec.md).  
**Scope:** Shared account security/safeguarding, Puckle profiles and public Join/contact journeys, independent tuition enquiries, parental-approval records/email, one isolated client onboarding host, selected-account backfill and verification.

## 1. Decisions, reuse and strict scope

Puckle, Switchplay and Strat17 share ordinary users and authentication. Keep credentials/account IDs in users, optional authoritative safeguarding facts on that account, and Puckle education/category/contact/onboarding information in puckleMemberships. There is no parallel account system or generic multisite profile framework.

New email-based student/teacher registration proves email ownership before account creation and automatically establishes the normal session afterwards. Mobile is visible immediately on all Join categories and optional with email. Student/teacher no-email mode creates only a mobile contact request for founder follow-up; interest submissions are always contacts. No SMS authentication or phone login.

One parental approval covers equivalent Group Learning across all three websites under the accepted common scope/explanation. Approval is not permission for live tuition. The project records/exposes facts and performs no Group Experience enforcement. No active group implementation is needed to complete membership work.

Remove all previous provisional memberships, enquiry-linked claims/invitations, issuer endpoints, account activation pages/tokens and public existing-account linking. Email challenges and approval/reset action capabilities are purpose-specific security records, not membership activation machinery. Future personal/admin membership invitations, reusable admin onboarding and manual account arrangements for no-email contacts are separate work. seed:user stays unchanged.

Reuse the existing account/session implementation, MongoDB connection/transaction guards, Puckle public layouts/CSS modules/phone input, existing tuition form/endpoint/collection and test infrastructure. Do not redesign My Decks, Creator/publishing, CardData/DeckData, progress/confidence/reflections, media, Step Visuals, groups, navigation, gestures or global CSS. Initialising existing empty personal arrays on a new account is required compatibility, not a learning-data change.

### Source inspection supporting the design

| Source | Current fact and consequence |
| --- | --- |
| src/lib/auth.ts | bcryptjs/jose, normalised email or exact-case username login, 30-day HTTP-only switchplay_session; getCurrentUser reloads users. AuthUser is an explicit core projection. Add narrow shared helpers/security fields; preserve the DTO and existing login rules. |
| auth login/logout/me routes and shared auth components | Login sets the cookie before success. AuthScreen uses replace or refresh; both logout components refresh, with OverviewMenu draining mutations/clearing its store first. Add only approved notifications and recovery entry, preserving order/behaviour. |
| src/app/layout.tsx and next.config.ts | Root renders children plus Analytics and global styles; no common authenticated layout or Cache Components setting. Add only a client sibling, without request APIs in RootLayout. |
| PublicHeader components and application pages | Existing public home/contact/privacy headers and authenticated pages already read cookies/authentication. /step-visuals has no server auth lookup. Preserve baseline route classifications rather than assuming every public page was static. |
| sites/getCurrentSite.ts, siteResolver.ts, siteRouting.ts and proxy.ts | Existing production host mappings, development localhost/cookie override and shared reserved routes. Reuse resolver in endpoints; do not parse host substrings in client code or modify proxy/routing. |
| Puckle TuitionEnquiryForm/publicTuitionEnquiry/early-access route | Existing conditional paths, E.164 formatting, preferred contact validation, JSON/honeypot and independent puckleTuitionEnquiries persistence. Add context/established links/founder notification, not a second form. |
| Puckle PublicPhoneInput.tsx | Already supports international input, labels/errors, optional country detection and E.164 values. Reuse unchanged on new Join forms; no new phone-verification dependency. |
| cards/repository.ts and cardMediaAccess.ts | Personal readers project learning fields; private media stays actor-bound. New safeguarding/profile writes must be subfield-only. These files need regression coverage, not modifications. |
| Email/recovery searches | No transactional sender, email-ownership or password-recovery implementation found. Add one small transport and concrete security/approval flows. |
| tests and scripts/test-phase2.ts | node:test/tsx, MongoMemoryReplSet and Playwright; real disposable Next runner exists. Component tests with mocked APIs alone cannot prove sessions, transactions, production caching or email-action security. |

Relevant installed Next.js guides were read: server/client components, usePathname, layouts, cookies, Route Handlers and caching/streaming guidance under node_modules/next/dist/docs. Preserve asynchronous cookies/params conventions. Review those local guides during implementation instead of assuming older Next behaviour. Installed bcryptjs documents its 72-byte UTF-8 input limit.

## 2. Existing-file change inventory and approval boundary

The following is the full planned existing runtime-file surface. New modules/endpoints are described later. No other existing authenticated learning file is authorised.

| Existing file | Exact proposed edit |
| --- | --- |
| src/lib/auth.ts | Add core credential preparation/account insertion, optional safeguarding/security typing, private session context/expiry and backward-compatible session-version support. Preserve AuthUser, existing authenticateUser contract, email/username matching and cookie lifetime/name/attributes. Section 4 specifies the password-version binding. |
| src/app/layout.tsx | Import new client OnboardingHost and insert one sibling immediately after children and before Analytics. Root remains a Server Component with unchanged children, metadata, Analytics and CSS imports. No getCurrentUser/getCurrentSite/cookies/headers/database await, new provider or child wrapper. |
| src/components/auth/AuthScreen.tsx | After successful login, publish a non-throwing auth-change notification before the existing replace/refresh; add the approved /login/forgot-password link. No login field/policy/branding redesign. |
| src/components/auth/LogoutButton.tsx | Publish notification after successful logout, before its existing refresh. Preserve errors and all other behaviour. |
| src/components/layout/OverviewMenu.tsx | One notification in its existing successful logout path. Keep mutation draining, working-store clearing, menu behaviour and refresh order intact. No other navigation/state edits. |
| src/app/sites/puckle/components/PublicHeader.tsx | Change only Puckle Join destination to /join. Keep existing tuition CTA behaviour. |
| src/app/sites/puckle/components/TuitionEnquiryForm.tsx | Use the same form with private age context, safe prefill, hidden selector for known-DOB students and optional direct adult Join continuation; preserve existing fields/errors/success interaction. |
| src/app/sites/puckle/lib/publicTuitionEnquiry.ts | Add only necessary context/success-response types; keep current anonymous validation/course/contact rules. Server age context is applied before calling the validator. |
| src/app/api/public/puckle/early-access/route.ts | Derive authenticated age path, add only established account/profile links, save the existing enquiry and notify founder after persistence. No account/profile/contact-request creation or invitation side effect. |
| src/app/sites/puckle/privacy/page.tsx | Reviewed privacy copy for verified signup, mobile/no-email contacts, shared facts/approval and justified retention. |

The only proposed additional existing runtime file is src/app/api/auth/login/route.ts, with the exact security edit under REQUIRES EXPLICIT APPROVAL below. It is not silently included in the five reviewed shared integration exceptions. No additional existing learning-component edit is proposed.

Existing non-runtime changes during implementation: package.json preparation/backfill commands, precise shared-infrastructure allowances in tests/site-independence.test.ts, focused tests/fixtures and test-runner additions. Do not alter seed:user or scripts/seed-user.mjs. No next.config.ts/proxy/site resolver/global CSS/learning model changes are planned. New shared recovery pages fit under reserved /login; new API routes fit under /api; Puckle public pages fit under sites/puckle.

## 3. Authoritative data model and preparation

### 3.1 Shared users and safeguarding

users keeps its identity/credential/account fields and existing learning data. Add optional emailVerifiedAt, sessionVersion (missing means zero), passwordChangedAt, and safeguarding. Do not expose these through the existing AuthUser/JWT projection except the internal session-version claim. New account insert initialises decksData: [], cardsData: [] and existing empty compatibility sharedDeckData, with isAdmin false. Existing learning shapes/types are unchanged.

| Optional shared safeguarding field | Meaning/invariant |
| --- | --- |
| dateOfBirth | Strict YYYY-MM-DD date-only or absent. The sole account-authoritative DOB. Never an authoritative age counter. |
| ageAssurance | Status unknown, self-declared, unverified or independently-verified; method, recordedAt, relevant evidence reference/verifiedAt where justified. Operator-supplied facts use unverified status and operator-entered method unless stronger evidence exists. New Puckle student input is self-declared. No public payload can set verified evidence. |
| dateOfBirthHistory | Reviewed old/new values, reason, actor, time and relationship to invalidated assurance. Never transfer verification tied to an old DOB to a new DOB. |
| groupExperienceApproval | One common activity-scope record: scopeId, accepted explanationVersion/scope snapshot, status, guardian contact/declaration evidence, request/decision/withdrawal timestamps and history. Applies to equivalent Group Learning on Puckle, Switchplay and Strat17. |

Use one concrete common scope identifier, for example shared-group-experiences, with a versioned explanation describing the three sites and actual visibility/sharing conditions. The sending site's ID is provenance/branding, never a per-site approval key. Do not add puckleApproved/switchplayApproved/strat17Approved or require a maths profile to read shared facts. Materially expanded/divergent activity may require a later additional approval; do not implement that future activity or automatically broaden consent now.

Absent DOB is unknown, not adult. Email ownership and guardian declaration are not independent age verification. Do not build a verification-provider workflow or store identity documents; allow relevant evidence references for authorised future use.

Use Europe/Dublin calendar dates for age and UTC timestamps for events. A 29 February birthday is reached on 1 March in a non-leap year, subject to required legal correction. Inject today/clock into pure functions. Parse DOB strictly rather than using dateOnly.ts's fallback-to-today helpers. New Puckle student forms enforce >=13, not global account validation. Historical/backfilled partial data can remain unknown.

New src/lib/userSafeguarding.ts exposes a server-only getSafeguardingFacts(userId, today) and targeted correction/approval writes. It returns raw age/assurance/common-scope evidence, not canJoinGroups or permission decisions. Authorised code from any site can call it without loading puckleMemberships. Own-data endpoints derive user ID from current authentication; never add public arbitrary-user fact lookup.

### 3.2 Puckle profiles and independent contact records

| Collection | Contents and boundaries |
| --- | --- |
| puckleMemberships | Required userId of an existing ordinary account; firstName/name, registrationCategory student/teacher, course/courseOther/level/levelOther, optional teacherIntroduction/mobile, timestamps, initialRegistrationSource and provisioning metadata; student welcome eligible/seenAt. No DOB/approval/credentials, no provisional/invited lifecycle. |
| puckleJoinContactRequests | No-email student/teacher contact submissions: kind no-email-join-request, category, name, mobile, submitted student DOB/course/level where applicable, optional introduction, createdAt and notification outcome. No password/hash, username reservation, users ID creation, membership or activation capability. |
| puckleInterestContacts | Name, email and/or mobile, reason/relationship, optional message, updates choice/version/time and notification outcome. No account. Mobile-only email-updates state is false/not-applicable; no promotional-SMS permission. |
| puckleTuitionEnquiries | Existing fields/source/validation/timestamps plus optional established userId/membershipId and founder notification outcome. No new per-enquiry person/account lifecycle. Repeated guardian contact/siblings remain valid. |
| accountEmailChallenges | Short-lived verification-code proof: normalised email, random challenge/flow binding, protected code digest, expiry, attempts, generation/usedAt and delivery outcome. No password, DOB or full registration draft. |
| accountEmailActions | Concrete reset/parent-request/parent-management capabilities: purpose, target account/common scope, random token digest, generation, recipient context, expiry/usedAt and short-lived action-context binding. No application-session grant. |
| emailRequestLimits | Small atomic time-window counters for actual mail/requester limits. Expiring operational state, not a general abuse platform. |

A no-email contact's submitted DOB is submission history about an unlinked contact, not a duplicate authoritative user DOB. No automatic conversion or sync is built. Future manual onboarding is separate work and must establish the intended person's facts/credentials afresh.

For new Puckle profiles, original registration source is join; optional context may record that the visitor came from tuition success, without pretending the enquiry created membership. Reserve admin-script/invitation as future source values only. Existing historical source is preserved; backfill has separate provisionedBy/recordedAt metadata and unknown original source when unknown. Normal tuition requests never rewrite source.

New student profiles mark welcome eligible with seenAt unset. Teachers do not receive a student free-maths-session welcome. Known-account backfill defaults welcome eligible false; appropriate approval reminders can still apply without inventing a past/new registration event.

### 3.3 Approved indexes and preparation

Create explicit unique indexes on existing users.email and users.username; normalise new email trim/lowercase as current login does, preserve binary/exact username case sensitivity, and do not add provider-specific email alias rules. Existing users have been confirmed duplicate-free. Inspect current definitions and expected normalisation; report unexpected failures without renaming, merging or cleaning accounts.

puckleMemberships has a unique required userId index. Contact/tuition mobile/guardian fields are not globally unique. Add only needed date/relationship/notification lookups. Challenges/actions have unique random proof digests/IDs and expiry indexes; rate windows expire independently. Enforce expiresAt in each operation, not by waiting for TTL cleanup. Never TTL-delete users, profiles or safeguarding history.

Use explicit, idempotent scripts/prepare-puckle-membership.ts with existing applicationDatabase/Mongo helpers. No index creation at import/public request time. One-time known-account population belongs to phase 7, not a broad legacy cleanup/migration.

### 3.4 Targeted writes and race invariants

Account creation + Puckle profile + verified proof consumption commit in one existing Mongo transaction. Hash new credentials before retried transaction callbacks. Send external email after persistence, never inside a retried callback. Unique indexes settle concurrent account races; code/proof ownership never signs into or overwrites an existing colliding account.

Corrections/approvals/backfill use narrow $set/$push/$setOnInsert and state/version preconditions. Never replace users or normalise learning arrays. Append evidence only when a fact changes; repeated identical backfill is a no-op. Tests must interleave a learning-data write with a safeguarding write and preserve both.

## 4. Shared account security, email and contact validation

### 4.1 Email ownership and final registration

The new Puckle registration form first collects details and requests a code for its normalised email. Keep password only in live form memory; never put it into sessionStorage, analytics, challenge records or logs. Requesting a code creates no user/profile and reserves neither email nor username.

Use a random six-digit code with ten-minute expiry, a protected keyed digest, random flow/challenge binding and at most five failed attempts per challenge. Check attempts atomically, including concurrent guesses. Resend after approximately 60 seconds rotates the code/generation and invalidates the prior one. Changing email invalidates the old form proof. Provider failure leaves the visitor on the form with an accurate retry state.

Final POST /api/public/puckle/membership validates the live full category payload and matching unexpired proof. Verify email, check Puckle-specific fields and consume the proof atomically with account/profile creation. No separate registration activation page/token or stored incomplete authenticated user. If a uniqueness race wins elsewhere, return field conflicts without account mutation or implicit existing-account sign-in.

After commit, set the existing session before success, publish auth invalidation from the new form and perform a normal document navigation to /decks. A new-registration hint contains only account ID/time, not DOB/credentials, and never substitutes for server identity checks. Fresh entry avoids a cached unauthenticated RSC/root result. If cookie delivery fails after commit, offer ordinary login/recovery rather than retrying account creation as a new person.

### 4.2 Credentials and recovery

prepareAccountCredentials in auth.ts handles core input only: username 3–30 ASCII letters/digits/_/-, exact case and trimmed boundaries; email trim/lowercase; new passwords at least 12 Unicode characters and <=72 UTF-8 bytes, without trimming/composition rules or silent truncation; bcrypt cost 12. insertAccount writes the ordinary user in the supplied Db/ClientSession. Student DOB/course/null-level validation stays in Puckle registration code. Existing login accepts existing credentials exactly as before, even if they do not satisfy new registration rules.

Shared /login/forgot-password and /login/reset-password pages fit under the existing reserved login route. New POST /api/auth/password-reset/request returns a neutral result and sends a 30-minute single-use link to the stored account email. Legacy accounts without emailVerifiedAt remain eligible for their existing email-based recovery; they are not forced through new registration. If that address is wrong/unavailable, use reviewed support, never automatic identity reassignment.

Reset completion verifies the account-bound action context, new password and unused proof, then atomically changes only passwordHash, passwordChangedAt and sessionVersion, consumes the reset proof and invalidates any other outstanding reset for that account. It preserves account ID/email/username and learning data, offers ordinary sign-in and publishes auth invalidation. Do not automatically sign a browser into the reset target or log out an unrelated currently signed-in account merely because a parent opened a child link.

### 4.3 Backward-compatible session security and the login race

Add optional users.sessionVersion, default zero. Newly issued JWTs contain the version; legacy tokens with no version are zero. getCurrentUser checks the signed version against the current account. A reset increments the version; old sessions fail without affecting users who have not reset. Preserve cookie name, HTTP-only/secure/sameSite/path flags and 30-day duration. Keep AuthUser and /api/auth/me/login response fields unchanged. No DOB or approval facts go into JWTs.

The version used for login must be captured with the account/password snapshot that passed bcrypt verification. Reading a fresh version only later in setSession could let old credentials racing a reset receive a new valid version. Recommended narrow implementation: add signInWithPassword in auth.ts using a private credential loader, carry its checked version into session signing, and adapt the existing login handler to use that helper while returning the same { user } response. Keep authenticateUser's exported core result/behaviour for compatibility and setSession's current callers supported. Internal session context can expose verified expiry/version to the new onboarding endpoint without changing AuthUser.

The login-handler edit requires the explicit approval described below; do not hide version metadata in enumerable DTO fields, use a hidden cross-function credential cache, or ignore the race merely to avoid reviewing one shared auth route.

### 4.4 Mobile, no-email and interest validation

All Join category views render PublicPhoneInput immediately and show Don't have an email address? below email. Reuse existing E.164 formatting, limits and form error/focus patterns without modifying the phone component. A supplied mobile must be valid even when optional; it is not verified or unique identity.

Email mode student/teacher requires email proof and credentials; mobile is nullable. No-email mode requires email absent/mobile present and omits username/password entirely. Clear credential state when switching, never persist it in a draft, and server-reject credential fields on contact-only payloads without logging their contents. Student contact requests still validate name, DOB >=13, course and applicable level; teacher contact requests require name/mobile with optional introduction and no mandatory DOB. Confirm contact follow-up, not registration/account access. Do not automatically convert requests later.

Interest always needs name, reason and email or mobile, with optional message. Its immediately visible mobile and no-email route have the same contact checks. An unchecked optional email-updates checkbox records explicit choice/version/time; phone-only disables email updates with a clear explanation and stores false/not-applicable. No promotional-SMS opt-in/sender is built. Relevant requested personal follow-up remains possible without an updates opt-in.

### 4.5 Shared email and founder notifications

New src/lib/siteEmail.ts is one concrete provider adapter with trusted per-site sender/origin settings. Puckle templates initially live in its own template module; the common approval disclosure is shared versioned data. No service registry, queue, notification platform or campaign engine. Missing provider/sender configuration is reported, not silently replaced by a different site's identity. Never derive email action destinations from arbitrary Host/redirect input.

Persist then notify the configured founder for tuition, teacher signup, no-email contact and all interest submissions. The latter is the simplest initial-volume recommendation and reuses the same utility. Notification failure never changes saved submission/registration success. Store pending/sent/failed/unknown, timestamp and sanitised provider/error reference beside the source record. A crash after commit can leave pending, and a timeout may be unknown; do not claim delivery or roll back a saved enquiry.

Use authorised MongoDB Compass or mongosh access to list puckleTuitionEnquiries, puckleJoinContactRequests, puckleInterestContacts and teacher puckleMemberships by createdAt since the last review, sorted ascending; retrieve an individual record by its _id. Also filter founderNotification.status for pending/failed/unknown, including an old pending attempt where the process may have stopped. This is the concrete fallback retrieval procedure; setup must confirm the founder can access it. The founder can recover by reading the saved record and personally contacting the person; do not falsely mark a failed notification as delivered. No retry engine, CRM or dashboard is required. Count no-email student/teacher requests by kind/category/date, and mobile-only interest by absent/null email with supplied mobile, with no PII analytics event.

Starting lightweight limits: 60-second per-account/flow resend cooldown, five code attempts, three recipient-address requests/hour and five/day aggregated across accounts for public-facing security/approval email, plus a modest requester/IP limit (initially ten/hour). Use atomic short-lived counters. Founder notifications are not restricted by the parent's recipient budget; keep honeypots/basic form limits to avoid notification spam. Treat exact abuse counters as tunable implementation settings, not an additional consent policy or infrastructure project.

### 4.6 Isolated email-action entry and context

Choose one small Route Handler entry at /api/account-actions/open, returning minimal HTML without React RootLayout, Analytics or other third-party resources. Approval/reset/manage email links place the random token in the fragment, not a query/path. A tiny first-party script removes the fragment immediately, POSTs it to /api/account-actions/context and navigates to an allowlisted clean review/reset page. Code verification remains an inline code entry and needs no link landing.

The exchange creates a short-lived, purpose-scoped HTTP-only/Secure/SameSite=Strict action-context cookie, restricted to /api/account-actions. Its lifetime is at most 15 minutes and never exceeds the original capability expiry; every decision rechecks both expiries. Context responses/decisions use this route family; the clean page shell does not need to read the cookie itself. Exchanging context does not approve, withdraw or reset, and must not consume the underlying decision token merely because a scanner ran JavaScript. Explicit decision POST consumes the matching original capability/state. Parent management links use the seven-day parent-link lifetime and can be renewed only to the recorded guardian with the same lightweight limits. New state-changing browser endpoints check expected same-origin requests; this does not broaden into a retrofit of existing unrelated APIs.

Return target display context and an opaque expected action ID, not the raw email token. Each decision validates purpose, target account/common scope, state/generation/expiry and that expected ID against the cookie. This prevents two child/reset links opened in different tabs from silently acting on whichever context cookie was written last. Parent action target comes from its capability, never the current application account or client-supplied userId. Preserve an unrelated signed-in application session.

Use no-store, no-referrer, a restrictive CSP for the tiny entry script and no token-bearing analytics/log/error data or email click-tracking rewrites. Fragment transport keeps the raw secret out of HTTP request URLs/referrers, but same-page third-party JavaScript could read it; this is why entry bypasses RootLayout. Sensitive links are ordinary full-document links to that entry, not client-side prefetch into the existing analytics-loaded page. Clean pages have no raw token in URL/DOM; API bodies are not logged. Provider acceptance/redirect behaviour and all outgoing network/log data must be checked with a sentinel token. This helper is limited to the actual reset/parent actions, not a generic token framework.

## 5. Isolated client onboarding and authentication lifecycle

### 5.1 Exact mounting and ownership

In src/app/layout.tsx add the import and one OnboardingHost sibling immediately after children. Do not import an async OnboardingBoundary, add Suspense-based auth lookup, call request APIs in RootLayout, change Analytics, wrap children or edit individual application pages.

New src/components/onboarding/OnboardingHost.tsx is a tiny client bootstrap that returns null during SSR/initial hydration. After mounting, usePathname gates application routes /decks, /library, /progress and /creator/descendants. Exclude public pages, /login, /step-visuals, /dev and /internal. Start no onboarding request on public/Step Visual routes. Use pathname/section entry rather than Card IDs, query parameters or learning state; swipes/flips/embedded visuals do not become fetch triggers.

GET /api/account/onboarding independently authenticates and resolves site through existing getCurrentSite/resolveSite. Return minimal actor ID, verified session expiry, server date/common approval status and site-specific welcome/reminder summary, with private no-store/Vary Cookie. Puckle initially has content; Switchplay/Strat17 return no-content for onboarding while their shared safeguarding facts remain available to authorised backend code. Do not implement their content/adapters or filter the host out at server render. Canonical host mapping and existing preview/local site cookie select branding, not account authority or separate approval scope.

After eligible entry, dynamically import the new Onboarding views/styles inside a caught client effect. Attach one open ShadowRoot and createPortal into it. It remains this sibling's React subtree, not a separate createRoot. Local state does not wrap learning, write its store, supply props/context, change keys or call router.refresh. Existing navigation/authentication retains its own legitimate rendering. Create/cleanup idempotently under Strict Mode; cancel stale imports/requests and catch effects/module errors explicitly. A local error boundary renders null on view failure.

onboardingStyles.ts inserts only shadow-scoped styles with local font/colour/direction/line-height/box-sizing/spacing/control rules and onboarding-owned variables. Shadow DOM prevents normal selectors crossing; inherited values are explicitly reset. The fixed host has zero layout footprint, bounded stacking order and pointer-events:none outside panels. Never edit global CSS/body scroll/inert state or reuse learning styles/measurement.

### 5.2 Notifications, expiry and cross-tab behaviour

New src/lib/authSessionEvents.ts is a small browser invalidation utility, not an auth provider/store. A successful registration/login/logout/reset dispatches a local event and a BroadcastChannel message, with a storage-event fallback. Carry only an invalidation nonce/type, not credentials, DOB, guardian information or trusted user identity. Publishers/listeners catch unsupported-storage/channel failures; notification failure must not fail the existing login/logout/navigation operation.

The approved AuthScreen notification runs before its existing replace/refresh. LogoutButton publishes after success before refresh. OverviewMenu retains its current flush, successful logout, working-store clear and refresh; insert exactly one notification after success/store clearing. Failed auth requests do not signal a successful session change. New forms publish through the same utility.

On invalidation, clear old overlay state immediately, abort outstanding requests and revalidate if on an eligible route. On blur/hidden, remove sensitive overlay contents; on return, confirm identity before displaying them again. Schedule removal at the verified session expiry and quiet revalidation at a calendar transition for a visible under-16 reminder. Every mutation includes expected actor ID and is checked against current authentication; a stale action cannot run for a different account. Coalesce route/auth/focus requests and discard outdated generations. No interval polling, global fetch monkeypatch, learning DOM observer or gesture-triggered request.

A previously authenticated browser checks the endpoint once on application entry. Same-URL sign-in/logout relies on the explicit events, not a pathname change or root-layout rerender. Cross-tab invalidation is same-origin; separate website domains keep existing host-only sessions. If both notification channels are unavailable, local handling still works and the next focus/revalidation clears cross-tab uncertainty; do not expose old facts while revalidation is pending. Do not introduce cross-domain SSO/cookies.

### 5.3 First welcome, parent setup and non-interruption

New verified student Join sets the normal cookie before success and fresh application entry. Welcome contains Request a free session and Explore Puckle, with no My Decks introductory copy. For ages 13–15, the same welcome includes optional parent email and Send approval request; submitting that section automatically calls the shared request endpoint. It can show pending/error state in place. Explore/skip stays available, and tuition and approval actions remain separate. No step registry/workflow engine.

Request a free session dismisses welcome and opens /#early-access; use the existing public form with its own context. Explore dismisses locally without reload. Record welcome seenAt only when actually presented, through an idempotent own-profile acknowledgement. A successful acknowledgement prevents later login/other-browser repetition. Failure never traps learning: suppress locally and retry within onboarding; cross-device once-only behaviour cannot be guaranteed while persistence is unavailable. Do not mark an unseen/late-collapsed welcome as presented.

During initial entry, the bootstrap observes only whether the user has begun an outside interaction; it never prevents/changes that event. If content arrives after interaction or beyond a short initial presentation window (initially two seconds), do not auto-expand. Offer a quiet collapsed welcome/parent-setup control during that first visit. Defer expanded panels during native modal/fullscreen ownership, including native video fullscreen; do not create a competing top-layer dialog or edit application focus code. Native/document capture listeners already exist, so stopping panel bubble events is not a claim to stop all global listeners. Verify actual behaviour and suppress/fix the new overlay if necessary.

Later authenticated visits can show the small bottom-left dismissible reminder: not-requested setup, pending status/resend, approved hidden, declined/withdrawn truthful status with explicit re-request. Dismissal is visit-local and independent of persisted approval. Welcome takes priority; do not immediately replace a dismissed welcome with another unsolicited panel. No initial parental offer is delayed until a later login. Age 16 ends that reminder; age 18 separately affects tuition context. Unknown age/teacher registration is not an adulthood claim and creates no new age-sensitive permissions.

Focus/visibility refresh updates existing status or a quiet affordance; it never resurrects a dismissed expanded welcome/reminder. No autofocus on recurring reminders, focus trap, body scroll lock or synthetic keyboard/focus/resize events. Panel-owned pointer/keyboard/wheel events are contained where appropriate; outside learning gestures remain untouched. Any load/fetch/render/action failure removes or limits only onboarding. A general database outage may already affect the existing app; onboarding is not added as another server-render dependency.

## 6. Eight implementation phases

Every phase identifies existing/new files, database work, dependencies, tests, regression risks and an acceptance checkpoint. No existing learning code changes are implicit in a test. File names are concrete proposed paths, with small adjacent helpers only where they materially improve readability.

### Phase 1 — Shared safeguarding/profile data and indexes

**Functionality:** Define the shared optional account facts, one common cross-site approval scope and active Puckle profile; strict Dublin/calendar age helper; targeted write contracts; contact-only schemas; explicit preparation. Keep Puckle validation in its own registration module. Implement the exact course map: A-level level/levelOther null and disabled/cleared selector; all other courses require their valid level/Other text/Don't know. Teacher introduction is optional. Define immediately visible mobile/no-email variants with no credential fields in contact requests.

**Existing files:** auth.ts optional data/security type declarations only, without login changes yet; no root mount or learning edits. Tests/site-independence.test.ts gets narrow shared-infrastructure exceptions for the actual new modules, including shared approval disclosure; package.json gets preparation command only. No seed script changes.

**New files:** src/lib/userSafeguarding.ts; src/lib/age.ts; src/lib/parentalApprovalScope.ts (data/explanation contract, not permissions); src/lib/puckleMemberships.ts; src/app/sites/puckle/lib/membershipRegistration.ts; scripts/prepare-puckle-membership.ts. Add small interest/contact persistence helpers alongside these if needed, without repository interfaces/frameworks.

**Database:** Section 3 collections/indexes, explicit and repeatable. No account/profile backfill yet. No provisional lifecycle, copied DOB/approvals, unique phone or learning-data changes.

**Dependencies:** Agreed architecture/defaults; explanation content can remain a reviewed draft until phase 5's production acceptance.

**Unit/integration/E2E tests:** tests/shared-safeguarding.test.ts, puckle-registration-validation.test.ts and shared-membership.integration.ts. Cover invalid/future DOB, 13/16/18 birthdays/leap day/timezone, unknown/operator/self-declared/verified distinctions, exact-case index behaviour, setup rerun and one profile per user. Cover all mobile/email variants, absence of credentials in contacts, supplied-but-invalid optional mobile, A-level null and transition in/out; Other/Don't know. Browser field behaviour is exercised in phase 3. Shared facts must be readable without a Puckle profile and report the same common approval across all site contexts.

**Regression risks:** Site fields becoming global; public DTO evidence leakage; subdocument writes clobbering personal data; index collation changing usernames. Preserve selective readers; test malicious authority fields and an interleaved personal write.

**Acceptance checkpoint:** Model/index/validation tests pass, with no change to existing auth behaviour or learning code.

### Phase 2 — Shared account security and email

**Functionality:** Core creation helpers, ten-minute email challenge, 30-minute recovery, session invalidation, common mail transport and isolated action entry as section 4. Establish codes without accounts/drafts, preserve existing credentials and secure the reset/login version race. Add the shared Forgot password entry and new shared recovery pages, not a new auth provider.

**Existing files:** auth.ts security/helpers; AuthScreen.tsx approved recovery link (notification added in phase 6). The proposed login/route.ts change is conditional on REQUIRES EXPLICIT APPROVAL. Existing logout/me handlers, site routing, RootLayout/Analytics and learning code otherwise unchanged.

**New files:** src/lib/accountEmailChallenges.ts; src/lib/passwordRecovery.ts; src/lib/emailActionTokens.ts (only concrete reset/parent purposes); src/lib/siteEmail.ts; src/app/sites/puckle/lib/memberEmailTemplates.ts; src/app/api/auth/email-verification/route.ts; src/app/api/auth/password-reset/request/route.ts; src/app/api/account-actions/open/route.ts, src/app/api/account-actions/context/route.ts and src/app/api/account-actions/password-reset/route.ts; src/app/login/forgot-password/page.tsx, src/app/login/reset-password/page.tsx; src/components/auth/ForgotPasswordForm.tsx, ResetPasswordForm.tsx and AccountRecovery.module.css.

**Database:** Use transient proof/counter collections and optional account security fields. Missing sessionVersion=0; old users/tokens stay valid until reset. No credentials in verification challenges. Reset atomically consumes proof, changes password and increments version. TTL applies only transient records.

**Dependencies:** Phase 1; selected provider/senders/origins; explicit login-handler approval. Stage common parent-action storage/entry here; phase 5 implements parent decisions.

**Unit/integration/E2E tests:** tests/account-email-verification.test.ts/.integration.ts, password-recovery.integration.ts and real Next auth/security journeys. Test code expiry/five attempts/resend/email change/flow binding, proof races and failed provider requests. Test normalised email/exact username, legacy short passwords/no verification metadata, old version-zero JWTs, reset expiry/single-use/concurrent reset, unchanged AuthUser/login/me JSON and cookie flags. Interleave bcrypt verification with reset and prove no valid new session from the old password. Test the isolated entry with sentinel-token network/log capture, previews/GET non-mutation, wrong purpose/target, two-tab action-cookie replacement and unrelated signed-in account. Browser forms/flow finish in phase 3/final suite.

**Regression risks:** Session revocation breaking all old users, stamp-new-version-after-old-password race, cross-account action context, token leakage through Analytics, delivery acceptance mistaken for delivery. Verify old-session compatibility and action boundaries in a real server, not only mocks.

**Acceptance checkpoint:** Shared authentication/recovery succeeds on all three site hosts without new DOB/Puckle requirements; approved old sessions behave unchanged except after a reset. Email-action secrets do not reach RootLayout/analytics.

### Phase 3 — Direct Join and interest registration, including no-email contacts

**Functionality:** /join with student default and in-place alternatives, mobile always visible, normal email-code path and no-email contact mode. Validate full student/teacher payload on final Join, create user/profile transactionally, automatically set session and enter the app. No-email mode clears/excludes username/password, requires mobile, saves request/notifies founder and confirms personal follow-up. Interest remains contact-only with email/mobile and optional email updates; notify founder for simple initial-volume visibility. Teacher signup notifies founder and confirms normal access/follow-up.

**Existing files:** Puckle PublicHeader.tsx Join link and privacy/page.tsx reviewed copy; no existing learning/root modification. Reuse PublicPhoneInput/CSS patterns unchanged. Existing tests/site-independence allowances as needed; no other-site forms are changed.

**New files:** src/app/sites/puckle/join/page.tsx; src/app/sites/puckle/components/MembershipJoinForm.tsx, StudentRegistrationForm.tsx, TeacherRegistrationForm.tsx, InterestRegistrationForm.tsx and MembershipJoinForm.module.css; src/app/api/public/puckle/membership/route.ts, src/app/api/public/puckle/join-contact/route.ts and src/app/api/public/puckle/interest/route.ts; src/lib/puckleRegistration.ts for explicit Puckle orchestration, plus puckleJoinContacts.ts/interest persistence if useful. Reuse phase 2 proof/account/email helpers; the draft remains in form memory.

**Database:** Insert active ordinary users and puckleMemberships only on verified email registration. Insert distinct contact records otherwise, with no auth/profile. Store optional unverified Puckle mobile, explicit no-email reason/category and notification outcome. No unique mobile, fake email, password placeholder or automatic contact conversion. Save followed by notification; failure does not undo success.

**Dependencies:** Phases 1–2. Onboarding views arrive in phase 6; until then registration tests may independently assert fresh authenticated application entry.

**Unit/integration/E2E tests:** tests/puckle-join.spec.ts, puckle-registration.integration.ts, puckle-join-contacts.integration.ts and interest tests. Exercise every category's mobile on initial render; email+optional phone; no-email toggle in both directions; required/invalid phone; password cleared/excluded and rejected server-side in contact mode. Assert zero users/profiles created by no-email/interest submissions, no password/hash in stored records and founder failure preserves success. Student tests include >=13, A-level null/selector reset, all Other/Don't know choices, malformed/tampered authority fields, code proof/duplicate races and rollback. Teacher blank introduction succeeds without special rights. Interest no opt-in/phone-only produces no email/SMS marketing permission. Real-server test proves Set-Cookie then ordinary application access without another login.

**Regression risks:** Accidentally treating contacts as members, retaining unusable passwords, mobile as verified identity, disabled level omitted but rejected by server, provider failure reported as lost signup. Compare form/server variants and collection counts, sanitised logs and API failures.

**Acceptance checkpoint:** All three Join categories have truthful successful outcomes; verified students/teachers are ordinary signed-in users, all contact-only variants remain outside users/profiles, and source/consent/mobile facts are accurate.

### Phase 4 — Existing tuition enquiry integration and founder operations

**Functionality:** Reuse the single form/URL/collection/anonymous validation/success. New private context supplies known shared DOB and Puckle education/name/contact prefill; known students skip selector. Under-18 contact remains guardian information, never auto-filled with the student's own credentials/mobile. POST independently derives the correct path before existing validation, resisting a forged adult request. Unknown-DOB/no-student-profile users keep selection. Add only established own-account links and founder notification. Adult success may offer ordinary Join via short-lived same-tab client state; no database claim, credential draft or identity assertion.

**Existing files:** TuitionEnquiryForm.tsx; publicTuitionEnquiry.ts context/response types only; existing public/puckle/early-access/route.ts; privacy copy if needed. Public homepage/BenefitSections/phone input, other-site forms and learning application stay unchanged.

**New files:** src/app/api/puckle/tuition-context/route.ts; small src/lib/puckleEnquiries.ts helper if needed for context/save/notification separation. Document operational queries/manual recovery in this existing engineering documentation, not a dashboard/CRM. No invitation/contact-request/profile creation from enquiries.

**Database:** Preserve puckleTuitionEnquiries and existing source; optional established userId/membershipId plus founderNotification. No historical matching/backfill or unique guardian email/phone. No changes to active membership source. Registration Don't know course leaves existing enquiry course unanswered; Other maps to existing Other; A-level adds no enquiry level field.

**Dependencies:** Phases 1–3 and shared mail utility. Approval flow is independent.

**Unit/integration/E2E tests:** Extend existing tests/puckle-enquiry.test.ts/.integration.ts; add authenticated context/notification browser journeys. All original adult/under-18/parent, contact-method, phone-only and honeypot assertions remain. Test known age 17/18, backend-forged adult input, unknown student DOB, no-Puckle shared user, safe name/course/mobile prefill, student self-request and guardian fields. Parent enquiry saves without knowing child email/DOB, never creates user/profile/contact-onboarding request or sends a membership invitation. Two siblings sharing contact remain independent enquiries. Simulate saved-record notification failure and verify normal success plus recoverable record. Adult client prefill is editable/unverified and absent state simply opens ordinary Join.

**Regression risks:** Changing existing form rules or success messaging, mixing guardian/student contact, auth lookup failure silently selecting adult path, optional notification causing duplicate resubmission. On context failure do not enable an adult bypass: backend remains authoritative and can return a recoverable context error while preserving entered form values.

**Acceptance checkpoint:** One unchanged-purpose enquiry remains useful whether the student already joined, joins later or never joins; founder can discover/retrieve/handle it. No new tuition system or membership invitation path.

### Phase 5 — One shared parental-approval workflow and evidence

**Functionality:** Implement common-scope not-requested/pending/approved/declined/withdrawn transitions, explicit re-request after decline/withdrawal, seven-day request links, request/resend, explicit parent declaration/decision, withdrawal and management renewal. Keep accurate scope/explanation/timestamps/history and separate delivery outcome. Load shared age facts without requiring a maths profile; no group permission decisions. Guardian-email submission triggers the actual sender automatically; there is no founder approval step. Never infer student age verification or live-tuition permission.

**Existing files:** No further auth/root/learning runtime edits. Puckle privacy copy finalised for actual disclosure. Existing user/media/permission endpoints untouched.

**New files:** src/lib/parentalApproval.ts using userSafeguarding.ts, parentalApprovalScope.ts, siteEmail.ts/action helpers; src/app/api/account/parental-approval/route.ts for authenticated own status/request/resend; src/app/api/account-actions/parental-approval/route.ts and src/app/api/account-actions/renewal/route.ts for parent context decisions/renewal; src/app/sites/puckle/parent-approval/page.tsx, src/app/sites/puckle/components/ParentApprovalForm.tsx and ParentApprovalForm.module.css. One common disclosure records all three websites; no per-site approval pages/databases are required.

**Database:** Targeted shared safeguarding approval/history and action-token writes. Request generation/state preconditions prevent stale/replayed/recipient-replaced links changing decisions. Source website is provenance, not approval scope identity. Management renewal uses recorded guardian recipient, not arbitrary input. Current approved guardian replacement needs reviewed support/renewal rather than silently rewriting approval evidence.

**Dependencies:** Phases 1–2, final common disclosure and sender configuration. Can be tested independently of application onboarding or any active Group Experience code.

**Unit/integration/E2E tests:** tests/parental-approval.test.ts/.integration.ts and parent browser journeys. Cover no request, send failure/unknown/delay, pending/resend/expiry/renewal, explicit approve/decline/withdraw/re-request, replaced/wrong-scope/wrong-purpose/replayed token, concurrent decisions and multiple child tabs. Assert target identity comes from action context and expected ID, not current logged-in person. Approving once returns the same common facts for Puckle/Switchplay/Strat17; changing only source website requests no second approval. Assert authority fields cannot be forged and user credentials/learning arrays remain byte-for-byte or structurally unchanged. Parent approval does not change assurance to independently verified.

**Regression risks:** Accidental per-site approval keys, global unspecific parentApproved flag, token cookie context switching targets, withdrawal deleting learning data, stale delivery marked approved. No group/media operation may be called; fixtures can assert only allowed user subpaths/action records changed.

**Acceptance checkpoint:** Full recorded request/decision/withdrawal lifecycle works with one cross-site activity approval, and no learning/group permission behaviour has changed.

### Phase 6 — Isolated client onboarding and approved auth notifications

**Functionality:** Implement section 5's single host and complete first welcome with optional 13–15 parent setup; later bottom-left reminders/quiet status, one-time acknowledgement, age transitions, failure isolation, auth invalidation and non-intrusive late responses. Include a reviewed support correction entry/link and shared admin-authorised DOB correction helper/endpoint; no casual self-edit, new admin UI, identity verifier or permission change.

**Existing files:** Exactly RootLayout client sibling and approved notifications in AuthScreen.tsx, LogoutButton.tsx and OverviewMenu.tsx (AuthScreen recovery link already phase 2). No learning page/inner-component/CSS/focus handler edit. Reuse existing support destination without changing its form.

**New files:** src/components/onboarding/OnboardingHost.tsx, Onboarding.tsx, onboardingStyles.ts and OnboardingErrorBoundary.tsx; src/lib/authSessionEvents.ts; src/app/api/account/onboarding/route.ts for minimal status/acknowledgement; src/app/api/account/date-of-birth-correction/route.ts requiring existing administrator authority/review reason and shared-target helper. No server OnboardingBoundary or duplicated mounts.

**Database:** Profile welcome eligible/seenAt, shared correction/assurance history and existing approval records only. Expected-user checks on own actions; correction expected-value/history constraints. No age counter, cron, global entitlement, learning-data mutation or change to historical source.

**Dependencies:** Phases 1–5. Common disclosure/approval email must work before exposing the first welcome's send action. The approved notifier call sites are all accounted for.

**Unit/integration/E2E tests:** tests/onboarding-lifecycle.test.ts, puckle-onboarding.spec.ts and real-server lifecycle tests. Measure harness sibling render counts and real application DOM/state retention through status/request/resend/dismiss. Verify SSR-null/hydration under rewrites, Strict Mode cleanup, own styles/inherited reset and no app CSS mutation. Test fresh verified registration/document navigation, standalone and embedded sign-in, both same-URL logout paths, same/different account login, expiry, cross-tab invalidation and notification-channel failure with focus recovery. Delayed old responses after account change must never render/act for the new user. Test the first 15-year-old welcome contains both tuition actions and optional parent email/send/skip now; approved state hides reminders, all five states are represented, and turning 16 removes the under-16 reminder while tuition still uses under 18. Modal/fullscreen, capture/bubble handlers, keyboard/Tab/Escape, touch/wheel and active Card/media/progress interactions are exercised without modifying them. Slow/failing endpoint/import/render/acknowledgement never replaces or resets the app; focus refresh never reopens dismissed expanded panels. Additional production measurements are phase 8.

**Regression risks:** Root becoming dynamic, notification publisher throwing into existing auth, stale account data, late intrusive popup, shadow style inheritance, capture listener/focus interference, repeated welcome during failed persistence. Keep every mitigation inside the new layer and document practical failure limits honestly.

**Acceptance checkpoint:** One independent layer works over the untouched learning subtree, including first parental setup, and approved authentication behaviour is preserved. No group enforcement is claimed.

### Phase 7 — Selected existing-account backfill checkpoint

**Functionality:** One-time reviewed manifest of explicit account identifiers and known optional DOB/assurance, Puckle category/course/level/mobile/source/provisioning data. Dry-run/report by default, explicit apply, per-account targeted transaction, expected-value preconditions and safe repeat execution. Resolve an exact account ID; if accepting email/username in the manifest, report its unique resolution for approval before writes. Never create missing users or auto-match contacts/children.

**Existing files:** No runtime auth/root/learning edits; package.json may add a specific one-time backfill command. seed:user untouched. This plan records the reviewed run/checkpoint.

**New files:** scripts/backfill-known-puckle-users.ts and a manifest schema/example within existing engineering documentation (the real manifest is supplied/reviewed near execution and handled as private data). No reusable invitation/account-creation CLI.

**Database:** Update only allowlisted shared safeguarding subfields and corresponding unique Puckle profile. Preserve _id, username, email, passwordHash, sessionVersion, learning arrays and any real original source. Use separate known-account-backfill provisioning metadata; unknown original source remains unknown. Missing DOB stays missing; operator-entered evidence is labelled unverified unless genuine self-declaration/independent evidence is supplied. Do not mark email/age independently verified merely because the founder knows the person. A-level is null when course is supplied as A-level; incomplete historical student facts may remain unknown. Welcome defaults ineligible, so old accounts do not become newly registered users accidentally.

**Dependencies:** Phases 1–6 completed/tested, explicit selected manifest and operator review before apply. Dry-run can be developed earlier. This is the only planned existing-user data population, not a public migration journey.

**Unit/integration/E2E tests:** tests/known-user-backfill.test.ts/.integration.ts with selected/unselected users, missing account, conflicting facts, known/unknown source, valid/invalid evidence, A-level null and repeated execution. Dry-run changes zero documents; apply touches only listed accounts/allowed fields; repeat creates no duplicate profiles/history. Run concurrent personal-data update fixtures and compare credentials/IDs/all learning fields before/after. E2E sign in as selected accounts on all three websites, with legacy credentials/sessions still valid and expected onboarding facts only.

**Regression risks:** Wrong identifier resolution, accidental credential/session reset, overwriting an existing correct DOB/history/source, unrelated array loss or unselected-account mutation. Refuse/report unexpected conflicts and review new explicit instructions rather than silently applying a merge.

**Acceptance checkpoint:** Approved dry-run, targeted apply and post-apply report agree; existing identities/credentials/data/login behaviour remain intact and repeated execution is safe. No account invitation/creation has occurred.

### Phase 8 — Final production-mode, multisite and mobile verification

**Functionality:** Complete section 7's evidence checklist and final two-document/scope audit. Verify actual production rendering/cache classifications and end-to-end security/onboarding, not only dev/component mocks. Track external launch dependencies separately from completion of membership implementation.

**Existing files:** No new existing runtime changes beyond the approved inventory and conditional login-route item. Tests/fixtures/scripts/test-phase2.ts may gain isolated indexes/email capture as needed. No configuration/deployment/learning redesign to make tests pass.

**New files:** tests/phase2/puckle-membership.browser.ts or a focused suite under the existing real-server runner, production comparison checks and site engineering evidence in docs/engineering/sites/puckle. Add a small production-mode runner only if existing dev runner cannot support the comparison; no general test infrastructure replacement.

**Database:** Disposable replica sets and fixture provider for automated mutation. Rehearse preparation/backfill. No cleanup/rollback that deletes legitimate accounts or history; delay release rather than exposing partial security/safeguarding workflows. Any real approved backfill is separately reviewed at phase 7.

**Dependencies:** Phases 1–7, provider configuration, reviewed evidence-retention/common disclosure and applicable external legal/safeguarding checks. Implementation completion does not authorise public launch/deployment.

**Unit/integration/E2E tests:** Run appropriate unit/integration/type/lint/build checks and full real-server journeys, including every new flow plus all three websites' legacy auth. Compare baseline/candidate production builds and routes, measure timings/query counts, inject mail/onboarding faults and exercise real iOS/Android interactions. Record actual passes/failures/skips and unrelated baseline failures.

**Regression risks:** Mistaking development rendering or mocked sessions for production proof, assuming absence of group code blocks membership, overlooking an extra runtime-file change, claiming a general DB outage is an onboarding-only failure. Keep measurements and scope assertions explicit.

**Acceptance checkpoint:** New functions and unaffected application behaviour have reviewable evidence; only justified documented existing-file edits remain; remaining external launch decisions are recorded. No Group Experience enforcement or future administrative onboarding is represented as delivered.

## 7. Final verification checklist and measurable regression evidence

### Architecture and automated checks

- [ ] Run npm run test:unit, npm run test:integration, focused npm run test:e2e suites, typecheck, lint and build. Real-server journeys use the disposable runner; report skipped/unrun checks honestly.
- [ ] Inspect the runtime diff against section 2. Only the five reviewed shared integration files plus specified Puckle public/API files and the explicitly approved login-route addition may change; no learning models/pages/inner components/global CSS/media/groups/Step Visuals/seed script changes.
- [ ] Shared age/assurance/approval authority exists only on users, while maths/category/intro/mobile/welcome metadata stays in puckleMemberships. Contact requests have no users/profile linkage created automatically.
- [ ] Common approval scope covers all three equivalent sites, retains accepted explanation and is not keyed per website. No generic parentApproved/canJoinGroups grant or group read/write is introduced.
- [ ] Unique email/exact-case username/profile indexes and final-proof consumption withstand races; setup reruns and reports unexpected errors without modifying identities.
- [ ] Check AuthUser/login/me/user-directory/creator projections and logs/analytics for accidental security/DOB/guardian/mobile/code/token/password exposure.

### Production rendering, caching and timing

- [ ] Before implementing the mount, record baseline production build route classifications and prerender-manifest/cache behaviour in a disposable environment. Repeat under equivalent config after implementation. Do not infer production caching from next dev.
- [ ] Compare Puckle/Switchplay/Strat17 /, /contact, /privacy, /login, representative app routes and /step-visuals; include a static-capable/not-found route where relevant. Existing marketing headers already use cookies: the criterion is no new classification/cache regression, not an invented static baseline.
- [ ] Verify RootLayout imports no request/auth/database helper for onboarding. SSR/initial hydration has no panel and no public-route onboarding request. A static-capable Step Visuals response remains static-capable.
- [ ] Compare cold/warm TTFB and first-content/LCP distributions for baseline/candidate production builds; count relevant backend lookups. Record sample/config/results and investigate repeatable material regressions rather than asserting an unmeasured millisecond budget.
- [ ] Delay or fail the onboarding endpoint/module while rendering an otherwise healthy application. Existing content/interaction becomes usable without waiting; a shared database outage is distinguished from an isolated onboarding failure.
- [ ] Record onboarding network calls through repeated Card swipes/flips, focused views, ordinary in-Deck navigation and Step Visual interaction: zero calls triggered by these actions. Entry/auth/focus/status changes are independently identified and coalesced.
- [ ] During acknowledgement/request/resend/local dismissal, harness sibling render counts stay unchanged and actual app DOM, selection, unsaved edits, progress and media playback remain intact. Onboarding never calls router.refresh.

### Registration, mobile/no-email and recovery journeys

- [ ] Student is default immediately on Join; all three categories show mobile at first render. Test valid email with no mobile, supplied invalid optional mobile and no-email required mobile.
- [ ] No-email mode hides/clears credentials; server rejects credential payloads and stores no password/hash/reserved username. Save distinct request/notification and show follow-up confirmation; users and profiles counts stay unchanged.
- [ ] Interest email/mobile/both works without an account or email-code requirement; unchecked/declined updates is preserved, phone-only has no email/SMS marketing permission. Founder can retrieve all saved interest/no-email requests and count no-email usage.
- [ ] Student DOB/course/applicable level is mandatory and >=13; A-level disables/clears selection, accepts/stores null server-side and becomes required again after switching away. Other/Don't know text/path combinations remain valid without changing tuition options.
- [ ] Ten-minute code, wrong/expired/replaced code, five attempts, recipient/requester limits and email-change binding work. Account/profile/proof transaction creates one ordinary account; no incomplete account is created on send/failure/invalid proof.
- [ ] Successful new registration sets the normal cookie and opens authenticated application automatically; a stale prefetch/public layout does not require another login. Duplicate email/username never overwrites/signs into an existing account.
- [ ] Teacher blank introduction succeeds with normal permissions, optional mobile and founder notification. Teacher no-email route stays contact-only and unknown-age is not treated as adult verification.
- [ ] Forgot password and single-use 30-minute reset preserve existing ID/email/username/learning data. Existing users without new email metadata and with legacy passwords can still log in/recover. Old JWTs fail after reset, version-zero legacy sessions remain valid without reset, and a login/reset race cannot issue a valid token using the old password.
- [ ] Across all three website hosts test email/exact username login, same-URL sign-in/sign-out, existing response shapes/cookie flags/expiry, all reviewed notification paths and cross-tab account changes. Keep host-only session semantics; use the existing local/preview site selection rules.

### Enquiries, approval and first onboarding

- [ ] Anonymous existing enquiry paths/contact methods/honeypot/success pass unchanged. Known-DOB Puckle students see no selector, have safe prefill and cannot forge an under-18 request into adult guardian-free validation. Unknown DOB retains the selector.
- [ ] Parent enquiry saves/notifies without child credentials/DOB, membership or invitation; founder personal follow-up arranges the session. Repeated guardian contact/siblings remain valid. Adult optional direct Join uses unverified client state only.
- [ ] Founder notification pending/failure/timeout after durable save does not turn success into lost submission. Saved records/provider references support authorised retrieval/manual recovery; no background worker/dashboard is needed.
- [ ] First 13–15 welcome contains tuition choices and optional guardian setup now. Submitting guardian email automatically sends the separate common approval request; skip/Explore immediately exposes learning.
- [ ] Not-requested/pending/resend/approved/declined/withdrawn, replaced/expired links, explicit declaration and renewal are tested. One recorded approval returns the same common scope across all three site contexts; tuition permission and age verification remain distinct.
- [ ] Email-action GET/scanners make no final decision. Sentinel token stays out of HTTP URLs/Analytics/logs/referrers/third-party resources; context exchange is purpose/account/state-bound. Two child links in separate tabs cannot change the wrong child's record, and a parent's unrelated logged-in account is not assumed to be the target.
- [ ] Delayed welcome never expands over active learning; optional setup remains reachable in a quiet first-visit control. Focus refresh does not reopen dismissed panels. Successful seenAt acknowledgement prevents normal repeat logins/other-browser welcome.
- [ ] Turning 16 removes only the reminder; under-18 tuition still applies until 18. Reviewed DOB correction updates facts/history and invalidates stale assurance without deleting data or changing application/group rights.

### Backfill, mobile and failure handling

- [ ] Review selected manifest dry-run, apply and rerun; missing/conflicting accounts/facts refuse safely. Only selected allowlisted fields change, all IDs/credentials/session versions/learning data and true historical origin remain intact.
- [ ] Test 320px/390px/tablet/desktop plus real iOS Safari/Android Chrome, email links opening another browser, mobile keyboards and Shadow DOM styles/focus/safe areas. Preserve screen-reader labels, error/success announcements and keyboard navigation.
- [ ] Exercise modal/fullscreen media priority, document capture/bubble shortcuts, Escape/Tab/touch/wheel and outside Card gestures. Panel only captures its own interactions; body/global CSS/learning handlers are unchanged.
- [ ] Inject status timeout/500, optional chunk/render failure, local storage/channel failure, failed acknowledgement and stale async actions. Application stays mounted/usable and prior-user overlay content is cleared before identity revalidation.
- [ ] Final two-document scope audit confirms no live provisional/invitation/activation/linking requirements, per-site approvals, global mandatory student profile, SMS auth, Group Experience implementation or reusable admin onboarding. Evidence claims reflect what was actually run.

## 8. QUESTIONS and external pre-launch dependencies

Settled defaults are not reopened: common cross-site approval; client host/notifiers; pre-account ten-minute email verification; 30-minute reset; seven-day approval; username/password policy; mobile/no-email contacts; A-level null; Dublin/March-1 convention; optional teacher introduction; optional unchecked email updates; approved unique indexes; one-time selected backfill; no group enforcement/seed changes.

| Remaining item | Recommendation / required input | When needed |
| --- | --- | --- |
| Shared login-route approval | Approve the exact small helper call change below so credential checking and signed version share a snapshot. No AuthUser/API/navigation change. | Before phase 2 implementation includes that file. |
| Email provider/configuration | Supply one provider, verified sender settings, founder recipient and canonical production/development/preview action origins. Use one shared transport with Puckle templates, not three implementations. | Before live email acceptance; fixtures permit earlier development. |
| Common activity explanation | Safeguarding owner must supply/approve actual equivalent Group Experience visibility/sharing/withdrawal wording covering all three sites and accepted version. Do not invent capabilities from absent group code or send a placeholder as final consent. | Before real approval requests/public launch, not a blocker to data-contract tests. |
| Evidence retention/correction review | Approve purpose-based retention/review/deletion criteria and the operator's correction/evidence procedure; do not assign one arbitrary lifetime to users/history/transient tokens. Code supports reviewed targeted changes and history. | Before production collection/retention policy acceptance. |
| Known-account manifest | Supply explicit account identifiers and known values/evidence; review dry-run and unknown origins before applying. | Phase 7 apply checkpoint. |

External legal/privacy review must confirm private learning for ages 13–15 without initial parental approval, children's notices and proportionate age/guardian assurance. Separate safeguarding work owns teacher/false-DOB bypass protection, corrected under-13 account policy, stronger verification and every Group Experience enforcement/withdrawal/age-transition effect. Before an under-16 public experience exposes groups, that enforcement must be ready; this membership project neither implements it nor is blocked by absent group code. Confirm the existing human under-18 live-tuition permission process separately.

The fact that one common approval covers three sites is settled. Later material divergence may need additional approval, but there is no future multisite permission/profile engine in this plan.

## REQUIRES EXPLICIT APPROVAL

**Additional existing shared-auth runtime file:** src/app/api/auth/login/route.ts.

**Proposed edit:** Replace its separate authenticateUser(identifier, password) then setSession(user) calls with one signInWithPassword helper from auth.ts that binds the session version to the same account/password snapshot. Return the same { user } JSON, statuses and generic login errors; retain all request validation and current session/navigation behaviour. The helper must not apply new-registration password-strength/DOB/profile rules to legacy login.

**Reason:** A reset between password checking and a later fresh-version lookup must not allow the old password to mint a valid new-version session. Carrying this proof explicitly is simpler and safer than hidden DTO metadata/caches. This route was not in the latest five-file approved integration list, so its minimal edit is proposed here for approval before implementation, not silently assumed authorised. Phase 2's race test verifies the purpose.

No additional existing authenticated learning-component changes are proposed. OverviewMenu's single auth notification is already expressly approved; its learning cleanup/navigation remains untouched. Any further unavoidable runtime change must be listed by exact path/edit/evidence here and approved before inclusion. Fix/suppress the new overlay rather than changing learning CSS, gestures, focus, media, models/pages or group functionality.

## 9. Planning completion and release limits

This revision incorporates the latest architectural assessment and final product decisions. It changes only the requested design/engineering Markdown documents. No application/test/configuration implementation, account/database mutation, email, commit, push, merge or deployment is performed. Application checks and production comparisons above are required future implementation evidence, not claimed as executed during documentation work.
