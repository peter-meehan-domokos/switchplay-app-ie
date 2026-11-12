# Functions and Graphs — Framework v2

**Status:** Proposed educational design for review, 28 October 2026. This is the result of the authorised design phase; individual activities have not yet been implemented or tested with learners.

**Companions:** [Learning plan](learning-plan.md) · [Annotated visual sketches](mockups/README.md) · [Complete storyboard PDF](mockups/visual-storyboards.pdf) · [Original framework](Functions-Graphs-Framework.md) · [Supplied examination research](funcs-graphs-core-exam-qs.md).

## 1. The organising idea

**A function tells a precise story about how one quantity depends on another. A graph lets us see that story; algebra lets us explain, predict and test it. The domain tells us where the story applies.**

The learner begins able to substitute into simple expressions and plot coordinates, with Junior Cycle experience of functions. We rebuild the connections required for Senior Cycle Higher Level. We do not assume differentiation, logarithms, formal function properties, radians or complex numbers have already been taught.

The recommended journey is A → B → C → D1–D5 → E → F → G → H → I → J, with **D6 as an optional epilogue**, accessible earlier after B4 and D2. The final story returns to a question planted at B4: when a parabola stops meeting the real axis, what has happened to its roots?

There are **42 core items/cards and one optional extension**, grouped into ten areas. The increase from 30 pays for focused lessons, explicit bridges and the added limits/continuity and periodic-function foundations. It is not a target to fill. Eight cards use a second teaching video; 35, including the optional extension, propose an interactive Step 2. Interactive cards can also have a brief orientation video.

The five recurring questions are:

1. What is the input, what is the output, and what values are allowed?
2. What would this equation, inequality or expression look like on a graph?
3. What changes, and what remains true?
4. Does the evidence establish this claim for one input, nearby inputs, or every permitted input?
5. Does a mathematically valid answer make sense in the situation?

## 2. App mapping and lesson contract

The app's structure is **framework → areas → items**. A deck groups cards; a card teaches through three steps. In this proposal each ID below identifies one framework item with one primary teaching card. Related cards revisit it without creating duplicate framework items. If a later production review requires two cards for an item, keep its learning outcome and item ID stable and attach both cards. A shared visual environment does not imply shared progress or a single educational item.

Area letters and item numbers are stable reference IDs, not database IDs or hard prerequisites enforced by the interface. Area titles can become deck titles; the ordering is a recommendation, not an unlocking mechanism. D6 is optional and should not become a requirement for completion of the core pathway. The eventual app configuration will need to express that distinction.

| Part of a card | Design responsibility |
| --- | --- |
| Step 1, normally 120 seconds, maximum about 150 | Introduce the concept and the basic technique required for the intended Step 3 task. Demonstrate one complete example. Seed a worthwhile question without withholding an essential method. |
| Step 2 interactive, normally 3–4 stages | Make a prediction, change something meaningful, explain the result, and transfer it. Use fewer stages where sufficient; use 5–7 only for a connected argument that needs them. |
| Optional Step 2 orientation video, usually 20–45 seconds | Show the first action and the investigation's purpose using a separate example; preserve the learner's actual prediction. |
| Step 2 teaching video, up to 120–150 seconds | Use for algebraic practice or contextual reasoning where manipulation adds little. Extend or consolidate Step 1, rather than conceal a prerequisite for the main exam task. |
| Step 3 | An exam-style task and a solution video of about two minutes. This design states the transfer and feedback focus, without authoring the exam paper or a full solution script. |
| Up to five optional info cards | Rewind, common trap, useful technique, connection, or extension. Use only as needed. Rewind may repair prior knowledge for direct entry; new knowledge essential to the current core task stays in the main teaching. |

The learning plan distinguishes the **core task** from optional harder transfer. A strong learner can attempt Step 3 after Step 1. An incorrect answer can recommend the relevant Step 2 investigation or Rewind. Interaction completion is not evidence of lasting mastery.

## 3. Areas and items

**I** = interactive Step 2, normally with a short orientation video. **V** = teaching video Step 2. Prerequisites name conceptual dependencies; direct-entry learners receive a Rewind route. “JC” means Junior Cycle arithmetic, substitution, basic algebra and coordinates.

### Area A — A function is a relationship

**Area outcome:** Move between a rule, inputs and outputs, points, and a graph; distinguish height, change and permitted values.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-A1 | One input, one output | A function assigns one output to each permitted input; different inputs may share an output. Function notation is not multiplication. | JC substitution | I |
| FG-A2 | From a rule to a graph — and back | A point is an input–output pair; reading f(a) and finding inputs for f(x)=k run in different directions. A few plotted points do not determine an arbitrary function. | A1, coordinates | I |
| FG-A3 | Domain, range and the promised outputs | Domain, actual range and declared codomain play different roles. A viewing window is not a domain restriction. | A1–A2, inequalities notation | I |
| FG-A4 | Reading change, signs and extremes | Positive is different from increasing; a local minimum need not be the least value on the whole domain. | A2–A3 | I |
| FG-A5 | Lines: a constant rate of change | Gradient is output change per unit input, with units; it is different from height or intercept. | A2, signed differences | I |

### Area B — A quadratic, several ways of seeing it

**Area outcome:** Use roots, symmetry and vertex form to sketch and reason about a quadratic, then understand why the root count changes.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-B1 | Roots, factors and intercepts | A zero output connects a root, an axis point and a linear factor. A root is an input, while an intercept is a point. | A1–A3; zero-product rule introduced here | I, adapt existing roots visual |
| FG-B2 | The vertex tells the shape | In a(x−h)²+k, distance from h controls output; the sign of a determines minimum or maximum. Symmetry supplies equal outputs. | A3–A4, B1, squares | I |
| FG-B3 | Completing the square; choosing a useful form | Expanded, factorised and vertex forms describe one function. Completing the square preserves equality and reveals information. | B1–B2; expanding brackets | V |
| FG-B4 | When roots meet and disappear | The discriminant and the vertex describe the same root-count event, provided the quadratic coefficient is nonzero. | B2–B3, quadratic formula Rewind | I |

### Area C — Equations make comparisons

**Area outcome:** Translate equations and inequalities into graphical relationships and preserve the original conditions while solving.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-C1 | Equal outputs: intersections | f(x)=g(x) asks for common inputs with equal outputs. Subtracting creates a difference function whose zeros encode the same inputs. | A5, B1–B3 | I |
| FG-C2 | Inequalities: whole intervals of answers | Solutions are intervals where a difference is positive or negative. Include equality only when allowed; multiplying by a negative reverses order. | C1, B1; number-line order | I |
| FG-C3 | Absolute value is distance | An absolute-value condition measures distance, producing an inside interval or two outside intervals. | A2, C2 | I |
| FG-C4 | Candidates are not yet solutions | Squaring can erase sign information; division can lose solutions. Check original conditions and distinguish algebraic, domain and contextual exclusions. | A3, B1, C1 | I |

Rational inequalities move to G5, after denominator restrictions and asymptotes have a full visual meaning. Absolute-value graph transformations receive their own later card E4.

### Area D — Polynomial structure and mathematical evidence

**Area outcome:** Infer global polynomial shape from structure, understand repeated roots, and use algebra to justify and recover what a graph suggests.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-D1 | Cubics and the ends of a graph | Degree and leading coefficient govern end behaviour; a cubic need not have three distinct real roots or two turns. | A4, B1–B2 | I |
| FG-D2 | Crossing, touching and repeated roots | The parity of multiplicity determines a sign change. A triple root crosses with flattening. | D1, B1, C2 | I |
| FG-D3 | Factor and Remainder Theorems | P(r) is the remainder on division by x−r; zero remainder means an exact factor. Testing one input has a precise purpose. | B1, polynomial expansion | V |
| FG-D4 | Divide, reduce, solve | A known factor reduces a polynomial problem to a lower-degree one. Preserve all roots and check reconstruction. | D3, factorising quadratics | V |
| FG-D5 | Identities: true for every input | Matching coefficients establishes a polynomial identity. A single numerical match does not. Functional identities can constrain a whole family. | A1, D3–D4 | V |
| FG-D6 | Where did the roots go? **Optional epilogue** | No real roots does not mean no complex roots. Real graph intercepts and roots plotted in an Argand plane are different objects. | B4, D2; introduces i²=−1 and Argand coordinates | I |

D6 is an invitation into complex numbers, not a replacement for that topic. Revisit it after formal complex-number teaching; the first encounter remains understandable with the definitions provided.

### Area E — Change the input or change the output

**Area outcome:** Derive transformations by tracking corresponding points, including their domains; recognise which operations preserve shape and which do not.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-E1 | Translations and their surprising direction | f(x+h) reaches an old input earlier; f(x)+k changes the output. Endpoints travel with the graph. | A1–A3 | I |
| FG-E2 | Reflections and scaling | Output scaling multiplies heights; input scaling divides horizontal coordinates. Negative factors add reflections. | E1 | I |
| FG-E3 | Combined transformations and restricted domains | For g(x)=a f(b(x−h))+k, track (u,v)→(h+u/b,av+k), with b≠0. Order is encoded by the expression. | E1–E2, C2 | I |
| FG-E4 | Two meanings of absolute value on a graph | \|f(x)\| changes outputs; f(\|x\|) selects nonnegative original inputs and mirrors that branch. | C3, E1–E2, A3 | I |

### Area F — Combine and reverse functions

**Area outcome:** Treat functions as mappings that can be chained and, under suitable conditions, reversed. Keep range and codomain explicit.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-F1 | Composition: the output becomes an input | Order matters; an intermediate output must be accepted by the next function. Work with graphs as well as formulas. | A1–A3, C4 | I |
| FG-F2 | One-to-one, onto and bijective | Output collisions and unreached codomain elements are different issues. Changing a codomain can change onto status without moving the graph. | A1, A3, F1 | I |
| FG-F3 | Inverse graphs and choosing a branch | Swap input and output; reflect in y=x. Restrict a domain when reversal otherwise gives more than one answer. | F2, B2, E2 | I |
| FG-F4 | Find and verify an inverse | Rearrange and verify compositions on the appropriate domains. Inverse does not mean reciprocal. | F1–F3; rearranging formulae | V |

### Area G — Missing points, boundaries and limits

**Area outcome:** Understand what happens at, near and far from a point, and distinguish undefined values from finite or unbounded limiting behaviour.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-G1 | Piecewise functions and boundary rules | Several rules can define one function. The condition selects the rule; the endpoint marker records whether that input is included. | A2–A3, C2 | I |
| FG-G2 | Rational graphs: holes and asymptotes | Simplifying a formula preserves its original restrictions. A cancelled factor and an uncancelled denominator zero behave differently. | A3, C4, D4, E1 | I |
| FG-G3 | The value there and the limit nearby | A limit concerns approach. Continuity at a point connects the two-sided limit with the defined value; a jump can destroy the limit. | G1–G2 | I |
| FG-G4 | Long-run behaviour and horizontal asymptotes | A limit at infinity concerns arbitrarily large inputs, not substitution of a number called infinity. A horizontal asymptote may be crossed. | G2–G3 | I |
| FG-G5 | Rational inequalities and unknown signs | Zeros and excluded denominator values partition a domain into sign intervals. Cross-multiplying without the sign can change the answer. | C2, G2 | I |

These cards teach informal limits, simple algebraic evaluation and continuity. They do not teach derivative rules, first principles of differentiation, derivative-based curve sketching or integration. Formal epsilon–delta definitions and elaborate limit techniques are outside this pathway.

### Area H — Growth, decay and the question logarithms answer

**Area outcome:** Recognise multiplicative change, recover an input using its inverse relationship, and solve models and equations while preserving restrictions.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-H1 | Exponentials: equal ratios, unequal increases | Exponential change is multiplicative. A shifted exponential approaches a baseline; its coefficient need not be its initial value. | A5, E1–E2, G4; index laws Rewind | I |
| FG-H2 | Logarithms reverse exponentials | A logarithm returns an exponent. Inverse graphs explain positive input restrictions and exchanged domain/range. | H1, F3 | I |
| FG-H3 | Recovering time and fitting growth models | Logarithms recover an input or an unknown rate. Separate the baseline, scale and exponent before solving. | H1–H2, F4 | V |
| FG-H4 | Hidden quadratics in exponential equations | Substitution exposes a familiar structure; the substitute retains the range of the expression it represents. | H2–H3, B3, C4 | V |

Core logarithm meaning, change of base and the power rule needed for these tasks are taught here. A complete course in logarithmic identities, difficult mixed-base manipulation and financial series is a connected Algebra/Number pathway; it must not be claimed as covered by these four cards.

### Area I — Repetition, circles and waves

**Area outcome:** Recognise periodicity before naming a trigonometric family, then connect circular position to sine, cosine and tangent graphs and their parameters.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-I1 | Periodicity beyond sine waves | A period repeats the whole function, not just one equal pair of outputs. The period usually means the smallest positive repeating shift. | A2, E1, G1 | I |
| FG-I2 | From a circle to sine and cosine | Sine and cosine are coordinates of a rotating unit-radius point. Their signs, ranges and periods follow from geometry. | I1; right-triangle ratios Rewind; radians introduced here | I |
| FG-I3 | Reading and building a wave | Amplitude, midline, period and phase describe different features; the input coefficient determines period reciprocally. | I2, E1–E3 | I |
| FG-I4 | Tangent: a periodic graph with gaps | sin x / cos x explains tangent's excluded inputs, signs and period. A periodic graph need not be bounded. | I2, G2–G3 | I |

This is graph literacy for trigonometric functions. General trigonometric identities, triangle solving and derivative techniques remain in their own courses. Core graph tasks include bounded-interval graphical solutions, with radians or degrees declared explicitly.

### Area J — Build models, make decisions, question predictions

**Area outcome:** Select a useful function form, translate evidence into conditions, interpret comparisons, and judge the limits of conclusions.

| ID | Item / primary card | Central understanding and misconception addressed | Rewind dependencies | Step 2 |
| --- | --- | --- | --- | --- |
| FG-J1 | Build a function from clues | A family plus independent conditions determines parameters; a single point or vertex usually leaves alternatives. | B1–B3, D5 | I |
| FG-J2 | Comparing functions in context | Intersections mark equality; profitability or superiority is an interval subject to units and contextual restrictions. | C1–C2, C4; G5 for optional rational context | V |
| FG-J3 | A perfect fit can still mislead | Finite data can fit different functions. Interpolation and extrapolation need assumptions; a calculation alone cannot validate a model. | J1–J2, G4, H1 | I |

Applications also appear earlier: rates in A5, permitted measurements in A3, symmetry in B2, cooling in H1/H3 and circular motion in I2/I3. J consolidates a habit already established rather than introducing “real life” at the end.

## 4. Examination coverage and evidence

The supplied report is a useful question-type catalogue, not an exhaustive frequency study or evidence of how often pupils make an error. This revision uses **verified examination demands**, **syllabus requirements**, and **design judgments** as different kinds of evidence. Teaching examples in the learning plan are original unless explicitly labelled as an examination reference.

The current curriculum page still links the syllabus for examination from 2015 and identifies the newer specification as a consultation draft. This design targets the examined syllabus, not a presumed future specification. [Curriculum Online, checked 28 October 2026](https://www.curriculumonline.ie/senior-cycle/senior-cycle-subjects/mathematics/).

The Functions outcomes include composition, inverse mappings and graphs, quadratic forms, exponential/logarithmic/trigonometric graphs, and informal limits and continuity. Algebra supplies the polynomial and inequality work. That supports including G within this framework while keeping differentiation separate. [Official syllabus, printed pp. 35–43, particularly p. 43](https://oide.ie/wp-content/uploads/2023/12/SCSEC25_Maths_syllabus_examination-2015_English-LC.pdf).

### Coverage matrix

| Demand identified in the supplied research | Principal cards | Verified anchor / coverage qualification |
| --- | --- | --- |
| Evaluate, tabulate, plot, estimate a graphical solution | A1–A3, C1 | [2016 P1 Q3(a–b)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2016-P1.pdf): table/graph work followed by algebraic solution. |
| Complete a square, infer minimum and number of real roots | B2–B4 | [2017 P1 Q1](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2017-P1.pdf). |
| Reconstruct a quadratic from its minimum | B2–B3, J1 | [2023 P1 Q2(a)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2023-P1.pdf). |
| Find roots, use a supplied factor, handle multiplicity | B1, D1–D4 | [2018 P1 Q2(b)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2018-P1.pdf); [2026 P1 Q1(c)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2026-P1.pdf). |
| Find intersection inputs and full coordinates | C1 | [2018 P1 Q6(a)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2018-P1.pdf); [2023 P1 Q6(a)(i)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2023-P1.pdf). |
| Solve inequalities with sign and boundary care | C2–C3, G5 | [2016 P1 Q2(a)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2016-P1.pdf), absolute value; [2018 P1 Q1(b)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2018-P1.pdf), rational inequality. |
| Check radical candidates and original restrictions | C4; revisited G2, H4 | [2024 P1 Q1(a)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2024-P1.pdf); original equation and declared number set both matter. |
| Translate a graph and its restricted domain | E1–E3 | [2023 P1 Q2(c)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2023-P1.pdf); [2026 P1 Q10(a)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2026-P1.pdf). |
| Compose mappings; distinguish injective and onto | F1–F2 | [2023 P1 Q5(c)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2023-P1.pdf). Graph-only composition is deliberately included too. |
| Find an inverse and draw its graph | F3–F4 | [2016 P1 Q5(b)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2016-P1.pdf); [2018 P1 Q6(b)(ii)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2018-P1.pdf). |
| Distinguish local from global claims | A4, G3, J3 | [2024 P1 Q4(c)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2024-P1.pdf). |
| Interpret limiting behaviour, missing values and continuity | G1–G4 | Functions syllabus. [2023 P1 Q2(b)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2023-P1.pdf) is a related sequence-limit task; G4 offers a bridge, not a whole sequences course. |
| Use exponential models, recover time, interpret baseline | H1–H3 | [2021 P1 Q9(a–b)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2021-P1.pdf); [2026 P1 Q8](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2026-P1.pdf) supplies a further model context. |
| Recognise a quadratic hidden in exponential algebra | H4 | [2016 P1 Q3(b)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2016-P1.pdf). |
| Recognise arbitrary periodicity; reason about an identity | I1, D5 | [2026 P1 Q10(b), Q10(f)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2026-P1.pdf). The restriction to the stated polynomial family in (f) is essential. |
| Interpret sinusoidal models and compare predictions | I2–I3, J2 | [2024 P1 Q8(b–d)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2024-P1.pdf). |
| Apply physical input restrictions and evaluate model reliability | A3, C4, J1–J3 | [2021 P1 Q10(a)(i)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2021-P1.pdf), admissible time. Model comparison also appears in [2018 P1 Q7(a–e)(i)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2018-P1.pdf); its calculus part is outside scope. |
| Connect non-real roots to polynomial structure | D6, optional | [2016 P1 Q1(a)](https://archive.maths.nuim.ie/staff/dmalone/StateExamPapers/Maths-LC-H-2016-P1.pdf) is a complex-number connection, not a reason to claim all complex-number exam skills are taught here. |

The original report's 2025 paper and marking-scheme URLs could not be retrieved in this design pass. Those particular references remain **reported, not independently reverified here**. They motivate graph-only composition and parameter practice, which are retained, but no unique curriculum decision depends on trusting an inaccessible citation. No fresh verification of marking-credit allocations or claimed annual frequencies is implied. Raw PDF text can lose mathematical symbols; ambiguous transcriptions are not copied as new exam questions.

## 5. Changes to agreed content

The draft explicitly describes Sections 1–2 / Cards 1–8 as agreed. The user has authorised reconsideration with a visible record. The following changes are therefore deliberate proposals for review, not silent corrections.

| Previously agreed card | v2 destination and change | Reason and what is preserved |
| --- | --- | --- |
| 1. Functions and Notation, video Step 2 | A1 plus A2; A1 now has a short mapping interaction | Separates the definition from representation fluency. A counterexample makes “many inputs, one output” distinct from “one input, many outputs”; notation and evaluation remain. |
| 2. Domain and Range | A3; formula restrictions revisited in C4/G2/H2 | Introduces codomain early enough for onto later, with a simple finite-set illustration. Avoids putting every family restriction into the first domain lesson. |
| 3. Sketching and Reading Graphs | A2/A4 for reading; B2/D1 for structural sketches; J1 for reconstructing | A general “sketch any graph” card assumed techniques not yet taught. Plotting, reading, and family-specific sketching now acquire their own foundations. Local/global reasoning is explicit. |
| 4. Roots and Intercepts | B1, before quadratic structure | Preserves the root–factor insight and reuse opportunity. Moves it into the area where the algebra immediately explains the shape. |
| 5. Solving Using Intersections | C1, after basic quadratics | Preserves graphical/exact comparison and adds an explicit difference-function bridge. The student already understands the line and parabola being compared. |
| 6. Graphical Inequalities, including appended sign cautions | C2 plus G5 | Keeps interval reasoning together; gives rational/unknown-sign division its own focused treatment after rational graphs. Sign reversal is still introduced in C2. |
| 7. Absolute Value | C3 and E4 | Distance and output/input folding are different discoveries. The comparison of \|f(x)\| with f(\|x\|) now follows input/output transformations. |
| 8. Valid and Extraneous Solutions | C4 | Keeps the squaring example; adds the distinction between added candidates, lost solutions and contextual exclusions. A small Rewind handles square-root notation. |

### Other substantial revisions

- **Linear functions receive an interaction (A5):** variable step sizes reveal constant rate without relying on a fixed “rise” or visual steepness. This also prepares exponential comparison.
- **Vertex form precedes completing the square:** students first know what the destination means. Completing the square itself uses two concise videos; it does not assume an existing reusable activity.
- **Factor/remainder reasoning and division split:** one establishes why a test works; the other teaches the algorithm and recovers remaining roots. This protects the short-video budget.
- **Function classification and inverse graphs split:** onto depends on codomain; reflection and domain restriction need separate space.
- **Limits and continuity added to the core:** the draft's placement elsewhere left a gap in understanding holes, ranges and asymptotes.
- **Exponential/logarithmic equations strengthened:** interpreting a growth factor alone did not prepare the report's threshold, parameter and substitution questions.
- **Periodicity introduced before trigonometry:** arbitrary repeating graphs come first; circle-to-wave geometry supplies the missing bridge; tangent has its own gap/period investigation.
- **Model limitations become interactive:** identical data can support different predictions. This makes the limitation discoverable.
- **Complex roots added as optional D6:** the plot twist returns to B4 without turning complex roots into fictitious real intercepts.

## 6. Why this ordering survived the story review

The draft placed broad graph sketching before the student had the graph-family tools, complicated inequalities before the relevant restrictions, and periodicity largely inside trigonometry. This revision uses simpler objects to establish each action before asking for a more demanding explanation.

The main sequence contains deliberate returns. A3 says “which inputs and outputs?”; F asks whether the outputs can be reversed; G asks what a missing input changes; H reverses exponential change. These returns deepen one idea rather than restart disconnected topics.

An initial candidate sequence placed all function families before composition and inverses. That would leave logarithms to be learned as a rule before the learner understood reversal. F therefore comes before H. Another candidate put formal transformations before vertex form. Instead B2 explains vertex form directly through squared distance; E later generalises that reasoning to arbitrary graphs. Neither lesson requires the other in a circle.

The extension D6 is kept off the core dependency chain. Introducing i early as a teaser is useful; making unfamiliar complex arithmetic a condition for studying real-valued transformations is not. Its final placement allows the course to end with both practical judgment (J3) and a widening of mathematical possibility (D6).

The [story section at the end of the learning plan](learning-plan.md#the-learning-story-and-final-reflection) audits every individual card and every area, including the bridge into the next idea and the intended change in the learner's thinking.

## 7. Reuse and design readiness

The existing integration visual demonstrates a useful phone composition: one prominent graph, a short instruction, a meaningful control, live mathematics, and a clear continuation. Its seven stages are a reference for continuity, not the default length for new cards. The roots-and-factors activity is a specific reuse candidate for B1; its current lesson is narrower than B1's full intercept coverage.

| Possible shared environment | Cards | Educational distinction to preserve |
| --- | --- | --- |
| Function trace / coordinate plane | A2–A4, C1, F1 | Reading a value, comparing outputs and feeding back an output are different actions. |
| Quadratic / polynomial view | B1–B4, D1–D2, J1 | A root, vertex, discriminant threshold and parameter constraint must remain distinguishable. |
| Interval / sign display | A3, C2–C3, G5 | Domain, distance and inequality solution are different meanings for a shaded interval. |
| Corresponding-point transformations | E1–E4, F3, H2 | Coordinate mapping is shared; an inverse swaps axes, while an ordinary transformation usually does not. |
| Limits and boundary view | G1–G4, I4 | A hole, jump and pole require different exact mathematics and explanations. |
| Growth models | H1–H3, J3 | Parameter exploration, inversion and model uncertainty have separate tasks. |
| Periodic / circle view | I1–I4 | Arbitrary repetition, a circular coordinate and a quotient have different foundations. |

Reuse is a feasibility hypothesis. The existing host only attaches image/video media, and interactive activities currently live separately; this design does not claim they are wired into cards. Implementation should first agree each activity's detailed experience specification, then apply the engineering guide to its actual mathematical and accessibility needs. The sketches describe mathematical composition and key states, not verified production layouts.
