# Puckle Step Visuals — Integration: Consolidated Seven-Stage Experience Specification

**Status:** Educational design Approval A complete (23 October 2026). This is the consolidated source-of-truth *design handover*, **not** a Codex implementation instruction and **not** an implementation approval. Approval B remains pending working-phone review.

**Scope and precedence:** Stages 3–7 below consolidate decisions approved in the design conversation, including the final Stage 6 layout reversal. Stages 1–2 already work and are to be preserved, not reconstructed from this summary. The existing in-repository experience specification, design guides, engineering guide and implemented Stages 1–2 govern their finer copy, layout and mechanics. This document makes no claim to have inspected the current repository or device screenshots. If the implementation differs from a clearly locked Stage 3–7 decision, do not silently reinterpret the design; raise the discrepancy before coding.

## A. Educational through-line

**One accumulating idea:** A graph's height determines the area of a thin strip; adding strips determines an area; the resulting area formulas have geometric meaning; we can change where we measure and which two curves define a strip; finally the student calculates the area.

| Stage | Title | Main learning event | Status |
|---|---|---|---|
| 1 | Area under a graph | Constant height × width; area under `y = 2` is `2b` | Existing; preserve |
| 2 | Refine the rectangles | Narrower rectangles estimate area under changing heights | Existing; preserve |
| 3 | How area grows | Doubling the boundary gives factors 2, 4 or 8 for `y = 2`, `y = x`, `y = x²` | Approved revision |
| 4 | Why do we divide? | Half of the enclosing rectangle for `y = x`, approximately one-third converging for `y = x²` | New; approved |
| 5 | Changing the area | Area from `a = 1` is area from zero minus a fixed excluded area | Approved revision (former Stage 4) |
| 6 | Area between curves | Strip height is the vertical difference between curves | Approved revision (former Stage 5) |
| 7 | Choose and calculate an area | Freely choose curves and interval; only the final calculation is assessed | Approved revision (former Stage 6) |

**Scope boundary:** These stages build an *intuition* for the power rule and exhibit the cases `x` and `x²`; they are not a proof of the general power rule. The derivative connection appears only as a short, optional tooltip in Stage 4. A fuller derivation belongs in another card.

## B. Shared experience rules (apply to all seven stages)

1. **Mobile-first:** Every stage fits one physical iPhone screen at normal zoom, with no routine vertical page scrolling. Verify content, feedback, control labels and navigation together, not just the default state. Mobile soft-keyboard handling needs a practical, non-obscuring solution in Stage 7.
2. **One educational task per stage.** Controls and copy must make the next action obvious. Do not introduce arbitrary unlocks, hidden gestures, extra Check/Set buttons or separate internal screens.
3. **Precision and mathematical honesty:** Typeset fractions, exponents and integrals properly. Distinguish exact results from rounded estimates. A finite rectangle estimate is evidence of a limit, not a proof of its exact value.
4. **Visual grammar:** Shaded areas show the desired region; excluded regions are visually distinct; `a`/`b` sit near their actual boundary guides, below the x-axis where needed; the strip-height indicator uses a **fine double-headed vertical arrow**, stopping just short of the curves, with `h(x)` beside it. Do not use the thick capital-I-shaped marker.
5. **No presumed selector order:** “First curve” and “Second curve” label arbitrary choices, not upper/lower ordering. Determine the upper and lower functions *at each x* automatically, including if they cross.
6. **Stage-specific gestures:** Smooth graph-boundary dragging where already approved. **Snap to an integer upon release only in Stage 5**. Stage 6 moves continuously without integer snapping. Stage 7 has no draggable interval boundaries.
7. **Reused presentation conventions, not forced shared code:** Keep the user-facing interaction vocabulary and visual grammar consistent, but do not mandate risky shared CSS or component extraction before fidelity is established. Technical architecture remains a Codex responsibility; educational choices do not.
8. **Navigation:** Preserve existing Previous/Next conventions, except Stage 7 finishes. No user is blocked by an incorrect answer. Persist/recover an already answered Stage 3 comparison appropriately.
9. **Explicitly approved copy takes precedence.** Do not shorten, reinterpret, reorder or invent student-facing prompts, feedback, terms or tooltips on implementation initiative.

## 1. Area under a graph — preserve existing work

**Purpose:** Introduce the geometric meaning of area using constant height `y = 2`.

- Right boundary `b` initially **1**, moveable by slider and direct graph drag.
- Width increases smoothly; display `b` at one decimal and use the **displayed** value consistently when computing the area.
- Display the area relationship `A = 2b = 2 × b` with the currently selected value.
- No additional typed Set input or hidden gesture.
- **Do not redesign** this working stage from this abbreviated consolidation; retain its existing exact approved copy and rendering.

**Transition meaning:** Once the height changes with x, a single rectangle no longer describes the whole region.

## 2. Refine the rectangles — preserve existing work

**Purpose:** Estimate area with increasingly narrow vertical rectangles.

- Fixed right boundary **`b = 3`**.
- Initially `y = 2`; switchable to `y = x`.
- One slider changes rectangle width/count in a clearly repeatable fashion.
- Display a right-endpoint rectangle estimate and the actual area distinctly; `estimated` has a clickable explanation that it sums the rectangle areas.
- Graph, control and explanatory text fit one screen.
- **Do not redesign** this working stage; use the existing approved implementation and documentation for unspecified precise slider values and copy.

**Transition meaning:** Now ask how the *total* area grows when we change how wide the region is.

## 3. How area grows — extend existing approved interaction

**Purpose:** Compare scaling of accumulated area; **do not** yet introduce the dividing-by-3 formula.

### Content and order

- Title: **`3. How area grows`**.
- Instruction: **`Watch the width change from 2 to 4.`**
- Selector above graph, in this order: **`y = 2`**, **`y = x`**, **`y = x²`**.
- Initially **`y = x`** is selected.
- Display shaded area from zero to `b = 2`; after the already agreed automatic delay (**existing delay plus two seconds**), animate `b` smoothly to **4**.
- Preserve a distinctly marked original region/boundary as the additional area appears. The final state must remain readable even if the animation was missed.
- On changing the selected function, replay the comparison for that function; do not require replay buttons, dragging or extra confirmations.
- Vertical scale for `y = x²` must correctly accommodate `y(4) = 16`, with explicit axis labels—no distorted or silently misleading scale.

### Question and answers

After the visual demonstration, ask: **`What happened to the shaded area?`**

The three answer buttons, replacing the prior arbitrary “It tripled” distractor, are:

- **`It doubled`**
- **`It quadrupled`**
- **`It increased eightfold`**

An answer reveals feedback immediately; there is **no Check button**. Next is available after any answer, including an incorrect one. Exploring all three functions is encouraged but not required. Returning to an answered comparison should preserve that result rather than inadvertently resetting all progress.

### Locked feedback

**`y = 2` — correct:** `Correct! The area doubled.`

- Before: `2 × 2 = 4`.
- After: `2 × 4 = 8`.
- `The width doubled, but the height stayed at 2. So the area doubled too.`

Incorrect headline: **`Not quite. The area actually doubled.`** Then show the same calculations/explanation.

**`y = x` — correct:** `Correct! The area quadrupled.`

- Before: `(2 × 2) / 2 = 2`.
- After: `(4 × 4) / 2 = 8`.
- `Both the width and the height doubled, so the area became four times as large.`

Incorrect headline: **`Not quite. The area actually quadrupled.`** Then show the same calculations/explanation.

**`y = x²` — correct:** `Correct! The area increased eightfold.`

- `The width doubled from 2 to 4.`
- `But for y = x², doubling x makes the corresponding height four times as large.`
- `So the whole region is twice as wide and four times as tall: 2 × 4 = 8.`
- `The area is eight times as large.`

Incorrect headline: **`Not quite. The area actually increased eightfold.`** Then show the same explanation.

**Do not** show numerical values `8/3` or `64/3` in this stage: Stage 4 is where the division by 3 acquires its meaning.

### Transition to Stage 4

Following feedback: **`We've seen how differently the areas grow. Next, we'll see why we divide by 2 or 3 when calculating them.`** Keep this short and within the one-screen design.

## 4. Why do we divide? — entirely new approved stage

**Purpose:** Give an intuitive geometric reason for the coefficient in `b²/2` and `b³/3`, without a mandatory theoretical derivation.

### Common composition

- Title: **`4. Why do we divide?`**
- Two directly visible tabs: **`y = x`** / **`y = x²`**. Initial selection: **`y = x`**.
- In both modes, fixed right boundary **`b = 3`**, left boundary 0; keep graph in same place and show its enclosing rectangle (width `b`, height `b` or `b²`).
- Use a consistent horizontal scale; adapt and clearly label vertical scale for height 3 versus 9.
- The lower portion of this **same screen** changes by mode. No full-page substage, mandatory progression or assessment.
- Next is never gated on tab use or slider count.

### Mode 1: `y = x` (initial)

Exact instruction: **`The diagonal cuts the rectangle in half. Then tap y = x² to compare.`**

- The diagonal of the enclosing rectangle is visible, splitting it into two equal triangles. Shade the triangle under the line.
- Whole enclosing rectangle: `3 × 3 = 9`.
- Shaded triangle: `1/2 × 9 = 4 1/2`.
- Main formula, typeset: **`Area = b² / 2`**.
- **No rectangle-width slider** in this mode: half the rectangle is already obvious.

### Mode 2: `y = x²`

Exact instruction: **`Move the slider towards Narrower. Watch the two area estimates get closer.`**

- The enclosing rectangle is width 3, height 9, area **27**.
- Its curved portion is shaded. Show *both* lower and upper right/left endpoint rectangle constructions without a second selector. On this increasing function: lower rectangles are left-endpoint and upper rectangles right-endpoint; visually distinguish them with restrained fills/outlines.
- One slider labeled **`Rectangle width`**, with ends **`Wider`** and **`Narrower`**. Six stops for counts **4, 8, 16, 32, 64, 128**, initially **4** on first entry. Display count as `N rectangles`.
- Below graph, compact side-by-side live outputs: **`Estimate from below`** and **`Estimate from above`**. Use one decimal, explicitly estimates rather than exact values.
- At 4 rectangles, values are approximately **5.9** and **12.7**; at 128, **8.9** and **9.1**. Their approach towards **9** makes the one-third relationship intelligible.
- Exact visible conclusion: **`The estimates approach 9. That's one-third of the whole rectangle, which has area 27.`**
- Main formula, typeset: **`Area = b³ / 3`**.
- Final observation in the quadratic mode: **`Notice the pattern: the power increases by one, and we divide by that new power.`** This is an observed pattern here, **not a proof for every power**.
- No Reveal button; result remains visible during exploration. Do not falsely present finite estimates as an exact proof.

### Optional anchored tooltip (only in quadratic mode)

Trigger text: **`Why exactly one-third?`**

Approved concise content:

> The rectangles suggest that the area is one-third of the whole rectangle. Differentiation confirms it.
>
> The area grows at a rate equal to the graph's height, `b²`:
>
> `d/db (b³/3) = b²`
>
> Since the area starts at zero, its exact value is `b³/3`.
>
> We'll explore this connection in another lesson.

Typeset the derivative and fractions. Tooltip is dismissible and anchored; it **must not grow the page or become a compulsory second lesson**.

**Transition meaning:** The area formula from zero is now known geometrically. Stage 5 changes the starting boundary.

## 5. Changing the area — former Stage 4, approved update

**Purpose:** Find the area under `y = x` from `a = 1` to a movable `b`, by subtracting the excluded triangle. Tie the *fixed* exclusion to a specific integration constant.

### Initial state and graph

- Title: **`5. Changing the area`**.
- Exact opening: **`We've found the area starting at 0. But what if we start at 1 instead?`**
- `y = x`; fixed left boundary **`a = 1`**, movable right boundary **`b = 4`** initially.
- Shade two distinct regions: small triangle from zero to one labeled **`Area left out`**, and region from one to `b` labeled **`Area we want`**.
- Both `a = 1` and `b = ...` must be visibly and correctly located below the graph; no label collisions.
- Primary instruction near the control: **`Move the right boundary and watch how the area changes.`**
- Drag the right boundary directly on the graph or with a slider. Movement is continuous **during dragging**, then snaps smoothly to the nearest integer **on release only in this stage**. Range `1 ≤ b ≤ 4`.

### Initial calculations: three linked explanations, vertically stacked

1. **`First, the whole triangle from 0 to 4 has area:`** `(4 × 4) / 2 = 8`.
2. **`But we start at 1, so we leave out this small triangle:`** `(1 × 1) / 2 = 1/2`.
3. **`So the shaded area we want is:`** `8 − 1/2 = 7 1/2` square units.

Retain the causal `But` and `So`, and place each equation with the sentence it explains. Never squeeze these into illegible side-by-side mini-panels.

### Interactive numeric contract

| b (settled) | Whole triangle | Fixed area left out | Area wanted |
|---|---:|---:|---:|
| 1 | 1/2 | 1/2 | 0 |
| 2 | 2 | 1/2 | 1 1/2 |
| 3 | 4 1/2 | 1/2 | 4 |
| 4 | 8 | 1/2 | 7 1/2 |

During fractional-value dragging, don't report rounded whole-number `b` while calculating using the fractional boundary. Display the actual current preview consistently; use exact mixed fractions at settled integer boundaries.

### Constant of integration: main copy and tooltip

Main text, visible—not hidden in the tooltip:

**`The small triangle always has area ½. So we always subtract ½. This gives us a constant of integration, C = −½.`**

Make **`constant of integration`** the clickable trigger; the fixed term `C = −1/2` stays visible.

Tooltip heading: **`Why is it a constant?`**

> The starting point stays at 1, so we always leave out the same area.
>
> That makes −1/2 a fixed term in our area formula:
>
> `A(b) = b²/2 − 1/2`
>
> A different starting point would give a different constant.

This is the particular integration constant ensuring `A(1) = 0`, not a claim that all antiderivatives of `x` use `C = −1/2`.

### Transition

If space permits without crowding: **`Now we can measure an area between two boundaries. Next, we'll measure the area between two curves.`** Otherwise let the Stage 6 title and its explicit instruction carry the transition; do not add a large extra panel.

## 6. Area between curves — former Stage 5, approved update

**Purpose:** Replace a single graph height with the **vertical gap between two selected curves**, and explore how geometric area changes when a boundary moves.

### Screen, functions and initial state

- Title: **`6. Area between curves`**.
- Exact instruction: **`Choose two curves, then move the right boundary b. Watch how the shaded area between a = 1 and b changes.`** Typeset `a`, `b` as maths.
- Function options: **`y = x`**, **`y = x² − 3x`**, **`x-axis (y = 0)`**.
- Initially First curve = `y = x`, Second curve = `y = x² − 3x`.
- Fixed `a = 1`; initial `b = 3`; continuous range **`1 ≤ b ≤ 4`**.
- Initial area is **`7 1/3 square units`**.
- Keep the relevant curves, x-axis, active region, and clearly placed `a = 1`, `b = ...` boundary labels visible. Include enough vertical range below the x-axis for the negative parabola.

### Final, explicitly approved control arrangement

**This supersedes the intermediate proposal of horizontal selectors and a full-width slider.**

- Below graph, **two curve selectors stacked vertically on the LEFT**, each labeled **`First curve`** / **`Second curve`**.
- **Right-boundary slider on the RIGHT**, with most of the horizontal width (approximately **60% slider / 40% selectors**, flexible to keep full function names legible). Label **`Right boundary: b`**, show the current value and end labels **1** / **4**.
- Spatial meaning: two curve selectors echo the graph's two functions; a slider on the right echoes movement of the **right** boundary.
- Preserve comfortable touch targets and do not truncate `y = x² − 3x`.
- Keep direct boundary dragging on the graph, also continuous, **without snapping**.
- “First” and “Second” remain neutral names: selections may be reversed and curves may exchange top/bottom order.

### Strip-height annotation and main explanation

- Replace the old thick, capital-I-shaped height marker with a **thin, double-headed vertical arrow**. Its ends stop slightly short of the selected curves, and **`h(x)`** sits unobtrusively beside it.
- Place the arrow where the selected curves are clearly separated, not on a label or boundary. Remove it when curves are identical or the interval collapses to zero.
- Default explanation: **`At any position x, the strip's height h(x) is the vertical distance between the two curves.`**
- For default pair display, typeset: **`h(x) = x − (x² − 3x) = 4x − x²`**.
- Display **`Shaded area: 7 1/3 square units`** initially.
- For other pairs, compute height from **higher minus lower at each x**, not from fixed selector order. Do not leave a formula on-screen that becomes negative on part of the selected interval.

### Curve crossing and edge cases

- A non-negative **geometric** area is required. If the selected parabola and x-axis cross at `x = 3` and `b > 3`, add the areas on both sides; do not subtract one shaded lobe from the other.
- In that case substitute this concise contextual explanation for the ordinary height explanation: **`The curves cross at x = 3. The curve on top changes there, so we add the areas on both sides.`**
- The graph/height arrow must reflect correct local upper/lower ordering. A full piecewise integral is **not** permanently displayed on the main screen.
- Same-curve pair is **valid**: no shaded region, no height arrow, area zero, and text **`The two curves are the same, so there is no gap between them. The shaded area is 0.`**
- `b = 1` is a valid zero-width area of zero, not an error.
- Reverse selector ordering leaves the same area and shading.
- No Check button, no grading of curve choices, no input and no blocking progress.

### Exact verification values

| Selected pair | Area from 1 to 3 | Area from 1 to 4 |
|---|---:|---:|
| `y = x` and `y = x² − 3x` | `22/3 = 7 1/3` | `9` |
| `y = x` and x-axis | `4` | `15/2 = 7 1/2` |
| `y = x² − 3x` and x-axis | `10/3 = 3 1/3` | `31/6 = 5 1/6` |
| Same function twice | `0` | `0` |

**Transition meaning:** Stage 6 provides the strip height and area automatically; Stage 7 asks students to calculate it themselves.

## 7. Choose and calculate an area — former Stage 6, approved update

**Purpose:** One coherent, single-screen activity: choose the two curves, choose the interval, evaluate the integral. **Only the numerical area calculation is assessed.**

### Mandatory one-screen structure

1. Title + one short instruction.
2. Main graph and shading.
3. **`Choose what area to measure`** — two curve selectors on **one horizontal row**.
4. **`Choose where to measure`** — three equal-width interval choices on **one horizontal row**.
5. **`Calculate the area`** — generated integral, one numeric answer input and **`Check calculation`** button.
6. Inline feedback, optional anchored hint, and normal **Previous / Finish** navigation.

**Never** split these three sections into full-page internal steps. Do not introduce extra Next buttons.

### Exact opening and graph

- Title: **`7. Choose and calculate an area`**.
- Instruction: **`Choose two curves and an interval. Then calculate the shaded area.`**
- Functions in both dropdowns: **`y = 9 + 2x`**, **`y = 3x²`**, **`x-axis (y = 0)`**.
- Initial First curve = `y = 9 + 2x`; Second curve = `y = 3x²`; interval **From 1 to 2**. Correct initial area is **5**, but **do not display the numeric answer before an answer is checked**.
- Show the actual region **strictly between the selected curves**, not down to the x-axis. Keep unused functions subdued but visible for context; emphasize the selected pair.
- Correct labels: `y = 9 + 2x` above the straight line on the upper-left; `y = 3x²` near the middle part of the parabola, not on the straight line; `h(x)` beside the approved thin, double-ended vertical distance arrow; `a` and `b` at the selected interval boundaries **below** the x-axis with enough clearance.
- No oversized draggable-looking boundary handles and **no graph dragging**. Interval buttons control the endpoints.
- Identical selected curves: zero gap, no filled region and no height arrow.

### Free choice 1: curves

Heading: **`Choose what area to measure`**.

Two selectors side by side: **`First curve`** and **`Second curve`**, each offering all three functions including the same curve. Selecting either curve, in any order, is a **free choice**, not a scored response.

### Free choice 2: interval

Heading: **`Choose where to measure`**.

Three radio-like buttons, default second:

- **`From 0 to 1`**
- **`From 1 to 2`** — initial
- **`From 0 to 2`**

Changing an interval updates the boundary guides, shaded region and integral immediately. Do not add sliders or draggable limits here.

### Assessed task: calculation

Heading: **`Calculate the area`**.

Immediately present the correct, dynamically generated definite integral for the chosen curve pair and interval, but **not its evaluated numeric answer**. Initial displayed integral:

`∫₁² (9 + 2x − 3x²) dx`

Below: input labeled **`Your answer`** and button **`Check calculation`**. The generated expression uses the actual **upper minus lower** curve; never use selector order to produce a negative area.

Validation and exact wording:

- Correct: **`Correct! The shaded area is 5 square units.`** (5 replaced with the current selection's correct value).
- Incorrect: **`Not quite. Try calculating the area again.`**
- Empty: **`Enter an area before checking.`** Empty does not count as a checked numerical answer and does not enable Finish.
- On a checked incorrect numerical answer, show clickable **`Show hint`**, anchored and dismissible without increasing page height.
- Different curves hint: **`Find an antiderivative of the expression inside the integral. Substitute the upper limit, then subtract the result at the lower limit.`**
- Identical curves hint: **`The two curves are the same, so the height between them is 0 everywhere.`**
- Student can edit and recheck. **Finish becomes available after any checked numerical answer, including an incorrect one.** Never require correctness.
- Changing either curve or the interval clears the previous answer, old feedback and open hint, and disables Finish until checking a new numerical answer.

### Mathematical truth table (all exact integers)

| Selected pair | From 0 to 1 | From 1 to 2 | From 0 to 2 |
|---|---:|---:|---:|
| `y = 9 + 2x` and `y = 3x²` | 9 | **5** | 14 |
| `y = 9 + 2x` and x-axis | 10 | 12 | 22 |
| `y = 3x²` and x-axis | 1 | 7 | 8 |
| Same curve twice | 0 | 0 | 0 |

The curves do not cross one another in `0 ≤ x ≤ 2` (apart from possible axes at an endpoint), so this final assessment does not require piecewise integration. Correct expressions for distinct pairs are `9 + 2x − 3x²`, `9 + 2x` and `3x²`; identical-pair integrand is `0`.

### Finish recap

After the student presses Finish, present a compact completion recap containing:

- Chosen two curves and interval.
- Strip height/integrand for that region.
- The chosen definite integral.
- Correct geometric area.
- If the submitted answer was incorrect, **their submitted answer as well as the correct area**.

The recap does **not** mark the free curve or interval selections as correct/incorrect. The existing completion pattern may be used; this is not a new assessed screen.

## C. Continuity, invariants and approval checks

### Conceptual transitions

- **1 → 2:** From an exact rectangle to estimating area under a varying height.
- **2 → 3:** From estimating a fixed area to seeing how the accumulated area changes as the boundary expands.
- **3 → 4:** From scaling factors (2, 4, 8) to fractions of enclosing rectangles (1/2, approximately approaching 1/3).
- **4 → 5:** From knowing the formula when measurement starts at 0 to subtracting a fixed area when it starts at 1.
- **5 → 6:** From subtracting an excluded region to finding strip heights by subtracting two function values.
- **6 → 7:** From watching the app shade/calculate an area to choosing a region and evaluating the integral independently.

### Layout/control coherence

- Stage 6 deliberately uses **vertically stacked curve selectors LEFT plus slider RIGHT** (because the right-hand position reinforces a right boundary), whereas Stage 7 uses **two selectors in a horizontal row** (because its interval choices occupy the following row). The vocabulary, selector contents and upper/lower mathematics remain consistent even though placement differs. This *final* decision supersedes an intermediate proposal to make both layouts identical.
- `a`/`b` describe **boundary positions**, not arbitrary coordinate labels. `h(x)` is the *vertical distance* between chosen curves.
- Stage 3's function comparison has only one question per selected graph; Stage 4's fraction comparison has no graded question; Stage 5's constant is visible, not exclusively in a tooltip; Stage 6's exploration has no graded selections; Stage 7 grades only the entered area.
- The quadratic one-third is *supported* by convergent estimates; exactness is addressed only in the optional short tooltip and may be developed in a future card.

### Numerical review

- Stage 3: `y = 2`: 4 → 8 (×2); `y = x`: 2 → 8 (×4); `y = x²`: 8/3 → 64/3 (×8, but **do not show those numbers in Stage 3**).
- Stage 4: With `b=3`, rectangle areas 9 and 27, target areas 4.5 and 9; the lower/upper sums with four rectangles are ~5.906/~12.656, and with 128 are ~8.895/~9.106.
- Stage 5: `A(b) = (b² − 1)/2` for `1 ≤ b ≤ 4`, so `C = −1/2` for this accumulated-area function.
- Stage 6: Geometry requires `∫ |f − g| dx` in the presence of crossings; values in Stage 6 table verified by splitting at `x=3` where needed.
- Stage 7: Truth table follows exact antiderivative evaluations; initial integral gives 5.

### Remaining non-design work / implementation QA

These are *not* unresolved teaching decisions; they are fidelity and technical verifications for the later Codex handover:

1. Inspect the actual repository for current Stage 1–2 exact approved copy, controls and existing state lifecycles; preserve them.
2. Confirm existing Stage 3's actual animation delay before adding the agreed two seconds; do not hard-code an invented starting delay.
3. Check real mobile rendering, including the most verbose text, wrapped function names, math typesetting, keyboard/focus behaviour and feedback on a physical or equivalent iPhone viewport.
4. Confirm exact-versus-rounded area values and slider/drag readouts are self-consistent at every stage.
5. Test crossings, reversed selectors, identical-curve selections, zero-width regions, input resets, incorrect-answer Finish and navigation/state restoration.
6. Update the repository's durable experience specification and Approval B fidelity report after implementation; do not claim Approval B until reviewed on the user's phone.

**Implementation discipline to carry into a *separate* Codex prompt:** Codex should read the design and engineering guides; implement these locked educational choices faithfully; decide technical means using the actual repo; identify genuine ambiguities as questions; limit risky cross-stage component changes; run appropriate checks; provide actual mobile evidence; and **not commit or push without explicit request**.
