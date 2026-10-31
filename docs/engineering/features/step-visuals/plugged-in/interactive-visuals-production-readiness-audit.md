# Interactive Visuals — production readiness audit

Date: 31 October 2026 (Europe/Dublin). **Read-only audit; no implementation or deployment authorised by this document.**

Inspected `/Users/peterdomokos/projects/step-visuals`, branch `feat/step-visuals-pluggedin`, verified HEAD `774fabb957c1fe3ac481e3d5de10875d952376bf`, tree `33214c4beebf086655a0d6363f76dd3e1ac4d2e3`. Working tree was clean before this audit. Only this Markdown file is added. Local `main` is `cbffc8d`; it does not contain the inspected feature HEAD. Remote/deployed configuration and database contents were not inspected.

## 1. Executive verdict

**Not ready for unrestricted production enablement. Substantially implemented for a controlled authenticated, visual-only trial after deployment preflight and one complete real-user acceptance journey.**

The application already has real creator attachment, draft/publication, Deck delivery, authenticated Visual Learning Records APIs, MongoDB persistence, account isolation and restore. These are not replacements that still need to be built after removing fixtures. The missing evidence is a single production-like creator → published Card/Deck → different learner → later return → independent second learner journey, without direct database seeding or intercepted visual APIs.

The decisive remaining issues are:

1. **Deployment/configuration is unverified.** The feature is on an unmerged local feature branch. The target artifact, flags, approved database, transaction support and new indexes have not been verified. The repository intentionally refuses visual writes when its indexes are missing.
2. **Public runtime exposure is broader than an authenticated trial.** `SWITCHPLAY_PLUGGED_IN_VISUALS=1` also enables anonymous guest issuance/direct entry/claim infrastructure. There is no independent account-only runtime switch. Guest expiry exists, but coordinated retention/deletion and deployment-wide abuse controls remain unfinished release work.
3. **Real uploaded-media security is not closed.** Canonical Card saves validate media shape without generally establishing original upload ownership. The new instructional-image endpoint is correctly gated off pending Q14. The Stream playback path also trusts an authorised stored Card reference rather than an upload allocation. This is an evidenced existing media security gap, not a defect in visual record ownership. A controlled visual-only trial avoids needing new R2/Stream attachments; it does not certify the general multimedia system.
4. **Production-like end-to-end and provider verification remains outstanding.** Subsystem tests are strong, but the phone review used disposable data and mock media. Current Integration presentation is owner-approved on a physical iPhone; that does not establish genuine account-to-account publication, production MongoDB persistence or real HLS behaviour.
5. **Roots has a concrete completion-usability caveat.** Its adapter still ignores supplied dimensions. An existing persistence test explicitly records Check below the900×1100 viewport and uses keyboard activation instead. This proves persistence, not pointer/touch completion. Target-device Roots completion must be verified before certifying both visuals; an inaccessible essential control is not an optional cosmetic improvement. Whether the owner's actual phone is affected remains unverified. [E8,T5]

No evidence warrants changing CardTemplate/CardData semantics, rebuilding the creator, replacing the player, or redesigning the generic host. Existing first-class Card migration is documented as completed on 14 October; **do not rerun that migration for this feature**. Verify the current foundation and add only the separately required Visual Learning Records indexes. [E1–E12]

## 2. Evidence conventions and end-to-end workflow

**Implemented/verified locally** means the production code path has unit, disposable-database integration or browser evidence. **Implemented/real-data unverified** means that path exists but has not been demonstrated in the target deployment with genuine accounts. Test names saying “real” mean real components/API/IndexedDB/Mongo within the disposable harness, not a production acceptance certificate. Historical test-run results below come from the handoff; source inspection alone is not a fresh execution.

| Journey step | Implementation and evidence | Readiness classification |
| --- | --- | --- |
| 1. Authenticated creator opens creation/editing | `/creator/new`, `/creator/edit/[deckTemplateId]` call `getCurrentUser`; edit loads `creatorSessionDTO`. `CreatorDragLab` is the genuine UI despite its historical name. Attachment access does not require `dev`/admin; `canPreviewOutput` is a separate existing preview permission. Runner users are non-admin. | Implemented; real authentication and creator routes exercised with disposable accounts. Target account/UI verification outstanding. [E1,E2,T1] |
| 2. Attach published visual | Existing Introduction/step media links open `CreatorStepMediaModal`. Published catalogue options create `{id,label,kind:"activity",activityId}`; no uploaded visual code or arbitrary visual URL. `editDestinationMedia` updates the normal Card draft lane. Requires both authoring gates. | Implemented; four destinations, ordering, labels, removal and replacement have disposable browser coverage. No fixture-only attachment API is required. [E2,E3,T1] |
| 3. Save and publish | Coordinator sends actor-bound, protocol-versioned requests to `/api/card-templates/[id]`; repository checks ownership/revision, stores drafts and inserts immutable Card versions. Deck publication is separate and pins Card references. A published Card alone does not make its containing unpublished Deck discoverable. | Implemented/locally verified; genuine target publication not verified. Creator media test publishes a Card; it does not by itself prove the entire subsequent Deck/learner journey. [E3,E4,T1] |
| 4. Different learner discovers/adopts Deck | Authenticated Library collection/detail/read models expose permissible published content. `/api/library/decks/[id]/add` validates the reviewed manifest and `addLibraryDeck` establishes membership; targeted working open uses adopted composition. | Genuine production path implemented; Library and visual-entry tests verify its pieces with disposable data. End-to-end from the same UI-created multimedia Deck is not established. Legacy shared-progress APIs return410 and are not a missing visual-sharing feature. [E4,E5,T2,T3] |
| 5. Open visual from Card | `DeckScene` supplies the actual personal data owner/current viewer to `VisualLearningRecordsProvider`. `FocusedCardView` supplies exact Card/version/Deck/step/attachment context. Preview performs read-only existence lookup; activation uses the real session API and compiled registry. | Implemented; working/canonical Card entry verified with actual APIs and disposable Mongo. Phone review demonstrates the seeded entry UI, not independent creator publication. [E6,E7,T3] |
| 6. Interact and navigate | Activity-owned adapters/reducers own mathematics, eligibility and restoration. Host only delegates capabilities. Integration consumes its supplied dimensions; Roots still exposes them as attributes only. | Mathematical behaviour implemented/locally verified; Integration presentation phone-approved. Roots completion-by-touch is only partially verified: existing tests document an offscreen Check and use the keyboard. Verify/fix any supported-target access failure within the visual before claiming both are ready. [E7,E8,T4,T5] |
| 7. Persist learning | Account-scoped service → IndexedDB outbox → `/api/visual-attempts/[id]/batches` → transactional records repository. Guest/account share this architecture. Snapshot and meaningful events are separate from Card/Deck progress. | Genuine DB implementation, not mock persistence. Verified against disposable replica-set Mongo and real browser IndexedDB; target database/indexes/latency unverified. [E9,E10,T5,T6] |
| 8. Close, leave and return | Close requests flush; local queue survives unmount/reload. Recreated account service scans pending rows, retries and opens the active server attempt. No promise that a killed tab transmits unacknowledged work, or that offline device-only work is available on another device. | Implemented; reload, reconnect, lost responses, account resumption and failed storage have fixture-backed coverage. Genuine later-session/cross-device acceptance outstanding. [E9,T5,T6] |
| 9. Restore correct learner state | Server checks principal ownership and snapshot/version compatibility; codecs validate before hydration. Compatible migration infrastructure exists; incompatible state retains history and requires confirmed New. No concrete historical durable migration is currently registered. | Current-release restore implemented/locally verified. Real account reauthentication, production origin/storage behaviour and future release-specific conversions unverified. [E9–E11,T5,T6] |
| 10. Independent second learner | Unique `(principalKey,activityId)` record key; attempt access resolves back to the owned record. Cookie identity must match `X-Visual-Learner`. Provider/queue are account-scoped, not template-owner scoped. | Implemented; repository/API isolation tests pass in disposable environments. Complete two-genuine-learner browser acceptance remains required. [E6,E9,E10,T6] |

**No missing creator-to-record plumbing was found in these ten steps.** The gaps are scoped deployment prerequisites, public-exposure/security work, Roots control-access limitations and composed real-environment verification. [E1–E12]

## 3. Fixture and mock inventory

| Mechanism | Classification and production consequence |
| --- | --- |
| `scripts/test-phase2.ts` creates a MongoMemoryReplSet, disposable users, indexes, flags and a development Next process | Useful test infrastructure; retain. It bypasses real operational provisioning, not repository/API authorisation. Its database is discarded when the owned runner stops. Never point it at production. |
| `scripts/fixtures/plugged-in-review.ts`: `review-roots`, `review-integration`, `review-four-media`, `review-legacy` | Development demonstration data. Uses real create/publish repository methods and DeckData, but bypasses the creator UI and supplies synthetic provider IDs/images. Do not migrate this deck into production as acceptance evidence. |
| `plugged-in-review-server.ts`: secret-path LAN login and local media gateway | Development scaffolding only. Uses the normal login API for its disposable learner and forwards a session cookie. It is outside the production Next route tree. Never expose its auto-login service or fixture password publicly. |
| `PHASE2_MEDIA_FIXTURE_ORIGIN`, `PHASE2_BROWSER_TEST`, `NEXT_PUBLIC_PHASE2_MOCK_MEDIA` | Provider/test overrides. `applicationDatabase.ts` rejects these in production mode. `mediaProviders.fixtureOrigin()` also requires an explicit disposable loopback database/origin. Keep useful tests; clear their deployment settings. |
| `NEXT_PUBLIC_PHASE2_VISUAL_REVIEW` and review-media origin | Development-only transport for three known synthetic video IDs. `phase2VisualReviewMediaUrl` requires development mode and a local/LAN HTTP origin. It does not establish real Stream playback or provider security. |
| `/dev/interactive-visual-host`, responsive/failing mocks, inert preview probes | Development scaffolding, production route calls `notFound()`. No need to replace it with a permanent interface. |
| `createDevelopmentVisualPersistence`; `FocusedCardView.interactiveVisualPersistence` override | In-memory test injection. Normal `DeckScene` does not supply this override; it supplies the account service. Open test card is not durable persistence. Keep the override for tests; do not wire it into normal routes. |
| Development “database review” / guest review | Actual APIs/database with disposable identity. Better persistence evidence than the memory probe; still not real production users, infrastructure or normal creator discovery. |
| `/step-visuals` Visuals Lab | Existing standalone showcase/controller path. It delivers callback/session records to `LearningRecordPreview`; it is **not** the durable Card workflow. It can remain for its established purpose, but must not be cited as proof of production persistence. Durable direct activity entry is `/interactive-visuals/[activityId]`. |
| Two compiled IDs, codecs and local release PNGs | Genuine production release mechanism, not temporary fake registration. Developer-maintained published visuals are the approved model. No database catalogue or runtime programming interface is missing. Preview capture happens during release preparation, not on learner devices. |
| Browser `page.route` failures, mock fetches, memory outbox stores, bundled layout/status fixtures | Useful negative/contract tests. They cannot prove production DB deployment, actual network/provider delivery or physical Safari policy. They are not production API replacements. |
| Phase2 `phase2`/`other` users and headers | Real test sessions use bcrypt/JWT/cookies and real server authorisation. Dependency-injected API unit tests separately substitute authentication; distinguish them. Actor headers bind a request to the cookie principal, never grant identity themselves. |

No localhost/LAN dependency was found in the normal visual persistence/registry paths: requests are same-origin relative APIs and previews are bundled public assets. `allowedDevOrigins` is development-server guidance, not the production visual endpoint configuration. [E1,E6–E9,E12]

## 4. Database, identity and permissions

### Ownership and first-class Card compatibility

```text
CardTemplate root + immutable CardTemplateVersion
  Introduction / three steps -> ordered mediaItems -> stable Interactive Visual ID
DeckTemplateVersion -> references CardTemplate IDs
users.cardsData[CardTemplate ID] / users.decksData[DeckTemplate ID]
  retain the established adopted versions and personal Card/Deck work

authenticated account or pseudonymous guest + Interactive Visual ID
  -> visualRecords -> active attempt + retained visualAttempts
                     -> visualEvents / visualVisits / visualSnapshotCheckpoints
visit source -> Card/Deck/version/step/attachment OR Framework OR direct context
```

Collections: `visualRecords`, `visualAttempts`, `visualEvents`, `visualVisits`, `visualSnapshotCheckpoints`, plus `visualGuests` and `visualGuestClaims`. The offline index plan contains **17 required indexes, 10 unique**, over these seven collections. Visual schema is TypeScript/validated Mongo documents, not a missing Mongoose model. Repository transactions use snapshot read concern/majority write concern. [E9,E10]

The record key is `account:<userId>` or `guest:<guestId>` plus activity ID. CardTemplate/DeckTemplate IDs only contextualise visits. Consequently:

- Same activity in two Cards or two Decks resumes the same learner attempt, including a fork/reused Card retaining that activity ID.
- Another learner receives another principal key and independent records. Template ownership never owns the learner record.
- Copying/reusing a Card preserves the existing shared per-user CardData identity; it neither clones nor resets Visual Learning Records.
- Card forks create their established Card identities/history. Visual progress still follows learner/activity identity; no new fork-specific learning-record entity is needed.
- Publishing, reordering/removing media and completion of a visual do not delete records or tick/reset Card steps. Existing adopted Card versions remain governed by the normal update workflow.

Cross-Card visual sharing and Card reuse each have tests; their entire fork/copy/update/visual combination has not been demonstrated as one genuine-account journey. Do not turn that verification gap into a schema redesign. [E4–E6,E9,T3,T6,T7]

### Server-side permission checks

| Operation | Enforced boundary | Assessment |
| --- | --- | --- |
| Attach/edit/remove reference | `creatorRequestBoundary` authenticates; optional initiating actor header must match; `ownerCard`/revision check; `assertCardContent` and write protocol validation | Implemented. All authenticated creators may reference known published catalogue choices through the real UI. No admin bypass is needed. |
| Publish | Card/Deck ownership, expected revision, publication rules and immutable versions; public Deck reference rules; foreign Card editing uses existing fork/permission machinery | Implemented. Direct client JSON cannot edit another owner's Card. |
| Open from Card | `authorizeVisualSource`: exact immutable/adopted version, current working membership or canonical permission, Deck membership/version, destination/attachment ID and visual ID | Implemented; negative tests cover private-era versions, unrelated Decks and wrong destinations. |
| Read own progress / read-only existence | Feature gate, JWT or guest credential, exact actor header, `ownedRecord`/`ownedAttempt`; no-store responses | Implemented; no identified cross-account progress-read gap. |
| Write progress / New / recovery | Same principal binding; attempt resolves through record ownership; visit belongs to attempt; bounded payload/codecs; revision and idempotency checks | Implemented; no identified progress IDOR. |
| Guest creation/claim | HttpOnly production-secure pseudonymous credential; server stores secret hash; account and guest proofs for claim; transaction-level active/expiry/claim checks | Implemented. Public rollout policy/abuse/lifecycle work remains; see §8. |
| Restricted Card access | Card and Deck root **and immutable-version** visibility; working membership required | Implemented. Source context is never an authorisation token. |

An exact replay of a previously accepted visit is allowed after source removal, but returns only currently owned learner data, not Card content or a new media grant. Later progress writes authorise the owned visual attempt/visit rather than making progress a child of the Card. Published visual code is intentionally globally reusable; legitimate direct access is not a bypass exposing private Card content. Guest Card/Deck access remains denied and the demo facility remains deferred. [E7,E9,E10,T6]

### Save, interruption and concurrency

IndexedDB keeps actor/activity-scoped snapshots, pending meaningful events, frozen requests and visit/attempt commands. Queuing occurs before acknowledgement; saves are coalesced, navigation/completion flush promptly, retries retain IDs/body, and server event hashes reject changed replays. `online`, `pagehide`, Close and service construction provide retry/flush paths. Network calls time out; storage failures remain errors rather than volatile “Saved”. [E9,T5]

Server CAS prevents stale snapshots overwriting newer state; valid distinct history can be retained even when a snapshot conflicts. Concurrent editing is unsupported V1, not silently merged. Pending work stays locally recoverable where possible and conflicts are visible. Sequential devices restore server-acknowledged work; no design can recover an unsent, evicted device queue from another device. Abrupt shutdown/private browsing/storage eviction and shared-browser retention still need real-environment checks. Routine persistence is now silent at the host presentation boundary only; internal state and genuine errors remain intact. [E8–E10,T4–T6]

Version restore validates snapshots before mounting code. Incompatible attempts/events remain retained with explicit, confirmed New recovery. `compiledVisualMigrations` is currently empty because these are the first durable formats; future release converters and historical codecs must be supplied and tested when needed. Generic migration tests with injected converters do not mean a future real converter already exists. [E11,T6]

**Current recovery-test caveat:** `tests/phase2/visual-records.browser.ts` still asserts a visible footer `pending backup` message in its pending recovery scenario. Commit774fabb deliberately filters the corresponding routine `Previous attempt pending backup` status, so this assertion is inconsistent with current approved UI and needs maintenance using internal status/outbox evidence. Do not restore the unwanted notification to satisfy the test. A related **source-level risk, not a newly reproduced runtime failure**, is that `client.ts:label` chooses recovery backup labels before consulting its transport-error map. Because that routine label is now hidden, verify that a genuine recovery-backup transport/storage failure still reaches existing actionable error feedback. Generic injected error-message UI tests alone do not prove that full path. No recovery/persistence change is implemented by this audit.

## 5. Publishing and media assessment

**Visual references:** real draft/publication workflow is implemented, including max-four ordered media, short labels, exact IDs, legacy one-media reads, immutable publications and old-writer rejection. Removing an attachment updates Card content only. Registry resolution is explicit/lazy, includes both actual visuals and has no arbitrary external visual loading. Runtime emergency disabling retains stored history. Published Codecs and release assets are bundled. No provider credentials or uploads are needed for a visual-only attachment. [E2–E4,E7,E11,T1,T3,T8]

**Existing video/image Cards:** readers retain legacy media adaptation and the Introduction's first-video thumbnail rule. Video tabs continue to use the existing player/grants and pause-aware navigation. Image content/fitting is retained when delivery is enabled, but **all instructional image attachments, including adapted legacy references, use the separately gated endpoint** and fail closed when it is off. There is deliberately no raw-provider fallback. The base Step View returned Unsupported media for ordinary images; this is not evidence of an established image-delivery path surviving independently of the gate. The creator can currently offer Add image while production image delivery remains gated, so a visual-only private trial is not a complete public creator/multimedia release. Authoring rollback should stop new writes while retaining compatible readers. Do not roll back to a binary that rejects `mediaItems` after modern Cards have been published, and do not rewrite immutable versions to simulate rollback. [E3,E6,E13,T8]

**Confirmed canonical media provenance gap:** `assertCardContent` and ordinary `saveCardDraft`/`publishCard` do not generally check original upload ownership. Upload authorisation protects allocation requests, and `validateForkAttachments` protects new assets on the first prospective foreign fork; those are not validation of every subsequent owned-Card save. `authorizeCardPlayback` checks that a readable Card version contains the requested Stream ID, then the provider layer can issue its token. Its only separate allocation exclusion is Info Card media. Thus a stored canonical reference can become evidence for a grant without proving the original asset owner. [E4,E13]

An **offline synthetic probe** using only plain in-memory stubs confirmed that Card shape validation and `authorizeCardPlayback` accept such a stored reference without an upload-owner lookup. No actual private asset, real database or provider call was used; this is not a claimed live exploit. The missing check is confirmed; live asset exposure depends on provider policy/asset knowledge and was not measured.

The new image route denies personal/Info namespaces, authorises exact Card/Deck context and bounds reads, but explicitly acknowledges remaining canonical provenance uncertainty. Keep `INSTRUCTIONAL_IMAGES_PRIVATE_MEDIA_VERIFIED` unset. **A flag is not the security fix.** Q14's recommended server-owned provenance/legacy review scope remains valid; extend review to Stream signing and existing general protected-media paths. Preserve legitimate public canonical reuse. No new media-picker/gallery UX is required. [E13]

Live R2 privacy/origin aliases, upload CORS, old public file URLs, Stream signed-URL requirements and real Safari HLS remain unverified. This blocks certifying full multimedia production readiness, while a restricted visual-only trial does not need to exercise those providers. [E12,E13]

## 6. Deployment prerequisites

| Requirement | Verified code behaviour / required operator evidence |
| --- | --- |
| Release artifact | Local feature HEAD is not in local `main`; deployed SHA is unknown. Integrate only through a separately authorised review/release. Build/typecheck the exact candidate in isolated output; do not reuse or disturb the phone server build directory. Previous handoff build success predates the latest UI checkpoints. |
| Base application database | `SWITCHPLAY_DATABASE_MODE=production`, approved TLS `mongodb+srv` URI, `MONGODB_DB=switchplay`, matching `SWITCHPLAY_ATLAS_HOST`; real transaction support and required privileges. `NODE_ENV` alone cannot enable Atlas. Current live configuration not read. |
| Existing Card foundation | Phase8 documentation records the first-class migration/verification on14 October. Confirm target schema/version/indexes through authorised read-only preflight; never rerun the historical reset/rename procedure as a visual prerequisite. |
| New record indexes | All17 named definitions, including guest/claim indexes, are checked before repository operations. Missing/mismatched indexes return setup-required503. Imports/startup never create them. An authorised operator must provision/verify them; current helper `--apply-local` intentionally refuses production. A reviewed operator runbook or narrowly scoped deployment command is needed, not weakened checks. |
| Visual runtime | `SWITCHPLAY_PLUGGED_IN_VISUALS=1` enables session/attempt APIs, direct entries and guest infrastructure. Account service and real API paths already exist. No independent account-only gate currently exists. |
| Creator writer | Additionally `SWITCHPLAY_STEP_MEDIA_WRITES=1`; actual client sends `X-Step-Media-Protocol: 1`. Stopping writer flag preserves compatible reads. An old client cannot silently strip modern media. |
| Identity/origin | Real `SESSION_SECRET` and normal account cookies; pin `SWITCHPLAY_APP_ORIGIN` to the canonical browser origin, including protocol/host after redirects. Visual mutation Origin and actor headers must match. Proxy/internal-host behaviour needs staging verification. |
| Protected media | Production database guard requires `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1`. Ensure build/runtime agreement. Real uploads additionally need existing Cloudflare configuration; IV code/PNGs alone do not. Keep image verification gate off until Q14 resolution. |
| Test settings | Clear Phase2 fixture/mock flags/origins; do not deploy the LAN gateway or seed review accounts/cards. Guards are already present, but configuration must be checked. |
| Asset/browser delivery | Bundle release PNGs and compiled lazy visual modules. HTTPS/IndexedDB/cookies and actual Safari reload/background/keyboard behaviour must work. No learner-side Playwright, screenshot service or LAN host is required. |
| Rollback/operations | Preserve records and published modern Cards. Use compatible reader/writer flags and per-visual emergency disable IDs; do not delete histories. Verify observable setup/auth/write/conflict/claim failures and backlog without logging credentials, answer drafts or full snapshots. |

All actual target settings, index installation, backups, privileges and provider settings remain **unverified**, not asserted absent. The offline helper reported17 indexes/10 unique and no legacy backfill/data rewrite. [E1,E9,E12–E14]

## 7. Verification evidence and its limits

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| T1 `tests/phase2/creator-multimedia.browser.ts` | Normal non-admin login/UI creates drafts, attaches visuals at all four destinations, orders/labels/removes, publishes immutable Card versions; upload/account-switch failures | Same UI-created Card reaching an independent genuine learner via a published Deck; real providers |
| T2 `tests/phase2/library-entry.browser.ts`, `library-read-models.browser.ts`, `library-ui.browser.ts` | Real auth/routes, public/private enforcement, reviewed Add/Restore and working membership, canonical vs personal separation | Production deployment or a single combined multimedia/visual lifecycle |
| T3 `tests/phase2/visual-card-entry.browser.ts` | Actual Card components, API, IndexedDB and disposable Mongo; across-Card restore, context, no Card completion writes; canonical entry without personal-data creation | Creator modal setup (fixtures publish through repository); real cross-account acceptance |
| T4 `tests/integration-container.spec.ts`, `interactive-visual-host.spec.ts`, `interactive-visual-saving-status.spec.ts` | Actual layout/host components, unchanged controls, Integration/Roots restore, silent routine status and retained errors | Bundled/memory fixtures do not prove DB/network durability; browser emulation does not certify physical Safari |
| T5 `tests/phase2/visual-records.browser.ts`, `visual-claims.browser.ts`, `visual-entry.browser.ts`, `visual-claim-handoff.browser.ts` | Real disposable API/Mongo/IndexedDB with injected network/storage faults; retries, offline/reload, draft state, attempts, recovery and sign-in claim | Actual deployment latency, long-lived reauthentication, quotas/eviction on real phones, operational deletion. Historical passes predate the latest silent-status change; the recovery scenario has the obsolete visible-backup assertion noted above. |
| T6 `tests/visual-learning-records.integration.ts`, `visual-learning-record-api.integration.ts`, `visual-guest-claims.integration.ts`, `visual-guest-records.integration.ts` | Disposable Mongo transaction/idempotency/CAS/index/ownership/claim and source checks | Injected API authentication is not a genuine deployed login or live provider security |
| T7 `tests/card-reuse.integration.ts`, Card forks/update tests | Established Card identity/reuse/history and atomicity | Combined real visual interaction after every copy/fork/adoption path |
| T8 `tests/step-media.test.ts`, `step-media.integration.ts`, `phase2/step-multimedia.browser.ts`, video-transition tests | Shape/DTO compatibility, old-writer rejection, tabs, thumbnail rules, local player intent/state | Private asset provenance and physical unmuted HLS under asynchronous signed grants |
| Owner phone review | Owner explicitly approved current Integration presentation and reported local host/navigation/autosave/restore working | No recorded independent creator/two-learner production journey, complete live-media device matrix or physical retest of the final silent-status commit |

**Checks run during this audit:**38 existing pure/Node cases passed across catalogue, Framework IDs, step media, API boundary, persistence client, restore, payload, guest credential and host-layout tests. Command: `node --import tsx --test tests/interactive-visual-catalogue.test.ts tests/step-media.test.ts tests/step-media-presentation.test.ts tests/visual-api-boundary.test.ts tests/visual-persistence-client.test.ts tests/visual-restoration.test.ts tests/visual-learning-record-contracts.test.ts tests/visual-guest-credentials.test.ts tests/interactive-visual-host-layout.test.ts`. Also ran the offline index plan and the synthetic media-authorisation probe described above. These use ephemeral in-process stubs/state, not saved learner/test databases. No DB/browser integration suite was rerun, because those create fixture records; no server/build output was changed. Earlier recorded runs remain historical evidence rather than newly executed production acceptance. [E1,T1–T8]

## 8. Prioritised remaining work

### A. Essential before genuine controlled use

| Task | Smallest scope, dependency and verification | Product decision? |
| --- | --- | --- |
| A1. Candidate deployment/database preflight | Review the exact artifact and base production configuration, origin, first-class foundation and transaction capability. Verify/add the17 visual indexes using an approved operational procedure. Deploy compatible readers and guarded writers before enabling modern media writes; do not create modern Cards in a database still served by an incompatible old application, including via a private preview sharing that database. Dependency: deployment access/approval, not new Card schemas. Done when reads/writes succeed with real sessions and missing-setup behaviour remains fail-closed. | Operational approval; no new product UX. |
| A2. Match exposure to trial scope | A private, access-controlled production-like trial can validate genuine authenticated accounts without exposing anonymous guest issuance to the public. **For a public authenticated-only launch**, add a narrowly separated guest rollout control or complete guest policy/abuse prerequisites first; current single flag is broader. Never silently gate guest interaction behind app login as a final product design. Verify anonymous endpoint exposure as well as authenticated success. Depends on A1/runtime rollout. | Public guest retention/access policy needs approval; the immediate private authenticated trial follows the stated goal. |
| A3. One unmocked creator → learners acceptance | Use ordinary UI and genuine approved accounts in the candidate environment: creator attaches both visuals, saves/publishes Card **and Deck**; learner finds/adopts it; interacts, closes/reloads/reauthenticates; second learner gets independent records. Verify stored ownership/versions/visits/history through authorised read-only inspection. No direct DB seeding, dev routes or intercepted visual APIs. Include same visual in another Card/Deck and unchanged step completion. Explicitly complete Roots through a real touch/pointer Check; a keyboard workaround cannot close this gate. If inaccessible on a supported target, a narrowly scoped Roots-owned layout fix becomes essential for that target, under separate implementation approval; do not change the generic host or confuse Check with the previous Next investigation. Depends on A1/A2. | No new product behaviour; any separate visual fix needs implementation authorisation. |
| A4. If real uploaded media is in scope, close provenance/provider gates | Enforce original upload permission on ordinary canonical writes using reviewed authoritative provenance, while preserving permitted public reuse; audit legacy references and Stream/R2 delivery. Keep image gate off meanwhile. Add synthetic cross-account forged-reference denials and then approved real-provider checks. Depends on owner policy and provider access. This is conditional for visual-only trials, mandatory for certifying the complete multimedia release. | Q14 legacy trust/public-vs-private asset policy remains consequential; do not infer permission from a URL. |

These are chiefly readiness/acceptance operations, plus a concrete media-security scope if multimedia is included. They are not a new implementation of the entire visual system.

### B. Recommended before wider release

| Task | Why / smallest scope / completion evidence | Dependencies / decision |
| --- | --- | --- |
| B1. Guest and account data lifecycle |90-day guest inactivity expiry does not delete data. Define coordinated deletion/export covering records, attempts, events, visits/checkpoints and claims; protect transferred account attempts. Dry-run counts/ownership in disposable data before any approved live operation. Address shared-device local queues/minors and account deletion. | Required before public guest runtime unless A2 keeps public issuance off. Owner privacy/retention policy approval. |
| B2. Deployment-wide abuse and observability | Current budgets are process-local; bounded request bodies do not bound lifetime storage or serverless fleet issuance. Add/review edge/service limits and operational error/backlog/latency/storage metrics, without learner payload logging or a new product dashboard. | Public traffic/capacity profile; technical/operator approval. |
| B3. Real-device/provider and failure acceptance | Test actual signed unmuted HLS transitions if video is included, Safari background/reopen/reauthentication, interrupted writes and IndexedDB eviction/storage failure. Update the obsolete visible pending-backup assertion; use internal pending-state evidence and verify genuine recovery-backup failures through the actual client, not only injected host labels. Retain exact device/origin/commit evidence. Do not repeat every pure test. | A1/A3, approved real assets. No autoplay fallback or extra notification is approved. |
| B4. Release/disable/rollback rehearsal | Prove current/old-client refusal, compatible reader rollback and retained attempts. Retirement/disable filtering for new creator references needs review: UI filters published status, while structural server validation accepts any known catalogue ID; all current entries are published. Enforce an appropriate new-reference rule when using retirement, without invalidating existing immutable Cards. | Before retiring/publishing another incompatible release. Existing compiled catalogue remains; no dynamic catalogue UI is required. |

### C. Deferred

- Dense exceptional short-height reflow and general Roots responsiveness remain owner-approved follow-ups; retain the approved Integration phone presentation. This deferral does **not** certify an inaccessible required Roots Check on a supported trial device: that specific failure is an A3 gate. Enlarged text and keyboard limitations need evidence, not a generic-host redesign.
- Simultaneous device/tab collaboration, semantic merge and writer leases: unsupported V1; retain CAS/idempotency/offline safeguards.
- Guest demo Decks, guest CardData/DeckData merge policy, direct Framework/Progress dashboards and catalogue discovery UI: separately scoped; reference plumbing already exists.
- Uploaded-media picker/refcounts/garbage collection and full attempt-history browsing: optional; do not make them prerequisites for a published visual attachment.

## 9. Recommended next milestone

**“Controlled authenticated creator-to-learner visual acceptance.”**

1. Choose the audited candidate through normal release review; perform A1 without altering the existing phone-review environment. Use an approved persistent, production-like trial target, not the disposable review database. Isolate its database from old incompatible application writers, or complete compatible-reader/writer rollout first; a protected preview sharing the old live database is not sufficient isolation.
2. Keep the trial visual-only and use existing deployment access controls. Do not enable the image verification gate, import review Cards, or claim public guest readiness. If trial must be public immediately, resolve A2 first.
3. In the ordinary creator UI, an approved creator creates a publishable Card/Deck, attaches Roots and Integration, saves, publishes and makes the Deck available through the existing Library.
4. Separate learner accounts perform A3, including reauthentication, cross-Card reuse, independent progress and full touch/pointer completion of Roots without the recorded keyboard workaround. Record immutable IDs/versions, response outcomes, principal keys, restored state and unchanged Card completion; never collect credentials or full learner answer payloads in the report.
5. Produce one acceptance receipt for the exact artifact/environment. Only genuine failures become targeted implementation tasks. No extra workflow, data entity or UX redesign is justified in advance.

Exit: a real UI-created publication works for separate learners against the intended durable database, with authorised provenance/context, truthful failures and reliable later restore. Remaining public guest/media gates are explicitly scoped rather than silently waived.

## 10. Questions requiring decisions

**No new product decision is needed to run the private authenticated visual-only acceptance milestone.** Operational access/deployment/index changes still require separate authorisation; none is requested or performed by this audit.

1. **Before public guest enablement:** confirm guest retention/deletion and account export/deletion policy, including claimed histories and shared-device pending work.90days is currently a provisional expiry, not an approved deletion/compliance policy. Recommendation: retain the established non-destructive claim contract and approve a coordinated lifecycle rather than a TTL that orphans/deletes transferred history.
2. **Before full uploaded-media release:** resolve Q14's authoritative canonical provenance and legacy trust policy. Recommendation: private assets require proven permission, with reviewed public canonical reuse; keep the image gate off until enforced. The Stream authorisation finding belongs in that review too. No general uploaded-media picker or live provider changes are authorised by this report.

Previously settled navigation, attempt, thumbnail and guest-claim product decisions are not reopened. [E1,E11–E13]

## Source cross-reference

Paths below are relative to the repository root; functions and test names identify the inspected implementation. Source tree is the verified baseline recorded at the top, not an assertion about the deployed site.

| ID | Primary evidence |
| --- | --- |
| E1 | Existing [implementation handoff](plugged-in-step-visuals-implementation-handoff.md), especially current checkpoints and production gates; [engineering plan](plugged-in-step-visuals-engineering-plan.md) §13 Q14; `docs/engineering/phase-8-preparation.md` completed migration record. Historical paused-deployment wording is not evidence of current live state. |
| E2 | `src/app/creator/new/page.tsx`; `src/app/creator/edit/[deckTemplateId]/page.tsx`; `CreatorDragLab.tsx:1551–1570,1880–1888,1939`; `CreatorStepMediaModal.tsx:52–125`; `creatorStepMedia.ts:selectedStepVisual`. |
| E3 | `src/lib/stepMediaRollout.ts`; `src/components/creator/creatorRequest.ts`; `creatorPersistenceCoordinator.ts:editCard/publishCard`; `src/lib/cards/domain.ts:25–50`; `src/lib/stepMedia.ts:24–62`. |
| E4 | `src/app/api/card-templates/[cardTemplateId]/route.ts`; `src/app/api/deck-templates/[deckTemplateId]/publish/route.ts`; `src/lib/cards/http.ts:cardRequest/creatorRequestBoundary`; `repository.ts:580–605,648–690,729–788`. |
| E5 | `src/lib/cards/libraryReadModels.ts:libraryCollection/libraryDetail`; `libraryProjection.ts:cardContentPresentation`; `src/app/api/library/decks/[deckTemplateId]/add/route.ts`; `repository.ts:addLibraryDeck/ensureCardData/workingCard`; `readModels.ts:projectWorking/membershipDTO`; `resolvers.ts:capabilities`; `versionAccess.ts`. |
| E6 | `src/components/decks/DeckScene.tsx:426`; `FocusedCardView.tsx:264–277,392–400`; `src/components/interactiveVisuals/VisualLearningRecordsProvider.tsx`; `src/app/decks/page.tsx`. |
| E7 | `InteractiveVisualPreview.tsx:previewRequest/hasAttempt/open`; `registry.ts`; `src/lib/interactiveVisuals/catalogue.ts`; `src/lib/visualLearningRecords/sourceAccess.ts:authorizeVisualSource`. |
| E8 | `InteractiveVisualHost.tsx:onChange/closeHost/startNewAttempt`; `interactiveVisualHostLayout.ts:visualPersistenceNotice`; activity `HostedIntegration.tsx`, `HostedRootsFactors.tsx:62–67`, `hostState.ts`; Integration `container-layout.ts`, introductory/later CSS; Roots `platform/web/ActivityFrame.module.css`; `tests/phase2/visual-records.browser.ts:148–165` records the Check workaround. |
| E9 | `src/lib/visualLearningRecords/client.ts:65–160,174–308`; `browserStore.ts:createBrowserVisualStore`; `outbox.ts:visualOutboxKey/hasPendingVisualWork/freezeVisualBatch/acknowledgeVisualBatch`; real route wrappers under `src/app/api/visual-*`. |
| E10 | `model.ts`; `repository.ts:VISUAL_COLLECTIONS/VISUAL_INDEXES/assertIndexesReady/ownedRecord/open/append/newAttempt`; `api.ts:boundary/assertVisualMutationOrigin/readVisualJson`; `contracts.ts`; `server.ts:visualApi`. |
| E11 | `codecs.ts`; `restoration.ts`; `migrations.ts:compiledVisualMigrations`; `guestCredentials.ts`; `guestServer.ts`; `guestClaims.ts`; `claimApi.ts/claimServer.ts`; `claimClient.ts/loginHandoff.ts`; `src/components/auth/AuthScreen.tsx`. |
| E12 | `src/lib/applicationDatabase.ts`; `src/lib/mongodb.ts`; `src/lib/auth.ts`; `scripts/prepare-visual-learning-records.ts`; `next.config.ts`; `scripts/test-phase2.ts`; `scripts/fixtures/plugged-in-review*.ts`; `src/lib/phase2VisualReviewMedia.ts`; `src/lib/cards/mediaProviders.ts`; `src/app/dev/interactive-visual-host/page.tsx`; `src/app/interactive-visuals/[activityId]/page.tsx`; lab session components. |
| E13 | `src/lib/instructionalImages.ts:resolveInstructionalImage/defaults`; `cards/protectedMedia.ts:18–66,98–112`; `cards/prospectiveUpload.ts:validateForkAttachments`; `cards/uploadAuthorization.ts`; `cloudflareStream.ts:143`; `infoCards/mediaRegistry.ts:assertNotInfoMedia`; canonical save/publication in E4. |
| E14 | `requestBudget.ts:createVisualRequestBudget`; `guestApi.ts`; `contracts.ts:assertBoundedJson/assertVisualBatch`; offline index plan execution and38 pure test passes in `/private/tmp/interactive-visuals-readiness-unit.log`. |

Audit boundary: no application/schema/test-fixture edits, no database reads/writes, no account creation/login, no reseeding, no server restarts, no branch/worktree changes, no merge/push/deployment. Only this audit document was created; no commit was made.
