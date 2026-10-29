# Integration Stages 1–2: final refinements

23 October 2026 · `feat/step-visuals` · **Approval B remains pending human review**.

This implements the latest targeted refinement request, including its reusable Tooltip amendment. It supersedes the initial values and precision in the [previous correction report](approval-b-fidelity-review.md); that report remains historical evidence, not the current initial-state specification. The [experience specification](../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md) now records the approved changes.

## Delivered

- **Previous** on the left, **Next** on the right. Stage 1's Previous is disabled. Later teaching panels and Stage 6's region/limits/calculation substeps support Previous. Finished retains the existing terminal Start again action.
- Stage 1 starts at **b = 1**. Marker, native slider, shaded region and canonical mathematical state remain continuous. `display-policy.ts` independently prepares a boundary rounded to one decimal and calculates area from that same rounded value: continuous 2.34 → displayed b = 2.3 → displayed area 4.6. Whole numbers have no trailing zero. This is an explicitly approved display approximation, not the true unrounded area's mathematical authority, not a snapping policy and not an assessment rule. Accessible text explains the readout policy.
- Stage 1 feedback is a compact **Shaded area** / secondary **square units** row followed by **A = 2b = 2 × 1 = 2**, rather than a wrapping sentence.
- Stage 2 starts with **y = 2 (constant)**, fixed b = 3 and four rectangles. Selector location, single width slider and live geometry are retained.
- Estimated areas use at most two decimals: rising n = 4 displays **≈ 5.63**, while the internal rectangle sum remains 5.625 and actual area is 4.5. The `≈` reflects a non-exact estimate of the actual area, not just display rounding. Constant estimates remain exactly **= 6** at every count. No unnecessary trailing zeros.
- Both occurrences of **estimated** use the same dotted-underlined reusable `Tooltip`. Its title and definition match the approved wording exactly. It opens on click/tap/keyboard activation, toggles closed, dismisses on outside pointer/focus interaction or Escape, and follows measured viewport geometry without reflow. No backdrop or event suppression blocks other controls. Host suspension unmounts the popup. Definition viewing is presentation state, not assessment assistance or a learning-record event.

## Navigation and evidence

The reducer holds bounded previous/forward panel snapshots containing only mathematical choices, prediction/presentation state and answer drafts—not copied record histories, revisions or editing transactions. Previous/Next restores visited values and progression. Active edits, stale actions and inactive surfaces remain guarded. No history processing is added to pointer previews.

Accepted prediction, Check and assistance evidence is never rewound. Stage 2 function changes invalidate an incompatible saved Stage 3 prediction, not the historical record. Stage 6 substeps share the current region: revisiting them does not silently reset limits. Returning to an unchanged calculation preserves its draft; changing its mathematical problem clears stale draft/feedback while retaining assistance evidence. Successful completion is still delivered once. Restart creates a fresh attempt and clears its navigation trail while preserving supported archives.

`stage-changed` events add an optional `direction: "previous" | "next"` field. Existing event types and record ownership remain compatible; there is no persistence or application-specific integration.

## Reusable Tooltip boundary

Public exports: `Tooltip` and `TooltipProps` from the feature's `public.ts`.

```tsx
<Tooltip title="Estimated area" content="The estimated area is found by adding together the areas of all the rectangles.">
  estimated
</Tooltip>
```

Props are `children: string`, `title: string`, `content: string`, optional `disabled`. Disabling unmounts the active implementation and portal. The web component owns DOM measurement, React portal, dismissal and ephemeral visibility. `core/presentation/tooltip-layout.ts` prepares plain placement data, preferring above when it fits, otherwise below, with visible-viewport clamping. It is not a glossary registry or a general popup framework.

The popup uses the existing palette and typography, capped at 18rem and viewport width. Inline term targets have a 24px minimum height without making a large visual button; essential navigation/manipulation controls retain their existing 44px targets. The component connects its native trigger to the mounted `role="tooltip"` through expanded/control/description attributes. Physical screen-reader behaviour remains a manual verification item.

No dependencies were installed. `react-dom` was already installed; the isolation allowlist now explicitly permits its browser portal import. Portable mathematical/layout modules still import no framework or browser APIs.

## Verification

- **131 pure tests passed**, including mathematical/layout, navigation restoration, invalidation/evidence, precision, Tooltip placement and feature isolation.
- **53 Chromium browser tests passed**, including real intermediate non-integer geometry, native sliders/cancellation, both Tooltip triggers, touch/keyboard/outside/Escape dismissal, full backward/forward navigation across all six stages, preserved drafts/evidence, restart, lab navigation and Roots and Factors manipulation regressions.
- **3 production browser tests passed**: both mobile screenshot sequences and Tooltip keyboard/dismissal behaviour.
- Scoped ESLint, production build, final post-build TypeScript and diff checks passed.
- WebKit was not run, following the user's environment instruction. Chromium mobile/touch emulation is not physical Safari or VoiceOver testing.

### Mobile screenshot evidence

Every captured normal state has **document scroll height 852px at 393×852** and **844px at 390×844**, with no horizontal or vertical overflow, including open popups and Previous/Next. Function/count changes and popups preserve graph geometry. An additional 393×700 check passes. At 320×568 with 200% root text sizing, controlled scrolling is allowed; controls and popups reflow without horizontal overflow.

Capture root: `/private/tmp/integration-refinements-final/`, separate directories ending `393-×-852-chromium` and `390-×-844-chromium`:

1. `01-stage-1-initial-b-1.png`
2. `02-stage-1-boundary-moved.png`
3. `03-stage-2-constant-four-rectangles.png`
4. `04-stage-2-rising-four-rectangles.png`
5. `05-stage-2-narrower-rectangles.png`
6. `06-stage-2-return-to-constant.png`
7. `07-stage-2-return-to-rising.png`
8. `08-tooltip-instruction.png`
9. `09-tooltip-feedback.png`

JSON measurement attachments accompany each viewport test. Screenshots are actual rendered application captures, not conceptual illustrations. Manual screenshot review checked the updated initial states and both popup placements. Review artifacts are local/generated, not committed application assets.

## Scope and files

Added within the feature: `activities/integration-area/display-policy.ts`, `platform/web/tooltip.tsx`, `platform/web/tooltip.module.css`, `core/presentation/tooltip-layout.ts`, `tests/integration-refinements.spec.ts` and `tests/integration-refinements.browser.ts`.

Updated Integration `learning.ts`, `records.ts`, `presentation.ts`, `graph-layout.ts`, `intro-stages.tsx`, `intro-stages.module.css`, `integration-activity.tsx`, and only the navigation rule in `integration.module.css`; public exports; isolation checks; affected Integration and LAN browser fixtures. The experience specification and implementation note document the approved refinements. No Card 1 source, global CSS, header terminology, configuration or dependency files changed in this pass. Earlier uncommitted changes remain preserved.

Stages 3–6 retain their existing mathematics, controls and presentation except the requested Previous navigation. Their previously audited one-screen/fidelity gaps are not fixed in this pass. Stage 6's calculation panel gains the requested Previous row; this does not claim to resolve that stage's existing overflow.

## Phone review

The development server remains bound to `0.0.0.0:3171`. Both `http://localhost:3171/step-visuals` and `http://192.168.1.38:3171/step-visuals` return HTTP 200; LAN-origin browser tests also verify hydration and interaction. Use the same Wi-Fi, burger → **Integration → Area and accumulation**.

No restart is needed. If starting a new review server later, from the repository run `npm run dev -- --hostname 0.0.0.0 --port 3171`; Ctrl+C stops that terminal's server. Do not start another process while that port is already occupied. The Wi-Fi address may change with the network; the existing exact development-origin allowlist must match it.

Manual attention is useful for tooltip discoverability/readability and touch feel in actual Safari, not repeating the already automated formulas or navigation cases. No commit or push was made. Approval B remains the reviewer's decision.
