# Maths Visuals Engineering Guide

Version: 1.0

Status: draft for review

Reference implementation reviewed: 21 October 2026

Scope: technical standards for Step Visuals and future interactive mathematical activities.

This guide defines how to implement reliable mathematical experiences. It is not a specification for a universal visualisation framework, nor a requirement to reproduce the quadratic activity's component tree.

## Contents

1. Scope, authority and implementation readiness
2. Architecture, ownership and dependency boundaries
3. Reuse and extension decisions
4. Mathematical models and numerical contracts
5. Pure layout preparation and declarative rendering
6. Interaction transactions and state management
7. Platform adapters, hosting and lifecycle
8. Responsive geometry and presentation
9. Accessibility implementation
10. Compact and static representations
11. Learning records and integration contracts
12. Verification, performance and maintenance

## 1. Scope, authority and implementation readiness

### 1.1 Responsibilities of the three guides

| Document | Authority |
| --- | --- |
| [Great Maths Visuals][quality-guide] | Mathematical and educational quality, including accessibility and clarity. |
| [AI Maths Visuals Support Guide][support-guide] | Educational design, collaboration, decision authority, approval and review. |
| This guide | Architecture, computational methods, technical contracts, implementation and verification. |

Follow [AGENTS.md][agents] for repository-wide instructions, including installed Next.js documentation requirements. Do not duplicate its generic rules here. This guide does not grant permission to change dependencies, application source, storage or integration scope.

Implement the approved experience specification produced under the Support Guide. If that specification, a quality requirement and existing behaviour conflict, identify the conflict and stop only the affected decision. Do not silently resolve it by weakening mathematics or treating existing code as the requirement.

Historical plans are evidence of earlier reasoning, not current authority. For example, the [original Card 1 plan][historical-plan] contains subsequently replaced integer-dragging, adjustment-button, assistance and sparkline decisions. It must not override later approved behaviour.

### 1.2 Convention and evidence labels

- **Mandatory:** a boundary or correctness requirement. Departures require an explicit, documented decision; missing implementation is not compliance.
- **Recommended:** the default technical choice. Use another approach when its benefits and verification justify it, within approved scope.
- **Activity-specific:** valid for a named activity; do not impose it on another mathematical model.
- **Unvalidated generality:** a pattern with useful potential, but no evidence yet that it works for substantially different activities or platforms.

These labels describe obligations separately from evidence. A pattern covered by Card 1 tests is established for those tested cases, not automatically for arbitrary functions, mobile hardware or React Native. Source and test links below identify evidence locations, not a claim that every test was rerun when this document was edited.

### 1.3 Technical readiness before substantial implementation

**Mandatory:** inspect the approved specification for enough detail to implement its mathematical objects, domains, continuous/release behaviour, controls, progression, feedback, assessment, assistance, accessible alternatives and meaningful evidence. Use the Support Guide's handoff; do not create a second educational design process.

Translate it into a short implementation note covering:

- Canonical values, derived quantities and numerical methods.
- Ownership of editing, learning, camera and lifecycle state.
- Reuse decisions and public component/record contracts.
- Required presentation states, geometry invariants and failure handling.
- Verification of the central interaction and any demonstrated external requirements.

Choose routine algorithms, file boundaries and tests independently when established requirements settle them. Refer consequential experience changes to the Support Guide's decision policy; do not turn ordinary technical choices into additional approval gates.

**Mandatory:** build and validate a minimal central-interaction prototype before expanding the full guided journey. Include actual mathematical computation, representative phone rendering and the essential accessible alternative. Exercise substantial-content states early using genuine presentation components. The prototype is an engineering validation step, not an automatic extra human review or a second disposable interface.

### 1.4 Durable activity documentation

**Recommended default:** keep the current educational specification at `docs/design/features/step-visuals/activities/<activity-id>/experience-specification.md`. If an activity already has an authoritative location, retain and link it rather than creating a competing copy. Keep an implementation note beside the feature or under `docs/engineering/features/step-visuals/activities/<activity-id>/` when useful.

Use lowercase, hyphenated names for new files. Link existing mixed-case implementation files by their actual names; do not undertake a naming migration as incidental work. Document status as approved, proposed, deferred or superseded, following the Support Guide. Record technical choices here or in implementation notes, not as additions to the educational specification's scope.

## 2. Architecture, ownership and dependency boundaries

### 2.1 Ownership, not a compulsory reducer hierarchy

**Mandatory:** give each concern a clear owner and a defined update path.

| Concern | Responsibility | Must not become |
| --- | --- | --- |
| Mathematical model | Authoritative quantities, constraints and derived relationships. | A collection of separately stored strings, paths and coefficients that can drift apart. |
| Interaction transaction | Active candidate, ownership, commit/cancel and input validity. | A second independently rendered mathematical model. |
| Learning state | Accepted answers, progression, feedback and assistance under the approved specification. | An effect that guesses outcomes from current DOM or pointer movement. |
| Lifecycle/hosting | Suspension, resumption, restart, exit and allocated space. | Lab navigation embedded in a reusable activity. |
| Presentation | Visible precision, notation roles, masking, geometry and accessibility descriptions. | The authority deciding mathematical truth. |
| Optional camera | Viewport, pan or zoom independent of the mathematical object. | An untracked transform owned simultaneously by React and a gesture library. |

One reducer may represent several concerns; several composed reducers may be clearer. Separate reducers, stores or component layers are not requirements. Card 1's [manipulation][manipulation], [learning][learning] and [recording][recording] composition is an established example, not a generic engine to instantiate for every activity.

### 2.2 Portable processing and platform rendering

The recommended processing arrangement is:

```text
model + effective interaction value + learning/presentation policy + dimensions
    → pure mathematical analysis and composed layouts
    → readonly component-specific scene data
    → platform renderer

platform input → coordinate adapter → semantic action → authoritative state
```

**Mandatory:** portable mathematical, layout and transition modules do not import React, Next.js, CSS, DOM APIs, browser event types or application-specific services. Platform adapters translate native/browser information into plain inputs. Pure modules receive dimensions and coordinate coefficients, not elements or observers.

For the existing web feature, React owns rendering and semantic state. D3 prepares data, scales, geometry and paths; it does not select or mutate React-owned elements. A different renderer may be appropriate for a future platform or demonstrated workload, but it must preserve these ownership boundaries rather than silently introducing another state owner.

### 2.3 Dependency direction and containment

**Mandatory:** genuinely shared processing does not depend on a particular activity's model. An activity may compose shared primitives and activity-local processing. Lab modules may import activities; reusable activities and renderers must not import the lab. The host consumes public contracts, not internal reducers.

All feature source, styles, tests and lab additions currently remain within `src/app/step-visuals/`. Documentation uses its approved documentation paths. No existing Puckle/Switchplay component, gesture utility, data model, authentication or persistence is required. Shared dependencies and tooling changes remain explicit exceptions requiring authorization.

Use the existing [public entry point][public-api] for supported mounts and types. Do not export every internal helper merely to make reuse easier. Introduce a processing entry point only if an actual consumer needs one; avoid importing a React barrel into pure tests.

## 3. Reuse and extension decisions

### 3.1 Decide before copying or generalising

**Mandatory:** inspect existing contracts, imports and tests; directory names alone do not establish suitability. For each substantial capability, choose:

| Decision | Use when | Verification |
| --- | --- | --- |
| Reuse unchanged | Model, semantics, dimensions and platform assumptions match. | Existing coverage plus a focused new-consumer test. |
| Adapt safely | A small explicit policy/configuration change supports both consumers without distorting either. | Preserve Card 1 defaults and test both policies. |
| Extract a primitive | A demonstrated second use exposes an independently meaningful operation hidden inside activity logic. | Test the primitive and both compositions; eliminate activity imports from the shared layer. |
| Build new | Mathematical object, interaction or representation is fundamentally different. | Reuse lower-level projection/input ideas where valid, but give the new capability its own contract. |

Prefer a small purposeful abstraction to duplication when the boundary is clear. A second use is useful evidence, not an absolute prerequisite. Do not build registries, plug-in systems, universal lesson engines or a diagram language for hypothetical consumers.

### 3.2 Current reuse map and limitations

| Capability | Current evidence | Reuse decision criteria |
| --- | --- | --- |
| [Real-factor helpers][real-factors] | Finite values, factor evaluation and sign formatting. | Reuse for real linear factors; not a symbolic algebra or calculus engine. |
| [Projection and coordinate plane][coordinate-plane] | Linear mapping, integer-oriented x ticks, both domains containing zero, minimum dimensions. | Projection concepts are reusable. Adapt axes/padding/domain policy before off-origin or differently scaled plots. |
| [Function plotting][function-plot] | Sampled evaluator, exact supplied landmarks, finite gaps and clipping. | Reuse only after the function family's error and discontinuity analysis in Section 4. |
| [Root marker layout][root-markers] | First factor fixed, later factors moving, labels and horizontal cues. | Root-specific, not an arbitrary-handle layout. Tangent points and interval endpoints need their own contracts. |
| [Graph renderer][graph-renderer] | SVG curve, coordinate plane and root layers; title is “Quadratic graph”. | Extract suitable layers or parameterise explicit semantics; do not label a calculus scene as a quadratic. |
| [Pointer adapter][pointer-adapter] | Horizontal root transaction, capture and calibrated coordinates; imports Card 1 manipulation types. | Reuse the safeguards. Extract a transaction/input boundary when another handle needs it, rather than importing the Card 1 reducer. |
| [Activity frame][activity-frame] | Slot composition and stable graph region with sizing slots. | Useful for a single-graph phone activity. Multiple linked graphs may need another composition. |
| [Prompt preparation][presentation] | Card 1 copy, actions, masking and stage policy. | Renderer ideas may transfer; stage names, content schema and progression are not universal. |
| [Sparkline preparation][sparkline-layout] | Card 1 fit and equal-scale policy; imports its model despite living in `core/`. | Keep activity-specific composition local when extending; extract only genuine framing primitives. |
| [Learning notifications][notifications] | Ordered, guarded delivery, currently typed to Card 1 records. | Preserve lifecycle guarantees; do not force another activity into Card 1 payloads. |

The present `core/` directory is therefore not a certified general-purpose library. Existing exceptions are not permission to add new shared-to-activity dependencies. Generalise or relocate only the affected capability during authorized implementation, with compatibility tests; this guide itself requires no refactor.

### 3.3 Substantially different activities

Differentiation may need a point constrained to a curve, a secant pair, tangent geometry or linked function/derivative plots. Integration may need ordered interval endpoints, signed areas, partitions or accumulation values. These are not variations of “move one root”.

**Recommended:** reuse scalar/point types, validated projections, clipping and transaction principles. Create activity-appropriate mathematical models and layers. Extract multi-handle selection, interval preparation or linked-plot framing only when the approved interaction needs them. Do not make a mathematical interval depend on a root-factor model to obtain dragging support.

## 4. Mathematical models and numerical contracts

### 4.1 Mathematical authority

**Mandatory: presentation requirements never determine mathematical truth.** Store the smallest adequate model, validate at its boundary and derive dependent values through pure functions. Formatting, pixel position and rounded text must not become inputs to evaluation or assessment.

Define the following distinctions for each activity, even when some values coincide:

| Value | Contract |
| --- | --- |
| Canonical model | Authoritative mathematical parameters and constraints. |
| Continuous candidate | Proposed value during an active transaction; real-valued when the interaction requires it. |
| Committed value | Accepted value after release/confirmation; not necessarily integer. |
| Effective value | The explicit choice of candidate or committed value used for current mathematical rendering. |
| Derived quantity | Calculated from the effective/canonical inputs, not independently maintained. |
| Display value | Formatted or rounded view of a quantity, with its mathematical role identified. |
| Assessment value | The approved submitted value or object; never inferred from a rounded label or last rendered sample. |

In Card 1, [the model][card1-model] distinguishes integer settled roots from real graphical roots. [Its compositor][card1-layout] derives curve/marker geometry from the continuous candidate and notation from a rounded display root. That separation is explicit, but its visible approximation policy has the limitation in Section 8.4. Integer roots, symmetric half-step rounding and snap-on-release are **activity-specific**.

### 4.2 Exactness, approximation and validity

**Mandatory:** document domains, units, constraints, singularities and the meaning of exact/approximate output before choosing an algorithm.

- Prefer known analytic relationships when they meet the approved task; distinguish an exact identity from its floating-point evaluation.
- Specify display precision separately from computational precision. Do not round repeatedly during accumulation or feed formatted values back into calculations.
- Define absolute and relative tolerances appropriate to magnitude, units and conditioning. A common comparison is `|a-b| <= absoluteTolerance + relativeTolerance * max(|a|, |b|)`, but its tolerances and applicability require justification.
- Keep numerical error, graphical interpolation error, input resolution and assessment acceptance tolerances distinct. Changing a graph's pixel density must not change whether a mathematical answer is correct.
- Validate finite inputs and non-degenerate projections. Normalise negative zero when appropriate for notation. An undefined result is not numerical zero.
- Treat expected undefined mathematics with a typed unavailable/undefined result and a prepared presentation policy. Invalid public configuration may fail explicitly; ordinary student movement through an allowed special case must not crash the activity.

For costly/approximate operations, a contract should state the value, method or approximation status, validity and any justified error estimate. Do not describe an estimated error as a rigorous bound unless it is one. Do not fabricate a universal result schema before it has a consumer.

Assessment must use a justified acceptance rule and account for uncertainty. If numerical uncertainty prevents a reliable decision, improve the computation or report that assessment is unavailable; do not silently widen tolerance until an answer passes. Changes to accepted mathematical answers are consequential experience decisions.

### 4.3 Numerical calculus

**Mandatory when applicable:** select and verify a method for the particular function family and objective; no differentiation or integration algorithm is universally prescribed.

| Capability | Decisions and checks |
| --- | --- |
| Derivative | Analytic versus numerical evaluation; finite-difference scheme and step size if used; truncation/roundoff balance; boundary handling; non-differentiability and domain restrictions. |
| Secant/tangent | Distinct-point requirements; near-coincident points; undefined or unbounded slope; how direction is represented without inventing a finite gradient. |
| Definite integral | Analytic versus numerical evaluation; orientation for reversed bounds; signed accumulation versus geometric area; subdivisions/tolerance; convergence budget; permitted improper cases. |
| Area representation | Split at relevant zeros, domain gaps and sign changes; show the approved signed/unsigned quantity; distinguish displayed quadrature rectangles from a more accurate computed integral. |
| Linked calculus views | Shared mathematical parameters and units; independently justified plot scales; all dependent views tagged to the same input revision. |

Validate against analytic examples and independently justified invariants: constants/polynomials, stationary points, domain boundaries and relevant sign/cancellation cases. Check convergence where appropriate; merely increasing subdivisions once is not proof of accuracy. Finite differences at a corner and quadrature over a singularity require deliberate handling, not smoothing or a plausible-looking number.

D3 may prepare samples, scales, areas and paths. It is not the mathematical authority for derivatives or integration. Ordinary pure mathematical functions are appropriate; do not add artificial D3 calls to satisfy a naming convention.

### 4.4 Plotting correctness

**Mandatory:** justify sampling for the permitted function family and maximum supported display size. Preserve exact known landmarks where appropriate. Keep true offscreen geometry and clip it; do not clamp function values into false flat segments or bridge unrelated valid points across a gap.

[The existing plot layout][function-plot] adds supplied roots/vertex to uniform samples and uses a linear D3 path. For a monic quadratic, interpolation over spacing `h` has maximum vertical error `h²/4` mathematical units; convert this through the y-scale to check pixel error. [Layout tests][layout-tests] exercise this relationship. Its default 200 intervals are not a general accuracy guarantee.

Non-finite samples break the existing path, but that does not detect a discontinuity lying between finite samples. Functions with poles, excluded intervals, sharp features or oscillation need explicit segmentation and/or suitably validated adaptive sampling. Do not rely on a decorative spline to conceal inadequate sampling. Additional numerical algorithms and curve types are proposals until implemented and verified.

## 5. Pure layout preparation and declarative rendering

### 5.1 Layout contracts

**Mandatory:** pure preparation functions are deterministic for their explicit inputs, do not mutate caller data, and return component-specific readonly data. Pure evaluators may be inputs; output scene contracts contain no evaluators, callbacks, JSX, mutable D3 scales or platform objects.

**Recommended:** compose layouts for meaningful components: coordinate plane, curve, annotations, expression and prompt, coordinated by an activity layout. Tiny SVG primitives need not acquire a dedicated module. Related helpers may share a file; file proliferation is not architectural quality.

Use semantic appearance roles, positions, segments, tokens and descriptions. Renderers translate these into platform markup and styles. Browser focus targets and SVG IDs belong to rendering; the renderer supplies stable per-instance IDs rather than a layout generating random values.

[Graph composition][graph-layout], [scene types][scene-types] and [factor-expression preparation][factor-layout] illustrate the pattern. Scene coordinates are rendering coordinates derived from mathematical values; never reuse them as learning evidence.

### 5.2 React and D3 division

For the current web stack:

- **Mandatory:** React owns the DOM/SVG tree. No `d3.select`, imperative axis construction, transition-driven stage changes or independent marker transforms on React-owned elements.
- **Recommended:** use installed focused D3 packages for scales/ticks, data preparation and paths. Instantiate/configure mutable D3 helpers locally inside pure computation and expose only their results.
- **Recommended:** React SVG rendering for the present workload. Canvas or another renderer requires a demonstrated need and explicit state/lifecycle/accessible-output boundaries, not a second owner added as an optimisation shortcut.

Mathematical calculations and layout belong in processing, not JSX. Rendering branches that map a prepared role to a CSS class are normal presentation work and do not need a layout abstraction. Essential boundaries matter more than requiring every component to call D3.

### 5.3 Immutability and caching

**Mandatory:** readonly contracts, input non-mutation and immutable accepted state. **Recommended:** memoise stable coordinate planes and unchanged presentation separately from moving geometry, keyed by all relevant model, policy and size inputs. Caches are conveniences; correctness must not depend on a cache surviving.

The current [recursive freezer][immutable] runs in production for prepared scenes. It offers runtime mutation protection but traverses nested objects, including already-frozen shared children. It is not a universal performance requirement. Do not freeze caller-owned objects, cyclic structures or growing historical data on every frame. Use owned new data and structural sharing; measure whether recursive freezing, selective checks or another strategy fits a larger scene before changing established behaviour.

## 6. Interaction transactions and state management

### 6.1 Transaction contract

**Mandatory for editable gestures:** distinguish begin, preview, commit and cancel. A transaction identifies its owner and applicable context/revision. The effective mathematical value comes from that transaction, not an independently moving DOM element.

- Begin validates permission, input identity and coordinate conversion; preserve the grab offset.
- Preview applies the approved constraints to current absolute coordinates and updates the candidate. Continuous motion stays continuous unless quantisation itself is specified.
- Commit uses final release/confirmation coordinates, validates current constraints and applies the approved snapping/precision rule atomically.
- Cancel discards the candidate and restores the committed model without recording a changed placement.
- Discrete accessible controls dispatch equivalent semantic placements, respecting the same bounds and validation.

Reject stale revisions, wrong owners, invalid coordinates and actions from locked stages. Unexpected secondary contacts must not steal a transaction; an explicitly designed multi-pointer gesture may own a defined set of contacts. Restart must not reuse transaction identities in a way that admits old events. An unchanged or cancelled edit must not count as a changed placement. A deliberate submission of an unchanged value may still be meaningful if the approved assessment permits it, as Card 1's initial Check does.

[Root calculations][root-interaction], [the manipulation reducer][manipulation] and [input tests][input-tests] demonstrate these safeguards for a one-dimensional handle. Two-dimensional points, multiple handles and interval crossings need activity-specific constraints and ownership policies; do not assume the root reducer already supports them.

### 6.2 Learning and assessment

**Mandatory:** implement explicit accepted transitions. UI enablement is not a substitute for transition guards. Assessment uses the approved submission action and authoritative value; a transient correct position is not a submission unless the specification explicitly says so.

Use a reducer or another explicit, testable state-transition model. Avoid effects that watch a root/answer and infer progression or completion. Card 1's [learning reducer][learning] advances the reveal on an accepted settled placement and assesses retrieval only on Check. Those are different policies, not a universal trigger.

Separate feedback visibility from retained evidence. Clearing a message must not erase attempt counts, assistance use or previous submissions. Do not duplicate derived mathematical/assessment state in multiple stores. Where an immutable record materialises evidence alongside live state, update it from the same accepted transition and test their agreement.

### 6.3 Camera, zoom and expensive processing

**Mandatory when present:** camera state changes the view, not the mathematical object. Store its domain/transform explicitly and prepare projection from it. Gesture libraries may translate input but must not maintain a competing untracked camera transform. Card 1 has no zoom; the current project contains no validated zoom implementation to reuse.

**Recommended:** React-owned camera state and pure pan/zoom calculations for a future web activity. A closed high-frequency native/canvas circuit is not a general exception: introduce it only after profiling, with one active owner, consistent linked views and explicit commit/cancel/revision handoff. Native worklet compatibility is not established by ordinary TypeScript purity.

For expensive numerical analysis, distinguish pending computation from accepted results. Tag asynchronous work with input revision, reject stale responses and never combine one revision's curve with another's assessed result. Workers, throttling or approximate previews require a demonstrated need and an honest accuracy policy; none is assumed implemented now.

## 7. Platform adapters, hosting and lifecycle

### 7.1 Browser adapter responsibilities

**Mandatory:** browser modules own measurement, event objects, pointer capture, focus, visibility and cleanup; portable processing receives plain values.

Use absolute pointer coordinates, a validated mapping and mathematical grab offsets. Clear ownership before intentional capture release so the resulting capture-loss event cannot cancel a commit. Cancel on unexpected capture loss, incompatible geometry changes, suspension, visibility/focus interruption and invalid mapping. Restrict `touch-action` to the necessary target rather than blocking page scrolling or browser magnification globally.

The [current adapter][pointer-adapter] uses three measured SVG probes because WebKit may omit ancestor CSS transforms from `getScreenCTM()`. This is an established workaround for tested affine transforms, not justification for probes in every renderer or support for arbitrary perspective transforms. Preserve transformed-coordinate regression tests when adapting it.

### 7.2 Host lifecycle

**Mandatory:** distinguish these operations in any public hosting contract:

| Operation | Required distinction |
| --- | --- |
| Suspend/hide | Cancel active editing, block input, preserve committed mathematics and learning. |
| Resume | Restore that session without making a learning transition. |
| Restart | Begin a new attempt, reset its learning state, preserve supported prior records. |
| Explicit exit | End interaction and deliver available final/partial evidence before navigation. |
| Unmount/shutdown | Clean up platform ownership; do not claim guaranteed evidence delivery. |

[Card 1's public activity][activity] exposes `visible`, `restartKey`, `exitKey`, callbacks and optional `onExit`. Request keys are its current host-control convention, not a compulsory API for all activities. Their initial values are inert and changed values are explicit requests. Consult the [current contract][records-document] rather than guessing lifecycle order.

The lab's A–E and sparkline dropdown previews preserve the mounted Guided owner; their interactions cannot change Guided evidence. A real experience change has a different mounting boundary. Preserve that distinction when adding lab entries. The two-level [experience registry][registry] remains lab-only; no student skipping feature is implied by preview navigation.

### 7.3 Hosting and React Native readiness

**Mandatory:** activities bring their own feature styles and do not require lab navigation, application CSS variables, authentication or card data. Hosts supply viable layout space and handle persistence/navigation outside the activity. CSS Modules prevent outgoing class-name collisions, not arbitrary inherited global styles; verify actual host typography, box sizing, overflow and safe areas during later integration.

**Recommended:** portable numeric coordinates and SVG-compatible path/segment data allow a future native renderer to retain computation. Native text metrics, SVG primitives, measurement, gestures, focus and accessibility still require adapters and tests. The current implementation is structured for a port, not verified as React Native-ready. Do not install native infrastructure in anticipation alone.

## 8. Responsive geometry and presentation

### 8.1 Stable mathematical frame

**Mandatory:** state the physical and mathematical invariants for the approved comparison. At a fixed allocated size, stage or feedback changes must not move/resize/rescale the graph when students are meant to compare states. Deliberate camera or scale changes require an explicit mathematical purpose and presentation policy.

Specify plot rectangle, domains, ticks, unit ratios and linked-view relationships independently from prompt content. Equal horizontal/vertical unit scales are necessary when the intended geometric interpretation requires them, not for every graph of different quantities. A camera/domain change must not be confused with movement of the mathematics.

Card 1 fixes domains `x = [-6,6]`, `y = [-10,10]` and graph geometry across stages. Its sparklines intentionally use a separate fit policy. Neither frame is a mandatory domain/aspect ratio for other activities.

### 8.2 Content-aware phone composition

**Recommended:** use a content-aware frame that reserves the longest normal instruction/notation/action requirements and gives the mathematical surface the remaining usable height. Test 320 × 568, 360 × 640 and approximately 390 CSS-pixel-wide portrait screens early, then tablet/desktop and 200% text scaling. Treat these as reference cases, not the only supported devices.

Allow controlled vertical scrolling on short screens or enlarged text rather than clipping controls or shrinking the mathematical surface until it is unreadable. Set sensible larger-screen maxima. Avoid hardcoded aspect-ratio changes to solve each new prompt independently.

[ActivityFrame][activity-frame] and [its CSS][frame-css] use overlapping sizing slots and a bounded graph row. This technique is established for Card 1's content but its sizing text approximates actual text widths; it needs rendered geometry checks as content, fonts or translations change. Alternative compositions may use another explicit reservation strategy. Do not copy its pixel limits into unrelated multi-graph experiences.

### 8.3 Presentation roles, labels and masking

**Mandatory:** preparation identifies whether notation represents current mathematics, a target, prediction, explanation or unavailable answer. Keep target quantities separate from current equations when they differ. [The root task layout][root-task] illustrates this separation without claiming the plotted function contains the target factor.

Prepare annotation positions, boundary handling and collision policy in layout functions. Keep mathematical marker centres exact. Visible markers, larger hit regions and finger-safe labels serve different purposes. Use stable identities and shape/outline cues; avoid unnecessary annotation jumps. Labels should render above curves when intended as surfaces, with tested contrast and restrained backing where needed.

Mask answer-bearing content in visible text, SVG titles/descriptions, accessible names, live regions, tooltips and hidden sizing nodes. Hidden or `aria-hidden` content is still in the DOM. Use neutral calibration content rather than hidden solutions; mount diagnostics only on explicit lab request. [Card 1 presentation preparation][presentation] and [masking tests][presentation-tests] are representative evidence. This prevents unintended disclosure through the rendered interface; it is not a security boundary against inspecting client code or explicitly opening authored lab previews.

### 8.4 Existing Card 1 precision limitation

**Activity-specific, not a general exception:** Card 1 currently uses a continuous curve with nearest-integer root/factor displays during dragging. `expressionIsRounded` and the graph description record that distinction, but the visible factorised equation has no approximation cue. It can temporarily differ from the function drawn.

This was explicitly approved during Card 1 development. It is not evidence that all current representations satisfy Great Maths Visuals Section 2.1's exact-versus-approximate requirement. Keep it visible as an existing mathematical-presentation discrepancy requiring a separate product review; do not silently alter that approved activity in a documentation task or reproduce the mismatch in new visuals.

For new work, define an honest visible approximation/presentation policy before implementing precision reduction. The display may simplify information, but must not assert false exact equality. The particular remedy for Card 1 remains outside this guide's implementation scope.

## 9. Accessibility implementation

### 9.1 Essential operations and equivalent input

**Mandatory:** new activities provide accessible alternatives for essential mathematical gestures, including students who cannot drag and have no keyboard. All input methods feed equivalent semantic actions and constraints, without automatically submitting or changing the mathematical task. Keyboard arrows alone do not establish adequate touch access.

Choose alternatives appropriate to the approved control inventory: for example, an accessible value-entry/control surface or discrete selection mechanism. These are examples, not authorization to add unexplained controls. Do not automatically restore Card 1's removed visible arrows or implement an alternative without resolving any consequential experience choice under the Support Guide.

For scalar controls, use suitable slider/value semantics with prepared names, bounds and value descriptions. Point/interval interaction may require different semantics. Preserve visible focus and stable identities, and distinguish graphical mark size from an operable target. The existing root uses a 48 CSS-pixel target; use at least the project's 44 CSS-pixel touch-target baseline for essential controls unless an explicit layout requirement demands a justified alternative.

### 9.2 Focus, feedback and visual accessibility

**Mandatory:** specify focus when a control disappears or a stage changes. Do not move focus on every pointer preview. Announce accepted feedback and relevant transitions without flooding live regions during dragging. Keep locked controls and their explanations consistent across pointer, keyboard and assistive technologies.

Use native buttons and semantics where applicable. When an unavailable action must explain its prerequisite on attempted activation, an `aria-disabled` control may be appropriate, but its handler and transition guard must still block progression. Test touch, mouse, Enter, Space, dismissal and enlarged-text tooltip overlap. [Navigation hint tests][hint-tests] demonstrate this specialised case; native disabled remains suitable when no activation explanation is needed.

Test mathematical labels and controls against backgrounds, grid and curves. Measure relevant contrast rather than trusting palette names; the current graph axes exceed the project's 3:1 essential-graphics threshold with a margin. Use non-colour cues, readable reflow, reduced-motion preferences and unrestricted browser text/zoom access. Automated geometry and contrast checks do not establish full accessibility compliance.

### 9.3 Known limitation and evidence status

Card 1's touch-only non-drag alternative remains explicitly deferred. It affects students unable to drag without another usable input method. Keyboard support does not close that requirement. Its development milestone acceptance is not full accessibility readiness, and future activities must not inherit the exception.

Record unresolved accessibility requirements with impact, affected users, approval/status and required verification. Physical iOS/Android and VoiceOver/TalkBack checks remain necessary where automated coverage cannot establish behaviour. Distinguish simulated text scaling, browser emulation, keyboard tests and real assistive-technology evidence in reports.

## 10. Compact and static representations

**Mandatory:** compact representations have explicit mathematical inputs, size constraints, semantics and framing. They do not mount an interactive learning controller or inherit its transient/pedagogical state implicitly. Their values must describe the state they claim to represent.

**Recommended:** prepare a dedicated compact layout rather than shrinking the full activity SVG. Fit important landmarks, use an intentional unit-scale policy, retain essential labels and omit only genuinely secondary furniture. Compare variants at the same mathematical state and identical graph geometry where applicable. A notation-only variant must not reserve an invisible graph region.

[Card1Sparkline][sparkline-component] has three static variants, independent styling and a runtime-validated integer root contract from −5 to 5. Its graphical variants have numerical labels below true root positions; coincident roots share a label. [Sparkline tests][sparkline-tests] cover framing, equal unit scales and labels, including 160-pixel reference widths.

These are **Card 1 policies**. A derivative thumbnail may need a tangent rather than roots; an integral thumbnail may need signed area and interval endpoints. No paired snapshots, three variants, integer inputs or equal-unit framing are mandatory for unrelated concepts. Changes to public input support need runtime validation, types, tests and deliberate compatibility treatment—not fractional labels bolted onto an integer-only contract.

## 11. Learning records and integration contracts

### 11.1 Activity facts, host persistence

**Mandatory:** Step Visuals owns learning decisions and produces structured facts. Puckle/Switchplay owns persistence, user identity, card associations and retention policy. No activity needs those services to compute or complete its task.

Expose clear typed public contracts for results and supported callbacks. Return mathematical values and semantic identifiers, not formatted expressions, SVG paths, React elements or screen coordinates. Records are immutable, serialisable and versioned. Expected unavailable values have explicit representations; `NaN`/`Infinity` must not silently become misleading JSON nulls.

Use an opaque attempt identity, distinguish restarts, and identify ordered events. Keep schema version separate from activity/task revision when interpretation can change. Different activities may share envelope conventions, but their prediction, construction, integral estimate or assessment payloads must remain appropriate to their mathematics. [Card 1 record types][record-types] are a concrete contract, not a common schema to force onto every activity.

### 11.2 Events, results and partial attempts

**Mandatory when recording is supported:** record accepted meaningful actions specified by the experience: committed choices, predictions, submissions, requested assistance and outcomes. Do not record every pointer frame, cancelled edit, rejected/stale action or lab preview as learner evidence. Produce accepted facts alongside state transitions, not by observing rendered state afterwards.

Individual assessments retain the submitted mathematical value, correctness and relevant assistance state at submission. Preserve the task's definition of independent/assisted success; a failed attempt must not silently become assistance. In Card 1, a Check evaluates the target linear factor, not the plotted quadratic, which is zero at every movable root.

Start again begins a new attempt and preserves completed snapshots for the mounted session. Make current/partial attempt information available to the parent and emit explicit restart/exit facts where those actions exist. Do not treat navigation previews, refresh or tab closure as guaranteed exits. Persistence or refresh restoration requires its own approved scope.

[The recorded reducer][recording] uses structural sharing and bypasses history processing during continuous previews. Accepted-action arrays grow and are copied on meaningful additions; their cost and session retention remain bounded by the intended short activity, not proven suitable for indefinitely running tools. Define a retention/delivery strategy before substantially longer sessions without silently deleting evidence promised by the public contract.

### 11.3 Callback delivery

**Mandatory:** callbacks deliver already accepted facts outside render/reducer execution. Guard duplicate completion delivery within an attempt, Strict Mode replay, reentrant handlers and stale interactions. Callback failures must not corrupt mathematical/learning state. Document error handling and late-subscription behaviour; local duplicate suppression is not exactly-once durable storage across remounts or crashes.

Card 1's established callback order is:

1. Newly accepted ordered `onEvent` deliveries, with `onComplete(result)` interleaved immediately after each completion event, once per completed attempt.
2. `onRecordsChange(records)` after the event batch, with the resulting accumulated snapshot.
3. `onExit()` after final evidence, so the host can navigate/unmount.

Late event/completion subscribers receive future notifications, not historical replay; a late snapshot subscriber can inspect archives. Synchronous callback errors are reported without undoing evidence; asynchronous persistence/error handling belongs to the host. These details are defined in [the current interface documentation][records-document] and covered by [record tests][record-tests]. Do not assume another interface has this order without an explicit contract.

### 11.4 Lab diagnostics

**Recommended:** keep fixtures, record inspectors and logging in the lab, consuming the same public callbacks as a future host. Avoid a second evidence calculation for diagnostics. The existing [console consumer][console-logger] logs accumulated snapshots in collapsed groups only in development, batching related event/completion deliveries at the snapshot boundary. It adds no learner identity data and does not log pointer previews. The on-screen inspector mounts record JSON only when explicitly opened.

Do not add names, user IDs, storage or production telemetry as incidental diagnostics. Test both development output and production silence when changing environment-dependent logging.

## 12. Verification, performance and maintenance

### 12.1 Evidence appropriate to risk

**Mandatory:** verify mathematical contracts, accepted/rejected transitions, presentation and platform behaviour separately. Use independent mathematical expectations; comparing a renderer with the same layout helper alone cannot establish that the mathematics is correct.

| Layer | Required evidence where applicable |
| --- | --- |
| Mathematics/numerics | Known analytic cases, invariants, boundaries, signs/zero, special cases, convergence/error analysis and invalid/undefined inputs. |
| Pure layout | Deterministic outputs, non-mutation, projection/inversion, finite paths, landmarks, clipping/segmentation, label positions and justified interpolation error. |
| State/transactions | Continuous previews, exact commits under the specified policy, unchanged/cancelled edits, stale owners/revisions, locked actions and assessment timing. |
| Learning/records | Correct/incorrect/assisted journeys, retained evidence, restart/exit, immutable archives, serialisation and duplicate-delivery safeguards. |
| Browser | Real intermediate geometry during movement, release/capture/cancellation, transformed coordinates, keyboard and non-drag alternatives, focus, masking and lifecycle. |
| Responsive/accessibility | Representative phones/tablets/desktops, substantial-content states, 200% text, overflow, target sizes, tooltip overlap, geometry invariants, contrast and reduced motion. |
| Static representations | Actual intended sizes, full supported input range, coincident/special cases, variant geometry and independent mounting. |
| Boundaries | Portable imports, no lab dependency from reusable activity, no unauthorized application coupling and scoped public contracts. |

[Mathematical/layout tests][layout-tests], [browser manipulation tests][browser-input-tests], [learning tests][learning-tests], [retrieval tests][retrieval-tests] and [isolation checks][isolation-tests] are reference examples. The current isolation checks use source scanning and a Card 1 module list; they do not prove every transitive architectural boundary. Extend discovery/coverage for new activities and review actual import direction, including nominally shared `core/` modules.

Use existing Playwright projects for pure assertions plus Chromium/WebKit browser tests before adding a new test framework. Keep intentional skips documented: Chromium native touch injection is not equivalent to verified Safari touch. Screenshot/appearance review complements functional assertions; it does not replace them.

### 12.2 Proportionate checks and reproducible commands

**Recommended:** run affected tests during small changes; broad mathematical, interaction or lifecycle changes warrant the relevant regression suites. A copy-only edit normally needs affected assertions and focused rendering checks, not every gesture test. A documentation-only edit needs link/consistency/diff checks, not an application build unless configuration or executable examples changed in a way requiring it.

Before substantial implementation handoff, run appropriate pure and browser suites, feature isolation, TypeScript, scoped lint and a production build. Report unrelated environment/application failures separately rather than changing unrelated source. Coordinate build and standalone type checks: generated Next route types can change during build, so perform the final `tsc` after build rather than racing them.

Run from the repository root using the existing feature-local configuration:

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure
SPV_TEST_BASE_URL=http://localhost:3000 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium --project=webkit
node_modules/.bin/eslint src/app/step-visuals
npm run build
node_modules/.bin/tsc --noEmit
```

Use the actual running development URL/port in `SPV_TEST_BASE_URL`; without it the config may start its own dev server. Apply a test-file filter for focused checks. The feature-local `package.json` marks ESM for the existing test/module boundary; it is not a separate dependency installation or a validated native package. Preserve it unless a concrete compatibility issue is demonstrated. Respect repository permissions for generated output and browser caches.

### 12.3 Performance without competing state

**Mandatory:** do not trade mathematical consistency for smooth-looking motion. Marker, curve and related live quantities must correspond to the same effective mathematical revision. If computation is not immediate, show an explicitly pending/approximate state rather than present mismatched results as current.

**Recommended:** measure representative work before optimisation. Separate coordinate preparation, evaluator cost, sampling, scene allocation/freezing, React rendering and browser layout. Cache stable planes and unchanged prompts, validate evaluators once per model where safe, and avoid history traversal or console work in preview handlers.

[Local layout diagnostics][performance-tests] and browser interaction diagnostics are not phone performance guarantees or universal frame budgets. Profile real representative hardware for demonstrated risks. Batching pointer updates may be considered if needed, but preserve the final release coordinates, cancellation semantics and one state owner. Do not add imperative D3 rendering or a second mathematical store to mask an unmeasured bottleneck.

### 12.4 Completion of engineering work

Keep a concise verification record stating what actually ran, important behaviour established, exceptions and what remains unverified. Distinguish automated function/geometry checks, visual judgment, physical-device testing, assistive-technology testing and learning-effectiveness evidence. Follow the Support Guide for human review; do not ask reviewers to repeat adequately automated functional checks.

At technical consolidation, update the authoritative experience specification with approved revisions, the public interface documentation with contract changes, and this guide only with genuinely reusable engineering lessons. Passing tests alone does not close a documented mathematical or accessibility discrepancy.

### 12.5 Maintain the guide as evidence grows

For an emerging reusable pattern, record its purpose, assumptions, implementation/test references, exceptions and evidence status. Promote it when its boundary is justified and supported by actual consumers; do not treat relocation into `core/` as validation. Keep activity-specific examples explicitly labelled and links current.

Before the next substantially different activity, review the reuse map, numerical requirements and known limitations. Extract only what that approved activity needs. When a convention changes, record the reason and compatibility implications; mark superseded guidance rather than preserving contradictory instructions. Change the educational quality guide or Support Guide only with the appropriate approval and only when the lesson belongs to that document.

Current issues to retain until separately resolved:

- Card 1 non-drag touch access: approved deferral, not full accessibility compliance.
- Card 1 rounded factor equation during continuous motion: approved earlier simplification requiring review against the current precision standard.
- Shared-module generality: root-specific and Card 1 dependencies remain as listed in Section 3.
- React Native and actual Puckle hosting: architectural preparation, not completed port/integration verification.

The aim is reusable boundaries and verifiable mathematics, not identical component trees, stage counts or algorithms across activities.

[quality-guide]: ../../../design/features/step-visuals/great-maths-visuals.md
[support-guide]: ../../../design/features/step-visuals/ai-maths-visuals-support-guide.md
[agents]: ../../../../AGENTS.md
[historical-plan]: ../../step-visual-1-plan.md
[public-api]: ../../../../src/app/step-visuals/public.ts
[card1-model]: ../../../../src/app/step-visuals/activities/roots-factors/model.ts
[card1-layout]: ../../../../src/app/step-visuals/activities/roots-factors/rootsFactorsLayout.ts
[manipulation]: ../../../../src/app/step-visuals/activities/roots-factors/manipulation.ts
[learning]: ../../../../src/app/step-visuals/activities/roots-factors/learning.ts
[recording]: ../../../../src/app/step-visuals/activities/roots-factors/recordedLearning.ts
[presentation]: ../../../../src/app/step-visuals/activities/roots-factors/presentationLayouts.ts
[activity]: ../../../../src/app/step-visuals/activities/roots-factors/RootsFactorsActivity.tsx
[real-factors]: ../../../../src/app/step-visuals/core/math/realFactors.ts
[coordinate-plane]: ../../../../src/app/step-visuals/core/graph/coordinatePlaneLayout.ts
[function-plot]: ../../../../src/app/step-visuals/core/graph/functionPlotLayout.ts
[graph-layout]: ../../../../src/app/step-visuals/core/graph/graphLayout.ts
[root-markers]: ../../../../src/app/step-visuals/core/graph/rootMarkerGroupLayout.ts
[scene-types]: ../../../../src/app/step-visuals/core/graph/types.ts
[root-interaction]: ../../../../src/app/step-visuals/core/interaction/rootInteraction.ts
[factor-layout]: ../../../../src/app/step-visuals/core/expressions/factorExpressionLayout.ts
[root-task]: ../../../../src/app/step-visuals/core/expressions/rootTaskLayout.ts
[immutable]: ../../../../src/app/step-visuals/core/immutable.ts
[graph-renderer]: ../../../../src/app/step-visuals/platform/web/Graph.tsx
[pointer-adapter]: ../../../../src/app/step-visuals/platform/web/useRootPointer.ts
[activity-frame]: ../../../../src/app/step-visuals/platform/web/ActivityFrame.tsx
[frame-css]: ../../../../src/app/step-visuals/platform/web/ActivityFrame.module.css
[notifications]: ../../../../src/app/step-visuals/platform/web/learningNotifications.ts
[registry]: ../../../../src/app/step-visuals/lab/experienceRegistry.ts
[console-logger]: ../../../../src/app/step-visuals/lab/learningConsole.ts
[sparkline-layout]: ../../../../src/app/step-visuals/core/sparklines/card1SparklineLayout.ts
[sparkline-component]: ../../../../src/app/step-visuals/sparklines/Card1Sparkline.tsx
[record-types]: ../../../../src/app/step-visuals/activities/roots-factors/learningRecords.ts
[records-document]: ../../../../src/app/step-visuals/learning-records.md
[layout-tests]: ../../../../src/app/step-visuals/tests/layout.spec.ts
[input-tests]: ../../../../src/app/step-visuals/tests/input.spec.ts
[presentation-tests]: ../../../../src/app/step-visuals/tests/presentation.spec.ts
[hint-tests]: ../../../../src/app/step-visuals/tests/navigationHint.browser.ts
[sparkline-tests]: ../../../../src/app/step-visuals/tests/sparkline.spec.ts
[record-tests]: ../../../../src/app/step-visuals/tests/records.spec.ts
[browser-input-tests]: ../../../../src/app/step-visuals/tests/manipulation.browser.ts
[learning-tests]: ../../../../src/app/step-visuals/tests/learning.spec.ts
[retrieval-tests]: ../../../../src/app/step-visuals/tests/retrieval.browser.ts
[isolation-tests]: ../../../../src/app/step-visuals/tests/isolation.spec.ts
[performance-tests]: ../../../../src/app/step-visuals/tests/layoutPerformance.spec.ts
