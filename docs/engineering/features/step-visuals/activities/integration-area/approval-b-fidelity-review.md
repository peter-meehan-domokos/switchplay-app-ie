# Integration: Approval B fidelity correction

Date: 23 October 2026. Branch: `feat/step-visuals`.

**Current authority:** the approved [seven-stage design](../../../../../design/features/step-visuals/puckle-integration-seven-stage-approved-design.md) and the three final decisions in the [approved implementation plan](seven-stage-experience-impl-plan.md#11-final-approved-educational-decisions). The **Seven-stage implementation — 24 October 2026** section at the end records current results. All earlier six-stage audits, screenshots, counts and correction instructions remain historical evidence. Approval B still requires human review.

**Historical correction record:** the [subsequent final refinement](final-refinements-review.md) changes Stage 1's initial boundary/readout, Stage 2's default/precision, adds Previous, and introduces the reusable Tooltip. Its current values and verification supersede those below. The later-stage discrepancy audit remains relevant, except for the now-added Previous navigation.

**Approval B is not granted.** The original pass below corrected Stages 1–2 and audited Stages 3–6 without rewriting their experience. The appended **Agreed Stage 3–6 correction and implementation** section records the subsequent explicit educational decisions and their implementation. Historical discrepancies, suggestions and test counts below are preserved as historical evidence, not current instructions. Automated evidence and rendered screenshots support another physical-iPhone review; they are not approval or physical Safari verification.

## Authority and scope

Read alongside the [experience specification](../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md), [six-stage reference](../../../../../design/features/step-visuals/Six-Stage-Mobile-Maths-Learning-Flow.png) and [implementation note](implementation.md). The user's explicit Stage 1–2 correction overrides previous implementation choices and conflicting numerical captions in the reference. Reference content, controls, placements and one-screen composition are binding; its decorative styling is not.

The activity-isolation amendment takes precedence over extracting shared infrastructure prematurely. No new controls, mathematical activities, dependencies, application integration, commits or pushes belong to this correction.

## Stages 1–2: corrected implementation

### Stage 1

- Title **Area under a graph**; function `y = 2`; initial right boundary `b = 2.4`; interval `[0,4]`.
- A native continuous range input sits directly beneath the graph, labelled **Right boundary**, with visible endpoints 0 and 4. Native track taps and keyboard operation do not require dragging. The graph boundary remains directly draggable.
- The boundary marker sits at the true intersection `(b,2)`, not an arbitrary vertical control lane. Its horizontal coordinate, shading and area share one effective mathematical value.
- Initial feedback: **Shaded rectangle area: A = 2b = 2 × 2.4 = 4.8 square units**. `A(b)` is absent from this stage. Rounded live values use approximation signs, not false equalities.
- Insight: **The height stays at 2. Each extra unit of width adds 2 square units of area.**
- There is no numerical boundary field or Set button. Next remains free exploration progression, not a hidden assessment.

### Stage 2

- Title **Refine the rectangles**; fixed interval `[0,3]`; initially `y = x`, four right-endpoint rectangles.
- Selector above the graph: **y = 2 (constant)** / **y = x (rising)**.
- One continuous-track width slider below the graph, with **Wider**, **Narrower**, and **Rectangles: n**. No count dropdown, boundary field, Set button or draggable boundary handle.
- A logarithmic track supports all integer counts from 1 to 128, rather than just eight preset counts. A finite rectangle partition necessarily has an integer count; the control is one continuous track, not a discrete-choice menu. Arrow keys change count by one; Home/End reach 1/128. Native tapping offers non-drag touch operation.
- Initial estimate **5.625**, actual area **4.5**. For 128 rising rectangles the estimate displays **≈ 4.535**, not an exact rounded equality. The constant graph displays estimated and actual area **6**.
- Function changes retain the partition count, interval, control inventory and reserved feedback space. The constant explanation correctly says the estimate is already exact; it does not promise that refinement improves an exact result.

### Ownership, reuse and containment

`intro-stages.tsx` and `intro-stages.module.css` are Integration-specific. They replace the spacious early-stage composition without modifying Card 1's frame or styling. Native range transactions share the existing Integration reducer's begin/preview/commit/cancel ownership: both graph and range manipulation use one mathematical authority. Pointer candidates, cancellations and unchanged releases add no history. A changed rectangle-slider release records one refinement event, rather than every intermediate count. Keyboard placements/refinements are deliberate commits.

Stage 1 commits the continuous value; its older tenth-unit release snapping is removed for this stage only. Stages 3–5 retain their existing tenth-unit policy and Stage 6 its integer policy. Continuous mathematics and display rounding remain distinct.

The existing pure polynomial model, D3-backed projection/area/curve preparation, declarative graph renderer, public records and lab navigation are retained. The graph receives a local class override; its default later-stage styles remain unchanged. Obsolete early-stage controls are removed from the legacy controls component; Stage 3's existing selector and Stages 3–6 controls retain their behaviour.

The lab host has one narrowly scoped `:has([data-integration-intro])` rule to include its header's 1px border in the available-height calculation. It applies only while Integration Stage 1 or 2 is mounted. It does not change menu appearance, Card 1 or the later Integration stages. Collapsed learning-record diagnostics remain available below the activity.

At normal target sizes, flex composition gives the graph the available height after controls and text. The frame uses a minimum height, not a fixed-height box that lets enlarged text overlap subsequent content. At shorter browser heights, gaps and spare reservation shrink before the graph reaches its supported 200px minimum; text and 44px touch targets do not shrink. At enlarged text, content reflows and may scroll. The graph surface contains stale overlay bounds during resize until its measurement updates.

## Requested screenshots and viewport measurements

All screenshots are genuine Chromium-rendered application captures at 100% normal text, not mockups. The 393×852 size is the previously supplied iPhone-sized viewport; 390×844 is the additional requested reference. These are CSS pixels. No new physical-device visual-viewport measurement was available to this run.

| Screenshot/state | 393×852: viewport / document height | 390×844: viewport / document height | Overflow |
| --- | --- | --- | --- |
| 01 — Stage 1, initial b = 2.4 | 852 / 852 | 844 / 844 | None |
| 02 — Stage 1, moved to b = 2.6 | 852 / 852 | 844 / 844 | None |
| 03 — Stage 2, rising, four rectangles | 852 / 852 | 844 / 844 | None |
| 04 — Stage 2, increased to 128 rectangles | 852 / 852 | 844 / 844 | None |
| 05 — Stage 2, constant, 128 rectangles | 852 / 852 | 844 / 844 | None |
| 06 — Stage 2, back to rising, 128 rectangles | 852 / 852 | 844 / 844 | None |

For each capture, automation checks both document dimensions, bounding boxes of essential content/controls and graph visibility. Stage 2 explicitly verifies selector-above-graph placement, exactly one slider, no combobox/number input, initial exact values, retained count and invariant graph/axis geometry after refinement and both switches. Stage 1 verifies slider-below-graph placement and unchanged geometry through boundary movement. Additional values include 0, 0.01, 1, 2.375, 3.999 and 4.

Screenshots and JSON measurement attachments are generated review artifacts, not application assets. The final capture root is `/private/tmp/integration-fidelity-final/`, with separate `393-×-852` and `390-×-844` test directories. Files are named `01-stage-1-initial-b-2.4.png` through `06-stage-2-return-to-rising.png`.

Visual review examined the six 393px states for hierarchy, readability, unchanged control inventory and stable feedback. Automated bounds and numerical assertions establish fit and correctness, not subjective educational clarity or finger feel.

## Stages 3–6: read-only discrepancy audit

The table distinguishes implementation differences from conflicts between the two authoritative references. None of these observations authorises an unreviewed redesign.

| Stage | Wording, initial values and objects | Controls: present, added or missing | Spatial continuity, fit and expansion | Exploration versus assessment |
| --- | --- | --- | --- | --- |
| 3 — Predict/test | Current title “Predict, then test”; starts b = 2 with the function selected in Stage 2. Mockup starts rising. Rising options currently Doubles/Triples/Quadruples; reference shows Doubles/Quadruples/Eightfold. Written spec supports the current function-specific choices. | Function selector is below the graph, unlike the reference above. Prediction buttons commit immediately; reference shows radio choices plus “Move to 4 and check”. After predicting, current implementation exposes graph dragging plus number input/Set rather than the reference's action. Required prediction-before-test logic exists. | Current graph/axes remain stable through prediction/reveal. Feedback adds content height: **949 → 1008px** at a viewport height of 844. Both states need scrolling. | Current prediction is recorded before learner movement; settling b = 4 tests it. Written spec explicitly supports this. Whether the reference action is confirmation, automatic movement or instruction needs clarification, not silent implementation. |
| 4 — Starting point | Current “Choose the limits”; correct y = x, initial a = 1, b = 4; full area 8, removed area 1/2, remainder 7.5. Multiple equations and a long explanation are denser than the reference. | Native left-boundary slider is missing. Both a and b have graph handles and number input/Set controls; the reference's primary control is a left-boundary slider with b = 4 shown. Editable b is supported by the written domain but differs from that composition. The removed-area annotation is textual rather than attached to the graph as in the reference. | Shares the Stage 3 frame and mathematical scales. Current full page is **1049px** at 844px viewport height. Boundary changes retain controls, but values/line wrapping need reservation in a later correction. | Free investigation and dynamic subtraction exist; no invented Check. Need resolve whether b remains fixed while a is the lesson's primary variable. |
| 5 — Between curves | The annotated functions agree: upper y = x, lower y = x² − 3x. Current initial selection is upper/axis, a = 1, b = 3; the reference shows the lower curve already selected. Its hand-drawn line placement must not be interpreted as authorisation for a different function. | Top and Bottom selectors are correctly ordered relative to one another. They follow a separate mathematical block rather than immediately following the graph. The required right-boundary slider is missing; a number input/Set and graph handle are used instead. No unauthorised assessment is added. | Stage 4 mathematical frame remains. Current page is **1043px** both initially and after choosing the lower curve; text varies but this tested selection does not increase page height. Still fails one-screen fit. | Free region selection, including valid zero area, follows written requirements. The initial shaded region differs from the reference's between-curves scene. |
| 6 — New example | Correct new objects y = 9 + 2x and y = 3x²; initial [1,2]. Current headings split construction into “Choose what area to measure”, “Choose where to measure”, “Calculate the area”. The reference shows all three sections together. | Current top/bottom selectors and number input/Set controls replace reference height-expression and interval radio groups. Controls accumulate across subparts; answer/Check and optional hint add further content. The reference's “From 1 to 3” is excluded by the written [0,2] domain for a mathematical reason: the curves cross before 3. | A justified, introduced new mathematical frame exists and remains stable within Stage 6. Page heights are **991 → 1099 → 1141px** across region/limits/calculation, and **1249px** after wrong feedback + hint, all at 844px viewport height. One-screen composition and fixed feedback accommodation fail. | Existing free region/limits then explicit calculation assessment follows the written spec. Literal incorrect-looking height choices in the reference conflict with that free-construction policy. Do not turn valid region choices into wrong answers without a decision. |

At 393×852, measured corresponding heights are: Stage 3 **957/1016**, Stage 4 **1057**, Stage 5 **1051/1051**, Stage 6 **999/1087/1149/1257**. No horizontal overflow occurred in these audit captures. These failures remain open; passing regression tests does not waive them.

### Conflicts requiring decisions before later-stage correction

1. **Stage 3 choice/control semantics:** mockup radio choices and “Move to 4 and check” versus written explicit prediction followed by learner movement and committed b = 4. Recommendation: preserve learner-performed testing, clarify the button's exact role, and confirm the intended distractor set before changing controls.
2. **Stage 4 boundary scope:** mockup emphasises changing a with b = 4; written implementation-domain section permits both. Recommendation: follow the mockup's single primary left-boundary slider and keep b fixed for this investigation unless both editable bounds are explicitly required.
3. **Stage 6 free construction and domain:** written requirements prohibit assessing free setup, while the mockup offers expression choices including a reversed negative height. It also offers [1,3] for curves crossing at `(1 + 2√7)/3 ≈ 2.097`. Recommendation: retain correct free construction and an ordered [0,2] domain unless the educational specification deliberately introduces curve crossings; confirm a faithful, mathematically valid control inventory before implementing it. Never conceal the crossing with absolute values or clipped mathematical truth.

Resolved Stage 2 conflict: the mockup's final caption says exact area 2 despite the drawn boundary at 3. The explicit correction settles this: exact area **4.5**, right-endpoint estimate **5.625** for four rectangles. No new product decision is needed for Stages 1–2.

## Verification and remaining review

- Entire pure project: **125 passed**, including mathematics, reducer transactions, delivery contracts and feature isolation.
- Chromium Integration/lab/Card 1 manipulation regression selection: **49 passed**. Includes native touch injection at the real LAN origin, both activity selections, continuous direct manipulation, keyboard, native-slider cancellation/stale events, capture safeguards, enlarged text, a 393×700 shorter phone viewport and existing Card 1 geometry/behaviour.
- The five dedicated introduction tests are included in that 49-test result. Both target screenshot sequences also passed against the production build: **2 production tests passed**, capturing all six states per viewport.
- Scoped ESLint, production build, final post-build TypeScript and `git diff --check` passed. All **32** local documentation links checked successfully. No new dependencies or configuration changes were made in this correction.
- WebKit deliberately not run, as requested. Chromium iPhone emulation is not physical Safari, VoiceOver or TalkBack evidence.

Review on the same Wi-Fi: `http://192.168.1.38:3171/step-visuals`, then burger → **Integration → Area and accumulation**. Inspect hierarchy/readability and slider/direct-boundary feel on the physical iPhone, with browser chrome in its usual state. The automated tests already cover formulas, control presence, function switching, count preservation and the specified viewport fit; no need to repeat those mechanics manually unless the phone behaves differently.

Opening the diagnostic Learning records inspector deliberately expands developer content; the one-screen captures use its default collapsed state. No claim is made that an expanded JSON inspector fits a student screen.

### Files changed in this correction

Under `src/app/step-visuals/`:

- Added `activities/integration-area/intro-stages.tsx` and `intro-stages.module.css`.
- Updated Integration `learning.ts`, `presentation.ts`, `graph-layout.ts`, `integration-graph.tsx`, `integration-activity.tsx` and `integration-controls.tsx`.
- Added the Integration-only lab host rule in `lab/Lab.module.css`.
- Added `tests/integration-intro.browser.ts`; updated `integration-learning.spec.ts`, `integration.browser.ts` and the existing `lab-network.browser.ts` entry fixture.

Documentation: updated the existing experience specification and implementation note; added this fidelity review. Earlier uncommitted work, including the previous LAN-origin configuration fix, was preserved, not recreated or expanded. No Card 1 source/style edits were made in this correction.

### Reproducible final verification

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure --output=/private/tmp/integration-fidelity-pure-final
SPV_TEST_BASE_URL=http://192.168.1.38:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration-intro.browser.ts integration.browser.ts lab-network.browser.ts lab.browser.ts manipulation.browser.ts --output=/private/tmp/integration-fidelity-final
node_modules/.bin/eslint src/app/step-visuals
npm run build
node_modules/.bin/tsc --noEmit
git diff --check
```

Production verification used a temporary `next start --hostname 127.0.0.1 --port 3172`, followed by:

```sh
SPV_CONSOLE_PRODUCTION=1 SPV_TEST_BASE_URL=http://127.0.0.1:3172 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration-intro.browser.ts --grep 'approved introductory compositions' --output=/private/tmp/integration-fidelity-production
```

That temporary production process was stopped. The Wi-Fi development process remains listening on `0.0.0.0:3171`; both localhost and `192.168.1.38` returned HTTP 200. LAN browser tests verified hydration and interaction, not only the HTML response. Nothing was committed or pushed.

## Agreed Stage 3–6 correction and implementation

### Authority and decisions — 23 October 2026

The subsequent human educational review explicitly resolves the three earlier conflicts. These decisions supersede the historical recommendations above and obsolete controls in the six-stage image. The durable [experience specification](../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md) has been updated in place. Approval B remains pending.

| Stage | Agreed correction from the historical audit | Implemented experience |
| --- | --- | --- |
| All six | Numbered headings; one stage per normal phone screen; concise instructions and no accumulating panels. | Normal heading typography with `1.` through `6.`; Stage 1–2 composition is otherwise preserved. A compact Integration-specific later-stage grid reserves feedback space and a stable graph frame. |
| 3 | Replace prediction → drag to target → confirmation with an automatic comparison and one selection. | Inherit the selected function, begin at b = 2, pause briefly, then animate to 4. Original-region dashed outline remains visible. Reduced motion shows the final comparison immediately. Selector is above the graph with exact Constant/Rising labels. No boundary input, drag requirement or Check. Any one selection reveals the two area values and enables Next. Switching function resets visible answer/result and replays the comparison. |
| 4 | Reverse the old variable: fix a = 1 and move b, making the excluded triangle genuinely invariant. | Start b = 4; graph and native range track continuously over [1,4]. Release smoothly settles to the nearest integer in 150ms, or immediately for reduced motion. Keyboard changes are integer-valued. Fixed a has no editor. Separate whole/removed/shaded calculations use vertical fractions and exact mixed numbers; the fixed ½ and C = −½ are retained with a restrained optional explanation. |
| 5 | Start between line and parabola; unrestricted selector order, valid equal curves; continuous boundary slider. | Initial region y = x / y = x² − 3x over [1,3]. First/Second curve selectors preserve the student's order; pure mathematics derives top/bottom over the entire interval. Same-curve selections give zero area. Fix a = 1; b remains continuously draggable and slider-controlled without release quantisation. Strip and area reflect the same ordered region. No assessment or Check. |
| 6 | Free construction in the first two substeps; only calculation assessed; retain [0,2]. | “Choose what area to measure” → “Choose where to measure” → “Calculate the area”. Show only the current editing controls; preserve graph and generated integral. Function pairs are automatically ordered; equal functions give a valid zero-area construction. Integer endpoint selects enforce a < b. A separate Check calculation submits the numerical answer. Incorrect feedback and requested hint use reserved space; Previous preserves choices and invalidates stale work after changes. |

### Deliberate departures from the old mockup

- Stage 3 animation is now an explicitly approved demonstration, not an unapproved replacement of learner movement. Its one answer is the only required learner action; distractors remain function-specific. No numerical areas are rendered before selection.
- Stage 4's a is permanently 1. Moving b is the approved way to observe a changing total and unchanged removed triangle. The fixed term is qualified; the activity does not generalise it into every integration constant.
- Stage 5 does not label freely selected slots Top/Bottom, since selector order is no longer mathematical ordering. The functions are compared analytically; no absolute-value shortcut masks a crossing or inversion.
- Stage 6 does not reproduce the old mockup's assessed height choices or invalid [1,3] interval. The selected functions keep a single order on [0,2]. Only the generated integral's numerical calculation is assessed.
- Essential controls have native track-tap/select/keyboard access, without duplicate numerical input/Set pairs. No new learning stages, reward system or application integration were added.

### Architecture, reuse and regression containment

Reused unchanged: pure polynomial evaluation/integration, D3 projection/curve/area preparation, existing graph measurement and calibration, notification delivery, lab activity hosting, menu, diagnostics and the reusable Tooltip. Roots and Factors source/styles were not changed by this pass. No dependencies, global CSS or application-specific imports were added.

Activity-specific additions: `later-stages.tsx`, `later-stages.module.css`, `boundary-slider.tsx`, `math-presentation.ts` and `use-stage-motion.ts`. The obsolete Integration-only `integration-controls.tsx` and `boundary-control.tsx` input/Set renderers were removed; their staged source remains recoverable through Git. The existing lab height correction now also recognises this Integration-specific composition; Card 1 is unaffected.

The reducer remains the sole mathematical/learning authority. Stage 3 demonstration progress and Stage 4 continuous settling live there, not in independent SVG transforms. Browser timing/reduced-motion adapters dispatch plain actions. Preview/animation frames preserve the same records reference and never traverse or append history. Stage 4 release retains its editing transaction until the integer commit; cancellation discards it and restores settlement. Pointer capture, final coordinates, grab offset, revision guards and interruption safeguards remain in the platform adapter. Stage 1 and Stage 5 do not inherit Stage 4 snapping.

Curve selections are retained separately from canonical ordered regions; region-choice events include both mathematical values and the selection order. Stage 3 produces one `comparison-demonstrated` event per completed comparison, then `prediction-submitted` and `prediction-tested` together on the accepted selection. Existing calculation, assistance, completion, restart, exit and archived-record delivery remain intact.

Regression testing exposed a browser default-action edge case: morphing a Next button into a form submit button during the same click could assess a restored answer draft. Navigation and Check now have distinct DOM identities, and navigation prevents its default action. A regression traverses every stage backwards and forwards with a correct retained draft, verifies that it remains unassessed, then explicitly checks it.

Accessible announcements include the revealed Stage 3 comparison; opening a hint transfers focus to its content without scrolling. At enlarged text sizes, grid rows grow and scrolling is allowed rather than overlapping/clipping text. Physical assistive-technology behaviour remains to be verified.

### Rendered evidence and mobile fit

Genuine rendered Chromium screenshots use the existing LAN development application, not a standalone mockup. The two reference viewports are 393×852 and 390×844 CSS pixels at normal zoom. Fifteen states per viewport cover:

1. Stage 3 before answering, constant result and rising result.
2. Stage 4 initial b = 4, settled b = 1 and b = 2.
3. Stage 5 initial, reversed selections and identical selections.
4. Stage 6 region, limits, calculation, incorrect feedback, expanded hint and Finished.

| Rendered set | 393×852: viewport / document height | 390×844: viewport / document height | Overflow |
| --- | --- | --- | --- |
| Stage 3, all captured states | 852 / 852 | 844 / 844 | None |
| Stage 4, all captured states | 852 / 852 | 844 / 844 | None |
| Stage 5, all captured states | 852 / 852 | 844 / 844 | None |
| Stage 6, all six substep/feedback states | 852 / 852 | 844 / 844 | None |

Automation checks essential-content/control bounds, horizontal overflow, selector placement, and identical graph position/dimensions across Stages 3–6 and state changes. Axes/domains remain identical through Stages 3–5; Stage 6 deliberately introduces its larger mathematical domain, then keeps that frame fixed. Stage 1–2 regression captures retain their previous one-screen fit, inline units and label lanes. Opening the developer records inspector intentionally expands diagnostics and is excluded from the student-screen fit criterion.

Final screenshot artifacts: `/private/tmp/integration-approval-b-final/` (development) and `/private/tmp/integration-approval-b-production/` (production). Each contains `integration.browser.ts-ren-18185-croll-captures-at-393-×-852-chromium/` and `integration.browser.ts-ren-6fa19-croll-captures-at-390-×-844-chromium/`, with `01-stage-3-before-answer.png` through `15-stage-6-finished.png` and an attached viewport-measurements JSON. These are local generated review artifacts, not checked-in application assets.

Representative production captures at 393×852:

- [Stage 3 rising result](/private/tmp/integration-approval-b-production/integration.browser.ts-ren-18185-croll-captures-at-393-×-852-chromium/03-stage-3-rising-result.png)
- [Stage 4 initial](/private/tmp/integration-approval-b-production/integration.browser.ts-ren-18185-croll-captures-at-393-×-852-chromium/04-stage-4-initial.png)
- [Stage 5 initial](/private/tmp/integration-approval-b-production/integration.browser.ts-ren-18185-croll-captures-at-393-×-852-chromium/07-stage-5-initial.png)
- [Stage 6 expanded hint](/private/tmp/integration-approval-b-production/integration.browser.ts-ren-18185-croll-captures-at-393-×-852-chromium/14-stage-6-hint.png)

Visual inspection reviewed these rendered states for label separation, restrained styling, fraction readability, central graph hierarchy and compact feedback. It complements, rather than replaces, the automated geometry assertions.

### Completed verification

- **137 pure tests passed**, including mathematical invariants, all selector permutations/equal functions, exact Stage 4 fractions, stage-specific release policy, settling cancellation/stale events, navigation snapshots, calculation evidence, delivery guards and feature isolation.
- **86 Chromium browser tests passed** in the consolidated regression selection. Covers corrected Integration interactions and all 30 later-stage phone captures, Stage 1–2 regressions, real LAN hydration/menu use, existing lab behaviour, and Roots and Factors learning/manipulation/retrieval. The new Stage 4 test observes real intermediate DOM values during both dragging and settling, not merely a helper's rounded result.
- **2 additional Chromium production tests passed**, repeating all 15 later-stage captures at each phone viewport against `next start`.
- **Production build, post-build TypeScript, feature-scoped ESLint and `git diff --check` passed.** No packages or lockfiles changed. Local documentation links were checked.
- At 200% text, later-stage content and control rows reflow without horizontal overflow; the test checks non-overlapping content rows. Normal phone composition remains unchanged. Full assistive-technology support is not inferred from that test.
- WebKit was deliberately not used. No physical Safari, VoiceOver or TalkBack session was available for this run.

Reproduce from the repository root:

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure --output=/private/tmp/integration-approval-b-pure-final
SPV_TEST_BASE_URL=http://192.168.1.38:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration.browser.ts integration-refinements.browser.ts integration-intro.browser.ts lab-network.browser.ts lab.browser.ts manipulation.browser.ts learning.browser.ts retrieval.browser.ts --output=/private/tmp/integration-approval-b-final
node_modules/.bin/eslint src/app/step-visuals
npm run build
node_modules/.bin/tsc --noEmit
git diff --check
```

Production captures used a temporary `next start --hostname 127.0.0.1 --port 3172` with `SPV_TEST_BASE_URL=http://127.0.0.1:3172` and `integration.browser.ts --grep 'rendered fidelity'`. That temporary server was stopped afterwards; unrelated servers were not touched.

### Phone review and server lifecycle

Verified HTTP **200** from both `http://127.0.0.1:3171/step-visuals` and [the phone URL](http://192.168.1.38:3171/step-visuals). The existing development server remains bound to **0.0.0.0:3171**. Open the phone URL on the same Wi-Fi, then burger → **Integration → Area and accumulation**, and use Next to reach the later stages. Keep the Mac awake. The Roots and Factors menu entry remains available.

The server is already running; do not start a competing instance. If intentionally stopped, restart from the repository root with:

```sh
npm run dev -- --hostname 0.0.0.0 --port 3171
```

Stop a terminal-owned instance with Ctrl+C in that terminal. If the existing detached instance must be stopped, inspect `lsof -nP -iTCP:3171 -sTCP:LISTEN` and terminate only that verified listener, never all Node processes. LAN IPs may change when networks change; reverify before sharing a future URL.

Nothing was committed or pushed. Earlier staged changes were preserved. The two superseded Integration-only input/Set renderer files were removed as described above; no previously completed activity was refactored.

### Remaining human review

Chromium emulated phone layouts, synthetic touch, mathematical assertions and screenshot inspection are not physical Safari or VoiceOver/TalkBack verification. WebKit is not run, as explicitly requested. Review the animation's instructional clarity, the fixed removed triangle, fraction legibility, touch settling feel, and the three-part calculation journey on the actual iPhone. Approval B has not been granted by this engineering work.

## Final locked Approval B corrections — 23 October 2026

### Authority and superseded decisions

The final handover **“Integration — Final Approval B Corrections: Locked educational specification and implementation handover”** is the active educational authority. Its complete Stage 3–6 wording and interactions have been transcribed into the existing [experience specification](../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md). The mockup remains a mathematical/layout reference, not permission to restore superseded interactions.

This pass supersedes these previous implementation choices:

- Activity label “Area and accumulation” → **Integration**, in the lab header and existing menu experience. Route and activity identity remain unchanged.
- Stage 3 title → **3. How area changes**, default rising rather than inherited from Stage 2, longer named start delay, persistent answer controls and locked feedback.
- Stage 4 three-column calculation/formal main-screen formulas → three vertical geometric explanations and an optional, properly typeset fixed-term tooltip.
- Stage 5 shortened strip description → exact specified explanation and fully connected height identity; selectors explicitly include **x-axis (y = 0)**.
- Stage 6 independent endpoint selects → three complete interval radio choices. No integral appears during construction. Correct Check no longer completes automatically: **Finish follows any checked numerical answer**, including incorrect work.

Historical audit findings and previous test counts above remain useful process evidence, but their alternative copy and former correct-only completion requirement are not active instructions.

### Locked copy implemented

| Screen | Exact student-facing content |
| --- | --- |
| Stage 3 | **3. How area changes**. “Watch the width change from 2 to 4.” Below the graph: “What happened to the shaded area?” Buttons remain visible: **It doubled**, **It tripled**, **It quadrupled**. |
| Rising comparison | “Correct! The area quadrupled.” / “Not quite. The area actually quadrupled.” Stacked fractions show (2 × 2)/2 = 2 and (4 × 4)/2 = 8, labelled Before/After, with square units. “Both the width and the height doubled, so the area became four times as large.” |
| Constant comparison | “Correct! The area doubled.” / “Not quite. The area actually doubled.” Before: 2 × 2 = 4; After: 2 × 4 = 8 square units. “The width doubled, but the height stayed at 2. So the area doubled too.” |
| Stage 4 | “Move the right boundary. Notice what changes and what stays the same.” Vertical steps: “The whole triangle, from 0 to 4, has area:” (4 × 4)/2 = 8; “But we start at 1, so we remove the small triangle:” (1 × 1)/2 = ½; “So the shaded area is:” 8 − ½ = 7½ square units. Dynamic b updates only the whole/shaded quantities. “The small triangle stays the same, so we always subtract ½.” |
| Fixed term tooltip | **Why is this a fixed term?** “The starting point stays at 1, so the area we remove is always ½.” “That means the shaded area is:” A(b) = b²/2 − ½. “For this starting point, the fixed term is:” C = −½. These formulas use vertical fractions and are absent from the main-screen DOM until the tooltip opens. |
| Stage 5 | “Choose two curves, then move the right boundary to see how the shaded area changes.” “The strip's height is the top curve minus the bottom curve.” Initially h(x) = x − (x² − 3x) = 4x − x², followed by **Shaded area:** 7⅓ square units. Identical selections replace the strip explanation with “The two curves are the same, so there is no gap between them. The shaded area is 0.” |
| Stage 6 region | **Choose what area to measure**. “Select two curves to make the shaded region you want to measure.” First/Second curve selectors only; no integral, numerical area or setup assessment. |
| Stage 6 interval | **Choose where to measure**. “Choose the interval for your shaded region.” Native single-choice controls: **From 0 to 1**, **From 1 to 2**, **From 0 to 2**. Initially From 1 to 2. |
| Stage 6 calculation | **Calculate the area**. “Calculate the area of the shaded region.” Generated integral, **Area =** input, **square units**, **Check calculation**. Correct feedback: “Correct! The shaded area is [correct area] square units.” Incorrect feedback: “Not quite. Try calculating the area again.” Then **Check again**, **Show hint**, **Finish**. |
| Hint | “Find an antiderivative of the expression inside the integral. Substitute the upper limit, then subtract the result at the lower limit.” For equal curves: “The two curves are the same, so the height between them is 0 everywhere.” An anchored optional tooltip prevents vertical expansion. |
| Recap | **Your area calculation**, actual selected curves and interval, strip height and solved integral. An incorrect finish also states **Your answer: [student answer] square units** and **Correct area: [correct area] square units**. No false success message or second assessment. |

The complete exact copy, including headings and control labels, lives in the experience specification. No general engineering/design guide was rewritten in this pass.

### Animation and interaction implementation

The start delay is explicitly exported near the top of `src/app/step-visuals/activities/integration-area/use-stage-motion.ts`:

```ts
export const STAGE_THREE_START_DELAY_MS = 2280;
export const STAGE_THREE_ANIMATION_DURATION_MS = 900;
```

The delay is the previous 280ms plus the approved additional 2,000ms. Edit `STAGE_THREE_START_DELAY_MS` in milliseconds to experiment, then start a fresh comparison by switching functions or restarting. Reduced motion bypasses both the delay and animation and presents the finished comparison directly.

The original region remains lighter with a dashed outline; the moving/final boundary is solid and has no draggable-looking point. The 2/4 tick positions remain mathematically accurate. A first accepted answer locks all three still-visible buttons, with a distinct selected treatment. Function changes clear visible answer/result and begin a fresh comparison; history is not overwritten. Previous/Next restores completed comparisons without unexpected replay.

Stage 4 retains continuous graph/native-range transactions and its local smooth integer settlement. The excluded triangle now has a visible subdued fill/outline. A rendering test caught a shorter transient equation resizing the graph and invoking the intended geometry-change cancellation; the Stage 4 grid now reserves the full vertical calculation height, with the same dimensions through candidates, settlement and tooltip use. No Stage 1, Stage 5 or Roots and Factors snapping policy was changed.

Stage 5 keeps both control selections separate from mathematical ordering. Same-curve regions have zero area and no misleading zero-height strip marker. Continuous releases keep real values. Fraction/approximation presentation remains separate from canonical mathematics.

### Check versus Finish and learning-record compatibility

The reducer now owns an explicit current-problem `checked` calculation and `problemRevision`. Check records the submitted finite value and correctness, retains the input and feedback, and **does not** emit completion. Finish is accepted only after a checked answer for that problem and produces the recap/result even when the last Check was incorrect. Finish uses the latest checked submission, not an unsubmitted edited draft.

Changing curves or the selected interval clears stale draft, checked outcome and feedback. Problem revision prevents an old result reappearing even after the parameters are changed back to their previous values. Interval choice is one atomic `interval-selected` record, not two arbitrary coordinate edits. Earlier attempts and requested assistance remain in history.

The existing callbacks and archives remain available. New results add optional `outcome` and `finalCalculation` fields. `status: "completed"` means the activity was finished; an incorrect finish has `outcome: "incorrect"`, `successMode: null`, the submitted incorrect `finalCalculation`, and the true `area`. Correct finishes retain independent/assisted classification. **onComplete fires once at Finish, never merely at Check.** Old result payloads lacking the additive fields remain valid; the widened nullable successMode truthfully represents the newly approved incorrect completion.

Numerical answer policy is defined in `learning.ts`: finite full-string decimals/scientific notation, accepted error at most `1e-9 + 1e-9 × max(1, |expected|)`. All supported exact answers are integers. This admits equivalent numerical representations and tiny floating-point noise, not materially wrong arithmetic; invalid strings are not assessment attempts.

### Reuse and containment

No new dependency, route, authentication, persistence, application-specific import or global style change was introduced. Existing mathematical/D3 preparation, lab menu/hosting, continuous-input adapters and notification delivery were reused. Integration's renderer/styles/presentation/reducer were adapted locally.

The existing Tooltip gained additive rich-content and optional `onOpen` support because the locked fixed-term content requires typeset fractions and the optional hint must record an actual request. Its original string content, layout, closing behaviour and styles remain unchanged; Stage 2's existing tooltip regressions cover those consumers. Browser-specific rich content stays outside pure mathematical/layout contracts.

An activity-scoped desktop override neutralises the legacy graph's `grid-row: 1` rule inside this new composition. It does not modify shared graph behaviour or Roots and Factors. Extra text reflows at accessibility enlargement; ordinary target-phone text is not reduced to achieve fit.

### Final verification and rendered evidence

All results in this section belong to the final locked correction pass, not to the historical runs above.

| Verification actually run | Result |
| --- | --- |
| Pure mathematical, reducer, presentation, input, records and isolation tests | **142 passed**, 18 files. |
| Consolidated Chromium Integration, introductory-stage, refinement, LAN/touch-menu, lab, Roots and Factors manipulation, learning and retrieval regressions | **91 passed**, 8 files. |
| Additional production-server rendered phone capture tests | **2 passed**, one per target viewport. |
| TypeScript `--noEmit` | Passed after the production build. |
| Feature-scoped ESLint | Passed. |
| Production `npm run build` | Passed; `/step-visuals` is generated successfully. |
| `git diff --check` | Passed. |

The phone capture tests create **20 rendered states at each viewport**: Stage 3 before/after animation and all four feedback branches; Stage 4 initial, changed boundary and fixed-term tooltip; Stage 5 initial, reversed, identical and non-integer boundary; and Stage 6 construction, interval, calculation, both feedback outcomes, optional hint and incorrect recap. The production capture tests repeat those same 40 states against the compiled application.

| Viewport | Measured inner/visual viewport height | Document scroll height, all 20 states | Document width | Normal-zoom overflow |
| --- | --- | --- | --- | --- |
| 393 × 852 | 852 / 852 CSS px | 852 CSS px | 393 CSS px | None. |
| 390 × 844 | 844 / 844 CSS px | 844 CSS px | 390 CSS px | None. |

Within each stage, the tests compare the graph's exact physical bounding box and axis markup before/after state changes. Stage 6 additionally compares them across every substep, feedback, hint and recap. Activity-specific graph heights differ between stages to accommodate the locked vertical explanations; the mathematical scales do not change within a stage in response to content or dragging. Tooltip bounds and every essential control/text block are checked against the viewport. Measurements are printed as `LOCKED_VIEWPORT_MEASUREMENTS` and attached as `viewport-measurements` by `integration.browser.ts`.

Representative screenshots from the completed development regression run:

- [Stage 3: selected answer, exact feedback and Before/After fractions, 393 × 852](/private/tmp/integration-locked-final/integration.browser.ts-loc-7572e-phone-captures-at-393-×-852-chromium/03-stage-3-rising-correct.png).
- [Stage 4: vertical explanations and fixed excluded triangle, 390 × 844](/private/tmp/integration-locked-final/integration.browser.ts-loc-bdd63-phone-captures-at-390-×-844-chromium/07-stage-4-initial-b-4.png).
- [Stage 4: optional fixed-term tooltip, 390 × 844](/private/tmp/integration-locked-final/integration.browser.ts-loc-bdd63-phone-captures-at-390-×-844-chromium/09-stage-4-fixed-term-tooltip.png).
- [Stage 5: initial curve region and connected height identity, 390 × 844](/private/tmp/integration-locked-final/integration.browser.ts-loc-bdd63-phone-captures-at-390-×-844-chromium/10-stage-5-initial.png).
- [Stage 6: optional hint over incorrect feedback, 390 × 844](/private/tmp/integration-locked-final/integration.browser.ts-loc-bdd63-phone-captures-at-390-×-844-chromium/19-stage-6-hint.png).
- [Stage 6: truthful incorrect-answer recap, 393 × 852](/private/tmp/integration-locked-final/integration.browser.ts-loc-7572e-phone-captures-at-393-×-852-chromium/20-stage-6-incorrect-recap.png).

The complete development artifacts are under `/private/tmp/integration-locked-final/`; production artifacts are under `/private/tmp/integration-locked-production/`. These are local review artifacts, not permanent checked-in golden images. Screenshots were opened and inspected, including the tight Stage 4 phone composition, selected Stage 3 answer, optional hint and incorrect recap. Automated fit is not a claim of human educational approval.

Additional responsive checks passed at 414 × 896, 768 × 1024 and 1280 × 900. At 200% text enlargement and the short 320 × 568 viewport, controlled scrolling is allowed and usability/horizontal-overflow checks passed. The one-screen claim above applies to the two normal-zoom target phone viewports, not every possible short screen or accessibility setting.

Reproduction commands:

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure --output=/private/tmp/integration-locked-pure-final
SPV_TEST_BASE_URL=http://192.168.1.38:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration.browser.ts integration-refinements.browser.ts integration-intro.browser.ts lab-network.browser.ts lab.browser.ts manipulation.browser.ts learning.browser.ts retrieval.browser.ts --output=/private/tmp/integration-locked-final
node_modules/.bin/eslint src/app/step-visuals
npm run build
node_modules/.bin/tsc --noEmit
git diff --check
```

Production screenshots used a temporary server on `127.0.0.1:3172` and the same Chromium project with `integration.browser.ts --grep 'locked copy and rendered phone'`. Only that temporary server was stopped after verification. No unrelated server was disrupted.

### Verified phone handoff and limitations

Both [localhost](http://127.0.0.1:3171/step-visuals) and [the phone URL](http://192.168.1.38:3171/step-visuals) returned **HTTP 200** after verification. The existing Next development server remains running on **0.0.0.0:3171**. On the same Wi-Fi, open the phone URL, then burger → **Integration → Integration**. The repeated parent/child label follows the required activity rename while preserving the existing two-level menu. Roots and Factors remains independently selectable.

Do not start a second server while this one is running. If intentionally stopped, restart from the repository root:

```sh
npm run dev -- --hostname 0.0.0.0 --port 3171
```

Stop a terminal-owned instance with Ctrl+C in its terminal. For the existing detached listener, first identify it using `lsof -nP -iTCP:3171 -sTCP:LISTEN`, then stop only that verified process. Keep the Mac awake; the phone must share its network. Recheck the Wi-Fi IP after changing networks.

Physical iPhone Safari, VoiceOver and TalkBack were **not** tested here. Chromium mobile emulation and automated touch tests cannot establish their physical-device behaviour. WebKit was deliberately not run, as requested. The remaining manual review is educational fidelity, animation pacing, finger-tracking/settling feel, fraction legibility and tooltip usability on the actual iPhone. No educational decision remains blocked, and no Approval B grant is claimed.

No dependencies were added. Existing staged/unrelated work was preserved. Nothing was committed or pushed.


## Seven-stage implementation — 24 October 2026

**Status: implemented for manual Approval B review; Approval B is not granted.** This section supersedes active six-stage behaviour described above. The [approved seven-stage design](../../../../../design/features/step-visuals/puckle-integration-seven-stage-approved-design.md), amended by the user's final decisions in [plan §11](seven-stage-experience-impl-plan.md#11-final-approved-educational-decisions), is the educational authority. The [durable experience specification](../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md) now describes the implemented seven-stage sequence.

### Implemented changes and fidelity

Stages 1–2 retain their approved renderer, exact copy, domains, continuous boundary/display policy, rectangle track and both estimated-area Tooltip triggers. Only their shared internal region contract now uses canonical selected curves.

Stage 3 adds y=x² and the third scaling factor, truthful height-16 framing, exact locked feedback and the required transition. The named start delay is **4,280ms**, the inspected 2,280ms plus the approved additional two seconds; motion remains 900ms. Per-function answer evidence survives switching. An answered function replays 2→4 and then restores feedback, with Next eligible throughout. Outer Previous/Next restores the completed comparison without replay. No duplicate prediction is recorded.

The new Stage 4 shows the enclosing rectangles and half-area relationship, then simultaneous lower/upper quadratic sums using the approved six-stop slider. Its exact explanation, formulas and derivative tooltip are present. The two modes retain the same physical graph box/horizontal scale; their explicit vertical scales differ as approved.

New Stage 5 is the revised fixed-exclusion activity. Its exact causal explanations, main-screen constant of integration, C=−½ and optional explanation are present. Continuous movement settles smoothly to an integer only here. At b=1 the desired fill and “Area we want” label are absent; the small **Area we want = 0** arrow identifies the coincident boundaries with both boundary identities visible.

Stage 6 uses left-stacked selectors and the right-hand boundary slider, continuous [1,4] movement, neutral selector ordering and thin height arrows. Parabola/axis crossings split at 3 and add non-negative lobes. Equal functions and zero-width intervals remain valid exploration.

Stage 7 displays the whole construction/calculation task on one screen. Curve and interval choices are free, and the integral is immediately visible without its result. Explicit Check handles correct, incorrect, empty and invalid input. Answer edits clear feedback and disable Finish until a new Check; historical submissions remain available. Finish accepts either correctness outcome and uses the latest checked answer. Restart archives the attempt.

There are no additional educational controls, stages, dependencies or application integrations. The old final-stage wizard, tripling distractor and tooltip-only constant explanation are deliberately removed because the approved design supersedes them.

### Requirement-by-requirement fidelity matrix

The IDs below correspond to the approved plan §7. The primary educational source is approved design B/C and the corresponding numbered stage; final amendments apply to 3i, 5b and 7h. Implementation filenames are under `src/app/step-visuals/activities/integration-area/`; test filenames are under `src/app/step-visuals/tests/`. PASS denotes the stated implementation/automated checks and inspected rendering. It does not certify physical Safari or educational effectiveness.

| ID | Approved requirement | Implementation location | Verification / result |
| --- | --- | --- | --- |
| G1 | Approved B/C: seven ordinary numbered titles; visible activity Integration | integration-activity.tsx, later-stages.tsx, stage-controls.tsx | PASS — integration.browser.ts; integration-seven-stage.browser.ts; lab-network.browser.ts |
| G2 | One screen including feedback/tooltips; no extra controls/substages | integration-activity.tsx, later-stages.tsx, stage-controls.tsx | PASS — integration.browser.ts; integration-seven-stage.browser.ts; lab-network.browser.ts |
| G3 | Mathematical truth, accessible alternatives, reduced motion, independent hosting | integration-activity.tsx, later-stages.tsx, stage-controls.tsx | PASS — integration.browser.ts; integration-seven-stage.browser.ts; lab-network.browser.ts |
| G4 | Previous/Next, explicit Finish/restart, evidence and menu suspension | integration-activity.tsx, later-stages.tsx, stage-controls.tsx | PASS — integration.browser.ts; integration-seven-stage.browser.ts; lab-network.browser.ts |
| 1a | Approved §1 and old spec §3: y=2, b=1; continuous [0,4] slider/direct drag | intro-stages.tsx, display-policy.ts | PASS — integration-intro.browser.ts; integration-refinements.browser.ts; integration-refinements.spec.ts |
| 1b | Existing instruction, Shaded area calculation with inline square units, fixed-height insight | intro-stages.tsx, display-policy.ts | PASS — integration-intro.browser.ts; integration-refinements.browser.ts; integration-refinements.spec.ts |
| 1c | No Set field/assessment; stable labels/one screen | intro-stages.tsx, display-policy.ts | PASS — integration-intro.browser.ts; integration-refinements.browser.ts; integration-refinements.spec.ts |
| 2a | Approved §2/old §3: b=3, initially constant/four rectangles; constant/rising selector above graph | intro-stages.tsx, presentation.ts | PASS — integration-intro.browser.ts; integration-refinements.browser.ts; integration-math.spec.ts |
| 2b | One logarithmic width control, all n=1…128; estimate versus exact | intro-stages.tsx, presentation.ts | PASS — integration-intro.browser.ts; integration-refinements.browser.ts; integration-math.spec.ts |
| 2c | Both clickable estimated terms and exact tooltip | intro-stages.tsx, presentation.ts | PASS — integration-intro.browser.ts; integration-refinements.browser.ts; integration-math.spec.ts |
| 3a | Exact heading/instruction; selector order `y = 2`, `y = x`, `y = x²`; initial x | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3b | b2→4 automatic, existing delay +2000ms; persistent original/additional regions | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3c | y(4)=16, explicit truthful scale | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3d | Question below graph; `It doubled`, `It quadrupled`, `It increased eightfold` | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3e | One selection; no Check; any answer enables Next; first answer retained | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3f | Exact flat/rising correct and incorrect headlines/calculations/explanations | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3g | Exact four-sentence quadratic explanation; no 8/3,64/3 or b³/3 | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3h | Exact transition after feedback | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 3i | Final decision §11.1: replay an answered function, then restore its answer/feedback | growth-stage.tsx, learning.ts, use-stage-motion.ts, presentation.ts | PASS — integration-locked.spec.ts; integration-learning.spec.ts; integration.browser.ts (growth/replay); 03-growth-* captures |
| 4a | Single screen; visible x/x² tabs; initially x; fixed b3 | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4b | Same graph placement and horizontal scale; rectangle heights3/9 labelled | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4c | Exact linear instruction, rectangle split, 3×3=9, ½×9=4½, Area=b²/2 | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4d | Exact quadratic instruction; both lower/upper rectangle constructions | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4e | `Rectangle width`, Wider/Narrower, N rectangles; six stops, first n4 | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4f | Side-by-side `Estimate from below` / `Estimate from above`; one decimal | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4g | Exact conclusion, Area=b³/3 and final observed-pattern sentence | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4h | `Why exactly one-third?` and all five approved tooltip passages including derivative | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 4i | Next always available | division-stage.tsx, division-refinement-slider.tsx, graph-layout.ts | PASS — integration-math.spec.ts (six sums/rectangle geometry); integration.browser.ts (division); 04-division-* captures |
| 5a | Exact opening; y=x, a1 fixed, b4 initially | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5b | Distinct `Area left out` / `Area we want` for b>1; a/b below graph; final decision §11.3 at b=1 | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5c | Exact instruction near control; slider and graph drag [1,4] | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5d | Three vertically stacked causal explanations and exact settled table | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5e | Consistent fractional preview, exact settlement | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5f | Entire main constant sentence and visible C=−½ | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5g | `Why is it a constant?` exact body/formula | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5h | Optional transition only if uncrowded | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 5i | Free exploration, no target/Check | offset-area-stage.tsx, boundary-slider.tsx, graph-layout.ts | PASS — integration-later.spec.ts (settlement); integration-math.spec.ts (zero annotation); integration.browser.ts (Stage 5); 05-offset-* captures |
| 6a | Exact instruction; initial line/parabola [1,3], fixed a1 | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 6b | First/Second curve stacked LEFT, slider RIGHT ~40/60; full labels | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 6c | `Right boundary: b`, current value, ends1/4; continuous/no snap | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 6d | Thin double arrow, h(x), local gap, no arrow for equal/zero width | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 6e | Exact ordinary explanation, default full height identity and 7⅓ | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 6f | Crossing parabola/axis beyond3; exact replacement explanation | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 6g | Reverse/equal choices valid, b1 zero, no assessment | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 6h | All truth-table values, stable fit on switches | between-curves-stage.tsx, model.ts, graph-layout.ts | PASS — integration-math.spec.ts (crossings/arrows); integration-later.spec.ts (permutations); integration.browser.ts (Stage 6); 06-between-* captures |
| 7a | Exact title/opening, graph then all three headings/sections simultaneously | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7b | Selected region strictly between curves; unused context visible, labels correctly associated | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7c | First/Second curve on ONE horizontal row; all choices including equal | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7d | Three equal-width interval choices on ONE horizontal row; default1→2 | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7e | Immediately generated unsolved integral, `Your answer`, `Check calculation` | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7f | Exact correct/incorrect/empty feedback; empty is not attempt | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7g | Both exact optional hints; close on choice changes | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7h | Any numerical Check enables Finish; answer edits or selection changes invalidate it | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7i | Approved recap, wrong submitted answer plus actual area; existing restart | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |
| 7j | All truth-table cases; no crossings on [0,2] | calculation-stage.tsx, learning.ts, presentation.ts, records.ts | PASS — integration-learning.spec.ts (Checks/edit/history); integration-later.spec.ts (27 combinations); integration.browser.ts (Stage 7); 07-* captures |

No material fidelity discrepancy was identified in these checks. Human Approval B and the physical-device checks below remain unverified.

### Mathematical verification actually performed

`integration-math.spec.ts` independently checks polynomial evaluation/antiderivatives, ratio 2/4/8, exact endpoint sums against direct rectangle summation, interval ordering, crossing pieces, reversal invariance, equal/zero-width regions, clipping and graphical interpolation error below 0.25 CSS pixels. `integration-later.spec.ts` checks assessment across all **27 ordered curve/interval combinations**, including each identical pair, against independently specified integers.

| Stage 4 n | Exact lower sum | Exact upper sum | One-decimal displays |
| --- | ---: | ---: | --- |
| 4 | 5.90625 | 12.65625 | 5.9 / 12.7 |
| 8 | 7.3828125 | 10.7578125 | 7.4 / 10.8 |
| 16 | 8.173828125 | 9.861328125 | 8.2 / 9.9 |
| 32 | 8.58251953125 | 9.42626953125 | 8.6 / 9.4 |
| 64 | 8.7901611328125 | 9.2120361328125 | 8.8 / 9.2 |
| 128 | 8.894805908203125 | 9.105743408203125 | 8.9 / 9.1 |

All six pairs pass direct-sum comparisons, lower≤9≤upper, monotonic convergence and upper−lower=27/n. Both endpoint constructions render simultaneously; their finite values remain explicitly estimates.

| Stage 6 pair | [1,3] | [1,4] |
| --- | ---: | ---: |
| x / (x²−3x) | 22/3 | 9 |
| x / axis | 4 | 15/2 |
| (x²−3x) / axis | 10/3 | 31/6 |
| Each identical pair | 0 | 0 |

The crossing result is **10/3 + 11/6 = 31/6**, not |−3/2|. Tests exercise b=3−10⁻⁷, 3, 3+10⁻⁷, 3.01 and 4. Paths and local height arrows use the same ordered pieces as the calculation.

| Stage 7 pair | [0,1] | [1,2] | [0,2] |
| --- | ---: | ---: | ---: |
| (9+2x) / 3x² | 9 | 5 | 14 |
| (9+2x) / axis | 10 | 12 | 22 |
| 3x² / axis | 1 | 7 | 8 |
| Each identical pair | 0 | 0 | 0 |

All distinct pair orders and the three individual identical pairs are assessed across all intervals. Assessment uses finite parsed mathematical numbers and the existing 10⁻⁹ absolute/relative tolerance, never formatted strings or sampled paths.

### Records, callbacks and compatibility

The seven-stage reducer produces **schemaVersion 2 / activityVersion 2**, with stable semantic stage IDs. Regions contain the selected mathematical pair and endpoints; global top/bottom fields do not falsely describe a crossing. The selected pair can reconstruct ordered pieces through the pure analyser.

The public entry exports v2 and named legacy v1 contracts. Callback payloads are versioned unions, and existing notification delivery supports both versions without changing historical facts. Explicit legacy-delivery, reentrancy, late-subscription and archive tests pass.

Each accepted Check retains submitted/expected values, correctness, assistance and problem/answer revisions. Editing clears current Finish eligibility without deleting earlier Check records. Finish emits completion once; Check does not. Incorrect Finish remains a completed activity with outcome incorrect and null successMode. Calculation hints distinguish assisted success; ordinary explanation tooltips are not calculation assistance. No transient movement, animation frame, rejected action, cancellation or keystroke is recorded.

### Reuse and activity isolation

Reused the existing Integration reducer/navigation snapshots, input capture/calibration/cancellation safeguards, polynomial primitives, D3 preparation, Tooltip, notification delivery, lab menu, hosting and record inspector. No Roots and Factors implementation or shared style was changed in this phase.

Activity-local renderers now separate growth, division, fixed exclusion, between-curves exploration and calculation. A small local mathematical renderer and control composition support those screens. This follows the approved plan, without extracting a calculus framework or changing the menu's design. New source/test filenames are lowercase and hyphenated.

All application changes are within `src/app/step-visuals/`; documentation changes are limited to the two authorised activity documents. The pre-existing staged changes, including configuration and Card 1 changes from earlier work, remain preserved. No new dependencies, global CSS, commits or pushes were introduced.

### Automated verification and environment findings

| Verification | Actual result |
| --- | --- |
| Preserved baseline before structural changes | 6 Chromium tests passed: intro stages, mobile menu/root touch and both activity selections |
| Full pure suite | **144 passed**, including mathematics, reducer, records, legacy delivery, isolation and unchanged Card 1/sparkline tests |
| Consolidated Chromium regression selection | **93 passed**, covering new Integration, preserved intros, lab, Card 1 manipulation/learning/retrieval and phone layouts |
| Final compiled-production mobile captures | **4 passed**, 9 introductory plus 38 later-stage states at each target viewport; no Integration learning-record console groups in production |
| Actual Wi-Fi-origin interaction and animation capture | **2 passed**: touch menu/root activity switching and clock-controlled animation evidence |
| Production build | Passed; /step-visuals statically generated |
| Post-build TypeScript and scoped ESLint | Passed, no warnings |
| Whitespace / feature-boundary checks | Passed |

After the final local graph-label clearance/emphasis adjustment, the 13 affected mathematical/layout tests, four development phone-capture tests and four production phone-capture tests passed again. The full-suite counts above count tests in their respective consolidated runs, not the sum of repeated targeted checks.

The baseline probe originally used **127.0.0.1**, which the existing Next dev-origin policy blocked for the development WebSocket. HTML and script responses alone did not establish working interaction. The verified Step Visuals process was restarted, and **localhost** worked with the existing configuration; no configuration change was needed. The actual permitted LAN origin also passes the menu and touch regression. Do not claim HMR alone was proven to be the root cause of every previous phone problem.

Local preparation diagnostics (Node v22.14.0, macOS; 100 samples each) measured median/p95 approximately **0.90/3.27ms** for Stage 5, **1.12/2.00ms** for Stage 6 and **1.60/2.36ms** for 128 paired rectangles. One Stage 6 maximum was 21.77ms. These are local preparation timings, not physical-phone frame guarantees or complete React render timings. The diagnostic also guards historical arrays against any access during continuous previews.

Reproduce using the existing feature config and a functioning server:

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure
SPV_TEST_BASE_URL=http://localhost:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration-seven-stage.browser.ts integration.browser.ts integration-intro.browser.ts integration-refinements.browser.ts lab-network.browser.ts lab.browser.ts manipulation.browser.ts learning.browser.ts retrieval.browser.ts
npm run build
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src/app/step-visuals
git diff --check
```

No WebKit run was attempted, as requested. Automated emulation is explicitly separate from physical Safari/VoiceOver/TalkBack verification.

### Rendered mobile evidence

Screenshots are actual application renders, using the real components and state. They are not conceptual mockups. Default collapsed diagnostics are part of the measured lab frame. Opening the record JSON intentionally expands developer content and is outside the one-screen student fit claim.

| Viewport | Stage 1–2 capture states | Stage 3–7 capture states | Document height in all normal captures | Horizontal/vertical overflow |
| --- | ---: | ---: | ---: | --- |
| 390×844 | 9 | 38 | 844 CSS px | None |
| 393×852 | 9 | 38 | 852 CSS px | None |

The later-stage capture suite asserts physical graph/axis invariants per stage/profile, non-overlapping content rows, essential element bounds, tooltip viewport bounds and no document overflow. Stage 4 tab switching separately verifies identical physical graph dimensions. Content includes every growth feedback branch, quadratic n4/n128, both mathematical tooltips, zero-area and fractional states, crossing/same-curve states, all final feedback/hints, edited-answer disabled Finish and both recap outcomes.

Final development artifacts: **/private/tmp/integration-seven-stage-final-mobile/**. Production artifacts: **/private/tmp/integration-seven-stage-production/**. Consolidated regression artifacts: **/private/tmp/integration-seven-stage-regression/**. Each later-stage viewport directory contains 38 PNGs plus **viewport-measurements.json**, with inner/visual viewport, document dimensions, graph bounds/domains and control boxes. Introductory capture directories also persist their measurements. Artifacts are local generated evidence, not permanent golden images.

Representative production files, at 390×844:

- [Stage 3 longest feedback](/private/tmp/integration-seven-stage-production/integration-seven-stage.br-1a538-d-compositions-at-390-×-844-chromium/03-growth-square-incorrect.png)
- [Stage 4 paired estimates](/private/tmp/integration-seven-stage-production/integration-seven-stage.br-1a538-d-compositions-at-390-×-844-chromium/04-division-square-n4.png)
- [Stage 4 derivative tooltip](/private/tmp/integration-seven-stage-production/integration-seven-stage.br-1a538-d-compositions-at-390-×-844-chromium/04-division-tooltip.png)
- [Stage 5 zero-area boundary](/private/tmp/integration-seven-stage-production/integration-seven-stage.br-1a538-d-compositions-at-390-×-844-chromium/05-offset-b1.png)
- [Stage 6 crossing lobes](/private/tmp/integration-seven-stage-production/integration-seven-stage.br-1a538-d-compositions-at-390-×-844-chromium/06-between-crossing-b4.png)
- [Stage 7 complete single-screen task](/private/tmp/integration-seven-stage-production/integration-seven-stage.br-1a538-d-compositions-at-390-×-844-chromium/07-calculation-initial.png)
- [Stage 7 incorrect recap](/private/tmp/integration-seven-stage-production/integration-seven-stage.br-1a538-d-compositions-at-390-×-844-chromium/07-incorrect-recap.png)

Additional clock-controlled pre-animation/intermediate-square captures are under **/private/tmp/integration-seven-stage-lan/**. The final source also moves Stage 4's fixed b badge clear of the SVG top edge and subdues labels belonging to unused contextual curves; final captures include these local clearance/emphasis fixes.

Screenshots were opened and inspected for the demanding compositions, fraction/derivative legibility, zero-area annotation, crossing geometry and truthful recap. Automated geometry is not a substitute for educational judgment. Wider 414×896, 768×1024 and 1280×900 layouts passed; 200% text and the short 320×568 viewport retain controlled reflow/scrolling without horizontal overflow or overlapping layout rows.

### Phone review and remaining limitations

The current Wi-Fi development URL is [http://192.168.1.38:3171/step-visuals](http://192.168.1.38:3171/step-visuals). Both localhost and this LAN address return HTTP 200, and the actual LAN-origin touch/menu regression passes. Open it on the same Wi-Fi and choose burger → **Integration → Integration**. The development server listens on **0.0.0.0:3171**; keep the Mac awake.

If intentionally stopped, restart from the repository root:

```sh
npm run dev -- --hostname 0.0.0.0 --port 3171
```

Stop a terminal-owned instance with Ctrl+C. For a detached instance, identify the exact listener with `lsof -nP -iTCP:3171 -sTCP:LISTEN` before terminating that process. Do not stop unrelated servers. The temporary production server on 3172 is stopped after verification.

Manual review should concentrate on the mathematical clarity/pacing of the growth and division comparisons, whether the excluded region/constant and crossing-lobe interpretation read naturally, and touch/tooltip feel on the physical phone. Also inspect the Stage 7 answer field with the actual iPhone keyboard: Chromium cannot certify Safari keyboard panning, browser-chrome height, touch feel or assistive-technology announcements.

No unresolved educational decision or deliberate departure from the approved plan remains. Physical Safari and VoiceOver/TalkBack remain **UNVERIFIED**. The existing deferred Card 1 non-drag accessibility gap is unchanged and is not reproduced as a new Integration requirement exception. Approval B remains entirely with the human reviewer.

## Final approved Integration refinements — 24 October 2026

This section follows the user's subsequent refinement approval and final recording/Tooltip/Stage 6 amendments, captured in [the existing refinements plan](final-integration-refinements-impl-plan-draft.md). It supersedes only the corresponding earlier design/implementation requirements. All earlier audit, approval decisions and verification evidence above remain historical evidence, not retroactively changed results. **Approval B remains pending human review.**

### Implemented fidelity checklist

Paths below are under `src/app/step-visuals/activities/integration-area/`; test names refer to `src/app/step-visuals/tests/`.

| Approved refinement | Actual implementation | Verification / result |
| --- | --- | --- |
| Stage 1 unchanged | Intro changes preserve its child order/content; model, display and input policies unchanged | PASS — introductory browser regression and preserved graph/input tests |
| Stages 2–4 title → horizontal buttons → current instruction | `intro-stages.tsx`, `later-stages.tsx`, scoped CSS; existing pressed-button semantics | PASS — new final-refinements phone tests check rendered order at both target sizes |
| Stage 2 short y=2/y=x labels; initial constant; existing count/estimates/tooltips | Intro renderer; same state and control implementations | PASS — intro capture/control/Tooltip regressions, pure estimate tests |
| Stage 3 initial y=2, unchanged automatic comparison | `learning.ts` first entry now flat; existing motion adapter untouched | PASS — pure initial/restored state checks and clock-controlled delay/animation browser tests |
| Stage 3 contextual leftmost-unanswered suggestion, exact approved variants/fallback | Pure `presentation.ts` conclusion derived from submitted-answer cache | PASS — all six function-answer orders; rendered flat/rising suggestions and longest square feedback |
| Original concluding transition only after all three answers; no new gate | Same conclusion location; `canAdvance` unchanged | PASS — pure conclusion/eligibility tests and all-answered screenshot |
| Stage 3 replay then restore; outer return immediately restored | Existing comparison cache and motion semantics retained | PASS — pure and browser replay/duplicate-evidence/outer navigation tests |
| Stage 4 three freely selectable subsections | `divisionSubsection` and guarded local action; not a polynomial ID | PASS — direct rule entry, no-op/stale/edit guards, outer restoration and slider memory tests |
| Stage 4 linear instruction, named calculations, main formula and lightweight indefinite preview | `division-stage.tsx`, `math-presentation.ts`, local `IndefiniteIntegral` renderer | PASS — literal presentation tests and actual linear-preview renders |
| Stage 4 quadratic revised instruction/convergence text; remove old pattern sentence only | `presentation.ts`, division renderer; slider, estimates, derivative Tooltip retained | PASS — mathematical sums, six-stop/Tooltip tests and n128 screenshot |
| Stage 4 rule: two examples, general formula, n≠−1 and exact conclusions | New local `division-rule.tsx`, immutable symbolic scenes | PASS — scene/copy tests; no graph/slider present; both phone renders and 200% reflow |
| Stage 4 switching back retains count; no compulsory visits | Snapshot includes subsection; count retained when rule is selected | PASS — n128 → rule → graph; outer Previous/Next restores rule |
| Stage 5 completely unchanged | Offset renderer, graph, model, input/motion adapters unchanged; no Stage 5 CSS allocation change | PASS — exact baseline graph/footer bounds, fractional/snapped/zero-area/Tooltip regressions; protected-source hash comparison |
| Stage 6 slider fills column; modest local spacing only | Grid uses 2fr/3fr weights, 12px column gap and scoped small gaps | PASS — slider right edge matches control block; track exceeds 200px at both targets; full labels visible |
| Stage 6 preserve graph, overall allocation and outer navigation | Existing 284px panel reservation retained; redistribute below-graph slack | PASS — exact pre/post graph and navigation rectangle equality at both targets, including crossing/equal cases |
| Stage 6 numerical output replaced, not supplemented | Approved lead-in and symbolic Area=∫ₐᵇh(x)dx; local compact limit placement | PASS — pure scene/browser assertions and default/crossing/equal screenshots; no extra panel |
| Stage 6 geometric h(x), crossings/equal curves preserved | Existing region analyser, height expression and graph untouched | PASS — mathematical truth tables, reversed selections, crossing lobes and zero-width tests |
| Stage 7 ordinary hint wording only; specialised hint and simple placement retained | `presentation.ts` text replacement; shared Tooltip/placement files byte-for-byte unchanged | PASS — both hint branches, dismissal/focus tests, viewport containment; temporary overlap accepted by user |
| Stage 7 recap Strip height label and improved distribution | Existing content grouped/distributed inside existing panel; equation remains on one line where space permits | PASS — incorrect/correct recap captures, graph equality and latest-checked-answer regressions |
| Learning record: accepted rule visit, not reading evidence | `division-rule-viewed`; unchanged selection no-op; graph returns use existing mode event | PASS — repeated visits vs unchanged clicks, stale/edit guards and actual callback-snapshot assertions |
| Learning record: explicit initial/restored arrival view | Optional compatible `view` context on `attempt-started` and `stage-changed`; live events populate it | PASS — initial/restart/forward/back/restored rule/graph/unfinished comparison cases |
| Preserve record ordering, schema compatibility and assessment semantics | Existing versions, IDs, notification delivery and archive structure retained | PASS — legacy delivery, callback ordering/reentrancy, restart, assistance, Check/edit/Finish tests |
| No unrelated styling, activity integration, dependency or configuration change | Feature-local code/tests and the three authorised planning/activity documents only | PASS — isolation suite, scoped diff review; Card 1 and lab regressions |

### Learning-record extension

The investigation found that manual graph switches were already recorded, but initial/restored views depended on navigation defaults rather than explicit event context. New live arrival events now carry:

```json
{
  "type": "attempt-started",
  "view": {
    "region": { "curves": ["flat", "axis"], "a": 0, "b": 1 }
  }
}
```

For example, returning to Stage 4 rule adds this detail to the existing navigation event:

```json
{
  "type": "stage-changed",
  "from": 5,
  "to": 4,
  "part": "compare",
  "direction": "previous",
  "view": {
    "region": { "curves": ["square", "axis"], "a": 0, "b": 3 },
    "subsection": "rule"
  }
}
```

The retained region describes the last mathematical graph, while subsection `rule` explicitly identifies the displayed content. Stage 3 arrival context describes the actual displayed comparison boundary, including a restored incomplete animation, without logging animation frames. Stages 2/3 include their active function as subsection; stages without subsections omit that property.

These examples omit the unchanged version/attempt/stage-ID/event-ID/sequence envelope. Public schema-v2 context fields are optional to accept historical payloads; all new live start/navigation events supply context. Existing event names and versions are preserved, with `division-rule-viewed` the only new event kind. No durations, reading/comprehension claims, persistence, additional assessments or transient-frame recording were introduced.

### Actual verification results

| Check | Result |
| --- | --- |
| Final complete pure suite | **151 passed**, including seven new refinement/arrival/history tests, numerical truth tables, Card 1/sparklines and isolation |
| Consolidated existing Chromium regression selection | **93 passed**, covering Integration, lab, root manipulation, learning and retrieval |
| New targeted Chromium phone captures | **2 passed**, 15 targeted states at each viewport |
| Added 200% rule reflow assertion in existing accessibility test | **1 passed** on targeted rerun |
| Compiled-production phone checks | **4 passed**: targeted refinements plus existing 38-state later-stage captures at both viewports; existing production learning-log silence assertions pass. The **2 focused tests passed again** on the final rebuilt source after the arrival-context edge-case correction. |
| Actual Wi-Fi-origin hydrated touch/menu/root/activity switching | **1 passed**; localhost and Wi-Fi document both HTTP 200 |
| Final production build | Passed; `/step-visuals` statically generated |
| Post-build TypeScript and scoped ESLint | Passed, no diagnostics |
| Feature/source protection | Isolation passed; eight protected source files byte-for-byte unchanged, including model, graph, offset renderer/input/motion and shared Tooltip/placement |

Initial test runs exposed assertions for superseded defaults/copy and one overstrict new object-identity assertion; those were corrected to the approved behaviour and mathematical equality. The initial rendered Stage 6 attempt grew intrinsically because the integral limits used a tall stack. This was corrected with conventional side-positioned limits **only for that formula**, before final verification; the final graph/footer bounds exactly match baseline. Visual review also caught a recap wrapper selector affecting integral layout; the selector was narrowed before final captures. No unresolved failure or product compromise remains from these findings.

The full suite totals describe their individual runs, not sums of repeated checks. After the final small navigation-context edge-case correction, the complete pure suite, build/type/lint checks and focused production phone verification were rerun. No WebKit was attempted, as requested.

### Actual mobile geometry and visual evidence

Both the pre-change baseline and new targeted suite measured the real development lab with the inspector collapsed. All captured normal-phone states have document height equal to viewport height and no horizontal overflow. The graph bounds below are exact baseline matches; units are CSS pixels.

| Viewport | Stage | Graph x/y | Graph width/height | Previous/Next y/height |
| --- | --- | --- | --- | --- |
| 390×844 | 5 | 12 / 154.1875 | 366 / 213.8125 | 736 / 44 |
| 393×852 | 5 | 12 / 154.1875 | 369 / 221.8125 | 744 / 44 |
| 390×844 | 6 | 12 / 173.796875 | 366 / 270.203125 | 736 / 44 |
| 393×852 | 6 | 12 / 173.796875 | 369 / 278.203125 | 744 / 44 |

Stage 4's two graph subsections share their revised common instruction reservation and identical graph bounds; rule intentionally has no graph. Stage 7 keeps the same graph before/after Finish. Stable mathematical domains/axis geometry are covered by existing tests. Stage 6 has no increased allocation or reduced graph; the wider slider and new formula use the existing panel. Popup overlap is accepted and is **not** tested as a collision failure.

Evidence root: **`/private/tmp/integration-final-refinements/`**. Baseline geometry/source hashes are `baseline.json` / `protected-hashes.json`. Final targeted development captures and `viewport-measurements.json` are under `final-mobile/`; broad regression captures under `regression/`; compiled screenshots under `production/` and the final focused build check under `production-final/`. These are generated local artifacts, not durable repository fixtures.

Representative actual rendered evidence:

- [Stage 4 linear preview, 390×844](/private/tmp/integration-final-refinements/final-mobile/integration-final-refineme-de363-erved-geometry-at-390-×-844-chromium/04-linear-preview.png)
- [Stage 4 quadratic n128, 390×844](/private/tmp/integration-final-refinements/final-mobile/integration-final-refineme-de363-erved-geometry-at-390-×-844-chromium/04-quadratic-128.png)
- [Stage 4 rule, 393×852](/private/tmp/integration-final-refinements/final-mobile/integration-final-refineme-08201-erved-geometry-at-393-×-852-chromium/04-rule.png)
- [Stage 6 preserved graph/full-width slider/integral, 390×844](/private/tmp/integration-final-refinements/final-mobile/integration-final-refineme-de363-erved-geometry-at-390-×-844-chromium/06-full-width-slider-integral.png)
- [Stage 6 crossing, 393×852](/private/tmp/integration-final-refinements/final-mobile/integration-final-refineme-08201-erved-geometry-at-393-×-852-chromium/06-crossing.png)
- [Stage 7 unchanged simple hint placement, 393×852](/private/tmp/integration-final-refinements/final-mobile/integration-final-refineme-08201-erved-geometry-at-393-×-852-chromium/07-approved-hint.png)
- [Stage 7 redistributed recap, 393×852](/private/tmp/integration-final-refinements/final-mobile/integration-final-refineme-08201-erved-geometry-at-393-×-852-chromium/07-spaced-incorrect-recap.png)

### Remaining manual review and server

The existing phone-accessible development server remains on **0.0.0.0:3171**, with actual Wi-Fi address **192.168.1.38** verified during this pass. Open [Step Visuals on the phone](http://192.168.1.38:3171/step-visuals) on the same Wi-Fi, then choose Integration from the existing menu. Restart if necessary with `npm run dev -- --hostname 0.0.0.0 --port 3171`; stop only that terminal-owned process with Ctrl+C. Keep the Mac awake. Temporary production verification uses port 3172 separately and is stopped after checks.

Manual review should assess the naturalness of the Stage 3 suggestions, readability of the Stage 4 rule/preview, Stage 6 slider feel and formula grouping, and Stage 7 recap spacing. Physical Safari soft-keyboard/viewport behaviour, real touch feel and VoiceOver/TalkBack remain unverified; Chromium emulation does not establish those. The known deferred Card 1 non-drag accessibility issue is unchanged. No unresolved educational question, deliberate deviation, commit or push is introduced by this refinement. **Approval B has not been granted.**

## Six final corrections — 24 October 2026

This section records the subsequently authorised six corrections. It supersedes the corresponding earlier delay, initial-boundary, integral-placeholder and hint/recap requirements; it does not rewrite the earlier approval history or test evidence. The original seven-stage design document is unchanged. The current experience specification has been updated. **Approval B remains a human decision.**

### Changes and fidelity

| Correction | Implemented behaviour and location | Verification |
| --- | --- | --- |
| Stage 2 encourage the second graph | The existing constant-graph conclusion now ends exactly **What about when y = x?** Existing preceding explanation and rising-graph explanation are preserved. No new state/control. `presentation.ts` | Pure literal-copy check; rendered initial Stage 2 at both target sizes |
| Stage 3 halve start delay only | Actual previous constant **4280ms**, new constant **2140ms**. Duration remains **900ms**, settlement remains 150ms, and easing/replay/prediction guards are unchanged. `use-stage-motion.ts` | Pure constants; clock-controlled browser checks before delay, during motion and after completion; existing replay tests |
| Stage 5 fresh initial b=3 | Change only the fresh destination region in `nextStage`. Existing saved-panel restoration takes precedence as before. `learning.ts` | Fresh entry/restart b3; both outer navigation directions preserve deliberately changed b2/b4; continuous dragging/cancellation/release-snapping regressions |
| Stage 6 actual height inside the integral | Substitute the existing `distanceExpression` into the integral. Simple x/0 are unparenthesised; polynomial differences have parentheses; crossings reuse existing absolute-value notation. `presentation.ts` | All nine ordered pairs at b=1,2,3,3.25,4; rendered x, parabola, crossing and equal-curve cases; exact graph/footer geometry |
| Stage 7 hint | Exact shorter approved sentence, followed by Area=Upper value−Lower value with smaller/lighter adjacent (x=b)/(x=a). The variables are italic mathematical letters and the equation has an accessible description. Existing specialised identical-curve hint remains unchanged. `calculation-stage.tsx`, `presentation.ts`, local CSS | Hint copy/meaning/focus/Escape and viewport checks; existing Tooltip interaction regressions; shared Tooltip/placement source unchanged |
| Stage 7 four-line Finish calculation | Inline Strip height label/expression; unsolved integral, integrated expression with bounds, upper/lower substitutions, evaluated subtraction. Prepared from actual canonical polynomials and analytic primitives in `workedAreaLayout`; rendered by the new local `worked-calculation.tsx`. | Independent primitive/result expectations for all 27 ordered curve/interval combinations; both target phone renders for every combination; existing assessment/edit/Finish/records regressions |

### Stage 5 cause and scope

The current and staged seven-stage reducer explicitly initialised Stage 5 with b=4. The earlier approved seven-stage document also explicitly specifies b=4 at its Stage 5 initial-state clause; the experience specification and previous plan carried that value forward. The Integration reducer has no committed file history in this worktree, so no earlier committed change introducing the value can be identified. There is no evidence that restoration accidentally replaced b=3 with b=4: the fresh-entry configuration itself was 4.

The latest instruction supersedes that earlier default. Fresh entry now creates a=1,b=3, then the existing saved-panel restoration runs unchanged. An intentionally saved b=4 or b=2 is therefore restored, not forcibly reset. No graph-layout, input adapter, snapping policy, constant explanation, navigation logic or new record event type was changed to achieve this correction. Arrival context naturally reports the updated initial region.

### Mathematical implementation

**Stage 6:** the same existing height preparation supplies both the displayed h(x) and the integral's integrand. Line/axis uses x; the initial line/parabola pair uses 4x−x²; parabola/axis below x=3 uses 3x−x². Beyond x=3, the integral uses **|x²−3x|**, which was already present in the approved strip-height representation. This introduces no new notation or explanation. The numerical analyser still splits at the crossing and adds non-negative lobes: [1,4] area is **10/3+11/6=31/6**, not the absolute value of one signed integral. Same curves use integrand 0; zero-width regions remain valid. No Stage 6 layout, controls, graph or slider policy changed in this pass.

**Stage 7:** only after Finish, `workedAreaLayout` orders the actual selected curves using the existing analyser, derives polynomial coefficients through `heightPolynomial`, uses `primitiveExpression` for the integrated expression and the existing `primitive` for both boundary values, and retains the analyser's geometric area. Explicit substitution terms are derived from those same coefficients. No independent polynomial table or assessment evaluator is introduced. The helper is deliberately limited to the supported final-task family and whole-number boundaries; unsupported inputs fail rather than producing false worked algebra.

For the reference case, the exact prepared steps are:

1. ∫₁²(9+2x−3x²)dx
2. [9x+x²−x³]₁²
3. (9×2+2²−2³)−(9×1+1²−1³)
4. 14−9=5

Reversed selector order gives the same steps. Identical curves yield an integral of 0, [0] with bounds, (0)−(0), and 0−0=0: valid algebra, not a fabricated non-zero example. The prepared numerical workings are absent before Finish; unchanged Check feedback still follows the previously approved assessment policy.

Independent primitive values used by tests:

| Curve | At 0 | At 1 | At 2 |
| --- | ---: | ---: | ---: |
| 9+2x | 0 | 10 | 22 |
| 3x² | 0 | 1 | 8 |
| Axis | 0 | 0 | 0 |

Subtracting these appropriate primitives gives all final-task area categories:

| Pair | [0,1] | [1,2] | [0,2] |
| --- | ---: | ---: | ---: |
| (9+2x) / 3x² | 9 | 5 | 14 |
| (9+2x) / axis | 10 | 12 | 22 |
| 3x² / axis | 1 | 7 | 8 |
| Each identical pair | 0 | 0 | 0 |

All 27 ordered combinations, including reversals and the three identical pairs, pass pure expected-value checks and rendered incorrect-answer Finish/recap checks. Correct calculations/assistance/edit invalidation/Finish eligibility remain covered by the existing learning tests. No new assessment or record semantics were introduced.

### Actual checks and evidence

| Verification | Actual result |
| --- | --- |
| Complete pure suite | **157 passed**, including six new correction tests, all mathematical/state/record checks and isolation |
| Final consolidated Chromium regression selection | **95 passed**, including existing Integration, final-refinement, lab, Roots and Factors manipulation/learning/retrieval tests |
| New six-correction phone suite | **2 passed**: all 27 final combinations plus reference hint/recap, fresh/restored boundaries and integral special cases at each viewport |
| Compiled-production targeted phone suite | **2 passed**, both reference viewports |
| Production build, post-build TypeScript, scoped ESLint | Passed; no type/lint diagnostics |
| Whitespace / source protection | Passed; seven protected model/graph/input/Tooltip files byte-for-byte unchanged against the prior baseline. The motion adapter's intended constant/comment edit is excluded from that comparison. |

Initial test runs found assertions for the superseded b4 start, symbolic h(x) placeholder and longer hint; they were updated to the new approved requirements. An old navigation test expected 3 after decrementing the previous default 4; it now expects 2 after decrementing the new default 3. The final consolidated run has no failures. No WebKit was run, as previously requested. Production phone checks were rerun on the final compiled source, including the new hint equation's accessible description and hidden duplicate child text; both tests passed again.

Actual rendered screenshots were inspected, including the initial/reference result at both sizes, a reversed pair on [0,2], identical curves, and the hint. The new suite writes **36 states per viewport**, with all four worked-line bounds and graph/footer rectangles in `viewport-measurements.json`:

| Viewport | Captured states | Document height | Horizontal overflow | Ordinary vertical scrolling |
| --- | ---: | ---: | --- | --- |
| 390×844 | 36 | 844 | None | None |
| 393×852 | 36 | 852 | None | None |

The Stage 7 graph remains x=12,y=154.1875,width=366,height=201.8125 at 390×844, and width=369,height=209.8125 at 393×852. Stage 5/6 graph and navigation rectangles exactly match the prior baseline table above. Stage 5's mathematical region changes to the newly requested b=3; its coordinate frame/physical graph allocation does not change. Stage 6's graph, spacing and outer navigation are unaltered. Enlarged text continues to use readable reflow/scrolling rather than clipping; existing 200% text checks pass.

Evidence root: **`/private/tmp/integration-six-corrections/`**. `mobile/` contains the 72 new rendered states and measurements; `regression-final/` contains the broader captures; `production-final/` contains final compiled-build phone captures. Test/build logs are alongside them. Generated artifacts are local evidence, not committed fixtures.

- [Reference four-line recap, 390×844](/private/tmp/integration-six-corrections/mobile/integration-six-correction-820f9-27-worked-recaps-at-390×844-chromium/07-reference-four-lines-incorrect.png)
- [Reference four-line recap, 393×852](/private/tmp/integration-six-corrections/mobile/integration-six-correction-5c8d6-27-worked-recaps-at-393×852-chromium/07-reference-four-lines-incorrect.png)
- [Reversed curves on [0,2]](/private/tmp/integration-six-corrections/mobile/integration-six-correction-5c8d6-27-worked-recaps-at-393×852-chromium/07-worked-parabola-upper-0-2.png)
- [Identical-curve calculation](/private/tmp/integration-six-corrections/mobile/integration-six-correction-5c8d6-27-worked-recaps-at-393×852-chromium/07-worked-axis-axis-1-2.png)
- [Hint with boundary clarifications](/private/tmp/integration-six-corrections/mobile/integration-six-correction-5c8d6-27-worked-recaps-at-393×852-chromium/07-revised-hint.png)
- [Stage 6 crossing integral](/private/tmp/integration-six-corrections/mobile/integration-six-correction-820f9-27-worked-recaps-at-390×844-chromium/06-integral-crossing.png)

No approved requirement required a substitute interaction, extra teaching copy, new event type or layout compromise. Physical iPhone Safari keyboard/touch feel and assistive-technology behaviour remain unverified. Manual review should focus on mathematical readability and whether the hint/fully worked recap explain the evaluation clearly, not repeat the automated 27-case functional checks. The development server remains available on port 3171; no commit or push was made. **Approval B remains pending human review.**
