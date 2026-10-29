# Group Experiences — Draft Engineering Plan

**Status:** Investigation and proposed architecture; no implementation authorised or performed.

**Date:** 29 October 2026. **Inspected branch:** `feat/group-experience`, HEAD `2ff6388`, based on `feat/info-cards` as instructed. The singular directory and filename are intentional. At the start, this directory was untracked and this file was empty; no other worktree changes were reported.

**Authority:** The attached “Group Experiences — Draft Engineering Plan” task, with the user's branch/path correction. Confirmed product requirements take precedence over historical plans. Recommendations below are engineering proposals, not approval of unresolved product or visual behaviour. All source paths are relative to the repository root; line references describe the inspected baseline.

## 1. Executive summary

Build a Group Experience that references one existing DeckTemplate, assigns it to selected registered followers, holds independent group-owned learning state, and lets equal-permission admins inspect and moderate experience-specific follower contributions. Keep canonical CardTemplates and DeckTemplates unchanged. An admin who also follows has a separate follower perspective and contributes once to follower aggregates.

Recommended architecture:

1. Introduce a persistent **Group Experience**, with independent admin and follower relationships, but no separate reusable Group or Organisation entity yet. An experience already supplies the identity, membership, permissions and lifecycle V1 needs. A future Group can link to experiences without changing their learning-data identities.
2. Keep existing personal `users.cardsData` and `users.decksData` semantics. Add experience-scoped CardData records outside user documents, using explicit experience, owner-kind and owner identities. Group-owned data and follower data share the existing learning-field model and calculation functions; they never impersonate an admin's personal data.
3. Store one authoritative Deck adoption and Card adoption selection per experience. All perspectives resolve those selections. Do not copy adoption independently into every follower record or call each follower's personal Update API.
4. Extend the existing Info Card domain with an experience-bound purpose and audience, using one root and its immutable versions for every recipient. Separate original author, current editor and recipients. Preserve existing permanently private Personal Info Cards outside experiences. Reuse the existing editor, maths support, media pipeline, snapshot resolver and pouch.
5. Query contributions from their original experience-specific storage. Compute completion/confidence from active followers; include retained former-follower media/reflections/shared Info Cards through separately authorised contribution projections. GroupData stores only group-owned values, not copies of all follower work.
6. Use indexed, paginated media records for group contributions and retain compatible personal-media reads. Reuse the viewer/player/download primitives. Unlimited item count must not become an unbounded response or a full-resolution gallery fetch. Existing personal media already has no five-item persistence quota; a wider storage migration is a separate, measurement-driven decision.

The largest risks are identity assumptions across the client/server, owner-only Info/media authorization, membership removal during in-flight operations, and retaining one coherent version selection under concurrent adoption. Private Deck eligibility, deletion meaning, safeguards for younger participants and several UX details need decisions before the affected implementation phases.

**Important findings:** the code already accepts more than five uploaded media items; the explicit five-item limit is a thumbnail rendering slice. Confidence aggregation currently rounds to an integer, whereas the prompt illustrates a decimal follower average. Neither finding should be hidden behind an implementation assumption.

## 2. Confirmed product requirements

| Area | Confirmed behaviour |
| --- | --- |
| Creation | Eligible registered user selects an existing Deck and registered followers, creates the experience and may appoint more admins. Automatic My Decks assignment; no invitations or acceptance. One Deck run per experience; no restart feature. |
| Roles | Equal admins; creator is not a privileged primary admin. Admin and follower roles are independent. Prevent loss of the final admin. Template authorship grants no experience administration. |
| Membership | Add/remove followers at any time. New followers have independent data. Removal revokes experience access and removes its My Decks assignment; retain data. Rejoin restores that data. |
| Former followers | Excluded from completion counts/confidence averages. Retained media/reflections remain visible with attribution; previously shared Info Cards can remain visible. Admins inspect preserved data through collapsed **Removed / Left Group**; active followers cannot inspect former personal Cards. |
| Context isolation | Personal, experience A and experience B have independent CardData and relevant DeckData, including tests, media and Info associations. Preserve existing same-user/CardTemplate reuse across ordinary personal Decks. |
| GroupData | Admin-controlled progress, confidence, reflection, direct group media and applicable assessments. These are separate from follower values and aggregates. |
| Progress | Existing step → Card → Deck calculation and interactions. Active follower completed/total counts immediately right of the group progress indicator at all three levels. |
| Confidence | Existing three step-linked signals and drag interaction. Always show group value and active-follower average; exclude unset/null values. No signal-mode setting. |
| Media | No arbitrary item-count cap in personal or group contexts. Group collection combines direct group uploads and follower uploads by upload timestamp, with uploader attribution, including removed followers. Preserve upload/view/remove/download/mobile functionality. |
| Reflections | Same bottom-right Card area; continuous automatic rotation every few seconds, tap advances, gentle fade, author name beneath, group reflection prominent. Include former followers. No separate group-reflection dashboard, viewing modal or expanding area. |
| Info authorship | Followers create self-only or permitted group-wide cards; never arbitrary subsets. Admins create group-wide or selected-recipient cards. One logical identity for multiple recipients; edits reach all recipients; admins manage recipients. |
| Info visibility | Group-wide appears in group and every active follower pouch, automatically including new members. Targeted appears only to selected recipients and admins. Preserve canonical Info Cards and the existing pouch. |
| Info management | Followers edit/delete their own cards, never admin-created cards. Admins manage admin-created cards and can delete follower-created contributions. Preserve actual author identity. |
| Sharing setting | Admins can enable/disable follower group-wide creation. Disable leaves existing shares intact and editable by their authors. Self → group requires permission; group → self always allowed for an authorised follower author. |
| Permissions | Followers edit only their own experience CardData and view the group Card/contributions. Admins inspect and delete follower data but cannot change follower-owned values. Admin-created Info Cards are the explicit management exception. |
| Versions | Existing canonical templates, no group editing/forking or Creator Mode even for template creators. Only admins adopt updates, from group perspective; all follower perspectives use the experience's adoption. Other contexts remain unchanged. |
| Progress view and assessments | Reuse the existing learning hierarchy and Progress structure for group completion/confidence alongside follower aggregates. Admins maintain group assessments; individual assessments stay in personal follower perspectives and are not aggregated. |
| Synchronized perspectives | All perspectives within the experience view track the same active CardTemplate while their learning data remains independent. Switching perspective retains that Card; moving through the Deck updates the Card shown by every perspective. |

**Provisional UX, not implementation specifications:** desktop admin main Card plus group/follower miniatures; default group perspective; mobile follower personal/group switching via a small alternate Card. Shared active CardTemplate navigation is confirmed; its visual presentation is provisional. Exact layout, geometry, timing, switching animation, editing affordances and management entry points need separate design. Preserve front/back behaviour, step navigation, media and pouch. Terminology remains domain-neutral for basketball and maths.

## 3. Existing architecture audit

### 3.1 Documentation and evidence

Read the [Personal Info Cards handoff](../info-cards/personal-info-cards-handoff.md), [Personal Info Cards plan](../info-cards/personal-info-cards-engineering-plan.md), and [original Info Cards plan](../info-cards/info-cards-engineering-plan.md). Also examined [first-class Card Phase 5 contract](../../phase-5-plan.md), [current data model](../../data-model.md), [architecture](../../architecture.md), and [system behaviour](../../system-behaviour.md), and traced the relevant implementation and tests.

The installed Next version is `16.2.6`. The installed Route Handlers guide (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) was inspected: existing routes use asynchronous `RouteContext.params`; authenticated routes must retain their explicit private/no-store boundaries. The installed caching guide distinguishes opt-in Cache Components. This plan proposes no Next configuration or shared response cache changes. Future coding must reread the relevant installed guides under `AGENTS.md`.

This is source inspection, not a new runtime certification. Existing test names and handoff results establish reusable coverage/infrastructure; no test suite, application server, database connection, provider verification or migration was run for this plan.

### 3.2 First-class identity, persistence and personal entry

| Evidence | Current implementation | Consequence |
| --- | --- | --- |
| [model.ts](../../../../src/lib/cards/model.ts):21–113 | Independent canonical roots/drafts/immutable versions. `CardData` is embedded in `users.cardsData`, keyed by CardTemplate ID within a user; DeckData is embedded membership/adoption/navigation. | Adding a group ID to a route alone cannot isolate data. |
| [repository.ts](../../../../src/lib/cards/repository.ts):43–52 | Unique canonical Card/Deck IDs, Card/Deck version pairs, global Step reservation and reference indexes. No database constraint enforces uniqueness of embedded user/CardData elements. | A unique multikey index is not a repair for duplicate elements inside one user document. New experience records should use actual compound uniqueness. |
| `repository.ts:823–965`, `ensureCompositionCardData`, `ensureCardData` | Guarded append only when template identity is missing. Existing personal data wins across Deck entry, restore and reuse. | Preserve this behaviour in the personal storage adapter; never let experience assignment call these initializers. |
| `repository.ts:986–1036`, `openWorkingDeck` | First working open initializes cadence/date state; Add/Restore/Update do not themselves establish first-open dates. | Group assignment is not a personal working-open operation. Scheduling policy needs an explicit experience decision. |
| [resolvers.ts](../../../../src/lib/cards/resolvers.ts), `resolveWorkingDeck`, `resolveCards` | Load one user's arrays; maps and lookups key by CardTemplate or DeckTemplate alone; effective versions come from personal records. | Reusing these unchanged against a mixed-context array would cross contexts or collapse duplicates. |
| [readModels.ts](../../../../src/lib/cards/readModels.ts):44–145 | Explicit projections of progress, signals, media, history and personal Info fields. My Decks resolves memberships into full Deck displays. | New fields need deliberate projection; group summaries must not eagerly contain every follower's full Cards. |
| [forks.ts](../../../../src/lib/cards/forks.ts):37–103 | First fork publication selectively copies the actor's current values and links same-actor retained history; media/tests/Info attachments remain at their original source. | Never infer group history from canonical fork lineage or import personal source history into a new experience. |

Current CardData includes target date, Step completion, step-linked readings, reflection, media, chats, tests and test revision, personal Info IDs/dates/revision, history source, creation/update timestamps. DeckData includes adopted Deck version, active Card, archive/membership revision, opened/created/updated dates, cadence anchor and parked sharing metadata. Every relevant field needs an explicit contextual treatment; isolating only completion is insufficient.

### 3.3 Progress, confidence, assessments and framework summaries

- [progress.ts](../../../../src/lib/progress.ts):18–29 computes done/non-skipped, rounded to an integer percentage; all-skipped returns 100; empty returns null. `inProgress` contributes zero completed Steps. Card and Deck layouts call this same function; Deck calculation flattens Steps instead of averaging Card percentages. `DeckScene.tsx:451` labels rounded 100 as Completed.
- [signals.ts](../../../../src/lib/signals.ts) validates a 1–10 range, stores client readings to two decimal places and averages valid raw values, excluding null/invalid values, then **rounds the final aggregate to an integer**. Skipped-Step readings still count. No set readings yields null. Do not average already-rounded Card values.
- [BackCardFaceContent.tsx](../../../../src/components/decks/BackCardFaceContent.tsx), `FocusedSignalRow`, owns drag preview, gesture-axis arbitration and one end-of-drag commit. Current transient labels emphasise endpoints/“Drag to set”; the two always-available group/follower numeric values need an additional presentation seam without replacing the gesture.
- [assessments/repository.ts](../../../../src/lib/assessments/repository.ts) uses exactly-one CardData validation, independent list revision, narrow writes and retry reconciliation. Existing results remain owner-manageable after personal archive/context loss. [contracts.ts](../../../../src/lib/assessments/contracts.ts) and [historyClient.ts](../../../../src/lib/assessments/historyClient.ts) identify Card sources only by template ID and assume viewer equals owner.
- [frameworks/eligibility.ts](../../../../src/lib/frameworks/eligibility.ts) includes active and archived personal memberships and deduplicates by CardTemplate. [calculations.ts](../../../../src/lib/frameworks/calculations.ts) filters actual adopted Steps, fails explicitly for missing/corrupt contributors, and reuses progress/confidence functions. These are useful calculation precedents, but the personal eligibility and deduplication rules are not group aggregate rules. Inclusion of group work in account-wide Progress remains unanswered.

### 3.4 Mutations, state, navigation and capabilities

[decks-data/[deckTemplateId]/route.ts](../../../../src/app/api/decks-data/[deckTemplateId]/route.ts) multiplexes archive, active Card, completion, signal, target date, reflection and media operations. Its repository methods (`repository.ts:1038–1169`) select the session user's data by template ID. Reflection/completion/signal writes use transactions and narrow fields, but do not supply the shared-editor revision contract required for multiple admins.

The following identities currently omit experience and perspective:

| Surface | Current assumption to change for group paths |
| --- | --- |
| [workingCardStore.ts](../../../../src/lib/cards/workingCardStore.ts) | Key `[userId, cardId]`; adoption freshness and independent personal-Info source revisions. |
| [useWorkingDeck.ts](../../../../src/components/decks/useWorkingDeck.ts) | `dataOwnerUserId` is used as request actor; field tokens, confirmed baselines and signal queues key by Card/Step. |
| [personalWork.ts](../../../../src/lib/cards/personalWork.ts) | Save/upload/editor barriers overlap by user plus Card/Deck IDs. |
| [userCardMediaMutationQueue.ts](../../../../src/lib/userCardMediaMutationQueue.ts) and [upload controller](../../../../src/components/media/useKeyedUserCardMediaUploadController.ts):67 | User/Card key intentionally shares upload state across personal Decks. |
| [presentation.ts](../../../../src/components/decks/presentation.ts) | Working identity uses owner/Card/version; `hasPersonalCard` means any noncanonical presentation. |
| [AppShell.tsx](../../../../src/components/layout/AppShell.tsx):65–103,226 | Membership lookup, URL `openDeck`, selection and mounted Deck key assume one membership per DeckTemplate. |
| [DeckDetail.tsx](../../../../src/components/decks/DeckDetail.tsx):47–68 | Creator entry is permitted for ordinary working membership; Update and assessments derive actor from data owner. |
| [FocusedCardView.tsx](../../../../src/components/decks/FocusedCardView.tsx):261–269 | Instructional playback actor also derives from personal data owner. Admin inspection must never impersonate that follower. |

Reuse `DeckScene`, `FocusedCardView`, `StepView`, Card layouts and their slots. `DeckDetail` is a working adapter, not a generic safe group controller. Group contexts need explicit capabilities and a separate narrow adapter around the same presentation, with injected scoped commands.

[cards/http.ts](../../../../src/lib/cards/http.ts) already supplies initiating-actor checks, error handling, private/no-store and `Vary: Cookie`. Preserve those and distinguish **authenticated viewer**, **data owner**, **template owner** and **uploader/author**. `AuthUser.isAdmin` is an application flag, not an experience grant. Legacy shared-Deck endpoints return 410; `sharedWithUserIds`/`sharedDeckData` are parked metadata, not a collaboration foundation.

### 3.5 Media and reflections

**Five-item finding:** [BackCardMediaCarousel.tsx](../../../../src/components/decks/BackCardMediaCarousel.tsx):51 slices thumbnails to five. `UserCardMediaUploadPanel` maps all supplied items; `appendUserCardMediaItem` and `CardRepository.mutateMedia` append without a five-item check; both direct-upload routes perform scope/type validation without count enforcement. [system-behaviour.md](../../system-behaviour.md) explicitly documents five thumbnails plus a full-list gallery; `tests/card-media-viewer.spec.ts` covers more than five. The retired `selectVisibleUserCardMediaItems` helper selects one image/video, but the current working uploader uses all trusted items. No five-item database/schema quota was found.

**Storage gap:** [media.ts](../../../../src/lib/media.ts) has media/asset IDs, URLs, description and video dimensions, but no per-upload timestamp or uploader. A CardData update timestamp cannot reconstruct upload chronology. New group uploads require server-owned attribution and timestamp metadata.

**Access gap:** [cardMediaAccess.ts](../../../../src/lib/cardMediaAccess.ts) validates exactly four request identity fields and reads only the session user's retained history. [protectedMedia.ts](../../../../src/lib/cards/protectedMedia.ts) similarly searches own personal records or permitted canonical references. Existing admins/template owners cannot read another learner's uploads; that remains correct outside group scope. Raw URL/asset identity is never sufficient for group authorization.

**Upload gap:** new personal R2 keys are `user-cards/{user}/{cardTemplate}/{uuid}` ([cards/media.ts](../../../../src/lib/cards/media.ts)); existing allocation/validation lacks experience identity. Ordinary video append validates item shape/ID/URLs, while Info Card media has stronger signed allocation provenance. Extend the latter pattern for group media so an asset cannot be transplanted from another context. Preserve old trusted references without re-uploading assets.

**Lifecycle:** reuse [mediaUploadClient.ts](../../../../src/lib/mediaUploadClient.ts), keyed upload controller, processing checks, R2/Stream provider adapters and existing selected-media viewer. Keep provider calls outside retriable Mongo callbacks. [protectedMedia.ts](../../../../src/lib/cards/protectedMedia.ts) issues one-hour Stream tokens; grant reuse is ten minutes, not expiry. A removed user may retain an already-issued bearer URL until expiry. The private-image trial allowance in `infoCards/media.ts` is explicitly not proof of protected storage origins.

**Reflections:** [BackCardReflectionFragment.tsx](../../../../src/components/decks/BackCardReflectionFragment.tsx) owns the current physical text fragment and edit activation. [WorkingFocusedCardView.tsx](../../../../src/components/decks/WorkingFocusedCardView.tsx) owns an existing reflection editor overlay, draft and Save flow. Tap currently means edit; group tap must mean advance. The viewing carousel can reuse the fragment/position, but its editing activation cannot simply reuse that tap. Do not introduce a new modal or choose an edit gesture without UX approval.

### 3.6 Personal Info Cards: implemented, reusable and incompatible assumptions

The feature is implemented, not a future dependency:

- [infoCards/model.ts](../../../../src/lib/infoCards/model.ts) has `kind: creator | personal`, immutable personal origin, root owner, draft revision/reference guard, immutable publications and exact media contexts.
- [repository.ts](../../../../src/lib/infoCards/repository.ts):107–156 creates/removes personal associations; 211–276 atomically commits first usable Save and CardData ID/date/revision; later Save and source-revision receipts do not reattach. Remove is **association-only**, not content deletion.
- `owner()` at 86 requires root owner equals session actor. Generic Publish/canonical attachment guards reject personal roots. Catalogue/series discovery exclude personal purpose even for the owner. Delete at 332 checks canonical draft/history and retained personal references before deleting versions and reserving the root ID.
- [queries.ts](../../../../src/lib/infoCards/queries.ts), `mainInfoConsultation`, joins exact adopted main references with live same-actor history and latest authorised private publications in a snapshot. Mixed entries sort by attachment date, with root creation as legacy fallback. Unavailable positions are opaque. Current `validPublication` also requires publisher equals original owner; that must change **only for the new group purpose** when another admin edits admin-managed content.
- [infoCardConsultationClient.ts](../../../../src/components/info-cards/infoCardConsultationClient.ts) rejects a personal entry if its owner differs from actor or origin is outside authorised personal sources. Adding backend sharing alone would still fail this contract.
- [PersonalInfoEditorDialog.tsx](../../../../src/components/info-cards/PersonalInfoEditorDialog.tsx), `InfoCardEditor`, controller, consultation and physical stack support embedded authoring, recoverable autosaves, exact Save receipts, pinned open snapshots, same-pouch New/Edit/Remove and stable selection. Reuse these components; add capability/audience contracts rather than a second Info feature.
- [infoCards/media.ts](../../../../src/lib/infoCards/media.ts) binds proofs and readiness to original actor/owner; R2 verification uses that actor's namespace, Stream checks provider creator. Another admin editing a group's existing card requires allocation-uploader provenance independent of original author. Draft/media reads cannot gain broad owner bypasses.
- `personalRecoveryContext`, My Drafts and recovery journals assume actor-owned personal origins; group recovery must reauthorize membership and purpose, and never route to generic canonical Publish.

### 3.7 Documentation discrepancies and constraints

1. The original Info plan contains historical statements that the domain is absent, personal cards do not exist, faces are 157px tall, maths is deferred and zero attachments hide the pouch. Current code/handoff supports both purposes, maths, 240×204 faces, centred creator credit, sage personal surfaces and working empty-pouch creation. Use current implementation, not those old phase instructions.
2. Original consultation order was canonical attachment order. Current Personal Info implementation mixes canonical/local/inherited associations newest-attached-first. Preserve that chronology for existing personal behaviour.
3. Earlier plans assume private author-owned cards and publisher equals owner. Group scope deliberately extends those assumptions; unrelated personal notes must retain them.
4. Historical architecture sketches nest Cards under Decks; current `model.ts` and Phase 5 contract use first-class identity and global personal reuse.
5. Handoff verification/deployment statements are historical. Its new `users.cardsData.personalInfoCardIds` index was reported uninstalled in Atlas, and physical Safari acceptance remained outstanding. No live state was checked here.
6. The prompt's “five-item limit” is currently a display truncation, not an upload quota. Its `6.4` example differs from current integer aggregate display. Both require explicit treatment below.

## 4. Architectural decisions and alternatives

### 4.1 Ad hoc experience versus separate persistent Group

| Option | Complexity/reuse | Migration/performance | Recommendation |
| --- | --- | --- | --- |
| Persistent experience with its own membership and Deck | One aggregate with exactly V1's lifecycle. | Direct experience-scoped queries; future Group link does not rekey data. | **Choose.** “Ad hoc” describes creation, not ephemeral storage. |
| Group + experience now | Two identities, memberships and decisions about whether Group changes affect existing experiences. | Little performance advantage; pre-empts future reusable-group semantics. | Defer unless product already requires a roster independent of this Deck. |
| Reuse legacy sharing metadata | Superficially fewer records. | Wrong owner, no independent roles/retention/adoption/context; disabled API. | Reject. |

Future Groups/Organisations may relate to experience IDs and supply initial membership. Do not create inheritance rules, an organisation permission framework, names/settings screens or a privileged creator now. `createdByUserId` is attribution, not authority.

### 4.2 Contextual CardData storage

| Option | Complexity/reuse | Risk and performance |
| --- | --- | --- |
| Add optional experience fields to embedded user arrays | Small schema diff; preserves field shape. | Every existing template-only lookup/filter/map becomes dangerous. Group-owned records still need a home; aggregating across user documents is expensive; user documents grow with all contexts. |
| Move all personal/group CardData to a universal collection immediately | Uniform queries and unique compound keys. | Broad migration of the recently stabilised personal/fork/media/assessment feature and rollback surface. More work than V1 needs. |
| **Keep personal arrays; add experience Card/Deck state collections behind explicit context resolution** | Reuse payload validation, reconciliation, layouts and calculation functions, with two explicit storage branches. | Actual database uniqueness and efficient group queries; no personal-data migration for context isolation. Some adapter work, but contained and reviewable. |
| Duplicate canonical templates or fake an admin/group user | Can trick existing APIs temporarily. | Violates canonical identity, mixes roles/ownership, breaks adoption/history and introduces account lifecycle dependencies. Reject. |

Choose the third option. This is a narrow storage boundary for two known contexts, not a generic tenant platform. Existing personal endpoints remain personal-only. Group endpoints must require explicit experience scope and never default a missing scope to an admin's or follower's personal record.

### 4.3 Adoption authority

Choose experience-owned adoption selections. Alternative fan-out writes to every member's adopted version create O(followers × Cards) transactions and mixed versions after partial updates. Reading latest canonical versions automatically would violate deliberate Update acceptance.

Experience selection is authoritative; individual records retain values keyed by Step identity. Use `reconcileCardUpdate` for the same preserve-existing/default-new semantics in read projection and before mutations. Stored reconciliation metadata is not an independent adoption choice. Recommend explicit record initialization for newly assigned Cards (§10), so missing required rows are errors rather than an ambiguous lazy-default fallback. Existing-Card version updates still need no follower adoption fan-out.

### 4.4 Shared Info Card identity

| Option | Assessment |
| --- | --- |
| Copy one private card per recipient | Violates one logical object and live edits; reject. |
| Make all existing personal cards potentially shared | Breaks permanent personal-purpose privacy and existing historical-version/media access assumptions; reject. |
| Attach ordinary public/creator Info Cards to follower arrays | Conflates canonical publication, group audience and authorship; private root policy still fails. |
| **Add an experience-bound purpose to existing roots, with audience and recipient relations** | Reuses one identity/version/editor/media domain; explicitly distinguishes private personal legacy behaviour from group-scoped sharing. Choose. |

Self-only within an experience means not shared with peer followers; the prompt grants admins inspection/deletion of experience data. Whether this includes unpublished self-only drafts requires a decision, rather than silently weakening old personal privacy. No existing personal note is automatically converted or imported.

### 4.5 Media storage and aggregation

Embedding all group media in one GroupData document or duplicating follower uploads there creates growth, contention, ordering and deletion problems. Aggregating full embedded media arrays from every user on every opening is also unsuitable.

Use one media-contribution collection with context, source owner, uploader, timestamp and existing media payload for new experience data. Group media is the indexed union of group-owned and follower-owned rows, with no copy. Extend the existing viewer's data-source seam to consume paged group metadata while its personal adapter keeps existing source-history semantics.

**Personal-storage comparison:** retaining embedded personal media avoids a migration and preserves every existing owner/history reader, but leaves growing user documents and full metadata projections. Moving all personal media to the new collection removes that growth constraint, but requires coordinated changes to history, protected-media scans, deletion and old clients. Recommend retaining existing personal storage initially because it already accepts arbitrary item counts, removing the five-thumbnail rule, and bounding image/player rendering. Measure personal metadata size as well as group performance. If the agreed launch workload exceeds that storage/response envelope, promote the controlled metadata cutover in §5.4 into Phase 3 before launch. Do not disguise a practical storage limit as a new numerical product cap or claim that client pagination alone fixes database growth. No provider-byte migration is needed in either option.

## 5. Proposed data model

Names below are proposed engineering names, not new product terminology. Mongo remains the datastore; reuse `withMongoTransaction` and explicit setup/readiness patterns.

### 5.1 Identity contract

Every operation has separate actor and target:

| Context | Logical CardData key |
| --- | --- |
| Existing personal | `personal + userId + cardTemplateId` |
| Experience follower | `experienceId + ownerKind=user + ownerUserId + cardTemplateId` |
| Experience group-owned | `experienceId + ownerKind=group + ownerKey=experienceId + cardTemplateId` |

Owner keys are typed/discriminated, not encoded into a fake user ID. An opaque `cardDataId` identifies a new stored row but is not access authority. A request supplies experience/perspective; the server resolves and checks the row's exact tuple. Legacy personal lookup remains `(actor, template)` explicitly within the personal branch.

Client keys must additionally bind the authenticated viewer, because an admin and a follower may view the same data with different capabilities. Use a structured tuple, not ambiguous string concatenation. Keep canonical `cardTemplateId` separate from visual/membership instance IDs.

### 5.2 Entities and relationships

| Entity | Proposed fields and responsibilities |
| --- | --- |
| `groupExperiences` | Stable `experienceId`, immutable `deckTemplateId`, `createdByUserId`, timestamps, `adminUserIds`, `allowFollowerGroupInfoCards`, configuration/membership/adoption revisions, internal operation guard. Authoritative adopted Deck version and per-Card selections, retaining selections for Cards temporarily removed from composition. No signal mode, primary-admin role or restart counter. |
| `groupExperienceFollowers` | Unique `(experienceId,userId)`, `status: active/removed`, first joined/latest joined/removed timestamps, membership revision; persistent identity across rejoin. Admin status is independently derived from experience admin IDs. If full join/leave audit is required, add transition events after retention policy is agreed rather than an unbounded array. |
| `experienceCardData` | `cardDataId`, experience ID, typed owner, CardTemplate ID; existing completion/readings/reflection/target-date/test/chat semantics, revisions, timestamps; reflection `updatedByUserId` for group attribution. Media lives in contribution rows. No authoritative follower adoption pointer and no personal-history link outside this experience. |
| `experienceDeckData` | Unique `(experienceId, ownerKind, ownerKey)` for relevant group/follower Deck state: dates/cadence where applicable, timestamps. Viewer navigation may be kept separately/alongside follower state as below; adopted Deck version resolves from experience. Do not use `archivedAt` as removal. |
| `experienceViewerState` | Small per `(experienceId,viewerUserId)` active Card/openedAt record, including admin-only viewers. This avoids creating follower progress for an admin and prevents an admin inspecting a follower from overwriting that follower's navigation. Can be merged into a non-learning membership/view-state record in implementation. |
| `cardMediaContributions` | Stable contribution ID; context and CardTemplate/CardData source; owner kind/key; immutable uploader ID, server attachment/upload-completion timestamp; existing validated media payload; revision and deletion/receipt state as required. No binary data or aggregate copy. |
| Existing `infoCards` | New discriminated `kind: group` with immutable experience ID, origin CardTemplate, original author ID (retain legacy owner attribution), `management: author/admins`, mutable audience `self/group/selected`, audience revision, initial attachment date, deletion state and current group-audience publication grant boundary (§7.3). Canonical/private personal kinds retain current rules. |
| `groupInfoRecipients` | Unique `(experienceId,infoCardId,userId)` for selected audiences, with association date, publication grant boundary and revision/transition metadata. No content copies. Group-wide membership is resolved dynamically; no per-follower fan-out rows. |
| Existing `infoCardVersions`, `infoCardMediaAssets` | Same immutable content/receipt mechanism; exact publisher/uploader stored independently of original author for group purpose. Allocation provenance includes group scope and actual uploader. Keep old personal/creator invariants. |

An experience Info Card binds to one CardTemplate within one experience. A follower-created self/group card retains its originating follower CardData relationship; an admin-managed card uses the corresponding group CardData origin, with recipients as separate logical associations. A recipient's pouch resolves those associations without putting foreign-owned IDs into legacy `personalInfoCardIds` and pretending they are private owned notes. Admin-targeted content is still associated with recipient CardData logically, through the scoped relation. New members see group-wide references automatically.

Group-owned assessment fields reuse Card assessment shape and revision rules. Direct Item tests remain personal and separate. Chats have storage/history but disabled shared write routes; retain their shape and isolation without introducing a new chat feature.

For implementation, reuse a learning-fields type rather than forcing an experience row to satisfy the entire existing `CardData` interface. The legacy interface requires a positive personal adoption pointer and embeds media; the new persistence record has neither responsibility. A resolver can produce a transient existing-compatible calculation/layout input using the experience-selected version, scoped learning fields and requested media page. Never persist that derived adoption as another authoritative follower choice. Keep `initialCardData` and `reconcileCardUpdate` behaviour, extracting only the pure fields they need; retain the existing personal caller contracts.

Use per-Step/per-field revisions for completion, signal and reflection writes, the existing list-revision pattern for tests, and separate Info audience/content revisions. A whole-Card revision alone would unnecessarily conflict independent admin edits. Zero/absent defaults apply only to the documented revision fields, not to missing owner/context identities.

### 5.3 Indexes and integrity

Propose explicit indexes, verified on disposable databases before deployment:

- Unique `groupExperiences.experienceId`; nonunique `adminUserIds + experienceId` for admin discovery.
- Unique followers `(experienceId,userId)`; `(userId,status,experienceId)` for My Decks; `(experienceId,status,userId)` for active/removed lists.
- Unique experience CardData `(experienceId,ownerKind,ownerKey,cardTemplateId)` and unique `cardDataId`; additional `(experienceId,cardTemplateId,ownerKind,ownerKey)` if query plans require it.
- Unique experience DeckData `(experienceId,ownerKind,ownerKey)` and viewer state `(experienceId,viewerUserId)`.
- Media unique context/source/contribution identity; feed index `(experienceId,cardTemplateId,deletedAt,uploadedAt,contributionId)` with consistent sort direction. Add a personal-source index only if the optional personal metadata cutover is commissioned. Choose partial live-row indexes only after delete/receipt policy is fixed.
- Group Info roots `(experienceId,originCardTemplateId,kind,audience,attachedAt,infoCardId)` and author/management draft lookup; recipients unique `(experienceId,infoCardId,userId)` plus `(experienceId,userId,infoCardId)`.
- Retain existing Info root/version/sourceRevision/provenance indexes. Extend reference/deletion readiness to new relations; do not remove the existing personal-reference index.

Validate unique admin IDs, at least one admin, eligible users, owner-kind consistency, matching experience in every relation and immutable source fields. Mongo uniqueness does not enforce foreign keys: repository transactions must check them. Do not impose an arbitrary group/media count cap as a shortcut. Benchmark practical transaction/batch sizes and document operational limits separately from product limits.

### 5.4 Migration and compatibility

No migration of existing personal CardData identity is required. Existing missing context means personal **only at the explicit legacy storage boundary**; never at group API parsing. No rewrite of canonical versions, Step IDs, parked sharing metadata, fork history or personal Info roots.

New group data starts with real upload timestamps and needs no backfill. Recommended initial compatibility keeps existing personal media arrays intact. If scale evidence requires the personal media metadata cutover, use a separately reviewed idempotent migration: deterministic legacy source/item keys, copy records without changing asset IDs/URLs, verify counts and source identity, then atomically switch each source's storage marker and stop treating its embedded array as authoritative. Mixed deployment reads exactly one authoritative source, not an unchecked union; new mutations follow that marker. Never clear arrays before successful verification. Old media lacks accurate upload time: retain legacy order and mark timestamps unknown rather than inventing dates.

That optional cutover must include every existing personal reader, not just the gallery: `getPersonalUser` projections, `personalHistorySegments`/`readablePersonalHistory`, `personalCardHistoryDTO`, working projections, `personalMedia`/`removePersonalMedia`, `resolveAccessibleCardMedia` and `authorizeProtectedMedia`. Reuse retained source identity and keep removal visible through all personal forks. Without this complete adapter coverage, clearing embedded arrays would silently lose history or deny protected delivery.

Do not rerun the historic first-class Card migration or connect the normal Atlas-backed dev app for test writes. Rollback must preserve scope/purpose/media readers and authorization; an older build that ignores group kinds/fields is not automatically safe.

## 6. Data ownership and authorization

### 6.1 Permissions matrix

“Admin” here means current experience admin, never global `isAdmin` or template author. A dual-role user gets the union of capabilities **for the selected target**, not automatic authority to edit another follower's work.

| Target/action | Active follower, own perspective | Other active follower | Current admin | Removed follower with no admin role |
| --- | --- | --- | --- | --- |
| Group Card read | Yes | Yes | Yes | No |
| Group progress/signals/reflection/tests/direct media write | No | No | Yes | No |
| Own follower completion/signals/reflection/media/tests | Read/write | No full-Card access | Inspect/delete; no value editing unless own follower data | No experience access |
| Former follower full Card | No | No | Inspect/delete only | No |
| Retained media/reflection feed | Read eligible contribution projection | Same | Read/moderate | No |
| Follower-created self Info | Author read/edit/delete | No | Read saved contribution/delete; draft scope Q3 | No |
| Follower-created group Info | Author edit/delete; sharing transition policy applies | Read | Read/delete; no editing another follower's content | No |
| Admin-managed selected Info | Selected recipient reads, no edit/delete | Only if selected | All admins manage; original attribution retained | No |
| Admin-managed group Info | Read | Read | All admins manage | No |
| Membership/admin/settings/update adoption | No | No | Yes, final-admin guard | No |
| Unrelated personal/another experience | Existing own-personal permissions only | No new grant | No new grant | Existing own-personal permissions only |

If a removed follower is still an admin, they retain **admin** access and no longer contribute to active follower metrics. This follows independent roles; removing the follower role must not implicitly remove admin authority. UI wording must make that distinction clear without inventing another role.

### 6.2 Server checks and concurrency

Every read, list page, download, status request, draft read, save and exact-version media request reauthorizes its scope. IDs, URL parameters, headers and capability flags are untrusted selectors. Authorize before projecting names, counts, private source metadata or errors. Use the session actor, verify the initiating actor header, and echo context/revisions in responses.

For commands, use current-role checks and a transaction write conflict with membership/settings/adoption changes. A read-only membership check inside a transaction alone does not serialize revocation. The simplest initial protocol is a narrow experience operation guard touched by group commands, with expected membership/adoption revisions and row/field CAS. Membership removal, role changes and adoption touch the same guard. This can become a write hotspot, so benchmark it; optimise into proven narrower member/pin guards only if needed, retaining deterministic race tests. Do not call providers inside transaction retries.

Last-admin removal is a single guarded experience update requiring the resulting unique admin set to remain nonempty. Two admins concurrently removing themselves must not both succeed. No privileged creator is technically required. Account deletion/recovery when the last admin disappears is a separate lifecycle decision (Q9).

### 6.3 Deletion scope and unresolved meaning

| Data | Existing operation / proposed group treatment |
| --- | --- |
| Media | Existing removal unlinks stored item, with no eager provider deletion. Group moderation deletes/tombstones only the scoped contribution; no removal of another context's references or shared underlying asset. |
| Reflection | Stored scalar text; delete means clear that scoped field, subject to expected revision. Preserve attribution/audit metadata according to retention policy. |
| Completion | Stored Step status; deleting a value would yield existing `todo` default. Whether admins may perform this reset needs explicit confirmation of deletion UX/semantics. |
| Confidence | Stored Step reading; deleting a value yields unset/null, not zero. Same confirmation as above. |
| Tests | Delete exact source/test ID with list CAS; preserve unrelated tests and retry-no-resurrection rules. No authority over direct personal Item tests. |
| Chats | Delete exact scoped comment/contribution if present; no new chat creation workflow. Do not delete unrelated source history. |
| Info Card | Personal Remove currently detaches only; global root deletion is blocked by references. Group delete needs a deliberate experience-local tombstone/removal operation across its audiences, serialized against Save/recipient changes. Do not bypass canonical/personal reference guards or delete an unrelated root. |
| Target dates/navigation/membership | Operational state, not automatically follower “contributions.” Do not expose arbitrary admin value edits or a whole-CardData delete endpoint. |

The requirement to allow deletion is confirmed; precise reset, recovery, visibility and physical-retention semantics are not. Q4 must be answered before moderation commands/UI are implemented. A deleted shared Info Card disappears for all its recipients; removing a recipient only revokes that association. A removed follower's preserved contribution must not be resurrected by a delayed upload/Save retry.

## 7. Data flows and APIs

Route names below are proposals. Reuse existing route-handler/auth/transport conventions, not a second API stack. Keep old `/api/decks-data` and `/api/cards-data` commands explicitly personal. Group endpoints carry experience and target perspective; shared Info endpoints dispatch by immutable root purpose and validate supplied scope.

| Operation | Proposed boundary | Contract |
| --- | --- | --- |
| Create | `POST /api/group-experiences` | Stable caller request/experience ID, eligible Deck and exact initial selections, follower IDs; server validates all users/content, creator becomes admin, follower set explicit. Atomic publication of a usable experience; idempotent retry. |
| Discovery | Extend My Decks membership DTO with discriminated personal/experience entries | Active assignment plus admin access discovery, using instance identity. No implicit ordinary personal membership. Admin-only placement needs Q7. |
| Experience read/open | `GET /api/group-experiences/:id`, explicit open command | Roles/settings/adoption and group summary; normal reads do not initialize data. Open persists only that viewer's navigation/openedAt/date contract. |
| Roster | `GET/POST/PATCH .../:id/followers`; admin changes on experience | Active/removed paginated lists, add/remove/rejoin with expected revision; admin-only inspection list. |
| Perspective read | `GET .../:id/cards/:cardId?perspective=group/self/follower&subject=...` | Server authorizes subject, selects experience-pinned template, returns minimal scoped Card DTO/capabilities. Never entire users. |
| Scoped mutation | `PATCH .../:id/cards/:cardId` with discriminated operation/target | Own follower or group admin target; expected state/adoption/membership revision. Return authoritative changed field/revision. |
| Aggregates | `GET .../:id/summary`, `GET .../:id/cards/:cardId/summary` | Active follower totals, existing completion/confidence semantics; independent group-owned values; coherent revisions. |
| Contributions | Paged `.../media`, `.../reflections` | Safe attribution/projection across retained contributions; current viewer authorization on every page. |
| Media allocation/commit/delivery | Scoped extension of existing upload/media adapters | Proof binds actor, experience, source owner/Card and asset; commit reauthorizes; delivery resolves stored source rather than trusting asset URL. |
| Info create/Save/audience | Existing Info repository/editor plus scoped create and audience command | One root, private immutable versions, first attachment atomic, management capability, dynamic group visibility or selected recipient relations. |
| Adoption | Experience `.../update` review/accept by Card or Deck | Exact reviewed source/target and adoption revision; admin-only; single experience authority update. |
| Moderation | Narrow scoped delete actions | Field/contribution identity, expected revision and current admin grant; no general overwrite of follower data. |

### 7.1 Creation, assignment and rejoin

Validate registered-user IDs without returning their contact data. `/api/users` currently lists all usernames/IDs without pagination; its existence is a reuse opportunity, not approval for unrestricted discovery in a minors-facing group feature. Apply Q2 before extending it.

Creation records one exact initial template selection, group-owned defaults, persistent follower membership and independent follower state. For ordinary initial group sizes, one transaction with sequential writes is simplest. If measured creation volume exceeds a practical transaction envelope, use a private provisioning state with idempotent batches and final activation; never show partly initialized assignments as usable. Do not impose a numerical follower cap merely to avoid this analysis.

Assignment appears automatically because My Decks queries active follower relationships. It does not call `addLibraryDeck`, share existing personal CardData or overwrite an independently followed copy. The same user can see personal Deck X, experience A/X and experience B/X as distinct instances.

Add creates missing independent state at experience-selected versions. Remove changes follower membership only, revokes follower grants, removes the follower assignment and invalidates aggregates; retain contributions and rows. If the same person remains an admin, independent admin access remains as specified in §6.1. Rejoin activates the same membership and restores state, reconciled against current experience selections. New joins get dynamic group-wide Info visibility; selected targeting follows retained-recipient policy Q5.

### 7.2 Personal and group updates

Capture full target context when interaction begins. Optimistically update only that target; persist through its scoped command. On success merge returned field revision and invalidate the relevant group summary/contribution page. A failed write restores only its own last confirmed field if no newer operation supersedes it. Do not roll back a whole Card snapshot over another admin's work.

Group progress, signals, reflection and tests use the same field semantics but CAS for shared writes. Different fields can succeed independently; conflicting same-field edits retain the rejected user's intent for refresh/retry. A local Update barrier cannot wait for other users' tabs: the server must reject or safely reconcile stale-version commands.

### 7.3 Info Card flows

Create one draft with immutable group/origin/author/management identity. First usable Save validates the current context, audience permission and content, commits one private immutable version plus logical association/recipients in one transaction, and returns its exact receipt. Autosave preserves incomplete drafts without publishing or sharing them. No fan-out copies.

Follower self → group requires current active follower membership and enabled setting at the commit, not just at editor opening. Group → self is allowed for the active author even when the setting is disabled. Existing group-wide content remains editable when disabled. Recipient management is an admin command; followers cannot submit selected recipients. For follower-authored cards, admin recipients management must not create an unapproved subset-sharing route (Q5).

Content revisions and audience revisions are separate. New publication updates all entitled recipients on their next authorised pouch read; open snapshots retain exact publication identity under existing behaviour. Audience revocation/deletion must immediately affect fresh API/media grants even if an older snapshot exists. Already-delivered text and bearer URLs cannot be recalled; do not promise otherwise.

**Historical private-version protection:** a current audience grant must not automatically disclose every previous immutable version. Recommend recording the first readable publication for each current group/recipient grant. Sharing a self-only card at v3 makes v3 and subsequent publications readable under that grant, not previously private v1/v2. Adding a selected recipient starts at the currently shared version; removing/re-adding that recipient creates a new grant boundary. Group → self revokes the group grant; sharing again starts at the newly shared current version. Retaining an authorised exact publication in an open pouch is allowed only while the relevant grant remains current and covers that version. Authors/current authorised admin editors use their separately defined content-management permissions. This extends existing private-era protection; it does not create a historical browsing UI.

Audience changes operate on the saved publication, not on incomplete autosaved draft content. First Save plus initial audience may be atomic; changing an existing saved card's audience must state which saved version is being shared and CAS its content/audience revisions. Do not store only a mutable visibility boolean and then authorize all old media using it. Q5 includes approval of this transition contract, with exact-version negative tests before release.

The existing owner-only My Drafts recovery should remain the starting point: an authorised author can reopen unfinished group work only in its group context; a removed member cannot use a direct editor URL as a back door. Current admins can manage admin-authored saved cards through group permissions. Whether another admin can discover unfinished drafts created by a fellow admin is part of Q3, not an automatic consequence of shared saved-content management.

Keep attachment timestamps stable on content edits. New selected-recipient links receive association dates. Recommendation: group-wide cards use their group-wide attachment date for all members, including later joiners, rather than all cards becoming “new” on joining. Switching audiences/reattachment chronology needs Q5. Reuse opaque unavailable entries without revealing revoked/private content.

### 7.4 Errors and caches

Responses include viewer, experience, perspective/subject, adoption revision and relevant data revision. Reject late responses after session, experience or perspective changes. Cache keys and request generations include all those identities. `private, no-store` and `Vary: Cookie` apply to group reads, including errors and file/status routes. No persistent shared content cache is needed initially.

Refresh aggregates after acknowledged own/admin mutations, membership/recipient changes and adoption; refresh on experience entry/perspective switch/tab focus. Cross-device freshness has no approved interval or realtime requirement: Q11 determines whether visibility-bound polling is needed. Do not describe local invalidation as realtime synchronization.

## 8. Frontend architecture

### 8.1 My Decks and navigation identity

Introduce a discriminated working membership identity, e.g. personal Deck instance versus experience ID. Keep canonical Deck ID separately for content. Update collection keys, selected-entry lookup, deep-link parsing, return/highlight identity and recency state in `AppShell`, `DeckGrid`, `DeckTile` and `myDecksLayout`. Preserve ordinary personal recency sorting. Removed experience membership must not expose a personal Restore action; the personal archive action must not silently mean leave group.

A follower can have two experience perspectives; an admin can additionally select authorised active/removed followers. Use **one session-local active CardTemplate selection** shared by perspective rendering. It is not a classroom-wide live navigation broadcast and is not the inspected follower's saved navigation. Preserve selection across perspective changes; reconcile against the new Deck composition on adoption using the existing retained/first/null rule.

### 8.2 Reuse and extension boundaries

| Existing component/module | Proposed use |
| --- | --- |
| `DeckScene`, Card stack and motion/gesture modules | Reuse physical scene and navigation. Add controlled active-selection/perspective input only where required. Do not instantiate an independent scene/controller per follower. |
| `FocusedCardView`, `StepView`, Card layouts | Same front/back/step/pouch composition. Supply context-aware capabilities, mutation adapters and aggregate slots. |
| `DeckDetail`, `useWorkingDeck` | Preserve personal adapter. Extract narrow transport/identity seams for group adapter; no blanket `canMutate=true` or actor=subject fallback. |
| `CardSemanticAnchors`, progress controls, Deck header | Group value plus completed/active count immediately right at Step/Card/Deck levels. Exact geometry still needs UX. |
| `FocusedSignalRow`, `PulseFieldSignal` | Existing drag mechanics for group-own editable value; labelled follower average beside it. Inspected followers/group-for-followers are read-only. |
| `BackCardReflectionFragment` | Same fragment position; inject attributed carousel content/advance handling. Resolve separate edit activation before wiring. |
| Media uploader/viewer/player/download components | Scoped target and paged collection adapters; retain selected-only full media/player lifecycle. |
| Info editor/controller/consultation/pouch/face | Add author/management/audience/capabilities; keep one pouch and current pinned-publication/selection/maths/gesture contracts. |
| `useWorkingUpdates` | Reuse review, exact-command recovery, pending-work and Refresh/Cancel interaction with experience authority; group perspective/admin only. |
| Assessment controls/history | Scope sources, caches and commands; permit group-admin tests and follower-own tests; inspection is read-only except approved deletion. |

Admin inspection needs capability distinctions for read, mutate-own, mutate-group, moderate and manage-Info. A single ownership boolean cannot express them. Omit callbacks as well as controls for disallowed actions; server checks remain mandatory. Creator Mode is absent from all group entry points, including when viewer owns templates. Existing Library authoring remains available outside this context.

### 8.3 Continuity and rendering budget

Keep the main physical Card container stable while changing perspective data. Bind reflection drafts, signal previews, uploads, assessment state and Info operations to their original context; same template ID does not imply the same editor. Flush or retain pending edits safely at an approved perspective transition boundary, without transplanting them. A stable outer Card does not require sharing its inner mutable state.

Miniatures receive lightweight summaries for the current Card, not full working Decks, private notes or media arrays. Fetch a selected follower's detail only after admin authorization. Paginate/virtualize the roster when necessary; only visible thumbnails should prepare images. Reuse common immutable template content, but keep private media grants actor/context-bound. Do not mount a video player or rotating-reflection timer in every miniature.

Preserve Info opening suspension, native dialog focus, mounted Step/activity state and no automatic playback resume. Perspective changes during a pouch/editor/media session require explicit safe lifecycle treatment, not reusing the old publication snapshot for the new target. Exact visual switching geometry/motion remains provisional.

## 9. Media and aggregation architecture

### 9.1 Completion and confidence

Read active membership and experience selections in one snapshot, then fetch projected scalar state for those followers and required Cards. Fetch no media, notes, chats or full assessment history to calculate totals. Count dual-role admins only through their active follower membership.

- Step completed count: apply the existing `getProgressPercentage` to that Step's status and count results equal to 100. This means skipped is treated consistently with the existing all-skipped completion rule; do not substitute `status === done` without explicitly changing the confirmed “same algorithm” requirement.
- Card completed count: call the same function for its three current adopted Steps and count 100 results.
- Deck completed count: flatten each follower's current Deck Steps and use the same function, including existing rounding. Do not count by average displayed Card percentage. Empty Deck gives null/no completed result. Zero active followers gives denominator zero, with the exact empty label left to UX.
- Denominator is active followers, not “followers who have opened the Deck.” Explicitly initialized/default assignment state counts as unfinished; missing/corrupt required data is an incomplete calculation, not silently another zero or a smaller denominator.
- Confidence uses valid raw 1–10 readings for the current Step across active followers; exclude null/invalid values, include set readings on skipped Steps. Return sample count and raw mean as well as existing rounded display value so Q6 does not require storage changes. Never average rounded averages. Group confidence remains its independently editable raw value.

Retain obsolete Step entries for possible return but exclude them from current calculations. Do not store all derived aggregates in GroupData. First implementation can compute from indexed scalar projections; only introduce materialized summaries if measured latency requires them, with an independently reviewed consistency protocol.

### 9.2 Media query and delivery

For a Card feed, query live contributions by `(experienceId,cardTemplateId)` across group-owned rows and all ever-valid follower sources, including removed followers. Do **not** filter the feed by active membership; do filter the requesting viewer by current access. Verify contribution source membership/provenance at creation, not from a caller's uploader field. Return uploader name through existing username projection, source kind, upload timestamp, opaque stable contribution key and permitted actions; avoid exposing the rest of that follower's CardData.

Use keyset pagination on timestamp plus stable ID. Direction (oldest/newest first) is Q10; the required timestamp ordering itself is confirmed. A page boundary is a transport size, not a stored-item cap. Return a cursor bound to experience/Card/filter/direction; reject foreign or stale-scope cursors. Deletion between pages must not substitute an unrelated item; deduplicate stable IDs on the client. New uploads can refresh the head without resetting an already-selected media item. Cursor stability does not require a long-lived database transaction.

Fetch thumbnails only for visible items; selected image/video obtains its own scoped read/grant. Adapt viewer next/previous to request another metadata page at a boundary instead of assuming the entire array is resident. Do not fetch every follower's media array or prepare full-resolution neighbours. Preserve image zoom/pan, video pause/release, focus return, Stream explicit download preparation, Safari file-sharing fallback and existing per-file resource limits. Removing an item must choose a surviving neighbour and invalidate its scoped grant caches.

Remove the fixed thumbnail `slice(0,5)` rule in accordance with the prompt. The existing gallery already reaches later items; this is a thumbnail presentation change, not a claim that the current gallery loses them. The exact replacement (incremental rail/window or another approved treatment within the existing media area) needs UX; simply rendering an unlimited thumbnail list would be a performance regression. No new numerical item cap replaces five. Existing file-size/video-duration limits are a different concern and are not implicitly removed.

### 9.3 Reflections

Read one group reflection with last editor attribution, plus nonempty follower reflections from both active and former followers. Use lean projection and page if necessary. Keep the group item independently available so its approved prominence is not lost because it falls on another page. Uploader and reflection author must not be inferred from template ownership.

A small carousel controller inside the current reflection slot handles stable IDs, continuous cycling, timer, tap advance and gentle opacity transitions. Pause timers when hidden/unmounted or while relevant editing/overlays require it; honour reduced-motion/accessibility requirements in UX design. Do not move the area, add a dashboard or automatically open an editor when tapping to advance. Group prominence, interval, edit activation and attribution after several admins edit remain Q8. No reflection snapshot copies are needed merely because a follower leaves; the preserved source scalar remains the contribution.

### 9.4 Scale and freshness

Query costs should scale with active scalar contributors for metrics, the requested roster page for inspection, and the requested contribution page for media/reflections. Avoid N HTTP calls per follower and per-thumbnail status polling across the complete collection. Batch usernames and template versions; share immutable content, not authority.

Measure representative follower/Card/media volumes in disposable fixtures before committing to numeric latency targets (Q11). Check Mongo explain plans, payload size, transaction conflicts, player count, image/network requests, phone memory and render commits. The coarse operation guard is a known concurrency tradeoff; results determine whether narrower proven guards are necessary. No websockets, Redis or background aggregate service is justified solely by this draft.

## 10. Versioning and lifecycle

### 10.1 Initial selections and updates

At creation, select exact authorised published Deck/Card versions and store the resulting experience adoption. Recommend matching ordinary new entry: chosen/current published Deck and latest eligible published Card versions, not blindly `cardVersionAtPublish`; confirm initial selection expectations under Q1. Recheck publication freshness transactionally rather than silently accepting a changed preview.

Card Update reviews chronological eligible update notes and pins source/target/adoption revision. Only an admin can accept; only group perspective shows Update. Accept advances that experience's Card selection once. All active and former follower projections thereafter use it; group data and followers retain stable-Step values, reflection, dates, tests, media and Info relationships. No reset based on changed descriptions or Step positions.

Deck Update changes the experience composition while retaining selections for existing Cards. New Card identities receive reviewed initial selections; previously removed/reintroduced Cards reuse the experience's retained selection/state rather than restarting. Keep removed CardData and its contributions. Access to Cards removed from current composition is Q12; preservation does not itself authorize a new browsing interface.

For scalable adoption, avoid rewriting all follower records when an **existing Card** advances version. The selection map is the atomic boundary. Derive new-Step defaults from `reconcileCardUpdate`; materialize missing Step entries only on a scoped write/open as appropriate, retaining all previously stored IDs and values.

For **new Card identities** introduced by Deck Update, recommend initializing group-owned and active-follower CardData in the same transaction that exposes the new composition. This costs O(active followers × newly introduced Cards), not a rewrite of every Card's learning history. Unique upserts preserve any retained rows from earlier composition. Creation/add/rejoin similarly initialize missing rows before the assignment is active. A removed follower needs no artificial contribution on a Card introduced after departure; rejoin initializes only those missing records, and admin inspection must distinguish “not assigned while a follower” from lost preserved data. Q12 covers that presentation.

This explicit-record approach is simpler than distinguishing intentional lazy absence from accidental missing storage. If Q11 measurements show that new-Card initialization exceeds practical transaction limits, review a narrowly scoped staged provisioning/activation protocol before implementation: prepare rows while the old composition remains authoritative, serialize membership changes with the pending adoption, and activate the new selection only after completeness verification. A generic background job platform or silently defaulting every missing row is not part of the recommendation.

Preserve active Card when still in composition, otherwise first remaining/null; viewer navigation applies this at refresh/open without changing another viewer's state. Follow current first-open cadence semantics only after Q7 resolves experience scheduling. Template publication by an admin outside the experience must not auto-adopt group data: existing publisher updates target only ordinary personal records.

### 10.2 Concurrent adoption and learning

Adoption checks exact reviewed target and current admin grant, locks selected canonical roots in stable order using existing guard patterns, and updates the experience guard/selection atomically. Competing updates return already-adopted/superseded/conflict outcomes without replaying initialization or resetting data. A newer publication before acceptance requires Refresh/Cancel, not silent retargeting.

Mutation requests carry displayed version/adoption revision. If adoption wins first, reject a stale Step command and retain local intent for refresh; do not write a position into a different Step. If the mutation wins, adoption preserves its stable-ID value. Upload attachment rechecks membership and target identity after provider completion. Unknown outcomes retry the same operation identity; confirmed writes followed by refresh failure retry reads only.

### 10.3 Removal, retention and revocation

Follower removal never deletes learning state or shared contributions. Current access requires active follower or admin status; retained CardData/root ownership alone is not sufficient for group reads/edits, unlike existing standalone personal history. Apply this to old direct URLs, My Drafts, exact publications, image proxies, status and download endpoints too.

Rejoining restores prior state under current selections. Existing group-wide Info cards automatically become visible. Selected-recipient retention and notes created by people whose roles later change follow Q5. Changing sharing settings does not retract existing group-wide cards.

Experience deletion, account deletion, last-admin loss and physical media retention are not specified. Do not add destructive cascades. Preserve experience-local moderation independently from eventual storage cleanup. Already-issued signed URLs/downloaded files cannot be instantaneously revoked; review that limitation for the intended audience before rollout.

## 11. Phased implementation plan

These phases are proposed commissions, **not executed work**. Dependencies are explicit; a phase is not accepted merely because later phases are planned. All operational/live-index/provider changes require their own authorised implementation/deployment scope.

### Phase 0 — Resolve contracts and establish regression fixtures

- **Purpose:** settle decisions that change authorization/data meaning before coding those contracts.
- **Files likely affected later:** this plan's accepted successor, focused fixtures in existing `tests/` and `scripts/test-phase2.ts`; no application behaviour change required for design review.
- **Dependencies/work:** Q1–Q5 policy decisions, Q7 navigation/scheduling, expected scale. Specify typed context/capabilities, deletion commands and exact adoption/initialization contract. Prepare personal + two experiences + several roles + one removed user sharing the same template.
- **Acceptance:** written approved contracts distinguish actor/owner/author, public/private eligibility, retained access and per-field delete meaning. Confirm one-run semantics and no extra Group management feature.
- **Automated tests required during implementation:** existing personal reuse/history/Info/adoption baseline selections; fixture checks that personal and group identities cannot alias.
- **Manual verification:** product/security review of permissions and intended UX boundaries; no requirement to manually reproduce deterministic storage cases.
- **Risks/blockers:** unanswered privacy/deletion/template-eligibility decisions. Do not resolve them by introducing accidental defaults in schema or UI.

### Phase 1 — Experience identity, roles and contextual storage

- **Purpose:** establish isolated records and transactional membership/role invariants.
- **Files:** proposed `src/lib/groupExperiences/{model,repository,authorization}.ts`, narrow extensions of `src/lib/cards/{model,domain,http}.ts`, explicit setup script, group API routes, focused integration tests.
- **Dependencies/work:** Phase 0 identity/eligibility decisions. Implement unique indexes, stable create retries, exact selection validation, independent roles, assignment, removal/rejoin and last-admin protection. Reuse existing payload validators/defaults. Do not expose group UI before authority is complete.
- **Acceptance:** same template personal/A/B has three independent follower states; group data belongs to experience; failed creation has no half-visible membership; remove/rejoin preserves rows; concurrent final-admin removals cannot orphan experience.
- **Automated:** disposable replica-set transaction rollback, duplicate creation/joins, add/remove races, actor mismatch, forged owner/context, cross-group denial, malformed/duplicate stored data, index idempotence/readiness.
- **Manual:** inspect authorised fixture responses/roles; no live DB setup.
- **Risks/blockers:** creation transaction scale and eligibility; no synthetic user or personal-array fallback.

### Phase 2 — Scoped learning, adoption and aggregation APIs

- **Purpose:** make all group/follower data operations correct before presentation.
- **Files:** group repositories/read models/API routes; `cards/updateAdoption.ts`, progress/signals helpers, assessment contracts/repository/history adapters; scoped data transport.
- **Dependencies/work:** Phase 1. Add own-follower/group-admin writes, read-only admin inspection, selected moderation commands after Q4, shared version selection, stable-Step reconciliation, active-only completion/confidence, retained former-data reads and efficient scalar projections. Initialize newly assigned Card records explicitly; use scale evidence to determine whether a separate staged activation design is necessary.
- **Acceptance:** shared selection across every perspective; other experiences/personal adoption unchanged; no admin modification of follower values; aggregates use existing formulas and exclude removed members; missing state is never silently counted as zero.
- **Automated:** stable/new/removed/reintroduced Steps, empty/all-skipped/mixed completion, raw confidence/null/rounding, admin-as-follower, stale publications, concurrent adoption/membership/scalar writes, rollback and already/superseded outcomes, removed inspection, assessment CAS/no resurrection.
- **Manual:** compare known fixture metrics with personal calculations; review exact update notes/outcomes.
- **Risks/blockers:** Q1 private versions, Q4 deletion, Q6 numeric presentation, initialization scale. No UI update buttons yet.

### Phase 3 — Unlimited, attributed, paginated media

- **Purpose:** support retained group contributions efficiently and replace the fixed five-thumbnail presentation rule while preserving unlimited item count.
- **Files:** proposed contribution repository/indexes; `cards/media.ts`, `uploadAuthorization.ts`, `mediaProviders.ts`, `cardMediaAccess.ts`, `protectedMedia.ts`; existing upload/status/file/download routes and adapters; media viewer/upload components and `BackCardMediaCarousel`. A personal metadata migration is conditional on the measured launch workload, not a default prerequisite.
- **Dependencies/work:** Phases 1–2 scope/retention, Q10 media ordering/presentation and privacy decision. Add server attribution/time, allocation proofs, scoped commit/status/delivery, paged group metadata queries, stable deletion, selected-only resources. Preserve existing personal source/history storage through the common viewer seam; perform the §5.4 cutover only if capacity evidence requires it. No asset-byte changes.
- **Acceptance:** sixth and later personal/group items remain reachable; no count cap; former follower uploads remain visible; removed viewer cannot obtain fresh grants; cross-context asset transplantation fails; legacy personal/fork media still works.
- **Automated:** personal source/order/reference compatibility; cursor ties/page removal/new-upload races; upload-after-removal denial; duplicate commit/no resurrection; uploader ownership/asset-proof forgery; exact media/image/video/download/status boundaries; large-list request/player/image bounds. If commissioned, also verify migration idempotence/counts/markers and every legacy reader identified in §5.4.
- **Manual:** real iPhone upload/view/zoom/video/download/share/cancel and live provider CORS/protection only in an authorised environment; record what mocks do not prove.
- **Risks/blockers:** provider-origin confidentiality, unknown legacy timestamps, compatibility rollback and approved infinite-list presentation. No broad unrelated asset-cleanup project.

### Phase 4 — Shared Info Cards within the existing feature

- **Purpose:** one shared identity with correct audience/management, preserving personal privacy.
- **Files:** `infoCards/{model,repository,queries,media,mediaRegistry}.ts`, new recipient relation/indexes, existing Info routes, `InfoCardEditor`, controller, consultation client/dialog/pouch/menu, My Drafts recovery/loader, working-store association handling.
- **Dependencies/work:** Phases 1–2 authority, Phase 3 provenance principles, Q3–Q5. Add group purpose and audience, first Save atomicity, recipient CAS, sharing-setting transitions, admin-managed multi-editor content and independent uploader identity; no canonical attachment of group IDs. Extend the same snapshot resolver with scoped sources/capabilities.
- **Acceptance:** five recipients resolve one root/version; editing updates all fresh views; group-wide cards include new members; targeted cards stay private to recipients/admins; followers cannot alter admin-created cards; setting disable preserves existing shares and author edits; old private personal/creator paths unchanged.
- **Automated:** full role/audience matrix, another admin publisher validation, media uploaded by different admins, recipient remove/read/download races, private-era version denial after sharing/regrant, removed-author access denial, disabled-setting transition races, Save/delete/recipient transaction interleavings, exact receipt retries, no duplicate attachment/redating, catalogue/series leakage, existing personal inheritance and pouch selection regressions.
- **Manual:** reuse of embedded editor/pouch on phone, recipient/audience affordances after design, attribution and focus with maths/media.
- **Risks/blockers:** self-only draft visibility, Remove versus Delete, recipient chronology, former-author/demotion policy. No weakening of legacy purpose checks.

### Phase 5 — My Decks and synchronized perspective presentation

- **Purpose:** expose the feature through existing physical Card interactions.
- **Files:** `AppShell`, `DeckGrid`, `DeckTile`, `myDecksLayout`, `DeckDetail`/new group adapter, `DeckScene`, `FocusedCardView`, `StepView`, presentation/types/layouts, working store/work barriers/queues, assessment UI and update client.
- **Dependencies/work:** Phases 1–4 and approved layout/navigation/creation design. Distinct instance entries/deep links, one active Card position, independent perspective state, correct capability callbacks, group-only admin Update, removed-follower section, lightweight roster summaries.
- **Acceptance:** personal and multiple assigned instances coexist; removal hides only the experience assignment; group defaults for admins; follower sees own/group only; no Creator Mode or follower Update; pending operations remain tied to original scope; inactive miniatures do not mount full media pipelines.
- **Automated:** identity/cache/queue collisions, account and perspective switch with reversed responses, optimistic rollback after newer writes, deep-link replay, member removal while open, adoption with selected Card removed, admin-only versus dual-role navigation, no full-follower-data payload to followers, DOM/activity/player continuity and network/render budgets.
- **Manual:** desktop miniature selection, mobile switching, existing front/back/step gestures, target sizes and physical continuity on the approved design.
- **Risks/blockers:** Q7 creation/admin discovery/date/archive choices and detailed UX. Avoid expanding `DeckScene` into an administration state machine.

### Phase 6 — Aggregate presentation and reflection carousel

- **Purpose:** place approved summaries and contributions on the same Card.
- **Files:** progress/semantic anchors/Deck header, `BackCardFaceContent`, signal row, reflection fragment/controller, contribution query adapters, group presentation styles/tests.
- **Dependencies/work:** Phases 2, 3 and 5; Q6, Q8, Q10, Q11. Place completion counts immediately right, show both confidence values, render timestamp-ordered attributed media, cycle group/follower reflections with gentle fade in the current slot.
- **Acceptance:** group values are editable only by admins; follower aggregates remain distinct; removed followers excluded from metrics but retained in contributions; group reflection prominence and continuous/tap cycling meet agreed design; no new dashboard/modal/expanding reflection surface.
- **Automated:** all three completion levels, null versus zero and no-signal display, timers/visibility/reduced-motion behaviour, group prominence sequence, removed author attribution, tap gesture isolation, no duplicate carousel timers, bounded page loading and stale aggregate generations.
- **Manual:** readable labels/attribution, calm fade/timing, editing affordance, VoiceOver/keyboard and phone safe-area/orientation checks.
- **Risks/blockers:** cramped existing geometry, current tap-to-edit conflict, numeric precision and freshness SLA. Do not silently change Card dimensions to fit.

### Phase 7 — Integrated verification and rollout readiness

- **Purpose:** verify isolation, retention and compatibility across the completed flows.
- **Files:** targeted existing/new integration/browser tests and implementation handoff; only justified in-scope fixes.
- **Dependencies/work:** all prior phases, resolved launch-critical policy questions, provider/index deployment plan. Run relevant regression selection, typecheck, scoped lint and standard build; inspect diff, migrations and compatibility rollback. Record actual evidence and remaining device/provider checks.
- **Acceptance:** no known cross-context leak, lost data or invalid version mixture; required indexes/migration verified on disposable data; exact operational steps and rollback documented; approved manual UX evidence recorded before rollout.
- **Automated:** full multi-actor journey across two experiences plus personal reuse, race matrix, large collection budgets and existing personal/Info/media/adoption suites (§12).
- **Manual:** physical iPhone Safari/VoiceOver, actual authorized provider delivery and product acceptance. Chromium touch emulation is not Safari proof.
- **Risks/blockers:** unmet safeguarding/private-delivery decisions, unverified migration/rollback, no-admin account lifecycle, unresolved severe performance results. No commit/deploy/live setup implied by this plan.

## 12. Regression and test strategy

Use the existing disposable `mongodb-memory-server` replica-set and authenticated Next runner (`scripts/test-phase2.ts`). Normal development is documented as production Atlas-backed; never use it to seed tests. Existing scripts may write generated output or connect to a database, so none were run during this planning task.

| Existing suite/family | Required protection or extension |
| --- | --- |
| `personal-lifecycle.integration.ts`, `card-reuse.integration.ts`, `card-foundation.integration.ts` | Same personal Card across Decks still shares state; archive/restore/entry retains fields and versions; experience assignment never changes it. |
| `card-forks*.ts`, `personal-history-projection.test.ts`, `personal-info-cards.integration.ts` | Live same-owner X → Y → Z source history and dates preserved; group contexts never traverse into it; no canonical lineage grants. |
| `update-adoption*.ts`, `working-updates.test.ts` | Existing global personal adoption unchanged; new group adoption scoped/shared, stale review and pending-work recovery safe. |
| `assessments*.ts`, `assessment-history*.ts`, framework/progress suites | Tests source/CAS and retry rules; current Steps only; account-wide framework behaviour not accidentally widened/deduplicated across contexts. |
| `info-cards*.ts`, `info-card-attachments.integration.ts`, `info-card-consultation-client.test.ts` | Legacy purpose privacy/publication guards, canonical attachment dates, unknown kinds fail closed, exact snapshots and unavailable positions, group recipients/management. |
| `info-card-editor.test.ts`, `info-card-upload.test.ts`, personal/shared Info browser suites | Autosave/receipt/Cancel, recoverable drafts, embedded authoring, maths, same-pouch selection, original-author credit after another admin edits. |
| `card-media-access.integration.ts`, `protected-media.integration.ts`, `personal-media-mutations.test.ts` | Group grants do not broaden existing own-only access; exact stored references, legacy-route bypass denial and original-source deletion. |
| `card-media-viewer.spec.ts`, upload-controller/panel tests, `ios-video-share.spec.ts` | Beyond-five navigation, incremental collections, selection after removal, original mobile playback/download/share behaviour. |
| `signal-confidence.spec.ts`, signal gesture/rollback tests, presentation/layout/working-entry suites | Same calculations, null and skipped semantics, drag end commit, independent context baselines, no navigation persistence into inspected subject. |
| Existing real-component Info motion/pouch/geometry and Phase 2 browser suites | Mounted activity/player, nested focus and gesture isolation, existing Creator/Library/personal journeys unaffected. |

Add focused group repository/API/browser tests rather than forcing every group scenario into personal suites. Use at least: two admins, active followers, a removed follower, an admin who follows, a template owner with no role, and an unrelated actor. Give the same template to personal plus two experiences, with deliberately different media IDs/values/versions.

Deterministic interleavings must cover remove versus upload/Save, concurrent final-admin removals, membership add versus adoption, recipient removal versus media read/edit, shared Info deletion versus first Save, two admins editing the same/different fields, retry after deletion and stale response after context/account switch. Assert stored unchanged unrelated fields, response metadata and exact denial; hiding a button is not an authorization test.

Calculation fixtures include all-skipped, mixed skipped/done/todo/inProgress, empty Deck, zero followers, unset versus set minimum confidence, raw values where rounded means differ, obsolete Step values, missing/duplicate state and rejoining followers. Preserve current rounded-100 completion behaviour rather than “fixing” it incidentally.

Performance checks use scalable synthetic metadata and mocked provider boundaries: no arbitrary item cap, bounded response/page/player/image work, no fetching all full Cards for a roster, stable cursors with equal times, and database index plans. Agree representative volumes/targets first; do not invent a product maximum.

## 13. QUESTIONS

Questions are ordered by impact. Confirmed requirements such as equal admins, no invitations, no Creator Mode and both confidence values are not reopened.

### Q1 — Which existing Decks can be assigned, and which initial versions are selected? [Before Phases 1–2]

Current foreign reads require public roots **and exact public versions**; a creator's private Deck/Card/Info attachments are owner-only. The prompt says existing Deck without defining private-content distribution. Options: published public Decks/public Cards only initially; or explicit experience grants for private published content, including every Card/Info/media version. Recommend public published content first if product agrees; otherwise private version grants are required architecture, not a hidden owner bypass. Also confirm initial selection follows ordinary new entry (latest eligible Card versions) rather than Deck publication pins or an admin's independently adopted personal versions. This affects creation preview, authorization and instructional media.

### Q2 — Who is eligible to create experiences and discover/assign registered users? [Before Phase 1 and rollout]

“Eligible” is not defined; `/api/users` currently lists every registered username/ID. Options include all registered users in an explicitly approved trial, or an eligibility relationship/allowlist restricting discovery and assignment. Recommend defining eligibility and discovery together, exposing only necessary username/ID data. No invitation/acceptance flow is proposed. Product/safeguarding review must address automatic assignment, under-18 participants, who may administer them, disclosure of contributions to peers/new members, and the fact that removed participants' contributions remain visible. This draft does not provide legal conclusions or assume consent from registration.

### Q3 — What does self-only Info privacy mean for drafts and admin inspection? [Before Phase 4]

The prompt grants admins inspection/deletion of experience CardData but followers can create Info Cards “for themselves only.” Recommend interpreting saved self-only as hidden from peer followers but inspectable by admins, clearly distinguished from unrelated permanently private Personal Info Cards. Unpublished follower drafts are not specified: options are author-only drafts or admin-readable drafts. Recommend author-only follower drafts unless safeguarding/product policy explicitly requires access; otherwise admin inspection would disclose unfinished work. Separately confirm whether all admins share access to each other's unfinished admin-managed drafts, or only to saved cards; the former requires admin-capable My Drafts/editor discovery. Approve wording and enforce draft/saved/media boundaries consistently.

### Q4 — What does deleting a follower contribution mean, by field? [Before moderation in Phase 2 and Phase 4]

Deletion rights are confirmed; arbitrary value editing is forbidden. Options for completion/signals are clearing to existing todo/null defaults or restricting moderation controls to content/events until a reset action is designed. For Info Cards, current Remove detaches while Delete destroys unreferenced content; choose whether group removal is a shared tombstone, recoverable removal or hard content deletion. Recommend narrow, revision-checked experience-local deletion with no eager provider destruction, no whole-CardData reset and no delayed retry resurrection. Decide recovery/audit/retention expectations and whether authors may recreate a deleted contribution; this changes storage and moderation UX.

### Q5 — Recipient lifecycle, role changes and attachment chronology [Before Phase 4]

Selected recipients can be removed and re-added, followers can leave/rejoin, and authors may gain/lose admin status. Options: retain selected-recipient relationships through follower removal and restore on rejoin, or revoke them permanently. Recommend retention with access gated by active membership. Keep original management class: admin-created cards remain managed by current admins; follower-created cards remain author-editable and admin-deletable, with no edit of another follower's work after promotion. Confirm how a dual-role admin creates a self-only note in their own follower perspective; recommend deriving its author-managed origin from that explicit perspective, not silently making it admin-managed.

Confirm whether admins' recipient management applies only to admin-created cards; recommend yes for explicit subsets, since follower subset sharing is disallowed. For dates, recommend stable first attachment/group-share dates, new dates for genuinely re-added selected relations and no redating on content edit or join. Approve the §7.3 grant boundary that shares current saved content without exposing earlier private versions. Audience transitions and removed authors' shared-card retention need explicit approval. The initial value of `allowFollowerGroupInfoCards` is also unspecified: choose enabled/disabled or explicit creator selection; do not invent a default or insert an unapproved creation step.

### Q6 — Decimal follower averages versus existing integer rounding [Before Phase 6]

The example says `6.4`; `getConfidenceScore` returns `Math.round(mean)`. Options: use existing integer display everywhere; or show a raw-mean-derived decimal for follower Step averages while retaining existing personal/Card/Deck rounding. Recommend preserve all existing roll-ups and return raw mean/sample count so the display can be agreed without changing stored values. If decimal display is desired, choose precision deliberately; do not store averaged values or average rounded scores.

### Q7 — Entry, dates and personal membership controls [Before Phase 5; scheduling before Phase 2 writes]

Follower assignments must appear in My Decks, but admin-only discovery, duplicate-instance labels, creation entry, and archive/leave behaviour are unspecified. Options for admin access include an admin experience entry in the existing collection or a separately approved entry point; recommend reusing collection infrastructure without creating follower data. Confirm how personal and two group instances of the same Deck are distinguished. Scheduling options are independent follower first-open cadence versus experience-wide dates; recommend preserving independent follower dates plus separately owned group dates unless shared deadlines are intended. Do not let ordinary Archive silently remove a follower or let Restore self-rejoin. Whether followers can voluntarily leave is not established by the section label alone.

### Q8 — Reflection editing, prominence and accessible rotation [Before Phase 6]

Tap must advance, but current tap edits. Options include an approved existing-context edit affordance or another explicitly designed activation; no new reflection dashboard/modal/expanding interface should be assumed. Decide prominence through ordering/frequency/treatment, interval, pause/accessibility behaviour and attribution after several admins edit the group reflection. Recommend preserve the existing position and editor machinery where permitted, track last editor separately from ownership, and use only gentle fade. No specific new gesture or timing is approved here.

### Q9 — Experience/account lifecycle and delivery safeguards [Before rollout; affected retention work earlier]

How are experience closure/deletion, account erasure, last-admin account loss and retained author names handled? Options include retained closed experiences and reassignment, or explicitly designed deletion/retention procedures. Recommend no automatic destructive cascade and a defined last-admin recovery path without introducing a primary admin. Product/legal review must set retention and notice expectations, especially for younger users and future joiners seeing historic contributions. Existing public-image trial acceptance for non-sensitive personal notes does not automatically approve group/minor media. Confirm acceptable delivery-origin protection and residual one-hour bearer-token access after removal; do not claim instant revocation of downloaded content.

### Q10 — Unlimited-media reachability and order direction [Before Phase 3 UI]

Storage/upload already exceeds five, but the Card back renders five thumbnails. Options include a windowed/incremental treatment within the existing media area or another approved design that keeps all items reachable. Recommend incremental metadata loading and selected-only media, without changing the current viewer's basic interaction. Confirm newest-first versus oldest-first timestamp order. Unknown legacy personal timestamps must retain honest legacy ordering; no invented upload dates.

### Q11 — Expected scale and freshness [Before Phase 2 performance design; final targets before rollout]

What follower count, Deck size, simultaneous active editors and media volume should the first release support, and how quickly should another user's change appear? Options: refresh on entry/focus/interaction, visibility-bound polling, or realtime subscriptions. Recommend mutation invalidation plus entry/focus refresh first, adding bounded polling if the expected classroom/coaching experience requires it. Representative volumes determine initialization transactions, guard contention and query targets; they must not become arbitrary product item caps.

### Q12 — Account-wide Progress and Cards removed by Deck adoption [Before integration beyond experience views]

Current Framework summaries deduplicate personal CardTemplate identity across active/archived memberships. Group contexts could contribute separately, be excluded, or require a new user-facing aggregation rule. Recommend leave existing personal summaries unchanged for V1 unless explicitly requested, with no accidental counting of group-owned/admin-inspected state. Also decide how admins/followers can reach preserved Cards removed from current Deck composition; retention is mandatory, but a historical Card browser is not specified. Conversely, when inspecting a removed follower on a Card first introduced after their departure, recommend an explicit no-record/not-assigned presentation instead of fabricated historical work. These decisions can wait for the relevant integration phase if storage preserves identities now.

## 14. Risks, assumptions and readiness

| Risk | Concrete mitigation/readiness condition |
| --- | --- |
| Template-only identity leaks across contexts | Explicit context resolver, group-only storage branch, full client key/queue/barrier audit; personal/A/B adversarial fixtures. |
| Admin accidentally impersonates inspected follower | Separate authenticated viewer from subject throughout HTTP, playback, editor, assessments and capabilities. No `dataOwnerUserId` as session substitute. |
| Sharing weakens permanently private existing notes | New immutable group purpose; legacy personal rules unchanged across catalogue, publication, media, recovery and canonical references. |
| Another admin cannot edit existing admin-authored media/publication safely | Separate original author from publisher/uploader; update the group-only validation branch and immutable provenance, not owner checks globally. |
| Removed users retain fresh access or delayed writes | Current membership checks on every surface plus transactional guard, stale-response rejection, scoped grant invalidation and no-resurrection receipts. Residual bearer/download access documented. |
| Group adoption overwrites data or splits versions | Single experience selection authority, stable-Step preservation, exact reviewed commands, concurrency tests; no per-user fan-out adoption. |
| Unlimited media overloads records/UI | Normalized group contribution rows, cursor pages, bounded thumbnail/player work and scale tests. Personal arrays retain existing growth constraints; escalate the documented metadata cutover only if measured launch needs require it. No replacement numerical cap. |
| Legacy media chronology falsely represented | Unknown timestamp retained explicitly; no inference from CardData updatedAt or asset filename. |
| Whole-Card optimistic rollback loses another admin's work | Independent field/list revisions and narrow acknowledgements/rollback; preserve local rejected intent. |
| New feature becomes a Groups/organisation platform | Experience identity only, narrow two-context adapters, reuse existing components and repositories. Future entities link without rekeying learning data. |
| Design assumptions accidentally become product decisions | Provisional layout clearly labelled; Q6–Q10 reviewed before UI; no invented gesture, dashboard, signal mode, primary admin or invitation flow. |
| Historical handoff mistaken for current operational evidence | No live checks claimed. Deployment/index/provider/device evidence must be recorded during authorised implementation. |

Ready now: review the recommended experience identity, separate group/follower data ownership, context resolution boundary, reusable calculation/component seams, central adoption authority, group-purpose Info extension, and the phased implementation sequence.

Settle first: eligible Deck/version access, assignment/discovery and safeguarding policy, self-only draft visibility, field-level deletion meaning and recipient/role lifecycle. Settle detailed UX, numerical display and freshness before their respective phases. Scale measurements must precede a claim that the chosen transaction and loading strategy supports the intended use.

**Investigation boundary:** only this draft document was edited. No application code, schema, migration, API, component, test or configuration was changed; no branch switch, reset, commit, database/provider write or full test run was performed.
