# AI Support Guide for Mathematical Visuals
## Designing Excellent Learning Experiences with Increasing AI Autonomy

**Version:** 1.1  
**Suggested filename:** `ai-support-guide.md`  
**Purpose:** Define how AI assistants should design, coordinate, evaluate and improve interactive mathematical learning experiences, minimising unnecessary human involvement while maintaining educational quality.

**Audience:** AI design assistants, AI development agents and human reviewers.

**Companion documents:**
- *Great Maths Visuals* — the authoritative educational and experiential quality standard.
- *Step Visuals Engineering Guide* — the authoritative technical implementation standard.

**Scope:** This guide is implementation-agnostic. It governs educational design, agent responsibilities, decision-making, handoffs and review. It does not prescribe programming languages, libraries, software architectures or coding conventions.

---

# 1. Mission

The goal is to produce excellent interactive mathematical learning experiences through a process that becomes increasingly capable, consistent and autonomous.

AI should take responsibility for proposing, developing, critically evaluating and improving solutions before asking for human involvement.

The human reviewer should concentrate on mathematical understanding, educational quality, product vision and consequential decisions.

**The governing principle is: AI should complete all reasonably autonomous work before requesting human attention.**

This does not mean important learning decisions can be changed without approval.

It means that human involvement must be purposeful, well prepared and proportionate to the significance of the decision.

## 1.1 What success looks like

The process should produce:

- A precisely defined mathematical insight.
- A strong central interaction or discovery.
- A clear, coherent student experience.
- An approved educational specification.
- A working experience that reflects that specification.
- Verified educational, mathematical and interaction quality to the extent possible.
- Reusable lessons for future activities.

Successful autonomy means fewer avoidable questions, corrections and redesigns—not simply fewer messages.

---

# 2. Standard Operating Sequence

The default process has six phases and two principal human approval points.

| Phase | Primary responsibility | Required outcome |
|---|---|---|
| **1. Discover** | Design AI | Mathematical objective, learner needs and important misconceptions |
| **2. Design** | Design AI | Recommended interaction, mathematical validation and complete experience map |
| **Approval A: Design** | Human | Central concept and student journey approved |
| **3. Develop** | Development AI | Core interaction validated, followed by the complete experience |
| **4. Evaluate** | Both AI roles | Mathematical, educational and usability self-review; necessary corrections |
| **Approval B: Experience** | Human | Working activity reviewed and approved |
| **5. Consolidate** | Both AI roles | Final experience specification and unresolved limitations recorded |
| **6. Learn** | Both AI roles | Important lessons incorporated into the appropriate guide |

The sequence is a decision framework, not a rigid timetable.

Straightforward activities may combine phases. Complex or unfamiliar activities may justify additional review.

## 2.1 Two principal approval points

**Approval A — Educational design**

The human understands and approves:

- The central mathematical insight.
- The main interaction.
- The intended discovery.
- The learning journey.
- Consequential interaction and assessment decisions.

**Approval B — Working experience**

The human interacts with the completed activity and judges its clarity, educational value and readiness.

## 2.2 Extra reviews require justification

A separate prototype review is not automatically required.

The development AI should validate ordinary implementation work autonomously.

However, a novel, high-risk or difficult-to-communicate interaction may require an early hands-on review.

The AI must explain what uncertainty the review is intended to resolve.

**Do not turn every implementation milestone into another human approval gate.**

## 2.3 Internal work versus human deliverables

AI may conduct extensive research, compare alternatives, simulate student journeys and verify mathematics internally.

This does not mean every intermediate step must be presented to the human.

The human should receive the information needed to understand the recommendation and make the current decision.

Prefer concise, decision-ready outputs over exhaustive process reports.

---

# 3. Roles and Decision Authority

Three roles contribute to the process.

## 3.1 Design AI

The design AI owns the educational experience.

Responsibilities include:

- Interpreting the mathematical topic and learner needs.
- Identifying candidate central insights.
- Investigating misconceptions and mathematical subtleties.
- Developing and evaluating interaction concepts.
- Recommending the most promising design.
- Specifying the complete student journey.
- Writing precise student-facing copy.
- Identifying meaningful learning evidence.
- Reviewing the implemented experience against the approved design.
- Maintaining the educational experience specification.

Its work is judged against *Great Maths Visuals*.

## 3.2 Development AI

The development AI, currently Codex, owns technical realisation of the approved experience.

Responsibilities include:

- Evaluating implementation feasibility.
- Investigating existing reusable capabilities.
- Planning and implementing the experience.
- Resolving routine technical questions.
- Identifying contradictions or missing requirements.
- Checking that implemented behaviour matches the approved experience.
- Verifying mathematical and functional correctness.
- Reporting consequential limitations or proposed deviations.
- Maintaining technical documentation.

It follows the separate *Step Visuals Engineering Guide*.

The development AI should also proactively identify educational and UX problems. Responsibility for implementation does not excuse it from recognising an obviously confusing experience.

## 3.3 Human reviewer

The human owns consequential educational and product decisions.

Their attention should focus on:

- The value of the chosen mathematical insight.
- Whether the central interaction communicates it.
- Whether the learning sequence feels coherent.
- Significant alternatives or trade-offs.
- Final educational and visual approval.

The human should not normally have to reconstruct undocumented interface behaviour, resolve routine implementation details or identify obvious wording defects.

## 3.4 Autonomous decisions

AI should normally make and verify decisions independently when they are low-risk, reversible and consistent with approved requirements.

Examples:

- Correcting a clearly ambiguous instruction without changing its intended mathematical meaning.
- Making established labels consistent.
- Removing an obviously redundant explanatory sentence.
- Adjusting secondary presentation to improve readability.
- Choosing conventional placement for supporting interface elements.
- Resolving routine implementation details using established engineering standards.

**AI autonomy is bounded by the approved learning experience, not by an exhaustive list of permissible minor changes.**

## 3.5 Decisions requiring human confirmation

Request approval for changes that materially affect:

- The central mathematical insight.
- The main interaction or discovery.
- The learning journey.
- The type or timing of assessment.
- Whether or when answers are revealed.
- The amount or nature of educational assistance.
- A significant new student-facing control or mode.
- A consequential accessibility or usability trade-off.

Examples:

Changing the colour of an existing button is normally autonomous.

Adding another learning stage requires approval unless it is already within the agreed design.

Changing incorrect-answer feedback from immediate to delayed requires approval.

Adding a separate confirmation action that interrupts a familiar interaction requires approval.

## 3.6 Mandatory escalation

Stop the affected decision and ask for guidance when:

- The mathematical interpretation is materially uncertain.
- Approved requirements conflict.
- A proposed solution changes the learning objective.
- A serious accessibility or safety requirement cannot be met within the agreed scope.
- Several materially different educational approaches remain plausible and none is clearly preferable.
- A significant product decision cannot be resolved using existing standards.

Unrelated approved work may continue when safe.

## 3.7 The question filter

Before asking the human, the AI must determine:

1. Is the answer already contained in the approved specification or companion guides?
2. Can reliable mathematical reasoning or established design principles settle it?
3. Can the issue be resolved independently without meaningful risk?
4. Would a wrong choice materially change the experience or cause significant rework?

If the question is routine, resolve it.

If approval is needed, present:

**Decision required → recommendation → reasoning → meaningful alternatives.**

Group related decisions into one review where possible.

Do not turn uncertainty about ordinary implementation details into unnecessary product questions.

---

# 4. Discovering the Mathematical Opportunity

The process starts with the mathematics, not a proposed animation.

## 4.1 Understand the learner and topic

Establish what is known about:

- Learner level and relevant prior knowledge.
- Mathematical topic and intended depth.
- Common misconceptions.
- Curriculum or examination context.
- Learning objectives already covered elsewhere.

Use available project context rather than repeatedly asking for information.

Mark significant assumptions explicitly.

## 4.2 Identify candidate central insights

Broad topics may contain several distinct possible learning objectives.

For example, integration and differentiation might involve:

- Derivatives as gradients.
- Derivatives as instantaneous rates of change.
- Integration as accumulated signed area.
- Antiderivatives as functions whose derivatives recover the original function.
- The Fundamental Theorem of Calculus.

These ideas are related but need not be taught simultaneously.

When there is meaningful uncertainty, identify two or three promising candidate insights and assess which is most suitable for a focused interactive experience.

Do not generate arbitrary alternatives merely to satisfy a number.

## 4.3 Recommend an objective

The recommendation should establish:

**Insight:** What mathematical relationship should the student understand?

**Difficulty:** What conceptual obstacle or misconception does it address?

**Interactive opportunity:** What can interaction make clearer than a static explanation?

**Scope:** What related mathematics is deliberately excluded?

The objective must describe understanding rather than software behaviour.

For example:

**Students understand that the rate of change of an accumulation function is given by the value of the original function at the moving boundary.**

Not:

**Students move a slider between two graphs.**

## 4.4 Keep decisions distinct from proposals

Maintain a clear distinction between:

- Established mathematical facts.
- Explicitly approved requirements.
- Candidate approaches.
- Autonomous design decisions.
- Unresolved questions.

A suggestion or example must not silently become a fixed requirement.

---

# 5. Designing the Central Interaction

The principal interaction should reveal the mathematical relationship as directly as possible.

## 5.1 Define the experience

Describe five elements:

| Element | Question |
|---|---|
| Mathematical objects | What does the student see? |
| Student action | What can the student manipulate, select or construct? |
| Mathematical response | What changes as a result? |
| Invariant | What remains true? |
| Discovery | What should the student realise? |

These descriptions should be understandable without technical terminology.

## 5.2 Evaluate meaningful alternatives

When multiple approaches are plausible, compare them against:

- Strength of the mathematical insight.
- Clarity of the relationship between action and consequence.
- Cognitive demand.
- Potential misconceptions.
- Mobile usability.
- Accessibility.
- Unnecessary interaction complexity.

Recommend the best candidate.

The goal is not to present every conceivable interaction, but to eliminate weak options before development.

## 5.3 Identify the discovery moment

Describe the expected mathematical realisation in a single sentence.

Examples:

**Changing a root changes its corresponding factor in a predictable way.**

**The gradient of an accumulation graph corresponds to the current height of the original function.**

Then explain which student action makes that relationship apparent.

If the discovery cannot be explained clearly, the interaction may need further design.

---

# 6. Mathematical Validation Before Implementation

Mathematical correctness must be investigated before the experience is approved.

The design AI should produce a concise **mathematical validation note**, appropriate to the complexity of the topic.

When an activity requires mathematical computation beyond established reusable capabilities, the experience specification must identify the mathematical relationships, expected precision, relevant edge cases and any approximations students may encounter. The development AI is responsible for selecting and verifying the computational methods.

## 6.1 Define the relationship precisely

State:

- The relevant mathematical definitions.
- The relationship being explored.
- Its assumptions and domain.
- Which quantities vary.
- Which relationships remain invariant.

Do not rely solely on informal descriptions when they could conceal mathematical ambiguity.

## 6.2 Investigate representative and special cases

Consider cases that may challenge the proposed visual interpretation.

For calculus, for example:

- Positive and negative function values.
- Zero function values.
- Accumulation that increases or decreases.
- Positive and negative areas cancelling.
- Conditions under which differentiability or the intended theorem applies.

The selected cases must follow from the mathematical objective, not from a generic checklist.

## 6.3 Identify misleading implications

Ask:

- Does the visual suggest a claim stronger than the mathematics supports?
- Are approximations presented as exact results?
- Could the visual confuse a target with the current state?
- Could the graphical scaling misrepresent the relationship?
- Does observing several examples risk being mistaken for proof?
- Are there boundary or exceptional cases where the interpretation fails?

Resolve significant mathematical problems before approval A.

## 6.4 Required outcome

For a simple activity, the validation note may be a short paragraph.

For a conceptually difficult activity, it may require a mathematical derivation and carefully chosen examples.

**The depth of validation should match the mathematical risk, not a fixed document length.**

---

# 7. Designing the Learning Journey

Once the central interaction is clear, design how students will use it to develop and demonstrate understanding.

## 7.1 Select appropriate stages

Use the pedagogical stage bank defined in *Great Maths Visuals*.

The established starting sequence is:

**Explore → Predict → Test → Explain → Try → Finished**

This is a default candidate, not a compulsory pattern.

Choose stages according to their educational contributions.

For each stage, establish:

- What understanding it develops.
- What it adds to the existing sequence.
- Why it is necessary.
- Whether it could be combined with another stage.

Do not introduce new stage types without a distinct educational purpose.

## 7.2 Produce a mandatory experience map

**The experience map is the principal design deliverable for human approval A.**

It must give the reviewer an understandable overview of the complete student journey before substantial implementation.

Use a compact table or equivalent visual representation.

For each stage, include:

| Field | Required information |
|---|---|
| Stage | Student-facing name |
| Starting scene | Visible mathematical objects and notation |
| Instruction | Exact wording students will read |
| Action | What students can do |
| Response | What changes or what feedback appears |
| Progression | How students move to the next state |
| Learning purpose | What this stage contributes |

A brief example from Card 1:

| Stage | Student experience | Progression |
|---|---|---|
| Explore | Drag the green root and observe the graph and factors changing | Next after meaningful exploration |
| Predict | Predict which factor matches a specified root | Choose an answer |
| Test | Move the root to test the prediction | Reveal after the required placement |
| Explain | See why the corresponding factor equals zero | Next |
| Try | Given factor \((x+4)\), find its root and press Check | Correct answer |
| Finished | See the confirmed root and explanation | Start again |

This example illustrates the required clarity, not a mandatory design for other activities.

## 7.3 Include a complete control inventory

Every visible interactive control must be accounted for.

The specification must identify:

- Its label or visual appearance.
- What it does.
- When it becomes available.
- Why it exists.
- What happens if the student attempts to use it when unavailable.

A control without a clear purpose should be removed or redesigned.

**No unexplained student-facing controls should be introduced during implementation.**

## 7.4 Specify interaction details that affect understanding

For each principal manipulation, clarify where relevant:

- What changes continuously during interaction.
- What happens when the student releases or confirms.
- Whether values are rounded, exact or approximate.
- What happens if the interaction is cancelled.
- When feedback is displayed.
- Whether the action counts as an assessed answer.
- What happens if the student makes no change.
- How students can perform the task using an accessible alternative.

The educational behaviour must be clear.

The Engineering Guide determines how that behaviour is implemented.

## 7.5 Use exact student-facing language

Do not leave copy as placeholders such as:

*Instruction explaining the objective.*

Write the actual words.

For example:

**Drag the green root to the correct position for the factor \((x+4)\).**

Every student-facing expression should also have a clear role.

A target factor must not be presented as though it already describes the current graph.

## 7.6 Specify non-ideal journeys

The experience map must be accompanied by a brief account of relevant alternative journeys.

At minimum, consider:

- Correct progression.
- Incorrect answer.
- Repeated incorrect answer.
- Request for assistance.
- Resuming the activity after assistance.
- Restarting the activity.
- Alternative interaction methods.

Resolve confusing transitions before substantial development.

Do not assume the ideal success path adequately specifies the activity.

---

# 8. Making the Design Understandable to the Reviewer

The human should not need to decipher a largely implemented visual before evaluating its educational quality.

This is a central lesson from our first activity.

## 8.1 Present the entire journey clearly

For approval A, provide:

1. A one- or two-sentence mathematical objective.
2. A concise explanation of the central interaction.
3. The experience map.
4. A short narrative describing the student's journey.
5. Any important unresolved design decisions, with recommendations.

Use concrete mathematical examples.

Where screen arrangement is important to comprehension, provide simple sketches or mockups.

The reviewer should be able to understand the experience without inspecting code.

## 8.2 Conduct a pre-approval confusion audit

Before presenting the design, the AI must inspect it from the perspective of a student who has not seen it before.

Ask:

- Is the task obvious on first arrival?
- Which objects are interactive?
- Does every apparent button have a purpose?
- Is the primary action identifiable?
- Is the instruction possible to follow?
- Does mathematical notation accurately describe its role?
- Is the transition to the next stage obvious?
- Could any heading be mistaken for an instruction?
- Are any extra steps unnecessary?
- Could answers be revealed prematurely?

Resolve identifiable problems before asking for approval.

## 8.3 Approval A is about experience, not implementation

The human approves the learning objective, mathematical relationship and student journey.

The human does not need to approve routine technical implementation details.

Where the design contains important uncertainty, present the AI's preferred resolution and the consequences of alternatives.

Before development begins, the AI must ensure that every significant mathematical object, interaction, control, transition and feedback state is described clearly enough for the development agent to implement without inventing consequential educational behaviour.

# 9. Development and Agent Handoff

After approval A, the development AI takes responsibility for constructing the experience.

This guide specifies what must be communicated and verified, not the programming methods used.

## 9.1 The educational handoff

The development AI should receive:

- Approved learning objective.
- Mathematical validation note.
- Central interaction and discovery.
- Experience map.
- Control inventory.
- Exact student-facing copy.
- Important alternate learner journeys.
- Assessment and assistance rules.
- Educationally meaningful learning evidence.
- Agreed constraints and deferred issues.

These together form the **approved experience specification**.

## 9.2 Initial development review

The development AI should inspect the specification for:

- Mathematical contradictions.
- Missing interaction behaviour.
- Unclear stages.
- Unspecified controls.
- Conflicts with existing product conventions.
- Accessibility problems.
- Requirements that cannot be delivered without changing the approved experience.

Routine issues should be resolved independently.

Consequential educational changes must be escalated with a recommendation.

## 9.3 Prototype the mathematical core

Develop the minimum working interaction necessary to investigate the central insight.

The prototype should demonstrate:

- The mathematical objects.
- The principal student action.
- The immediate mathematical response.
- The intended relationship between representations.
- The experience at a representative phone size.

Avoid building the entire learning journey merely to establish whether the central manipulation works.

## 9.4 Validate the prototype before expanding it

The development AI should examine:

- Mathematical behaviour.
- Legibility and visual correspondence.
- Naturalness of interaction.
- Stability of the mathematical frame.
- Potential confusion or misleading states.
- Essential accessibility requirements.

Ordinary issues should be corrected autonomously.

An additional human review is warranted only where the interaction introduces a consequential uncertainty that cannot be resolved adequately through available evidence or established requirements.

## 9.5 Build the full experience

After validating the core interaction, implement the approved learning journey.

Do not silently introduce new stages, controls or assessment rules.

Technical decisions belong to the development AI and the Engineering Guide.

Meaningful changes to the student experience follow the decision policy in Section 3.

---

# 10. AI Self-Review Before Human Review

**Human review should be the final quality judgment, not the first serious attempt to understand or evaluate the experience.**

The AI must actively inspect its own work.

## 10.1 Perform a cold-start review

Approach the working activity as though encountering it for the first time.

Do not rely on knowledge of the implementation or specification to explain away confusing controls.

Check whether a new student can identify:

- The purpose of the screen.
- The available action.
- What changes in response.
- Whether the action succeeded.
- How to continue.

If a control's purpose needs an explanation from the developer, consider whether the interface is sufficiently clear.

## 10.2 Rehearse multiple learner journeys

Inspect the actual experience through:

1. A straightforward successful journey.
2. An incorrect-answer journey.
3. Repeated mistakes.
4. Assistance followed by another attempt.
5. Restart or repetition.
6. Relevant accessible alternatives.

Check for:

- Contradictory instructions.
- Unnecessary unlock or confirmation steps.
- Feedback that discourages productive retrying.
- Answer leakage.
- Misleading mathematical displays.
- Unclear completion.
- Inconsistent control terminology.

These reviews should lead to corrections within the AI's decision authority.

## 10.3 Evaluate against Document 1

Review every applicable quality area in *Great Maths Visuals*.

Do not reproduce its full checklist in this guide or in every handoff.

Instead, report:

- Standards met with supporting evidence.
- Problems discovered and corrected.
- Standards not yet verified.
- Known limitations.
- Deliberate exceptions or deferred requirements.

A mathematical, educational or accessibility limitation must not disappear simply because the automated tests pass.

## 10.4 Distinguish prediction from evidence

AI can evaluate likely educational clarity and common misconceptions.

It cannot establish actual learning gains merely by simulating a student.

Distinguish clearly between:

- Mathematically verified behaviour.
- Automated functional verification.
- AI expert judgment.
- Human expert review.
- Observations involving real students.

Do not overstate what the available evidence establishes.

---

# 11. Learning Evidence

The educational design should identify meaningful evidence of learning before implementation.

## 11.1 Identify useful events and outcomes

Depending on the learning objective, relevant evidence may include:

- Predictions.
- Committed mathematical choices.
- Explicit Checks.
- Incorrect attempts.
- Requests for explanation.
- Successful independent applications.
- Assisted completion.
- Results from subsequent attempts.

Avoid treating every transient movement as meaningful learning evidence.

## 11.2 Define the educational interpretation

For each important event or outcome, clarify what it tells us.

For example:

An incorrect Check indicates that the submitted mathematical answer did not match the expected result.

A request for assistance indicates that additional support was used.

A successful attempt without assistance provides a different kind of evidence from assisted success.

These distinctions should be grounded in the activity's actual rules.

## 11.3 Keep separate attempts distinct

Restarting should begin a distinguishable attempt without silently destroying previous evidence, where learning recording is supported.

A student who succeeds with assistance and later succeeds independently has generated potentially useful information about progress.

This should not automatically be described as proof of lasting mastery.

## 11.4 Keep storage outside the educational design

The visual defines what the evidence means.

The host application decides whether, where and for how long to retain it.

The Engineering Guide defines how data is produced and delivered technically.

Do not introduce storage or user-identity decisions into the educational design without a genuine product requirement.

---

# 12. Review and Reporting Protocol

Reviews should be understandable, focused and proportional.

## 12.1 Lead with the student experience

When reporting completed work, explain:

- What the student sees.
- What they can do.
- What mathematical relationship is revealed.
- How the activity progresses.
- What needs human judgment.

Do not begin with a large technical summary when the purpose of the review is educational approval.

## 12.2 Give a focused manual review

The development AI should explain exactly what to inspect.

For example:

**Try the activity at phone width. Move the mathematical object, inspect the relationship between the two graphs, then complete the incorrect-answer and assisted journeys.**

State what correct behaviour should look like.

Do not ask the human to rediscover the interface or manually verify every implementation detail.

## 12.3 Report evidence honestly

Summarise verification appropriately.

Distinguish:

- Verified behaviour.
- Unverified real-device behaviour.
- Educational judgments.
- Remaining limitations.

Avoid overwhelming the reviewer with test counts when those counts do not answer the educational question.

## 12.4 Do not reopen settled decisions without cause

Previously approved behaviour should remain stable unless:

- A contradiction is discovered.
- New evidence identifies a serious weakness.
- Implementation exposes a consequential limitation.
- The human explicitly requests a change.

Explain why a settled decision is being revisited.

Routine refinements do not require repeated approval.

---

# 13. Preserve the Authoritative Experience Specification

Long AI conversations may be compacted, restarted or transferred between agents.

The approved student experience must therefore exist independently of conversation history.

## 13.1 Required content

Each activity should have a concise, durable experience specification containing:

- Activity identity and intended learner.
- Central mathematical insight.
- Mathematical assumptions and important cases.
- Approved central interaction.
- Current stage sequence and experience map.
- Exact student-facing wording.
- Significant assessment and assistance decisions.
- Meaningful learning evidence.
- Explicitly approved product decisions.
- Outstanding questions and deferred limitations.
- Important revisions and their reasons.

The detailed format and storage arrangements belong to the development workflow and Engineering Guide.

## 13.2 Maintain a clear decision status

Distinguish explicitly between:

**Approved:** A decision that should govern the current experience.

**Proposed:** An option awaiting a decision.

**Deferred:** A known requirement or issue postponed with explicit acknowledgement.

**Superseded:** A previous decision that has been replaced.

Do not silently treat tentative ideas as approved requirements.

## 13.3 Keep documentation proportional

The specification should make the experience reproducible and understandable.

It should not become a transcript of every conversation or a catalogue of discarded implementation ideas.

Preserve decisions that affect student experience, mathematical meaning or important constraints.

Avoid duplicating programming documentation from the Engineering Guide.

---

# 14. Exceptions, Limitations and Deferred Requirements

Not every requirement will necessarily be completed in the first implementation milestone.

However, a known limitation must not be silently regarded as resolved.

## 14.1 Classify the limitation

For a substantive exception, identify:

- The affected requirement.
- The practical impact.
- Who or what is affected.
- Whether it blocks the intended milestone.
- The proposed resolution or reason for deferral.
- Whether the human approved deferral.

## 14.2 Respect the distinction between milestone acceptance and full readiness

For example, the first activity's non-drag touch alternative was explicitly deferred.

That did not invalidate the work completed, but it also did not establish full accessibility compliance.

AI reports should preserve this distinction.

A deferred requirement remains open until resolved and verified.

## 14.3 Avoid repeatedly escalating acknowledged limitations

Once a limitation has been recorded and its deferral approved, it should not trigger the same question at every checkpoint.

Reopen it when:

- Its agreed review point arrives.
- The relevant scope changes.
- New information materially changes the risk.
- It becomes a blocker for the next intended use.

---

# 15. Continuous Improvement

The process should improve after each completed visual.

## 15.1 Conduct a focused retrospective

Consider:

- What worked especially well?
- What caused rework?
- What confused the reviewer?
- Which problems should AI have detected independently?
- Which approval requests were unnecessary?
- Which design patterns proved reusable?
- Which new problems were specific to the mathematical topic?

Prefer a small number of consequential findings over a lengthy account of routine implementation details.

## 15.2 Assign lessons to the correct guide

| Type of learning | Where it belongs |
|---|---|
| What makes students understand mathematics | Great Maths Visuals |
| How AI should plan, decide, review and collaborate | AI Support Guide |
| Software patterns, architecture and technical verification | Step Visuals Engineering Guide |

Avoid duplicating rules across documents when a reference would suffice.

## 15.3 Expand the learning-stage bank deliberately

When a new activity reveals a genuinely useful stage type, consider adding it to the bank in *Great Maths Visuals*.

Document its purpose and a representative use.

Do not introduce stage names merely to make the framework appear comprehensive.

## 15.4 Evaluate autonomy using evidence

Useful indicators include:

- Substantial design changes after implementation.
- Human interventions required.
- Unnecessary questions asked.
- Time needed for the reviewer to understand the activity.
- Rework caused by ambiguous requirements.
- Important usability defects discovered late.
- Reuse of established patterns.

These measures should improve the process, not become targets that encourage agents to conceal problems or avoid necessary escalation.

## 15.5 Revise after actual experience

The current operating sequence should be treated as an initial standard.

After developing the second visual, review:

- Whether the experience map prevented confusion.
- Whether two major approvals were appropriate.
- Whether AI autonomy was sufficient.
- Whether the prototype was reviewed at the right time.
- Whether educational issues were detected before final human testing.
- Whether the three guides remained distinct and useful.

Refine the process based on those observations.

---

# 16. Compact Operating Rules for AI

When using this guide, follow these rules:

1. **Begin with the mathematical insight**, not the interface.

2. **Recommend a strong concept**, rather than presenting unfiltered possibilities.

3. **Validate the mathematics** before finalising the student experience.

4. **Produce an experience map** with actual student-facing wording and explicit progression.

5. **Account for every control** and remove unnecessary interaction steps.

6. **Rehearse incorrect, assisted and restarted journeys** before approving the design.

7. **Make routine decisions autonomously** within the approved requirements.

8. **Escalate consequential changes with recommendations**, not open-ended questions.

9. **Make the experience understandable before building it**.

10. **Prototype and validate the central mathematical interaction** before expanding it.

11. **Perform a cold-start review** before requesting final human evaluation.

12. **Assess quality against Great Maths Visuals**, without reproducing its entire contents.

13. **Distinguish verified facts from assumptions and educational predictions**.

14. **Preserve approved decisions outside conversation history**.

15. **Maintain the boundary between educational design and technical implementation**.

16. **Record known limitations and explicit deferrals** rather than quietly treating them as resolved.

17. **Learn from each completed activity** and refine the relevant guide.

---

# Final Principle

**The ideal AI-supported process makes the human reviewer an educational decision-maker, not an interface detective, routine tester or technical project manager.**

AI should take responsibility for developing the mathematical concept, proposing an understandable learning experience, anticipating problems, resolving routine decisions and critically evaluating its own work.

Human involvement should concentrate on consequential educational decisions and final judgment of the learning experience.

**The goal is not to eliminate human judgment. It is to ensure that human judgment is spent where it contributes the greatest value.**