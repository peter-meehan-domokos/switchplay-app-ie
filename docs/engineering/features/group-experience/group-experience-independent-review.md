# Group Experiences — independent architecture review (single document for Codex)

Reviewer: Claude (Copilot in VS Code). Scope: investigation only. No application code, docs, schemas, tests or config were changed; no database or provider was touched; no tests were run.

Reviewed: `docs/engineering/features/group-experience/group-experience-engineering-plan-draft.md` against `docs/design/features/group-experience/original-requirements-prompt.md` and the code on `feat/group-experience`.

## 0. How to read this / process notes

- **Review question numbering:** the plan has its own Q1–Q12. The questions raised by this review are labelled **A1–A10** to avoid confusion. Plan questions are always written "plan Q#".
- **Independence caveat:** the review prompt puts the "Priority areas" section in the same file as the Stage 1 instructions, so the six hypotheses were seen before Stage 1. The plan itself was not opened until the Stage 1 first pass was written down. The first pass below is the exact text written before reading the plan.
- **Requirements path:** `/Users/peterdomokos/.codex-second/attachments/.../Pasted text.txt` was not accessible. The copy in `docs/design/features/group-experience/original-requirements-prompt.md` was used.
- **Please verify, don't just accept:** several findings are readings of the code, not tested behaviour. Section 10 lists the ones Codex should confirm or refute with evidence before acting.

## 1. Independent first pass (written BEFORE reading the plan)

### Evidence that shaped it (code, not plan)
- Personal state is embedded in `users` documents: `PersonalUser.decksData[]`, `cardsData[]`, `itemTests[]` (`src/lib/cards/model.ts`). Identity is `(userId, cardTemplateId)`. Almost every path does `cardsData.find/filter(cardTemplateId)` and asserts exactly one (`repository.ts`: `updateReviewInSession`, `adoptUpdate`, `openWorkingDeck`, `setReflection`, `mutateMedia`, `removePersonalMedia`; `assessments/repository.ts` `assessmentStorage`; `cardMediaAccess.ts`; `infoCards/queries.ts`; `frameworks/readModels.ts`).
- Card adoption is global per user (`adoptUpdate` sets `cardsData.$[card].cardTemplateVersion`).
- Template access guards are `root.ownerUserId === actor || visibility === "public"` (`ensureCompositionCardData`, `openWorkingDeck`, `membershipDTO`, `assertCardVersionAccess`). A follower cannot read a private template today.
- Media access is actor-scoped by scanning the actor's own user document (`protectedMedia.authorizeProtectedMedia`, `cardMediaAccess.resolveAccessibleCardMedia`). Public R2 URLs are an accepted trial risk (`docs/engineering/features/info-cards/info-card-media-security-backlog.md`): the URL is a capability, and the personal bucket is also anonymously readable.
- Personal media is a whole-array read-modify-write inside a transaction (`mutateMedia`).
- The five-media limit is only a display slice (`BackCardMediaCarousel.tsx`: `items.slice(0, 5)`).
- Info Cards: the root has a single `ownerUserId`; personal means `kind: "personal"` plus `originCardTemplateId`; attachments live on `cardsData[].personalInfoCardIds`; Save forces private (`PERSONAL_INFO_PRIVATE_ONLY`); consultation filters `ownerUserId === actor && private`; `validPublication` requires `publishedByUserId === ownerUserId`; media proofs bind actor to owner.
- Client caches and queues key on `(userId, cardId)`: `WorkingCardStore`, `PersonalWork`. They are context-blind.
- Progress/frameworks aggregate over all of `user.cardsData`. Embedding group contexts in `cardsData` would pollute personal Progress.
- `/api/users` returns every username to any logged-in user.

### Preferred approach
1. **Identity:** a lightweight `groupExperiences` record (experienceId, deckTemplateId, settings, adoption selection, revision) plus `experienceMembers`, one row per user with admin/follower roles, follower status, timestamps and viewer navigation state. Unique on `(experienceId, userId)`. No persistent Group entity; a nullable `groupId` seam for later.
2. **Data:** personal stays embedded and untouched. Experience contexts use a new collection keyed `(experienceId, subject{group|user}, cardTemplateId)` with the same learning fields (steps, readings, reflection, tests). Rejected: embedding a context ID in `user.cardsData` (breaks uniqueness assumptions everywhere, 16 MB, Progress pollution). Rejected for now: full storage unification (largest regression surface, little V1 benefit). New code should share pure domain functions so personal could migrate later.
3. **Adoption:** a single authoritative selection (deck version plus per-card versions) on the experience record, changed by an admin via compare-and-set on a revision. Records are keyed by Step ID, so there is no fan-out or per-follower reconcile on adoption. Missing Steps or rows default to todo/null. Obsolete Step values are ignored by projection and retained.
4. **Info Cards:** extend the existing `InfoRoot` with an experience scope `{experienceId, cardTemplateId, authorUserId, audience: self|group|users[]}`. The attachment is intrinsic to the root, not embedded on follower CardData. Non-managers only ever read the latest published version. Authority is the author or any experience admin.
5. **Media:** normalized `contextMedia` rows (experienceId, cardTemplateId, subject, uploader, uploadedAt, item) with keyset pagination on `(uploadedAt, _id)`. The group view is a query over rows, including removed followers. A new experience-scoped, membership-based authorization path, not user-document scanning. Public R2 is flagged as a safeguarding blocker.
6. **Aggregates:** computed at read time from active follower rows with the existing pure progress and signal functions. A denormalized per-follower summary only if measurements require it.
7. **Perspectives:** one viewer-level active-card state; cache identity per `(experience, subject, card)`; miniatures render a lightweight projection and never mount full Cards or media.
8. **Reflections:** the carousel is a read projection of group and follower reflections. Tap-to-advance for non-editable display; a separate edit affordance. The tap-to-edit conflict needs a product decision.
9. **Concurrency:** per-record revisions or compare-and-set for list-like writes; a per-member guard for ordinary writes; one cheap guard on the experience document only for structural commands (membership, roles, adoption).

### Alternatives considered
- A. Unified storage (move personal to a collection): safest long term, highest migration and regression cost now.
- B. Embed contextId in `user.cardsData`: rejected.
- C. Persistent Group entity: rejected for now, keep the seam.
- D. Per-follower eager fan-out on adoption: rejected (large transactions).

### Major risks identified in the first pass
- Private templates are not readable by followers today; assignment needs an experience-scoped grant or a public-only rule.
- Context-blind client caches, `PersonalWork` and `WorkingCardStore`.
- Media authorization and public R2: removal doesn't revoke; Stream playback grants are one-hour bearer tokens.
- Owner-equals-actor assumptions in six or more Info Card places.
- Aggregate query cost for big groups; personal media array growth once the cap is removed.
- Under-18 safeguarding and consent; `/api/users` enumeration.

### Rough sequence
0 product and safeguarding decisions → 1 pure-domain extraction, context type, personal media-cap UI removal → 2 experience, members, access service, template-access rule → 3 follower context writes → 4 group-owned writes → 5 aggregation read models → 6 adoption → 7 media → 8 Info Card sharing → 9 perspective UI → 10 Progress and assessments → 11 reflection carousel.

### Uncertainties
Group size and scale; whether private templates must be assignable; whether follower media should appear outside the experience; how assessments relate to Items and frameworks for a group.

## 2. Overall assessment

The plan is sound and unusually well evidenced. It keeps personal data as is, adds experience collections, keeps one adoption authority per experience, and extends the existing Info feature while separating author, manager and audience. It correctly flags that confidence averages are rounded to integers, that the "five-item limit" is only a thumbnail slice, and that client cache keys collide across contexts.

It is not ready for implementation yet:
- It does not carry the public-R2 reality into its privacy promises.
- The explicit-initialization decision creates a race that then justifies the heaviest machinery in the plan (the guard and the staged provisioning fallback).
- The proposed guard is too coarse.
- The group Progress view (requirement 13) has no design.
- The Info Card version-grant mechanism looks heavier than needed.

## 3. High-level comparison

We agree on the foundations: experience collections, one adoption authority, an Info Card extension, and paged media.

| Topic | First pass | Plan |
| --- | --- | --- |
| Missing rows | Absent row means defaults | Explicit initialization, with a conditional staged provisioning fallback |
| Roles | One member row per user | Admins on the experience document, followers on separate rows |
| Guard | Per-member for ordinary writes; experience-level for structural | One experience guard for all group commands |
| Info Card reads | Latest version only | Per-grant boundary tracking |
| Group-owned deck data | On the experience record | Separate `experienceDeckData` collection |

Preferred: the plan's structure with the simplifications in section 4.3 and section 7.

## 4. Prioritized findings

### 4.1 Confirmed defects or gaps in the plan

**F1. Public R2 undermines the privacy guarantees.** (Plan §3.5, §6.2, §10.3, Phase 3.)
- `info-card-media-security-backlog.md` records that Info Card images and the personal-media bucket (`path-user-data`) are anonymously readable by URL, and that 130 of 131 inspected Stream videos lacked signed-URL protection (the doc says these are not proof of private-card content).
- Stored image items carry the public `src` (`validateUserCardMediaItem` in `src/lib/userCardMedia.ts`).
- The plan promises "removed viewer cannot obtain fresh grants" and denial of old direct URLs and image proxies. These pass at the application layer but don't protect the image. The plan names "provider-origin confidentiality" as a Phase 3 risk but never says follower media, possibly from under-18s, is publicly fetchable.
- Recommendation: make this a launch-gating question (A1).
- Confidence: high on the documentation; medium on actual end-to-end exposure, because the protected-media client path wasn't checked.

**F2. No design for the group Progress view (requirement 13).**
- The existing Progress view is framework-based (Framework → Area → Item → mapped Cards), and its Test column is user-level `itemTests` on `PersonalUser` (`src/components/progress/ProgressShell.tsx`, `src/lib/frameworks/calculations.ts`).
- The plan only models group-owned Card tests and says Item tests stay personal. It has no phase, data model or question for a group Progress view.
- Either requirement 13 is narrower than it reads, which the plan should say, or this is a missing workstream.

**F3. Rejecting stale follower writes after adoption contradicts the plan's own design (§10.2).**
- Step values are keyed by stable Step ID and obsolete values are retained. A follower write validated against v1 that lands after adoption of v2 is therefore harmless.
- Rejecting it would make every open follower tab fail until refresh, after every adoption.
- Only a Step ID absent from both versions needs rejecting.

**F4. The experience-wide operation guard is the wrong shape (§6.2).**
- Every group command touching one document means a class of followers tapping progress and confidence all contend on one row. The Mongo driver's `withTransaction` retries transient write conflicts for up to 120 seconds.
- The repo already has this pattern, and it already serializes at small scale. `addLibraryDeck` does `$inc publicationGuard` on the public Deck for every personal Add (`repository.ts` line 896), and Deck Update does the same (line 173).
- A read-only membership check inside a snapshot transaction doesn't serialize revocation (the plan is right about that). But ordinary writes only need to write the actor's own member row, and structural commands (membership, roles, adoption) the experience document.
- The plan relies on every route remembering to participate. One repository wrapper that requires an access check would make this structural.

**F5. Explicit initialization (§10.1) creates a race that the plan then heavily mitigates.**
- Timeline: a Deck Update adds Card N and initializes rows for the active followers it sees. Concurrently, follower F is added and initializes rows for the old composition. F is active but has no row for N, and the plan treats "missing required data" as an incomplete calculation.
- That is why the plan needs the experience guard and keeps a conditional "staged provisioning" fallback, which is effectively a job system and the unresolved architecture decision the lead engineer suspected.
- The existing code already treats a missing Step as todo (`resolveAdoptedCardCalculation` in `src/lib/frameworks/calculations.ts`). It also needs lazy defaults anyway when an existing Card gains a Step, so the plan has two mechanisms.
- Treating an absent row as defaults, written on first write with the unique `(experience, owner, card)` index, removes the race and most of the guard and fallback.
- Confidence about 0.7. The caveat is that denominators then come from member rows.

**F6. "Synchronized perspectives" is interpreted as viewer-local without being asked (§8.1).**
- The plan says selection "is not a classroom-wide live navigation broadcast" and persists a per-viewer record. This is a reasonable reading but isn't in the plan's QUESTIONS (see A3).

### 4.2 Likely risks

- **Info Card version-grant boundaries (§7.3).**
  - They work (see scenario S1). They also add per-recipient and per-group grant state, transitions and exact-version denial tests.
  - If non-managers can only read the latest version, this collapses to "current audience plus recipient row".
  - The cost is that a recipient's pinned open snapshot becomes "unavailable" when the author saves a new version. That is a product call (A5).
- **Private templates (plan Q1).**
  - Every foreign read requires an owner or public visibility check (`ensureCompositionCardData`, `openWorkingDeck`, `membershipDTO`, `assertCardVersionAccess`). Public visibility is permanent: `PUBLIC_VISIBILITY_PERMANENT` in `repository.ts` line 30.
  - So the plan's "public content first" recommendation means a coach must permanently publish a Deck to assign it to a team. Plan Q1 should say this explicitly.
- **Per-field compare-and-set for group progress taps.**
  - Setting a status or reading is idempotent, so last-writer-wins is probably acceptable.
  - Compare-and-set matters for reflection text and list writes (tests, media, Info).
  - Revision-checking every Step tap adds conflict UI that no requirement asks for.
- **Personal media deferral gate is vague.**
  - `mutateMedia` rewrites the whole array in a transaction.
  - `getPersonalUser` loads the entire user document, including all media, on essentially every request.
  - The real risk is per-request payload, not the 16 MB limit. The plan's trigger ("if the agreed launch workload exceeds the envelope") has no numbers.
- **Aggregation cost.** The deck-level count reads followers × cards rows and is recomputed on refresh. That's fine for 30 × 12, but a threshold is needed (A10).
- **`/api/users` enumeration** (`src/app/api/users/route.ts`). The plan flags this under plan Q2.
- **Info Card series.** Series are mandatory for publication and are creator-owned and per-author (`eligibleSeries`, `validPublication`). The plan doesn't mention them. For example, whose series does an admin use when editing a follower's card (A9)?

### 4.3 Simplification opportunities
- Merge `groupExperienceFollowers` and the admin list into one `experienceMembers` row (roles, status, navigation state, revision). This also narrows the guard.
- Drop `experienceDeckData`: member rows hold per-follower fields and the experience record holds group-owned ones.
- Make `groupInfoRecipients` an embedded recipient array with a multikey index, if latest-only reads are adopted.
- Treat absent rows as defaults and remove staged provisioning.

### 4.4 Unresolved assumptions
- Group size and freshness (plan Q11).
- Whether a user's media outside the experience should appear in it (the plan assumes not).
- Whether admins can read self-only Info drafts (plan Q3 covers this).

## 5. Questions raised by this review (A1–A10)

| # | Question | Who | Needed |
| --- | --- | --- | --- |
| A1 | Is it acceptable that group media, including from under-18s, is protected only by URL secrecy at the provider? If not, provider protection is a prerequisite. | Product owner and safeguarding | Before Phase 1 |
| A2 | Must a coach be able to assign a private Deck? If so, an experience-scoped template grant is required architecture, not an edge case. Public-first implies permanent public publication. | Product owner | Before Phase 1 |
| A3 | Does "synchronized" mean viewer-local only, or should one admin's navigation drive other users' views? | Product owner | Before Phase 5 |
| A4 | What does the group Progress view (requirement 13) concretely show, and are there group-owned Item tests? | Product owner, then lead engineer | Before Phase 2 design |
| A5 | If a shared Info Card is edited, should a recipient's open snapshot survive or become unavailable? This decides whether latest-only reads work. | Product owner | Before Phase 4 |
| A6 | Adopt "absent row means defaults" and per-member guards, removing staged provisioning? | Lead engineer | Before Phase 1 |
| A7 | Should group progress taps be last-writer-wins, with compare-and-set limited to reflection and list writes? | Lead engineer | Before Phase 2 |
| A8 | What numeric gate (payload bytes, item count) triggers the personal media migration? | Lead engineer | Before Phase 3 |
| A9 | Whose series applies to a follower-authored card that an admin edits? | Lead engineer | Before Phase 4 |
| A10 | What followers × cards threshold makes read-time aggregation insufficient? | Lead engineer | Before Phase 2 performance design |

The plan's own Q1–Q12 stand on their merits and are not reopened.

## 6. Concrete failure scenarios

**S1. Info Card timeline** (private v1 → shared v2 → private v3 → shared again, with recipient removal and re-addition).
- v1 self-only is author only.
- Shared at v2: the grant boundary is v2.
- Revoked: the grant is removed.
- v3 saved privately: not readable by others.
- Shared again: the new boundary is v3, so v1 and v2 stay hidden.
- Recipient removed and re-added: a new boundary for that recipient.
- The plan holds up. The latest-only rule gives the same outcome without grant records. The case to test is a recipient added after v2 requesting exact v2 by direct URL, which must be denied.

**S2. Stale follower write.** The admin adopts v2 while a follower's tab shows v1. The follower taps Step 2 and the plan rejects it. Thirty followers all see "refresh and retry". Accepting the write loses nothing because Step IDs are stable.

**S3. Join versus Deck Update.** See F5. It needs both transactions to touch the same guard, or absent-row semantics.

**S4. Cache collision.** `src/lib/cards/workingCardStore.ts` keys on `(userId, cardId)`, and `project()` overlays stored values whenever `adoptedVersion` matches. A follower's group card at the same version would show their personal completion, reflection and media. Cache keys need the experience and perspective, as the plan says.

**S5. Context-blind URLs.** `/api/decks-data/[deckTemplateId]` and the `/api/cards-data/...` routes select the session user's embedded data by template ID alone. A group UI that reused them would silently read or write personal data whenever the same Deck exists personally.

## 7. Recommended plan revisions

**Make now**
- Add a Phase 0 gate on media protection (A1) and private-template eligibility (A2).
- Replace the experience-wide guard with a per-member guard for ordinary writes and a structural guard for membership, roles and adoption, enforced by a single repository access wrapper.
- Switch to absent-row-means-defaults. Remove staged provisioning, or document why it stays.
- Stop rejecting stale follower writes for Steps that exist in either version.
- Add a group Progress view workstream, or an explicit scoping statement (A4).
- Add "meaning of synchronized" to the plan's questions (A3).
- Add a test that enumerates group routes and asserts the access wrapper is used.

**Defer safely**
- Info Card latest-only versus grant boundaries, until A5 is answered.
- Per-field compare-and-set scope.
- The personal media cutover, but with numeric triggers (A8).
- Materialized aggregates.

## 8. Strongest parts of the plan to preserve
- Separate group and follower storage with real compound unique indexes.
- Experience-owned adoption selection with no fan-out.
- Extending the existing Info feature rather than building a parallel one, with author, manager and audience kept distinct.
- Normalized, keyset-paged media with selected-only playback.
- Surfacing facts the requirements didn't know: the five-item slice, integer rounding of confidence, owner-only media, `validPublication` requiring publisher equals owner.
- The acknowledgement that read-only membership checks don't serialize revocation.
- The regression table and the deterministic interleaving list.

## 9. Which existing paths are most likely to bypass the context boundary
1. `PersonalWork` and `WorkingCardStore` keys, which are context-blind (S4).
2. `/api/decks-data/[deckTemplateId]` and `/api/cards-data/[cardTemplateId]/*`, which select the session user's data by template ID and accept the same Deck ID in personal and group contexts (S5).
3. `authorizeProtectedMedia` and `resolveAccessibleCardMedia`, which scan the actor's own user document. This fails closed today; the risk is someone broadening the scan.
4. `assessmentStorage` and `assessmentWorkingCard`, which use `deckTemplateId` plus `cardTemplateId` against personal records only.
5. Info Card `createPersonal`, `removePersonal` and `personalRecoveryContext`, which assume personal origins.
6. AppShell membership lookup, which assumes one membership per DeckTemplate.
The plan covers most of these in its §3.4 table; item 4 deserves explicit mention.

## 10. Please verify (Codex)

I'd like Codex to confirm or refute these with evidence before any plan changes:
1. **Hotspot (F4):** whether a single experience guard document would actually cause write-conflict retries under realistic concurrent follower writes (replica-set test, not reasoning).
2. **Explicit initialization race (F5):** whether the Deck Update vs add-follower race exists given the plan's transaction design, and whether absent-row semantics break any consumer (`projectWorking` has `requireCondition(card.data !== null, "MISSING_CARD_DATA")` and `resolveAdoptedCardCalculation` fails on a missing row).
3. **Public R2 exposure (F1):** whether a group member's feed DTO would expose public image URLs, and whether protected media mode (`NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA`) changes that.
4. **Latest-only Info reads (§4.2):** whether limiting non-managers to the latest version breaks pinned open snapshots, exact-version media authorization or the unavailable-entry contract in a way the product cannot accept.
5. **Group Progress view (F2):** whether requirement 13 is a real gap or a narrower requirement than I read.
6. **Stale-adoption rejection (F3):** whether any consumer depends on rejecting writes made against a pre-adoption version.

## 11. Limits of this review

**Read:** the full original requirements and the full plan. In code: `src/lib/cards/model.ts`, most of `cards/repository.ts` (update adoption, deck data, open, reflection, media, assessments), `cards/updateAdoption.ts`, `cards/forks.ts` (personal history), `cards/readModels.ts`, `cards/protectedMedia.ts`, `cardMediaAccess.ts`, `userCardMedia.ts`, `deckData.ts`, `progress.ts`, `signals.ts`, `assessments/repository.ts`, `frameworks/readModels.ts` and `frameworks/calculations.ts`, `infoCards/model.ts`, most of `infoCards/repository.ts`, `infoCards/queries.ts`, parts of `infoCards/media.ts`, `workingCardStore.ts`, `personalWork.ts`, `BackCardReflectionFragment.tsx`, `ProgressShell.tsx`, `users/route.ts`, `mongodb.ts`, and `data-model.md`.

**Partly read:** the Info Card handoff (searched for privacy statements) and the Info Card engineering plans (searched, not read in full).

**Not read:** test files, the Next.js docs the plan cites, provider code in detail, `DeckScene`, `FocusedCardView`, the media viewer.

**Checks performed:** none at runtime. No tests, servers or databases were run, and no providers were contacted. All claims are from source reading.

**Remaining uncertainty:** anything about what the UI exposes to the client; real concurrency behaviour; provider-side access control.
