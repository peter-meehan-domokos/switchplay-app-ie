# Five explanations: exact explanation-area visual review

This is a development-only review fixture, not Info Card integration. Open
`http://192.168.1.38:4181/dev/maths-renderer#five-explanations` on the existing
Wi-Fi review server. The route's existing production `notFound()` guard remains
unchanged. No renderer or Info Card implementation files were changed.

## Geometry provenance

- `src/components/info-cards/InfoCardEditor.module.css:13`: 240px card width;
  the mobile media query does not change this width.
- `src/components/info-cards/InfoCardFace.module.css:1`: 157px card height,
  12px padding, 1px border, two-row grid, 9.5px Arial/Helvetica prose,
  400 weight and 1.25 line height.
- The same stylesheet at line 25: header line box plus 9px bottom margin;
  line 39: 8.8px inline series button; line 77: bold title; line 82: body
  with no additional padding or border.
- `src/app/globals.css:1`: border-box sizing.

The supplied explanations have no media, so this review uses the real
**text-only/no-media** card allocation. Cards with an optional media row have
less explanation space; these fixtures do not claim to reproduce that variant.
The review also mirrors whole-card responsive scaling from
`src/components/decks/FocusedCardView.tsx:171` and
`src/constants/cardStack.ts:3`: baseline width 252px, viewport padding 18px,
height ratio 1.45, preferred width 394px, maximum 430px and minimum readable
width 284px (bounded by available width and height). Resize and visual-viewport
resize update this review-only transform. No application helper is imported.
This reproduces both local content dimensions and visible screen dimensions;
it does not shrink mathematics to resolve content overflow.

The review mirrors the ordinary frame/header geometry in its own CSS, using an
invisible header reservation. Review labels and status readouts are outside
the frame/body. The actual explanation viewport has zero padding and border:

| Browser | Card frame | Explanation viewport (CSS px) |
| --- | --- | --- |
| Chromium | 240 × 157 | 214 × 110.015625 |
| Firefox | 240 × 157 | 214 × approximately 110.1167 |
| WebKit / iPhone emulation | 240 × 157 | 214 × 111 |

Browser-dependent header font metrics account for the small height variation.
Tests compare each review viewport to the **actual existing InfoCardFace**
rendered through the separate existing `/info-cards` browser fixture, at
320, 390, 430 and 1100px viewport widths. Both local and screen-space widths
and heights must agree within 0.05px (subpixel layout/scale arithmetic). For
example, at a 390 × 844px viewport, WebKit's 214 × 111px local body appears as
approximately 315.905 × 163.857px on screen, exactly as on the real card.
Border, padding,
box-sizing, font size and line height must match exactly.

## Renderer and scrolling

All five sources are passed unchanged as authored strings to `MathsRenderer`.
Balanced maths settings remain 1× prose, 1em indentation, 0.6em display gaps,
0.8em paragraph gaps, existing inline clearance and unchanged 2.3125 working
row arraystretch. The consumer supplies the actual card prose typography.

The review alone owns `overflow: auto`. A separate 100%-sized child represents
the finite body allocation supplied to the existing container measurement
contract. The renderer keeps its natural height and reports intrinsic overflow;
no renderer overflow, parsing or presentation contracts were changed.

Both `\boldsymbol` general rules render using KaTeX bold symbol/relation glyphs
and MathML. Tests inspect glyph font weight, relation classes, source annotation
and expression counts, not only successful parsing.

All five fit in Chromium and mobile WebKit, with no horizontal or vertical
overflow and no rendering diagnostics. Firefox reports vertical overflow for
examples 2–4 because their initial prose has approximately 0.05px of measured
top overhang at the compact card line height. No horizontal overflow occurs.
This existing measurement result is displayed without suppression or styling
changes. Examples 1 and 5 fit in Firefox.

The tests temporarily reduce only the test allocation to 12px height to verify
independent scrolling and continued overflow reporting for every explanation.
A temporary 40px width verifies horizontal overflow remains detectable. These
changes occur only inside automated tests and are not review-page controls or
the dimensions used in the screenshots/results.

`measurements.json` records each browser's actual results through the Wi-Fi URL.
The three `*-review.png` screenshots show the complete five-example section.
They use a tall capture viewport to include the section; the WebKit capture
retains the iPhone 13 profile and 390px width. Capacity results and the LAN
test use the normal device viewport. WebKit's screenshot preparation toggles
a stylesheet, temporarily invalidating measurements, so its image can show
`pending`; live results recover to ready and are independently recorded in
`measurements.json`. This is automated mobile WebKit verification, not a claim
of physical-device or screen-reader testing.

## Verification results

- New review suite: **7 passed, 2 intentionally skipped**. The LAN/iPhone test
  runs only in WebKit, avoiding duplicate non-Safari copies.
- Existing renderer browser suite: **105 passed across Chromium, Firefox and
  WebKit**, combining the full run and the targeted WebKit screenshot rerun.
  Both alignment layouts and mathematical row spacing remain unchanged.
- Renderer unit/isolation tests: **17 passed**.
- Existing application unit tests: **420 passed**.
- Existing Info Card database integration: **26 passed**.
- Existing Info Card browser consultation: **9 passed**.
- Existing Info Card browser capacity: **5 passed**.
- Existing Info Card UI integration/motion/pouch/production checks: **57 passed**.
- `npx tsc --noEmit`, scoped ESLint and `git diff --check`: **passed**.

The initial full browser run began while the fixture was still being edited.
Two new Chromium tests initially read `innerText` from collapsed diagnostic
details; they were corrected to read `textContent`. A WebKit screenshot was
detached by a development-page navigation, and a new WebKit reduced-height
check ran during live changes. The final complete new review suite and the
exact existing WebKit screenshot check passed after the edits stopped.
No existing assertions or renderer implementation were changed to obtain a pass.

## Complete changed-file list

- `src/app/dev/maths-renderer/page.tsx`
- `src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx`
- `src/app/dev/maths-renderer/explanationReview.module.css`
- `tests/maths-renderer/explanation-review.browser.ts`
- `tests/maths-renderer/evidence/five-explanations/README.md`
- `tests/maths-renderer/evidence/five-explanations/measurements.json`
- `tests/maths-renderer/evidence/five-explanations/chromium-review.png`
- `tests/maths-renderer/evidence/five-explanations/firefox-review.png`
- `tests/maths-renderer/evidence/five-explanations/webkit-review.png`

## Reproducing the dedicated comparisons

Use the already running development server on port 4181. In an isolated test
process, start the existing reference fixture server:

```sh
SWITCHPLAY_FIXTURE_PORT=4193 node tests/browser/server.cjs
npx playwright test -c playwright.maths-renderer.config.ts tests/maths-renderer/explanation-review.browser.ts
```

The dedicated tests use `MATHS_INFO_REFERENCE_BASE_URL` if provided, otherwise
`http://127.0.0.1:4193`. They import no Info Card components or capacity utilities
into the renderer or development page. The LAN test intentionally checks the
actual supplied review address, HTTP response and all five ready results.
