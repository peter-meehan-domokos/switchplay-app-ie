# Info Cards Phase 1A — Final static visual refinement

22 October 2026. Worktree: `/Users/peterdomokos/projects/switchplay-app`; branch: `feat/info-cards`.

**Pending your visual review. Phase 1A is not accepted.** This report supersedes the [previous correction evidence](visual-correction.md), which is retained for comparison. No Phase 1B, Phase 1C or backend implementation was started. Nothing was committed.

## Review images

| Viewport | Closed | Static open |
| --- | --- | --- |
| 360 × 780 | [Closed](screenshots/refined/360-closed.png) | [Open](screenshots/refined/360-open.png) |
| 390 × 844 | [Closed](screenshots/refined/390-closed.png) | [Open](screenshots/refined/390-open.png) |
| 430 × 932 | [Closed](screenshots/refined/430-closed.png) | [Open](screenshots/refined/430-open.png) |
| 430 × 764 — reference aspect ratio | [Closed](screenshots/refined/430-reference-aspect-closed.png) | [Open](screenshots/refined/430-reference-aspect-open.png) |

Also captured and visually inspected: [closed comparison](screenshots/refined/closed-reference-comparison.png), [open comparison](screenshots/refined/open-reference-comparison.png), [attribution tooltip](screenshots/refined/390-attribution.png), [three taller lines](screenshots/refined/390-tall-lines.png). Additional captures cover [basketball](screenshots/refined/390-basketball.png), [no media](screenshots/refined/390-no-media.png) and [short landscape](screenshots/refined/844-landscape-observation.png).

The original closed, open and emergence references were inspected before changes and left untouched. The comparison boards preserve each Step View's aspect ratio at matched widths. **The later instruction to increase the current card height by about 35% deliberately overrides the old reference's short proportions.** The card is not shortened to match those images. The later header, index prohibition, two backing cards and consultation close control also supersede old mockup details. The closed outer aspect ratio, application typography and undimmed reference-frame crop retain the differences explained in the previous report; these are not pixel-identical mockup reproductions.

## Focused changes

- **Pouch icon/count:** replaced the font-dependent circled-i glyph with an SVG containing an explicit circle, separate dot and rounded stem. Icon and count share one centre-aligned flex row with a 2px layout gap. The row is positioned 8px from the pocket's left and 5.5px from its bottom, inside the triangular and rounded boundaries. A new rendered-coordinate check protects the entire count from diagonal clipping, rather than merely testing its centre.
- **Corner pocket:** left/bottom positioning is still exactly zero. The open fill is closer to the card surface; fold stroke opacity falls from 13% to 2.5%. Closed hover highlighting no longer brightens the open pocket. The pocket remains visible without a strong diagonal crossing the media row.
- **Height and spacing:** face height is **157 layout pixels instead of 116 (+35.3%)**; width stays 240. Padding increases from 7 to 12, the header-to-body gap from 5 to 9 and paragraph spacing from 4 to 7. The media target now sits completely inside the card with a positive 4px top margin, replacing the negative bottom margin. Body/header font sizes are unchanged. These are local component layout units; actual rendered sizes follow existing focused-card scaling.
- **Header:** the secondary series stays smaller/lighter than the bold, brighter card title, on one line with a discreet dot. The consultation reserves the line's right end for its close target. Series attribution remains available by tap, hover and keyboard; no persistent username is added.
- **Physical pack:** exactly two backing cards, offset (−2, −6) and (+3, −3) layout pixels, with static rotations of −0.35° and +0.4°. Small opposite-side reveals replace inset, evenly spaced horizontal bands. There is no animated fanning, emergence or circular browsing.
- **Close control:** the dedicated X is now integrated at the front card's top-right, with a transparent 32 × 32 layout-pixel target, no floating circular background and a smaller glyph. Rendered checks confirm it clears the title and ends before the body begins. The Step View X is unchanged.
- **Media:** a single compact control, no thumbnail, with comfortable target height and restored bottom clearance. Only the control triggers the existing explicit Phase 1C placeholder message; it does not play media.

## Updated rendered measurements

CSS pixels after the actual focused-card transform. Origin is the viewport's top-left. Full precision, padding, capacity and backing bounds are saved in [refinement-measurements.json](refinement-measurements.json).

| Viewport | Face width × height | Face origin (x, y) | Face bottom | Bottom inset from Step View | Pouch left / bottom inset |
| --- | --- | --- | --- | --- | --- |
| 360 × 780 | 325.7 × 213.1 | (17.1, 404.5) | 617.6 | 20.4 | 0.0 / 0.0 |
| 390 × 844 | 354.3 × 231.8 | (17.9, 437.8) | 669.5 | 22.1 | 0.0 / 0.0 |
| 430 × 932 | 375.2 × 245.5 | (27.4, 482.7) | 728.2 | 23.5 | 0.0 / 0.0 |
| 430 × 764 | 375.2 × 245.5 | (27.4, 398.7) | 644.2 | 23.5 | 0.0 / 0.0 |

The bottom anchor and width are unchanged. At 390 × 844, height rises from 171.2 to 231.8 rendered pixels, moving the top up by 60.5px as a direct consequence of growing upward from the same bottom anchor. The face occupies about 43% of Step View height. Approximately 200px of the upper static video remains visible, out of its 355.4px total height. No new footer row or reduced video allocation was introduced.

At that viewport, Previous/Next still each measure 91.5 × 38.4px; index-to-video centre error is below 0.001px. Pouch bounds remain 67.9 × 67.9px, flush to Step View within 0.0001px numerical error. The consultation close target and media target height are both 47.2px; at 360px width they are 43.4px. The close control is at (324.9, 437.8), within the front card's top-right, not above it.

## Content capacity and limitations

At 390 × 844, body text is still 14.0px with a 17.5px line height; series/title remain approximately 13.0/14.0px with weights 400/700. Padding is now 17.7px, header gap 13.3px and paragraph gap 10.3px. The media target ends approximately 19.2px above the face's bottom edge.

| Sample with media | Measured body use / available height at 390 × 844 | Outcome |
| --- | --- | --- |
| Maths: five lines, two paragraphs; 192 source characters including the break | 98.0 / 109.2px | Fits |
| Basketball: four lines, two paragraphs | 80.5 / 109.2px | Fits |
| Three taller plain-text lines at 26.6px line height | 100.4 / 109.2px | Fits; not actual fraction rendering |
| Deliberately long header | Body fits, header fails | Explicit over-capacity feedback |
| Deliberately long body: 25 lines, ten paragraphs | 531.2 / 109.2px | Explicit over-capacity feedback |

The five-line sample also fits at 360px and 430px portrait widths. Normal content has no scrolling, ellipsis, line clamp, index, dots, separate INFO label or thumbnail. Deliberately oversized fixture content is visibly reported as invalid rather than silently shrunk/truncated; publication validation is not implemented. No-media content retains identical outer dimensions. No arbitrary publication word limit was set.

Existing viewport-fit scaling still makes body text about 9.7px in the exceptional 844 × 390 landscape observation. That screenshot is not a readability/accessibility pass. Real-phone Safari, enlarged text, zoom and physical comfort still require manual review. No browser zoom restriction was added. The approved video frame is a static image crop, not a paused running video.

## Verification

Final relevant runs: **50 Chromium tests passed** (9 Phase 1A geometry/content/interaction checks, 20 existing media-viewer/download regressions, 21 existing card/deck preparation regressions). The new count-clearance assertion initially caught a subpixel overlap with the diagonal; positioning was corrected before the final passing capture run. Automated passes do not establish visual acceptance.

```sh
INFO_CARDS_CAPTURE_DIR=docs/engineering/features/info-cards/phase-1a/screenshots/refined npx playwright test -c playwright.info-cards.config.ts
npx playwright test -c playwright.media-viewer.config.ts media-viewer.browser.ts ios-video-download.browser.ts --reporter=line
npx playwright test tests/card-video-preparation.spec.ts tests/deck-video-preparation.spec.ts --grep-invert webkit --workers=1 --reporter=line
npx eslint src/components/info-cards/InfoCardPouch.tsx tests/browser/info-cards.browser.ts
npx tsc --noEmit --incremental false
npm run build -- --webpack
git diff --check
```

ESLint, TypeScript, whitespace checking and the final webpack production build passed. Chromium touch/Safari simulation is not real Safari coverage. WebKit was not rerun or counted as passed; no further crash investigation or virtual iPhone infrastructure was introduced.

## Files changed in this pass

- `src/components/info-cards/InfoCardPouch.tsx`: explicit SVG information icon and grouped count.
- `src/components/info-cards/InfoCardPouch.module.css`: group placement, open fill/seam and closed-only hover treatment.
- `src/components/info-cards/InfoCardFace.module.css`: taller face, restored spacing and contained media target.
- `src/components/decks/StepView.module.css`: compact physical backing edges, header clearance and integrated close target.
- `tests/browser/info-cards.browser.ts`: count clearance/alignment, taller face, side reveals, close/content/media separation, measurements and updated comparison caption.
- This report, measurement JSON, `screenshots/refined/` and historical report pointers.

Other pre-existing worktree changes were preserved. No global CSS, dependencies, backend, migrations, application routes, Creator/Library workflows, animation or gesture infrastructure changed in this pass. The functional specification and engineering plan were not edited.

## Local and phone review

The final fixture is running at **[http://192.168.1.38:4179/info-cards](http://192.168.1.38:4179/info-cards)**; laptop: **[http://127.0.0.1:4179/info-cards](http://127.0.0.1:4179/info-cards)**. Both addresses returned HTTP 200 from the laptop; this does not verify phone access. Use the same Wi-Fi/LAN, keep the laptop awake and refresh an existing tab. Tap the corner pocket or **Static open**, inspect the new in-card X, and tap the series for attribution. Media is intentionally only a placeholder action; swiping/animations are absent.

Restart from the repository root if needed:

```sh
SWITCHPLAY_FIXTURE_HOST=0.0.0.0 SWITCHPLAY_FIXTURE_PORT=4179 node tests/browser/server.cjs
```

The server compiles once; restart after source edits. Startup prints current LAN addresses if the IP changes. It serves synthetic fixture content and whitelisted local reference images without an account/database connection. It stops with Ctrl+C. **Your visual acceptance and actual-phone review remain pending.**
