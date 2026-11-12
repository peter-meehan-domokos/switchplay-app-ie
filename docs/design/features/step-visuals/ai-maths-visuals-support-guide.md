# AI Support Guide for Mathematical Visuals
## Designing Excellent Learning Experiences with Increasing AI Autonomy

**Version:** 1.2  
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

**The governing principle is: AI should complete all work within its current authority before requesting human attention.**

Before the first collaborative review, AI has full responsibility for educational design within the original project brief. Once human collaboration establishes decisions, subsequent independent work proceeds under an explicit autonomy contract specifying what AI may change and what remains protected.

Human involvement must be purposeful, well prepared and proportionate to the significance of the decision. The aim is to expand effective AI autonomy, not to turn every improvement into a permission request.

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

The default process has six **workflow phases** and two principal human approval points. Workflow phases describe the work; **authority modes** (autonomous or collaborative) describe who may make educational decisions. These are related but not interchangeable.

The initial Discover and Design work is autonomous: AI owns educational design within the original brief. Approval A is ordinarily the first collaborative review. Later autonomous work is governed by an explicit contract established when leaving collaboration.

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

Straightforward activities may combine phases. Complex or unfamiliar activities may justify additional review. A new human review does not automatically make every detail of the experience human-controlled; the resulting agreements and subsequent autonomy contract determine what is protected.

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

A collaborative review should conclude by recording consequential agreements and identifying whether the next work is collaborative or autonomous. If autonomy resumes, establish its scope before handoff; do not assume either unrestricted autonomy or universal protection of every previously visible detail.

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

## 2.4 Autonomous and collaborative authority modes

**Autonomous:** AI owns the assigned outcome and may investigate, design, evaluate and revise decisions within its authority. Before the first collaborative review, the original project brief and standing quality guides define that authority; no separate autonomy contract is needed. AI should not ask permission for ordinary educational decisions in this initial phase.

**Collaborative:** Human and AI actively evaluate and agree consequential decisions. AI should bring reasoned proposals and alternatives, but a proposal does not become a joint agreement simply because AI recommends or repeats it.

**Subsequent autonomous:** After collaboration, AI may again receive broad or narrow authority. The previously agreed design is protected only where the new autonomy contract says it is; the human may explicitly delegate authority to revisit earlier choices.

The current mode should be identifiable. A handoff, conversation ending, or another agent taking over does not by itself transfer decision authority.

## 2.5 Establish an autonomy contract when collaboration ends

**Every transition from collaborative work to a new autonomous phase must establish an explicit autonomy contract** that specifies:

1. **Objective:** The outcome AI must deliver.
2. **Autonomous authority:** Which educational, interaction, presentation and other decisions AI can make or revise independently.
3. **Protected decisions:** Which existing agreements cannot be changed without further discussion.
4. **Escalation conditions:** Which conflicts, discoveries or proposed deviations require renewed collaboration.
5. **Completion criteria:** What must be delivered or verified before the next review.

The contract references the living experience specification and consequential entries in the decision log (Section 13). It may be a concise section of the current brief or handoff; it does not need a third permanent document. When authority is unchanged, the contract can explicitly carry forward an earlier one rather than being rewritten in full.

Once the contract is established, AI should work independently within it. If a consequential decision falls outside or ambiguously across its boundaries, AI should surface the issue rather than silently treating itself as authorised. Do not turn the contract itself into an unnecessary extra approval meeting.

**Phase-transition rule:** Complete the assigned work autonomously, or collaborate on the decision at hand, without assuming authority to start a different phase. When changing from collaborative to autonomous work, clarify the contract first.

---

# 3. Roles and Decision Authority

Three roles contribute to the process.

## 3.1 Design AI

The design AI leads the educational experience within its current authority mode and autonomy contract, if any.

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

The development AI, currently Codex, owns technical realisation within its assigned scope. It may also hold expressly delegated educational-design authority during an autonomous phase; technical ownership alone does not grant that authority.

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

The human determines the original project objective and the allocation of decision authority. During collaborative phases the human shares in consequential educational and product decisions; during autonomous phases AI makes decisions within its delegated scope.

Human attention should focus on:

- The value of the chosen mathematical insight.
- Whether the central interaction communicates it.
- Whether the learning sequence feels coherent.
- Significant alternatives or trade-offs.
- Final educational and visual approval.

The human should not normally have to reconstruct undocumented interface behaviour, resolve routine implementation details or identify obvious wording defects.

## 3.4 Autonomous decisions

**Autonomy is phase- and contract-dependent, not a fixed list of small changes.**

During the **initial autonomous design phase**, AI may decide and revise the central insight, interaction, learning journey, examples, language and presentation within the original objective and the standards in *Great Maths Visuals*. AI should resolve genuine design choices independently and critically evaluate its own work before the first human review.

During **later autonomous phases**, AI may make any decision explicitly delegated by the autonomy contract, whether substantial or routine. Other consequential decisions remain protected. AI should be ambitious in identifying and investigating possible improvements even when it cannot implement them without further agreement.

Examples of routine decisions that are normally autonomous *when consistent with the current contract* include:

- Correcting an unambiguous typographical error.
- Making established labels consistent without changing their educational meaning.
- Adjusting secondary presentation to improve readability within agreed visual constraints.
- Choosing conventional placement for supporting elements where placement has not been protected.
- Resolving routine technical matters under the Engineering Guide.

Once wording or behaviour has been collaboratively agreed and protected, AI must not silently rewrite it merely because another phrasing seems shorter or more consistent. Removing a supposedly redundant explanation can change the teaching and should be proposed when outside delegated authority.

## 3.5 Decisions requiring human confirmation

During **collaborative work**, consequential proposals should be discussed and agreed. During a **subsequent autonomous phase**, human confirmation is required only when a proposed change exceeds or conflicts with the autonomy contract, or meets an agreed escalation condition.

Potentially consequential areas include:

- The central mathematical insight or main discovery.
- The stage sequence and its mathematical dependencies.
- Established student-facing explanations and instructions.
- Starting states and significant interaction behaviour.
- The type or timing of assessment, feedback, assistance or answer reveal.
- Significant new student-facing controls or modes.
- Consequential accessibility and usability trade-offs.

These are **not permanently human-controlled categories**. For example, AI may independently redesign a stage when expressly delegated that authority; it must not insert an unapproved stage while contracted only to implement a protected learning journey.

## 3.6 Mandatory escalation

Stop the affected decision and seek guidance when:

- Mathematical interpretation is materially uncertain and cannot be validated responsibly within the assigned scope.
- Protected requirements conflict or the authoritative sources disagree about a consequential decision.
- A desired change lies outside delegated autonomy, including changes to protected learning objectives or student-facing behaviour.
- A serious accessibility or safety requirement cannot be met within the agreed scope.
- A consequential product decision has not been delegated and cannot be resolved from existing agreements.
- The autonomy contract does not clearly allocate authority for an important choice.

Multiple plausible educational approaches **within an autonomous design mandate** are a reason for AI to evaluate and decide, not automatically a reason to ask the human. Unrelated work within authority may continue safely.

## 3.7 The question filter

Before asking the human, AI must determine:

1. Which authority mode is active, and what does the autonomy contract permit or protect?
2. Is the answer already in the current living specification, decision log, brief or companion guides?
3. Can reliable mathematical reasoning, learner-centred evaluation or established design standards settle the choice within the current authority?
4. Is the issue a genuine conflict or an unapproved change, or merely an ordinary decision AI has been asked to own?

If the choice is delegated, decide and verify it. If it requires collaboration, present:

**Decision required → recommendation → reasoning → meaningful alternatives.**

Group related decisions into one review where possible. Do not turn uncertainty about routine work into unnecessary permission requests.

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
- Protected decisions under the current autonomy contract.

A suggestion or example must not silently become a fixed requirement. Equally, a decision made legitimately during an autonomous phase is part of that phase's work: it need not be retroactively approved to count as a design decision. Collaborative review and the subsequent contract determine which decisions become protected.

When a later proposal conflicts with a current decision, trace its origin and authority rather than assuming that a repeated AI recommendation, a mockup or a draft plan has established approval.

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
- Revisiting an earlier stage or subsection after exploration.

Specify the difference between **fresh-entry defaults** and **returning-state behaviour**. An initial example may be chosen to establish a natural progression, while a returning learner may need their previous choices, answers or exploration settings restored. These are distinct educational decisions; the Engineering Guide governs their technical realisation.

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

Where screen arrangement is important to comprehension, provide simple sketches or mockups. Treat these as exploratory design evidence: incidental styling, labels, controls or layout details in generated imagery are **not approved requirements** unless explicitly adopted. Identify which aspects the review is intended to decide.

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

Rehearse the educationally significant **states and transitions**, not just the first screen of each stage: for example, after a prediction, while a different graph is selected, after a hint, after an incorrect Check, and on completion. Ask whether the visible mathematics, instruction and next action still make sense to a student with no knowledge of the specification.

## 8.3 Approval A is about experience, not implementation

The human approves the learning objective, mathematical relationship and student journey.

The human does not need to approve routine technical implementation details.

Where the design contains important uncertainty, present the AI's preferred resolution and the consequences of alternatives.

Before development begins, the AI must ensure that every significant mathematical object, interaction, control, transition and feedback state is described clearly enough for the development agent to implement without inventing consequential educational behaviour.

# 9. Development and Agent Handoff

After approval A, the development AI takes responsibility for constructing the experience within the agreed autonomy contract. The contract may delegate additional design responsibility, but that must be explicit; implementation responsibility alone does not grant permission to change protected educational requirements.

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
- The current living specification, consequential decision-log entries and autonomy contract.

These together form the **authoritative educational handoff**. The contract states what the development AI may revise autonomously; the specification states the current intended student experience. No separate implementation-plan proposal may silently expand the contract.

## 9.2 Initial development review

The development AI should inspect the specification for:

- Mathematical contradictions.
- Missing interaction behaviour.
- Unclear stages.
- Unspecified controls.
- Conflicts with existing product conventions.
- Accessibility problems.
- Requirements that cannot be delivered without changing the approved experience.

Routine issues within the contract should be resolved independently.

For consequential changes or apparent contradictions, check **requirement provenance** before implementation: did the requirement come from the current brief, an approved collaborative decision, an autonomous decision within delegated authority, the living specification, or an unresolved AI proposal? Apply this check to suggestions from both design and development AI.

A proposal in an earlier assistant message, mockup, draft plan or review report does not become binding merely by repetition. If a change exceeds delegated authority or conflicts with protected behaviour, explain the conflict and recommend a resolution rather than silently implementing it.

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

After validating the core interaction, build the intended learning journey within the current contract.

Do not silently introduce stages, controls, educational wording changes or assessment rules that exceed delegated authority. Conversely, exercise genuinely delegated design autonomy without unnecessary requests for approval.

Technical implementation decisions belong to the development AI and the Engineering Guide. Student-experience decisions follow the authority model in Sections 2 and 3.

Before substantial implementation or a new autonomous handoff, perform the consistency check in Section 13.

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
7. Changes of mathematical example, subsection and return to earlier work.

Inspect the **actual rendered** states that carry important mathematical information, not just the opening screens. Use representative portrait-phone sizes, including hint and finished-answer views. Choose states according to educational significance rather than imposing an exhaustive screenshot checklist.

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

Displaying an example or a rule records **exposure**, not proof that the student noticed, explored or understood it. Selecting a graph records a **choice**, not necessarily meaningful investigation of it. An intentional prediction, committed calculation or submitted Check can provide stronger, though still limited, evidence of attempted reasoning.

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

## 12.4 Respect settled decisions and delegated authority

During collaborative work, previously agreed decisions should remain stable unless a contradiction, important new evidence, consequential implementation limitation or explicit request justifies revisiting them.

During autonomous work, follow the current contract: protected decisions remain stable unless the contract permits revisiting them or a new agreement is reached; delegated decisions may be reconsidered without repeated approval.

When a learner-facing problem is identified in protected behaviour, explain it and propose the **smallest effective correction** before suggesting broader redesign. The smallest correction is the least unnecessary change to the student's experience, not necessarily the fewest lines of code.

Explain why a protected decision is being revisited. Do not rewrite settled student-facing copy merely for stylistic uniformity.

## 12.5 Respect the requested workflow phase

Finish the currently assigned task thoroughly, but do not assume that discussing a design authorises drafting a new implementation prompt, starting development or moving into another phase. A recommendation to proceed is not itself agreement to proceed.

Likewise, in an authorised autonomous phase, do not interrupt ordinary decisions with repeated approval requests. Use the phase-transition rule and autonomy contract in Section 2.

---

# 13. Preserve the Authoritative Experience Specification

Long AI conversations may be compacted, restarted or transferred between agents.

The current student experience must therefore exist independently of conversation history. **Maintain one living experience specification, one lightweight decision log and an explicit autonomy contract whenever responsibility returns to AI after collaboration.** These have different purposes, and none should become a competing version of another.

## 13.1 One living experience specification

Each activity should have **one authoritative, current** experience specification containing:

- Activity identity and intended learner.
- Central mathematical insight.
- Mathematical assumptions and important cases.
- Current authoritative central interaction.
- Current stage sequence and experience map.
- Exact student-facing wording.
- Significant assessment and assistance decisions.
- Meaningful learning evidence.
- Current authoritative educational and product decisions, whether agreed collaboratively or made within delegated autonomy.
- Outstanding questions and deferred limitations.
- Important current revisions and remaining limitations.

The specification describes **what the student should currently experience**; it is not a transcript or an ever-growing stack of amendments. After relevant decisions are made in collaboration, incorporate approved changes into the corresponding sections at natural checkpoints. Before the next substantial implementation handoff, the specification must reflect all applicable current decisions.

The detailed format and storage arrangements belong to the development workflow and Engineering Guide.

## 13.2 Maintain a lightweight decision log

Keep a concise record of consequential educational and product decisions that may otherwise be difficult to interpret later. For each, record:

- **Decision:** What was decided.
- **Reason:** Why it was preferred, including any important trade-off.
- **Status:** Whether it is current, deferred or superseded.
- **Supersession:** Which earlier decision it replaces, where applicable.

The decision log records **why important choices were made**, while the living specification records **what is now required**. Do not log every punctuation adjustment or routine implementation choice. Do not force the reader to reconcile competing instructions spread across the log and specification.

## 13.3 Maintain decision and authority status

Distinguish explicitly between:

**Approved:** Agreed in collaboration or otherwise authoritative under the current brief or contract.

**Autonomously decided:** Chosen legitimately by AI within its assigned authority; it does not require retrospective human sign-off merely to be a design decision.

**Proposed:** An option awaiting a decision by the actor currently holding authority.

**Protected:** A current decision the next autonomous phase may not change without renewed collaboration.

**Deferred:** A known requirement or issue postponed with explicit acknowledgement.

**Superseded:** A previous decision that has been replaced.

A decision may be both approved and protected, or autonomously decided and later protected following review. Status should be interpreted against the current phase and autonomy contract. **A suggestion, mockup detail or implementation-plan idea must not silently become an authorised requirement.**

## 13.4 Consistency and authority check before handoff

Before substantial implementation work or a new autonomous phase after collaboration, verify:

1. The living specification reflects all applicable current decisions and exact agreed student-facing wording.
2. Superseded requirements have been replaced or clearly marked, rather than remaining as competing instructions.
3. The decision log preserves the rationale for consequential choices without overruling the specification.
4. Proposed changes have not been mistaken for decisions; their provenance and approval status are clear.
5. The autonomy contract identifies the new objective, delegated and protected decisions, escalation conditions and completion criteria, and does not contradict the specification or log.

If the source documents conflict about a consequential learner-facing requirement, investigate the origin of the discrepancy and resolve it within current authority or escalate. Do not assume a regression cause or silently choose whichever wording appears latest.

## 13.5 Keep documentation proportional

The specification should make the experience reproducible and understandable, not become a transcript of every conversation or a catalogue of discarded ideas.

The log and contract can be short and may live inside existing project documents. Consolidate amendments at natural checkpoints, not after every conversational sentence. Avoid duplicate authoritative specifications and keep implementation details in the Engineering Guide.

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
- Whether the deferral was authorised within the current phase and contract or explicitly agreed in collaboration.

## 14.2 Respect the distinction between milestone acceptance and full readiness

For example, the first activity's non-drag touch alternative was explicitly deferred.

That did not invalidate the work completed, but it also did not establish full accessibility compliance.

AI reports should preserve this distinction.

A deferred requirement remains open until resolved and verified.

## 14.3 Avoid repeatedly escalating acknowledged limitations

Once a limitation and its deferral have been recorded and authorised under the current authority model, they should not trigger the same question at every checkpoint.

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
- Did the transitions between collaborative and autonomous work grant enough authority while protecting agreed decisions?
- Did proposed requirements acquire authority without a clear source or agreement?

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
- Human interventions required, and whether they were well timed and necessary.
- Unnecessary questions asked.
- Time needed for the reviewer to understand the activity.
- Rework caused by ambiguous requirements.
- Important usability defects discovered late.
- Reuse of established patterns.
- Rework from unclear or contradictory autonomy contracts and outdated specifications.

These measures should improve the process, not become targets that encourage agents to conceal problems or avoid necessary escalation.

## 15.5 Revise after actual experience

The current operating sequence should be treated as an initial standard.

Following the second visual, the Integration experience highlighted the importance of connected mathematical reasoning, significant rendered states, reliable decision preservation and authority transfers between phases.

Continue to review:

- Whether the experience map and its stage-to-stage dependencies prevented confusion.
- Whether the principal collaborative reviews occurred at the right time.
- Whether AI had sufficient authority before the first review and under each subsequent contract.
- Whether the prototype and rendered learner states were reviewed appropriately.
- Whether educational problems were detected before final human testing.
- Whether the living specification, decision log and contract remained consistent.
- Whether the three guides remained distinct and useful.

Refine the process based on observed outcomes, not assumed educational effectiveness.

---

# 16. Compact Operating Rules for AI

When using this guide, follow these rules:

1. **Begin with the mathematical insight**, not the interface.

2. **Own the initial autonomous design phase** within the original brief; do not seek routine human permissions.

3. **Recommend and select a strong concept**, rather than presenting unfiltered possibilities.

4. **Validate the mathematics** before finalising the student experience.

5. **Produce an experience map** with exact student-facing wording, coherent progression and significant returning states.

6. **Account for every control** and remove unnecessary interaction steps.

7. **Rehearse significant learner states**, including incorrect, assisted, returning and finished journeys.

8. **Make decisions according to the current phase and autonomy contract**, not a universal list of prohibited changes.

9. **Agree an explicit contract when collaboration returns to autonomy**, identifying delegated and protected decisions.

10. **Escalate only matters beyond authority or requiring genuine collaboration**, with recommendations rather than open-ended questions.

11. **Make the experience understandable before building it**.

12. **Prototype and validate the central mathematical interaction** before expanding it.

13. **Review rendered mathematical states on mobile** before requesting final human judgment.

14. **Assess quality against Great Maths Visuals**, without reproducing its full checklist.

15. **Distinguish verified facts from assumptions and educational predictions**.

16. **Maintain one living experience specification and a lightweight decision log**, with a consistency check before handoff.

17. **Trace consequential requirements to their actual source**, including suggestions from design AI.

18. **Preserve the separation between educational authority and technical ownership**.

19. **Respect the requested phase**; do not turn discussion into unsolicited implementation.

20. **Record known limitations and explicit deferrals** rather than quietly treating them as resolved.

21. **Learn from each completed activity** and refine the relevant guide.

---

# Final Principle

**The ideal AI-supported process makes the human reviewer an educational decision-maker, not an interface detective, routine tester or technical project manager.**

AI should fully own the initial educational design within the brief, critically evaluate its work and arrive at the first collaborative review with a coherent experience rather than a queue of routine questions.

Human collaboration establishes consequential agreements. When the work returns to AI, a clear autonomy contract should give it enough authority to progress independently while preserving only the decisions that remain protected.

**The goal is not to minimise autonomy or eliminate human judgment. It is to transfer responsibility deliberately so AI initiative and human educational judgment each contribute where they have the greatest value.**