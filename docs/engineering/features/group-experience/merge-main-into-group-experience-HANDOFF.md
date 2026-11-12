# Independent review handoff: merge of main into Group Experience

Written for: the reviewing agent (Codex) who has not seen this work and will review it independently. Review only; do not push, merge into `feat/group-experience`, or deploy.

## Update after the independent review (test and documentation changes only)

An independent review (Codex) found that several tests and test descriptions claimed more than they established. This section records what changed. **Only tests and documentation were changed. No production code was touched, nothing was committed, pushed or deployed, and `feat/group-experience` is still at `40c7626`.** The changes are uncommitted working-tree edits in `/Users/peterdomokos/projects/switchplay-merge` on top of `12fcc38` (the branch tip is unchanged). The results in the rest of this document are historical, recorded before these changes; verification performed after them is in "Verification after the review corrections" below.

| Area | Correction |
|---|---|
| Pinned versions (`group-step-media-images.browser.ts`, `groupStepMediaFixture.ts`) | The fixture now publishes real Card and Deck versions 1 and 2 through the Creator, with different images, alt texts and stored assets. The Group is created while version 1 is latest and stays pinned to it. The test proves version 2 exists, is public and is itself deliverable, then asserts the Group shows and requests version 1 only, on first open and when reopened, in the Group and follower perspectives (and Me for the follower). Missing-version negative checks now use genuinely nonexistent versions (3). |
| In-place perspective switching (`group-visual-record-ownership.browser.ts`, fixture) | The switching test no longer uses a navigation `PATCH` plus `page.goto`. The page is entered once; every switch uses the real picker on the mounted scene (admin Group, follower, Group; follower Me, Group, Me, in a separate authenticated context). The test asserts no document navigation, that the same scene element was retained, the restored value and the signed-in learner header after each switch, and that an edit made after switching leaves the other account's records unchanged. |
| Vibration test (`group-visual-records-stack.browser.ts`) | Re-described as a stack-stability check during delayed Visual Learning Records module release or failure, with its limitation first in the header (see below). Assertions, engines, viewports and swipe check unchanged. |
| Protected media descriptions | Header comments and titles now state what is simulated (see "Protected video: what each test establishes"). Assertions unchanged. |
| `main-merge-interactions.integration.ts`, `auth-login-handoff.spec.ts` | Titles and comments narrowed to what is asserted (below). Assertions unchanged. |

Corrections to claims made earlier in this document:

- "Verified: `group-step-media-images.browser.ts` fails without the line" referred to the image gap only. It did not establish pinned-version behaviour (the earlier fixture had a single version). That is now covered.
- The earlier switching test did not exercise in-place switching. It now does.
- The canonical image endpoint does **not** restrict images to the Group pin. `resolveInstructionalImage` serves any accessible public version of a readable Deck. The pin is enforced by the manifest the Group presents, which is what the browser assertions observe.
- "Opening Step media does not re-read the Group" was too broad. The test asserts that Step navigation and tab selection issue no Group requests **other than authority checks**. Authority checks come from the Group's own refresh clock (lease renewal in `groupResource.ts`) on a timer, independent of Step view, so a stricter window is timing dependent: it passed on first open and failed intermittently on reopen.

## Where everything is

Full SHAs: merge `6abeda43c54badfdaa0467110d1a7c29004a7caa`, fixtures `93ec2c35e1e423cc522152709ac7ce433a243bf9`, tests `1bab5850bfdf6d82b4f1f808ec36375ab8a363e8`, dev origin `7a142aafe6b80e00b94b443ee3292b83a191f7e7`, Group image fix `43ef775da2769e9ba4749f7e845e9f92cbd37679`, new tests `12fcc38cfeb068f1844601f18231c1f87a9e8213`.

| Item | Value |
|---|---|
| Review worktree | `/Users/peterdomokos/projects/switchplay-merge` |
| Review branch | `merge/main-into-group-experience` |
| Branch tip | `12fcc38cfeb068f1844601f18231c1f87a9e8213` |
| Group Experience (parent 1) | `40c76265d79f21d781c2ef197b1597cdbd9b9e91` (`feat/group-experience`, unchanged) |
| main (parent 2) | `69a4bc6a36817f28a49a62cffe0fce88ec703d5a` (`origin/main`) |
| Merge base | `de7d378ddcd30e2e37a331c94b49b0f0cd336029` |

Commits on the review branch, oldest first:

1. `6abeda4` Merge origin/main into feat/group-experience. Conflict resolutions only.
2. `93ec2c3` test: keep main image object store in every review fixture. Fixture adaptation only.
3. `1bab585` test: cover interactions between main and Group Experience. New tests only.
4. `7a142aa` chore: allow a phone to reach the dev server via configurable origin. `next.config.ts` and README.
5. `43ef775` fix: give Group focused Cards the signed in viewer for instructional images. One-line source fix in `GroupExperienceDeck.tsx` (see Interaction gap found by the new tests).
6. `12fcc38` test: cover Group Step media images and visual record ownership. Two new browser specs and one shared helper.

Commits 4 to 6 were added in the final verification round. Commits 1 to 3 are unchanged. `git log --oneline 40c7626..HEAD` lists all six.

**One real integration gap was found and fixed (commit 5).** See the section below. It is the only source change after the merge commit.

Not touched: `feat/group-experience`, any remote, any deployment, any database record. Nothing was pushed.

Baseline worktrees, KEPT for the review (delete only once Codex has finished with them): `/Users/peterdomokos/projects/switchplay-main-baseline` (main) and `/Users/peterdomokos/projects/switchplay-head-baseline` (`40c7626`). Both are detached and hold a cloned `node_modules`.

## Inspect the merge against both parents

```
cd /Users/peterdomokos/projects/switchplay-merge
git log --oneline --graph -6
git diff 6abeda4^1 6abeda4          # what main brought into Group Experience
git diff 6abeda4^2 6abeda4          # what Group Experience brought into main
git show --diff-merges=cc 6abeda4  # combined diff: only the lines that differ from BOTH parents
git show --diff-merges=dense-combined 6abeda4
git diff 40c7626 1bab585 -- tests scripts   # test and fixture additions after the merge
git merge-tree --write-tree 40c7626 69a4bc6 # re-simulate the textual conflicts
```

The combined diff (`--diff-merges=cc`) is the most efficient view of the resolutions: it shows only hunks where the merge result matches neither parent.

## Conflict resolutions to review carefully

10 files conflicted textually. Highest risk first.

1. `src/lib/cards/repository.ts` (5 hunks). Imports now carry both `assertNoGroupMediaReferences` (this branch) and the image ownership imports (main), plus `assertStepMediaWrite`. Check the order and presence of, in `createCardFork`, `createCardDraft` and `saveCardDraft`:
   - content validation, then Step Media Protocol write gating, then date handling (`withInfoAttachmentDates`), then `assertImageAttachments`;
   - `saveCardDraft` keeps `content = withInfoAttachmentDates(content, current)` and `assertStepMediaWrite(this.stepMediaProtocol, content, current)`.
   Question to answer: could any write path skip an ownership or media check that either parent applied?
2. `src/lib/cards/domain.ts`: both import sets kept. The merged strict allow-lists must accept both `infoCardAttachedAt` and `mediaItems`, on introduction and steps.
3. `src/components/auth/AuthScreen.tsx`: after a successful sign in, in order: `workingCardStore.clearSession()`, `startGroupLogin(user.id)`, then the visual guest handoff when a guest is present (asynchronous, deliberately not awaited), then navigation.
4. `src/components/decks/DeckScene.tsx` and `FocusedCardView.tsx`: the scene is wrapped in `VisualLearningRecordsProvider` (main) with the Group props (`comparisonFraction`, `onFaceChange`) kept. `deckVersion` is passed in both focused-view paths. Check the provider closes at the right place and the account used is the signed-in user (see Visual Learning Records below).
5. `src/components/creator/cardArchitectureAdapter.ts`: keeps the `infoCardAttachedAt` spread and main's introduction `mediaItems` choice.
6. `scripts/test-phase2.ts` (6 hunks): combined harness (flags, collections and indexes, seeding order, environment, the `--dev` branch, runner argument filter). Test infrastructure only.
7. `tests/card-video-preparation.spec.ts`, `tests/deck-video-preparation.spec.ts`: took main (same loader plus a StrictMode tolerant assertion).
8. `next.config.ts`: kept this branch structure (fixture and optimised handling). **Main added an unconditional `allowedDevOrigins: ["192.168.1.38"]`, a developer LAN address. It was deliberately NOT carried over.** If that dev setting is wanted it should be reintroduced deliberately, preferably from an environment variable.

Auto-merged files that were read and judged correct: `CreatorDragLab.tsx` (contains main navigation save error handling and the `infoCardAttachedAt` pruning), `StepView.tsx` (keeps the `allowEmpty` pouch condition and main media tabs), `types.ts`, `libraryProjection.ts`, `creatorBoardState.ts`.

## Interaction gap found by the new tests (fixed in commit 5)

After the merge, any Group Card with an instructional image in a Step or introduction showed "Image unavailable." with no Retry control. This is an interaction defect: neither branch had it alone.

- Cause: `FocusedCardView` builds the image request from `playbackViewerUserId`. Main passes it where it renders a focused Card in the Library (`LibraryShell`: `renderFocusedCard={props => <FocusedCardView {...props} playbackViewerUserId={currentUserId} ...>`). The Group render path in `GroupExperienceDeck` passed `playbackViewerUserId={actor}` to `DeckScene` only. The focused Card therefore had no viewer, no image context was built, and the canonical image route was never called.
- Fix: `GroupExperienceDeck.tsx`, `renderFocusedCard`: add `playbackViewerUserId={actor}` to the `FocusedCardView`. `actor` is the signed in user, the same identity already given to the scene and the Visual Learning Records provider. Nothing is attributed to an inspected follower.
- No authorisation, ownership or provenance check was touched.
- Review prompts: confirm no other Group render path builds a `FocusedCardView` without the viewer; and consider whether passing the viewer enables card playback grants for Group video when `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1"` and no shared resource exists (correct for canonical public versions, as in the Library, but not exercised by any test; the harness sets that flag to 0).
- Verified (historical): `group-step-media-images.browser.ts` fails without the line and passes with it. That establishes the image gap only; pinned-version behaviour is covered separately since the review (see the update section above).
- Protected video for Group Cards is **not covered by any checked-in test**. See "Protected video: what each test establishes".

## Things to check that are not visible as conflicts

- **Image ownership is unchanged and not weakened.** `instructionalImageAllocations`, `assertImageAttachments`, `assertImagePublication`, `prepareImagePublication`, `inheritImageAllocations`, `/api/media/instructional-image` and `resolveInstructionalImage` are main code, taken as is. No compatibility path for legacy media was added.
- **Group media guard** (`assertNoGroupMediaReferences`) must now also scan nested `mediaItems`. It does, by scanning nested content for `group-media/` paths and for reserved Stream asset ids. Covered by integration test 3.
- **Visual Learning Records belong to the signed in user.** `GroupExperienceDeck` passes `playbackViewerUserId={actor}` where `actor` is the signed in user, `DeckScene` gives the provider `hasPersonalDeck(deck) ? deck.dataOwnerUserId : playbackViewerUserId`, the provider keys the service by `account:<id>`, and the API uses the session. Reasoning verified by reading the code. **There is no test that switches to a follower perspective as an admin and asserts no write reaches the follower. This is a gap; see Remaining gaps.**
- `tests/helpers/personalMediaReviewProvider.ts` re-exports the real instructional image functions through the `?actual` query so fixtures do not bypass ownership.

## Test results

Environment: the merge worktree has its own `node_modules` (`npm ci`). Typecheck must be run as `npm run typecheck` (it runs `next typegen` first); plain `tsc --noEmit` reports false `RouteContext` and `PageProps` errors.

| Suite | Merge | Group Experience (`40c7626`) | main (`69a4bc6`) |
|---|---|---|---|
| `npm run typecheck` | clean | clean | clean |
| Unit (`tests/*.test.ts`) | 729 / 729 | 637 / 637 | 524 / 524 |
| Integration (`tests/*.integration.ts`, concurrency 1) | 614 / 615 | 561 / 562 | 380 / 380 |
| New integration (`tests/main-merge-interactions.integration.ts`) | 3 / 3 | n/a | n/a |
| New component spec (`tests/auth-login-handoff.spec.ts`) | 4 / 4 | n/a | n/a |
| New browser (`tests/phase2/group-visual-records-stack.browser.ts`) | 8 / 8 | n/a | n/a |
| Existing stack layout browser (`group-initial-stack-layout.browser.ts`) | 16 / 16 | 16 / 16 | n/a |
| New browser (`group-step-media-images.browser.ts`) | 3 / 3 | n/a | n/a |
| New browser (`group-visual-record-ownership.browser.ts`) | 3 / 3 | n/a | n/a |

Final verification round, run after commit 5 (`--group-experiences`): `group-initial-stack-layout`, `group-visual-records-stack`, `group-experience-perspectives`, `group-login-perspective` and the two new specs: 39 passed, 2 failed. The 2 failures are the known `group-login-perspective` cases (fresh follower login, Chromium and WebKit), which also fail on `40c7626`. `npm run typecheck` is clean and ESLint reports no problems on every file changed in the final round. The full browser, integration and unit suites were NOT repeated after commits 4 to 6, because they touch only `next.config.ts` (development phase only), one prop in `GroupExperienceDeck.tsx`, and test files. The Group media specs (`--group-media`) were not re-run after the one-line fix.

The single integration failure is test 220, `a migrated Group resumes learning and assessment operations without modifying personal data`. It fails identically on `40c7626`, so it is **pre-existing**, not caused by the merge. It was not investigated further.

The integration counts were taken before the three new files were added; the new files were then run on their own.

### Browser suites (Playwright, `scripts/test-phase2.ts`)

Run on the merge, then every failing spec file was re-run on the parent that owns it, with the same flags.

| Group | Merge result | Verdict |
|---|---|---|
| Info Cards (`--info-cards`, 7 specs) | 69 passed, 0 failed | clean |
| Group experiences fixture (8 specs) | 39 passed, 13 failed, 2 skipped | the same 13 fail on `40c7626`: pre-existing |
| Group media and loading (`--group-media --complete-loading`) | 67 passed, 15 failed | 11 failures are common to both. Remaining differences were investigated: pre-existing (below) |
| Creator (9 specs) | 73 passed, 13 failed | all 13 also fail on main: pre-existing |
| Step media specs | 2 passed, 8 failed | 7 fail on main with `INSTRUCTIONAL_IMAGE_FORBIDDEN`; the 8th is a pre-existing flake (below) |
| Visual records and geometry | 30 passed, 7 failed | the same 7 fail on main: pre-existing |

Detail on the cases that first looked like regressions:

- `integrated-card-media`: passed on main in one run, failed on the merge. Repeated runs: merge 3 passed of 5, main 3 passed of 4. Identical failure on both (`Expected 2, Received 1` rows after an upload in the Step media dialog). **Intermittent on both: pre-existing.**
- `media-ux`: `Admin inspection Centre is remove-only` and `Group Card upload refreshes newest thumbnails and exact Gallery item without reload` failed only on the merge in the first runs. Repeated 5 times each on both sides: merge 7 failed of 10, `40c7626` 7 failed of 10, with exactly the same split (5 of 5 and 2 of 5). **Identical on both: pre-existing.** The dominant failure signature across `media-ux` and `focused-signal-arbitration` is the horizontal flip drag not taking effect (`Expected pattern: /is-flipped/`), seen on both sides.
- `group-integrated-acceptance` cannot be run with these fixtures (it requires `PHASE11_REVIEW`), so it was not run.
- `info-cards-live-media` was not run: it is restricted to explicitly authorised live provider runs.
- Specs not run: `phase5-acceptance`, `group-progress-*` (other than `group-progress-navigation`), `area-*`, `library-*`, `assessment-*`, `framework-*`, `fork-foundations`, `update-adoption` and similar older foundations. None of them touch the merged surfaces beyond what other suites cover, but they were not run against this merge.
- The `--visual-review` fixture start-up was not exercised separately.
- The causes of the pre-existing failures were NOT investigated. They are classified only by "fails the same way on a parent".

## New regression tests and what they establish

1. **`tests/phase2/group-visual-records-stack.browser.ts`**: a **stack-stability check during delayed Visual Learning Records module release or failure** (browser, Chromium and WebKit, viewports 390x664 and 375x560, service available and unavailable). It opens a Group Deck as admin, waits for the presentation to finish, then lets the real `VisualLearningRecordsProvider` update by releasing (or failing) the lazily loaded service module, which the test holds back until then. It records every animation frame and requires scale, scene height and every Card top to be exactly equal to the settled frame: no tolerance. A vertical swipe must still change the active Card.
   - **Limitation (prominent in the file header):** today only `FocusedCardView` reads the provider, so a provider update does not re-render `CardStack`, and this test passes with or without the `layoutDependency` fix from `40c7626`. It does **not** independently establish that the original vibration fix is effective, and removing the fix is not expected to fail it. A one-off temporary mutation (not committed, not repeatable from the file) subscribed `CardStack` to the provider and removed `layoutDependency`; all 8 variants then failed on the exact `tops` comparison. That shows the assertion would catch movement if a provider update ever reached the stack without the fix; it is a guard for that future change, not evidence about the current code. It skips on optimised builds (`PHASE2_OPTIMIZED=1`).
   - The test that does sample the stack on entry and resume is `group-initial-stack-layout.browser.ts` (unchanged).
2. **`tests/main-merge-interactions.integration.ts`** (3 tests): `mediaItems` and `infoCardAttachedAt` coexist through save, publish, Library, presentation and the Creator **adapter** round trip (pure functions, not the Creator interface), and a client without the Step Media Protocol is still refused; image ownership applies to Card `mediaItems` image entries including publication and resolution of an authorised image reference (object storage is a stubbed S3 client; no bytes are served); Group media is refused inside nested `mediaItems` **through the Card create and save paths**.
   - **Not covered:** Deck content and the graph write paths (`createPrivateGraph`, Deck saves) for the Group media restriction and image ownership. The review found a pre-existing validation defect on those paths. Fixing it needs a production change and is outside this test and documentation scope. It remains an open item.
3. **`tests/auth-login-handoff.spec.ts`** (4 tests, real `AuthScreen` bundled with its four collaborators replaced by recorders): a sign in **invokes** the client scope clearing, then the Group login perspective start (the only ordered pair), and then, in either order, the guest-handoff collaborator, the refresh or the return navigation; no guest means no handoff invocation; a rejected sign in invokes none. The four collaborators are recorders, so the real handoff, session and perspective modules are not run. The test does not assert that the response body is read once.

## Protected video: what each test establishes

Four different things are easily conflated. None of the checked-in tests below plays protected video for a Group Card, and none contacts Cloudflare.

| Layer | What is real | What is simulated | Established | Not established |
|---|---|---|---|---|
| Repository authorisation (`tests/protected-media.integration.ts`) | Real in-memory MongoDB, real `authorizeProtectedMedia` and `authorizeCardPlayback` | Nothing about delivery: it is not reached | Which actors may be authorised for which stored references and exact public or adopted versions; no writes | Byte delivery, grant issuance, playback; the HTTP route |
| Route behaviour (`tests/protected-media-route.test.ts`) | The real route handler | Authentication, repository, both authorisation functions and `streamPlaybackGrant` are fixtures | Status codes, private no-store headers, actor binding, sanitised errors; the route calls the grant provider once and returns its descriptor | Real authorisation rules; real grant issuance |
| Simulated browser grants (`card-video-preparation.spec.ts`, `deck-video-preparation.spec.ts`; tests labelled "simulated grants" in the Card file) | Real `FocusedCardView`, `DeckScene`, player and poster code, bundled with the protected flag on | Grant and status responses, thumbnails (generated SVG), `videodelivery.net`, video element readiness | How the component requests, retains, shares and releases grants and prepared images | Server authorisation or issuance; real decoding; Group Cards |
| Local decoding (Card file: "real local-WebM decoding, protected mode disabled") | Real decoding and compositing of local WebM fixtures in Chromium and WebKit | Transport URLs; protected mode is **disabled**, so no grant is requested | The thumbnail to video handoff has no black gap | Protected playback; HLS; Safari HLS |
| Review provider (`tests/helpers/protectedMediaReviewProvider.ts`) | Real authorisation functions | Image bytes come from the fixture media server; **Stream grant and token issuance are disabled (both throw)** | The disposable review fixtures cannot reach Cloudflare | Anything about video |

Group Cards: the one-line fix (`playbackViewerUserId={actor}` on the Group `FocusedCardView`) means a Group Card now passes a viewer, so with `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1` and no shared resource, `FocusedCardView` requests card playback grants. The review ran a successful Group protected-video probe. It was an **ad hoc component probe with simulated issuance and decoding**. It is not a checked-in test and is not live Cloudflare verification. Live Cloudflare Stream playback of a Group Card remains unverified.

## Verification after the review corrections

Run in `/Users/peterdomokos/projects/switchplay-merge` on the uncommitted changes, after the corrections (the earlier tables above are historical and unchanged):

| Check | Result |
|---|---|
| `group-step-media-images.browser.ts` + `group-visual-record-ownership.browser.ts` (`--group-experiences`), two fresh runs | 6 / 6 passed, then 6 / 6 passed |
| Same two plus `group-initial-stack-layout` and `group-visual-records-stack` in one run | the 24 stack tests (16 layout, 8 stability) and the 3 ownership tests passed; the media test failed once on the stricter "no Group requests" window (an authority check from the refresh clock). The assertion was narrowed as described above and the two fresh runs above followed |
| `main-merge-interactions.integration.ts`, `protected-media.integration.ts`, `protected-media-route.test.ts` | 8 / 8 passed |
| `auth-login-handoff.spec.ts`, `card-video-preparation.spec.ts`, `deck-video-preparation.spec.ts` | 27 / 27 passed on the final run. One earlier run failed "simulated grants: renewed grants replace thumbnails ..."; it is intermittent on both sides: 1 failure in 5 runs on this branch and 1 failure in 5 on main (`69a4bc6`) |
| `npm run typecheck`; ESLint on all changed test files | clean |

Notes: `--repeat-each` is not valid for the two Group specs because the repeats share one disposable database and the ownership spec expects the admin to have no record yet (true of the original spec too); use separate harness runs. The `group-login-perspective` failures and the other pre-existing failures listed above were not re-run and are unchanged. The mutation checks for the rewritten tests, the full unit, integration and browser suites, and the `--group-media` specs were not re-run.

## Remaining gaps and risks

- Group Card media tabs, authorised images and pinned versions (`group-step-media-images.browser.ts`), and visual record ownership across Group, follower and Me, including in-place perspective switching (`group-visual-record-ownership.browser.ts`), are covered. The earlier temporary-mutation checks (media test fails without the commit 5 fix; ownership test fails when the provider is attributed to the inspected follower) predate the rewritten tests and were **not repeated** for the new assertions.
- **Open:** protected video playback for Group Cards under `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1` has no checked-in test and no live Cloudflare verification.
- **Open:** Deck content and graph write paths are not covered for Group media restriction and image ownership (pre-existing validation defect, production change required).
- "Me" exists only for a member of the Group, so the admin in the new media test covers Group and follower, and the follower covers Me. This is the existing permission model.
- The new specs create their own Group (admin plus one follower) through the real Creator and repositories, take about a minute of set up each, and rely on the main object store fixture from commit 2. They assume the `--group-experiences` fixture and the `phase2` and `other` style accounts.
- Pre-existing failures listed above remain; reviewing them was out of scope and none was fixed.
- Group images are only requested for public Card and Deck versions (a Group manifest only accepts public versions, and the route checks version access). A private Deck used in a Group is not a supported case here and was not tested.

## Accepted limitations

- **Legacy images.** No image migration was implemented, by decision. Cards whose images use legacy keys (for example `path-templates/...`) fail provenance verification and will need their images replaced manually. A read-only audit found 14 R2 references and 97 local demo images that would need manual replacement. Main image ownership and security checks are intentionally not weakened and no compatibility workaround exists.
- No database records were modified by the merge or by any test; tests use disposable in-memory MongoDB. The earlier legacy image investigation ran read-only audit scripts (find and count only, no writes) against the database named by the local environment configuration.
- Process note: an earlier round ran one broad `pkill -f mongod`, which may have stopped unrelated MongoDB processes. The final round only started and stopped its own dev servers by process id.
- The hard-coded developer LAN origin from main was not carried over. It is replaced by an optional development-only setting (next section).
- Physical iPhone verification of the Card stack is still required, as stated in commit `40c7626`.

## Physical iPhone development access

Checked, and found broken, then fixed in commit 4. With the merged config, a plain `npm run dev` returned 403 to dev assets and hot reload for a request carrying the Mac Wi-Fi address (main had hard-coded `192.168.1.38`, which was deliberately not carried over). Fix: an optional list read from `SWITCHPLAY_DEV_ORIGINS` (comma separated, for example in `.env.local`), applied only in the Next development server phase. Unset, nothing changes. Production phases ignore it, and the Phase 2 harness setting (`SWITCHPLAY_REVIEW_ORIGINS`) still takes precedence. README documents it.

To use it: put `SWITCHPLAY_DEV_ORIGINS=192.168.1.38` in `.env.local` (the Mac current address; the Mac `en0` address was 192.168.1.38 at the time) and restart `npm run dev`.

Verified against a real dev server with a cross-site request carrying the Wi-Fi address as Origin and Referer: unset, assets and hot reload both 403; set to the address, assets 200 and the hot reload endpoint passes the origin check; set to a different address, both stay 403. A config probe showed the production build and server phases return no `allowedDevOrigins`. Not tested on a physical iPhone; that remains a manual check.

## Decisions still needing approval

1. How to treat the pre-existing failing browser specs (leave, or fix separately). None was fixed here.
2. Integration route into `feat/group-experience` (fast forward or a merge commit), after Codex review. `feat/group-experience` has NOT been updated: it is still at `40c7626`.
