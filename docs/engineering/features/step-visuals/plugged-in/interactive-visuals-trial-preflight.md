# Interactive Visuals — first authenticated trial preflight

31 October 2026. **Preparation only: no trial deployment, shared database access, real trial account creation or runtime fixes authorised/performed.** Starting evidence: [production-readiness audit](interactive-visuals-production-readiness-audit.md). This document adds measurements and operational preparation; it does not supersede approved product behaviour.

## 1. Readiness verdict

The genuine creator → published Card **and Deck** → Library → independently authenticated learners → Visual Learning Records pipeline exists. An isolated persistent trial is technically possible with existing application/repository code, but **no suitable persistent target has yet been approved or verified**. The current four-card review environment is disposable and must not be presented as that target.

Two previously uncertain application issues are now reproduced, without changing runtime code:

- **Roots Check is inaccessible by touch in its retrieval state at ordinary phone sizes**, in both Chromium and WebKit. This is a visual-owned sizing defect, not merely a keyboard-test limitation. Both-visual completion acceptance is blocked until a separately approved correction and phone verification. Integration-only preparation/acceptance can proceed independently.
- **Recovery-backup transport errors can be hidden.** The real persistence client retains the frozen pending work after an injected HTTP 503, but publishes `Previous attempt pending backup` ahead of its recorded error; the host correctly suppresses that routine label. Local save-storage failure still reports an actionable error. A narrow error-precedence fix requires approval before certifying recovery feedback. Ordinary current-version saving is not shown to be broken by this finding.

Operational requirements are understood: choose/authorise an isolated persistent database and private app origin, provision/verify indexes, prepare three ordinary accounts, then execute §7. No general new infrastructure, guest product change or Card schema redesign is needed. Existing media provenance/privacy release issues remain outside this **visual-only** trial: do not upload video/images or enable the instructional-image security gate.

## 2. Exact candidate and isolated build

| Item | Verified result |
| --- | --- |
| Worktree / branch | `/Users/peterdomokos/projects/step-visuals`; `feat/step-visuals-pluggedin`. No branch/worktree change. |
| Application HEAD | `774fabb957c1fe3ac481e3d5de10875d952376bf`; tree `33214c4beebf086655a0d6363f76dd3e1ac4d2e3`. Includes `9ee7184`, `389382f`, `f9746df`, `810e12e`, container-responsive Integration `27990f2`, tab colour `4d87d10`, silent persistence `774fabb`. |
| Intended deployment branch | No new target designated. Local `main` is `cbffc8d`, not this candidate. `main...HEAD` has 1 main-only merge commit and 35 feature-only commits; merge-base `090676e4ad1f654c2c9d0638cc25c231df88a6aa`. Feature diff from merge-base: 224 files, 11,064 insertions, 280 deletions. Do not deploy local main and assume it contains the feature. No remote/deployed SHA was inspected. |
| Source isolation | Exported exact HEAD with `git archive` to `/private/tmp/iv-trial-preflight-z7mfgen0`; excluded `.env*`, no Git checkout or worktree switch. Existing installed dependencies were symlinked read-only. No shared `.next`, development route declarations or environment files used. |
| Production compilation | **PASS:** installed Next 16.2.6 `next build --webpack`, including its TypeScript check, using Node 22.14.0. Existing Next requires Node >=20.9.0. Synthetic build credentials and a non-listening localhost Mongo URI; no real DB or provider connection. Initial sandbox run could not resolve Google Fonts; the network-enabled retry fetched the existing Space Grotesk dependency and passed. No font/source workaround. |
| Bundled visuals | Both `integration-area` and `roots-and-factors` occur in compiled client output. Release previews included: `integration-area-v2.png` (31,815 bytes), `roots-and-factors-v1.png` (33,336 bytes). `catalogue.ts` plus `registry.ts` remain the real compiled release mechanism. |
| Production-mode start | **PASS:** temporary loopback `next start` with synthetic, guard-valid production settings, no fixtures and no account cookies. `/api/auth/me` and visual existence GET return401; `/creator/new` renders normal auth entry; direct Integration entry and both PNGs return200; development host returns404. Only anonymous/static routes were requested. Owned smoke process was stopped. This proves startup/routing, not Atlas connectivity, signed-in hydration or persistence. |
| Build method limitation | Verified **Webpack**, not the default Turbopack production build. `vercel.json` currently runs `npm run build`, which defaults to Turbopack. For an approved candidate deployment either use the tested `npm run build -- --webpack` command as an operational override, or verify default Turbopack in a normal independently installed candidate workspace. Do not claim this run verified that default. |

Installed framework guidance read: `node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md` and `01-app/03-api-reference/06-cli/next.md`. Server routes/auth/database make a static export unsuitable. Logs, smoke results and copied candidate are temporary diagnostics, not a deployed service or durable acceptance archive.

## 3. Database contract, inspection and provisioning

### Supported environments

`src/lib/applicationDatabase.ts` deliberately supports two modes:

1. `production`: `MONGODB_DB=switchplay`, `mongodb+srv` URI with approved matching `SWITCHPLAY_ATLAS_HOST` ending `.mongodb.net`, TLS verification intact, protected-media build setting enabled, no fixture settings. **A different staging database name on the live cluster is rejected.** An isolated Atlas cluster may use the same database name without sharing live data.
2. `disposable` (default): explicit loopback `mongodb://` URI without credentials and a name matching `switchplay_(phase2|test|migration)_...`. The guard restricts location/name, not storage durability: an independently operated disk-backed local replica set could persist a `switchplay_test_authenticated_trial` database across app restarts. Its name does not mean the application deletes it. Do not use the MongoMemory runner for that purpose.

`src/lib/mongodb.ts:withMongoTransaction` requires multi-document transactions with primary reads, snapshot read concern and majority writes. A standalone mongod is insufficient. Use a replica set/Atlas topology with transactions, appropriate network access and normal operational backups. No topology or privileges were tested against an actual target during this task.

**Current local inventory:** mongod at loopback27017 has persistent files configured under `/usr/local/var/mongodb`; `/usr/local/etc/mongod.conf` has no replication section. This is not proof of its running topology; no DB connection was made. It belongs to existing development infrastructure and is not an approved trial database. Two MongoMemory servers belong to existing test/review runners. Do not repurpose any of these. `mongod`, `mongosh` and Vercel CLI are installed; no local Vercel project link exists. No Caddy/mkcert executable was found.

**Existing project environment, offline check only:** a fresh subprocess loaded the normal local environment and called only `assertApplicationDatabase`, never a connection method. Its selected mode is `production` and the current settings satisfy the guard. URI/database/Atlas-host/session-secret settings are present; protected media is enabled; visual runtime/writer gates and fixture/image-verification gates are not enabled; `SWITCHPLAY_APP_ORIGIN` is absent. Only these non-secret statuses were returned. This is **not** an approved isolated staging configuration and must not be forwarded to a new trial process. No URI/host/credential was printed or used by the build, smoke, browser tests or database client. Running servers can have explicit environment overrides; this file check does not describe their live configuration.

### Exact required Visual Learning Records indexes

Rechecked directly against `repository.ts:VISUAL_INDEXES` and `guestCredentials.ts:VISUAL_GUEST_INDEXES`. The offline `scripts/prepare-visual-learning-records.ts --plan` still reports **seven collections,17 indexes,10 unique**, no backfill or document rewrites. `_id` indexes are additional server defaults, not part of17.

| Collection | Index name | Ordered key fields (all ascending) | Unique |
| --- | --- | --- | --- |
| visualGuests | visual_guest_id | guestId | yes |
| visualGuests | visual_guest_credential | credentialHash | yes |
| visualGuests | visual_guest_retention | status, expiresAt | no |
| visualGuestClaims | visual_guest_claim_id | claimId | yes |
| visualGuestClaims | visual_guest_claim_guest | guestId | yes |
| visualGuestClaims | visual_guest_claim_account | accountId, createdAt | no |
| visualRecords | visual_record_id | recordId | yes |
| visualRecords | visual_learner_activity | principalKey, activityId | yes |
| visualAttempts | visual_attempt_id | attemptId | yes |
| visualAttempts | visual_attempt_history | recordId, createdAt, attemptId | no |
| visualAttempts | visual_attempt_command | recordId, command.id | no |
| visualEvents | visual_event_identity | attemptId, eventId | yes |
| visualEvents | visual_event_history | attemptId, serverReceivedAt, eventId | no |
| visualVisits | visual_visit_id | visitId | yes |
| visualVisits | visual_visit_history | attemptId, openedAt | no |
| visualSnapshotCheckpoints | visual_checkpoint_id | checkpointId | yes |
| visualSnapshotCheckpoints | visual_checkpoint_history | attemptId, createdAt, checkpointId | no |

The non-unique command index is intentional in the current implementation; do not strengthen/rename indexes speculatively. No TTL index: guest expiry is not a deletion policy. Runtime `assertIndexesReady` checks exact name/key/unique, rejects sparse/partial substitutes and caches successful readiness per Mongo client/database. All17, including guest indexes, are required even for an account-only trial.

### Safe target check — prepare now, execute only after target/read-access approval

1. Record candidate SHA, operator, approved cluster/database fingerprint and whether database is new. Read secret URI from the approved secret store/environment, never a command-line literal, report or shell history. Apply the existing database guard **before connecting**. For Atlas, use a read-only inspection credential restricted to the intended database; check cluster identity separately in the operator console.
2. Run read-only `hello`/deployment inventory to confirm a replica-set/mongos topology and supported sessions; do not treat ping as a transaction test. Inspect collection options and `listIndexes` on the seven named collections. Namespace-not-found means missing, permission failure means **unknown**, not absent.
3. Generate the expected JSON offline with the existing `--plan` command. Compare each installed index by exact name, ordered key fields and uniqueness; reject sparse/partial variants. Report **present/missing/mismatched/unverifiable** per definition. Also inspect collation/options; any non-simple default/collation requires review rather than assuming name/key equality is sufficient. Never print sample learner documents or credential hashes.
4. Inventory first-class `users`, `cardTemplates`, `cardTemplateVersions`, `deckTemplates`, `deckTemplateVersions` and their required foundation indexes from `cards/repository.ts:createFoundationIndexes`. Existing production foundation is documented migrated on14October; **do not rerun that migration**. A fresh empty isolated database needs current foundation indexes, not the historical conversion/rename script. The normal creator produces Card/Deck records later.
5. In an already existing target collection, perform a read-only snapshot/majority transaction using the installed driver/session helper, return only success/failure. No inserts, updates, temporary sentinel documents or automatic collection creation. On a completely empty target, defer this check until approved provisioning has created its collections. The first authorised trial write is a further transaction acceptance check.
6. Save redacted counts/results and exact candidate. **Current result: target unknown; no determination of which indexes are missing is possible without authorised inspection.** Do not label all17 missing.

### Provisioning procedure — separate write approval required

The current helper intentionally implements only offline `--plan` and guarded `--apply-local`; it **cannot provision Atlas**. Do not add an Atlas bypass to it. An operator-only procedure using the exported definitions is necessary; a new permanent application endpoint or general migration tool is not.

After approving the exact target and inspection manifest: establish the normal backup/restore checkpoint; stop unapproved trial writers; check unique-key duplicate groups and existing incompatible index/collection options without returning contents. Abort on duplicates or mismatch; do not delete/deduplicate learner data or drop/rebuild an index automatically. Missing only: use the existing exported `createVisualLearningRecordIndexes(db)` in a reviewed operator session, or its generated equivalent `createIndex(key,{name,unique})` for the approved missing definitions. Its calls are sequential; a partial failure can leave some indexes installed. Rerun the read-only comparison and provision only remaining approved gaps. No index deletion, history rewrite, user migration or Card backfill.

For a **fresh** trial database, explicitly approve creation of the five current Card foundation collections/users plus these seven collections, install `createFoundationIndexes` and visual indexes before accounts/creator writes. Recheck options/indexes with the runtime application credential, not just the setup credential. A DB-scoped Mongo `readWrite` role is a practical baseline for this private trial; an operator may grant a narrower tested runtime role providing the actual CRUD and `listIndexes` needs. Setup additionally needs collection/index creation; do not use cluster-admin credentials in the app. Target-specific role/Atlas network approval remains unverified.

Do not execute production-like target scripts by loading the existing `.env.local` implicitly. Index-readiness guards remain unchanged and fail closed with `VISUAL_INDEX_SETUP_REQUIRED`/503. Rollback preserves collections/attempts: disable writes/execution as necessary, retain compatible readers, never remove indexes to roll back the application.

## 4. Trial environment options and recommendation

| Option | Available foundation / missing work | Assessment |
| --- | --- | --- |
| Dedicated persistent local replica set, loopback app | Installed Mongo/Next/auth support it. Requires a **new approved data directory, replica set, database and unused ports**, current indexes and three account inserts. Use `disposable` guard with a trial-prefixed local name; no fixture runner, fake providers or auto-login gateway. Keep application origin loopback initially. | **Smallest no-cloud authenticated desktop acceptance target.** Real DB and authentication; durability lasts while its disk data is retained, not while a runner lives. It is not a full production-mode/Atlas/iPhone certificate. Do not modify the existing27017 service. |
| Private HTTPS candidate app + isolated Atlas cluster with DB `switchplay` | Existing app guard and Vercel build configuration support this. No approved staging deployment, cluster, participant protection or independent secrets established. Requires separately authorised resource/deployment/configuration operations. | **Preferred production-like and iPhone trial** if the owner has or approves the infrastructure. Isolates old writers and tests production cookies/proxy behaviour. No live dataset copy is necessary. |
| Existing live Atlas database with protected preview | Existing environment keys are not evidence of permission/isolation. Old application versions could still read/write modern Cards. Public app discovery would expose new content beyond the preview. | **Do not use for the first trial.** A protected preview does not isolate the database. Requires a separately reviewed compatible-reader/writer rollout and live-data authorisation. |
| Current four-card review runner | Real components plus disposable users/Mongo/mock media; ports4182/4183. | Preserve for design review; **not genuine persistent acceptance**. |

No trial was started. The quickest autonomous next preparation after owner choice would be the new loopback disk-backed replica set; its eventual setup/data writes must be explicitly approved. The local guard refuses Mongo URI credentials: keep that database strictly loopback-bound on the trusted Mac; protect any approved remote app access independently and never expose its Mongo port. For phone access use a private, trusted HTTPS endpoint or approved VPN/TLS proxy in front of an isolated service. Do not turn an unauthenticated LAN bind into assumed participant restriction. In `NODE_ENV=production`, normal session cookies are Secure; HTTP LAN access is not a substitute for production HTTPS. No installed trusted local TLS solution was established in this task.

## 5. Configuration checklist (names/contracts only)

| Setting / dependency | Required contract |
| --- | --- |
| Node/dependencies | Node >=20.9.0; lockfile-consistent `npm ci` in the authorised candidate workspace. Installed build here used Node22.14.0 and Next16.2.6. Do not install into or delete active server dependencies. |
| `SWITCHPLAY_DATABASE_MODE` | Explicit `production` for approved Atlas, or deliberately `disposable` for the isolated persistent loopback option. `NODE_ENV` does not select DB permission. |
| `MONGODB_URI`, `MONGODB_DB`, `SWITCHPLAY_ATLAS_HOST` | Atlas: exact database `switchplay` and host-bound TLS SRV configuration. Local: loopback URI/name contract above; its independently configured replica set must survive app restart. No live URI is included here. |
| `SESSION_SECRET` | Independent strong trial secret, stable across restarts/deployments; normal bcrypt/JWT authentication,30-day HttpOnly session cookie. No fixture credentials/auto-login. Do not reuse production signing secrets with an isolated trial database. |
| `SWITCHPLAY_APP_ORIGIN` | Exact externally used canonical origin including scheme/host/port. Visual POST Origin equality and Sec-Fetch-Site checks remain enforced. Pin after choosing a stable trial URL; avoid alternate deployment aliases during pending work. Reverse proxy preserves canonical authority and forwards cookies/Origin without broad CORS or header-based identity substitution. |
| `SWITCHPLAY_PLUGGED_IN_VISUALS=1` | Enables normal account APIs **and guest entry/session/claim**. Enable only behind verified access protection. |
| `SWITCHPLAY_STEP_MEDIA_WRITES=1` | Additionally enables creator multimedia selection/writes; current client supplies `X-Step-Media-Protocol:1`. Both flags are required for authoring. Compatible media readers must be the only application readers/writers of this trial DB. |
| `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1` | Required by production database guard; set at build **and** runtime. IV-only trial needs no Stream/R2 credentials or new uploads. Do not copy dummy provider values into the trial. |
| `INSTRUCTIONAL_IMAGES_PRIVATE_MEDIA_VERIFIED` | Keep unset/off. Image provenance issue remains unresolved. Do not select image/video uploads in the trial. |
| `SWITCHPLAY_DISABLED_INTERACTIVE_VISUAL_IDS` | No disabled trial target, unless deliberately restricting the trial to Integration pending Roots repair. Same registry/availability rules apply; record any restriction. |
| Fixture flags | Clear `PHASE2_BROWSER_TEST`, `PHASE2_MEDIA_FIXTURE_ORIGIN`, `NEXT_PUBLIC_PHASE2_MOCK_MEDIA`, `NEXT_PUBLIC_PHASE2_VISUAL_REVIEW`, review-media origins and development-only persistence overrides. No review gateway. |
| Assets | Ship both compiled lazy modules and release PNGs; no screenshot service, arbitrary activity URLs or runtime visual upload. Normal browser requests are same-origin relative APIs. |
| Browser persistence | Stable HTTPS trial origin, normal non-private browser profile, writable IndexedDB schema2 and cookies. No old tab blocking upgrade. Server-acknowledged progress must survive browser reauthentication and another approved browser; pending offline work is device/origin-local. Do not clear site data until pending work is acknowledged. |

Actual target settings/network access/cookie behaviour have not been verified. The smoke used synthetic settings and cannot close these gates.

## 6. Keeping the trial private without changing guest semantics

The app login screen does **not** protect guest APIs. Existing source has one runtime flag for accounts and guests (`server.ts`, `guestServer.ts`). No new app-level guest restriction is proposed or implemented.

Use deployment-level protection across **every candidate hostname, alias and API path**, including `/interactive-visuals/*`, `/api/visual-guests/*` and `/api/visual-*`. An upstream participant identity gate can coexist with ordinary Switchplay account login. On Vercel, inspect the actual project's Deployment Protection scope/method and participant access; no local project link or live protection settings were available. Do not assume the plan/default protects a production alias. Official documentation describes selectable scopes/methods and protection exceptions; confirm actual availability and absence of bypass domains in that account. [Deployment Protection](https://vercel.com/docs/deployment-protection), [protection methods](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments), [exceptions](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions).

Before enabling the runtime, an unauthorised fresh browser must encounter the upstream gate for the page and representative API paths, not merely application JSON401. Verify all aliases, method coverage, no automation bypass shared with participants and no public direct origin. After enabling, repeat safe unauthenticated requests without issuing guest mutations; accepted participants then sign into the ordinary app. Keep testing authenticated; platform access does not create a Switchplay guest. No full guest lifecycle/privacy policy is being approved by private testing.

If deployment-wide protection is unavailable: prefer loopback-only local testing, or an approved private network/reverse proxy protecting the **whole service**. If public hosting is mandatory and cannot be protected, stop public enablement and seek approval for infrastructure protection or a separately scoped rollout gate; do not silently change guest product behaviour. `noindex`, a secret Deck URL and an ordinary app login are insufficient controls.

## 7. Executable acceptance procedure — awaiting target/account approval

Use **three ordinary, non-admin accounts** and three separate browser profiles/contexts. Existing auth provides login/logout/me, not a registration API. The operator must authorise existing trial accounts or creation of three new isolated-DB accounts with unique usernames/emails and bcrypt passwords. The existing `scripts/seed-user.mjs` is unguarded operational code, not an approved production account tool: do not run `npm run seed:user` with the repository `.env.local`. Account setup must explicitly bind the approved trial database and never print/store passwords in the receipt. No Card/Deck/record seeding.

Record candidate SHA, stable base URL, protection evidence, DB fingerprint/index results, browser/device versions and approved account aliases before starting. Use actual requests with cookies; no `page.route`, fake persistence provider or manual JWT. A UI automation may drive the steps after approval, but cannot substitute direct repository/API creation for creator/publication UI.

### Creator

1. Sign in normally and open `/creator/new`. Use **Add card** and the existing edit dialog to create a mathematically realistic Card with Introduction and three steps. Suggested titles: Introduction “Explore area and factors”; steps “Estimate an area”, “Explain a root”, “Compare your results”. Save through the normal dialog/coordinator; verify successful draft requests and no revision/auth errors.
2. Use the existing Introduction media link to open the modal. In **Add Interactive Visual**, select Integration (`integration-area`) and Roots and Factors (`roots-and-factors`), with short labels **Area** and **Roots**. Close the modal normally. Do not upload files. Reload the creator draft and verify both references/order/labels remain. An Introduction with no video correctly has **no card-front thumbnail**; the IV preview appears inside Step View.
3. Publish the Card using its existing **Publish Card …** action. Confirm an immutable `cardTemplateVersions` entry with the two exact activity references. Keep the Card's public visibility compatible with the containing public Deck, using the existing visibility/publish controls; deployment access protection still restricts who reaches the trial application.
4. Name the containing Deck uniquely, publish it through the normal Deck publication/review controls and make it available through the current Library. Confirm `deckTemplateVersions` references the intended Card and both roots have a latest published version. **Card publication alone is not success.** Capture IDs/version numbers from authorised responses or read-only inspection, not database edits.
5. As a negative check, keep a separate unsaved/private draft inaccessible to learner profiles. Do not change real/private existing content for this check.

### Learner A

1. Authenticate normally in another profile. Open `/library`, find the creator's Deck by its unique title, review and **Add** using the actual Library control, then open the personal Deck. Record adopted Deck/Card versions and current user ID from the authorised session. No gateway/direct seeded route.
2. Open Introduction → **Area**. Confirm the inert preview initially says **Start** for an account with no earlier Integration attempt. Merely selecting the tab must produce no open/visit write. Activate the preview: a genuine `/api/visual-sessions/open` request succeeds with the account's `X-Visual-Learner`; host opens.
3. Move the Stage1 boundary; advance to Stage2, select `y = x` and adjust rectangle refinement. Record a distinctive stage/function/slider value, close and return to the same tab. Routine saving/navigation stays silent. Wait for successful batch acknowledgements in DevTools/approved automation, not a new Saved indicator. Check server snapshot revision and visit/event existence via read-only inspection without copying learner answers into the receipt.
4. Leave for another route, reopen the Deck/Area and expect **Continue** with the same attempt/state. Reload the page, then sign out/in normally and verify again. Later reopen in another approved browser/device **after acknowledgement** to distinguish server restore from only the original IndexedDB cache. No simultaneous editing.
5. Open **Roots** and use pointer/touch only: move the green root, Next, choose a factor, move the root to−3, Next, then place the root at−4 and tap **Check**. Expect completion/Rewind, same-attempt Rewind and confirmed New only at eligible states. **Currently blocked by §8; do not use Enter, force-click or browser scrolling to declare a pass.** Complete this step after an approved visual-owned fix and physical phone verification.
6. Verify Card step completion remains unchanged by visual navigation/completion. Check ordinary Card navigation/tab return remains intact.

### Learner B and shared visual identity

1. Authenticate in a third clean profile; independently adopt the same public Deck through Library. Before activating either visual, confirm no A progress appears. Open Area, expect a separate record/attempt and initial state; create a different distinctive stage/value and acknowledge it.
2. Leave/reopen and reauthenticate; verify B's saved state. Return to A and verify A's state is unchanged. Use read-only DB projections to prove separate `principalKey`/record/attempt IDs, not just different visible screens.
3. Creator makes a second ordinary Card/Deck containing Integration via the same UI/publication process. A adopts/opens it and resumes **A's existing Integration attempt**; B resumes **B's**. New visits carry the second Card/Deck/version/step/attachment context. No per-Card duplicate visual progress; user-specific CardData semantics remain unchanged.
4. Using B's actual session/header, attempt a **read** of A's captured record-current endpoint: expect403 and no snapshot. A forged A header with B's cookie must not rebind identity. Try the creator's private draft via ordinary learner route and confirm refusal. Do not send writes to A's attempt as an acceptance shortcut.

### Acceptance receipt / database evidence

Use `visualRecords` filtered by each test account's `account:<id>` plus activity ID; project recordId/activeAttemptId/attemptCount. Inspect matching `visualAttempts` identity, activityVersion/snapshotSchema/stateRevision and stage only; count events and inspect visits' context IDs. Verify independent account records, same-activity cross-Card identity, durable snapshots and correct versioned source linkage. Inspect the trial users' relevant CardData/DeckData/adopted versions with targeted projections only. Do not dump users/password hashes, cookies, full snapshots, answer drafts or guest credentials.

Classify each step pass/fail/not-run with actual request outcomes and device; save redacted screenshots. Root completion and recovery-warning defects cannot be waived by fixture evidence. Failed acceptance becomes a focused issue; do not start an architectural rewrite. Environment stop/restart/cleanup must preserve approved disk/Atlas records and requires its own operational scope.

## 8. Roots touch-access assessment — confirmed normal-phone blocker

Source: `HostedRootsFactors.tsx:62–67` records dimensions in attributes but does not consume them. `RootsFactorsView.tsx` uses `platform/web/ActivityFrame`; `ActivityFrame.module.css:1–14` uses `min-height:var(--spv-surface-height,100dvh)` and its grid's navigation row follows the mathematical content. The adapter does not supply that variable. Internal navigation includes the mathematical **Check** action; it must stay visual-owned. Existing `tests/phase2/visual-records.browser.ts:148–165` used keyboard Enter at900×1100 and recorded this limitation.

New isolated reproduction bundled the **unchanged real Host + HostedRootsFactors + global CSS** with esbuild. A valid activity-owned snapshot was produced through the existing reducer: place4 → ready → predict plus → place−3 → continue → place−4. It restores the retrieval challenge with the correct root already placed. In-memory persistence avoids every learner/server/database mutation; this probe tests layout/touch only, not genuine acceptance. Fresh contexts use `hasTouch:true`, reduced motion and normal font size.

| Viewport | Actual host content rectangle (x,y,w,h) | Check top/bottom | Chromium / WebKit tap |
| --- | --- | --- | --- |
| 320×568 | 12,56,296,456 | 580 /624 | outside viewport /outside viewport |
| 375×667 | 12,56,351,555 | 679 /723 | outside viewport /outside viewport |
| 390×844 | 12,56,366,732 | 856 /900 (WebKit855.98/899.98) | outside viewport /outside viewport |
| 430×932 | 12,56,406,820 | 944 /988 | outside viewport /outside viewport |
| 900×1100 | 12,56,876,988 | 1112 /1156 | outside viewport /outside viewport |

Check is76×44 in every case. Centre hit-testing fails; normal Playwright `tap` attempts time out reporting outside viewport, even with its normal scroll-into-view attempt. Document height stays equal to viewport; dialog overflow extends below it. This is not a force-click/locator false negative. Whole-screen390×844 WebKit screenshot was visually inspected: graph/task/prompt display, but Check is absent below the screen. Diagnostic JSON/screenshots: `/private/tmp/iv-roots-touch-results.json`, `/private/tmp/iv-roots-{chromium,webkit}-<width>x<height>.png` (temporary).

**Proposed correction, not implemented:** make the Roots adapter/presentation consume its actual supplied rectangle, using a visual-owned height input to `ActivityFrame` (the existing `--spv-surface-height` seam may suffice initially), and verify flexible graph allocation plus every prompt-sizing state. Do not change Host geometry or move Check into generic navigation; do not merely subtract a fixed112px/scale the whole visual. Scope is the Roots layout contract and regression tests, with no math/navigation/persistence changes. Further short-screen reflow requires evidence and separate approval. Physical iPhone touch verification remains required; automation already establishes a normal-size blocker, not just exceptional small-screen work.

## 9. Persistence regression assessment

### Test-only correction

`tests/phase2/visual-records.browser.ts` had `expect(status()).toContainText("pending backup")` in the two pending invalid-state/version recovery cases. Replaced with the existing internal `data-visual-save-status="Previous attempt pending backup"` assertion and an assertion that the visible status does not contain the routine wording. Existing recovery request identity/deduplication, checkpoint root4, old attempt preservation, confirmed New and final acknowledgement checks remain. No runtime source, persistence semantics or notification rules changed. This is not intended to certify failure visibility: the separate diagnostic below exposes that bug.

Verification uses a temporary copy with a brand-new MongoMemory replica set and dynamic ports, never the review DB. The first copied-runner attempt hit Turbopack's external-node_modules-symlink restriction before tests. For the **temporary copy only**, Webpack and an explicit baseUrl in its generated test tsconfig resolved the copy/alias limitations. Original runner/configuration are unchanged. An initial negative assertion on an intentionally absent status element was corrected to inspect the always-present footer instead. These are disposable regression tests, never the genuine-account milestone.

### Confirmed genuine error masking

`src/lib/visualLearningRecords/client.ts:29–37` selects restoration labels **before** `errors.get(attemptId)`. In the recovery transport loop (`:125–153`), a failed `/recovery-batches` request sets a retry/stopped error and retains the frozen work. `visualPersistenceNotice` intentionally hides the routine restoration label, so the actual transport warning never reaches the host's existing visible error path.

A temporary in-process diagnostic used the **real** `createAccountVisualPersistence`, real Roots snapshot/events, memory-store seam and an injected recovery HTTP503. Result: one failed request; frozen batch retained; subscribed label `Previous attempt pending backup`; `visualPersistenceNotice` returnsnull. This reproduces the audit's risk. In the same recovery state, an injected local save storage failure produces **Saving failed. Changes are not safely stored on this device.**, which remains visible because `localFailures` has higher precedence. Existing storage-read/outer-flush failures also have direct warning paths; do not generalise the transport result to all storage errors.

**Proposed correction, not implemented:** narrowly prioritise genuine transport errors ahead of routine restoration labels, leaving local-failure/conflict/unavailability precedence and quiet successful/pending states intact. Add a client-to-host regression for a pending recovery request failing503/403 and later retry, plus retained queue/history. No persistence redesign or replacement notification. Needs separate runtime-change approval. Existing generic host tests injecting an error string directly cannot prove this pipeline.

## 10. Verification ledger and operational approvals

### Checks completed

- Exact-HEAD isolated Webpack production build **passed**, including TypeScript; production-mode anonymous/static smoke **7 checks passed**. No fixture/server output in the original tree changed.
- Production database guard/TLS/mock rejection test **1 passed** (`--test-name-pattern='production is explicit' tests/phase8.test.ts`). Other migration tests were not run; no migration invocation.
- Catalogue/Framework, persistence client, host status/layout and visual API-boundary pure tests **23 passed**. Commands: `node --import tsx --test tests/visual-persistence-client.test.ts tests/interactive-visual-host-layout.test.ts tests/visual-api-boundary.test.ts tests/interactive-visual-catalogue.test.ts`.
- Offline index plan confirmed7/17/10 and no DB/backfill. No target connectivity/index inspection/provisioning performed.
- Roots:10 browser/viewport probes executed; **all10 reproduced inaccessible Check**. Not a passing touch certificate. Physical iPhone test not performed.
- Real-client recovery diagnostic confirmed masked503 warning and preserved frozen pending work; local save-storage warning remained visible. No runtime fix made.
- Corrected recovery browser cases: **2/2 Chromium passed** (40.5s) against actual APIs/IndexedDB and the newly owned disposable replica set. Both invalid-state and version recovery retain their checkpoints, identical retry bodies, historical attempts and confirmed-next-attempt behaviour. WebKit was not rerun for this test-only assertion change. The separate masked-error defect above remains unresolved.
- Genuine creator/three-account persistent acceptance **not run**; no environment/accounts authorised. No provider or production tests claimed.

### Exact approvals needed next

| Request | Scope / consequence | Not included |
| --- | --- | --- |
| O1. Choose target and permit setup | **Local:** new disk-backed loopback replica set/data directory, unused ports, named test database and independent app instance; or **private HTTPS/Atlas:** identify/approve isolated cluster and candidate deployment with all-host protection. Approve intended persistence lifetime and who can access it. | No reuse of27017/live Atlas/review databases, external resource creation or deployment assumed. |
| O2. Target read preflight, then exact missing-index provisioning | First approve connection/read-only metadata/transaction checks; then approve the resulting explicit missing-index manifest. A fresh target also needs current foundation collection/index creation. Setup credential separate from runtime; no document rewriting. | No historical migration, dropping indexes, data repair/deletion or provider changes. |
| O3. Three ordinary accounts and genuine UI acceptance writes | Create new isolated-DB creator/A/B accounts or identify approved existing trial accounts; permit their Card/Deck publication/adoption and learning records. Use separate stable secret and genuine login, not review credentials. | No real live users/data copied; no seeded Cards/Decks; no guest policy change. |
| O4. Two narrow application corrections | Approve **Roots-owned container sizing/Check access** and **recovery-error label precedence**, each with focused tests and separate review. Other work may proceed independently; do not certify both-visual/recovery acceptance until fixed. | No generic-host change, math/progression/layout redesign, new notifications or persistence semantics. |

No new product design decision is needed for the private visual-only trial. O1–O3 are operational authorisations; O4 is implementation permission for evidenced defects. Public guest retention and uploaded-media provenance decisions remain deferred by keeping the environment private and trial visual-only.

## 11. Recommended next action

Approve the dedicated **persistent loopback trial** as the smallest no-cloud route, or nominate an existing **protected HTTPS + isolated Atlas** target if phone/production-mode acceptance is required immediately. Authorise its read preflight and three accounts, and the two narrow runtime corrections. Then provision only the reviewed prerequisites and execute §7 using genuine UI workflows. Do not deploy this candidate against the old shared live database merely because its build passes.

Preservation: existing phone-review gateway80773/app81282 at4183/4182, review learner progress, the other worktrees/ports and original build outputs were left untouched. Temporary owned smoke/regression processes are stopped by their runners. This document, the test-only assertion correction and a brief handoff link are the only intended changes in this task; no commits, merge, push, deployment or live data/index operations.
