# Phase 10 — Approved reflection redesign and iPhone review

## Current status — 5 November 2026

**Finalisation authorised by the founder: remove the member moderation UI, retain the approved layout and commit the Phase10 work after focused verification.**

The founder approved the collective reflection architecture and the current-context/two-area presentation. Baseline `36bbd6f` — `feat (group experience): add source-aware group reflections` remains the latest commit. The founder has now explicitly authorised committing the redesign, earlier approved Group-name warning and documentation after the final moderation-UI removal. The historical implementation/review records below are superseded where their carousel, labels, timer or approval status differs from this section.

### Implementation and preservation

- Additive optional `groupCardData.reflection`, independent `reflectionRevision` and bounded last-operation metadata identify one collective note per experience/Card. Missing fields read as empty/revision 0. No existing author-owned text is copied, converted, deleted or migrated. There is no new collection/index or invented collective author.
- Current members read the collective source; all current Group Admins edit that same note. Saves reuse current role/epoch/scope checks, transactions and membership/adoption fences. Atomic reflection revision checks reject conflicting Admin saves; exact retries are safe. Authority is rechecked before retries. Revocation during a pending save is covered.
- Narrow writes preserve Group learning, confidence, assessments and their revisions. First-row creation remains compatible with concurrent scalar learning writes. A collective note never enters Personal CardData or an Admin's author history.
- Existing Personal reflection strings and author-owned `groupReflections` remain unchanged. All-origin author history remains retrievable independently of originating membership, with existing Card identity, fork/inheritance and visibility semantics. The preview filters that existing history rather than restructuring it. This history is retained per-context contributions, not an archive of every text edit.
- Individual Cards show only the current Personal or Group source, including the normal authorised empty Add prompt. The original 102px corner note and existing modal are reused. Other-member inspection remains read-only. There are no context labels, visibility icons, carousel controls or automatic rotation on individual previews.
- Group Cards have two independent notes: the collective 102px note at the original bottom-right position, and a 130px member note 20px to its left. The collective note retains its original bottom anchor/offset; the later approved refinement left-aligns and raises the complete member area12px. The final founder decision removes all member moderation controls without changing this layout. Member username, colon and text form one continuous, three-line maximum preview; the stored full text is unchanged.
- Only currently Group-visible nonblank contributions enter the member carousel. Old Admin-authored contributions retain their existing authorship and visibility; they are not the new collective note. Tapping the member text advances/wraps for both roles, including quick repeated taps. A restrained 200ms fade respects reduced motion; there is no automatic rotation or separate navigation icon. No member contributions means no extra placeholder. Group Admin moderation UI is deferred; no Remove control or confirmation is rendered. Existing server ownership/visibility permissions remain unchanged.
- Existing source-bound request/draft identities, late-response rejection and private/no-store reads remain. Foreign reflections never enter the Personal working store. Pointer shielding is limited to interactions starting in the notes, preserving Card gestures outside them.
- The previously approved non-blocking Group-name warning remains: **Longer names may be shortened in some parts of the app.** It uses the existing Creator warning styles above 15 characters and does not restrict stored names. The redesigned reflection preview no longer displays shortened context labels.

### API and source contracts

- Existing `GET /api/reflections` owner/own-Group/inspection histories are preserved. For authorised `mode=group`, return a separate `collective` object with exact `group-card` source, text, independent revision and current `canEdit`. Existing author-history items are not reclassified.
- Existing `POST /api/reflections` additionally accepts `action=save` with `{ kind: "group-card", experienceId, cardTemplateId }`, text, operation ID, expected reflection revision and captured access epoch. Authentication supplies the actor. Exact source, same-origin, current Admin and selected Card validation apply. Clearing shared text uses Save with blank text; there is no collective author-delete operation.
- The reflection modal/controller reuses these contracts. Concurrent-save errors preserve the draft and instruct the editor to close/reopen against the latest revision; they do not silently overwrite another Admin's text.

### Actual verification

All MongoDB tests use disposable replica sets. Browser actions use the separate disposable automated-test export on port 4191 with mock media providers. No Atlas data, live media or provider configuration was accessed.

| Command | Actual result |
| --- | --- |
| `node --import tsx --test tests/reflection-presentation.test.ts` | **8/8 passed**: existing history/order invariants, exact current-context selection, member visibility filtering and existing name helper boundary. |
| `node --import tsx --test tests/group-reflections.integration.ts` | **21/21 passed**: all existing author history/privacy cases plus collective multi-Admin sharing, CAS/conflicting saves, exact retries, independent learning/tests revisions, role revocation, pending-save revocation and first-row/scalar race. |
| `node --import tsx --test --test-concurrency=1 tests/group-experience.integration.ts tests/group-assessments.integration.ts tests/card-forks.integration.ts tests/personal-lifecycle.integration.ts` | **50/50 passed**. Existing Group, assessment, fork and Personal lifecycle protections retained. |
| `PHASE10_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json npx playwright test --config playwright.phase10.config.ts` | **16/16 passed** across Chromium/WebKit after corrections: current-only previews, existing Personal Add/Save/Delete, collective editor/read-only member access, manual member wrap/no timer, empty areas, fixed layout, forged/stale source denial and delayed inspection response rejection. |
| Same browser command with `--grep 'Group notes keep fixed'` | **2/2 passed** after tightening the layout example to a genuinely one-line collective note against three member lines. Verified 102/130px source widths, scaled 20px gap, matching last visible text-line baselines, clipping and unchanged typography. Both screenshots visually inspected. |
| Same browser command with `--grep 'touch opens'` | **2/2 passed** in touch-enabled Chromium/WebKit contexts: tapping the collective note opens the existing editor; tapping the member note advances without opening a modal or flipping the Card. Final lint on the added test passed. |
| `PHASE7_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json npx playwright test --config playwright.phase7b.config.ts --grep 'Personal icon/count|owner media and layout survive|read-only Group signals own'` | Initial **5/6 passed**; Chromium outside-signal Card flip assertion failed while another browser selection was running. No cause established and no gesture code changed. Isolated repeat of `--grep 'read-only Group signals own'` passed **2/2** in Chromium/WebKit. The other four media checks had passed. |
| `npx tsc --noEmit` | Passed, including final application source. |
| `npx eslint src/app/api/reflections/route.ts src/components/group-experiences/GroupManagementForm.tsx src/components/reflections/ReflectionArea.tsx src/lib/groupExperiences/model.ts src/lib/groupExperiences/namePresentation.ts src/lib/reflections/collective.ts src/lib/reflections/model.ts src/lib/reflections/presentation.ts src/lib/reflections/reads.ts tests/group-reflections.integration.ts tests/phase2/reflections.browser.ts tests/reflection-presentation.test.ts` | Passed. |
| `MONGODB_URI='' MONGODB_DB='' node node_modules/next/dist/bin/next build --webpack` in synchronized `/private/tmp/switchplay-phase10-build` | Production build passed, including Next TypeScript validation. No environment credentials copied or database connection made. |
| `git diff --check`; review/build source comparison; actual LAN login/rendering/read | Passed. Founder review collective remains empty/revision 0. No old controls render. No review data reset. |

Initial reflection browser failures exposed rapid-tap wrap handling and a test route teardown race. Pending member identity now accumulates quick taps correctly; the teardown helper safely handles a closing browser. The complete 16-case selection subsequently passed. These results are newly executed for this redesign, not inherited baseline passes. The unrelated full repository suite was not run.

### Changed files relative to baseline 36bbd6f

- Collective persistence and contracts: `src/lib/groupExperiences/model.ts`, `src/lib/reflections/{collective,model,reads}.ts`, `src/app/api/reflections/route.ts`.
- Current-context selection/member filtering and reused UI: `src/lib/reflections/presentation.ts`, `src/components/reflections/{ReflectionArea.tsx,reflections.css}`. The committed old SVG module is dormant and is not rendered.
- Earlier approved Group-name warning: `src/components/group-experiences/GroupManagementForm.tsx`, `src/lib/groupExperiences/namePresentation.ts`.
- Regression coverage: `tests/{reflection-presentation.test.ts,group-reflections.integration.ts}`, `tests/phase2/reflections.browser.ts`.
- Specification: engineering plan §11.2, Phase 10, related ownership/data-model/permission/acceptance/decision rows; this handoff. Completed earlier phases remain intact.
- No fixture generator or persisted review records changed during this redesign. No media, signal, date, navigation, Personal Info Cards or later-phase implementation.

### Preserved disposable iPhone review

Plain-text LAN URL, verified after updating only source files:

http://192.168.1.38:4192/decks?openExperience=7facd9be-07ea-4159-ab6a-0d3429773aba

Ordinary Personal Deck:

http://192.168.1.38:4192/decks?openDeck=e2a1dc06-6a58-44ff-a117-fa32a3a30615

Credentials: **Aoife Kelly / local-test-only**; **phase2 / local-test-only**.

Aoife is Follower-only; phase2 is Admin-only. Neither review account is dual-role. Multi-Admin shared editing is verified in disposable integration fixtures; no extra follower perspective is invented for an Admin.

The existing runner remains `/private/tmp/switchplay-phase10-review`, PID 7712, app PID 7753; metadata is `phase2-test-results/review-server.json`. Its disposable memory database remains `switchplay_phase2_browser_404983fca4334e22bd021f102ba536fe`. IDs, existing reflection/media content and previous review actions are preserved across logins/reloads. **Do not restart/reseed to apply these changes.** Restarting this memory runner discards its state; obtain agreement before any reset. Existing start command, only for an explicitly agreed fresh environment: `SWITCHPLAY_REVIEW_PORT=4192 node --import tsx scripts/test-phase2.ts --dev --lan --group-media --group-reflections`. Ctrl+C in that runner stops only its own services.

Actual LAN check as phase2 returned HTTP 200, empty collective/revision 0/editable, the normal Add prompt and a separate attributed member note. No new collective text was seeded or written to the founder environment. The final Group editor should therefore initially show **Add a reflection…**, rather than silently reusing old Admin text.

Review steps:

1. As phase2, open the Group Card and flip to the back. Tap the right-hand Add prompt; enter a short shared note such as **Good teamwork.** Save and verify it stays at the original 102px corner position. Tap the left-hand member note repeatedly to advance/wrap; taps must not open the editor or flip the Card. Wait briefly to confirm there is no automatic rotation.
2. On the third Card (**Make it consistent**), the existing long member reflection provides the three-line/ellipsis example. Add a short collective note there too if desired; compare the two last-line baselines and comfortable gap. Existing member content is not modified by this step.
3. As Aoife, inspect the same Group Card: collective text is read-only and the member note still advances by tap. Switch to **My Card**: only Aoife's current Galway U18 note appears, with the original tap-to-edit behavior and no history controls. The second Card (**Control the movement**) has an empty current slot unless a previous review action filled it.
4. Open the ordinary Personal Deck: only Personal text/Add appears; other-context reflections remain retained by the owner-history API. Check long text clipping and familiar modal behavior. Existing media, signals, date and outside reflection flip gestures should retain their accepted presentation.

Screenshots with a one-line collective/three-line member layout example:
- `/private/tmp/phase10-two-notes-chromium.png`
- `/private/tmp/phase10-two-notes-webkit.png`

These two screenshots use the separate automated-test environment, sample collective text and DOM-only member stress text. No author fixture text/identity was changed. They are layout demonstrations, not evidence of migration or seeded collective text. Actual preserved founder environment, empty collective: `/private/tmp/phase10-review-two-areas-empty-collective.png`.

### Remaining boundary

The founder has authorised finalisation and the Phase10 commit after the final moderation-UI removal; no further approval blocks that requested commit. Group Admin reflection moderation, former-member contribution-deletion UI, separate history interface and edit-version archives remain deferred. The founder has now authorised the final commit. Existing ownership/privacy APIs and protections are preserved; no broader moderation or later-phase work was introduced. Polling/focus refresh remains the established mechanism, not a realtime service. No application deployment, persistent database migration or live provider check is required/performed. The only new moderation interface is the expressly approved visibility-only Remove confirmation.

No product or architecture decision is outstanding. The latest founder instruction authorises the final Phase10 commit after removing moderation UI.

### iPhone reflection Save correction — 5 November 2026

The founder reported Save doing nothing for both phase2 and Aoife. Reproduced over the actual plain HTTP LAN address using the separate automated-test export: `isSecureContext=false`, `crypto.randomUUID` unavailable, zero POST requests, editor remained open, and browser error `crypto.randomUUID is not a function`. ID generation threw before the existing request/error handler, so the server never received the save.

`ReflectionArea.tsx` now uses the established `clientId()` helper, based on cryptographic `getRandomValues`, which works on HTTP LAN pages. Source identity, ownership, permissions, revisions and exact retry reuse are unchanged. The same controller covers collective, individual Group and ordinary Personal reflections. No server or persistence change was needed.

Added Chromium/WebKit regressions that remove `crypto.randomUUID` before loading the page, then save/edit/reload as phase2 and Aoife. The existing Personal Add/Save/Delete test now runs with the same restriction. Added test operations restore the original text in the isolated automated-test database; founder review records and actions are untouched.

Verification:
- Actual LAN reproduction before correction: confirmed the error and no outgoing save request. New pre-fix browser regression also failed as expected waiting for a request.
- `PHASE10_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json npx playwright test --config playwright.phase10.config.ts --grep 'secure-context randomUUID|ordinary Personal Add'`: four new account/browser save/edit/reload cases passed; WebKit Personal passed. Chromium Personal initially lost the focused Card during navigation after saving. Its exact cause was not established; no unrelated navigation code was changed.
- Same command with `--grep 'ordinary Personal Add'`, isolated repeat: **2/2 passed**, both engines. Thus all six relevant scenarios passed, with the initial navigation failure recorded rather than hidden.
- `node --import tsx --test tests/info-card-drafts.test.ts tests/reflection-presentation.test.ts`: **11/11 passed**, including the existing LAN-compatible cryptographic ID test.
- `npx tsc --noEmit` and `npx eslint src/components/reflections/ReflectionArea.tsx tests/phase2/reflections.browser.ts`: passed. `git diff --check`: passed.
- Actual plain HTTP LAN save after correction returned HTTP 200 and updated the Card preview successfully, with `isSecureContext=false` and `crypto.randomUUID` still unavailable. Original test text restored afterward.
- Updated only `ReflectionArea.tsx` on the existing 4192 founder review export; no restart, reseed or reflection writes there. Existing staged changes were preserved; this fix/test/handoff delta is not staged or committed. Reload the phone page to load the corrected client before retrying.

This is a targeted client ID-generation fix; the already-passing backend integration/production build results above remain applicable. No repeat persistence suite or production build was needed for this helper substitution. Physical acceptance remains pending.

### Final founder amendment — remove moderation UI and commit

The founder explicitly requested removal of the Group Card member Remove control and authorised the Phase10 commit. This supersedes the prior physical-acceptance/no-commit boundary and the temporarily approved moderation UI. Group Admin reflection moderation returns to the backlog.

- Removed the button/CSS touch target, captured removal target, hide submission/selection handling and unused confirmation-modal properties/markup. The existing reflection editor remains unchanged in appearance and behavior. No backend hide capability, API permission, reflection data or ownership changed.
- Preserved130px left-aligned member note,12px upward offset,20px gap,102px right-aligned collective note and manual tap-to-advance. The single adjustment remains `src/components/reflections/reflections.css:23`, `.reflection-member-area { --reflection-member-offset: 12px; }`.
- Replaced browser moderation-action cases with explicit absence assertions for Admins and followers; retained layout, touch, saving, privacy/history and existing backend permission regressions. Updated the authoritative engineering plan to put the moderation UI on the backlog.
- Final verification: `PHASE10_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json npx playwright test --config playwright.phase10.config.ts --grep 'Group notes keep|moderation controls|touch opens|ordinary Personal Add|secure-context randomUUID'`: **12/12 passed** in Chromium/WebKit. Covers identical layout/offset, missing controls for both roles, manual touch navigation, Personal Add/Save/Delete, collective and individual Group Save/edit/reload without secure-context randomUUID.
- `node --import tsx --test tests/reflection-presentation.test.ts`: **8/8 passed**. `npx tsc --noEmit` and targeted ESLint on `ReflectionArea.tsx`, `ReflectionModal.tsx`, `BackCardReflectionFragment.tsx` and `tests/phase2/reflections.browser.ts`: passed. `git diff --check`: passed. Previously successful storage/regression results above remain valid because this final amendment changes UI only.
- Final isolated production build passed: `MONGODB_URI='' MONGODB_DB='' node node_modules/next/dist/bin/next build --webpack` in `/private/tmp/switchplay-phase10-build`, with final application source and no copied credentials/database access. Final source screenshots at the existing staggered-notes paths now show the same layout without Remove. Existing review records were not modified.
- The existing4192 review environment is updated by source copy only, without resetting or altering its records. Existing unrelated work is preserved. No later phase began.

---

<details>
<summary>Historical baseline, prior refinement and architecture-review records — superseded where noted above</summary>

# Phase 10 — Group reflections implementation and iPhone review

## Resume here / approval boundary

Baseline `36bbd6f` is committed. Later layout/name-warning refinements and the new context-only/two-area redesign are **uncommitted**. As of5November2026, the founder has requested an architecture review before approving shared Group persistence. Do not add shared reflection fields/APIs, change author ownership, migrate records or commit until that approval. The independent context-only selector and manual member-area UI are partial working-tree changes; the collective right-hand note is deliberately not wired to an author-owned substitute. Existing4192 review service still serves the prior approved-for-review layout; its data/identities/actions have not been changed or reset during this investigation. The review findings and next action are recorded at the end of this handoff.

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


## Uncommitted refinement after baseline commit36bbd6f

The founder explicitly authorised and received the completed Phase10 baseline commit first: `36bbd6f` — `feat (group experience): add source-aware group reflections`, with a detailed multiline body. Subsequent changes in this section are **uncommitted**, pending physical iPhone acceptance.

- Reflection text remains102px wide: **0% widening**. Existing absolute corner anchor and text typography/clamping remain; the footer uses a narrow two-column grid with context to the left of the unchanged icon/control. Label and visible icon centres align even with wrapping. Both context and48px invisible touch target together fit the text width, without overlap/clipping. No DOM wrapper/background/border or Card-height change was introduced. The existing grouping uses `display: contents`; text/context keep their200ms Group fade, independently of the steady icon.
- Per founder clarification, only reflection Group-context labels shorten beyond15 characters, including ellipsis: `Galway development team` displays `Galway develop…`. Personal labels and Group-wide author names retain their meanings. Complete stored names and other Group-name displays remain unchanged; full source labels and Private state remain available to assistive technology.
- Group settings uses the existing `creator-modal-counter creator-modal-counter--warning` styling for the non-blocking message **Longer names may be shortened in some parts of the app.** Warning appears above15 characters; existing120-character input/storage allowance and Save permissions remain unchanged. Shared create/edit form behavior is consistent. No name was changed in the review database.
- Changed implementation: `src/components/reflections/{ReflectionArea.tsx,reflections.css}`, `src/components/group-experiences/GroupManagementForm.tsx`, `src/lib/groupExperiences/namePresentation.ts`; focused tests in the existing reflection unit/browser files; corresponding specification and this handoff updated.
- Initial focused checks:6/6 reflection presentation unit tests;4/4 Chromium/WebKit layout/warning cases, including exact102px width, combined footer bounds, one-line/wrapped vertical centring, short/long snippets, unchanged Card bounds and non-blocking full Group names. TypeScript and targeted lint passed. Follow-up interaction/fade checks and actual review refresh are recorded below when complete.
- Existing disposable review data and account-switch history must remain intact. Update only the changed review source files; do not restart/reseed the runner. URL/credentials above remain applicable.


Refinement verification completed:

- `node --import tsx --test tests/reflection-presentation.test.ts`: **6/6 passed**, including the exact15-character compact-label boundary and preservation of the full name.
- Phase10 Chromium/WebKit config, `--grep 'reflection footer|only reflection context'`: **4/4 passed**. Checks include short/long text, one-line/wrapped context, shared102px footer/text bounds, non-overlap, vertical centres, unclipped labels, unchanged Card dimensions and the non-blocking settings warning.
- Same config, `--grep 'only reflection context|carousel still fades|read-only.*'`: **6/6 passed**, covering the full accessible context/Private label, existing read-only modal and unchanged200ms text/context fade with steady navigation.
- Same config, `--grep 'Admin Group working reflection'`: **2/2 passed**, preserving automatic rotation and source-specific modal permissions.
- Existing Phase7B config, `--grep 'read-only Group signals own'`: **2/2 passed**, preserving touch/mouse interception and Card flipping outside controls.
- `npx tsc --noEmit`, targeted ESLint on all changed TypeScript/TSX, and `git diff --check`: **passed**. No database/schema change warrants rerunning persistence suites for this refinement; the baseline persistence/build results remain recorded above.
- Updated only the changed source files on the existing4192 review export. The runner/database/IDs and prior actions were **not reset**. Actual LAN rendering verified102px text and102px footer. Updated screenshot: `/private/tmp/phase10-reflection-layout-review.png`.

Only the baseline was committed. The layout/name-label/warning refinement, tests and documentation remain unstaged and uncommitted for physical iPhone acceptance. No additional product question is pending.


## Architecture review —5November2026 — proposal awaiting approval

### Verified facts

- Personal reflection remains `users.cardsData[].reflection` keyed by user/CardTemplate; optional revision/original-date/last-operation metadata was added in the baseline. Group contributions remain unique `(authorUserId,cardTemplateId,experienceId)` rows in `groupReflections`, with immutable author/origin/source and independent visibility/deletion. No shared collective reflection exists in `GroupCardData` today.
- `readReflectionFeed` queries author/Card across all origins, merges the exact Personal slot and preserves ownership-based retained access independently of original membership. Foreign Group reads separately query only visible current-Group contributions. `/api/reflections` and `ReflectionArea` preserve explicit source/viewer/context identities.
- Current-context-only rendering can filter the existing feed without changing its retrieval contract or stored history. New `currentContextReflection` and `memberReflectionItems` helpers implement only this independent selection. History means current retained per-context contributions; existing writes overwrite text and creator deletion clears/tombstones it. This is not an edit-version archive.
- Reusing the same CardTemplate in different Decks/Groups reuses Personal CardData and existing per-Group reflection slots. Forks intentionally have new CardTemplate IDs. `inheritForkCardData` snapshots the current Personal reflection and retains a history-source pointer; reflection history reads do not automatically traverse Group-origin ancestor contributions. Personal media does traverse legitimate Personal source links, while Group-origin media uses exact author/Card retrieval. Preserve these existing distinctions, not a new ancestry policy.
- `groupCardData` is already unique by experience/Card and stores collective progress/confidence plus separately revisioned Group Card assessments. Learning writes update only their fields; `testsRevision` provides the relevant precedent for a separate reflection revision. Current role checks, epoch changes, transactions and member/adoption fences already exist.

### Recommended minimal addition — not implemented or approved yet

Add optional collective `reflection`, independent `reflectionRevision` and small last-operation retry metadata to the existing `GroupCardData` row. Missing legacy values mean empty text/revision0. Initialise required learning fields only if the row genuinely does not exist; never replace the whole row. Reuse its existing unique index, current-member reads, current-Admin writes, scope validation and transaction fences. Keep the collective source separate from author-owned reflection IDs and ownership DTOs.

The expected reflection revision must participate in the atomic write condition. Concurrent Admin saves from the same revision yield one success and one conflict; preserve the draft and request reload rather than silently merging. Scalar/test changes must not advance the reflection revision. Exact-operation retry metadata follows existing patterns. Losing Admin status revokes editing through the existing access epoch/fence; retaining Follower membership permits read-only access. Leaving entirely ends Group access, but the collective text stays with the Group for other Admins. This must never turn a collective note into the departing Admin's Personal history.

No author-owned row needs conversion, duplication, new IDs or migration. Keep old Admin-authored rows author-owned; never silently promote an old Admin's text to collective ownership. The new collective note should start empty unless deliberately authored through its eventual editor. Existing visible author-owned contributions remain eligible for the member area under unchanged visibility policy.

A collective-ownership variant in `groupReflections` is technically possible but requires broader ownership/type/index changes and brings no practical advantage here. A new collection, audit log, generic permissions framework, or restructuring media/Personal CardData is unnecessary.

### Prospective impact and acceptance

If approved: update `groupExperiences/model.ts`, a narrow collective reflection service, source/read contracts in `reflections/model.ts`/`reads.ts`, `/api/reflections`, existing `ReflectionArea`/modal integration and scoped tests. Preserve current author repository and historical-owner reader. Add multi-Admin same-note/CAS/retry tests, role-removal/adoption/first-row races and isolation from learning/assessments. Existing author-ownership/privacy/history tests stay; rewrite only browser expectations superseded by the approved presentation. Add exact-context-only previews, manual member tap/wrap/no timer, hidden filtering, empty areas and fixed102/130px widths/20px gap/bottom-baseline mobile checks.

No new persistence model, migration, review-fixture changes, moderation UI or former-member deletion interface has been implemented. Independent UI draft is not complete and must not be presented as a finished shared Group editor. Next action: receive approval for the minimal shared GroupCardData addition and no-conversion default, then finish the two-area implementation and its dedicated automated/phone review. Do not restart/reseed4192.

</details>


<details>
<summary>Historical stagger and temporary moderation UI verification — superseded by final removal</summary>

### Current amendment — staggered member note and Admin Remove

**Offset adjustment: `src/components/reflections/reflections.css`, `.reflection-member-area`, `--reflection-member-offset: 12px;` (line23).** Change only `12px` to `8px` or `16px` to try those offsets. `bottom: calc(62px + var(--reflection-member-offset))` moves the complete member note and its Remove target together. Do not change the collective `.reflection-area` anchor or the shared sparse/no-media offset. Larger positive values move the member area further upward. This replaces the earlier common-baseline requirement.

- Member note remains130px wide with the20px horizontal gap, but is now left-aligned. Its inline username retains the same font/line height with a slightly subdued colour. The reused fragment accepts an optional prefix; ordinary Personal/collective text has no prefix and retains its original DOM geometry/style.
- The collective note remains102px wide, right-aligned, at its original position; no collective storage/editor/revision change. The member three-line clamp, manual navigation, ordering and fade remain.
- A small Remove text control appears only for the displayed contribution's existing server-issued `canHide` capability, while current interactive access is verified. It sits absolutely below the member text, within a48×48px minimum invisible source-layout target (at least44px measured in the mobile browser tests), without moving either snippet. The server continues to decide who may hide; author-owned contributions are not deleted or reassigned.
- Remove opens the existing reflection modal shell in confirmation mode, naming the captured author and explaining that Group visibility alone changes. Cancel/Escape/close/backdrop leave storage and carousel selection unchanged. Confirm uses the exact captured source/revision/access epoch and a LAN-safe stable operation ID; busy state prevents duplicate clicks. Success selects the captured next source or removes the empty member area, then refreshes through the existing scoped reader. Failure keeps the contribution and displays an error. Text taps still advance the member carousel and never open confirmation.
- Reused the existing hide API/repository. No persistence model, server permission, endpoint, ownership or personal-history change. Revoked Admins cannot issue a new hide or replay an earlier one. The existing `canHide` grant applies to another author's visible contribution; it does not grant new rights over the old Admin-authored rows.

Verification for this amendment:
- `node --import tsx --test --test-name-pattern='Admin hiding|source-aware owner history|revoked Admin cannot hide' tests/group-reflections.integration.ts`: **3/3 passed** using fresh disposable MongoDB. Includes actual visibility changes with retained author text/history and revoked-Admin denial of hide/replay.
- `PHASE10_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json npx playwright test --config playwright.phase10.config.ts --grep 'Group notes keep|Admin Remove|rejected Admin|touch opens|ordinary Personal Add|own and inspected'`: **12/12 passed**, Chromium/WebKit at390px, including touch. Checked widths/gap, opposite alignments,12px offset and independent8/16px experiments moving both text/control, three-line clipping, modal source/name, Cancel/no navigation, successful next/empty behavior, error handling, follower absence, existing individual/editor behavior and Card gesture isolation. Browser hide responses are deliberately simulated so reusable browser fixtures are not permanently hidden; real persistence/owner-history behavior is covered by the integration tests above.
- `npx tsc --noEmit` and targeted ESLint on `ReflectionArea.tsx`, `ReflectionModal.tsx`, `BackCardReflectionFragment.tsx` and the two affected test files: passed. `git diff --check`: passed. The isolated production build also passed: `MONGODB_URI='' MONGODB_DB='' node node_modules/next/dist/bin/next build --webpack` in the synchronized `/private/tmp/switchplay-phase10-build`, without copied credentials or a database connection.
- Follow-up browser command with `--grep 'Group notes keep'`: **2/2 passed**, explicitly checking one-line and three-line member examples without moving the collective note. Final test lint passed.
- Mobile screenshots, visually inspected: `/private/tmp/phase10-staggered-notes-chromium.png`, `/private/tmp/phase10-staggered-notes-webkit.png`; short examples `/private/tmp/phase10-staggered-short-notes-{chromium,webkit}.png`. These use separate automated-test layout examples; no founder contribution was rewritten for the screenshots.

Changed files for this amendment: the three components above, `src/components/reflections/reflections.css`, `tests/phase2/reflections.browser.ts`, `tests/group-reflections.integration.ts`, engineering plan §11.2/Phase10/related acceptance rows and this handoff. Existing staged work is preserved; no staging or commit was performed.

Actual LAN rendering verified the member width130px, left alignment, offset12px and available Admin Remove; collective width102px, right alignment and bottom62px remained unchanged. Screenshot `/private/tmp/phase10-staggered-founder-review.png` records the actual preserved review state. Only the four changed UI source files were copied onto the existing4192 review export. The runner/database/fixture IDs/content and prior review actions were not restarted, reseeded, hidden or overwritten. The LAN URL/credentials above remain unchanged. Reload the phone page to load this version. As phase2, inspect the Group Card, tap member text to advance, then try Remove → Cancel before confirming a visibility change. As the author, check that a confirmed hidden contribution remains in the current-context reflection/history. Followers should not see Remove. Physical iPhone acceptance remains outstanding; no later phase began.


</details>
