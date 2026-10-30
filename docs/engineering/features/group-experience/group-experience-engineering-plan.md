# Group Experiences — Final Engineering Plan

**Status:** Approved architecture, incorporating the final four corrections. Phase 1 is complete and committed as `d68bd4c`. The subsequent “Implement Group Experiences Phases 2 and 3” commission authorizes Phase 2, its acceptance checks and separate commit, then Phase 3, its acceptance checks and separate commit. A documentation-only handoff commit follows. Stop before Phase 4; detailed UI and operational approvals in §18 remain gates.

**Baseline:** `feat/group-experience`, commit `2ff6388`. The existing untracked design requirements, draft and independent review are preserved. Phase 1 implementation evidence and changed files are recorded in [its handoff](group-experience-phase-1-handoff.md); later phases below remain specifications.

**Authority:** The current “Implement Group Experiences Phases 2 and 3” commission supersedes the prior Phase 1 stopping gate, while preserving all approved product corrections. The “Final Corrections and Authorisation” prompt updates the “Group Experiences: Final Engineering Plan” prompt supplied as attachment `89884217-de1f-47aa-9472-1782689e0999/Pasted text.txt`, which supersedes the earlier requirements, [draft](group-experience-engineering-plan-draft.md) and [Claude review](group-experience-independent-review.md). This document restates the implementation contract so those materials are not required to recover product rules. Source paths refer to the inspected baseline; proposed files are identified as proposed.

## 1. Executive summary

Implement Group Experiences as named assignments of a published public Deck to registered users. Keep **one authoritative personal CardData per user/CardTemplate**. Its completion, confidence, tests and target date follow the user across independent and group contexts. Each experience holds its own group-controlled learning values and its own media, reflections and Info Cards. Membership grants a narrowly projected view of personal learning; it never grants access to the whole personal CardData document.

The principal decisions are:

1. Keep `users.cardsData` and ordinary `users.decksData`. Add persistent experience and member records, group-only learning state and scoped contributions. No experience-specific follower learning collection, fake user, template copy, formal Group or Organisation.
2. Separate **which content version a view displays** from **who owns the learning values**. Independent personal views retain `CardData.cardTemplateVersion`; group views use experience selections. Both project the same Step-ID values. A group update never changes the personal adoption pointer or another group's selection.
3. Compose explicit own-follower, group, inspected-follower and former-follower read models. Only the signed-in owner receives private media, reflections, Info associations, test history or target dates. Admin queries select progress/confidence fields at the database boundary.
4. Save a small removal snapshot of allowed learning values and exact template selections. Former-follower inspection reads that snapshot and retained group contributions, never the live personal record. Rejoining resumes current personal values.
5. Extend the existing Info Card domain with immutable group purpose, author/management identity, an embedded audience, private editor drafts and an audience revision on saved versions. Reuse the existing pouch, editor, immutable publications and media provenance.
6. Keep the five-thumbnail layout, selecting the newest five in oldest-to-newest order. Use paged group metadata and the existing full gallery. New group images use a private storage origin; group videos require signed delivery. Existing public-image trial permission is insufficient for group assets.
7. Validate the central Card experience after the learning/membership foundation, before advanced sharing/media work. Use one main Card scene, lightweight perspectives, shared active Card and front/back orientation, and modest visible-page polling.

The personal Framework policy is approved: use the highest version explicitly adopted by an eligible context and retain eligibility once legitimately assigned, including after Card removal from Deck composition. The one-hour signed-video lifetime is provisionally approved. Remaining gates concern concrete UI integration and operational verification. No broad personal-data migration is required. Phases 1–3 are committed. The subsequent authorised Phase 4 fixture-backed slice follows the dedicated [product specification](../../../design/features/group-experience/group-experience-phase-4-spec.md) and [engineering plan](group-experience-phase-4-engineering-plan.md); creation/settings and later phases remain excluded from that slice.

## 2. Confirmed product contract

### 2.1 Identity, membership and roles

- Any currently eligible registered user can create an experience by selecting an existing published public Deck, entering an informal name, selecting followers and optionally selecting more admins. The creator becomes an admin; being a follower is optional and explicit.
- Every selected Deck and Card version must itself be public and published. Template ownership is not a substitute for that check. No private distribution grants, canonical edits, forks or Creator Mode exist inside an experience. Creators use the normal Library workflow.
- The experience follows one Deck identity once. There is no restart/run counter, invitations, acceptance workflow, organisation hierarchy or reusable Group management. Future Groups can link to experience IDs without rekeying learning or contributions.
- All admins have equal permissions. Admin and follower are independent roles. Protect the last admin. Removing follower status does not also remove admin status; a person with a remaining admin role retains admin access but leaves follower metrics.
- Followers receive distinguishable My Decks entries automatically. An informal name distinguishes personal Deck X, group A/X and group B/X. These are presentation/membership identities, not separate personal learning records.
- Admins add/remove followers and appoint/remove admins. No follower-controlled leave, restore or rejoin action is added. Ordinary personal archive/restore behaviour remains independent.
- Follower removal removes the assignment, excludes the person from current metrics and revokes follower access. Group contributions remain attributed and visible according to their audience. Admins can inspect former-follower history through a collapsed **Removed / Left Group** section. Rejoin restores association and uses current personal learning, without reset.

### 2.2 Data and visibility

| Category | Authority and behaviour |
| --- | --- |
| Personal completion/confidence | One shared value per user/CardTemplate/Step ID. Existing work counts immediately on assignment. Admins may inspect allowed current values while the user follows; active followers may inspect active peers only when the default-Off peer policy is On. Inspection never grants edit, clear or delete rights. |
| Personal target date | Existing user/CardTemplate value remains authoritative. Group assignment/open/materialization must not derive a date from group cadence or suggested dates. Ordinary personal Deck scheduling remains unchanged. No group deadline feature; date is owner-only in group read models. |
| Personal tests | Existing user-controlled Card tests and direct Framework Item tests. Included in personal Framework results; never returned to group admins/peers, including counts or pass/fail summaries. |
| Group learning | Separate admin-controlled completion, confidence and assessments. A dual-role person's personal values contribute once as a follower, independently of these group values. |
| Existing private content | Personal media, reflection and Personal Info Cards remain private, including ancestor/fork history. Owners may view them in their group perspective with a restrained **Private** indication. No automatic import, conversion or cross-group copying. |
| Group media | Uploads made within an experience are scoped to that experience and Card. Direct admin uploads and follower uploads form one attributed collection. Former contributions remain. Only the uploader or an admin can remove an item; admins cannot edit another author's content. |
| Group reflections | One reflection per experience/Card/person, including admins. A dual-role person has one, not two. Independent private reflection remains distinct. Author edits; admins may clear. |
| Group Info Cards | Both admins and followers can create self-only, selected-member or group-wide content. One identity serves all recipients. Every current admin sees every **saved** group Info Card. Unpublished drafts stay private to their editor. |
| Info management | Authors edit and change their own audiences. Current admins also manage cards created as admin-managed. Admins delete follower-created cards but cannot edit them or change their recipients. No follower-sharing permission switch. |

Saved self-only **group** notes remain visible to admins. Permanently private Personal Info Cards outside the group do not. That distinction must be apparent in recipient selection and the Private treatment; never label a saved group self-note “Private” without clarifying admin visibility.

### 2.3 Calculations and interaction

- Reuse existing Step → Card → Deck roll-ups with the Phase 4 neutral-skipped correction (§9.5). Group completion is admin-controlled; active-follower doing/done counts use eligible non-skipped denominators. All-skipped is ineligible, never explicitly completed. Personal percentage presentation retains its established all-skipped 100 convention; completion labels use exact statuses independently of rounded percentages.
- Show group confidence and follower confidence together when active followers exist; omit F with zero followers, and show a dash for unset readings. Each valid raw Step reading has equal weight; exclude null/unset values and round only the final mean to the nearest integer. `10, 2, 2, 2` produces `4`. Do not average already-rounded follower or Card scores.
- Group-assigned learning and personal tests contribute to the owner's overall Framework. Deduplicate CardTemplate identities; exclude group-owned learning/assessments. Preserve current Framework mapping, hierarchy and visual conventions.
- The group Progress view reuses existing Progress presentation and assessment interactions, with group values and follower aggregates. Inspected followers have progress/confidence only; the Test column is unavailable by capability, not a redacted personal-test count.
- Keep five media thumbnails. For eight chronological uploads, show 4–8, with 8 on the right; use a restrained older-item count. The gallery reaches every item, older left/newer right, and opens at the tapped item's stable identity. Preserve upload, removal, download, zoom and iPhone share behaviour.
- Reflections remain bottom-right on the Card, original creation date newest first, username beneath, automatic cycling every few seconds, tap-to-advance and a gentle opacity fade. Editing does not reorder them. No sliding or admin prominence. Admins get a restrained Add/Edit action for their own reflection. A follower taps their own group reflection to edit in their personal perspective.
- Within one viewer, synchronize active CardTemplate and front/back orientation across perspectives. Do not broadcast navigation to other people or synchronize a learner's Step-position/editor state across perspectives.
- Admins default to Group; followers default to self, with a validated remembered selection taking precedence. The approved Phase 4 compact picker, ordinary list and focused three-column grid share active Card/face within one viewer. Followers see peers only when the default-Off policy is On. The dedicated Phase 4 specification governs geometry and interaction; creation/settings UI follows the first iPhone review.
- Poll modestly while visible; refresh on entry/focus and relevant local mutations. No realtime service, Redis or background aggregate platform.

### 2.4 Superseded proposals

Do not carry forward independent follower progress per experience; admin reset/deletion of personal progress, signals or tests; exclusion of group assignments from Framework eligibility; decimal confidence display; removal of the five-thumbnail layout; special group-owned/prominent admin reflection; restrictions on follower recipient subsets; `allowFollowerGroupInfoCards`; private-template distribution; or classroom navigation broadcasts. The Phase 1 gate and separately committed Phases 2–3 are complete. The current Phase 4 authorisation stops after the initial fixture-backed slice and iPhone review handoff.

Initial engineering targets are 10–20 followers, several admins and hundreds of registered users. Batching supports larger groups; those targets are not product caps. Broader discovery/consent/organisation/safeguarding workflows are explicitly deferred pre-release work. Core access control and private group-media delivery are essential now.

## 3. Existing implementation audit

### 3.1 Evidence and reuse

The [Personal Info handoff](../info-cards/personal-info-cards-handoff.md), [personal plan](../info-cards/personal-info-cards-engineering-plan.md), [original Info plan](../info-cards/info-cards-engineering-plan.md), [first-class update plan](../../phase-5-plan.md), [data model](../../data-model.md) and [system behaviour](../../system-behaviour.md) were consulted alongside implementation. Earlier Info plans contain historical “not implemented,” prototype geometry and publication assumptions; the implemented personal feature, 240×204 common face, maths support and later handoff take precedence.

The original planning investigation was source-only and did not run tests or inspect live infrastructure. Phase 1 subsequently adds executable verification using disposable databases and the existing browser harness; actual commands/results are recorded in its handoff. Earlier Info handoff results remain historical evidence, not new provider certification. No production database/provider operations or production latency measurements are part of Phase 1. The installed Next Route Handler guide confirms asynchronous route params; relevant installed guides were read before implementation.

| Source and functions | Verified behaviour | Required extension |
| --- | --- | --- |
| [cards/model.ts](../../../../src/lib/cards/model.ts), `CardData`, `DeckData`, `PersonalUser` | Personal arrays; Card adoption pointer, Step values, private reflection/media/Info associations, Card tests, history-source pointer. Separate user `itemTests`. | Preserve identity/storage. Introduce narrow learning-field input types and explicit group read models; do not pass a foreign full CardData into UI adapters. |
| [cards/repository.ts](../../../../src/lib/cards/repository.ts), `ensureCompositionCardData`, `ensureCardData`, `workingCard` | Guarded first insertion; existing user/Card data wins. Working writes require active personal Deck membership and use the personal adoption pointer. | Reuse insertion/payload primitives behind an additional group-authorized context resolver. Ordinary private-content endpoints remain owner-only. |
| Same repository, `setCompletion`, `setSignalReading`, `setReflection`, `mutateMedia`, `setTargetDate` | Transactional, narrow field writes; missing Step appended; media append has no count quota. | Extract the learning mutation core. Group reflection/media must never call the personal reflection/media mutations. |
| [updateAdoption.ts](../../../../src/lib/cards/updateAdoption.ts), `reconcileCardUpdate` | Validates stable IDs, retains obsolete values, appends default new Steps. Does not discard history. | Extract/reuse pure Step projection against an explicit selected version. Group adoption changes selections without changing personal adoption. |
| [cards/resolvers.ts](../../../../src/lib/cards/resolvers.ts), [readModels.ts](../../../../src/lib/cards/readModels.ts) | Working resolution and `projectWorking` expect real personal data; output includes private fields/history. | Group paths require dedicated allowlisted projections, including explicit authorized-default handling. Do not loosen every legacy missing-data check. |
| [progress.ts](../../../../src/lib/progress.ts), [signals.ts](../../../../src/lib/signals.ts) | Empty progress is null; skipped Steps excluded, all skipped is 100; percentages rounded. Raw confidence flattened then rounded once. | Phase 4 correction: preserve personal percentage presentation, but classify completion from nonempty eligible Step statuses. Group scopes exclude skipped observations; all-skipped is ineligible, never completed. |
| [frameworks/eligibility.ts](../../../../src/lib/frameworks/eligibility.ts), [calculations.ts](../../../../src/lib/frameworks/calculations.ts), [readModels.ts](../../../../src/lib/frameworks/readModels.ts) | Eligibility comes from active **and archived** personal Deck composition, not all CardData. Calculations use personal adoption; missing required rows fail, missing individual Steps default. | Add authorized group assignment eligibility and an explicit summary-version selector. Preserve error/incomplete semantics. |
| [frameworks/destinations.ts](../../../../src/lib/frameworks/destinations.ts) | Area/Item destination queries already project learning fields narrowly; keys assume one personal membership per Deck. | Reuse projection approach and add typed experience destinations; do not create personal membership just to navigate. |
| [assessments/repository.ts](../../../../src/lib/assessments/repository.ts), contracts/history | Card and Item results use existing Boolean result/date shape, list revisions, reconciliation and retained-source ownership. Creation requires a working context. | Authorize own group-assigned Card creation through the new context resolver. Reuse validation/list logic for separate group-owned lists. No foreign personal history reader. |
| [workingCardStore.ts](../../../../src/lib/cards/workingCardStore.ts), [personalWork.ts](../../../../src/lib/cards/personalWork.ts), [useWorkingDeck.ts](../../../../src/components/decks/useWorkingDeck.ts) | User/Card keys intentionally share personal values; one cache bundles learning with private media/reflection, and adoption version controls overlay freshness. | Keep personal data authority; separate group read caches and contribution queues. Shared-learning invalidation spans contexts; private payloads never enter inspected-subject caches. |
| [AppShell.tsx](../../../../src/components/layout/AppShell.tsx), [DeckDetail.tsx](../../../../src/components/decks/DeckDetail.tsx), [presentation.ts](../../../../src/components/decks/presentation.ts) | DeckTemplate-based membership/URL/React keys; actor often inferred from data owner; Creator entry allowed for working personal Cards. | Typed membership identity, actual session actor and explicit capabilities. Group adapter suppresses Creator/fork/personal Update paths. |
| [DeckScene.tsx](../../../../src/components/decks/DeckScene.tsx), [FocusedCardView.tsx](../../../../src/components/decks/FocusedCardView.tsx) | Active Card state and focused flip state live at different levels; media preparation wraps the scene. | Add controlled state seams preserving legacy defaults. One scene, shared active Card/side; cheap miniatures. |
| [ProgressShell.tsx](../../../../src/components/progress/ProgressShell.tsx), [FrameworkProgressTable.tsx](../../../../src/components/progress/FrameworkProgressTable.tsx) | Actual structure is Framework → Area → Item, with Area→Deck and Item→Card destinations. `ItemTestsCell` is currently coupled to personal APIs. | Parameterize data/capabilities/assessment transport. Preserve current hierarchy rather than inventing a new Set model. |
| [BackCardMediaCarousel.tsx](../../../../src/components/decks/BackCardMediaCarousel.tsx), media viewer/upload components | `slice(0,5)` shows first five; full gallery already reaches later items. Media payload lacks reliable upload chronology. | Newest-five metadata selection, total count, attributed scoped sources and lazy gallery pages. Preserve five existing layouts. |
| [BackCardReflectionFragment.tsx](../../../../src/components/decks/BackCardReflectionFragment.tsx), [WorkingFocusedCardView.tsx](../../../../src/components/decks/WorkingFocusedCardView.tsx) | Existing text location/tap editing and editor state assume one reflection per displayed Card. | Scoped reflection target and rotation display. Reset editor identity on experience/author change, not just Card ID. |
| [cardMediaAccess.ts](../../../../src/lib/cardMediaAccess.ts), [cards/protectedMedia.ts](../../../../src/lib/cards/protectedMedia.ts) | Retained personal access is actor-only; generic delivery checks stored references. Instructional playback uses exact versions. | Separate group contribution access; experience-selected instructional playback. Never broaden the own-user scan to read followers. |
| [mediaDelivery.ts](../../../../src/lib/mediaDelivery.ts), [media security backlog](../info-cards/info-card-media-security-backlog.md) | Protected mode rewrites presentation URLs but does not remove public origins. Backlog reports anonymous R2 access and many historical unsigned videos. | New group storage must have verified origin protection. Source inspection cannot certify current provider settings. |
| [infoCards/model.ts](../../../../src/lib/infoCards/model.ts), [repository.ts](../../../../src/lib/infoCards/repository.ts), [queries.ts](../../../../src/lib/infoCards/queries.ts) | Purpose distinguishes creator/personal; owner-only mutation, immutable versions, first-Save association, receipts, reference guards. `validPublication` assumes publisher equals owner. | Add group-only purpose/authorization branches; retain original author separately from actual publisher. No foreign IDs in `personalInfoCardIds`. |
| [infoCards/media.ts](../../../../src/lib/infoCards/media.ts), [mediaRegistry.ts](../../../../src/lib/infoCards/mediaRegistry.ts) | Upload proof/provenance, exact-publication media, deleted-asset anti-bypass registry; readiness currently assumes uploader equals acting owner. | Bind group scope, actual uploader and editor draft; another admin may reuse an authorized saved asset without pretending to be its uploader. |
| [InfoCardEditor.tsx](../../../../src/components/info-cards/InfoCardEditor.tsx), [controller](../../../../src/components/info-cards/infoCardEditorController.ts), [consultation client](../../../../src/components/info-cards/infoCardConsultationClient.ts) | Serial autosave, exact receipts, embedded editing, pinned consultation and owner-specific validation/recovery. | Inject group editor transport and capability-aware source validation, preserve maths and selection. Do not treat frontend owner checks as backend authorization. |
| [mongodb.ts](../../../../src/lib/mongodb.ts), [cards/http.ts](../../../../src/lib/cards/http.ts) | Snapshot/majority transactions, sequential callback operations; session-bound API replies and no-store helpers. | Reuse narrow guards and helpers. Providers remain outside retried callbacks. |

### 3.2 Corrections to tempting reuse assumptions

`CardData.cardTemplateVersion` cannot become the group selection: that would update independent personal views and other groups. `dataOwnerUserId` cannot become the authenticated actor during inspection. `getPersonalUser` retrieves broad arrays and is unsuitable for foreign-user group reads. Existing personal fork-history traversal remains legitimate only for the signed-in owner; a canonical ancestor relationship never authorizes another person's private content.

The existing first-open target-date initialization is personal Deck behaviour. Group reads/assignment must not invoke it as a side effect of inspecting a follower. The personal initial-data helper also derives a suggested target date; preserve its existing owner initialization semantics when materializing a genuinely new personal record, without changing an existing date or inventing a group schedule.

## 4. Independent review reconciliation

Claude reviewed the earlier, now-superseded requirement for independent follower learning. Its findings are useful evidence, not an implementation mandate.

| Finding/question | Decision and evidence |
| --- | --- |
| F1 / A1: public R2 bypass | **Accept and strengthen release treatment.** `mediaDelivery.ts` is presentation-only; `protectedMedia.ts` authorizes the app endpoint while persisted image references retain public origins. The backlog explicitly records the bypass. New private group storage and unsigned-denial verification are required before participant media use (§11). No live provider verification is claimed. |
| F2 / A4: group Progress insufficiently designed | **Accept.** The prior plan mentioned reuse/tests but did not specify Framework-scoped group results or the Item test transport. §9 now covers group Card/Item assessments, own-personal eligibility, destinations and inspected-follower privacy. |
| F3 / S2: every stale write harmless | **Modify.** Stable IDs avoid positional corruption, but current `workingCard` validates the selected version and a removed Step/removed Card is not automatically an authorized target. Accept unchanged current Steps despite an older displayed version; reject a request that starts after its target is no longer in the selected context. An adoption concurrent with an already-authorized stable-ID write preserves that historical value (§12). “Exists in either version” alone is too permissive. |
| F4 / A6: global operation guard | **Accept direction; specify the protocol.** A shared write document creates contention. Use member-level access fences for ordinary writes, experience-level revision for structural commands, and root/list revisions where needed (§14). Structural removal must also change the affected member row; touching only the experience is insufficient. No runtime contention number was measured. |
| F5 / S3: explicit-initialization race | **Reject as a defect in the guarded draft; accept simplification.** Its proposed common guard serialized join and adoption, so the stated mixed snapshot was prevented if implemented as specified. The cost/complexity criticism is valid. The new design has no follower-row fan-out: authorized unstarted assignments have virtual defaults and materialize the single personal row on first write/open. Existing consumers must be adapted deliberately; missing corrupt personal rows do not universally become zero. |
| F6 / A3: meaning of synchronization | **Settled by revised product contract.** Viewer-local active Card and front/back only. No broadcast infrastructure. |
| A2: private Decks | **Settled.** Only exact published public Deck/Card versions. Public publication's permanence remains existing Library behaviour; no private-grant workstream. |
| A5: latest-only shared Info reads | **Modify.** Latest-only media would invalidate an open card on every content edit. Use audience epochs on immutable versions: ordinary edits preserve pinned publications; an audience change creates a new saved version/epoch and invalidates earlier audience grants (§11.3). No per-recipient version-grant collection. |
| A7: scalar CAS everywhere | **Accept simplification.** Narrow absolute scalar writes use server commit order; text and lists use CAS. No new conflict UI for every progress tap. Unknown outcomes and stale local responses still need the documented retry rules. |
| A8: personal media migration | **Defer migration; make the evidence gate concrete.** Existing arrays remain. Group foreign reads never fetch them; new own-media reads project metadata/pages. §14 supplies payload/query targets and a measured escalation rule. No numerical storage quota replaces the product requirement. |
| A9: series/publisher ownership | **Modify.** Admins never edit follower-authored content, so that example is forbidden. Another admin can edit an admin-managed saved card; preserve its retained series through `eligibleSeries`, actual original-author credit, and actual publisher/uploader metadata. Series need not belong to the current editor. |
| A10: aggregate threshold | **Resolve technically.** Test 20×12 and a 40×24 batching case, with bounded projections and stated latency/query budgets (§14). Counts are test workloads, not product limits. No materialized aggregate service initially. |
| Merge roles/navigation into member rows; drop follower DeckData collection | **Accept.** Independent role fields, viewer navigation and removal manifest live on one member row. A structural revision protects the last-admin invariant. No `experienceDeckData` collection. |
| Embed recipients | **Accept.** Expected groups are small; embed deduplicated recipient IDs/attachment dates on group Info roots. Group-wide audience is dynamic membership, without fan-out. |
| S4/S5: context-blind caches/endpoints | **Still important, revised meaning.** Sharing progress is now intentional; sharing private/group contribution payloads is a leak. Legacy endpoints remain personal-only; new contexts explicitly select learning authority and content audience. |
| Route-wrapper enumeration test | **Modify.** Prefer behavioural authorization tests for every endpoint class, including direct URLs/media/receipts. A source-import assertion cannot prove the wrapper is used correctly. |

The review requested live-like contention tests and provider checks. They belong to implementation acceptance on disposable fixtures and separately authorized provider verification. Source evidence supports the design changes; it does not establish measured performance or current origin configuration.

## 5. Architecture alternatives and recommendation

| Criterion | A: independent follower CardData per experience | B: shared personal learning + scoped contributions | C: group tags inside existing personal arrays |
| --- | --- | --- | --- |
| Product identity | Fails confirmed shared-learning requirement. Synchronizing copies would reintroduce multiple authorities. | Meets it directly. | Can preserve identity, but mixes private and shared content in every legacy reader. |
| Refactor/migration | New follower storage, all learning APIs/adapters and Framework reconciliation. | Narrow learning-context resolver, new group projections; no personal-record migration. | Small initial schema diff; broad filtering changes across history, media and private arrays. |
| Framework/tests | Duplicate progress requires new deduplication semantics; private tests can be copied accidentally. | Existing personal tests/state reused; eligibility and display-version selection extended explicitly. | Every existing full-array reader becomes an isolation hazard. |
| Privacy/admin inspection | Context containment is straightforward, but contradicts desired shared values. | Explicit allowlisted learning join plus scoped content; tests stay owner-only. | A missing filter can disclose private content or another group's contribution. |
| Removal/history | Retained follower row naturally freezes. | Small allowed-field removal snapshot required. | Still requires a snapshot; tags do not stop future personal activity. |
| Version differences | Separate adoption/value records simplify projections but violate shared values. | Stable Step IDs plus explicit version projection; no adoption-pointer overwrite. | Same version problem as B, with more mixed ownership. |
| UI/concurrency | Duplicate learning caches and fan-out work. | Context-specific read payloads, shared learning invalidation, bounded member guards. | Existing queue keys risk conflating personal content with scoped content. |
| Performance/tests/maintenance | More rows and synchronization/test surface. | Small read-time joins at pilot scale; focused privacy and projection tests. | Large user documents and pervasive negative filtering; higher long-term leak risk. |

**Choose B.** Separate normalized group contributions are the smallest robust privacy boundary. Option C saves collections but increases the number of existing code paths that must understand sharing. A full universal personal-data migration offers no necessary V1 benefit.

An additional simplification is sparse group-only learning storage and virtual defaults for known unstarted assignments. No follower learning row must exist before any work occurs. The invariant is **one possible stored authority**, with a deterministic empty projection before creation. This is not permission to treat malformed/duplicate existing records as empty. Personal-only workflows keep their current strict expectations.

Complexity classification: scoped read models, removal snapshots, group-media protection, shared Step writes and Info draft isolation are **essential now**. Batched projections, embedded recipient lists, polling and stable retry identities are **cheap and worthwhile now**. Generic permission engines, a universal learning migration, aggregate workers, membership event histories and provider garbage collection are **deferrable**.

## 6. Proposed data model

### 6.1 Identity and learning authority

Use a typed request context, not a fake user or encoded CardTemplate ID:

- Personal presentation: `{ kind: personal, deckTemplateId, cardTemplateId }`.
- Experience presentation: `{ kind: experience, experienceId, cardTemplateId, perspective: group | self | follower, subjectUserId? }`.
- Personal learning write authority always resolves to the authenticated user's `(userId, cardTemplateId)`; the context proves an allowed working path and selected content. No request can choose a different personal owner.
- Group learning identity is `(experienceId, cardTemplateId)`.
- Content contribution identity includes experience, Card, author/uploader and its own stable ID as appropriate.

Keep the authenticated viewer, inspected subject, template creator, original author, current editor and uploader separate. Cache/response identity includes viewer and access context even where the underlying personal learning key is shared.

### 6.2 Entities

| Storage | Fields and responsibility |
| --- | --- |
| Existing `users.cardsData` | Existing single personal record, including Step arrays, personal adoption pointer, target date, private reflection/media/Info references, tests and history source. No experience ID is added to its identity. Group learning writes touch only the authorized personal learning fields. |
| `users.retainedCardAssignments` | Additive owner-only references `{cardTemplateId,version}` recording the highest legitimately adopted personal assignment. Preserve old composition before personal Deck adoption/republication removes Cards. No learning values, test contents, group grants or navigation authority. Current-only Framework readers are extended in Phase 5. |
| Existing `users.decksData` | Ordinary personal membership, adoption, navigation, archive and cadence. Never insert a group assignment here to make legacy APIs work. |
| Proposed `groupExperiences` | `experienceId`, `name`, immutable `deckTemplateId`, creator attribution, creation/update timestamps, exact `deckVersion`, per-Card adopted version selections (including temporarily detached Cards), `structureRevision`, `adoptionRevision`, `adminCount`. Group direct Item tests and `itemTestsRevision` reuse existing shape. Creator ID is not authority. |
| Proposed `groupExperienceMembers` | Unique `(experienceId,userId)`; `isAdmin`, `followerStatus: never/active/removed`, joined/rejoined/removed timestamps; `accessEpoch`, incrementing write fence; viewer active Card/openedAt; latest removal snapshot manifest; lifetime assigned-Card references with highest adopted versions. No group cadence anchor. A non-admin removed follower row is retained but grants no group access. |
| Proposed `groupCardState` | Unique `(experienceId,cardTemplateId)`, sparse Step completion/readings, existing Card test list/revision, timestamps and read revision. No personal reflection/media/Info/test fields copied here. Missing new group row means default todo/null/empty tests; values persist across composition changes. |
| `groupOperationReceipts` | Narrow structural-operation receipts keyed by experience/authenticated actor/operation ID. Store command hash and committed structural revision, with no private content. Exact retries acknowledge or report superseded intent and cannot replay over a later transition. Creation uses its own unique creator/operation key on the experience. |
| Proposed `groupRemovalLearning` | Unique `(experienceId,userId,cardTemplateId)` for the latest completed removal snapshot generation. Exact selected version and only its Step statuses/readings, snapshot generation/time. No personal tests, dates, private content, history pointers or user-document timestamps. The member manifest stores Deck version/order and snapshot generation. |
| Proposed `groupMediaContributions` | Stable ID, experience/Card, immutable uploader ID, `source: group/follower` for provenance, server upload-completion time, scoped asset reference, revision, pending/attached/deleted state and deletion metadata. The same row acts as an allocation/attachment receipt; deleting leaves a content-free reservation sufficient to reject delayed commits. |
| Proposed `groupReflections` | Unique `(experienceId,cardTemplateId,authorUserId)`, text, revision, createdAt/updatedAt and last clearing metadata. Author ownership ignores whether they also administer. Clear retains revision; delayed saves cannot restore cleared text. |
| Existing `infoCards`, group branch | Immutable `kind: group`, experience/Card origin, original author, `management: author/admins`; saved audience `self/group/selected`, deduplicated selected recipients with attachment dates, audience epoch, content revision, first attachment date, deletion reservation. Creator/personal branches unchanged. |
| Proposed `infoCardGroupDrafts` within existing Info domain | Unique `(infoCardId,editorUserId)`, same `InfoDraft` content, draft revision, base saved content revision, pending audience intent, timestamps. Required because equal admin editing must not expose another editor's incomplete draft. No separate editor/viewer/content system. |
| Existing Info publications/asset registry | Immutable saved content plus group audience epoch, actual publisher, source draft receipt identity and uploader provenance. Group asset allocations bind experience, root, editor and asset. Legacy owner-only publication validation remains intact. |

**No follower CardData/DeckData collection.** Member state holds only membership/presentation, retained assignment references and the removal manifest. Removal snapshots are historical restricted views, never writable alternate learning records.

Retained Framework assignment references contain Card IDs and highest authorized adopted versions, not learning values. Personal references live on the user; group references live on the member. Record group references at assignment/add/rejoin and preserve/merge them at Card/Deck adoption **before** old composition disappears, not only when a follower leaves. Updating the small active-member reference lists is permitted metadata fan-out; it never changes personal progress, adoption pointers or private content. Removed members' references remain frozen until a legitimate rejoin. Reuse the same max-version/deduplication helper for both sources. Retention grants only the owner Framework eligibility, never group access or historical working navigation.

### 6.3 Version and default projection

Extract a pure `projectLearning(content, fields)` from the existing stable-Step logic: validate exactly the selected Card's three Step identities, read matching values, default absent Step values to todo/null and retain obsolete stored IDs without including them in that view. Keep completion/confidence helpers unchanged.

For a known group assignment with no personal row, project virtual empty learning. On the owner's first mutation or explicit working open, conditionally insert exactly one personal record using the existing guarded-append pattern. If a personal/other-group operation wins the race, reload and use that record; never replace it or its adoption pointer. Subsequent new Steps are materialized only as needed. A missing independent-personal row, duplicate record, invalid Step value or broken canonical version remains an explicit integrity error.

If an existing ordinary personal membership already requires that CardData row, a coincident group assignment cannot excuse its absence. For group-only eligibility, row absence is deliberately defined as unstarted; no separate completeness ledger is introduced. This cannot diagnose arbitrary out-of-band deletion of a previously existing row. Detectable corruption—malformed values, duplicate identities, broken versions or a missing ordinary-personal record—still fails explicitly. Existing chats and private history remain in the owner record and out of group projections; no group chat functionality is introduced.

The personal pointer initializes once from the version used at first materialization; it remains the ordinary personal adoption authority thereafter. Group selections and the proposed Framework summary selector are separate read inputs. Reuse `initialCardData` field defaults, including its existing suggested-date semantics; group assignment itself performs no personal-date or first-open write.

On an explicit **own-follower working open**, materialize missing personal learning only as needed, with target date null even if the group-selected Card suggests a date. Preserve an existing date exactly. Never call the ordinary personal cadence initializer or derive group dates. Ordinary personal Deck entry/open retains its current suggested-date/cadence precedence and can initialize an unset date later. Future group deadlines require separate storage and product scope.

### 6.4 Indexes, constraints and rollout

- Unique experience ID and `(creatorUserId,operationId)` creation receipt; unique `(experienceId,actor,operationId)` structural-operation receipt; unique `(experienceId,userId)` members; member indexes `(userId,isAdmin,experienceId)`, `(userId,followerStatus,experienceId)` and `(experienceId,followerStatus,userId)`.
- Unique `(experienceId,cardTemplateId)` group state; unique `(experienceId,userId,cardTemplateId)` latest removal row, with generation filter checked against its member manifest.
- Media unique contribution ID and provider/asset allocation identity; feed index `(experienceId,cardTemplateId,state,uploadedAt,contributionId)`; uploader-prefix variant only if query plans justify it. Pending/deleted records do not appear in feeds.
- Reflections unique experience/Card/author and chronological index experience/Card/createdAt/author. Maintain updatedAt/revision for edits and concurrency, without changing order. Filter blank text in the repository; cap neither author count nor contribution count by product rule.
- Group Info lookup by kind/experience/Card/audience/attachment date; selected-recipient multikey index; group drafts unique root/editor. Reuse root/version/source-revision indexes, adding a partial unique group draft receipt index `(infoCardId,sourceDraftEditorId,sourceDraftRevision)`.
- Preserve personal Info association indexes. Verify the handoff's outstanding live-index prerequisites before enabling writes; do not assume the Atlas index exists because a test creates it.

Mongo indexes do not enforce foreign keys or independent roles. Transactions validate same-experience references, real registered users, immutable origins, valid role transitions, allowed recipients and at least one admin. Do not attempt a unique multikey index as a substitute for uniqueness **inside** one user's CardData array: retain guarded insertion and duplicate-detection tests.

No backfill/migration of personal CardData, canonical versions or private Info roots is required. New group collections and optional fields are additive. Index setup is explicit and idempotent; request handlers do not build indexes. No bulk public-origin change or provider-byte migration is implied. Rollback may disable group entry while retaining data and group-asset denials; an older application that ignores group purpose/asset reservations is not a safe rollback target.

## 7. Permissions and privacy matrix

Read models are allowlists. Never build an admin response by fetching an owner's full working DTO and deleting a few fields afterward.

| Data/action | Owner in independent personal view | Active follower | Other follower | Current admin | Removed follower without admin role |
| --- | --- | --- | --- | --- | --- |
| Shared personal progress/confidence | Own read/write | Own read/write | No direct full-person view | Inspect active followers; frozen values for former followers; never edit/delete another's values | Own data remains usable through ordinary authorized personal contexts; no group route |
| Personal tests/target dates/private history | Own only | Own only | None | None for another user, including aggregate metadata | Own ordinary rights only |
| Group progress/confidence/tests | No grant from personal ownership | Read | Read as member | Read/write/delete group tests using existing semantics | None |
| Group media | No grant from matching Card identity | Read group feed; create/remove own uploads | Read contributions, no full follower Card | Read, upload, remove any contribution; no foreign content edit | None; retained contribution visible to current members |
| Group reflection | No cross-context grant | Create/edit/clear own | Read carousel | Own create/edit; clear any | None; retained text visible to current members |
| Saved self/selected group Info | No cross-context grant | Author or selected recipient reads; author edits | Read only if entitled | Read every saved root; delete any; edit only own/admin-managed | None |
| Saved group-wide Info | No cross-context grant | Read; author manages own | Read | Read/moderate; management rule above | None |
| Unpublished group Info draft/media | No cross-context grant | Own authorized editor draft only | None | Own editor draft only; another admin's saved card may be edited from its saved version | None |
| Membership, role, name, adoption | No grant | None | None | Manage; final-admin and revision guards | None |
| Template edit/fork inside experience | No | No | No | No, even if template creator | No |

A dual-role person receives the union of role capabilities for the selected target. They can edit their own personal learning as a follower and group values as an admin; they still cannot inspect peers' personal tests. If a user inspects themselves, owner-only data may appear because the session actor equals the subject, not because admin authority grants it. Other followers and template creators without membership have no group access. Application-wide `isAdmin` does not grant experience administration.

Admin inspection permits progress/confidence and group-scoped contributions only. Query personal arrays with a bounded `$filter`/`$map` or equivalent projection selecting Card ID, completion and readings; project only the requested group-version Step IDs before responding. Do not return personal adoption versions when they could disclose private template history, private timestamps, test existence, reflection length, media IDs, private attachment counts or fork history.

Group feed DTOs expose contribution IDs and authorized display URLs, not reusable private origin locators or provider metadata. Every list page, exact media read, draft recovery, receipt retry, download and processing-status endpoint checks current access. Unknown IDs and unavailable content must not reveal another group's title/author or private counts.

## 8. Data flows and APIs

Proposed routes under `/api/group-experiences` are a concrete namespace, not a second personal API. Existing repositories remain the source of shared learning validation and mutation. Route handlers use the installed Next conventions and existing authentication/no-store response helpers.

| Operation | Suggested contract and critical checks |
| --- | --- |
| Create/list | `POST /api/group-experiences`; `GET /api/group-experiences` returns the actor's admin/follower entries. Create accepts name, follower/admin IDs and an exact public preview manifest plus operation ID. Validate registration, roles and public versions; atomically insert experience and members. |
| Membership/roles | Versioned `POST /:id/members` commands for add/remove/role changes. Session actor must currently administer; structural CAS and affected-member fences; snapshot removal before committing inactive status. Retry never restores a later removal. |
| Open/navigation | `GET /:id`, `POST /:id/open`, bounded member navigation write. Reads do not initialize personal data. Explicit own-follower open may materialize learning with date null; no group cadence/suggested-date initialization (§6.3). Admin inspection never materializes another user's personal data. |
| Summary/roster | `GET /:id/summary`, paged roster and batched lightweight perspectives. Snapshot-consistent membership/selections; active-only counts. Admin roster includes collapsed former section; ordinary followers get no inspectable peer records. |
| Card view | `GET /:id/cards/:cardId?perspective=group|self|follower&subjectUserId=…`. Resolve current selection and capabilities. Own private sources are an owner-only extension; inspected follower has only allowed fields. Former subject uses snapshot. |
| Personal learning | `PATCH /:id/cards/:cardId/personal-learning`, self only, explicit Step/value or own target date. Authorize active follower and selected Card; call the shared personal mutation core, never overwrite whole CardData. |
| Group learning | `PATCH /:id/cards/:cardId/group-learning`, admin only, narrow absolute Step/confidence setters. Group tests use scoped assessment commands. |
| Progress/tests | Experience summary and Card/Item assessment routes reuse existing contracts with explicit owner kind. Personal test source remains session owner; all foreign requests denied. |
| Media | Allocation, commit, page, status, delivery/download and delete commands bound to experience/Card/contribution. See §11.1. Provider work is outside DB retries; authorization repeats at final commit. |
| Reflections | Per-author read/write/clear under experience/Card; author edit or admin clear, expected revision. Feed includes current and former contributions. |
| Info Cards | Existing Info feature receives a group context and group commands; create, editor draft, Save, audience change, consultation, media and delete all verify immutable scope. See §11.3. |
| Updates | Experience Card/Deck review and accept commands pin exact source/target/adoption revisions and new Card selections. Admin/group perspective only. No calls to followers' personal adoption endpoints. |

### 8.1 Creation, assignment and owner writes

The public manifest follows existing Library preview semantics: current public Deck and reviewed eligible public Card selections. Existing followers' personal adoption pointers do not influence the group manifest. A changed publication between preview and creation yields the existing refresh/review outcome, not silent retargeting.

Creation writes experience/member metadata only; no O(followers × Cards) personal data initialization. Assignment is computed from active member records and appears without a follower opening the Deck. Existing learning is immediately visible through the restricted projection; absent authorized learning is default unfinished.

Shared learning mutations use the real session actor, authorize the context and write the same user's personal row. They preserve every unmentioned field and stable Step value. Personal endpoints retain their existing personal-membership checks. New group authorization does not add group members to `sharedWithUserIds`, bypass personal private-content checks or impersonate an inspected subject.

### 8.2 Responses, errors and client work

Reply with viewer/context identity, selected version/adoption revision and relevant record/list revisions. Use `private, no-store`, `Vary: Cookie` on data/errors/delivery. Reject late responses after account, experience, subject, Card or authorization-generation change. An authorization failure clears accessible group payloads/grants and pending group presentation; it does not erase the owner's retained personal learning.

Separate **learning operation scope** `(actor,cardTemplateId,field/step)` from **contribution scope** `(actor,experienceId,cardTemplateId,kind,id)`. Learning queues/barriers span that owner's personal and group views because the values are shared. Media/reflection/Info queues do not span unrelated experiences.

Keep legacy `WorkingCardStore` as a personal-presentation store. Do not feed group or inspected DTOs into it. Add a narrow cross-context learning invalidation event and a per-Card cache-clear operation: after an own group learning acknowledgement, clear stale personal overlays and refresh affected owner views/Framework summaries. Group read caches include experience/subject/version. Existing in-flight local mutations remain overlaid until their own acknowledgements; a refresh never rolls back a newer local field. This avoids an unnecessary universal cache rewrite while fixing privacy and freshness.

Foreign admin inspection is always read-only with respect to personal learning. Its cache is keyed by the admin viewer as well as the subject; it cannot be reused after sign-out or role loss. Publication/Info audience invalidation is distinct from learning invalidation.

## 9. Framework Progress integration

### 9.1 Preserve the actual hierarchy

The code's Progress hierarchy is **Framework → Area → Item**, with Area selecting Deck destinations and Item selecting mapped Cards. The requirements' Set → Deck → Card language describes the existing learning navigation, not permission to replace the Framework model. Reuse the current configuration, canonical ancestry mapping, expansion behaviour, tables and Deck/Card destination components. Do not introduce a new Set entity or reinterpret Area/Item relationships.

### 9.2 Approved personal eligibility and differing versions

Extend the existing eligibility reader to union:

1. Active and archived ordinary personal Deck compositions, exactly as today.
2. Current compositions of experiences where the actor is an active follower.
3. The actor's retained personal assignment references and lifetime group assignment references, including Cards removed by Deck updates and groups the follower has left.

Deduplicate by CardTemplate identity before mapping/calculation/history collection. An admin-only membership contributes nothing. A matching Card in three memberships contributes one personal learning record and one set of personal test source identities. Canonical fork identities remain distinct under existing mapping/ancestry rules.

**Approved summary-version rule:** select the highest version explicitly adopted by any legitimate personal or group assignment for that Card, including retained assignment references. Never use a newly published but unadopted version. Compute one three-Step projection from that version, not a union of all historical Steps. Do not write this calculated choice into `CardData.cardTemplateVersion`. Merge references deterministically by CardTemplate ID and maximum adopted version.

Example: personal view v2, group A v3, group B v1 all read the same Step-ID map. Their displayed percentages may differ if the Step identities differ. Overall Framework uses v3 once under the recommendation. A group v3 write changes the owner's shared values and subsequent overall results; no view changes its content adoption. If v3 replaces a Step, the older value remains available in v1/v2 but is not another denominator entry in v3.

This visible summary policy is approved. Retaining only the current personal pointer would omit newer group-only Step work; unioning all versions would change the existing three-Step/current-content calculation; averaging context scores would double-count. Once assigned, a Card remains eligible after either personal or group Deck composition removes it. Record references at authorized transitions without inventing eligibility for arbitrary orphan CardData or unadopted historical Deck publications. No historical browser is needed. Legacy assignments that disappeared before any reliable evidence was retained cannot be inferred safely from CardData alone; no bulk backfill is authorized.

While an authorized group assignment exists without a stored personal row, Framework receives its explicit default projection. Corrupt duplicate records or missing canonical versions still yield incomplete, not zero. Retained references are usable only in the owner's Framework query; they do not grant former admins live access, restore a group tile or make a removed Card writable through its former Deck. Private tests retain their existing owner-only source rules.

### 9.3 Personal tests and destinations

Keep personal Card tests in `cardsData.tests` and direct Item tests in `users.itemTests`. Reuse `collectCardHistory`, source deduplication, mapped Item selection and `projectAssessmentHistory` for the owner. Group-created personal tests use the same list and revision; creating a test from a group-only Card uses group working-context authorization instead of fabricating an independent Deck membership. Existing retained-source edits/deletes remain owner-only. Adapt the Framework source-title/version loader as well as its numeric calculations so group-only Cards resolve under the chosen summary version; do not leave a hidden personal-pointer-only read behind.

Extend Area/Item destination contracts with `{kind: experience,experienceId,deckTemplateId,name}`. React keys and URLs use this identity, not just DeckTemplate ID. Active group-only Cards must be reachable from Progress. Retained removed assignments continue to affect the owner's totals, but do not produce a working link back into a revoked experience; an ordinary public Library destination remains subject to existing Add behaviour.

### 9.4 Group and inspected Progress

Use the existing Framework configuration and intersect mapped Cards with the current experience composition. Group completion/confidence uses group learning projected against experience versions. Alongside it, compute completed/total and raw-reading confidence from active followers over that same mapped Card set. Area totals union mapped Cards before calculating, just as current code does; they do not average displayed Item scores.

Provide explicit group assessment storage using the existing two sources: Card test lists in `groupCardState`, and direct Item lists on `groupExperiences`. They describe the group as a whole, never an individual follower. Reuse Boolean result/date/ID/list-revision semantics and the current Test cell/history presentation. Group history combines only these group sources; personal source/fork history is never traversed. This is the required missing group-assessment adapter, not a new marking/assignment system.

For an inspected follower, reuse the same table with **only that experience's mapped Cards** and allowed progress/confidence. Personal assessment readers are not invoked; the Test cell has no foreign data or edit action. For the signed-in follower's own perspective, their private personal Test column works normally. Group test writes are admin-only; followers can read group results.

Parameterize `ProgressShell`, `FrameworkProgressTable`, `ItemTestsCell`, summary/destination hooks and assessment history with explicit data source/capabilities. The actual presentation entry and additional-value layout are covered by Q2; storage and calculations do not wait for final geometry. No new dashboard is required.

### 9.5 Exact aggregate contract

**Superseded 30 October 2026 by the approved Phase 4 specification:** rounded percentage equality and all-skipped-as-completed are not valid completion classifications. For each active follower in a selected Step/Card/Deck scope, exclude skipped Steps. No eligible Steps means ineligible; all remaining explicitly done means done; some done/inProgress means doing; otherwise unstarted but eligible. Return `activeTotal`, `eligibleTotal`, `doing`, `done` and independent raw-weighted `confidence`. Hide follower counts when eligibleTotal is zero. A rounded percentage of 100 does not establish completion.

Group-context percentage/snapshot metrics are null with no eligible Steps. The existing personal percentage helper keeps its established all-skipped 100 display convention; explicit completion labels use a separate nonempty/all-done classifier. Framework read state `complete` describes calculation availability, not a completed learner. Skipping progress does not discard a valid confidence reading. Foreign DTOs remain allowlisted; corrupt required data is never counted as unstarted.

## 10. Group presentation and navigation

### 10.1 One physical scene, explicit perspectives

Introduce a thin group Deck adapter around the existing Card/Deck presentation, rather than mounting one `DeckDetail` per follower. It owns viewer-local `{experienceId, activeCardTemplateId, side: front/back, perspective}`. The main scene receives controlled active Card/side callbacks; ordinary personal callers retain current uncontrolled defaults. Refactor only the existing state seams needed in `DeckScene` and `FocusedCardView`.

All representations show the same selected Card and orientation. Perspective switching replaces authorized data/capabilities while retaining the main object's navigation/flip state. Keep existing transitions and geometry until approved. Media players, editor drafts, selected Info publication and pending uploads remain bound to their actual context, not merely the visible CardTemplate ID. Do not synchronize StepView position between people; close/preserve its local state through the existing safe transition rules.

An admin sees group, active follower and collapsed former-follower choices; an ordinary follower receives only self/group choices. Do not fetch a full peer Card for a follower and rely on hidden controls. Another user's tests and private content cannot be present in a hidden miniature or prefetched JSON.

Viewer navigation belongs to the viewer's member row. Inspecting a follower never writes that follower's active Card/openedAt/date. Group selection changes preserve the viewer's active Card if retained, otherwise choose the first remaining Card or null as existing Deck behaviour does. Front/back side remains viewer-local. No cross-user broadcast.

### 10.2 Prefetch, invalidation and editing

On entry fetch one composition and batched lightweight current-Card perspectives. For up to 20 followers, prefetch their allowed scalar data when the viewer is an admin. Preload the next/previous Card's lightweight summaries after the active one; larger rosters use batches of 20. Do not preload every Card × member × contribution list. Miniatures render public content/layout tokens plus allowed scalar values, without full scene/media/editor machinery.

Only the selected perspective activates contribution pages, Info consultation and heavy media. Preserve the existing main Card's approved instructional-video preparation; none is multiplied per miniature. A loaded perspective switch performs no blocking network request and does not remount the whole Deck scene. Work still in flight retains its captured target, and results are ignored by a different context. Do not carry a reflection draft from follower A to follower B because their Card IDs match.

Every successful own learning mutation invalidates affected personal/group/Framework views. Other members' activity arrives by polling: default 15 seconds while the experience is visible, one request in flight, stop while hidden, refresh immediately on focus, and back off to at most 60 seconds on failures. This is an engineering default within the approved modest-polling requirement, not a realtime promise. Poll lightweight summaries; refresh contribution pages only when their revision/count indicates change or on opening. Do not replace an open pinned Info snapshot on ordinary content polls.

### 10.3 Entry and visual approval

Reuse My Decks infrastructure for named experience entries, including admin-only access without manufacturing follower progress. Personal ordering/archive/restore stays personal; group entries expose only approved experience actions. A user who is both admin and follower receives one experience entry with the appropriate perspectives, not duplicate role tiles.

Q2 approves a compact design covering creation/name/member selection, admin-only discovery, miniature geometry, follower switching, Progress entry/additional metrics, removed-state indication, private-content overlap, older-media count and recipient controls. It is not permission for a new dashboard or management suite. Technical phases can proceed while those surfaces are reviewed, but their UI implementation waits for approval.

## 11. Media, reflections and Info Cards

### 11.1 Media storage, delivery and gallery

**Scope:** new group uploads write contribution/allocation rows, never `users.cardsData.mediaItems`. Own-follower media presentation combines the owner's existing private history with **that person's uploads in this experience**. The group perspective combines all experience uploads, including direct admin and former-follower uploads. Admin inspection shows the subject's experience uploads only. Another group's uploads are never included because the CardTemplate matches.

**Allocation/commit:** authorize current membership and creation capability, reserve a stable contribution ID and immutable uploader/scope, then obtain provider upload permission outside transaction retries. Bind the proof to actor, experience, Card, allocation ID, asset locator and purpose. Reserve an operation/ID before external work; retries reuse that operation or return its pending/committed state. Provider transfer completion does not itself attach content. Final commit rechecks current membership, reservation state, exact asset metadata and immutable scope, then marks attached and sets server `uploadedAt` once. A delete or membership loss prevents a delayed commit. Never trust client uploader/time or accept an arbitrary URL as proof.

**Provider boundary:** use a dedicated private R2 bucket/namespace with no public/custom-domain bypass for new group contributions and group Info media. A prefix in an already-public bucket does not supply privacy. Reuse S3 signing/provenance code and application streaming delivery; store trusted locators and serialize contextual application URLs. Never mint a public URL merely to satisfy the old `MediaItem.src` shape: adapt the group source at the viewer/delivery boundary. Existing personal/canonical references retain their compatibility reader.

Cloudflare documents independent public access through custom domains and `r2.dev`; blocking only one origin is insufficient. Verify all origins serving the new bucket. [Cloudflare R2 public access documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/)

New group Stream allocations must request and verify `requireSignedURLs: true` regardless of a legacy trial flag. Verify unsigned manifests/thumbnails/downloads are denied. Readiness/status, playback and download all authorize the contribution or exact Info publication first. Existing one-hour bearer-token behaviour is provisionally approved: removal stops fresh grants, while already-issued links may remain usable until expiry and downloaded copies cannot be recalled. This approval permits neither public group origins nor unsigned delivery. No instant-revocation claim.

Extend the existing asset-reservation denial pattern so legacy canonical/personal media endpoints cannot turn a group asset ID into an unrelated grant. Check reserved group assets at attachment and generic delivery boundaries, including Stream asset casing/normalization. A group asset cannot be transplanted into a personal or public Card by submitting its UID. Info asset reservations remain after deletion. Another admin reusing a saved admin-managed Info asset validates the recorded uploader/provenance; the actor need not equal the original uploader.

**Release condition:** real participant group media remains disabled until private-origin, signed-video and real browser CORS checks pass. The existing `INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL` cannot authorize group delivery. New private storage avoids bulk-changing shared legacy buckets. Historic private personal images remain subject to the documented legacy-origin risk; this feature does not claim to remediate those bytes. Their URLs/content are never newly disclosed through group projections. A broader legacy-origin hardening/migration requires its own scoped deployment decision.

**Ordering and pages:** assign new personal uploads an optional server timestamp as well, preserving old items. New group items use `(uploadedAt, contributionId)` as a stable total order. Query the newest five, reverse for display, and return total count/older cursor. Gallery pages are bounded to 30 metadata items; newest-right presentation uses stable item keys, not a mutable array index. Opening a thumbnail selects that ID in the page window. Older/newer navigation fetches adjacent pages; new uploads do not jump the selected item. Removal chooses the existing next-surviving-item rule.

Legacy personal items have no truthful upload timestamps. Preserve existing per-source relative order; undated historical entries form an older stable block before dated new uploads, with source/item tie-breakers. Do not infer upload time from CardData.updatedAt or invent historical dates. This compatibility rule cannot reconstruct lost cross-source chronology. In the rare own-private/group mix, label private items and preserve their typed source so their delivery/removal cannot be redirected to group APIs.

Keep existing one-to-five thumbnail geometry and full gallery interactions. The older count is `total − visibleCount`, with restrained placement approved in Q2. Store unlimited item counts; bound fetched metadata, decoded images and active players. Existing personal arrays remain in place, but use metadata projections/windowing for new group-owner endpoints rather than fetching their whole private history into every summary request. Selected-only image/video delivery, existing zoom/pan, download fallbacks and iPhone share remain acceptance requirements.

Removal immediately tombstones the scoped contribution and denies new application access. For an exclusively allocated group-contribution asset, follow it with bounded best-effort provider deletion as specified below. Neither action affects a separately uploaded personal copy or another group's upload. Keep a content-free allocation reservation against stale retry resurrection. Existing per-file/type/duration limits remain; there is no new item-count cap.

**Provider-deletion evaluation and decision (Phase 6, no provider work in Phase 1):**

| Issue | A — Logical deletion only | B — Logical deletion then provider deletion |
| --- | --- | --- |
| Complexity/reuse | Existing scoped tombstone/read checks only. | Small S3 `DeleteObjectCommand`/Stream DELETE adapters, timeout, durable cleanup state and retry. The live-media test already uses both primitives; no production delete helper currently exists. |
| Failure/interruption | App access reliably denied; asset remains indefinitely. | Commit tombstone first, then delete outside the transaction. Store pending/succeeded/failed cleanup state on the existing allocation. Crash or timeout leaves it hidden and retryable. |
| References | No physical-reference risk. | Delete only the exact dedicated contribution allocation with no other permitted reference. Never apply this to legacy/personal/canonical assets or Info assets shared across immutable publications. Keep group asset-transplant denial mandatory. |
| Retry | Logical deletion idempotent. | Repeated exact DELETE resumes cleanup, treating verified provider not-found as success; permissions/transport failures remain failures. Repeat after provider success but DB-ack failure is safe. |
| Infrastructure | None. | No queue service, scheduler or worker. Retry the same cleanup on a repeated delete; later authorized media mutations may perform one bounded pending cleanup. A documented operator retry can drain failures. No eventual-cleanup SLA without another request/operator action. |
| Signed links/privacy | Previously issued URLs can work until expiry; storage retained. | Physical removal may shorten access, but no immediate CDN/cache or downloaded-copy erasure guarantee. New app grants are denied before either provider result. |
| Testing/maintenance | App ACL/tombstone tests. | Add mocked success, not-found, timeout, interruption, duplicate retry, sole-reference and wrong-provider/asset tests; real deletion only for explicitly authorized disposable assets. |

**Choose B for dedicated group-media contributions.** The modest extra work is worthwhile for sensitive-content moderation. Use a short bounded provider attempt after logical deletion; cleanup failure must not undo the tombstone or report that application removal failed. Return logical deletion success plus internal cleanup state without inventing a new moderation dashboard. Retain locator/operation metadata for retry, not visible media content. Pending cleanup may persist if the process stops and no retry occurs; that limitation is explicit. Broader orphan collection, guaranteed background purge and physical Info/legacy asset deletion remain deferred.

Provider interfaces are documented by [Cloudflare R2 object deletion](https://developers.cloudflare.com/r2/objects/delete-objects/) and [Stream video deletion](https://developers.cloudflare.com/api/resources/stream/methods/delete/). No live calls or configuration changes were made for this decision.

### 11.2 Reflections

Use `groupReflections(experienceId,cardTemplateId,authorUserId)` for every member, regardless of role. A dual-role person writes the same row from either permitted entry. Group progress/confidence remains separate and is not coupled to this intentional one-person reflection rule.

Use immutable original `createdAt` as the chronological rule, newest first, with stable author/row-ID tie-breaks. Editing only updates text, updatedAt and revision; it never moves the reflection. Bob's Tuesday creation remains before Alice's Monday creation after Alice edits on Wednesday. Blank/cleared entries are absent. Retain the row's creation timestamp through clearing/re-authoring so one person/Card contribution is not accidentally recreated with a new carousel position. Display current username with a stable neutral fallback if the account no longer has one; never expose email/contact data. Retain author ID independently of display-name lifecycle.

Reuse the existing text fragment/editor, not a new reflection dashboard. A group carousel rotates every five seconds with a 200 ms opacity fade, pending visual approval in Q2. Tap or keyboard activation advances once and restarts the timer. Pause automatic movement while the document is hidden, the Card is inactive, or focus/editing is within the reflection area; reduced-motion disables fading and automatic rotation while retaining manual advance. Avoid repeating screen-reader announcements every cycle. The member's own group reflection remains tap-to-edit in self perspective; group display remains tap-to-advance. Admin Add/Edit targets the admin's own row, never a special group reflection.

The owner's existing private reflection is a separate source. Group edit controls always target the experience reflection; no private text is prefilled or copied. Q2 must approve the small own-view treatment when both exist, including the **Private** label and how the owner reads the private text in the existing area. Backend/source identity is fixed regardless of that visual choice. Another user's private reflection is never fetched for admin display.

Use revision-checked text replacement and clearing. Admin clear increments revision while retaining a tombstone/empty row; a delayed author Save at the earlier revision fails. The author can intentionally write a fresh contribution after reloading the current empty revision. Moderation is not an author ban and does not silently create one.

### 11.3 Info Cards: one feature, one identity, explicit audience epochs

**Purpose and ownership:** add `kind: group` inside the existing Info domain. Scope and original author never change; roots cannot be imported into canonical attachments or ordinary private-personal associations. New group notes created from either experience perspective stay group-scoped even when their audience is self. Existing private notes visible to their owner retain their permanent purpose and owner-only editing; no Share Existing conversion is offered.

At creation, record management class from current role: an admin-created root is admin-managed, otherwise author-managed. Dual-role admins create admin-managed roots; no extra management toggle. An author who remains a member can edit their own root. Current admins can edit any admin-managed saved root, but promotion does not turn earlier follower-authored roots into admin-managed content. Demotion does not remove original-author credit. Losing all membership removes group author/editor access; a retained root is not a personal ownership back door.

**Audience:** `self`, `group`, or an embedded deduplicated selected-member list, allowing current admins and followers as recipients. Both roles use the same recipient selector. Every admin can inspect every saved group root regardless of audience. Author/manager capabilities do not follow from receipt. Recipients cannot edit/delete the author's card. Selected relationships remain stored through membership removal and become readable again on rejoin if the author has not removed them; current membership always gates access. Group-wide membership is dynamic, including future joiners, without per-member copies.

**Pouches:** group-wide roots appear in the group and every member's applicable own pouch. A follower's own pouch also includes self/selected roots they author or receive. An admin's group pouch includes all saved group roots for that Card, with restrained audience information, providing inspection through the existing surface. Inspected-follower pouches can filter relevant authored/received roots, while the admin's general group pouch remains the route to all saved roots. Ordinary followers never receive this administrative superset. Preserve canonical Info references selected by the main Card version and owner-only private notes as distinct source descriptors.

**Private drafts and equal-admin editing:** `infoCardGroupDrafts` stores one private draft per editor/root. A second admin starts from the latest saved content, not another admin's unfinished draft. Reuse the existing editor/controller's content form, maths, media prerequisites, serial autosave, receipt recovery and local journal, parameterizing transport and draft identity. Autosave does not change audience or publish. Draft/media recovery checks current membership and editing capability; My Drafts never grants access after removal.

Each draft records its base saved content revision. Save uses CAS against that revision, atomically creates an immutable publication, updates the root and acknowledges the exact editor/draft-revision receipt. Concurrent editors do not silently overwrite each other; the losing draft remains recoverable with existing refresh/retry handling. Current admins cannot read a follower's draft, including through media/status/rendering diagnostics. Saved content may be moderated without reading unfinished text; deletion invalidates all drafts and retries.

Receipts bind operation kind, actor, root, exact draft revision or audience-command payload and expected saved revision. Reusing an operation identity with different recipients/content is a conflict, not a successful replay of an unrelated publication. Receipt lookup still checks current membership, root tombstone and capability before returning saved content. An audience-only command uses the root's next global source revision; private draft autosaves do not consume that publication identity.

**Historical publication access without per-recipient grants:**

1. Each group root has an integer `audienceEpoch`. Each immutable group publication records the epoch under which it was saved.
2. Normal content Save under the same audience retains the epoch. Current eligible recipients can finish viewing earlier pinned publications from that epoch, preserving ordinary open-pouch behaviour.
3. An audience change is an explicit commit against the current saved revision. Increment the epoch and create a new immutable version of the **currently saved** content under that epoch, atomically with recipient changes. Incomplete editor content is not shared. This internal version does not create a second Info identity or redate the root's original attachment.
4. Ordinary recipients may read only versions whose epoch equals the root's current epoch, plus current audience/membership checks. Original active authors and current authorized admin managers/inspectors may read saved content under their broader saved-content rights; draft access remains editor-only.
5. Removing/re-adding a selected recipient or self → group → self → group transitions advance the epoch. A fresh audience cannot request earlier private-era versions or their media by version number. A pure membership join does not change the root audience: group-wide historical content is intended for future members too.

Example: self v1 at epoch 0; share commits v2 at epoch 1; content edit v3 stays epoch 1, so an open v2 remains usable by current recipients. Return to self commits v4 at epoch 2, immediately denying recipients fresh v2/v3 grants. Share again commits v5 at epoch 3; recipients get v5, not the former private v1/v4. The root ID is unchanged throughout.

Audience changes invalidate old recipient snapshots even for recipients retained in the new audience. Reopen/authorized refresh resolves the same root's newest saved version; no new error dialog or sharing-management screen. This is a bounded cost of the simpler epoch design. Revocation is checked on fresh content/media requests; already-delivered text and bearer media cannot be erased. Content polling does not silently replace a pinned pouch; an explicit audience invalidation or acknowledged local operation uses the existing controlled replacement mechanism.

**Series, attribution and media:** retain the existing series field and `eligibleSeries` rules, including retained-series access. A different admin may keep the saved series; selecting a replacement uses existing eligibility. No per-group series namespace. Display original author, not the current publisher or series creator. Group publication validation accepts an authorized publisher without changing legacy `publishedByUserId === ownerUserId` checks for other purposes. Store actual uploader provenance; saved-asset reuse must match a group allocation and root/version, not a globally relaxed owner check.

Group media uses the protected origin and existing allocation registry machinery, with draft-editor versus saved-publication checks. Deny group assets in generic legacy media routes. Exact-version access enforces epoch even when the requested image also appears in an earlier private version. A newly shared version may intentionally reuse that asset; its **current** authorized reference grants access, not knowledge of its ID.

**Ordering, delete and compatibility:** root first-Save/attachment dates stay stable on content edits. Selected-recipient additions receive association dates; retain dates through mere membership removal/rejoin, and use a new date for author removal/re-addition. Group-wide first-share date applies consistently to later joiners. Existing mixed-pouch ordering and unavailable-slot handling remain. Author delete or admin moderation tombstones the one group root for every recipient; removing one recipient changes audience only. No hard provider deletion or modification of canonical/personal reference guards. Repeated receipt recovery must authorize before returning content and cannot reattach a deleted root.

## 12. Template versioning

### 12.1 Three views, one value map

Persist personal Step completion/readings as the existing union of known stable Step IDs. A selected content version defines which three values to display and aggregate. It does not own a separate set of values. Absent current Steps are todo/null; valid obsolete values are retained. Never copy a value by Step position or propagate values to a different CardTemplate/fork identity.

For v1 `[a,b,c]`, v2 `[b,a,c]`, v3 `[a,b,d]`, a change to `a` appears in every view. A change to `c` affects v1/v2; v3 ignores it. New `d` defaults and later becomes visible in any context selecting it. All Card/Deck calculations use their selected content's Steps; no global reconciliation may drop `c` when a group adopts v3.

This means “completed everywhere” holds for the same applicable Step identities. Different selected versions can have different percentages without separate personal progress. The API includes selected version; it never mislabels a projection as the user's independently adopted version. The Framework summary uses Q1's selected policy rather than averaging these views.

### 12.2 Review and adoption

Experience creation pins the reviewed public Deck and Card versions. Existing Card Update/Deck Update note/review components are reused with a group command transport. Only current admins, in group perspective, see/accept Update. Private historical versions are not selectable even by their creator inside the experience.

Card adoption atomically changes one experience selection. Deck adoption updates its composition/version, retains existing Card selections, selects reviewed public versions for new identities and reuses retained selections for reintroduced identities. Missing group rows project defaults. No loop writes follower personal adoption pointers, initializes follower learning or resets dates/tests/contributions. Retain removed Card selections and contributions for authorized historical references; do not add a new historical browsing UI without Q2 design approval.

Publishing through Library may continue updating the publisher's ordinary personal adoption as today. It does not modify any experience selection. Existing ordinary personal adoption reconciles the shared Step union with narrow writes and must preserve Steps introduced through groups, even if absent from the personal target content. This preservation is already the intended `reconcileCardUpdate` behaviour and becomes a regression invariant.

Adoption commands carry exact reviewed source/target/manifest and expected adoption revision. Reuse chronological notes, already-adopted/superseded results, public immutable-version checks and stable canonical-root locking order. Stale publication review refreshes explicitly; no automatic latest targeting. No canonical content is modified by group membership or adoption.

### 12.3 Writes during version changes

A new request resolves current membership and the context's selected version in its transaction. For a group request, validate the submitted version is public and no greater than the selected version. Accept a stale-display Step write when its stable Step ID is present in both that submitted version and the currently selected version, even if the numbers differ. This avoids failing unchanged Steps after every update. Reject removed Cards, unknown/reassigned Step IDs and a Step no longer present when the request is authorized; keep local intent for refresh rather than substituting a positional Step. Ordinary personal version/owner access retains its existing contract.

If adoption commits after a write has already read an authorized version, the stable-ID write may still commit and remain historical. It cannot change adoption or erase values; the new projection simply ignores removed IDs. This intentional commutativity avoids touching the experience adoption document on every scalar write. Membership revocation remains serialized through the member fence. A request through another still-authorized older personal/group context may legitimately change that older Step's shared value.

Group-owned state uses the same stable-ID projection and narrow mutation pattern. Concurrent personal adoption and group learning writes touch the same user's document, retry against fresh state and preserve both updates. Tests must demonstrate those interleavings rather than assuming that a local Update barrier coordinates other clients.

## 13. Membership and historical lifecycle

### 13.1 Creation, add and rejoin

Creation inserts experience/member metadata and the public manifest in one transaction. Deduplicate user IDs, make the creator an admin, independently apply requested follower roles and verify user existence. Use an operation ID so a lost response cannot create a second experience on retry. At the expected group sizes, this transaction is small and contains no provider operations or follower learning fan-out.

Adding/rejoining a follower updates the same member row and access epoch; it does not clone or reset personal learning. Retained group contributions and selected Info relationships remain associated. A rejoin uses current personal values and current experience selections. Historical removal values are no longer used as the active perspective. Prior assignment references remain eligible for the owner's Framework under approved Q1; the learning values still come from authoritative personal CardData.

No follow invitation or acceptance is inserted. User discovery initially reuses registered username/ID selection with bounded results; do not return contact details. More restricted eligibility/discovery/guardian workflows are already deferred and must be completed before their separately defined public release, not invented here.

### 13.2 Removal snapshot

In one transaction, authorize the admin, fence the actor and target member, read the current experience manifest, read only the target's selected Step completion/readings, write the snapshot rows/manifest, then mark follower removed and advance access epoch. Use defaults only for an authorized never-started assignment; corrupt state is a failure, not a fabricated snapshot. This is O(Cards) for **one** departing user, not O(all followers × Cards) on every adoption.

The snapshot represents the database snapshot observed by the removal command, with its recorded time and selected versions. It is not a forensic log of the last millisecond before commit. Independent personal activity concurrent with removal may fall before or after that snapshot; no later query follows the personal row. Group writes that race removal touch the same member fence and either commit before the removal snapshot or retry and lose authorization.

After removal, admin inspection never joins live personal state, including Framework/test/history helpers. It reads the manifest generation and frozen values plus current retained group contribution records. Later private progress, target-date/test changes and uploads in other contexts cannot alter this historical perspective.

If the group later changes Steps, keep the main viewer on the current experience Card as required. Show frozen values only for matching snapshot Step IDs; new IDs or a Card not assigned at removal are **unavailable/not assigned**, never invented todo/null history. Historical overall metrics use the removal manifest and are labelled with removal time/version. Do not present them as current follower aggregates. The small visual treatment is included in Q2.

Snapshot replacement on a later removal is atomic by generation. This V1 retains the latest removal state, not an unbounded join/leave timeline. Shared contributions retain their own authors/timestamps independently. A person still serving as admin after follower removal retains admin grants but is excluded from follower metrics. Removing their remaining admin role revokes those grants too.

### 13.3 Admin changes, deletion and account lifecycle

A structural revision and transactional `adminCount` update serialize concurrent final-admin removals. Role commands also update the affected member fence/epoch. Do not give the creator implicit fallback authority. Tests cover two admins removing themselves or one another concurrently.

Admin contribution deletion applies only to group media, group Info roots and group reflection clearing. Personal progress, confidence, target dates, tests and private content have no admin deletion endpoint. Group-owned assessment deletion follows existing assessment semantics. Moderation is deliberately restrained in existing affordances.

Deleting an account or closing an experience is not a new V1 user flow. Deployment must not enable an account-deletion path that silently removes the last admin or cascades private/shared data incorrectly. Retain stable author IDs and neutral display fallback. Broader erasure/retention and final-admin recovery policy is explicitly pre-release backlog work; existing account operations must fail safely where policy is not yet defined. No new primary-admin role or destructive cascade is introduced.

## 14. Performance and concurrency

### 14.1 Minimum protocol

Use a small group authorization repository wrapper with explicit operation class, not a generic permission framework:

- **Ordinary mutation:** transaction reads/updates the actor's member fence under the required role and access epoch, then performs the narrow target write. Role/removal commands update that same member row. A read-only membership check is insufficient to serialize revocation.
- **Structural mutation:** creation/membership/role/adoption commands CAS the experience structural/adoption revision as applicable and fence affected members. Acquire member rows in stable user-ID order, followed by target records; reuse canonical root order for adoption. Ordinary learning writes do not touch the experience document.
- **Shared content:** Info Save/audience/delete contend on the root revision; private autosave touches only that editor draft. Reflection text and assessment lists use their own CAS. Media commit/delete contend on one allocation/contribution reservation.
- **Reads:** authorize and project from one snapshot where a coherent membership/adoption/count result is required. Do not take write locks for every image or roster read. A request already authorized before revocation can complete; requests begun against revoked membership cannot obtain fresh content. Clients reject stale generations. Do not promise recall of already-delivered data.

Mongo documents that transaction reads can be stale and that modifying the relevant document establishes a write conflict with concurrent changes. The member fence applies that mechanism to revocation without serializing every follower on one experience record. [MongoDB transaction considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

Scalar completion/confidence uses narrow absolute writes and server commit order for same-field conflicts. Different fields cannot overwrite one another. The client serializes/coalesces its own field changes, merges acknowledgements only into their original target, and never restores a whole Card snapshot after failure. A repeated absolute set can be a later same-field write; it is not a historical event replay guarantee. Clear user intent/reload handling uses existing controls. Lists, text and destructive/moderation operations need CAS/receipts because retries could lose content or resurrect a deletion.

Unknown outcomes retry the same create/attachment/Save/structural operation identity. A confirmed commit followed by a read failure retries the read only. Provider calls, UUID/operation allocation and timestamps that define retry identity must not be regenerated on each Mongo callback retry. Provider completion is rechecked against current authorization before attachment.

### 14.2 Bounded work and measurable budgets

These are proposed implementation acceptance budgets, not measurements already achieved or product limits. Record machine/database configuration, warm-up, query plans and sample count with results.

| Check | Initial acceptance budget |
| --- | --- |
| Normal fixture | 20 followers, 3 admins, 12 Cards, personal overlap plus two experiences; 100 metadata contributions per Card, mixed removed members. |
| Batching fixture | 40 followers × 24 Cards, 10,000 media metadata rows on one Card; 300 registered users. This exercises more than one roster batch without designing for hundreds of simultaneous followers. No requirement to decode those assets. |
| Foreign learning projection | Zero private fields/tests/URLs in returned DTO or intermediate selected document; no full `getPersonalUser(subject)` call for admin/group summaries. |
| Query shape | No per-follower HTTP call. Database queries bounded by member/Card batches (100 IDs per database batch); no unbounded join of user media/tests. `explain` must use appropriate experience/member/contribution indexes. |
| Summary/perspective payload | At 20×12, initial lightweight response ≤250 KB uncompressed, excluding separately requested content/media pages; active-Card perspective batch ≤100 KB. |
| Summary latency | Warm disposable-replica-set p95 ≤300 ms repository time over 100 reads at 20×12; same-region staging end-to-end p95 ≤1 s. Report separately; mocks are not staging measurements. |
| Loaded perspective switch | No awaited HTTP request; p95 ≤100 ms interaction-to-next-paint in the approved browser fixture over 50 switches. No new main-scene mount per switch. |
| Media | Five thumbnail slots; at most 30 new metadata items per page; zero video players in miniatures; selected-gallery player only. Network tests assert no full-resolution fetch for every feed item. |
| Polling | At most one summary poll in flight, nominal 15 s visible interval, none while hidden; focus refresh and bounded backoff. |
| Concurrent workload | 20 independent followers each making 10 Step/signal writes plus membership/adoption interleavings; zero lost unrelated fields, unauthorized post-removal commits or duplicate personal rows. Record transaction retry distribution; normal local scalar p95 target ≤500 ms, staging ≤1 s. |

If a measured budget fails, first reduce projection/payload, add a justified index, batch or adjust polling. A batch size is not a total follower/media cap. No speculative aggregate cache/service is authorized by a failing microbenchmark alone.

Personal media arrays retain a practical document-growth limit. First use metadata projection and selected-field updates to keep group requests independent of those arrays. Commission a personal metadata migration only if representative **own-media** reads remain above 250 KB/page or p95 1 s despite bounded projections, or measured user documents approach 8 MB (an investigation threshold with headroom, not a user quota). Such a migration must preserve source IDs/order, every history/protected-media reader, rollback and old-client compatibility, and requires approval. Do not clear arrays merely to make one gallery query faster.

### 14.3 Deferred mechanisms

No staged follower provisioning, background aggregation, websocket synchronization, Redis, generic tenant/RBAC framework or personal-record migration is needed for the chosen model. Read-time computation remains O(active followers × selected Cards); missing expected scale targets triggers measured refinement. Media bytes and generic provider garbage collection remain outside the learning-data transaction model.

## 15. Phased implementation process

### 15.1 Operating rules and model choice

The contracts below preserve the ordered project sequence. Phases 1–3 and their separate implementation/handoff commits are complete. The later Phase 4 commission authorises dedicated-plan checkpoints 1–7 and 9 only, using disposable seeded experiences; checkpoint 8 creation/settings and later phases remain gated. No new commits, deployment, production-backed test writes, provider changes or materially different product design are authorised by that commission.

Use existing node/tsx integration tests with disposable Mongo replica sets, the seeded `scripts/test-phase2.ts` browser harness and current Playwright infrastructure. The normal development app connects to production Atlas; do not use it for fixtures. Read installed Next guides before code. Finish a phase's focused checks before advancing; repeat broader tests only when changes/failures justify them.

Available model IDs relevant here are **GPT-6 Astra** (`gpt-6-astra`) and **GPT-6.1 Sol** (`gpt-6.1-sol`). Both support High and Extra High (`high`, `xhigh`); Sol also suits Medium. Recommendations below are engineering judgments, not guarantees or measured cost comparisons. Use Astra High for the concentrated privacy/version/authorization work; Sol High for bounded integration and UI; Sol Medium for well-specified reflection work. Reserve Extra High for an unresolved cross-cutting defect or architecture revision, not every test/edit. [Astra model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra), [Sol model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

Each phase below states pre-start feedback, post-phase approval and automatic progression separately. A gate blocks only its dependent work. Phase 0 design review may continue while approved foundation phases run; unresolved miniature geometry does not block pure learning projection. A material new privacy trade-off, destructive migration or unexplained relevant test failure always stops the affected progression for review.

### Phase 0 — Record decisions, approve the visual contract and establish fixtures

- **Objective/dependencies:** record the approved Q1/Q3 policies and review remaining Q2 visual details. Depends on review of this plan, not an application change.
- **Scope/reuse:** review concrete static designs using existing Card, pouch, Progress, gallery and editor components. Approve the early slice separately from later recipient/reflection details if helpful. Define deterministic fixture identities: personal + two experiences, two admins, a dual-role admin, active/removed followers, unrelated/template-owner actors and v1/v2/v3 with retained/replaced Steps.
- **Likely files:** approved design document under `docs/design/features/group-experience/` during that future commission; focused fixture helpers in existing `tests/`/browser harness. This planning task creates neither.
- **Edges/automated checks:** reuse relevant existing personal reuse/adoption/Framework/Info/privacy baselines. Fixture assertions prove distinct private sentinel data and overlapping learning IDs; no mirror-of-implementation test framework.
- **Measurable acceptance:** approved highest-adopted-version/lifetime-eligibility and one-hour-link policies recorded; exact Phase 4 entry/switching/flip design approved; private-content/audience treatments approved before their UI phases; no unresolved choice encoded as a hidden default. Baseline failures are classified rather than silently inherited.
- **Manual:** product review of designs. No provider/device certification required at this point.
- **Risk/rollback:** designing every edge before any visible slice delays validation; approve only the surfaces needed next. No data rollback needed.
- **Gates:** user feedback **before affected UI/policy implementation**; approval **after design review**. Phases 1–3 may proceed within an approved technical commission while later visual details remain pending. Later gates are not waived by elapsed time.
- **Model/effort:** GPT-6.1 Sol, High.

### Phase 1 — Shared learning projection and safe client boundaries

- **Objective/dependencies:** isolate reusable personal learning logic from version/presentation identity. Depends on the accepted single-personal-record architecture and approved highest-adopted-version policy; Framework reader/UI integration remains in Phase 5.
- **Scope/reuse:** extract explicit-version Step projection/validation, narrow learning mutation helpers and guarded first-materialization; preserve ordinary personal caller contracts. Establish typed contexts and separate learning/contribution operation scopes. Add cross-context learning invalidation without allowing group/private payloads to share a DTO cache. Add max-version assignment-reference merge/storage foundations and preserve legitimate personal references before Deck removal. Experience materialization leaves date null and preserves existing dates; personal scheduling remains unchanged. No group creation, membership, APIs or UI.
- **Likely files:** `cards/{model,domain,repository,updateAdoption,workingCardStore,personalWork}.ts`, `useWorkingDeck.ts`, mutation clients; focused existing reuse/adoption/store tests.
- **Edges/automated:** personal v2/group v3/group v1 over one value map; new/replaced/reordered Steps; obsolete values retained; simultaneous first writes from two contexts; field-only writes preserve tests/media/reflection; account switch and late responses.
- **Measurable acceptance:** one stored personal row after competing materializations; writing Step `a` is visible in all selected versions containing `a`; no personal adoption/date/content fields change during group-style projection; group materialization does not initialize a date; legitimate personal Deck removal preserves unique highest-adopted references without restoring navigation; duplicate/corrupt rows fail; relevant personal regression selection passes.
- **Manual:** none beyond review of fixture projections; UI remains exercised by existing personal tests.
- **Risk/rollback:** broadening a legacy resolver can accidentally loosen privacy. Keep new context entry explicit; rollback is code-only before group enablement, preserving any additive optional fields.
- **Gates:** Phase 1 completed its handoff and mandatory stop. The user subsequently reviewed/committed it and explicitly authorized Phases 2–3.
- **Model/effort:** GPT-6.1 Sol, High.

### Phase 2 — Experience identity, roles, assignments and group learning

- **Objective/dependencies:** implement a correct usable group backend foundation. Depends on Phase 1 and approved identity/permissions.
- **Scope/reuse:** experience/member/group-state repositories, index readiness, public-manifest creation, named assignment listing, independent roles/final-admin protection, own-follower learning endpoints, group scalar endpoints, restricted active-follower projections and read-time aggregates. Reuse public preview validation, progress/confidence helpers, HTTP/auth and Mongo transaction wrapper.
- **Likely files:** proposed `src/lib/groupExperiences/{model,repository,authorization,readModels}.ts`, `/api/group-experiences/**`, existing cards learning helpers and isolated index setup; new focused integration/API tests.
- **Edges/automated:** duplicate create/retry, public root with private historical version, template owner without membership, admin-only/dual-role users, no-row defaults versus corruption, forged subject/context, zero followers/empty Deck/all-skipped values and raw confidence weighting.
- **Measurable acceptance:** one experience per operation ID; one assignment tile descriptor per experience/user; zero private sentinels in any foreign response; `10,2,2,2 → 4`; dual-role follower counted once; two concurrent last-admin removals cannot produce zero admins; group and personal writes remain independent where required.
- **Manual:** inspect fixture roles/DTOs; no live database setup.
- **Risk/rollback:** member/role authority must be complete before exposing UI. Keep feature entry disabled until Phase 3; preserve group rows on rollback and deny unknown group kinds.
- **Gates:** no additional feedback within approved design. Acceptance and relevant regression checks must pass, then create the required separate Phase 2 commit before proceeding automatically to Phase 3. Follower removal snapshots/rejoining remain Phase 3; Phase 2 exposes addition and independent admin-role changes only.
- **Model/effort:** GPT-6 Astra, High.

### Phase 3 — Adoption, removal snapshots and lifecycle races

- **Objective/dependencies:** make the foundation safe under membership/version changes before the visible slice. Depends on Phase 2.
- **Scope/reuse:** experience Update review/accept, stable-ID concurrent writes, removal snapshot/manifest, add/rejoin, retained contribution authority, structural/member fencing and exact retry outcomes. Reuse existing update notes/publication guards; no follower adoption or initialization fan-out.
- **Likely files:** group repositories/adoption/lifecycle modules, group Update routes, existing public version access helpers; deterministic replica-set tests.
- **Edges/automated:** adopt versus same/removed Step write, add versus new Card adoption, removal versus own write, remove/rejoin/remove, former snapshot versus independent private progress/test/media changes, simultaneous role changes, empty/new/reintroduced composition.
- **Measurable acceptance:** adoption writes zero follower personal adoption fields; changed shared values survive every tested ordering; fresh unauthorized writes fail after removal; later private activity changes no former-follower response; no snapshot contains tests/private metadata; rejoin shows current personal values rather than copying the snapshot back.
- **Manual:** inspect exact review results and removal labels/data in fixture responses. No claim of measured production contention.
- **Risk/rollback:** membership transitions and snapshots must commit together. A failed transaction leaves the prior membership usable; rollback never clears learning/contributions. Existing participant data must not be opened by an older reader.
- **Gates:** acceptance and relevant regressions must pass before the separate Phase 3 commit. Commit the consolidated handoff separately and stop. Phase 4 requires new explicit authorization and its UX approval.
- **Model/effort:** GPT-6 Astra, High.

### Phase 4 — Early synchronized-perspective vertical slice

- **Objective/dependencies:** validate the physical Card experience early. Depends on Phases 1–3 and approved creation/entry/perspective design.
- **Scope/reuse:** seeded experiences sharing public Cards, real shared personal/group learning, named My Decks entries, one main Card scene, Group/self and authorised peer switching, compact ordinary list/focused comparison grid, shared active Card/front/back, front/back progress and confidence, lightweight prefetch and visible-page authority leases. Fixture media/empty pouches are acceptable; do not claim later contributions are complete. The dedicated Phase 4 specification and plan govern the initial slice; creation/settings follows iPhone review under a new instruction.
- **Likely files:** `AppShell`, `DeckDetail`, `DeckScene`, `FocusedCardView`, presentation types, proposed `GroupExperienceDeck` adapter/hooks, group summary transport and browser fixtures.
- **Edges/automated:** same Deck in personal/A/B, dual-role single tile, Card traversal/flip retained through switching, follower peer access denied Off and narrow/read-only On, pending write while switching, role loss, account switch, zero/many followers and unloaded batches. Correct all-skipped and rounded-100 classification at Step/Card/Deck and snapshot boundaries.
- **Measurable acceptance:** one heavy scene; zero miniature video players; no network wait for already-loaded switches; selected Card/side unchanged across 50 switches; same personal Step change appears in personal/A/B; independent group value unchanged; no Creator/fork/follower Update action or callable unauthorized endpoint.
- **Manual:** founder reviews desktop and phone-sized slice for object continuity and interaction direction before additional UI builds on it. This is a genuine acceptance gate, not a demand for full media completion.
- **Risk/rollback:** remounting resets editors/flip state. Keep legacy personal defaults covered; disable group entry to roll back without deleting records.
- **Gates:** UX approval **before**; early-slice acceptance **after**. Do not advance dependent presentation work automatically until accepted. Approved independent backend work can continue.
- **Model/effort:** GPT-6.1 Sol, High.

### Phase 5 — Personal Framework, group Progress and assessments

- **Objective/dependencies:** connect shared learning to the existing hierarchy and private tests. Depends on Phases 1–3, the already-approved Framework policy and approved Progress entry/layout; reuse Phase 4 navigation.
- **Scope/reuse:** eligibility union/deduplication, selected summary version, owner-only retained assignments, group-only destinations, own personal test creation from group context, group Card/Item test storage and transports, restricted inspected Progress. Reuse Framework mapping/calculation and existing assessment/history contracts.
- **Likely files:** `frameworks/{eligibility,calculations,readModels,destinations,progressClient}.ts`, `assessments/{contracts,repository,historyClient}.ts`, Progress components, group progress/assessment routes and tests.
- **Edges/automated:** group-only never-opened Card, personal + two groups, different versions, archived/removed membership, inherited mapping, Card/Item test history source deduplication, template fork, missing mapping/row, admin-only viewer and self-inspection.
- **Measurable acceptance:** every legitimately assigned Card participates even after personal/group Deck adoption removes it or the follower leaves; duplicates count once; highest explicitly adopted version wins, never a newer unadopted publication; retained references grant no old Deck/group navigation; personal Card/Item test totals retain owner-only semantics; zero personal-test fields/counts in foreign routes; group tests never change a user's Framework result; Area totals derive from raw unioned Card data, not averaged Item scores.
- **Manual:** check the approved existing hierarchy/column treatment; no separate dashboard.
- **Risk/rollback:** an incorrect eligibility extension silently changes overall learning totals. Keep ordinary-only fixture results identical; new reader rollback must not drop already-assigned group learning without explicitly disabling the feature.
- **Gates:** Progress UX approval **before**; Q1 is settled. No routine post-phase approval if the approved presentation and tests pass; proceed only within a future commission covering the next phase.
- **Model/effort:** GPT-6.1 Sol, High.

### Phase 6 — Protected group media and allocation lifecycle

- **Objective/dependencies:** establish secure storage/access for both contributions and group Info assets. Depends on membership/authorization foundation, not on gallery UI completion.
- **Scope/reuse:** private group R2 locator/delivery adapter, signed Stream allocation, immutable scoped upload proofs, contribution reservations/commit/tombstone, bounded provider deletion with durable cleanup status/retry, processing/download access and anti-transplant checks. Reuse existing provider/registry, delivery and test-cleanup primitives; mock providers in ordinary tests. No cleanup worker/service.
- **Likely files:** group media repository/routes, `cards/{media,uploadAuthorization,protectedMedia,mediaProviders}.ts`, `cloudflareR2.ts`, `cloudflareStream.ts`, `cardMediaAccess.ts`, Info asset registry/media adapters and focused tests.
- **Edges/automated:** allocation then removal, delete then delayed commit, duplicate commit, forged uploader/time/asset, group A→B/personal/canonical transplantation, old direct route, Info draft versus saved scope, aliases/casing, unavailable provider, logical-success/provider-failure, crash/retry, verified not-found and rejection of shared/legacy asset purge.
- **Measurable acceptance:** every group media read/status/download requires current scope; reservation cannot reattach after deletion; new group video requests signed-only even under legacy trial configuration; group image path never returns a public fallback. At least one denial test per alternate delivery/attachment route class.
- **Manual:** prepare exact bucket/CORS/unsigned-denial and disposable-asset deletion checks. Real provider operations remain separately authorized and may wait until Phase 11; no participant assets before protection passes. The one-hour video-link lifetime is provisionally approved.
- **Risk/rollback:** changing shared legacy buckets could break other content. Use dedicated group storage; retain registry denials on rollback. Do not bulk-change historical Stream assets.
- **Gates:** no additional feedback for specified code/mock work. Provider authorization/verification remains a real-use gate; Q3 is settled. A future commission may proceed to Phase 7 with mocked fixtures.
- **Model/effort:** GPT-6 Astra, High.

### Phase 7 — Media collections and existing gallery integration

- **Objective/dependencies:** deliver unlimited stored media with the approved five-thumbnail presentation. Depends on Phase 6 and approved older-count/private-source treatment.
- **Scope/reuse:** chronological metadata pages, newest-five selection, total/older count, own-private/own-group source composition, admin inspection filtering, selected-item gallery navigation and scoped removal. Reuse existing thumbnail layouts, upload controller, media viewer, download/share fallback; keep personal storage compatibility.
- **Likely files:** media contribution reader, `BackCardMediaCarousel`, `UserCardMediaUploadPanel`, keyed uploader/queue, `WorkingCardMediaViewer`, gallery layout and image/video components, media source types.
- **Edges/automated:** 0/1/5/8/10,000 metadata items, timestamp ties, cursor insertion/deletion, opening upload 6 then paging older, private ancestor sources, pending upload during perspective change, former contribution retention and signed-link expiry.
- **Measurable acceptance:** eight items render 4–8 left-to-right, newest right, older count 3; gallery reaches all eight; metadata requests bounded to 30; private items never appear in group/admin responses; only selected gallery video plays; existing personal mobile/download tests pass.
- **Manual:** desktop/phone-sized upload/view/remove; physical iPhone/Safari download/share acceptance is recorded in Phase 11. No claim that Chromium proves native share.
- **Risk/rollback:** source confusion could delete private/foreign content. Stable typed source identities are required; rollback preserves assets and normalized contribution records.
- **Gates:** UX approval **before**. No routine post-phase permission if approved checks pass; automatic progression permitted, with device/provider release gates outstanding.
- **Model/effort:** GPT-6.1 Sol, High.

### Phase 8 — Group Info identity, drafts, sharing and media authorization

- **Objective/dependencies:** extend the existing Info domain safely. Depends on Phases 2–3 and 6; no new sharing screen required for backend work.
- **Scope/reuse:** immutable group purpose, author/management class, embedded audiences, admin saved-content inspection, private per-editor drafts, audience-epoch publications, exact receipts, same-root sharing, deletion and recovery. Reuse current validation/series/maths/publication/provenance machinery with group-specific policy branches.
- **Likely files:** `infoCards/{model,domain,repository,queries,media,mediaRegistry}.ts`, proposed group draft adapter, existing Info routes with explicit group commands and group consultation route, indexes and integration tests.
- **Edges/automated:** full self→selected→group→self timeline; new/re-added recipients; content save with same epoch; audience save with pending private draft; removed author/admin; role promotion/demotion; two admins' private drafts and concurrent Save; original-author series/media retained by second admin; delete versus Save/receipt.
- **Measurable acceptance:** one root for five recipients; all admins see saved self/selected roots, zero other-editor drafts; followers cannot edit received content; admin cannot edit follower root; prior-epoch recipient media denied; same-epoch pinned media survives ordinary edit; legacy private Personal Info tests unchanged.
- **Manual:** inspect fixture authority/receipt outputs and original-author attribution; provider origin evidence remains the Phase 11 release gate.
- **Risk/rollback:** unknown-purpose fallthrough and broad owner-check removal are severe risks. Add explicit group branches, keep unknown kinds denied; rollback retains purpose/asset denials and draft data.
- **Gates:** no new product decision is delegated to implementation. No routine pre/post approval within this specification; proceed automatically to Phase 9 only when its UX gate is satisfied.
- **Model/effort:** GPT-6 Astra, High.

### Phase 9 — Pouch/editor sharing integration

- **Objective/dependencies:** expose group sharing through existing Info interactions. Depends on Phase 8 and approved recipient/audience/admin-inspection/Private treatment.
- **Scope/reuse:** parameterized existing editor/controller, recipient selection, group/self/selected consultation sources, all-saved admin pouch, exact source/capability validation, My Drafts recovery and controlled pinned-snapshot replacement. Preserve maths, geometry, media position, author credit and existing three-dot menu.
- **Likely files:** `InfoCardEditor`, editor controller, consultation client/view, pouch hooks, My Drafts loader/links, `FocusedCardView` group adapter and browser tests.
- **Edges/automated:** first Save, incomplete autosave, Cancel/reopen, edit received card denied, admin edits saved admin-managed card with another draft pending, epoch change while open, selection after delete, same Card in two experiences, account/removal mid-edit and private legacy note editing.
- **Measurable acceptance:** editor/pouch remains mounted according to existing contract; selected root identity survives authorized edits; no extra Info-management screen/toggle; recipient changes affect only current authorized audiences; draft recovery cannot reopen revoked group access; all existing personal Info regression journeys pass.
- **Manual:** approve the implemented restrained sharing/Private treatment against Phase 0 design. Real device checks may combine with Phase 11.
- **Risk/rollback:** frontend owner validation may reject legitimate foreign-authored reads or accept too much. Keep discriminated sources/capabilities; disable group entry rather than broadening legacy checks.
- **Gates:** UX approval **before**. Post-phase feedback is conditional on a material visual departure; otherwise proceed automatically.
- **Model/effort:** GPT-6.1 Sol, High.

### Phase 10 — Member reflections and carousel

- **Objective/dependencies:** implement the fully specified reflection data model and approved minimal controls. Depends on membership/contribution authorization and Phase 4 presentation; visual details/private overlap approved under Q2.
- **Scope/reuse:** unique per-person group reflection, chronological feed, author edit/admin clear, existing-position carousel, username attribution, timer/fade/accessibility, own-private source distinction. Reuse reflection text/editor components and scoped queue machinery.
- **Likely files:** group reflection repository/routes, `BackCardReflectionFragment`, `WorkingFocusedCardView` adapter, group carousel hook/component and focused tests.
- **Edges/automated:** dual-role same row, blank/one/many items, edits never reorder, immutable creation timestamp through clear/re-authoring, former retention, delete versus delayed Save, pointer/keyboard propagation, hidden tab/inactive Card, reduced motion, perspective change during editing.
- **Measurable acceptance:** one reflection per person/Card/experience; no private text in feed; original creation newest first; Bob Tuesday precedes Alice Monday after Alice edits Wednesday; updatedAt/revision change without createdAt/order changes; tap advances only in group display and edits own reflection in self display; timer pauses correctly; admin clear cannot be undone by stale revision; no sliding animation.
- **Manual:** review readable attribution, gentle fade and approved Add/Edit/clear placement on desktop/mobile.
- **Risk/rollback:** editor identity mistakes overwrite the wrong source. Server tuple and client captured target must agree; rollback preserves text/revisions and disables the carousel surface.
- **Gates:** UX approval **before**; no routine post-phase approval after matching the accepted design/tests. Proceed automatically to integration.
- **Model/effort:** GPT-6.1 Sol, Medium.

### Phase 11 — Integrated acceptance and release readiness

- **Objective/dependencies:** prove the combined feature, operational prerequisites and rollback. Depends on every implemented phase and resolved applicable Q1–Q3 gates.
- **Scope/reuse:** run targeted combined regressions, typecheck, scoped lint and standard build; verify API privacy and browser journeys with existing harnesses; measure §14 budgets; document indexes/configuration, provider verification, account-lifecycle restrictions and rollout/rollback. No unrelated refactor or new test framework.
- **Likely files:** group integration/browser suites, current test harness, operational checklist and accepted plan/handoff during implementation. Any defect fixes stay within the approved feature scope.
- **Edges/automated:** personal/A/B overlapping Card across three versions; owner private sentinels; active/removed/rejoined and demoted admin; open editors/uploads during removal/adoption; independent personal activity after removal; many metadata pages and all legacy delivery bypasses.
- **Measurable acceptance:** zero known isolation/retry/data-loss failures; all required suite/build checks green or an explicit approved unrelated exception; recorded payload/query/render/concurrency budgets; idempotent indexes verified on disposable data; no unapproved schema/provider migration; rollback reader preserves denial rules.
- **Manual:** actual iPhone/Safari upload, image zoom, video, native download/share, Card flipping/perspectives and Info/reflection interactions. Separately authorized provider checks must prove browser CORS, anonymous origin/unsigned-video denial and authorized reads. Verify final-admin/account operations fail safely. Record actual results rather than inheriting old handoff claims.
- **Risk/rollback:** an old build can ignore group scope; the rollback build must retain purpose/asset denials and may disable group entry. Never clear personal/contribution data to roll back a UI.
- **Gates:** permission for specified provider/live-index/deployment work and manual device acceptance is required before real participant rollout. Automated checks may run without another routine confirmation. **No automatic deployment or real-use enablement.**
- **Model/effort:** GPT-6.1 Sol, High; escalate a demonstrated architecture/privacy failure to Astra High/Extra High with a concrete problem statement.

## 16. Automated tests and acceptance strategy

### 16.1 Required fixtures and invariant assertions

Use at least two experiences containing the same public Card, an independent personal Deck, a second Card/fork, three public content versions, one private historical version, two admins, an admin who follows, active/removed/rejoined followers, an unrelated actor and a template creator without membership. Seed unique sentinel strings/asset IDs/test results into each person's private content so a broad projection cannot accidentally pass an empty-fixture privacy test.

| Area | Required assertions |
| --- | --- |
| Personal identity | Concurrent personal/group first creation yields one embedded row. A common Step mutation is visible across selected versions containing it. No group adoption changes personal pointers, target dates or private fields. |
| Version projection | Reorder preserves values; replacement defaults only the new ID; old values survive; selected-version percentages may differ appropriately; no Step-position copying. Unauthorized/unknown version and removed-Card writes denied. |
| Admin/peer privacy | Foreign reads never contain personal tests, counts, dates, reflection/media/Info IDs, private timestamps or history pointers. Own reads retain those sources with Private identification. Query spies/assertions verify narrowed database projection as well as response shape. |
| Groups | A/B contribution references, upload proofs, drafts and direct media URLs cannot cross contexts. Group-owned values/assessments remain independent from personal values. |
| Roles | Equal admins, final-admin concurrency, creator without role, dual-role counted once, follower removal with remaining admin role, later admin loss and current authorization on every endpoint class. |
| Aggregates | Before-join completion counts; active-only denominator; zero followers; skipped/all-skipped/empty cases; rounded-100 behaviour; `10,2,2,2 → 4`; nulls and all-unset; no averaging of follower means. Missing corrupt data reports incomplete. |
| Framework | Group-only eligibility without personal Deck; duplicates deduped; Q1 version rule; retained removed references owner-only; no unrelated orphan expansion; private tests counted once; group tests excluded; existing mapping/fork/Area unions unchanged. |
| Assessment authority | Own group-created test writes the same personal list; admin foreign test endpoints fail; group Card/Item lists have independent revision/IDs; stale add/delete retry cannot recreate a test. |
| Media | Eight→five newest chronology/rightmost selection/count; all older items reachable; page ties/new inserts/deletes; correct own/private/inspected feed; uploader immutable; timestamp server-assigned once; no full-feed player/image fetch. |
| Info | Both roles select subsets; all admins read saved self/selected; author management versus admin-managed exception; other-editor drafts secret; one shared root; group-wide new join; epoch timeline; removed/re-added recipient; saved-asset reuse/provenance; legacy private notes unaffected. |
| Reflections | Unique tuple includes author, not role; no duplicated dual-role reflection; original creation chronology unaffected by editing; attributed former text; own edit versus group advance; CAS clearing; private overlap never copied. |
| Removal history | Change live personal progress/tests/media after removal and assert former response unchanged. New group Steps show not-assigned/unavailable. Rejoin reads live learning without restoring old snapshot values. |
| Client | Same Deck identity in personal/A/B; actor/subject separation; controlled active Card/side; original-target pending mutations; no private cache reuse after role/account change; polling doesn't overwrite local drafts or pinned Info content. |
| Provider | All app routes covered by mocks, then separate real-origin/unsigned denial and upload CORS verification. No flag or mock test alone certifies provider privacy. |

### 16.2 Deterministic interleavings

Integration tests explicitly pause one transaction/operation at the relevant boundary and run the competing command, then release it. Cover both orderings of removal/upload commit; removal/Info Save; audience change/exact-media read; delete/receipt retry; last-admin removals; join/adoption; adoption/same-Step and removed-Step write; personal adoption/group learning write; different-field admin writes; two admin Info Saves; clear/reflection Save; and account/context switch/late response.

Assert final stored values and authority, not merely HTTP status. A successful stale read already authorized before removal is different from an unauthorized **new** grant after removal. Snapshot reads are not retroactively cancellable; the tests must reflect the stated contract. No test may use production Atlas or real provider assets without explicit operational authorization.

### 16.3 Existing regression selection

Reuse and extend `card-reuse.integration.ts`, `personal-lifecycle.integration.ts`, `update-adoption.integration.ts`, `frameworks.test.ts`, `framework-readers.integration.ts`, `frameworks.integration.ts`, `assessments.integration.ts`, `assessment-history.test.ts`, `personal-history-projection.test.ts`, `personal-info-cards.integration.ts`, `info-card-attachments.integration.ts`, `info-cards-api.integration.ts`, `info-cards-media.test.ts`, `info-card-consultation-client.test.ts`, `info-card-editor.test.ts`, `card-media-access.integration.ts`, `protected-media.integration.ts`, `card-media-viewer.spec.ts`, `keyed-user-card-media-upload-controller.spec.ts` and signal/rollback browser suites according to changed modules.

Add focused group suites instead of forcing every new scenario into old personal tests. Retain existing real-component pouch/geometry/maths/activity tests and personal Creator/Library/My Decks journeys. The final combined check includes typecheck, relevant lint and standard build. Do not change expectations merely to mask a regression; any intentional product change must trace to this contract or an explicit approval.

## 17. Risks, trade-offs and deferred work

| Risk/trade-off | Decision, classification and boundary |
| --- | --- |
| Shared personal learning across differing content versions | **Essential now:** explicit-version projection and shared stable-ID values. Percentages may differ across versions. Highest explicitly adopted version and lifetime assigned eligibility are approved; Phase 1 preserves reference evidence, Phase 5 integrates summaries. |
| Private fields accidentally exposed by reused working DTO/cache | **Essential now:** foreign database projection allowlist, separate group DTO/cache, true session actor and adversarial sentinels. No full personal DTO sanitization shortcut. |
| Subsequent private activity exposed after removal | **Essential now:** small removal snapshot and owner-only retained assignment references. Latest-removal snapshot only; no general activity/event system. |
| Pinned Info versions versus evolving recipients | **Essential now:** audience epochs and saved-version checks. Audience changes invalidate old recipient snapshots; ordinary edits preserve them. This trades per-recipient history precision for a smaller, testable policy. |
| Equal-admin editing versus draft privacy | **Essential now:** per-editor group drafts within existing Info feature, saved-version CAS and actual publisher/uploader attribution. No shared access to incomplete drafts. |
| Public legacy origins | **Essential now for new group assets:** private group storage and signed video. Legacy personal bytes are not migrated or certified. Separate broader hardening remains explicit pre-release work. |
| Same-user document contention | **Accepted existing trade-off:** personal learning remains in one user document, so that user's concurrent contexts serialize at storage. Narrow writes/retries preserve fields; independent followers do not all touch the experience document. |
| Group scalar simultaneous edits | **Cheap and worthwhile now:** absolute narrow setters, server commit order and local field queues. Text/list conflicts use CAS; no general collaborative editing system. |
| Personal media growth | **Deferred migration with evidence gate:** metadata windowing and §14 thresholds first. Any eventual cutover needs complete source/history/delivery compatibility and approval. |
| Retained deleted/group assets | **Modest cleanup in Phase 6:** tombstone first, then bounded provider deletion for exclusively allocated contributions, with durable retry state and retained anti-bypass reservations. No purge of legacy/shared Info assets; no general cleanup infrastructure or guaranteed background retry. |
| Scale beyond expected pilot | **Cheap now:** indexes, batching, bounded pages/prefetch and polling. Materialized aggregates/background infrastructure wait for measured failure after query improvements. |
| Unfinished creation/recipient/overlap design | **Required UX gate:** backend contracts fixed; concrete surfaces approved before their phases. Early slice prevents late discovery that scene reuse feels wrong. |
| Release/account/safeguarding gaps | **Deferred pre-release policy, not relaxed ACLs:** controlled discovery, eligibility, guardian consent, organisation verification, retention/erasure and admin recovery. Existing destructive account operations fail safely; real-use media protection is a separate mandatory release gate. |

Formal Groups/Organisations, private-template distribution, repeated runs, follower test assignment/marking, automatic test aggregation, realtime classroom control, new group deadlines, private-to-group content conversion and universal learning-store migration remain out of scope. Future Groups reference stable experience IDs; future deadline fields remain separate from personal target dates; future assignment tests receive separate ownership/contracts rather than repurposing private tests.

## 18. QUESTIONS / approval requirements

### Q1 — Approved: Framework version basis and lifetime eligibility

Resolved by the final corrections: one calculation per CardTemplate, using the highest version legitimately adopted by a personal/group assignment, including retained references after Card removal or follower removal. No unadopted latest publication, extra learning record, historical navigation grant or new browser. Phase 1 records the foundations; later authorized phases complete group metadata and Framework integration. No further product decision is requested.

### Q2 — Approve the concrete existing-component visual integration

**UX approval in small batches; blocks the corresponding UI phases only.** The initial Phase 4 perspective/flip design and seeded scope are approved in the dedicated specification, including front/back progress/confidence. First review/refine on iPhone, then implement the already-designed creation/name/member/settings workflow under a new instruction before Phase 5. Phase 5 still needs Progress/assessment integration approval. Phases 7, 9 and 10 need the older-media indicator, Private treatment for overlapping owner content, recipient/audience controls, admin saved-Info inspection and restrained reflection editing/clearing/rotation.

Recommended approach: approve one static existing-component specification for each batch, then test the early working Card slice before advanced UI. Keep the existing physical Card, five-thumbnail arrangement, pouch/editor, table hierarchy and reflection location. No dashboard, new Card geometry, new sharing-permission switch or novel gesture is assumed. The removal snapshot's time/version/unavailable treatment is included so frozen values are not presented as live progress.

### Q3 — Provisionally approved: one-hour signed video links

Resolved by the final corrections: reuse the existing one-hour signed Stream URL lifetime. Fresh grants are denied when authorization is revoked; previously issued links may remain usable until expiry and downloaded copies cannot be recalled. Protected group image origins, signed-only video and provider verification remain mandatory. This approval does not authorize provider operations, deployment or real participant enablement.

### Technical decisions resolved by this plan

No further user decision is needed for persistent experiences without formal Groups, one personal learning store, sparse group state, virtual unstarted defaults, member-level write fences, removal snapshots, embedded recipient lists, audience epochs, private per-editor group drafts, author attribution, original-createdAt reflection order, raw signal-weighted integer means, page/batch sizes, visible-page polling, private group storage, scoped tombstones or the existing assessment data shape. Implementing agents may refine internal names/indexes after query evidence without changing these contracts.

### Already-deferred pre-release work and operational approvals

Eligibility/discovery restrictions, organisation verification, participant/guardian consent, minors policies, comprehensive retention/erasure and final-admin recovery are already assigned to pre-release backlog work. Do not ask the user to re-decide their inclusion in V1, and do not build an Organisations system to unblock the technical foundation.

Provider setup/verification, live index installation, actual device acceptance and deployment are concrete operational gates. Prepare exact reviewable changes/checklists before seeking that authorization. Core ACL/privacy tests apply from Phase 2; operational uncertainty never justifies exposing real group assets through a public trial bypass.

### Final implementation phase table

The current commission authorizes Phases 2 and 3, with a tested implementation commit at each boundary and a separate consolidated handoff commit. Stop after Phase 3. Later automatic-progression entries describe possible future commissions and do not grant permission now. Deployment/provider operations always require their own operational authorization.

| Phase | Scope | Recommended model | Reasoning effort | Automated acceptance gate | User feedback required? | May proceed automatically? |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Decisions, visual contract, fixtures | GPT-6.1 Sol | High | Relevant personal baselines; privacy/version fixtures defined | Yes — product/UX approval for affected phases | No for gated UI/policy; approved foundations may proceed |
| 1 | Shared learning projection and client boundaries | GPT-6.1 Sol | High | One row; three-version projection; private fields/dates protected; retained references | Completed, reviewed and committed | Gate satisfied by explicit Phase 2–3 commission |
| 2 | Experience, roles, assignments, group learning | GPT-6 Astra | High | Role/DTO isolation; unique retries; counts/means; final-admin invariant | No — fully specified | Yes, after passing tests |
| 3 | Adoption, removal history, lifecycle races | GPT-6 Astra | High | No adoption fan-out; frozen former reads; deterministic race tests | Review consolidated handoff before further authorization | **No — commit Phase 3 and handoff, then stop** |
| 4 | Early synchronized-perspective slice | GPT-6.1 Sol | High | Shared Card/side; isolated capabilities; one heavy scene; switch budget | Yes — UX before, slice acceptance after | No, requires slice acceptance for dependent UI |
| 5 | Framework, group Progress, assessments | GPT-6.1 Sol | High | Lifetime assigned inclusion; highest adopted version; deduplication; test privacy | Progress UX only; Q1 approved | Future authorization required |
| 6 | Protected group-media lifecycle | GPT-6 Astra | High | Scoped commit/tombstone/purge retry; anti-bypass; no public fallback | Provider operations/verification; Q3 approved | Future authorization required |
| 7 | Media collections and gallery | GPT-6.1 Sol | High | Newest five; all items reachable; bounded requests; source isolation | Yes — UX before; device acceptance at release | Yes, after passing tests |
| 8 | Group Info domain and authorization | GPT-6 Astra | High | One root; private drafts; epoch/receipt/role/media tests | No — fully specified | Yes, subject to Phase 9 UX approval |
| 9 | Pouch/editor sharing integration | GPT-6.1 Sol | High | Existing editor/pouch continuity; recipient and Private boundaries | Yes — UX approval before implementation | Yes, after approved UI tests pass |
| 10 | Member reflections and carousel | GPT-6.1 Sol | Medium | Unique author row; chronology; fade/tap/pause; clear CAS | Yes — UX approval before implementation | Yes, after passing tests |
| 11 | Integrated acceptance and release readiness | GPT-6.1 Sol | High | Combined regressions/build; privacy races; measured budgets | Yes — manual device and operational acceptance | No automatic deployment or participant rollout |
