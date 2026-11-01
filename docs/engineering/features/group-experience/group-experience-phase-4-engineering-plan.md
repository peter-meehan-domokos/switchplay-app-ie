# Group Experiences — Phase 4 Engineering Plan

**Date:** 30 October 2026  
**Branch inspected:** `feat/group-experience`  
**Status (1 November 2026):** Phase 4, including Checkpoint 8 atomic creation/settings and subsequent iPhone refinements, is accepted and committed at review baseline `a6f2e32`. Q1–Q3 are resolved. Findings and execution/test records below describe their historical Phase 4 baseline and remain preserved. The founder's revised Phase 5 contract in the [overarching engineering plan](group-experience-engineering-plan.md), §§7 and 9, supersedes forward requirements about owner-only assessments and preserved all-skipped percentage displays; it also defines Progress-only scope/defaults/capabilities without redesigning the accepted Card interface. Checkpoint 5.0 is completed; this documentation update does not authorise 5.1a–5.7 implementation.
**Product authority:** [Phase 4 UX and Product Specification](../../../design/features/group-experience/group-experience-phase-4-spec.md), requirements P1–P15, created before this detailed plan. References to P-numbers below refer to that specification.  
**Project context:** [Overarching engineering plan](group-experience-engineering-plan.md), [Phase 1 handoff](group-experience-phase-1-handoff.md), [Phases 2–3 handoff](group-experience-phases-2-3-handoff.md). This document supplements rather than replaces that plan.

The supplied Phase 4 product decisions supersede conflicting older policies. Sections A–J preserve the planning baseline; the implementation record below identifies actual changes and verification. Section J/Q1–Q3 is resolved by the subsequent authorisation and specification P15. The accepted initial iPhone review is followed by the explicitly authorised Checkpoint 8 atomic creation/settings implementation; older exclusions describe the initial slice only.

## A. Executive assessment

The first-class Card model and Phase 1–3 backend support the requested interface without a replacement learning store, global state library or animation framework. The strongest reuse point is `DeckScene`, which already separates the physical scene from working-personal and canonical rendering adapters. Reuse the scene, gesture interpretation, progress strip, signal interaction and existing loading conventions.

Phase 4 is not only presentation wiring. It requires earlier-backend corrections and additions:

1. Group aggregates currently count skipped singletons/all-skipped followers as completed and can count rounded 100% as completed. Correct these locally before exposing the new numbers (§F).
2. Peer inspection is currently admin-only. Add a default-Off group policy with server checks, active-only subject selection and revocation-aware client state. Preserve admin-only historical snapshot access.
3. Group self reads currently contain only learning; they are insufficient for owner-private presentation. Add a distinct owner-only projection for the Phase 4 fields, with later private-content integration clearly separated.
4. Current group metadata is insufficient to render a full Deck; add an adopted-content presentation contract, bounded learning batches and minimal selection persistence.
5. Presentation types currently distinguish personal from canonical. Treating a group/follower DTO as personal would expose inappropriate controls, mix caches and change physical identities. Add a narrow third presentation kind with explicit capabilities.

The principal animation risk is using subject identity as a React/layout key: this would remount/reset Card state during perspective exchange. The principal privacy limitation is that server revocation cannot erase bytes already delivered to a different browser; visible-page polling gives bounded detection, not instantaneous remote erasure. Resolve Q1 before claiming acceptance.

Recommended delivery is the original seeded early slice, including named My Decks entries and actual APIs, with full creation/settings treated as the explicit Q2 scope option. Group front/back Step counts and G/F confidence are now Phase 4 requirements even though the older plan placed some presentation in Phase 5. Later contribution/assessment functionality remains deferred.

## B. Existing code and documentation findings

Paths below are repository-relative. These findings come from source inspection, not solely from previous handoff claims. Prior test results remain historical evidence; no application/test run was performed for this documentation task.

| Actual file(s) | Current responsibility and implication |
| --- | --- |
| `src/app/decks/page.tsx`; `src/components/layout/AppShell.tsx` | Server loads personal `membershipDTO`; client owns personal Deck selection/open verification, pending/error/retry, selected Deck and outer flip rotation. No group list/entry consumer exists. Personal opening is a POST with initialization semantics; do not reuse it for groups. |
| `src/lib/cards/readModels.ts:membershipDTO` | Returns substantial personal Deck/Card displays, not merely tile summaries. Group entries must use a separate discriminated source and cannot be inserted as fake personal memberships. |
| `src/components/decks/{DeckGrid,DeckTile,DeckFrontContents,deckFrontPresentation,myDecksLayout}.tsx/.ts` | Tile layout/attribution and group-independent personal summary logic. `DeckTile` uses `deckPresentationIdentity` for shared layout. Preserve category and Card-template creator attribution while using experience name in the tile attribution slot. |
| `src/components/library/LibraryShell.tsx`; `src/components/decks/DeckMenu.tsx` | Existing Library actions and three-dot menu; intended extension points for eventual Add as Group and Group… actions. No group creation/settings modal exists. |
| `src/components/decks/DeckDetail.tsx` | Personal adapter: owns `useWorkingDeck`, updates, personal media/assessment controls and `WorkingFocusedCardView`. Group entry should mount its own adapter around `DeckScene`, not enable this adapter with fabricated personal capabilities. |
| `src/components/decks/DeckScene.tsx` | Owns active index, focus state, traversal phase, entry reconciliation and viewport scaling. Exposes focused/back/overlay/action render slots. Keeps CardStack and surrounding scene while focused. Outer Deck face is supplied by parent. |
| `src/components/decks/{CardStack,DeckCard,FocusedCardView}.tsx`; `presentation.ts` | Stack keys/layout IDs use `cardPresentationIdentity`; focused article key is `card.id`. Focused content identity change resets flip, Step View and video state; deck face changes synchronize focused face. Existing personal identity includes owner/version. Separate physical identity from data/security identity for group switching. |
| `src/components/decks/FocusedCardView.tsx` | Fixed full-viewport focus layer, scrim dismissal, per-Card flip, Step View/Info consultation and separately hosted video. Current scaling uses viewport dimensions, not space remaining above a comparison grid. Grid scrolling must be outside its Card gesture surface. |
| `src/components/cards/{ActiveCardFront,StepList,StepItem,StepProgressStrip,CardHeader}.tsx` | Existing Step bar is 24×3 CSS pixels inside a larger hit area; callbacks select interactive versus static strip. `hasPersonalCard` currently gates progress. Good reuse for both editable and inspected perspectives after adding explicit learning presentation. |
| `src/components/decks/CardSemanticAnchors.tsx` | Central confidence, compact Card completion and target-date anchors; assumes personal data for learning and date display. Add paired confidence and owner-only date capability without relabelling inspected data as personal. |
| `src/components/decks/BackCardFaceContent.tsx`; `PulseFieldSignal.tsx` | Back requires `CardLayout`, combines personal media/reflection with signal rendering. `FocusedSignalRow` implements relative drag, its own pointer capture, and vertical navigation delegation. `PassiveSignalRow` removes editing. Refactor only the learning region/props needed for reuse; source-private portions stay in personal adapter. |
| `src/components/decks/gestures/{useDeckGestures,gestureThresholds,gestureTypes}.ts`; `motion/{deckMotion,transitionState}.ts` | Semantic vertical traversal/flip interpretation, locks and calm motion constants. Add perspective exchange constants separately from existing traversal meaning. |
| `src/app/globals.css`; `src/constants/cardStack.ts` | Fixed-focus layering, shared Card geometry, CSS progress states and confidence anchor. Skipped bar has distinct neutral colour/no shadow despite full-width fill. Add scoped group CSS; do not globally restyle personal Cards. |
| `src/lib/groupExperiences/{model,authorization,repository,contracts,indexes}.ts` | Five collections, independent roles, final-admin checks, assignment references, member fences and structural receipts. No peer-visibility setting or remembered perspective. Metadata GET contains title and Card IDs/version/title only. Roster includes removed/admin-only members and sorts by user ID; it is not the UI picker source. |
| `src/lib/groupExperiences/{learningReads,readModels}.ts` | Foreign reads project nested learning allowlists inside Mongo; missing rows distinguish legitimate unstarted state from corruption. Aggregates reuse personal percentage equality for completion, the mandatory mismatch in §F. |
| `src/lib/groupExperiences/{adoption,lifecycle,publicVersions}.ts` | Exact public adopted content, stale-review handling, stable-Step preservation, metadata-only adoption fanout, frozen removal generations/rejoin. Retain these boundaries. Snapshot metrics call the group metrics helper, so audit them when correcting it. |
| `src/app/api/group-experiences/**`; `src/lib/groupExperiences/http.ts` | Real authenticated routes, no-store responses, optional checked viewer header and disabled-by-default `SWITCHPLAY_GROUP_EXPERIENCES_ENABLED`. No UI or production enablement accompanies existing backend. |
| `src/lib/cards/{learning,personalLearning,learningContext,workingCardStore,personalWork}.ts`; `src/lib/deckMutations.ts` | Explicit-version stable-Step learning, narrow mutations, experience scheduling leaves target date null. Context cache keys already include viewer/experience/subject/version; personal store rejects experience DTOs. Work barriers and invalidation reusable for own learning. |
| `src/components/progress/useProgressSummary.ts`; `src/components/library/useLibraryNavigation.ts`; `src/components/decks/updateClient.ts` | Local loading/error state, aborts/generation checks, visible-page revalidation, bounded mounted cache; working requests additionally verify actor. No universal request cache or fetching library. |
| `src/components/media/DeckVideoPreparation.tsx`; `src/lib/{deckVideoPreparation,cardPlaybackGrants}.ts` | Context-scoped resource pool, neighbouring canonical preparation, in-flight request sharing and expiry. Reuse the ownership pattern; do not reuse private playback grants for inspected users or implement group media here. |
| `src/app/api/users/route.ts` | Authenticated minimal `{id,name}` username directory, all users sorted by username; no search/pagination/photo or current UI caller. Creation-modal dependency only if Q2 includes it. |
| `src/lib/assessments/{repository,contracts,history}.ts`; `src/lib/infoCards/repository.ts`; `src/components/decks/WorkingFocusedCardView.tsx` | Existing assessment creation and personal Info editing carry ordinary working-Deck context. Existing owner history is not permission to pass inspected subjects to private APIs. Do not assume group-only assignment satisfies all existing editor/media transports. |
| `tests/group-experience*.ts`; `tests/helpers/groupExperiences.ts` | Foundation, privacy, API, lifecycle and capacity fixtures; current assertions explicitly expect skipped completion. Extend rather than replace. |
| `scripts/test-phase2.ts`; `playwright.phase2.config.ts`; `tests/phase2/*.browser.ts` | Disposable replica-set/browser harness, real auth, optional isolated LAN review mode. It does not yet seed a group fixture/provision group indexes or enable group routes for that fixture. `phase2` in these paths is the existing harness name, not a Group Experience phase boundary. |

Documentation inspected: current overarching plan §§2, 3, 6–14, 15–19, both handoffs, `docs/engineering/{architecture,data-model}.md`, and design animation/interaction conventions. The architecture/data-model documents explicitly mark mock-era sections historical. Existing handoffs say the feature is disabled and later UI remains unimplemented; they do not prove revised UX compliance. Installed Next loading-file guidance was also inspected in the preceding loading investigation; before implementation read relevant installed route/server-client guides as required by AGENTS.md.

## C. Requirements and phase boundaries

Legend: **Exists** = implemented foundation; **4** = this phase; **Prerequisite** = earlier backend correction/addition needed now; **Later** = named later phase. A later designation preserves the agreed final requirement rather than asserting it is already available.

| Spec | Coverage and delivery |
| --- | --- |
| P1 shared CardData, independent group state/adoption | Exists; 4 integrates and regression-tests personal/A/B overlap. No second personal row. |
| P2 defaults, restore, equal roles, own/group edits, read-only peers | Roles/writes exist; Prerequisite peer policy/selection persistence; 4 UI/capability enforcement and foreign-control removal. |
| P2 revocation including cached views | Fresh server membership checks exist; Prerequisite policy-aware checks; 4 scoped cache purge/revalidation; Q1 governs remote detection guarantee. |
| P3 compact identity, actual name/initials, alphabetical order, empty group | 4; Prerequisite permitted active identities and global alphabetical paging. Group+self-only trigger subject to Q3. |
| P4 focused three-column grid, lower 35–40%, retained scroll/selection, collapse/dismissal | 4; preserve accessible surrounding Deck and existing focus scene. |
| P5 ordinary upward list and whole-Deck perspective exchange | 4; complete selected Deck learning readiness before committing switch. |
| P6 all three motions, orientation and placed-Card continuity | 4; extend existing motion/scene interfaces; iPhone refinement after automated gates. |
| P7 front group bar plus doing/done on one line; all skipped edge cases | Prerequisite §F correction; 4 presentation. Supersedes older Phase 5 placement of extra values. |
| P8/P9 paired confidence and back markers/counts | Raw signal-weighted mean exists; 4 presentation/missing-value behaviour; back markers always read-only. |
| P9 Group/player tests | Phase 4 scalar Card/matrix responses remain test-free. Phase 5 adds separate authorised assessment-only history, including relevant live inherited and direct Item tests; personal mutations remain owner-only. No invented Group test zeros; fixture 5.0 is not persistent storage. |
| P10 existing own dates/private content | 4: distinct owner-private contract, own target-date display with private marker, strict foreign exclusion and typed deferred source boundaries. No new scheduling or date mutation feature. Full media/Info/reflection/test presentation below. |
| P10 own/private media and group media | Later Phase 6 protection, Phase 7 combined galleries. No real group media enabled in 4; canonical public Card content remains available through existing authorised presentation. |
| P10 private Personal Info vs self-addressed group Info | Later Phases 8–9 group domain/UI; owner group-context Personal Info access integration in Phase 9. Keep true-private versus admin-visible group distinction explicit in 4 types/tests. |
| P10 private/group reflection coexistence | Later Phase 10 source-specific display/editing. 4 adds no reflection editor or automatic copy/share; reserve separate source contracts and required comments. |
| P11 active-only picker/aggregation and frozen history | Snapshot backend exists; 4 excludes former subjects everywhere in ordinary navigation. Proposed Later Phase 5 history presentation in `Removed / Left Group` within approved settings, after settings entry exists; this is a scope placement recommendation, not an already assigned old-plan feature. |
| P12 public creation, full-screen settings, return-to-My-Decks | Creation/role APIs exist; rename/policy update and modal/directory do not. Q2 decides optional checkpoint 8 or a separately approved Phase 4 entry/settings follow-up before wider use. Not silently absorbed into the seeded slice. |
| P12 named tiles/category/group summaries and entry restore | 4 seeded entries use the final tile conventions and ordinary authenticated routes; no query-param role bypass. |
| P13 loading/races/empty Deck/version reconciliation | Existing primitives; 4 controller integration and lifecycle tests. |
| P14 accessibility, reduced motion, automated/iPhone strategy | 4 as §H; no deployment or live data operations. |
| Framework retained-reference consumption and group Progress | Later Phase 5; retained-reference foundations already exist. Use corrected aggregate contracts there. |
| Media deletion, one-hour signed links, shared Info audiences, reflection carousel | Later Phases 6–10 under overarching plan; no change to their approved privacy/ownership contracts. |

The early slice will therefore not yet display the entire final own-private media/Info/reflection/test collection inside a group. The prompt expressly assigns much of this presentation to later phases. Document these specific omissions in the implementation handoff, avoid fake empty/private-count indicators, and do not describe Phase 4 as complete Group Experience content support. Existing ordinary personal Deck functionality remains available.

## D. Proposed architecture

### D1. State ownership and persistence

Add a bounded `GroupExperienceDeck` adapter plus `useGroupExperience` controller under `src/components/group-experiences/` (proposed). Keep selection/loading state local to the mounted experience. A small resource/controller owns data reuse; no app-wide library or generic permissions framework.

State comprises viewer/session generation, experience ID, adopted composition/revisions, active CardTemplate, face rotation, selected perspective/subject, intended pending selection, focus mode, picker/list state, comparison-expanded state and grid scroll position. Physical navigation state is independent of which person's learning is displayed.

Persist a nullable validated `lastPerspective` on `GroupMember` (group/self/follower+subject ID) for restoration across visits/devices, matching the existing persisted `activeCardId`. UI panel expansion/scroll stays local; expansion resets on focus exit, not Card traversal. Persisted values are hints, not access grants. Default admin Group, otherwise self; check subject active status/current peer policy before restoring. Role loss/rejoin/adoption revalidates against current rights. Retain active Card and face through perspective change; only a real removed Card requires composition reconciliation.

Propose a small `PATCH /api/group-experiences/:id/navigation` with exact fields `{accessEpoch, expectedStructureRevision, activeCardId?, perspective?, subjectUserId?}`. It authenticates/fences the actor, validates adopted composition and requested perspective, and updates only member navigation metadata. Serialize/coalesce local navigation writes, bind all responses to their request/session; never use this endpoint to initialize dates or write learning. It does not increment the experience structure revision on every click. Missing stored preference is the existing-record default. Refresh on structural conflict before retrying current intent.

Keep opening as the existing POST `/open`: selected own row initialization uses experience scheduling, not ordinary Deck cadence. Do not call `/open` on every traversal merely to persist selection. Learning mutations can lazily initialize missing personal rows using existing narrow helpers.

### D2. Transport contracts and loading

Implement a shared server in-session presentation builder from `selectedContent`, `groupLearning`, `personalLearningForUsers` and `cardContentPresentation`. Avoid nested repository transactions by extracting/reusing in-session helpers. The My Decks server loader must check the same server-side feature gate before including group entries; a direct repository call from a Server Component does not pass through `groupRequest`. Do not rely on hiding UI to gate callable routes, or expose the flag as a permission grant.

Proposed route changes:

| Route | Proposed delta |
| --- | --- |
| `GET /api/group-experiences` | Add lightweight tile presentation/summary through a batched builder: category, experience attribution, canonical title/preview and **group-owned** progress/confidence. Never derive tile summary from saved perspective. Bound page size; no HTTP call per tile. |
| `GET /:id` | Extend existing metadata to a typed bootstrap: canonical adopted Deck/Card presentation, current viewer roles/policy/revisions, permitted saved selection, group learning/aggregate summary, and own learning/date when active follower. No peer private fields. Content computed once, not repeated for every identity. Chunk large compositions rather than introducing a product Card limit. |
| `GET /:id/perspectives` (new) | Paginated alphabetically ordered active identity and lightweight learning batches for selected adopted Card IDs; use bounded Card/member windows. Group is a separate first identity; admin-only people do not become follower tiles. Off-policy follower receives Group/self choices only, never full roster rows. |
| Existing `GET /:id/cards/:cardId/perspectives` | Reuse shared policy/batch builder for active-Card prefetch; existing current endpoint is admin-only/user-ID ordered and must be corrected. |
| Existing `GET /:id/cards/:cardId` | Policy-aware group/self/peer read; owner-only optional private projection distinct from foreign `LearningProjection`. Preserve admin snapshot branch only for explicit historical inspection. |
| `PATCH /:id/settings` (new) | Admin policy change with expected structural revision, operation ID/hash receipt and existing actor fence. Default missing `allowFollowerInspection` to false; schema accepts a boolean, never coerces truthy strings. Optional approved name changes only if Q2 includes full settings. |
| Existing learning PATCH routes | Keep self-owner/group-admin write matrix and stable-Step version guards; never accept writable foreign subject IDs. Return enough context to reject obsolete acknowledgements and invalidate affected summaries. |
| Existing snapshot/update routes | Keep admin-only. Peer permission never expands historical or adoption rights. No personal Deck Update/Creator controls in group adapters. |

For alphabetical paging, do not sort only each existing user-ID page. Query active memberships, join/project username only, sort by a defined case-insensitive username key then user ID and page by that tuple. Group stays first across pages; missing username uses the existing Unknown user fallback with stable ID tie-break. Use the existing experience/member index to narrow first; inspect query plan before adding any index. No denormalised username migration is required for this scale.

Cache canonical content once per adopted composition. Cache group/self/foreign learning separately, keyed by the existing `cardLearningContextKey` plus permission/structure generation. For the normal 20×12 fixture, fetch the permitted lightweight matrix in bounded batches to make whole-Deck and focused switches warm. Prioritise active Card and selected subject; fill remaining Card batches in the background. Do not issue one request per follower or download private content for the grid. Reuse the existing 30-item page and 100-ID database batch conventions; enforce payload budgets in tests and page Card windows too for large Decks. A paged identity list may progressively append alphabetically; the UI is not capped at 30 users.

A warm complete selected Deck switches without awaited HTTP. A cold selection keeps the old verified identity and its matching values until the new data is ready, with a restrained pending indication in the picker and retry on failure. Never label Alice's data Bob. Group-only/empty-Deck cases can render identity and empty state without a fake Card. Reuse content/learning rows across focused and ordinary views, so closing focus does not create a mismatched remaining stack.

### D3. Authorisation and owner-private boundaries

Add a pure policy predicate taking actual viewer membership, current experience policy and subject membership. It grants active peer inspection only when viewer is admin or an active follower with peer visibility On. Self resolves to the owner branch even for a dual-role admin. Group reads require current participant access. Former subjects require admin historical access; never allow the peer-policy branch to fall through to snapshots.

Retain `personalLearningForUsers` as the foreign batch reader with nested Mongo allowlists. Never broaden it to retrieve dates/media/tests and delete fields afterward. A separate owner-only reader requires `actor === owner`, active follower membership, selected Card in adopted Deck and valid public selected version. In Phase 4 it reads only the required personal date alongside learning; the owner-private type can later gain distinct source records through dedicated loaders. Do not return entire owner histories as part of a shared matrix or combine them with foreign cache rows.

Own progress/signal writes use the existing personal mutation helper and `personalWork` owner/Card scope shared with personal Decks. Group writes use group API/state and a distinct work key. After successful own writes invalidate `workingCardStore.invalidateLearning(actor, cardId)` and the group's mounted personal projections; after group writes invalidate only group learning/summary. Polling detects other participants' changes; no WebSocket subscription is assumed.

Private loaders in later phases will bind `source.kind` (personal/group), owner, experience where applicable, source CardTemplate/contribution ID and context revision. Own personal data read through a group remains personal; do not rewrite its ownership. Switching perspective cancels/hides private editors/media before foreign content becomes active. The permissions boundary is server authority; disabled/hidden controls merely reflect it.

### D4. Revocation, stale responses and failures

Use existing `structureRevision` as the permission generation initially: policy/role/membership/adoption changes already need structural transactions. Return the current value with all group DTOs and paginated results. All new reads authenticate again; operations started after a revocation commits see the new denial. Existing writes retain transactional actor/member fences. A structural revision check is not permission by itself.

On local policy save/removal, synchronously purge affected foreign rows, pending selection and persisted local hints before accepting further switches. Other mounted views invalidate on the next authority refresh. Reject any late response if viewer/session, experience, selection generation, adopted version, structural revision or relevant subject access no longer matches. Discard partial pages spanning revisions. Subject removal must invalidate cached subjects even though the viewer's access epoch is unchanged.

Recommended Q1 policy: visible-page authority/learning refresh every 5 seconds, plus focus/pageshow and re-entry refresh; hidden pages pause polling and mask peer content until current authority is checked on return. If authority checks fail or the authority freshness lease expires, hide cached foreign values and require Retry. Cache reuse never extends the lease. A late read begun before revocation cannot renew it beyond the original check start; structural revision responses are monotonic within a session. Fresh server denial is immediate; remote visual removal is bounded by detection and network availability, not instantaneous. Previously downloaded bytes cannot be erased. Confirm this policy explicitly before implementation; no read locks or extra polling claim can solve the physical limitation.

Controller requests use AbortController, checked viewer headers and session generation. Shared pending reads coalesce by context; one consumer leaving does not cancel a request still used by another. Keep snapshots immutable for `useSyncExternalStore` if used; a local hook plus resource subscriptions suffices. Never put group DTOs into `workingCardStore`, whose private overlays and personal-adoption identity are deliberately incompatible.

Capture mutation target at dispatch, not from current selected perspective at completion. Track pending writes per owner/Card/field and optimistic confirmed values. Rapid perspective switching may continue for already loaded targets; completion/rollback applies only to the original target. Adoption invalidates selected-version projections and reprojects stable Step IDs without rewriting personal adoption; never transfer by position. Offline/permission failures do not fabricate empty aggregates or silently retry destructive structural commands.

### D5. Presentation types and composition

Add explicit experience variants to `PresentedCard`/`PresentedDeck` or equivalent small adapter output in `presentation.ts`; do not cast inspected DTOs to `CardLayout`. A group Card presentation contains canonical content, selected version, discriminated learning, optional group follower aggregates, capabilities and an owner-only date branch. It contains no synthetic private arrays, personal adoption pointer or fake DeckData.

Add small accessors for learning and physical identity, rather than repeating role checks throughout leaf components. Audit every `hasPersonalCard`/`hasPersonalDeck` false branch: it currently assumes canonical and may access canonical-only fields. Preserve existing personal/canonical outputs exactly. `hasPersonal*` continues to mean real personal working representation, not any Card with progress.

- `ActiveCardFront` → `StepList` → `StepItem`: optional learning/follower-count props; wrap existing strip and count text in a scoped inline-flex row, nowrap, aligned centre. Keep the existing bar/hit area; no second line or bar shrink. Read-only foreign Cards receive no cycle callback.
- `CardSemanticAnchors`/`CardHeader`: allow single or paired confidence presentation and owner-private date. G/F are superscripts with meaningful accessible labels; missing displayed values use dash and never coerce to zero. Guard null/empty dates before formatting: the current focused personal path formats `card.targetDate`, whereas newly materialized group rows legitimately have no date. Existing personal defaults remain untouched.
- `BackCardFaceContent`: extract/reuse the signal learning region/row primitives, leaving personal media/reflection composition in the personal adapter. Proposed group back adapter uses the same layout/classes, three read-only Step markers, abbreviated counts and paired numeric values. Keep G editing attached only to group signal interaction; F is always passive. Read-only peer rows have neither sliders/edit labels nor disabled editor controls.
- `GroupExperienceDeck`: mounts one `DeckScene` with group-specific back/focused render adapters and picker overlay. Do not mount `WorkingFocusedCardView`, personal Update discovery, Creator/fork controls or personal media loaders for inspected rows.
- `DeckGrid`/tile helpers: distinguish `{kind:'personal', deckTemplateId}` and `{kind:'experience', experienceId, deckTemplateId}`; use experience ID for selection, URL and layout identity. Group summary/attribution is fixed at tile level even after viewing a follower. Retain canonical Card creator attribution on main Cards.
- Deferred personal/group contribution slots are typed as unavailable/deferred rather than actual empty collections. No permission inferred from absence of a callback. Assessment slots are supplied only by an appropriate future owner/group adapter.

### D6. Motion, gesture and viewport integration

Separate **physical scene identity** `(viewer session, experienceId, cardTemplateId)` from **data identity** `(viewer, experience, perspective, subject, Card, selected version, permissions generation)`. Physical IDs remain stable when perspective changes. Content-version/media-source changes may reset only the affected content resources. Personal/canonical identity defaults remain backward-compatible.

Expose optional controlled navigation/face and focus-change hooks in `DeckScene`/`FocusedCardView`; avoid rewriting their state machine. The group controller shares active Card and face between all perspectives. Fix the focused `contentIdentity` reset path for experience adapters so a subject switch cannot reset rotation. Card traversal retains existing authored vertical variants and normal focused article Card key. Grid state/scroll lives outside that keyed article so it survives traversal.

Use distinct nested transform layers: existing traversal owns its y/placement transform; existing flip owns rotateY; a new short perspective-exchange layer owns modest x/y depth/scale/rotateZ. The ordinary exchange layer wraps the whole `CardStack`, including placed Cards, inside existing scene geometry. It does not move fixed picker/settings overlays or duplicate the full scene. Never write competing transforms on the same node.

Proposed starting exchange duration 120–180 ms with existing calm easing; focused uses a slight diagonal/depth exit/entry cue and ordinary incoming stack a small upper-left offset. Keep nonzero Card visibility and swap only matched prepared data at the exchange midpoint. This is a physical motion of the existing Card/stack, not a labels-only fade. Retarget rapid latest selection from the current animation state; coalesce superseded targets rather than queueing 15 animations. If iPhone review finds that insufficient, a noninteractive lightweight silhouette may be considered; no second live scene/player/editor. Timing remains a reviewable technical starting point.

Focused comparison overlay is a sibling of the focused article inside the focus layer and outside `.focused-card-object` gesture handlers. Use a measured lower panel around 35–40% of `visualViewport.height`, safe-area padding and a stable scroll container. Recalculate available Card scale/offset from remaining upper space rather than using the existing full-height minimum unconditionally. Leave a measurable tappable Deck strip above. Preserve fixed Card anatomy, not responsive internal reflow. On short screens use available-space scaling while retaining the agreed grid fraction; if text cannot remain usable, present measurements at visual review rather than silently changing layout rules.

Panel/list uses native vertical scroll (`touch-action: pan-y`, contained overscroll), stops pointer/click propagation to scrim/Card, and does not prevent default scrolling. Card gestures remain on the Card only. Signal controls keep their existing axis/vertical delegation. Expansion/collapse and perspective exchange must not strand pointer capture; lock conflicting structural transitions briefly and preserve latest selection intent. Tapping the exposed surrounding Deck closes focus, collapses grid and retains perspective; next focus entry is collapsed.

Use real buttons for picker/identities/collapse, selected-state semantics, `aria-expanded`/`aria-controls`, accessible full names despite truncation, visible focus and keyboard selection/Escape. Keep authorised read-only content navigable without exposing editing. Reduced-motion handling is new for these exchanges: use minimal/no travel and deterministic state changes, retaining clear selection. No blanket new navigation gesture or focus-trap redesign.

## E. Detailed implementation sequence

The checkpoint contracts below define the implementation gates. The subsequent commission authorises 1–7 and 9 only. See the implementation record for completion and verification; checkpoint 8 remains deferred. No later phase permission is implied by this plan.

### Checkpoint 1 — Correct neutral-skipped group calculations

1. **Purpose/behaviour:** accurate doing/done denominators; hide all-skipped/empty aggregates; preserve raw confidence weighting.
2. **Files:** `src/lib/groupExperiences/readModels.ts`, possibly a small `aggregation.ts`; `lifecycle.ts` consumers; group unit/integration tests; future documentation amendments in §G.
3. **Dependencies:** none on UI; validate current narrow learning projection inputs.
4. **Approach:** implement §F exact counters and group-specific null-on-empty percentage wrapper. Keep personal helper semantics unchanged.
5. **Tests:** truth table, 12-person example, mixed Card/Deck scopes, all-skipped/empty, rounded-100 trap, removed/admin-only/dual roles, independent confidence.
6. **Acceptance:** no skipped follower counted in doing/done or eligible denominator; all group scope results use exact statuses; existing personal Framework tests retain their established result.
7. **Risk:** snapshot metrics and DTO consumers must migrate together; historical snapshot values themselves are never rewritten.

### Checkpoint 2 — Peer policy, active choices and selection contracts

1. **Purpose/behaviour:** correct allowed perspectives and defaults; peer reads only when On; immediate fresh server denial after revocation.
2. **Files:** group `model.ts`, `authorization.ts`, `contracts.ts`, `repository.ts`, `readModels.ts`, routes for settings/navigation and existing Card/perspective reads; indexes only if query evidence requires.
3. **Dependencies:** Q1 and Q3 decisions; existing role fences/receipts.
4. **Approach:** default-false policy, structural CAS/receipt setting operation, pure viewer/subject policy, active alphabetical pages, validated persisted perspective. Preserve final-admin and historical snapshot restrictions.
5. **Tests:** roles × policy × self/active peer/removed/outsider matrix; forged actor/body; direct API writes; policy/removal races; stale navigation restore; default absent field; duplicate command replay; alphabetical page boundaries.
6. **Acceptance:** Off permits own/Group only for followers; On grants no private fields or write rights; all admin peers equal; target removal purges choices; policy setting cannot be changed by follower/creator-without-membership.
7. **Risk:** do not relax the generic `admin` role to make peer access work; keep management roster separate from allowed perspective DTOs.

### Checkpoint 3 — Presentation transport and owner-safe resource

1. **Purpose/behaviour:** load a group with enough adopted content for one reusable scene, show own date, switch warm perspectives without content fetches.
2. **Files:** group repository/read builders/routes; proposed `src/components/group-experiences/{groupClient,groupResource,useGroupExperience}.ts`; Phase 1 context/work helpers reused.
3. **Dependencies:** checkpoints 1–2; public selected versions; group indexes ready only in disposable fixtures.
4. **Approach:** canonical bootstrap plus bounded learning matrix, distinct owner-date projection, in-flight deduplication, context/revision generations, selection persistence and optimistic per-target write tracking; §D4 polling/lease behaviour.
5. **Tests:** no whole foreign CardData fetch; sentinel/date exclusion; own date survives; group-only user without personal Deck; coalesced requests; late account/subject/version results; pending-write switch/rollback; poll failure; revocation while response delayed.
6. **Acceptance:** one personal row; group/self writes independent; no subject-label/data mismatch; no stale rows accepted; no personal-date initialization from group entry; normal 20×12 payload/repository budgets maintained.
7. **Risk:** full content retrieval cannot use current metadata titles alone; own-private cache never shares storage with foreign rows.

### Checkpoint 4 — Reusable Card learning presentation

1. **Purpose/behaviour:** Group/self/peer front/back correctly show learning, paired confidence and read-only markers; foreign edits absent.
2. **Files:** `presentation.ts`, Card front/Step/header/anchor components, signal primitives in `BackCardFaceContent.tsx`, proposed `GroupCardBack.tsx` and presentation adapter, scoped styles.
3. **Dependencies:** typed DTOs/capabilities and corrected aggregation.
4. **Approach:** explicit experience union and learning accessors; extract only shared learning regions; no fake personal records. Implement one-line count row, G/F centre, owner date/lock, signal interaction only for permitted owner.
5. **Tests:** pure adapter contract; browser rendering of all statuses/nulls, one-line bounding rectangles, missing F versus zero followers, back marker read-only, no foreign buttons/sliders/target date/test counts; personal/canonical screenshots/geometry regressions.
6. **Acceptance:** three front/back Steps consistent; `3/11 doing · 2/11 done` and `3 · 2`; F omission/dash correct; group admin edits G only; private date visible only to owner.
7. **Risk:** audit existing false branches of `hasPersonal*`; missing group contributions must not instantiate personal reflection/media loaders.

### Checkpoint 5 — Named My Decks entry and stable scene state

1. **Purpose/behaviour:** seeded experiences are accessible as distinct named tiles; correct default/restored perspective; active Card/face survive switching and opening.
2. **Files:** `src/app/decks/page.tsx`, `AppShell.tsx`, tile/grid/front helpers, proposed `GroupExperienceDeck.tsx`, `DeckScene.tsx`, `FocusedCardView.tsx`, `presentation.ts`, isolated fixture harness.
3. **Dependencies:** bootstrap/resource and adapters; feature flag remains disabled outside isolated review configuration.
4. **Approach:** discriminated personal/experience selection (e.g. `/decks?openExperience=…`); real group API open; stable scene IDs, controlled group face/navigation, backward-compatible personal defaults. Group tile summaries always use group state.
5. **Tests:** personal and groups A/B same Deck do not collide; dual-role one tile; owner vs admin defaults; restore revoked subject fallback; zero followers/empty Deck; adoption removes selected Card; return to collection summary independent of selected person; scene mount counter.
6. **Acceptance:** one heavy scene; no personal Add/open/cadence path for a group; actual experience name at existing top-right attribution and category unchanged.
7. **Risk:** preserve ordinary personal URL/entry verification behaviour and creator attribution; do not share layout IDs across distinct experiences.

### Checkpoint 6 — Ordinary picker/list and whole-stack exchange

1. **Purpose/behaviour:** compact identity remains visible; upward list selects whole-Deck perspective and closes.
2. **Files:** proposed `PerspectivePicker.tsx`, `PerspectiveList.tsx`, group controller; `DeckScene.tsx`, `CardStack.tsx`, `motion/deckMotion.ts`, group styles.
3. **Dependencies:** complete selected Deck data readiness and stable physical identity.
4. **Approach:** authorised Group-first/alphabetical choices; Q3 compact two-choice handling; nested stack transform layer for upper-left depth exchange; no comparison grid here.
5. **Tests:** long names, Group-only noninteractive identity, list scrolling, keyboard dismissal, no foreign choices Off, active Card and face unchanged, whole stack geometry continuity, rapid out-of-order fetch/switch handling.
6. **Acceptance:** ordinary mode remains ordinary; no new-person labels over old values; loaded switches await no content request; all placed Cards participate coherently.
7. **Risk:** perspective animation must not overwrite existing traversal/scale/flip transforms or animate the entire fixed overlay coordinate system.

### Checkpoint 7 — Focused comparison grid and interaction continuity

1. **Purpose/behaviour:** three columns beneath main Card, preserved grid scroll through traversal, rapid comparison and automatic collapse on focus exit.
2. **Files:** proposed `PerspectiveGrid.tsx`; group controller; `FocusedCardView.tsx`, focus/viewport layout helpers and group motion/styles.
3. **Dependencies:** checkpoint 6 state/caches; existing outside-tap/Step/flip semantics.
4. **Approach:** stable panel outside keyed Card article and gesture hit area; measured remaining viewport; subtle named heading; selected tile; explicit collapse; diagonal/depth exchange layer. Source-private editors remain closed/ineligible during foreign display.
5. **Tests:** expansion/collapse, 35–40% panel bounds at representative mobile sizes, tappable Deck strip, native grid scrolling not traversal, Card traversal preserves grid and scroll, face unchanged over 50 perspective switches, dismiss/reopen collapse, keyboard/reduced motion, no thumbnail video players.
6. **Acceptance:** main Card moves continuously and stays readable; selected perspective survives all permitted transitions; no extra scene mount; warm interaction-to-next-paint p95 target ≤100 ms over 50 switches (animation may finish later).
7. **Risk:** small viewport/keyboard and hosted video layering; verify geometry and suspend conflicting gestures without blanket pointer suppression.

### Checkpoint 8 — Creation/settings entry work (authorised follow-up)

1. **Purpose/behaviour:** implement the approved full Add as Group/Group… modal, zero-follower creation, atomic Save and return to My Decks. This follow-up supersedes the earlier seeded-slice deferral of this checkpoint only.
2. **Files:** `LibraryShell.tsx`, `DeckMenu.tsx`, proposed group modal/directory resource; `/api/users`; settings route/name command; creation harness/browser cases.
3. **Dependencies:** Q2 approval; existing public manifest creation and role lifecycle operations. Never use all registered users as current perspective choices.
4. **Approved atomic contract:** one full-screen modal with name/Admins/Followers/peer setting. A small `ensureUserDirectory` plus subscribing hook reuses cached/in-flight minimal user data; load on modal open now, allow later shell prefetch through the same function. Alphabetical directory and selected-identity Card grid, without search or photos. `PATCH /:id/management` submits the complete desired state, operation ID and expected structure revision. One MongoDB transaction validates final roles, applies narrow member changes and removal snapshots, updates name/policy, increments the revision once and records the receipt. No independent member/settings requests from Save. Creation includes visibility in its existing transaction. Creator is always Admin, never implicitly Follower.
5. **Tests:** public-only creation, exact/lost-response retries including self-removal, injected rollback at each write stage, zero followers, dual roles, equal admins/final-admin races, stale edits/adoption, wrong user/session, directory cache/retry, Cancel with no writes, tile placement and return path, setting revocation.
6. **Acceptance:** all requested changes commit or none do. An uncertain network outcome retains the exact command for retry, never claims failure/success prematurely. An actor may acknowledge only their own exact committed operation after losing access; this exposes no Group content or renewed authority. Access retained: preserve the mounted Deck and valid Card/face/perspective. Final access removed: return to My Decks and remove the assignment. Creation returns to My Decks with the new Group first, preserving other entries' relative order. Explicit Create/Save and Cancel; no management dashboard or direct auto-open.
7. **Risk:** this is substantial extra scope compared with the seeded slice. Removed-history section remains Phase 5 presentation; all normal pickers stay active-only.

### Checkpoint 9 — Regression gate and review handoff

1. **Purpose/behaviour:** certify revised backend, UI continuity and private boundaries before phone refinement.
2. **Files:** tests and existing isolated harness, permitted implementation handoff/plan updates at that future time.
3. **Dependencies:** all included checkpoints green; no unresolved Q1/Q2/Q3 policy encoded as an implicit default.
4. **Approach:** §H commands, inspect source diff, record counts/machine/query budgets and remaining visual-only review. Supply actual isolated review URL and credentials while server runs.
5. **Tests:** selected existing and all new group suites, sequential type/build checks, targeted lint; network/payload and scene/player instrumentation.
6. **Acceptance:** no unexplained failures, no production fixture writes, exact implemented/deferred coverage and no Phase 5–10 feature creep. Stop for iPhone slice acceptance before dependent presentation phases.
7. **Risk:** successful mocks do not certify provider privacy or phone motion; report those limits accurately.

## F. Mandatory skipped aggregation correction

### F1. Located conflict

The overarching plan §3 source table (`progress.ts` row, around line 86) says reuse unchanged and count rounded-100 results. Section 9.5, Exact aggregate contract (paragraph around line 316), explicitly states: **“A skipped singleton therefore counts complete, an all-skipped Card counts complete”**. Its earlier summary of completed/total and §16 aggregate acceptance also require reconciliation with doing/done and eligible denominators.

Actual code: `src/lib/progress.ts:getProgressPercentage` excludes skipped entries but returns 100 when none remain. `src/lib/groupExperiences/readModels.ts:followerMetrics` counts a follower whenever `metrics(cards).completion === 100`, with denominator `followers.length`. `aggregateLearning` applies this at Deck, Card and Step scope. It has no doing counter. Thus skipped singletons count done, all-skipped scopes count done and stay in denominator, and 199 done + 1 todo rounds to 100 and can count done.

Tests encoding this are `tests/group-experience.test.ts` (skipped Step complete and rounded-100 examples) and `tests/group-experience.integration.ts` (Bob all-skipped yields completed 1/total 4). The Phase 2–3 handoff records reuse of all-skipped complete semantics; that was historical implementation, now superseded.

Other affected paths: `metrics` feeds group-owned summary and removal snapshot display metrics; new tile/Header/Deck display must not relabel a rounded percentage as explicit completion. `StepProgressStrip.tsx` uses a full-width skipped fill, but CSS gives skipped a distinct neutral treatment; this is a visual status encoding, not a count, and should remain. Personal `cardLayout`, `deckLayout`, Framework calculations and existing Framework tests deliberately use the old personal helper. Do not globally change them as a shortcut.

### F2. Proposed exact algorithm and contract

For a selected Step: each active follower contributes exactly one selected status. Exclude skipped; count `inProgress` as doing, `done` as done, and `todo` only as eligible. Return explicit `{activeTotal, eligibleTotal, doing, done, confidence}`. `activeTotal` is retained independently because confidence display depends on presence of followers, not non-skipped completion.

For Card/Deck follower roll-ups, proposed consistent extension: flatten that follower's selected Steps within scope, remove skipped, then:

- No remaining Steps → follower ineligible for progress in that scope.
- Every remaining Step explicitly done → done.
- Otherwise at least one done or inProgress → doing.
- Otherwise → unstarted but eligible.

This treats a mixed done/todo scope as started, a done/skipped scope as done, and an all-skipped/empty scope as ineligible. Never infer category from rounded percentages. Card/Deck categories are not new Phase 4 UI labels; they correct shared summary DTOs for later Phase 5 consumers. Document this derivation with examples in code.

For group-controlled percentage/individual group-context percentage and historical group snapshot metrics, first count non-skipped selected Steps: zero → null; otherwise reuse the existing percentage calculation over eligible input. Where a “Completed” label is shown in group context, use explicit nonempty/all-done status, not rounded percent equality. Carry `isComplete` if needed by the tile adapter. Personal views outside Group Experiences retain their existing helper/results; this is a deliberate compatibility boundary, not evidence that skipped means done in the group.

Confidence remains independent: include every valid selected raw reading, even if its completion Step is skipped. Ignore null/unset, never average rounded follower means; round once. Zero active followers → omit F; active followers/no readings → F dash, including when every Step is skipped. Missing/malformed stored data fails through existing validation rather than manufacturing a denominator.

Migrate `completed/total` group response consumers/tests to explicit names together while feature remains gated; do not quietly change `total` from active to eligible with ambiguous meaning. No production data rewrite is needed: summaries are computed at read time and snapshots retain statuses, not the incorrect count. Keep historical snapshot generation/privacy checks unchanged.

### F3. Required test table

| Inputs | Expected progress output |
| --- | --- |
| 3 inProgress, 2 done, 1 skipped, 6 todo | active 12, eligible 11, doing 3, done 2; front `3/11 doing · 2/11 done`, back `3 · 2` |
| No followers | active/eligible 0; no follower counts; no F portion |
| All skipped | eligible 0, no doing/done; hide counts; group bar retains skipped visual; F independently reflects readings or dash |
| All todo / legitimate missing personal row | eligible active count, doing/done 0; show `0/N` counts |
| Mixed done + skipped within one Card | ignore skipped, done if all remaining explicitly done |
| Mixed done + todo or inProgress within Card | eligible and doing; not done |
| Empty Deck | no eligible follower progress; no synthetic completed follower; empty content UI |
| 199 done + 1 todo | rounded percentage may be 100; explicit completion false and follower classified doing |
| One Step skipped, others eligible | Step denominators differ correctly; Card roll-up ignores only its skipped Steps |
| Removed follower / admin-only / dual-role | excluded / excluded / included once |
| Readings 10,2,2,2 | follower confidence 4, independent of statuses; no average of per-person means |
| All readings null; some null; fractional valid readings | dash when none; valid values equally weighted and final rounding only |
| Duplicate/invalid stored Step values or wrong selected version | existing validation/conflict, not quiet todo/skipped classification |

Add regression assertions on API DTOs, rendered front/back and new group tiles, plus unchanged personal Framework expectations. Update future removal-history tests to the corrected group-context metric without changing snapshot values.

## G. Cross-phase dependencies and documentation

Eventual implementation must update the overarching plan's role/perspective rules, §9.5 aggregation and §3 source-table statements, Phase 4/5 boundary, acceptance matrix and relevant Q2 design gate references. Do not rewrite past handoffs as if old tests never existed: add a clearly dated supersession note identifying corrected semantics. Those changes are **not authorised during this documentation task**, so this plan is the recorded discrepancy list.

Phase 5: follow the overarching plan §§7 and 9 for a central **Progress-only** scope/evidence model, lifetime eligibility and highest adopted versions, Group-owned tests, own Group-context test entry, and authorised active-player assessment history. Personal assessment visibility is intentionally extended to current Admins/permitted peers through narrow dedicated queries, including live legitimate inherited source tests and direct Item tests regardless of origin; private media/reflection/Info/target dates and foreign mutations remain denied. Every Group viewer gets server-derived capabilities; only Admins receive confidence extrema, even when peers can inspect. Separate My Progress/Group routes have Progress-specific follower-first defaults and preserve the accepted Card picker defaults. The explicit Framework skip/Card skipped indicator/Deck percentage omission now approved for Phase 5 supersedes Phase 4's historical retained all-skipped display convention; preserve geometry and all other interactions. Current enrolment trust is explicitly deferred to Organisation work, not new Phase 5 membership UX. Removed / Left Group presentation remains deferred; historical Group test-management rights and exact Progress menu entry remain the targeted §9.8 gates. Historical Phase 4 implementation and test results below are unchanged.

Phase 6: private group images, signed-only video/provider verification and bounded deletion. Phase 7: own-private/own-group media composition, newest-five layout, galleries and scoped deletion. Phase 4 canonical-public media reuse is not permission to enable participant media through public origins.

Phases 8–9: saved group Info Cards/audiences/drafts and source-aware UI; true private Personal Info remains distinct from group self-addressed content visible to admins. Phase 10: group/private reflection coexistence, source-specific Add/Edit, moderation and creation-ordered carousel. The proposed controls in the prompt are a reuse direction, not a detailed approved dual-reflection UI.

Required eventual code comments and regression tests:

- At group aggregation: skipped exclusion, active versus eligible denominator, exact completion versus rounded presentation and independent confidence weighting.
- At presentation identity helpers: physical identity must survive subject switch; cache/security identity must not. Test face and scene mount continuity alongside stale private response rejection.
- At private projection/adapter boundary: own data remains authoritative personal CardData; group-only access does not create a second personal record; foreign responses never fetch private fields. Test pre-existing sentinels and group-only users.
- At later reflection/source adapters: a private reflection and a group reflection legitimately coexist on one Card; record separate IDs/queues and why admin visibility differs. Add “edit private leaves group unchanged” and inverse tests, plus stale completion after perspective switch.
- At later media/Info mutations: retain personal/group source, original author and contribution ID; detaching/removing one source must not affect the other.
- At peer authorisation: visibility grants only allowlisted active learning, never private history/tests or former snapshots. Test every new direct route, not only picker choices.
- At selection persistence: preference is a hint; server revalidates membership/policy/adopted composition every restore.

Future implementation handoff must list actual changed files/schema/API/index changes, commands and counts, revised aggregate contract, scope option selected in Q2, deferred private presentation and actual phone-review URL/steps. No additional report file is needed or created for this planning commission.

## H. Automated testing and iPhone review strategy

### H1. Fixtures and automated layers

Use disposable MongoMemoryReplSet and extend `tests/helpers/groupExperiences.ts`/the browser harness. Seed personal Deck plus groups A/B sharing a Card at different versions; 15–20 followers with alphabetical/tied/long names, admin-only and dual-role admins, outsider/template creator, removed/rejoined follower, zero-follower group and empty Deck. Include unique private date/media/reflection/Info/test sentinels and source-overlap cases. Fixture defaults must not accidentally give every follower a personal Deck. No production Atlas or live providers.

1. **Pure tests:** policy matrix, selection restoration, context keys, aggregation truth table, immutable presentation adapters, same Card/version/subject distinction, scroll/expansion state transitions.
2. **Repository/API tests:** actual projected fields and query allowlists; default-Off settings, role equality, direct forged writes, admin-only history; duplicate/stale structural commands, selected-version validation and retained learning; policy/removal/adoption versus delayed reads/writes in deterministic barriers. Assert fresh requests after revocation fail and old responses cannot repopulate client state under Q1.
3. **Resource/controller tests:** in-flight sharing, loaded switch without content request, abort/reference ownership, reverse-order responses, original-target optimistic rollback, user/session/permission/subject cache isolation, lease expiry, stale paginated revisions, focus refresh.
4. **Browser tests:** real authenticated fixture APIs; picker order/defaults/restore, group/self/peer permission and no edit affordances, front/back values, empty cases, list/grid modes, persistent grid scroll through vertical traversal, outside dismissal/reopen, 50 loaded switches with preserved Card/face, reduced motion and keyboard, scene/player counts, viewport bounding boxes and active source labels. Delayed/failed requests are deliberate network tests rather than manual tasks.
5. **Existing regressions:** personal working entry/update adoption, library entry/presentation, Deck menu, Progress/Framework, assessments, Personal Info Cards, signal gesture/rollback and media preparation as touched. Existing `.spec.ts` tests may assume a particular server fixture; port/adapt the relevant assertions into the isolated harness rather than launching the normal production-backed app.

### H2. Verification commands

Use the exact executed commands/counts in the implementation handoff as final evidence. Group paint timing uses the optimized loopback fixture with real Secure cookies on localhost; ordinary LAN review and existing personal regressions retain the established development harness. The examples below identify the relevant gates.

```sh
node --import tsx --test tests/group-experience.test.ts tests/group-experience-perspectives.test.ts tests/group-experience-client.test.ts tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/presentation-foundation.test.ts tests/deck-state-characterisation.test.ts tests/frameworks.test.ts

node --import tsx --test --test-concurrency=1 tests/group-experience.integration.ts tests/group-experience-api.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-perspectives.integration.ts tests/group-experience-capacity.integration.ts tests/shared-learning.integration.ts tests/update-adoption.integration.ts tests/personal-lifecycle.integration.ts tests/framework-readers.integration.ts tests/assessments.integration.ts tests/personal-info-cards.integration.ts

node --import tsx scripts/test-phase2.ts --group-experiences --optimized group-experience-boundaries.browser.ts group-experience-motion.browser.ts group-experience-perspectives.browser.ts --reporter=line
node --import tsx scripts/test-phase2.ts --info-cards working-entry.browser.ts working-updates.browser.ts update-adoption.browser.ts presentation-foundation.browser.ts deck-menu.browser.ts personal-info-cards.browser.ts assessment-ui.browser.ts library-entry.browser.ts progress.browser.ts framework-readers.browser.ts --reporter=line

env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= npm run build
npx tsc --noEmit --incremental false
git diff --check
```

Also run targeted ESLint against the actual changed application/test files. Run build and standalone type checking sequentially: the earlier parallel attempt raced `.next/types` regeneration. Do not run fixture tests using ordinary `npm run dev`. Extend only the isolated harness child environment with the group feature flag and group index provisioning; reset it on teardown.

Retain measurable budgets from the overarching plan: normal 20×12 summary/bootstrap ≤250 KB excluding separately loaded content/media as specified; active-Card perspective batch ≤100 KB; local summary p95 ≤300 ms/100 warm reads; scalar write p95 ≤500 ms/200 writes; loaded interaction-to-next-paint p95 ≤100 ms/50 switches; one heavy scene and zero identity-tile players. Record measurements and retry distribution, not just assertions. Test 40×24 paging too. No new virtualization framework unless measurement requires it.

### H3. Focused phone review after automated acceptance

Extend existing `scripts/test-phase2.ts --dev --lan` with a group fixture mode (proposed `--group-experiences`, not currently available). It must continue to own a disposable DB, provision indexes and mock providers. Its current printed phone link targets the Info Cards Library, so add real group review URLs and roles to the review output. Verify the running URL responds before handing it over; provide actual LAN address/port, disposable accounts, experience IDs, process/stop instructions and fixture reset behaviour. No review server was started during this planning task.

Required eventual steps:

1. Sign in as seeded admin; open named My Decks group and verify the physical tile-to-Deck entry.
2. Open picker/list, switch Group ↔ several followers while front and back; assess whole-stack upper-left depth and placed-Card continuity.
3. Focus a Card, expand grid, scroll to later followers and rapidly compare ~15 identities. Assess whether the short diagonal exchange feels distinct from traversal and remains calm.
4. Traverse Cards vertically with grid open; assess scroll ownership, main-Card readability, exposed dismissal area and continuity. Tap outside; reopen and assess collapse transition.
5. Inspect count-row legibility, paired G/F balance and back symmetry with long names, missing readings and skipped statuses. Change Safari chrome/orientation and assess short viewport behaviour.
6. Repeat representative motions with reduced motion enabled and inspect comfortable touch targets/focus treatment.

Automated tests already establish permission, value, selection, scroll and face correctness. Phone review is for motion feel, real Safari touch/viewport behaviour and visual balance, not a manual substitute for those assertions. Do not claim Chromium emulation certifies physical iPhone behaviour.

## I. Risks, simplifications and alternatives

| Risk/choice | Recommended simplest approach | Alternative and cost |
| --- | --- | --- |
| Existing CardLayout combines learning/private sources | Explicit experience presentation plus small learning-only adapters/accessors | Fake personal DTOs reduce initial typing but create privacy/control/identity hazards; reject |
| Subject switch remounts physical Card | Stable physical IDs and scoped motion layer, separately keyed data | Duplicating DeckScene creates multiple players, stale editors and continuity problems; reject |
| Peer data revocation already cached remotely | Immediate server checks plus short visible lease/polling, explicit Q1 | Push revocation may reduce delay but adds realtime infrastructure and still cannot erase downloaded bytes |
| All-skipped personal helper returns 100 | Group-local exact aggregate/counter and null guard; leave existing personal tests | Global semantic change affects Framework/history/personal presentation and needs separate scope |
| Group private content overlap | Typed deferred source adapters; owner date now; domain phases add full content | Pulling media/Info/reflections into 4 expands providers, audiences and editing work prematurely |
| Alphabetical paging vs existing user-ID cursor | Scoped membership/username-only join and stable sort/cursor | Fetch-all IDs then client sort is simpler only for tiny groups and breaks correct progressive order/bounds |
| Creation/settings vs seeded slice | Resolve Q2; no invented halfway management UI | Full modal/directory is feasible but increases this phase and adds save orchestration testing |
| Frequent switching with writes in flight | Original-target mutation lanes and cached projection, latest-intent visual exchange | Blocking every switch until every save finishes weakens rapid comparison; global locks unnecessary |
| Grid shrinks usable mobile Card height | Measure visual viewport/panel and reuse geometric scale | Redesigning Card anatomy or two-column comparison contradicts current product agreement |
| Network request duplication | Small experience resource with shared promises and existing hooks | App-wide query/state library is disproportionate for this feature |

No fixed desktop miniatures beyond the agreed identity tiles are invented. Use the same compact picker/list/grid semantics with a bounded responsive layout; desktop may use available width while retaining three grid columns. Treat “15 followers” as a comparison-use case, not a product limit.

## J. QUESTIONS

### Q1. What is the acceptable remote-client revocation guarantee?

**Why:** Immediate server denial is achievable. A browser already displaying authorised data cannot learn about a remote setting change immediately without communication, and no mechanism can erase received bytes. The older plan explicitly favours visible-page polling and excludes realtime subscriptions.

**Recommendation:** approve immediate fresh server denial plus a maximum five-second visible authority lease/check interval, immediate local purge on local changes, and mandatory revalidation before showing peer data after focus/re-entry. On failed/expired authority check, hide peer data until verified. This is a best-effort detection interval, not a network-latency SLA.

**Impact:** approval preserves the simple polling architecture and warm switching. If truly instantaneous remote visual revocation is required, the product guarantee must be revised or realtime scope separately designed; do not label polling as immediate erasure.

### Q2. Does this Phase 4 include the complete creation/settings modal?

**Why:** The original phase is a seeded early slice. The new prompt fixes full-screen creation/settings UX but explicitly says not to assume all of it belongs here. The setting can be exercised through real admin APIs/fixtures in the slice, but there is no existing administration UI.

**Recommendation:** retain the seeded Phase 4 slice, real named My Decks entries and policy APIs; follow it with an explicitly authorised Phase 4 entry/settings checkpoint before wider participant use. Place removed-history presentation in Phase 5 within those settings. Do not add a temporary settings page or partial modal.

**Impact:** if full creation/settings is wanted now, include checkpoint 8 (directory resource, name change, roles/settings save orchestration, Add as Group and Group… integration). Otherwise checkpoint 8 remains deferred and tests set visibility/roles through fixture-authenticated APIs.

### Q3. How should a follower with peer viewing Off choose between Group and self?

**Why:** Both perspectives remain permitted, but `All followers` is conditional on inspection permission. The exact compact-picker trigger for these two choices is not specified.

**Recommendation:** tapping the compact identity opens a compact Group/self list in either mode; the `All followers` comparison action appears only with peer-inspection authority. It opens the focused grid in focus mode and the full upward list in ordinary mode. With only Group available, the picker is noninteractive. This adds no extra persistent label or gesture.

**Impact:** approval fixes the trigger semantics while preserving all specified views. An alternative direct two-choice toggle would change discoverability/keyboard interaction and must be selected explicitly, not inferred by implementation.

No new model, styling-duration or state-library decision needs user approval. Resolve these three points and explicitly authorise the selected checkpoints before application changes begin.

## Implementation record — 30 October 2026

- Initial tree contained the two untracked Phase 4 planning documents from the preceding authorised planning task; preserve them. Branch remains feat/group-experience. No commits authorised.
- Checkpoint 1 audit: personal/Framework percentage convention returns 100 on all-skipped. Framework state complete denotes read availability, not completed learning. Keep both. Correct actual completion labels in DeckScene/DeckFrontContents using classifyProgress; no broader Framework calculation change. Group metrics guard zero eligible observations and follower categories use exact statuses. Snapshot projection shares corrected group metrics without rewriting stored values.
- Checkpoint 1 unit verification: 30 passed after correcting a new fixture missing its signal rows and replacing the obsolete all-skipped Completed tile assertion. Database regressions: 49 passed; separate all-skipped snapshot: 1 passed; standalone TypeScript passed. Framework destination tile DTO gained the explicit completion flag so it preserves the same label rule; calculation percentages were not changed. Exact commands/results will be consolidated in the implementation handoff.
- Q1–Q3 are resolved as specified in the product specification P15; Section J is retained as planning history and no longer blocks implementation. Full creation/settings UI is the subsequent checkpoint after iPhone review.

- Checkpoint 2: default-Off policy, active alphabetical cursor, settings/navigation APIs, validated saved perspective and policy/member fences implemented. 23 policy/API/foundation checks passed; type check passed.
- Checkpoint 3: paginated content/learning/aggregate transports and owner-only date projection implemented. 12 API/repository checks and 4 resource tests passed; type check passed. Separate presentation/aggregates routes retain lightweight metadata polling; tile collection has a dedicated gated route. These are bounded transport details within the approved architecture.
- Checkpoint 4: explicit experience presentation, existing front bars, inline counts, paired confidence, owner date/lock and learning-only back using existing passive/editable signal primitives. 13 group/personal presentation checks passed; type check passed.
- Checkpoint 5: gated group tiles and one scene adapter now work through real disposable fixture APIs. Initial browser smoke check passed (1/1). Full continuity/permissions/browser checks continue with checkpoints 6–7. No creation/settings management UI added.
- Checkpoints 6–7: compact authorised picker/upward list, stable focused three-column grid, 38% visual-viewport panel, scroll preservation, collapse/dismissal and distinct transform layers implemented. Eight isolated browser checks passed, including real owner/group writes, remote revocation/offline masking, reduced motion/keyboard and 50 loaded comparisons (p95 91.8 ms, same scene/stack/focused object, zero tile players). Scoped legacy strip-offset correction centres front counts. Final additional signal-drag/empty-Deck assertions are being checked.
- Transport simplification: the first render waits for all bounded permitted pages as one verified matrix rather than progressively exposing partially loaded choices. The mounted resource refreshes content/matrix/aggregates every four visible seconds as well as metadata; a separate five-second lease masks peers independently of slow requests. This avoids a second readiness/state machine at startup scale. It can later retain unchanged canonical pages if measurements warrant that refinement.
- Checkpoint 9: 154 consolidated repository/regression checks, 89 unit checks, 7 final targeted repository/capacity checks and production build passed. Final standalone TypeScript passed. Existing browser regressions and the iPhone handoff are in progress. Exact commands and all final evidence are consolidated in [Phase 4 handoff](group-experience-phase-4-handoff.md). No checkpoint 8 or later-phase UI has been implemented.

- Final personal browser selection passed 68/68 after repairing the stale baseline fixture bundler (also reproduced on committed HEAD). The existing Info Card Cancel-focus case passed its full suite rerun and final combined run without application changes. Canonical/working geometry baselines remain unchanged.
- Final lifecycle audit: derive the current Card from the adopted composition before rendering/navigation writes, and collapse focus/grid for an empty composition. Real publish/review/adopt browser test passed 1/1, including removed-Card denial and post-adoption perspective persistence. This is an in-scope current-selection guard, not a new Update UI.

### Final verification and handoff

Checkpoints 1–7 and 9 are complete for the authorised initial slice: 154 consolidated repository/regression checks, 7 final targeted DB/capacity checks, 91 unit checks, 10 Group Experience browser cases, 68 existing personal browser cases, and a further 21 shared-component browser regressions passed. The default build (feature disabled), standalone TypeScript and diff checks passed; targeted lint returned zero errors and one pre-existing image warning. Exact commands, logs and the complete inventory are in the [Phase 4 handoff](group-experience-phase-4-handoff.md).

The final client uses persistent signal rows with read-only capabilities and separate gesture identities, memoised static SVG definitions/identity contents, and a composited preserve-3D exchange wrapper. Existing Motion layout/gesture behaviour is retained. Already queued scalar saves finish against captured actor/context after view disposal; obsolete reads and responses cannot repopulate the view. Current-Card hints are validated against adopted composition, including transition to an empty Deck.

The 50-switch paint gate uses native trusted-input Event Timing after five fixed warm-up inputs/initial-geometry settling, retaining the ≤100 ms limit. It passed at 72 ms p95 with the same scene/stack/Card/signal DOM nodes and zero identity-tile players. The optimized mode is a local disposable build, isolated in `.next-phase2-optimized`; it does not modify production auth/cookie policy, database/provider settings or feature enablement. Diagnostic tracing is off for the motion file; other functional cases keep traces. The LAN review server uses normal development mode, so absolute development timing is not a production latency claim.

At the initial-slice handoff, Checkpoint 8 was deferred pending iPhone acceptance. Subsequent explicit instructions authorised the atomic creation/settings workflow and its refinements. The user has now accepted and committed Phase 4, including that workflow and the subsequent iPhone refinements (`a6f2e32` review baseline). See the dedicated Checkpoint 8 section of the [handoff](group-experience-phase-4-handoff.md) for the historical API contract, file inventory, test commands/results and review URL. No tests were rerun by the Phase 5 planning review. Real-participant enablement, removed-history presentation, assessments/Framework integration and later contribution phases remain deferred.

### Approved Card visual refinements — 31 October 2026

Physical iPhone review supersedes the original P9 per-signal G/F presentation: remove only the added Step-heading numbers from `GroupCardBack`, retaining the shared signal rows, graphics, gesture controllers and top Card-level pair. The product specification P7–P9 now records the approved refinement.

Front counts previously measured 8px from a passive 24px bar but 8px from an editable 52px button, yielding a 36px visible gap. Use the opt-in `StepProgressStrip` adjacent layout: a 24px visual column, 6px gap and contained 24px row. End-align the full 52px editable target in that visual column with its spare width extending into the empty left gutter, not across the counts. Passive and editable views share this geometry. The target's actual hit tests, description clearance and neighbouring counts must be verified at 320/390/1440px and with comparison expanded. Personal-only progress controls retain their existing default layout. Remove the old Group negative-margin/top compensation rather than adding another override.

Aggregation text retains 8px/400 typography and uses existing neutral metadata `#aeb5c1` on both faces. Shared Card confidence uses that colour and weight 500 while retaining `0.8rem`; remove the assessment-dependent back confidence exception. Existing back scaling, G/F superscripts, header anchors and all other content/interaction styles remain intact. The real 24px row contains the existing touch target vertically; this intentionally reserves equal learning-row space in passive and editable Group presentations instead of allowing a target to overlap instructional copy. No Card size, scene transform or animation change is required.

Regression coverage and actual commands/results are recorded in the Phase 4 handoff. No backend, data, privacy, aggregate or later-phase changes are part of this refinement.
