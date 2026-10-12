# Card 1 — Roots and Factors: Architecture and Implementation Plan

Status: Stage 3 plan, awaiting explicit implementation approval.

Branch: `feat/step-visuals` only.

Feature boundary: `src/app/step-visuals/`.

This document consolidates the three supplied mathematics documents, the Stage 1 repository review, the Stage 2 comparison with Antigravity, and the user's agreed v1 decisions. It authorizes no implementation, installation, deployment, or changes to existing application source. Saving this plan at the requested documentation path is an explicit exception to feature-folder containment.

## 1. Scope and agreed decisions

Build one independently reusable mathematical activity, its static sparkline companion, and an isolated development lab at `/step-visuals`.

The learning objective is that a root at `x = r` corresponds to the factor `(x − r)`, because that factor evaluates to zero at the root. The reference family is `f(x) = (x − 1)(x − r)`, initially `r = 3`.

The agreed v1 experience is:

1. Explore integer roots in `[0, 5]` for as long as desired; explicitly proceed to prediction.
2. Predict the factor corresponding to root `−3`.
3. Move the root to `−3` and inspect the factor and substitution explanation.
4. Place a root for target factor `(x + 4)` and press **Check**.
5. After the first incorrect Check, optionally open **Show explanation**, then continue attempting the challenge.
6. Complete only after Check at `−4`, recording independent or assisted success internally.
7. Optionally keep exploring with the full integer range `[-5, 5]`.

There are no stage-skipping actions in v1. Normal exit remains available. Exam-question navigation is absent. Opening/dismissing the lab menu preserves the mounted activity; leaving the experience and returning starts again.

The lab has exactly two navigation levels: expandable card headings and their implemented child experiences. Card 1 has **Interactive visualisation** and **Sparkline preview**. The preview shows all three variants together. Unimplemented Card 2 and later experiences are not rendered as usable entries.

All implementation source, styles, mathematical helpers, tests, fixtures and lab configuration stay inside the feature folder. No application-specific components, gestures, layouts, types, APIs, data models or state managers outside it may be imported. No authentication, persistence, database, analytics events or card/deck integration is introduced.

## 2. Architectural principles and purposeful boundaries

The processing contract is:

```text
Mathematical state + lesson state + active edit + dimensions/configuration
    -> pure presentation policy
    -> composed D3-backed layouts
    -> plain component-specific scene data
    -> declarative React rendering

Platform input
    -> platform measurement/coordinate adapter
    -> pure interaction calculation
    -> semantic activity action
    -> pure reducer
```

React owns semantic state and rendering. D3 supplies scales, ticks, sampling utilities and path preparation; it never creates, selects or mutates rendered elements. All mathematical analysis, formatting, geometry and answer assessment live in pure processing modules, not JSX or event-handler arithmetic.

D3-backed functions may compose ordinary pure helpers for polynomial evaluation, factor formatting, validation, snapping and lesson predicates. D3 has no polynomial or pedagogy engine, so these operations do not require artificial D3 calls. Layout functions are deterministic `const` functions, construct/configure D3 objects locally, and return immutable results.

The useful abstractions established now are:

- A platform-independent activity reducer and mathematical model.
- Read-only, plain-data projection and scene contracts.
- Semantic input actions independent of browser events.
- Compositional layouts for meaningful graphical and text components.
- A presentation frame with ordinary slots, independent of lab navigation.
- A browser adapter separated from mathematical coordinate calculations.
- Independent activity and sparkline public entry points.

These support later cards and a React Native port without building native infrastructure now. There is no universal lesson-authoring framework, scene-language interpreter, complex-number engine, global store, camera implementation or integration adapter.

## 3. Component hierarchy and responsibilities

```text
StepVisualsPage — small Next route entry
└── StepVisualsLab — selected experience and menu state
    ├── LabHeader — burger button and selected experience label
    ├── LabNavigationDialog
    │   └── CardDisclosure[]
    │       └── ExperienceButton[]
    └── ExperienceHost — mounting/session boundary
        ├── RootsFactorsActivity
        │   └── ActivityFrame
        │       ├── activity heading / optional exit action
        │       ├── MeasuredGraphSurface
        │       │   └── MathGraph
        │       │       ├── CoordinatePlane
        │       │       ├── FunctionPlot
        │       │       └── RootMarkerGroup
        │       ├── FactorExpression
        │       ├── RootAdjustmentControls
        │       └── ActivityPrompt
        └── SparklinePreview
            ├── PairedRootsSparkline — complete
            ├── PairedRootsSparkline — graphics-only
            └── PairedRootsSparkline — notation-only
```

| Component | Responsibility |
| --- | --- |
| `StepVisualsLab` | Select experiences, maintain disclosure/menu state, allocate host space. No mathematical or lesson state. |
| `LabNavigationDialog` | Accessible modal navigation, disclosures, focus containment and return. |
| `ExperienceHost` | Preserve an instance on menu open/close; replace it on an actual experience change. |
| `RootsFactorsActivity` | Own reducer, compose layout inputs, route semantic actions and optional exit. |
| `ActivityFrame` | Mobile screen composition from supplied content slots. No FSM or burger dependency. |
| `MeasuredGraphSurface` | Measure available content space through the web adapter. No polynomial calculations. |
| `MathGraph` and layers | Render prepared SVG scene data and connect root input. No evaluation, formatting, masking decisions or scale mutation. |
| `FactorExpression` | Render prepared mathematical tokens and descriptions. |
| `RootAdjustmentControls` | Render prepared left/right controls and position readout; dispatch committed placements. |
| `ActivityPrompt` | Render a small typed prompt view model with prepared content and semantic actions. |
| `PairedRootsSparkline` | Render static mathematical snapshots from props. No activity reducer or lab dependency. |

The lab header is exclusively lab-owned and has a compact reserved layout row; the activity receives the remaining space. An independently mounted activity uses the full space supplied by its host. Avoid a second lab toolbar or a burger overlay across the graph. `ActivityFrame` neither imports the lab nor reserves space for a menu it does not own.

The initial selection is Card 1's interactive visualisation. The sparkline preview is a separate mounted experience.

Keep the route entry server-compatible and place client boundaries on the lab/activity entries that use hooks and browser adapters. Portable core modules have no client directive or framework dependency. Confirm the exact boundary rules against the installed Next guides before writing source.

## 4. Pure layout hierarchy

```text
rootsFactorsLayout(effectiveMath, lesson, editStatus, dimensions, config)
├── rootsFactorsPresentation(...) -> permitted controls/content policy
├── graphLayout(...)
│   ├── coordinatePlaneLayout(...) -> projection description, axes/grid/ticks
│   ├── functionPlotLayout(...) -> finite curve path and clipping bounds
│   └── rootMarkerGroupLayout(...) -> markers, labels and hit regions
├── factorExpressionLayout(factors, expressionPolicy)
├── rootAdjustmentLayout(root, bounds, interactionPolicy)
└── activityPromptLayout(lesson, predictionEvaluation, assistanceEvaluation)

pairedRootsLayout(snapshotInputs, dimensions, variant)
├── coordinatePlaneLayout(..., compact policy)
├── functionPlotLayout(...)
├── rootMarkerGroupLayout(..., static policy)
└── factorExpressionLayout(..., static correspondence policy)
```

`rootsFactorsLayout` coordinates sublayouts rather than implementing their internals. Meaningful composites have named pure preparation functions, but related small functions may share a file. Primitive circles/lines consume prepared coordinates without unnecessary wrappers.

Mathematical helpers know factor meaning, polynomial evaluation and valid values. Card 1 policy knows stages, masking, instructional ranges and assistance. Component layouts prepare geometry, tokens, labels and actions. Renderers know markup and local styles.

Generic graph code accepts an evaluator and projection description rather than a Card 1 state object. Generic expression preparation accepts factors and explicit display policy rather than inspecting an activity stage. Prompt preparation is Card 1-specific, while its renderer supports the small set of actual content blocks used here. Do not build a generic content DSL.

CSS/native screen composition is distinct from mathematical layout. The former places graph/expression/prompt regions; the latter maps mathematical values into a measured plot rectangle.

## 5. Typed contracts

The following are design contracts, not an implementation. Names may be adjusted without changing ownership or semantics.

### Mathematical and interaction inputs

```ts
type RootInteger = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;
type Bounds = readonly [number, number];
type Size = Readonly<{ width: number; height: number }>;
type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

type Card1Math = Readonly<{ movingRoot: RootInteger }>;

type RootEdit =
  | Readonly<{ kind: "idle" }>
  | Readonly<{
      kind: "pointer";
      sessionId: number;
      candidateRoot: RootInteger;
    }>;

type LinearFactor = Readonly<{ id: string; root: number }>;
// A factor with root r means x - r. Presentation flags are separate.

type ProjectionSpec = Readonly<{
  xDomain: Bounds;
  yDomain: Bounds;
  xRange: Bounds;
  yRange: Bounds;
  plot: Rect;
}>;

type Affine2D = Readonly<{
  a: number; b: number; c: number;
  d: number; e: number; f: number;
}>;
```

The browser adapter extracts the SVG screen matrix as plain coefficients. Pure interaction helpers invert that mapping and the mathematical projection. Native input can later supply graph-local points directly. No DOM types, D3 setters or React elements enter these portable inputs.

`RootInteger` documents Card 1's finite values; shared graph/factor contracts remain numeric for later activities. Runtime validation still rejects non-finite, out-of-range and invalid external inputs and normalizes negative zero.

### Lesson and assistance contracts

```ts
type PredictionChoice = "x-minus-3" | "x-plus-3";
type PredictionRecord = Readonly<{ choice: PredictionChoice }>;

type RetrievalEvidence = Readonly<{
  incorrectChecks: number;
  assistanceViewed: boolean;
}>;

type SuccessMode = "independent" | "assisted";

type Lesson =
  | Readonly<{ stage: "orientation"; hasChangedPlacement: boolean }>
  | Readonly<{ stage: "prediction" }>
  | Readonly<{ stage: "reveal-position"; prediction: PredictionRecord }>
  | Readonly<{ stage: "reveal-explanation"; prediction: PredictionRecord }>
  | Readonly<{
      stage: "retrieval";
      prediction: PredictionRecord;
      evidence: RetrievalEvidence;
      panel: "challenge" | "explanation";
      feedback: "none" | "try-again";
    }>
  | Readonly<{
      stage: "completed";
      prediction: PredictionRecord;
      successMode: SuccessMode;
    }>
  | Readonly<{
      stage: "free-explore";
      prediction: PredictionRecord;
      successMode: SuccessMode;
      explanationOpen: boolean;
    }>;

type RootsFactorsState = Readonly<{
  math: Card1Math;
  lesson: Lesson;
  edit: RootEdit;
}>;
```

There are no skipped-state variants, navigation evidence stores or scoring UI. Prediction exists in every later stage because v1 requires it. Success mode remains recorded in free exploration; moving the root afterwards does not revoke completion.

### Scene and prompt outputs

Prepare immutable component-specific records:

- `CoordinatePlaneScene`: positioned axis/grid segments and already formatted tick labels.
- `FunctionPlotScene`: path string, clipping rectangle and stroke role.
- `RootMarkerGroupScene`: stable root IDs, marker geometry, hit rectangles, emphasis roles, position labels and accessible slider values/bounds.
- `FactorExpressionScene`: readonly token groups, visible mask state and prepared accessible description.
- `RootAdjustmentScene`: position text, two action descriptors and enabled states.
- `ActivityPromptScene`: a discriminated union for orientation, choices, reveal comparison, retrieval, assistance, completion and exploration.
- `PairedRootsScene`: shared frame geometry and two static snapshot/correspondence scenes.

Use semantic appearance roles rather than CSS class names in portable outputs. Web renderers map them to CSS Modules. Accessible descriptions should be meaningful text, with the web renderer translating them to web attributes and a later native renderer translating them to native properties.

Action descriptors contain a stable semantic action ID, prepared label and enabled state. React connects them to dispatch; it does not compute correctness or stage policy. Disabled controls remain backed by reducer guards.

Unique SVG clip/description identifiers are supplied by the renderer's per-instance ID allocation, never generated randomly inside pure layouts.

A representative plain scene contract is:

```ts
type Segment = Readonly<{ start: Point; end: Point }>;
type PositionedLabel = Readonly<{ position: Point; text: string }>;
type AppearanceRole = "neutral" | "moving-root" | "curve" | "success";

type RootMarkerScene = Readonly<{
  id: "fixed-root" | "moving-root";
  center: Point;
  visibleRadius: number;
  hitRegion: Rect | null;
  role: AppearanceRole;
  positionLabel: PositionedLabel | null;
  interaction: Readonly<{
    enabled: boolean;
    value: number;
    bounds: Bounds;
    accessibleName: string;
  }> | null;
}>;

type GraphScene = Readonly<{
  size: Size;
  projection: ProjectionSpec;
  axes: readonly Segment[];
  grid: readonly Segment[];
  tickLabels: readonly PositionedLabel[];
  curve: Readonly<{ path: string; clip: Rect }>;
  roots: readonly RootMarkerScene[];
  accessibleDescription: string;
}>;
```

Expression and prompt outputs follow the same pattern: plain immutable token/content records with explicit discriminants, semantic roles and action IDs. Do not embed JSX, callbacks or browser objects in them. This is a component contract, not a general-purpose scene interpreter.

## 6. Mathematical model and invariants

Store the settled movable root only. Derive the effective root from the active candidate while editing; otherwise use the settled root. All visual representations use that same effective value.

Derive:

- Factors with stable identities: fixed `(x − 1)` and moving `(x − r)`.
- Evaluation: `(x − 1)(x − r)`.
- Roots: `1` and `r`.
- Vertex: `((1 + r) / 2, −(r − 1)^2 / 4)`.
- Factor notation: `(x − n)`, `(x + n)` for negative roots, `(x)` at zero.
- Prediction substitutions and target-factor substitution through the same pure factor evaluator.

Do not store coefficients, factor strings, root arrays and paths independently in React state. Do not add complex values or multiplicity machinery. Later activities may own coefficient, vertex, real-factor or complex-point models and feed their evaluators/geometry into the same graphical foundations.

At `r = 1`, the function is `(x − 1)(x − 1)`. Keep both factor identities and a composite marker appearance. Do not collapse into squared notation or teach multiplicity. The graph must touch the axis correctly, and the moving handle stays operable.

Bounds and integer validity are enforced in the reducer as well as pure input preparation. A stale input from an old stage cannot use an obsolete range. Invalid actions are harmless; they cannot corrupt mathematical state.

## 7. State transitions and precise learner experience

### Transition table

| Stage | Supported interaction | Advancement |
| --- | --- | --- |
| Orientation | Drag/adjust within `[0, 5]`; live graph and factor. | **Ready to predict**, after one changed committed placement. |
| Prediction | Two factor-choice buttons; root locked. | First valid choice -> reveal positioning. |
| Reveal positioning | Drag/adjust within `[-5, 5]`; selected prediction retained. | Committed placement at `−3` -> explanation. |
| Reveal explanation | Stable root/curve at `−3`; comparison and zero-substitution reason. | **Continue** -> retrieval. |
| Retrieval challenge | Drag/adjust within `[-5, 5]`; changing factor masked. | **Check** at `−4` -> completed; otherwise supportive retry feedback. |
| Retrieval explanation | Worked explanation for target `(x + 4)`; root adjustment temporarily locked. | **Try again** -> challenge at the preserved position. |
| Completed | Stable success and summary; root locked. | **Keep exploring** -> free exploration. |
| Free exploration | Full range, live factor, optional **Why?** explanation. | No further completion transitions. |

The orientation button is never activated automatically. Enabling it after one changed placement establishes that the first interaction occurred without imposing a timer, movement count or exploration duration. This is the plan's concrete readiness rule for approval, based on the Stage 2 recommendation; it is not an additional automatic transition. Exit is available throughout.

### Orientation and prediction

Start at `r = 3`, show the factorised expression, and explain the initial range with compact wording such as **Explore roots from 0 to 5**. Dragging or a visible adjustment button counts equally. A press/release at the same position does not unlock readiness. Cancelled previews do not count.

Prediction asks what factor corresponds to root `−3`, with large options `(x − 3)` and `(x + 3)`. Record the exact choice. Both choices produce the same neutral next instruction: **Now move the root to −3 to check.** Do not announce correctness yet.

### Reveal

Moving through `−3` does not advance; a committed placement does. Process the final release coordinates before evaluating that placement. Discrete adjustment buttons and keyboard changes are intentional committed placements and follow the same rule.

At `−3`, lock the root and use a reserved explanation area. The main equation shows `(x − 1)(x + 3)`.

For a correct prediction, briefly confirm the match and show `−3 + 3 = 0`. For an incorrect prediction, prepare both rows:

| Meaning | Substitution at `−3` |
| --- | --- |
| Your choice `(x − 3)` | `−3 − 3 = −6` |
| Matching factor `(x + 3)` | `−3 + 3 = 0` |

Both branches explain: **At the root, the factor must equal zero.** The identity `x − (−3) = x + 3` may be included if it remains compact. The longer incorrect branch sets the normal panel-space requirement. No harsh failure screen, timed progression or layout jump is introduced.

### Retrieval and optional assistance

Start retrieval from the demonstrated position `−3`. Show **Place the root for the factor `(x + 4)`**, plus **Check**. The current position remains visible and accessible. The changing factor is explicitly masked rather than frozen at an old, mathematically false value.

Mask the factor in all answer-bearing channels: visible equation, SVG descriptions, accessible names, hidden text, titles and live announcements. The target itself and coordinate controls remain available. Do not place a sparkline hint beside the challenge.

Check is accepted only in the challenge panel with no active edit. Passing through or releasing at `−4` never completes. Incorrect Check increments `incorrectChecks` and shows concise feedback such as **Not yet. Try another position.** It also makes **Show explanation** available.

Opening assistance sets `assistanceViewed = true`; merely offering it or making an incorrect attempt does not. Show a compact worked explanation for this target:

```text
The factor must equal zero:
x + 4 = 0, so x = −4.
Check: −4 + 4 = 0.
```

Replace content within the existing prompt region, temporarily lock root adjustment, and offer **Try again**. Do not automatically move the root, submit an answer or mark success. Returning restores the masked challenge at the preserved current position. Assistance remains reopenable after it first becomes available.

On Check at `−4`, success mode is `assisted` if assistance was actually opened, otherwise `independent`. Multiple wrong attempts alone do not make success assisted. Display the same clear success experience in both cases, without score labels:

- **Activity complete**.
- **Yes — `(x + 4) = 0` when `x = −4`.**
- **A root at `x = r` gives a factor `(x − r)`.**
- **Keep exploring** and normal exit, with no exam action.

### Reducer actions and guards

The action vocabulary covers `ROOT_EDIT_STARTED`, `ROOT_EDIT_PREVIEWED`, `ROOT_EDIT_COMMITTED`, `ROOT_EDIT_CANCELLED`, `ROOT_PLACED`, `READY_FOR_PREDICTION`, `PREDICTION_SUBMITTED`, `CONTINUE_TO_RETRIEVAL`, `CHECK_RETRIEVAL`, `SHOW_RETRIEVAL_EXPLANATION`, `RETURN_TO_RETRIEVAL`, `KEEP_EXPLORING`, and opening/closing exploration explanation.

Session-bound actions require the active session ID. Commit carries the final candidate atomically. Cancel discards the candidate without changing settled mathematics. Discrete placements are rejected while a pointer edit owns the control. Prediction is processed once. Assistance cannot open before an incorrect Check. Check cannot occur in another stage/panel, during a drag, or from stale UI. Cosmetic animations never unlock stages.

Exit is a platform/host navigation action, with edit teardown; it is not a fabricated completion. There are no skip actions.

## 8. Touch, keyboard and platform adapter

### Browser input

Use local React Pointer Event handlers and capture on a stable root hit element. The browser adapter owns pointer ID, capture references, gesture session and raw-coordinate bookkeeping. It does not own a second root value or lesson state.

On pointer-down:

1. Validate allowed interaction, primary contact/button and absence of another owner.
2. Read the current SVG screen matrix and measured projection inputs.
3. Purely invert coordinates and calculate a mathematical grab offset.
4. Acquire capture; start a semantic transaction only when the input boundary is valid.

On movement, run pure inverse mapping, offset, bounds and nearest-integer snapping. Dispatch a preview only when the snapped candidate changes. Use absolute positions, never accumulated `movementX`. Normalize negative zero and specify deterministic symmetric half-step rounding.

On release, calculate the final value from the release event and commit once. On cancellation, unexpected lost capture, resize, suspension or unmount, discard the transaction. Clear ownership before releasing capture so the resulting lost-capture notification cannot undo an intentional commit. Reject null/singular matrices and zero/invalid dimensions safely.

Treat a dimension revision during dragging as cancellation rather than trying to change scales under the finger. Late events from the cancelled session are ignored. Multi-touch never steals the root or becomes a different gesture. A ref supplies immediate pointer ownership; reducer session checks remain authoritative.

Use `touch-action: none` narrowly on the handle/hit surface, not the entire document or screen. Decorative marker children do not intercept events. Browser pinch magnification and ordinary scrolling outside that target remain available. Do not modify viewport zoom settings.

### Keyboard and non-drag controls

The movable root is focusable with slider semantics, prepared current/min/max values and an accessible name. Left/right arrows adjust one integer; Home/End use the current allowed bounds. These are discrete committed placements; they never submit retrieval. Prediction and Check are ordinary buttons activated by standard keyboard behaviour.

Visible left/right adjustment controls are part of the normal phone UI, each at least 44 CSS pixels. They use the same placements and bounds as the handle, disable at bounds or locked stages, and provide a non-drag single-pointer alternative. No equation-entry field or on-screen keyboard is needed.

At coincidence, render a neutral fixed-root ring and distinct moving marker; only the movable marker has a hit region. Keep root identity stable across stages. Preserve focus when values change and never use changing numeric values as component keys.

### Lifecycle and accessibility

Permit effects only for genuine platform work: measurement/observer cleanup, visibility/focus cancellation, dialog/focus management and teardown. Do not use effects to derive paths, factors, masks, correctness or stages. No animation completion is required for progression.

Use visible focus, text/shape cues in addition to colour, and reduced-motion-aware CSS feedback. Announce stage instructions and submitted outcomes without flooding announcements on every pointer movement. Focus should move to the new instruction or primary control when a focused control disappears; passive root movement should not steal focus. Test this with real assistive technology.

## 9. Mobile layout and styling

Phone quality determines the design. Use a compact header, flexible graph, stable expression strip, visible adjustment row and prompt/action region. The original viewport percentages are sketches, not fixed-height rules.

The activity fills its allocated container. `ActivityFrame` uses content-aware CSS grid with a minimum viable graph and space for the longest actual prompt, including incorrect prediction and assistance. At ordinary portrait sizes, prompt changes do not move the graph. Bottom actions are reachable and include safe-area padding.

Measure the graph content box and use corresponding SVG viewBox units so hit sizes reflect actual CSS pixels. Ensure handle targets remain reachable near allowed endpoints. Keep curve clipping separate from the marker/hit layer. Put the root readout above the finger rather than obscured underneath it.

Start design review at phone widths 320, 360 and 390 CSS pixels, including a short 568-pixel viewport, common taller phones, dynamic browser chrome and increased text size. If minimum content cannot fit, allow controlled vertical scrolling; never hide controls or squeeze the graph to zero. Allow readable equation breaks at large accessibility text sizes instead of shrinking text to preserve a rigid line.

On desktop, use the same sequence in a restrained-width frame. Do not add dashboard columns, hover-only controls or laptop-centric settings that compromise the phone layout.

Use feature-local CSS Modules and `spv`-prefixed classes/custom properties. Explicitly style feature typography, background, controls and spacing. Avoid `:global`, global selectors, application CSS variables, body scroll mutations and external portals. The root layout's existing global CSS and Analytics remain inherited environmental dependencies; folder/CSS Module isolation cannot block arbitrary incoming global styles.

## 10. D3 plotting and correctness

Use focused imports from `d3-scale` and `d3-shape`, with existing `d3-array` utilities where useful. No D3 DOM selection, axes rendering, drag, zoom, transition or simulation package is needed.

For the activity, keep mathematical domains fixed at `x: [-6, 6]`, `y: [-10, 10]`. Across the full root range, the vertex is never below `−9`. Roots and minima fit; upper arms may be clipped. Tick density may adapt to available pixels, but the mathematical frame does not auto-scale while a root moves. Show enough integer x-position information to support placement at `−3` and `−4`.

`functionPlotLayout` accepts an evaluator and sampling landmarks, not a Card 1 reducer or universal root model. Uniformly sample approximately 200 points across the domain and include exact roots and vertex, sort and deduplicate, project through local D3 linear scales, and generate a linear D3 path.

For a monic quadratic, interpolation error over spacing `h` is at most `h² / 4` mathematical y-units. Use the projected error to confirm subpixel fidelity at supported sizes; do not treat 200 as a universal quality guarantee for future functions.

Clip the finite path to the plot rectangle. Do not clamp y-values into false horizontal segments or remove arbitrary offscreen points and bridge survivors. Invalid/non-finite evaluations deliberately break a path. At a repeated root the exact vertex sample must touch the axis. Prepared paths contain no `NaN`/`Infinity`.

## 11. Sparkline and three-variant preview

`PairedRootsSparkline` is a static, independently reusable component. Inputs include variant, allocated dimensions and a finite positive magnitude (reference value `3`). It has its own styles and no activity FSM, prediction, assistance, lab selection or retrieval masking.

Construct two mathematical snapshots from the same family:

- Moving root `+3`: `(x − 1)(x − 3)`, vertex `(2, −1)`.
- Moving root `−3`: `(x − 1)(x + 3)`, vertex `(−1, −4)`.

Use the same frame for both, a faint accurate curve, a neutral fixed root and an emphasized moving root. Do not mirror one parabola to fabricate the other. At reference magnitude 3, a compact common frame such as `x: [-4, 4]`, `y: [-5, 5]` contains both vertices/roots. If magnitude is configurable, derive common bounds that contain both snapshots rather than applying those reference bounds blindly.

| Variant | Visible content |
| --- | --- |
| Complete | Paired graphical snapshots and explicit `+3 ↔ (x − 3)` / `−3 ↔ (x + 3)` correspondences. |
| Graphics-only | Same paired graphical snapshots, without visible text/notation. Accessible description remains available. |
| Notation-only | The two explicit root–factor correspondences, without graphs. |

Graphics-only is a learned memory cue, not a standalone explanation of factor signs. Curves establish the quadratic context. All scenes remain static and non-focusable unless the host supplies a separate interaction.

The preview shows all three variants in one vertically arranged phone-friendly page, each labelled outside the component. Initial reference widths around 300–320 CSS pixels and appropriate variant-specific heights are design starting points. Evaluate actual appearance at the agreed visual checkpoint. Do not add a third navigation level or separate variant routes.

## 12. Two-level lab navigation

Use an explicit immutable card/experience registry, with distinct card and experience IDs. Each card contains a flat list of implemented child experiences; no recursive tree type is needed.

```text
Card 1 — Roots and Factors [disclosure]
    Interactive visualisation [experience]
    Sparkline preview [experience]
```

Do not add Card 2 until it has an implemented child. Future single-child cards still use the same two-level disclosure structure.

Render a lab-owned modal navigation dialog inside the feature subtree, with a labelled navigation region. Use native dialog focus/background isolation where supported by the verified target environment. The dialog includes a heading/close button, card disclosure buttons and child experience buttons. This is ordinary navigation with disclosures, not an ARIA menu or tree widget.

- Burger: accessible name, `aria-expanded` and `aria-controls`.
- Card heading: native button with `aria-expanded`/`aria-controls`.
- Child entries: native buttons for local experience selection, with selected state conveyed semantically (for example `aria-current`). They do not navigate to the changing application architecture.
- Tab/Shift+Tab traverse controls; Enter/Space activate disclosures/experiences; Escape dismisses the dialog.
- Collapse removes children from tab order and the accessibility tree; focus cannot remain in hidden content.
- Initially expand Card 1. Preserve disclosure choices during the lab session.
- Dismissal returns focus to the burger. After selecting another experience, focus its heading/entry point without leaving focus in removed content.

The activity stays mounted when the dialog opens. The lab marks its host interaction as suspended using a feature-local presentation context that defaults to active outside the lab. This generic lifecycle boundary contains no selected ID or menu data: it only informs the web adapter that its surface is inactive. The activity cancels an edit on suspension, preserves settled mathematics/lesson state, and blocks inputs while suspended. A later native host can supply an equivalent lifecycle signal without changing the mathematical reducer.

An actual experience change unmounts the old instance and mounts a fresh one. Selecting the already-active entry simply dismisses the menu and preserves it. Returning from Sparkline preview to Interactive visualisation creates the initial activity state. No URL persistence or browser-history contract is introduced.

The lab supplies the activity's exit callback. Exit unmounts the current experience, clears the active selection, and opens navigation. If navigation is dismissed without a selection, show a simple lab-owned **Choose an experience** state. Selecting an experience then mounts a fresh instance. This makes normal exit meaningful without navigating to, or depending on, existing application routes.

## 13. Public interface and React Native portability

Expose `RootsFactorsActivity`, `PairedRootsSparkline` and their small public types from a feature-local public entry point. The lab and reducer internals are not public exports.

An independently mounted activity requires no props:

```tsx
<RootsFactorsActivity />
```

An optional `onExit: () => void` lets a host provide normal exit. Without it, omit a nonfunctional exit button. No next/exam callback is needed in this phase because exam navigation is absent; that capability can be added when integration is requested. The component owns state, configuration and styling, and never imports an application router or domain model.

The host supplies viable layout space. The default frame fills that space; a standalone web host can supply a viewport-sized container. No lab component or lab stylesheet is necessary to mount the activity.

Portable modules have no imports from React DOM, Next, CSS, DOM types or browser APIs. Web rendering, measurement, events, focus and dialog behaviour are in the platform layer. A native port can retain math/reducers/policy/D3 layouts and substitute measurement, gesture adapters, text/buttons and SVG primitives.

For future zoomable activities, mathematical state and view/camera state remain separate. A pure camera function can update visible domains before the usual layouts. Card 1 builds no camera or pinch controller. D3 zoom could be evaluated as a browser input adapter later, but its element-owned transform must not become a second untracked camera owner.

A native high-frequency gesture loop may be justified for camera motion after profiling. It must have one active owner, explicit initial/final snapshots, revision checks and cancellation/commit handoff. Do not assume D3 closures or arbitrary layout functions run in native worklets. No Reanimated, native gesture library or native renderer is installed now. Root, expression and curve must never drift into independently controlled states.

## 14. Proposed feature-local structure

```text
src/app/step-visuals/
├── page.tsx
├── public.ts
├── lab/
│   ├── StepVisualsLab.tsx
│   ├── LabNavigationDialog.tsx
│   ├── experienceRegistry.ts
│   ├── SparklinePreview.tsx
│   └── Lab.module.css
├── activities/roots-factors/
│   ├── RootsFactorsActivity.tsx
│   ├── state.ts
│   ├── reducer.ts
│   ├── presentation.ts
│   ├── layout.ts
│   └── RootsFactorsActivity.module.css
├── core/
│   ├── math/realFactors.ts
│   ├── graph/types.ts
│   ├── graph/coordinatePlaneLayout.ts
│   ├── graph/functionPlotLayout.ts
│   ├── graph/rootMarkerGroupLayout.ts
│   ├── interaction/rootInteraction.ts
│   ├── expressions/factorExpressionLayout.ts
│   └── sparklines/pairedRootsLayout.ts
├── platform/web/
│   ├── measurement.ts
│   ├── useRootPointer.ts
│   ├── SurfaceLifecycle.tsx
│   ├── ActivityFrame.tsx
│   ├── Graph.tsx
│   ├── FactorExpression.tsx
│   ├── RootAdjustmentControls.tsx
│   ├── ActivityPrompt.tsx
│   └── MathUI.module.css
├── sparklines/
│   ├── PairedRootsSparkline.tsx
│   └── Sparkline.module.css
└── tests/
    ├── playwright.config.ts
    ├── math.spec.ts
    ├── layout.spec.ts
    ├── flow.spec.ts
    ├── input.spec.ts
    ├── lab.browser.ts
    ├── activity.browser.ts
    ├── snapshots/
    └── .gitignore
```

`activityPromptLayout` and adjustment preparation can initially live in the activity layout module; graph primitives can share `Graph.tsx`. Split by responsibility when useful, not mechanically by function count. All imports between these files are feature-local relative imports. Do not add files under existing `src/components`, `src/lib`, `src/mocks` or shared configuration directories.

## 15. Automated and manual validation

Use existing Playwright tooling for pure assertions and browser tests. No new Jest, React Testing Library or Cypress is required. Feature-local config explicitly scopes discovery and separates pure tests from browser projects. Keep fixtures, baselines and output rules local. No broad imports through the public React entry point in pure tests.

### Automated coverage

| Area | Required evidence |
| --- | --- |
| Mathematics | Every root integer; correct sign/zero notation; both roots evaluate to zero; vertex; coincidence; finite-input guards. |
| Layout | Projection/inversion round trips; finite paths; exact roots/vertex; clipping; invalid dimensions; shared sparkline frame; no input mutation. |
| FSM | Every supported transition and rejected action; explicit readiness; no timer/auto-progression; actual predictions; stale sessions; locked stages. |
| Retrieval | Passing/releasing at `−4` cannot complete; Check at `+4` fails; Check at `−4` passes; active edits cannot submit. |
| Assistance | Available only after incorrect Check; only opening sets viewed; preserves root; never auto-submits; independent vs assisted completion; reopening behaviour. |
| Input | Offset/scaled screen matrices; grab offset; final release position; out-of-bounds values; capture loss; multi-touch; resize/visibility cancellation. |
| Rendering/accessibility | Factor masking in all channels; keyboard/buttons; focus behaviour; 44px hit regions; reduced motion; enlarged text. |
| Lab | First experience selected; two levels only; disclosures; current entry; Escape/focus return; menu preserves state; switching/return resets. |
| Sparkline | All variants together; actual two curves; notation correspondences; multiple instances have distinct IDs; no lesson state dependency. |
| Isolation | Import boundary; portable modules contain no browser/React DOM dependencies; only approved paths changed. |

Use Chromium and WebKit browser projects at representative phone dimensions. Add restrained visual baselines after the first appearance review for the longest reveal panel, assistance, completion and three sparkline variants. Snapshots supplement behavioural/math tests; they do not substitute for them.

### Manual validation

- Real iPhone Safari and Android Chrome: thumb drag, targets, occlusion, adjustment buttons, dynamic browser chrome, rotation and interruption.
- Narrow/short phones and larger portrait screens; screen magnification and increased text size.
- VoiceOver/TalkBack where available; announcements, slider adjustments, prediction buttons, dialog focus and restoration.
- Correct and incorrect prediction journeys; independent success after retries; assisted success; free exploration.
- All sparkline reference sizes and coincident-root appearance.
- Desktop keyboard/mouse usability without changing the phone design.

Report any unavailable physical-device validation honestly. Browser emulation is not evidence of completed real-device testing.

Run scoped lint and pure/browser checks before a production build. A global build may reveal unrelated application/environment failures; report them separately without modifying existing source. Inspect the changed-path/import audit and branch before handoff. Leave implementation uncommitted unless subsequently instructed otherwise.

## 16. Incremental implementation checkpoints

| Checkpoint | Small deliverable | Acceptance before proceeding |
| --- | --- | --- |
| 0. Approval/environment | Obtain explicit plan approval and scoped dependency/tooling approval; restore dependencies; read relevant installed Next guides. | Correct branch; documented baseline; compatible packages; no unauthorized outside-folder edits. |
| 1. Lab/frame | Isolated route, two-level menu and correctly mounted experience shells. | Default selection, disclosure/focus semantics, preservation/reset boundaries, viable phone frame. |
| 2. Pure core/static graph | Card 1 model, typed scenes, compositional layouts and static initial graph/expression. | Mathematical/layout tests pass; exact roots/vertex; finite clipped path; portable core boundary. |
| 3. Manipulation | Pointer transactions, adjustment buttons and keyboard operation. | Capture/offset/cancel/resize checks; integer consistency; coincidence; real phone smoke test. |
| 4. Guided reveal | Explicit orientation progression, prediction and stable correct/incorrect explanations. | No automatic advancement/skip; actual choice retained; longest panel fits; focus and masking policy ready. |
| 5. Retrieval/completion | Check-only challenge, optional assistance and internal success modes, exploration. | Independent/assisted tests pass; no unintended success; assistance preserves position; no unavailable exam action. |
| 6. Sparkline preview | Reusable component and all three variants in one lab experience. | Accurate paired snapshots; visual review at reference sizes; independent mounting and IDs. |
| 7. Release review | Responsive/accessibility/device checks, production build and isolation audit. | Report passed checks/limitations; all source local; only approved tooling exceptions; reviewable uncommitted result. |

Review appearance at checkpoints 3–6 while changes are small. Refine visual details within agreed product decisions rather than postponing all phone evaluation until the end. Do not begin another card or application integration during these checkpoints.

## 17. Environment, external requirements and merge safety

Repository observations at plan preparation:

- `feat/step-visuals` is checked out and clean before this documentation addition.
- Next `16.2.6`, React/React DOM `19.2.4`, strict TypeScript and existing Playwright are declared.
- `d3-array` and its declarations are present in the manifest.
- `d3-scale` and `d3-shape` are not declared.
- `node_modules` and `node_modules/next/dist/docs/` are absent.
- Root layout imports application globals, phone-input CSS and Analytics; those remain inherited host infrastructure.

Before source implementation, restore dependencies and read the installed routing, client/server composition and CSS guides required by `AGENTS.md`. Verify the actual package APIs/ESM/type compatibility with this Next and Playwright setup. Online architecture research does not replace the installed version-specific guide check.

Required approval exceptions are explicit:

| Outside-folder surface | Proposed requirement | Approval/status |
| --- | --- | --- |
| `docs/engineering/step-visual-1-plan.md` | Save this planning document. | Authorized by the Stage 3 request only. |
| `package.json` / `package-lock.json` | Add focused `d3-scale`, `d3-shape` and required TypeScript declarations; no broad `d3` bundle. | Request before modification; not authorized by planning approval alone. |
| `node_modules` / package-manager caches | Restore and install approved dependencies. | Request before installation; exact operation identified then. |
| `.next`, generated Next types, build metadata | Standard dev/build output; prefer no unnecessary metadata writes for standalone type checks. | Obtain tooling-write approval before executing those operations. |
| Playwright browser/cache locations | Download missing browser executables if needed. | Request before downloading. |
| Root configuration or scripts | None currently needed. | Any newly demonstrated need requires separate approval. |

Keep test reports/artifacts under the feature with local ignore rules. Dependency versions will be selected and locked after approval against the actual environment; this plan does not claim compatibility has already been tested. Native packages are future requirements, not current exceptions.

Merge safety comes from an independent source/import graph, relative feature imports, local styles/tests, no application-specific selectors or DOM mutation, and a small documented package exception. Shared package/lock files and inherited runtime configuration remain real merge dependencies and must be reconciled normally; complete conflict immunity is not promised.

Later cards can reuse graph evaluation/projection, real-factor formatting, platform input boundaries and UI frames, while owning their own mathematical models and pedagogical reducers. Inequalities need interval semantics, and Argand diagrams need deliberate axis/unit policy; neither is implemented as a premature extension here.

## 18. Remaining approvals and unresolved issues

There are no blocking unresolved educational choices. The plan includes a concrete readiness rule (one changed committed placement enables **Ready to predict**) and a target-specific assistance explanation that reveals the answer without placing/submitting it. These details are reviewable parts of this plan, not claims of prior separate approval.

The following gates remain:

1. The user must explicitly approve this consolidated plan before any implementation starts.
2. Dependency/lockfile installation and outside-folder tooling writes require the separate scoped approvals identified above.
3. Missing installed Next guides, package compatibility, actual phone behaviour and native portability assumptions require verification at their checkpoints; they are environmental checks, not reasons to reopen agreed product decisions.

Sparkline appearance, exact copy spacing and modest animation are deliberately reserved for visual review after implementation. If verification exposes a substantial conflict with an agreed decision or requires broader repository changes, pause that dependent work, explain the concrete issue and request a decision.

## 19. Reference basis

Product requirements come from the supplied Card 1 Reference Implementation Spec, the provisional Ten-Card Progression, and the Stage 3 decisions in this conversation. The user's isolation and approved v1 decisions take precedence over earlier provisional structures and skipping proposals.

The Stage 2 technical investigation used primary references, including [D3 linear scales](https://d3js.org/d3-scale/linear), [D3 line generation](https://d3js.org/d3-shape/line), [D3 zoom](https://d3js.org/d3-zoom), [React refs](https://react.dev/learn/referencing-values-with-refs), [React Native SVG](https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md), [Reanimated worklets](https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets/), and [W3C dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements). These support the architectural boundaries; they do not establish that the proposed implementation has already been tested or that a future native runtime has been selected.
