# Organisations — Draft Engineering Plan

**STATUS: PARTIAL DRAFT — investigation in progress. Not ready for implementation.**
Planning only. No application code, migrations or data were changed.

- Spec (authoritative): `docs/design/features/organisations/organisation-foundations-draft-spec.md` (30 Oct 2026). Section references below ("§") are to it.
- Branch inspected: `feat/group-experience` (HEAD `39aa33a`, "checks not yet complete"). Group-experience errors on this branch are assumed to be fixed later; where they matter it is noted.
- Evidence labels: **Verified** (read in code) · **Provisional** · **Proposed** (needs agreement) · **Unresolved**.
- A second attachment (`file_organisations-specification.md`) was empty (0 bytes); the spec in the repo was used.

## 0. Investigation log (resume here)

| Area | State (session 2) |
| --- | --- |
| Spec read in full | Done |
| Decisions Q1–Q8 + feedback A–F recorded | Done (§0A) |
| A. Users / auth / scripts | Done; auth enforcement verified across all 82 routes (§2.F); email/username findings |
| B. Access-check inventory | Done by grep (Appendix A). Not a proof of completeness (hence the guard test) |
| C. Publishing / visibility / fork | Publish path read; gate points listed (§3.5) |
| Q3 Card removal A/B/C evaluation | Done (§3.6), recommendation B; product choices remain (Q3a–e) |
| Officer-concurrency comparison | Done (§3.5), recommendation: derived query |
| Group experiences (create, access, member commands, content scope) | Read in repo; supervision design written (§3.7, §3.8) |
| Admin UI incl. app-admin chooser | Designed (§3.9) |
| **Info Cards + series + Personal Info Cards access paths** | **NOT yet re-investigated this session** |
| **Media authorisation paths** | **NOT yet re-investigated this session** |
| Stages / risks / tests rewrite to match decisions | **NOT yet done** (still first-draft text; §4–§6 partly stale) |
| Questions rewrite (Q9+ new) | Partly (Q3 rewritten; Q9–Q12 to add) |

### 0B. Next concrete steps for a resumed session
1. Info Card + series + Personal Info Card access paths (`src/lib/infoCards/{queries,repository,media,mediaRegistry}.ts`, routes `info-cards/*`, `library/info-cards`, `info-card-series`, `cards-data/*/personal-info-cards`) -> add §2.H and scope hooks.
2. Media authorisation (`lib/cards/{protectedMedia,libraryMedia}.ts`, `cardMediaAccess.ts`, `app/api/media/*`) -> add §2.G; add moderation + scope filters to scans.
3. Rewrite §4 stages (no intermediate releases; integrate Stage 4 supervision; Stage 5 checks), §5 risks (add R21+), §6 tests.
4. Add questions Q9–Q12 (see §8 "Questions to add").
5. Re-mark status `DRAFT — READY FOR PRODUCT/ENGINEERING REVIEW` only after 1-4.
6. Needs the owner: duplicate-username check on production data, who holds `isAdmin`.

## 0A. Decisions confirmed after review of the first draft (31 Oct 2026 session)

These override the draft and, where noted, the product spec. **Proposed spec amendments** are flagged for the owners to incorporate; the spec itself was not edited.

| Ref | Decision | Effect on this plan | Spec amendment needed? |
| --- | --- | --- | --- |
| Q1 | No public sign-up. Extend provisioning scripts and the new admin tooling. All **new** accounts require DOB; legacy accounts may lack it. | Public registration + DOB collection recorded as **BL-15** (new). | §4.2 says independents "sign up through the existing process"; no such process exists — amend. |
| Q2 | Officer requirement applies only to making content visible to other organisation members. Private publication is unaffected, and must not leak. | Gate keyed on org-visible publication only (§3.5). Added a negative test: private publication never exposes content. | §7.3 wording "publish" → "make visible to other members". |
| Q3 | **Not decided.** Investigate Approaches A/B/C. Placeholder not approved. | Replaced by §3.6 evaluation and recommendation; Q3 remains open only for the product choices left. | — |
| Q4 | Plan the complete adult-supervision mechanism now, as a **generic safeguarding capability**, not coupled to Info Cards. Unfinished group/Personal Info Card work is assumed completed before implementation starts. | Old "Stage 4b blocked" claim withdrawn. New §3.7 and Stage 4. | §7.4 can stay; add that supervision gates all shared contributions (media, Info Cards, others). |
| Q5 | Application admins **also** get the member-management UI with a minimal organisation chooser. Org creation and batch provisioning stay script-based. | Stage 2 scope grows; §3.8. | §9.2 "no default UI route" is consistent; clarify that the member-management screen has an organisation chooser for app admins. |
| Q6 | New `applicationAdmin` role; `isAdmin` untouched and not reinterpreted; script assigns first app admin. | §3.1/§3.4; script in Stage 1. | — |
| Q7 | Login throttling/lockout and temporary-password expiry **deferred**. | **BL-16** (new, must be reviewed before a live pilot with minors). Risk R11 re-labelled deferred. | Add to §12 backlog. |
| Q8 | Case-insensitive **global username** uniqueness. **No** global email uniqueness unless required by the auth design. Handle duplicates first; login lookup must match the uniqueness rule. | §3.1/§3.3 changed; see §2.A email finding. | — |
| A | Stages are not separate deployments. | No intermediate-release protections designed. Stages remain ordering/test units. | — |
| B | Officer-count counter should be compared against simpler options. | §3.5 rewritten with comparison. | — |
| C | Group-experience **records themselves** need organisation ownership/access, not only member and Deck selection. | §3.2/§3.7 and Stage 4 updated. | — |
| D | Do not assume all routes share one auth wrapper. | §2.F verification added. | — |
| E | Group and Personal Info Card work are present but unfinished; plan for their final shape and list integration checks. | §1 assumptions + §4 Stage 4/5 integration-check lists. | — |
| F | New backlog items get IDs. | BL-15, BL-16, BL-17+ below (§7). | Add to spec §12. |

## 1. Branch reality vs spec assumptions

| Spec assumption | Reality on this branch | Evidence |
| --- | --- | --- |
| Group-experience may be absent (§11.5) | **Present** (foundation, learning, adoption, membership lifecycle; checks incomplete). Stage 4 is not blocked by a missing branch, but by that feature's own stability. | `src/lib/groupExperiences/*`, `src/app/api/group-experiences/*`, commits `d68bd4c`…`39aa33a` |
| Personal Info Cards absent (§7.2, §11.6) | **Present** (`kind: "personal"` Info roots). The "do not pre-build" rule still applies: no org code should reference them; §11.6 becomes a regression-test checkpoint rather than a wait. | `src/lib/infoCards/model.ts` (`isPersonalInfo`) |
| Independent users "sign up through the existing process" (§4.2) | **There is no account sign-up flow.** Users are only created by `scripts/seed-user.mjs`. `earlyAccessSignups` is a marketing list, not accounts. See Q1. | only `scripts/seed-user.mjs` inserts users |
| Username globally unique (§3.2) | **No unique index** on `users.username` or `email`; uniqueness is a find-then-insert check in the seed script (race-prone). | `scripts/seed-user.mjs`; no `createIndex` on users in `src` |

## 2. Verified findings so far

### A. Users and authentication (Verified)
- `UserDocument` (`src/lib/auth.ts`): `email, username, passwordHash, decksData, cardsData (embedded personal state), sharedDeckData?, isAdmin?, createdAt, updatedAt`. No `organisationId`, `dateOfBirth`, `ageVerified`, `active`, roles or `mustChangePassword`.
- Login: `POST /api/auth/login` → `authenticateUser` (bcryptjs compare; identifier is email if it contains `@`, else exact-case username) → `setSession`. No rate limiting, no lockout.
- Session: HS256 JWT (`jose`) in an `httpOnly` cookie `switchplay_session`, 30 days, payload `{sub, email, username}`. **`getCurrentUser()` re-reads the user document from MongoDB on every call**, so deactivation can be enforced immediately at that one point without token revocation. This satisfies §3.1/§10.1 "immediate enforcement on existing sessions" cheaply.
- `getCurrentUser` is the single choke point: used by `cardRequest` (`src/lib/cards/http.ts`, which wraps essentially all `/api/*` handlers; group-experience and Info Card routes go through their own `http.ts` helpers — **Provisional**, confirm each), plus direct callers: `app/api/media/protected`, `app/api/users`, `lib/cardMediaApi.ts`, `cardMediaFile.ts`, `cardMediaVideoFile.ts`, and several server pages. Every one sees the same org/active check if the check lives inside `getCurrentUser`.
- `AuthUser` (returned by `/api/auth/login` and `/api/auth/me`) = `id, email, username, isAdmin, createdAt, updatedAt`. `isAdmin` is only used for creator preview (`app/creator/*`); it is **not** an application-admin role for anything else today.
- No password-change, reset, temporary-password or forced-change flow exists. No account deactivation or deletion mechanism exists.
- `GET /api/users` returns **every user's username and id** to any logged-in user (no scoping, no pagination). This is the user lookup used for follower/admin selection and is a direct tenant leak (§5.2, §6.1) — must be scoped in Stage 1.
- Passwords: bcryptjs cost 12 in the seed script.

### B. Template visibility (Verified, partial)
- Template access is decided by a scattered predicate "owner is actor, or root/version is `public`". Roughly **80 `visibility` predicate lines in 17 files plus 40 `assertCardVersionAccess/assertDeckVersionAccess` calls in 12 files** (exact list in Appendix A; supersedes the earlier "~75" estimate): `lib/cards/repository.ts` (~29 public + ~45 owner), `libraryReadModels.ts` (11), `resolvers.ts` (6+11), `infoCards/repository.ts` (6+8), `infoCards/queries.ts` (5+5), `libraryMedia.ts` (4), `protectedMedia.ts` (3), `groupExperiences/adoption.ts` (3), `groupExperiences/publicVersions.ts` (2), `versionAccess.ts` (2), `readModels.ts`, `libraryProjection.ts`, `deckTemplateQueries.ts`, `deckTemplateDocuments.ts`, `publicationRules.ts`, `cardReuse.ts`.
- `src/lib/cards/versionAccess.ts` already centralises the read check for versions: `assertCardVersionAccess/assertDeckVersionAccess(actor, root, version)` = `root.ownerUserId === actor || (root.visibility === "public" && version.visibility === "public")`. It takes only the actor ID, so it cannot know the viewer's organisation today.
- Template roots (`CardTemplateRoot`, `DeckTemplateRoot`, `src/lib/cards/model.ts`) have `ownerUserId` and `visibility: "private" | "public"`, `forkedFrom`; no organisation field. Public visibility is permanent (`PUBLIC_VISIBILITY_PERMANENT`, `repository.ts` line ~30).
- Card/Deck data of a user is embedded in the `users` document (`cardsData`, `decksData`), so user-owned learning data inherits the user's organisation by construction.

### C. Publishing (Verified)
- Publishing is not only "make public". `CardRepository.publishCard` (`src/lib/cards/repository.ts` ~line 683) creates an immutable version with `visibility = draftVisibility(root)` (**private or public**). Users need a *published version* (even private) before they can follow/use their own Card or Deck (`data-model.md`: "personal records adopt positive published versions"). Same for `publishDeckInSession`, `promoteCard`, and Info Card `publish`.
- Consequence: the spec's "safeguarding officer must exist before any member may publish" (§7.3) **must be keyed to organisation-visible (`visibility: "public"`) publication only**, otherwise members cannot use their own new content before an officer exists, contradicting "used for drafting" in §7.3. See Q2.
- Eight template-root creation sites in `cards/repository.ts` (lines ~424, 487, 505, 533, 538, 553, 589, 615: drafts, forks, copy, graph, create-and-attach) plus three Info sites (`infoCards/repository.ts` ~98, 125, 161 incl. series). All set `ownerUserId: actor`.
- Forks/Library add read foreign public content through `assertCardVersionAccess` (`forkView`, `validateForeignSelections`, `addLibraryDeck`).

### D. Administration (Verified)
- No admin UI, role model or org concept exists. Navigation is `components/layout/OverviewMenu.tsx` with fixed links (Library, My Decks, Progress, Creator, Contact). Pages follow "server page → `getCurrentUser()` → `EmbeddedAuthScreen` or a client shell" (`app/progress/page.tsx`). A minimal `/organisation` page and one conditional menu item fits this pattern.

### E. Group experiences and Info Cards on this branch (Verified at structural level)
- Group experience data: `groupExperiences`, member rows with `isAdmin` and `followerStatus` (`never|active|removed`), `adminCount`, `structureRevision`, per-member `accessEpoch`/`writeFence` (`src/lib/groupExperiences/model.ts`, `repository.ts`). Member eligibility is validated only by `registered(userIds)` (`repository.ts` ~line 49) = "user documents exist". **No organisation check anywhere.** It is the single choke point for create and add-follower.
- There is **no adult-leader, acceptance, supervision or "communication active" concept**, and **group-shared Info Cards do not exist yet** (no experience reference in `src/lib/infoCards/*`). So §7.4 rules 2–6 and §8.2 (group-admin removal of shared Info Cards) have nothing to attach to on this branch. Only scoping (who may be a member, which Deck may be used) can be done now.
- Personal Info Cards exist on this branch (see §1).

### F. Authentication enforcement across routes (Verified in this session)
Every one of the 82 route handlers was classified by which auth path it uses (script over `src/app/api/**/route.ts`, then the "unclassified" ones read individually).
- **All authenticated traffic reaches `getCurrentUser()` through exactly three paths:**
  1. `cardRequest` (`src/lib/cards/http.ts`) — the base of `personalUpdateRequest`, `creatorRequestBoundary`, `libraryRequest` (`cards/libraryHttp.ts`), `infoRequest` (`infoCards/http.ts`, built on `creatorRequestBoundary`), `groupRequest` (`groupExperiences/http.ts`) and `assessmentRequest` (`assessments/http.ts`, built on `personalUpdateRequest`). Covers cards-data, decks-data, deck-templates, card-templates, creator, frameworks, items-data, library, info-cards, info-card-series, group-experiences, media upload/status routes.
  2. Direct `getCurrentUser()`: `api/auth/me`, `api/users`, `api/media/protected`, server pages (`decks`, `library`, `library/[id]`, `progress`, `creator/*`, `login`) and `components/public-site/PublicHeader.tsx`.
  3. Injected `currentUser` that dynamically imports `getCurrentUser`: `lib/cardMediaApi.ts`, `cardMediaFile.ts`, `cardMediaVideoFile.ts` (routes `media/card/*`).
- **Routes with no auth by design:** `auth/login`, `auth/logout`, `public/{contact,creator-interest,early-access}` (marketing forms), and four legacy routes that return a fixed 410 before any lookup (`decks-data/reconcile`, `decks-data/shared*`, `deck-templates/.../cards/[cardTemplateId]` PATCH).
- **Conclusion (Verified):** there is one place (`getCurrentUser` in `src/lib/auth.ts`) where "inactive user / inactive organisation / password change required / credentials changed after token issue" can be enforced for *every* authenticated route. No route reads the session cookie itself (only `src/lib/auth.ts` references `switchplay_session`). **Caveat (Unresolved):** two upload-proof JWTs (`infoCards/media.ts`, `cards/prospectiveUpload.ts`) use `jwtVerify` for 30-minute purpose-bound upload proofs, not sessions; they are issued only after an authenticated call but are not re-checked against account state when redeemed — low risk, note for Stage 1 tests.
- **Mandatory password change — design implication:** the safest fail-closed design is for default `getCurrentUser()` to return `null` for an account with `mustChangePassword`, so **every existing caller treats it as unauthenticated (401 / login screen)** with no per-route change; a separate `getPasswordChangeSession()` (same cookie, same verification) is used only by `POST /api/auth/change-password` and the login screen.
- **Email findings (Verified):** email is used only for login-by-email (`authenticateUser` looks up `findOne({ email })` when the identifier contains `@`), for the session JWT payload, and for the `AuthUser` DTO. Nothing else depends on email uniqueness. **However** (a) `findOne({email})` with duplicate emails would silently pick an arbitrary account, and (b) `readSessionToken` rejects any token whose `email` claim is not a string, and `UserDocument.email` is a required string, so an account **without an email cannot hold a session today**. Both matter for organisation accounts (children may have no email, and a person may share an email between independent and club accounts).
  - **Proposed:** no unique email index. Email login succeeds only when exactly one active account matches (otherwise the generic failure; the user signs in with the username). Make `email` optional on `UserDocument` and drop the `email` claim from the session token (the user document is re-read every request anyway). See Q9.
- **Username lookup (Verified):** login uses exact-case `findOne({ username })`. With case-insensitive uniqueness (Q8), login must use the same collation/normalisation, otherwise `Jane` and `jane` are one account at creation but two different lookups. **Proposed:** store `usernameLower` (or use a collation index) and look up by it.

## 3. Proposed architecture (Proposed unless marked)

### 3.1 Data model
- **`organisations` collection (new):** `organisationId` (UUID string), `name`, `active`, `createdAt`, `updatedAt` (no officer counter; see §3.5). Unique index on `organisationId` and on a normalised name. No self-service creation (§3.1).
- **`users` additions (all optional so legacy documents remain valid):** `organisationId: string | null` (missing ≡ `null` ≡ independent; immutable after creation), `dateOfBirth: Date` (never returned by APIs), `ageVerified: boolean` (false on creation), `active: boolean` (missing ≡ true), `roles: { organisationAdmin?: true; adultLeader?: true; safeguardingOfficer?: true; applicationAdmin?: true }`, `mustChangePassword?: true`, `credentialsChangedAt: Date`. Existing `isAdmin` keeps its present meaning (creator preview) and is **not** reused for application admin, so no existing account silently gains cross-organisation power.
- **Content scope: denormalised immutable `organisationId` on template and Info roots** (`cardTemplates`, `deckTemplates`, `infoCards`, `infoCardSeries`), copied from the creating user's document in the same transaction as the insert (11 insertion sites listed in §2.C). Missing ≡ `null` ≡ independent, so **no migration of existing content is needed**. Because membership is fixed at account creation and a fork is created by the forking user, a root's scope never changes.
  - *Why not derive scope from `ownerUserId`?* It needs a user lookup inside every predicate (about 75 sites, several inside aggregation pipelines such as `libraryCollection`) and breaks if an owner document is unavailable. Denormalisation is a single field and a plain Mongo filter. Missing-field-equals-null semantics keep independents unchanged.
  - *Alternative considered (not recommended):* a new visibility value (`"organisation"`) so un-updated predicates would fail closed. It changes the `Visibility` type, permanence rule, fork and publish flows (high churn) and still needs every site touched.
- **Visibility rule (one equation for everyone):** a viewer may read another user's content iff `root.visibility === "public"` **and** `(root.organisationId ?? null) === viewer.organisationId`. Owner access is unchanged. Independents therefore see only unscoped public content (today's behaviour), and organisation members see only their organisation's public content.
- **Moderation:** `moderation?: { removedAt, removedByUserId, reason? }` on roots, plus append-only `moderationEvents` (`targetKind`, `targetId`, `organisationId`, `action: "remove"|"restore"`, `actorUserId`, `at`). Removal flips only the root flag; versions, relationships, CardData/DeckData are untouched (non-destructive, reversible, applies to every Deck using the canonical Card because the flag lives on the Card root).
- **Indexes:** unique `users.username` (case-insensitive collation) and unique `users.email`; `users.organisationId`; `(visibility, organisationId, latestVersion)` on deck/card/info roots; `moderationEvents (organisationId, at)`. Index creation follows the existing explicit-deployment pattern (`createFoundationIndexes`, `scripts/setup-info-cards.ts`) — **never auto-created on request**. Unique indexes need a pre-check for duplicate legacy usernames/emails (**Unresolved**, needs production data; see §0).

### 3.2 One scope module, threaded through access paths
- New `src/lib/organisations/scope.ts`: `ViewerScope = { id, organisationId: string | null }`, `scopeOf(doc)`, `sameScope(root, viewer)`, `scopeFilter(viewer)` (Mongo filter), and `assertSameScope`.
- `getCurrentUser()` returns the scope (org id) and enforces `active` (user and organisation). `cardRequest`/other helpers pass it on. Repository methods that already load the actor's user (`assertUser`) can read `organisationId` without an extra query.
- `assertCardVersionAccess` / `assertDeckVersionAccess` (`versionAccess.ts`, 40 call sites in 12 files — Appendix A) change from taking an actor id to a `ViewerScope`; raw predicates (~19 `ownerUserId === actor ||` sites plus Mongo `visibility: "public"` queries in `libraryReadModels.ts`, `infoCards/queries.ts`, `protectedMedia.ts`, `libraryMedia.ts`, `publicVersions.ts`, `deckTemplateQueries.ts`) move to the shared helpers. This is mechanical but wide; treat as one reviewable refactor (Stage 1b) with a **static guard test** that fails if `visibility === "public"` or `visibility: "public"` appears outside the scope module and an allow-list (the safety net against a forgotten site).
- Entry points that need explicit scope (beyond the access asserts): `libraryCollection`, `publishedLibraryEntries`, `libraryDetail`, `libraryViewerStatus`, `addLibraryDeck`, forks/copy, `infoCatalogue`, `discoverSeries`, `eligibleSeries`, media authorisation (`authorizeProtectedMedia` scans public roots), `GET /api/users`, group `registered()` and Deck selection (`validateCreationManifest`, `publicVersions.ts`).

### 3.3 Authentication and sessions
- Keep JWT/cookie/bcrypt. In `getCurrentUser`: return `null` if the user is missing, `active === false`, the organisation is inactive, or the JWT `iat` is earlier than `credentialsChangedAt` (invalidates sessions after password reset/change and forced re-auth). One extra organisation read per request (or `$lookup`) — acceptable; this already costs one user read per request.
- `mustChangePassword`: `getCurrentUser()` default behaviour returns the user flagged; all `cardRequest`-wrapped routes reject with `PASSWORD_CHANGE_REQUIRED` (403) until changed; a new `POST /api/auth/change-password` is the only allowed route. Login redirects to the change screen. Minimal UI: one form reusing existing login screen styling.
- Temporary passwords: generated with `crypto.randomBytes` (≥ 12 characters, unambiguous alphabet), hashed with bcryptjs exactly like the seed script, printed once to the provisioning admin (script stdout / one-off file with mode `0600`; UI shows once in the response). Never logged.
- `AuthUser` gets `organisationId` and role flags only; `dateOfBirth`/`passwordHash` are excluded from every projection (add a test that no route serialises a raw user document).

### 3.4 Roles and permissions (server-enforced)
- Roles live on the user document (so changes apply on the next request). A small `src/lib/organisations/permissions.ts` implements §5.1: only `applicationAdmin` can set `organisationAdmin`; an `organisationAdmin` cannot grant safeguarding roles to themselves or touch another organisation or deactivate a peer `organisationAdmin`; `adultLeader`/`safeguardingOfficer` require `dateOfBirth` showing 18+ **and** an explicit approval action (the act of an authorised admin assigning the role is the approval; no separate workflow). Every mutation re-reads the target and actor inside a transaction.

### 3.5 Safeguarding-officer gate and concurrency (supersedes the first draft's counter)

**Options compared**

| | Counter on organisation (`activeSafeguardingOfficerCount` + `publishGuard`) — first draft | **Derived query inside the publish transaction (recommended)** | Revision touch (`organisations.safeguardingRevision`, no count) |
| --- | --- | --- | --- |
| New state | A count that must be updated by every officer grant/revoke, user (de)activation, org (de)activation and any future path that changes `active`/roles | None (officer = `users` row with `organisationId`, `active`, `roles.safeguardingOfficer`, organisation active) | One integer that only ever increments |
| Drift / recovery | Can drift after a crash, a script edit or a missed path; needs a repair script | Cannot drift: the source of truth is read directly | Cannot drift |
| Concurrent last-officer removal vs publish | Strict (write-conflict) | Snapshot read. A publish already past its read can commit milliseconds after the removal. The outcome is indistinguishable from "published just before removal" and the content stays visible either way (§7.3: existing published content is not unpublished). | Strict (write-conflict) if both publish and role changes `$inc` it |
| Concurrent publishes | Serialised per organisation | Not serialised | Serialised per organisation |
| Deactivation/reactivation | Must maintain count | Automatic | Must remember to `$inc` on every officer-affecting change |
| Testing | Interleaving tests plus count-consistency tests | Plain unit/integration tests; no race tests required | Interleaving tests |
| Matches existing patterns | `publicationGuard` precedent | The group code's derived reads | `publicationGuard` precedent |

**Recommendation: derived query.** Within the publish transaction run
`users.countDocuments({ organisationId, active: { $ne: false }, "roles.safeguardingOfficer": true }, { limit: 1, session })` plus a read of the organisation's `active` flag, and block with `SAFEGUARDING_OFFICER_REQUIRED` when there is none. It needs no new state and has no synchronisation obligations; a partial index on officers keeps it cheap. The millisecond ordering window is semantically harmless for the agreed requirement. **If the owners want strict linearisation**, the *revision-touch* column is a drop-in addition (role changes `$inc` one field and publish reads-then-writes it) — still without any count to keep consistent. The first-draft counter is withdrawn.

**Gate points (Q2: org-visible publication only):** `publishCard` and `publishDeckInSession` when `draftVisibility(root) === "public"`, `promoteCard`, and `InfoCardRepository.publishVersion`/`save` with intent `public`. **Private publication is never gated and must never create org-visible content**: the visibility used for the version is the root's explicit private visibility, and the scope rule (§3.1) only makes `public` content readable by others. Negative test: a private version of an organisation Card is invisible to another member by every read path (Library, direct id, fork, group selection, media scan).
- **Safeguarding "active" definition:** user active, organisation active, role present. Adult status is checked once at role assignment (DOB is immutable after creation in this pass).

### 3.6A Staleness note on the Moderation model above
The `moderation` field and `moderationEvents` defined in §3.1 are the *state*; the evaluation of how removal propagates is §3.6 below.

### 3.6 Content removal and restoration — evaluation of Approaches A, B, C (Q3 investigation)

**Relevant verified architecture**
- A Deck version is an **immutable** snapshot: `DeckTemplateVersion.content.cards = [{ cardTemplateId, cardVersionAtPublish }]` (`src/lib/cards/model.ts`). Every follower's `DeckData` points at one such version (`deckTemplateVersion`) and holds only `activeCardId` — **DeckData contains no per-Card references**.
- `CardData` is keyed by `cardTemplateId` per user (shared across every Deck that uses that Card). Progress, signals, reflections, media and tests live there.
- Deck composition is resolved from the version, then each Card root/version is loaded and access-asserted in one place for reads: `resolveCards` (`src/lib/cards/resolvers.ts` ~line 34), used by `resolveWorkingDeck` (My Decks display → `workingDTO`), `resolveDeckPreview`, `resolveHistoricalDeck` and `authorizeWorkingCard` (used by media upload/playback authorisation). Today any inaccessible Card makes `resolveCards` throw, so the **whole Deck read fails** (`CARD_FORBIDDEN`).
- Write paths are per-Card: `CardRepository.workingCard` (`repository.ts` ~1158) checks only the target Card (plus the Deck membership/version), so progress/reflection/media writes to *other* Cards would not be disturbed by a removal. (Correction to the first draft, which said all writes would block.)
- `membershipDTO` (`readModels.ts` ~140) already turns an inaccessible Deck into an explicit **"unavailable" membership tile** ("never hide it") instead of failing the page. The Library does the same with `PUBLIC_CONTENT_UNAVAILABLE` (`libraryReadModels.ts` `projectSelections`).
- Card labels are computed from position over the *unfiltered* Deck content (`layoutCardLabels` in `readModels.ts` 52 and `groupExperiences/presentationReads.ts` 27).
- Reverse lookups exist: `deckTemplateVersions` is indexed on `content.cards.cardTemplateId`, decks on `draft.cards.cardTemplateId` (`repository.ts` index setup).

**Approach A — structural removal (mark/remove references in DeckTemplates and DeckData).** *Not recommended.*
- Needs mutating immutable published Deck versions (every historical version that includes the Card, across every Deck) or inventing a parallel per-version exclusion list; DeckData has no Card references to mark, so "mark in DeckData" would mean adding new per-user state for every follower of every affected Deck.
- Write amplification: O(affected Deck versions + followers). Partial failure leaves some Decks removed and others not; restoration must reverse exactly the same set, including Decks published after the removal.
- Breaks version immutability guarantees that `libraryEntry` manifests, update adoption and group adoption depend on.

**Approach B — central moderation flag on the canonical Card root (and Deck/Info roots).** *Recommended.*
- Data: `moderation?: { status: "removed"; at; byUserId; reason? }` on `cardTemplates` / `deckTemplates` / `infoCards` roots, plus the append-only `moderationEvents` audit record (actor, timestamp, action) required by §8.1. Nothing else changes; versions, relationships, CardData, DeckData are untouched.
- One write (flag) + one insert (event) in a single transaction for removal; the same for restore. **No fan-out, no partial-failure state, restoration is exact** (flip the flag). A Card reused in N Decks is covered automatically because every Deck resolves the same root.
- Creator bypass: `publishCard`/`saveCardDraft` do `$set` of specific fields on the root and never replace the document (verified at `repository.ts` ~683–700), so the flag survives republishing. Creators remain able to edit/publish while removed (the content stays hidden), which supports the "fix the video, then restore" workflow.
- **Read-path change:** central. (1) `canReadRoot/assert*VersionAccess` deny when `root.moderation` is set (everyone, including the owner for foreign-visible reads; officer/app-admin moderation views read roots directly). (2) `resolveCards` must *tolerate* a moderated Card instead of throwing, otherwise every Deck containing it disappears (the risk R8 behaviour). This is the one genuinely new piece of logic. See "Treatment inside a Deck" below.
- Other reads that must apply the flag via the same helper: Library list/detail/viewer-status, `libraryMedia`, `protectedMedia` scans (otherwise the removed Card's media stays authorisable), frameworks/progress read models, group-experience composition reads, Info consultation, fork/copy sources, update review/adoption.

**Approach C — temporary suspension.** The mechanism is identical to B (one flag, one reason). A separate "suspended" state would add a second status and a second permission set for no additional capability: *removal followed by restoration already is suspension*. **Recommendation: implement B only**, store `status: "removed"` (the field can later gain another value without migration if product wants a distinct "under review" label).

**Treatment inside a Deck — three technical options (product choice remains, see Q3):**
1. **Omit** the moderated Card from the resolved Deck in `resolveCards` (filter by root flag; map labels by `cardTemplateId` over the unfiltered content so numbering does not shift). Smallest change; no new UI element. Navigation (`activeCardId` fallback exists: "retained, else first remaining") and the client's progress calculation then exclude it automatically — **which is itself a progress decision** (see Q3b).
2. **Placeholder position** (an explicit "unavailable" Card in order). Needs a new Card variant through `projectWorking`, the client Deck scene, layouts and group presentation. Largest change; not approved.
3. **Whole Deck unavailable while any Card is removed** (what happens by default today if nothing is changed). Zero new logic but contradicts "other Cards remain usable".
- **Recommendation:** option 1, provided product accepts the progress consequence in Q3b. It reuses the existing `activeCardId` fallback and needs no new interface element.
- New adoption from the Library of a Deck containing a removed Card: Library already shows a Deck as unavailable when any Card is inaccessible. Keep that (conservative) behaviour; followers who already hold the Deck keep their access to the rest.

**Restoration complexity:** flag flip + audit event; permissions per §8.3 (organisation's officers, application admin). Restored content returns to the *adopted* versions followers already hold. **Risk:** if the creator published a corrected version while the Card was removed, followers still hold the removed version until they Update; the officer must verify what is being restored (noted as R19).

**Testing:** a Card reused in two Decks removed → disappears from both (Library, direct URL, My Decks, group selection, media authorisation, fork source); sibling Cards still usable and writable; CardData/DeckData byte-identical before/after removal and restoration; creator republish while removed stays hidden; restore by officer of another organisation denied; removal event actor/time recorded; concurrent removal + follower write consistent.

**Forks and copies of a removed Card are independent roots** (`forkedFrom` only) and are *not* covered. An officer must remove them separately (no index on `forkedFrom` today). Recorded as R20; proposed backlog item BL-17 (tooling to find forks/copies of removed content) rather than building it now.

### 3.7 Generic adult-supervision capability (Q4 — planned now, independent of Info Cards)

**Verified base on this branch (to be extended, not replaced):** group member rows carry `isAdmin`, `followerStatus`, `accessEpoch` (`GroupMember`, `src/lib/groupExperiences/model.ts`); every group route is wrapped by `groupRequest` (`http.ts`) and resolves membership through `GroupExperienceRepository.access(actor, experienceId, role)` (`repository.ts`) which applies `authorize()` (`authorization.ts`). Structural changes use one command pattern: `structureRevision` compare-and-set, `fence()` on affected members, operation receipts for idempotent retry (`changeMember`, `replay`, `record`). **Assumption (documented):** the final group project keeps these mechanisms; supervision should be added as new member-command kinds, not as a parallel framework.

**Data (additive, optional fields):**
- `groupExperiences.organisationId: string | null` — stamped at creation from the creator's account; immutable. `null` ⇒ independent group, **no supervision requirement** (§7.4 applies to organisation groups only).
- `groupExperienceMembers.supervision?: { status: "pending" | "accepted" | "declined" | "withdrawn"; invitedByUserId; invitedAt; respondedAt? }` — meaningful only for members with `isAdmin: true` who hold `roles.adultLeader`.
- `users.roles.adultLeaderGrantedAt` — an acceptance counts only if `respondedAt >= adultLeaderGrantedAt`, so revoking and later re-granting the role cannot silently revive an old acceptance.

**Commands (extend `memberCommand`/`changeMember`; each uses the existing CAS + receipt + fence machinery):** `invite-supervisor` (group admin appoints an eligible adult leader of the same organisation as group admin with `supervision.status = "pending"`), `respond-supervision` (only the invited adult, `accept`/`decline`), `withdraw-supervision` (the adult or any group admin). Eligibility check at invite and at accept: same organisation, `active`, `roles.adultLeader`, DOB indicates 18+. A pending adult cannot count toward the requirement.

**Reusable check (derived, never stored):** `groupSupervisionState(repo, experience, session)` in a new `src/lib/groupExperiences/supervision.ts` returns `{ required, satisfied, reasons[] }`:
1. `required = experience.organisationId !== null`.
2. satisfied only if: organisation active; **at least one active safeguarding officer** in the organisation (same derived query as §3.5); and at least **two distinct** members with `isAdmin`, `supervision.status === "accepted"` (after `adultLeaderGrantedAt`), whose user documents are active, same organisation and hold `roles.adultLeader`.
3. Because it is derived at call time, **suspension is automatic and immediate** when an adult is deactivated, loses the role, withdraws, is demoted from group admin, or the last officer is lost (§5.1) — there is no synchronised counter or flag to maintain, and nothing is written, so no data is changed or lost (§7.4 rule 6/8).

**Enforcement point (the integration contract with the group project):** a single `assertSharedContributionAllowed(access)` that calls the check and throws `GROUP_SUPERVISION_REQUIRED`. Every group route/command that creates or edits *shared* content (shared Info Cards, group uploaded media, shared reflections/other contributions) must call it **after** `access()` and inside the same transaction. Writes of a user's *own private learning state* (progress, signals) and group-admin Deck progression are **not** blocked (the spec says Deck progression and follower data are preserved). Read policy during suspension is a product question (Q11). On this branch there are **no shared-contribution routes yet** (only learning, navigation, membership, adoption), so today the function would gate nothing; its call sites become the checklist the group project must satisfy (see §4 Stage 4 integration checks).

**Oversight reads (spec §7.2):** a helper `canOverseeSharedContent(viewer, organisationId)` in `src/lib/organisations/permissions.ts` returns true for an active `adultLeader` or `safeguardingOfficer` of that organisation. The group project's shared-Info audience resolver calls it to grant **read-only** access to shared (non-private) Info Cards. It must **not** be used for Personal Info Cards or private learning data.

### 3.8 Group-experience records and organisation boundary (Feedback C)
- **Ownership:** `groupExperiences.organisationId` (above) is the authoritative scope of the experience; member rows, `groupCardState`, receipts and removal snapshots are children and inherit it (no separate field, always read through the experience).
- **Creation (`GroupExperienceRepository.create`):** `registered(userIds)` (the single choke point for create and member add, `repository.ts` ~line 49) becomes `registeredInScope(userIds, organisationId, session)`: every user must exist, be **active** and have exactly the creator's `organisationId` (`null === null` for independents). The creator's own scope comes from the account, not the request.
- **Deck/Card content scope derives from the experience, not the viewer:** `publicDeck`/`publicCards` (`publicVersions.ts`) currently call `assertDeckVersionAccess(null, …)`/`assertCardVersionAccess(null, …)` (public-only, viewer-independent). They must instead assert `root.organisationId === experience.organisationId` (for creation: the creator's), so an organisation group can only use that organisation's public content and an independent group only unscoped content. `adoption.ts` reads the same helpers.
- **Access:** `access()` additionally requires the actor's account scope to equal `experience.organisationId` and the actor to be active (cheap: user document already needed by `getCurrentUser`). `list()` (`members.find({ userId: actor … })`) and `tiles` are scoped by membership rows; a defensive scope filter is added anyway.
- **Learning reads of other users' data:** `learningReads.ts` / `presentationReads.ts` aggregate over `users` documents for the experience's members only; scope is guaranteed by membership validity; add a test that a forged member id of another organisation is rejected at add time.
- **Deactivation:** deactivated members keep their member rows and data; `getCurrentUser` blocks them. Group admins who are deactivated still count in `adminCount` (final-admin protection) — potential orphan groups: see R21 and BL-19.
- **Moderation:** group-removal of contributions (§8.2) is a group-experience feature; organisation-wide removal reaches groups through the root flag (§3.6) because group reads go through the same root/version helpers.

### 3.9 Minimal member-management interface (Q5 — application admins included)
- One page `app/organisation/page.tsx` (server page pattern of `app/progress/page.tsx`: `getCurrentUser()` → `EmbeddedAuthScreen` or shell), reached through **one conditional `OverviewMenu` item** shown only to `organisationAdmin` or `applicationAdmin`.
- Content: member table (username, active, roles; **never DOB**), create member (username, DOB, roles optional), deactivate/reactivate, reset password (shows the new temporary password once), assign/remove `adultLeader` / `safeguardingOfficer`; `applicationAdmin` additionally appoints/revokes `organisationAdmin`.
- **Application-admin organisation chooser:** a plain `<select>` of organisations (from `GET /api/organisations`, app-admin only) that sets `?organisation=<id>`; every member API takes `organisationId` explicitly for app admins; for an `organisationAdmin` the server **ignores any supplied organisation and uses the account's own** (a mismatch returns 403, never silently overridden). This is not a session-wide context switcher and changes nothing for ordinary users.
- API: `GET/POST /api/organisation/members`, `PATCH /api/organisation/members/[userId]` (actions: `deactivate`, `reactivate`, `reset-password`, `set-role`), all through `cardRequest` so they inherit active/org/password-change checks. Role/permission rules live in `src/lib/organisations/permissions.ts` (§3.4), never in the page.
- Scripts that stay (Q5): organisation create/deactivate/reactivate, batch provisioning (CSV), `grant-application-admin` (Q6: assigns the first applicationAdmin by username; no existing `isAdmin` account is converted automatically).

## 4. Implementation stages (Proposed)

Each stage is independently implementable and verifiable on the current branch unless marked.

### Stage 1a — Organisation and account foundation
- **Objective:** organisations, scoped users, auth enforcement; no content scoping yet.
- **Code areas:** `src/lib/auth.ts`, new `src/lib/organisations/*`, `scripts/seed-user.mjs` (+ new `scripts/create-organisation.ts`), index setup script, `src/app/api/users/route.ts`.
- **Tasks:** collections and indexes; user fields; `getCurrentUser` checks (active user/org, `iat` vs `credentialsChangedAt`); scoped `/api/users` (same organisation only, active only, paginated); `create-organisation` and `deactivate/reactivate-organisation` scripts; seed script gains DOB (required), `organisationId`, roles and temporary-password mode.
- **Tests:** username/email uniqueness incl. case and concurrent inserts; DOB required for new accounts and legacy accounts still log in; deactivated user/org blocked on an already-issued cookie; reactivation restores only individually active users; `/api/users` scope matrix (org A, org B, independent); no DOB/passwordHash in responses.
- **Acceptance:** spec §11.7 items 2, 3, 7 (scripts-level), plus user-search isolation.
- **Deliverables:** migration-free data change, setup script, scripts, tests.

### Stage 1b — Content boundary
- **Objective:** immutable scope on content and server-enforced isolation on every read/write/follow/fork path.
- **Code areas:** all files in §3.2; `cards/repository.ts` insertion sites; Info repository/queries; media authorisation; group `registered()`/manifest validation.
- **Tasks:** stamp `organisationId` at 11 creation sites; replace predicates with scope helpers; scoped Library/Info catalogue/series/media; fork/copy/add-library-deck cross-scope refusal; static guard test.
- **Tests:** a matrix test (org A, org B, independent × {list, search, detail, direct id, follow/add, fork, copy, group deck selection, Info catalogue, series, media authorise}) asserting denial both ways using direct repository calls **and** HTTP route handlers; independent-user regression using existing suites (`creator-visibility`, `card-forks`, `area-library`, `info-cards*`, `card-media-access`).
- **Acceptance:** §11.7 item 1 and 13.
- **Risk:** widest change; keep it a mechanical refactor with the guard test and no behaviour change for independents.

### Stage 2 — Provisioning, roles and minimal admin UI
- **Objective:** §4 and §5 and §9.
- **Code areas:** new `src/lib/organisations/{provisioning,permissions}.ts`, `POST /api/auth/change-password`, `/api/organisation/members/*`, `app/organisation/page.tsx` + one `OverviewMenu` item shown only to `organisationAdmin`, batch script reading CSV.
- **Tasks:** member create (DOB + temp password), deactivate/reactivate, reset password, assign/remove roles with all §5.1 rules, forced first-login change, `credentialsChangedAt`, batch script with per-row result and idempotent reruns.
- **Tests:** role escalation negatives (self-assignment, peer admin deactivation, cross-organisation target, forged organisation id in body); temp password shown once and never persisted in plaintext; forced change blocks every other route; batch partial-failure and rerun behaviour.
- **Acceptance:** §11.7 items 4, 5, 6.

### Stage 3 — Publishing gate and moderation
- **Objective:** §7.3, §8.1, §8.3.
- **Tasks:** officer-count maintenance and `publishGuard`; gate at four org-visible publication sites (server-side); moderation flag and events; access helpers deny removed content (Library, direct routes, My Decks, group selection, media authorisation); restore command; defined behaviour for a removed Card inside a Deck (Q3).
- **Tests:** §11.7 items 8, 10 (officer part), 11, 12; concurrency interleaving last-officer removal vs publish; removed canonical Card reused in two Decks; creator republish cannot undo removal; follower progress and CardData unchanged and restored on reinstatement.

### Stage 4 — Group-experience integration (partly possible now)
- **4a (can start after Stage 1b):** members must be active and same-organisation (`registered()`), Deck/Card scope in manifest validation, Deck/user deactivation interplay with `adminCount`/members. Do not change group UX.
- **4b (blocked):** adult-leader supervision, acceptance, "communication active" state, group-admin removal of shared Info Cards and officer visibility of shared Info Cards **depend on group-shared Info Cards, which do not exist on this branch**. Prerequisites: that feature merged and stable, group-experience checks completed. Needs agreement from the group-experience project on how acceptance and supervision are modelled (Q4).

### Stage 5 — Personal Info Card regression checkpoint
- Personal Info Cards already exist here. Add regression tests only (no new code): owner-only visibility for `kind: "personal"` roots vs every new role; moderation and scope never expose or restore personal attachments (see `infoCards/queries.ts`: personal entries require `ownerUserId === actor`, `visibility === "private"`).

## 5. Edge cases, risks and mitigations

| # | Risk | Severity | Mitigation | When | Test |
| --- | --- | --- | --- | --- | --- |
| R1 | A forgotten access site leaks other-org content (≈75 predicates, 12+ files) | High | Single scope module; static guard test; matrix tests through HTTP and repository | Now (1b) | Guard test fails on stray `visibility === "public"`; matrix suite |
| R2 | Independent users regress | High | Missing field ≡ null; run existing suites before/after; no data migration | Now | Existing creator/library/fork/info suites unchanged |
| R3 | Reused Cards across Decks: scope of a Card ≠ scope of a Deck | Medium | Creation inside one scope only; foreign selections must satisfy same-scope rule; a Deck cannot reference a Card from another scope | Now (1b) | Attempt Deck with foreign-scope Card via API |
| R4 | Deactivated users retain sessions | High | Per-request DB check in `getCurrentUser`; `credentialsChangedAt` vs JWT `iat` | Now (1a) | Old cookie after deactivation, org deactivation, password reset |
| R5 | Role escalation | High | Central permission module; re-read actor/target in transaction; never trust body-supplied org/role | Now (2) | Negative matrix |
| R6 | Last safeguarding officer lost while publishing | Low | Derived officer query in the publish transaction; millisecond ordering window accepted (§3.5); revision-touch upgrade available | Now (3) | Publish blocked with no officer, allowed with one, blocked after deactivation/org deactivation/role removal |
| R7 | Moderated content reachable via another path (direct id, fork source, My Decks, media, Info series) | High | Moderation check in the same helpers; enumerate paths in matrix | Now (3) | Per-path denial tests |
| R8 | A removed Card makes the whole followed Deck fail to load (`resolveCards` throws; `authorizeWorkingCard` too, so uploads/playback in that Deck fail). Writes to other Cards still work (`workingCard` is per-Card) | High | `resolveCards` must tolerate a moderated Card (Q3a recommendation: omit; labels from unfiltered list) | Now (3) | Deck with removed middle Card: load, navigate, write others, restore |
| R19 | Restoring after the creator published a corrected version: followers still hold the removed version; the officer may restore old content | Medium | Moderation view shows adopted-vs-latest versions before restore; note in runbook (no new feature) | Note now | Restore with newer version present |
| R20 | Forks/copies of a removed Card are independent roots and remain visible | Medium | Document; BL-17 tooling to find forks (`forkedFrom`) | Defer (BL-17) | — |
| R9 | Missing DOB in legacy accounts | Low | Org accounts are new so always have DOB; legacy accounts are independent; adult-role assignment requires DOB | Now | Assign role to no-DOB user is rejected |
| R10 | Temporary password disclosure | Medium | Printed once, `0600` file, never logged; forced change; bcrypt | Now | Assert no plaintext in DB/log output |
| R11 | Brute-forcing of temporary passwords (no login throttling today) | Medium | Q7 | Decide | — |
| R12 | Batch provisioning partial failure | Medium | Per-row transaction, idempotent on (organisationId, username), report file of results | Now (2) | Rerun after injected failure |
| R13 | Unique username index fails on duplicate legacy data | Medium | Pre-check script lists duplicates; resolve manually before index | Before 1a deploy | Dry-run script |
| R14 | Direct media URLs bypass scoping | Known | Record limitation (BL-12); tests must not claim URL protection (§11.7 item 14) | Now (note) | Explicit non-claim in test names |
| R15 | Group changes on this branch still unstable | Medium | Stage 4a only touches `registered()` and manifest validation; rest waits | — | — |
| R16 | Org deactivation vs group experiences with mixed membership | Low | Groups are intra-organisation by construction (Stage 4a) | Now | Cross-org member add rejected |
| R17 | `/api/users` returns every username today (existing leak) | High | Fix in 1a | Now | Scope matrix |
| R18 | DOB exposure through server code that loads whole user documents (`getPersonalUser`) | Medium | Keep DTOs explicit; add test that serialised routes contain no `dateOfBirth`/`passwordHash`; consider projection exclusion | Now | Serialisation test |

## 6. Testing strategy
- **Existing infrastructure (Verified):** Node test runner (`npm run test:unit`, `test:integration`) with `mongodb-memory-server` replica sets and helper fixtures in `tests/helpers/`; Playwright via `scripts/test-phase2.ts` for browser suites. Tests insert user documents directly (see `tests/phase2/*.browser.ts`), so new fields must be optional with sensible defaults or fixtures break.
- **New suites:** `organisation-isolation.integration.ts` (matrix), `organisation-auth.integration.ts` (session/deactivation/password), `organisation-roles.integration.ts`, `organisation-safeguarding.integration.ts` (gate, moderation, concurrency), `organisation-scope-guard.test.ts` (static guard), plus provisioning script tests. Do not run against production Atlas.
- **Manual only for:** the single admin screen layout and the forced-password-change screen on a phone.

## 7. Backlog references
Respected as written: BL-01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14. Minimal prerequisites that must be done now: scope field on roots (supports BL-13 without precluding it); per-user `organisationId` as a single value (does not block BL-01); DOB captured (BL-06/09 later); moderation events table is the minimum audit (BL-11 later).
**Proposed backlog additions:** (a) login throttling/lockout and temporary-password expiry (if Q7 defers it); (b) a public sign-up flow with DOB (if Q1 = scripts only); (c) cleanup/consolidation of the legacy `isAdmin` flag.

## 8. QUESTIONS

### Q1 — There is no account sign-up flow to add date of birth to
- **Finding (Verified):** only `scripts/seed-user.mjs` creates users.
- **Matters:** spec §3.3/§4.2/§11.7(3) assume independent users sign up and DOB is collected there.
- **Options:** (a) DOB required in the seed script and the new admin/provisioning tooling only; (b) also build a sign-up page (new scope).
- **Recommendation:** (a). A sign-up flow is new product scope and not required for organisations.
- **Affects:** Stage 1/2.

### Q2 — Does the safeguarding-officer gate apply to private publication?
- **Finding (Verified):** `publishCard` and the Deck/Info equivalents create *private* immutable versions that users need before they can use their own Cards/Decks.
- **Matters:** if the gate (§7.3 "before any member may publish") covered private publication, a new organisation without an officer could not use its own content, contradicting "drafting/use before an officer exists".
- **Options:** (a) gate only organisation-visible (`public`) publication; (b) gate all publication.
- **Recommendation:** (a).
- **Affects:** Stage 3 (small); acceptance §11.7 item 8 wording.

### Q3 — Card removal: remaining product choices (technical approach now recommended in §3.6: central flag, Approach B)
Architecture is settled in §3.6 pending your agreement; these product choices remain.
- **Q3a — How should a removed Card appear inside a Deck that followers already hold?** Evidence: today an inaccessible Card makes the whole Deck read fail (`resolveCards`), while writes to other Cards still work (`workingCard`). Options: (1) omit the Card (recommended; no new interface element, reuses the existing `activeCardId` fallback; labels must be computed on the unfiltered list so "Week 4" stays "Week 4"); (2) an explicit placeholder position (new Card variant through the client Deck scene — more work, not approved); (3) whole Deck unavailable (contradicts your requirement). Effect: option 1 is small; option 2 adds a UI element and group/progress changes.
- **Q3b — Do removed Cards still count in Deck/progress calculations while removed?** The client computes Deck completion by flattening the Steps of the Cards it is given, so omission (1) excludes them by default, while framework summaries mark the mapped Item "incomplete" when a contributing Card is inaccessible. These two behave differently today and I have not chosen one. Options: exclude while removed (progress may jump up/down on removal and restoration), keep counting the preserved state (needs the Card's data passed through even though the Card is hidden), or mark affected progress as "incomplete". Recommendation: exclude while removed in both places, because the Card is not usable and restoration reverses it exactly. Needs your decision because it changes visible progress.
- **Q3c — My Decks tile for a removed *Deck*.** Spec §8.3 says hidden from My Decks; existing code deliberately keeps memberships visible as an "Unavailable Deck" tile (`membershipDTO`). Options: keep the existing unavailable tile (zero work), or hide it (membership filter). Recommendation: keep the existing tile unless hiding is a safeguarding requirement, since it also tells followers why the Deck vanished.
- **Q3d — May the creator still see/edit/publish removed content?** Recommendation: yes (hidden from all others), so a corrected version can be prepared and then restored by an officer. Needs agreement because it affects the "bypass" wording.
- **Q3e — Where does an officer trigger removal and restoration?** The spec defines the permissions but no interface. Options: (1) a script taking a template ID (cheapest, no UX); (2) a minimal officer-only action on a published Library item (new UX); (3) the member-management screen gains a "content by ID" form. Recommendation: (1) for the first pilot, with (2) as a backlog item (BL-18) once the group UX project can design it. Affects Stage 3 scope and "do not invent UX".
- **Affects:** Stage 3 scope, risks R8, R19, R20.

### Q4 — Group-experience integration: who models supervision and may Stage 4 touch the group model?
- **Finding (Verified):** this branch has the group foundation but no adult-leader/acceptance concept, no "communication active" state and no group-shared Info Cards.
- **Matters:** spec §7.4 says to specify and integrate, not change that project's scope prematurely.
- **Options:** (a) Stage 4a now (same-organisation members and Deck scope only), 4b after group-shared Info Cards exist; (b) pause all Stage 4 until the group project is complete.
- **Recommendation:** (a), with the group project owning the supervision/acceptance data model.
- **Affects:** Stage 4; sequencing.

### Q5 — Application-admin tooling: scripts only, or also an in-app screen?
- **Finding:** no admin UI or application-admin role exists; spec §9.2 says "administrative tools" and creation is a script initially.
- **Options:** (a) application admin acts through scripts only in this pass (create/deactivate organisations, appoint organisation admins, cross-organisation member management); in-app UI is the organisation-admin screen only; (b) also an organisation-selector admin screen (resembles the context switcher the spec excludes).
- **Recommendation:** (a): smallest scope, no new cross-organisation UI surface.
- **Affects:** Stage 2 scope (significant reduction).

### Q6 — Application admin identity: new role flag or reuse `isAdmin`?
- **Finding (Verified):** `isAdmin` currently only enables creator output preview. I cannot see from the repository which production accounts have it.
- **Recommendation (engineering decision, flagged for awareness):** introduce `roles.applicationAdmin` and leave `isAdmin` unchanged, so no existing account silently gains cross-organisation power. Please confirm, and confirm who should be the first application admin(s).
- **Affects:** Stage 1a/2.

### Q7 — Minimal login protection for temporary passwords
- **Finding (Verified):** there is no login throttling or lockout; temporary passwords for children's accounts will exist until first sign-in. Spec defers security assessment (BL-14).
- **Options:** (a) high-entropy temporary passwords only (no throttling) and add a backlog item; (b) also a simple per-account failed-attempt counter/lockout in this pass.
- **Recommendation:** (a) now, with the backlog item flagged as required before real minors use the app.
- **Affects:** Stage 2 (small if (b)).

### Q8 — Case-insensitive global usernames and existing duplicates
- **Finding:** no unique indexes exist today; login uses exact-case username match.
- **Proposal:** enforce uniqueness case-insensitively (collation) to prevent look-alike accounts; needs a one-off duplicates check of production data before the index is created (cannot be done from the repo).
- **Affects:** Stage 1a deployment step.

## Appendix A — Access-check inventory (Verified by grep; line numbers as of HEAD `39aa33a`, will drift)

Patterns searched under `src/` (excluding `src/components`): the two assert functions, any `visibility` comparison/filter set to `"public"`, and `ownerUserId` comparison. Not a proof of completeness (it cannot find a check written in another form, e.g. through a helper), which is why the guard test in Stage 1 is required.

**Category R — foreign-read gate ("owner or public"). Must become scope-aware (viewer organisation).**

| File | Lines (assert calls / inline predicates) | Purpose |
| --- | --- | --- |
| `lib/cards/versionAccess.ts` | 7, 11 | The two central asserts (change signature to take `ViewerScope`). |
| `lib/cards/repository.ts` | asserts: 113 120 131 199 307 377 387 467 679 764 838 890 903 983 987 1005 1043 1067 1166 1174; inline: 90 92 137 268 374 384 464 878 980 1003 1040 1054 1163 1169 | Update review/adopt, copy, fork sources, foreign selections, publication prerequisites, entry, restore, open, working mutations. The 16 inline `ownerUserId === actor \|\| visibility === "public"` copies should collapse into one `canReadRoot(viewer, root)` helper. |
| `lib/cards/resolvers.ts` | asserts: 50 63 76 84 104; inline: 25 38 61 73 82 96 | `resolveWorkingDeck/DeckPreview/HistoricalDeck/resolveCards`. |
| `lib/cards/readModels.ts` | asserts: 114 125; inline: 111 119 | Working DTO and membership DTO. |
| `lib/cards/creatorSession.ts` | 49 66 | Creator session reads. |
| `lib/cards/cardReuse.ts` | 24, 27 | Card reuse eligibility. |
| `lib/cards/prospectiveUpload.ts` | 23 29 | Upload proofs for prospective Cards. |
| `lib/cards/protectedMedia.ts` | asserts: 62; inline: 33 38 63 | **Media authorisation scans public roots/versions** (see §2.G). |
| `lib/cards/libraryMedia.ts` | 15 16 21 22 | `authorizeLibraryVideo`. |
| `lib/frameworks/{calculations,eligibility,readModels}.ts` | 38 / 39 / 94 | Progress calculations re-assert access. |
| `lib/groupExperiences/publicVersions.ts` | asserts: 14 27; inline: 54 58 | Group Deck/Card version selection. |
| `lib/groupExperiences/adoption.ts` | 42 74 78 | Group adoption reads public versions. |
| `lib/infoCards/queries.ts` | 28 75 118 121 184 207 209 | Info consultation, catalogue and series discovery (Mongo `visibility: "public"`). |
| `lib/infoCards/repository.ts` | 88 96 101 117 122 175 177 194 249 302 324 325 336 | Series eligibility, owner(), publish, delete. |
| `lib/infoCards/media.ts` | 90 101 104 109 110 | Media proof/ready checks. |
| `lib/cards/libraryReadModels.ts` | 62 71 72 84 111 139 148 159 162 180 181 (+ asserts 197 243) | **Library list/search/detail/viewer-status: Mongo `$match: { visibility: "public" }`** — these need `scopeFilter(viewer)` added, not just an assert. |
| `lib/cards/libraryProjection.ts` | 62 86 | Presentation guard (`version.visibility === "public"`); no viewer — scope enforced upstream. |
| `lib/deckTemplateQueries.ts`, `lib/deckTemplateDocuments.ts` | 29, 85 | **Legacy** `deckTemplates` document model, used by `sharedDecks.ts` (route returns 410) and `userCardUploadAuthorization.ts`. Confirm dead, then ignore or fence. |

**Category W — creation/ownership stamping (add `organisationId` at insert):** `cards/repository.ts` 424, 487, 505, 533, 538, 553, 589, 615 (roots); `infoCards/repository.ts` 98, 125, 161.

**Category O — owner-only edit checks (`ownerUserId === actor` on own drafts/publish):** `repository.ts` 248 254 269 300 303 310 335 400 413 419 437 485 497 524 527 536 551 568 577 587 677 692 782 802 860; `creatorDrafts.ts` 18 34; `app/api/deck-templates/[deckTemplateId]/publish/route.ts` 12 27. **No scoping change needed** (a user can only edit what they own, and ownership implies the same scope); listed so they are not mistaken for gaps.

**Category P — publication-visibility transitions (where the officer gate attaches):** `repository.ts` 32 (permanence), 407 420 493 506 546 610 (intent), 765 (public Deck needs public Cards), `publishCard` (~683), `publishDeckInSession`, `promoteCard`; `infoCards/repository.ts` `publishVersion`/`save` (intent `public`). See §3.5.

**Existing duplication note:** the pattern `ownerUserId === actor || visibility === "public"` already appears ~16 times inline in `repository.ts` instead of calling `assertCardVersionAccess`. Replacing these with one helper is a prerequisite refactor for the scope rule and reduces future drift.

## 9. What should happen next
1. Review the QUESTIONS (especially Q2, Q3, Q4, Q5).
2. Complete the not-yet-investigated list in §0 (call-site checklist for the scope refactor is the main sizing input).
3. Then convert Stage 1a into an implementation commission; Stages 1b onward follow once the site list is complete.
