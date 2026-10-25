# Mathematical Content Renderer — Engineering Plan

**Status: Approved plan — Stages 0 and 1 implemented; awaiting Stage 1 review. Stages 2–5 are not authorised.**

**Date:** 25 October 2026

**Authorisation:** The user explicitly approved Stages 0 and 1, including the pinned KaTeX dependency, isolated alignment implementation/tests and iPhone Wi-Fi review setup. This does not authorise Stage 2 or later stages. Section 14 records implementation evidence.

**Working context:** Existing `feat/math-renderer` branch and shared working directory. Do not create another branch or Git worktree.

## 1. Purpose, scope and authority

Build a standalone, general-purpose system for rendering explanatory prose mixed with LaTeX and assessing its actual browser layout against consumer-supplied constraints. Info Cards are the intended first consumer, not the renderer's architectural basis. Standalone development and acceptance must complete independently of publication-capacity integration.

Authority, in order:

1. The user's explicit subsequent decisions in this conversation, particularly the engineering-plan authorisation and the clarification answers recorded below.
2. The complete [product and interaction specification](../../../design/features/maths-renderer/maths-renderer-spec.md).
3. This plan's engineering recommendations, within the explicitly approved stages. Provisional visual settings still require user approval.

Labels used in this plan:

- **Agreed:** product requirements or explicit user decisions.
- **Recommended:** proposed technical choices for plan review.
- **Provisional:** candidates needing implementation evidence or visual approval.
- **Open:** unresolved questions; do not silently decide them during coding.

### 1.1 Subsequent decisions and specification discrepancies

The design document still describes technical investigation as pending and leaves some error/source rules open. Do not edit it as part of this task. The conversation now establishes:

| Topic | Current authority |
| --- | --- |
| Engine | KaTeX is the preferred technical direction, subject to early fidelity verification. |
| Literal currency | `\$` represents a literal dollar. Prose `€` and `£` need no special escaping; mathematical currency representations must also work. |
| Invalid maths | Emit a diagnostic and display the original unformatted expression, including its original `$` or `$$` delimiters. Do not repair it. |
| Unmatched delimiters | Emit a diagnostic and display the unmatched opener and all remaining source literally. Later maths in that remainder stays unformatted until the source is corrected. |
| Paragraph separators | Any run of blank separator lines creates one paragraph gap. Preserve deliberate single prose newlines. |
| Mathematical wrapping | Inline expressions stay intact and may move as units within prose. No automatic internal breaks; explicit working rows remain. |
| Scope | Browser-only standalone development first. No publication workers, services, attestations, persistence changes or consumer integration. |
| Mathematical vocabulary | Pass normal KaTeX mathematics through without an arbitrary command allowlist. Investigate individual rendering/measurement problems; obtain approval before excluding otherwise supported functionality. Unsafe resources/commands remain protected. |
| Complex transforms | Future measurement prioritises ordinary layouts, translation and positive axis scaling. Rotation, skew and perspective may report measurement unavailable; no general transformation engine or approximate fit claims. This direction does not authorise Stage 2. |

The two precise alignment layouts are fixed requirements. At planning time their candidate KaTeX sources were unverified. Stage 1 now provides browser geometry and visual evidence for both layouts and both B candidates; see section 14. A successful parse alone is still not acceptance evidence.

### 1.2 Verified repository and technical references

- [package.json](../../../../package.json): Next.js 16.2.6, React 19.2.4, TypeScript, Node test runner via `tsx`, and Playwright are present. Stage 0 added exactly pinned KaTeX 0.19.1. A package lockfile exists.
- [Installed routing guide](../../../../node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md): new App Router `page.tsx` files register routes without central registration.
- [Installed client/server guide](../../../../node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md): browser measurement belongs in a Client Component boundary.
- [Installed CSS guide](../../../../node_modules/next/dist/docs/01-app/01-getting-started/11-css.md): CSS Modules support local rules; package styles can be imported from colocated components. Global styles can persist after navigation.
- [Installed notFound reference](../../../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md): supports a production guard for the development page.
- [playwright.config.ts](../../../../playwright.config.ts) and [capacity browser configuration](../../../../playwright.info-cards-capacity.config.ts): separate browser configurations are established infrastructure. Do not extend the existing Info Card fixture server.
- KaTeX [API](https://katex.org/docs/api.html), [options](https://katex.org/docs/options.html), [supported functions](https://katex.org/docs/supported.html), [support table](https://katex.org/docs/support_table.html), and [font guidance](https://katex.org/docs/font.html): source for engine-specific decisions. Pin and recheck the selected release during the approved dependency stage.
- The CSS Working Group's [Font Loading draft](https://drafts.csswg.org/css-font-loading/#font-face-set-ready), [CSSOM View draft](https://drafts.csswg.org/cssom-view/), and [Resize Observer draft](https://drafts.csswg.org/resize-observer/) describe the browser APIs and their limits. These are technical references, not proof that the proposed measurement implementation works.

Before coding, reread the relevant installed Next.js guides and any updated directory instructions. Repository facts may change while the other chat continues its work.

## 2. Confirmed requirements and architectural boundaries

**Agreed:**

- Accept one string containing prose, `$...$` inline maths and `$$...$$` display maths.
- Preserve authored prose line breaks and paragraph separation; collapse repeated blank separator lines to one paragraph gap.
- Render fractions, roots, powers, symbols, nested expressions, and explicit multiline working in coherent reading order, including short lines such as `Therefore,`.
- Implement layouts A and B exactly as defined in section 5.2. Do not infer alignment from algebra or centre each row independently.
- Accept different dimensions and typography from consumers; no embedded consumer dimensions, font sizes, line limits, expression limits or padding assumptions.
- Keep all parsing, typesetting, layout, styling, measurement and rendering diagnostics within the standalone system.
- Report horizontal and vertical capacity separately from input validity and measurement readiness.
- No automatic shrinking, internal maths wrapping, scrolling, clipping, truncation or rewriting to force a fit.
- Invalid input remains visible as original unformatted source and produces diagnostics. Markdown is not parsed in v1.
- Do not import, copy, extract or adapt application-specific components, models, business logic or capacity estimators.
- Source and tests start in new files. Existing-file exceptions need explicit approval.

**Out of scope:** Info Card integration; changes to editing, saving, storage, publication validation or consultation; replacement of the existing estimator; server-controlled measurement; attestations; legacy migration; authoring controls; Markdown parsing; AI feedback and other future consumers.

## 3. Proposed standalone architecture

**Recommended folder:** `src/components/maths-renderer/`. These are proposed file responsibilities, not a requirement to create a separate abstraction for every helper:

| Proposed file | Responsibility |
| --- | --- |
| `MathsRenderer.tsx` | Public Client Component, React-owned prose/math structure, result lifecycle and rendering. |
| `types.ts` | Public props, presentation, result and diagnostic types. |
| `parseContent.ts` | Pure mixed-content scanner and private source-positioned representation. |
| `typesetMath.ts` | KaTeX core adapter, per-expression errors and fresh macro state. |
| `measureLayout.ts` | Read actual content extents and compare against resolved constraints. |
| `useLayoutMeasurement.ts` | Font readiness, resize observation, scheduling and stale-generation protection; may be colocated initially if clearer. |
| `MathsRenderer.module.css` | Scoped prose, display-block, fallback and inline-maths layout. |
| `index.ts` | Small public UI/types entry; Node tests import pure modules directly to avoid pulling in CSS or browser hooks. |

Use KaTeX core directly, without a React wrapper, Markdown pipeline or page-wide auto-render scan. Keep the initial adapter small; do not build an interchangeable-engine framework. React owns the document structure. Only engine-produced mathematical markup enters its mathematical output regions; source prose and diagnostic messages are escaped text.

Internal parser nodes, KaTeX HTML classes and measurement helpers are not part of the public API. Engine-specific DOM knowledge is contained in the adapter/measurement code and its tests. No consumer needs to inspect KaTeX markup or install its own observers.

## 4. Public component and result contract

**Recommended contract for review:** one component, one measurement pipeline, two constraint inputs. Final exported names can change during implementation without changing these semantics.

### 4.1 Inputs

| Input | Semantics |
| --- | --- |
| `content: string` | Original source; never mutate or rewrite the caller's string. |
| `constraints` | Either explicit content-box dimensions, or an explicit reference to a dedicated containing element whose content box is observed. |
| `presentation` | Typed prose and mathematical presentation settings described below; no consumer-specific modes. |
| `onResult(result)` | Receives the current generation's readiness, diagnostics and reliable capacity result when available. |

Constraint shapes, expressed as documentation rather than implemented types:

- **Explicit:** `{ kind: "explicit", widthPx: number, heightPx: number | null }`. Width is finite and positive. Height is finite and nonnegative, or `null` for no vertical limit. The renderer lays out at that width; it does not silently clamp it to a narrower surrounding element.
- **Container:** `{ kind: "container", elementRef, height: "bounded" | "unbounded" }`. Observe a dedicated host's content box. In bounded mode the consumer must establish its height independently of the rendered child's natural height. In unbounded mode only width is a capacity constraint.

Both modes resolve to the same local CSS-pixel width and optional height budget before rendering and comparison. A host reference must not point at the growing content layer. A detached, hidden, zero-width or otherwise unresolved host cannot yield a ready fit. Invalid numerical configuration yields a configuration diagnostic and measurement unavailable, not invalid mathematical input.

Presentation settings: prose font family, size, weight and line height; mathematical scale relative to prose; paragraph gap; display indentation and surrounding gaps. Keep geometry-affecting typography explicit so prop changes invalidate measurement. Ordinary styling such as colour can inherit. Unrestricted descendant CSS overrides are not a supported reliable measurement contract.

Exact defaults and numerical ranges remain **provisional**. Within-working row spacing is typesetter-owned; establish it with standard supported TeX/layout facilities after early verification, not arbitrary CSS changes to KaTeX positioning internals. Do not promise a public row-spacing knob before that approach is demonstrated.

### 4.2 Results

Use a discriminated result contract that makes accidental `fits: true` on unreliable output impossible:

| State | Required meaning |
| --- | --- |
| `pending` | Current source/configuration is being typeset or awaits fonts/layout. No fit declaration. |
| `ready`, `fits: true` | Valid current output has been reliably measured and satisfies all supplied constraints. |
| `ready`, `fits: false` | Valid current output has been reliably measured and exceeds width and/or height. Overflow is a normal result. |
| `invalid-input` | Delimiter or mathematical errors exist; original affected source is displayed. No valid-content fit declaration. |
| `measurement-unavailable` | Reliable current layout cannot be obtained; include a reason such as required-font failure, hidden host or unsupported transform. No fit declaration. |

Every result identifies its monotonically increasing generation and contains diagnostics. Ready results additionally contain:

- Resolved available width and optional height in local CSS pixels.
- Occupied bounds relative to the available content-box origin, including any left/upward excess.
- Occupied width and natural required height at this wrapping width. This is not a prediction of fit at a different width.
- `overflowX` and `overflowY`, plus excess amounts per side where useful; an unbounded height has no vertical overflow test.
- No raw-character capacity approximation or consumer-specific acceptability decision.

Diagnostics have stable codes, messages, severity, and original source ranges where applicable. Example categories: unmatched delimiter, invalid/unsupported LaTeX, font loading failure and measurement/configuration unavailable. Source offsets use the original JavaScript string's code-unit offsets with an exclusive end; newline normalisation must preserve their mapping.

Invalid-source fallback may be measured internally or for development inspection, but must never turn an invalid result into a ready acceptance of the intended mathematical content. If input errors coexist with layout problems, retain both diagnostic categories; input validity remains independently visible.

Before hydration there is no browser-authoritative measurement; report no ready result. Callbacks are state notifications, not an every-frame stream. Publish semantic changes once and clean up on unmount.

## 5. Parsing and mathematical typesetting

### 5.1 Parsing strategy

**Recommended:** a small deterministic scanner with prose, inline-math and display-math contexts, source ranges and exact raw segments. Recognise unescaped `$$` before `$`. Handle escaped dollars in both prose and mathematical regions without stripping backslashes needed by KaTeX. Test backslash parity explicitly.

Parse mathematical regions before prose paragraphs. Preserve complete mathematical contents, including `&`, `\\`, braces and newlines, for KaTeX. Interpret prose single newlines as deliberate breaks and any run of blank separator lines as one paragraph separator. Do not count newlines inside a mathematical region as prose breaks. Display boundaries create mathematical blocks even without surrounding blank lines; do not manufacture empty prose rows around them.

CRLF and lone-CR treatment is a **recommended technical normalisation** to logical newlines, with original source retained for fallback/offsets. Whitespace-only separator lines should be recognised. Do not add trimming, repeated-space rewriting, tab expansion or smart punctuation as an implicit formatting feature; any ambiguous visible-whitespace behaviour needs review before its tests become acceptance rules.

Only `$` and `$$` are external mathematical delimiters. Do not add `\(...\)`, `\[...\]`, Markdown fences, bold, lists or HTML interpretation. Literal Markdown characters remain prose; the scanner still applies the agreed dollar syntax wherever it appears. A future prose parser could replace the private prose-processing step, but no Markdown dependency, plugin layer or future API is needed now.

**Agreed unmatched delimiter recovery:** issue a source-positioned diagnostic and display the unmatched opener and all remaining source literally, preserving earlier complete regions. Later maths in that remainder stays unformatted until the source is corrected. Do not synthesize a closer, infer a different delimiter, resume parsing at later paragraph/display boundaries or reinterpret malformed material to make it valid. Test mixed delimiter runs and ambiguous sequences against this recovery rule. Empty mathematical regions and unusual dollar runs still need explicit documented grammar expectations rather than silent repair.

### 5.2 Mandatory alignment candidates and acceptance

**Agreed layout A:** relation positions match across rows; left expressions end in a right-aligned column toward `=`; right expressions start consistently after it; relation spacing is consistent.

First candidate, taken from the specification:

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

**Agreed layout B:** all expressions start at one horizontal position, including the initial expression without `=`; continuation equals signs occupy a separate column to their left; indent the complete block relative to prose.

First explicit-column candidate from the technical follow-up:

```latex
$$
\begin{aligned}
{} & x^2+5x+6 \\
={} & x^2+2x+3x+6 \\
={} & x(x+2)+3(x+2) \\
={} & (x+2)(x+3)
\end{aligned}
$$
```

Also include the specification's original `&\phantom{={}}...` candidate unchanged in the early comparison. These are authored fixtures, not automatic source transformations. Stage 1 now records successful browser geometry for both candidates in section 14; user visual acceptance remains pending.

Stage 1 must measure visible expression/column geometry after font readiness. Check relation x-coordinates, left-column right edges, right-expression starts, and relation gaps for A. For B check every expression start, a separate preceding relation column on continuation rows, and no initial equals sign. Use expressions of different lengths so individually centred rows would fail. Check row y-positions and tall-expression clearance. Font-bearing differences must not be confused with column alignment: inspect expression/cell layout anchors and visible content, not merely whole-line boxes.

A small documented test tolerance accommodates browser subpixel reporting; it does not relax the common-column product requirement. Establish that tolerance from evidence rather than accepting visibly misaligned output. Screenshots and user inspection accompany geometry assertions. DOM checks use the selected engine release and visible HTML only, without enabling arbitrary HTML annotation commands in creator input.

**Stop gate:** if KaTeX cannot faithfully implement either fixed layout, stop and report the limitation and evidence. Do not switch engines, substitute a different layout, alter the source automatically or weaken acceptance criteria without approval.

### 5.3 Typesetting, currency and errors

- Use KaTeX core per mathematical segment, with inline/display mode set from parsing. No whole-document auto-render mutation.
- Recommend `htmlAndMathml` output, caught errors, untrusted HTML/resource commands disabled, and fresh macro state per expression. No macro state may leak between instances or renders.
- Preserve invalid segments as escaped source text **including original delimiters**; render valid neighbouring segments normally. No library-default red source/hover-error UX, repair or hidden omission is adopted automatically.
- Collect unsupported-command, unknown-metric and engine warnings into diagnostics where they affect fidelity; do not rely on console output as authoring feedback. Final strictness handling needs tests, especially for Unicode currency.
- Mathematical currency fixtures must include dollar `\$`, pound `\pounds`/`\text{\textsterling}`, and a euro text representation such as `\text{€}`. The latter needs font/glyph verification, not an assumption of known math metrics. KaTeX documents dollar/pound forms but lists `\euro` as unsupported; do not add a silent alias. If the selected font path cannot faithfully render euros, report and review a supported representation.
- Engine resource protections must not silently cap visual dimensions or change oversized expressions. Resource-limit failures produce diagnostics. No consumer-sized content ceiling is introduced.

## 6. Typography and layout

**Agreed:** ordinary prose wraps naturally; each inline expression remains intact and can move as a whole to the next prose line. Make the complete inline expression non-breaking; do not merely rely on each smaller KaTeX chunk being unbreakable. Preserve explicit rows inside mathematical environments.

The inline wrapper remains baseline-aligned and allows the engine's full height/depth to participate in line layout. Do not constrain formula height, clip radicals or force tall fractions into a prose-height box. An overly wide inline unit remains intact and yields overflow.

Display maths occupies its own block, with a consistent consumer-configurable indent. Its natural mathematical width can exceed the budget. Remove default whole-display centring in the renderer's scoped styling; do not centre each row. Explicit column alignment remains controlled by the supplied LaTeX.

Use explicit paragraph/display spacing rules that avoid margin collapse and duplicated gaps. Prevent display delimiters on separate source lines from introducing unwanted extra blank rows. Internal working-row spacing must be consistent and give fractions sufficient clearance; validate engine defaults before proposing adjustments.

**Provisional presentation review:** show a small set of relative mathematical scales, indents and modest gap options on fixed development fixtures. Numerical values are experimental settings until approved. Consumer typography controls scale; no fixed card font, maximum number of equations or minimum card-sized area belongs in the renderer. Obtain user approval of appearance before declaring visual acceptance.

Application rules belong in CSS Modules/scoped selectors. Audit the selected KaTeX stylesheet for unrelated document-wide selectors/counters before importing it. Scope any such rules within new renderer-owned styling, preserving version provenance/licensing, or report the need for an exception. Bundled font-face registration is inherently document-wide; do not modify existing global CSS or allow engine CSS to alter unrelated application layout. Verify asset URLs and fonts through Next.js in development and production builds.

## 7. Capacity measurement and diagnostics

### 7.1 One measurement pipeline

Resolve either constraint input to a content-box origin, width and optional height. Maintain a natural-height content layer at that wrapping width; keep excess visible, with no scroll container, maximum content height, line clamp or clipping. A fixed-height host is only the budget, not a cap on its child's actual layout.

Use the natural flow box for height and intended vertical spacing; do not report its stretched, constraint-sized width as the actual occupied text width. Obtain horizontal extents from prose text-fragment rectangles, mathematical layout boxes, and any overflowing visible mathematical descendants. Include the content origin and intended indentation when determining required horizontal space. Compare all four sides against the budget; total width alone can miss negative-offset overflow. Do not use raw LaTeX length or the old capacity estimator.

`scrollWidth`/`scrollHeight` may corroborate checks but are not sole authority: their integer measurements and overflow semantics lose detail. A parent bounding rectangle alone misses descendant overflow. Conversely, unioning every KaTeX node can count hidden MathML and positioning struts. Keep a small engine-aware collector for visual/layout extents, excluding accessibility duplicates and internal nonvisual helpers while retaining purposeful layout space such as phantom widths. Verify fractions, roots, nested working and overflow beyond the parent explicitly.

Geometry describes browser layout, not a pixel-perfect painted glyph outline. If unusual accepted commands defeat reliable collection, produce a diagnostic or stop for review rather than declaring fit from incomplete bounds. Validate the collector early, before expanding accepted input cases.

### 7.2 Readiness and freshness

1. On source, presentation or resolved-constraint change, invalidate the old result and increment an instance-local generation.
2. Parse and typeset the current source; expose invalid-input diagnostics immediately if needed.
3. Ensure stylesheet/required font faces are available. Await current font loading and verify failures separately; `document.fonts.ready` alone never rejects and is insufficient proof of success.
4. Schedule browser layout reads, checking stable relevant bounds and computed typography before publishing a ready result. A stability check is additional evidence, not a substitute for font readiness.
5. Before emitting, confirm the generation, host and resolved constraints still match. Discard stale work.
6. Observe constraint/content size changes and relevant font-loading events. Prop-driven typography changes always invalidate even if the outer dimensions happen to stay constant.

Use `ResizeObserver` and coalesced animation-frame measurement rather than polling all instances every frame. Avoid resize/update feedback loops. Cleanup observers, font listeners and pending frames on unmount; React development remounts must not produce duplicate live work. Results belong only to the current generation, and callback-driven consumer rerenders must not restart measurement unnecessarily.

No font failure, elapsed timeout or cached older fit may be promoted to a ready result. If font loading cannot complete, report measurement unavailable with a diagnostic; timeout mechanics are technical choices to document and test, not a new visible error interaction.

### 7.3 Transforms and unmeasurable hosts

**Recommended initial transform support:** capacity is in local CSS layout pixels. Test translated and positively axis-scaled ancestors, including nested scale, using a consistent conversion between visual rectangles and local content-box coordinates. Account for padding/borders and independent x/y scales; do not compare transformed coordinates directly to untransformed budgets.

Rotated, skewed, perspective or degenerate transforms must not trigger a general geometric transformation project. Do not assume axis-aligned bounding rectangles can be divided by one scale. The user approved measurement unavailable with a reason where reliable measurement is unsupported; stage 2 must document actual support. Never silently treat an approximate or unreliable result as fit. Stage 2 remains unauthorised.

Hidden/detached hosts or unresolved finite widths produce measurement unavailable, then remeasure when they become usable. A visible zero-height budget is valid: nonempty measured content can overflow it. An explicitly unbounded height is different from an unknown height. Ancestor transforms do not themselves trigger ResizeObserver; test how measurements remain valid under supported transforms and how unsupported-transform changes are detected. Any needed transform invalidation must stay inside the renderer and avoid an application-wide mutation framework.

## 8. Independent development route and fixtures

**Recommended route:** `/dev/maths-renderer`, from new `src/app/dev/maths-renderer/page.tsx`, with new colocated client fixture, stylesheet and source samples. The server page uses `notFound()` when `NODE_ENV !== "development"`, before rendering the fixture. No database, authentication, Info Card imports or editor controls.

This guard makes the page unavailable in production; it does not claim the route is physically absent from build output. Verify production access is denied. No central route registration, navigation link, existing layout edit or existing fixture-server edit is expected.

Use ordinary dedicated containers varying width, height and typography. No renderer modes named after consumers. A small example may resemble a current explanation area, but every such dimension stays in fixture data only.

Fixed samples must cover:

- Fluent prose with multiple inline expressions and prose wrapping around intact inline units.
- Prose, display equation, `Therefore,`, another display equation, both with and without blank separators.
- Layout A and both layout B source candidates.
- Stacked/nested fractions, radicals, powers, subscripts and tall inline maths between prose lines.
- Single newlines, multiple blank separators, whitespace-only separators and literal Markdown characters.
- Prose `€`, `£`, escaped dollars, and mathematical currency forms.
- Same source fitting a large area and exceeding small width, height, or both.
- Invalid LaTeX, unsupported commands and unmatched delimiters with exact fallback source.
- Multiple independent instances with different presentation settings.

Display source, output and diagnostics/measurements separately. Put fixture diagnostics outside measured content. Reserve enough surrounding development-page space to inspect overflow without clipping, scrolling or overlapping neighbouring samples. Automated test cases may change dimensions/content through a test-only fixture API; do not expose this API on the public renderer or add a creator editor.

New renderer-specific browser configuration should exercise the actual Next.js route for real CSS/font bundling. Reuse an already-running suitable local server only after verifying its identity; do not stop another chat's server or run competing Next.js processes against the same output directory. Any need for a dedicated output configuration is an additional existing-file exception requiring review, not silently added scope.

## 9. Reviewable implementation stages

The user authorised Stages 0 and 1 only; both are implemented and recorded in section 14. **Stages 2–5 remain unstarted and unauthorised.** Approval covers named stages; do not infer that a request for evidence authorises later scope.

| Stage | Dependencies and work | Acceptance / checkpoint |
| --- | --- | --- |
| 0. Approval and shared-directory preflight — implemented | Review this plan, unresolved items and existing-file exceptions. Inspect current working changes and relevant installed Next.js docs. | Authorisation, baseline, manifests and server identity checked; section 14 records results. |
| 1. Early alignment feasibility — implemented; awaiting review | Install the approved pinned KaTeX dependency; add minimal new standalone adapter, development route, fixed A/B fixtures and browser tests. Use clearly provisional styling. | Both layouts and B candidates pass browser alignment checks. Screenshots and metrics recorded in section 14; user visual review remains pending. If later evidence shows a mandatory layout cannot be faithful, stop and report. No alternative layout without approval. |
| 2. Early measurement feasibility | Add the common constraint resolver, natural-height layer and minimal measurement/readiness lifecycle. Use plain prose, inline maths, aligned working and deliberate width/height failures. Depends on stage 1. | Explicit and container inputs agree for equivalent budgets. Detect each overflow axis; no false ready before fonts, stale results or hidden-host fit. Demonstrate supported transformed ancestors. Review evidence and any limitations before expansion. |
| 3. Complete parsing and diagnostics | Complete source grammar, escaped dollars, paragraphs, currency, source ranges and original-input fallback, including the agreed unmatched-opener-to-end recovery. Integrate with the demonstrated pipeline. Depends on stages 1–2 and review of remaining grammar edge cases. | Parser/unit tests pass; exact fallback includes delimiters; an unmatched opener makes the entire remainder literal; invalid results cannot declare fit; earlier complete regions remain readable; no Markdown processing or silent repair. |
| 4. Presentation and lifecycle completion | Expand fixed size/typography fixtures, accessibility checks, resize/font failures, multiple instances, cleanup and cross-browser verification. | No collisions or prohibited wrapping/remediation. Submit provisional scale, spacing and indentation examples for user visual approval; do not label them final beforehand. |
| 5. Standalone acceptance and regression | Run the approved standalone and existing regression checks; verify production route guard, stylesheet isolation and changed-file scope. | Record fresh results, unresolved limitations and visual approval. Standalone acceptance can complete without publication integration. Any consumer integration requires a separate plan and authorisation. |

Stages 1 and 2 are intentionally foundational. Do not implement the complete feature first and postpone alignment or measurement proof until final testing. Review evidence at those checkpoints; a failed mandatory criterion blocks dependent work.

## 10. Automated and visual testing

**Proposed new location:** `tests/maths-renderer/`, with pure unit tests, isolated fixture data, browser tests and approved visual baselines. New `playwright.maths-renderer.config.ts` can select `*.browser.ts` without changing the default Playwright configuration. Do not create or approve screenshot baselines merely because current output exists.

| Layer | Cases and evidence |
| --- | --- |
| Parser units | Inline/display precedence, escaped dollars/backslash parity, raw source/ranges, adjacent maths/prose, mathematical newlines, malformed/unmatched delimiters, plain currency and literal Markdown. An unmatched opener preserves the entire remainder literally, including later apparently valid maths and paragraph boundaries; earlier complete regions remain parsed. |
| Prose units | Single breaks versus one gap per separator run, whitespace-only separators, logical-newline mapping, no lost/reordered `Therefore,` segments. |
| Typesetter units | Fractions, roots, powers, nested constructs and explicit alignment syntax; errors/warnings, currency representations, safe source fallback and isolated macro state. Parsing success alone never passes alignment acceptance. |
| Result/lifecycle tests | Ready-only fit fields, independent axes, generation invalidation, invalid configuration, invalid content versus unavailable measurement, cleanup and callback-loop prevention. |
| Alignment browser tests | Common relation/column anchors for A; common expression starts and separate preceding equals column for B; varying widths and fonts; row clearance. Inspect visible output, not hidden MathML. |
| Inline-flow browser tests | Prose wraps before/after intact maths; the whole expression can move; narrow width never splits it internally; explicit working rows survive. |
| Bounds browser tests | Real versus reported extents, left/right and vertical excess, natural height, display indentation, descendants beyond parent, tiny and large budgets, independently insufficient axes, both constraint modes, null/unbounded height and valid zero-height budget. |
| Font browser tests | Cold/warm loads, delayed and failed required faces, content introducing additional faces, font/presentation changes during waits, no cached fit promotion. |
| Resize/staleness browser tests | Rapid source/font-size/line-height/width/height changes; older callbacks resolving late; hidden-to-visible, detached/replaced host and supported/unsupported transforms. |
| Isolation browser tests | Two or more instances with different content/settings, unmount/remount, no cross-instance macro/results, no neighbouring-style changes, no active work after unmount. |
| Accessibility/visual | Accessible prose/math order without duplicate announcements; manual screen-reader inspection on agreed targets; fractions/radicals legible; provisional styling reviewed by the user. |
| Route/build | Next.js asset/font loading and hydration; development route available only during development; production request returns unavailable/404 without fixture content. |

Use Chromium, Firefox and WebKit for foundational alignment, wrapping and capacity cases. Capture deterministic visual baselines in a controlled browser/font environment; do not demand cross-platform screenshot identity. Compare geometry with a documented small rounding tolerance and boundary cases, not a large fit allowance. Exact pixel thresholds remain provisional until early evidence.

Planned commands, only during authorised implementation/testing:

- `node --import tsx --test tests/maths-renderer/*.test.ts` for the isolated unit folder (existing top-level wildcard does not discover it).
- `npx playwright test -c playwright.maths-renderer.config.ts` after the new configuration exists.
- Existing lint, typecheck and build checks appropriate to the new files. Inspect scripts/output first: type generation/builds can modify generated files or conflict with another chat's running server. Do not silently retain tracked generated-file edits outside the approved list.

### 10.1 Existing regression protections

Standalone development does not replace or alter current capacity tests. Run existing top-level units and the focused Info Card browser capacity suite; run the relevant authoring/consultation checks through their existing documented fixture setup. Record infrastructure limitations as unverified checks rather than claiming a pass.

| Existing coverage | Protection |
| --- | --- |
| `tests/info-cards-capacity.test.ts` | Current plain-text wrapping, paragraph spacing, media reservation and diagnostics remain unchanged. |
| `tests/info-card-editor.test.ts` | Autosave, rejected publication correction, revision conflicts and lost-response recovery. |
| `tests/info-card-consultation-client.test.ts` | Snapshot identity, actor/context checks and cancellation. |
| `tests/info-cards.integration.ts` | Draft preservation, atomic/immutable publication, access and snapshot behaviour. |
| `tests/browser/info-cards-capacity.browser.ts` | Existing estimated/plain-text geometry comparisons. |
| `tests/browser/info-cards-integration.browser.ts` | Consultation geometry across viewports and preserved surrounding state. |
| `tests/phase2/info-cards-authoring.browser.ts` | Plain explanations, overflow feedback, publication rejection, mobile editor/Library and media-dependent capacity. |
| `tests/phase2/info-card-consultation.browser.ts` | Pinned publications, reopening, unavailable positions and media/consultation behaviour. |

These suites must continue using their existing implementations during this phase. Baseline pre-existing failures separately from regressions. Do not fix unrelated application bugs in this chat.

## 11. Isolation and change safeguards

### 11.1 Planned file scope

| Category | Proposed changes |
| --- | --- |
| New renderer | Files under `src/components/maths-renderer/` only. |
| New development page | Files under `src/app/dev/maths-renderer/` only. |
| New tests/config | `tests/maths-renderer/` and `playwright.maths-renderer.config.ts`. |
| Existing-file exceptions | **Only `package.json` and `package-lock.json`**, for the selected KaTeX dependency and its required resolved metadata, subject to explicit implementation approval. Verify bundled types for that release before adding any type package. |
| Existing route/config/style files | No edits expected to `next.config.ts`, root layout, global CSS, TypeScript config, existing Playwright configs/server or package scripts. Report any newly demonstrated requirement before editing. |
| Existing Info Card/application files | No edits. No extraction, reuse or refactoring. |

Dependency installation must preserve unrelated manifest changes and avoid broad upgrades. Exact version choice is an engineering recommendation to record at the approved stage, not permission to install now. Self-host package assets; no runtime CDN dependency is proposed.

### 11.2 Shared working directory

- Recheck branch and working-tree state before each authorised mutation. Do not switch branches, create a worktree, commit, reset, clean, stash or overwrite another chat's changes as part of this plan.
- Coordinate any approved shared manifest edit against the current file contents. If concurrent changes make it unsafe to apply cleanly, pause that edit and report the conflict.
- Enforce imports with an isolation check that follows the renderer's local dependency graph. Permitted dependencies are renderer-local modules, React, the approved KaTeX package and necessary platform APIs; no indirect Info Card/application dependency through a shared barrel.
- Development fixtures must also have no Info Card/application-component imports. A normal inherited Next.js root layout is framework composition, not a reusable application dependency inside the renderer.
- Review the final diff against the scoped list and record test evidence. Test artifacts may be generated only in the designated new test locations or temporary output; avoid overwriting shared reports/baselines.

## 12. Risks, limitations and open questions

| Risk/question | Treatment and decision boundary |
| --- | --- |
| Alignment fidelity | Stage 1 verified both layouts and B candidates across the recorded configurations. User visual review remains pending. Stop if a required layout fails in further evidence; never weaken the requirement. |
| Candidate B differs from illustrative spec syntax | Test both sources unchanged; propose a verified authoring example for review. Never auto-convert source or substitute a layout. |
| Bounds miss descendants or count engine helpers | Stage 2 compares measured extents with browser evidence for nested/tall/overflowing content before full rollout. |
| Font fallback or unknown glyph metrics | Required-face checks and currency fixtures; no ready fit on failed required assets. Browser-specific prose fallback remains a documented platform limit. |
| Unusual layout commands | Normal KaTeX vocabulary remains supported in principle; no command allowlist may be introduced to simplify later measurement. Investigate individual problems and obtain approval before excluding otherwise supported maths. No silent size capping. |
| Transform complexity | Translation/positive axis scaling are the approved priorities for future stage 2. Complex transforms may report measurement unavailable; do not build a general geometry engine or claim approximate fit. |
| Delimiter grammar / empty regions | Unmatched-opener-to-end literal recovery is agreed in section 5.1. Confirm remaining ambiguous dollar-run/empty-expression grammar expectations without changing that recovery rule. |
| Ordinary prose whitespace beyond newlines | Single breaks and collapsed separator runs are agreed. Repeated spaces, tabs, edge blank lines and unbreakable prose-token policy must not acquire new normalisation/forced breaking without review where behaviour is ambiguous. |
| Exact styling and legibility | Provisional fixtures only until visual approval. There is no final numerical indent, gap, mathematical scale or minimum font size in this plan. |
| Accessibility targets | Recommend HTML plus MathML and screen-reader checks. Confirm specific target combinations during acceptance; no expression-menu UX is introduced. |
| Global engine stylesheet effects | Audit selected stylesheet and verify neighbouring content/navigation. Scope unrelated rules in new files or report an exception. |
| Concurrent repository work | Scope mutations, coordinate manifests and avoid competing build output. No branch/worktree change. |

The paragraph, exact-source fallback and unmatched-delimiter recovery decisions are recorded in section 1.1. Stage 1 does not exercise the remaining mixed-content grammar/whitespace edge cases; review them before their later dependent parser behaviour is implemented. Exact visual values wait for user inspection of the Stage 1 page. Technical platform limits must be reported with evidence rather than converted into new UX.

### 12.1 Future integration considerations — not implementation work

Current explanation source is plain `body: string` in [model.ts](../../../../src/lib/infoCards/model.ts), displayed as paragraphs in [InfoCardFace.tsx](../../../../src/components/info-cards/InfoCardFace.tsx). [capacity.ts](../../../../src/lib/infoCards/capacity.ts) combines header, explanation and general validation; [repository.ts](../../../../src/lib/infoCards/repository.ts) enforces it at publication, and [queries.ts](../../../../src/lib/infoCards/queries.ts) can reject a publication during consultation reads.

A future integration plan must preserve plain-text meaning, saving, immutability and existing publication availability, and resolve authoritative nonbrowser validation. Client measurements alone do not establish server trust. None of that blocks standalone acceptance, and no workers, services, validation receipts, storage metadata or migrations are included here. Do not import the old estimator now or reuse it in the renderer later.

## 13. Explicit approval checkpoints

1. **Plan review — complete:** the user approved the plan with the mathematical-vocabulary and transform clarifications in section 1.1.
2. **Stages 0–1 authorisation — granted and work implemented:** manifests/lockfile, isolated alignment files, fixtures/tests, documentation evidence and iPhone review setup were authorised. No permission for later stages is implied.
3. **Current checkpoint — early alignment review:** inspect the live page and section 14 evidence. A mandatory alignment failure stops dependent work and requires user review, not a substitute layout. Obtain explicit authorisation before Stage 2.
4. **Early measurement review:** present stage 2 readiness/overflow/staleness/transform evidence and supported limits before broader completion. Report failed reliability criteria immediately.
5. **Visual approval:** present provisional numerical styles on the independent page and obtain approval before calling them product defaults or accepting visual baselines.
6. **Standalone acceptance:** report fresh test results, regression checks, remaining limitations and changed-file scope. User acceptance does not authorise consumer integration.
7. **Separate future integration:** only a separately requested/reviewed integration plan and explicit authorisation may touch Info Card functionality or publication-capacity validation.

**Stop after Stage 1. Stages 2–5 remain unauthorised and have not begun.**

## 14. Stage 0 and Stage 1 implementation record — 25 October 2026

### 14.1 Preflight, dependencies and isolation

- Existing branch: `feat/math-renderer`; no branch/worktree changes. The preflight had no tracked modifications. The design and engineering document directories were already untracked and were preserved.
- Read the complete design and plan and relevant installed Next.js routing, CSS, client/server, development-origin and route-guard documentation before source work.
- Installed exactly **KaTeX 0.19.1**. Only the necessary manifest/lockfile entries changed: KaTeX plus its `commander` 15.0.0 dependency. Existing dependency versions were not upgraded. Bundled TypeScript definitions required no extra type package. The installed commander requires Node >=22.12.0; the verified local runtime is 22.14.0.
- Existing unit baseline: **420/420 passed**. Existing Info Card capacity browser baseline: **5/5 passed**.
- The initial verification used the general development server on port 3000. After the user reported an iPhone 404, corrected the review setup to the established Info Cards LAN Next.js server on port **4181**, launched by `scripts/test-phase2.ts --dev --lan --info-cards`. Verified the actual Maths Renderer page there over localhost and Wi-Fi; no server was stopped, restarted or replaced. The renderer-only browser configuration now defaults to that same review server.
- No existing application source, Info Card files, capacity logic, models, storage/publication code, root/global styles or existing test configuration were modified.

### 14.2 Implemented files and deliberate limits

| Files | Stage 1 purpose |
| --- | --- |
| `src/components/maths-renderer/typesetMath.ts` | Small KaTeX adapter accepting explicitly authored TeX; normal engine vocabulary, fresh macro state and unsafe-resource protection. |
| `src/components/maths-renderer/MathsExpression.tsx`, `MathsExpression.module.css` | Standalone expression primitive with scoped provisional display indentation and intact inline units. It is not the later mixed-content public component. |
| `src/components/maths-renderer/katex.scoped.css`, `katex.LICENSE.txt` | Versioned upstream engine CSS with all selectors rooted under `.switchplay-maths-katex`; body counters moved to that root, package font URLs retained and MIT notice included. Font-face declarations remain necessary document-wide registrations. |
| `src/app/dev/maths-renderer/page.tsx`, `page.module.css`, `fixtures.ts` | Development-only route, ordinary prose containers and six fixed authored examples under three width/typography settings. No editor, parser or capacity UI. |
| `playwright.maths-renderer.config.ts` | Renderer-only Chromium/WebKit browser configuration using the verified running server; outputs to temporary renderer-specific paths. |
| `tests/maths-renderer/alignment.browser.ts`, `typesetting.test.ts`, `isolation.test.ts` | Actual browser geometry/screenshots plus adapter, vocabulary, security, CSS provenance and import-isolation tests. Geometry collection exists only in browser tests, not in the renderer. |
| `tests/maths-renderer/evidence/stage1/` | Fourteen screenshots and compact `geometry.json` from the successful final run. These are review evidence, not user-approved visual baselines. |
| `package.json`, `package-lock.json` | Approved pinned dependency change only. |
| This engineering plan | Approval clarification and progress/evidence record. The design specification is unchanged. |

Stage 1 directly supplies TeX expressions to the primitive. It does not parse mixed prose, implement a full diagnostic contract, assess capacity, observe container/font changes or claim fit. The limited catch/fallback in the expression primitive is not Stage 3 completion. Full parser, capacity and presentation/lifecycle work remains deferred.

### 14.3 Alignment results and candidate comparison

Fixtures use widths **280 / 460 / 700 CSS px**, prose sizes **14 / 18 / 22px**, and Arial/Georgia presentation examples. These values and the **1em indent, 0.6em display gaps and 1em mathematical scale** are provisional development settings, not approved product defaults. Basic fixtures have four rows; tall fixtures have three rows with fractions, radicals and powers. Expression widths differ by more than one em within each tested working block.

Final browser run: **10/10 tests passed** in Chromium and WebKit, including **36 full geometry configurations** (six examples × three presentations × two browsers) and an additional six small-container alignment checks per browser at a 390 × 844 viewport.

| Criterion | Observed final result |
| --- | --- |
| Layout A equals-sign x spread | 0 CSS px across tested rows/configurations. |
| Layout A left-column right edges and RHS starts | Aligned; consistent positive gaps before/after each relation, with symmetry within the 0.5px test tolerance. |
| Layout B separate-column candidate expression-start spread | 0 CSS px across tested rows/configurations. |
| Layout B original phantom candidate expression-start spread | 0 CSS px across tested rows/configurations. |
| Visible continuation equals-sign x spread | 0 CSS px; signs precede the expression starts. No visible equals sign on the initial B row. |
| Whole-block indentation | Matches the configured 1em indentation across tested sizes. |
| Row clearance where content shares horizontal space | Minimum **0.921875 CSS px** among the tested text/radical/fraction-bar rectangles; no collision within the 0.5px rounding tolerance. |
| Prose before/after mathematical working | No overlap in tested configurations. |

The 0.5 CSS-pixel tolerance is smaller than one CSS pixel and accommodates browser subpixel reporting; it did not hide column error (observed spreads were zero). KaTeX fixes row/column layout; no source rewriting, automatic wrapping, shrinking or content clipping was added.

An initial clearance assertion incorrectly compared entire row envelopes even where the content occupied disjoint horizontal columns. It reported an apparent overlap. Visual/DOM inspection confirmed that the mathematics did not collide. The corrected test compares adjacent text/radical/fraction-bar rectangles where their horizontal extents intersect and still checks increasing row positions and surrounding prose clearance. No authored formula, row spacing or acceptance requirement was changed to obtain the pass.

**Recommendation for review:** prefer the explicit separate-column B source (`{} & expression`, then `={} & expression`) because it directly expresses the product's relation-column/expression-column structure. The original phantom candidate also passed all current geometry checks. Keep both examples intact; adopting a preferred authoring convention does not authorise converting creator input.

Evidence:

- [Compact browser geometry, all 36 configurations](../../../../tests/maths-renderer/evidence/stage1/geometry.json).
- Chromium: [A basic](../../../../tests/maths-renderer/evidence/stage1/chromium-a-basic.png), [A tall](../../../../tests/maths-renderer/evidence/stage1/chromium-a-tall.png), [B separate-column basic](../../../../tests/maths-renderer/evidence/stage1/chromium-b-columns-basic.png), [B separate-column tall](../../../../tests/maths-renderer/evidence/stage1/chromium-b-columns-tall.png), [B phantom basic](../../../../tests/maths-renderer/evidence/stage1/chromium-b-phantom-basic.png), [B phantom tall](../../../../tests/maths-renderer/evidence/stage1/chromium-b-phantom-tall.png).
- WebKit: [A basic](../../../../tests/maths-renderer/evidence/stage1/webkit-a-basic.png), [A tall](../../../../tests/maths-renderer/evidence/stage1/webkit-a-tall.png), [B separate-column basic](../../../../tests/maths-renderer/evidence/stage1/webkit-b-columns-basic.png), [B separate-column tall](../../../../tests/maths-renderer/evidence/stage1/webkit-b-columns-tall.png), [B phantom basic](../../../../tests/maths-renderer/evidence/stage1/webkit-b-phantom-basic.png), [B phantom tall](../../../../tests/maths-renderer/evidence/stage1/webkit-b-phantom-tall.png).
- Full-page 390px review captures: [Chromium](../../../../tests/maths-renderer/evidence/stage1/chromium-iphone-alignment-review.png), [WebKit](../../../../tests/maths-renderer/evidence/stage1/webkit-iphone-alignment-review.png). The page intentionally includes larger fixed-width examples; wide mathematics remains visible, not fitted to the phone.

### 14.4 Verification and iPhone review setup

| Check | Final result |
| --- | --- |
| `node --import tsx --test tests/maths-renderer/*.test.ts` | 5 passed. |
| `node node_modules/@playwright/test/cli.js test -c playwright.maths-renderer.config.ts` | 10 passed (Chromium/WebKit). |
| `npm run test:unit` | 420 passed before and after the changes. |
| Existing `playwright.info-cards-capacity.config.ts` suite | 5 passed before and after the changes. |
| ESLint on new renderer, route, tests and configuration | Passed. |
| `tsc --noEmit --incremental false` | Passed, without running type generation or changing tracked generated files. |
| Wi-Fi URL, Chromium and mobile-style WebKit | HTTP 200; all 18 mathematical examples present; required mathematical fonts loaded; no page errors or failed requests observed. |

**Corrected iPhone Safari URL, on the same Wi-Fi:** [http://192.168.1.38:4181/dev/maths-renderer](http://192.168.1.38:4181/dev/maths-renderer). This uses the existing Info Cards LAN Next.js setup, not the general port-3000 server or the port-4180 static fixture. No terminal commands, IP lookup or manual configuration are needed. The existing server is left running. This is a local review URL and can change if the Mac's network address changes.

Follow-up verification after the reported 404: two mobile-WebKit navigations to that exact Wi-Fi URL returned HTTP 200 and the visible `Stage 1 · Alignment review` heading, one `main[data-maths-stage="1"]`, all 18 mathematical displays and three loaded KaTeX font faces. Neither navigation showed a visible 404, failed request or page error. The route also returned its own Maths Renderer title and 18 expressions over loopback on port 4181. No server-running-only check was treated as page verification. The earlier port-3000 404 could not be reproduced from the Mac during this follow-up; this does not override the user's device report. The shared LAN review environment on 4181 is now the documented and tested default.

Actual iPhone hardware visual review is pending the user's inspection; desktop WebKit with mobile settings is supporting evidence, not a claim of testing a physical iPhone. Firefox, full database/API/authoring suites and a production build were not run in Stage 1. The production guard is implemented, but its end-to-end production-build check remains later scope. No general application regression or standalone completion beyond the listed checks is claimed.

### 14.5 Review boundary

Both required alignment layouts are technically demonstrated under the tested conditions; no KaTeX layout blocker was found. User visual approval, selection of a preferred B authoring example and approval of any final numerical styles remain pending. No full mathematical parser, reliable-capacity API or production measurement pipeline exists yet. **Stages 2–5 have not begun. Await Stage 1 review and explicit Stage 2 authorisation.**
