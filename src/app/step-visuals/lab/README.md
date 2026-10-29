# Card 1 guided activity and stage-preview lab

The default selector option mounts the independently reusable guided activity.
The lab and its direct stage previews remain available in development and deployed
previews, but are not exported with the activity.

The genuine sequence is Explore → Predict → Test → Explain → Try → Finished.
One changed committed placement enables
the compact footer Next action; the student then
chooses when to proceed. The selected orientation root is preserved through the
next two stages. Only a settled placement at −3 reveals the explanation. The moving
factor is masked in prediction and positioning. Next retains −3, displays
`(x + 4)` and enables dragging/keyboard adjustment and an immediately available Check.

Try evaluates only an explicit Check of the settled integer, using the target
linear factor evaluator (not the quadratic, which is zero at every movable root).
Dragging, snapping and keyboard placement cannot assess or complete the task.
Check and help actions are unavailable during an active edit. Accepted assessment
and panel actions increment the input revision so duplicate/stale actions are ignored.

Retrieval owns immutable evidence: `checkAttempts`, `incorrectChecks` and
`assistanceViewed`. A wrong Check records its checked root/attempt and offers help;
only a genuinely changed committed placement clears visible retry feedback.
Transient/cancelled/unchanged edits do not clear it. Help eligibility remains latched.
Requested help preserves the current root and keeps manipulation enabled, shows the
target equation/solution and retains Check in the footer. The explanation remains
visible during editing, without a Try again barrier. Check is unavailable during a
drag. An unsuccessful Check returns to the masked challenge, preserving assistance
evidence; assistance never places or submits the root.

A correct Check at −4 enters Finished, locks the root, unmasks its factor and shows
the zero substitution. `successMode` is explicitly `independent` unless the Guided
explanation was requested, otherwise `assisted`. Wrong attempts alone are not help.
Both modes have identical calm presentation, without scores or visible mode labels.
Preview E intentionally contains the answer but cannot affect Guided evidence;
independent therefore means no explanation request within Guided, not proof of no
answer exposure elsewhere. Start again resets the full guided lesson to root 3,
bounds [0,5], no prediction/assistance/attempt evidence and an unavailable Next.
The input revision increases and past pointer session IDs remain invalid. There is
no post-completion free-exploration state.

Try uses a portable `rootTaskLayout` scene to display `Factor: (x + 4)` separately
from `Root = ?` in place of the current function equation. It never claims that the
current plotted quadratic contains the target factor. Its graph description remains
masked, and the unknown factor never appears as an ambiguous visible equation.

Attempting the initially unavailable Next shows its prerequisite on demand. The
button uses aria-disabled rather than native disabled for this specific case; click,
tap, Enter and Space show a small positioned message and polite announcement without
dispatching a lesson action. Escape, blur and outside input dismiss the message.
This is ephemeral web presentation state, not progress or assessment state; the
tooltip occupies no layout space. Preview/inactive/active-edit controls remain blocked.

`RootsFactorsActivity` owns one composed reducer: portable `recordedLearningReducer`
wraps `learningReducer`, which delegates root transactions to `manipulationReducer`
before evaluating lesson transitions. Effects deliver already accepted records; they
never infer assessment or introduce another gesture system.

When inspecting a preview, the guided state owner stays mounted but renders no
view. Hiding or opening navigation cancels editing, advances the input revision,
and preserves the settled root and lesson. Returning restores that session; preview
interaction never dispatches to it. Restart guided activity requests a recorded
new attempt without remounting the owner. Leaving the actual experience (including Exit or the burger-menu
Sparkline preview entry) still ends the session according to the original navigation
contract. Sparkline preview selected through the dropdown preserves Guided state.

The lab-header selector selects authored fixtures:

- A — Explore: orientation at root 3.
- B — Predict: prediction at root 3, manipulation visually locked.
- C — Reveal: incorrect prediction and both substitutions at root −3.
- D — Retrieve: masked factor, target `(x + 4)`, retry feedback at root −3.
- E — Help: expanded retrieval explanation, preserving root −3.

Root dragging and keyboard adjustment work in A and D. B, C and E are
locked. Preview learning actions remain disabled. Choosing another fixture loads
its reference root and cancels any old input transaction; it does not represent
a learner's transition or a learner-controlled stage skip.

Pointer dragging uses a finite real-valued candidate in the reducer-owned editing
transaction. `math.movingRoot` remains the previous settled integer until release.
The graph's curve, root landmarks, vertex, marker, halo and hit region all use the
same continuous candidate. Cancellation discards it; release computes the final
pointer coordinate and commits its nearest permitted integer immediately.
Keyboard Arrow keys, Home and End continue to make whole-integer placements.
Visible adjustment buttons and the separate root-position strip have been removed;
the pure adjustment preparation and reducer placement actions remain available.
A touch-only learner who cannot drag needs an alternative input method. A labelled
position input opened on request is recommended, pending product approval.

`RootsFactorsScene.graphicalRoot` describes the actual geometry;
`displayRoot` is its nearest integer (half steps round away from zero). The
expression, root badge and slider announcements use `displayRoot`.
`expressionIsRounded` explicitly identifies the temporary presentation mismatch,
without adding new visible approximation notation. No independent display or
graphical state is stored. Graph accessibility text explains the rounding when
the graphical value is fractional, rather than describing the factor as exact.

`RootsFactorsLayoutPreview` retains its manipulation-only controller and mounts
the same `RootsFactorsView`, `ActivityFrame`, graph, expression, prompt and footer
navigation renderers as the guided activity. The selector, fixtures, restart control,
disclaimer and collapsed session-note probe are lab-only.
The selector and all five options must remain until the user explicitly authorises
removal. Any future teacher/student stage navigation is a separate product decision.
The session probe exists solely to test preservation and reset boundaries.

## Checkpoint 6: static sparkline comparison

Sparkline preview is available through the existing dropdown and the burger menu.
The dropdown suspends the Guided view while keeping its reducer mounted; changing
the lab-owned sparkline root never dispatches learning or manipulation actions.
The root selector starts at 3 and offers integers from −5 to 5. Menu interruption
disables it and preserves its selection. All nine reference samples share that value.

`Card1Sparkline` is independently reusable, bringing its own CSS Module. Its props
are `movingRoot`, `variant` (`complete`, `graphics-only`, `notation-only`), `width`
and `graphHeight`. Defaults are root 3, complete, 240px and 112px respectively.
The public v1 component and compositor validate settled integer roots from −5 to 5.
The three variants are compared at widths up to 160, 240 and 320px. Notation-only
has no graph node or reserved graph height. Both graphical variants use identical
graph dimensions and the same pure preparation pipeline.

`card1SparklineLayout` composes the existing factor formatting and quadratic model
with a dedicated compact graph layout. The browser width adapter reports available
space; the portable layout fits roots, vertex and origin with modest mathematical
padding, then expands the visible window to maintain equal horizontal/vertical unit
scales. Root/value and viewport changes deliberately alter this static framing;
the Guided coordinate frame is unaffected. The existing D3 sampling includes exact
roots and vertex, retains offscreen curve samples and uses SVG clipping. Coincident
roots use a fixed outer ring and moving inner dot at one exact centre. No sparklines
have gesture handlers, activity reducers, grids or general axis tick labels.
Both graphical variants show each root number directly below its marker; coincident
roots share one label. Label positions are prepared by the pure layout without
changing the coordinate frame, curve or marker geometry.

## Checkpoint 7: records and final fixes

See [learning-records.md](../learning-records.md) for the versioned callback/schema contract.
The lab is a sample client consumer, with an on-demand Learning records inspector.
Completed snapshots survive Start again; explicit lab restarts and exits preserve partial
data, and callbacks are delivered before navigation unmounts the activity. No persistence,
application user/card identifiers or refresh restoration are included.

The Next prerequisite hint adapts its width to text scaling without covering graph or
instructions. Axis colour is #7F8D83, exceeding 3:1 against #FFFDF8 with a margin.
Existing dragging/keyboard controls are unchanged. The non-drag touch alternative is parked.

Checkpoint 5 extends the retrieval lesson and explicit actions without teaching
renderers to assess answers or turning the lab selector into learner progression.
Root/lesson session assertions now supplement the original session-note probe.

Stage and retrieval-panel changes focus the new instruction heading, whose description
contains the instruction. A failed Check keeps focus on Check and announces prepared
retry feedback through a persistent polite status region. Each accepted retry has
a distinct announcement identity; no visible attempt counter is introduced.
Eligibility is announced through the same status region. Pointer
movement does not refocus or continuously announce state. Returning from a preview
leaves focus on the selector so keyboard preview navigation remains predictable.

Deep freezing remains active in production for newly prepared scenes. The view
memoizes preparation by mathematics, measured dimensions and display policy;
the cache is only a performance convenience, not a correctness dependency.
The fixed coordinate-plane scene is prepared separately by measured size, reused
by the pure compositor, and rendered by a memoized React component. Unchanged
prompt components are also memoized. Polynomial sampling validates the real root
once and avoids allocating factor arrays for every curve sample. Pointer events
still dispatch directly to React: no imperative SVG loop or frame-delayed second
mathematical state owner is introduced. Deep freezing remains enabled; local
fractional-layout timings are measured before considering additional optimisation.
`layoutPerformance.spec.ts` reports local diagnostic timings, not device targets.

The viewport-filling frame uses overlapping inaccessible, inert sizing slots for
the longest normal prompt, expression and footer navigation. All non-whitespace
prompt calibration characters, including signs and correctness labels, are replaced
with neutral tabular glyphs. Expression/navigation calibration is neutral too;
hidden sizing DOM does not retain solution text.
The graph absorbs remaining height (210px minimum, 480px maximum); stage content
cannot alter its geometry. Extra lab diagnostics sit below the activity surface.
