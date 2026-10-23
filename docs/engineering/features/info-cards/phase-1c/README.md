# Info Cards Phase 1C — Integration handoff

Updated 23 October 2026. Branch: `feat/info-cards`. Starting commit: `a4c2e2a` (committed Phase 1A visual corrections). Implementation and automated verification are complete; actual-phone Safari testing and user acceptance remain pending. No commit, Phase 1B work, backend implementation or migrations were made.

## Reordering and implementation

**1A → 1C → 1B → final integration verification is technically sound.** Playback, activity lifetime and overlay ownership do not require circular selection or physical animation. The [engineering plan](../info-cards-engineering-plan.md) now records revised dependencies, the static interface, controller boundary and final verification gate. Product decisions and later-phase acceptance criteria remain in force.

`FocusedCardView` owns a consultation session tied to the current card/content identity, viewer and Step View item. Opening copies the temporary ordered cards, immediately suspends the mounted player and presents the first card. That copy remains stable through nested media; reopening uses the current input data. Navigating away, changing viewer/content version or unmounting dismisses the session and its media layer.

The real `StepView`, activity subtree and hosted player remain mounted. The pouch stays in the actual footer for both video and activity content. Shared `InfoCardStack` markup preserves the corrected 1A face, backing cards and close control. No changes were made to the existing Step View, pouch or face CSS modules, or global CSS.

The hosted video occupies a separate stacking layer. A transparent native modal, portalled to the document body and aligned to the measured Step View bounds, places the consultation above it. A second modal hosts info media. Native background inertness, explicit focused-card/host inertness, callback guards and event containment isolate the underlying deck, flip, step and media/activity controls. Closing consumes the click and restores focus; it does not activate the covered control. Geometry follows the real scaled Step View while the consultation is open.

The new player suspension method pauses without resetting its source or playback position. A generation guard invalidates earlier autoplay intent and delayed load/play results, including results arriving after consultation closes. Readiness work can finish while paused. Releasing suspension never requests playback; a subsequent manual play still works.

Only the compact media control opens the optional image/video. The viewer reuses `CardMediaViewerImage` and `CloudflareHlsVideoPlayer`, with an explicit top-right close control and local focus handling. Closing it disposes its own player, returns to the same info card/control and leaves the step paused. The wrapper has no personal-media queue or download assumptions.

## Changed files

Paths below are relative to the repository root.

| Files | Change |
| --- | --- |
| `docs/engineering/features/info-cards/info-cards-engineering-plan.md` | Targeted sequence/dependency update, controller boundary, current/deferred verification, phone access and historical-status corrections. |
| `src/components/decks/FocusedCardView.tsx` | Session/snapshot ownership, immediate playback suspension, lifecycle cleanup, real Step View anchor, activity slot and navigation/flip isolation. |
| `src/components/decks/StepView.tsx` | Stable surface ref and activity slot; reuse shared static stack markup. |
| `src/components/info-cards/InfoCardStack.tsx` | Extract unchanged 1A stack presentation for use in both fixtures and the integrated consultation. |
| `src/components/info-cards/InfoCardConsultation.tsx`, `InfoCardConsultation.module.css` | Static transparent consultation modal, measured alignment, open pouch and nested media state. |
| `src/components/info-cards/InfoCardMediaViewer.tsx`, `useInfoCardDialog.ts` | Image/video wrapper, local modal/focus/scroll lifecycle and interaction containment. |
| `src/components/info-cards/InfoCardFace.tsx` | Tooltip dismissal before modal event handling, Escape priority and explicit media-trigger focus restoration. Typography/layout styles are unchanged. |
| `src/components/media/CloudflareHlsVideoPlayer.tsx` | Narrow suspension API/prop and guards against pending load/play requests; preserve source/time and existing normal playback paths. |
| `tests/browser/info-cards-integration-fixture.tsx`, `info-cards-integration-fixture.module.css` | Actual DeckScene/FocusedCardView/StepView composition with synthetic video and a stateful, scrollable activity. |
| `tests/browser/info-cards-playback.ts`, `server.cjs` | Fixture-only local-video adapter, range-aware sample delivery and integrated fixture route. Existing non-info media URLs retain their original helpers. |
| `tests/fixtures/info-cards-sample.mp4`, `generate-info-cards-video.m` | Small synthetic H.264 clip and reproducible macOS AVFoundation generator; no downloaded media or dependency changes. |
| `tests/browser/info-cards-integration.browser.ts`, `playwright.info-cards-integration.config.ts` | Seventeen focused Chromium integration checks, screenshots and responsive alignment measurements. |
| `tests/deck-intro-playback.spec.ts` | Repair the older esbuild harness to collect/inject component CSS, matching existing preparation-test patterns. |
| This report and `screenshots/` | Saved evidence and local/device review instructions. |

## Verification results

**85 browser test cases passed across the focused suite and relevant regressions.** No cases remained failing in the completed runs.

| Check | Result |
| --- | --- |
| New Phase 1C Chromium suite | **17 passed**, no skipped or flaky cases in the final run. |
| Existing player/card/deck preparation and readiness regressions | **35 passed**; explicit WebKit cases excluded. |
| Existing deck-intro regressions | **4 passed** after the CSS-aware fixture repair. |
| Phase 1A layout/content/attribution checks | **9 passed**. |
| Existing personal media viewer/download browser checks | **20 passed** in Chromium. Cases named “iPhone Safari simulation” remain simulations, not real-device results. |
| `npx tsc --noEmit` | Passed. |
| ESLint on changed application/test/config files | No errors; two pre-existing unused `reason` parameter warnings in the player. |
| `npm run build -- --webpack` | Passed with installed Next.js 16.2.6. |
| `git diff --check` and local documentation links | Passed. |

The first broad regression run encountered a deck-intro harness bundling failure and left its other three cases unrun. Collecting/injecting component CSS fixed the harness; all four cases passed on rerun. The remaining 35 regressions passed in the original run.

The integration suite covers Intro and Steps 1–3; playing-video pause and position retention; unchanged player/Step View identity; delayed authorization/readiness and pending play promises released both during and after consultation; manual playback afterward; preserved activity input, counter, mount identity and scroll; pointer/keyboard/focus exclusion and restoration; tooltip Escape priority; nested image zoom and video disposal; frozen content during consultation with refresh on reopening; unmount/content-version/viewer cleanup; nesting above the existing Library/Creator dialog component; no-media rendering; responsive alignment; and touch closing without click-through to the video.

Responsive portal checks at **360×780, 390×844, 430×932 and 1280×900** verified alignment to actual Step View bounds within **0.5 rendered CSS pixels** during resizing, preserving the player instance. Card dimensions continue to use 1A styles. The existing 1A suite independently checks footer geometry, content and sampled mobile viewports; no new publication limits were introduced.

### Reproduction commands

Run from the repository root:

```sh
npx playwright test -c playwright.info-cards-integration.config.ts
npx playwright test -c playwright.info-cards.config.ts
npx playwright test -c playwright.media-viewer.config.ts tests/browser/media-viewer.browser.ts tests/browser/ios-video-download.browser.ts --reporter=line
npx playwright test tests/video-source-transition.spec.ts tests/deck-intro-playback.spec.ts tests/card-video-preparation.spec.ts tests/user-card-video-readiness.spec.ts tests/deck-video-preparation.spec.ts --grep-invert webkit --workers=2 --reporter=line
```

The focused config writes its JSON report and browser artifacts under the OS temporary directory as `switchplay-info-cards-integration-report.json` and `switchplay-info-cards-integration-results/`. To regenerate the saved screenshots, prefix its command with `INFO_CARDS_CAPTURE_DIR=docs/engineering/features/info-cards/phase-1c/screenshots`.

## Screenshots

Screenshots show the real Step View/player at 390×844, using synthetic fixture media. They document integration and preserved 1A presentation; they do not establish user visual acceptance.

- [Closed Step View with playing video](screenshots/390-real-video-closed.png)
- [Open consultation over paused video](screenshots/390-real-video-consultation.png)
- [Open consultation over stateful activity](screenshots/390-activity-consultation.png)
- [Nested image viewer](screenshots/390-nested-image.png)
- [Nested video viewer](screenshots/390-nested-video.png)

## Local and phone review

The fixture server was left running on port **4180** for review. Local URL: `http://localhost:4180/info-cards/integration`. Same-Wi-Fi phone URL at handoff: **http://192.168.1.38:4180/info-cards/integration**. The address may change when the laptop reconnects.

If the server has stopped, run:

```sh
SWITCHPLAY_FIXTURE_HOST=0.0.0.0 SWITCHPLAY_FIXTURE_PORT=4180 node tests/browser/server.cjs
```

Use the phone URL printed by the server, allow the local firewall connection if needed, and keep both devices on the same trusted network. No app login, database, deployment or public tunnel is required. Stop with Ctrl+C when finished; this opt-in LAN server serves synthetic fixture data only. The original static 1A fixture remains at `/info-cards`.

1. Choose **Real video** and **Image** before opening a card. Tap the front card, then its Intro title or a step. Play the clip and wait a few seconds.
2. Tap the bottom-left pouch. Confirm playback pauses, the upper video remains visible and the lower pack covers navigation. Close with its X, pouch or upper background; confirm time is preserved and playback stays paused. Resume manually. Repeat on Steps 1–3.
3. Reopen and use **View image**. Check zoom, close with the media X and confirm return to the same open info card. Tap the series title for attribution. Card-body taps should neither close consultation nor open media.
4. Close the Step View/focused card as needed, choose **Video** in the fixture's Info media selector and repeat using **Watch video**. Closing the nested viewer must leave the underlying step unchanged and paused.
5. Choose **Stateful activity**, open a card/Intro, enter an answer, increase Attempts and scroll the activity. Open/close consultation and its media; verify all activity state remains. Underlying controls must not respond while consultation is open.
6. Check portrait/landscape changes, browser chrome resizing, comfortable touch targets, keyboard focus where available and VoiceOver. Record actual Safari/native-fullscreen behaviour and any unexpected playback or click-through.

The optional `?parent-dialog` query mounts the same real fixture inside the existing `LibraryDialog` component for nested-dialog review.

## Coverage limits and Phase 1B boundary

- Actual iPhone/macOS Safari, VoiceOver and native-fullscreen behaviour **have not been manually tested**. These checks require user/device participation. WebKit automation was not run for this checkpoint; the two explicit WebKit regression variants were excluded, and the known sandbox crash was not investigated again.
- The fixture uses a locally generated H.264 MP4 through a test-only URL/capability adapter. Actual decoding, controls and application components run, but this does **not** verify Cloudflare HLS, protected provider delivery or future info-card media permissions. Those require later live-media checks.
- The reusable integration is in the real production components; temporary info cards are supplied by the browser fixture. Ordinary app decks have no persisted attachments yet. The separate Step Visuals worktree was not integrated; the stateful activity is a deliberate test component in the real Step View host.
- Opening/closing is immediate and only the first fixture card is displayed. Circular selection, physical emergence/return, swipe thresholds, animation interruption/reversal and media return after selecting a non-first card remain Phase 1B work.
- Phase 1B should add selection/motion inside `InfoCardConsultation`, keeping `FocusedCardView`'s pinned session, playback suspension and activity lifetime. Keep the session and isolation alive until return animation completes; freeze selection while media is open, preserve the selected card on media close, and reset to the first card on each new opening.
- After 1B, repeat these lifecycle/focus/playback checks during motion, add circular gesture/cancellation tests and obtain combined phone acceptance before Phase 2.

No unresolved engineering decision blocks review. The functional specification was intentionally unchanged. Its older §4.2 wording gives both header parts bold emphasis and §10.3 omits the later dedicated consultation X; the later approved visual decisions and existing 1A corrections govern those details, as recorded in the plan.
