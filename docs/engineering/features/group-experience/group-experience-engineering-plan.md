# Group Experiences — Final Engineering Plan

**Status (1 November 2026):** Phases 1–4 are accepted and committed. Phase 5 Checkpoint 5.0 is a completed, visually reviewed fixture prototype. The founder has approved the revised Phase 5 scope, contextual navigation, assessment visibility/provenance, capabilities and skipped-state requirements recorded here. The current commission authorises sequential implementation and one commit each for 5.1a, 5.1b, 5.2a, 5.2b and 5.3 only; stop before 5.4. See the foundations handoff for actual checkpoint/test/commit status. §§9.6–9.8 distinguish verified implementation, planned checkpoints, provisional visual treatment and the final approved decisions. Operational and real-participant gates remain in §18.

**Baselines:** original architecture inspection: `feat/group-experience`, commit `2ff6388`; current Phase 5 source review: `a6f2e32`. Phase 1 evidence is recorded in [its handoff](group-experience-phase-1-handoff.md), followed by the [Phases 2–3 handoff](group-experience-phases-2-3-handoff.md) and [Phase 4 handoff](group-experience-phase-4-handoff.md). Original source-audit sections describe their historical baseline; §§9.6–9.8 record current Phase 5 findings. Existing design requirements, draft and independent review are preserved.

**Authority:** The founder's “Update the Group Experiences Phase 5 Engineering Plan” decisions supersede conflicting earlier requirements and recommendations. The [independent Phase 5 review](group-experience-phase-5-review.md) remains an unchanged evidence/recommendation record, not the authoritative specification. In particular, the founder selected separate personal/Group entry contexts, Admin-only confidence extrema, explicit `skip` presentation and deferred membership trust work. Earlier implementation commissions and the accepted Phase 4 specification govern historical work except for these explicit forward changes. This plan incorporates the earlier final corrections and supersedes the [draft](group-experience-engineering-plan-draft.md) and [Claude review](group-experience-independent-review.md). Proposed files and remaining unapproved choices are identified; this documentation approval does not authorise code, database changes, commits or rollout.

## 1. Executive summary

Implement Group Experiences as named assignments of a published public Deck to registered users. Keep **one authoritative personal CardData per user/CardTemplate**. Its completion, confidence, tests and target date follow the user across independent and group contexts. Each experience holds its own group-controlled learning values and its own media, reflections and Info Cards. Membership grants a narrowly projected view of personal learning; it never grants access to the whole personal CardData document.

The principal decisions are:

1. Keep `users.cardsData` and ordinary `users.decksData`. Add persistent experience and member records, group-only learning state and scoped contributions. No experience-specific follower learning collection, fake user, template copy, formal Group or Organisation.
2. Separate **which content version a view displays** from **who owns the learning values**. Independent personal views retain `CardData.cardTemplateVersion`; group views use experience selections. Both project the same Step-ID values. A group update never changes the personal adoption pointer or another group's selection.
3. Compose explicit own-follower, group, inspected-follower and former-follower read models. Authorised active-player assessment reads expose relevant Card/direct Item history, including legitimate live inherited tests; scalar readers remain scalar-only. Private media, reflections, private Info associations and target dates stay owner-only. Foreign queries select permitted fields at the database boundary.
4. Save a small removal snapshot of allowed learning values and exact template selections. Former-follower inspection reads that snapshot and retained group contributions, never the live personal record. Rejoining resumes current personal values.
5. Extend the existing Info Card domain with immutable group purpose, author/management identity, an embedded audience, private editor drafts and an audience revision on saved versions. Reuse the existing pouch, editor, immutable publications and media provenance.
6. Keep the five-thumbnail layout, selecting the newest five in oldest-to-newest order. Use paged group metadata and the existing full gallery. New group images use a private storage origin; group videos require signed delivery. Existing public-image trial permission is insufficient for group assets.
7. Validate the central Card experience after the learning/membership foundation, before advanced sharing/media work. Use one main Card scene, lightweight perspectives, shared active Card and front/back orientation, and modest visible-page polling.

The personal Framework policy remains highest explicitly adopted version and lifetime legitimate eligibility, including Card removal from composition. Phase 5 adds one shared **Progress-only scope model**, separate **My Progress** and fixed-Group entry contexts, target-based assessments and server-derived capabilities for every Group viewer. It preserves shared CardData and the accepted Card geometry; only the specifically approved all-skipped indicator changes extend to Card/Deck presentation. The dedicated [Phase 4 specification](../../../design/features/group-experience/group-experience-phase-4-spec.md) governs other accepted Card behavior. No broad migration, new assessment collection or membership acceptance is planned. §§9.6–9.8 contain the implementation evidence, ordered checkpoints and remaining decisions. Phase 5.0 is completed; no integration implementation or later phase is authorised by this planning commission.

## 2. Confirmed product contract

### 2.1 Identity, membership and roles

- Any currently eligible registered user can create an experience by selecting an existing published public Deck, entering an informal name, selecting followers and optionally selecting more admins. The creator becomes an admin; being a follower is optional and explicit.
- Every selected Deck and Card version must itself be public and published. Template ownership is not a substitute for that check. No private distribution grants, canonical edits, forks or Creator Mode exist inside an experience. Creators use the normal Library workflow.
- Phase 5 retains one Deck per experience; no restart/run counter, invitations, acceptance workflow, organisation hierarchy or reusable Group management. Future multi-Deck scope will union explicitly adopted references with one version per CardTemplate per experience: adding an overlapping Deck retains the existing Group Card version until an explicit update. No multi-Deck storage/UI is implemented now.
- All admins have equal permissions. Admin and follower are independent roles. Protect the last admin. Removing follower status does not also remove admin status; a person with a remaining admin role retains admin access but leaves follower metrics.
- Followers receive distinguishable My Decks entries automatically. An informal name distinguishes personal Deck X, group A/X and group B/X. These are presentation/membership identities, not separate personal learning records.
- Admins add/remove followers and appoint/remove admins. No follower-controlled leave, restore or rejoin action is added. Ordinary personal archive/restore behaviour remains independent.
- Follower removal removes the assignment, excludes the person from current metrics and revokes follower access. Group contributions remain attributed and visible according to their audience. Existing restricted former-follower scalar snapshots remain; the collapsed **Removed / Left Group** presentation is deferred and is not Phase 5 UI scope. Rejoin restores association and uses current personal learning, without reset.

### 2.2 Data and visibility

| Category | Authority and behaviour |
| --- | --- |
| Personal completion/confidence | One shared value per user/CardTemplate/Step ID. Existing work counts immediately on assignment. Admins may inspect allowed current values while the user follows; active followers may inspect active peers only when the default-Off peer policy is On. Inspection never grants edit, clear or delete rights. |
| Personal target date | Existing user/CardTemplate value remains authoritative. Group assignment/open/materialization must not derive a date from group cadence or suggested dates. Ordinary personal Deck scheduling remains unchanged. No group deadline feature; date is owner-only in group read models. |
| Personal tests | Stored once in the player's existing Card/direct Item lists. Authorised Admins and peers can read target-relevant results in the Group's current scope, including live legitimate inherited Card history and direct tests for in-scope Items, regardless of origin. Inspection never grants mutation rights. Outside-scope results and private content remain excluded. |
| Group learning | Separate admin-controlled completion, confidence and assessments. A dual-role person's personal values contribute once as a follower, independently of these group values. |
| Existing private content | Personal media, reflection and Personal Info Cards remain private, including ancestor/fork history. Owners may view them in their group perspective with a restrained **Private** indication. No automatic import, conversion or cross-group copying. |
| Group media | Uploads made within an experience are scoped to that experience and Card. Direct admin uploads and follower uploads form one attributed collection. Former contributions remain. Only the uploader or an admin can remove an item; admins cannot edit another author's content. |
| Group reflections | One reflection per experience/Card/person, including admins. A dual-role person has one, not two. Independent private reflection remains distinct. Author edits; admins may clear. |
| Group Info Cards | Both admins and followers can create self-only, selected-member or group-wide content. One identity serves all recipients. Every current admin sees every **saved** group Info Card. Unpublished drafts stay private to their editor. |
| Info management | Authors edit and change their own audiences. Current admins also manage cards created as admin-managed. Admins delete follower-created cards but cannot edit them or change their recipients. No follower-sharing permission switch. |

Saved self-only **group** notes remain visible to admins. Permanently private Personal Info Cards outside the group do not. That distinction must be apparent in recipient selection and the Private treatment; never label a saved group self-note “Private” without clarifying admin visibility.

### 2.3 Calculations and interaction

- Reuse raw Step roll-ups and exact completion classification (§9.5). Skipped is neutral. A nonempty, entirely explicitly skipped Item/Area displays **skip** in personal and Group Framework completion cells; it is never 100%, unset or outside scope. An all-skipped Card indicator represents skipped; an all-skipped nonempty Deck front omits its completion percentage. Preserve geometry, interactions and every other state. No completed label may be inferred from rounded percentages.
- Preserve the accepted Group Card G/F pair, including both slots and subtle missing-value marks; preserve other consumers' existing conditional F behavior and individual/personal empty-confidence hiding. Phase 5 does not redesign these Card displays. Each valid raw Step reading has equal weight; exclude null/unset values and round only the final mean to the nearest integer. `10, 2, 2, 2` produces `4`. Do not average rounded follower or Card scores.
- Group-assigned learning and personal tests contribute to the owner's overall Framework. Deduplicate CardTemplate identities; exclude group-owned learning/assessments. Preserve current Framework mapping, hierarchy and visual conventions.
- Reuse the four-column Progress table. Normal navigation opens **My Progress**, Framework selector only. Group Deck entry fixes Group scope and adds **Group / My Progress in Group / authorised active player names** with arrows and persistent metadata; active followers default to self even if Admin, Admin-only viewers to Group. Group mode selects **Group scores | Player averages** in the same metric cells; Tests stays Group-owned in both modes. Individual-player Tests is visible with scoped personal history. Touch comparisons and server-derived capabilities follow §§7 and 9.
- Keep five media thumbnails. For eight chronological uploads, show 4–8, with 8 on the right; use a restrained older-item count. The gallery reaches every item, older left/newer right, and opens at the tapped item's stable identity. Preserve upload, removal, download, zoom and iPhone share behaviour.
- Reflections remain bottom-right on the Card, original creation date newest first, username beneath, automatic cycling every few seconds, tap-to-advance and a gentle opacity fade. Editing does not reorder them. No sliding or admin prominence. Admins get a restrained Add/Edit action for their own reflection. A follower taps their own group reflection to edit in their personal perspective.
- Within one viewer, synchronize active CardTemplate and front/back orientation across perspectives. Do not broadcast navigation to other people or synchronize a learner's Step-position/editor state across perspectives.
- In the accepted **Card/Deck perspective interface**, Admins default to Group and followers to self, with a validated remembered selection taking precedence. Preserve that interface, picker/grid, geometry and accepted creation/settings. **Progress entry has its separate approved default:** every active follower, including a dual-role Admin, starts at My Progress in Group; Admin-only starts at Group. Neither Progress scope nor these defaults redesigns the Card interface.
- Poll modestly while visible; refresh on entry/focus and relevant local mutations. No realtime service, Redis or background aggregate platform.

### 2.4 Superseded proposals

Do not carry forward independent follower CardData, Admin mutation of another player's personal learning/tests, exclusion of group assignments from Framework eligibility, decimal confidence display, foreign full-personal DTOs, origin-filtered personal assessments, the combined personal/Group/roster dropdown, extra permanent metric columns/number lines, or the superseded prohibition on authorised foreign assessment reads. Existing later-phase exclusions remain: no five-thumbnail removal, prominent Admin reflection, restrictions on follower recipient subsets, `allowFollowerGroupInfoCards`, private-template distribution or classroom broadcasts. Phases 1–4 and 5.0 are accepted; this task authorises documentation only.

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
| [cards/resolvers.ts](../../../../src/lib/cards/resolvers.ts), [readModels.ts](../../../../src/lib/cards/readModels.ts) | Working resolution and `projectWorking` expect real personal data; output includes private fields/history. | Group paths require dedicated allowlisted scalar and assessment projections, including explicit authorized-default handling. Never send full foreign working DTOs; do not loosen legacy integrity checks. |
| [progress.ts](../../../../src/lib/progress.ts), [signals.ts](../../../../src/lib/signals.ts) | Empty progress is null; skipped Steps excluded, all skipped is 100; percentages rounded. Raw confidence flattened then rounded once. | Historical Phase 4 retained the personal percentage convention while fixing exact completion. Phase 5 now requires explicit all-skipped state: Framework skip, Card skipped indicator and no percentage on an all-skipped nonempty Deck front (§9.5); preserve geometry and other states. |
| [frameworks/eligibility.ts](../../../../src/lib/frameworks/eligibility.ts), [calculations.ts](../../../../src/lib/frameworks/calculations.ts), [readModels.ts](../../../../src/lib/frameworks/readModels.ts) | Eligibility comes from active **and archived** personal Deck composition, not all CardData. Calculations use personal adoption; missing required rows fail, missing individual Steps default. | Add authorized group assignment eligibility and an explicit summary-version selector. Preserve error/incomplete semantics. |
| [frameworks/destinations.ts](../../../../src/lib/frameworks/destinations.ts) | Area/Item destination queries already project learning fields narrowly; keys assume one personal membership per Deck. | Reuse projection approach and add typed experience destinations; do not create personal membership just to navigate. |
| [assessments/repository.ts](../../../../src/lib/assessments/repository.ts), contracts/history | Card and Item results use existing Boolean result/date shape, list revisions, reconciliation and retained-source ownership. Creation requires a working context. | Authorise own Group-context Add, extend compatible embedded lists/provenance, and reuse pure history/CAS for separate Group-owned lists. Add a dedicated authorised foreign assessment-only reader; keep ordinary personal endpoints owner-only. |
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

`CardData.cardTemplateVersion` cannot become the group selection: that would update independent personal views and other groups. `dataOwnerUserId` cannot become the authenticated actor during inspection. `getPersonalUser` retrieves broad arrays and is unsuitable for foreign-user group reads. Authorised assessment-only inspection follows the subject's legitimate live personal source chain (§9.3); do not reuse the broad owner walker with foreign full CardData. Canonical ancestry alone never authorises private content or personal-source access.

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
| Framework/tests | Duplicate progress requires new deduplication semantics; personal test history can be copied or misowned accidentally. | Existing personal tests/state reused; eligibility and display-version selection extended explicitly. | Every existing full-array reader becomes an isolation hazard. |
| Privacy/admin inspection | Context containment is straightforward, but contradicts desired shared values. | Explicit allowlisted scalar/assessment joins plus scoped content; relevant personal tests are inspectable, but foreign mutations and private media/reflection/Info remain denied. | A missing filter can disclose private content or another group's contribution. |
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
| Proposed `groupExperiences` | `experienceId`, `name`, immutable `deckTemplateId`, creator attribution, creation/update timestamps, exact `deckVersion`, per-Card adopted selections (including detached retained Cards), `structureRevision`, `adoptionRevision`, `adminCount`, existing default-Off `allowFollowerInspection`. Group identity/membership foundations are implemented. Phase 5 adds optional direct Item tests with conceptual/stored `frameworkItemId`, provenance and `itemTestsRevision`; these lists do not exist yet. Creator ID is not authority. |
| Proposed `groupExperienceMembers` | Unique `(experienceId,userId)`; `isAdmin`, `followerStatus: never/active/removed`, joined/rejoined/removed timestamps; `accessEpoch`, incrementing write fence; viewer active Card/openedAt; latest removal snapshot manifest; lifetime assigned-Card references with highest adopted versions. No group cadence anchor. A non-admin removed follower row is retained but grants no group access. |
| Proposed `groupCardState` | Unique `(experienceId,cardTemplateId)`, implemented sparse Step completion/readings, timestamps and read revision; planned optional Group-owned test list/revision/provenance in Phase 5. No personal reflection/media/Info/test fields copied here. Missing new group row means default todo/null/empty tests; values persist across composition changes. |
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

Extract a pure `projectLearning(content, fields)` from the existing stable-Step logic: validate exactly the selected Card's three Step identities, read matching values, default absent Step values to todo/null and retain obsolete stored IDs without including them in that view. Keep selected Step projection separate from the Phase 5 explicit skipped-state/display work (§9.5); confidence calculation is unchanged.

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

Read models are allowlists. Never build an inspector response by fetching full personal CardData and deleting fields. Phase 5 deliberately permits relevant assessment reads; that does not relax private-content protection or foreign write denial.

| Data/action | Owner in ordinary personal view | Active follower/self in Group | Other active follower | Current Group Admin | Removed follower without Admin |
| --- | --- | --- | --- | --- | --- |
| Personal completion/confidence | Own read/write | Own read/write; Progress uses fixed Group scope | Read permitted Group-scoped values only if peer policy On; never write | Inspect active followers; existing historical scalar snapshot only for former subjects; never foreign personal writes | Own authorised personal contexts remain; no live Group route |
| Personal Card/direct Item assessments | Own history and established owner mutations | Relevant Group-scoped history; own mutations through valid owner/working context | Read relevant history only if peer inspection On; no mutation | Read relevant active-player history; no player mutation; no new removed-player assessment history | Own retained rights only; no Group inspection |
| Target dates, private media/reflections/Info Cards and unrelated private history | Own only | Owner-only extension; not a broader self Progress learning scope | Denied | Denied for another person, including hidden metadata/URLs | Own ordinary rights only |
| Group completion/confidence/tests | Personal ownership alone gives no grant | Read; no Group test writes unless also Admin | Read as current member | Group-owned writes with source/list guards; approved P5-Q1 exact retained-source management | None |
| Aggregate confidence average | No unrelated Group grant | Available as member; small-cohort inference accepted | Available even peer Off | Available | None |
| Individual confidence min/max aggregate fields | No unrelated Group grant | **Denied unless also Admin** | **Denied even peer On** | Allowed for active cohort | None |
| Group media | No matching-Card grant | Group feed; own upload/remove | Read contributions; no full follower Card | Read/upload/remove any contribution, not edit another's content | No access; contributions remain for current members |
| Group reflection | No cross-context grant | Create/edit/clear own | Read carousel as member | Own create/edit; clear any | No access; retained text remains |
| Saved self/selected Group Info | No cross-context grant | Author or entitled recipient; author manages own | Only if entitled | Every saved root readable/deletable; edit own/Admin-managed only | None |
| Saved Group-wide Info | No cross-context grant | Read; author manages own | Read | Read/moderate under management rule | None |
| Unpublished Group Info drafts/media | No cross-context grant | Own authorised editor draft only | None | Own editor draft only; no other Admin drafts | None |
| Membership, roles, name, visibility, adoption | No grant | No management unless also Admin | No management | Existing equal-Admin/final-Admin/revision rules | None |
| Template edit/fork inside experience | No | No | No | No, even if creator | No |

Every Group viewer receives server-derived capabilities (§9.4); Admin/follower roles are independent and union for dual-role users. An application-wide `isAdmin` or template creator identity grants no experience rights. Own personal private loaders still require actor === owner. Group Progress's numeric/evidence scope is identical for self and authorised inspectors; only capabilities differ.

Keep scalar personal queries bounded to requested Card/selected Step fields. New assessment-specific projections select only legitimate source tests/revisions and server-internal lineage links. Never return private dates, media/Info IDs, reflection length, unrelated tests or private adoption/history metadata. Provenance Group names/IDs require separate originating-Group authority; return Personal/Other group/Unknown as appropriate (§9.3). Do not infer membership or permission from provenance.

Current membership/peer policy and source scope are checked on every new read/mutation, including direct guessed IDs, list pages, histories and retries. A capability boolean is a projection of that authority, not a client-granted credential. Group feed delivery remains scoped to contribution/publication, not provider locators.

**Known limitation:** current automatic enrolment itself establishes inspection authority; no new acceptance/verified-role rule is introduced in Phase 5. The founder deferred that trust boundary to Organisation work (§9.8). Keep the feature gated; fixture readiness does not certify real-participant suitability. Aggregate averages are not mathematically anonymous in small cohorts.

## 8. Data flows and APIs

Proposed routes under `/api/group-experiences` are a concrete namespace, not a second personal API. Existing repositories remain the source of shared learning validation and mutation. Route handlers use the installed Next conventions and existing authentication/no-store response helpers.

| Operation | Suggested contract and critical checks |
| --- | --- |
| Create/list | `POST /api/group-experiences`; `GET /api/group-experiences` returns the actor's admin/follower entries. Create accepts name, follower/admin IDs and an exact public preview manifest plus operation ID. Validate registration, roles and public versions; atomically insert experience and members. |
| Membership/roles | Versioned `POST /:id/members` commands for add/remove/role changes. Session actor must currently administer; structural CAS and affected-member fences; snapshot removal before committing inactive status. Retry never restores a later removal. |
| Open/navigation | `GET /:id`, `POST /:id/open`, bounded member navigation write. Reads do not initialize personal data. Explicit own-follower open may materialize learning with date null; no group cadence/suggested-date initialization (§6.3). Admin inspection never materializes another user's personal data. |
| Summary/roster | `GET /:id/summary`, paged roster and batched lightweight perspectives. Snapshot-consistent membership/selections; active-only counts. Current UI navigation excludes former followers; its history presentation remains deferred. Active peer identities follow the existing peer policy. Progress adds the same server-derived capabilities for every viewer. |
| Card view | `GET /:id/cards/:cardId?perspective=group|self|follower&subjectUserId=…`. Resolve current selection and capabilities. Own private sources are an owner-only extension; inspected follower has only allowed fields. Former subject uses snapshot. |
| Personal learning | `PATCH /:id/cards/:cardId/personal-learning`, self only, explicit Step/value or own target date. Authorize active follower and selected Card; call the shared personal mutation core, never overwrite whole CardData. |
| Group learning | `PATCH /:id/cards/:cardId/group-learning`, admin only, narrow absolute Step/confidence setters. Group tests use scoped assessment commands. |
| Progress/tests | Progress summary/history uses the central context scope and explicit owner kind. Owner personal mutations stay session-bound; authorised active-player assessment reads use new narrow Group adapters. Group-owned writes are Admin-only; extrema are Admin-only; no foreign personal writes. Provenance labels are server-redacted. |
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

### 9.1 One Progress scope/evidence contract

**Approved boundary:** establish a small central scope model before the remaining Phase 5 storage/read/UI integration. It applies to **Framework Progress views**, not to ordinary Card content or the identity of shared personal CardData. Only §9.5's specifically approved skipped indicators extend into Card/Deck presentation. Preserve the accepted Card/Deck layouts, controls, gestures, perspective state and private-content rules.

Preserve **Framework → Area → Item**, current configuration/canonical ancestry mappings, expansion and four table columns. Implement a few pure functions plus bounded server read adapters, not a generic permission engine, new state library or new learning store. Keep these concepts explicit:

- **Context:** personal Progress or one fixed Group Experience, established by entry route.
- **Scope:** selected CardTemplate identities and adopted versions, their mapped Items/Area unions and permitted assessment evidence targets.
- **Owner/perspective:** personal player, Group-owned results or active-player aggregates; owner is never inferred from provenance.
- **Authority/capabilities:** authenticated viewer and current Group membership/role/policy. These govern allowed reads/actions, not wider numeric/evidence scope for self.

Suggested internal flow (names are engineering choices): `resolveAuthority → resolveProgressScope → bounded learning/assessment readers → raw metrics/history projection → existing table`. A conceptual scope result includes selected `{cardTemplateId,version}` references, per-Item Card IDs, Area unions, coverage `inside | outside | unknown`, direct Item assessment targets, source-lineage dependencies, issues and composition revisions. The client cannot submit its own authorised Card set.

**Personal scope** uses §9.2's lifetime evidence and version rule. Direct personal Item tests can exist without eligible Cards; preserve these on configured Items. **Group scope** intersects the currently adopted Deck composition with its explicitly selected Card versions and the existing Framework mappings. An Item is inside when at least one current Group Card maps to it; partial Items use only those Cards, and Areas union their relevant Cards once. Use `selectedContent`, not every retained `cardSelections` entry: detached selections and member lifetime references are not current Group scope.

The same Group scope applies to Group scores, averages and each selected player, including the signed-in player. Permissions and mutation capabilities may differ; self must not receive unrelated personal Item/Card results inside Group Progress. Numeric inputs and assessment targets derive from the same scope plan but need not be identical: direct Item tests target the Item, and legitimate inherited tests form an assessment-only evidence closure. Ancestor tests never add ancestor progress, assignments or navigation rights.

Complete hierarchy stays visible. Known outside coverage, unstarted, explicitly all-skipped, no observations, loading and incomplete/corrupt data remain different states (§9.5). Mapping failures must not be disguised as deliberate outside coverage. Do not broaden scope through a destination or history reader.

**Future-only multi-Deck contract:** the resolver accepts a resolved list/union of adopted Card references. One version per CardTemplate per experience remains authoritative. Adding another Deck with that Card must retain the experience's existing Card version; only deliberate normal Group adoption changes it. Deduplicate identical resolved references; inconsistent versions in a supposedly resolved Group scope are an integrity error, not permission to apply the personal max-version rule or silently adopt a newer version. No multi-Deck storage, selection UI or conflict-resolution workflow is part of Phase 5.

### 9.2 Personal lifetime eligibility and explicit summary version

Union active and archived ordinary personal Deck composition, current compositions where the actor is an active follower, and legitimate retained personal/member assignment references, including Cards removed from Decks and Groups the follower left. Admin-only status supplies no personal learning eligibility. Removed or now-Admin-only member rows can still contain legitimate frozen retained follower references; never use their former Group's later composition as evidence.

Deduplicate by exact CardTemplate identity and select the **highest version explicitly adopted by an eligible personal or Group assignment**, including retained references. Never use a newer unadopted publication, union historical Steps or average context percentages. Canonical fork identities remain distinct; mapping inheritance is not identity collapse. Reuse `mergeRetainedAssignments` deterministically. A personal v2 / A v3 / B v1 overlap uses one v3 projection for overall Framework, while each Card/Group retains its own selection. Never write the calculated summary version into `CardData.cardTemplateVersion` or fan out adoption changes across players.

Once legitimately assigned, learning remains personally eligible after Card removal or follower departure. Retention grants no revoked Group tile, old Deck navigation, historical working access or foreign live-history permission. Legacy disappeared assignments without reliable evidence cannot be invented from orphan CardData; no bulk backfill is authorised.

A genuinely never-opened Group-only assignment can project todo/null and empty tests without a write. Missing required ordinary personal rows, duplicate records, invalid selected content/values or unavailable mapping remain incomplete. Extend source-title/version and Item assessment readers alongside numeric readers so Group-only/retained Cards resolve under the selected summary policy. Preserve target dates, private fields and ordinary personal adoption. Group-owned tests/values never contribute to personal Framework totals.

### 9.3 Assessment targets, inclusion, provenance and history

#### Targets, ownership and compatible storage

Exactly one conceptual target: `{cardTemplateId}` or `{frameworkItemId}`. `configurationContracts.ts` validates Item IDs globally across the catalogue; no redundant `frameworkId` in assessment identity. Keep Item IDs stable in meaning. A Card may contribute to different Items in different Frameworks under existing mapping rules; do not relax within-Framework duplicate/conflicting mapping validation.

Keep personal Card tests in `cardsData.tests` and direct tests in `users.itemTests`, with existing list revisions. Legacy stored/API `itemId` may remain behind an adapter; new conceptual contracts use `frameworkItemId`. Planned Group Card tests live in `groupCardState.tests/testsRevision`; direct Group Item tests in `groupExperiences.itemTests/itemTestsRevision`. New direct Group entries use `frameworkItemId`. Card target and Group owner are inherited from the parent; do not duplicate parent identity in every embedded event. Optional absent lists/counters mean empty/zero where legitimate. These Group assessment fields/APIs are **not implemented by 5.0**.

Reuse Boolean result, assessment date, ID, immutable `createdAt`, ordering, source deduplication, CAS and existing retained owner edits/deletes. Group histories combine Group-owned sources only, never personal fork histories. Current Admins manage Group tests; followers read them. Inspection does not authorise coach/peer writes to a player's tests. Coach-on-behalf entry, imports, new test catalogues and modification audit logs remain future work. P5-Q1 is approved: retain removed sources, exclude them from current Progress, permit current Admin exact-source read/correction/deletion with list guards, and deny new out-of-scope results. No historical browser or restored working navigation.

#### Approved inclusion and live inheritance

Assessments follow their **target**, regardless of entry route or original Group:

- In a Group player Item view include legitimate history of its current in-scope Cards, plus **all** personal direct tests of that in-scope Item.
- Exclude tests attached only to unrelated outside Cards, even when mapped to the same Item. Entirely outside Items expose no assessment data/counts, even in self perspective.
- For a selected in-scope Card, authorised inspectors see the **same legitimate live assessment history as the player**, following the subject's stored `historySourceCardTemplateId` chain. Include later inherited source tests under existing rules. Do not freeze history, copy tests, use canonical ancestry alone as authority, traverse siblings, or expose unrelated private content/navigation.
- Deduplicate each originating owner/source/test event reached through several current Cards. History may legitimately contribute to multiple Framework Items across Frameworks without event copies.
- Direct Item evidence concerns the skill as a whole, even when the Group practices only a subset of its Cards. It does not claim completion of those exercises and never automatically changes progress/confidence.

Use a narrow assessment-only database projection, separate from scalar `personalLearningForUsers`; do not call `getPersonalUser(subject)` and remove private fields afterwards. A minimal history-source adapter can reuse legitimate traversal/dedup logic without loading media, chats, reflection, target dates, private Info IDs or personal adoption/history metadata beyond the required server-internal chain. Validate cycles/duplicates/missing sources and preserve incomplete-history behavior. Inaccessible source titles/IDs are not content grants; project a safe source label and read-only row identity. Owner mutation authority remains separate from foreign history DTOs. Removal snapshots remain scalar-only and ordinary Progress excludes removed subjects.

#### Provenance and date/context presentation

For new records use optional additive provenance fields `enteredByUserId`, `entryMethod: manual | import | automated`, nullable `groupExperienceId` and nullable `deckTemplateId`; reuse immutable server-owned **createdAt** as the entry timestamp. New manual events always have server-stamped authenticated actor, time and method. Assessment `date` remains its separately editable date-only field. Capture and validate the actual entry context at dispatch; never infer origin from concurrent memberships, infer ownership from origin, or change provenance on edit/retry. Use a Deck ID only when there was a real Deck entry context. New Group Item entry need not invent a Deck origin merely because one Deck currently defines scope.

Legacy absent provenance means unknown origin, not Personal or the currently viewed Group. Preserve valid existing createdAt and every result; no fabricated actor/Group/Deck, migration or destructive rename. Both source-list DTO mapping and `readablePersonalHistory` reconstruct fields explicitly and must preserve/project new provenance deliberately.

**Approved history modal:** reuse the existing date cell with assessment date above and smaller, lighter origin text below. Server returns a safe display discriminant/label, not arbitrary raw provenance IDs:

| Recorded origin and viewer authority | Context line |
| --- | --- |
| Reliable recorded personal origin (Group explicitly null) | **Personal** |
| Recorded Group origin; viewer currently authorised to know that Group's identity | Its current authorised display name, resolved server-side |
| Recorded Group origin; identity not authorised/unavailable | **Other group**; do not leak its ID/name, Deck or member identities |
| Legacy absent/unreliable origin | **Unknown** |

Truncate long names within the existing cell; no new wide column, different-coloured symbols or provenance management UI. Provenance itself does not grant originating-Group access. Result/date/source history already authorised for the current view remains readable even when origin identity is redacted. Parameterise the existing shared history modal so personal and Group **Progress** use this date/context presentation; preserve other consumers unless explicitly adapting their approved Progress entry. Retain source labels, controls, assessment symbol colours and editing behavior; no incidental Card-modal redesign.

#### Transactions, revisions and retries

Personal Group-context Add authorises the real session owner as active follower, resolves selected content and materialises a legitimately absent own CardData **before** storage/list checks, all in one fenced transaction. No fake personal Deck membership or cadence/target date initialisation. Existing owner-only personal endpoints retain contracts. Direct Item Group creation requires current Item scope; ordinary personal direct Item creation remains permitted for configured Items.

Group test lists have independent assessment revisions, not a Group-wide structural lock. Preserve first-row uniqueness against scalar writes; narrow list updates must not overwrite learning/membership fields. Reuse desired-state reconciliation, not a claim of exact assessment operation receipts: a retry reads its captured owner/source list, never combined history or another perspective. Bind immutable Add context as well as result/date/ID. A deleted Add must not resurrect. After Group authority loss, reconciliation cannot return forbidden history; report unresolved outcome unless current authority permits confirmation. Preserve original personal queue identity across personal/A/B contexts; Group queues use explicit Group owner identity. Use HTTP-compatible `clientId()` and preparation error handling when adapting the existing modal's UUID calls.

### 9.4 Progress routes, perspectives, modes and capabilities

#### Two entry contexts, one reusable interface

**Normal Progress:** existing application navigation opens `/progress`, labelled **My Progress**, with the Framework selector and complete eligible personal learning. No Group selector, roster or silently restored foreign context. Keep existing personal tests/destinations except the approved changes here.

**Group Progress:** entry from the Group's Deck fixes one experience for that visit. Reuse the Progress shell/table with Framework selector, compact Group perspective selector and previous/next arrows, then immediately beneath it Group name and **active Follower count**. Count all active followers, not only the visible roster page, including dual-role followers once. No combined context hierarchy or cross-Group picker inside this view.

Perspective options, in order: **Group**, **My Progress in Group** if the viewer is an active follower, then other authorised active followers by existing alphabetical identity ordering. Do not duplicate self under their username. **Every active follower defaults to their own perspective, including Admin/follower dual-role users. Admin-only viewers default to Group.** These are Progress entry defaults, not a change to accepted Card picker defaults/remembered state. Arrows move within this authorised list; recommended non-wrapping ends are disabled. Group scores is the initial Group mode; retain its selection while switching players during the same mounted visit.

Preserve selected Framework, expanded Areas, visible Item/row and viewport offset on perspective changes; keep table mounted and reserve stable control space. Do not paint previous-subject values under a new name. Make the compact perspective controls available while scrolling with a restrained sticky treatment, checked on portrait iPhone. A Progress-local solution may be needed because `.app-shell` uses `overflow-x: hidden`; never alter shared Card shell geometry to fix sticky behavior. Close cell/history overlays on an incompatible context change while retaining any captured pending write safely.

P5-Q2 is approved for later 5.5: the existing top-right three-dot Group Deck menu provides Progress to every current member while Group… stays Admin-only. Do not implement this entry during 5.1a–5.3. Return transport must capture originating experience, valid Card/face/perspective, selected Framework/Area/Item and scroll/expansion state. Restore permitted state, revalidate after adoption/membership change, and return to My Decks if final access is gone. Normal My Progress remains reachable through existing navigation.

Personal Area/Item destinations reuse active/archived/Library dialogs and add typed named experience destinations `{kind: experience, experienceId, deckTemplateId, name}` keyed by experience. A personal Progress destination explicitly opens **self**, including dual-role Admins, never their normal Card Group default. Group Progress destinations stay within current Group content/selected subject and existing read-only capabilities. Retained-only references create no revoked or historical working link. Browse unrelated public learning through existing Library behavior without auto-assignment or widening Group scope; no new planning screen/shortcut.

#### Table modes and touch comparisons

Preserve the accepted four columns, widths, hierarchy and existing symbols. Only **Group** perspective shows **Group scores | Player averages**:

- Group scores: Group-owned completion/confidence; Group-owned Tests.
- Player averages: raw weighted active-follower completion/confidence in the **same cells**; the **same Group-owned Tests**.
- A selected player: their Group-scoped personal completion/confidence and relevant personal Tests. Self may manage own tests; foreign viewers read only. No aggregated player Tests.

Completion popover in Group scores shows player aggregate percentage and full wording, e.g. **3 doing, 5 done**, without repeating total followers. Confidence shows the pooled player average; **only Admins additionally receive lowest/highest individual players' calculated scope confidence**. No player names. In Player averages, metric taps reveal the corresponding Group-owned value. Use cell-anchored, touch-compatible non-modal popovers, one at a time, close on outside tap/Escape/context change, avoid covering the source figure where practical and clamp/flip within viewport. Reuse existing dismissal/portal patterns; there is no ready-made collision-aware primitive. Keep overlays outside table flow; no permanent second values/columns or new hover dependency. No zero-state numbers may be fabricated when comparison observations are unavailable.

#### Server-derived capabilities for every Group viewer

Derive one small extensible `groupCapabilities` object from existing `authorize`, `canInspectPeers`, member roles and policy for **Admins and followers alike**. It reflects authority; requests still reauthorise server-side. Suggested names:

| Capability | Current Group Admin | Follower without Admin role | Dual role |
| --- | --- | --- | --- |
| `canInspectFollowers` | true for active-subject inspection | existing peer-visibility setting | true |
| `canViewConfidenceExtrema` | true | **false even with peer inspection On** | true |
| `canManageGroupAssessments` | true, subject to target/list guards | false | true |
| `canManageMembers` | true, existing final-Admin/transaction guards | false | true |

Reconcile existing `canInspectFollowers` fields rather than creating a competing policy path. Group read capability and own-personal test mutation are additional context/owner checks, not consequences of this example object. The server must omit extrema data for non-Admins, deny their direct extrema requests, and enforce Group test/member writes regardless of hidden controls. Every member may see Group aggregate confidence averages; small-cohort inference is accepted and must not be described as mathematically anonymous. Peer On never upgrades a follower to Admin extrema/management rights.

### 9.5 Raw metrics, skipped states and coverage presentation

Compute completion from **done observations / non-skipped observations**, rounding once. For a player cohort count `(playerId, cardTemplateId, selected stepId)` separately, deduplicating Cards inside that person's Item/Area only. Do not deduplicate different players out of the denominator or average rounded player/Card/Item scores. An Area unions relevant Cards before calculating.

Confidence is the mean of all valid underlying selected Step readings (1–10), excluding null/unset and rounded only once. For Admin extrema calculate each active player's valid confidence for that same scope, then min/max of those individual calculated scores; unset players are excluded. The pooled mean still uses raw readings, not those rounded player scores. Skipped Steps can retain valid confidence. Tests never change these numbers.

Existing exact classifications remain: no non-skipped Steps → no eligible completion; otherwise all explicitly done → done, some done/inProgress → doing, else unstarted. A rounded 100% does not establish completion. Keep activeTotal, eligibleTotal, doing/done separately; no `0/0` Card aggregate counts. Malformed data is incomplete, not absent/unstarted.

**Shared explicit progress state:** extend pure progress-state derivation with observation count and an `allSkipped` flag/state: valid nonempty observations, **every** status explicitly skipped. Never infer skip solely from a zero denominator, null percentage, missing row, zero followers or empty Deck. Keep percentage, exact completion and allSkipped distinct; existing read-state `complete` still means availability. Reuse this classifier in Framework/Card/Deck adapters rather than sprinkling conditions in components. The old low-level percentage helper may remain compatible internally if all approved display consumers use the explicit state; no UI may expose its legacy all-skipped 100 under this contract.

| Situation | Completion presentation / behavior |
| --- | --- |
| Personal or Group Framework Item/Area inside scope, all relevant valid Steps explicitly skipped | Small, light **skip**, slightly clearer than outside dashes; not 100%, unset or completed |
| Player-aggregate Framework scope with active followers and nonempty selected Step observations, all explicitly skipped | **skip** in Player averages; comparison state also explicitly skipped; follower doing/done zero, not a completion percentage |
| Inside scope, all todo | Existing 0% / unstarted presentation |
| Mixed skipped and done/doing/todo | Exclude skipped from denominator; existing rounded percentage and exact classification |
| Zero followers, no assigned Step observations or genuinely empty learning | No manufactured skip or zero percentage; use existing no-observations/empty state |
| Unknown/corrupt source, mapping or observation | Distinct unavailable/error state; never skip or outside coverage |
| Group Item/Area known outside current composition | Exceptionally faint dashes in completion/confidence/Tests; do not fetch excluded personal results |

All-skipped is a **completion** state, not a reason to suppress an independent confidence value or valid Tests. In-scope empty confidence/tests retain established presentation. Personal direct Item tests without assigned Card Steps remain visible, without inventing skip. Area Tests retains the existing blank structural cell where no Area assessment model exists; Group Areas without coverage use the specifically approved faint placeholders.

**Card indicator audit and planned change:** `StepProgressStrip` already has skipped track/fill styling; preserve its geometry and touch target. The shared Card-level `CardSemanticAnchors` completion strip currently uses only width and the normal completion accent, so all-skipped personal Cards can look full/completed and Group null may look merely unset. Supply explicit Card skipped state to this existing indicator, reuse neutral skipped palette/status treatment and semantic label, retain the same position/dimensions. Cover personal, Group-owned and individual-player Cards on ordinary/focused representations wherever the indicator appears. Do not change per-Step controls, G/F display, comparison grid, gestures or scope of Card learning.

**Deck indicator audit and planned change:** personal `deckLayout` and `deckFrontPresentation` can pass the helper's all-skipped 100; `DeckFrontContents` then prints 100% even though exact classification avoids Completed. Suppress completion percentage only for a **nonempty Deck whose every actual Step is explicitly skipped**, using the shared state. Preserve card-count/confidence fields, reserved layout/spacing, and existing explicit-completion labels for other states. Apply the same condition at the detailed Deck-front `DeckScene` label and Framework destination/tile transport where that same front presentation is used; Group aggregation must not lose the skip state when percentage is null. A paged preview is not evidence that every Card was skipped: derive from the full selected composition, never only visible Cards.

**Outside scope visual review:** complete hierarchy stays. Outside Item titles receive a **very light strikethrough**, with readable text; this exact visual treatment is provisional pending fixture/iPhone review. Outside Areas show faint result placeholders without unnecessary strikethrough on Area headings. Keep inside unset/empty formatting unchanged. Use separate accessible descriptions such as “Outside this Group's learning” and “All relevant Steps skipped”; do not make a dash/colour/strikethrough the only semantic distinction. No comprehensive unrelated accessibility redesign.

### 9.6 Verified implementation baseline and Phase 5 gaps

The following table preserves the pre-implementation source audit: accepted Phase 4 `a6f2e32` plus the existing uncommitted completed 5.0 preview. The independent review supplies additional evidence; founder requirements in §§9.1–9.5 supersede its unapproved alternatives. The table is **not a new test run or a statement that completed foundations are still missing**. Checkpoints 5.1a–5.3 now implement scope/state contracts, personal lifetime readers, provenance, personal Group-context assessment transport and Group-owned assessment storage/APIs. See `group-experience-phase-5-foundations-handoff.md` for exact files, verification and commit boundaries. Scoped Group/player Progress metrics and foreign assessment reads, navigation and new skipped presentations remain 5.4–5.7 work.

| Current source | Already implemented | Actual Phase 5 gap |
| --- | --- | --- |
| `cards/learning.ts`, `cards/personalLearning.ts`, `groupExperiences/learningReads.ts` | One personal CardData, stable-Step explicit-version projection, narrowly authorised writes, safe virtual defaults for genuinely unstarted group assignments, no group scheduling. | Consume these foundations in Framework readers and assessment context resolution. Preserve Framework validation/incomplete semantics; do not blindly substitute a helper with different corruption rules. |
| `cards/retainedAssignments.ts`; personal repository retention; group creation/adoption/lifecycle/management | Deterministic ID/max-version merge; personal retention at legitimate transitions; member references on assignment/rejoin and before composition changes; frozen references after departure. Atomic settings also retains removal snapshots/references. | Framework does not consume the references yet. Query the authenticated owner's member records, including removed/now-admin-only former followers with legitimate retained references; do not use a former group's later composition as their adopted-version evidence. |
| `frameworks/eligibility.ts`, `readModels.ts`, `calculations.ts` | Active and archived personal Deck eligibility; deduplication, canonical ancestry mapping, raw Area unions, empty/incomplete states. | Eligibility currently returns IDs only from personal Deck composition. `adoptedCards`, `resolveAdoptedCardCalculation` and `sourceTitles` select the personal CardData pointer. They omit group-only/retained assignments and can select the wrong summary version. |
| `frameworks/destinations.ts`, `progressNavigation.ts`, `progressDeckSelection.ts`, Area/Item dialogs | Existing active/archived/Library selection, mapped Card previews, version-difference hints, session checks, explicit restore and return-position handling. | No experience destination kind. Matching/navigation keys assume DeckTemplate identity. `AppShell`'s Group entry currently does not forward the existing personal Progress return path or accept a complete targeted Group Card/self entry contract. |
| `assessments/{contracts,repository,history,client,historyClient}.ts` | Personal Card/direct Item CRUD; result/date/ID/list revisions; desired-state retry reconciliation (not an exact operation receipt); inherited personal source-history deduplication; owner-only retained edits/deletes. | Card Add requires `deckTemplateId` and active personal membership via `assessmentWorkingCard`. Storage is read before that authorisation/materialisation. A never-opened group-only Card may have no stored row, so changing only the final Add permission check is insufficient. |
| `GroupExperience`, `GroupCardState` actual types and routes | Group completion/confidence, membership fences and selected versions. Scalar writes use narrow fields and can preserve additional assessment fields. | No group Card test list/revision or direct Item list/revision is implemented. No group assessment endpoints/history exist. Fields in §6.2 describe the planned Phase 5 additions, not completed Phase 2 storage. |
| `groupExperiences/readModels.ts`, `presentationReads.ts`, `policy.ts` | Correct active-follower aggregates, raw confidence, neutral skipped, explicit completion, allowlisted foreign learning, policy-aware peer reads and authority leases. | Aggregates cover Step/Card/whole Deck, not Framework/Area/Item mapped intersections. Bootstrap explicitly lists assessments as deferred. |
| `ProgressShell`, `FrameworkProgressTable`, `ItemTestsCell` | Personal `/progress` from the shared Overview menu; Framework selector; expandable Area/Item rows; four columns (Area/Item, Completion, Confidence, Tests); Area/Item destination dialogs. | The shell, summary validation and tests cell are personal-only. The table requires an assessment object for each Item, and `ItemTestsCell` constructs a personal context with `canCreate: true`. Neither can be used unchanged for foreign/group data. |
| `AssessmentControl`, `AssessmentModal`, `useAssessmentHistory` | Existing Card header slot, latest-result symbols, date/pass-fail/history editor, pending-work/conflict/retry UI. | History keys use viewer/source only; transports and pending-work actions are personal-only. Scope owner/experience/capabilities before reuse. `AssessmentModal` still calls `crypto.randomUUID()` for new results; the accepted LAN compatibility fix exists in `lib/clientId.ts` but has not reached this component. Account for that narrow compatibility dependency when adapting assessments; no implementation is made by this review. |

| `frameworks/configurationContracts.ts`, `mapping.ts` | Global Item-ID validation across the catalogue, per-Framework mapping uniqueness and canonical ancestry validation. | Reuse these rules in one Progress scope plan; preserve original/fork identities and stable Item semantics. No `frameworkId` is needed in assessment target identity. |
| `cards/forks.ts`, `personalHistory.ts`, `assessments/history.ts` | Personal history follows a live subject-owned source chain; event ordering and source/ID deduplication exist. | A foreign assessment-only projection must preserve this chain without loading private media/chats; explicit reconstruction currently drops new provenance unless extended. |
| `CardSemanticAnchors`, `StepProgressStrip`, `deckFrontPresentation`, `DeckFrontContents`, `DeckScene` | Step strips have neutral skipped styling. Card-level completion strip uses percentage only, with no skipped variant; personal helper returns 100 for all-skipped. Deck labels avoid explicit Completed, but can still display 100%. | Add a shared explicit all-skipped state; Card indicator uses skipped treatment in its existing slot; Deck front suppresses percentage; Framework uses `skip`. No layout, gesture or numeric-confidence changes. |
| `DeckMenu`, `GroupExperienceDeck`, `OverviewMenu`, Progress return helpers | Global `/progress` exists. Group Deck injects an Admin-only menu for `Group…`; followers do not receive that menu. Return position/context exists for personal Progress. | Approved P5-Q2: add Progress for all Group members in this existing menu during 5.5, keeping Group… Admin-only. Extend validated return identity, not global Card navigation defaults. |

Keep existing 100-ID database batches, paged identities, bounded lightweight reads, current membership/structural/adoption revisions and approximately five-second authority lease with focus revalidation. Scalar readers continue excluding tests; new assessment readers explicitly permit only authorised source data. Query/response tests must reflect this intentional policy change without weakening private-content protection. Personal assessment APIs remain owner-only.

The 5.0 adapter bundles actual Progress components with test-only substitution and static assessments; its synthetic actor/context is not a production ownership or permission mechanism. All its nine Items are in scope. Further authorised fixtures must add partial/outside coverage, personal-only history, source inheritance, provenance and multiple-role cases; do not claim 5.0 already proves these.

### 9.7 Ordered implementation checkpoints and acceptance gates

**Authority:** 5.0 is complete. The founder commissioned 5.1a, 5.1b, 5.2a, 5.2b and 5.3 sequentially, with one verified implementation commit each; the foundations handoff records their completion. Stop before 5.4: later contracts remain approved requirements awaiting a new implementation commission. All tests use disposable infrastructure, never production Atlas. This commission retains the requested GPT-6.1 Sol / Extra High setting; escalate a concrete unresolved architectural issue rather than launching another general review.

The following **5.0 execution record is preserved verbatim as historical evidence**. Its references to then-unresolved P5-Q1–Q4 and the stop-before-5.1 instruction describe that commission; current decisions and remaining gates are §§9.1–9.5 and 9.8. No historic verification is represented as a rerun or permanent integration.

#### 5.0 — Populated Group Progress visual review (isolated prototype)

- **Scope:** display Group-owned values in the unchanged existing four-column Progress table, with fixture-only assessment summaries/read-only history. No permanent entry, production route, Group assessment persistence/API, editing lifecycle, personal lifetime/version reader changes or final Group/follower column arrangement. P5-Q1–P5-Q4 remain unresolved. Stop for visual review before 5.1.
- **Fixture:** `tests/fixtures/groupProgress.ts` defines twelve distinct public canonical Cards, thirty-six distinct Steps, three Areas/nine Items, four varied followers, all four progress statuses and confidence readings spanning 1–10. A separate disposable `Galway Progress review` experience preserves the accepted Galway U18 fixture. Area completion/confidence is 55%/6, 45%/4 and 38%/8; these are calculated results, not seeded percentages.
- **Real calculation path:** `tests/helpers/groupProgressReview.ts` provisions only a runner-owned local replica set, then reads selected versions through `selectedContent`, `groupLearning` and the allowlisted `personalLearningForUsers`. `calculateMappedProgress`/`resolveEffectiveMapping` provide real mappings and raw Card unions; Group `metrics` preserves neutral-skipped/null semantics. `followerMetrics` computes comparisons retained in preview data, without choosing their table placement. No personal assessment reader is called.
- **Assessment adapter:** 24 Card and 27 direct Item example results live solely in the fixture module, never Mongo. Existing result/source/history contracts, `orderHistoryResults` and `compactAssessmentHistory` supply the existing `ItemTestsCell`, `AssessmentSymbols` and `AssessmentModal`. Histories are read-only through existing `canMutate` capabilities; real Group Admin editing rights are not being decided here. Private personal test sentinels exist in disposable follower records but never enter the preview.
- **Presentation isolation:** esbuild substitutes only Progress data reads and the assessment history hook inside the test bundle; actual `ProgressShell`, `FrameworkProgressTable`, expansion persistence and their CSS remain unchanged. Global styles come from the existing local disposable app. A companion HTTP server serves `/__group-progress-preview`, bundle assets and static application styles only; no application API is proxied. Existing Overview links and Area/Item destination controls are not connected to future Group navigation; destinations/editing are outside this preview. This is not a separate mock dashboard.
- **Review harness:** `GROUP_PROGRESS_PREVIEW_PORT=4185 node --import tsx scripts/review-group-progress.ts` starts the companion against the existing `phase2-test-results/review-server.json` styling server and records its own metadata in ignored `phase2-test-results/group-progress-review.json`. It owns/destroys a separate `switchplay_phase2_progress_*` database, never loads an environment database URI, and leaves existing review services/data intact. Preview access needs no login because it contains only synthetic, read-only fixtures. The existing Group app retains `phase2` / `local-test-only` and `other` / `local-test-only`.
- **Verification:** focused fixture calculations/history tests; Chromium/WebKit at desktop and 390×844, real modal display/close and expansion, no personal API requests/private sentinels, no persisted Group tests, existing personal catalogue and accepted Group Card smoke checks. Final results: 28 unit tests and 9 browser checks passed; TypeScript, targeted lint and diff checks passed. The browser checks also compare the real existing Group summary API against underlying fixture learning and verify four private-test sentinel owners without exposing their tests. An initial run exposed missing Next build-time environment substitutions in the standalone bundle; this was corrected entirely in the test bundler, then all checks were rerun. The existing NO_COLOR/FORCE_COLOR runner warning is harmless. No unrelated full suite or production build was run.
- **Manual review:** review populated hierarchy, existing column widths, confidence readability, latest-three symbols and combined read-only history on iPhone; use that evidence to approve P5-Q1. No final Group/follower metric arrangement or permanent entry is inferred from this prototype.

Executed verification commands:

```sh
node --import tsx --test tests/group-progress-preview.test.ts tests/frameworks.test.ts tests/assessment-history.test.ts
node --import tsx scripts/test-phase2.ts --group-progress group-progress-preview.browser.ts progress.browser.ts group-experience-perspectives.browser.ts --grep 'fixture Group Progress|preview uses real|Progress requires authentication|configured order, independent|Tests cells and Item modal|named seeded group entries'
npx tsc --noEmit --incremental false
npx eslint tests/fixtures/groupProgress.ts tests/fixtures/groupProgressAdapter.ts tests/fixtures/groupProgressHarness.tsx tests/helpers/groupProgressReview.ts tests/group-progress-preview.test.ts tests/phase2/group-progress-preview.browser.ts scripts/review-group-progress.ts scripts/test-phase2.ts
git diff --check
```

Review session: `http://localhost:4185/__group-progress-preview` (desktop), `http://192.168.1.38:4185/__group-progress-preview` (LAN), both verified HTTP 200. No preview credentials are required. Existing review app on 4181 was also verified HTTP 200 and was not restarted/reseeded; occupied port 4182 was left untouched. Preview session PID is recorded in `phase2-test-results/group-progress-review.json`; SIGTERM stops only that companion and disposes its owned Mongo replica set. These URLs/PID metadata are session-specific. No changes under `src/`, production configuration changes or commits were made.

#### 5.1a — Central scope/evidence contract, mapped coverage and explicit states

- **Scope/files:** pure Progress scope plan around `frameworks/{mapping,eligibility,calculations}.ts`, selected Group composition and shared `progress.ts` classification; define typed coverage, selected versions, evidence sources, complete/empty/incomplete and explicit allSkipped states. Future union input with one adopted Card version; no multi-Deck persistence. Define server-derived capabilities in existing Group policy vocabulary for every viewer.
- **Dependencies:** accepted Phase 4 foundations and decisions above; no new UI, Group assessment persistence or historical-management answer required. Implemented and verified in the current foundations commission; see the handoff.
- **Acceptance:** identical Group scope for self/foreign player, Group mode and cohort; partial Items and Area unions; detached retained selections excluded; direct Item and legitimate live lineage evidence policy expressed centrally; scalar versus assessment input shapes separate; empty/missing/all-skipped cannot collapse; Admin-only extrema capability and dual-role union explicit.
- **Automated:** pure table-driven scope/state tests; global Item collisions and canonical mapping conflicts unchanged; original/fork identity distinct; identical overlapping references count once, conflicting resolved Group versions fail instead of auto-updating; all skipped versus empty/zero observations/corrupt; one eligible Card among outside Cards; no viewer-dependent widening. A scope plan creates no assignments or writes.
- **Visual/boundaries:** no visual changes. Define semantic states now; their rendering is 5.6. Do not feed the Progress resolver into ordinary Card ownership/presentation or introduce general policy classes.

#### 5.1b — Personal lifetime eligibility, versions and owner history

- **Scope/files:** snapshot read adapters in `frameworks/{eligibility,readModels,calculations}.ts`, `cards/retainedAssignments.ts` and existing Group membership/reference readers. Extend summaries, source-title loader and Item history eligibility together.
- **Dependencies:** 5.1a; existing personal/current-follower/retained assignment evidence. No Group navigation control approval needed for numeric/history eligibility.
- **Acceptance:** max legitimate adopted version once per exact Card identity, no publication-only adoption, frozen departed references, active/archived personal Decks, current Group-only virtual defaults and owner tests; no personal adoption/date/private mutations. Direct Item history independent of Card eligibility is retained.
- **Automated:** Framework/reader/history integration suites: personal+A/B v1/v2/v3 versus unadopted v4; personal/Group Deck removal; removed/rejoined/now-Admin-only members; no orphan expansion/backfill; missing expected ordinary rows/versions incomplete; identical ordinary-only results except approved eligibility/version and skipped-state output changes.
- **Visual/boundaries:** none for evidence correctness; My Progress label/rendering comes later. Do not add historical working links or implement assessment storage here.

#### 5.2a — Assessment targets, provenance and compatible personal storage

- **Scope/files:** `assessments/{contracts,repository,history,client,historyClient}.ts`, `cards/{model,personalHistory}.ts`, narrow projection/types. Preserve embedded lists; conceptual frameworkItemId adapter; immutable createdAt plus additive provenance and safe origin display DTO.
- **Dependencies:** 5.1a scope/authority contract; 5.1b's owner selection is available before complete integration. Origin-name resolution checks actual current authority, not membership in the viewing Group alone.
- **Acceptance:** exact target/owner separation; new manual actor/method/time server-stamped; provenance immutable on edit/retry; Personal/authorised name/Other group/Unknown are reliable and redacted; no raw inaccessible Group IDs/names. Existing result/date/list/revision contracts and legacy rows remain valid.
- **Automated:** spoofed actor/time/origin rejected; explicit entry context validation; valid legacy createdAt/no origin remains Unknown; two contexts/retry preserve initial intent; all history/source-list projections retain provenance; unauthorised origin-name lookup excluded; no extra personal data; current edit/delete/uncertain retry and no-resurrection tests.
- **Visual/boundaries:** DTO/tests now, two-line modal date/context cell in 5.6. No collection migration, audit log, import/on-behalf feature or coloured symbols. Use HTTP-safe IDs/preparation handling when the shared modal adapter is touched.

#### 5.2b — Personal assessment creation through Group contexts

- **Scope/files:** own Group Card/Item command routes, in-session membership/context adapter, existing personal storage/materialisation/list queue. Add affects the same personal list, not Group tests or fake Deck membership.
- **Dependencies:** 5.1a/b and 5.2a; existing current-member fences/version guards.
- **Acceptance:** authorise owner, current follower and current Card/Item scope; materialise missing legitimate own CardData before list checks in the same transaction; no target-date/cadence changes. Retained owner edits/deletes stay available through established owner rights; foreign inspection never writes.
- **Automated:** never-opened Group-only Card; shared personal/A/B list; first insertion versus scalar write; removal/adoption versus Add; own direct Item Add from personal and Group entry; forged subject/foreign writes denied; result origin from actual submitted context; lost response/retry/HTTP LAN preparation failure does not strand Saving or duplicate events.
- **Visual/boundaries:** reuse existing assessment editor after 5.6 wiring; no new marking or attribution workflow and no normal Card redesign.

#### 5.3 — Group-owned Card/direct Item assessment domain

- **Scope/files:** optional lists/revisions in `groupExperiences/model.ts`; dedicated Group repository/history adapter, existing assessment pure helpers and routes. Implemented exact source endpoints `/api/group-experiences/:id/cards/:cardId/tests` and `/items/:frameworkItemId/tests`, ID-specific mutations and current-scope history readers. Global Item identity permits retained exact-source management after Framework configuration changes; new Item entries still require configured current Group scope. Personal Group-context Item routes retain their Framework view parameter.
- **Dependencies:** scope/capabilities and provenance contracts. **P5-Q1 is approved**: current Admins may read/correct/delete exact retained sources; new out-of-scope entries remain denied.
- **Acceptance:** current Admin writes only, current members read applicable Group tests, personal/Group A/B ownership independent; new tests require current Card/in-scope configured Item; list CAS separate from structure revision; scalar/membership fields survive; stored tests retained after composition/configuration removal. Exact retained-source management requires current Admin authority and CAS; no historical discovery UI.
- **Automated:** equal Admin races, follower/peer forged writes, absent counters/first-row race, duplicate ID/stale Add/Delete, lost-response reconciliation on captured Group list, role/adoption/removal races, provenance immutability, retained-record preservation and the approved Q1 retained-source rights.
- **Visual/boundaries:** no new history browser or removed-follower tests. Static 5.0 assessments are not migrated; use disposable fixtures for real persistence tests.

#### 5.4 — Scoped metrics, capabilities and authorised assessment reads

- **Scope/files:** scoped Group Framework summary/history routes, `groupExperiences/{policy,readModels,learningReads,presentationReads}.ts`, new assessment-only adapter and Framework scope modules. Suggested summary `/api/group-experiences/:id/frameworks/:frameworkId/summary`; exact route details may reuse current conventions. Resolve scope, subject, Group state/cohort and source revisions in a consistent snapshot.
- **Dependencies:** 5.1 scope/eligibility and 5.2/5.3 assessment contracts; current in-scope reads do not wait for dormant-source UI. Every viewer gets server-derived capabilities, not an Admin-only object.
- **Acceptance:** raw eligible-Step completion, raw confidence once, Admin-only per-player extrema omitted/denied for all non-Admins even peer On; active followers only; named self/peer metrics and tests have identical scope; live inherited evidence parity, direct Item tests regardless of origin; no outside personal data; Group Tests stay separate. Revisions/leases/revalidation reject late or revoked data.
- **Automated:** unequal denominators, skip/empty/all-todo/rounded-100, independent confidence, all-null/malformed data, dual roles/zero followers, raw Area unions; direct/history guessed IDs and cross-Group denial; projections inspected for private sentinels; source chain cycle/missing/duplicate/sibling; same event reached twice; legacy/name-redacted provenance; both peer settings with no extrema for non-Admins; removal snapshots unchanged after later personal tests.
- **Visual/boundaries:** none for maths/authority. No full-user foreign queries, universal cache, all-history eager prefetch or real-participant enablement. Preserve scalar reader exclusions; deliberately add positive test-read coverage for authorised assessment routes.

#### 5.5 — Contextual Progress entry, destinations and return state

- **Scope/files:** existing `OverviewMenu`, `DeckMenu`, `GroupExperienceDeck`, `AppShell`; `frameworks/{destinations,progressNavigation,progressClient}.ts`, destination dialogs and context-keyed hooks. Parameterise one Progress interface, normal /progress personal only and a proposed experience-scoped route behind existing flag.
- **Dependencies:** 5.4 read/capability contracts and **approved P5-Q2 entry/control contract; wiring remains outside the 5.1a–5.3 commission**. No combined Group selector. Validate route parameters/return state against current membership/content rather than trusting URL payloads.
- **Acceptance:** normal entry always My Progress; Group entry defaults self for all active followers including Admins, Group for Admin-only; return restores valid originating Deck Card/face/perspective; access loss returns My Decks. Framework/Area/Item/scroll identity is context-safe. Personal destinations include distinct named current experiences and target self; retained-only references never produce working destinations.
- **Automated:** personal+A/B same template/versions, dual-role defaults, all roster pages, removed/revoked entry, adopt between discovery/open, account switch/late response, browser Back/re-entry, return restoration and fallback, existing Library/archive/restore unaffected, no automatic personal Add.
- **Visual/boundaries:** review approved menu entry and return continuity on phone; no Card animation/geometry/picker changes or unrelated menu redesign. Existing global My Progress remains simple.

#### 5.6 — Progress presentation, history context and specific skipped indicators

- **Scope/files:** shared `ProgressShell`, `FrameworkProgressTable`, `ItemTestsCell`, assessment modal/control/history hook adapters; narrow Progress CSS/portal; `CardSemanticAnchors`, `deckFrontPresentation`/`DeckFrontContents`/`DeckScene` and mapped tile transport only as necessary for §9.5. Split delivery into (a) stable selectors/modes and semantic states, (b) history/popovers and skipped visual verification.
- **Dependencies:** 5.1 explicit states, 5.4 DTOs and 5.5 approved navigation. New skipped indicator meaning is approved; precise outside strikethrough/faint visual weights remain provisional until iPhone acceptance.
- **Acceptance:** exact labels Group/My Progress in Group/My Progress; metadata always present; authorised arrows and stable Framework/expansion/visible Item/scroll; sticky selector with stable space for mode controls. Same four-column table, Group Tests in both modes, player Tests visible/read-only when foreign; no stale data beneath new labels. Two-line date/context cell truncates long names; normal symbols/editing retained. Touch popovers follow §9.4/capabilities.
- **Skipped acceptance:** Framework completion says **skip** for valid all-skipped in-scope personal/Group/cohort, distinct from outside dashes/unstarted/unavailable/empty; confidence/tests stay independent. Card all-skipped indicator uses skipped styling in the same geometry; nonempty all-skipped Deck front omits percentage; other percentages/content unchanged. Main-reference progress bar/Step geometry and touch target assertions remain exact.
- **Automated:** actual Chromium/WebKit mobile/desktop components, all contexts and both Card faces/ordinary/focused/grid representations as affected; state-specific accessible names; arrows/open/closed overlays and outside/Escape; long Group-name origin truncation; loading failures/rapid switches preserve row and never expose stale subject; owner/foreign/Group test control and retry interactions; Card confidence/signals/progress editing/face/gesture/picker regressions; nonempty/all-skipped/partial/empty Deck and destination tiles.
- **Visual:** focused disposable iPhone review of sticky/header height, outside strikethrough/faint placeholders versus readable skip/unstarted states, popover placement, context line truncation and unchanged Card/Deck geometry. Do not manually repeat arithmetic/privacy/persistence checks. If a broader layout change appears necessary, stop for approval.
- **Boundaries:** no additional columns/permanent secondary numbers, custom context tree, search, new assessment interaction, changed Card spacing, media/Info/reflection work or comprehensive unrelated accessibility remediation.

#### 5.7 — Consolidated regression and implementation handoff

- **Scope/dependencies:** commissioned 5.1–5.6 complete, Q1/Q2 resolved where required and visual treatments accepted. Reuse the disposable 5.0 harness without altering production Framework definitions; extend future fixtures only under implementation authority. Add partial/outside Items/Areas with private personal evidence, overlapping A/B versions, live lineage, legacy/new provenance, two Admins/dual roles and active/removed members.
- **Acceptance/tests:** run relevant Framework/assessment/history/shared-learning/Group policy/lifecycle/destination suites and existing personal/Card/Library/Info regressions as affected; TypeScript, targeted lint, build and diff checks. Test deterministic membership/adoption versus assessment interleavings and lost responses. Preserve every non-assessment private field denial. Record actual commands/results, intentional approved skipped expectation changes and any unresolved failures; do not inherit 5.0 passes as current verification.
- **Manual:** physical iPhone acceptance of authorised Progress/navigation/modal/skip/outside visuals only after automated checks. Document exact disposable URL/credentials/stop instructions when that future environment is prepared; no services start in this planning task.
- **Handoff/boundaries:** separate completed prototype from permanent data/API implementation; complete file/API/schema/index inventory, capabilities, known membership-trust limitation, remaining operational prerequisites and rollback. No new membership acceptance/adultLeader, multiple Decks, Group provenance colours, historical browser, Phase 6 work, commit or rollout without a specific commission. Stop at the authorised boundary.

### 9.8 Remaining decisions, provisional visuals and deferred trust

**P5-Q1 — Approved: retained Group-owned assessments.** Retain Group Card/direct Item results after composition/configuration loss. Exclude removed-only sources from current Group Progress. Current Group Admins may read/correct/delete existing results by exact retained source identity and proper revision/transaction guards; do not create new results outside current scope, restore removed Card navigation or add a historical browser. Existing personal-owner retained rights remain independent.

**P5-Q2 — Approved for later 5.5: Group Progress entry.** The existing top-right three-dot menu of an open Group Deck includes Progress for every current member; Group… remains Admin-only. Open fixed Group-context Progress, default My Progress in Group for every active follower including dual-role Admins, Group for Admin-only. Back restores the authorised originating Deck context; final access loss returns My Decks. Normal Progress remains complete My Progress. No entry/menu/navigation work is authorised in 5.1a–5.3.

**Provisional visual acceptance, not reopened product questions:** outside Item very light strikethrough and exceptionally faint dashes; subtle readable skip; compact sticky selector and stable mode-control footprint; long-name origin line. Validate with fixture-based iPhone review and accessible state text before permanent visual acceptance. Approved wording/inclusion/capabilities/defaults are settled and must not be re-decided from older P5-Q1–Q4 notes in the 5.0 historical record.

**Known membership-trust limitation — explicitly deferred:** creation/member assignment currently activates registered users and grants inspection without their acceptance or independent relationship verification. Keep existing creation/settings/member behavior unchanged for Phase 5. The founder understands this; do not introduce acceptance, verified roles or adultLeader to unblock writing/testing these checkpoints. Fixture/development readiness does not establish suitability for real-participant rollout, which remains separately gated.

**Organisation backlog requirement:** forthcoming Organisation work must establish trusted creation/inspection authority. Preferred future policy: verified Organisation **adultLeader** roles can create and assign without individual acceptance; Groups involving minors require **at least two adult leaders as Admins**, subject to the future safeguarding policy. If non-adult leaders may create Groups, invitation/acceptance before activation/inspection is a possible alternative. Exact policy belongs to that work; no new Phase 5 role or membership schema is authorised. Document small-cohort aggregate inference as accepted, not mathematical anonymity.

**Outside Phase 5:** removed-follower history presentation (existing snapshots remain), real participant/media enablement, multi-Deck persistence, Organisations, invitations, scheduling, contributions, media/galleries, Info Cards and reflection phases. Preserve accepted Phase 4 creation/settings/Card refinements and the unchanged independent review.

## 10. Group presentation and navigation

### 10.1 One physical scene, explicit perspectives

Introduce a thin group Deck adapter around the existing Card/Deck presentation, rather than mounting one `DeckDetail` per follower. It owns viewer-local `{experienceId, activeCardTemplateId, side: front/back, perspective}`. The main scene receives controlled active Card/side callbacks; ordinary personal callers retain current uncontrolled defaults. Refactor only the existing state seams needed in `DeckScene` and `FocusedCardView`.

All representations show the same selected Card and orientation. Perspective switching replaces authorized data/capabilities while retaining the main object's navigation/flip state. Keep existing transitions and geometry until approved. Media players, editor drafts, selected Info publication and pending uploads remain bound to their actual context, not merely the visible CardTemplate ID. Do not synchronize StepView position between people; close/preserve its local state through the existing safe transition rules.

The accepted Phase 4 specification supersedes the original picker proposal: Admins see Group and active followers; active followers see Group/self and may inspect active peers only when the default-Off policy permits it. Former followers never enter ordinary perspective navigation; historical inspection remains a separate admin-only, deferred settings presentation. Do not fetch a full peer Card and rely on hidden controls. Private content cannot enter a hidden miniature or peer matrix. Scalar Card/picker payloads remain assessment-free; authorised assessment data is fetched only through the Phase 5 scoped readers, not by broadening the miniature DTO.

Viewer navigation belongs to the viewer's member row. Inspecting a follower never writes that follower's active Card/openedAt/date. Group selection changes preserve the viewer's active Card if retained, otherwise choose the first remaining Card or null as existing Deck behaviour does. Front/back side remains viewer-local. No cross-user broadcast.

### 10.2 Prefetch, invalidation and editing

On entry fetch one composition and batched lightweight current-Card perspectives. For up to 20 followers, prefetch their allowed scalar data when the viewer is an admin. Preload the next/previous Card's lightweight summaries after the active one; larger rosters use batches of 20. Do not preload every Card × member × contribution list. Miniatures render public content/layout tokens plus allowed scalar values, without full scene/media/editor machinery.

Only the selected perspective activates contribution pages, Info consultation and heavy media. Preserve the existing main Card's approved instructional-video preparation; none is multiplied per miniature. A loaded perspective switch performs no blocking network request and does not remount the whole Deck scene. Work still in flight retains its captured target, and results are ignored by a different context. Do not carry a reflection draft from follower A to follower B because their Card IDs match.

Every successful own learning/assessment mutation invalidates affected authorised personal/Group/Framework resources for that owner/source. Preserve accepted Phase 4 visible polling (currently 4 seconds) and approximately five-second authority lease, focus/re-entry checks and one in-flight verification. Verification failure/expiry hides foreign results; a longer content retry interval cannot extend that lease. Future heavier contribution/history refresh may use revision changes, explicit opening or a separate modest interval; it must not replace access verification. Pause while hidden and revalidate on focus. Do not replace an open pinned Info snapshot on ordinary content polls. No realtime service is required.

### 10.3 Entry and visual approval

Reuse My Decks infrastructure for named experience entries, including admin-only access without manufacturing follower progress. Personal ordering/archive/restore stays personal; group entries expose only approved experience actions. A user who is both admin and follower receives one experience entry with the appropriate perspectives, not duplicate role tiles.

Creation/settings, miniature geometry and follower switching are accepted Phase 4 behavior. Phase 5 Progress uses the approved fixed-context/two-mode contract in §9; only its exact existing-menu entry/Back affordance and provisional phone visual treatment remain gated. Removed-history presentation stays deferred. Later private-content overlap, older-media and recipient controls retain their own phase-specific approval gates. No dashboard or broader management suite is implied.

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
| Foreign learning projection | Scalar DTO/query stays test-free. Explicit assessment routes select only authorised target/source tests and safe origin labels; zero media/reflection/private Info/date/unrelated tests or inaccessible origin IDs in query output/JSON. No full `getPersonalUser(subject)` call. |
| Query shape | No per-follower HTTP call. Database queries bounded by member/Card batches (100 IDs per database batch); no unbounded join of user media/tests. `explain` must use appropriate experience/member/contribution indexes. |
| Summary/perspective payload | At 20×12, initial lightweight response ≤250 KB uncompressed, excluding separately requested content/media pages; active-Card perspective batch ≤100 KB. |
| Summary latency | Warm disposable-replica-set p95 ≤300 ms repository time over 100 reads at 20×12; same-region staging end-to-end p95 ≤1 s. Report separately; mocks are not staging measurements. |
| Loaded perspective switch | No awaited HTTP request; p95 ≤100 ms interaction-to-next-paint in the approved browser fixture over 50 switches. No new main-scene mount per switch. |
| Media | Five thumbnail slots; at most 30 new metadata items per page; zero video players in miniatures; selected-gallery player only. Network tests assert no full-resolution fetch for every feed item. |
| Polling | One authority poll in flight; preserve accepted visible 4 s polling / approximately 5 s lease and focus/re-entry checks. Hidden/failed/expired verification hides foreign content. Any slower history/contribution refresh is separate from authority verification. |
| Concurrent workload | 20 independent followers each making 10 Step/signal writes plus membership/adoption interleavings; zero lost unrelated fields, unauthorized post-removal commits or duplicate personal rows. Record transaction retry distribution; normal local scalar p95 target ≤500 ms, staging ≤1 s. |

If a measured budget fails, first reduce projection/payload, add a justified index, batch or adjust polling. A batch size is not a total follower/media cap. No speculative aggregate cache/service is authorized by a failing microbenchmark alone.

Personal media arrays retain a practical document-growth limit. First use metadata projection and selected-field updates to keep group requests independent of those arrays. Commission a personal metadata migration only if representative **own-media** reads remain above 250 KB/page or p95 1 s despite bounded projections, or measured user documents approach 8 MB (an investigation threshold with headroom, not a user quota). Such a migration must preserve source IDs/order, every history/protected-media reader, rollback and old-client compatibility, and requires approval. Do not clear arrays merely to make one gallery query faster.

### 14.3 Deferred mechanisms

No staged follower provisioning, background aggregation, websocket synchronization, Redis, generic tenant/RBAC framework or personal-record migration is needed for the chosen model. Read-time computation remains O(active followers × selected Cards); missing expected scale targets triggers measured refinement. Media bytes and generic provider garbage collection remain outside the learning-data transaction model.

## 15. Phased implementation process

### 15.1 Operating rules and model choice

Phases 1–4, including Phase 4 Checkpoint 8/refinements, are accepted; their phase contracts below preserve historical scope and boundaries, not new implementation instructions. Phase 5.0 is completed and reviewed. The current commission updates this plan only. Future Phase 5 implementation follows §§9.1–9.8 and a new explicit instruction; no automatic implementation, commit, deployment, provider changes or production-backed fixtures.

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

### Phase 5 — Personal Framework, Group Progress and assessments

- **Objective/dependencies:** accepted Phases 1–4 and completed fixture preview 5.0. Establish one Progress-only scope/evidence model, then execute 5.1a/b → 5.2a/b → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 (§9.7). Scope, provenance, visibility, Admin-only extrema, contextual defaults and explicit skipped states are settled. Retained Group test management and exact Group Deck entry are approved in §9.8; entry wiring remains later 5.5 work.
- **Scope/reuse:** lifetime/max-adopted personal eligibility; current-composition Group mapping and identical self/peer scope; embedded assessment lists/provenance and safe live inherited histories; Group-owned test isolation; server-derived capabilities for every Group viewer; two existing-table modes/popovers; separate My Progress and fixed Group entry; safe destinations/return state; specific Framework/Card/Deck skipped indicators without geometry changes.
- **Files/tests:** detailed checkpoints in §9.7 name existing Framework/assessment/Group modules, shared Progress/history components, narrowly affected Card/Deck indicator adapters and disposable test harnesses. No new assessment collection, Group acceptance/Organisation roles or general policy engine.
- **Acceptance:** highest legitimate adopted version once per Card identity, lifetime retention without navigation grants; partial Items and Area unions; authorised relevant player tests including live sources and direct Item tests regardless of origin, no private content; all non-Admins denied extrema even peer On; raw cohort metrics; skip/outside/unstarted/empty/corrupt states distinct; history date/context redaction/truncation; existing personal/Phase 4 interactions and exact geometry protected. Preserve 5.0 execution record and distinguish fixture assessments from real persistence.
- **Manual:** focused iPhone acceptance of provisional outside strikethrough/faint marks, skip readability, sticky selector, context/history lines, touch comparisons and return continuity after automated checks. No new table layout/dashboard or comprehensive unrelated accessibility work.
- **Risk/rollback:** wrong evidence scope changes totals or discloses unrelated history; shared scope and database allowlists are mandatory. Do not drop legitimate Group eligibility on reader rollback; retain additive provenance/test fields and current denial rules. Membership trust remains a known deferred real-use limitation, not a prerequisite for writing/testing Phase 5.
- **Gates:** the current commission completes and separately commits 5.1a through 5.3 only. P5-Q1/P5-Q2 are approved and must not be reopened. A new commission is required before 5.4; fixture phone review gates final provisional visual treatment. Stop at the authorised checkpoint boundary and never start Phase 6 automatically.
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

Use at least two experiences containing the same public Card, an independent personal Deck, a second Card/fork, three public content versions, one private historical version, two admins, an admin who follows, active/removed/rejoined followers, an unrelated actor and a template creator without membership. Seed unique private media/reflection/Info/date sentinels and both relevant and unrelated assessment events. Tests must prove the new authorised assessment inclusion and unchanged private exclusions, not misclassify all tests as private.

| Area | Required assertions |
| --- | --- |
| Personal identity | Concurrent personal/group first creation yields one embedded row. A common Step mutation is visible across selected versions containing it. No group adoption changes personal pointers, target dates or private fields. |
| Version projection | Reorder preserves values; replacement defaults only the new ID; old values survive; selected-version percentages may differ appropriately; no Step-position copying. Unauthorized/unknown version and removed-Card writes denied. |
| Admin/peer privacy | Scalar readers still contain no tests. Scoped assessment readers positively include authorised relevant tests and safe labels; exclude private dates/media/reflection/Info IDs, unrelated tests and inaccessible Group/source metadata. Query spies and HTTP responses verify allowlists, live legitimate lineage only, peer Off denial and no foreign personal writes. |
| Groups | A/B contribution references, upload proofs, drafts and direct media URLs cannot cross contexts. Group-owned values/assessments remain independent from personal values. |
| Roles | Equal admins, final-admin concurrency, creator without role, dual-role counted once, follower removal with remaining admin role, later admin loss and current authorization on every endpoint class. |
| Aggregates | Active-only raw player-Step denominator and confidence; unequal eligible counts; doing/done from exact statuses; zero followers/empty/all-skipped distinct; rounded-100; `10,2,2,2 → 4`; Admin-only individual confidence extrema absent/denied for followers even peer On. Small-cohort inference is accepted; malformed required data remains incomplete. |
| Framework | Group-only eligibility without personal Deck; duplicates deduped; Q1 version rule; retained removed references owner-only; no unrelated orphan expansion; relevant personal test sources deduplicated; Group-owned tests excluded from personal results; existing mapping/fork/Area unions unchanged. |
| Assessment authority | Own Group-context test writes the same personal list; authorised foreign assessment reads succeed but personal mutations fail; Group Card/Item lists have separate owners/revisions; safe provenance and stale/lost-response reconciliation preserve origin and cannot resurrect deleted tests. |
| Media | Eight→five newest chronology/rightmost selection/count; all older items reachable; page ties/new inserts/deletes; correct own/private/inspected feed; uploader immutable; timestamp server-assigned once; no full-feed player/image fetch. |
| Info | Both roles select subsets; all admins read saved self/selected; author management versus admin-managed exception; other-editor drafts secret; one shared root; group-wide new join; epoch timeline; removed/re-added recipient; saved-asset reuse/provenance; legacy private notes unaffected. |
| Reflections | Unique tuple includes author, not role; no duplicated dual-role reflection; original creation chronology unaffected by editing; attributed former text; own edit versus group advance; CAS clearing; private overlap never copied. |
| Removal history | Change live personal progress/tests/media after removal and assert former response unchanged. New group Steps show not-assigned/unavailable. Rejoin reads live learning without restoring old snapshot values. |
| Progress states/UX | Personal and Group Framework skip for nonempty all-skipped observations; faint outside dashes and provisional light Item strike; no false skip for zero followers/empty/corrupt. Same four columns, two Group modes with Group Tests, My Progress versus My Progress in Group, dual-role self default, sticky selector/row stability, date/origin redaction/truncation. Card skipped status and Deck percentage omission preserve main-reference geometry. |
| Client | Same Deck identity in personal/A/B; actor/subject separation; controlled active Card/side; original-target pending mutations; no private cache reuse after role/account change; polling doesn't overwrite local drafts or pinned Info content. |
| Provider | All app routes covered by mocks, then separate real-origin/unsigned denial and upload CORS verification. No flag or mock test alone certifies provider privacy. |

### 16.2 Deterministic interleavings

Integration tests explicitly pause one transaction/operation at the relevant boundary and run the competing command, then release it. Cover both orderings of removal/upload commit; removal/Info Save; audience change/exact-media read; delete/receipt retry; last-admin removals; join/adoption; adoption/same-Step and removed-Step write; personal adoption/group learning write; different-field admin writes; two admin Info Saves; clear/reflection Save; assessment Add/edit/Delete versus membership/adoption and scalar first-row insertion, and account/context switch/late response.

Assert final stored values and authority, not merely HTTP status. A successful stale read already authorized before removal is different from an unauthorized **new** grant after removal. Snapshot reads are not retroactively cancellable; the tests must reflect the stated contract. No test may use production Atlas or real provider assets without explicit operational authorization.

### 16.3 Existing regression selection

Reuse and extend `card-reuse.integration.ts`, `personal-lifecycle.integration.ts`, `update-adoption.integration.ts`, `frameworks.test.ts`, `framework-readers.integration.ts`, `frameworks.integration.ts`, `assessments.integration.ts`, `assessment-history.test.ts`, `personal-history-projection.test.ts`, `personal-info-cards.integration.ts`, `info-card-attachments.integration.ts`, `info-cards-api.integration.ts`, `info-cards-media.test.ts`, `info-card-consultation-client.test.ts`, `info-card-editor.test.ts`, `card-media-access.integration.ts`, `protected-media.integration.ts`, `card-media-viewer.spec.ts`, `keyed-user-card-media-upload-controller.spec.ts` and signal/rollback browser suites according to changed modules.

Add focused group suites instead of forcing every new scenario into old personal tests. Retain existing real-component pouch/geometry/maths/activity tests and personal Creator/Library/My Decks journeys. The final combined check includes typecheck, relevant lint and standard build. Do not weaken expectations to mask regressions. Deliberately supersede the old foreign-assessment prohibition and all-skipped 100 display assertions only where the approved §§7/9 contracts require it; preserve geometry and all other privacy/state assertions.

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
| Membership trust / Organisation backlog | **Explicitly deferred by founder:** current enrolment/creation stays unchanged in Phase 5 despite its automatic inspection-authority limitation. Future verified Organisation adultLeader creation/assignment and at least two adult leaders as Admins for Groups involving minors; possible acceptance alternative for non-adult creators. Do not implement these roles/workflows now or block fixture Phase 5 on them. Real-participant suitability remains a separate gate. |
| Release/account/safeguarding gaps | Controlled discovery, guardian/consent policy, retention/erasure and Admin recovery remain future pre-release work. Existing destructive account operations fail safely; real-use media protection is separately mandatory. |

Formal Groups/Organisations, private-template distribution, repeated runs, follower test assignment/marking, automatic test aggregation, realtime classroom control, new group deadlines, private-to-group content conversion and universal learning-store migration remain out of scope. Future Groups reference stable experience IDs; future deadline fields remain separate from personal target dates; future assignment tests receive separate ownership/contracts rather than repurposing personal result ownership.

## 18. QUESTIONS / approval requirements

### Q1 — Approved: Framework version basis and lifetime eligibility

One calculation per exact CardTemplate, using the highest legitimately adopted personal/Group version including retained assignment references; never an unadopted publication or revoked working-navigation grant. Phase 5.1 consumes the implemented retention foundations. No further decision is requested.

### Q2 — Phase 5 decisions and provisional visual acceptance

The founder has approved the central scope model, separate **My Progress** / Group-context routes, exact perspective labels, dual-role follower-first Progress default, target-based personal tests including live legitimate inherited history, server-safe provenance context line, Admin-only extrema and explicit skipped/outside states. Do not reopen them from older review recommendations.

**P5-Q1 retained exact-source management** and **P5-Q2 existing-menu Group Progress entry/Back** are now approved in §9.8. No product decision blocks 5.1a–5.3; entry wiring remains 5.5. Provisional phone acceptance covers the outside Item strikethrough/faint marks, skip readability, sticky control footprint, history origin truncation and touch popovers; approved arithmetic/permissions are verified automatically.

Phases 1–4 and the 5.0 visual prototype are accepted; preserve their execution records. Later media/Info/reflection phases retain their separate UX gates for Private treatment, gallery/recipient/author management and carousel interactions. No dashboard, Card geometry redesign or new gesture is implied. Removed-follower history UI remains deferred.

### Q3 — Provisionally approved: one-hour signed video links

Reuse the existing one-hour signed Stream URL lifetime. Fresh grants are denied after revocation; previously issued links may work until expiry and downloaded copies cannot be recalled. Protected Group image origins, signed-only video and actual provider verification remain required. This approval permits no provider operations, deployment or participant enablement.

### Technical choices resolved by this plan

Use shared CardData and sparse Group state; virtual unstarted defaults with integrity checks; legitimate retained assignment/version evidence; current membership/role fences; snapshot-only former scalar reads; separate allowlisted assessment projections; embedded lists and existing desired-state retry/CAS; immutable server createdAt/provenance; central Progress scope/state derivation and capabilities for every Group viewer. Internal names/routes may follow existing conventions without changing those contracts. Future multi-Deck scope retains one explicitly adopted Card version per experience, preserving it when an overlapping Deck is added; no such feature is implemented now.

### Deferred trust and operational approvals

Current Group enrolment/assignment behavior is knowingly unchanged for Phase 5. The trusted creation/inspection boundary belongs to forthcoming Organisation work: preferred verified adultLeader creation/assignment and at least two adult leaders as Admins for minors' Groups, with a possible invitation/acceptance alternative for non-adult creators. Exact future policy is not decided here. Do not implement roles or acceptance as an implicit Phase 5 dependency. Fixture/development acceptance is not approval for real-participant use; small-cohort mean inference is explicitly accepted, not mathematical anonymity.

Provider setup/verification, live index installation, device acceptance and deployment require specific operational authorisation. Prepare concrete reviewable work first. New Group assets never use a public-trial bypass. This documentation commission does not start/reseed services, write databases, commit or enable the feature.

### Implementation phase table and present authority

Phases 1–4 and Checkpoint 5.0 are complete. The current implementation commission covers **5.1a through 5.3 only**, sequentially verified and separately committed. Stop before 5.4; no navigation/UI implementation or rollout is authorised. Later-phase rows state future gates, not permission to proceed or commit.

| Phase | Scope | Recommended model / effort | Acceptance and current gate |
| --- | --- | --- | --- |
| 0 | Decisions, visual contracts and fixtures | GPT-6.1 Sol / High | Historical decisions preserved; remaining Phase 5 gates in §9.8 |
| 1 | Shared learning projection and client boundaries | GPT-6.1 Sol / High | Completed/reviewed/committed; see handoff |
| 2 | Experience, roles, assignments and Group learning | GPT-6 Astra / High | Completed with separate implementation commit |
| 3 | Adoption, removal snapshots and lifecycle races | GPT-6 Astra / High | Completed with separate implementation/handoff commits |
| 4 | Card perspectives, creation/settings and refinements | GPT-6.1 Sol / High | Accepted and committed at review baseline a6f2e32; preserve geometry/behavior |
| 5.0 | Isolated populated Progress visual prototype | GPT-6.1 Sol / High | Completed and phone-reviewed; fixture assessments remain fixture-only |
| 5.1a–5.7 | Scope, personal eligibility, provenance, assessments, scoped Progress/UI | GPT-6.1 Sol / Extra High for foundations commission | 5.1a–5.3 implemented/verified with separate commits; stop before 5.4. Q1/Q2 approved; later UI and iPhone acceptance remain deferred |
| 6 | Protected Group-media lifecycle | GPT-6 Astra / High | Future commission plus provider authorisation/verification; Q3 settled |
| 7 | Media collections/gallery | GPT-6.1 Sol / High | Future UX/device acceptance and appropriate implementation commission |
| 8 | Group Info domain/authorisation | GPT-6 Astra / High | Future commission; one root, private drafts, audience/receipt/role/media isolation |
| 9 | Pouch/editor sharing | GPT-6.1 Sol / High | Future UX approval; preserve existing editor/pouch and privacy boundaries |
| 10 | Member reflections/carousel | GPT-6.1 Sol / Medium | Future UX approval; original chronology/fade/tap/clear CAS |
| 11 | Integrated acceptance/release readiness | GPT-6.1 Sol / High | Combined regressions/build, device and operational gates; no automatic rollout |
