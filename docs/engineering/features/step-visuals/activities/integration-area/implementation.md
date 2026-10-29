# Integration area: implementation and verification

Activity ID: `integration-area`

Design: [Approval A — approved 22 October 2026](../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md).

Status: **Approval B not granted**. The initial physical-iPhone fidelity review failed. Stages 1–2 have now received the approved corrections and [final refinements](final-refinements-review.md). Stages 3–6 retain their earlier mathematics/presentation except the newly requested Previous navigation. The refinement report is current; the [previous fidelity review](approval-b-fidelity-review.md) retains the earlier audit and historical evidence.

The [engineering guide](../../maths-visuals-engineering-guide.md) governs architecture; the experience specification governs educational behaviour. This note records only activity-specific decisions and evidence. It does not introduce application integration, storage or a generic calculus engine.

## 1. Scope and reuse decisions

All new source, styles, tests and lab registration live under `src/app/step-visuals/`. These two activity documents use the approved design/engineering locations. No dependency installation, global CSS or unrelated application-source change is required.

| Capability | Decision and reason |
| --- | --- |
| Development navigation | Reuse the existing two-level registry and navigation dialog; register Integration as a sibling activity. Preserve menu appearance and Card 1's existing experience entries. |
| Host lifecycle | Follow the established visible/suspend, restart, explicit exit and callback semantics. Do not import Card 1's learning or mathematical state. |
| Projection and function paths | Reuse suitable pure `ProjectionSpec`, coordinate conversion and sampled path operations. Supply integration domains/landmarks rather than root-factor assumptions. |
| Affine input calibration | Reuse the plain affine-calibration and screen-to-math calculations. Build a boundary-specific browser adapter instead of importing Card 1's root transaction. |
| Mathematical model | Build a small approved polynomial family and analytic area functions. A root-factor model is inappropriate; no symbolic integrator is needed. |
| Region, strips and rectangles | Build pure integration-specific geometry. The shaded area and estimates are new mathematical representations. |
| Graph rendering | Build an integration-specific declarative SVG renderer; do not reuse a quadratic-labelled root renderer. Match established colours, target/focus treatment and restrained styling. |
| Activity composition | Use a new activity-local composition for graph, results and grouped controls, within the existing lab host. Card 1's longest-prompt reservation and root-expression slots are not calculus requirements. |
| Navigation and diagnostics presentation | Reuse `ActivityNavigation` and the collapsed `LearningRecordPreview`. The inspector accepts activity-independent data; its appearance and explicit-open behaviour are unchanged. |
| Shared action type | Extract the existing action shape to `core/presentation/action.ts`. Card 1 re-exports the same type, preserving its contract; the reusable navigation no longer imports a Card 1 presentation module. |
| Learning records | Reuse envelope/delivery principles but define integration-specific prediction, region and calculation payloads. No forced Card 1 schema. |
| Verification | Reuse feature-local Playwright pure/Chromium projects, TypeScript, scoped lint and production checks. Do not run WebKit in this work pass: the user explicitly reported it does not work in this environment and requested its exclusion. |

The [six-stage reference image](../../../../../design/features/step-visuals/Six-Stage-Mobile-Maths-Learning-Flow.png) is now binding for educational content, initial values, controls, placement and one-screen composition, but not decorative styling. Explicit Stage 1–2 corrections take precedence over conflicting mockup details. Later-stage conflicts with written instructions are flagged in the fidelity review rather than silently resolved.

## 2. Source map

The feature implementation is rooted at [`activities/integration-area`](../../../../../../src/app/step-visuals/activities/integration-area/).

| Module | Responsibility |
| --- | --- |
| [`model.ts`](../../../../../../src/app/step-visuals/activities/integration-area/model.ts) | Finite polynomial family, evaluation, antiderivatives, gap/area validation, rectangle estimates and mathematical formatting. |
| [`learning.ts`](../../../../../../src/app/step-visuals/activities/integration-area/learning.ts) | Authoritative mathematical selections, candidate transactions, stage/prediction/calculation transitions and accepted evidence. |
| [`records.ts`](../../../../../../src/app/step-visuals/activities/integration-area/records.ts) | Versioned readonly public event, attempt, result and callback contracts. |
| [`use-boundary-pointer.ts`](../../../../../../src/app/step-visuals/activities/integration-area/use-boundary-pointer.ts) | Browser pointer capture, affine calibration, grab offsets, final coordinates and interruption cleanup. |
| [`integration.module.css`](../../../../../../src/app/step-visuals/activities/integration-area/integration.module.css) | Isolated phone-first activity styles matching the existing feature. |
| [`integration-activity.tsx`](../../../../../../src/app/step-visuals/activities/integration-area/integration-activity.tsx) | Reusable React controller, stage presentation and public host lifecycle. |
| [`graph-layout.ts`](../../../../../../src/app/step-visuals/activities/integration-area/graph-layout.ts) | Pure coordinate, curve, shaded-region, rectangle, strip and boundary scene preparation. |
| [`integration-graph.tsx`](../../../../../../src/app/step-visuals/activities/integration-area/integration-graph.tsx) | Declarative SVG scene and accessible graphical handles. |
| [`boundary-control.tsx`](../../../../../../src/app/step-visuals/activities/integration-area/boundary-control.tsx) | Labelled non-drag boundary value entry. |
| [`notifications.ts`](../../../../../../src/app/step-visuals/activities/integration-area/notifications.ts) | Guarded delivery of accepted records through host callbacks. |
| [`presentation.ts`](../../../../../../src/app/step-visuals/activities/integration-area/presentation.ts) | Stage copy, notation roles, approximation signs, masked assessment and revealed explanations. |
| [`display-policy.ts`](../../../../../../src/app/step-visuals/activities/integration-area/display-policy.ts) | Stage 1's approved rounded-boundary/derived-area readout, separate from continuous geometry and assessment. |
| [`tooltip.tsx`](../../../../../../src/app/step-visuals/platform/web/tooltip.tsx) and [`tooltip-layout.ts`](../../../../../../src/app/step-visuals/core/presentation/tooltip-layout.ts) | Reusable inline Tooltip browser adapter and pure viewport placement; no glossary registry or activity state. |
| [`integration-controls.tsx`](../../../../../../src/app/step-visuals/activities/integration-area/integration-controls.tsx) | Grouped function/refinement/prediction/region controls and numerical submission. |
| [`intro-stages.tsx`](../../../../../../src/app/step-visuals/activities/integration-area/intro-stages.tsx) and [`intro-stages.module.css`](../../../../../../src/app/step-visuals/activities/integration-area/intro-stages.module.css) | Corrected, Integration-specific Stage 1–2 composition and native range adapters; no dependency on Card 1's frame. |
| [`integration-lab-session.tsx`](../../../../../../src/app/step-visuals/lab/integration-lab-session.tsx) | Public callback consumer, collapsed inspector and development-only batched console logging. |

Public exports are added to the existing feature entry point. New tests are `integration-math.spec.ts`, `integration-learning.spec.ts`, `integration-notifications.spec.ts` and `integration.browser.ts`; the existing isolation and menu tests cover the new activity too.

## 3. Mathematical and numerical authority

### Polynomial family

Each function is represented by immutable ascending coefficients `[constant, linear, quadratic]`:

| Identifier | Coefficients | Function |
| --- | --- | --- |
| `flat` | `[2,0,0]` | `2` |
| `rising` | `[0,1,0]` | `x` |
| `lower` | `[0,−3,1]` | `x² − 3x` |
| `upper` | `[9,2,0]` | `9 + 2x` |
| `parabola` | `[0,0,3]` | `3x²` |
| `axis` | `[0,0,0]` | `0` |

The region stores only `{top, bottom, a, b}`. Height coefficients, shading, expressions and area derive from those inputs; paths and formatted strings are never mathematical authority.

For the height polynomial `c₀ + c₁x + c₂x²`, evaluate area as:

```text
(b − a) × [c₀ + c₁(a + b)/2 + c₂(a² + ab + b²)/3]
```

This is the analytic definite-integral identity factored to avoid subtracting near-equal primitive values for narrow intervals. Floating-point arithmetic evaluates that identity; it is not numerical quadrature. The antiderivative is separately available for the learning explanation.

Validate finite inputs and `a ≤ b`. Check upper/lower ordering across the entire interval by evaluating the height at both endpoints and, for a convex quadratic, at any interior minimum. Never take `abs(integral)` to conceal an inverted or crossing region.

### Independent numerical cases

The required mathematical expectations are listed in the [experience specification](../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md#2-mathematical-assumptions). In particular, independent area decompositions are:

```text
Stage 5, [1,3]: 4 + 10/3 = 22/3
Stage 6, [1,2]: 5 + 7 = 12
```

These tests must not compare a renderer against the same helper and call that independent verification.

### Exact, estimated and displayed quantities

- Mathematical area derives from the analytic model.
- Rectangle area is the explicit right-endpoint estimate: flat `2b`; rising `b²(n+1)/(2n)`.
- Function/area path sampling affects drawing, not the result.
- Display formatting returns text plus an `approximate` flag. Rounded values use `≈` where needed. Normalise negative zero only for display.
- The submitted calculation is a complete finite decimal, not the displayed area string. All nine allowed final problems have integer answers. Acceptance uses `8 × Number.EPSILON × max(1, |expected|)` solely as a floating-point guard, not a pedagogical rounding tolerance. Blank/partial/nonfinite input is not recorded as an incorrect mathematical calculation. Changing display precision does not affect acceptance.

The model is deliberately polynomial-specific. It contains no promise about discontinuous functions, arbitrary quadrature, symbolic algebra or signed geometric area.

## 4. Geometry and scene preparation

The coordinate frames are fixed within the related comparison:

- Stages 1–5: `x = [−0.5,4.5]`, `y = [−3,5]`.
- Stage 6's fresh example: `x = [−0.2,2.3]`, `y = [−1,14]`.

The larger Stage 6 values justify a deliberate frame change, introduced with the new example. Candidate movement or a control selection must not cause further rescaling within a stage. Corrected Stages 1–2 fit the target phone in one screen, reserving feedback/control space. Their physical compositions differ deliberately because Stage 2 adds the approved selector above the graph. Their mathematical domains remain the same. Existing Stages 3–6 retain their earlier renderer and fail the new one-screen criterion; the audit reports this rather than claiming acceptance. Enlarged text may scroll.

Pure layout prepares coordinate-plane data, curve paths, shaded top/bottom region, right-endpoint rectangles, excluded triangle, representative strip and boundary handles/labels. React renders those plain scenes. Mutable D3 scales/path builders remain local to preparation; no imperative D3 selection or competing graphical state is introduced.

Use true geometry and SVG clipping rather than flattening out-of-range y-values. Supply interval endpoints and useful polynomial landmarks exactly. For a quadratic `cx²`, piecewise-linear interpolation has maximum vertical error `|c|h²/4` on a segment of width `h`; convert through the actual y-scale to justify the selected sampling density.

The lower Stage 5 curve is clipped to `0 ≤ x ≤ 3`, and the fresh Stage 6 curves to `0 ≤ x ≤ 2`. This avoids introducing incidental crossings outside the permitted introductory region. Their full sampled values remain mathematically correct, including offscreen samples. Plane geometry stays fixed; curve values are never clamped. The tested doubling reveal includes an outlined reference region for `[0,2]` inside the larger region.

Stages 1–2 now use an activity-specific flex frame: instruction, optional Stage 2 selector, flexible graph, one range control, compact live mathematics, reserved concise insight and Next. Native controls retain 44px touch targets. At accessibility enlargement the frame grows with its contents rather than allowing them to overlap the following inspector. The Integration-only lab host rule accounts for the header border. Stages 3–6 still use the original bounded graph row, calibration and desktop arrangement described in the original review; they have not received this composition correction. Navigation moves focus to the task heading; continuous manipulation does not move it.

The current layout uses 200 intervals plus exact landmarks. At the current maximum graph height of 420 CSS pixels, the plot height is 368 pixels. The first frame's width is 5 mathematical units: the largest quadratic coefficient is 1, giving at most `0.0072` vertical CSS pixels of curve-interpolation error. The final frame's width is 2.5 units and largest coefficient 3, giving at most `0.0029` pixels. The shaded region's sampled interval is no wider than the corresponding visible domain, so the same bound is conservative for its polynomial edges. Linear graphs are represented exactly by their line segments. These bounds apply to this polynomial family and size policy, not arbitrary functions or future much larger renderers.

Scenes are readonly plain data. Stable plane preparation can be memoised separately from candidate-dependent shading/labels. High-frequency movement must not traverse a growing learning history.

## 5. State and interaction ownership

The explicit reducer owns committed `region`, the active boundary transaction, learning stage/subpart, function/refinement, prediction, answer draft, feedback/help and records. This single activity composition is a pragmatic choice, not a generic six-stage engine.

An edit contains an opaque monotonic transaction ID, boundary identity and continuous candidate. The effective region substitutes that candidate into the committed region. Both marker and all derived mathematical graphics use it. Commit uses the final pointer-up coordinate and rounds to the declared input resolution:

- Stage 1: continuous finite value within `[0,4]`, shared by graph and native range.
- Stage 2: b remains fixed at 3; the range changes an integer partition count from 1 to 128, initially 4. Its transaction previews count/geometry without history, then records a changed release once.
- Stages 3–5: nearest `0.1` unit, unchanged in this correction.
- Stage 6: integer endpoints, within the ordered allowed limits.

This precision policy is separate from continuous motion and numerical area precision. No Card 1 integer-only live label exception is copied.

The adapter preserves grab offset, captures the initiating primary pointer and rejects stale revisions or competing contacts. It uses the feature's affine calibration approach for transformed SVG coordinates. It cancels on capture loss, invalid mapping, incompatible geometry, visibility/focus interruption, resize and host suspension. Intentional release clears adapter ownership before releasing capture; final commit cannot be undone by the resulting capture-loss event.

In Stages 1–2, native range track tapping, dragging and keyboard control are the single control path alongside Stage 1's direct graph handle. Arrow keys change b by 0.1 or rectangle count by one; Home/End reach the limits. The continuous refinement track is logarithmic, mapped to all integer counts. Native pointer previews use the reducer transaction, so only a changed final placement/refinement is recorded. The controls cancel on interruption and reject stale ownership. No duplicate boundary field, Set button or count dropdown remains in these stages. Existing labelled number-input/Set controls remain in Stages 3–6 and are explicitly included in their unresolved fidelity audit.

## 6. Learning and presentation policy

- Stage 1 Next is not gated by an arbitrary placement target or movement count.
- Stage 1 starts at b = 1, y = 2, titled Area under a graph. Its compact calculation uses the displayed boundary rounded to one decimal, while geometry and canonical position stay continuous. It does not introduce A(b).
- Stage 2 starts constant at fixed b = 3 with four right-endpoint rectangles; selector above graph, width slider below. Counts span all integers 1…128. Switching function preserves count, fixed interval and graph geometry. Estimated values use at most two decimals and distinguish non-exact estimates (`≈`) from exact constant coverage (`=`). Both estimated terms open the reusable Tooltip without affecting learning evidence.
- Previous/Next restores visited panels without rewinding evidence or transaction identities. Stage 6 substeps share the chosen region; mathematical changes invalidate a cached calculation draft. Finished retains Start again. No mathematical or control redesign for Stages 3–6 is included.
- Stage 3's standardisation to `b = 2` is explained. Prediction is function-specific. Committing `b = 4` after the prediction reveals the relationship; a transient candidate is not the test outcome.
- Stage 4 derives the removed triangle and `C = −a²/2` dynamically. A change in `a` must not retain an explanation asserting `a = 1`.
- Stage 5 region changes are free exploration. The optional additional prediction is omitted to avoid obstructing that exploration.
- Stage 6 separates free region choice, free interval choice and explicit calculation. Region edits invalidate stale calculation UI. Requested assistance remains evidence even after a later edit or retry. No extra unlock action is needed.
- Successful explicit Check creates completion inside Stage 6. Start again resets the learning attempt while retaining prior record snapshots.

Prepare answer-bearing text only for the state where it is permitted. Hidden sizing content, SVG descriptions, accessibility names and live regions must not contain the unrevealed final area. Lab diagnostics consume public records and are deliberately separate from learner presentation; this is not a security boundary against inspecting client code.

## 7. Public contract and learning records

Use the feature's [`public.ts`](../../../../../../src/app/step-visuals/public.ts) as the supported activity/type entry point. The reusable activity brings its own styles and does not import the lab, application models, authentication or persistence.

### Typed evidence

`IntegrationAttempt` uses `schemaVersion: 1`, `activityVersion: 1`, `activityId: "integration-area"`, opaque attempt ID, session-local attempt number, stage, status and current region. It retains graph-specific predictions, individual calculations, persistent assistance use and nullable independent/assisted success.

`Prediction` records function, selected multiplier, whether tested and nullable correctness before testing. `Calculation` records submission number, full region, submitted value, expected mathematical area, correctness and assistance at submission. Free curve/interval selections are never Check records or incorrect answers.

`IntegrationResult` refines a completed attempt with a non-null success classification and calculated area. `IntegrationRecords` contains current, completed archives, partial archives, ordered events and explicit exit state.

Events have version/activity/attempt metadata plus session-wide sequence and event ID. The event vocabulary covers attempt start, committed boundary, selected function, refinement, prediction submission/test, selected region, stage/subpart transition, help, calculation Check, completion, restart and explicit exit. Pointer previews, cancellations and rejected/stale actions retain the same record envelope.

### Hosting and callback semantics

The implementation must preserve the established delivery guarantees:

1. Deliver accepted ordered `onEvent` facts after React commits; deliver `onComplete` once per completed attempt after its completion event.
2. Deliver the accumulated `onRecordsChange` snapshot after its event batch, including an initial snapshot and archives.
3. Deliver explicit `onExit` only after final evidence so the host may safely unmount.

Guard Strict Mode replay, callback identity changes and reentrant/stale requests. Synchronous host callback failures must not corrupt learning state or block other deliveries; asynchronous persistence remains the host's responsibility. A late snapshot subscriber can inspect archives, but event/completion subscriptions do not replay historic deliveries.

Suspend/hide preserves committed state and cancels editing; it is not a learning exit. Restart creates a distinct attempt and archives the old completed/partial snapshot. Explicit activity switching reports exit through the existing host; arbitrary unmount, browser refresh and tab closure do not promise guaranteed delivery. No page-refresh restoration is implemented.

`IntegrationActivityProps` exposes `visible`, `restartKey`, `exitKey`, `onExit`, `onEvent`, `onComplete` and `onRecordsChange`. Request keys are non-negative safe integers; their initial values are inert, and changed values request the operation. If both keys change together, exit takes priority. Exit is explicitly recorded before host navigation. Callback errors are reported without undoing accepted evidence. A mounted delivery cursor guards Strict Mode/reentrant duplicates. Delivery and recording guarantees are covered by six pure delivery tests, reducer tests and browser callback-inspector assertions.

The lab logs only actual callback batches in development, at `onRecordsChange`, and never logs transient/cancelled pointer movement. The closed inspector mounts no record JSON. Puckle can consume the same exported contracts from a client component; no identity, storage, refresh recovery or application-specific adapter is implemented.

A compact example result (opaque ID shortened for illustration):

```json
{
  "schemaVersion": 1,
  "activityVersion": 1,
  "activityId": "integration-area",
  "attemptId": "opaque-attempt-id",
  "attemptNumber": 1,
  "stage": 6,
  "status": "completed",
  "region": { "top": "upper", "bottom": "parabola", "a": 1, "b": 2 },
  "predictions": [{ "function": "flat", "multiplier": 2, "observed": true, "correct": true }],
  "checks": [{ "number": 1, "region": { "top": "upper", "bottom": "parabola", "a": 1, "b": 2 }, "submitted": 5, "expected": 5, "correct": true, "assisted": false }],
  "assistanceRequested": false,
  "successMode": "independent",
  "area": 5
}
```

## 8. Verification record

### Current Stage 1–2 final refinements

The [latest report](final-refinements-review.md) records **131 pure**, **53 Chromium regression** and **3 production browser tests passed**, including Previous/Next preservation, rounded calculations, both tooltips, target-phone fit and existing Roots and Factors checks. Scoped lint, production build and post-build TypeScript passed. All work remains uncommitted. No WebKit or physical Safari pass is claimed.

### Previous Stage 1–2 fidelity correction

The [fidelity review](approval-b-fidelity-review.md) contains the six requested screenshot states, viewport/document heights, later-stage discrepancy table and outstanding reference conflicts. Current results: **125 pure**, **49 Chromium regression** and **2 production composition tests passed**; scoped ESLint, production build, post-build TypeScript and diff checks passed. WebKit was not run. The same development server remains accessible on port 3171; no packages, shared Card 1 styles or application source were changed in this correction. Approval B remains a manual decision, not a consequence of these test counts.

### Historical initial implementation — before failed Approval B review

The results below establish what passed in that earlier run, not fidelity approval. In particular, its scrolling composition, Stage 1 b = 1 and progressive/duplicated Stage 2 controls were subsequently rejected. Current Stages 1–2 and their entry fixtures supersede those choices. Physical equality across Stages 1–5 reported below is historical; the approved Stage 2 selector placement now has its own composition, while geometry remains stable within each stage.

Verification performed on 23 October 2026:

| Check | Result |
| --- | --- |
| Entire feature pure project | **124 passed**, including 28 new integration tests and the extended isolation checks. |
| Existing Chromium feature regressions | **108 passed**: Card 1, A–E/Guided preservation, sparklines, records, responsive layout and menu behaviour. |
| Integration Chromium tests | **12 passed**: full/assisted/independent journeys, free choices, context invalidation, gestures, cancellation, transformed coordinates, coincident handles, touch emulation and screenshots. |
| Focused 200% text recheck | Passed after making control-label flex bases text-relative so select values can reflow onto their own row. |
| Production Chromium smoke checks | **2 passed**: independent calculation and native-touch emulation; zero learning-record console groups in production. |
| Scoped ESLint | Passed. |
| Production build | Passed; `/step-visuals` prerendered successfully. |
| Final TypeScript and diff checks | Passed after production generation; no application configuration or dependency changes. |

Commands actually used from the repository root (output directories are generated review artifacts):

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure --output=/private/tmp/integration-all-pure-final
SPV_TEST_BASE_URL=http://localhost:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium --grep-invert 'integration' --output=/private/tmp/integration-card1-regression
SPV_TEST_BASE_URL=http://localhost:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration.browser.ts --output=/private/tmp/integration-browser
node_modules/.bin/eslint src/app/step-visuals
npm run build
node_modules/.bin/tsc --noEmit
git diff --check
```

Production smoke used a temporary `next start --hostname 127.0.0.1 --port 3172`, followed by:

```sh
SPV_CONSOLE_PRODUCTION=1 SPV_TEST_BASE_URL=http://localhost:3172 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration.browser.ts --grep 'default calculation|emulated native touch' --output=/private/tmp/integration-production
```

That production server was stopped after verification. The development server remains available on port `3171` for review.

During iteration, corrected a redundant narrowed TypeScript condition, strict locator ambiguities, a Playwright activation test that needed keyboard activation for an `aria-disabled` explanatory button, and an exact floating-point geometry assertion requiring a sub-pixel tolerance. These were resolved rather than hidden. An initial sandboxed browser launch failed before tests could run; Chromium then ran with the required execution permission. WebKit was excluded following the user's instruction.

Independent evidence covers the required polynomial identities and all nine proper final regions, convergence versus exact flat estimates, ordered/zero-width boundaries, intermediate gestures and final coordinates, cancellation/stale ownership, non-drag entry, both prediction contexts, dynamic constants, free curve choices, retry/help/completion/restart and callback/archive semantics. Browser tests confirm numerical and geometric behaviour; they do not establish student learning gains or physical-device performance.

### Screenshot review inventory

The screenshot tests generated ten named states at each of **360×640**, **390×844**, **428×926** and **1280×900**:

`stage-1.png`, `stage-2.png`, `stage-3-predict.png`, `stage-3-reveal.png`, `stage-4.png`, `stage-5.png`, `stage-6-region.png`, `stage-6-limits.png`, `stage-6-calculation.png`, `stage-6-finished.png`.

The final review captures are under `/private/tmp/integration-review-final/integration.browser.ts-six-*/`. The 390px directory is:

`/private/tmp/integration-review-final/integration.browser.ts-six-a01b0-d-stable-graph-at-390-×-844-chromium/`

The successful full-journey test also captured `stage-4-changed-left.png`, `stage-6-incorrect.png` and `stage-6-hint.png` under `/private/tmp/integration-browser/integration.browser.ts-com-*/`. The final reflow captures are `stage-5-200-percent-text.png` and `stage-6-hint-200-percent-text.png` under `/private/tmp/integration-review-final/integration.browser.ts-200-*/`, at 320×568 with simulated 200% root text sizing. Short landscape at 740×360 was functionally checked. These are generated local artifacts, not committed source assets.

The final screenshot/reflow refresh used:

```sh
SPV_TEST_BASE_URL=http://localhost:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration.browser.ts --grep 'six-stage screenshots|200%' --output=/private/tmp/integration-review-final
```

All five selected tests passed. Documentation link validation checked 24 local links successfully.

Actual screenshot review examined phone stages 2–6, the 320px enlarged-text help state and desktop Stage 5. It prompted an outlined baseline region for doubling, explicit `−1/2` constant notation, quieter placement of the lower-curve label, removal of locked controls from completion, and text-relative form wrapping. The graph retained identical document geometry/axes across Stages 1–5 and across all Stage 6 subparts; the only mathematical frame change is the explained new Stage 6 example. All screenshot runs assert no horizontal page overflow.

WebKit is not run in this implementation pass at the user's explicit request because it does not work in the current environment. This supersedes the original request for both browser projects; no cross-engine pass is claimed. Automated emulated touch and Chromium are not physical iPhone Safari or VoiceOver/TalkBack verification. Manual phone/assistive-technology and educational clarity remain human-review evidence unless genuinely performed.

## 9. Approval B review route and known limits

Open `/step-visuals`, open the existing burger menu and select **Integration → Area and accumulation**. Roots and Factors remains independently accessible through the same menu; its Guided/A–E/Sparkline controls remain its own lab session.

For this review session, use `http://localhost:3171/step-visuals` on the computer. On a phone on the same local network, the current address is `http://192.168.1.38:3171/step-visuals` (the address may change when networks change). An HTTP request to this network address returned 200 from this computer; this does not establish phone-side firewall/network access. The activity is also available through a normal `npm run dev` server on that server's `/step-visuals` route.

### Phone-origin interaction fix — 23 October 2026

A later physical-iPhone report exposed a development-origin issue missed by localhost tests: the Wi-Fi URL returned server-rendered HTML with HTTP 200, but the menu and draggable root did not respond. Chromium with an iPhone user agent and touch input reproduced the failure on `192.168.1.38`, while localhost worked. Hit testing reached the correct burger button; the server and browser logged a rejected `/_next/webpack-hmr` WebSocket connection. No overlay or pointer-capture change was needed.

The installed Next.js 16 guide requires `allowedDevOrigins` for additional development hosts. The minimal necessary outside-feature change adds the exact Mac Wi-Fi address to `next.config.ts`; no wildcard, production origin rule, menu styling or gesture behaviour was changed. Next restarted automatically and remains bound to `0.0.0.0:3171`.

`tests/lab-network.browser.ts` failed at menu activation before the allowlist change, then passed on both the Wi-Fi URL and localhost. It tests menu close/reopen, native touch root movement, Integration selection and boundary input, returning to Roots and Factors, and absence of client/WebSocket errors. This is Chromium touch emulation, not physical Safari verification. The comparison with the separate Info Cards fixture is consistent: that fixture has its own server and does not use this Next.js development connection. An HTTP 200 check alone is insufficient evidence of an interactive review URL.

Run the regression against the actual served host:

```sh
SPV_TEST_BASE_URL=http://192.168.1.38:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium lab.browser.ts lab-network.browser.ts --output=/private/tmp/step-visuals-network-regression
```

If the Mac's Wi-Fi address changes, update the exact development allowlist entry and rerun the network-origin check. Physical iPhone confirmation after reloading remains with the reviewer; WebKit was not run.

Results: all 14 network-origin mobile/desktop navigation tests passed, and the new interaction test also passed on localhost. Scoped ESLint, TypeScript and diff checks passed. HTTP responses were 200 at both addresses. Only the verified Step Visuals development server restarted; other servers were left running.

The focused review should assess whether accumulating area, narrowing rectangles, doubling, removing the earlier triangle, selecting strip boundaries and finally calculating feel like one coherent investigation. In Stage 6, try upper line/parabola on `[1,2]` (area `5`), then an incorrect calculation followed by help on a new attempt. The mathematical/functional test record should already cover the mechanics; human attention should focus on clarity, mobile feel and educational continuity.

Known scope limits: no crossing-curve or signed-area lesson, no symbolic engine, no native renderer, no backend/identity/persistence, no video or exam subsystem. Card 1's separately deferred non-drag gap is not copied into this new activity and is not fixed incidentally. Extension topics remain in the experience specification's register.
