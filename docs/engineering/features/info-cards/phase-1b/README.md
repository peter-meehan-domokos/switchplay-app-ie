# Info Cards Phase 1B — Physical stack handoff

23 October 2026. Repository: `/Users/peterdomokos/projects/switchplay-app`; branch: `feat/info-cards`; starting commit: `666abb4` (Phase 1C). The starting worktree was clean. Scope is Phase 1B and its minimal consultation integration only. No commit, migrations, backend, Creator/Library or production attachment work was undertaken.

The user reports successful manual Phase 1C testing. The new physical interaction still requires phone review and combined final integration acceptance.

## Interaction implemented

- A compact pack emerges from the actual bottom-left pouch, moves diagonally up/right with a restrained 12° initial tilt, and settles horizontally in the approved 1A resting position. Rotation eases continuously to horizontal across the approximately 480ms opening, while translation retains its distinct final seating movement. The existing Step View boundary clip and foreground pouch mask the emergence.
- Card dimensions remain constant. Motion changes translation, rotation and stacking order; it never scales or changes card proportions. The corrected card height, margins, typography, surfaces and integrated X are reused without changing their CSS.
- Swipe down sends the front card down and behind the pack, revealing the next card. Swipe up brings the previous card upward from beneath it. A turn takes approximately 360ms. Current and adjacent cards are separate keyed physical layers: incoming content moves into place and retains its node when selected, rather than replacing text or crossfading.
- Settled views have one readable face and at most two tightly staggered backing edges, using the approved opposite-side offsets/rotations. One attachment has no fictitious backing card or cycling movement; two have one backing edge; larger packs have two. Edges make only a small accompanying movement during turns.
- The dedicated X, pouch and exposed upper background gather the cards and return the pack diagonally into the pouch. Closing takes approximately 100ms gathering plus 300ms return. The existing consultation, input isolation and playback suspension remain active until the return finishes.
- Closing may interrupt opening, a drag or a turn. Tapping the pouch again during an unfinished return reverses that motion within the same consultation, preserving its snapshot and selection. After a **completed close**, every new consultation starts at the first card and copies fresh input data.
- Vertical pointers use the existing 10px dead zone and axis-lock/velocity conventions, with a smaller threshold of 20% of rendered card height capped at 56px; a sufficiently clear fast swipe can commit after 20px. Cancelled, short or horizontal gestures restore the current card. Drag clicks are suppressed. Committed turns are locked: further requests are ignored until settled, with no queue that can reorder or duplicate cards.
- Up/Down keyboard navigation follows the same circular order. A screen-reader status announces the title only. Card faces have no visible index, dots or progress UI. Following the later pouch-alignment request, the closed pouch retains its attachment count and the open pouch shows the selected card's single positional number.
- Reduced motion uses an approximately 80ms pack fade and small, short physical card transitions, retaining ordering, focus, closing and state behaviour. Browser pinch zoom remains allowed; pan suppression is scoped to the consultation/stack.
- During a movement, the pack's geometry is frozen so a viewport change does not resize it in flight. The pouch independently follows the real Step View corner. Resizing retargets a return toward that corner; after settling, the pack realigns to the current Step View without resetting selection. The existing short-landscape readability limitation remains documented in 1A; it is not claimed solved here.

## Phase 1C preserved

`FocusedCardView` still owns the opening-time data copy, mounted Step View/activity/player and playback suspension. This phase does not change that component, `StepView`, the player, the nested viewer or their lifecycle helpers. `InfoCardConsultation` now waits for the motion controller's exit completion before releasing the existing session.

The hosted video remains paused with its playhead/source intact, including delayed load/play requests, and closing never resumes it. Activity input, internal counter, scroll position and mounted identity survive repeated consultation. The consultation remains above hosted video with a transparent background; underlying deck/flip/step/video/activity interactions stay isolated through transitions. Media opens only from its compact control, freezes browsing, and closes back to the same selected card and trigger. Focus restoration and the existing parent Library/Creator dialog composition remain covered.

## Changed files

| Path from repository root | Purpose |
| --- | --- |
| `src/components/info-cards/InfoCardPhysicalStack.tsx` | Local Motion sequences, current/adjacent keyed layers, circular selection, pointer capture/cancellation, keyboard control, reduced motion and exit completion. |
| `src/components/info-cards/InfoCardPhysicalStack.module.css` | Scoped grid layers, transform origin, input surface, close-control stacking and hidden title announcement. |
| `src/components/info-cards/InfoCardConsultation.tsx` | Keep the existing session/media ownership, request animated closure, preserve fixed moving-pack geometry and independently track the live pouch corner. |
| `tests/browser/info-cards-integration-fixture.tsx` | Extend the real DeckScene/FocusedCardView/StepView fixture with 0/1/2/5/12 attachment choices and temporary ordered content; retain real local video/activity options. |
| `tests/browser/info-cards-motion.browser.ts` | Physical/circular/edge-case tests, transition measurements, review screenshots and real Chromium touch input. |
| `tests/browser/info-cards-integration.browser.ts` | Wait for animation settlement/exit in the existing lifecycle tests; retain their assertions. |
| `playwright.info-cards-integration.config.ts` | Run both motion and existing integration suites in the same real-component fixture. |
| `docs/engineering/features/info-cards/info-cards-engineering-plan.md` | Record current authorisation/status, implemented motion boundary and combined acceptance gate. |
| `docs/engineering/features/info-cards/phase-1c/README.md` | Record the user's subsequent successful manual 1C review while preserving the original evidence. |
| This report, measurements and `screenshots/` | Review evidence, limits and device instructions. |

The functional specification, approved face/pouch/Step View CSS modules and global CSS are unchanged. The prototype remains fixture-fed; ordinary application decks do not acquire persisted info-card attachments in this phase.

## Automated verification

Final result: **88 Chromium cases passed**, with no remaining automated failure:

| Suite/check | Result |
| --- | --- |
| Combined real-component Phase 1B/1C suite | **38 passed**: 21 physical-stack cases and 17 retained Phase 1C cases. |
| Existing Phase 1A geometry/content/attribution suite | **9 passed**. |
| Existing card/deck preparation and navigation regressions | **21 passed**; two explicit WebKit variants excluded. |
| Existing personal-media viewer/download regressions | **20 passed** in Chromium; cases named iPhone/Safari simulation remain simulations. |
| TypeScript and ESLint on changed application/test/config files | Passed. |
| Webpack production build using installed Next.js 16.2.6 | Passed. |
| Whitespace and local documentation links | Passed. |

Motion tests cover both circular directions and wraparound; physical displacement and retained incoming nodes; constant pack/card dimensions and unit transform scale sampled through motion; zero/one/two/twelve cards; bounded backing layers; all close controls; reset after a completed close; short/horizontal/cancelled/reversed gestures; rapid requests; interrupted/reversed opening/return; unmount during motion; selected non-first image/video return; activity retention; keyboard/reduced motion; portrait/landscape resizing; and real Chromium touch dispatch without accidental media activation or page scrolling.

At 390×844, **72 opening/resting/closing samples** kept the pack at **240×157 layout pixels** (354.3×231.8 rendered pixels at the unchanged 1.47619 parent scale). Its own transform scale stayed within 0.0000005 of 1 while rotation ranged from 0° to 12°. The pouch's measured left/bottom corner error was 0px in that run. **47 browsing-layer samples** likewise kept each face at 240×157 with unit scale. The responsive case additionally checks live pouch alignment within 0.5px after resizing while the pack's in-flight scale remains fixed. These are automated measurements, not device acceptance.

The retained 1C cases cover Intro and Steps 1–3, pending load/play races both during and after consultation, no automatic resume or player remount, activity state, pointer/keyboard/focus isolation, nested media disposal and snapshot stability, account/version/unmount cleanup, parent-dialog nesting and ordinary Step View navigation.

Early iterations exposed an X hit-target stacking issue and touch implicit-capture transfer cancelling the gesture. Both were corrected. A separate resize probe also caught the pouch being frozen with the pack; separate live pouch coordinates corrected that behaviour. These failures are not counted as passes; the results above refer to verification after correction.

Run from the repository root:

```sh
npx playwright test -c playwright.info-cards-integration.config.ts
npx playwright test -c playwright.info-cards.config.ts
npx playwright test tests/card-video-preparation.spec.ts tests/deck-video-preparation.spec.ts --grep-invert webkit --workers=2 --reporter=line
npx playwright test -c playwright.media-viewer.config.ts tests/browser/media-viewer.browser.ts tests/browser/ios-video-download.browser.ts --reporter=line
```

To refresh the three review images, prefix the combined command with `INFO_CARDS_MOTION_CAPTURE_DIR=docs/engineering/features/info-cards/phase-1b/screenshots`. The combined JSON report and retained-failure traces use the existing OS temporary-directory paths `switchplay-info-cards-integration-report.json` and `switchplay-info-cards-integration-results/`. Frame measurements are attached to the opening/closing and physical-browsing tests; [measurement summary](motion-measurements.json) records their final observed ranges.

## Review evidence

- [Closed](screenshots/390-closed.png)
- [Emerging diagonally](screenshots/390-emerging.png)
- [Settled pack](screenshots/390-settled.png)

These are captures of the actual Step View with synthetic 1C video at 390×844. During emergence/return, the fixed-size tilted pack is intentionally occluded by the Step View boundary and pouch. Full readability applies to the settled face. The earlier reference's shorter proportions and obsolete index/title details are not restored. Still images document composition but cannot establish swipe feel or motion quality.

## Review the animation locally and on a phone

**Routing follow-up, 23 October:** the server's former catch-all sent `/info-cards/integration/` to the Media Viewer, although the exact path worked. Both slash forms now load Info Cards; unknown pages return 404. Review responses use `Cache-Control: no-store` and a per-build script URL to avoid stale bundles. The restarted LAN URL `http://192.168.1.38:4180/info-cards/integration?review=phase1b` returned HTTP 200 with the Info Cards entry. Two focused routing/browser tests and ESLint passed; this server-only correction changes no Info Cards component. The original implementation test results above remain historical evidence, not a claim that the full suite was rerun for this correction.

The final fixture server is left running on port **4180**:

- Laptop: **http://localhost:4180/info-cards/integration**
- Phone on the same trusted Wi-Fi: **http://192.168.1.38:4180/info-cards/integration**

If stopped, run:

```sh
SWITCHPLAY_FIXTURE_HOST=0.0.0.0 SWITCHPLAY_FIXTURE_PORT=4180 node tests/browser/server.cjs
```

Use the current LAN address printed by the server if the laptop's IP changes; allow the local firewall connection if needed. No login, database, deployment or tunnel is required. The server compiles once, so restart it after source changes; stop it with Ctrl+C when finished. The original static 1A fixture remains at `/info-cards`.

1. Choose **5 Cards**, open the front main card, then Intro or a step. Play the sample and tap the pouch. Review diagonal emergence, unchanged card dimensions, subtle pack edges and the horizontal resting position.
2. Swipe down through Negative signs → Brackets → Like terms → Operation order → Check an answer → Negative signs. Swipe up to reverse. Try short/cancelled gestures and rapid alternating swipes; input during a committed turn is deliberately ignored.
3. Open image or video media after selecting a non-first card. Close the media X: the same card should remain selected. Swiping/keyboard input in the viewer must not browse the hidden pack.
4. Try consultation X, pouch and upper-background closing. After a completed close, reopen and confirm Negative signs is first. Playback must remain paused at its previous position. Try closing during opening/turning; a second pouch tap during return reverses that unfinished return.
5. Use **1**, **2**, **12** and **0** cards. A single card should not cycle; zero attachments should show no pouch.
6. Choose **Stateful activity**, enter an answer, increase Attempts and scroll. Repeat opening, browsing, media and closing; confirm all underlying state survives. Review portrait/landscape changes, especially pouch corner attachment during movement.
7. With a keyboard, use Up/Down and Tab; Escape dismisses attribution first, then the topmost consultation/media layer. Test the phone's reduced-motion setting, native video controls/fullscreen, browser chrome and VoiceOver as available.

## Opening rotation correction — 23 October

Following iPhone feedback, the initial opening now rotates from 12° to 0° over the full 480ms with one `easeInOut` curve. Previously, rotation used `[12, 9, 0]` at times `[0, 0.65, 1]`, leaving a 9° anticlockwise turn for the last 168ms. The per-property rotation timing is now `[0, 1]`; translation remains `[hiddenX, -4, 0]` / `[hiddenY, 3, 0]` at `[0, 0.65, 1]`. This removes the late rotational acceleration without removing the existing edge-contact/seating translation.

Closing, interrupted-return reversal, circular browsing, reduced motion, card dimensions and Phase 1C lifecycle code are unchanged. The frame-measurement test now checks that most rotation is complete when translation enters the final seating region. The original screenshots and measurement summary above remain historical evidence; the changed rotation must be judged in motion, not from a settled screenshot.

Verification after this correction: **40 Chromium tests passed** (the combined motion/Phase 1C suite, including the two routing checks). TypeScript, ESLint on the changed component/test and `git diff --check` passed. The separate Phase 1A, deck and personal-media suites listed above were not rerun for this rotation-only correction. WebKit and physical iPhone testing were not performed.

The fixture server has been rebuilt. Review on the same Wi-Fi at **http://192.168.1.38:4180/info-cards/integration?review=rotation** (verified HTTP 200). Real iPhone review of the smoother turn and retained physical snap remains pending; automated results cannot establish subjective motion acceptance.

## Pouch alignment correction — 23 October

The rounded triangular interior now determines content placement, with a deliberately grouped information icon/subscript count when closed and independently ink-centred positional numeral when open. Scoped typography prevents the existing step-index styles leaking into the pouch. The new positional numeral is explicitly requested in the latest review and is confined to the open pouch; it does not add an index to card faces.

See the [geometry derivation, measured clearances and mobile screenshots](pouch-alignment/README.md). Verification after the final adjustment: **43 Chromium integration/motion/pouch cases and 9 Phase 1A cases passed**, together with TypeScript, changed-file ESLint and whitespace checks. The new checks include one-/two-digit artwork, circular-position updates and reset on reopening. Browser screenshots and close-ups were visually inspected; phone/Safari review remains pending. No animation timing, footer geometry, card design, global CSS or backend code changed in this correction.

## Acceptance recommendation and limits

The combined 1A–1C prototype is ready for **final integration acceptance review on the phone**. There is no outstanding engineering decision or known automated failure blocking that review. Acceptance is not claimed until the user reviews the new movement, touch feel, remaining video context and device behaviour.

Actual iPhone/Safari testing of **this new Phase 1B interaction** has not been performed by the assistant. The user's successful earlier 1C manual testing remains recorded separately. WebKit was not run or investigated again; unavailable coverage is not a pass. Live protected Cloudflare HLS/permission behaviour remains outside this local MP4 fixture and requires later media work. Existing extreme text-enlargement/short-landscape limitations remain in the engineering backlog.

Normal animation may be visually tuned after device feedback. The intentionally serial gesture policy and unfinished-return reversal behaviour above are implemented choices, not unresolved failures. Backend phases remain subject to separate authorisation; no Phase 2 work has begun.
