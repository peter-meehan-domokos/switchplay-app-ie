# Phase 10 — Group reflections implementation and iPhone review

## Resume here / approval boundary

Phase 10 implementation and automated verification are complete. The founder has explicitly authorised committing this baseline before the separately requested reflection context/arrow layout refinement. That refinement remains subject to physical iPhone acceptance and must stay uncommitted. Do not merge Personal Info Cards or begin Phases8,9 or11.

Baseline: accepted Phase7 commit `00a157e` on `feat/group-experience`, following `4447011`, `2dd1c0d` and `642171d`. Working tree was clean at Phase10 start. All current changes belong to this commissioned checkpoint. No existing commits were rewritten, and no persistent database/provider was used.

Authoritative specification: engineering plan §11.2, Phase10 and related acceptance rows now record the latest founder clarification. Tapping text/Add opens the existing modal in **every** perspective. The separate Refined A arrow navigates; Group-only autoplay/fade remains. No reflection menu or Deck-menu reflection action was introduced.

## Implemented

### Storage, ownership and reads

- Personal reflection remains the existing CardData string. Optional `reflectionRevision`, original `reflectionCreatedAt` and last-operation metadata support CAS/exact retries. Unknown legacy dates remain unknown; scalar writes do not change reflection revisions. New empty Personal records have an explicit nullable original date; the server records a witnessed first creation. Clearing/re-authoring does not fabricate a new original date.
- `groupReflections` contains one unique author/Card/Group slot, immutable source/author/original creation time, text, revision, independent visibility and deletion state, and bounded last-operation metadata. No Group text is copied into Personal CardData; no extra personal record or Follower Card is created for an Admin.
- Explicit Group setup provisions reflection identity/slot/history indexes. Request paths never create collections/indexes. Group mutations fail closed without required indexes. Ordinary Personal reflection reads work without Group collections/readiness.
- Authenticated authors read their exact-Card Group history through the author/Card index independently of original membership or Group availability. Origin names and current authority/scope are resolved in batches. Former members can read/delete their own retained contributions; Group editing requires current membership, selected Card and captured epoch.
- Foreign Group/inspection reads query shared, nonblank, non-deleted current-Group rows at MongoDB, with an explicit reflection-only projection. They never query foreign Personal CardData or retrieve hidden/other-origin reflections and strip them later. Public usernames use the established identity fallback. Inspection requires current subject membership and the existing Admin/peer policy.
- Admin removal changes Group visibility only, preserving author text/origin/history. Creator deletion clears/tombstones the exact owned source. Revision checks, transaction fences, exact operation identity and retained slot reservations reject stale writes/retries. Editing, rejoining or re-authoring never implicitly unhides an Admin-hidden contribution.
- Existing trusted internal Personal snapshot writes remain compatible; all HTTP writers supply reviewed revisions (legacy HTTP absence means revision0). Duplicate malformed Personal slots cannot be edited/cleared together. Existing fork/history behavior is preserved.

### Card and modal interaction

- Ordinary Personal view starts with Personal text/Add. Own Group view starts with current-Group text/Add, even when hidden. Other own sources follow original creation order, with undated legacy Personal last in a Group. Display resets on Card/context opening; keys identify sources, not carousel indexes.
- An authorised Admin's Group Card starts with their own current-Group working text/Add slot, without enrolling them as a Follower. Other visible contributions follow in creation order, including still-visible former-member contributions. Ordinary members get shared entries only. Group-wide labels are author usernames; individual labels identify origin. Own nonshared Group-context entries show the approved Private indication.
- Existing bottom-right reflection text/Add presentation and editor shell are reused. Only current-author/current-context text is editable. Other owned origins open read-only with author Delete and accurate original-context/former-membership explanations. Foreign text opens read-only; Admins may remove its Group visibility, never delete its underlying text.
- Manual arrow navigation wraps and appears only for at least two items, including an empty current slot. Individual views never auto-rotate. Group view rotates every5seconds with a200ms opacity fade, pausing for inactive/hidden Card faces, hidden documents, focus/editing and reduced motion. Text taps never advance.
- The reference-based **Refined A** icon is inline SVG: one clockwise open arc, fading lower-left tail, slate-blue gradient depth, restrained upper-right highlight and heavier diagonal-down/right head. No icon library, image asset, background or border. SVG24px/CSS target48px compensate for Card scaling: verified390px viewport yields **22.71px visible icon** and **45.42px touch target**. Absolute positioning preserves text/Card geometry and the existing sparse/no-media offset.
- Source-bound drafts, current authority and request generations prevent perspective/account/Card changes or late responses retargeting operations. Foreign data never enters the Personal working store. Owner-only history survives temporary scalar-save revalidation; Group controls still require verified authority. Gesture interception applies to pointer sequences starting in the reflection controls, preserving Card flips that start outside and cross the arrow.

## API contracts

`GET /api/reflections`

- Personal owner history: `cardTemplateId` only.
- Own Group: `cardTemplateId,experienceId,mode=own,accessEpoch`.
- Group Card: same with `mode=group`.
- Inspected member: `mode=inspection,subjectUserId` plus the same Group authority.
- Returns explicit viewer/Card/view identity, access epoch/adoption revision, ordered source-aware items and server-derived edit/delete/hide capabilities/explanations. Cache is private/no-store. Group reads use current membership/scope/peer policy and membership/adoption fences.

`POST /api/reflections`

- `action=save|delete|hide`, exact typed source, `operationId`, `expectedRevision`; Save includes text and appropriate current context (`deckTemplateId` for Personal, captured `accessEpoch` for Group). Group hide also requires captured epoch. Creator delete needs authenticated ownership, not original membership.
- Group source is `(experienceId,cardTemplateId,reflectionId)`; Personal source is its CardTemplate. Actor comes from authentication. Header actor identity and same-origin protections are enforced; callers cannot supply a foreign owner. List position is never a mutation target.
- Existing Personal Deck PATCH reflection operation remains supported with additive `expectedReflectionRevision`/`operationId`. Stale/unversioned writes cannot overwrite a newer reflection revision.

## Disposable review environment

Fresh dedicated export: `/private/tmp/switchplay-phase10-review`.

Phone Group URL (plain text):

http://192.168.1.38:4192/decks?openExperience=7facd9be-07ea-4159-ab6a-0d3429773aba

Ordinary Personal Deck:

http://192.168.1.38:4192/decks?openDeck=e2a1dc06-6a58-44ff-a117-fa32a3a30615

Credentials: **Aoife Kelly / local-test-only** and **phase2 / local-test-only**.

- Aoife is an active Follower and **not** an Admin. phase2 is an Admin and **not** a Follower. Neither review account is dual-role; the existing independent-role model remains supported and existing Group tests cover dual-role behavior. No artificial individual Follower Card was created for phase2.
- Runner PID7712; app PID7753. Metadata: `/private/tmp/switchplay-phase10-review/phase2-test-results/review-server.json`. Disposable memory replica-set database: `switchplay_phase2_browser_404983fca4334e22bd021f102ba536fe`. No Atlas or real Cloudflare credentials/data.
- Seed runs exactly once when this runner starts. Account changes, reloads and repeat logins retain the same reflection/media IDs and any edits/hides/deletions. Stopping/restarting this memory runner discards data and creates fresh IDs/URLs: announce a reset first. Do not silently recreate the environment after founder actions.
- Existing review services and their data were not reset or modified. Separate test export4191 contains automated test actions and is not the founder review URL.
- Start command from the review export: `SWITCHPLAY_REVIEW_PORT=4192 node --import tsx scripts/test-phase2.ts --dev --lan --group-media --group-reflections`. Ctrl+C in that runner stops its own disposable services. Restart only after acknowledging the reset.
- Actual LAN login, page rendering and Admin feed were checked. No browser page errors. Screenshot: `/private/tmp/phase10-iphone-review.png`; Chromium/WebKit screenshots also at `/private/tmp/phase10-{chromium,webkit}-reflection-arrow.png`.

### Short review route

1. As Aoife, open **Find your balance**, flip its focused Card to the back. Current Galway U18 reflection is first. Tap to edit; use the separate arrow to visit the Galway development and Personal reflections. These open read-only here with author deletion; the development explanation correctly recognises she has left that Group. Compare the Refined A arrow with the supplied reference at actual phone size.
2. **Control the movement** starts with Add for the empty current-Group slot, despite a retained development reflection. Add text, navigate away/back, and verify the correct slot remains first. In the ordinary Personal Deck this Card also starts with its empty Personal Add slot.
3. **Make it consistent** has the long reflection. Card text truncates; the modal retains the complete text. Check manual navigation and unchanged Card/media geometry.
4. As phase2, view the **Group** Card. Its first reflection discusses the Group; tap to edit it. Other member/former-member text opens read-only with Remove from Group. The arrow navigates independently and Group autoplay/fade pauses during the modal. The third Card provides an empty Admin working Add slot.
5. Hide Aoife's reflection as phase2, then sign back in as Aoife. The same reflection remains in her owner history and is Private in Galway U18. Deleting as Aoife removes the exact contribution across views. Switching accounts must not reseed or undo either action. Use the ordinary Personal Deck to verify the complete own history and Personal-only edit target.

## Automated verification

All persistence tests use fresh disposable MongoDB replica sets. Browser tests use the isolated4191 review export and local mock media providers. No real provider verification is needed for text reflection storage; existing Group-media release restrictions are unchanged.

| Actual command/check | Result |
| --- | --- |
| `node --import tsx --test tests/reflection-presentation.test.ts` |5/5 passed: empty first slots, ordering, unknown dates, stable identities, wrong/foreign sources and shared-feed assertions. |
| `node --import tsx --test tests/group-reflections.integration.ts` | Expanded13/13 passed: storage, exact retry/CAS, hiding/deletion, former-member retention, missing indexes, rollback, Personal dates, deliberate removal/save interleaving, peer policy and actual database projection allowlists. |
| Same integration file, `--test-name-pattern='unavailable originating'` |1/1 passed: owner read/delete with unavailable original Group. |
| Same integration file, `--test-name-pattern='ambiguous duplicate'` |1/1 passed: malformed duplicate Personal slots fail closed. |
| Same integration file, `--test-name-pattern='Personal new\|Personal reflection CAS'` |2/2 passed after the final duplicate-slot guard: successful Personal CAS/date preservation and exact delete retries. |
| `node --import tsx --test --test-concurrency=1 tests/group-reflections.integration.ts tests/personal-lifecycle.integration.ts tests/card-review-regressions.integration.ts tests/group-experience-perspectives.integration.ts` | Earlier cumulative31/31 passed (then8 reflection cases plus23 existing regressions). Later added reflection cases were run separately as above. |
| `node --import tsx --test --test-concurrency=1 tests/card-forks.integration.ts tests/group-experience.integration.ts` | Group13/13 passed. Initial fork11/13 exposed internal-call compatibility; after correction `node --import tsx --test tests/card-forks.integration.ts` passed13/13. No existing assertions were weakened. |
| `PHASE10_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json npx playwright test --config playwright.phase10.config.ts` |12/12 passed at the then-complete selection: current slot/order, manual wraparound/no individual timer, Group autoplay/source-aware modal, actual SVG dimensions, forged IDs/revisions/origins, cross-account hide/author delete, empty slots, truncation, and inspected permissions. |
| Same browser command, `--grep 'reduced motion\|late inspected'` | Added4/4 passed across Chromium/WebKit: reduced-motion/manual behavior and delayed foreign-response rejection after context switches. |
| Same browser command, `--grep 'ordinary Personal Add'` | 2/2 passed on the final follow-up (`/tmp/phase10-personal-editor-browser-final.log`). The first attempt was interrupted by development hot reload in Chromium; WebKit passed. Repeating after synchronization/build activity stopped passed both engines without an application change. Total distinct reflection browser cases:18 across both engines. |
| `PHASE7_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json npx playwright test --config playwright.phase7b.config.ts --grep 'Personal icon/count\|owner media and layout survive\|read-only Group signals own\|Group settings remains'` | Existing selection7/8 passed initially; WebKit exposed arrow-crossing gesture interception. After the targeted fix, same config `--grep 'read-only Group signals own'` passed2/2. Remaining7 cases were unchanged/passing. |
| `npx tsc --noEmit` | Passed. |
| Targeted `npx eslint` across every changed TypeScript/TSX file (inventory below) | Passed, no warnings. Initial new ref-in-render lint issues were corrected using effects. |
| `MONGODB_URI='' MONGODB_DB='' node node_modules/next/dist/bin/next build --webpack` in `/private/tmp/switchplay-phase10-build` | Final synchronized-source production build passed including Next TypeScript validation. No environment credentials copied; no database connection. |
| `git diff --check`; source checksum comparison with build/review exports | Passed. Nothing staged or committed. |

The full repository suite was not run; verification concentrates on reflection storage/privacy, affected Personal/fork/Group behavior and mobile media/gesture regressions. Initial failures and their corrections above are recorded rather than hidden as inherited passes.

## Changed-file inventory

- Specification/handoff: `docs/engineering/features/group-experience/group-experience-engineering-plan.md`, this handoff.
- Reflection server/display contracts: `src/lib/reflections/{model,presentation,indexes,groupRepository,reads}.ts`.
- API: `src/app/api/reflections/route.ts`; compatible existing Personal operation in `src/app/api/decks-data/[deckTemplateId]/route.ts`.
- Personal metadata/CAS and compatible transport: `src/lib/cards/{model,domain,repository,readModels}.ts`, `src/lib/deckMutations.ts`, `src/components/decks/{types,useWorkingDeck}.ts`.
- Explicit provisioning: `src/lib/groupExperiences/indexes.ts`.
- Reused Card integration: `src/components/decks/{BackCardFaceContent,WorkingFocusedCardView}.tsx`, `src/components/group-experiences/{GroupCardBack,GroupExperienceDeck}.tsx`.
- Reflection surface: `src/components/reflections/{ReflectionArea,ReflectionModal,ReflectionNextIcon}.tsx`, `src/components/reflections/reflections.css`.
- Disposable seed-once fixtures/harness: `tests/helpers/reflectionReviewFixture.ts`, `scripts/test-phase2.ts`.
- Verification: `tests/reflection-presentation.test.ts`, `tests/group-reflections.integration.ts`, `tests/phase2/reflections.browser.ts`, `playwright.phase10.config.ts`.

## Remaining acceptance and limitations

- Physical iPhone acceptance is outstanding, including the supplied icon's exact visual balance. Do not commit before approval.
- No new Group archival/deletion workflow was introduced. Author access is independent of originating Group availability, verified with removed membership and unavailable-origin tests; historical Group identity preservation remains the existing approved lifecycle requirement.
- Legacy Personal creation dates remain unknown by design. No historical dates are guessed from CardData modification timestamps.
- Live updates use existing polling/focus/local invalidation patterns, not realtime infrastructure. Foreign authority loss fails closed, and revisions protect mutations between reads.
- No product question remains unresolved. No new reflection menus, ownership model, media features, Info Cards integration, collection rename or later phase was implemented.
