# Great Maths Visuals
## Design Principles and Quality Standards

**Version:** 1.2  
**Suggested filename:** `great-maths-visuals.md`  
**Purpose:** Define what makes an interactive mathematical visual educationally effective, mathematically sound, intuitive, accessible and worth building.

**Audience:** AI design assistants, AI development agents, mathematics educators and reviewers.

**Companion documents:**
- *AI Support Guide* — how AI should design, review and improve the experience.
- *Step Visuals Engineering Guide* — how the experience should be implemented reliably.

This document defines **what good looks like**, independently of implementation technologies or development processes.

---

# 1. Purpose: Mathematical Understanding

A great mathematical visual helps students understand a mathematical idea that might otherwise remain abstract, difficult to imagine or disconnected from their existing knowledge.

Its purpose is not merely to display mathematics accurately, illustrate an explanation or provide an attractive animation.

The strongest visuals help students **discover, investigate, understand and apply mathematical relationships** through meaningful interaction.

## 1.1 The central mathematical insight

Every visual should have a clearly identifiable central insight: the mathematical understanding students should take away from the experience.

For example, our first visual connected three representations:

- A numerical root \(r\).
- A point where the graph meets the x-axis.
- A corresponding factor \((x-r)\).

The central mathematical relationship was:

\[
f(r)=0\quad\Longleftrightarrow\quad(x-r)\text{ is a factor of }f(x)
\]

The student could change a root and observe the graph and factorisation changing together.

The central insight should be expressible in one or two sentences **without describing the software**.

## 1.2 Understanding rather than demonstration

A visual should help answer at least one of these questions:

- What does this mathematical idea mean?
- Why does this relationship hold?
- How do different mathematical representations connect?
- What changes when a quantity changes?
- What remains unchanged, and why?
- Why does a mathematical procedure work?
- How can I recognise or apply the relationship in another situation?

The visual should make something mathematically meaningful easier to see, reason about or understand.

**Quality standard:** Students should leave with a stronger mathematical mental model, not merely familiarity with an interface.

## 1.3 Focused mathematical depth

Prefer a coherent central insight over several loosely connected objectives.

A visual may contain multiple stages, representations and discoveries, provided they support the same learning purpose.

Avoid adding mathematical features merely because they are technically possible.

Equally, do not simplify a concept until the important mathematics disappears.

The aim is **focused mathematical depth, not superficial simplicity**.

---

# 2. Mathematical Design

## 2.1 Correctness at every moment

Graphs, equations, numerical values, diagrams and explanations must remain mathematically valid throughout the experience.

This includes intermediate interaction states, not just starting and final positions.

Consider:

- Domains and assumptions.
- Signs, zero and negative values.
- Repeated or coincident solutions.
- Undefined quantities and discontinuities.
- Boundary and limiting cases.
- Exact equality versus approximation.
- Differences between a special example and a general result.

An animation must never display a false mathematical relationship merely because that makes the interface easier to implement.

A mathematical expression presented as a **target** must not be confused with an expression describing the **current state**.

For example, if students are given the factor \((x+4)\) and asked to find its root, the target factor should be clearly distinguished from the factorisation of the graph before the student reaches the correct answer.

Explicitly address numerical approximations and their limitations. Students must not be led to mistake approximated quantities for exact results.

## 2.2 Connect representations explicitly

Interactive mathematics can connect graphical, algebraic, numerical, geometric, verbal and dynamic representations.

The value comes from the **relationship between them**, not simply displaying them together.

For example:

- **Graphical:** A root occurs at \(x=-3\).
- **Algebraic:** The corresponding factor is \((x+3)\).
- **Numerical:** Substituting \(-3\) gives \(-3+3=0\).

A student should understand how these statements express the same mathematical relationship.

The connection must be perceivable without substantial mental reconstruction.

In our first sparkline, the graph and factorised expression were both correct, but numerical root labels were initially absent. Adding those labels made the intended root–factor connection considerably clearer.

**Quality standard:** Essential correspondence between representations should be explicit enough to recognise quickly.

### Sequence representations deliberately

Connecting representations means deciding not only which students encounter, but **when** they encounter them.

An activity might progress from concrete manipulation to geometric observation, numerical evidence, algebraic relationships and formal notation. The sequence must follow the mathematical insight being developed, not a compulsory concrete-to-abstract template.

Introducing a formal rule too early may replace the intended discovery with a procedure to follow. Introducing it too late may leave the purpose of earlier explorations unclear. Where possible, formal notation should express, connect or generalise something the student has already begun to understand.

If visual or numerical evidence suggests an exact relationship, distinguish that observation from the reasoning needed to establish it. Showing several agreeing representations does not, on its own, establish a proof.

## 2.3 Distinguish variables from invariants

Dynamic mathematics often becomes understandable by observing what changes and what stays the same.

The visual should help students identify:

1. The quantity they changed.
2. The mathematical consequences.
3. The quantities or relationships that remained unchanged.
4. Why the invariant relationship holds.

Changing one meaningful quantity at a time is often more revealing than simultaneously changing several.

For example, moving one quadratic root while the other remains fixed makes it easier to isolate the corresponding change in factorisation.

## 2.4 Preserve mathematically meaningful geometry

Graph scales, coordinate transformations, axes and visual proportions must support correct mathematical interpretation.

Equal horizontal and vertical scales are valuable where geometric proportions matter. Different scales may be appropriate for different quantities or units if clearly represented.

Keep the mathematical frame stable when students need to compare successive states.

Avoid automatically rescaling a graph in ways that conceal a genuine mathematical change.

Stable framing is the default when comparing mathematical states, not an absolute rule. Deliberate changes of scale can sometimes serve learning.

**The visual must distinguish movement of the mathematics from movement of the viewing frame.**

## 2.5 Distinguish observation, verification, explanation and proof

A mathematical visual can motivate a conjecture, expose a pattern, support intuition or illustrate why a theorem is plausible.

These are not equivalent to proving a general statement.

Distinguish carefully between:

- **Explore:** Observe examples and investigate relationships.
- **Predict:** State what is expected to happen.
- **Test:** Check the prediction against one or more cases.
- **Verify:** Establish that a particular proposed result satisfies the specified conditions.
- **Explain:** Clarify the mathematical reasoning behind a result.
- **Show:** Establish a specified relationship through appropriate reasoning.
- **Prove:** Supply a valid argument establishing a general claim.

These distinctions are conceptual starting points, not definitive descriptions of Leaving Certificate command words.

Future alignment with Irish examination terminology should be based on verified curriculum and marking guidance.

**Quality standard:** Do not claim that an observed graphical pattern establishes a general theorem unless the required reasoning is supplied.

---

# 3. Interaction Design

## 3.1 Every interaction needs a mathematical purpose

Students should manipulate an object because the action helps reveal or understand the mathematics.

A control should answer:

**What mathematical relationship becomes clearer through this action?**

Dragging a root is useful because it directly connects the root position, the curve and the associated factor.

An unrelated animation or extra adjustable parameter may introduce complexity without improving understanding.

## 3.2 Prefer direct manipulation when meaningful

Where appropriate, students should manipulate mathematical objects directly.

Examples include:

- Dragging a root along an axis.
- Moving the vertex of a parabola.
- Adjusting an integration boundary.
- Moving a point along a curve to investigate gradient.
- Changing the dimensions of a geometric construction.

Direct manipulation can make the relationship between action and consequence immediate.

However, dragging is not inherently superior to selecting, comparing, constructing, estimating or explaining.

Responsiveness is valuable, but accuracy matters more than making every numerical result appear instantaneous. Some complex calculations may require appropriate processing or carefully communicated approximation.

**The interaction method must follow the mathematics.**

## 3.3 Separate exploration from assessment

During exploration, mathematical representations should generally respond immediately to student actions.

When a root moves, the graph should move with it. When an integration boundary changes, the displayed accumulated area should respond accordingly.

Assessment has a different purpose.

A student may need to settle on an answer and deliberately press **Check** before receiving correctness feedback.

The distinction is:

- **Exploration:** Reveal the mathematical consequences of manipulating something.
- **Assessment:** Establish what the student has chosen or understood before judging correctness.

Avoid accidental assessment during exploratory movements.

## 3.4 Use constraints deliberately

Freedom of interaction is not automatically educationally valuable.

Constraints can direct attention towards the intended relationship.

Moving one root while holding another fixed may be better for learning than adjusting every coefficient independently.

Constraints should support discovery, not feel arbitrary or obstruct the task.

## 3.5 Handle special cases meaningfully

Important mathematical cases should be correct and interpretable.

For quadratics, these include negative roots, zero roots and repeated roots.

For calculus, relevant cases might include zero gradients, stationary points, sign changes, discontinuities where applicable, and cancellation of positive and negative accumulated area.

Special cases can reveal ideas that ordinary examples conceal.

## 3.6 Eliminate unnecessary interaction steps

Every student-facing action should serve a necessary purpose:

- Advance learning.
- Manipulate the mathematics.
- Reveal useful information.
- Navigate the experience.
- Provide access or orientation.

A student who receives an incorrect result should not ordinarily have to press a separate button merely to regain control of an object they were already manipulating.

Avoid controls that introduce work without improving learning, clarity or accessibility.

---

# 4. Learning Journeys

An interactive mathematical object becomes a learning experience when the student is guided towards understanding and application.

## 4.1 Our starting learning sequence

The first visual used:

| Stage | Purpose |
|---|---|
| **Explore** | Discover relationships through meaningful manipulation |
| **Predict** | Form an expectation before seeing an answer |
| **Test** | Investigate the prediction |
| **Explain** | Understand the underlying reasoning |
| **Try** | Apply the understanding to a fresh challenge |
| **Finished** | Recognise completion and reinforce the conclusion |

This is an established starting pattern, **not a compulsory template**.

Some concepts need fewer stages; others need different forms of investigation.

The choice of **first example**, its initial mathematical state and the order of subsequent examples are teaching decisions. They should make the intended progression understandable rather than follow an incidental implementation order. A returning student may need to see their earlier exploration state instead of the original starting example.

## 4.2 A growing pedagogical stage bank

Potential additional stages include:

| Stage | Educational purpose |
|---|---|
| Compare | Identify similarities, differences and relationships across cases |
| Construct | Build an object satisfying mathematical conditions |
| Estimate | Anticipate a value or magnitude before calculating |
| Verify | Establish whether a specified result or condition holds |
| Show | Develop reasoning establishing a requested relationship |
| Prove | Construct or understand a valid mathematical proof |

These are candidate reusable patterns, not fully specified or interchangeable stage definitions.

They should be refined as new mathematical activities are developed, including eventual alignment with Leaving Certificate assessment language.

A new stage type should be introduced when it performs a distinct educational function—not merely because it gives an existing stage a new name.

## 4.3 Prediction creates purposeful attention

Prediction encourages students to think before receiving the answer.

The subsequent interaction becomes an investigation of their expectation rather than passive observation.

A prediction should be:

- Clearly connected to the central insight.
- Accessible from the student's current understanding.
- Specific enough to test.
- Revealed at an appropriate time.

Do not reveal the answer prematurely through labels, secondary views or other representations.

## 4.4 A reveal should connect observation to reasoning

An effective mathematical reveal does more than report correct or incorrect.

It explains **why** the observed relationship holds.

For example, \(-3\) corresponds to the factor \((x+3)\) because substituting \(-3\) makes the factor zero.

The explanation should connect to what the student has just manipulated, predicted or observed.

Where useful, explicitly relate a numerical result to the geometric evidence visible in the graph or construction. Do not assume students will notice that correspondence merely because the representations appear together. Keep clear the difference between what a diagram suggests, what numerical estimates support and what mathematical reasoning establishes exactly.

## 4.5 Include opportunities for retrieval and transfer

Following an explanation is not the same as understanding it independently.

A later challenge should require students to apply the relationship without simply copying the demonstrated answer.

For example, after investigating the factor corresponding to a given root, students could receive a factor and be asked to determine its root.

This reversal helps test the relationship rather than the ability to repeat a memorised interaction.

The challenge should remain focused and proportionate to the learning objective.

As difficulty increases, new challenges should normally extend or combine reasoning established earlier in the activity. Avoid demanding an unexplained technique merely because its individual ingredients have appeared on previous screens.

## 4.6 Completion must be clear

Students should recognise that they have finished.

A final stage should:

- Acknowledge their achievement.
- Reinforce the mathematical conclusion.
- Avoid unexplained new material.
- Clearly label any available next action.

Prefer unmistakable status language such as **Finished** rather than ambiguous wording that could sound like an instruction.

## 4.7 Preserve mathematical continuity between stages

A sequence of individually effective visuals does not necessarily create a coherent learning experience. Each stage should build on understanding established earlier and prepare students for the reasoning needed next.

For every transition, ask:

1. What mathematical understanding has the student just developed?
2. What does the next stage assume they already understand?
3. Has the essential connection between those ideas been made explicit?
4. Would a concise observation, explanation, expression or interaction make that connection clearer?

Resolve missing connections without automatically adding another stage. The aim is a continuous mathematical argument rather than a collection of related demonstrations.

**Example:** After identifying the vertical strip height between curves as \(h(x)=3x-x^2\), the next representation should show that expression inside the area integral, \(\int_a^b(3x-x^2)\,dx\), rather than asking the student to infer the substitution from the generic symbol \(h(x)\).

**Quality standard:** Students should be able to follow the mathematical reasoning from stage to stage without having to reconstruct essential connections that the activity was intended to teach.

## 4.8 Organise multiple explorations within a stage

When a stage contains several distinct mathematical explorations, its interface should make their relationship and suggested sequence apparent.

Clearly named subsections arranged in a meaningful order can communicate progression without a separate layer of instructions, completion indicators or compulsory unlocking. Where appropriate, students should be free to compare and revisit them in any order.

The instruction for the selected subsection should direct attention to its immediate mathematical action or observation. Avoid repeating navigation instructions when the structure itself already makes the next opportunity clear.

Subsections should represent meaningful differences in mathematical focus or activity, not merely several controls used together in one task.

**Example:** An area investigation may move from \(y=x\) to \(y=x^2\) and then to a subsection that consolidates the general integration rule. This is one possible organisation, not a requirement to add subsection buttons to every activity.

**Quality standard:** Students should understand how the explorations relate and how to continue, without being forced through an arbitrary sequence.

---

# 5. Communication and Cognitive Clarity

## 5.1 Use direct, age-appropriate instructions

Students should not have to decipher the interface before engaging with the mathematics.

Prefer:

**Drag the green root between 0 and 5.**

Over:

**Investigate the range of possible positions for the variable root.**

Prefer:

**Drag the green root to the correct position for the factor \((x+4)\).**

Over:

**Place the root for this factor.**

Clear instructions do not weaken mathematical rigour.

They allow students to concentrate on the concept being taught.

Distinguish the roles of student-facing text. An **instruction** directs an action or an observation; an **explanation** establishes why something happens; a **conclusion** consolidates or connects what has been learnt. The opening instruction should normally tell the student what to do or notice, without forcing explanations and conclusions to sound like commands.

## 5.2 Distinguish mathematical vocabulary from interface language

Correct mathematical terms such as *root*, *factor*, *gradient*, *derivative* and *integral* should be used accurately and explained when necessary.

Interface language should usually remain familiar and direct.

Examples include:

**Drag, Choose, Check, Next, Start again.**

Do not invent new interface terminology where an established word would be clearer.

## 5.3 Make the next action obvious

At each stage, students should be able to answer:

1. What am I looking at?
2. What am I supposed to do?
3. What happens when I do it?

Every visible control should have an understandable purpose.

Avoid competing primary actions, unexplained icons and elements that appear interactive but are not.

If progression is unavailable, the student should be able to understand what needs to happen first.

Use short, context-sensitive prompts when the intended next exploration might otherwise be missed. Prefer clarifying an existing instruction or interface structure to introducing a separate guidance system. A next-step sentence is not necessary after every exploration; it should not compete with the mathematical conclusion.

## 5.4 Minimise unnecessary cognitive load

The mathematical reasoning may be challenging. The interface should not add avoidable difficulty.

Avoid unnecessary:

- Simultaneous controls.
- Repeated instructions.
- Redundant mathematical labels.
- Decorative animations.
- Explanatory panels competing with the main visual.
- Confirmation actions.
- Unrelated mathematical representations.

**Simplicity means removing distractions while retaining the information needed for understanding.**

## 5.5 Mathematical notation must communicate its role

Notation should be concise but sufficient.

Students should understand whether an expression represents:

- The current mathematical state.
- A given condition.
- A prediction.
- A target to achieve.
- An answer revealed after assessment.

Do not remove essential labels merely to create a cleaner screen.

Conversely, do not display every possible annotation when only a few contribute to the intended insight.

---

# 6. Visual Design and Mobile Usability

## 6.1 Design for portrait phones first

The activity should work naturally on a small portrait screen, rather than being a desktop interface scaled down.

The central mathematical visual, instruction and primary interaction must remain usable without unnecessary scrolling or crowding.

Do not rely on hovering to reveal essential information.

Support appropriately sized touch targets, smaller screens and enlarged text.

### Allocate space according to mathematical importance

On a constrained screen, allocate space to the graph or construction, primary interaction, essential notation and instructions according to their contribution to understanding.

Before shrinking a graph, reducing mathematical typography, removing necessary content or introducing scrolling, examine how the available space is distributed. Whitespace can improve clarity, but unused space should not force important mathematics into unnecessarily cramped areas elsewhere.

Different states may need different allocations, especially when assistance, feedback or a worked solution appears. Evaluate the actual learner-facing states at representative phone sizes, not only the initial layout.

## 6.2 Establish visual hierarchy

Important mathematical objects should receive the strongest emphasis.

For example:

- The draggable root is prominent.
- A fixed root remains clear but visually quieter.
- The curve is distinct from the axes.
- Essential mathematical notation remains legible.
- The primary action is easy to find.

Use colour, contrast, size and position to clarify meaning.

Do not rely on colour alone to distinguish essential information.

## 6.3 Preserve spatial continuity

Students should be able to compare mathematical states without unnecessary changes to graph position, dimensions or scales.

Changing axes or framing without a mathematical reason can distort the student's perception of the relationship.

Spatial stability is particularly important during interaction and between closely related stages.

## 6.4 Use animation purposefully

Animation should clarify mathematical transformations or preserve continuity.

It should not delay interaction, obscure exact values or introduce unnecessary spectacle.

Respect reduced-motion preferences.

## 6.5 Design compact mathematical visuals separately

A sparkline is not simply a full mathematical graph reduced in size.

Small representations should prioritise:

- Recognisable mathematical shape.
- Important mathematical landmarks.
- Essential numerical labels.
- Connection to associated notation.
- Legibility at the actual display size.

Remove secondary graph furniture when it contributes little.

**A successful mathematical sparkline communicates its intended relationship quickly, not merely accurately.**

---

# 7. Feedback, Mistakes and Assessment

## 7.1 Feedback should help students progress

An incorrect answer should lead naturally to another attempt or a clearer understanding.

Prefer task-focused language:

**Not quite. Move the green root and try again.**

Avoid feedback that labels the student's ability.

Incorrect answers are learning opportunities rather than failures of the experience.

## 7.2 Distinguish mistakes from assistance

Making incorrect attempts is not equivalent to receiving help.

A student may make several mistakes before succeeding independently.

Requesting a worked explanation introduces additional support and may be recorded separately.

This distinction matters when evaluating the student's learning journey.

## 7.3 Assistance should not create unnecessary barriers

Students should be able to request help and return naturally to the activity.

Assistance should explain enough to support progress without unnecessarily removing the opportunity for independent reasoning.

Avoid extra steps simply to unlock an interaction after viewing an explanation.

Hints should, where possible, reactivate mathematical ideas, methods and terminology already encountered in the activity. Avoid introducing a new unexplained procedure or technical term at the point when the student is asking for help. Assistance should support the next reasoning step without unnecessarily completing the assessed task.

## 7.4 Assessment should measure the intended mathematics

A student should not be marked incorrect because an instruction was ambiguous or a control was difficult to operate.

Similarly, merely passing through the correct value while exploring should not necessarily count as an assessed answer.

Where appropriate, require an intentional submission or Check.

Assessment behaviour should reflect the particular learning objective.

## 7.5 Do not confuse completion with mastery

A student may successfully complete a short activity without retaining the insight later or being able to apply it broadly.

Completion provides evidence of performance in that task.

Stronger evidence of understanding may come from:

- Independent explanation.
- Transfer to a different example.
- Delayed retrieval.
- Comparison of unfamiliar cases.
- A conventional examination-style application.

The activity should avoid making unsupported claims about mastery.

## 7.6 Worked solutions should expose the intended reasoning

When an activity provides a worked solution, show the mathematical steps necessary to understand how its answer follows.

The appropriate detail depends on the learning objective. Routine arithmetic need not always be expanded, but steps that express the central mathematical reasoning should not be omitted. Present successive expressions as a clear, connected calculation rather than a collection of disconnected results.

**Example:** After a student has explored definite integration, a final worked calculation may need to show the integral, the integrated expression evaluated between its boundaries, the substitution of both boundary values and the final subtraction. Jumping straight from the integral to its numerical answer hides the method the activity was designed to teach.

A worked solution should help the student recognise which earlier discoveries were applied, how they were combined and why the result follows. It should not introduce unexplained new mathematics at completion.

---

# 8. Accessibility and Inclusion

Accessibility is part of the quality of a mathematical visual, not an optional decorative enhancement.

## 8.1 Essential interactions require accessible alternatives

A student should not be excluded because they cannot use the main gesture.

Where dragging is essential, an appropriate alternative must be available for students who cannot drag, including those using touch assistive technologies.

Keyboard operation alone may not meet every student's needs.

The alternative should remain mathematically equivalent and should not introduce unnecessary complexity.

## 8.2 Important mathematics must be perceivable

Meaningful relationships should not depend solely on:

- Colour.
- Animation.
- Pointer position.
- Visual proximity without appropriate explanation.

Provide suitable text, labels, descriptions and alternative representations.

A student using assistive technology should be able to identify relevant quantities and changes where practical.

## 8.3 Support readable and operable layouts

Consider:

- Text and graphical contrast.
- Mathematical label legibility.
- Touch-target sizes.
- Visible focus.
- Sensible focus order.
- Announcements of relevant feedback.
- Enlarged text and responsive reflow.
- Reduced-motion preferences.

## 8.4 Distinguish requirements from verified compliance

A quality requirement remains a requirement even when its implementation is deferred.

An activity with an acknowledged accessibility limitation may be accepted for a **development milestone**, but that does not mean it has met the full quality standard.

For example, the non-drag touch alternative in our first visual was explicitly deferred. That is an unresolved accessibility requirement, not a completed feature.

Every known limitation should state:

- Who or what it affects.
- Its practical consequences.
- What remains unresolved.
- Whether its deferral has been explicitly approved.

The relevant requirement should remain open until it is satisfied and appropriately verified.

Automated browser testing does not establish complete VoiceOver, TalkBack or physical-device usability.

---

# 9. Meaningful Learning Evidence

Interactive activities can produce evidence of how students approached a mathematical problem.

This evidence should be educationally meaningful rather than merely plentiful.

Depending on the activity, useful information may include:

- Predictions.
- Committed mathematical choices.
- Explicit Checks.
- Incorrect attempts.
- Requests for assistance.
- Successful independent applications.
- Changes between successive attempts.

Repeated transient movements may provide little educational meaning.

Similarly, a large number of interactions does not necessarily indicate deep learning.

The aim is to understand **meaningful mathematical decisions and outcomes**, while remaining cautious about what those observations can establish.

Students should be able to distinguish the mathematical object from the way it is represented, including where approximation or graphical limitations matter.

Learning evidence should not distort the educational experience merely to make it easier to measure.

The technical recording and integration mechanisms belong in the Engineering Guide.

---

# 10. Quality Assessment

A visual should be evaluated across three dimensions.

**Mathematical quality:** Is the mathematics correct and meaningfully represented?

**Educational quality:** Does the experience plausibly help students develop and demonstrate understanding?

**Interaction quality:** Can students use it clearly, comfortably and accessibly?

Strength in one dimension does not compensate for a fundamental failure in another.

## 10.1 Essential quality criteria

The following are the principal criteria for reviewing an activity.

| Area | Standard |
|---|---|
| Central insight | A specific mathematical understanding is clearly defined |
| Correctness | All relevant mathematical states and explanations are valid |
| Representations | Important relationships between representations are apparent |
| Interaction | Principal actions reveal or investigate meaningful mathematics |
| Learning journey | Every stage contributes to understanding or application, and essential connections between stages are clear |
| Instructions | A first-time student can understand what to do |
| Feedback | Mistakes and requests for help lead naturally towards learning; worked solutions show the reasoning needed for the task |
| Transfer | Students can demonstrate the insight in a fresh situation |
| Visual clarity | The mathematics remains legible and prominent, including on phones |
| Accessibility | Essential actions and information are accessible through suitable alternatives |
| Completion | Students understand when the activity has ended and what they achieved |

These criteria are not a weighted score in which a serious defect can be offset by unrelated strengths.

For example, a visually beautiful graph cannot compensate for incorrect mathematics.

## 10.2 The student-understanding test

A student encountering the activity should be able to answer:

**Before:** What am I supposed to do?

**During:** What changed, and what mathematical relationship am I observing?

**After:** What have I learned, why does it work, and can I apply it?

The interface should not require a developer to explain how to use it.

## 10.3 The removal test

For each control, label, instruction and stage, ask:

**Would removing this weaken mathematical understanding, orientation, accessibility or essential functionality?**

If not, removal may improve the experience.

This is a guide to purposeful simplicity, not a rule against supporting information.

## 10.4 The transfer test

The strongest activities help students recognise or use an idea beyond the exact example demonstrated.

Appropriate transfer might involve:

- Different numerical values.
- Reversing a relationship.
- Comparing unfamiliar cases.
- Explaining the result verbally.
- Applying the idea to an examination-style problem.

## 10.5 Distinguish predicted effectiveness from demonstrated effectiveness

Mathematical correctness can be established through reasoning and verification.

Educational clarity can be evaluated through expert judgment and informed AI review.

But whether an activity genuinely improves understanding is ultimately an empirical question.

Useful evidence may come from real learner observations, teacher feedback, student explanations and subsequent performance.

**AI review is a valuable quality filter, not proof of educational effectiveness.**

---

# 11. Guiding Principles

1. **Understanding before demonstration.** The purpose is mathematical insight rather than animation.

2. **Relationships before representations.** Multiple representations matter when their connections are clear and introduced at useful moments.

3. **Meaningful interaction before unrestricted exploration.** Manipulation should reveal mathematics.

4. **Prediction and reasoning before passive observation.** Students should think, test and explain.

5. **Mathematical correctness at every moment.** Intermediate states matter as much as final answers.

6. **Clarity before unnecessary completeness.** Show what students need for the current objective.

7. **Direct language before abstract interface terminology.** Students should focus on the mathematics.

8. **Accessible alternatives for essential tasks.** No essential interaction should depend exclusively on one gesture.

9. **Meaningful learning evidence before interaction counts.** Record mathematical decisions, not merely activity volume.

10. **Reusable principles without rigid teaching templates.** Each mathematical concept should shape its own connected learning journey.

---

# Final Standard

**A great interactive maths visual makes a mathematical relationship understandable through a clear, accurate and purposeful experience.**

It helps students recognise what changes, understand what remains true, connect representations, reason about why relationships hold and apply that understanding themselves.

The interaction should feel natural. The instructions should be immediately clear. The mathematics should remain the focus.

**The highest standard is not how much the visual can do, but how much understanding it can create with the least unnecessary effort from the student.**