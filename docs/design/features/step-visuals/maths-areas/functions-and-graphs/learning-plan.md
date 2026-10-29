# Functions and Graphs — Learning Plan

**Status:** Proposed design for review, 28 October 2026. Companion to [Framework v2](Functions-Graphs-Framework-v2.md). The original documents are preserved. [Browse all annotated sketches](mockups/README.md) or [open the complete storyboard PDF](mockups/visual-storyboards.pdf).

## How to use this plan

This is a teaching and interaction plan, not a narration script or an engineering specification. Each item below corresponds to the same ID in the framework. A teacher should be able to picture the lesson, identify its central mathematical claim and prepare the recording from the points given. Step 3 specifies the kind of transfer and feedback required, without supplying a complete exam question.

**Learner:** A student ready for Leaving Certificate Higher Level, with Junior Cycle algebra and coordinates, meeting Senior Cycle functions for the first time. The main route is sequential; every card also has a direct-entry route through Rewind. Rewind reactivates named prerequisites and gives a small worked reminder rather than asking the learner to search a large deck.

**Pacing:** Step 1 targets two minutes and may reach 2½ minutes. Timings below are approximate recording beats, including the pad work and screen demonstration. If a recording repeatedly exceeds 150 seconds, reduce examples or move optional depth to an info card; do not narrate essential reasoning too quickly to follow. Interactive Step 2 normally has four stages. Its optional 20–45 second orientation clip demonstrates the control on a separate example. Video Step 2 lasts about 90–120 seconds, up to 150 where justified. Step 3's solution video targets two minutes and refers back to the relevant idea when explaining an error.

**Step 1 can stand on its own for the intended core exam task.** It states the necessary rule and demonstrates the basic technique. Step 2 can still create surprise by requiring a prediction in a new case, challenging the reach of a rule, or asking for a construction. We do not pretend a rule already stated in the video is an unseen revelation. An advanced learner may go straight to Step 3; a wrong answer can point to a specific investigation.

**Info cards:** Usually two or three candidates per item, with a maximum of five. Each may carry a short 1–2 minute video, but none is compulsory unless the learner needs its prerequisite repair. Labels used here—Rewind, Trap, Technique, Connection, Extension—describe editorial purpose; only Rewind is an established app label. Required content is never relegated to an optional extension to make the main card appear shorter.

### The common visual experience

The portrait composition follows the useful simplicity of integration: title and immediate instruction, a large mathematical object, one primary control or answer action, a compact mathematical consequence, then Previous/Next or Finished. Rewind sits in the card's supporting information rather than competing with the graph. Sketches show selected initial/comparison/reveal states; they are not exhaustive stage screens.

For every proposed interaction:

- The first instruction names an action and the object: “Move the right endpoint to 2”, “Choose which mapping breaks the rule”, or “Tap the interval where f is above g”. The orientation clip repeats the actual first gesture only as needed.
- Exploratory changes respond immediately. An answer is judged only after an intentional choice or Check. A learner passing through a correct slider position has not submitted an answer.
- One parameter changes at a time until combining changes is the mathematical objective. Fixed quantities remain visibly fixed. Controls are labelled with the quantity they affect.
- Dragging has an equivalent labelled slider, value input or select-and-adjust control usable without dragging, including by touch. A slider alone must not be assumed to solve every touch-assistive need. Mapping choices use buttons, not compulsory drag-and-drop. Keyboard, screen-reader text and sufficient touch targets are requirements of implementation.
- Labels, shapes and line styles distinguish roles as well as colour. Predictions do not expose their answers through a second representation or accessible text. A concise live readout describes meaningful changes.
- Axes stay stable across a comparison. A deliberate wider view is labelled as a change of viewing window; it does not silently change the domain. Equal axis scales are required for literal geometric reflections in y=x.
- Graphical readings are marked approximate when appropriate. Exact results come from the specified mathematics. No finite collection of pixels is presented as proof of a universal claim or a limit.
- Incorrect choices get a task-specific explanation and another opportunity. Help restores the relevant earlier reasoning. No extra button is required merely to resume manipulating the object.
- Each activity ends with **Finished**, a one-sentence mathematical conclusion and a route to the exam task. Four stages is a useful default, not an enforced Explore/Predict/Test template.

The [final story and reflection](#the-learning-story-and-final-reflection) traces all cards and records the conceptual gaps resolved during design. Verified syllabus and exam anchors, along with limitations of the source audit, are in the [framework coverage matrix](Functions-Graphs-Framework-v2.md#4-examination-coverage-and-evidence).

## Area A — A function is a relationship

**Area journey:** A familiar substitution becomes an input–output relationship; points make that relationship visible; restrictions and change give the graph meaning.

### FG-A1 — One input, one output

**Learning target:** Recognise a function and interpret its notation. The revealing contrast is that two inputs may share an output, but one permitted input cannot have two outputs. **Entry:** Substitute signed numbers into a simple expression.

**Step 1 video, 0:00–2:10:** Begin with a rule that assigns a delivery charge to each permitted distance; clarify that other factors have been fixed. Move to f(x)=x²: 2→4 and −2→4. Say what f, x and f(2) name, and contrast f(2) with solving f(x)=4. On the pad evaluate f(−3), then explain why a proposed input with two assigned outputs breaks the definition. Every declared domain element needs an output. Establish the definition completely; leave the learner to judge fresh mappings.

**Step 2: three-stage mapping comparison.** [Sketch](mockups/fg-a1.svg). Two labelled columns contain inputs −2, 0, 2 and possible outputs 0, 4, 7. Large numbered nodes and arrows occupy the middle of the screen; a sentence below describes the selected input.

1. **Trace:** “Tap an input. Follow its arrow.” Tap −2 and 2; both reach 4. The rule and a numerical substitution appear together.
2. **Judge:** Show three small selectable mappings: valid many-to-one, one input with two arrows, and a domain input with no arrow. “Choose the mapping that is a function.” The learner commits before explanations appear.
3. **Repair and transfer:** For an invalid mapping, choose which arrow to remove or which missing assignment to add. Explain that changing the domain would be a different repair, not an invisible deletion of an inconvenient input.

**Discovery / invariant:** All permitted inputs retain exactly one assignment; shared outputs are allowed. The clip shows how to tap a node, without identifying the valid challenge.

**Info cards:** Rewind—substitution and (−3)² versus −3². Connection—a rule can be given by a table, graph or words; a formula is not required. Extension—why a circle can be a relation without being y as a function of x.

**Step 3 transfer and feedback:** Evaluate notation and justify whether a finite mapping is a function. If the learner rejects shared outputs, return directly to the two arrows meeting at 4. No injective/surjective vocabulary is assessed yet.

### FG-A2 — From a rule to a graph — and back

**Learning target:** Read a graph as the set of permitted input–output pairs. **Entry:** A1; ordered pairs and axes.

**Step 1 video, 0:00–2:20:** For f(x)=x²−1, calculate the outputs at −2, −1, 0, 1, 2 and plot selected pairs. Explain why real inputs between the table entries also have outputs; a graph of this real-domain rule is a curve, not just five dots. Trace x=2 upwards to f(2)=3. Reverse the question: the horizontal line y=3 meets two inputs. Demonstrate how to label axes, scales and points. Distinguish plotting from sketching the important shape and landmarks. A finite table alone does not justify an arbitrary curve between its points.

**Step 2: four-stage input/output trace.** [Sketch](mockups/fg-a2.svg). A large graph shares one selected point with a small three-column input/output/coordinate strip. Vertical and horizontal tracing guides have different line styles.

1. “Move the input marker to 2.” The linked table row and point (2,3) illuminate.
2. “Set the output to 3. Select every input that gives it.” Switch to a horizontal guide. Keep both solutions visible after Check.
3. Compare the same rule with domain {−2,−1,0,1,2}. “Choose whether these points should be joined.” The domain label changes explicitly; the continuous curve disappears because the mathematical domain changed.
4. Read f(a) and solve f(x)=k on a supplied unfamiliar polygonal graph with no formula. The formula panel is replaced by “Read from the graph”; no new piecewise algebra is required.

**Discovery / invariant:** The graph and table encode the same pairs; a question may fix either coordinate. Orientation demonstrates the tracing guide, not the requested values.

**Info cards:** Rewind—coordinates and negative axes. Technique—estimate from a graph, calculate exactly from a formula. Trap—two sampled points do not prove a relationship is linear.

**Step 3 transfer and feedback:** Complete a small table, plot or sketch a supplied function and read outputs or level-set inputs. Feedback distinguishes an output, an input and a full coordinate pair.

### FG-A3 — Domain, range and the promised outputs

**Learning target:** Distinguish permitted inputs, attained outputs and declared codomain, including endpoint inclusion. **Entry:** A1–A2; number-line inequalities.

**Step 1 video, 0:00–2:30:** Show x² on −2≤x≤3. The input interval is the domain; tracing all permitted inputs gives range [0,9], with its minimum inside the interval. Display f:[−2,3]→ℝ: ℝ is the declared codomain, while only [0,9] is reached. In a quick finite mapping, show an unused codomain element. Explain open/closed endpoint notation. Give the natural-domain checks 1/(x−2): x≠2 and √(x−1): x≥1, stating why division by zero and a negative real square-root input fail. A supplied domain can be narrower than these natural restrictions.

**Step 2: four-stage domain window.** [Sketch](mockups/fg-a3.svg). The fixed full curve is a faint reference; only the currently permitted arc is solid. Domain is a horizontal strip below the graph and range a labelled vertical strip beside it. The rest of the curve is explicitly marked “excluded inputs”.

1. “Move the right endpoint from 3 to 2.” Observe the permitted graph and range shorten together.
2. “Move the left endpoint from −2 to 1.” With right endpoint 2, the minimum rises from 0 to 1. Explain why using only endpoint outputs would previously have missed the minimum.
3. Toggle inclusion of x=2; with domain [1,2), output 4 becomes excluded. Contrast excluding x=−2 while x=2 remains allowed: output 4 can still occur.
4. Give an unfamiliar restricted graph; select its domain and range from labelled intervals. A separate zoom illustration changes the window without changing either set.

**Discovery / invariant:** Restriction changes which pairs belong to the function; zoom changes what is visible. Endpoint exclusion does not always remove the corresponding output because another input may give it.

**Info cards:** Rewind—intervals, unions and ℝ. Trap—square root means the nonnegative root. Connection—physical domains, such as nonnegative time or whole item counts.

**Step 3 transfer and feedback:** State domain/range from a graph and simple algebraic restrictions. Codomain identification is included; classification as onto waits for F2. Feedback returns to an actual permitted input attaining any disputed output.

### FG-A4 — Reading change, signs and extremes

**Learning target:** Separate graph height from direction of change, and local claims from whole-domain claims. **Entry:** A2–A3.

**Step 1 video, 0:00–2:20:** Trace a supplied curve from left to right. Identify a section below the axis that is increasing, then one above the axis that is decreasing. Describe each using input intervals. Explain minimum value versus minimum point. A labelled valley is a local minimum because nearby values are no smaller; it need not be the global minimum. Show that domain endpoints can also give global extrema. Use a graph as evidence about the displayed domain; do not suggest the viewing window proves behaviour outside it.

**Step 2: four-stage claim investigation.** [Sketch](mockups/fg-a4.svg). A graph has an input cursor and paired readouts “Output sign” and “As x increases”. Only the readout relevant to the current task is emphasised.

1. “Move the point along the rising section below the axis.” The output remains negative while its value increases.
2. “Select where the function is decreasing.” Tap whole graph intervals; Check highlights the interval and explains left-to-right comparison.
3. Show a marked local valley at (0,5) in a small, explicitly labelled window of h(x)=5+x²−x⁴. Ask whether 5 must be the lowest value everywhere. “Show a wider view” reveals h(2)=−7 while preserving the marked valley. The whole domain was ℝ throughout.
4. On a new finite-domain graph, choose the global minimum including endpoints and state its value separately from its location.

**Discovery / invariant:** A point's height and the change around it answer different questions. Enlarging the window can refute a global claim without moving the original local valley. No derivative calculation is needed.

**Info cards:** Rewind—input intervals. Trap—a flat inflection is not necessarily a turning point. Connection—temperature can be below zero and still rising.

**Step 3 transfer and feedback:** Interpret signs, monotonic intervals and extrema; justify a local/global statement using a counterexample. The counterexample's formula is available for verification but not a differentiation task.

### FG-A5 — Lines: a constant rate of change

**Learning target:** Interpret and calculate constant rate, including units. **Entry:** A2, differences and division.

**Step 1 video, 0:00–2:15:** Begin with a model V(t)=2t+3 litres. Identify the starting amount and the increase per minute. On the graph calculate ΔV/Δt between (1,5) and (4,11): 6/3=2 litres per minute. Derive y=mx+c and find c by substitution. A negative m means decreasing outputs; m=0 is constant. Explain that a vertical line cannot be y=f(x), rather than calling its gradient zero. Keep rate different from height.

**Step 2: four-stage rate comparison.** [Sketch](mockups/fg-a5.svg). Two handles lie on a line; a thin rise/run triangle has exact labelled differences. A compact ratio sits below the graph; scales remain fixed.

1. “Move the second point along the line.” Rise and run change together; their ratio stays 2. Points cannot coincide while the ratio is evaluated.
2. Predict whether choosing points further apart changes the gradient; then compare a one-unit and three-unit interval.
3. “Raise the starting amount from 3 to 6.” The whole line rises, but equal-input changes remain unchanged. Follow with a negative-gradient preset.
4. Choose a line consistent with a stated initial value and rate, then verify using two labelled points. Explain the unit attached to m.

**Discovery / invariant:** Constant ratio of changes defines the linear relationship, independently of which distinct points measure it. A higher graph need not be increasing faster. The orientation clip shows selection of the second point and its value control.

**Info cards:** Rewind—subtracting negative coordinates. Technique—point–slope form as the same relationship anchored at a known point. Extension—equal screen angles can be misleading when axis units differ.

**Step 3 transfer and feedback:** Find a line from points or from a contextual rate and initial condition. Feedback identifies using y/x instead of Δy/Δx, reversing only one subtraction, or treating the first observed point as the y-intercept.

## Area B — A quadratic, several ways of seeing it

**Area journey:** A zero becomes a factor; squared distance explains a parabola; rewriting exposes its structure; a parameter then brings two roots together.

### FG-B1 — Roots, factors and intercepts

**Learning target:** Connect r, (r,0), f(r)=0 and the factor x−r. **Entry:** A1–A3; multiplication and brackets.

**Step 1 video, 0:00–2:15:** Use f(x)=(x+2)(x−3). A product is zero exactly when at least one factor is zero. Substitute −2 and 3, locate both axis points, and distinguish root values from intercept coordinates. Evaluate f(0)=−6 to find the y-intercept. Explain the apparent sign reversal in x+2 by solving x+2=0. Sketch the upwards parabola through its landmarks, with an explicit note that full vertex reasoning follows in B2.

**Step 2: four-stage adaptation of the existing roots activity.** [Sketch](mockups/fg-b1.svg). A fixed root at −2 and a movable root r sit on a parabola; the expression (x+2)(x−r) and labelled intercepts are linked. The current moving-root value is exact at settled positions and consistently approximate during movement.

1. “Move the right root. Watch its factor.” One factor stays fixed while the other changes.
2. Given a new factor, predict the root with its corresponding factor temporarily masked. Keep the target expression visibly distinct from the current function.
3. Check a deliberate root placement; show the substitution that makes the target factor zero. Touching the right position during exploration does not count as an answer.
4. On a fresh factor pair, identify both x-intercepts and compute f(0). Include one zero root so the x- and y-intercept can coincide.

**Discovery / invariant:** The moving factor always vanishes at its associated root. The existing activity supplies the central interaction; the y-intercept and two-root transfer require additional lesson content rather than pretending the current implementation already covers them.

**Info cards:** Rewind—zero-product rule and simple factorisation. Trap—a root is not the same kind of answer as an intercept coordinate. Extension—a nonzero leading multiplier changes heights without moving these roots.

**Step 3 transfer and feedback:** Solve a factorised quadratic and label its intercepts. A sign error routes to the zero substitution; missing y-coordinates routes to A2's point interpretation.

### FG-B2 — The vertex tells the shape

**Learning target:** Read a(x−h)²+k through squared distance and sketch a quadratic from its landmarks. **Entry:** A3–A4, B1.

**Step 1 video, 0:00–2:25:** Start with f(x)=2(x−1)²−3. At x=1 the squared distance is zero; everywhere else it is nonnegative. Therefore (1,−3) is the minimum point and the range is [−3,∞). Evaluate x=0 and x=2 to explain equal outputs on opposite sides of x=1. Change the coefficient to −2 and explain the maximum through the sign of the squared term. Sketch axes, vertex, symmetry, y-intercept and real roots when available; do not make a drawing depend on knowing derivatives. Define “vertex” as this parabola's turning point.

**Step 2: four-stage symmetric-point investigation.** [Sketch](mockups/fg-b2.svg). A large parabola has a marked vertex and two points linked by equal horizontal-distance guides. One control changes distance d; a later selector changes the coefficient.

1. “Move the point away from x=1.” Its paired point moves the same distance in the opposite direction. Both outputs stay equal.
2. Predict the output change when distance doubles. Square the distance on the pad/readout to explain the factor of four in the height above the vertex.
3. Switch a from 2 to −2. The reference vertex remains; the attainable side of its output changes. Nonzero coefficients only in this investigation.
4. Build a sketch from a supplied vertex form: place vertex, choose opening direction, then identify range. A restricted-domain variation tests whether the vertex is actually permitted.

**Discovery / invariant:** Equal distances from h give equal outputs; k is an extremum only when h is in the domain. Orientation shows the distance handle without explaining the prediction's numerical result.

**Info cards:** Rewind—squares and negative coefficients. Technique—roots' midpoint gives the symmetry axis when real roots exist. Connection—equal heights on ascent and descent in a simple projectile model.

**Step 3 transfer and feedback:** Sketch/read a vertex-form quadratic, state symmetry and range, and infer roots from the square equation. If the learner always chooses k as the restricted-domain minimum, return to the domain variation.

### FG-B3 — Completing the square; choosing a useful form

**Learning target:** Rewrite a quadratic without changing the function and select the form that answers the question. **Entry:** B1–B2; expansion.

**Step 1 video, 0:00–2:30:** Keep one graph visible while the pad calculation rewrites 2x²−8x+3 as 2(x²−4x)+3, then 2[(x−2)²−4]+3, then 2(x−2)²−5. Explain each compensation: the added 4 inside the bracket is multiplied by 2, so its total contribution is 8. Read the minimum (2,−5) and range. Briefly expand the completed form back as a check. Compare what expanded form exposes (y-intercept), factorised form exposes (real roots, when such a form exists), and vertex form exposes (extremum and symmetry).

**Step 2 video, about 110 seconds:** A static graph remains fixed while a second quadratic is rewritten as x²−6x+8=(x−3)²−9+8=(x−3)²−1 and also as (x−2)(x−4). Highlight the same roots, vertex and intercept in each representation. Ask which form makes each requested feature easiest to obtain. Include a negative leading coefficient in a brief final worked comparison, or move that extra worked example to an info card if it breaches the time budget.

**Why video:** The conceptual purpose of vertex form is already established. The new work is the equality-preserving calculation; a slider would not teach its compensation step. Use the graph as a stable check rather than inventing a separate manipulation task.

**Info cards:** Rewind—expanding a binomial square. Trap—forgetting the outside multiplier on the compensation. Extension—completing the square with fractional coefficients, including the full working.

**Step 3 transfer and feedback:** Complete a square and infer extremum/range or solve using the completed form. The solution video shows the bracket adjustment rather than jumping directly to the finished form. Factorised form over the reals is not promised when there are no real roots.

### FG-B4 — When roots meet and disappear

**Learning target:** Connect discriminant sign, vertex position and distinct real-root count. **Entry:** B2–B3; quadratic formula via Rewind.

**Step 1 video, 0:00–2:20:** Recall the quadratic formula and explain how the sign of Δ=b²−4ac determines the real square-root term. For f(x)=x²−4x+c, calculate Δ=16−4c and complete the square as (x−2)²+c−4. Both descriptions say the same thing: c<4 gives two distinct real roots; c=4 gives a repeated root; c>4 gives no real roots. Show the three cases and solve a simple parameter condition. State a≠0 for any general quadratic claim. Plant “No real roots—does that mean no roots of any kind?” as a later invitation.

**Step 2: four-stage threshold investigation.** [Sketch](mockups/fg-b4.svg). One parabola, fixed axes, a c slider and the discriminant readout. Roots are labelled only where real; no ghost intercepts appear below an inaccessible domain.

1. “Raise c towards 4.” Observe two root markers approach each other.
2. Predict the value of c at the touching event, then deliberately set it. Verify using both the squared expression and Δ=0.
3. Move above the threshold. The vertex rises but the graph still has real outputs; only its zero outputs disappear. Explain “one repeated root” versus “two distinct roots”.
4. Classify parameter ranges for a new downward-opening family. Choose the algebraic condition before the graph is revealed so the task transfers beyond the original orientation.

**Discovery / invariant:** The root count changes at the same threshold in the algebra and graph. The symmetry axis remains x=2 while c changes.

**Info cards:** Rewind—quadratic formula and real square roots. Trap—if a parameter can make a=0, analyse that linear case separately. Extension—a preview link to D6, clearly optional.

**Step 3 transfer and feedback:** Determine parameter ranges for two, one or no distinct real roots; include declared parameter restrictions. The solution explains the threshold condition before manipulating its inequality.

## Area C — Equations make comparisons

**Area journey:** Equal outputs become intersections; comparisons become intervals; distance gives another meaning to intervals; algebra then has to justify which answers survive.

### FG-C1 — Equal outputs: intersections

**Learning target:** Connect graphical intersection, algebraic equality and a zero difference. **Entry:** A5, B1–B3.

**Step 1 video, 0:00–2:20:** Compare f(x)=x²−1 and g(x)=x+1. At a common x, draw the two heights. Equality gives x²−x−2=0, hence x=−1 or 2. Substitute to obtain (−1,0) and (2,3). Emphasise that solving for x and reporting intersection coordinates are two steps. Define d(x)=f(x)−g(x); its roots have the same input coordinates, though its graph is a different curve. A plotted intersection normally gives an estimate; factorisation establishes these exact values.

**Step 2: four-stage comparison.** [Sketch](mockups/fg-c1.svg). Two labelled curves share a cursor. A vertical segment records f(x)−g(x), with its sign; the compact difference graph is introduced only in stage 3.

1. “Move the input until the two outputs agree.” Read both outputs at the same x.
2. Move a line's intercept and predict whether intersections will be two, one or none; verify the touching case as equality, not a crossing requirement.
3. “Show the difference.” The vertical separation is transferred to d(x). Original intersections and difference roots are linked by vertical guides, not visually merged.
4. On a fresh line/parabola pair, estimate an intersection input, then choose the exact algebraic equation to solve and supply its output coordinate.

**Discovery / invariant:** Same input and equal output define the event. Subtraction changes the representation but preserves its solution inputs. Orientation shows the shared cursor and the distinction between curve labels.

**Info cards:** Rewind—factorisation and substitution. Trap—dividing x²=x by x loses x=0. Connection—two pricing rules agree at an intersection.

**Step 3 transfer and feedback:** Solve a line/quadratic comparison and report the requested inputs or points. If only one branch is found, feedback asks whether every permitted equality has been considered; it does not infer exactness from proximity on screen.

### FG-C2 — Inequalities: whole intervals of answers

**Learning target:** Solve a comparison over all relevant inputs, with correct endpoints and signs. **Entry:** C1, B1; order on a number line.

**Step 1 video, 0:00–2:25:** Continue the same pair. f(x)>g(x) becomes (x−2)(x+1)>0. Mark −1 and 2, test one input in each interval, and explain why a polynomial's sign cannot change inside an interval containing no root: its graph has no breaks, so moving between positive and negative outputs would require passing through zero. Obtain x<−1 or x>2. Contrast ≥ with > at the roots. Demonstrate −2x<6 ⇔ x>−3 using number-line order; when multiplying by an expression with unknown sign, first determine its sign or use a sign analysis. Rational cases will be treated in G5.

**Step 2: four-stage interval selection.** [Sketch](mockups/fg-c2.svg). The two curves sit above a number line divided at intersections. An alternative difference view uses the same x-axis; shaded solutions project onto the number line.

1. “Tap every interval where f is above g.” Check commits a set of intervals, not a single test point.
2. Select > or ≥; choose open or closed root markers. The equality decision changes endpoints without changing interval interiors.
3. Compare f(x)<g(x). Ask whether multiplying the difference by −1 preserves the same sign symbol; a paired number-line illustration explains the reversal.
4. Solve a fresh factorised inequality with a repeated root. A concise bridge recalls that a squared nonzero factor is positive; sign need not change at every root. D2 will develop its graph shape.

**Discovery / invariant:** The comparison holds throughout each chosen interval; roots mark boundaries, not the complete answer. Repeated roots are introduced here only as a sign example, without presuming later multiplicity terminology.

**Info cards:** Rewind—union and interval notation. Technique—testing one point works because the continuous polynomial has no zero inside the interval. Trap—dividing ax>6 requires cases a>0, a<0, a=0.

**Step 3 transfer and feedback:** Solve a quadratic inequality and state an interval set. Wrong endpoint inclusion routes to the equality toggle; indiscriminate sign alternation routes to the squared-factor comparison.

### FG-C3 — Absolute value is distance

**Learning target:** Translate a distance condition into one interval or two exterior intervals. **Entry:** A2, C2.

**Step 1 video, 0:00–2:15:** Define |x−2| as the distance from x to 2. |x−2|<3 means −1<x<5; |x−2|>3 means x<−1 or x>5. Show equality gives the two boundary points. On the pad connect distance to the two cases for the sign of x−2, then plot y=|x−2| and compare with y=3. State the crucial condition: a distance is nonnegative, so negative thresholds need separate reasoning.

**Step 2: four-stage distance gate.** [Sketch](mockups/fg-c3.svg). A labelled centre and movable point appear on a number line above a V-shaped distance graph. A line at height r marks the allowed distance; only one adjustable value is active at a time.

1. “Move x. Watch its distance from 2.” Points on opposite sides produce the same positive distance.
2. “Choose all positions less than 3 units from 2.” Shade the interval, then link it to the part of the V below y=3.
3. Switch “less than” to “greater than”. The allowed region becomes two exterior pieces; toggle equality separately.
4. Transfer to |2x−4|≤6. First rewrite 2|x−2|≤6 in the visible explanation; the same distance rule then applies. Include a negative-threshold choice as a brief final check.

**Discovery / invariant:** Absolute value measures a distance. The graph and number line describe the same permitted inputs. Orientation shows moving x and the distance label; it does not pre-shade the task's answer.

**Info cards:** Rewind—compound inequalities. Trap—|x|=−3 has no real solution, whereas |x|>−3 holds for every real x. Connection—a tolerance of 0.2 units around a target measurement.

**Step 3 transfer and feedback:** Solve an absolute-value equation or inequality, including a simple linear expression inside. Feedback identifies confusing “outside” with “between”. Transforming an arbitrary graph with absolute values is deferred to E4.

### FG-C4 — Candidates are not yet solutions

**Learning target:** Distinguish implications from reversible steps and check the original problem. **Entry:** A3, B1, C1; nonnegative square-root convention.

**Step 1 video, 0:00–2:25:** Solve x=√(x+6). The radical requires x≥−6, and equality to its nonnegative output further requires x≥0. Squaring gives x²=x+6 and candidates −2,3; substitution into the original keeps only 3. Show that 2 and −2 have the same square: sign information was lost. Briefly contrast dividing x²=x by x, which can lose the valid answer x=0. Finally distinguish a true polynomial root at negative time from an extraneous root: the former can fail the model's context while still satisfying its algebra.

**Step 2: four-stage original-versus-transformed comparison.** [Sketch](mockups/fg-c4.svg). Initially y=x and y=√(x+6) share axes. A clearly labelled “After squaring” comparison switches to y=x² and y=x+6; candidate chips preserve the two x-values across the switch.

1. “Find where the original outputs agree.” Identify the intersection at x=3.
2. Predict whether squaring keeps exactly the same answers. Switch views; the second candidate at −2 appears.
3. “Test −2 in the original equation.” Show −2 on one side and √4=2 on the other, with the original curves visible again. This explains the failure, not merely a red cross.
4. Classify a fresh candidate as valid, excluded by the original expression, or excluded only by a stated physical domain. Supply the original conditions on the same screen.

**Discovery / invariant:** A solution must satisfy the original equation and its declared conditions. The candidate list from a transformed equation is evidence to check, not an automatic answer set.

**Info cards:** Rewind—principal square roots and checking by substitution. Technique—record restrictions before manipulating. Extension—when an implication can be reversed after adding a sign condition.

**Step 3 transfer and feedback:** Solve a radical equation and verify candidates. The solution video shows the original substitution and explains whether the error arose from squaring, undefined input, or contextual admissibility.

## Area D — Polynomial structure and mathematical evidence

**Area journey:** Move beyond parabolas, explain local crossing behaviour with factors, then use algebraic structure to justify what the graph suggests. D6 is the optional return at the end of the main route.

### FG-D1 — Cubics and the ends of a graph

**Learning target:** Sketch polynomial shape from roots, leading term and sign information without inventing exact turning points. **Entry:** B1–B2, A4.

**Step 1 video, 0:00–2:20:** Use f(x)=(x+2)x(x−2)=x³−4x. Locate roots and the y-intercept. For large |x| the cubic term controls the ends: left down, right up; reversing the leading sign reverses both. Compare x³+x, whose only real root is zero because x²+1>0. Thus cubic does not mean three distinct real roots. Briefly contrast an even-degree leading term, whose two ends point the same way. Sketch the broad shape and label only known landmarks; locating exact extrema is separate work.

**Step 2: four-stage structural sketch.** [Sketch](mockups/fg-d1.svg). A cubic appears with its factored or expanded expression and quiet arrows at the window edges. Presets change one structural feature; the axes do not auto-fit to hide magnitude changes.

1. “Choose the direction of each end.” Check, then expose the leading term and its sign for large positive/negative inputs.
2. Switch between x³−4x and x³+x. Read the number of real intercepts and explain why a degree is not a count of distinct visible roots.
3. Change the leading multiplier from 1 to −1. Roots remain fixed while all output signs reverse.
4. Assemble a sketch from supplied distinct roots and a positive leading coefficient. Choose a valid shape among alternatives rather than drawing a pixel-perfect curve. The graph need not have a root at every turn.

**Discovery / invariant:** The ends are constrained by degree and leading sign; root locations alone do not locate exact extrema. The orientation clip demonstrates switching a preset and reading the end arrows.

**Info cards:** Rewind—degree and leading coefficient. Trap—part of a curve outside the window is not absent from the function. Extension—why a degree-n nonzero polynomial has at most n distinct roots, using the factor/degree reasoning developed in D3–D4.

**Step 3 transfer and feedback:** Sketch a simple factorised cubic with intercepts and end behaviour. No derivative-based extrema are required. Feedback separates incorrect signs from unsupported precision.

### FG-D2 — Crossing, touching and repeated roots

**Learning target:** Explain local sign behaviour through multiplicity. **Entry:** D1, B1, C2.

**Step 1 video, 0:00–2:15:** Compare (x−1), (x−1)² and (x−1)³ just to either side of 1. Odd powers change sign; even powers do not. In f(x)=(x−1)²(x+2), the other factor is nonzero and keeps its sign close enough to x=1, so it does not change that conclusion. Explain multiplicity and distinct roots: x=1 counts twice algebraically but names one input. A triple root crosses while flattening; repeated does not always mean touching and turning.

**Step 2: four-stage multiplicity comparison.** [Sketch](mockups/fg-d2.svg). Keep roots at −2 and 1. Buttons labelled power 1, 2, 3 change only the exponent of x−1; a small sign strip shows values just left and right of 1.

1. “Choose power 1. Compare the signs either side of x=1.” The graph crosses.
2. Predict power 2's behaviour, then switch. The root remains at the same input; its neighbourhood stays on one side of the axis.
3. Switch to power 3. Observe the flattened crossing and verify signs numerically. Describe the visual flatness without derivative notation.
4. Given a fresh factored polynomial, choose crossing/touching at each root and count distinct roots separately from multiplicities. Keep other roots distinct so the stated multiplicities remain correct.

**Discovery / invariant:** Root position is unchanged while local sign behaviour follows exponent parity. The explanation comes from factor signs, not the apparent thickness of the curve near the axis.

**Info cards:** Rewind—signs of powers. Trap—two coincident linear factors form one repeated root. Connection—a repeated root is a limiting case of two nearby simple roots; return to B4.

**Step 3 transfer and feedback:** Sketch a polynomial with repeated factors, state multiplicities and explain sign changes. A wrong “every root crosses” answer returns to the sign strip, while a wrong “every repeat touches” answer returns to the cubic factor.

### FG-D3 — Factor and Remainder Theorems

**Learning target:** Understand why evaluating P(r) tests division by x−r, and use it to find a parameter. **Entry:** B1; polynomial expansion.

**Step 1 video, 0:00–2:20:** Begin with ordinary division: dividend equals divisor times quotient plus remainder. For a linear polynomial divisor, the remainder is a constant: P(x)=(x−r)Q(x)+R. Substitute x=r; the product vanishes, so P(r)=R. Zero remainder is exactly the factor case. Work P(x)=x³+ax+6 with factor x−2: P(2)=8+2a+6=0 gives a=−7. Show the graph passes through (2,0), but substitution establishes it exactly.

**Step 2 video, about 100 seconds:** Use a nonzero remainder to demonstrate why “not a factor” is still useful information. For P(x)=x³−x+1, division by x−2 leaves P(2)=7. Present the identity with a supplied quotient and check by expansion. Then interpret the divisor 2x−3: its zero is 3/2, so evaluation at 3/2 finds the constant remainder. This latter case is an extension if the recording would exceed 150 seconds.

**Why video:** The essential discovery is a short algebraic argument. A graph can illustrate zero remainder but cannot replace the division identity. Use a simple highlighted substitution animation and pad working.

**Info cards:** Rewind—what quotient and remainder mean. Trap—x+3 calls for P(−3). Extension—remainders for non-monic linear divisors, with the reason the zero of the divisor is the useful input.

**Step 3 transfer and feedback:** Show a linear factor, find a remainder or determine a coefficient from a supplied factor. Feedback asks which value makes the divisor zero. The method for computing Q(x) is taught in D4, not silently assumed here.

### FG-D4 — Divide, reduce, solve

**Learning target:** Recover the remaining polynomial factor and all real roots from a known factor. **Entry:** D3, quadratic factorisation; polynomial term order.

**Step 1 video, 0:00–2:30:** Work P(x)=x³−4x²+x+6 with the supplied factor x−2. Briefly verify P(2)=0. Carry out long division in aligned columns: choose x², subtract its product; choose −2x, subtract; choose −3, subtract. Obtain Q(x)=x²−2x−3=(x−3)(x+1). Explain why P(x)=(x−2)(x−3)(x+1) gives roots 2,3,−1. Reconstruct the product as a check; do not stop at the quadratic quotient or forget the supplied root.

**Step 2 video, about 120 seconds:** Repeat the process with a missing-power coefficient, explicitly writing a zero placeholder, and make the subtract-the-whole-row operation visible. Pause briefly for the learner to choose the next quotient term before continuing. Tie each subtraction to cancelling the current leading term. A non-monic divisor is optional additional practice, not part of the core exam transfer for this card.

**Why video:** The assessed skill is following and carrying out an algorithm with controlled algebra. Reusing the graph is useful for checking roots; dragging a curve does not explain why each division term is chosen.

**Info cards:** Rewind—factorising the resulting quadratic. Technique—zero placeholders and checking by multiplication. Extension—synthetic division as an alternative for x−r, with its restricted applicability explained.

**Step 3 transfer and feedback:** Factor and solve a cubic given a linear root/factor, with full intermediate working. A sign error routes to subtracting the entire product; a missing root routes to the complete factorisation. Degree and root counting are connected to D1 without assuming non-real-root methods.

### FG-D5 — Identities: true for every input

**Learning target:** Distinguish an identity from an equation and infer unknown coefficients. **Entry:** A1 substitution; D3–D4 expansion and coefficients.

**Step 1 video, 0:00–2:20:** Compare x²=4, true at selected inputs, with (x+1)²≡x²+2x+1, true for every real x. Explain the identity symbol and matching corresponding coefficients after expansion. Work (x+a)(2x−3)≡2x²+bx+12: the constant gives a=−4 and the x coefficient gives b=−11. One numerical agreement can check a candidate but cannot establish this identity for all x. Equality of the expanded coefficients does.

**Step 2 video, about 120 seconds:** Investigate h(x+1)=h(x)+2 within h(x)=ax²+bx+c. Expand both sides explicitly, compare x coefficients to obtain a=0, then constants to obtain b=2; c stays free. Show why a quadratic candidate cannot keep the same output increase for every unit input increase. The conclusion is a line within this stated family, not a claim about all conceivable functions.

**Why video:** Coefficient comparison needs a connected calculation. A few agreeing graph samples would risk teaching that numerical agreement proves an identity. A short moving-point illustration may show the resulting line after the proof.

**Info cards:** Rewind—collecting like powers. Trap—a single counterexample disproves “for every x”, but a single match does not prove it. Extension, after I1—2x+sin(2πx) also satisfies the shift identity; it lies outside the quadratic family. This is a return visit, not unexplained trigonometry in the main lesson.

**Step 3 transfer and feedback:** Determine coefficients in a polynomial identity. Functional identities are a harder transfer demonstrated in Step 2; a Step 3 using that harder form must be labelled accordingly. The core Step 3 remains accessible after Step 1. Feedback identifies treating x as the unknown to solve instead of matching a whole polynomial.

### FG-D6 — Where did the roots go? Optional epilogue

**Learning target:** Broaden the number system without confusing real graphs with complex root locations. **Entry:** B4 and D2. This card introduces its minimal complex-number vocabulary; it can be revisited after a separate complex-number course.

**Step 1 video, 0:00–2:25:** Return to (x−2)²+k with k positive. Its real graph has no zero output. Define i by i²=−1 and substitute z=2+i into (z−2)²+1 to verify zero; 2−i also works. Explain real and imaginary parts and the Argand point (2,1). State clearly that this diagram locates the number 2+i; it is not the point (x,f(x))=(2,1) on the original real graph. State the conjugate pairing for real-coefficient polynomials, with direct verification in this example. Leave the general theorem and complex arithmetic course as later study.

**Step 2: four-stage roots in two representations.** [Sketch](mockups/fg-d6.svg). On phones, two compact stacked panels are permanently titled “Real-input graph: (x,f(x))” and “Root locations: (Re z, Im z)”. Their axes and roles remain distinct. A shared k control changes the polynomial, not the axis meanings.

1. Start k=−1: two real roots 1 and 3 are shown on the real graph and as real-axis points in the root-location panel.
2. Set k=0: roots merge at 2, with “multiplicity 2” shown rather than two falsely separated markers.
3. Move k to 1: the real graph loses its intercepts; root locations become 2±i. The displayed calculation verifies each root.
4. Predict and verify roots for k=4: 2±2i. Ask which, if any, are real x-intercepts. Completion preserves “No real intercepts; two non-real roots”.

**Discovery / invariant:** The polynomial equation still has two complex roots counted with multiplicity; the real plot displays only real-input/real-output pairs. It has not secretly grown a new visible crossing.

**Info cards:** Rewind—discriminant and repeated roots. Connection—complex numbers later help describe rotations and oscillations. Extension—why real coefficients make conjugate roots travel in pairs; demonstrate by conjugating the equation.

**Step 3 transfer and feedback:** Verify a supplied complex root or interpret a real-coefficient conjugate pair. This is extension progress, not a hidden requirement for the core Functions and Graphs pathway. Feedback checks that the learner has not mistaken imaginary part for f(x).

## Area E — Change the input or change the output

**Area journey:** A familiar point becomes a reference that survives increasingly complex changes. Tracking what the new expression needs as its input removes the need for unexplained sign rules.

### FG-E1 — Translations and their surprising direction

**Learning target:** Derive a horizontal or vertical translation from the meaning of the input/output change, including endpoints. **Entry:** A1–A3.

**Step 1 video, 0:00–2:20:** Use an asymmetric supplied graph, with a named point f(1)=3 and domain [−1,3]. In f(x)+2 the old output becomes 5 at the same input. In f(x+2), ask what x makes the inner input equal 1: x+2=1 gives x=−1. Thus the corresponding point moves left. Apply the same argument to the domain: −1≤x+2≤3 gives −3≤x≤1. Teach the general point changes (u,v)→(u,v+k) and (u,v)→(u−h,v), with a complete example.

**Step 2: four-stage corresponding-point translation.** [Sketch](mockups/fg-e1.svg). Original graph is dashed and transformed graph solid; one distinctive corner and both endpoints are labelled. A single slider changes either the inside or outside amount, selected in plainly written expressions.

1. “Move the output up by 2.” Observe unchanged inputs and changed outputs.
2. Given f(x+2), predict the new location of the marked corner before revealing the transformed curve. An “input needed” strip shows x+2=u after Check.
3. Move a domain endpoint by following the same point correspondence. The domain readout moves with the graph.
4. Transfer to a negative translation and a graph with no formula. The learner locates corresponding points and states the transformed domain.

**Discovery / invariant:** Corresponding outputs are reached at different inputs for a horizontal shift; shape and pairwise displacements are preserved. Orientation uses an outside shift, leaving the inside-shift prediction untouched.

**Info cards:** Rewind—solve a simple equation for the required input. Trap—graph movement and panning the viewport are different. Connection—why vertex-form x−h puts the vertex at h.

**Step 3 transfer and feedback:** Transform a supplied graph and its domain. Feedback solves the inner-input equation for one landmark rather than repeating “inside signs are backwards”.

### FG-E2 — Reflections and scaling

**Learning target:** Track input and output multiplication, including reciprocal horizontal factors and reflections. **Entry:** E1.

**Step 1 video, 0:00–2:25:** Starting from a point (6,4), show 2f(x)→(6,8) and f(2x)→(3,4), because 2x=6. Then show −f(x) reflects outputs in the x-axis, while f(−x) reverses inputs across the y-axis. Explain positive compression factors and negative factors through this same correspondence. State b≠0 for reciprocal input-scaling rules; f(0x) is a different constant-function case when 0 is in the original domain.

**Step 2: four-stage scale and reflection comparison.** [Sketch](mockups/fg-e2.svg). Use an asymmetric piecewise-linear reference shape so reflections visibly differ. One labelled point travels from the dashed original to the solid result; axes and scales stay fixed.

1. “Double the output.” Track each y-coordinate while x stays unchanged.
2. “Now double the input inside f.” Predict the new x-coordinate, then check the equation bx=u. Domain endpoints change by the same rule.
3. Compare the two negative-factor expressions. Later switch to an even graph and explain why a y-axis reflection can leave it unchanged; symmetry is a special case, not a failed control.
4. Match a requested point correspondence to an expression, including a scale factor of 1/2. Output and input controls are separate tasks, not simultaneously active sliders.

**Discovery / invariant:** Inside multiplication changes the input needed to obtain the old output; outside multiplication changes the output itself. Negative multiplication reverses the relevant coordinate.

**Info cards:** Rewind—reciprocals and negative coordinates. Trap—reflection in the x-axis changes y, not x. Extension—the degenerate b=0 and a=0 cases, with their domains stated.

**Step 3 transfer and feedback:** Sketch a reflected/scaled graph or transform a point and domain. Feedback uses a labelled pair to diagnose reciprocal-factor and axis errors.

### FG-E3 — Combined transformations and restricted domains

**Learning target:** Interpret a compound expression by a coordinate rule and avoid ambiguous order shortcuts. **Entry:** E1–E2, C2.

**Step 1 video, 0:00–2:30:** Write g(x)=a f(b(x−h))+k. To reuse an old input u, solve b(x−h)=u, hence x=h+u/b; its output v becomes av+k. Work g(x)=2f(3(x−1))−4 on the point (6,5), obtaining (3,6). Show f(2x+4)=f(2(x+2)), so its old input u appears at x=u/2−2. For a restricted original domain, solve the same inner-input inequality; with negative b, reorder the endpoints. The expressions, rather than a memorised universal order phrase, settle the result.

**Step 2: four-stage transformation construction.** [Sketch](mockups/fg-e3.svg). A short stack of expression changes sits above one graph; the marked point and domain endpoints persist. The learner chooses transformations in order, with the resulting formula always visible.

1. Apply an output stretch then an output shift; compare with reversing those operations. Use 2f+3 versus 2(f+3) so the distinction is concrete.
2. For a supplied combined expression, predict one new landmark before the whole graph is shown.
3. Move both restricted-domain endpoints using the same inner-input equation; introduce a negative input factor only after the positive case is settled.
4. Build a target graph from a reference using a short sequence, then verify its formula by one point and its domain. Numerical point checks support the derived rule; they are not claimed as proof for arbitrary functions.

**Discovery / invariant:** Every corresponding point obeys the same input/output calculation. Different instruction sequences may produce different expressions; sometimes different sequences are equivalent, so accept mathematically equivalent constructions.

**Info cards:** Rewind—factor an inner linear expression. Technique—write “old input = inner expression” before rearranging. Trap—do not apply x→x/b−h to b(x−h); solve the equation correctly.

**Step 3 transfer and feedback:** Describe combined transformations, map a point and state a transformed domain. Feedback locates the first incorrect coordinate calculation rather than rejecting an alternative but equivalent verbal order.

### FG-E4 — Two meanings of absolute value on a graph

**Learning target:** Distinguish changing outputs from selecting and reflecting original inputs. **Entry:** C3, E1–E2, A3.

**Step 1 video, 0:00–2:20:** Choose f(x)=x−1. For |f(x)|=|x−1|, negative output points reflect upwards; nonnegative outputs remain. For f(|x|)=|x|−1, each input first becomes nonnegative, so the original right-hand branch supplies both sides. Calculate at x=−2: the two outputs are 3 and 1. Explain that |f| preserves the original domain, while the domain of f(|x|) is the set of x with |x| in the original domain. Show one restricted-domain example without assuming both transformations always use the whole real line.

**Step 2: four-stage branch tracing.** [Sketch](mockups/fg-e4.svg). A dashed original and one solid result share fixed axes. Buttons show the full expressions |f(x)| and f(|x|); a highlighted source point explains which original pair produces the new pair.

1. “Choose |f(x)|. Follow a point below the axis.” Its height becomes its distance from the axis; its input stays fixed.
2. Predict f(|x|) at a negative input; trace to the original positive input before drawing the mirrored point.
3. Compare the two graphs together only after their constructions are understood. Ask which source points were retained, reflected or unused.
4. Transfer to an unfamiliar asymmetric graph restricted to [−1,3]. Derive the new domain of f(|x|) as [−3,3]; only the original nonnegative branch contributes. Include a labelled boundary check.

**Discovery / invariant:** The location of the absolute-value bars tells us which quantity becomes nonnegative. Original negative-input data is not generally used by f(|x|).

**Info cards:** Rewind—absolute value and point reflection. Trap—an even original function can make f(|x|)=f(x), concealing the operation. Extension—apply an output fold to a sine graph after I2.

**Step 3 transfer and feedback:** Sketch an absolute-value transformation from a supplied graph, with domain. Feedback traces one mistaken point back to its source rather than relying on the V shape of a familiar special case.

## Area F — Combine and reverse functions

**Area journey:** Input/output roles become operations on functions themselves. Chaining raises a domain question; reversing raises uniqueness and codomain questions; algebra then verifies the reversal.

### FG-F1 — Composition: the output becomes an input

**Learning target:** Follow and calculate a composition in the correct order, using mappings, formulas and graphs. **Entry:** A1–A3, C4.

**Step 1 video, 0:00–2:25:** Run an input through g(x)=x−3 then f(x)=√x. Name the intermediate value and write f(g(x))=√(x−3), with x≥3. Reverse the order to obtain g(f(x))=√x−3, with x≥0. Explain that this is not multiplication. Give the domain rule in words: x must be accepted by the first function, and its output by the second. Briefly follow the same process using a supplied graph rather than a formula.

**Step 2: four-stage function relay.** [Sketch](mockups/fg-f1.svg). Three large value boxes—input, intermediate output, final output—are joined by two labelled function arrows. In graph mode, one large graph is traced twice, with the intermediate number visibly returning to the input axis.

1. “Choose x=7. Send it through g, then f.” The intermediate 4 is not skipped.
2. Predict the reversed result before choosing “Reverse order”. The input remains 7; the functions exchange order.
3. Try x=2 in f(g(x)). Mark the first invalid stage: g(2)=−1 is valid, but f cannot accept −1. Keep the reason local to that stage.
4. Evaluate q(q(2)) from a supplied piecewise-linear graph with points (0,0),(2,1),(4,3). Read q(2)=1, then q(1)=1/2. No piecewise formula is needed; the line segment supplies the second reading.

**Discovery / invariant:** Each output becomes the next input; the same rule governs symbolic and graphical composition. Orientation demonstrates advancing one arrow and identifies the intermediate box, without supplying the challenge path.

**Info cards:** Rewind—square-root domains. Trap—q(q(x)) differs from q(x)². Extension—a composition may be defined on some inputs even if the first function's entire range is not accepted by the second.

**Step 3 transfer and feedback:** Calculate a composite, state its domain, or trace a repeated graph input. Feedback identifies the actual order and the first failed domain condition.

### FG-F2 — One-to-one, onto and bijective

**Learning target:** Judge two independent mapping properties relative to the declared sets. **Entry:** A1, A3, F1.

**Step 1 video, 0:00–2:25:** Begin with a valid function between finite sets. Injective means different inputs never share an output; surjective means every declared codomain element is reached. Bijective means both. Show all four possibilities with small mappings, then connect injectivity of a real-valued function to the horizontal-line test. Explain why the vertical-line test checks whether something is a function instead. For x²:ℝ→ℝ, show a collision and negative codomain values that are not reached. Restricting only the codomain to [0,∞) repairs onto but leaves collisions.

**Step 2: four-stage mapping repair.** [Sketch](mockups/fg-f2.svg). Two compact set panels have labelled members and distinct input/output arrow markers. Buttons change one assignment or the declared codomain; no free arrow dragging is required.

1. “Find two inputs sharing an output.” Select a pair; the collision is shown without calling the function invalid.
2. “Select the codomain elements never reached.” Distinguish unused possibilities from actual outputs.
3. Remove an unused codomain element using an explicit “Change codomain” action. Mapping arrows stay unchanged; onto status changes. Contrast a separate “Change domain” action that removes a colliding input.
4. Classify a new finite mapping and a real graph. Provide two separate yes/no decisions and explanations; one property cannot be inferred from the other.

**Discovery / invariant:** The function condition remains satisfied while injectivity and surjectivity vary independently. A smaller codomain must still contain every actual output; invalid choices are explained, not silently accepted.

**Info cards:** Rewind—domain/range/codomain. Trap—many-to-one can still be a function. Technique—show a linear function is injective by f(a)=f(b)⇒a=b, with one complete example.

**Step 3 transfer and feedback:** Classify and justify properties from diagrams or simple formulas. Algebraic injectivity proof is a demonstrated info-card technique for a harder transfer, not silently required by the basic diagram question.

### FG-F3 — Inverse graphs and choosing a branch

**Learning target:** Explain inverse graphs as reversed pairs and make reversal single-valued through a suitable domain. **Entry:** F2, B2, E2.

**Step 1 video, 0:00–2:25:** Reverse (1,3) to (3,1) and explain reflection in y=x using equal axis scales. For x² on ℝ, output 4 could have come from 2 or −2, so its reverse relation is not a function. Restrict to x≥0 and declare codomain [0,∞); the bijection has inverse √x. State the domains and ranges of both. Explain the alternative negative branch if the original domain is x≤0. An injective function has an inverse on its range; an inverse defined on the entire declared codomain requires bijectivity.

**Step 2: four-stage reversal.** [Sketch](mockups/fg-f3.svg). The original graph and y=x guide share square grid units. A chosen point has a coordinate chip; “Swap coordinates” places its corresponding inverse-relation point. Domain options are explicit.

1. “Swap the marked point's coordinates.” A few linked points establish the reflection before a complete inverse graph appears.
2. Reverse the full parabola and inspect input 4 on the reversed relation. Two outputs explain why it fails the function test.
3. “Keep the original inputs x≥0.” The unused branch fades as excluded; the retained branch reverses to √x. Keep the declared codomain visible.
4. Reverse a new increasing polygonal graph, then compare choosing the negative branch of the parabola. State the new domain and range rather than merely drawing a reflected shape.

**Discovery / invariant:** Each reversed pair exchanges roles; uniqueness depends on the original allowed inputs. Reflection is in y=x, not a swap of axis labels on an unchanged drawing.

**Info cards:** Rewind—injective and onto. Trap—f⁻¹(x) is not 1/f(x). Extension—f⁻¹(f(x))=x only on the original domain; √(x²)=|x| on ℝ.

**Step 3 transfer and feedback:** Sketch an inverse, justify a restriction and state domain/range. A wrong negative branch is judged against the declared original domain, not an automatic preference for positive roots.

### FG-F4 — Find and verify an inverse

**Learning target:** Derive an inverse algebraically and verify the domain-qualified reversal. **Entry:** F1–F3; rearranging formulae.

**Step 1 video, 0:00–2:30:** For f(x)=(2x+1)/(x−3), x≠3, write y=f(x), then yx−3y=2x+1, then x(y−2)=3y+1, and x=(3y+1)/(y−2). Rename the input to obtain f⁻¹(x)=(3x+1)/(x−2), x≠2. Explain that output 2 of f is impossible by solving y=2 in the original expression. Verify one composition with the key cancellation written out: f(f⁻¹(x))=[(7x)/(x−2)]/[7/(x−2)]=x for x≠2. A visible worked calculation connects the result to the original domain rather than just saying the functions cancel.

**Step 2 video, about 120 seconds:** Verify the other composition explicitly and map the two restrictions to input/output roles. Then contrast a restricted quadratic inverse: choosing the branch is part of the definition, so algebra alone cannot decide its sign. Keep the rational example as the core exam target; the quadratic is a consolidation of F3, not a second full new technique.

**Why video:** Rearranging and simplifying are the central skills. The inverse reflection already has its own interactive lesson. A small static graph or mapping strip keeps the meaning present without competing with the pad calculation.

**Info cards:** Rewind—collect terms containing the unknown before dividing. Trap—inverse and reciprocal notation. Technique—check a numerical round trip as a quick error detector, while recognising that it is not a general proof.

**Step 3 transfer and feedback:** Find a simple rational inverse, state restrictions and verify a composition. Feedback identifies a lost denominator condition or an incorrect rearrangement. A learner whose algebra works but whose branch is invalid returns to F3.

## Area G — Missing points, boundaries and limits

**Area journey:** Rules can change at a boundary; algebra can conceal a missing point; approach and value then become distinct questions. Long-run behaviour and sign analysis make those distinctions useful.

### FG-G1 — Piecewise functions and boundary rules

**Learning target:** Evaluate and graph one function defined by different rules on different input regions. **Entry:** A2–A3, C2.

**Step 1 video, 0:00–2:15:** Introduce f(x)=x+1 for x<1 and f(x)=2x for x≥1. Choose the branch from the input before calculating: f(0)=1, f(1)=2 and f(2)=4. Explain the brace and the endpoint conditions. Draw each rule only on its permitted region; show the open/closed endpoint information even when the pieces meet at the same height. Change the second rule to 2x−1: the two pieces no longer meet, but each permitted input still has one output. A tariff with a threshold gives a practical motivation.

**Step 2: four-stage boundary trace.** [Sketch](mockups/fg-g1.svg). The two short rules sit above the graph; the rule currently selected by x is highlighted. The input cursor can land exactly at the boundary using a labelled button or value input.

1. “Move x towards 1 from the left.” Read the left rule and its outputs.
2. “Set x exactly to 1.” Choose which condition applies before revealing the output. The closed endpoint decides the value.
3. Choose a supplied jump preset, then compare x=0.9, 1 and 1.1. Do not interpolate across the vertical gap or draw a connector.
4. Evaluate and sketch a fresh two-rule function with the equality assigned to the other branch. Detect an invalid proposed definition if the same boundary input receives two different outputs, or a missing input if the declared domain includes an uncovered boundary.

**Discovery / invariant:** Selecting a rule is governed by input conditions; several rules can still define one function. A gap in the drawing is not automatically a failure of the function definition.

**Info cards:** Rewind—strict versus inclusive inequalities. Trap—an open endpoint does not give f(a). Connection—whole-unit charges may produce a step function; distinguish a continuous input from a discrete count.

**Step 3 transfer and feedback:** Evaluate boundary values, draw restricted pieces and describe a jump informally. Feedback identifies the branch condition first, rather than beginning with arithmetic.

### FG-G2 — Rational graphs: holes and asymptotes

**Learning target:** Preserve denominator restrictions and distinguish two kinds of excluded-input behaviour. **Entry:** A3, C4, D4, E1.

**Step 1 video, 0:00–2:25:** Rewrite f(x)=(x+1)/(x−2)=1+3/(x−2), x≠2. Explain the vertical asymptote through outputs growing without bound near 2, not by assigning infinity as an output. Use the rewritten form to identify the long-run level y=1, with fuller limit language coming in G4; calculate intercepts and sketch both branches. Compare g(x)=(x²−1)/(x−1)=x+1 only for x≠1. The original still has no value at 1; its graph is the line with (1,2) missing. Cancellation did not redefine its domain.

**Step 2: four-stage excluded-point comparison.** [Sketch](mockups/fg-g2.svg). Choose between two clearly labelled functions; each has the original expression, restriction and graph. A compact “near the excluded input” table appears below, with separate left/right probes.

1. “Move close to x=2 from each side.” The rational graph's outputs become large with opposite signs. The curve is clipped at the frame, with no spurious connecting line.
2. Predict what happens near x=1 for the cancelled expression. Select progressively closer inputs; outputs approach 2 instead of growing without bound.
3. Switch between original and simplified formula. The graph's missing point remains unless the learner explicitly chooses to define a new extended function there.
4. Classify fresh factored rational examples as a hole or a pole at the specified input, after cancelling common factors. Include (x−1)/(x−1)² to show that one cancellation can leave a denominator factor.

**Discovery / invariant:** Simplification agrees on the original domain; it does not automatically restore an excluded input. The number of remaining denominator factors matters.

**Info cards:** Rewind—factorisation and legal cancellation. Trap—cancel factors, not separate terms. Connection—a model with a denominator approaching zero may cease to be physically meaningful before the mathematical blow-up.

**Step 3 transfer and feedback:** State restrictions and sketch a simple rational function with intercepts and asymptotes, or locate a hole. Feedback compares behaviour near the input with the value at the input, preparing G3.

### FG-G3 — The value there and the limit nearby

**Learning target:** Read and evaluate a simple finite limit and distinguish it from the function value and continuity. **Entry:** G1–G2.

**Step 1 video, 0:00–2:30:** Revisit (x²−1)/(x−1), x≠1. For nearby x≠1 the expression equals x+1, so outputs approach 2 as x approaches 1. Introduce lim notation as a description of approach, not substitution into an undefined expression. Give the point at 1 a separate value 5: the nearby limit remains 2. At an interior point, continuity requires a defined value, an existing two-sided limit and agreement between them. Setting the value to 2 makes this example continuous there. Contrast a jump whose left and right approaches differ. Include the short cancellation calculation for a simple limit in the main video.

**Step 2: five connected stages.** [Sketch](mockups/fg-g3.svg). Two probe points approach a fixed input from left/right; a separate dot marks f(1) if defined. Readouts are explicitly “approaching from left”, “approaching from right” and “value at 1”.

1. “Move both probes closer to 1.” Read values on either side without landing on the missing point.
2. “Set the value at 1 to 5.” Only the isolated filled point moves. Ask whether the limit changed, then explain using the unchanged neighbouring rule.
3. “Choose a value that makes the function continuous at 1.” Set 2 and verify all three conditions.
4. Switch to a jump preset: x+1 for x<1, x+2 for x≥1. Left approach is 2, right approach 3; a selected single point value cannot make them agree.
5. Transfer to a new simple removable case. State the limit, the current function value and whether an extension could make it continuous at the specified input.

**Discovery / invariant:** Changing one point can change the value and continuity without changing the nearby limit. Probe samples illustrate the claim; the local formula supplies the exact explanation. No epsilon–delta proof is implied.

**Info cards:** Rewind—open/closed endpoints. Trap—0/0 is an indeterminate form, not a value of the limit. Extension—at domain endpoints use approach through the permitted domain; a punctured function can be continuous at every point it actually includes.

**Step 3 transfer and feedback:** Read limits/values from a graph, evaluate a simple factor-cancellation limit, or determine the value that fills a hole continuously. A jump cannot be repaired by assigning one number.

### FG-G4 — Long-run behaviour and horizontal asymptotes

**Learning target:** Interpret limits at large positive/negative inputs and avoid the “never touches” definition of an asymptote. **Entry:** G2–G3.

**Step 1 video, 0:00–2:20:** For y=2+1/x, x>0, compare x=1,10,100. Outputs approach 2 because 1/x becomes arbitrarily small, while no permitted x makes 1/x zero. Introduce x→∞ as unbounded growth of the input. Rewrite (3x+1)/(x+2)=3−5/(x+2) to establish limit 3 as x→±∞. Explain that a horizontal asymptote describes long-run behaviour; y=2+x/(x²+1) crosses y=2 at x=0 and still approaches it at both ends. Thus a limit need not be an unattained value.

**Step 2: four-stage distance-to-a-level investigation.** [Sketch](mockups/fg-g4.svg). A graph and a small labelled gap-to-asymptote readout share an input control. Preset inputs 1,10,100,1000 use a table for scale; graph camera changes are explicit and do not disguise mathematical movement.

1. “Choose a larger input.” Track the difference y−2, not only rounded y-values that may falsely read as exactly 2.
2. Predict whether the rational function's outputs approach 3 from above or below at each end; verify the sign of −5/(x+2).
3. Compare the crossing example. “Find where it equals its horizontal asymptote.” A valid equality at x=0 coexists with the long-run limit.
4. For a fresh rational expression, choose a horizontal limit and justify it by dividing numerator and denominator by the highest power, or by an equivalent rewritten form shown in the prompt.

**Discovery / invariant:** The difference from a limiting level tends to zero at the relevant end; its behaviour at finite inputs can vary. A screen boundary is not infinity, and a rounded zero gap is not exact equality.

**Info cards:** Rewind—negative and reciprocal powers. Connection—sample at n=1,2,3,… to obtain a sequence; n/(n+1) has the same approach idea. Extension—some functions, such as sin x after I2, keep oscillating and have no limit at infinity.

**Step 3 transfer and feedback:** Find and interpret a simple horizontal limit/asymptote, including a conceptual crossing claim. More involved sequence-limit laws remain a Number topic, with a clear route from this card.

### FG-G5 — Rational inequalities and unknown signs

**Learning target:** Solve a rational inequality without losing a denominator restriction or assuming an unknown sign. **Entry:** C2, G2.

**Step 1 video, 0:00–2:25:** Solve (x−1)/(x+2)≥0. Mark −2 as excluded and 1 as a zero. Test a point in each of the three intervals; obtain x<−2 or x≥1. Explain why multiplying directly by x+2 is unsafe: its sign differs on the two sides of −2. Compare the roles of the two boundaries—one is undefined, one allows equality. For comparisons with a nonzero right side, first collect onto one fraction against zero. Show that operation on a short example without a second full solution.

**Step 2: four-stage sign investigation.** [Sketch](mockups/fg-g5.svg). The rational graph is aligned with a number line and a compact numerator/denominator sign row. Only one test input is highlighted at a time; the vertical asymptote and root use different symbols and text labels.

1. “Test x=−3.” Numerator and denominator are both negative, so the quotient is positive.
2. Compare the false shortcut x−1≥0 obtained by careless multiplication. The original inequality accepts −3 while the shortcut rejects it; explain the missing sign condition.
3. “Select every valid interval.” Check the union, with an open marker at −2 and a closed marker at 1.
4. Transfer to a new rational comparison against a constant. Show the collected numerator and denominator; learner identifies all critical inputs before testing signs.

**Discovery / invariant:** A sign interval can end at a zero or an undefined point, and those endpoints have different inclusion rules. A vertical asymptote is never an admissible answer for this rational expression.

**Info cards:** Rewind—C2's sign chart and inequality reversal. Technique—multiply by the denominator's square only after excluding its zeros; explain why this positive factor preserves order. Extension—a removable hole inside an otherwise valid solution interval still has to be removed.

**Step 3 transfer and feedback:** Solve a rational inequality with a union of intervals. Feedback tests the learner's interval against one original value and checks excluded endpoints independently.

## Area H — Growth, decay and the question logarithms answer

**Area journey:** Equal steps stop giving equal increases; ratios reveal a new family. Reversal introduces logarithms, which then recover times, rates and familiar algebra hidden inside new notation.

### FG-H1 — Exponentials: equal ratios, unequal increases

**Learning target:** Recognise multiplicative change and interpret a baseline-shifted model. **Entry:** A5, E1–E2, G4; basic index laws.

**Step 1 video, 0:00–2:25:** Compare L(t)=10+10t and P(t)=10·2ᵗ at equal time steps. Both begin at 10 and reach 20 at t=1, then diverge. Explain a·bᵗ, using positive models with a>0 and b>0: a is the value at t=0, b is the factor per time unit; 1.08 means 8% growth. For 0<b<1 the positive model decays; b=1 is constant. Extend to T(t)=20+80(1/2)ᵗ: initial value 100, limiting level 20, with the excess above 20 halving. This shift means the coefficient 80 is not the initial temperature.

**Step 2: four-stage equal-step comparison.** [Sketch](mockups/fg-h1.svg). Two curves and equal time markers share a fixed graph; a small table toggles between successive differences and ratios. A later cooling preset displays the baseline and the gap above it.

1. “Advance one time step.” Compare additive and multiplicative changes at t=0,1,2,3.
2. Predict which model is larger at the next time, then reveal; neither “exponential always larger” nor “same first two values means same rule” is accepted.
3. Select a decay factor. Track the ratio of successive positive outputs, then switch to the shifted cooling preset and track ratios of excess above baseline.
4. Match model parameters to an initial value, a percentage change and a limiting level. The learner explains which quantity changes by the stated factor.

**Discovery / invariant:** Equal time steps preserve a ratio in the changing component, while absolute increases vary. Orientation introduces the table and step button rather than inviting uncontrolled coefficient play.

**Info cards:** Rewind—zero, negative and fractional exponents. Trap—a percentage is tied to the stated time unit. Connection—idealised pitch frequencies and geometric growth; assumptions about real systems stay explicit.

**Step 3 transfer and feedback:** Interpret parameters, calculate a model value and identify a growth/decay factor or asymptote. Solving for the time awaits H2–H3.

### FG-H2 — Logarithms reverse exponentials

**Learning target:** Interpret log as an exponent and connect inverse graphs, restrictions and notation. **Entry:** H1, F3.

**Step 1 video, 0:00–2:25:** Ask what input makes 2ˣ=8; write log₂8=3 as the same statement with the unknown named differently. Include log₂1=0 and log₂(1/2)=−1 so negative logarithmic outputs are natural. Reflect the exponential graph in y=x and exchange domain/range. Real logarithm inputs must be positive, although their outputs may be negative. State b>0, b≠1. Introduce ln as logarithm to base e, where e≈2.718, and the inverse identities ln(eˣ)=x and e^(ln x)=x for x>0. Solve log₂(x−1)=3 by reversing exponentiation, with x>1.

**Step 2: four-stage inverse trace.** [Sketch](mockups/fg-h2.svg). Equal-scale axes show y=2ˣ and y=log₂x with y=x as a quiet guide. A selected exponential point and its swapped partner share a coordinate strip.

1. “Choose an exponential output. Find the input that produced it.” Swap the point to read it as a logarithm.
2. Predict what log₂(1/4) should be; locate it and explain the negative output through 2⁻²=1/4.
3. Try zero and a negative input. Explain that no real exponent of a positive base produces them; do not merely disable unexplained controls.
4. Apply a one-unit horizontal shift to the logarithmic graph and state its new domain and vertical asymptote. A decreasing-base comparison is optional, not a hidden stage.

**Discovery / invariant:** The same pair of numbers is read in reverse. The exponential's positive range becomes the logarithm's positive-input domain. The clip reminds the learner how to select a point pair.

**Info cards:** Rewind—inverse graphs and restrictions. Technique—change of base derived from bʸ=x, giving y=ln x/ln b. Extension—0<b<1 gives a decreasing exponential and decreasing inverse; no positivity restriction on the logarithm's output is added.

**Step 3 transfer and feedback:** Convert exponential/log statements, evaluate simple logs, sketch a translated logarithm and solve a simple log equation with its restriction. Feedback distinguishes a negative log output from an invalid negative log input.

### FG-H3 — Recovering time and fitting growth models

**Learning target:** Use logarithms to recover an input or unknown rate from an exponential model. **Entry:** H1–H2; rearranging equations.

**Step 1 video, 0:00–2:30:** Work T(t)=20+80e^(−kt). Explain the initial value and baseline, then use a measurement T(5)=60: e^(−5k)=1/2, so −5k=ln(1/2), k=ln2/5. With k known, recover the time when T=40: e^(−kt)=1/4, t=ln4/k=10. Teach ln(aᵘ)=u ln a for a>0 and the change-of-base calculation needed for a model a·bᵗ. Keep units on time and identify a logarithm's dimensionless ratio rather than taking the log of an unnormalised measurement.

**Step 2 video, about 110 seconds:** Apply the same method to growth with an unknown multiplier and rate, using two measurements: first determine the initial scale if t=0 is supplied; otherwise divide equations to eliminate it. Show a non-integer time threshold and discuss whether a question asks for continuous time or the first whole time period. Graph intersections with a horizontal target provide an approximate check, not an alternative exact proof.

**Why video:** The new work is isolating the exponential, applying its inverse and interpreting the answer. H1/H2 already supply the visual meaning. The graph stays present during the pad calculation.

**Info cards:** Rewind—H2's change-of-base derivation. Trap—remove the baseline before taking logarithms; ln(A+B) is not ln A+ln B. Extension—estimating an exponential rate from two nonzero-time observations with the algebra shown.

**Step 3 transfer and feedback:** Determine a simple unknown parameter or solve for a threshold time in a supplied growth/decay model. Feedback checks baseline subtraction, logarithm arguments, sign and units. Simultaneously fitting several unknowns is harder transfer, not the basic Step 3 target after Step 1.

### FG-H4 — Hidden quadratics in exponential equations

**Learning target:** Recognise quadratic structure while preserving the range of the substituted quantity. **Entry:** B3, C4, H2–H3.

**Step 1 video, 0:00–2:20:** Rewrite 2^(2x)−3·2ˣ−4=0 as (2ˣ)²−3(2ˣ)−4=0. Set u=2ˣ, explicitly recording u>0. Solve u²−3u−4=(u−4)(u+1)=0. Reject u=−1 because it cannot be an exponential output; u=4 gives x=2. Verify in the original expression. The equation in u is familiar, but u is not an unrestricted new variable. Show the linked positive-range exponential beside the algebra.

**Step 2 video, about 115 seconds:** Compare (ln x)²−ln x−2=0. Here x>0 while u=ln x may be any real number; u=2 or −1 gives x=e² or e⁻¹, both valid. Work one substitution back completely. The surprising contrast is that a negative substitute is invalid for an exponential output but valid for a logarithmic output. A candidate's status comes from its meaning, not its sign alone.

**Why video:** The central comparison is semantic and algebraic. The earlier exponential/log graphs provide static range evidence; an additional interactive engine would add little beyond those established experiences.

**Info cards:** Rewind—index law (aˣ)²=a^(2x). Trap—do not report u as though it were the original x. Extension—logarithm laws for products and quotients, with positive-argument conditions, as preparation for harder Algebra questions.

**Step 3 transfer and feedback:** Solve an exponential equation reducible to a quadratic and filter substitute values. A logarithmic-substitution task is a labelled harder transfer after Step 2. The solution video explicitly states the substitute's permitted range before selecting roots.

## Area I — Repetition, circles and waves

**Area journey:** Recognise a repeating rule independently of trigonometry, then see how circular position produces familiar waves. Transformations give the waves meaning in models; a quotient produces a repeating graph with gaps.

### FG-I1 — Periodicity beyond sine waves

**Learning target:** Identify a period as a shift that repeats the whole function. **Entry:** A2, E1, G1.

**Step 1 video, 0:00–2:15:** Show a triangular repeating function of period 4, with one complete pattern explicitly marked. Explain f(x+4)=f(x) for every permitted real input, and distinguish the smallest positive period from shifts 8,12,… that also work. Negative repeating shifts work too, although “the period” conventionally refers to a positive length. Two equal outputs alone do not establish periodicity: x² gives equal values at ±1 without repeating its whole shape. A graph clipped to a finite window only supports a global repeating claim if the rule or question states that the pattern continues.

**Step 2: four-stage sliding copy.** [Sketch](mockups/fg-i1.svg). A dashed copy of the graph can be shifted horizontally across a solid original. A marked whole-pattern interval and three linked test points make overlap easier to judge; the axis scale stays fixed.

1. “Slide the copy until one whole pattern matches again.” Record a nonzero shift.
2. Find the smallest positive match. Distinguish it from zero, which always matches but is not a positive period.
3. Predict which of −4,2,8 are repeating shifts; compare the entire displayed pattern and use the specified repeating rule to justify the answer.
4. Transfer to an unfamiliar repeating stepped graph and reject a non-periodic graph that merely has several equal heights. The function's domain and continued repetition are declared.

**Discovery / invariant:** A repeating shift preserves outputs at every input, not only at chosen peaks. Overlap gives evidence; the definition of the repeating rule supports the global statement.

**Info cards:** Rewind—horizontal translations. Trap—a constant function has every positive shift as a period and no smallest positive one; our main examples are nonconstant with a least period. Extension—return to D5's shift identity and add a period-1 component after I2.

**Step 3 transfer and feedback:** Read a period and give other valid repeating shifts, explaining why a proposed shift fails. Feedback highlights a mismatched part of the pattern, not merely one matching point.

### FG-I2 — From a circle to sine and cosine

**Learning target:** Construct sine/cosine graphs from coordinates of a rotating unit point, including signs, range and period. **Entry:** I1; Junior Cycle right-triangle ratios, with Rewind available.

**Step 1 video, 0:00–2:30:** Draw a unit-radius circle and an angle θ from the positive horizontal axis. In the first quadrant, the right-triangle ratios give horizontal coordinate cos θ and vertical coordinate sin θ. Continue the point around the circle: signed coordinates extend those definitions beyond acute angles. Introduce radians as arc length divided by radius; one turn is 2π and a quarter turn π/2. Trace height against angle to get sine, then horizontal position to get cosine. Establish range [−1,1], period 2π, zero crossings and quarter-turn landmarks. Explain that the graph's horizontal axis is angle, not the circle point's horizontal coordinate.

**Step 2: four-stage linked circle and graph.** [Sketch](mockups/fg-i2.svg). A compact circle sits above a wide angle/output graph; one angle control moves a point around the circle and its corresponding graph point. A thin guide links the selected coordinate value to the graph height.

1. “Move the point through one quarter turn.” Track sin θ as its vertical coordinate; show θ and sin θ as different quantities.
2. Predict the sign and value at a half and three-quarter turn before moving there. The negative half of sine is a signed coordinate, not a negative triangle length.
3. Select cosine and track the horizontal coordinate at the same angle. Compare its starting value with sine's.
4. Fill missing quarter-turn landmarks on fresh sine/cosine graphs and identify a full period. Keep radians explicit; a supplied degree conversion strip supports direct-entry learners.

**Discovery / invariant:** The circle's fixed radius bounds each coordinate; returning after a full turn repeats the outputs. Equal angular increments do not produce equal vertical increments.

**Info cards:** Rewind—sine and cosine ratios in a right triangle. Technique—radians and degrees, including calculator mode. Connection—idealised vertical position of a point on a rotating wheel; actual motion assumptions are named.

**Step 3 transfer and feedback:** Sketch sine/cosine over a stated interval, identify signs, range and period, and read landmark solutions. Feedback checks axis meaning and angular units before calculation.

### FG-I3 — Reading and building a wave

**Learning target:** Interpret a sinusoidal model's amplitude, midline, period and phase using known transformations. **Entry:** I2, E1–E3.

**Step 1 video, 0:00–2:30:** Use h(t)=5+3sin(πt/4), for 0≤t≤8. Its midline is 5, amplitude 3, range [2,8] and period 8, because the inner angle increases by 2π in eight time units. Generalise to D+A sin(B(t−C)), with A≠0, B≠0: amplitude |A|, midline D, period 2π/|B| when the inner angle is in radians, and horizontal shift C. For the example, solve h(t)=5 by locating every midline crossing on the given interval: t=0,4,8. Maximum value is D+|A|, not amplitude. State units for input and output.

**Step 2: four-stage wave construction.** [Sketch](mockups/fg-i3.svg). One graph shows the midline, a vertical amplitude bracket and a horizontal period bracket. Only the parameter relevant to the current stage is adjustable; other values remain displayed.

1. “Raise the midline without changing the amplitude.” Max and min move together.
2. “Make one cycle take 4 time units.” Predict how B changes, then verify through the angle accumulated over the period.
3. Move the phase by C using a marked landmark, with the old wave dashed. Explain whether the same output occurs earlier or later.
4. Build a wave from a stated range, period and starting condition, then identify all crossings of a supplied level within a bounded interval. The core challenge uses landmark levels; arbitrary thresholds are optional.

**Discovery / invariant:** Each parameter changes a different meaningful feature. A transformed wave's domain comes from its model or question; infinite repetition does not automatically authorise negative time in a physical model.

**Info cards:** Rewind—inside/outside transformations. Trap—amplitude is half the total range width. Extension—non-landmark level crossings, using a reference angle and all solutions in the specified interval; demonstrate the method before asking for it.

**Step 3 transfer and feedback:** Read parameters, sketch a transformed sinusoid or infer simple parameters from a graph/context. Feedback distinguishes amplitude, maximum and period, and checks all required level crossings.

### FG-I4 — Tangent: a periodic graph with gaps

**Learning target:** Derive tangent's shape, excluded inputs and period from a coordinate ratio. **Entry:** I2, G2–G3.

**Step 1 video, 0:00–2:25:** Define tan θ=sin θ/cos θ. At θ=0 the ratio is zero; approaching π/2 the denominator approaches zero while the numerator approaches 1, so the ratio becomes unbounded and changes sign across the excluded input. Explain why θ=π/2 is not an allowed argument. After a half-turn both circle coordinates change sign, leaving their ratio unchanged, so the period is π. Give domain θ≠π/2+nπ, n∈ℤ, and range ℝ; contrast its unbounded outputs with sine/cosine. Sketch one branch and repeat it, with asymptotes and angular units labelled.

**Step 2: four-stage ratio and gap investigation.** [Sketch](mockups/fg-i4.svg). The tangent graph is primary; a small sin/cos ratio readout accompanies an angle cursor. Dashed asymptotes separate branches; the renderer never joins across a forbidden angle.

1. “Move the angle towards π/2 from the left.” Inspect the numerator, denominator and growing ratio.
2. “Approach from the right.” Compare signs. An exact π/2 choice displays “undefined: cos θ=0”, not an enormous finite approximation.
3. Shift a copied branch by π and explain the repeated ratio using the circle's half-turn sign change.
4. On a bounded interval, identify the domain exclusions and all intersections with a simple horizontal target such as y=1. Show π/4 and its period-shifted partners where they lie in the stated interval.

**Discovery / invariant:** Repetition does not imply boundedness or a value at every input. The ratio explains both the pattern and the gaps.

**Info cards:** Rewind—division near zero and angular units. Trap—π is tangent's period in radians; 180° is the same angle in degrees. Extension—transform tan(Bx) and derive the excluded inputs from its inner argument.

**Step 3 transfer and feedback:** Sketch/read tangent and simple transformed variants with domain and period. Hard trigonometric identities and general equation-solving methods remain in Trigonometry; the core task uses the graph and established landmarks.

## Area J — Build models, make decisions, question predictions

**Area journey:** The learner now chooses a useful representation, turns information into constraints, uses comparisons to make a decision and questions how much evidence a prediction deserves.

### FG-J1 — Build a function from clues

**Learning target:** Select a function form and translate independent information into parameters. **Entry:** B1–B3, D5.

**Step 1 video, 0:00–2:20:** Given a quadratic with vertex (2,1), choose f(x)=a(x−2)²+1 instead of immediately expanding ax²+bx+c. Use the additional point (0,9) to get 9=4a+1, so a=2. Explain that the vertex alone leaves a whole family. Contrast a roots-based clue, suggesting a(x−r)(x−s), and a line's two points. A family assumption is essential: the same finite clues can fit functions outside that family. Distinguish repeated information from independent constraints.

**Step 2: four-stage constraint construction.** [Sketch](mockups/fg-j1.svg). A graph shows a ghost family of a few admissible parabolas and one selected solid curve. Clue chips are introduced one at a time; each removes a genuine freedom.

1. “Place the vertex at (2,1).” The learner sees several remaining widths and orientations; the formula shows a as still unknown.
2. “Make the curve pass through (0,9).” Adjust a with a labelled control, then verify by substitution.
3. Add a redundant clue, such as the symmetric point (4,9), and ask whether it determines a new parameter. Explain the dependency through symmetry.
4. Transfer to two roots plus another point. Select factorised form first, then determine the remaining scale. If supplied clues are inconsistent, explain that no member of the chosen family satisfies them all.

**Discovery / invariant:** Every accepted curve satisfies the currently active clues. More statements do not necessarily mean more independent information. Orientation introduces the clue sequence and shows how a remaining parameter is displayed.

**Info cards:** Rewind—vertex and factorised forms. Technique—three distinct input/output pairs determine at most one quadratic of degree at most two, with a brief coefficient argument. Extension—why two points only determine a unique line after the linear-family assumption.

**Step 3 transfer and feedback:** Recover a quadratic from a vertex and point, or roots and point. Feedback first checks whether the chosen form already encodes the known features, then checks the substitution.

### FG-J2 — Comparing functions in context

**Learning target:** Translate a contextual decision into equality/inequality and interpret the answer in the permitted units and domain. **Entry:** C1–C2, C4.

**Step 1 video, 0:00–2:25:** In a deliberately simplified business model, R(x)=18x−x² and C(x)=8x+16, measured in hundreds of euro, apply for whole batches x∈{0,…,10}. Profit is R−C=−x²+10x−16=−(x−2)(x−8). Break-even occurs at 2 and 8; profit occurs for 2<x<8. Translate the real interval into allowed whole batches: 3,4,5,6,7. Show the graph, number line and sentence answer as three views of the same conclusion. Making more batches is not automatically more profitable under this stated model.

**Step 2 video, about 100 seconds:** Work a second comparison with two pricing plans and a restricted time interval. Explicitly separate “equal”, “cheaper” and “at least this much cheaper”. Sketch the difference and interpret its sign in the correct direction. Finish by checking one value inside and one outside the proposed interval, then discuss whether the model permits fractional inputs.

**Why video:** Intersections and inequality regions already have dedicated interactions. This lesson's new work is deciding what the words mean, preserving units and interpreting the mathematical result. Use the established comparison visual as a narrated demonstration without adding compulsory controls.

**Info cards:** Rewind—C1/C2's equality and inequality connection. Trap—break-even inputs are not the profitable interval. Extension—compare rational models after G5, including excluded and physically inadmissible inputs.

**Step 3 transfer and feedback:** Form and solve a contextual comparison, then write an answer with units and allowed input values. Feedback distinguishes an incorrect inequality direction from a correct real interval that was not converted to the declared discrete domain.

### FG-J3 — A perfect fit can still mislead

**Learning target:** Judge the evidence behind a model and distinguish a correct calculation from a reliable prediction. **Entry:** J1–J2, G4, H1.

**Step 1 video, 0:00–2:15:** Use three explicitly fictional observations (t,y)=(0,1),(1,2),(2,3). L(t)=t+1 matches them. So does Q(t)=t+1+¼t(t−1)(t−2), because the extra product is zero at each observed input. At t=4 they predict 5 and 11. Explain interpolation, extrapolation and the need for assumptions or further measurements to select a useful model. Fitting perfectly does not establish the model's mechanism, domain of usefulness or long-run behaviour. Give a short model-evaluation answer naming a concrete assumption rather than saying only “it may be inaccurate”.

**Step 2: four-stage evidence comparison.** [Sketch](mockups/fg-j3.svg). Three observation dots appear on a fixed graph; the measured interval is labelled, and the unmeasured region has a restrained background tint. Two model labels distinguish solid/dashed curves; predicted points are different shapes from observations.

1. “Check both models at the three measured inputs.” All six predictions match the dots.
2. Predict whether agreement must continue at t=4, then reveal the two forecast points. The added factor explains the divergence exactly.
3. “Choose a new measurement that would help distinguish them.” Compare an already measured point with an unmeasured point where the predictions differ. Selection is judged by information value, not by picking a preferred curve.
4. Given a new contextual model, identify a useful domain and an assumption that limits extrapolation. A short choice-plus-reason prompt allows more than one defensible limitation where justified.

**Discovery / invariant:** Both models continue to match the original evidence; that fact does not force their future agreement. A new measurement could reject either, both or neither within measurement uncertainty.

**Info cards:** Rewind—J1's family assumption and independent conditions. Trap—a high-quality fit is not proof of a causal explanation. Extension—measurements have uncertainty; a small prediction error may not distinguish models reliably.

**Step 3 transfer and feedback:** Interpret a model's domain, assumptions and limitations, or compare two predictions. Feedback demands a reason linked to the model and context. The main pathway ends with the learner able to calculate, explain and question; D6 offers an optional return to the roots mystery.

## Design checks and review limits

The framework and this plan contain the same 43 unique item IDs: 42 core cards and one optional epilogue. Every item has Step 1 teaching, a Step 2 plan, info-card suggestions and Step 3 transfer. The 35 interactive items each have a linked SVG sketch; the eight video items describe their recording visuals instead. All local file links and Markdown table structures were checked.

Worked algebra and representative values were checked through direct substitution and exact rational arithmetic where applicable, including factorisations, inverse round trips, inequality intervals and model parameters. These checks supplement the mathematical explanations; sampled values do not establish universal claims. All 35 sketches were rendered and visually reviewed, and their text bounds were checked for panel overflow. The PDF contains one page per interactive item.

This is design validation, not learner testing or production accessibility verification. The static sketches do not yet establish touch-target sizing, small-screen legibility, screen-reader behaviour or recording pace. Those checks belong in the later experience specifications and implementation. The framework records the limits of the examination-source audit, including inaccessible 2025 references.

## The learning story and final reflection

### The whole journey in the learner's head

The opening question is modest: **“If I put a number in, what comes out?”** The learner can already substitute, so the first demand is familiar. A shared output then creates the first productive surprise: a function can give the same answer twice without breaking its rule. This is the seed of the later inverse-function problem, not a disconnected exception to remember.

A point becomes a record of one input/output pair; a graph gathers the pairs. We then ask which pairs are allowed, what the outputs do as inputs change, and what can be inferred from a limited view. That gives meaning to notation before the course asks the learner to transform, compare or reverse it.

Quadratics are the first sustained case where algebra tells a visible story. Factors name zero outputs. Squared distance explains symmetry and a minimum. Completing the square changes what is easy to see without changing the function. The discriminant then describes a visible event: two intersections merge and disappear. The course can leave a question open here—“no real roots?”—because every method required for the core question is already supplied.

Equations and inequalities turn graphs into tools for decisions. Algebra does more than operate on symbols: each move changes, or preserves, a relationship. Polynomial work extends the range of graphs while improving the quality of evidence. A plotted match is different from an exact factor, an exact identity or a claim about every input.

Transformations return to input/output roles. Composition then makes an output into a new input. Reversal exposes the cost of the first card's harmless shared output: a backwards machine may have two possible answers. The learner now has a reason to care about injectivity, codomain and domain restriction.

G revisits “allowed inputs” at greater depth. A missing point, a jump and an asymptote are different phenomena; the value at a point and behaviour nearby are different questions. The learner can now understand exponential baselines and logarithmic restrictions as part of a connected view. Periodic functions extend it again: a relationship can repeat, a circle can generate a wave, and a repeating graph can still have gaps and unbounded outputs.

The final core question is **“What am I entitled to conclude?”** Enough information within a family can determine a function; perfect agreement with finite data cannot determine all future behaviour. The learner ends able to build, calculate with and question models. The optional roots epilogue widens the world once more: the real graph was accurate, but the real numbers were not the only possible setting for the equation.

### Area A: from substitution to a mathematical object

The area makes the graph a readable relationship. It introduces no graph-family machinery beyond a line or a supplied simple curve; algebraic sketching arrives later when its tools exist.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| A1 | “Is a function just a formula? Must all answers be different?” | The rule is one output per permitted input; formulas are one way of specifying it. Shared outputs are allowed. | A pair can record an assignment, which A2 can plot. The shared-output memory will explain inverse ambiguity in F3. |
| A2 | “How can a picture answer a calculation?” | Every graph point is an input/output pair. Fixing input and fixing output ask different questions. | The learner can follow all points belonging to a domain in A3; no algebraic root-solving is assumed yet. |
| A3 | “Why can't I use every number? Is everything on the screen allowed?” | Domain selects inputs; range records attained outputs; codomain states possibilities. Zoom is different from restriction. | A4 can make precise statements over an interval. The early codomain distinction avoids introducing an unexplained new set in F2. |
| A4 | “Does high mean increasing? Is a minimum the lowest thing anywhere?” | Height, direction of change and scope of a claim are independent. A wider view can overturn a global inference. | A5 gives a quantitative version of change. Later quadratic and model conclusions will specify their domain. |
| A5 | “Is gradient just how high or steep the line looks?” | The invariant is a ratio of changes with units. Intercept is a starting value. | Lines are now meaningful objects to compare with quadratics in C; their additive pattern will challenge exponential intuition in H1. |

### Area B: algebra begins to explain geometry

The area moves from a known output condition to visible structure, then to an algebraic method. The order deliberately avoids teaching completing the square before the student knows why its destination is useful.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| B1 | “Why does a factor have the opposite sign from its root?” | Substitution makes the factor zero, so the whole output is zero; the axis point records the same event. | B2 adds shape between the known intercepts. Repeated roots and theorem-based factor tests later deepen this relationship. |
| B2 | “Where does the bend come from? Why are two heights equal?” | Squared distance from h explains symmetry; its sign and coefficient explain the extremum and width. | Vertex form now has a purpose. B3 can teach how to obtain it without borrowing transformation rules from E. |
| B3 | “Why rewrite something that was already correct?” | Equivalent expressions reveal different facts about the same curve. The compensation step preserves equality. | B4 can link a symbolic root count to a vertex height; the learner can choose forms in J1. |
| B4 | “Can the number of answers change when I move one coefficient?” | Two real roots merge at a threshold and then cease to be real. Discriminant and vertex reasoning agree. | C1 generalises equality beyond the x-axis. The unresolved phrase “real roots” earns the later D6 return. |

### Area C: a solution set is a relationship to preserve

The common thread is “which inputs make this statement true?” The learner already understands the line and parabola used in the first comparison, so new effort goes into the comparison itself.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| C1 | “What does setting two formulas equal mean?” | Equal outputs at the same input are intersections; subtracting gives zero difference. Inputs and coordinates are distinct answers. | C2 changes equality to order, using the same difference rather than introducing a new unrelated procedure. |
| C2 | “Why do I get a range of answers instead of two numbers?” | Intersections partition the input line; signs decide whole intervals; equality decides boundary inclusion. | C3 interprets intervals as distances. G5 later adds undefined boundaries after rational graphs are understood. |
| C3 | “Do the bars just remove minus signs?” | Distance explains symmetric boundary points, inside intervals and two outside regions. | E4 will distinguish applying that operation to an output from applying it to an input. |
| C4 | “If the algebra was legal, why is an answer wrong?” | An implication can add candidates, division can lose them, and original or contextual restrictions can exclude them. | The checking habit returns in rational cancellation, composites, logarithmic substitution and models. It is learned once and strengthened repeatedly. |

### Area D: structure predicts; reasoning establishes

The area gives the learner more shapes without abandoning the link between roots and factors. It then strengthens what counts as mathematical evidence. D6 is deliberately excluded from the core progression at this point.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| D1 | “Does cubic mean three crossings?” | Degree and leading sign constrain the ends; real intercept counts vary. A sketch labels only established features. | D2 investigates what happens at each root, including shapes not resolved by root position alone. |
| D2 | “Why does one root bounce and another cross?” | Even multiplicity preserves nearby sign; odd multiplicity changes it. A flattened crossing is possible. | D3 establishes the algebra behind exact factors; B4's repeated-root event now has a local explanation. |
| D3 | “Why does plugging in one number test a whole factor?” | At the divisor's zero, the quotient term vanishes and leaves the remainder. | D4 has a reason to divide by the discovered factor and a check for the result. |
| D4 | “One root is known; how does that help with the others?” | Division lowers the degree while preserving the full factorisation and all its roots. | D5 contrasts identities holding for every input with equations satisfied at the roots. |
| D5 | “If two expressions match a few times, are they the same?” | Coefficients can establish polynomial identity; matching examples alone cannot. Conclusions depend on the stated function family. | E can use equivalent expressions confidently. J3 later turns this evidence distinction into a question about modelling. |

### Area E: the surprise of inside and outside

Every transformation is explained by a corresponding point. The learner is never expected to remember a sign trick before understanding the required input. Complex combinations use the same calculation, not a new mnemonic.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| E1 | “Surely plus means right or up?” | Outside plus changes output; inside plus changes when the old input is reached. Domain endpoints follow the point rule. | E2 replaces addition with multiplication while retaining the same input/output distinction. |
| E2 | “Does doubling inside double the width?” | Reaching the old input requires half the new input; negatives reverse the relevant coordinate. | E3 composes those coordinate changes and derives compound rules. |
| E3 | “Which transformation rule do I apply first?” | Solve for the old input and calculate the new output. The full expression settles order and domains. | F1 will name the more general process of chaining functions; E4 first checks the distinction in a less reversible operation. |
| E4 | “Aren't these two absolute-value expressions the same?” | One folds negative outputs; the other uses the original nonnegative-input branch twice. Domains may differ. | The learner is ready to track intermediate inputs in F1 and to ask whether lost information can be recovered in F3. |

### Area F: turning functions into operations on functions

The mathematical reason for the vocabulary arrives before it is needed for a calculation. Function classification is given its own space so that onto and inverse are not collapsed into one visual rule.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| F1 | “Which function acts first? Can I always feed the result onward?” | The intermediate output is a new input; order and domain compatibility matter. | Reversal can now be tested as a round trip, but first F2 asks whether the mapping permits it. |
| F2 | “Is one-to-one just another word for a function or for onto?” | Collisions and unreached codomain elements are independent issues. The declared sets matter. | F3 has a clear reason for uniqueness and codomain coverage when defining a full inverse. |
| F3 | “Why can't I simply swap x and y?” | Reversing pairs can give two outputs; choosing a branch makes the reversal a function. | F4 turns the understood reversal into an algebraic method, with restrictions retained. H2 later reuses this idea for logarithms. |
| F4 | “How do I know the rearranged expression actually undoes the rule?” | Composition verifies the reversal on the correct domains. A reciprocal is a different operation. | G explores restrictions and missing values in more depth; H recovers inputs from a new family. |

### Area G: at, near and far away

This area adds a precise vocabulary for phenomena already encountered. Limits are introduced because they answer questions about functions; differentiation is not needed to make those questions meaningful.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| G1 | “How can one function have more than one rule?” | Input conditions select exactly one output, including at boundaries. The pieces need not join. | G2 supplies a different reason for a missing point; G3 will compare the approaches on either side of a boundary. |
| G2 | “Does every denominator zero mean the same kind of gap?” | A cancelled factor can leave a finite missing point; an uncancelled factor can produce unbounded behaviour. | The learner now has a reason to distinguish the value at the missing input from outputs nearby in G3. |
| G3 | “Can the limit exist if the value is missing or wrong?” | Yes: nearby behaviour and point value are separate. Continuity asks them to agree; opposite one-sided approaches may disagree. | G4 moves the approach question from a finite point to arbitrarily large inputs. |
| G4 | “Is infinity a place? Does an asymptote forbid every crossing?” | Infinity describes unbounded input growth; a horizontal asymptote is a long-run relationship, not a barrier. | H1's cooling baseline and H2's restrictions can now be explained precisely. G5 first uses the rational domain/sign distinctions to solve. |
| G5 | “Why can't I clear a denominator as usual?” | Multiplication preserves or reverses order according to sign; undefined inputs remain excluded. | H4 will carry restrictions through another algebraic substitution. J2 can safely compare more complicated models. |

### Area H: a different kind of change, and its reversal

The first two cards introduce new meanings; the next two apply familiar algebra with those meanings intact. Logarithms are presented as a needed question about an exponent, not as a list of manipulation laws arriving without a purpose.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| H1 | “If growth starts at the same rate, won't it stay similar?” | Equal increments and equal ratios produce different futures. A baseline-shifted model changes its excess multiplicatively. | H2 asks for the exponent needed to reach an output; G4 already explains the baseline's limit. |
| H2 | “What number does a logarithm actually give me?” | It gives the exponent. Inversion explains its graph and domain; negative outputs are valid. | H3 can use logarithms to recover an unknown time or rate without a new unexplained operation. |
| H3 | “How can I solve for a variable trapped in an exponent?” | Isolate the changing component, apply its inverse, then interpret the result and units. | H4 exposes familiar polynomial structure inside more elaborate exponential expressions. |
| H4 | “Can I treat the substitute as any real number?” | Its meaning supplies its range. Negative exponential outputs are impossible, while negative logarithmic outputs are normal. | The validity thread is now robust enough for mixed modelling tasks; I introduces repetition as another behaviour rather than a harder algebraic recipe. |

### Area I: repeated relationships become waves

Starting with arbitrary repetition avoids making periodicity seem exclusive to trigonometry. The circle then supplies the missing geometric reason for sine and cosine, with angular units explicitly introduced before transformed models use them.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| I1 | “Is every repeated height a period? Does periodic mean sine?” | The whole output pattern must repeat under a fixed shift. A nonsinusoidal function can satisfy that condition. | I2 provides a geometric mechanism that generates a particular repeating pattern. |
| I2 | “How did a triangle ratio turn into a wave?” | Rotating coordinates extend the ratios, produce signs and bound the outputs. Angle and horizontal position have different roles. | E's transformation rules now have a meaningful sine/cosine parent graph in I3. |
| I3 | “Which number in the formula is the height, width or timing?” | Amplitude, midline, period and phase encode distinct features; the inner argument controls timing. | I4 challenges the assumption that every periodic graph is a smooth bounded wave. J can use wave parameters as model information. |
| I4 | “How can a repeating function have gaps and grow without bound?” | A coordinate ratio keeps repeating but becomes undefined when its denominator is zero. | This combines periodicity with the rational/limit story; it completes the core family vocabulary needed for model choice. |

### Area J: using and questioning what we know

The final core area combines established skills, so the learner's effort shifts toward selecting an approach and judging conclusions. The novelty is the responsibility of interpretation, not a surprise algebraic prerequisite.

| Card | Starting question or belief | Change in understanding | Bridge to what follows |
| --- | --- | --- | --- |
| J1 | “How do clues become a function? Does any new clue help?” | Choose a form that expresses known features; independent constraints remove freedoms within a stated family. | J2 uses constructed or supplied functions to make decisions. J3 will question the family assumption itself. |
| J2 | “Which answer should I give in this situation?” | Equality, superiority, units and discrete/physical restrictions determine what an answer means. | A correct calculation is now available; J3 asks whether its model deserves confidence. |
| J3 | “If the model matches every observation, why doubt its prediction?” | Finite agreement can leave multiple futures possible. More informative evidence and explicit assumptions matter. | The core course ends with mathematical agency: calculate, explain and question. The optional D6 return asks whether a different mathematical setting reveals more. |

### Optional epilogue: D6 pays off the roots mystery

The learner returns to B4 with the question **“Were the roots destroyed, or was my picture only showing part of what an equation can mean?”** The real graph remains truthful: it has no real zero for k>0. A newly defined number i allows direct verification of two non-real roots, and a separately labelled Argand plane locates those numbers. The payoff is an expansion of understanding, not a retroactive claim that the earlier graph was wrong.

D6 does not require a detour through complex arithmetic before continuing the main course. It introduces only what its own example uses, and invites a richer return after formal complex-number teaching. The boundary between (x,f(x)) and (Re z,Im z) is stated in the video, on the visual and in the transfer check. This is essential to making the surprise mathematically honest.

### What changed during the story review

| Potential leap or weakness | Resolution in the final plan |
| --- | --- |
| “Sketch a graph” before teaching how its structure determines shape | A2 teaches plotting/reading; B2 and D1 teach family-specific sketches. J1 later reconstructs a function from features. |
| Vertex form explained only by transformation rules that arrive later | B2 derives it from nonnegative squared distance. E subsequently generalises the point correspondence. |
| Quadratic intersections before the student understands a parabola | Area B now precedes C. A5 supplies the line first. |
| Completing the square as an isolated algebraic chore | B2 gives the destination meaning; B3 preserves one graph while its expressions change. |
| A single inequalities card carrying interval meaning, unknown-sign division and rational exclusions | C2 handles polynomial sign intervals and sign reversal; G5 returns after G2 gives excluded boundaries meaning. |
| Absolute value distance and two graph folds crowded together | C3 establishes distance; E4 uses the input/output distinction to compare the folds. |
| “Onto” introduced only at the moment an inverse needs it | A3 establishes codomain; F2 classifies mappings; F3 applies the classification to reversal. |
| Logarithms introduced before the learner has an inverse mental model | F precedes H; H2 reuses coordinate swapping and range/domain exchange. |
| Cancellation treated as restoring a missing input | C4 establishes validity; G2 preserves the restriction; G3 distinguishes extending the function from simplifying its expression. |
| Limits treated as an unexplained calculus add-on | G uses them to answer at/near/far questions about functions, with no differentiation methods. |
| Periodicity treated as an attribute of sine formulas only | I1 starts with arbitrary repetition; I2 constructs sine/cosine from circular coordinates; I4 challenges boundedness. |
| Proof suggested by animation or several agreeing numbers | Exact explanations accompany observations: factor signs, coordinate rules, polynomial identities, local simplifications and explicit model constructions. |
| Step 1 removes every reason to interact | Step 2 uses changed values, reversed tasks, boundary cases and constructions. Its question remains worthwhile even after the basic rule has been taught. |
| Step 2 hides a technique required by an advanced learner's core exam question | Core Step 3 tasks are matched to Step 1. Harder transfer after a second teaching video is explicitly labelled, as in D5/H4. |
| Rewind becomes compulsory extra material for new teaching | Rewind repairs named prior knowledge; required new concepts remain in the main lesson. Optional extensions are not prerequisites of later core cards. |

### Engagement, clarity and the Great Maths Visuals test

The surprises form a connected sequence: shared outputs are allowed (A1), apparently similar questions run in opposite directions (A2), a minimum can be local (A4), forms change while a graph stays fixed (B3), roots can merge (B4), correct-looking algebra can change the answer set (C4), a repeat can still cross (D2), plus can move left (E1), reversal can fail (F3), a missing value can have a limit (G3), an asymptote can be crossed (G4), equal early data can hide different growth (H1), periodic graphs can have gaps (I4), and a perfect fit can predict badly (J3). D6 then opens a new number system. None requires a trick instruction or a false mathematical state.

For every card, the opening action is concrete, the relevant quantity is named, and the conclusion explains why the observed result follows. The learner may have to think hard about the mathematics; they should not have to infer which control is active, what an unlabelled number represents, or whether the visual is asking for exploration or an answer.

The plan follows the [Great Maths Visuals principles](../../great-maths-visuals.md): a central insight, explicit links between representations, meaningful variation, honest exact/approximate claims, a connected transition, accessible actions and fresh transfer. It deliberately avoids forcing all lessons into the existing roots activity's six stages or integration's seven. The sketches make the central composition reviewable; they do not establish phone usability, screen-reader support or educational effectiveness. Those remain to be demonstrated through implementation review and learner observation.

The final learner story is therefore a progression in the questions a student can ask and answer. **“What output?” becomes “Which inputs?”, then “Why this shape?”, “What does this operation preserve?”, “Can I reverse it?”, “What happens near the boundary?”, and finally “What does the evidence justify?”** Each new question has an explicit foothold in what came before, with a Rewind route for a student entering midway.
