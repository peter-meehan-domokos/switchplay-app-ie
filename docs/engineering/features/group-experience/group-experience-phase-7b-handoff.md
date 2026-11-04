# Phase 7 Checkpoint B — Media UX integration

## Status / resume here

Implementation and automated verification complete on `feat/group-experience`, based on `642171daf037931e2c88bb7c818db5155920fe51`. **Uncommitted, awaiting founder physical iPhone acceptance. Do not commit before acceptance or begin later phases.** The 4 November review approved two visual amendments, now applied; the source-context Remove restriction and clearer fixtures are investigated below and await implementation approval. Intermittent disappearance remains unresolved. Physical acceptance/commit is still pending.

## Approved decisions implemented

- Use the custom SVG traced from the founder-supplied **icon.png**: rounded square interrupted at the **bottom-right**, with a smaller protruding plus at that corner. This supersedes all earlier verbal/icon-library versions. One existing-position Media Centre control, total immediately beside it only above five; no older-item count/badge. Ordinary Personal and authorised Group Card contexts use the same control.
- Gallery remains the existing `CardMediaViewer`, opened at the exact thumbnail. Media Centre remains the existing modal/`UserCardMediaUploadPanel`, separate from Gallery. The former focused-only shell is shared with ordinary and Group entry points; reflection editing and its existing work lease are preserved.
- Thumbnails show the newest five, oldest-to-newest left-to-right. Gallery retains bounded navigation through older pages. Per founder clarification, only opening Media Centre loads all metadata, using successive bounded30 requests, into its existing image/video rails. No new paging controls or gallery were added.
- Own Card within a Group shows the existing subdued date-lock glyph beneath nonshared thumbnails (including Centre previews), following the 4 November review. The selected full Gallery item retains its existing separate Private caption. Personal, other-origin and hidden-current-origin items are Private. Ordinary Personal views have no Private captions. No origin Group names appear beside media. Five-thumbnail dimensions and existing lower margin are retained; labels use that margin.
- Remove is immediate, as clarified. Creator Remove deletes the exact underlying source; Admin Remove of someone else only hides current Group visibility and shows **Removed from this Group. The creator still has their copy.** No confirmation, separate Hide/Delete controls, new ownership model or privileged deletion rights.
- Every Group upload stays **author-owned**. Group Card upload affordances are Admin-only; an active Follower uploads through their own Card. An Admin inspecting a player has removal-only management; a peer has Gallery-only access. A Follower with their own shared contribution can remove it from Group perspective without receiving Group Card upload or foreign-removal capability.

## Implementation / safety

The Phase 7A controller, typed source keys, upload operation, exact-source mutations and Phase 6 persistence/permissions are reused. Foreign media never enters the personal working store. The shared Centre keeps existing upload panels/rails and 140ms opacity transition, adds focus containment and preserves source focus on dismissal. Personal upload callbacks retain their working-store and pending-work behaviour. Group upload operations capture actor/Group/Card/version/epoch and retry identity; they never fall back to Personal upload.

Media read responses now include small server-derived capabilities, separate from authoritative mutation checks. Creator history still uses the author/Card query and survives leaving an origin. Group feeds remain visibility/scope/subject filtered, with creator management detected inside the same authorised snapshot.

Group overlays retain their captured intent while an authority lease is being refreshed, but Centre content is hidden/inert and the Gallery dialog is unmounted until verified. A real actor/Group/perspective/Card/adoption/role change discards it. This preserves native-picker returns without displaying stale foreign media; actual revocation is tested. Preview Cards do not acquire management entry points.

### Narrow existing defect discovered

Real browser upload exposed `GROUP_MEDIA_ORIGIN_FORBIDDEN`: Next can construct `request.url` with an internal hostname rather than the incoming LAN hostname. Group media mutations now compare Origin to the actual HTTP Host using the request protocol, ignore forwarded-host, and still reject cross-site/different-Origin requests. A red-first route test covers the internal-host/LAN-host difference and hostile forwarded-host/cross-site cases. Membership, ownership, provider and revision checks are unchanged.

## Initial Checkpoint B automated verification

These results precede the two 4 November visual amendments; latest focused results are recorded in the review investigation below. The mutating browser suite was not rerun against the founder-reviewed dataset.

All final checks below passed. No assertions/tolerances were weakened.

| Check | Actual result |
| --- | --- |
| `node --import tsx --test tests/media-centre-metadata.test.ts tests/media-ux.test.tsx tests/media-collection-client.test.ts tests/media-collection-operations.test.ts tests/media-collection-delivery.test.ts tests/group-media-providers.test.ts tests/group-media-routes.test.ts tests/card-media-viewer-layout.test.ts tests/personal-media-mutations.test.ts` | **37/37** |
| `node --import tsx --test --test-concurrency=1 tests/media-ux.integration.ts tests/media-collection.integration.ts tests/group-media.integration.ts` | **29/29**, disposable memory replica sets; followed by **1/1** rerun of the extended capabilities test after adding creator-only Group management |
| `npx playwright test tests/user-card-media-upload-panel.spec.tsx tests/user-card-media.spec.tsx tests/keyed-user-card-media-upload-controller.spec.ts tests/card-media-viewer.spec.ts tests/media-upload-client.spec.ts tests/user-card-media-mutation-queue.spec.ts` | **69/69** |
| `npx playwright test --config playwright.media-collection.config.ts` | **44/44**, Chromium/WebKit: existing Gallery, exact/inherited selection, older pages, zoom/swipe, paused video, download, simulated iPhone file sharing and stale-response handling |
| `PHASE7_REVIEW_INFO=/private/tmp/switchplay-phase7b-review-ucl528ag/phase2-test-results/review-server.json npx playwright test --config playwright.phase7b.config.ts` | **14/14**, Chromium/WebKit: real Personal/own-Group uploads and removal; ordinary/focused entry; Group Card Admin upload; Admin hide/toast with creator retention; read-only peer inspection; revocation purge; all35 metadata in existing Centre rails |
| Same config with `--grep 'Personal icon|own Group history'` | **4/4** after adding exact **46×58** intrinsic thumbnail assertions, Private-label non-overlap and open-Centre focus revalidation |
| `npx tsc --noEmit` | Passed |
| Targeted ESLint on changed TS/TSX files | Passed; no warnings |
| `MONGODB_URI='' MONGODB_DB='' node node_modules/next/dist/bin/next build --webpack` in isolated source export | Passed, including Next TypeScript validation; no copied environment credentials or database connection |
| `git diff --check` | Passed |

Tests cover 0/1/5/6/8 icon totals, full-metadata consistency rejection, exact source/creator/capability routing, removed-origin ownership, hiding versus deletion, membership/upload races, delayed completion, retries and existing Personal regressions. Raw Gallery selection identity and existing bounded history calculations are preserved.

Initial intentional red tests failed for the missing icon component, absent creator management capability and internal-host Origin comparison. Early browser attempts also exposed incorrect test flip selectors, concurrent artifact-directory collisions and stale disposable uploads left by failed attempts. Those were corrected without loosening expectations. The final fixture cleanup removes only recent test-created contributions, never seeded history. Run this browser config sequentially.

The owned Next dev process once reported empty manifests and stopped recognising the existing commit route. Only this task's disposable runner was restarted and its generated output recreated; commit/allocation/delivery routes were warmed sequentially (unauthenticated401, no writes). The current environment is healthy and has the new generated IDs below. Unrelated services were left running.

Full repository suites were intentionally not run. Physical iPhone acceptance remains outstanding. Mock image allocation/transfer/attachment/removal and actual application authorisation are exercised. **Live Cloudflare video/provider verification is not enabled**: the phone dataset uses local images, and video/download/share regressions use existing mock-provider browser tests. Phase 6 private-origin/CORS/signed-media release gates remain separate; this work neither enables participant media nor claims a real-provider check.

## iPhone / desktop review

Plain LAN URL:

    http://192.168.1.38:4187/decks?openExperience=3b5ebe64-ed04-47b6-95dd-cee94849be75

Desktop:

    http://127.0.0.1:4187/decks?openExperience=3b5ebe64-ed04-47b6-95dd-cee94849be75

Personal Deck on phone:

    http://192.168.1.38:4187/decks?openDeck=d31701f5-8df0-4265-8a9c-9ace49fcad49

Credentials: **Aoife Kelly / local-test-only** (Follower), **phase2 / local-test-only** (Admin). Use the first Card, **Find your balance**. Each account has eight items in its unified Personal history; Aoife has two Personal, four Galway U18 (one hidden), and two other-origin items retained after leaving that origin. Group-wide initially had eight shared items; after the recorded founder hide it has seven (five phase2, two Aoife). Existing empty Cards remain available. Other origins/identities/progress are not fabricated by the UI.

Review only visual/touch details not already proved by automation:

1. Aoife: open/flip first Card; inspect image-plus +8, five thumbnails and restrained Private captions. Tap a thumbnail for Gallery and use the icon for the separate Centre; check spacing/readability and horizontal rails.
2. Same account, ordinary Personal Deck: same control/history, no Private captions. Inspect ordinary versus Focused placement.
3. Admin: Group perspective has upload management; inspect Aoife for removal-only Centre. Review the existing Remove control and approved visibility-removal toast. Image uploads/removals are safe disposable mock operations.

Actual LAN verification: page200, Aoife login200, own-Group history200 (**total8, Private5**), image delivery200 (`image/png`). Automated iPhone viewport capture measured a **41.64×41.64 painted control** and five **46×58 layout thumbnails**. Private captions do not overlap the signal block. Screenshot `/tmp/phase7b-own-group.png` is supporting automated evidence, not physical acceptance.

### Running environment / restart

Owned source snapshot: `/private/tmp/switchplay-phase7b-review-ucl528ag`. Current runner PID **21810**, app PID **21846**. Disposable database `switchplay_phase2_browser_d1609053dfbd40ed943d4f2cfc6df3ff` on the runner-owned local memory replica set. Root `.env.local`/Atlas was never used for seeding or tests. Mock media bytes live only in the local fixture process.

Start from that owned source snapshot:

```sh
SWITCHPLAY_REVIEW_PORT=4187 node --import tsx scripts/test-phase2.ts --dev --lan --group-media
```

Stop **only this runner**, using Ctrl+C in its session or `kill -TERM 21810` after checking its identity. Restart creates a fresh disposable dataset; use the newly printed IDs/URLs or `phase2-test-results/review-server.json`. It does not preserve or modify persistent data. Existing ports4181–4186 were not terminated.

The bundler substitutes test-only provider modules exclusively inside the explicitly guarded local disposable harness; normal development/production keeps the existing provider configuration and definitions. The production build was checked separately in `/private/tmp/switchplay-phase7b-build-p4mpl9gl`.

## Changed files

All changes are uncommitted. The initial tree was clean; no unrelated modified/untracked work was discarded, staged or committed. HEAD remains `642171daf037`. No production data/provider configuration, later-phase storage, Group reflections/Info Cards or Card gestures/progress calculations were changed.

- `next.config.ts`
- `scripts/test-phase2.ts`
- `src/app/globals.css`
- `src/components/decks/BackCardFaceContent.tsx`
- `src/components/decks/BackCardMediaCarousel.tsx`
- `src/components/decks/DeckDetail.tsx`
- `src/components/decks/WorkingFocusedCardView.tsx`
- `src/components/group-experiences/GroupCardBack.tsx`
- `src/components/group-experiences/GroupExperienceDeck.tsx`
- `src/components/media/CardMediaViewer.module.css`
- `src/components/media/CardMediaViewer.tsx`
- `src/components/media/UserCardMediaUploadPanel.tsx`
- `src/components/media/useMediaCollection.ts`
- `src/lib/groupExperiences/media/http.ts`
- `src/lib/groupExperiences/media/reads.ts`
- `src/lib/groupExperiences/media/repository.ts`
- `src/lib/mediaCollection/contracts.ts`
- `src/lib/mediaCollection/ownerHistory.ts`
- `src/lib/mediaCollection/transport.ts`
- `tests/group-media-routes.test.ts`
- `docs/engineering/features/group-experience/group-experience-phase-7b-handoff.md`
- `playwright.phase7b.config.ts`
- `src/components/media/CardMediaCentre.tsx`
- `src/components/media/CollectionGallery.tsx`
- `src/components/media/MediaCentreControl.tsx`
- `src/lib/mediaCollection/permissions.ts`
- `tests/helpers/groupMediaReviewProvider.ts`
- `tests/helpers/mediaReviewFixture.ts`
- `tests/helpers/personalMediaReviewProvider.ts`
- `tests/helpers/protectedMediaReviewProvider.ts`
- `tests/media-centre-metadata.test.ts`
- `tests/media-ux.integration.ts`
- `tests/media-ux.test.tsx`
- `tests/phase2/media-ux.browser.ts`

## 4 November physical-review investigation and approved amendments

Only the square-plus glyph and thumbnail lock treatment were implemented in this pass. **No permission, date, fixture, model, upload, removal or loading-state implementation was changed. No commit.**

### Actual removal reconstructed from preserved live data

Read-only investigation used the existing disposable database `switchplay_phase2_browser_d1609053dfbd40ed943d4f2cfc6df3ff` on the identified owned local replica set (port64339). No environment database URI/Atlas connection was used. The review runner was not restarted and its data was not reset. Owner/shared API snapshots and allowlisted Mongo projections were captured before visual edits.

The removed contribution is **`1dde0180-48f4-434f-ab2b-2350a839e7be`**. Log `/tmp/phase7b-review.log` line3443 records a successful PATCH to its Galway U18 media visibility endpoint. The seeded state was attached/shared/revision2; current Mongo state is **attached, groupVisible:false, revision3**. Owner history still contains the same ID and returns `private:true`; Group inspection excludes it. Its owner image request returns200 (3568bytes), Group inspection returns403. This confirms hiding, not deletion. The log/model do not store a historical actor name or hide timestamp; phase2 as actor comes from the founder account of the action and matches the required Admin-only command.

Before the hide, this was the oldest of the three shared items: first thumbnail/first image in the Centre under the implemented oldest-to-newest UI ordering, and full owner history position4 of8. The exact selected Gallery state/finger position is not logged.

All eight records belong to **Aoife Kelly** (`6aea951d8f20faceee76a311`). Galway U18 is `3b5ebe64-ed04-47b6-95dd-cee94849be75`; the other origin is **Galway development**, `e1045534-3ee0-435e-8fa1-1f1ec6cdf1cb`. Aoife is active in U18 and removed from Galway development. phase2 is Admin in both.

| Owner history position | Exact item ID | Display label | Origin | Shared in Galway U18 now | Owner sees it | Private reason | Current removal rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `image-665d006e-23dc-4286-b239-08ad7af8904d` | Training photo 1 | Personal | No | Yes | Personal-origin; not Group-shared | P |
| 2 | `image-b478fe1c-572c-4c3e-b1d1-0849bafc8f0b` | Training photo 2 | Personal | No | Yes | Personal-origin; not Group-shared | P |
| 3 | `8519e9bb-c9c9-460a-bcd8-db3c27e077a9` | Group image | Galway U18 | No | Yes | Pre-hidden by seed (revision2) | G |
| 4 | `1dde0180-48f4-434f-ab2b-2350a839e7be` | Group image | Galway U18 | No | Yes | Actual Admin hide (revision3) | G |
| 5 | `656e5342-85ef-4cf2-a38a-05ceacf76211` | Group image | Galway U18 | Yes | Yes | None: currently shared | G |
| 6 | `5b0cb080-4d36-42e1-8e45-566607009760` | Group image | Galway U18 | Yes | Yes | None: currently shared | G |
| 7 | `0b51042d-7e2e-43f1-8e2f-e9bd588f4349` | Group image | Galway development | No | Yes | Other Group origin, not U18 | O |
| 8 | `fa0b792d-5aaf-4514-8d91-25f15bfd8ea1` | Group image | Galway development | No | Yes | Other Group origin, not U18 | O |

Removal legend describes **current code**, not the newly confirmed restriction: **P** — Aoife can currently delete from ordinary Personal or her own Group Centre; no Group Admin access to this Personal item. **G** — Aoife can currently delete from any own Centre; U18 Admins can only hide within U18 (already hidden is an idempotent no-op). **O** — Aoife can currently delete from ordinary Personal or her own U18 Centre, including after leaving the origin; the originating Group Admin can hide in that origin, not via U18. phase2 cannot delete any underlying Aoife contribution. Every row's immutable author is Aoife.

The actual split is **two Personal + four U18 + two Galway development**, not three other-Group items. One U18 item (`8519e9bb-c9c9-460a-bcd8-db3c27e077a9`) was already seeded hidden. After the founder action there are **two shared / six Private** in Aoife history: two Personal, two other-origin, one pre-hidden U18, one actually hidden U18. Group inspection returns exactly the two shared records. Viewing eight requires the authenticated owner context; phase2 inspecting Aoife does not receive her private history.

### Why labels are confusing

`Training photo 1/2` are deliberately seeded Personal `description` values. Normal Personal uploads normally derive description from `file.name` (`mediaUploadClient.ts`). Group records currently store kind/type/size, but no title/original filename/description (`groupExperiences/media/model.ts`). Both `mediaCollection/ownerHistory.ts` and `mediaCollection/transport.ts` generate `Group ${kind}`. Thus **Group image is an application fallback description**, not a filename, user title, origin label or merely a fixture name.

The fallback is visible as the Centre tile name and is used for image alt text, thumbnail accessible names and Remove accessible names. Gallery images use it as alt text; there is no separate visible Gallery title/caption naming the item in the normal successful image display. Plain Card thumbnails have no visible title caption. It is a real production metadata limitation amplified by inadequately labelled mock imagery, not evidence that Group origin or authorship changed.

The existing minimal Private indicator distinguishes shared versus nonshared in the current Group; it does not distinguish Personal versus other-origin versus hidden-current-origin. The server knows these sources; production UI deliberately does not show their Group names. No new provenance UI was added.

### Confirmed source/context Remove mismatch — not implemented

`mediaCollection/permissions.ts::mediaRemoveOperation` currently returns delete for an owned item before considering the supplied current experience. `CardMediaCentre` uses this to show Remove for all eight owned rows; this was observed in the live modal. `operations.ts` sends Personal deletion to the Personal source endpoint or Group deletion to the owner-only contribution endpoint. The latter intentionally has no originating-membership requirement.

Current Group author deletion, ordinary Personal management, retained author deletion after leaving, and Admin-only visibility hiding already satisfy their respective approved rules. **Personal-origin and other-Group-origin deletion from within the current Group Centre do not satisfy the new context restriction.**

Recommended next correction: make existing source-aware Remove eligibility and transport guards respect the current Group; only current-origin owned contributions may be removed there. Preserve viewing all own history, existing owner-only Personal deletion outside Groups, and author deletion after leaving. If using an explicitly Group-scoped mutation contract, validate origin/current authority server-side without globally revoking the author's owner endpoint. No new controls or ownership model are needed. This remains proposed, not implemented.

### Date comparison — no styling regression found

Read-only Git comparison: `.deck-card-date`, `.deck-card-date-shell`, `.card-semantic-anchors`, front content padding, back date rules and Focused date rules are identical to main. Front date is **.72rem / 11.52px, weight800, line-height1 / 11.52px, padding0, margin0**. Back is **.64rem / 10.24px, weight680**, unchanged. Header grid gap10px/min-height22px and ordinary content padding14px20px18px (front top19px) are unchanged. Focused fit scaling matches main when comparisonFraction=0.

At390×844 the front date's painted height was11.52px in Deck view and17.00px when Focused, from existing whole-Card scaling. Applying main's stylesheet to the same content/DOM produced identical Focused typography, colour, padding and bounds. This is a stylesheet comparison, not a claim that main had Group Experiences. No physical Safari font-autosizing cause is established.

Read-only Group date display is deliberate: `CardSemanticAnchors` creates date edit hit zones only for a Personal presentation with its adjustment callback, not an Experience presentation. Aoife's Group date has zero edit hit zones. Group assignment does not schedule or change her Personal date. No date code/style/value was edited here.

### Intermittent disappearance — unresolved observation

Do not treat this as reproduced on the physical iPhone or fixed. Confirmed code path: Group resource invalidates its5-second lease on focus/pageshow/visibility changes (and on expiry); `GroupExperienceDeck` supplies null mediaContext while unverified. `useMediaCollection` then changes/disposes its controller; `GroupCardBack` renders empty items and selects the no-media signal layout, until verification plus a new media request completes. Failed refresh also clears data by design. An ordinary successful15-second media refresh retains its current page while loading, so that alone does not explain the symptom.

This is a plausible mechanism, not a proven attribution of the observed tap. Hold for further physical reproduction, then correlate authority/context/loading events and test delayed responses before choosing any correction. No loading/layout/permission refactor was made.

### Proposed clearer fixture scheme — not implemented

Keep eight examples and the same provenance/visibility cases. Give each mock image an unmistakable image-embedded title and distinguishable court/training composition: Personal—Solo shooting A/B; Galway U18—Balance H (pre-hidden), Footwork A (the removable test target), Passing A and Rebounding A; Galway development—Training A/B. Maintain a manifest mapping these human identifiers to actual UUIDs. Image-embedded wording is disposable fixture content, not a new production caption or provenance control. A U18-labelled image with a lock is then visibly different from a Personal-labelled or other-origin image with a lock.

Do not add Group names beside production media or silently add production filename/title storage. Burnt-in fixture labels plus the review manifest are the smallest proposed fix for acceptance clarity. Preserve this captured manual-test evidence before any separately approved fixture refresh; report any new generated IDs. No fixture changes or resets occurred during this investigation.

### Latest visual implementation and checks

- `MediaCentreControl.tsx`: only SVG glyph/class/license name changed to Lucide square-plus;22×22, stroke2, count>5 condition, position and touch target unchanged.
- `BackCardMediaCarousel.tsx` and `UserCardMediaUploadPanel.tsx`: replace thumbnail Private text with the same 🔒 / `.group-private-mark`, accessible name Private. No title, badge, background, new click handler or definition change. The full Gallery's selected-item Private caption is intentionally unchanged because it is not a thumbnail label.
- `globals.css`: keep thumbnail indicator positioning; match back date's inherited paint (rgba255250240/.42, weight680, line-height1, spacing.0064rem, shadow16px/.05, ancestor opacity.84). The reused mark supplies7px and.65 opacity. Both browsers confirm the computed lock styles and effective ancestor opacity match the date lock exactly.
- `tests/media-ux.test.tsx` and visual expectations in `tests/phase2/media-ux.browser.ts` updated only for the approved glyph/lock treatment.
- Latest focused unit **7/7**, TypeScript and targeted ESLint passed. Read-only Chromium/WebKit visual verification passed in both engines: same-engine before/after control/thumbnail/signal bounds, count8, exact lock styling, all eight Centre rows, Gallery unchanged, zero media mutation requests. The first WebKit attempt used a mismatched standalone Playwright version; the corrected repository-version check also corrected a cross-engine baseline comparison, without enlarging tolerances.
- The mutating Phase7B fixture suite was deliberately not rerun against the founder's reviewed data. No broader build/regression rerun was necessary for these SVG/caption-only edits; earlier baseline results remain historical.

Evidence files are local only: `/tmp/phase7b-review-investigation-evidence.json`, `/tmp/phase7b-review-db-evidence.json`, `/tmp/phase7b-date-evidence.json`, `/tmp/phase7b-removal-delivery-evidence.json`, `/tmp/phase7b-refinement-browser-evidence.json`. Current review URL/IDs/credentials above are unchanged. Only four presentation source files, two focused test files and this handoff were changed in this pass; all prior uncommitted Checkpoint B work was preserved.

### QUESTIONS / next approvals

1. Authorise implementing the confirmed source-context Remove restriction next (hide the existing Remove for Personal/other-origin items inside a Group, preserve owner deletion outside Groups and current-origin author Remove)?
2. Approve the proposed clearly identified eight-image disposable fixture scheme, without adding production provenance captions or changing ownership/visibility semantics?

Physical Checkpoint B acceptance remains pending. No later phase or commit has begun.

## Precise corner-plus icon correction — 4 November

Implemented only the newly specified Media Centre control correction. No Gallery, Media Centre operation, media permission, fixture or ownership change. No commit; physical iPhone acceptance remains pending.

- `MediaCentreControl.tsx`: custom two-path SVG, viewBox16×16, width/height16px, stroke1.5, rounded caps/joins, fill none. The frame has three rounded corners and a gap beneath the protruding corner plus, keeping the small plus legible without filled masking. Frame bounds x.75–12.75/y3.25–15.25; plus centre12.75,3.25 with5×5 arms, so its centre is at the frame's upper-right corner and its arms extend above/right. It is not a centred plus or a picture/mountain icon.
- `globals.css`: control keeps the existing absolute top/right anchoring. Gap4px, count12px/400; count remains total>5. Muted metadata colour rgba(255,250,240,.42), opacity.546 matching the existing back-date lock's .84×.65 inherited opacity. Hover remains subdued. No fill, border, background or shadow.
- Card transforms had reduced the existing44 CSS-pixel button below44 screen pixels. A local read-only size observer now scales only the transparent pseudo-element hit area to approximately45×45 screen pixels, following ancestor Card transforms and viewport changes. Visible icon/count coordinates and Card geometry do not depend on that hit area. Existing click handlers still open the same Media Centre.
- Focused unit assertions and existing browser icon-class expectation updated. Focused unit7/7, targeted ESLint, TypeScript and diff checks passed. Read-only Chromium and WebKit checks passed: rendered SVG16CSS px/~15.14painted px at390×844; stroke1.5; actual plus-at-corner geometry; count8;4px CSS gap; transparent control; real hit targets44.99×44.99 in both ordinary Deck and Focused views. Clicking the invisible outer part successfully opens the existing Centre in both views. The initial browser check needed to await asynchronous media loading before asserting the eight rows; the assertion itself was unchanged.
- Captured and visually inspected `/private/tmp/phase7b-corner-plus-mobile.png` with loaded thumbnails, count8 and the date lock alongside the new control. The frame/plus is visibly smaller and quieter than the previous22px square-plus. Measurements: `/private/tmp/phase7b-corner-plus-measurements.json`; check log `/tmp/phase7b-corner-icon-browser.log`.
- Review server source was refreshed in place without restarting its runner or resetting data. Same LAN URL and credentials above. Changed in this pass: two source files (`MediaCentreControl.tsx`, `globals.css`), two visual test expectations (`media-ux.test.tsx`, `phase2/media-ux.browser.ts`) and this handoff. All earlier uncommitted work preserved.

## Final image-authoritative icon correction — 4 November

The supplied `/Users/peterdomokos/Desktop/icon.png` is authoritative, superseding the earlier upper-right design. Inspected the image and its actual pixels before editing. Changed only the SVG in `MediaCentreControl.tsx`, its focused unit expectations, and this handoff. Existing count, styling, 45px screen-space hit area, event handlers, Gallery, Centre, permissions and fixture data are unchanged. No commit; physical acceptance pending.

A custom SVG traces the reference's40×40 glyph region: three rounded frame corners, interrupted lower-right outline and a separately stroked bottom-right plus. Native frame stroke4.1667 and plus stroke5 preserve the raster's measured relative weights. At18 CSS pixels this gives1.875px frame /2.25px plus before the existing Card transform, avoiding an overly thin mobile shape. The plus is centred at31.5,31.5 in a40×40 viewBox; its strokes extend to40, beyond the frame's stroked right/bottom bounds near37.75. The frame path ends before the lower-right corner on both the right and bottom edges. No image/mountain detail or centred plus remains.

Actual component SVG was rasterised at native reference glyph size and compared with the supplied pixels: foreground intersection/union98.95% at threshold160. This validates the trace geometry; remaining rasterisation differences are subpixel. It is not a library match claim. No changes were made to the supplied image.

Verification: focused unit7/7, targeted ESLint, TypeScript and diff checks passed. Chromium/WebKit checks passed on the existing disposable environment: computed SVG18×18CSS px, approximately17.03×17.03painted px at390×844; correct separate frame/plus strokes; lower-right positioning and interrupted frame endpoints; unchanged subdued colour/count8/4px gap; no inherited size or stroke overrides; approximately44.99×44.99screen-space hit target; outer-target clicks open the same existing Media Centre in Deck and Focused views. No media mutations or fixture reset were performed.

Captured and visually inspected the actual mobile Card with loaded thumbnails and count8 against the supplied image: `/private/tmp/phase7b-reference-icon-mobile.png`. Geometry/paint measurements: `/private/tmp/phase7b-reference-icon-measurements.json`. Reference comparison: `/private/tmp/phase7b-reference-icon-comparison.json`. Browser log: `/tmp/phase7b-reference-icon-browser.log`. Existing port4187 review source updated in place; URL and credentials above unchanged. All previous uncommitted work preserved; no later phase begun.
