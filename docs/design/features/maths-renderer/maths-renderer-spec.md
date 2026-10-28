# Mathematical Content Renderer — Product and Interaction Specification

**Target repository location:** `docs/design/features/maths-renderer/maths-renderer-spec.md`  
**Status:** Initial agreed design; technical investigation pending  
**Initial consumer:** Info Card explanations  
**Scope:** Standalone mixed-prose and mathematical-content renderer (not an Info Card feature implementation)

## 1. Purpose

Build an **isolated, reusable mathematical content renderer** that accepts ordinary explanatory prose containing LaTeX mathematics and produces correctly typeset, readable content. It must work in different contexts and container sizes. Info Cards are the **first consumer**, not the architectural basis or size target of the renderer.

Initially, the creator can ask ChatGPT to generate content containing LaTeX and paste the resulting string into the existing explanation input. The goal is *not* to build a mathematical keyboard, formatting toolbar, visual equation editor or AI authoring workflow in v1.

Future consumers may include larger learning panels, worked solutions and AI-generated feedback. **Do not implement those consumers now.**

## 2. Architectural boundaries — agreed

1. The renderer is a **new, self-contained component/system**. Keep its parsing, layout, mathematical typesetting, styles and tests in new, isolated files.
2. **No imports from Info Card components, models or capacity utilities** inside the renderer. Do not extract, adapt, or reuse existing application components to build it. A third-party mathematical typesetting library may be selected following technical investigation.
3. The renderer is **not aware of Info Card dimensions**, publication state, data structures, editor state, media, or business rules. Do not hardcode Info Card dimensions, maximum line counts, font sizes or padding.
4. The **consumer supplies the content, available dimensions/layout constraints and any agreed presentation settings**. The renderer handles mixed prose/math presentation and assesses the actual rendered layout against those constraints.
5. The renderer must expose **rendering/capacity information** to the consumer: whether content fits the available width and height, and enough diagnostics to support an appropriate response. The exact API and measurement strategy are technical design questions.
6. The renderer **does not guarantee that all content will fit**. It must detect/report non-fitting content, not silently shrink, clip, truncate, scroll or reinterpret it to force a fit. Any alternative behaviour requires later explicit product approval.
7. Consumers decide what to do with the result. In a later, separately approved phase, Info Cards will use the new rendering/capacity system **in place of their existing plain-text capacity estimator for mathematical-content support**; the old estimator must **not** be imported into or used as part of the new renderer.
8. Isolate development from unrelated product changes. **Do not create a new Git worktree.** The existing Info Card Codex chat can continue handling unrelated bugs; coordinate edits to shared files when integration eventually occurs.

### Explicit non-goals for v1

- Direct mathematical authoring controls or a visual equation editor.
- Parsing ambiguous ordinary prose to *infer* mathematics not marked as LaTeX.
- Info Card layout redesign, card resizing, publication changes or editing UX changes during standalone renderer development.
- AI-generated feedback or student-upload features.
- General application component reuse/refactoring or an application-wide dependency search.
- Automatic maths line wrapping, resizing or overflow remediation unless separately approved.

## 3. Source-content format — agreed

The renderer receives **one content string** that can contain prose and LaTeX.

- **Inline maths:** `$...$`, embedded within ordinary prose.
- **Display maths:** `$$...$$`, occupying its own mathematical display line/block.
- Text outside maths delimiters remains ordinary explanatory prose.
- **Preserve deliberate single newlines** in prose; blank lines separate paragraphs.
- If prose and inline maths are on the same input line, they remain in the same text flow and may wrap naturally with the container.
- Display maths remains distinct from the surrounding prose even when there are no blank lines around it.
- Parsing must respect the contents of a maths block: do not split an aligned/multiline LaTeX expression using the prose paragraph rules.
- Mathematical alignment is **explicit in LaTeX provided by the creator/ChatGPT**; the renderer does not guess whether equals signs should line up.

**Inline example (source):**

```text
First, divide both sides by 3. $x=\frac{12}{3}$ Therefore, $x=4$.
```

**Mixed multi-line example (source):**

```text
First, divide both sides by 3.
$$x=\frac{12}{3}$$
Therefore,
$$x=4$$
```

Both examples must be valid. The first is a single flowing sentence with inline expressions; the second preserves its intentionally separate prose and mathematical lines.

### Two distinct mathematical alignment styles — agreed

**A. Equations with expressions on both sides of `=`**

- Vertically align the equals signs in a multi-line working block.
- Left expressions are **right-aligned toward** the equals column, not aligned by their left edges.
- Right expressions begin consistently after the equals column; spacing on either side of `=` is balanced.
- The equals column is the central *internal alignment anchor*, not a command to centre every complete mathematical line separately.

Illustrative standard LaTeX source:

```latex
$$
\begin{aligned}
2(x+3) &= 14 \\
2x+6 &= 14 \\
2x &= 8 \\
x &= 4
\end{aligned}
$$
```

**B. Chain of reasoning with leading equals signs**

- The expressions on all lines **start in one common column**.
- Subsequent lines show `=` in a separate column **to the left** of those expressions.
- The initial expression, which may have no leading equals sign, starts at **the same expression column** as the subsequent lines.
- The overall working block is indented relative to surrounding prose.

Illustrative standard LaTeX source (syntax to be verified with the selected engine):

```latex
$$
\begin{aligned}
&\phantom{={}}x^2+5x+6 \\
&=x^2+2x+3x+6 \\
&=x(x+2)+3(x+2) \\
&=(x+2)(x+3)
\end{aligned}
$$
```

The critical visual requirement is the alignment of the **expressions** after the optional `=`, *not* alignment of `=` with the initial `x^2`.

These are presentation capabilities of the general renderer, **not modes specific to Info Cards**. Use established LaTeX alignment constructs rather than adding automatic algebraic interpretation.

## 4. Visual rules — agreed

- Display mathematics has a **deliberate, consistent indentation** relative to surrounding prose. Do **not** treat every line as an independently centred equation.
- Multi-line working is aligned as described in section 3. A mathematical block reads as one coherent unit.
- Use **modest, consistent spacing** between prose and display maths and between successive mathematical working lines.
- Preserve ordinary prose line breaks and distinguish them from blank-line paragraph separation.
- Mathematical symbols should be approximately the **same perceived size** as surrounding prose, but fractions, radicals, superscripts and subscripts must receive the ascent/descent and height they need to remain legible.
- Inline fractions and other tall expressions must not collide with adjacent text lines.
- Display expressions must not overlap surrounding prose or each other.
- Do not impose fixed Info Card typography. Presentation must respond to consumer-supplied typography/layout settings as agreed in the eventual contract.
- Long expressions must **not** be broken, reduced or clipped in a way that silently changes or obscures mathematical meaning.

**Exact numerical values** for indentation, line/paragraph gaps, maths scaling and minimum legibility have **not** been fixed. Establish sensible options in standalone prototypes, report the results and seek approval before treating values as product rules.

## 5. Layout constraints and capacity — agreed

The renderer must support consumers with small or large available areas. It should work when dimensions change; the same mathematical input could fit a larger panel and fail to fit a smaller one.

The consumer conceptually supplies:

- source content;
- available width and height (or equivalent layout constraints);
- any agreed presentation configuration (e.g., prose typography).

The renderer conceptually provides:

- correctly laid-out prose and mathematics;
- width/height fit status, based on **formatted output**, not LaTeX source length or raw character counts;
- enough measurement/error information for the consumer to respond.

A narrow Info Card is only **one test case**. Info Cards are currently intended for roughly two or three lines of mathematical working, but **that is not a limitation of the renderer**. Info Card height may be increased in a future, separately approved design change.

Do not silently shrink, clip, truncate, scroll, or automatically line-break mathematical expressions to fit. Report insufficient space. The correct technical way to produce reliable measurements (including client/server publication checks) is **open for investigation**.

## 6. Invalid mathematical input — agreed principle

Invalid/unsupported LaTeX should trigger **clear authoring feedback**, not silently render as if it were correct maths. The exact diagnostic representation and any learner-facing fallback remain decisions to resolve during technical design/integration. Do not implement an unapproved error UX.

## 7. Independent development and regression protection — agreed

### Standalone phase

- Develop the new renderer in an isolated folder, with tests in new files.
- Create a **development-only test page** that imports the renderer and places it in ordinary containers. It should not import Info Card components or models.
- Use **fixed representative sample content initially**; do not introduce editor/preview UX merely for testing.
- Exercise small, medium and large container sizes; both dimensions should vary, including deliberately insufficient dimensions.
- Include prose, inline maths, display maths, aligned multi-line working, factorisation chains, fractions, radicals, powers, short lines such as `Therefore,`, and erroneous/oversized expressions.
- A test container may reproduce current Info Card dimensions as an **example**, but such values belong only in the test page/test fixtures, never in the renderer.
- **Do not change existing Info Card files** in this phase. Even dependency installation and adding a route may touch existing files; identify these exceptions in the engineering plan and obtain explicit approval first.

### Later integration phase — separately approved

- Connect the Info Card explanation area to the standalone renderer using its agreed contract.
- Replace the existing Info Card plain-text capacity estimator for the new rendering behaviour, **without reusing its implementation inside the standalone renderer**.
- Resolve how client-rendered measurements agree with server-side draft/publication validation and consultation reads. **Do not assume a browser-reported fit result is authoritative for the server.**
- Preserve existing explanation text, saving/autosave, publication immutability, consultation visibility and layout behaviour; pay particular attention to existing published plain-text content.
- No integration, capacity-rule changes or card-height changes until explicitly reviewed and approved.

## 8. Acceptance scenarios for the standalone renderer

The following are behavioural checks, **not** implementation prescriptions:

1. **Inline:** `Solve $x^2=9$, so $x=\pm3$.` renders as fluent prose with inline mathematical symbols.
2. **Line structure:** Prose, a display equation, `Therefore,`, then another display equation appear in their authored order, with natural spacing.
3. **Two-sided aligned equations:** Equals signs share a column; left expressions end consistently before the equals column; right expressions start consistently after it.
4. **Factorisation chain:** The first expression and all subsequent expressions share a start column; leading equals signs sit to its left.
5. **Fraction/root height:** Tall inline and display maths do not collide with adjacent lines.
6. **Small/large containers:** The same content renders using the same renderer in materially different-sized containers, without Info Card-specific assumptions.
7. **Overflow:** The renderer detects and reports insufficient width and/or height rather than silently disguising the problem.
8. **Malformed input:** Invalid/unsupported LaTeX produces a diagnostic that can support clear authoring feedback.
9. **Isolation:** Renderer files do not depend on Info Card components/models/capacity modules; standalone tests do not need Info Card infrastructure.

## 9. Known existing-system facts (investigation context only)

A prior read-only Codex investigation reported that:

- The Info Card explanation editor currently uses an ordinary controlled textarea, with explanation stored as `body: string`.
- Rendering currently treats explanations as plain prose, preserving newlines/paragraphs.
- The Info Card capacity estimator uses precomputed text widths, **not actual typeset mathematical dimensions**.
- Drafts can save while over capacity; publication enforces fit; consultation may revalidate published capacity.
- The baseline Info Card explanation area is narrow, and media reduces available height.

These facts are **integration/regression considerations**, not design constraints for the standalone renderer. Codex should verify code references before engineering planning, and avoid broad searches for components to reuse.

## 10. Open technical/design questions for Codex investigation

Codex should report findings and preliminary recommendations **in chat first**, without modifying code or creating the engineering plan yet:

1. Which standalone typesetting engine (e.g., KaTeX or MathJax) best supports the agreed `aligned` forms, inline/display delimiters, font loading, accessibility and sizing?
2. How should a contained renderer measure real formatted output and reliably report width/height overflow without altering the consumer's layout?
3. What component/API boundary best keeps all maths parsing/layout/capacity responsibilities inside the renderer while accepting consumer-supplied constraints?
4. How can a standalone dev page be registered with minimal impact on existing files? Identify any exact necessary exceptions.
5. What risks arise from ambiguous dollar signs, escaped delimiters, prose newlines/whitespace, unsupported macros, and malformed content? Propose options; **do not silently choose UX conventions**.
6. How could future server-side Info Card publication/consultation checks use trustworthy capacity information without relying blindly on client claims? This is an **investigation for later integration**, not a request to implement server work.
7. What compatibility/versioning strategies could preserve currently published plain-text explanations when math interpretation and capacity validation are introduced? Do not select one without approval.
8. What tests and isolated fixtures will detect mathematical errors, visual regressions, font-loading shifts and overflow in multiple container sizes?

## 11. Approval and deliverables

**Current authorised next action:** Read this specification, perform a tightly scoped, read-only technical investigation and report findings, trade-offs, unresolved decisions and preliminary suggestions **in the Codex chat**.

**Not yet authorised:** Creating/editing source files, installing libraries, adding a route, modifying Info Cards, creating a worktree, implementing a prototype, or writing the engineering plan.

After the findings and design questions are reviewed, Codex's **ultimate planning deliverable** will be:

`docs/engineering/features/maths-renderer/maths-renderer-engineering-plan.md`

That plan must be explicitly requested and reviewed before implementation. All technical/UX proposals not already agreed above are **proposals requiring approval**, not decisions.
