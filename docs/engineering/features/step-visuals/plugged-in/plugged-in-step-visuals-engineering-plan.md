# Plugged-in Step Visuals — Final Engineering Plan

**Status: Stage A revision under the owner-approved implementation contract; autonomous implementation may proceed after the consistency gate in §14. Production release is not authorised.**

Date: **29 October 2026**, Europe/Dublin. This document supersedes the earlier draft in this same location. The owner's “Finalise and Autonomously Implement Plugged-in Step Visuals” instruction, including the subsequent confirmation of the feature branch, authorises implementation, local verification and meaningful commits. It does not authorise push, merge, deployment, live migrations/provider changes, demo decks or responsive redesign of existing mathematical visuals.

Inputs: [product specification](../../../../design/features/step-visuals/plugged-in/plugged-in-step-visuals-specification.md), [independent review](plugged-in-step-visuals-independent-review.md), and the final owner decisions transcribed into §2. The specification remains authoritative except where those final decisions explicitly supersede it. [Implementation handoff](plugged-in-step-visuals-implementation-handoff.md) records actual completion, commits, tests and the next slice. This plan describes intended work; it is not proof that a slice has shipped.

## 1. Baseline, recommendation and authority

### 1.1 Inspection baseline

| Item | Verified state |
| --- | --- |
| Worktree | `/Users/peterdomokos/projects/step-visuals` |
| Required and now active branch | `feat/step-visuals-pluggedin` |
| Implementation starting HEAD | `090676e4ad1f654c2c9d0638cc25c231df88a6aa` |
| Tree | `d00e5a4beaa1c7e06f55a31d809e89d1cfae826c` |
| Initial branch mismatch | This revision started on `main` at `cbffc8d58bd23f129548a113fc15beaebac33725`, whose tree is identical. The owner switched the worktree to the required branch; Codex verified it before implementation. No merge was needed. |
| Initial local work | Specification, original plan and Claude review were untracked; no tracked modifications. Preserve those inputs. |
| Specification SHA-256 | `23fdd28b60ba0163eea231a4f1afb9e13903b5866acff4767db72cff33635e52` |
| Review SHA-256 | `77ee2901e92029f95a70ec104db5a966d35821c40048450ae9e3b61fd2fd7a9c` |
| Toolchain | Next 16.2.6, React 19.2.4, MongoDB driver 7.2, Playwright test 1.58.1, playwright-core 1.63, hls.js 1.7, Motion 12.38. Existing mongodb-memory-server is available as a declared development dependency; a disposable replica set must still be verified locally. |

First-class cards, immutable published card versions, creator coordinator, Info Cards and Progress already exist. The extra local `feat/step-visuals` commit contains documentation only; do not merge it as a prerequisite. Source locations in §3 apply to the baseline; implementation updates must be reflected in the handoff.

Evidence labels: **verified** means source or a named executed check; **inferred** means reasoned consequence; **unverified** means runtime/provider/device evidence is absent; **proposed** means an implementation deliverable. No production database, provider credentials or physical iPhone was inspected in Stage A. Claude read the specification/plan fully and significant source, but did not read most supporting guides or run tests; its report is evidence to assess, not a replacement authority.

### 1.2 Recommended architecture

1. Persist one ordered media collection per edited Introduction/step, retaining legacy single-media reads. A read-only presentation projection supplies the existing video-only Introduction thumbnail. Existing immutable publications are not rewritten.
2. Extend the existing persistent HLS player and playback-intent chain, with first-tab selection and an in-memory position map. Preserve ended/buffering/rapid-video-navigation continuation. Non-video selection, genuine pause, failure and leaving the card break continuation.
3. Use immutable compiled Interactive Visual metadata and explicit lazy component registration. Stable IDs are `roots-and-factors` and `integration-area`. Generate static initial-state previews from pure activity views. Implement mandatory `interactiveVisualIds` Framework configuration support without altering Progress calculations.
4. Build a generic full-screen Interactive Visual Host with measured content bounds, Close, bottom-right Next, supported Previous, Back to Start, confirmed Start New Attempt and small sync status. Mathematical controls and transition rules remain in each visual.
5. Store first-class Visual Learning Records using records, attempts, unique meaningful events and visits; keep the latest validated snapshot on the attempt. Use a durable local outbox, simple snapshot revision checks and event-ID deduplication. Simultaneous editing is unsupported; retain conflicting pending snapshots locally and report the conflict honestly.
6. Use separate opaque guest credentials and the same record/attempt repository as accounts. Claim reparents attempts to account records, retains all histories and continues the foreground guest attempt. Initial unknown/offline opens require a connection; established attempts continue offline.

The early vertical slice uses Roots and Factors and a real card media attachment with inert preview → host → state restore → Close to exact origin. A development-only responsive mock tests host geometry independently. Persistence becomes Mongo-backed before public interaction is enabled. Integration follows after the first adapter exposes the practical contract.

### 1.3 Execution versus release gates

Routine technical choices and passed slice boundaries proceed automatically. Physical iPhone tests, privacy review of provisional guest retention, live database index installation and provider verification are **release/operational gates**, not reasons to stop safe independent local implementation. Any actual regression, ownership weakness, data-loss failure or new product decision blocks only its affected work. No production readiness claim is allowed while required device/security evidence is absent.

## 2. Final product contract and traceability

The following decisions close or supersede the draft questions. They must not reappear elsewhere as mandatory unanswered implementation gates.

| Decision | Final instruction / implementation interpretation |
| --- | --- |
| Q1 | First Introduction video in creator-defined order supplies the existing front thumbnail; no image/visual substitute and no main-step thumbnails. |
| Q2 / N3 | Multimedia host normal-layout target is 320 CSS px. Host correctly reserves content/control regions. Existing visual overflow, overlap and enlarged-text limitations are documented for separate work; responsive mathematical redesign is excluded. |
| Q3 / N2 | Owner expressly approves connecting existing HLS expansion functionality. Preserve native controls and the player element. The historical custom-control removal is acknowledged; this new approval supersedes it. |
| Q4 | Minimal production guest-accessible `/interactive-visuals/[activityId]` entry with the same host; no catalogue, discovery menu or registration system. |
| Q5 | Capability-based activity navigation and same-attempt Back to Start. No generic mathematical reducer or automatic Previous for Roots. |
| Q6 / N6 | Simultaneous editing unsupported. Snapshot CAS, truthful conflict status and preserved local pending work; no automatic server-state replacement, writer coordination subsystem or reconciliation screen. |
| Q7 / N4 | Separate guest credentials; provisional 90-day inactivity expiry, privacy review before production. Claim retains all attempts and continues the foreground guest attempt even if it has little progress. For other activities keep an existing account active attempt; use guest active when no account active exists. |
| Q8 | Immutable compiled releases, newest release on next open, no mid-interaction hot swap. Soft retirement removes new selections; emergency disable prevents unsafe use. Incompatible state remains historical with explicit confirmed new-attempt recovery. |
| Q9 | Roots and Factors is the second target; preserve `roots-and-factors` identity. |
| Q10–Q11 | Demo-deck access and guest ordinary-progress collision policies remain future work. |
| Q12 / N1 | No multimedia autoplay fallback approved. Preserve existing intent continuation including ended/buffering/rapid navigation; extend it to video tabs. This resolves the review ambiguity in favour of the explicit preservation requirement. |
| Q13 | Audit relevant provider security; do not change live configurations or expose restricted guest media. Public activity access does not grant guest card/media access. |
| N5 | Modal edits valid configuration directly into existing draft coordinator; Close does not undo saved draft changes. No extra modal Cancel/Apply transaction. Invalid label input remains local until valid. Unicode labels remain supported with conservative bounds and browser measurement; no new Latin-only restriction. |
| Framework scope | `interactiveVisualIds` support is mandatory in this implementation; arrays may be empty. No Progress formula or dashboard change. |

The permission to resolve review questions does not permit arbitrary new product behavior. The decisions above either implement explicit final choices or choose the smallest interpretation that preserves them.

### 2.1 Requirements inventory

IDs are retained from the original plan so existing evidence and acceptance scenarios remain traceable. P0–P9 are workstreams; executable boundaries are S00–S17 in §11. T01–T20 are verification groups in §12.

| IDs | Locked behavior / scope | Evidence and gap | Slices / tests |
| --- | --- | --- | --- |
| M01–M02 | Introduction plus three steps, 0–4 ordered video/image/Interactive Visual items, repeated types allowed | E01/E02/E09: single descriptor currently | S02,S04,S11; T01–04 |
| M03 | Zero retains current empty behavior; one has no tabs; 2–4 have tabs | E03: video placeholder and one video | S04,S11; T01–03 |
| M04–M05 | First tab on step entry/re-entry; same tab on overlay Close; outer Previous/Next still steps | E04: existing step navigation | S04,S11; T04,T06 |
| M06 | Readable untruncated one-line labels at 320px; combined rendered-width validation | No current label contract | S02,S10,S11; T03 |
| M07–M08 | Automatic inert initial preview, full-screen-only interaction, origin-aware Close; accepted side overlay | E12–14: live mounts create attempts | S03–S05; T05–06 |
| M09–M12 | Embedded video/image, explicit expansion, session positions, no hidden play, legacy pause-aware autoplay | E04/E06; no position map; guarded load awaits grants | S11–S13; T06–08 |
| M13 | Introduction video-only thumbnail, first video by order, no step thumbnails | E05 truthiness hazard | S02,S11; T09 |
| C01–C04 | Existing entry points open modal; add/reorder/label/replace/remove; draft-only existing publication; creator cannot author visual | E07/E08 coordinator/projections need extension | S02,S10; T03,T10–11,T17 |
| C05 | General existing-upload picker deferred | E09/E10 no general asset ownership catalogue | No initial slice |
| A01–A03 | Stable ID; central current release; original event/attempt versions; compatible restore and non-destructive incompatibility | E12/E14 session-only versions | S01,S03,S05,S09; T12–14 |
| A04 | Framework items support independent `interactiveVisualIds`; calculations unchanged | E16 strict fields only accept card IDs | S01; T18 |
| R01–R03 | Learner + activity identity independent of cards; attempts/history/snapshot/visits; contextual journey links | E12/E15 no durable persistence | S03,S06–S09; T12,T15,T18 |
| R04–R05 | Resume after days; completed attempt editable; same-attempt Back to Start retains work; confirmed new attempt on Stage 1 | E13 current restart creates attempt, finish locks editing | S03,S05,S08; T12–13 |
| R06–R07 | Automatic meaningful autosave, durable offline pending work, no frame telemetry, truthful status | Existing callbacks omit unchecked drafts | S03,S05–S08; T12,T15 |
| R08 | Visual completion never ticks card; reference removal never deletes records; media edits preserve completion | E05/E08 separate completion route | S02,S06,S10–S11; T10,T13 |
| S01 | Generic host/lifecycle/navigation; all mathematical choices, checks, hints and animations remain visual-owned | E13/E14 differing components | S03–S05; T05,T13,T19 |
| S02 | Host geometry/safe areas/stable controls; Next bottom-right; expose content dimensions | Existing visual CSS has minimum heights | S04; T19 host/mock. Real visual limitations recorded, no responsive repair. |
| G01–G04 | Guest DB persistence without login; return credential; contextual invitation; preserve both histories on claim | E15 account-only routes | S06,S14–S16; T16–17 |
| D01–D02 | Selective demo decks, normal guest CardData/DeckData and journey reconstruction | Requires separate deck permission work | P8 future only; T20 |
| X01 | Legacy readers, immutable publications, upload ownership and stale-client protection | E02/E07/E09 strict/reconstructive paths | S02,S10–S13; T01,T11,T17 |
| X02 | Final approval authorises local sequential implementation/commits, no deploy/push/live writes | Owner instruction; §14 gate | S00 and every slice gate |

## 3. Existing-code evidence and as-is architecture

### 3.1 Source cross-reference

Paths and line ranges are for the inspected tree; use names to relocate after subsequent edits. A range is evidence to inspect, not a claim of exhaustive coverage of that file.

| Evidence | Real source / location | Finding and implications |
| --- | --- | --- |
| E01 | `src/components/decks/types.ts:21–35`; `src/lib/cards/domain.ts:24–48` (`assertCardContent`) | `CardIntro.mediaItem` required nullable; step media optional; exactly three steps, stable stepId; strict allowed fields reject a new array until validators change. |
| E02 | `src/lib/cards/model.ts:21–110`; `repository.ts:40–63,575–600,644–690` | Roots have draft/revision/latestVersion; immutable versions own published content/visibility; CardData and DeckData are arrays on personal user documents. CardData mediaItems is personal evidence, not instructional media. |
| E03 | `src/components/decks/StepView.tsx:16–35,67–111,139–195` | Four navigation units, media anchor and fallback Stream iframe, Video placeholder for empty media, images currently unsupported. `mediaPreview`/`activity` slots exist for other consumers; not a durable Step Visual integration. |
| E04 | `src/components/decks/FocusedCardView.tsx:106–115,256–347,348–400,470–595,609–640,848–950` | Owns step selection, persistent player outside keyed StepView, intent ref, protected grants/poster prep, info consultation suspension and display generations. This is the actual integration boundary. |
| E05 | `src/components/cards/IntroMediaBlock.tsx:55–67,245–287`; `PreparedIntroThumbnail.tsx:1–27`; `StepItem.tsx:48–117`; `src/components/decks/useWorkingDeck.ts:69–112`; `src/lib/deckMutations.ts:26`; `src/app/api/decks-data/[deckTemplateId]/route.ts:12–23`; `src/lib/cards/repository.ts:1129–1141` | Only Cloudflare video supplies thumbnail URL; wrapper/play glyph is gated by media truthiness. A naïve array substitution would alter the front. Card completion follows a separate path: StepProgressStrip → `cycleFocusedStepStatus` optimistic update/rollback → `persistStepCompletionStatus` → authenticated PATCH → `setCompletion`, which checks working-card access and adopted-version step membership before updating the user's CardData items. Visual completion must never call this path. |
| E06 | `src/components/media/CloudflareHlsVideoPlayer.tsx:26–58,189–224,226–409,411–615,632–734`; `videoPlaybackState.ts:1–5` | Native HLS on Safari, hls.js otherwise; explicit unmuted play, operation/source/pause generations, guarded source reset, frame readiness, internal pause suppression, teardown. Handle has no position getter/restore input. |
| E07 | `CreatorMediaUploadSlot.tsx:1–67`; `CreatorDragLab.tsx:824–841,1545–1607,1852–1867`; `cardArchitectureAdapter.ts:43–64`; `creatorBoardState.ts:455–484,569–635`; all under `src/components/creator/` | Four existing media entry points use one hidden video input each; uploads edit coordinator draft after success. Board/adapters reconstruct known fields and would drop an array unless changed together. |
| E08 | `src/components/creator/creatorPersistenceCoordinator.ts:205–345,390–460`; `src/lib/cards/repository.ts:644–690`; `updateAdoption.ts:51–77`; `versionAccess.ts:1–13` | Actor-bound, revision-controlled lanes and fork upload proofs; published versions immutable. Adoption retains completion by step ID, including absent historical IDs. Public root alone does not expose private historical versions. |
| E09 | `src/lib/media.ts:1–170`; `mediaUploadClient.ts:1–20,169–281,284–434`; `cloudflareStream.ts:1,125–151`; `cloudflareR2.ts:256–340`; `src/app/api/media/{stream,images}/direct-upload/route.ts` | Existing descriptor union includes R2/providerless images and Stream/YouTube videos. Live inspected upload client uses FormData POST to Stream and presigned PUT to R2, not tus; branch names mentioning tus are not source evidence. Video max duration is 150 s; images client-limit 10 MiB. |
| E10 | `src/lib/cards/{uploadAuthorization,prospectiveUpload,protectedMedia}.ts`; `src/lib/infoCards/mediaRegistry.ts:1–31`; `src/lib/cardMediaAccess.ts:1–48`; `src/components/media/CardMediaViewer.tsx:1–115`, `CardMediaViewerImage.tsx` | Upload scopes card-template/deck-introduction/user-card; special proof for prospective forks; exact-version Stream grants but broad legacy image lookup; dedicated info-card allocation protection; personal viewer tied to retained personal-history ownership. No general file catalogue/refcount. |
| E11 | `src/lib/cardPlaybackGrants.ts:1–97`; `cardVideoThumbnails.ts:1–76`; `src/components/media/DeckVideoPreparation.tsx`; `src/app/api/media/protected/route.ts:1–45` | Grants scoped to user/card/version/mode, 10-minute reuse, one-hour provider bearer URLs; decoded image reuse; account/version/generation invalidation. Neighbor prep must not become 16 eager video downloads. |
| E12 | `src/app/step-visuals/activities/integration-area/records.ts:1–58`, `notifications.ts:10–70`; `activities/roots-factors/learningRecords.ts:1–62`; `platform/web/learningNotifications.ts`; `learning-records.md` | Integration live v2 and legacy v1 types; roots v1. UUID attempt identity, session-wide sequence, event ID derived from attempt + sequence. Callback cursors suppress mounted duplicates, catch errors, do not await persistence or replay history to late event subscribers. No timestamps/context/principal/DB. |
| E13 | `integration-area/learning.ts:6–65,96–155,219–244`, `integration-activity.tsx:14–51`, `stage-controls.tsx:23–32`; `roots-factors/learning.ts:10–86`, `recordedLearning.ts:1–111`, `RootsFactorsActivity.tsx:13–57` | Both initialise fresh on mount, no hydration input. Integration navigation caches/state exceed published snapshot. Current Start again creates a new attempt. Root lesson has no Previous action. Integration Finish may record an incorrect outcome; root completion requires correct −4 Check. |
| E14 | `src/app/step-visuals/page.tsx`; `public.ts`; `lab/{StepVisualsLab,experienceRegistry,integration-lab-session}.tsx` / `.ts`; `platform/web/{ActivityFrame,ActivityNavigation,SurfaceLifecycle}.tsx`; `sparklines/Card1Sparkline.tsx:1–60` | Public unauthenticated lab with lab-only selector/diagnostics, two interactive activities and static sparkline. Existing public exports enable mounts but no production catalogue. Root frame is slot-based; Integration uses separate IntroStages/LaterStages layout. |
| E15 | `src/lib/auth.ts:9–36,95–188`; `src/app/api/auth/{login,me,logout}/route.ts`; `src/lib/cards/http.ts:1–65`; `src/lib/mongodb.ts:1–46`; `src/app/api/users/route.ts:14–23` | 30-day HttpOnly signed account session, Mongo ObjectId lookup, account-only card boundary, actor guards, majority/snapshot transactions. No guest issuance/claim/signup route found. User listing assumes username; adding anonymous rows to users is not a harmless local change. |
| E16 | `src/lib/frameworks/configuration.ts:5–73`, `configurationContracts.ts:3–66`; `readModels.ts:24–55,108–130`; `calculations.ts`; `src/app/progress/page.tsx:1–9` | Framework items strictly accept cardTemplateIds, Factor Theorem/integration mappings empty. Progress uses signed-in adopted CardData/assessments. No activity records consumption. |
| E17 | `docs/engineering/features/info-cards/info-card-media-security-backlog.md`; `docs/engineering/system-behaviour.md:20–90`; `README.md:27–49` | Historical trial documentation: public R2 aliases/legacy unsigned Stream exposure; image browser PUT CORS failure. Protected app route does not make origin storage private. README test description is partly stale: actual browser test files exist. |
| E18 | `tests/video-source-transition.spec.ts:1–190`; `tests/card-video-preparation.spec.ts`; `tests/card-playback-grants.test.ts`; `tests/published-video-preparation.test.ts`; `tests/deck-video-preparation.spec.ts` | Controlled media/authorization race tests and some decoder fixtures; not proof of native iPhone HLS autoplay. Unit coverage for grants/posters/readiness exists. |
| E19 | `src/app/step-visuals/tests/{records,integration-notifications,integration-final-refinements,integration-math,retrieval,isolation}.spec.ts`; `integration-{seven-stage,final-refinements}.browser.ts` | Mathematical/event/lifecycle coverage; layout checks at 390×844 and 393×852. Test existence is distinguished from tests run in §12.1. No durable/offline/claim tests found. |
| E20 | `next.config.ts:1–39`; `src/app/step-visuals/tests/playwright.config.ts:1–27`; `docs/engineering/features/step-visuals/activities/integration-area/implementation.md:282–310` | Exact LAN allowlist, separate test dist paths, lab review default port 3171; historical HTTP-200-but-inert phone incident. Hydrated interaction on real origin must be checked. |

### 3.2 Documentation read and authority reconciliation

Relevant inspected guidance includes `maths-visuals-engineering-guide.md` (especially §§2,6–12), its `-v1-1.md` sibling, `engineering-guide-recommended-changes.md`, `ai-maths-visuals-support-guide.md` (authority/handoff and §11 evidence semantics), `great-maths-visuals.md` (mathematical correctness, portrait geometry, compact representations and accessibility), Integration experience/seven-stage/refinement documentation, the existing activity record contract and lab README. Repository data-model/system-behaviour/architecture guides supply card and media history; current source takes precedence over mock-era descriptions explicitly labelled historical.

Important reconciliations:

- The main engineering guide contains later Integration-specific updates despite a sibling named v1-1. Do not assume filename version alone establishes authority. Historical Integration implementation examples still show six-stage v1 data; live `records.ts` is seven-stage v2.
- Old guides say feature code remains isolated and persistence is out of scope. This user-approved planning scope expressly investigates application integration; those old containment rules are not a new permission barrier. Portable mathematical code should still avoid Mongo/auth/card imports.
- Old Start again/new-attempt rules are deliberately superseded by this specification's Back to Start and confirmed Start New Attempt rules. The mathematical content/assessment rules remain protected.
- **No standalone activity titled Factor Theorem was found.** The implemented contrasting interactive activity is Roots and Factors, record ID `roots-and-factors`, lab ID `card-1-interactive`. Factor Theorem exists as an empty framework item and future curriculum/video material. Do not rename that implementation or claim a missing Factor Theorem activity was audited; The final owner instruction resolves Q9: use `roots-and-factors` as the second target, preserving its identity.
- There are only two implemented interactive activity directories. `Card1Sparkline` is the third contrasting visual inspected: pure initial numeric input, no activity reducer/learning events, static compact layout. It is not interchangeable with a preview of the full initial activity screen.
- Installed Next guides read: `01-app/01-getting-started/15-route-handlers.md`, `01-app/03-api-reference/04-functions/cookies.md`, `01-app/03-api-reference/05-config/01-next-config-js/allowedDevOrigins.md`. Plan uses App Router handlers, async cookie access and explicit non-cacheable personal responses. Re-read relevant installed guides before implementation; no framework code was written here.

### 3.3 As-is ownership map

```text
Account cookie -> getCurrentUser -> cardRequest / creatorRequestBoundary
                                         |
Mongo users { cardsData[], decksData[] }   |   cardTemplates { draft, revision }
  CardData: adopted version, completion   |      -> publish transaction
  DeckData: membership, active card      |   cardTemplateVersions { immutable content }
                  \                      |                  /
             working/canonical projections + creator board adapters
                               |
                   DeckScene -> FocusedCardView
                               |-- IntroMediaBlock -> video poster only
                               |-- StepView (key card:index, Introduction + 3)
                               |     -> anchor + text + outer Previous/Next
                               |-- one CloudflareHlsVideoPlayer outside StepView
                               |     play/playing -> intentRef=continue
                               |     genuine pause -> paused
                               |     navigation -> loadMedia(next, shouldPlay)
                               |     internal pause guarded; generation rejects stale frames
                               |-- info consultation -> suspend player, keep position, no resume-play
                               `-- grants/poster caches (memory only, actor/card/version scoped)

/step-visuals (public lab; separate from cards)
  StepVisualsLab -> lab experience registry -> IntegrationLabSession / RootsFactorsLabSession
     -> activity-owned reducer -> accepted semantic events + current record
     -> notification cursor -> lab inspector/development console
     -> NO durable persistence; mount creates attempt; exit archives in mounted memory
  Card1Sparkline -> pure static layout -> SVG; no activity attempt

Creator slot -> prepareUploadTarget -> authorised direct-upload URL
  -> browser Stream POST / R2 PUT -> media descriptor -> coordinator draft lane
  -> existing card save/publication; provider processing readiness is a separate state
```

V: no `fetch`, IndexedDB or storage-backed Visual Learning Records host was found in activity source. I: current full-screen no-scroll guarantees on small phones cannot be inferred from tall minimum-height CSS or the lab screenshots. N: no durable snapshot hydration, public activity publication lifecycle, guest claim, general asset picker or refcounts.

## 4. Independent review reconciliation

Every substantive finding was assessed against the unchanged baseline source and the final owner decisions. Claude's review remains unchanged as an independent artifact.

| Finding | Disposition and evidence | Implementation consequence |
| --- | --- | --- |
| F-01 server mathematical recomputation | **Accept.** Existing reducers own assessment; no server-verified mastery is required. | Validate envelopes, activity snapshot shape/invariants, bounds and ownership. Store outcomes as client-reported facts; never feed them into card completion or Progress. |
| F-02 batch receipts | **Modify/accept simplification.** Event uniqueness alone cannot acknowledge a snapshot-only write after response loss. | No batch-receipt collection. Store last accepted write ID/hash/revision on the attempt alongside CAS; serial client sender retries exact payload. Events have independent immutable IDs/hashes. See §8.3. |
| F-03 claim aliases | **Accept reparenting.** Events reference attempt identity; per-event owner rewriting and permanent aliases are unnecessary. | Reparent attempts to account record in resumable per-activity transactions. Visits resolve ownership through attempt; original guest context is provenance only. No arbitrary attempt-count cap. |
| F-04 divergent conflict design | **Owner supersedes.** Simultaneous editing unsupported. Review's automatic replacement/checkpoint alternative also exceeds the needed V1 behavior. | CAS rejects installing a stale snapshot; meaningful valid events can be acknowledged separately; retain the pending snapshot locally and show conflict. No automatic overwrite, new attempt or selection UI. |
| F-05 provisional offline first attempts | **Accept.** Temporary loss during established use differs from unknown first open. | One successful initial open is required before interaction; cached known attempts remain usable offline. New-attempt confirmation is queued against a known record. |
| F-06 early slice | **Accept.** Roots runtime is smaller; Integration has panel stacks and demonstrations. | S03/S04 provide early real card→preview→host→restore with replaceable persistence interface, then S06/S07 supply durable DB/outbox. |
| F-07 internal wording/gates | **Accept.** No DB publication pointer; baseline tests are historical. | Current release is compiled metadata; no repeated owner gate; historical counts remain labelled. |
| F-08 observed-playing regression | **Accept.** FocusedCardView reads intent; ended pause is explicitly excluded by tested helper. | Preserve intent chain for ended/stall/rapid navigation and add host-level characterization. Clear on non-video, genuine pause, failure, Close/account change. |
| F-09 custom expansion history | **Accept factual correction, reject deferral under final approval.** `4fdd50e` deliberately removed wiring. | Latest owner instruction explicitly approves Q3 A. Reconnect existing callbacks without replacing player, adding new geometry or changing native controls. Record added custom expansion in tests. |
| F-10 async grant path | **Accept.** `loadMedia` awaits guard and resolvePlayback in protected mode. | S12 preserves element and synchronous eligibility decision; adds no new await before invoking loadMedia. Test both modes automatically; real iPhone remains release evidence. |
| F-11 Roots hydrate crash | **Accept.** `recordedLearning.ts` throws when completion lacks checked prediction or settled root −4. | Validate cross-field stage/prediction/evidence invariants before constructing state. Dedicated hydrate constructor emits zero events. |
| F-12 Integration traps | **Accept with refinement.** Reuse panel projection; restore attempt evidence; constructors emit start; event IDs derive from array length; finish locks actions. | Activity-owned codec, bounded transport buffer, host event UUIDs, normalized animation, complete draft/panel memories, explicit completed-attempt navigation. No mathematical redesign. |
| F-13 modal staging/ledger | **Accept.** Existing uploads attach to draft on completion; status requires saved reference. | Valid edits go through current coordinator. Invalid text is ephemeral; no Apply/Cancel transaction or new allocation ledger. Existing fork proofs remain. |
| F-14 duplicate media storage | **Accept.** Adapter reconstructs Intro and spreads steps differently; `sameContent` respects field presence. | Exactly one canonical media representation per destination. Derive legacy front descriptor only in presentation, preserve untouched legacy fields byte-for-byte. Protect old writers. |
| F-15 image scan/cache | **Modify.** Exact-context authorization is needed; long browser caching of private data could bypass revocation/account-change checks. | Add selected attachment exact-card/version image route; keep `private, no-store` initially, reuse decoded image/object URL only within actor-scoped mounted session. Do not promise unmeasured p95 improvement or enable long-lived HTTP cache. |
| F-16 nearly empty guest wins | **Reject precedence change for foreground.** Final instruction explicitly continues foreground guest attempt. | Preserve account attempt as history even when guest is barely started; keep other account active pointers. No new history picker. Record accessibility of older attempts as known product limitation. |
| F-17 server typography | **Accept simplification, avoid new script restriction.** System fonts cannot yield exact server/browser parity. | Conservative grapheme/byte/aggregate bounds plus actual DOM measurement at target width with margin. Reject controls/newlines, allow Unicode. No server font dependency. |
| F-18 no-scroll conflict | **Resolved by owner scope.** Integration later-stage CSS has 700px floor; keyboard reduces content region. | Host region invariant is tested independently. Existing visual overflow/overlap is recorded, not fixed or made a blocker to internal slices. No claim of visual accessibility compliance. |
| F-19 layout pipelines | **Accept.** Repository uses pure `build…Layout` projections. | New host/media/modal renderers receive derived layouts; runtime actions update source state. No downstream layout patching. |
| Catalogue/manifest endpoints | **Accept initial deferral.** Static shared safe metadata suffices for selector. | Open response carries current release/capability/error. No standalone catalogue endpoints needed. |
| Framework deferral | **Reject.** Final instruction makes reference capability mandatory. | S01 implements `interactiveVisualIds` in configuration, validation and tests, without Progress aggregation. |
| Preview pipeline | **Choose generated static asset.** Pure initial render is required either way; live inert React preview can load heavy activity bundles. | Capture existing pure view in development tooling once per release, generate reviewed static SVG/PNG as appropriate. No request-time renderer or live attempt mount. |
| Per-visual disable list | **Accept bounded configuration.** A separately evaluated availability policy complements compiled metadata. | Server checked disable IDs; no operations UI or remote executable modules. Changing live environment/provider settings is outside this run. |

N1–N6 are resolved in §2; they are not new blocking questions. Retain historical audit caveats: protected origin access, deployed data shape, Safari behavior and image-route performance were not measured in this revision.

## 5. Architecture alternatives and complexity budget

| Topic | Practical alternatives | Chosen approach and rationale |
| --- | --- | --- |
| Step media | Embedded arrays; first-class file entities; hybrid wrappers | **Hybrid:** embedded labels/order/descriptors and stable Interactive Visual ID. Avoid a media-library migration; immutable content remains self-contained. Medium coordinated effort. |
| Legacy storage | Store array plus legacy field; rewrite all versions; lazy single representation | **Lazy single representation:** read either, persist one on explicit edit. Presentation-only projection prevents drift. Old-client marker rejects destructive downgrade. |
| Creator edits | Temporary staged transaction; immediate valid draft edits | **Existing coordinator edits:** fewer upload/status/Cancel races. Invalid local label drafts do not save; valid changes immediately affect draft. |
| Selected tab | Inside keyed StepView; persistent navigation host | **Navigation host:** coherent step-entry vs overlay-return identity, direct source-intent capture. |
| Full-screen | Route per card launch; overlay; route-intercepting overlay | **Overlay** for card launch; minimal direct-entry page uses same host. Side entrance is already accepted. No new browser-history behavior for modal opens. |
| Preview | Generated asset; inert live initial view; request-time capture | **Generated initial-view asset:** no learner state, no runtime screenshot service; lazy activity bundle stays closed until launch. A pure preview harness is tooling only. |
| Video | New per-tab player; existing persistent HLS host | **Existing player:** preserve proven source guards, posters and grant resolution. Position hook is a narrow extension. |
| Visual shell | Universal lesson engine; unchanged wrapped activities; thin adapters | **Thin adapters:** generic lifecycle/controls around activity-owned semantics. Do not generalize Check/Reveal/Predict because their buttons resemble navigation. |
| Durable storage | Embedded history per learner; embedded per attempt; separate events + current snapshot | **Separate events:** completed attempts remain editable indefinitely; event history cannot grow one Mongo document without bound. Snapshot stays bounded and history queries paginated. |
| Idempotency | Receipt collection; event uniqueness + latest write marker | **Event uniqueness + marker:** permanent event dedupe and exact current snapshot retry; no independently expiring receipt collection. Unsupported multi-writer responses stay conflicts. |
| Concurrency | Last-write-wins; simple revision check; coordinated editing | **Revision check:** no silent overwrite; local retention and explicit conflict. Concurrent collaboration is future work. |
| Guest identity | Guest rows in users; separate principal; browser bearer | **Separate principal + HttpOnly opaque token:** existing directory/auth assumes accounts; avoid exposing anonymous entries and browser-readable authorization secrets. |
| Claim | Rewrite all events; ownership aliases; reparent attempts | **Reparent attempts:** bounded per-record transactions; event IDs stay fixed. A small claim progress record handles retry without permanent authorization indirection. |
| Publication | Compiled registry; DB pointer; remote code packages | **Compiled releases:** approved scope; no remote code injection. Current metadata and server availability policy suffice. |
| Images | Existing global scan; exact contextual lookup | **Exact lookup:** select stored authorized attachment, never trust arbitrary URL. Bounded actor-scoped decode reuse; keep conservative private HTTP policy. |
| Labels | Character cap alone; exact server font engine; conservative bounds + browser measure | **Bounds + measure:** actual combined rendered width matters, system font variation needs safety margin/device tests. No new typography service. |
| Upload reuse | Scan old descriptors; asset catalogue + permissions/GC; no new picker | **Defer picker:** neither scan nor catalogue is a cheap safe addition. Preserve new uploads and legitimate existing fork/copy references. |

Essential now: media/read contracts, host boundary, complete codecs, DB ownership, unique-event ingest, snapshot CAS, durable offline queue, guest claim, exact media authorization, mandatory Framework references, regression tests. Cheap prevention now: typed origins, explicit release metadata, per-visual disable policy, bounded snapshots, pure host layout. Deferred: remote catalogue, asset library/GC, full history UI, concurrent-device reconciliation, real-time infrastructure, demo decks and mathematical responsive redesign.

## 6. Media, registry and host contracts

### 6.1 One canonical destination representation

```ts
type StepMediaItem = Readonly<{ id: string; label: string }> & (
  | Readonly<{ kind: 'video'; media: VideoMediaItem }>
  | Readonly<{ kind: 'image'; media: ImageMediaItem; alt: string }>
  | Readonly<{ kind: 'activity'; activityId: string }>
);
// Stored destination has exactly one representation:
// legacy mediaItem (Intro nullable; step optional), OR mediaItems: StepMediaItem[].
// Normalized and presentation DTOs may carry derived legacy descriptors; never persist them.
```

Attachment identity differs from provider asset ID and Interactive Visual ID. Preserve existing Stream/R2 IDs, src, poster, dimensions and descriptions. Array order is the order; no redundant numeric order. Replace may preserve attachment ID but changes the source fingerprint; remove/add creates another attachment ID. Repeated types and repeated visual IDs are valid; the same learner/visual still resolves one record.

Normalize absent/null legacy descriptor to zero items, otherwise one deterministic slot scoped by card/destination/original descriptor. Reading never materializes new fields. A media edit removes legacy `mediaItem` from that destination and writes `mediaItems`, including explicit empty array. Unrelated text edit, reordering cards or publishing untouched data must not dirty legacy media. Canonical validation rejects dual representations; front/working DTOs are clearly separate projections and must be converted through canonical adapters before save.

Update strict domain validation, creator board pair/column fields and adapters, API DTOs, copy/fork/move, instructional video enumeration, upload/status authorization and prospective proof enumeration together. Existing `protectedMedia.contentMedia` recursion already finds wrapped descriptors; keep Info Card media exclusions. Reject newly attached foreign/private/personal/Info Card assets through existing ownership/proofs; opaque asset IDs and public URLs are not proof. Do not rewrite old immutable versions or weaken legacy authorized reads.

Require media protocol capability on full-content writes if the stored or submitted draft has arrays. An old client cannot erase arrays by omission, including on an unrelated text save. Apply the same rule to creator-session/fork/save routes, not just the obvious PATCH endpoint. Test old client publication using unchanged draft separately from stale content replacement.

### 6.2 Front projection and learner selection

The front selector returns the first video descriptor in Introduction order, or null. Legacy content preserves its existing descriptor path; known legacy unsupported media remains a characterized compatibility case. `IntroMediaBlock` poster/click geometry, `PreparedIntroThumbnail` and preparation use the derived video; they never receive image/activity truthiness as a substitute. No main-step front thumbnails.

A pure media-region layout computes ordered tabs, selected item and expansion availability. The persistent navigation host owns step-entry identity, selected attachment and memory positions. Initial/open/re-entry selects item zero. Overlay Close preserves entry/selection; step change resets selected item. Same tab or boundary navigation is a no-op. All user completion operations continue through the existing separate CardData mutation.

### 6.3 Creator management and labels

Keep the four existing upload/link locations. Convert the trigger into a modal with configured items, existing transport upload controls, published Interactive Visual selector, short labels, accessible reorder and remove/replace actions. No alternate card editor, extra publishing action, gallery or file picker.

Valid edits use the current coordinator desired card and revision lane immediately. Only unfinished/invalid label input is ephemeral. On Close, previously committed valid edits remain in the draft. Invalid text is not applied; show its validation while editing. Upload completion attaches to the intended draft, then status polling uses that stored reference. A failed upload/replacement keeps the old attachment. Pending uploads reserve capacity; cap includes reservations. Abort/generation/actor/destination checks reject obsolete completions. Closing the modal does not erase an already-completed upload. Preserve current fork/prospective proof behavior; derive its bounded proof count from all possible new instructional slots and the existing separate back-media slot, not an arbitrary unlimited array.

Labels: defaults Watch/Explore/Image; trim outer whitespace; reject empty, line/control characters, oversized bytes and excessive graphemes. Start with at most 12 graphemes per label and 32 across a destination; tune only with boundary fixtures, preserving readability. These are conservative data bounds, not exact font assertions. Do not introduce a new script whitelist. At the 320px layout's actual inner width, measure rendered tab text/padding/gaps using the same styles and a safety margin after fonts settle. Invalid combined width prevents applying that configuration. Renderer has no scroll, ellipsis, shrinking-font or hidden-tab escape hatch. Test wide Latin, accented, combining and non-Latin labels. Server verifies structure/bounds, not a font service; browser tests establish actual fit. Four suggested defaults may require shortening if measured invalid; never silently truncate them.

### 6.4 Compiled registry, release and previews

Proposed pure `src/lib/interactiveVisuals/catalogue.ts`: stable ID, title, published/retired status, activity version, snapshot schema, event schema and preview asset path. Explicit component loaders live separately in `src/components/interactiveVisuals/registry.ts` to keep React/runtime code out of server metadata. Historical release/schema identifiers remain distinguishable. Record a build identifier for diagnostics; avoid redundant version axes without a concrete consumer.

Publish through an activity-focused application release. Cards store only stable IDs and resolve current metadata on each open. New selector entries exclude retired and disabled visuals; existing retired references remain usable when safe. Emergency disabled visuals show unavailable, preserve references/history and reject new opens/unsafe mutations. A small server configuration list can disable IDs; configuring production is not authorised here. Old clients declare activity/schema versions; incompatible clients receive a typed response and keep pending work. Do not hot-swap a running reducer.

Preview generation renders the actual initial view without mounting an activity state owner, creating an attempt, delivering callbacks or querying records. Use a pure initial presentation fixture and a tooling-only capture harness; generated assets are release-specific and reviewed. No runtime capture service. Missing preview gives an honest unavailable/preparing surface with Open only when the visual is available, never a card-front fallback. The development responsive mock is excluded from the published registry and production import closure.

### 6.5 Generic host versus visual-owned controls

```ts
type VisualContentBounds = Readonly<{ width: number; height: number }>;
type VisualNavigation = Readonly<{
  previous: { visible: boolean; enabled: boolean };
  next: { visible: boolean; enabled: boolean; label: 'Next' | 'Finish' };
  canBackToStart: boolean;
  atStart: boolean;
}>;
// Adapter receives bounds, initial validated snapshot, active/suspended state,
// and explicit commands. It emits navigation capability, committed snapshot
// changes and meaningful events. Host requests; visual validates/transitions.
```

Host owns modal lifecycle, origin/focus return, safe areas, fixed control regions, measured content bounds, transport/sync status and generic controls. **Next/Finish occupies bottom-right; Previous occupies bottom-left only when supported.** Close is stable and separately accessible. Back to Start navigates the same attempt; Stage 1 offers secondary confirmed Start New Attempt. Do not add a generic arbitrary-stage picker.

Visual owns every graph/function/case selector, slider, root/boundary, numeric input, Check/Reveal/Predict/answer submission, hint, explanation, demonstration and feedback. The host never decides a correct answer or unlocks a mathematical gate. Integration Finish and stage Next are capability requests whose eligibility is computed by its adapter/reducer. Roots Check remains inside the visual even when successful Check completes the activity.

Use `buildInteractiveVisualHostLayout` / `buildStepMediaRegionLayout` / modal layout helpers per repository convention. Measure a reserved content DOM rectangle with ResizeObserver and visualViewport changes; pass numeric dimensions to the visual adapter. Host controls are not sized by a visual's content height. A responsive development-only mock proves control bounds, bottom-right Next, resizing and safe-area behavior.

Existing Integration/Roots mathematical layout CSS, graph sizes, typography and panel ordering are not redesigned. They may temporarily overflow/overlap host controls during internal testing. Record exact affected stage/viewport/keyboard state and consequences. Do not hide that problem with clipping or claim visual no-scroll/accessibility success; do not block unrelated host/persistence work or fix the visual incidentally. Generic host accessibility remains in scope: dialog naming, keyboard operation, focus trap/inert background, Escape/Close, focus restoration without targeted scrolling, status announcements and reduced-motion overlay.

Suppress duplicate existing Exit/navigation/restart UI only in hosted mode; preserve lab behavior through existing public mounting contracts. This is a control-ownership integration, not a responsive redesign. Pure mathematical modules stay free of DOM, Next, auth, card and Mongo imports.

### 6.6 Origin, access and routes

Step origin carries deck/card/version, Introduction or stable stepId, attachment ID, entry key and local focus token. Direct origin carries only an approved internal return target; never accept arbitrary URL redirects. Framework source carries framework/item IDs validated against configuration. Server validates card/step/attachment/visual association for verified context; source context never grants another learner's record access.

| Route/service (proposed) | Responsibility |
| --- | --- |
| `/interactive-visuals/[activityId]` | Minimal guest-capable production entry using shared host, no catalogue/menu/signup. Invalid/disabled ID is unavailable. No private card text/media returned. |
| `POST /api/visual-sessions/open` | Account or guest principal; validated visual/source; unique learner/activity record; idempotent first attempt and visit; current snapshot/compatibility. |
| `GET /api/visual-records/[recordId]/current` | Owner-only active attempt/snapshot; bounded response, no complete history load. |
| `POST /api/visual-attempts/[attemptId]/batches` | Actor-bound meaningful events and candidate snapshot, dedupe + revision check, explicit per-part acknowledgements. |
| `POST /api/visual-records/[recordId]/attempts` | Explicit confirmed new attempt, stable command/attempt IDs, expected active attempt, idempotent retry. |
| `POST /api/guest-sessions` | Opaque same-origin guest bootstrap; no identity per thumbnail or per open. |
| `POST /api/guest-claims` | Both account session and guest credential; bounded retryable ownership transfer; server-derived principals. |
| Exact-context instructional image route | Account/card/version/mode/destination/attachment authorization, stored URL only, protected response. Guest card images remain inaccessible. |

No separate catalogue/manifest endpoints initially: shared safe metadata feeds selector, and open response supplies current server capability. Reuse current login surface and internal return handling. Private responses are no-store, mutation origin/body bounded and actor checked. Next 16 route params/cookies are asynchronous; installed guides govern implementation.

## 7. Video preservation and session-position protocol

### 7.1 Verified implementation and chosen policy

`FocusedCardView.goToStepViewItem` captures `videoPlaybackIntentRef === 'continue'` synchronously, invokes `loadMedia`, then updates step state. The HLS player lives outside keyed StepView while video is selected. `loadMedia` has direct and guarded paths; the guarded path awaits readiness/grants before play. Existing operation/source/pause generations reject stale work. Internal source pauses are suppressed; ended pause is deliberately not treated as user pause. Source-ready/video-frame callbacks and paint boundaries control poster reveal.

Preserve that chain rather than requiring `!paused && !ended` at navigation time. The owner delegates the review's N1 choice while requiring legacy protection: ended, buffering and intermediate loading during rapid Next remain continuation cases. This is an explicit boundary-case interpretation, not an unnoticed relaxation. Fresh entry, actual user pause, non-video/empty source, blocked/error result, consultation and leaving the card clear continuation. A browser policy rejection remains paused with usable Play.

### 7.2 Transition table

| Transition | Required behavior |
| --- | --- |
| Fresh step open | First tab, paused video, valid session position if available |
| Video intent continue → video, including ended/stall/rapid loading | Capture source position; invoke existing load path with shouldPlay; retain element across video-to-video |
| Genuine paused/blocked/failed source → video | Destination paused |
| Video → image/visual/empty | Capture position, pause/reset/cancel pending work, clear chain |
| Image/visual/empty → video | Paused regardless of historical play state |
| Outer Previous/Next | New step entry and first item; continuation captured before selection changes |
| Same tab/boundary navigation | No reload/seek/play request |
| Image/visual overlay Close | Same entry/tab and focus; no first-tab reset |
| Existing video expansion/collapse | Same player and source, preserve position/state; no second autoplay decision |
| Native fullscreen exit | Observe native state without inferring play; real device verification |
| Card Close/account change | Pause/cancel all source work, clear chain; actor change clears position/cache |

Keep controller state minimal: entry key, selected attachment, overlay origin and memory position map. Reuse player generations instead of a second independent playback machine. Add position getter and `startAt` load option; restore only after metadata/seek readiness, clamp finite time to duration, associate callbacks with source generation. Do not show frame-zero poster as if it is restored content; preserve the original one-video poster transition and test nonzero seek separately.

Positions key by actor-session/card/destination/attachment/source fingerprint and survive ordinary in-app tab/step/card navigation within that session. Hard reload/account boundary may reset. No server video-position persistence. Do not replace a known saved position with zero from a source that has not loaded yet. Capture once before reset; stale completion/grant/seek events cannot change newer position or intent.

Automated tests must drive navigation host decisions, not only call a player handle with manually supplied shouldPlay. Include protected-mode grant delay/failure, direct-mode load, rapid Next/Next, pause during grant, ended, stalled, same asset in different slots, and video→nonvideo→video. One active decoder, bounded poster/grant preparation. No multimedia autoplay fallback is enabled without new evidence and explicit approval.

## 8. Visual Learning Records

### 8.1 Entities, identity and indexes

```text
account or guest principal
  -> record UNIQUE(principalKey, activityId)
       activeAttemptId
       -> attempts {recordId, snapshot, stateRevision, lastAcceptedWrite}
            -> events keyed by immutable attemptId + eventId
            -> visits keyed by attemptId + source context
            -> migration checkpoints only when preserving incompatible/old state
Card/Deck/Framework -- contextual source --> visit
```

| Entity | Fields and invariants |
| --- | --- |
| `visualRecords` | recordId, principalKey, activityId, activeAttemptId, revision, createdAt/updatedAt. One per learner/visual. No card/deck ownership. |
| `visualAttempts` | attemptId, recordId, activityId, startedRelease, current snapshotSchema/version, validated snapshot, stateRevision, lastAcceptedWrite {id,hash,revision}, createdAt/updatedAt, firstCompletedAt/latestCompletion metadata. Old attempts retained; display attempt number is not identity. |
| `visualEvents` | eventId, attemptId, visitId, writerId, clientSequence, clientOccurredAt, serverReceivedAt, activityVersion/eventSchema, type, bounded payload, content hash. Outcomes client-reported. No pointer/animation samples. |
| `visualVisits` | visitId, attemptId, openedAt, principal kind at access, validated source IDs/version, optional journeyId; no bearer URLs or card-text copy. Optional close event may be absent after crash. |
| `visualSnapshotCheckpoints` | checkpointId, attemptId, previous version/schema/revision, snapshot/hash, reason pre-migration or invalid-snapshot preservation. Not a concurrent-edit branch system. |
| `guestLearners` | guestId, tokenHash, active/claiming/claimed/expired state, lastUsedAt/expiresAt, optional account-bound claim status. No email/name/fingerprint. |
| `visualClaims` | claimId, guestId, accountId, foreground attempt, per-record progress/receipt, completedAt. Durable idempotency and resumable transfer, not an alias permission path. |

Indexes: unique recordId and `{principalKey,activityId}`; unique attemptId, attempts `{recordId,createdAt,attemptId}`; unique `{attemptId,eventId}`, events `{attemptId,serverReceivedAt,eventId}` and optional `{attemptId,writerId,clientSequence}` consistency index only if needed; unique visitId, `{attemptId,openedAt}`; unique checkpointId; unique guestId/tokenHash; unique guestId in claims and unique claimId. No payload/free-text index. Explicit setup script/dry run, never index creation on imports or public requests. No live setup execution in this task.

Do not embed unlimited events or attempts in one Mongo document. Snapshots contain bounded state/evidence necessary for continuation; retained meaningful history lives separately. Enforce limits and keep writes truthful if unsupported oversized state occurs; never silently trim learner evidence. Initial limits: 100 events/request, 256 KiB total, 128 KiB snapshot, bounded nesting/strings; derive actual fixtures before final constants. Paginate history, resume reads one current snapshot.

### 8.2 Activity-owned state and event semantics

Provide dedicated initial and hydrate constructors. Hydrate never calls a constructor that emits attempt-started, never replays historical events and clears mounted terminal exit flags. Activity-owned validators enforce safe reducer invariants; server does not independently re-grade historical maths. Pure codecs remain alongside each visual; the generic repository handles identity/transport/schema selection.

Roots snapshot includes settled movingRoot, hasChangedPlacement, exact lesson discriminant/prediction/retrieval panel/feedback/evidence, current attempt evidence and retained per-stage work needed by Back to Start. Reconstruct manipulation with no live edit and safe fresh input counters. Validate reveal/retrieval/completed prediction relationships, checked prediction and completed root −4, check counters/assistance and matching current stage. Reject invalid state before reducer invocation.

Integration snapshot includes all `IntegrationPanel` fields, normalized demonstration state, comparisonRun, previousPanels/nextPanels and current attempt evidence. Reuse the panel projection. Include unchecked draft, checked/problem/answer revisions, help, rectangle/function/subsection memories and prediction state. Fractional demonstration frames are not saves: normalize unfinished comparison to restartable semantic state; restore demonstrated comparisons without inventing demonstration or prediction events. Serialize committed content changes, not every reducer object identity or frame. Keep stage-specific controls/assessments intact, including Finish after any valid numerical Check, even incorrect.

Hosted event envelope IDs are UUIDs allocated once on accepted semantic action, stable across queue retry. Existing activity session eventId/sequence may remain internal/lab metadata but are not database identity. Clear/acknowledge bounded delivery buffers without replay or array-length ID reuse. React effect replay must not mint duplicate persisted facts. The adapter outputs snapshot changes separately from event records because typing an unchecked Integration answer creates no existing event.

Back to Start must retain stage work, not just an event log. Integration returns through retained panels, permits navigation out of finished state and restores completed stage work without auto-completing on arrival. Roots retains visited stage snapshots in its own adapter/reducer: Stage 1 returns to its last valid orientation placement (not completed −4, outside orientation bounds). Forward capability may restore previously reached stage state when its prerequisite work is unchanged; a new mathematical answer invalidates only dependent current feedback/presentation, preserving former values in retained evidence. No extra previous-stage button or mathematical selector is added. Explicit checks and prediction actions stay inside the visual. Tests define same-attempt return, untouched progression restore, changed-answer invalidation and repeated completion. `firstCompletedAt` is stable; later completion events append without creating another attempt or duplicate attempt identity in summaries.

### 8.3 Autosave, revision checks and idempotency

1. Initial successful open returns principal handle, record/attempt IDs, visit, current release, validated snapshot and stateRevision. Unique learner/visual index plus idempotent open request prevents duplicate first attempts. Unknown first open while offline shows connection-needed; it creates no provisional attempt. Known local attempt can continue offline.
2. Accepted semantic action produces immutable event IDs and a new committed snapshot. One IndexedDB transaction stores the events and latest local snapshot under principal/activity/attempt. Draft snapshots coalesce; checks, predictions, help and placements do not. Keep a bounded in-memory transport view; no frame writes.
3. Single local sender serializes requests for that attempt. Freeze each request body/writeId/baseRevision until acknowledged; newer local edits stay pending. Flush about 1–2s idle, at most about 5s during ongoing meaningful edits, promptly after Check/stage change/Close. Retry backoff with jitter and Retry-After. Visibility/pagehide is best effort, never primary durability.
4. Request carries writeId, expectedStateRevision, visitId, release/schema, events and candidate snapshot/hash. Server derives principal from cookie and verifies initiating handle; validates sizes, schemas, stored access and attempt ownership. Repeated event ID with changed immutable payload is rejected. Dates/claimed correctness are never authorization.
5. In a transaction, deduplicate/append valid events. Install snapshot only when expected revision matches. Store latest writeId/hash/result revision atomically with accepted snapshot. Update active-record summary only if this remains active; never reactivate a historical attempt due to a late batch.
6. If last accepted write ID/hash matches an exact retry, acknowledge it without increment/reinstall. A different payload with same ID is an error. Unique event IDs keep history dedupe independent of receipt retention. If another device subsequently wrote, an old snapshot retry may return conflict rather than misleadingly declaring the current local state Saved; accepted events can still be acknowledged.
7. Conflict response explicitly separates acceptedEventIds from snapshotAccepted:false/currentRevision. Do not overwrite server snapshot, automatically adopt server state, create another attempt or discard the local candidate. Preserve pending work locally and show small nonblocking conflict status; stop futile retry of that stale snapshot. Other activity/step navigation remains available. Simultaneous editing is unsupported; reconciliation is future work.
8. Saved status requires the newest local snapshot revision/hash and all event IDs to be acknowledged, with no pending new-attempt command. An older success cannot clear newer pending work. IndexedDB failure is volatile pending/failed, not safely offline. Network error is not Saved.
9. Explicit confirmed new attempt allocates one command/attempt ID and expectedActiveAttemptId. Retry finds the same created attempt before checking active revision and never sets it active again after later changes. Offline confirmation on a known record queues the command before its subsequent batches. Competing active changes return conflict and retain local command/work; no automatic replacement.
10. Actor/account changes hide private runtime data and prevent outbox retargeting. Successful server claim is the only supported guest→account queue rebinding and preserves IDs. Logout clears in-memory/decoded caches; disk pending data remains partitioned and inaccessible until the same authenticated principal returns, subject to retention policy. It is not encrypted protection against same-origin compromise; record shared-device limitation before production.

Example request: `{writeId, expectedStateRevision:17, activityVersion:3, snapshotSchema:1, visitId, events:[{eventId,writerId,clientSequence:42,type:'boundary-committed',clientOccurredAt,payload:{stage:1,boundary:'b',from:1,to:2.5,input:'pointer'}}], snapshot:{...completeActivityOwnedState}}`.

Response: `{acceptedEventIds, snapshotAccepted:true, stateRevision:18, snapshotHash, writeId}`; conflict: `{code:'REVISION_CONFLICT',acceptedEventIds,snapshotAccepted:false,currentRevision:19}`. Never return another actor's snapshot in an error.

Meaningful vocabulary remains activity-specific: Integration boundaries, function/division selection, demonstrated comparison, prediction submitted/tested, refinement, region/interval, calculation Check/help and completion; Roots placements, predictions, checks, assistance and completion. Visit/source plus client/server timestamps support contextual ordering and rough durations; background time is not proof of engagement. Preserve mistakes separately from assistance and completion separately from mastery.

### 8.4 Compatibility and lifecycle failure handling

On next open resolve current compiled release. Compatible snapshot resumes same attempt; deterministic migration validates input/output and preserves a pre-migration checkpoint under CAS. Unmigratable/corrupt state is retained, never passed to a reducer or replaced with fresh defaults. Provide an explicit non-destructive recovery surface with Stage 1 Start New Attempt confirmation. No automatic new attempt on version update.

Implementation contract from S09b: immutable compiled codecs live in `src/lib/visualLearningRecords/codecs.ts`; explicit activity-owned conversions are registered in `migrations.ts`. The first durable releases have no earlier durable format, so the production conversion list starts empty. Tests inject a synthetic historical format without publishing an additional curriculum visual. A conversion must preserve attempt identity, attempt number and internal event sequence, validate both source and destination, retain `startedRelease`, and checkpoint the raw source before installing the target. A latest accepted write remains retryable through a format-only revision. A pending candidate may cross that exact format-only revision only when a transactional checkpoint proves that no learner write intervened; any subsequent learner write remains an ordinary conflict. This is not concurrent editing or semantic merging.

On-device conversion keeps frozen requests and historical event versions unchanged, queues a raw-source checkpoint and converts only the latest candidate. Older known event vocabularies remain ingestible through their retained codecs. The owner-scoped `POST /api/visual-attempts/[attemptId]/checkpoints` validates the source codec and a declared conversion path, stores immutable backup history and never installs the raw state. Queued checkpoints for a retained intermediate release remain history after a newer publication; they cannot downgrade the active snapshot.

If pending work meets unsafe server restoration, normal append must refuse to overwrite it. `POST /api/visual-attempts/[attemptId]/recovery-batches` then backs up the bounded raw candidate and immutable event IDs under the same actor, visit, origin and request-budget controls. It is allowed only for an unsafe historical attempt or an exact retry of an existing backup. Known-codec facts can retain their interpreted history; unsupported bounded payloads are marked `opaque-history`, never executed or used to infer completion. The client reports pending backup / previous attempt kept rather than Saved. Confirmed fresh-attempt registration drains that predecessor backup first, including across reload or a lost acknowledgement. Backups do not replace the unsafe snapshot or advance its state revision; attempts and contextual visits remain retained. Checkpoints join the same retention/export/deletion ownership traversal and require additive indexes before feature enablement.

Retired references remain representable; new selection is denied. Emergency disable prevents new execution while retaining data. Old-release pending events can be validated/stored as historical client facts when safe, without treating their snapshot as compatible current state. Keep original release/schema on each event. Rollback cannot feed a newer snapshot to an older incompatible reducer. Removing card reference leaves record/attempt/event/visit untouched. Account/guest data deletion is a separate authorized lifecycle operation, not attachment cleanup.

## 9. Guest identity, claim and deferred demo design

### 9.1 Common learner boundary

Use opaque random 256-bit guest token in HttpOnly, SameSite cookie, Secure in production. Store only a cryptographic hash; public guestId is never proof. Validate status and expiry on every request. Provisional 90-day inactivity expiry is renewed on real accepted use, not passive previews. No automatic TTL that deletes credentials while orphaning related history; provide coordinated retention dry-run/service for later approved operation. Production privacy/retention review is still required.

The same Visual Learning Records repository accepts `account:<id>` or `guest:<id>`. No guest-specific event/snapshot schema, no anonymous rows in account directory, no fingerprinting. First real entry establishes guest identity without login. Public entry allowlists published accessible visuals only; it never grants guest access to existing card APIs, uploads, private images or arbitrary source contexts.

Sign-in invitation appears after meaningful stage progress or completion, using existing sign-in UI with an internal return target; no initial gate, registration wizard or compulsory prompt. Preserve local work during authentication. Login success remains success even if subsequent claim needs retry.

### 9.2 Claim protocol

1. Capture foreground guest attempt and stable claimId in guest outbox before login. Claim requires authenticated account cookie, valid guest credential, same-origin request and initiating account binding. Account/guest IDs in request body never decide ownership.
2. Short transaction validates and marks guest claiming for that account; concurrent guest writes must contend on the same ownership guard so a pre-claim authorization cannot commit after transfer without recheck. Claimed credential fails closed for all ordinary guest endpoints. Same-account retry resumes; another account is denied without revealing identity.
3. Process guest activity records in bounded, resumable per-record transactions. Get/create account's unique record, reparent attempts by recordId, keep attempt/event/visit IDs. Visits authorize through attempts; guest-at-access and origin record remain non-authorizing provenance. Event rows are not rewritten. No permanent record redirect resolver.
4. For foreground activity, make captured guest attempt active exactly once, retaining prior account attempt. For other activities preserve existing account active attempt, or take guest active when absent. Concurrent explicit account new-attempt changes are detected; retain all work and report conflict rather than erase it.
5. Mark each source record transferred/tombstoned after reparenting and store claim progress. Retry checks completed mapping before updating active pointers; it cannot displace a later intentionally selected attempt. No arbitrary user-facing attempt cap to make transactions easy. If a very large claim exceeds transaction capacity, preserve partial progress and retry bounded work; report limitation rather than delete or flatten history.
6. Account-bound claim receipt lets client rebind the same queued IDs. Late guest write receives claimed/actor-changed; account resend deduplicates. Retire guest credential after acknowledged claim; short bounded claim-status recovery remains account-bound. Logout never revives guest access to claimed records.

Test lost login/claim response, two claim requests, account switch, expiry mid-queue, in-flight write/claim, existing account history, zero/one/many guest attempts and foreground nearly-empty attempt. Foreground continuation is explicit owner policy; older account attempts remain stored even though history UI is deferred.

### 9.3 Security and data lifecycle

Deny guessed IDs, cross-account attempts, forged visits/context, arbitrary assets, claim-by-guestId, CSRF and hostile/oversized/deep/nonfinite payloads. Validate snapshot cross-field invariants before hydration; store reported assessment facts without server grading or automatic card completion. Rate-limit issuance and writes using bounded existing/local infrastructure; no new Redis, CAPTCHA or fingerprint subsystem. Do not log tokens, signed URLs, answer payloads or account credentials.

Exact contextual image authorization selects trusted stored descriptors and verifies account/card/version before fetching. Preserve Info Card provenance exclusions and private-era restrictions. Existing documented public R2/unsigned Stream assets are a historical risk, not verified private delivery. No live provider changes or new restricted guest-media exposure. Use controlled test assets/stubs locally; release requires authorized provider audit. Account logout invalidates local decoded-object caches; private HTTP responses do not enter shared caches.

Export/delete services must traverse records → attempts → events/visits/checkpoints and claims under one owner, with coordinated expiry. Implementation may supply dry-run/tested code, never delete live data. Provisional retention is not legal compliance certification. Preserve only bounded numerical/choice/answer-draft data and useful context; future free-text visuals need separate content/privacy review.

### 9.4 Demo decks — P8, NOT AUTHORISED FOR INITIAL IMPLEMENTATION

Prepare optional typed journey/source context now; implement no guest deck pages, flags, card mutation routes or guest CardData/DeckData yet. Future guest progress uses ordinary models through principal-aware storage adapters, with Visual Learning Records remaining separate.

Options: boolean guestAccessible is smallest but underspecifies version/revocation; new visibility enum affects existing public/private invariants; a separate default-disabled guest-deck policy best isolates contextual permission. Recommend later policy tied to approved published composition/version and issuer. URL possession grants only that context; it does not make private cards universally readable or authorize a deck owner to expose another creator's private content.

Future sequence: approve designation/authority → exact deck/card/version/media permission resolver → ordinary guest DeckData/CardData → explicit progress mutations → bounded deck/card/step/media journey events → join VisualVisits by journeyId → non-destructive account association → revocation/retention/security/device review. Guest card/deck collisions remain a future owner decision; never silently overwrite account dates, adoption, completion, reflections, media or tests. No event-schema migration is needed merely to populate already optional journey/source IDs.

## 10. Migration, verification environment and rollback

Reader-first rollout: validators/normalizers/projections/capability rejection precede new writers. Materialize only destination explicitly edited, never rewrite immutable versions or normalize every card on ordinary read. Preserve assets, dimensions and step IDs. Stale clients cannot write full content lacking media protocol to modern cards. Publication remains existing transaction; central visual release does not dirty card drafts.

Visual Learning Records collections are additive. Supply explicit index/setup dry run, duplicate check and disposable replica-set tests. Imports/builds must never connect to Atlas. Test helpers instantiate a disposable DB directly and assert localhost/test database; never load production `.env.local` for test writes. Do not run existing seed/reset/migration scripts. If local Mongo binary/server unavailable, record exact integration gap, continue pure/client slices and keep DB-dependent completion unverified rather than report mock tests as database evidence.

Feature gates separate new media writes, host execution and guest access. Disabled writes cannot leave the host falsely reporting Saved. Keep server authorization independent of UI flags. Generated fixtures/mocks remain development-only; no published mock visual.

Rollback keeps a reader-compatible version and all data. Disable new writers/opens if needed, leave arrays and queued pending work intact. Never flatten arrays, delete attempts, unclaim a guest or bulk-change provider flags. Activity rollback resolves snapshot compatibility and preserves migration checkpoints; incompatible newer snapshots remain retained. A committed claim is not undone by app rollback; older compatible code must still authorize moved attempts correctly.

Local builds and tests are authorised; push/deploy/live DB setup/provider config are not. Real iPhone and provider validation remain release gates. Record outstanding commands as operator tasks, not executed actions.

## 11. Autonomous implementation slices

### 11.1 Workstreams and dependency order

P0 baseline → P1 contracts → early P3/P4 host slice → P5 persistence → P2/P3 media management/presentation → P6 guest claim → P9 integrated hardening. P7 Framework references move into mandatory S01. P8 demo decks remain future only.

```text
S00 plan/authority
 -> S01 registry + Framework + characterization
 -> S02 canonical media + legacy compatibility
 -> S03 Roots codec/adapter
 -> S04 early card preview/host/restore slice
 -> S05 Integration codec/adapter
 -> S06 Mongo records/event/snapshot repository
 -> S07 API + durable outbox integration
 -> S08 attempt controls and same-attempt lifecycle
 -> S09 release compatibility/recovery
 -> S10 creator modal/uploads
 -> S11a account-scoped Card visual entry/origin
 -> S13a exact-context image delivery foundation
 -> S11b learner mixed media/origin
 -> S12 video position/autoplay/expansion
 -> S13b instructional image expansion/cache
 -> S14 guest credential and DB access
 -> S15 non-destructive account claim
 -> S16 guest entry/sign-in return
 -> S17 integrated hardening/handoff
```

This is the default sequential execution order, not a requirement to block independent work behind an unavailable external test. S05 can proceed while a disposable DB is unavailable; S10/S11 depend on compatible contracts and adapters but not guest claim. S12 physical-device evidence does not block S14–S16 local implementation. The same file should have one coordinated editor; no uncontrolled parallel edits are authorised. Relative effort: S01/S03 M, S02/S04–S05 L, S06–S08 L, S09 M, S10–S13 L, S14 M, S15 L, S16 M, S17 L. Confidence is high in bounded contract changes, medium until runtime tests for restoration/claim, and unverified for physical iPhone policy.

### 11.2 Common slice completion and commit gate

Every slice must: inspect current code and prior commits; implement its bounded tasks; run relevant new and regression tests; inspect `git diff --check` and actual diff; document limitations and actual results; stage only named intended paths; commit subject plus multiline body **with no straight or curly apostrophes anywhere**; update handoff with hash, changed areas, checks, remaining work and exact next step. Include the handoff update in the next slice or an intentional documentation checkpoint; never leave a completed state permanently undocumented. A failing slice is not marked complete. Proven unrelated failures are separately recorded with reasoning.

Automatic progression is authorised for every core slice after this common gate. Only new product decisions, significant integrity/security failures, required unapproved external operations or broken regression gates stop affected work. Manual phone checks are recorded as unperformed until actually performed and block production readiness, not unrelated slices. All suggested new modules below are proposed until present in Git.

### S00 — Consolidate approved architecture and review

- **Deliverable/dependencies:** revised plan, full F-01–F-19 dispositions and persistent handoff; current branch verified. No implementation dependency.
- **Areas/tasks:** this plan, unchanged specification/review as source inputs, new handoff. Audit obsolete concurrency/visual-responsive/Framework scope in all sections; record latest authority and pending operational gates.
- **Automated acceptance:** links/fences/IDs/slices valid; no old mandatory conflict subsystem, optional Framework capability or visual responsive redesign; input hashes unchanged. Review actual documentation diff.
- **Regression/manual:** no app build required for docs; no phone check. Confirm intended branch and no unrelated staging.
- **Commit:** `docs: finalise plugged-in visuals implementation plan`.
- **Rollback/continue:** documentation revert only; does not revoke user instruction. Continue automatically to S01.

### S01 — Registry, Framework references and regression characterization

- **Deliverable/dependencies:** S00; shared metadata for two stable Interactive Visual IDs, availability policy and mandatory independent Framework references.
- **Areas/tasks:** proposed `lib/interactiveVisuals` metadata/contracts; `frameworks/configuration{,Contracts}.ts`; existing framework/unit tests. Add optional backwards-readable `interactiveVisualIds`, explicit arrays in sample config, type/duplicate/known-ID validation without changing card mapping calculations. Keep metadata free of React/lab imports. Characterize ended/pause/rapid continuation and existing activity baseline before changing it.
- **Tests/acceptance:** empty visual arrays allowed; malformed/duplicate/unknown visual IDs rejected; a visual mapping without card IDs is valid; existing card aggregation/assessment results identical; registry contains only approved real IDs and no mock; baseline affected tests pass.
- **Manual/regression:** record native autoplay check pending; no production publication or provider call.
- **Commit:** `feat: add interactive visual registry and framework references`.
- **Rollback/continue:** additive schema; keep compatible config reader if later metadata used. Continue S02 after common gate.

### S02 — Canonical media and compatibility through real card workflows

- **Deliverable/dependencies:** S01; 0–4 media type contract, lazy legacy normalization and video-only front selector with safe write protocol.
- **Areas/tasks:** `decks/types`, `cards/domain/model`, creator board/adapter/coordinator request boundaries, read models, upload/prospective enumerators and new stepMedia helpers. Implement exactly one persisted representation. Audit every reconstruction, fork/copy/move path. Add capability guard before modern writes; preserve unchanged legacy shape and provider identity.
- **Tests/acceptance:** full round trips for Intro and main steps; [] vs absent, duplicate slots, repeated visuals, >4, invalid IDs/assets; text-only save stays legacy-identical; first video selected despite image first; old writers cannot drop arrays; publication and step-completion tests unchanged.
- **Manual/regression:** no provider upload needed; review serializer diff and data ownership.
- **Commit:** `feat: support compatible instructional media collections`.
- **Rollback/continue:** no backfill; keep array reader on rollback. Continue S03.

### S03 — Roots persistence codec and narrow hosted adapter

- **Deliverable/dependencies:** S01/S02; Roots can start/hydrate through a public host contract with navigation capabilities and committed state output.
- **Areas/tasks:** Roots learning/recorded state, activity props, pure persistence codec, public exports and portable tests. Dedicated hydrate constructor; validate completion/prediction/evidence; cancel live input; separate events from snapshot and preserve event ID semantics through host envelope. Keep Check/Predict/Reveal/math inside visual.
- **Tests/acceptance:** every reachable stage serialize→hydrate→legal action equivalence; zero events/completions at hydration; inconsistent prediction/root/counters rejected before reducer; existing math/input/retrieval tests unchanged. No CSS responsive changes.
- **Manual:** relevant real view render; existing overflow/non-drag limitations recorded.
- **Commit:** `feat: add restorable Roots and Factors host adapter`.
- **Rollback/continue:** legacy lab mount remains compatible; new adapter can be disabled. Continue S04.

### S04 — Early card preview, full-screen host and origin return

- **Deliverable/dependencies:** S02/S03; internal real card fixture with attached Roots visual, automatically generated inert preview, host opening/controls/content bounds, controlled restore and exact Close return.
- **Areas/tasks:** proposed InteractiveVisualHost, host/media layout builders, registry loader, preview tooling/assets, minimal StepView/FocusedCardView hook, development-only responsive mock. Define persistence service interface now; internal local adapter clearly reports local/pending, never durable Saved. Production host execution remains gated until S07/S14.
- **Tests/acceptance:** preview emits zero attempt/events/network persistence; Open creates/restores only once; Close preserves selected tab/step/focus; host Next bottom-right and controls contained at 320px; mock receives correct content bounds; no mathematical controls in host; same adapter used later with DB service.
- **Manual:** inspect actual initial/stage renders and host/mock at desktop/phone viewport. Real visual overflow reported without CSS redesign.
- **Commit:** `feat: host interactive visual previews from card steps`.
- **Rollback/continue:** flag off host; keep media data. Continue S05; remove internal persistence adapter from any production execution path by S07.

### S05 — Integration restoration and hosting

- **Deliverable/dependencies:** S03/S04; seven-stage Integration uses same host contract with its own navigation/math.
- **Areas/tasks:** Integration panel projector, state codec, activity component and notifications; public adapter export. Include current attempt evidence, unchecked draft, panel stacks and semantic animation state; disable targeted scrolling only in hosted lifecycle; suppress duplicate generic controls without altering educational controls.
- **Tests/acceptance:** all stages/functions/subsections/hints/check states round trip; unfinished animation cannot fabricate demonstrated event; no attempt-started on hydrate, no reused persisted event IDs; stage-7 empty/invalid/correct/incorrect rules unchanged; Next/Previous restore panel state and browser Enter does not dispatch Check accidentally.
- **Manual:** inspect meaningful stage states, record 700px/keyboard limits separately.
- **Commit:** `feat: restore Integration state through the visual host`.
- **Rollback/continue:** registry availability isolates adapter; preserve snapshots. Continue S06.

### S06 — Database record, attempt, event and snapshot integrity

- **Deliverable/dependencies:** S03/S05; common account/guest-principal repository, explicit indexes, idempotent open/new-attempt primitives and event append plus snapshot CAS.
- **Areas/tasks:** proposed `lib/visualLearningRecords/{contracts,validation,repository}` and setup dry-run script; use injected Db/client with current transaction helper. Implement owner resolution, bounded visits, unique events/hash check, last accepted write marker, active summary checks; no auth cookie code in pure repository.
- **Tests/acceptance:** disposable replica-set tests: same learner/visual through two cards gives one record; duplicate open one first attempt; duplicate exact write one snapshot revision; changed same-ID payload rejected; stale snapshot never overwrites; distinct events retained/acknowledged; snapshot-only lost response retry; transaction abort leaves valid atomic state; unauthorized principal denied; immutable prior attempts retained.
- **Manual/regression:** verify tests cannot connect to Atlas; dry-run setup only. No live indices.
- **Commit:** `feat: persist visual learning records with revision checks`.
- **Rollback/continue:** additive collections, disable new writes without data deletion. Continue S07; if DB tests cannot run record integration gap and do independent client work without marking repository verified.

### S07 — Account API, durable outbox and truthful autosave

- **Deliverable/dependencies:** S06; signed-in end-to-end DB restore and IndexedDB retry, replacing controlled internal persistence.
- **Areas/tasks:** visual session/current/batch routes, client transport/service, outbox/session coordinator, host status. Bind actor, source and version; add origin/body limits. Serialize local sender; event+snapshot atomic local storage; coalesce only snapshots; pending/saved/error/conflict indicators.
- **Tests/acceptance:** real local API/DB plus browser: reload resumes DB state; disconnect/edit/reload/reconnect retains history; drop request vs response; older ack cannot clear newer state; quota failure no false Saved; account switch cannot send old queue; stale server revision preserves local candidate and reports conflict; no login bypass or personal-data cache.
- **Manual:** inspect small nonblocking status; no physical phone success claimed.
- **Commit:** `feat: autosave visual state with a durable offline outbox`.
- **Rollback/continue:** preserve queues and compatible readers; disable new opens if write service unavailable. Continue S08.

S07 execution boundaries (refined after S06):

- **S07a — authenticated API and source boundary.** Depends on S06. Add gated open/current/batch/new-attempt HTTP handlers, explicit principal header binding, same-origin/body limits, no-store DTOs and stored card/framework source verification. Test with injected authentication and disposable repositories: forged source, other account, mismatched viewer, private-version access, malformed/oversized body, idempotent responses and disabled flag. Acceptance: APIs reject untrusted context and preserve repository acknowledgements; production host remains disabled. Suggested commit `feat: authorize Visual Learning Records API requests`. Rollback: disable server feature gate, retain collections. Continue automatically to S07b after tests/diff review/handoff.
- **S07b — durable client queue and host integration.** Depends on S07a. Implement IndexedDB atomic event/snapshot acceptance, stable transport UUIDs, serialized frozen requests, snapshot coalescing, reconnect retry, local pending/conflict state and account partitioning. Connect account host only behind the settled feature gate. Run the S07 browser/API scenarios above, including actual reload and disconnect. Acceptance: newest state and all event acknowledgements required for Saved, no account retargeting, no data loss on retries. Suggested commit remains `feat: autosave visual state with a durable offline outbox`. Rollback preserves pending queues; continue S08 automatically when verified.

### S08 — Same-attempt navigation and explicit new attempts

- **Deliverable/dependencies:** S03/S05/S07; Back to Start retains stage work/history, completed attempts editable, Stage 1 confirmed Start New Attempt.
- **Areas/tasks:** activity-owned stage memories/transitions, generic host capabilities/confirmation, explicit command endpoint/outbox dependency. Roots restores valid orientation state and retains subsequent work; Integration unlocks navigation while keeping completion history. No new generic stage arithmetic.
- **Tests/acceptance:** same attemptId after Back; prior drafts/answers/checks retained; later changes invalidate relevant current feedback without erasing evidence; new attempt only after confirmed command; Cancel/double tap/retry/offline command creates exactly one; old attempt remains; subsequent completion updates summary without duplicate identity; card completion untouched.
- **Manual:** keyboard confirmation/focus and generic control placement; Check/Reveal/Predict remain visual-local.
- **Commit:** `feat: preserve visual attempts across return to start`.
- **Rollback/continue:** disable new command if needed, retain data/old attempts. Continue S09.

S08 execution boundaries (refined after durable queue verification):

- **S08a — same-attempt return.** Depends on S07. Add activity-owned Back to Start and retained forward state, global evidence independent of earlier-stage presentation, no completion replay and no card-step mutation. Test repeated completions, changed-answer invalidation, hydrate after return and the real host control. Commit `feat: retain visual work when returning to start`. Continue automatically after relevant tests, diff review and handoff.
- **S08b — explicit new attempts.** Depends on S08a. Add Stage1 secondary confirmation and persist one command/attempt ID before new state/events. Atomically archive a pending prior local row and install the new current row plus command; keep predecessor work in separate local rows, serialize registration/batches and retain server histories. Test cancel, double click, lost response, offline confirmation/reload/reconnect, old attempt retention and concurrent active conflict. Commit `feat: create confirmed visual attempts with durable commands`. Saved requires command acknowledgement as well as events/snapshot. Rollback hides the control while preserving rows and commands. Continue S09 automatically when verified.

### S09 — Current release adoption and safe recovery

- **Deliverable/dependencies:** S06–S08; compatible resume, validated migration checkpoints, retired/disabled/missing handling and incompatible explicit recovery.
- **Areas/tasks:** registry policy, codec migration dispatch, open/ingest validation, host unavailable/recovery state. Keep old event schemas ingestible when safe; do not run old code to verify outcome. No DB publication pointer/catalogue API.
- **Tests/acceptance:** next open resolves current for all card references; compatible same attempt; migration retry once; incompatible/corrupt snapshot preserved, no auto reset; old client cannot install unknown state; emergency disable blocks new execution; rollback cannot corrupt newer snapshot.
- **Manual:** inspect recovery text/action and ensure it reuses explicit confirmation semantics.
- **Commit:** `feat: handle visual release compatibility and recovery`.
- **Rollback/continue:** current release/availability changes never delete data. Continue S10.

S09 execution boundaries (refined during restore validation):

- **S09a — validated restore and safe shell.** Completed internal checkpoint: withhold incompatible/corrupt state from execution; preserve historical attempts; confirmed fresh-attempt recovery; render failure containment and emergency disable; old-client metadata checks. Include first-snapshot Saved race and basic local revision checks. No compatible cross-release migration is claimed by this increment.
- **S09b — migrations and pending recovery.** Required before S09 exits. Register immutable known codecs and explicit activity-owned migration functions; validate identity and event sequence, checkpoint conversions once and retain historical release metadata. Preserve exact frozen requests and old-version meaningful events while installing a compatible new-version candidate under a revision check. An unsafe restore with pending local work needs a bounded owner-only history/checkpoint backup before confirmed new-attempt registration; never deadlock on a predecessor that ordinary writes rightly reject. Unrecognized raw legacy state may be preserved as non-executable history only, never auto-graded, rendered or called a normal saved active snapshot. Test synthetic injected migrations without publishing a fake curriculum release, retry/double-open, offline candidate upgrade, pending/corrupt recovery, rollback and genuine stale revisions. Commit `feat: checkpoint visual migrations and recovery history`. Continue automatically to S10 once tests/diff review/handoff pass. Production rollout remains gated until this increment and later hardening are complete.

### S10 — Creator multimedia management using existing draft lanes

- **Deliverable/dependencies:** S02/S09; existing header/step controls manage up to four videos/images/visuals.
- **Areas/tasks:** CreatorMediaUploadSlot, CreatorDragLab, coordinator/board adapters, modal/layout helpers, existing upload client. Add selector, labels/order/remove/replace; actual combined label measurement at 320px; direct valid-draft edits; upload reservations/abort/generation/proofs; processing status via attached draft.
- **Tests/acceptance:** zero/one/four/fifth denial, wide/Unicode/invalid labels, same-type order, failed replacement keeps prior media, pending cap, late completion after actor/card change rejected, fork first upload proof, reload draft, published content unchanged until publish, no extra modal Apply/Cancel transaction.
- **Manual:** actual modal keyboard/focus/gesture isolation at 320px and desktop. Live upload remains provider gate; controlled tests do not prove CORS.
- **Commit:** `feat: manage step multimedia through creator drafts`.
- **Rollback/continue:** disable new modal edits, retain modern reader. Continue S11.

S10 execution notes: creator uses the existing actor-bound coordinator and one pending upload per destination; valid metadata edits enter its draft lane immediately. The native modal has an explicit original focus target, including through foreign-card confirmation. Failed replacements preserve prior items; a sign-in change after transfer prevents attachment. The shared label probe measures required browser-rendered widths before flex growth (WebKit otherwise rounds three expanded thirds beyond the nominal width). The learner's focused card is a252px authored baseline scaled to the viewport: use a conservative250px physical label budget at a normal320px viewport, and S11 must supply the shared `--step-media-scale` so14px visible typography stays stable. Verify the actual learner geometry before enabling multimedia; creator-only success does not prove Step View fit.

### S11 — Complete mixed-media learner presentation

- **Deliverable/dependencies:** S04/S09/S10; all four destinations render 0/1/2–4 mixed/repeated media and correct origin semantics.
- **Areas/tasks:** StepView, FocusedCardView, media-region layout/controller, thumbnail/preparation selectors. First-tab reset on real entry, retain on overlay Close, stable attachment selection; images stay embedded; activity stays preview-only; Introduction projection always first video.
- **Tests/acceptance:** full combination matrix, repeated IDs/types, step reentry, overlay return, text/pouch/completion unchanged, no one-item tabs, video-only front/no front thumbnail without video, unavailable visual does not block outer navigation.
- **Manual:** inspect actual card front and Step View comparison to legacy, narrow label row.
- **Commit:** `feat: present ordered mixed media in Step View`.
- **Rollback/continue:** compatible renderer retained for stored arrays; no destructive flatten. Continue S12.

S11 execution boundaries:

- **S11a — account-scoped durable Card entry.** Depends on S09/S10. Add a cancellable effect-owned records provider across focused Cards in a Deck, preserve the internal explicit persistence override, carry the actual canonical/adopted Deck version and connect the existing first-attachment preview to real persistence. No tab/video source changes in this checkpoint. Files: `VisualLearningRecordsProvider`, `DeckScene`, `FocusedCardView`, `InteractiveVisualPreview`; browser fixtures use real private disposable records. Acceptance: inert previews create no attempt; working Cards share one record; close returns to the same step; canonical context uses the real Deck version; no visual interaction ticks Card steps or creates personal state in canonical mode; account unmount disposes its service. Run real Chromium/WebKit entry tests, records regressions and existing video tests. Commit `feat: connect Card visual entries to durable records`. No migration; rollback removes public wiring while retaining records. Continue automatically to S13a.
- **S11b — ordered mixed-media selection.** Depends on S11a and the S13a secure image boundary. Implement selected attachment identity, accessible 2–4 tabs, no one-item tabs, first-item reset on real entry, stable close return, all-media preparation and exact first-video Introduction projection. Supply actual focused-card scale to shared label typography and verify physical bounds at320px. Tab navigation must invoke the existing video source path synchronously and clear continuation on non-video sources; S12 adds session position and expansion without changing the approved source rule. Test complete type/order/entry matrix plus legacy paused/ended/stalled/rapid navigation, image error, missing visual and exact origin. Commit `feat: present ordered mixed media in Step View`. No destructive migration; compatible reader remains necessary for stored arrays. Continue automatically to S12 only after relevant tests and diff/handoff checks.

### S12 — Preserve HLS continuation, session position and expansion

S11b execution evidence: the ordered learner renderer now uses stable attachment IDs and a shared synchronous source transition for tabs and outer navigation. Zero/one-item surfaces retain their prior structure. Selection resets only on genuine step entry; full-screen visual Close retains the selected tab and focus. The existing decoded frame remains visible when the next attachment shares its source. Preparation includes each destination's first video plus the selected item's immediate neighbours, deduplicated to at most seven sources, while single-media navigation retains its original preparation-pool identity. Real320px geometry validates readable14px tab text; images use only the exact-context endpoint, still production-gated by Q14. Session positions/expansion remain S12/S13b, and no physical iPhone result is inferred from WebKit tests.

- **Deliverable/dependencies:** S11 and baseline S01; video tabs/steps preserve existing chain and position with approved expansion wiring.
- **Areas/tasks:** FocusedCardView navigation, CloudflareHlsVideoPlayer narrow getter/startAt, session map, existing expansion callbacks. Preserve native controls, poster pipeline, protected grant and pause/source guards. No new async hop before loadMedia invocation.
- **Tests/acceptance:** host-driven play/pause/ended/stalled/rapid-next in both protected/direct modes; nonvideo breaks chain; blocked Play; pause while grant waits; seek after metadata; stale source/grant/frame/seek ignored; no background sound; same element during video-to-video and expansion; fresh visit may reset.
- **Manual:** physical iPhone sound/Next/tabs/native+custom fullscreen and grant-delay matrix required before production. If unavailable record exact steps and continue S13–S16; no fallback silently enabled.
- **Commit:** `feat: retain video sessions across step media transitions`.
- **Rollback/continue:** retain legacy continuation path, disable affected new affordance if a proven regression cannot be fixed. Continue independent slices; release blocked by known regressions.

### S13 — Exact-context instructional image access and expansion

S12 execution evidence: optional startAt/getPosition extend the existing player, not a replacement controller. Session memory is bounded256 and keyed by actor/Card/destination/attachment/source fingerprint; successful sign-out clears it. Capture occurs before reset and genuine Card unmount. Pending authorization/seek has no usable getter value, preventing zero from replacing prior progress. Source-generation guarded metadata/seek/frame listeners restore nonzero time before uncovering a new source. Identical sources in distinct attachment slots use explicit restoration while ordinary prop reconciliation remains a no-op; outgoing layout cleanup cannot overwrite another slot. Approved expansion preserves native controls, original geometry, the element, position and playback, with focus/background isolation. Browser-blocked/error intent stops the chain; ended/stalled/rapid-Next continues. Real Chromium/WebKit decoded-frame tests pass, but physical iPhone sound/cold-grant/native-fullscreen testing remains mandatory and unperformed. No autoplay fallback, mathematical layout repair or cross-visit position storage was introduced.

- **Deliverable/dependencies:** S13a depends on S02/S09 and precedes S11b; S13b depends on S11b. Embedded/expanded images use authorized exact context without global version scans.
- **Areas/tasks:** new narrow route/service modeled on authorizeCardPlayback, trusted attachment lookup and existing protected image renderer/fit primitive. Reuse actor-scoped decoded/object URL during mounted session, revoke on account change/unmount. No gallery or download UI added.
- **Tests/acceptance:** current accessible card/version/attachment allowed; foreign, private-era, cross-version substitution, arbitrary URL/key and Info Card asset denied; opening tab remains embedded; explicit expansion returns exact origin; cached bytes cannot be selected by another actor; source failure leaves step navigation usable.
- **Manual:** provider origin/CORS/security not changed; document release audit and real upload/download checks relevant to existing flows.
- **Commit:** `feat: authorize instructional images by card context`.
- **Rollback/continue:** disable new image entry if needed, preserve references and old routes. Continue S14.

- **S13a — exact image delivery foundation (ordered before S11b).** Proposed modules: `src/lib/instructionalImages.ts`, `src/app/api/media/instructional-image/route.ts`. Provide the narrow immutable card/version/mode/deck/destination/attachment request contract, actor-bound authorization, trusted R2 lookup and bounded private response. Reuse `readProtectedImage`; never fetch an arbitrary client URL or scan unrelated versions. Tests cover accessible working/canonical context, private-era/foreign/cross-deck/version/attachment substitutions, Info Card assets, unsupported origin/type, missing bytes and unauthenticated/actor-switched requests. No gallery, caching UI, guest-card access, live provider changes or schema migration. Commit `feat: authorize instructional images by card context`. Entry: current canonical media contracts; exit: real disposable authorization and injectable delivery tests, reviewed errors/cache headers and handoff. Rollback disables the new endpoint without deleting assets. Automatic continuation to S11b.
- **S13b — image expansion and mounted-session byte reuse.** After embedded tabs work, reuse the exact-context URL/owned decoded resource for explicit optional expansion, preserve origin/tab/focus and revoke cached resources on account/unmount. The image tab itself stays embedded. Test failure/retry, source change, actor isolation and close behavior on narrow/desktop viewports. Commit `feat: expand instructional images with origin-aware return`. Continue S14 after the common gate; provider/device/privacy release checks remain outstanding.

S13a security boundary: exact context reuses the existing consultation/working-card resolver and immutable Deck access; it rejects personal `user-cards`/`user-decks` namespaces and registered Info Card assets before provider access. Production delivery requires both `SWITCHPLAY_PLUGGED_IN_VISUALS=1` and `INSTRUCTIONAL_IMAGES_PRIVATE_MEDIA_VERIFIED=1`; the latter must remain unset until Q14 is resolved. Only the owned disposable runner supplies it for local fixture bytes. Byte handling accepts raster formats only, caps actual data at10MiB rather than trusting Content-Length, and retains one of four process-local slots until the response drains/cancels/aborts. It has a15s provider/read timeout and bounded per-account request budget; these are not fleet-wide abuse controls. No production flag or provider policy was changed.

### S14 — Guest credential and shared DB persistence

S13b execution evidence: optional native-modal image expansion reuses the existing fit/zoom renderer and expansion icon, without gallery navigation/download controls. Selection stays embedded and return preserves tab/focus. Actor/Card/version ownership encloses exact-context object URLs; the byte store retains at most two idle entries/12MiB, admits at most four leases and caps each response at10MiB actual raster bytes. Abort/timeout/retry and revocation on scope/unmount are explicit; no raw-provider or persistent/public cache exists. Browser decoded-memory overhead and already-delivered-byte revocation limitations remain. Chromium/WebKit real-endpoint journeys verify reuse, close/revoke,403 retry and320px bounds. Q14 still blocks production delivery; no privacy policy, provenance registry or provider configuration was changed.

- **Deliverable/dependencies:** S06/S07; accessible visual can establish pseudonymous guest and use identical record/attempt service.
- **Areas/tasks:** guest cookie/hash service, principal resolver, bootstrap/access route, expiry/rate limits and explicit status validation. Bind outbox to opaque principal; no users-directory entries. Local test/config fixtures only.
- **Tests/acceptance:** no-cookie bootstrap then persisted return; no start login; expiry/lost/forged token denied appropriately; guessed guest/attempt ID not auth; 90-day sliding inactivity calculation; ordinary account behavior unchanged; no guest card/media privileges; CSRF/limits and test-only DB assertions.
- **Manual:** production HTTPS/cookie and retention/privacy tasks remain operational review.
- **Commit:** `feat: persist guest visual learning records securely`.
- **Rollback/continue:** disable new issuance without deleting valid guest work. Continue S15.

### S15 — Non-destructive guest-to-account claim

S14 execution evidence: guest credentials now use256-bit opaque secrets, hash-only MongoDB storage, HttpOnly production Secure `__Host-` cookies and provisional90-day sliding inactivity. The same APIs/repository/outbox serve guests; explicit guest-bound requests remain so after sign-in. Active/expiry is rechecked and touched inside each record transaction, serializing against later claim without leases/epochs. No users/CardData/DeckData guest alternative exists. Bootstrap is same-origin/body/availability checked and coalesces in-flight browser issuance, including development Strict Mode. Additive guest indexes have no TTL; coordinated retention/privacy/HTTPS/fleet abuse review remains outstanding. Process-local issuance/bootstrap/credential-verification/per-principal limits do not establish fleet-wide protection. Real disposable Chromium/WebKit guest and account regressions pass; public entry/claim remain unimplemented at this checkpoint.

- **Deliverable/dependencies:** S14; all guest/account attempts retained, foreground guest continues, stable event IDs and resumable claim.
- **Areas/tasks:** claim repository/route, existing auth-success integration point, outbox rebinding and receipt recovery. Per-record transactions reparent attempts; serialize ownership mutation; preserve provenance; no aliases/epochs or per-event owner rewrites.
- **Tests/acceptance:** existing account active+older attempts and guest multiple attempts all retained; nearly-empty foreground guest wins; other account active stays; duplicate/lost response no repeated active reset; in-flight guest write cannot cross claim without ownership recheck; already-claimed token denied; wrong account/forged IDs; partial claim retry; late queued event dedupes under account.
- **Manual:** inspect existing sign-in return behavior; no signup flow.
- **Commit:** `feat: claim guest visual attempts without losing history`.
- **Rollback/continue:** never unclaim or duplicate histories; keep compatible ownership reader. Continue S16.

S15 queue ordering clarification: finish registration of already-confirmed guest attempt commands before the server freezes the guest for claim. A signed-in account cookie must not implicitly retarget an explicitly guest-bound request with a still-valid guest credential. Reparent registered attempts with their existing numbers/IDs; account aggregate attempt counts cannot be substituted into already-created guest snapshots. Include multiple offline attempts plus existing account attempts in claim/retry tests. This is sequencing within the approved common record architecture, not concurrent-device reconciliation.

S15 execution subdivisions (sequential, cohesive review boundaries):

- **S15a — server ownership claim and future attempt allocation.** Depends on S14. Deliver authenticated same-origin claim with both identities, stable claim ID and foreground attempt, resumable per-record transactions and immutable results. Inspect/change `guestCredentials`, records model/repository/API, proposed `guestClaims`/claim route, session DTO and client next-attempt allocation. First define a server-supplied next-attempt number independent of the historical active attempt number; preserve all original guest/account snapshots/event payloads even when their local historical attempt numbers overlap. Then freeze active guest issuance/writes, transfer ownership/reparent attempts without event rewriting or redirect aliases, preserve nonforeground account pointers, and activate the foreground guest exactly once. Keep historical roots/audit evidence without deleting user history. Tests: existing account active/older attempts plus several guest attempts, empty/nonforeground cases, wrong credentials/account/source, lost response/retry after a later new attempt, failure between record transfers, revocation races and next offline attempt numbering. Acceptance: no lost/duplicated history, immutable IDs/snapshots/numbers, exact retry result, correct new allocation and no stale guest writer. Manual diff/security review plus shared automated gate; no extra user gate for settled semantics. Commit `feat: claim guest visual records without losing attempts`. Rollback disables new claims while preserving completed ownership and compatible readers. Continue automatically to S15b after passing tests; no public claim UI yet.
- **S15b — drained local queues and atomic claim handoff.** Depends on S15a. Deliver a common-client claim operation that first drains all guest snapshots/events/checkpoints/visits and confirmed new-attempt commands, persists claim identity before network mutation, recovers a lost result, then atomically rebinds owned local rows to the account using the verified mapping. Inspect/change common `client`, `browserStore`, `outbox` and proposed claim-client helpers; reuse the internal review probe for browser proof. Preserve any existing account pending row by archiving its attempt before installing foreground guest progress, including when account work has not uploaded; never overwrite a queue. Store no guest secret in JavaScript. Tests: offline multiple attempts, account pending histories, lost claim response/reload, partial server completion, IndexedDB abort at each transition, stale account change, failed login, exact IDs and subsequent new attempt. Acceptance: no false Saved, no duplicate events or lost account/guest work, foreground guest resumes after sign-in; guest queue remains bound until server claim and local handoff are acknowledged. Manual diff review and common automated gate. Commit `feat: preserve pending visual work through account claim`. No destructive migration or unclaim rollback; retain pending journals and disable new handoffs if needed. Continue automatically to S16, which connects the existing sign-in return flow and approved contextual invitation. This split adds no new product interface.

### S16 — Minimal guest entry and contextual sign-in return

- **Deliverable/dependencies:** S09/S14/S15; production route for allowed visual IDs with same host, meaningful-progress invitation and preserved foreground state.
- **Areas/tasks:** minimal route/page, host/session service, existing auth UI/return binding, approved direct origin. No lab diagnostics, published mock, catalogue, Progress menu or demo deck access.
- **Tests/acceptance:** direct guest starts without login and persists; invitation absent initially/present after milestone; sign-in existing account returns same guest attempt; failed login keeps work; invalid/retired/disabled policy correct; arbitrary return URL denied; card-host and direct-host share learner record.
- **Manual:** full anonymous-to-account local journey; physical Safari pending as documented.
- **Commit:** `feat: open interactive visuals with guest continuity`.
- **Rollback/continue:** disable new public entry while preserving ownership and records. Continue S17.

### S17 — Integrated hardening and resumable delivery

- **Deliverable/dependencies:** all core slices; tested integrated implementation, operational checklist and accurate handoff.
- **Areas/tasks:** complete T01–T19, scoped lint/typecheck/build using safe local environment, fixture performance/limits, cross-card and claim end-to-end, rollback drill against disposable records, source/diff/scope review and no-prod/mock leak checks.
- **Tests/acceptance:** all supported automated gates pass or explicitly classified pre-existing/environment limitations; no known card/upload/math regression; no false Saved; unique histories; required Framework support; original source docs unchanged; all intended files committed. Verify no forbidden concurrency or responsive-maths implementation slipped in.
- **Manual:** give exact physical iPhone/provider/privacy/live-index tasks; record unperformed checks and resulting production-readiness limitation. Do not deploy or push.
- **Commit:** `test: harden plugged-in visual journeys and recovery`, followed by intentional documentation checkpoint if needed.
- **Rollback/continue:** last verified compatible commit retained; report implementation complete only to the degree evidenced. No automatic P8 or provider operation.

## 12. Verification, worked traces and operational risks

### 12.1 Evidence ledger and runnable baselines

Original planning investigation ran **29/29 Node tests** (card playback grants/thumbnails, published-video preparation, update adoption, creator step characterization) and **157/157 pure Step Visual tests**. Those results are historical and cover old restart semantics; they are not new implementation acceptance. Claude ran no tests. Actual current runs and failures belong in the handoff per commit.

Relevant commands, after checking current scripts and disposable environment:

```sh
node --import tsx --test tests/card-playback-grants.test.ts tests/card-video-thumbnails.test.ts tests/published-video-preparation.test.ts tests/update-adoption.test.ts tests/creator-step-characterisation.test.ts tests/deck-intro-preview.test.ts
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure --output=/private/tmp/plugged-in-pure-tests
```

Use existing Playwright configurations and Node tests, not a new framework. Typecheck/build must not race generated Next types or disturb another server. No `.env.local` production database test writes; test harness uses disposable replica set with explicit local assertion. New API integration tests should inject repositories/services rather than need live credentials. Browser controlled-media tests document their mocked boundary; real decoder fixtures and native iPhone are distinct evidence. Generate and actually inspect meaningful screenshots when available.

### 12.2 Validation matrix

| Test | Required positive and negative assertions | Slices |
| --- | --- | --- |
| T01 legacy | 0/1 media Intro/three steps, draft/published/working/canonical, no tabs, empty catalogue, unchanged fields and front | S01–02,S11 |
| T02 collections | 1/2/3/4 mixed/repeated types, repeated activity/asset, first-item order, embedded image, inert visual | S02,S10–11 |
| T03 labels | 320/360/375/390/430/desktop, defaults, wide/Unicode/combining, whitespace/newline/long, combined fit, invalid edit not saved, pending cap | S02,S10–11 |
| T04 selection | step exit/reentry first tab; overlay Close same tab; same-tab no-op; version/attachment removal safe; outer navigation unchanged | S04,S11 |
| T05 preview | generated current initial state, no attempt/events/record read, unavailable asset/visual, no live reduced activity | S04–05,S09 |
| T06 fullscreen | card/direct origin, Escape/focus, image explicit open, same video element expansion, native exit, no underlying input/play | S04,S11–13,S16 |
| T07 autoplay | play/pause/ended/stalled/rapid loading chain, tabs and steps, nonvideo break, blocked/error, both flag modes | S01,S12 |
| T08 positions/races | nonzero seek, before metadata, delayed grant/frame/play, pause while awaiting, source replacement, duplicate asset slots, fresh visit/account reset | S12 |
| T09 thumbnail | video alone/after image/several videos first in order; image/visual-only no thumbnail; no main-step thumbnail; portrait/poster unchanged | S02,S11–12 |
| T10 independence | media edit/publish/adopt and activity complete/reference removal do not reset/tick card or delete records | S02,S06,S08,S10–11 |
| T11 creator | failed/cancelled/processing upload, stale actor/destination, fork proofs/cap, old client save, roundtrip arrays, draft-only publication, no provider deletion | S02,S10 |
| T12 restore | each reachable stage/help/panel/draft, dedicated hydrate zero events, invalid cross-fields rejected, same record across cards, DB reload/new device sequential use | S03–S07 |
| T13 attempts | same ID and prior work Back to Start, completion edits, explicit confirm/cancel/retry/offline new command, historical retention, unchanged math gates | S08 |
| T14 release | newest metadata, compatible migration/retry/checkpoint, incompatible/corrupt recovery, old client, retire/disable/missing, safe rollback | S09 |
| T15 offline | local atomic persistence, disconnect/reload/retry, dropped response, snapshot-only retry, duplicate payload mismatch, stale CAS local preservation, quota, no false Saved | S06–S08 |
| T16 guest | token return/loss/expiry, DB state, contextual sign-in, existing histories, foreground guest continuation, late batch/claim retry/account change | S14–S16 |
| T17 auth/privacy | IDOR, forged asset/source/claim, cross-account and Info Card exclusions, CSRF, bounds/rate limits, logs, coordinated retention dry run | S06–S07,S13–S16 |
| T18 Framework | empty and independent interactiveVisualIds, invalid/duplicate IDs, known stable registry IDs, existing Progress maths unchanged | S01,S17 |
| T19 host/device | mock verifies host safe regions and bottom-right Next at 320px/resizes; keyboard/focus/status; real visuals function with documented overflow; iPhone autoplay/fullscreen/sound | S04–S05,S12,S17 |
| T20 future demo | designated/revoked exact deck/card/media scope, normal guest progress and journey, non-destructive ordinary-progress claim | Future P8 only |

Specification acceptance mapping: 1→T01/T07/T08; 2→T01/T02/T05; 3→T02/T03; 4→T03/T04/T10; 5→T04/T12; 6→T05/T06; 7→T07/T08; 8→T08; 9→T09; 10→T01/T11; 11→T10/T13; 12→T12; 13→T13; 14→T15; 15→T12/T18; 16→T14; 17→T16/T17; 18→T20 deferred; 19→T06/T08/T19 with the owner's explicit host-versus-existing-visual layout scope override. No test may require repairing existing mathematical responsiveness in this project.

### 12.3 Worked trace A — account, videos, Integration and later return

A learner opens a legacy one-video card: normalization changes no stored fields or appearance. Play→Next continues; paused→Next pauses; ended/stall/rapid Next retain established continuation. Moving to an image-first mixed Introduction selects the image while the front still uses its first video poster. Video tab stays paused after the image; two video tabs continue only on the unbroken intent chain. Selecting Integration captures video position and clears playback.

The preview emits nothing. Open validates exact card/source and finds the learner/Integration record, creates a visit and hydrates active attempt. A boundary commit creates one event; unchecked answer text changes snapshot without a Check event. A lost save response retries exact writeId/body, acknowledges unique events and the same snapshot revision. A new local edit during retry remains pending.

Close leaves attempt alive and returns the exact visual tab; navigation never ticks card completion. Days later another card referencing Integration opens the same active attempt from DB and a new contextual visit. Video positions can reset on the new visit. A compatible compiled release resumes/migrates with preserved checkpoint; incompatible release retains history and requires explicit new-attempt confirmation. A stale second device receives conflict, retains local pending state and cannot overwrite current server state. This path exercises boundaries rather than assuming that a green reducer test establishes persistence.

### 12.4 Worked trace B — guest offline and account claim

A guest opens the allowed direct entry, receives opaque cookie and DB record/attempt/visit without login. Unknown first open offline cannot establish an attempt; after successful open, offline continuation stores meaningful events/latest snapshot locally and shows pending. A response lost before disconnect is retried without duplicate history. A guessed guest ID cannot recover a lost credential.

After meaningful progress the optional sign-in invitation appears. Account already has advanced and older attempts for the same visual. Claim proves both sessions, transfers all guest attempts without event duplication and makes the foreground guest attempt active exactly once. The old account active attempt remains historical, even when the guest attempt is nearly empty, per final owner instruction. Nonforeground account active pointers stay. A late guest request loses authorization after claim; the same queued event IDs can finish under the verified account mapping. A retry never resets active state after a later explicit new attempt.

Future demo context would add verified journey/deck/card/version IDs to visits and join normal guest CardData/DeckData through a separate access resolver. It would not create per-card visual progress. Revoking demo access would block new card/media access while retaining already recorded learner history. That facility and ordinary-progress collision policy are not implemented by these slices.

### 12.5 Device and operational checklist

Physical iPhone: record OS/Safari/build/origin, verify hydrated interaction, then test protected grant-await and direct paths with sound: Intro Play→Next→Next, Pause→Next, ended→Next, stalled→Next, rapid Next/Next, video tabs, video→image/visual→video, nonzero-position return, native/custom fullscreen exit, background/return and late grant after pause. Verify no hidden sound, exact tab return, safe areas and host focus. Test real keyboard in Integration Stage 7 and record overflow without changing its layout. Browser emulation cannot close this gate.

Provider tasks: authorized inventory of Stream signed access and all R2 public aliases; exact scoped grants and foreign/private-era denial; actual browser upload CORS; no bulk flag changes. New public guest entry serves visual code/records only, not restricted card assets. Live index creation, production retention and deployment remain separate approved operator actions.

Performance: one player/visual mounted; no eager 16 manifests/full images; static previews; bounded selected/neighbor preparation. Resume is constant-size current state, history paginated. Measure actual event/snapshot bytes and p95 local save/open/query cost before optimizing. Illustrative volume only: 100 daily learners × 2 sessions × 50 meaningful events = 10,000 events/day; at 1 KiB ≈10 MiB before indexes/replication. 1,000 learners under same assumptions yields ≈100 MiB/day. These are not traffic forecasts or capacity claims. No pointer/frame records.

Observe counts for save failures/conflicts/dedupe, oldest pending age, invalid snapshots, release incompatibility, guest/claim errors, denied access, upload failures and player blocked state using opaque IDs and release metadata, never answers/secrets. Recovery preserves pending queues and event history; restore tests use disposable DB and verify indexes/ownership. No new analytics UI.

### 12.6 Risk register

| Risk | Mitigation / remaining limit |
| --- | --- |
| HLS grant timing/seek/expansion regression | Preserve element and generation guards; host-driven tests; real iPhone release gate, no unapproved fallback |
| Creator reconstruction drops arrays | Canonical/presentation split, roundtrip tests and old-client capability denial |
| False Saved or partial restore | Complete activity codec, atomic local queue, explicit snapshot/event acknowledgements and response-loss tests |
| Hydration crash/duplicate events | Cross-field validation, separate hydrate constructors, host event UUIDs and zero-event restore assertions |
| Same-attempt return loses stage work | Activity-specific retained state and changed-answer tests; no shared lesson reducer |
| Stale device overwrite | CAS and local pending retention; simultaneous editing intentionally unsupported |
| Guest claim crosses identities | Both credentials, server-derived ownership, transaction guard, idempotent reparenting and actor-bound outbox |
| Restricted origin bypass | No guest card-media exposure; provider audit remains release blocker for such exposure |
| Canonical reference lacks upload provenance | Ordinary main Card saves validate media shape rather than file ownership. New image path rejects personal/Info assets and stays behind the separate verification gate; Q14 blocks production image enablement pending canonical provenance/privacy review. |
| Existing visual overflow/accessibility | Explicit owner deferral; host geometry/mock tested separately; no misleading compliance claim |
| Central release breaks references | Immutable metadata, disable policy, compatibility checkpoints and non-destructive recovery |
| Local storage eviction/token loss | Truthful pending state and regular DB autosave; no guarantee for unsynced evicted work |
| Attempt evidence/history size | Separate immutable events, bounded runtime transport and snapshots; no silent trimming |

## 13. Questions, decisions and remaining gates

No original Q1–Q13 or review N1–N6 remains an unanswered prerequisite for starting approved slices. Choices are recorded in §2/§4. Do not re-request routine permission.

Only newly discovered product conflicts or significant safety/data-integrity failures may add a blocking question, with the exact affected slice and smallest alternatives. Currently pending external tasks are physical iPhone verification, production privacy/retention review, provider configuration/provenance audit where relevant, live index/setup execution and deployment approval. These are not permission to perform live operations during autonomous implementation.

### Q14 — MUST RESOLVE BEFORE PRODUCTION INSTRUCTIONAL IMAGE ENABLEMENT

**Finding:** verified source inspection shows `CardRepository.saveCardDraft`, `createCardDraft` and `assertCardContent` validate canonical media shape but do not establish asset ownership. `validateForkAttachments` proves newly added assets on a first foreign fork only; it does not protect ordinary subsequent owned-card writes. The new exact-context resolver proves access to the requesting Card, not the provenance of a file forged into that Card. Personal and Info Card namespaces are now explicitly denied by the new endpoint. If canonical R2 storage contains restricted assets, a forged canonical reference could still amplify access. That last risk is conditional on actual provider policy, which was not inspected live and must not be guessed from a variable named publicBaseUrl.

- **A — narrow canonical provenance foundation plus legacy audit (recommended).** Establish server-owned upload allocation/provenance for future instructional assets, preserve legitimate source inheritance and audit legacy references before enabling restricted byte delivery. This is a security foundation, without a general media picker/refcounts/GC UI. It adds storage and write-path review and needs an approved legacy trust policy.
- **B — explicitly public canonical instructional assets.** Only if the owner deliberately accepts that file bytes remain public independently of Card visibility, verify that actual provider policy and keep personal/Info assets isolated. This is a consequential privacy choice; it is not inferred or implemented here.
- **C — keep instructional image delivery disabled pending a separately approved security scope.** Independent visual/records/guest work continues, but this is not a complete multimedia production release because images are locked core scope.

**Current action:** fail closed with `INSTRUCTIONAL_IMAGES_PRIVATE_MEDIA_VERIFIED` unset in production. The internal S13a foundation and local tests may advance; image production readiness and any provenance/privacy remediation requiring a new architectural scope remain blocked. Do not enable the flag as a substitute for resolving the finding. No original Q1–Q13 is reopened, and no guest Card/media access is added.

Deferred backlog: simultaneous device/tab reconciliation; responsive/accessibility adaptation of Integration/Roots; full history navigation; uploaded-media reuse/GC; catalogue/Progress discovery UI; demo-deck authorization and normal guest CardData/DeckData claim collision policy. A deferred item must not re-enter a core test or completion gate accidentally.

## 14. Stage A completion gate and handoff

Gate checklist before Stage B:

- Authoritative specification and entire original plan/review considered; final decisions consolidated in this document.
- F-01–F-19 and additional recommendations have explicit dispositions.
- Generic host controls/dimensions and visual mathematical ownership are consistent.
- No writer-lease/epoch, server event branch, conflict-tree or semantic-merge subsystem remains in core contracts/tasks/tests.
- No mathematical responsive redesign remains in core scope; host geometry is independently verifiable.
- Framework `interactiveVisualIds` is mandatory S01; Progress calculations unchanged.
- Thumbnail and legacy video preservation are explicit, including ended/stall/rapid navigation.
- Guest uses common records/attempts, foreground claim retained, provisional 90-day inactivity policy recorded.
- Demo decks/general file picker remain excluded; provider/live database actions require separate permission.
- S00–S17 have dependencies, deliverables, files/tasks/tests, objective acceptance, commit subjects, rollback and automatic progression.
- Required branch verified; no existing user work discarded; no new unresolved product question blocks S01.

When consistency/link/diff checks pass, record the result in the handoff, commit S00 and begin S01 automatically. Production release remains unauthorised. The handoff is the authoritative ledger of what has actually been implemented and tested.
