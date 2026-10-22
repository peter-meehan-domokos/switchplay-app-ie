# Info Cards Phase 1A — Initial implementation evidence (superseded visuals)

Date: 22 October 2026. Branch: `feat/info-cards`.

**Phase 1A was not accepted.** This document preserves the initial prototype's evidence; see the latest [static visual refinement](visual-refinement.md) for current screenshots, measurements and review instructions. The [first visual correction](visual-correction.md) is also retained as history. Automated checks did not establish visual acceptance. Phase 1B, Phase 1C and backend implementation have not begun. Nothing has been committed.

Scope follows the [engineering plan](../info-cards-engineering-plan.md), sections 8 and 14, and the [functional specification v0.3](../../../../design/features/info-cards/info-cards-functional-spec.md). The source specification and plan were preserved during this implementation task.

## What is implemented

- The actual `StepView` footer now has identical Previous/Next tracks, symmetric outer gutters and an index centred on the step/video area. Its existing body allocation is retained.
- An optional diagonal pouch occupies the far-left portion of that same row. Its whole button area is tappable; visible content is only the information icon and attachment count. It is absent without attachments.
- A reusable minimalist info-card face has a single bold body-sized series/title line, a little extra header gap, ordinary paragraph text and one optional compact media control. There is no thumbnail, INFO label, stack index, progress UI, scrolling, line clamp or shrinking-to-fit.
- Series attribution appears on tap, mouse hover or keyboard focus; Escape or outside interaction dismisses it. The face header contains no persistent username.
- A temporary fixture supplies content and can place one **static** open card over the lower navigation region, leaving the upper step visible. It uses the actual `FocusedCardView`, its viewport-fit scale and its actual Step View. It does not draw a separate imitation footer.
- The fixture media control acknowledges the tap with an explicit Phase 1C message. It does not open a media viewer or load a video.

There is no emergence animation, stack browsing, video pause integration, complete modal/gesture isolation, real attachment loading or persistence. The fixture explicitly identifies those later checkpoints. The optional presentation prop is unused by production callers, so temporary info data is not injected into ordinary cards; the real footer geometry applies to the Step View component itself.

## Changed files

| Files | Purpose |
| --- | --- |
| [StepView.tsx](../../../../../src/components/decks/StepView.tsx), [StepView.module.css](../../../../../src/components/decks/StepView.module.css) | Actual footer geometry, optional pouch and static content placement. |
| [FocusedCardView.tsx](../../../../../src/components/decks/FocusedCardView.tsx) | Small optional presentation prop forwarded to Step View; existing scale/state/player lifecycle retained. |
| [InfoCardPouch.tsx](../../../../../src/components/info-cards/InfoCardPouch.tsx), [styles](../../../../../src/components/info-cards/InfoCardPouch.module.css) | Diagonal shape, icon/count, accessible button and focus state. |
| [InfoCardFace.tsx](../../../../../src/components/info-cards/InfoCardFace.tsx), [styles](../../../../../src/components/info-cards/InfoCardFace.module.css) | Minimal card, attributed series tooltip and compact media affordance. |
| [info-cards-fixture.tsx](../../../../../tests/browser/info-cards-fixture.tsx), [fixture styles](../../../../../tests/browser/info-cards-fixture.module.css) | Temporary samples, actual focused-card host, static-open controls and visible fit/fail feedback. |
| [info-cards.browser.ts](../../../../../tests/browser/info-cards.browser.ts), [Playwright config](../../../../../playwright.info-cards.config.ts) | Geometry, content, tooltip, touch-emulation and screenshot/measurement checks. |
| [server.cjs](../../../../../tests/browser/server.cjs) | Separate `/info-cards` fixture entry; optional host/port settings and printed LAN URLs. Default binding remains loopback. |
| [fixture-loader.cjs](../../../../../tests/browser/fixture-loader.cjs) | Per-file CSS Module names, fixing collisions between identically named local classes. |
| [card-video-preparation.spec.ts](../../../../../tests/card-video-preparation.spec.ts), [deck-video-preparation.spec.ts](../../../../../tests/deck-video-preparation.spec.ts) | Adapt existing in-memory esbuild harnesses to emit/load imported component CSS. No production media logic changed. |
| This report and `screenshots/` | Review evidence and phone instructions. |

No global CSS, dependencies, application routes, database structures, migrations, Creator/Library workflows or publication behaviour were changed.

## Automated results

Final relevant Chromium runs: **48 tests passed**.

| Command/check | Result |
| --- | --- |
| `npx playwright test -c playwright.info-cards.config.ts` | 7 passed: three portrait geometries, hover/keyboard attribution, touch-emulated attribution, capacity cases and landscape observation. |
| `npx playwright test -c playwright.media-viewer.config.ts media-viewer.browser.ts ios-video-download.browser.ts --reporter=line` | 20 existing tests passed. Tests named iPhone/Safari simulation still run in Chromium; these are not actual-device Safari results. |
| `npx playwright test tests/card-video-preparation.spec.ts tests/deck-video-preparation.spec.ts --grep-invert webkit --workers=1 --reporter=line` | 21 existing tests passed, including focused-card navigation/preparation and real Chromium decoder cases. Explicit WebKit cases were excluded. |
| ESLint on all changed TS/TSX/CJS files | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. |
| `npm run build -- --webpack` | Production build passed, including TypeScript and static-page generation. |
| `git diff --check` | Passed. |

The default `npm run build` using Turbopack inside the sandbox made no further progress after its initial build message and was stopped. The supported webpack production build outside the sandbox completed successfully. This does not establish the cause of the Turbopack stall. No additional build/browser repair loop was attempted.

The initial test iterations exposed the fixture CSS namespace collision, a card grid sizing issue and a duplicate-line counting issue in preserved-space DOM ranges; these were corrected before the passing final runs. No WebKit run or actual-phone test is represented as passed.

The Phase 1A config also writes machine-readable results and measurement attachments to `switchplay-info-cards-report.json` in the operating system's temporary directory. Browser traces/results go to `switchplay-info-cards-results` there. To regenerate the review images intentionally:

```sh
INFO_CARDS_CAPTURE_DIR=docs/engineering/features/info-cards/phase-1a/screenshots npx playwright test -c playwright.info-cards.config.ts
```

## Measured geometry and capacity

Measurements are **rendered CSS pixels**, after the actual focused-card transform, in Chromium at standard text sizes. They are prototype results, not publication limits or device acceptance.

| Viewport | Info face width × height | Body font / line height | Previous and Next, each | Pouch hit area | Media hit height |
| --- | --- | --- | --- | --- | --- |
| 360 × 780 | 285.0 × 217.1 | 14.25 / 19.24 | 89.6 × 35.3 | 46.1 × 46.1 | 43.4 |
| 390 × 844 | 310.0 × 236.2 | 15.50 / 20.93 | 97.4 × 38.4 | 50.2 × 50.2 | 47.2 |
| 430 × 932 | 328.3 × 250.2 | 16.42 / 22.16 | 103.2 × 40.7 | 53.2 × 53.2 | 50.0 |

At each portrait size, Previous/Next widths and heights match within 0.2px and the index is centred on the step/video within 0.5px (observed error below 0.001px). The pouch's centre aligns with the footer row, its hit area is disjoint from Previous, and toggling attachments/static open content changes the step body height by less than 0.2px. Navigation heights retain the existing footer allocation; phone comfort still requires review.

The baseline card face is 210 × 160 layout pixels, approximately 44% of the main card's height, and is enlarged by the existing viewport-fit transform. Header and body use the same 10.5px baseline font; the header is bold. The following gap is 9px versus 7px between paragraphs. These are revisable prototype dimensions, not fixed publication policy.

At 390 × 844:

| Sample | Observed content | Result |
| --- | --- | --- |
| Maths, media present | 5 lines, 2 paragraphs; 145 source characters including the blank-line separator | Fits. Text uses 114.9px of approximately 125.5px available body height. |
| Basketball, media present | 4 lines, 2 paragraphs | Fits; approximately 94.0px used. |
| Three taller lines, media present | Plain-text placeholders with 32.5px rendered line height, 3 paragraphs | Fits; approximately 118.1px used. This is spacing evidence, not fraction/maths rendering. |
| Same maths text, no media | Same 5 lines and same outer dimensions | Fits; available body height increases to approximately 163.9px. |
| Deliberately long combined header | 535.9px measured overflow width versus 271.6px available | Fails; explicit OVER CAPACITY feedback. The text is not shortened or shrunk. |
| Deliberately long body | 25 lines across 10 paragraphs, approximately 616px used | Fails; explicit OVER CAPACITY feedback. No scroll container, line clamp or discarded text. |

Ordinary content is complete and readable in the tested portrait envelope. Deliberately invalid samples may visibly run beyond their allotted face/parent; they exist to expose failure, not to demonstrate an acceptable published card. They would need publication rejection in a later phase. These samples establish the five-line target, **not the maximum possible text length**. No numeric word/character publication limit has been introduced; titles, glyph widths, newlines and media reservation must all be considered later.

**Short landscape observation (844 × 390):** the existing fit-to-height convention produces an approximately 213.8 × 162.9 face with 10.69px body text and a 34.6px pouch hit area. The sample still fits, but text and touch targets are substantially smaller. This is a recorded limitation, not a supported-viewport readability pass. Browser zoom is not disabled. Actual Safari zoom/text enlargement, VoiceOver, browser-chrome resizing and comfortable tapping remain manual checks; no exceptional-size fallback was added.

## Screenshots

| View | Closed | Static open |
| --- | --- | --- |
| 360 × 780 | [Closed](screenshots/360-closed.png) | [Open](screenshots/360-open.png) |
| 390 × 844 | [Closed](screenshots/390-closed.png) | [Open](screenshots/390-open.png) |
| 430 × 932 | [Closed](screenshots/430-closed.png) | [Open](screenshots/430-open.png) |

Additional evidence: [series tooltip](screenshots/390-attribution.png), [no media](screenshots/390-no-media.png), [basketball](screenshots/390-basketball.png), [taller-line placeholders](screenshots/390-tall-lines.png), [short-landscape observation](screenshots/844-landscape-observation.png).

## View on your phone

The temporary fixture server was left running for review:

**[http://192.168.1.38:4179/info-cards](http://192.168.1.38:4179/info-cards)**

1. Keep the laptop awake and connect the phone to the same Wi-Fi/LAN.
2. Open the address in Safari. The laptop's LAN endpoint returned HTTP 200; access from the phone/firewall still requires your check.
3. Tap the bottom-left pouch or the fixture's **Static open** control. Tap the series title to reveal attribution; tap body text to dismiss that tooltip without closing the card. Tap the pouch to close.
4. Try Maths/Basketball, toggle Media and Attachments, and inspect the deliberately failing samples. Use the normal Previous/Next controls with the card closed to inspect Intro and Steps 1–3.
5. Review text readability, footer balance, pouch visibility and tap comfort. The media control only reports that the viewer belongs to Phase 1C. Swiping/animated emergence is intentionally unavailable.

If the server has stopped, run this from the repository root:

```sh
SWITCHPLAY_FIXTURE_HOST=0.0.0.0 SWITCHPLAY_FIXTURE_PORT=4179 node tests/browser/server.cjs
```

The startup log prints current LAN addresses; the IP above may change. For laptop-only access use `http://127.0.0.1:4179/info-cards`. If macOS prompts for local-network/firewall access, allow the fixture connection on the trusted network. The server uses temporary synthetic content, bundles no application secrets and requires no account/database. It compiles once; restart it after source changes. When you start it in a terminal, Ctrl+C stops it; the running assistant-started instance can also be stopped on request.

## Manual review and next boundary

**Pending your participation:** actual-phone Safari rendering/readability, tap/tooltip comfort, portrait/landscape/browser chrome, zoom/text size and VoiceOver feedback. Chromium touch emulation is completed automation, not this manual review. The prototype is ready for that review; phone acceptance has not been claimed.

No unresolved automated failure blocks Phase 1A review. Short-landscape scaling and unavailable manual/WebKit coverage are documented above. Phase 1B/1C work and backend/Creator/Library infrastructure await their separate authorisation. No commit has been created.
