# Info Cards Phase 1A — Visual correction against approved images

Date: 22 October 2026. Repository/worktree: `/Users/peterdomokos/projects/switchplay-app`, branch `feat/info-cards`.

**Historical correction evidence — superseded by the [final static visual refinement](visual-refinement.md). Phase 1A remains unaccepted.** The newer report contains the taller face, updated pouch grouping, compact backing pack and integrated close control. Automated results are verification evidence, not visual acceptance. Phase 1B has not started. No commit has been created.

## References inspected before coding

All three supplied images were opened and inspected in the requested order. Originals were not modified:

1. [Closed Step View](../../../../design/features/info-cards/closed-step-view.png).
2. [Open info-card bundle](../../../../design/features/info-cards/open-info-card-bundle.png).
3. [Emerging bundle](../../../../design/features/info-cards/emerging-bundle.png).

All are 941 × 1672 pixels. The latest correction brief takes precedence over older content details: the implementation has no info-card index/INFO label, uses a secondary series label and primary title, and adds the separately approved consultation X. Those older elements remain visible only on the clearly labelled reference side of comparison images.

## Corrected screenshots and direct comparison

| Viewport | Corrected closed | Corrected static open |
| --- | --- | --- |
| 360 × 780 | [Closed](screenshots/corrected/360-closed.png) | [Open](screenshots/corrected/360-open.png) |
| 390 × 844 | [Closed](screenshots/corrected/390-closed.png) | [Open](screenshots/corrected/390-open.png) |
| 430 × 932 | [Closed](screenshots/corrected/430-closed.png) | [Open](screenshots/corrected/430-open.png) |
| 430 × 764 — reference aspect ratio | [Closed](screenshots/corrected/430-reference-aspect-closed.png) | [Open](screenshots/corrected/430-reference-aspect-open.png) |

Direct side-by-side evidence, inspected after capture:

- [Closed reference versus implementation](screenshots/corrected/closed-reference-comparison.png).
- [Open reference versus implementation](screenshots/corrected/open-reference-comparison.png).
- [Series-attribution tooltip](screenshots/corrected/390-attribution.png).
- [Without media](screenshots/corrected/390-no-media.png), [basketball content](screenshots/corrected/390-basketball.png), [three taller lines](screenshots/corrected/390-tall-lines.png).
- [Short landscape observation](screenshots/corrected/844-landscape-observation.png), not a readability acceptance result.

**Comparison method:** actual implementation captures use the real focused-card scale and real Step View at 430 × 764, almost exactly the supplied images' aspect ratio. The comparison boards crop the Step View from each original and from the rendered implementation, display both at 430px width and preserve each aspect ratio. They do not stretch either image to manufacture agreement. Original crop bounds were measured manually (approximately closed: x38, y294, 867 × 1204; open: x37, y294, 869 × 1260), so reference measurements are approximate rather than inferred from the implementation. The fixture toolbar is excluded from these Step View crops; full-viewport captures are also linked above.

The paused-video **appearance** uses an SVG viewBox crop of the approved closed reference's video area (x240, y494, 464 × 822). This reproduces its subject/frame for static review, including its pictured play symbol. It does not load or pause a real video. The fixture server serves only the three explicitly whitelisted reference files, not arbitrary local paths.

## What changed in this correction

### Pocket and footer

- Replaced the inset outlined triangle with a corner-anchored fold. Its positioning context is the Step View surface, even though its markup remains inside the existing footer. Its left and bottom offsets are zero.
- The Step View's existing rounded clipping defines the pocket's outer boundaries. Only the diagonal fold gets a restrained line; there is no outer triangular outline, stitching or dashed decoration.
- The pocket uses a muted blue-grey fill, with the icon/count inside the rounded corner's readable region. Hit testing includes three points across the visible triangle, not just its centre.
- Previous/Next remain identical and symmetric around the centred step index, with a small gap separating Previous from the pouch. No new row or extra footer height was added.
- Reference spacing adjustments apply only when an info supplement or static media preview is supplied. Ordinary Step Views retain their existing spacing. In the fixture, the portrait still and corner pouch share the same stable geometry with attachments on/off; the pouch does not take height from the video.

### Open stack, content and close control

- The stack now spans approximately 95% of the Step View width and rests low over the footer. Two subtle backing edges, separated by four baseline layout pixels, imply a thin pack.
- The readable face uses a dark muted gradient, a restrained border/shadow and soft corners. No dark backdrop is added over the Step View, and the upper portrait still stays visible.
- The corner pouch remains visible in front of the lower-left stack corner. Footer buttons/index retain their layout but are visually hidden while the static stack is open, preventing outlines peeking out beneath it.
- Series text is smaller/lighter; the card title is bold/brighter on the same line, separated by a dot. The series tooltip still works by tap, hover and keyboard without adding a persistent username.
- A separate X sits above the top-right edge of the consultation. Its accessible label is **Close information card stack**. It closes the static stack without closing Step View. The existing **Close step view** X is unchanged.
- The media control remains a compact bottom control with a practical hit area. It only reports the fixture's Phase 1C message; no media playback was introduced.

The typography change replaces the earlier cream-card treatment and equal-weight headings. The previous [initial report](README.md) is retained as historical evidence, clearly marked as superseded.

## Rendered coordinate measurements

All implementation figures below are CSS pixels measured after the actual focused-card transform. Pouch offsets are relative to the **actual Step View bounds**, not its inner padding or footer grid.

| Viewport | Step View origin / dimensions | Pouch dimensions | Pouch left / bottom inset | Top card dimensions | Top card left / right / bottom inset |
| --- | --- | --- | --- | --- | --- |
| 360 × 780 | (9.0, 142.0), 342.0 × 495.9 | 62.4 × 62.4 | 0.0 / 0.0 | 325.7 × 157.4 | 8.1 / 8.1 / 20.4 |
| 390 × 844 | (9.0, 152.3), 372.0 × 539.4 | 67.9 × 67.9 | 0.0 / 0.0 | 354.3 × 171.2 | 8.9 / 8.9 / 22.1 |
| 430 × 932 | (18.0, 180.3), 394.0 × 571.3 | 71.9 × 71.9 | 0.0 / 0.0 | 375.2 × 181.4 | 9.4 / 9.4 / 23.5 |
| 430 × 764 | (18.0, 96.3), 394.0 × 571.3 | 71.9 × 71.9 | 0.0 / 0.0 | 375.2 × 181.4 | 9.4 / 9.4 / 23.5 |

Numerical pouch-inset error was below 0.0001px. Its visible outer curve is clipped by Step View, so the triangular corner does not paint outside the rounded surface. Previous starts to the right of the pouch bounds; measured targets do not overlap.

At **390 × 844**, Previous and Next each measure **91.5 × 38.4px**. The index-to-video centre error is below **0.001px**. The static face rests at approximately **(17.9, 498.3)** and its bottom is **669.5px**, covering the footer beneath it. The portrait still occupies approximately **(95.0, 237.8), 199.9 × 355.4px**. Approximately **260.5px of its upper height** remains above the top card (the close control is to the right of the portrait).

The separate consultation X measures **47.2 × 47.2px**, with its bottom about **8.9px above** the card's top edge. It does not overlap card text or media and is substantially below the Step View X.

## Comparison findings and remaining differences

| Detail | Approved reference, approximate | Corrected implementation / remaining difference |
| --- | --- | --- |
| Pocket anchoring | Triangle formed by left/bottom boundaries and one diagonal | Zero left/bottom inset; existing rounded clipping; no independent outline or seam. |
| Pocket leg size | Roughly 18.7% of Step View width | 18.3%; same corner relationship. Fill/anti-aliasing are recreated in CSS/SVG, not claimed pixel-identical. |
| Open face width | 826 / 869 ≈ 95.1% | 240 / 252 ≈ 95.2%. At a 372px Step View this is approximately 354.3px versus 353.6px from the reference. |
| Open face bottom inset | Approximately 53 / 869 of Step View width | 15 / 252. At 372px, approximately 22.1px versus 22.7px from the reference. The bottom position follows the reference rather than an arbitrary upward shift. |
| Open face height | Approximately 385 / 869 of Step View width | 116 / 252: about 3.9% taller, or 6.4px at a 372px Step View. This preserves the requested five-line content and tappable media control. It is an explicit remaining difference for visual review. |
| Backing layers | Several edges in the older reference | Two restrained edges, following the newer instruction to show only a few thin cards. |
| Closed outer aspect | Approximately 1:1.39; open reference approximately 1:1.45 | The application retains its existing 1:1.45 focused-card ratio in both states. The closed comparison therefore has a taller outer frame at matched width. No unrelated main-card resizing or open/close resizing was introduced. |
| Header / index | Older reference includes a position index and larger standalone title | Deliberately replaced by the newer single-line hierarchy and index prohibition. |
| Consultation X | Absent from the supplied older image | Added as explicitly approved in the correction brief. |
| Upper video appearance | Open source looks dimmer than closed source | Same static closed-frame crop remains present in both states; no consultation dimming/backdrop is added, following the correction brief. |
| App background and main heading | Source includes deck chrome behind Step View | The fixture continues to use actual application components plus its review toolbar. It does not recreate background deck chrome or rasterise the whole approved screen as the implementation. |

**Emergence reference:** the third image was checked for the physical origin and upward/right relationship. In baseline layout units, the corrected pouch-bounds centre to resting top-card centre is approximately **(+103, −50)**; the open reference suggests roughly **(+102, −48)** when normalised to the same Step View width. This gives the later bundle motion a coherent corner origin. No emerging-state animation, rotation sequence or circular browsing was implemented or claimed tested. The existing fixed card dimensions are static at this checkpoint.

These comparisons identify what matches and what differs. They do not assert visual equivalence or acceptance.

## Header hierarchy and content capacity

At 390 × 844:

- Series: approximately **13.0px, weight 400**, muted `#b2bdcc`.
- Info title: approximately **14.0px, weight 700**, brighter `#f0f2f6`.
- Body: approximately **14.0px**, with a 17.5px line height and light `#c9d0da` text on the muted dark surface.
- Header gap: approximately **7.4px**; paragraph gap: approximately **5.9px**. There is one header line and no extra header bar.
- Media control hit height: approximately **47.2px**. The pictured play symbol in the upper static still is not an info-card thumbnail; no thumbnail appears inside the info card.

Measured samples with media present:

| Sample | Outcome at 390 × 844 |
| --- | --- |
| Maths: five lines across two paragraphs, 192 source characters including the paragraph break | Fits; approximately 93.6px used of 96.0px available body height. |
| Basketball: four lines, two paragraphs | Fits; approximately 76.0px used. |
| Three taller plain-text placeholders | Fits; approximately 91.5px used. This reserves line height for future maths; it is not fraction rendering. |
| Deliberately overlong single-line header | Fails with visible capacity feedback; not shortened or shrunk. |
| Deliberately long body | Fails with visible capacity feedback; no scrolling or line clamp. |

Five normal lines also fit at the tested 360px and 430px portrait widths. The body has little spare space at the intended capacity, which is visible review evidence rather than a claim that arbitrary text will fit. No publication limit/backend validation has been introduced. At 844 × 390, existing fit-to-height scaling reduces body text to about 9.7px; that remains an exceptional-size limitation, not a readability pass.

## Tests and verification

Final relevant runs: **50 Chromium tests passed** — 9 correction checks, 20 media-viewer regressions, 21 card/deck preparation regressions. The correction checks measure corner insets, hit-test the visible pocket, verify symmetric navigation and portrait width, check stack placement, heading hierarchy, independent close action, tooltip access and capacity, and produce the comparison boards. Passing them does not establish visual acceptance.

Commands:

```sh
INFO_CARDS_CAPTURE_DIR=docs/engineering/features/info-cards/phase-1a/screenshots/corrected npx playwright test -c playwright.info-cards.config.ts
npx playwright test -c playwright.media-viewer.config.ts media-viewer.browser.ts ios-video-download.browser.ts --reporter=line
npx playwright test tests/card-video-preparation.spec.ts tests/deck-video-preparation.spec.ts --grep-invert webkit --workers=1 --reporter=line
npm run build -- --webpack
```

ESLint on changed sources/tests, TypeScript checking and `git diff --check` also passed. The webpack production build completed. No new WebKit investigation was performed; the explicit WebKit variants remain excluded and are not counted as passed. The iPhone/Safari simulation tests above run in Chromium, not on a phone.

One existing paused-thumbnail decoder test timed out in the first preparation-suite run. After the final change limiting reference spacing to supplemental/static-preview surfaces, the full 21-test suite passed, including that case. There was no player/provider behaviour change; this sequence does not establish a particular decoder root cause, and the earlier failure is not hidden.

## Files involved in this correction

- `src/components/info-cards/InfoCardPouch.tsx` and its CSS module: surface fold, position-independent shape and label.
- `src/components/info-cards/InfoCardFace.tsx` and its CSS module: dark face, compact dimensions and explicit header hierarchy.
- `src/components/decks/StepView.tsx` and its CSS module: corner positioning, restrained stack edges, independent static close control, stable footer and optional static-media presentation.
- `src/components/decks/FocusedCardView.tsx`: forwards the optional static-media presentation; does not alter player logic.
- `tests/browser/info-cards-fixture.tsx` and its CSS module: approved-frame crop and revised realistic/tall-line samples.
- `tests/browser/info-cards.browser.ts`: stronger geometry/content/close checks and direct comparison captures.
- `tests/browser/server.cjs`: whitelisted approved-reference image delivery for the fixture only.
- This report, its new `screenshots/corrected/` evidence, and a supersession notice on the initial report.

No global CSS, backend, database, Creator, Library, publishing, playback or swipe implementation was added. Existing untracked design/plan work and original images were preserved.

## Local and phone review

The corrected fixture is running at:

**[http://192.168.1.38:4179/info-cards](http://192.168.1.38:4179/info-cards)**

Laptop-only URL: **[http://127.0.0.1:4179/info-cards](http://127.0.0.1:4179/info-cards)**.

Connect the phone to the same Wi-Fi/LAN and keep the laptop awake. Refresh an already-open fixture tab to load the correction. Tap the corner pocket or **Static open**, inspect the new X, tap the series title, and compare the screenshots above. The X above the info card closes the stack; the original X at the top of Step View closes Step View. Media is still an acknowledged placeholder action. Swipe/closing animations remain intentionally absent.

To restart from the repository root if needed:

```sh
SWITCHPLAY_FIXTURE_HOST=0.0.0.0 SWITCHPLAY_FIXTURE_PORT=4179 node tests/browser/server.cjs
```

The startup log prints current LAN addresses if the laptop's IP changes. The fixture compiles once, so restart it after source edits. It uses static synthetic content and the approved local images, with no account or database connection. A foreground terminal instance stops with Ctrl+C.

**Still pending:** your visual acceptance and actual-phone Safari/zoom/VoiceOver review. No Phase 1B or backend work may start on the strength of these test results. Nothing has been committed.
