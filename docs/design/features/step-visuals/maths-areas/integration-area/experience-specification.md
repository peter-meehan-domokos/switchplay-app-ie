# Integration

Activity ID: `integration-area`. Host: `/step-visuals`. Current experience: seven stages.

Educational authority: [Puckle Integration — approved seven-stage design](../../puckle-integration-seven-stage-approved-design.md), Approval A complete, together with the three final user decisions recorded in [the approved implementation plan, §11](../../../../../engineering/features/step-visuals/activities/integration-area/seven-stage-experience-impl-plan.md#11-final-approved-educational-decisions).

The subsequently approved **final Integration refinements**, recorded in [the refinements implementation plan](../../../../../engineering/features/step-visuals/activities/integration-area/final-integration-refinements-impl-plan-draft.md), supersede the corresponding earlier subsection, copy, layout and record requirements. The original approved document and historical fidelity evidence remain unchanged; this file describes the current experience.

The user's **six final corrections** subsequently supersede the earlier Stage 3 delay, Stage 5 initial boundary, Stage 6 symbolic-placeholder integral and Stage 7 hint/recap requirements. They are reflected below and recorded, with actual verification, in [the fidelity review](../../../../../engineering/features/step-visuals/activities/integration-area/approval-b-fidelity-review.md#six-final-corrections--24-october-2026). Historical approvals/evidence are not rewritten.

Implementation updated: 24 October 2026. **Approval B remains pending human review on the physical iPhone.** [The fidelity review](../../../../../engineering/features/step-visuals/activities/integration-area/approval-b-fidelity-review.md#seven-stage-implementation--24-october-2026) records actual verification, screenshots and limitations.

## 1. Authority and scope

The approved seven-stage document supplies exact student-facing titles, instructions, choices, explanations, equations, tooltip content and feedback for Stages 3–7. Reproduce that content literally; this document references it rather than maintaining a second transcription. The three final decisions below override conflicting earlier requirements. Preserve the existing approved Stages 1–2 content in §3.

The [Great Maths Visuals guide](../../great-maths-visuals.md), [AI support guide](../../ai-maths-visuals-support-guide.md), [engineering guide](../../../../../engineering/features/step-visuals/maths-visuals-engineering-guide.md) and repository instructions govern their respective responsibilities. The [six-stage image](../../Six-Stage-Mobile-Maths-Learning-Flow.png) remains historical educational/layout context; it does not override the approved seven-stage experience.

The six-stage requirements previously in this file are superseded for Stages 3–7. In particular, do not restore the tripling distractor, omit the new division stage, hide the constant of integration exclusively in a tooltip, limit the exploratory crossing domain to b≤3, or restore a three-screen calculation wizard.

The activity name remains **Integration**, with the existing two-level development menu and independent activity hosting. No Puckle integration, database, authentication, persistence or new dependency is included.

## 2. Experience map and invariants

| Stage | Initial scene | Student action and response | Progression |
| --- | --- | --- | --- |
| 1. Area under a graph | y=2, a=0, b=1 | Continuous graph/slider movement over [0,4]; rounded displayed b and its consistent area calculation | Free Next |
| 2. Refine the rectangles | y=2, [0,3], four right-endpoint rectangles | Choose constant/rising; one logarithmic rectangle-width track supports integer counts 1–128 | Free Next |
| 3. How area grows | y=2, boundary 2 | Automatic 2→4 comparison; select doubled, quadrupled or increased eightfold; see exact function-specific feedback and contextual suggestion | Any first answer enables Next |
| 4. Why do we divide? | y=x, b=3, enclosing rectangle | Freely choose x/x²/The rule; quadratic mode retains lower/upper rectangles and count; rule connects formulas to indefinite integration | Free Next |
| 5. Changing the area | y=x, fixed a=1, initial b=3 | Continuously move b, then smooth integer settlement on release; observe fixed excluded ½ | Free Next |
| 6. Area between curves | y=x and y=x²−3x, a=1, b=3 | Choose any two curves, move b continuously over [1,4]; correct non-negative geometric area including crossings | Free Next |
| 7. Choose and calculate an area | y=9+2x and y=3x², [1,2] | On one screen choose curves and interval, calculate and explicitly Check | Any current checked numerical answer enables Finish |

All ordinary headings begin with the number and full stop. Stage 7's three sections remain on one screen. Curve/interval choices are free choices; only its numerical calculation is assessed. Incorrect answers never force correctness before onward navigation.

Only Stages 2–4 use the subsection pattern **title → horizontal subsection buttons → current instruction → graph/content → explanation**. No ticks, counters or additional gates. The Stage 4 rule subsection deliberately has no graph or rectangle controls; returning to either graph subsection restores its geometry and mathematical state.

At normal zoom all seven stages, including the longest feedback and open tooltips, fit the reference 390×844 and 393×852 CSS-pixel viewports with the lab diagnostics collapsed. Enlarged text and exceptionally short screens may reflow/scroll. Soft-keyboard focus must remain usable; physical Safari keyboard handling is not certified by Chromium screenshots.

The graph retains its physical position, dimensions and frame within each stage through movement, feedback and tooltip changes. Stage-specific allocations are permitted. Stage 3's x² comparison deliberately shows height 16 with labelled y scale; Stage 4 changes its labelled vertical scale for enclosing heights 3/9 while preserving horizontal scale and physical graph placement. No area-driven auto-fit.

Pure analytic mathematics owns areas and assessment. D3 prepares scales, sampled paths and scene geometry; React owns rendering. Samples do not determine exact areas. Clip true offscreen curves rather than clamp their values. Selected curves and boundaries remain associated with their mathematical positions.

## 3. Preserved Stages 1–2

### Stage 1 — Area under a graph

Instruction:

> Move the right boundary and watch the shaded area change.

The graph starts at **b = 1**. Directly beneath it, a continuous **Right boundary** slider shows the permitted interval **0 to 4**. Feedback has a compact **Shaded area** label and one logical calculation, initially **A = 2b = 2 × 1 = 2 square units**, with units immediately after the numerical answer and natural wrapping if necessary. Do not introduce `A(b)` here.

The latest approved display policy intentionally separates continuous geometry from its simplified readout: a physical boundary at 2.34 displays **b = 2.3**, and calculates **A = 2b = 2 × 2.3 = 4.6**. Never multiply the underlying 2.34 while claiming the displayed calculation uses 2.3. No unnecessary trailing zeros. The marker and shaded region remain continuous; assessment and canonical mathematics must not take authority from the rounded display. Accessible wording explains the rounding policy without exposing extra decimal places in the calculation.

Supporting explanation:

> The height stays at 2. Each extra unit of width adds 2 square units of area.

The draggable boundary and native slider represent the same variable. Track tapping and keyboard controls provide non-drag operation without a duplicate value field or Set button. No exact target is required, and no movement is assessed. Next deliberately prepares Stage 2's fixed interval rather than inheriting this explored value.

### Stage 2 — Refine the rectangles

Fix the interval at `[0,3]` throughout. Put the selector directly beneath the title and above the instruction, using exactly:

- **y = 2**
- **y = x**

Start with the constant graph selected and four rectangles, continuing Stage 1's y = 2. Instruction:

> Make the rectangles narrower. Compare the estimated and actual areas.

Use one continuous-track **Rectangle width** slider below the graph, labelled **Wider** and **Narrower**, with a visible **Rectangles: n** readout. Integer partition counts range from 1 to 128; a logarithmic track distributes widths usefully. Track tapping and keyboard operation use this same control. Do not add a rectangle-count dropdown or boundary input/Set controls.

Initially show **Estimated area = 6 square units** and **Actual area = 6 square units**. After selecting rising with four rectangles, show **Estimated area ≈ 5.63 square units** and **Actual area = 4.5 square units**. Internally the rectangle sum remains exactly 5.625; formatting does not change it. Estimate displays have at most two decimals, no unnecessary trailing zeros, and use `≈` whenever they differ from the actual area. An exact constant-area estimate uses `=`.

The word **estimated** in both the instruction and **Estimated area** feedback is an inline, dotted-underlined Tooltip trigger. Either opens the same optional definition: **Estimated area** — “The estimated area is found by adding together the areas of all the rectangles.” It overlays without reflow, anchors above/below the selected word, remains within the viewport, and closes on repeat activation, outside interaction or Escape. It supports touch/keyboard and accessible descriptions. This definition is not calculation assistance and does not change learning evidence.

For the rising graph:

> Narrower rectangles follow the rising line more closely, so the estimated area approaches the actual area.

For the constant graph:

> The rectangles fit the constant-height graph exactly at every width. What about when y = x?

Both function selections retain the count, fixed interval, control inventory and graph geometry. Reserve feedback space so switching functions never expands the screen.


## 4. Stage 3 — How area grows

Implement [approved §3](../../puckle-integration-seven-stage-approved-design.md#3-how-area-grows--extend-existing-approved-interaction), with the final refinements below.

- Three functions, in order: **y = 2**, **y = x**, **y = x²**. Initially y=2. Buttons sit beneath the title, followed by the unchanged instruction **Watch the width change from 2 to 4.**
- Automatic continuous b=2→4, retaining original region/boundary and the added region.
- The final correction halves the previously implemented **4,280ms** delay to **2,140ms**. The animation duration remains **900ms**, with unchanged easing, replay and prediction timing rules. Reduced motion presents the final comparison directly.
- One answer selection, with **It doubled**, **It quadrupled**, **It increased eightfold**. No draggable boundary, Check or replay control.
- Correct and incorrect feedback use the exact approved branch. Numerical constant/rising areas are shown after selection; x² explains the eightfold scaling without displaying 8/3, 64/3 or b³/3.
- After an answer, suggest the leftmost unanswered function in the existing concluding location. Flat→rising uses **Now try y = x. Does the area grow in the same way?** Rising→square uses **Now try y = x². Does the area grow even faster?** Other orders use **Now try [next unanswered function].** Only after all three answers show the original concluding transition to Stage 4. These are suggestions, not gates; Next eligibility is unchanged.
- A function's first answer cannot be overwritten. Cache each function's evidence for the attempt.

**Final approved return policy:** selecting a previously answered function replays 2→4, then restores its answer and feedback without a new prediction. Next stays eligible throughout. Outer Previous/Next returns immediately to its completed comparison without replay. Replay frames and repeated completion do not create duplicate evidence.

## 5. Stage 4 — Why do we divide?

Implement [approved §4](../../puckle-integration-seven-stage-approved-design.md#4-why-do-we-divide--entirely-new-approved-stage), with the final refinements below.

Three freely selectable buttons sit beneath the title: **y = x | y = x² | The rule**. The current instruction follows. Both graph subsections share a fixed [0,3] interval, enclosing rectangle and physical graph box. Initially y=x; instruction: **See how the diagonal divides the rectangle in half. Then tap y = x² to compare.** Preserve the **Whole rectangle** and **Shaded triangle** calculation labels, 3×3=9, ½×9=4½ and Area=b²/2. Below the principal formula, add a visually secondary **A glimpse of the rule:** and properly composed ∫x dx=x²/2+C. No rectangle-width control appears here.

The x² tab encloses area 27 and simultaneously shows lower left-endpoint and upper right-endpoint constructions. One **Rectangle width** slider has exactly six stops: **4, 8, 16, 32, 64, 128**, initially 4. Wider/Narrower and the current count are visible. Side-by-side **Estimate from below** and **Estimate from above** show one decimal and explicit approximation.

| Count | Below | Above |
| --- | ---: | ---: |
| 4 | ≈5.9 | ≈12.7 |
| 8 | ≈7.4 | ≈10.8 |
| 16 | ≈8.2 | ≈9.9 |
| 32 | ≈8.6 | ≈9.4 |
| 64 | ≈8.8 | ≈9.2 |
| 128 | ≈8.9 | ≈9.1 |

Quadratic instruction: **Move the slider towards Narrower. Watch the estimates of the area under the graph get closer together.** Conclusion: **The estimates approach 9. That's one-third of the whole rectangle, which has area 27 (as you can see on the graph).** Preserve Area=b³/3 and the exact **Why exactly one-third?** tooltip/derivative. Remove the former final “Notice the pattern…” sentence; no indefinite integral is added to this subsection. Finite estimates support the limit, not an exact proof.

**The rule** has no graph or rectangle controls. Instruction: **Compare the two area formulas to see the pattern behind the power rule for integration.** Show **For y = x:** with ∫x dx=x²/2+C; **For y = x²:** with ∫x² dx=x³/3+C; then **The power rule for integration**, ∫xⁿ dx=xⁿ⁺¹/(n+1)+C, with **n ≠ −1** unobtrusively. Use composed fractions and exponents. Conclude exactly:

> These examples show the pattern: increase the power by one, then divide by that new power.
>
> We'll explore the constant C in the next stage.

Rule may be opened at any time. Switching back preserves the quadratic slider count. Outer Previous/Next restores the selected subsection. No assessment or mandatory subsection/count visit gates Next.

## 6. Stage 5 — Changing the area

Implement [approved §5](../../puckle-integration-seven-stage-approved-design.md#5-changing-the-area--former-stage-4-approved-update), amended by the zero-area decision below.

Fix y=x and a=1. On genuinely fresh entry start **b=3**; graph and slider continuously explore [1,4]. Outer navigation restores an intentionally saved boundary rather than resetting it to 3. Release alone starts a short smooth transition to the nearest whole number. Keyboard/non-drag operations settle to whole numbers. This policy applies only to Stage 5. The prior b=4 was an explicit earlier default, not a restoration override; the latest correction supersedes it without altering other Stage 5 behaviour.

Keep the excluded triangle unchanged and visibly separate from the desired region. Boundary labels a/b remain below the axis and individually legible. For b>1 use **Area left out** and **Area we want**.

**Final approved zero-area policy:** at b=1 no desired region exists. Draw no false fill and no “Area we want” label. A small restrained arrow points to the coincident boundaries, labelled exactly **Area we want = 0**. Both **a = 1** and **b = 1** remain clear. The excluded triangle is unchanged. Do not trigger this state by rounding a positive-width candidate to 1.

Keep the three approved causal explanations vertically stacked, retaining **First**, **But** and **So**. At settled boundaries:

| b | Whole triangle | Removed triangle | Desired area |
| --- | ---: | ---: | ---: |
| 1 | ½ | ½ | 0 |
| 2 | 2 | ½ | 1½ |
| 3 | 4½ | ½ | 4 |
| 4 | 8 | ½ | 7½ |

During fractional movement use the actual continuous boundary for geometry and mathematics. Rounded readouts use approximation notation; symbolic b avoids false exact substitution. Exact fractions/mixed numbers return at integer settlement.

The full approved main-screen observation includes **constant of integration** and visible **C = −½**. Its anchored tooltip uses the approved **Why is it a constant?** content. This particular constant makes A(1)=0; it is not a claim about every antiderivative. The expressly optional transition is omitted on the compact phone composition.

## 7. Stage 6 — Area between curves

Implement [approved §6](../../puckle-integration-seven-stage-approved-design.md#6-area-between-curves--former-stage-5-approved-update) exactly.

Initially select line y=x and parabola y=x²−3x, a=1, b=3. Options in either slot also include **x-axis (y = 0)**.

Below the graph, **First curve** and **Second curve** selectors are stacked vertically on the **left**. The **Right boundary: b** slider is on the **right**, using the larger share where function-name legibility permits. Continuous range [1,4], no release snapping; direct graph dragging remains available.

The final refinements fill the slider's available column and modestly redistribute unused space below the graph. Preserve the pre-refinement graph dimensions/position, overall stage allocation and Previous/Next position. The numerical shaded-area readout is replaced by **Add these narrow strips using integration:** and a properly typeset **Area = ∫ₐᵇ … dx**, substituting the actual calculated strip-height expression, not the placeholder h(x). Thus line/axis shows ∫ₐᵇ x dx; parabola/axis below the crossing shows ∫ₐᵇ (3x−x²) dx; the default pair shows ∫ₐᵇ (4x−x²) dx. Identical curves show integrand 0. Beyond the parabola/axis crossing use ∫ₐᵇ |x²−3x| dx, reusing the already approved absolute-value height expression; do not integrate a single signed polynomial across the crossing. The explanation, dynamic h(x), geometric-area calculation, graph, controls and spacing remain unchanged by this substitution correction.

Compute higher-minus-lower separately on each ordered interval piece. Selector reversal changes no geometric area. Equal curves give no fill/height arrow and use the exact zero-gap explanation. b=1 is a valid zero-width region.

For parabola/axis beyond b=3, split at x=3 and add both non-negative lobes. Replace the normal explanation with the exact approved crossing sentence. The displayed height remains a non-negative distance; no full piecewise integral is added to the main screen.

The height indicator is a fine double-headed vertical arrow, inset slightly from the selected curves and labelled h(x). It disappears for zero width or identical curves and is placed away from essential labels/crossings.

| Pair | Area [1,3] | Area [1,4] |
| --- | ---: | ---: |
| x / (x²−3x) | 22/3 = 7⅓ | 9 |
| x / axis | 4 | 15/2 = 7½ |
| (x²−3x) / axis | 10/3 = 3⅓ | 31/6 = 5⅙ |
| Identical pair | 0 | 0 |

No grading, Check or prescribed target is introduced.

## 8. Stage 7 — Choose and calculate an area

Implement [approved §7](../../puckle-integration-seven-stage-approved-design.md#7-choose-and-calculate-an-area--former-stage-6-approved-update), amended by the answer-edit decision below.

All three sections remain visible below the graph:

1. **Choose what area to measure** — First/Second curve selectors on one horizontal row.
2. **Choose where to measure** — three equal-width radio-like interval choices on one horizontal row.
3. **Calculate the area** — immediate unsolved integral, **Your answer**, **Check calculation**.

Curves: y=9+2x, y=3x², axis. Initial pair is line/parabola and **From 1 to 2**. Other interval choices are **From 0 to 1** and **From 0 to 2**. Choices are not assessed. Changing either curve or interval updates the actual selected region/integral and invalidates stale draft, feedback, open hint and Finish eligibility.

Shade strictly between the selected curves. Keep unused curves subdued, function labels correctly associated, a/b below the axis and the thin distance arrow where meaningful. There are no draggable boundary controls.

The correct integral is generated from mathematical upper-minus-lower order. No evaluated numerical answer is shown before Check. Equal curves have integrand 0 and no false fill/height arrow.

| Pair | [0,1] | [1,2] | [0,2] |
| --- | ---: | ---: | ---: |
| (9+2x) / 3x² | 9 | 5 | 14 |
| (9+2x) / axis | 10 | 12 | 22 |
| 3x² / axis | 1 | 7 | 8 |
| Identical pair | 0 | 0 | 0 |

Use exact approved correct/incorrect/empty feedback. Empty/non-numeric input is validation, not an assessment attempt. A finite numerical Check records the submission and enables Finish regardless of correctness. The optional anchored **Show hint** appears after an incorrect Check; preserve its distinct ordinary/equal-curve wording. It does not reveal a distinct-pair answer.

The ordinary hint reads: **Use the power rule to integrate each term. Then subtract the lower value from the upper value.** Immediately beneath it show **Area = Upper value − Lower value**, with smaller/lighter **(x = b)** next to Upper value and **(x = a)** next to Lower value, using mathematical variable typography. The identical-curve hint is unchanged and does not acquire this extra equation. Preserve the existing simple Tooltip placement/interaction/accessibility; temporary coverage of other controls is accepted. No collision-avoidance system is introduced.

**Final approved edit policy:** editing a checked answer clears feedback and disables Finish until another Check calculation. Preserve earlier checked submissions in history, including when an edit is subsequently reverted. Finish uses the most recently checked answer for the current problem and answer revision.

Finish alone produces **Your area calculation**: selected curves/interval, height, solved integral and true geometric area; if incorrect, also show the latest submitted answer. No new assessment or congratulations is added. **Start again** starts a new attempt and archives the old evidence.

The recap places **Strip height: h(x) = [expression]** on one line at the target phone sizes. Below the selected curves/interval and strip height, show four mathematical lines, generated from the actual ordered curves and interval:

1. The unsolved definite integral.
2. The integrated expression in brackets, with upper/lower evaluation bounds.
3. Explicit substitution at the upper boundary minus substitution at the lower boundary.
4. The evaluated upper value minus lower value and resulting area.

For the initial [1,2] example these are ∫₁²(9+2x−3x²)dx; [9x+x²−x³]₁²; (9×2+2²−2³)−(9×1+1²−1³); and 14−9=5. Identical curves correctly give an integral of 0, [0] with bounds, (0)−(0), and 0−0=0. Reversed selections give the same non-negative height and solution. Derive all steps from the existing canonical polynomial model and analytic primitives, never from hard-coded reference-case algebra. Worked numerical steps mount only after Finish. Preserve the graph, selected information, existing submitted/correct-answer feedback and Start again position, using the already allocated panel without ordinary phone scrolling.

## 9. Learning records and numerical contracts

The live seven-stage implementation emits schema/activity version **2**, with stage number plus stable stage ID and canonical selected curve pair/interval. Older six-stage v1 records retain their original types/version; public consumers narrow by version. A crossing region is not misrepresented as having one global upper curve.

Record changed committed placements/refinements, curve/interval choices, first prediction/results, first completed comparison, calculation Checks, requested hints, Finish, restart and explicit exit. Do not record drag/animation frames, cancellations, rejected actions or input keystrokes.

Accepted entry into The rule emits **division-rule-viewed**, meaning a subsection visit, not proof of reading. Graph returns retain **division-mode-selected**; reselecting the active subsection records nothing. Every newly emitted **stage-changed** includes **view** describing the actual destination region and, for Stages 2–4, its active subsection, after saved-state restoration. **attempt-started** includes the initial flat/axis region [0,1], also on restart, so the first graph does not depend on inferred defaults. Context is optional in public v2 types for compatibility with historical payloads; new live events supply it. No event names are renamed, and no durations or additional analytics events are added.

Checks include submitted and expected mathematical numbers, correctness, assistance-at-submission and problem/answer revisions. Check does not complete. Incorrect Finish has outcome incorrect, null successMode and the true area. Correct Finish is independent unless a calculation hint was requested. Incorrect attempts and explanatory tooltips in Stages 2/4/5 do not by themselves imply assistance.

Callbacks deliver accepted events, completion at its event, accumulated records, then explicit exit. Delivery guards cover mounted-session Strict Mode/reentrancy; they are not durable exactly-once persistence. Start again retains completed/partial snapshots. Refresh restoration and guaranteed tab-close delivery remain out of scope.

All final answers are exact integers internally. Parse full-string finite decimal/scientific numbers, including 5, +5.0 and 5e0. Acceptance tolerance remains 1e−9 + 1e−9×max(1,|expected|). It absorbs numerical representation noise, not a rounding allowance; 5.01 is incorrect for 5. Formatting never determines assessment.

## 10. Hosting, accessibility and verification

The existing lab menu and activity host remain in use. Roots and Factors and its Guided/A–E/sparkline previews are unchanged by this implementation.

Native sliders provide track tapping and keyboard alternatives to graph dragging. Selects, radio-like intervals and the answer field use native accessible semantics. Preserve pointer capture, offsets, final-coordinate commits, interruption cancellation, stale-event guards, reduced motion, focus visibility and polite feedback announcements. Tooltips are optional, anchored and dismissible without page reflow.

The fidelity review records the actual pure, browser, production and layout checks. Automated Chromium coverage does not establish physical Safari keyboard/touch behaviour or VoiceOver/TalkBack accessibility. WebKit is excluded at the user's request. Approval B is a human educational/phone review and has not been granted.
