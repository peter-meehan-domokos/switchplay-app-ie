# Organisation Foundations — Draft Product Specification

**Product:** Switchplay / Strat17  
**Focus:** Basketball-club organisations  
**Status:** Draft for design review — not an implementation instruction  
**Date:** 30 October 2026  
**Scope:** An intentionally limited first implementation, with explicit integration dependencies and a referenced backlog

---

## 1. Purpose and boundaries

Introduce `Organisation` as a first-class entity so a basketball club can have its own users, Library, Decks, Cards, Info Cards, follower data and group experiences, separated from other organisations and independent users.

The goal of this pass is **a functional organisational foundation with enforceable server-side access boundaries**, not a completed GDPR-compliance or child-safeguarding programme. The initial implementation must nevertheless avoid obvious cross-organisation disclosure and unsupervised in-app communication. More advanced privacy, compliance and security work is separately tracked in the backlog.

### 1.1 Required outcomes

1. Users are either independent or belong to exactly one organisation, fixed at account creation.
2. Organisation members cannot discover or access users or content belonging to another organisation or to independent users, and vice versa.
3. An organisation has distinct membership-administration, adult-leadership and safeguarding roles.
4. New organisations and their members can be provisioned using scripts; approved administrators can manage members in a minimal in-app interface.
5. Organisation publishing and group communication are subject to the agreed safeguarding gates.
6. Content moderation and account/organisation deactivation preserve underlying data.
7. Features already being built on other branches are integrated **after** those features become available; this project must not pre-build their implementations.

### 1.2 Explicit non-goals

- Separate databases or collections per organisation.
- Multi-organisation account switching or moving existing accounts between organisations.
- Full GDPR compliance, formal age verification, complex child-specific permissions or a comprehensive moderation platform.
- A new authentication service, an email/invitation system or self-service organisation creation.
- Building Card comments or private messaging.
- Rebuilding media storage/security in this pass.
- Building organisational teams/subgroups. *A group experience* (multiple users following the same Deck) is a separate, existing feature concept and is **not** an organisational subgroup.
- Developing the content-import workflow; content seeding is handled in a separate JSON-content-script project.

The exclusions correspond to backlog items in **§12**, referenced throughout the specification.

## 2. Terms and principles

| Term | Meaning |
|---|---|
| **Organisation** | A club, such as Galway Basketball Club, defining a data-access boundary. |
| **Independent user** | A user with no organisation membership; participates only in the independent/public part of the app. |
| **Organisation member** | A user assigned to one organisation when the account is created. |
| **Organisation Library** | The published Decks and Info Cards discoverable by members of that organisation. |
| **Group experience** | A shared experience where a set of followers works through the same Deck, potentially with shared Info Cards and media. Not an organisation/team hierarchy. |
| **Personal Info Card** | The private, owner-only note feature being developed on another branch; **not available in the initial target branch**. |
| **Published/shared content** | Content made visible to others, either through the organisation Library or within a group experience, as distinct from otherwise-private user material. |

**Invariant 1 — Tenant boundary.** Organisation membership determines access, not just what the UI displays. Every relevant server-side read, write, list, search, mutation and link-resolution route must enforce the boundary.

**Invariant 2 — Privacy is separate from administration.** Organisation or application administration does not automatically grant permission to view private user content.

**Invariant 3 — No unsupervised one-to-one communication in organisations.** Card comments are deferred; any shared Info Card used for communication must have the agreed adult/safeguarding visibility.

**Invariant 4 — Deactivation and moderation are non-destructive.** Accounts, organisations and moderated content can be made inaccessible, but no underlying user or content records are deleted by these actions.

**Invariant 5 — Publishing is organisation-local.** “Public” means public **inside the organisation** for organisation users. Independent users continue to have their own public content area.

## 3. Organisation and account model

### 3.1 Organisation entity

An `Organisation` represents the club. The minimum conceptual fields are:

- Stable identifier (`organisationId`).
- Name/display identity.
- Active/inactive status.
- Basic creation/update metadata.

Only application administrators can create, deactivate or reactivate organisations. Initially creation can be performed with an npm script; there is no organisation-creation UI. An organisation starts with **an empty Library**. Separately developed JSON content-seeding scripts can populate it later; this project does not add import/copy tooling.

Deactivating an organisation immediately blocks **all its members** from access, including previously established sessions. It must not affect other organisations or independent users and must not delete any data. Reactivation restores access only for members whose *individual accounts* are also active.

A new organisation may exist and have provisioned members before a safeguarding officer is assigned. Publishing and group activity gates are defined in §7.

### 3.2 User identity and membership

- Each `User` has an optional `organisationId`: either **one** organisation or `null` for an independent user.
- Membership is fixed **when the user account is created**. No joining an organisation later using that account, transfers, or account merges in this pass.
- A person who needs a club account in addition to an independent account needs a **separate account** for now.
- Usernames are globally unique, across independent users and all organisations.
- No ordinary organisation context switcher is required.
- Account deactivation blocks sign-in and active access without removing the account or its data.

The first data model should be simple. A separate membership collection is not required solely for hypothetical future multi-membership; however, the architecture must not gratuitously make such expansion impossible. See **BL-01** (multiple memberships) and **BL-02** (account migration/merging).

### 3.3 Existing users and date of birth

Every **new** account, whether independent or organisational, must have:

- `dateOfBirth` — stored as a date, not shown in the normal application interface.
- `ageVerified` — a Boolean, **initially `false` for every account**, including newly created organisation accounts.

Age is calculated from the date of birth when needed; a mutable numeric age is not stored. Dates of birth are personal information: minimise exposure in API responses, logs, ordinary interfaces and analytics exports.

Existing accounts may temporarily have no `dateOfBirth`. The product owner will backfill these manually because most are mock accounts. **Do not** create a forced date-of-birth collection step for their next login.

The club/organisation administrator is responsible for confirming members' ages outside the app, typically using a supplied member spreadsheet. This responsibility **does not** automatically set `ageVerified: true`: no formal in-product age-verification workflow is implemented yet. Assigning `adultLeader` (or safeguarding-officer duties) requires a known date of birth indicating adulthood **and** explicit approval by an authorised administrator. The `ageVerified` flag may remain false while the initial offline club-confirmation process is in use; it must not be misrepresented as a completed formal verification.

Formal age-verification workflows, especially for independent users, are **BL-09**. Age-based content restrictions are **BL-06**. Wider safeguards for independent minors are **BL-10**.

## 4. Account provisioning and authentication

### 4.1 Reuse the existing system

Users currently sign in using **username and password**. An existing npm script creates users. The implementation must inspect and extend the current account/authentication model rather than assume a particular library, password-hashing implementation or token/session strategy.

### 4.2 Three supported organisational provisioning paths

1. **Batch script.** Application administrator creates an organisation and/or batches members using a spreadsheet (or a supported converted input format). Organisation creation and member creation may be separate script steps.
2. **Organisation administrator.** Creates member accounts **only inside their own organisation**, via the minimal admin interface.
3. **Application administrator.** Creates member accounts for any organisation using administrative tooling.

An independent user continues to sign up through the existing process, now with the required date of birth.

No self-service organisation joining, invitation code, invitation email or organisation discovery. No self-service organisation creation. See **BL-03**.

### 4.3 Credentials

- New organisation accounts receive a **system-generated temporary password**.
- It is shown or exported **once** to the authorised provisioning administrator for secure delivery to the member; never stored as retrievable plaintext in the database.
- On the first sign-in, the member **must change** the temporary password before proceeding.
- Authorised administrators can reset passwords but cannot see existing passwords. Scope resets to the organisation they are allowed to administer; elevated-account resets must respect administrator boundaries.
- Apply the same temporary-password rules to batch-created accounts.
- Independent users retain the existing password-authentication path other than date-of-birth collection.

## 5. Roles and permissions

Roles are **additive**, not mutually exclusive, but privileges do not imply broader access to otherwise-private data.

| Role | Scope and principal rights |
|---|---|
| **Ordinary member** | Create and use content; discover other members within the same organisation; may create/administer a group experience. |
| **Group admin** | Manage a particular group experience, including removing any member's group-contributed content from that experience. A group admin may be under 18. |
| **`adultLeader`** | Explicitly appointed, approved adult; can serve as a supervising group admin and inspect shared Info Cards under the safeguarding rules. Does **not** automatically administer the organisation. |
| **`safeguardingOfficer`** | Explicitly appointed organisation role; oversight and organisation-wide moderation of **shared/published** content. No unrestricted access to private user data. Multiple officers are allowed. |
| **`organisationAdmin`** | Manage members of their own organisation, including creation, deactivation/reactivation, credential resets and assigning/removing `adultLeader` and `safeguardingOfficer`. |
| **Application admin** | Create/deactivate/reactivate organisations; manage members across organisations; exclusively appoint/revoke `organisationAdmin`; perform authorised moderation restoration. Does not automatically browse private organisational data in the app. |

### 5.1 Role assignment constraints

- Only application administrators can appoint or revoke `organisationAdmin`.
- Organisation admins may assign or remove adult-leader and safeguarding-officer roles within their own organisation, but **may not assign these roles to themselves**. Application admins may assign them.
- Being over 18 does not itself confer `adultLeader`; appointment requires explicit club approval and a date of birth consistent with adulthood.
- There can be multiple organisation admins, adult leaders and safeguarding officers.
- Organisation admins can deactivate ordinary members, including adult leaders and safeguarding officers, but **not another organisation admin**. Only an application admin can deactivate an organisation admin.
- Deactivation of adult leaders/officers must immediately update safeguarding eligibility; it must not leave a group incorrectly treated as supervised.
- Losing the last active safeguarding officer triggers the restrictions in §7.3.

### 5.2 Visibility of users

Every member may search for and discover **all other members of their organisation**, including coaches and players. Directory/search results must not show users outside the organisation. Discoverability alone never grants access to another member's private content or progress.

Future visibility restrictions for teams, ages or specific member groups are **BL-04** and **BL-06**.

### 5.3 Administrative access versus analytics

Application-admin permission within the **app** does not confer unrestricted private-content browsing. Authorised database-level analytics is a **separate operational access path**, governed by appropriate access control and data handling; the organisation UI permission system must not be mistaken for the complete analytics security model. This project does not build an analytics product.

## 6. Organisation data isolation and content visibility

### 6.1 Shared infrastructure, enforced scoping

Use the existing MongoDB deployment and current collections. No separate database/collection per organisation in this pass.

The engineering design may associate a record with an organisation explicitly or derive its scope from an authoritative owner/parent relationship, **provided it is unambiguous and enforced on every access path**. Merely filtering a page's results in React is insufficient. Missing, guessed or manipulated IDs must never bypass the boundary.

Scoping must cover, as applicable:

- User listings, user searches and membership selection.
- Library lists, search and individual Deck/Card/Info Card retrieval.
- CardTemplate and DeckTemplate references, versioned content, reused Cards and forks.
- CardData/DeckData, follower lists, progress, signals, reflections and associated media metadata.
- Group experiences, memberships, shared attachments and administration routes.
- Create, edit, publish, follow, fork, import/copy-by-reference and administrative mutations.
- Direct links and API calls, not merely visible navigation.

Organisation-specific content must never refer to or grant access to records owned by another organisation or independent users. A fork must be valid **within the user's own scope**; it must not create a cross-scope data leak. Preserve existing first-class Card and Deck reuse semantics inside a single organisation.

Further assessment of stronger tenant-data controls or optional physical separation is **BL-13**, not a precondition for this pass.

### 6.2 Libraries and publication

- An organisation's **published** Decks and Info Cards are visible to **all** active members of that organisation, including adult leaders and safeguarding officers.
- Any organisation member may create Decks, Cards and Info Cards, including drafts, and publish subject to §7.3.
- An organisation's “public” content is **never globally public** in the initial implementation.
- Organisation members **cannot** browse or follow public content from independent users or other organisations; external users cannot discover organisation content.
- Independent users continue with the existing independent public Library and its existing publishing behaviour.
- Drafts and otherwise-private user content retain their privacy; publication does not happen automatically merely because the user belongs to an organisation.
- Standalone Cards not attached to a Deck do not currently appear in the public Library. A future Library **Cards** tab is **BL-07**.

Globally publishing organisation content, browsing external public content or transferring/importing content across boundaries is **BL-05**. In this pass a new organisation starts empty; the separate JSON content-script project can create new content directly in that organisation.

### 6.3 Deactivated creators and reused content

- Deactivating a member **does not** hide their already-published Decks/Cards/Info Cards or interrupt existing followers' normal access and progress.
- Original ownership does not transfer. Nobody else gains edit permissions on the original.
- Members can use the **existing fork capability** to create their own maintainable version, where content is otherwise accessible.
- A reused `CardTemplate` remains one canonical Card used across Decks; a moderation action on that Card has the effects in §8.3.

## 7. Safeguarding and communications

### 7.1 Core communication rule

Organisation members must not be able to conduct unsupervised, private, one-to-one communication through the app.

**No CardData comments** are implemented for now, whether within or outside group experiences. Do not add direct messaging or a replacement hidden communication channel in this pass. Any future comment/conversation mechanism must be designed with supervision; see **BL-08**.

### 7.2 Shared versus private Info Cards

- Normal published Info Cards behave like published Decks: visible in the organisation Library to all members.
- Info Cards shared as part of a group experience are visible to **all group admins**, including the required supervising adult leaders.
- Shared Info Cards, including group-shared ones, are additionally visible for safeguarding oversight to the organisation's **adult leaders and safeguarding officers**. This is **read access to shared communication**, not permission to inspect the associated person's private CardData, confidence, reflections or notes.
- Personal Info Cards are **not** part of the initial implementation. Once the separate branch is merged, they remain permanently **owner-private** and are excluded from the above supervisory viewing permissions; see mandatory integration stage **§11.5**.
- Published and group-shared content can be moderated under §8. Private notes and other otherwise-private personal data do not become subject to general browsing/moderation solely because of safeguarding roles.

### 7.3 Safeguarding officer gate

An organisation may be created, populated with users and used for drafting before a safeguarding officer exists. However:

- At least **one active `safeguardingOfficer`** must be appointed before any member may **publish** a Deck, Card or Info Card, or activate supervised group activity.
- Multiple officers are allowed and have equivalent safeguarding rights.
- If the last active officer is removed/deactivated, **new publishing is blocked** and **group shared communication is suspended**.
- Already published content remains visible unless it has been moderated; drafts and existing data remain preserved. This event does not imply permanent deletion or automatic unpublishing.
- Enforce these conditions server-side, not just by disabling buttons.

### 7.4 Group experience supervision

Group experiences are being implemented through a **separate project/branch**. The organisation project must specify and later integrate these rules rather than silently change that project's scope prematurely:

1. Any member, including an under-18 member, may create and be a **group admin**.
2. Every organisation group experience requires at least **two distinct, active, approved `adultLeader` users as group admins**.
3. Each supervising adult must **explicitly accept** the appointment; simply adding an adult to a list does not activate supervision.
4. A group cannot become active for shared communication until those two accepted adults and an active organisation safeguarding officer are in place.
5. All group admins can see the group's shared Info Cards; the two adult leaders therefore have direct visibility. Additional organisation adult-leader/safeguarding-officer oversight is governed by §7.2.
6. If supervision falls below two accepted active adult leaders, **group communication is suspended** until restored. Existing group content, Deck progression and follower data are preserved.
7. Group admin permissions to remove group contributions are described in §8.2.

The minimum requirement applies to **organisation group experiences**, not to independent users' existing group experiences. The broader independent-user safeguarding review is **BL-10**. Organisational subgroups/teams are separate and deferred (**BL-04**).

## 8. Moderation and non-destructive removal

### 8.1 General policy

No moderation or deactivation action defined here permanently deletes the underlying data. Distinguish:

- **Remove from one group experience:** detach/disable that content's association only in the group.
- **Organisation-wide safeguarding removal:** mark the content unavailable everywhere it is exposed within the organisation.

These are distinct permissions and actions. Implement with soft-removal/status or equivalent non-destructive references; preserve ownership and user data. Basic audit records for **organisation-wide safeguarding removal and restoration** must identify the actor and timestamp. A full case-management/moderation platform is **BL-11**.

### 8.2 Group admin removal

Any group admin, including a minor, may remove **any follower's group-contributed content** from that group experience, including shared Info Cards, images and videos. Removal must not automatically unpublish an Info Card from the organisation Library or remove a reusable original from other Decks/groups. Where group uploads are only attached to that group, prevent their exposure in that group without physically deleting the media record.

### 8.3 Safeguarding officer removal

A safeguarding officer may remove **any published or shared content** within their own organisation, including Decks, Cards, Info Cards and shared group media. “Any content” here concerns material visible/shared with others; it **does not** grant the officer access to private Decks, reflections, confidence signals, otherwise-private media or future Personal Info Cards.

An organisation-wide removal must:

- Hide the affected content from the Library, group experiences, direct app routes and relevant APIs, and from existing followers' accessible content (including My Decks for a removed Deck).
- Preserve the original templates, versions, relationships, follower progress and CardData/DeckData.
- Apply to **every usage of the same canonical `CardTemplate`**, even when reused by multiple Decks; unaffected Cards in those Decks remain accessible.
- Be reversible without reconstructing follower progress or references.
- Not be overridden by the creator editing or republishing the removed original.

Only an organisation safeguarding officer or an application admin can restore an organisation-wide moderation removal. Restoring it must respect normal organisation, publication and ownership permissions. Application-admin restoration is a **specific administrative capability**, not a grant of unrestricted private-data browsing.

### 8.4 Media caveat

App/API access restrictions do **not** necessarily revoke access to an image or video via an already-known direct public media URL. Enhanced storage, token and URL protections are already covered by **existing media-security backlog work (BL-12)**. Do not duplicate or redesign that work here. This is a **known privacy limitation** and must be addressed before identifiable children's media is used in a live club trial.

## 9. Minimal administration interface

Create a simple, organisation-scoped **member-management screen** for authorised administrators. Reuse the application's existing UI patterns; do not build a general multi-tenant management suite.

### 9.1 Organisation administrator

- View the member list, basic account status and assigned roles for **their own** organisation.
- Create member accounts with date of birth and a system-generated temporary password.
- Deactivate and reactivate eligible members without deleting data.
- Reset eligible member passwords without reading their current passwords.
- Assign or remove `adultLeader` and `safeguardingOfficer` for other eligible members.
- Cannot appoint organisation admins, assign safeguarding roles to themselves, deactivate other organisation admins, see other organisations or inspect private user content.

An admin enters date of birth at account creation, but routine membership lists do not display members' full dates of birth.

### 9.2 Application administrator

- Perform equivalent member-management actions across organisations through **administrative tools**; this is **not** an ordinary-user organisation switcher.
- Exclusively create/deactivate/reactivate organisations (initially via script) and appoint/revoke organisation admins.
- Assign safeguarding roles and perform permitted restoration actions.
- No default application UI route to browse all private organisation content.

The engineering plan should inspect current navigation/admin infrastructure and select the least invasive placement. Specific screen layouts and new navigation constructs are **not** being pre-authorised in this product draft.

## 10. Data protection and delivery limits

### 10.1 Minimum requirements for this pass

- Server-enforced organisation access checks on all relevant endpoints and actions.
- Password credentials handled through the existing protected authentication system; generated temporary passwords not retrievable later.
- Immediate enforcement of account and organisation deactivation on existing sessions.
- Date of birth excluded from ordinary UI and unnecessarily broad read APIs.
- Personal content remains private, irrespective of member, adult-leader, safeguarding or admin role.
- Non-destructive deactivation and moderation, with basic moderation actor/time records.
- Safeguarding publication and communication gates enforced on the server.
- Existing analytics access treated as a separate, authorised backend concern rather than broad in-app browse permission.

### 10.2 Deferred compliance and risk work

This initial implementation **must not be described as fully GDPR-compliant or fully child-safe merely because organisations are isolated**. Legal basis, notices, children/guardian processes where applicable, retention, erasure requests, access requests, security assessment, breach response and similar operational responsibilities need their own assessment/workstream (**BL-14**). Additional media protections (**BL-12**) and independent-user safeguards (**BL-10**) remain particularly important before real-world use with minors.

The decision to preserve data on deactivation/moderation is an **application behaviour**, not a claim that data can lawfully be retained forever. Future deletion/retention handling must reconcile those requirements (**BL-14**).

## 11. Delivery stages and dependencies

These stages are a suggested **specification sequencing**, not an instruction for a coding agent to implement without first inspecting the target branch.

### 11.1 Stage 0 — Repository and branch audit

Inspect current User/authentication, existing account script, templates/data ownership, Library queries, media access, admin infrastructure and group-experience integration points. Identify every public/read/write route requiring scoping, including direct-ID queries and background jobs. Confirm the target branch does **not** yet include Personal Info Cards.

### 11.2 Stage 1 — Organisation foundation and boundaries

Introduce organisations and membership at account creation; implement immutable one-organisation scoping across queries and mutations; preserve the independent experience. Add global username uniqueness, DOB/default age flags for new accounts and manual-compatible legacy records. Add creation/deactivation scripts and enforce deactivation at auth/session boundaries.

### 11.3 Stage 2 — Accounts, roles and minimal admin UI

Extend batch provisioning and build limited member management: creation, temporary password, forced first-login change, resets, deactivation/reactivation and authorised role assignment. Enforce all role restrictions server-side.

### 11.4 Stage 3 — Publishing gates and moderation

Enforce active-safeguarding-officer gating of organisation publishing and the agreed shared-content access policy. Add organisation-wide soft moderation and restoration with canonical Card reuse behaviour; preserve group-specific versus global-removal semantics.

### 11.5 Stage 4 — Group-experience integration (dependent on its branch)

When the separate group-experience implementation is present in the integration branch, connect it to organisation scoping, accepted adult-leader supervision, safeguarding-officer gates, shared Info Card visibility and group-admin removal. Do **not** invent or implement new group-experience UI before coordinating with that project's approved design.

### 11.6 Stage 5 — Personal Info Cards integration **after their separate branch merges**

This is an **explicit final integration stage**, not pre-emptive scaffolding:

- Preserve the other branch's Personal Info Card ownership/privacy rules.
- Ensure adult leaders, safeguarding officers, organisation admins and application admins gain **no** access to those private notes by virtue of their roles.
- Ensure organisation scoping and group moderation do not inadvertently expose, alter or restore removed personal attachments.
- Add regression tests at that point. **Do not build Personal Info Card-aware code before the feature is available on the target branch.**

### 11.7 Verification / acceptance scenarios

At minimum, engineering tests should demonstrate:

1. Organisation A, organisation B and independent users cannot list, search, fetch, follow, fork, reference or mutate each other's users/content via UI **or direct API calls**.
2. Global username collision is rejected, regardless of organisation.
3. New users require DOB; legacy users without DOB can continue until manually updated; `ageVerified` remains false until a future workflow sets it.
4. A new organisational account receives a temporary password and cannot proceed without changing it; admins cannot retrieve an existing password.
5. Organisation admins cannot assign themselves safeguarding roles, grant organisation-admin status, manage another organisation or deactivate peer organisation admins.
6. Deactivated user content remains published and forkable, but the owner cannot sign in; no original edit ownership transfers.
7. Organisation deactivation prevents new and already-authenticated member access while preserving all data.
8. Without an active safeguarding officer, drafts work but new publishing and group communication do not; existing published material is preserved.
9. A group can be created/administered by a minor but cannot activate group communication without **two distinct accepted, active adult leaders** as group admins and an active safeguarding officer. Losing supervision suspends communication without deleting progress.
10. Group admins can remove a member's shared Info Card/media **from their group only**; an organisation safeguarding officer can remove shared/published content organisation-wide.
11. A safeguarding removal of a reused canonical Card blocks its visibility everywhere that Card occurs, while preserving other Cards and followers' stored data. Only authorised roles can restore it.
12. Private Decks, CardData, signals, reflections and later Personal Info Cards do not become generally visible to adult leaders, safeguarding officers or administrators.
13. Independently published content and independent group behaviour remain unchanged, aside from new-user DOB collection.
14. Media direct-URL limitation is explicitly recorded and checked against the pre-pilot media-security work; test results do **not** falsely claim direct-URL protection if absent.

## 12. Backlog — referenced deferrals

Every backlog item below is referenced in its relevant specification section above. These are **not** part of this initial implementation unless later explicitly promoted into scope. Items already tracked elsewhere should be linked to the existing task rather than duplicated.

| ID | Deferred item | Where referenced | Notes |
|---|---|---|---|
| **BL-01** | Multiple organisation memberships and context switching | §3.2 | Replace/extend one-organisation association and add explicit context handling only when needed. |
| **BL-02** | Move/merge existing accounts and content into/between organisations | §3.2 | Includes resolving Decks, CardData, followers, group links and existing sharing. |
| **BL-03** | Organisation self-service: joining, invites, approval and organisation creation | §4.2 | Current creation/provisioning remains administrator-controlled. |
| **BL-04** | Organisational subgroups/teams and restricted directory visibility | §§5.2, 7.4 | Separate from existing Deck-based group experiences. |
| **BL-05** | Cross-boundary publishing, external discovery and content sharing/import | §6.2 | Includes globally public Decks from organisation creators and authorised reuse from independent creators. |
| **BL-06** | Age-appropriate content and granular age-based permissions/visibility | §§3.3, 5.2 | DOB is recorded now; age-based publication/discovery rules are not. |
| **BL-07** | Standalone Cards tab in the public Library | §6.2 | Already planned elsewhere; do not add to this pass. |
| **BL-08** | Card comments and other supervised conversation mechanisms | §7.1 | Must avoid unsupervised private one-to-one communication when eventually designed. |
| **BL-09** | Formal age-verification workflow and verified-status management | §3.3 | Especially independent users; initial `ageVerified=false` and offline club responsibility remain. |
| **BL-10** | Wider safeguarding for independent users, including minors | §§3.3, 7.4, 10.2 | The organisation-specific two-adult rule is not imposed on independent group experiences in this pass. |
| **BL-11** | Advanced moderation and safeguarding case management | §8.1 | Reporting, workflows, review/appeal, alerts and richer audit facilities beyond minimum removal/restoration records. |
| **BL-12** | Stronger direct-media URL/storage access protection | §§8.4, 10.2 | **Existing media-security backlog:** link to existing tasks; avoid duplicate tickets. Must be reviewed before a pilot using identifiable minors' media. |
| **BL-13** | Stronger tenant isolation architecture if warranted | §6.1 | Assess extra controls or physical separation later; current server-side isolation is mandatory now. |
| **BL-14** | Broader GDPR/privacy operations and children-data requirements | §10.2 | Retention, erasure, rights requests, privacy notices/lawful basis, safeguarding operational processes and go-live review. |

## 13. Dependencies, caveats and interpretation

- **Existing group-experience project:** Owns its primary product/UX design. This specification contributes constraints to be integrated after that work is present; it does not authorise new group UX independently.
- **Separate Personal Info Cards branch:** Not present in the initial target branch. Treat §11.6 as a mandatory **post-merge** integration step, not a reason to scaffold early.
- **Separate JSON content-creation script project:** Responsible for populating a new organisation with content. Organisations begin empty here.
- **Existing media backlog:** Direct-URL protections are not delivered by ordinary database filtering. See BL-12 and the explicit pre-pilot risk.
- **Existing account/auth implementation:** Must be inspected; do not replace working authentication solely because the exact library is not yet documented.
- **GDPR/safeguarding status:** A functional pilot foundation is not equivalent to regulatory approval. Live use involving children needs a separate pre-launch review of deferred protections and operating procedures.

### Status of unresolved implementation details

The decisions above are product requirements. Repository inspection must determine the simplest safe implementation of entity associations, auth/session invalidation, UI placement, moderation state and current branch integration **without silently adding new product behaviour**. Anything that materially changes these requirements must return for design approval.
