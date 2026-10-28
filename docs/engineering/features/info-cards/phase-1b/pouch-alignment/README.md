# Pouch alignment review — 23 October 2026

This is a targeted pouch-content correction, not a card, footer or animation redesign. Existing staged work was preserved; nothing was committed.

## Geometry and composition

The actual pouch is a 46×46 layout-pixel triangle (`y >= x`), clipped by the Step View's 30px bottom-left radius. The rounded corner removes a meaningful part of the apparent triangle. In pouch-local coordinates, that arc's centre is `(30, 16)`.

The largest circle within this rounded triangle has centre `(15.8934, 30.1066)`, derived from `x = L/4 + R/2 - R/(2√2)`, `y = L-x`, with `L=46`, `R=30`. This is the usable-interior anchor, **not** the rectangular centre `(23,23)`.

- **Closed:** one deliberate icon/subscript composition: a 14px icon, 1.5px horizontal gap and 9.5px numeral. The numeral starts 9px below the icon's top. The circle's centre is shifted 1.5px up/left from the interior anchor to compensate optically for the secondary lower-right numeral. Two-digit counts move farther below the diagonal (13.5px subscript offset), without shrinking the icon. The icon's circle, dot and stem are all centred on the same axis; the dot and stem have a distinct gap.
- **Open:** only the selected card's one-based position, independently centred at the usable-interior anchor. Its actual numeral ink is centred using browser font metrics, rather than centring its advance width/line box. Position changes only on a completed card turn and resets on a fresh consultation.
- Existing `.step-view-actions span` rules were overriding numeral typography and spacing. Scoped pouch selectors now explicitly inherit the intended pouch typography/colour. No global CSS was changed.

The latest user request for a **single positional number in the open pouch** supersedes the earlier no-position-indicator rule for that location only. The closed pouch still shows attachment count. Card faces remain free of indexes, progress dots or extra labels. The button's accessible label still describes its open/close action and attachment count; existing title announcements remain intact.

## Rendered measurements

At **390×844 CSS pixels**, pouch dimensions are **67.90×67.90px**, at page `(9,623.78)`, with a rendered corner radius of **44.29px**. Its diagonal runs from its top-left to bottom-right. Left/bottom anchoring and the shape itself are unchanged.

The following are **rendered CSS pixels**, not the screenshot's 3× raster pixels. Artwork boxes are relative to the pouch's top-left and exclude SVG viewport/line-box whitespace. Clearances are conservative minima across the outer circle and numeral-ink rectangle; diagonal clearance is perpendicular to the line, and rounded-corner clearance is radial to the clipping arc.

| State | Visible artwork box `(x,y,w,h)` | Left edge | Bottom edge | Diagonal | Rounded corner |
| --- | --- | --- | --- | --- | --- |
| Closed `ⓘ` with subscript `5` | `(12.07,33.04,28.96,24.10)` | 12.07 | 10.76 | 4.27 | 5.51 |
| Open `1` | `(20.66,38.06,5.57,12.73)` | 20.66 | 17.11 | 8.36 | 8.28 |

The closed group's CSS layout box is 30.70×28.05px; the smaller visible-artwork box above is the relevant visual measurement. The open numeral's measured ink centre is within 0.02 layout pixels of the intended interior anchor. Checks also cover 360×780 and 430×932 viewports, two-digit attachment counts, and open position `12`.

## Screenshots and review

- [390px closed composition](390-pouch-closed.png) · [closed close-up](390-closed-detail.png)
- [390px open composition](390-pouch-open.png) · [open close-up](390-open-detail.png)
- [360px closed](360-pouch-closed.png) · [360px open](360-pouch-open.png)
- [430px closed with 12 attachments](430-pouch-closed.png) · [430px open](430-pouch-open.png) · [open position 12](430-pouch-open-12.png)

These are real Chromium screenshots of the integrated Step View at 3× device pixel ratio. Both complete compositions and the close-up artwork were visually inspected. Iteration caught and corrected inherited footer typography, glyph-bearing miscentring and insufficient two-digit diagonal clearance; these were not treated as acceptable merely because other tests passed.

The rebuilt LAN fixture remains at **http://192.168.1.38:4180/info-cards/integration?review=pouch-alignment** on the same Wi-Fi. Choose 5 cards, open a main card, then Intro/a step; tap the pouch and swipe to check the open positional numeral. Phone/Safari visual review is still required; Chromium screenshots are not a claim of user acceptance or real-device testing.

Tests: `INFO_CARDS_POUCH_CAPTURE_DIR=docs/engineering/features/info-cards/phase-1b/pouch-alignment npx playwright test -c playwright.info-cards-integration.config.ts`. The three dedicated geometry cases attach full JSON measurements. The retained Phase 1A geometry/content suite runs with `npx playwright test -c playwright.info-cards.config.ts`.
