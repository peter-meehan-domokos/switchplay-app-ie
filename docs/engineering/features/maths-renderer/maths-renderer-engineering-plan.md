# Mathematical Content Renderer — Engineering Plan

**Status: Standalone Stage 5 acceptance passed. Stages 0–5 are complete; Balanced styling and current 2.3125 row spacing are approved. Info Card integration is not authorised.**

**Date:** 25 October 2026

**Authorisation:** The user approved Stage 4 visually and authorised **Stage 5 — Standalone Acceptance and Regression Verification** under this plan. Balanced styling is accepted. The user separately confirmed **“Keep current 2.3125 spacing”**, resolving the discrepancy with the earlier +25% wording. **Info Card integration remains unauthorised.** Sections 14–16 are historical implementation records; section 17 records current acceptance. The latest conversation supersedes earlier stage-authorisation/provisional wording retained in those records.

**Working context:** Existing `feat/math-renderer` branch and shared working directory. Do not create another branch or Git worktree.

## 1. Purpose, scope and authority

Build a standalone, general-purpose system for rendering explanatory prose mixed with LaTeX and assessing its actual browser layout against consumer-supplied constraints. Info Cards are the intended first consumer, not the renderer's architectural basis. Standalone development and acceptance must complete independently of publication-capacity integration.

Authority, in order:

1. The user's explicit subsequent decisions in this conversation, particularly the engineering-plan authorisation and the clarification answers recorded below.
2. The complete [product and interaction specification](../../../design/features/maths-renderer/maths-renderer-spec.md).
3. This plan's engineering recommendations, within the explicitly approved stages. Balanced visual settings and the current row spacing are now approved; alternative fixtures do not establish additional defaults.

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
| Empty mathematical regions | Accept empty/whitespace-only mathematics as KaTeX does, without invalid-input diagnostics or literal fallback. Existing delimiter recognition and unmatched-opener recovery remain unchanged. |
| Mathematical wrapping | Inline expressions stay intact and may move as units within prose. No automatic internal breaks; explicit working rows remain. |
| Scope | Browser-only standalone development first. No publication workers, services, attestations, persistence changes or consumer integration. |
| Mathematical vocabulary | Pass normal KaTeX mathematics through without an arbitrary command allowlist. Investigate individual rendering/measurement problems; obtain approval before excluding otherwise supported functionality. Unsafe resources/commands remain protected. |
| Complex transforms | Measurement prioritises ordinary layouts, translation and positive axis scaling. Rotation, skew and perspective may report measurement unavailable; no general transformation engine or approximate fit claims. Stage 2 is now explicitly authorised. |
| Working-row spacing | The earlier approximately +25% setting was `arraystretch = 1.3125`. The user subsequently adjusted it to `2.3125` and explicitly selected **“Keep current 2.3125 spacing”** at Stage 5. Preserve that approved value, without fraction-dependent rules or changes to prose. Ordinary row pitch is 3.075em, about 2.05× the engine baseline; do not describe the current value as +25%. |
| Accepted Balanced styling | Mathematical scale 1× prose, display indent 1em, display gaps 0.6em, paragraph gaps 0.8em, and local inline clearance 0.25 mathematical em. Consumer-supplied typography/constraints remain explicit; fixture prose sizes/families are not universal defaults. |

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

The accepted default visual profile is **Balanced**, as recorded in section 1.1 and section 17. Consumer typography and constraints remain explicit under the existing API. Within-working row spacing is typesetter-owned, using the approved standard `arraystretch` macro; no new public spacing knob or KaTeX positioning overrides are introduced.

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

**Agreed unmatched delimiter recovery:** issue a source-positioned diagnostic and display the unmatched opener and all remaining source literally, preserving earlier complete regions. Later maths in that remainder stays unformatted until the source is corrected. Do not synthesize a closer, infer a different delimiter, resume parsing at later paragraph/display boundaries or reinterpret malformed material to make it valid. Test mixed delimiter runs against this recovery rule. **Subsequently agreed:** accept empty and whitespace-only mathematical regions as KaTeX does. `$$$$` is a complete empty display region and `$ $` is a complete whitespace-only inline region; neither produces an invalid-input diagnostic or fallback. Longest-opener recognition is unchanged: `$$` alone remains an unmatched display opener, rather than being reinterpreted as empty inline mathematics.

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

**Presentation review — complete:** the user visually approved Balanced and the current `arraystretch = 2.3125` setting. Other fixed comparisons remain alternatives. Consumer typography controls scale; no fixed card font, maximum number of equations or minimum card-sized area belongs in the renderer. Stage 5 preserves approved appearance while checking technical acceptance.

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

Rotated, skewed, perspective or degenerate transforms must not trigger a general geometric transformation project. Do not assume axis-aligned bounding rectangles can be divided by one scale. The user approved measurement unavailable with a reason where reliable measurement is unsupported; section 15 documents the tested support. Never silently treat an approximate or unreliable result as fit.

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

Stages 0–4 are complete and Stage 4 is visually approved. The user's latest instruction explicitly authorises **Stage 5 standalone acceptance only**. Consumer integration remains separately gated.

| Stage | Dependencies and work | Acceptance / checkpoint |
| --- | --- | --- |
| 0. Approval and shared-directory preflight — implemented | Review this plan, unresolved items and existing-file exceptions. Inspect current working changes and relevant installed Next.js docs. | Authorisation, baseline, manifests and server identity checked; section 14 records results. |
| 1. Early alignment feasibility — complete | Install the approved pinned KaTeX dependency; add minimal new standalone adapter, development route, fixed A/B fixtures and browser tests. | Both layouts and B candidates pass browser alignment checks. Section 14 retains the early evidence; Stage 4 visual review is approved. If later evidence shows a mandatory layout cannot be faithful, stop and report. No alternative layout without approval. |
| 2. Early measurement feasibility — implemented | Common constraint resolver, natural-height layer and measurement/readiness lifecycle. Plain prose, inline maths, aligned working and deliberate width/height failures. Depends on stage 1. | Equivalent explicit/container budgets agree. Independent overflow, fonts/failure/timeout, resize, freshness and supported-transform browser tests pass; see section 15. |
| 3. Complete parsing and diagnostics — implemented | Source scanner, escaped dollars, paragraphs, currency, original offsets and exact fallback, including unmatched-opener-to-end recovery. Integrated with the same measurement pipeline. Authorised together with Stage 2, without an intermediate stop. | Parser/unit and browser tests pass; invalid results cannot declare fit. The user confirmed empty/whitespace-only mathematics follows KaTeX acceptance; focused unit and browser tests verify this without changing unmatched-delimiter recovery. |
| 4. Presentation and lifecycle completion — complete and visually approved | Expanded fixed size/typography fixtures, accessibility checks, observer/font/host lifecycle, strict remounting, callback independence and cross-browser verification. | Both exact layouts preserved. Balanced and the user's subsequently adjusted row spacing are approved. Section 16 retains the historical Stage 4 verification record. |
| 5. Standalone acceptance and regression — passed | Acceptance against the specification, fresh protected regression suites, production route guard/build and scoped assets, approved presentation verification, evidence and limitations. | Sections 8–11 verified; section 17 records results and remaining platform limits. No integration, publication validation or new product work. Stop after Stage 5. |

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
| Existing-file exceptions | Outside renderer-owned files, **only `package.json` and `package-lock.json`** for the approved dependency installation. No further manifest changes in Stages 2–3. Existing Stage 1 renderer/dev/test files and their own Playwright configuration may be extended within the explicitly authorised scope. |
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
| Alignment fidelity | Both layouts and B candidates pass current three-browser geometry checks; Stage 4 visual review is approved. Stop if a required layout fails in future evidence; never weaken the requirement. |
| Candidate B differs from illustrative spec syntax | Test both sources unchanged; propose a verified authoring example for review. Never auto-convert source or substitute a layout. |
| Bounds miss descendants or count engine helpers | Stage 2 compares measured extents with browser evidence for nested/tall/overflowing content before full rollout. |
| Font fallback or unknown glyph metrics | Required-face checks and currency fixtures; no ready fit on failed required assets. Browser-specific prose fallback remains a documented platform limit. |
| Unusual layout commands | Normal KaTeX vocabulary remains supported in principle; no command allowlist may be introduced to simplify later measurement. Investigate individual problems and obtain approval before excluding otherwise supported maths. No silent size capping. |
| Transform complexity | Translation/positive axis scaling are the approved priorities for future stage 2. Complex transforms may report measurement unavailable; do not build a general geometry engine or claim approximate fit. |
| Delimiter grammar / empty regions | Resolved for v1: longest unescaped opener, matching closer, literal unmatched-opener-to-end recovery, and KaTeX acceptance of complete empty/whitespace-only regions. Focused tests preserve the distinction between empty display mathematics and an unmatched display opener. |
| Ordinary prose whitespace beyond newlines | Single breaks and collapsed separator runs are agreed. Repeated spaces, tabs, edge blank lines and unbreakable prose-token policy must not acquire new normalisation/forced breaking without review where behaviour is ambiguous. |
| Exact styling and legibility | Balanced settings and current 2.3125 row spacing are approved; see sections 1.1 and 17. No universal consumer font size or minimum font size is imposed. Reopen appearance only for a substantive defect. |
| Accessibility targets | HTML/MathML, reading order and automated accessibility checks pass across the recorded browsers. Physical VoiceOver/NVDA verification was not performed and is not implied. No new accessibility UX or spoken labels are introduced. |
| Global engine stylesheet effects | Audit selected stylesheet and verify neighbouring content/navigation. Scope unrelated rules in new files or report an exception. |
| Concurrent repository work | Scope mutations, coordinate manifests and avoid competing build output. No branch/worktree change. |

The paragraph, exact-source fallback, unmatched-delimiter recovery and empty-region decisions are recorded in section 1.1 and verified by the Stage 3 tests in section 15. Approved visual values and the final spacing clarification are recorded in section 17. Technical platform limits are reported with evidence rather than converted into new UX.

### 12.1 Future integration considerations — not implementation work

Current explanation source is plain `body: string` in [model.ts](../../../../src/lib/infoCards/model.ts), displayed as paragraphs in [InfoCardFace.tsx](../../../../src/components/info-cards/InfoCardFace.tsx). [capacity.ts](../../../../src/lib/infoCards/capacity.ts) combines header, explanation and general validation; [repository.ts](../../../../src/lib/infoCards/repository.ts) enforces it at publication, and [queries.ts](../../../../src/lib/infoCards/queries.ts) can reject a publication during consultation reads.

A future integration plan must preserve plain-text meaning, saving, immutability and existing publication availability, and resolve authoritative nonbrowser validation. Client measurements alone do not establish server trust. None of that blocks standalone acceptance, and no workers, services, validation receipts, storage metadata or migrations are included here. Do not import the old estimator now or reuse it in the renderer later.

## 13. Explicit approval checkpoints

1. **Plan review — complete:** the user approved the plan with the mathematical-vocabulary and transform clarifications in section 1.1.
2. **Stages 0–1 authorisation — granted and work implemented:** manifests/lockfile, isolated alignment files, fixtures/tests, documentation evidence and iPhone review setup were authorised. No permission for later stages is implied.
3. **Stages 2–3 authorisation — granted:** implemented together under the user's later instruction. Alignment requirements remain unchanged; section 15 records fresh regression evidence.
4. **Stage 4 authorisation — granted:** complete standalone presentation, lifecycle, automated accessibility/browser verification and the requested regression checks. No production-build/Stage 5 acceptance work or consumer integration.
5. **Stage 4 visual approval — granted:** Balanced styling and current 2.3125 row spacing are approved. Existing screenshots remain supporting evidence, not automatically generated visual-regression baselines.
6. **Stage 5 standalone acceptance — passed:** section 17 records fresh tests, production guard/assets, remaining limitations and complete changed-file scope. Stop after this stage. User acceptance does not authorise consumer integration.
7. **Separate future integration:** only a separately requested/reviewed integration plan and explicit authorisation may touch Info Card functionality or publication-capacity validation.

**Stop after Stage 5. Consumer integration requires separate explicit authorisation.**

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

At the Stage 1 checkpoint, both required alignment layouts were technically demonstrated under the tested conditions and no KaTeX layout blocker was found. Final numerical styling and a preferred B authoring example were not selected. Stages 2–3 were subsequently authorised together; their implementation is recorded below. The historical Stage 1 evidence above is retained.

## 15. Stages 2–3 implementation record — 25 October 2026

### 15.1 Scope and files

Preflight: existing `feat/math-renderer` branch, clean working tree at `56072e3`; no branch/worktree/reset/stash/commit operations. Rechecked relevant installed Next.js Client Component and scoped-CSS documentation. Baseline existing unit suite: 420 passed. KaTeX remains pinned at **0.19.1**; no package manifest, lockfile or application dependency changes in this cycle.

New renderer-owned modules:

| File under `src/components/maths-renderer/` | Responsibility |
| --- | --- |
| `MathsRenderer.tsx`, `MathsRenderer.module.css` | Public mixed-content Client Component and scoped natural-flow presentation. No editing, publication, consumer models or overflow remediation. |
| `types.ts` | Public content/constraints/presentation/result/diagnostic contract. |
| `parseContent.ts` | Private deterministic dollar-delimiter scanner, original ranges, prose blocks and literal recovery. |
| `prepareContent.ts` | Private typesetting/diagnostic preparation; maps engine offsets to original source offsets. |
| `measureLayout.ts` | Shared explicit/container constraint resolution, actual extents and independent overflow axes. |
| `fontReadiness.ts` | Required face loading/checks, failure and timeout detection, cancellation. |
| `useMeasurement.ts` | Instance generations, coalesced reads, stable-layout checks, resize/font/ancestor invalidation and cleanup. |

Existing renderer-owned `typesetMath.ts` now returns structured issues while preserving fresh macros, the earlier working-row spacing adjustment and normal KaTeX vocabulary. Unsafe HTML/resource commands produce errors and literal fallback, rather than an apparently successful blocked-command rendering.

Development-only files: new `src/app/dev/maths-renderer/CapacityFixtures.tsx`; update the existing renderer-owned `page.tsx` and `page.module.css` to append fixed mixed-content/capacity cases and diagnostics. The original 18 Stage 1 cases remain intact. No new creator controls or product interface. Fixture-only update/history hooks are reachable solely through this guarded development page.

Tests: new `tests/maths-renderer/parsing.test.ts` and `capacity.browser.ts`; extend the renderer-owned import-isolation allowlist in `isolation.test.ts`. Add Firefox to `playwright.maths-renderer.config.ts`; its Playwright browser binary was installed in the local browser cache without changing project dependencies. Evidence is stored separately under `tests/maths-renderer/evidence/stages2-3/`. No existing Info Card source, test, model, estimator, saving, publishing or consultation file changes.

### 15.2 Implemented contract and parsing

`MathsRenderer` accepts `content`, `constraints`, `presentation`, and optional `onResult`. Presentation values are explicit consumer choices; fixture values remain provisional, not product defaults. Explicit constraints use positive `widthPx` and nonnegative or null `heightPx`. Container constraints reference a dedicated containing element and declare bounded/unbounded height. The consumer must independently establish a bounded host's height. Padding and borders are excluded from its content-box budget, including `border-box` hosts.

Every result includes an instance-local generation and diagnostics. Only `ready` results contain `fits` and layout. Layout includes available dimensions, occupied bounds relative to the content origin, width/height, separate `overflowX`/`overflowY` and excess on each side. `pending`, `invalid-input` and `measurement-unavailable` never declare fit. Source/configuration changes immediately hide a previous ready result; stale asynchronous reads cannot publish.

Parsing uses unescaped `$$` before `$` for openers, then the matching delimiter without nesting or inferred repairs. Backslash parity determines escaping. Mathematical content and explicit working rows pass unchanged to KaTeX. Prose logical newlines normalise CRLF/lone CR without changing original source offsets. Single breaks remain; blank-line runs create one paragraph separation. Display boundaries create blocks without additional empty prose rows. Repeated ordinary spaces/tabs are retained. No Markdown, HTML interpretation, new external delimiters, mathematical rewriting or algebraic inference.

Invalid expressions display their exact original source, including delimiters, as React text. An unmatched opener consumes the entire remaining source literally; earlier valid regions remain rendered. Diagnostic offsets are original JavaScript code units with exclusive ends, including across CRLF and surrogate pairs. Resource/HTML commands are untrusted; there is no mathematical command allowlist.

**Resolved edge case:** the user confirmed that empty/whitespace-only mathematical regions (`$$$$`, `$ $`) should be accepted as KaTeX does. The existing renderer already behaves accordingly; no source, styling or measurement changes were needed. Focused tests now verify successful preparation, preserved source segments/ranges, no error diagnostics or fallback, no visible mathematical expression, finite browser capacity results, and preservation of surrounding prose. Empty regions retain ordinary KaTeX/renderer layout behaviour; no special spacing-collapse rule was added. An unmatched `$$` opener still produces the agreed diagnostic and literal remainder. This closes the remaining Stage 3 decision.

### 15.3 Measurement evidence and technical choices

- One collector serves both constraint modes. Root natural flow height includes authored block spacing; text-fragment ranges, intrinsic `.katex-base` boxes, intact inline boxes and visible rules/SVG extents provide occupied bounds. The constraint-sized root width is not substituted for content width.
- Descendants beyond ordinary boxes are included: the `\smash`/`\llap` fixture reports negative left overflow and vertical overflow. Intentional spacing such as `\kern{30em}` remains measurable. Hidden MathML, positioning struts and newline helper boxes are excluded. Radical construction SVGs are intersected with KaTeX's own clipping boxes, avoiding a false 400em width. The renderer itself introduces no clipping or scroll container.
- Geometry uses local CSS pixels. Nested translation and positive nonuniform x/y scaling are verified. Rotation, skew, perspective and nonpositive/degenerate scaling return unavailable. Active ancestor transform animations return unavailable until completion; transition/animation events invalidate prior results and allow recovery. A wrapping-width mismatch also returns unavailable. No general transformation engine was built.
- Capacity comparisons allow only 0.01 CSS px for floating-point/subpixel noise; the 0.5 CSS px tolerance in independent geometry comparisons is not a fit allowance. A width 0.1px below an intact expression's measured requirement reports overflow; 0.1px above it fits.
- Load/check only fonts actually requested by current rendered text. Verify declared failures in addition to `FontFaceSet.load()`/`check()`: WebKit can otherwise accept fallback after a declared face fails. Do not wait for unrelated instances' fonts. A 10-second required-font timeout returns unavailable, never fit; a later successful load can recover.
- Require two identical consecutive frame measurements after required fonts. At most eight frame reads per attempt; unstable layout reports unavailable. Coalesced `ResizeObserver` callbacks handle root/host geometry; font events and ancestor style/class/hidden changes invalidate relevant state. Attribute checks compare the relevant computed environment, so unrelated development diagnostics positioning cannot create a feedback loop.
- Pending font waits, animation frames, observers and callbacks are cancelled/discarded on source/configuration change or unmount. Multiple instances retain independent macro, measurement and result state.

### 15.4 Automated verification

Recorded results for the agreed requirements, including the subsequently confirmed empty-region policy:

| Check | Result |
| --- | --- |
| Standalone unit/isolation tests | **15 passed** after the empty-region clarification. Includes original-source offsets, delimiter runs, empty/whitespace-only regions, escaping, paragraphs, fallback, security and isolation. |
| Maths browser suite | **57 passed**: 15 Stage 1 alignment checks and 42 Stage 2–3 checks, Chromium/Firefox/WebKit. |
| Empty-region follow-up | **3 passed**, one focused test per browser, covering empty display/whitespace-only inline and display regions plus surrounding prose. This extends the prior 57-test suite without changing renderer source. |
| Targeted checks after fixture stability/event cleanup | **9 passed**: actual bounds, internal inline nonbreaking geometry and ancestor transform-animation recovery in all three engines. |
| Final environment-change checks | **12 passed**: actual bounds, container resizing, translation/scaling and transform-animation recovery in all three engines. Viewport events only invalidate changed environments; root/host dimensions remain observed directly. |
| Existing application unit suite | **420 passed**, matching preflight. |
| Existing `tests/info-cards.integration.ts` | **26 passed**, using its own disposable MongoDB replica set. Includes save/publication immutability/capacity/consultation checks. |
| Existing Info Card capacity browser suite | **5 passed**, isolated fixture port 4179. |
| Scoped ESLint and TypeScript `--noEmit --incremental false` | Passed; no shared type-generation/build-output mutation. |

The Stage 2–3 browser tests cover explicit and observed content-box budgets, independent/both overflow axes, natural occupied height, nested fractions/radicals, left overhang, authored prose/paragraph spacing, atomic inline wrapping (including the engine's internal fragments), typography/content changes, rapid supersession, hidden recovery, invalid numerical configuration, invalid-source fallback, supported/unsupported/animated transforms, delayed/failed fonts, post-ready font changes, timeout/recovery, independent instances and cancellation. Both B candidates and A are also exercised through the public mixed-content component, with common expression/equals-column anchors and indentation; the original row-clearance tests remain passing. The prior approximately 25% working-row spacing remains unchanged.

Inspectable evidence in `tests/maths-renderer/evidence/stages2-3/`:

- `browser-tests.json`: compact full 57-test result, with no failures, skips or flaky results.
- `fixture-verification.json`: final targeted check results.
- `environment-verification.json`: the final twelve environment-change checks after avoiding unnecessary viewport-only invalidation.
- `empty-regions.json`: focused Chromium/Firefox/WebKit results for the approved empty-region behaviour.
- `capacity-results.json`: all eleven fixed cases in desktop Chromium and mobile WebKit; includes independent axes, exact budgets, diagnostics and generations.
- `chromium-mixed.png`, `chromium-wide.png`, `chromium-currency.png`, `iphone-webkit-inline.png`: actual source fixtures/output. Detailed diagnostics are collapsed for stable inspection, with a visible status and expandable JSON outside each measured host. Pending results retain the last measured surrounding development-page space; this affects only the fixture page, not renderer capacity/layout.

For example, Chromium reports the mixed fixture at approximately **254.16 × 189.66px** within a **360 × 330px** budget, identically through both constraint modes. The wide fixture occupies approximately **510.39px** against **160px** available width and reports horizontal overflow alone. The height-only fixture retains approximately **189.66px** natural occupied height against **35px**, reporting vertical overflow alone. The complete browser records retain platform differences rather than asserting identical text metrics across engines.

### 15.5 Review environment, limits and next boundary

During the initial Stages 2–3 verification, the established Info Cards LAN review setup served **http://192.168.1.38:4181/dev/maths-renderer**. That exact URL was verified in Chromium and mobile WebKit: HTTP 200, all 18 alignment examples, all eleven mixed-content cases, and no page errors. No server was stopped, restarted or replaced and no review database was modified by the maths tests. Existing Info Card integration tests used their own disposable database; capacity browser regression tests used their own fixture server. Server availability at the subsequent empty-region follow-up is recorded in section 15.6 rather than assuming this historical LAN endpoint is still running.

Bounds describe actual browser layout boxes, not exact painted glyph outlines. Browser/system font fallback varies by platform. Mathematical `\text{€}` renders using text fallback and returns KaTeX's Unicode/unknown-metric warnings; those warnings remain visible in diagnostics and actual browser geometry is measured. Dollar/pound forms are supported without aliases. This is not a guarantee of identical glyph outlines across operating systems.

Complex transforms report unavailable as approved. Consumers must provide a dedicated, stable host and establish bounded height independently; arbitrary external descendant CSS overrides are outside the reliable styling contract. Hidden hosts and zero/unresolved widths cannot declare fit; zero available height is valid and reports vertical overflow for nonempty content. An explicitly unbounded height is not treated as an unknown budget.

Numerical visual styling is still provisional. No human visual approval, physical iPhone run, production-build acceptance or screen-reader acceptance is claimed by automated desktop browser tests. None of this work integrates Info Cards or makes browser capacity authoritative for publication. **Stages 4–5 have not begun. Stop for Stages 2–3 review and explicit Stage 4 authorisation.**

### 15.6 Empty-region clarification and Stage 3 closure

The user answered **“Accept empty mathematics as KaTeX does.”** This resolves the only outstanding Stage 3 decision. The existing parser/typesetter already implements that behaviour; this follow-up changes only renderer-owned tests, this plan and test evidence. No renderer source, styling, dependency, development route or Info Card changes were needed.

- `parsing.test.ts`: verifies complete empty/whitespace-only inline and display regions are valid with no diagnostics, retaining exact raw source and original ranges. Incomplete display openers remain invalid under the agreed longest-opener grammar.
- `capacity.browser.ts`: verifies no fallback or visible mathematical expression, reliable finite ready results, and preservation of surrounding prose in Chromium, Firefox and WebKit. No extra spacing-collapse behaviour is introduced.
- Unit/isolation suite: **15 passed**. Focused browser suite: **3 passed**. Scoped ESLint, TypeScript without emission/incremental output, and diff checks passed.

The previous port-4181 review server was no longer listening when the focused browser checks began; the first attempt could not connect. Read-only inspection identified the existing Next.js 16.2.6 server on port 3000 in this same working directory. Although its actual `/dev/maths-renderer` response was HTTP 200 with the correct title and markup, the browser did not initialise the client fixture API, so it could not run these checks. That server was left untouched.

Restored the previously authorised `scripts/test-phase2.ts --dev --lan --info-cards` review setup on unused port 4181, with its own `.next-phase2` build output and newly created disposable database. No other process was stopped or restarted, no source/configuration changed, and no existing review or application database was modified. The focused tests pass on this restored setup. The review server is left running at **http://192.168.1.38:4181/dev/maths-renderer**. Mobile WebKit verified that exact URL after restoration: HTTP 200, correct Maths Renderer title, working client fixture API, all 18 alignment cases, all eleven mixed-content cases and no page errors. See `empty-regions.json` for the focused test results.

**Stages 2 and 3 are complete for their approved scope. Stages 4–5 and consumer integration remain unauthorised and have not begun.**

## 16. Stage 4 — presentation and lifecycle implementation record

**Authority:** the user's subsequent Stage 4 authorisation supersedes the historical stop gates in section 15. Work is confined to the standalone renderer, its development fixtures/tests and this record. **Stage 5 has not begun.** Numerical styling remains provisional pending the user's visual review.

### 16.1 Changed files and isolation

| Renderer-owned file | Stage 4 change |
| --- | --- |
| `src/components/maths-renderer/MathsRenderer.tsx` | Flow-preserving display wrappers and provisional inline font-metric clearance, scaled with mathematics. Public props and result types are unchanged. |
| `src/components/maths-renderer/MathsRenderer.module.css` | Noncollapsing display gaps, one gap between adjacent displays, and inline mathematical clearance. Prose-only line height remains consumer-controlled. |
| `src/components/maths-renderer/typesetMath.ts` | Preserve KaTeX MathML and raw TeX annotation, marking only the annotation metadata `aria-hidden` to avoid a duplicate raw-TeX representation in WebKit accessibility output. The semantic presentation branch remains accessible. |
| `src/components/maths-renderer/fontReadiness.ts` | Reuse the actual rendered-font requests to filter unrelated document font events; cancel superseded font waits without promoting fallback to a ready fit. |
| `src/components/maths-renderer/useMeasurement.ts` | Rebind observers on host/ref/ancestor changes; handle detach/reinsert and native disclosures; suppress unchanged initial resize deliveries and duplicate semantic callbacks; clean up per-instance work. React-commit checks compare host identities rather than animated computed styles, preventing a transform-driven update loop. |
| `src/components/maths-renderer/measureLayout.ts` | Detect closed disclosures; distinguish painted prose fragments from nonpainting hanging whitespace. Engine-aware mathematical bounds and the strict capacity tolerance remain intact. |
| `src/app/dev/maths-renderer/page.tsx`, `page.module.css` | Stage 4 review at the existing route, with responsive ordinary hosts; retain earlier fixed-width regression fixtures in an expandable development-only section. Existing production guard unchanged. |
| New `src/app/dev/maths-renderer/presentationSamples.ts`, `PresentationFixtures.tsx` | Fixed source, nine presentation/size combinations, source/settings/result inspection outside measured hosts. The case-distinct names avoid a filename collision on case-insensitive filesystems. |
| New `src/app/dev/maths-renderer/LifecycleFixture.tsx` | Independent full StrictMode development root and test-only lifecycle controls, confined to the guarded page. The renderer itself gains no test or editing API. |
| New `tests/maths-renderer/lifecycle.browser.ts`, `presentation.browser.ts` | Browser geometry, lifecycle, callback, accessibility and responsive presentation checks. |
| Existing renderer-owned `alignment.browser.ts`, `capacity.browser.ts`, `parsing.test.ts`, `isolation.test.ts` | Await hydration before opening development fixtures; retain earlier requirements and add accessibility/transform-loop regression assertions. Import allowance for `react-dom/client` applies only to the development fixture. |
| New `tests/maths-renderer/evidence/stage4/` | Separate screenshots and machine-readable verification; historical evidence is retained unchanged. |
| This engineering plan | Stage 4 authority, progress, findings and review boundary. The design specification is unchanged. |

No dependency/lockfile, global stylesheet, application layout, Info Card component/model/test, persistence, publication, consultation or capacity-estimator changes. No branch/worktree or server replacement. KaTeX remains pinned to **0.19.1**. No source convention is rewritten and no mathematical command exclusions were introduced.

### 16.2 Provisional presentation for visual review

Recommended **Balanced** fixture settings, all awaiting visual approval:

| Setting | Provisional value |
| --- | --- |
| Prose size and family | 14px Arial, 18px Arial and 22px Georgia examples; fixture choices only. |
| Prose line height / weight | 1.5 / 400. |
| Mathematical scale | 1em relative to surrounding prose. |
| Paragraph separation | 0.8em. |
| Whole-display indentation | 1em. |
| Prose-to-display / display-to-prose gap | 0.6em; adjacent mathematical displays share one such gap. |
| Inline mathematical clearance | 0.25 mathematical em above/below the inline layout box. This reserves font-metric space without changing prose-only line spacing or the mathematical alignment. |
| Working-row spacing | Existing `\arraystretch = 1.3125`, unchanged: ordinary aligned row pitch is 1.875em versus 1.5em, approximately 25% larger. Tall rows still expand naturally. |

Two fixed alternatives isolate questions of appearance: **Larger mathematics** changes the mathematical scale to 1.1em; **More display space** changes the indentation to 1.5em and display gaps to 0.8em. These are comparison fixtures, not renderer modes or approved product defaults. Every actual consumer still supplies its own dimensions and presentation values.

The 280/460/700px review-host widths include 12px padding and 1px borders; actual capacity uses their content boxes and adapts to a narrower viewport. They are test data, not renderer limits. All hosts have natural, unbounded height for presentation review; earlier fixtures retain bounded-height and deliberately oversized cases. Overflow stays visible and is reported without automatic remediation.

### 16.3 Lifecycle, measurement and accessibility findings

- Root and current constraint-host dimensions are observed independently. A stable ref may change target after a React commit; observers rebind to the replacement target. Ancestor identity changes rebind mutation/animation listeners. Only direct ancestors are observed; there is no document-wide subtree observer or geometric transformation engine.
- Hidden, detached and closed-disclosure content cannot retain an earlier fit. Returning to usable layout triggers fresh measurement. A missing ResizeObserver reports `measurement-unavailable` rather than crashing or declaring fit.
- Required-font loading, failure, timeout and recovery use the same measurement pipeline. Events for an unrelated font family do not reset otherwise-ready instances. Per-attempt cancellation and generation checks discard superseded work.
- Identical resize deliveries, equivalent consumer objects, callback identity changes and paint-only changes do not repeatedly notify consumers. Notifications describe semantic state changes rather than every pending generation. Full StrictMode mounting and repeated unmount/remount exercise cleanup and exclude late callbacks.
- A WebKit transform test exposed a feedback loop when each React commit reread an evolving animated transform and synchronously invalidated state. Commit checks now inspect only host/connection identities. Normal mutation/resize/animation events still invalidate layout. Repeated WebKit tests verify unavailable during the unsupported transition and recovery after completion, with no page errors.
- Inline boxes remain indivisible and baseline aligned; additional local padding accommodates mathematical font metrics. Fractions/radicals use natural height. Display gaps use padding to avoid margin collapse. No clipping, maximum height, shrinking, truncation, scrolling or automatic internal mathematical breaks were added.
- Mobile WebKit returns an extra zero-width caret rectangle at a wrapped word's old line boundary, sometimes past hanging trailing whitespace. It paints no part of the word. Prose measurement excludes that zero-width fragment while retaining all positive-width word fragments at their actual positions. A mobile browser regression exercises this case without trimming source or relaxing the 0.01px capacity tolerance. Deliberate mathematical spacing and overhanging mathematical descendants remain measured.
- Prose remains HTML paragraphs in reading order, interleaved with KaTeX `htmlAndMathml`. Visual HTML is accessibility-hidden. The MathML presentation branch remains exposed once per expression; only secondary TeX annotation metadata is marked hidden. WebKit's automated accessibility representation previously included that annotation as duplicate raw notation. The adjustment retains source metadata and structured MathML without a custom spoken label or alternative mathematical layout. MathML's primary-expression/annotation distinction is documented in [W3C MathML Core, Semantics and Presentation](https://www.w3.org/TR/mathml-core/#semantics-and-presentation).

### 16.4 Verification record

| Check | Stage 4 result |
| --- | --- |
| Standalone unit/isolation suite | **16 passed**, including parser/source recovery/security and accessible metadata retention. |
| Maths browser suite | **96 passed**: 32 each in Chromium, Firefox and WebKit; no failures, skips or flaky results. Includes all existing Stage 1–3 checks and the new Stage 4/mobile regressions. |
| Repeated WebKit transform recovery | **3 passed** after correcting the commit-driven update loop. |
| Existing application unit suite | **420 passed**, matching the clean preflight baseline. |
| Existing Info Card database integration | **26 passed**, using a disposable MongoDB replica set. |
| Existing Info Card capacity browser suite | **5 passed** on its isolated fixture server. |
| Existing Info Card consultation/layout browser suite | **19 passed** on its isolated fixture server. |
| Existing real Info Card authoring and consultation browser flows | **36 passed**, using their own disposable Phase 2 setup and build output. |
| Scoped ESLint / TypeScript | Passed, with `--noEmit --incremental false`; no shared generated-type or build-output changes. |
| Wi-Fi review page | HTTP 200 and correct rendered Stage 4 page in mobile WebKit and desktop Chromium; all nine examples ready/fitting, no page/asset/request errors. |

The browser suite preserves Stage 1 alignment geometry and Stage 2–3 capacity/diagnostic checks. New Stage 4 tests verify nine size/presentation combinations, tall inline/display clearance, indentation/gaps, ordinary working-row pitch against a 1.0 array-stretch baseline, accessible reading order, mobile/desktop layout, nonpainting mobile caret fragments, stable-ref replacement, detachment/reparenting, hidden/disclosure recovery, unrelated font/paint changes, semantic callback deduplication, full StrictMode effect replay, repeated remount cleanup and unavailable results without ResizeObserver.

All measurements use actual browser geometry. Column/clearance comparisons retain the documented 0.5 CSS px tolerance for independently read rectangles; capacity retains its separate strict 0.01px arithmetic tolerance. No alignment acceptance rule was weakened. Both B source candidates remain authored and tested independently; the precise common-expression column and separate leading-equals column are preserved.

Screenshots in `tests/maths-renderer/evidence/stage4/` show the actual LAN review page and rendered hosts: `iphone-webkit-review.png`, `iphone-webkit-balanced.png`, `iphone-webkit-larger-maths.png`, `iphone-webkit-more-space.png`, corresponding desktop images, and desktop small/large Balanced examples. `review-verification.json` records actual page responses, capacities, asset/font status and successful settling after screenshot capture. `browser-tests.json` records all 96 final passing browser checks; `geometry.json` retains independent column/bounds/clearance measurements, the 25% row-pitch comparison and mobile fragment evidence; `accessibility.json` retains the reading-order/native accessibility snapshots. `regression-checks.json` records the scoped and protected application checks. Screenshots are review evidence, not approved visual baselines.

### 16.5 Review boundary and limitations

The same existing review server and Wi-Fi setup are retained at **http://192.168.1.38:4181/dev/maths-renderer**. The exact LAN URL returned HTTP 200 with the Stage 4 heading and all nine current review examples ready/fitting in iPhone WebKit (390px viewport) and desktop Chromium (1100px viewport). Page width equals viewport width, with no page errors, failed requests or HTTP asset errors. See `review-verification.json`; this verifies the page itself, not merely the listening process. No other session's server is stopped or restarted; Info Card regressions use isolated fixtures/disposable databases.

Browser layout boxes are the capacity authority, not exact painted glyph outlines or a cross-platform promise of identical font metrics. Complex transforms continue to return unavailable. Arbitrary external overrides of renderer descendants remain outside the reliable styling contract.

Automated MathML/ARIA checks do not establish how every screen reader audibly presents mathematical structures. No physical iPhone or audible VoiceOver/NVDA acceptance is claimed. Mobile WebKit verifies the actual LAN page; the user is asked only to judge appearance and readability. Production-build/route-guard acceptance is deliberately left for separately authorised Stage 5.

**Stop after Stage 4. Await numerical styling/visual approval and explicit Stage 5 authorisation. Info Card integration remains outside this implementation.**

## 17. Stage 5 — standalone acceptance and regression verification

**Authority:** Stage 4 visual review and Balanced styling are approved. The user explicitly authorised this final standalone acceptance stage, including fixes for demonstrated implementation defects. This supersedes the historical stop gates above. **No Info Card integration or publication-capacity work is included.**

Preflight: clean existing `feat/math-renderer` working directory at `323123f`. Existing Next.js servers on ports 3000 and 4181 were identified and preserved; no branch/worktree/reset/stash/commit operations. The specification, this plan and the relevant installed Next.js CSS, Client Component, production-build and `notFound()` documentation were reviewed. Current KaTeX remains pinned to 0.19.1; manifests and lockfiles are unchanged.

### 17.1 Accepted presentation and resolved spacing discrepancy

**Accepted default: Balanced.** Mathematical size 1× prose, display indentation 1em, display gaps 0.6em, paragraph separation 0.8em, and local inline clearance of 0.25 mathematical em on each side. These are accepted settings, not new optional renderer modes. The existing API still requires explicit consumer presentation/constraints; the demonstration's 14/18/22px prose sizes, Arial/Georgia families and container widths are test scenarios, not universal defaults.

The user's opening Stage 5 instruction mentioned preserving the earlier +25% spacing, but the actual visually reviewed code had subsequently been adjusted to `arraystretch = 2.3125`. Clarification was requested before changing it. The user selected **“Keep current 2.3125 spacing.”** That is the accepted setting; it is retained unchanged. Ordinary row pitch is approximately `(1.2 × 2.3125 + 0.3)em = 3.075em`, or 2.05× the original 1.5em pitch. Tall expressions can expand rows naturally. The earlier 1.3125/+25% description remains historical only. Comments, the development page and the geometric acceptance expectation now accurately describe the user's decision. No automatic fraction detection, source rewriting or per-row spacing rule was added.

### 17.2 Acceptance against the specification

The implementation was read against specification sections 2–8 and the agreed subsequent decisions, rather than using passing tests as the definition of the contract.

| Requirement | Implementation review and acceptance coverage |
| --- | --- |
| Mixed prose and mathematical delimiters | `parseContent.ts` scans unescaped `$$` before `$`, retains original segments/ranges and passes mathematical contents unchanged. Parser units plus the exact inline/mixed specification examples in `acceptance.browser.ts`. |
| Escaping, currencies, literal prose | Backslash parity handles `\$`; prose € and £ remain literal. Dollar/pound/euro mathematical representations are typeset; euro unknown-metric warnings are retained. Literal HTML/Markdown is React text, never interpreted. Unit and browser assertions inspect actual DOM/source, including malicious-looking literal markup. |
| Invalid and unmatched mathematics | KaTeX failures retain exact source including delimiters. Unmatched opener consumes the literal remainder, preserving earlier valid maths. Original code-unit offsets are retained across CRLF/surrogate pairs. Invalid results never expose fit; coexisting hidden/layout errors retain their diagnostics. |
| Authored line and paragraph structure | Single prose newlines remain in `pre-wrap`; repeated blank separators produce one paragraph gap. Mathematical rows remain within their authored environments. Exact before/equation/Therefore/equation ordering, paragraph geometry and adjacent-display gaps are exercised. |
| Alignment A | Browser column anchors verify equal relation positions, right-aligned left expressions, common right starts and consistent relation gaps across varying fonts, widths and expression lengths. |
| Alignment B | Both unchanged authored candidates verify a shared expression column, a separate preceding equals column and an initial expression without a visible equals sign. Whole-block indentation is measured independently. |
| Approved typography and row clearance | Balanced values and accepted 2.3125 row stretch are preserved. Geometry tests cover fractions, nested radicals, superscripts, row clearance and tall inline neighbours. Production tests independently check mathematical size, indentation and each approved gap. |
| Natural sizing and intact mathematics | Natural root height and visible overflow remain; no clipping, max height, transform shrink, scroll container, truncation or mathematical line-wrap remediation. Long inline and display expressions exceed narrow budgets intact. A new display acceptance case checks intrinsic equation width and the number of authored working rows. |
| Capacity contract | Both explicit and dedicated-host content-box constraints use one actual-bounds collector. Independent x/y and combined overflow, borders/padding, subpixel boundaries, zero height, unbounded height and intentional overhang/spacing are verified. No character estimator is used. |
| Result readiness | The discriminated result union reserves fit/layout fields for `ready`; pending, invalid input and unavailable results cannot declare fit. Required fonts and two stable frame reads precede ready results. |
| Font and lifecycle handling | Actual required fonts, delayed/error/timeout/recovery, cancellation, scoped invalidation and source supersession are verified. Empty mathematical regions remain valid under the agreed KaTeX policy. |
| Resizing, freshness and transforms | Generation checks reject stale reads. Root/current host resizing, ref retargeting, hidden/disclosure recovery, detachment/reparenting, positive scale/translation and unavailable unsupported transforms are exercised. No general transformation engine. |
| Multiple independent instances | Per-expression macro state and per-instance observers/results remain isolated. Equivalent rerenders, callback identity, unrelated fonts/paint, StrictMode replay and repeated remount cleanup are checked. |
| Accessibility | HTML prose order and one exposed MathML presentation branch per expression; visual HTML and secondary raw-TeX metadata are accessibility-hidden. Automated reading-order/DOM checks across three engines and Chromium native accessibility-tree evidence; no invented spoken labels. |
| Isolation and reuse | Public component depends only on renderer-local modules, React, KaTeX and browser APIs. A new complete local import-graph check rejects relative/alias escapes. Scoped CSS is compared with the pinned upstream source, and neighbouring prose/engine-like class names are compared before/after loading renderer styles. |
| Production safety | The actual review page's existing server `notFound()` guard executes before fixtures. A full application production snapshot is built separately and tested for HTML and RSC 404 responses, absent fixture markup/hooks, and actual compiled renderer assets/presentation. See section 17.4. |

Missing acceptance coverage identified and added: literal specification examples through the browser, visible prose/currency/literal-markup checks, long display working with simultaneously insufficient width/height, neighbouring-style isolation, complete local dependency traversal, actual production HTML/RSC guard execution and compiled CSS/font/presentation checks. Existing alignment, capacity, parser and lifecycle assertions remain in force.

### 17.3 Defects found and fixes

1. **Production font resolution:** the relocated scoped stylesheet used `url(katex/dist/fonts/...)`. Development Turbopack resolved it, but a real Webpack production build attempted a nonexistent stylesheet-relative `./katex/...` path. Use standard relative URLs to the installed package (`../../../node_modules/katex/dist/fonts/...`). No fonts, vendor declarations, selectors, dependency versions or global styles were substituted. The pinned-upstream provenance test checks the corrected path transformation. The failing build evidence is retained in `production-font-resolution-before.log`.
2. **Production CSS ordering:** the vendor's scoped selectors could tie the renderer override's specificity, allowing a production chunk order to restore KaTeX's default 1.21em scale. A production browser measured 21.78px maths against 18px prose instead of the approved 1× ratio. Renderer-owned overrides now outrank the vendor selectors regardless of stylesheet order, including display margins/alignment. The same precedence correction covers the earlier standalone expression primitive. No numeric styling values changed. Production browser assertions retain exact approved sizes/gaps; the full suite's independent column checks remain unchanged.
3. **Stale acceptance descriptions:** comments/fixture labels and a +25% test expectation described an earlier spacing value. They now reflect the user's explicit current 2.3125 approval. This is an approved requirement clarification, not weakening a failed requirement.

New test helpers also required corrections: intrinsic table width must be measured instead of the constraint-sized `.katex-html` wrapper; an empty positioning span is not an authored equation row; and a local function inside a `tsx`-serialized browser callback must not depend on an unavailable helper. These were test-harness issues. Expected overflow, three authored rows, font sizes, spacing and production 404 requirements were retained. Their corrected checks must pass before acceptance is recorded complete.

### 17.4 Production build and guard method

`node --import tsx tests/maths-renderer/production-acceptance.mts` uses an ordinary temporary filesystem copy of current application source/public/configuration. It does not create a Git checkout/worktree, copy repository environment files, install dependencies, alter application configuration or share either development server's output. Installed dependencies are copied with filesystem cloning where available: default Turbopack rejects an out-of-root dependency symlink, an isolation-harness limitation encountered during investigation. The final check uses the project's normal `next build` production bundler; Webpack separately demonstrated the font-path defect and compiled successfully with the fix.

A tiny ordinary consumer is created **only inside the temporary copy**, under the real application root layout, to verify production CSS ordering, local fonts, hydration, MathML and approved geometry. It is served on an automatically allocated **loopback-only** port. It is never added to the repository application or deployed. The unchanged real `/dev/maths-renderer` route is checked via HTML, RSC and browser navigation for HTTP 404, no fixture content and no `window.mathsFixtures`/`window.mathsLifecycle` hooks. Local browser-only analytics stubbing avoids unrelated hosting analytics requests. The temporary server is stopped and the final temporary directory removed after verification; existing servers remain running.

The route guard makes fixtures unreachable through the production page. It does **not** promise that a route manifest, source reference or unused compiled chunk is physically absent. No extra routing architecture or production fixture endpoint is introduced. Public browser capacity is not made authoritative for any server operation.

### 17.5 Verification and evidence

**Standalone acceptance passed.** No unresolved renderer defects or product decisions remain within the approved scope.

| Check | Result |
| --- | --- |
| Renderer units and isolation | **17 passed**: parser/source/error/security checks, pinned stylesheet provenance and complete local import ownership. |
| Maths browser acceptance | **105 unique cases verified**, 35 each in Chromium/Firefox/WebKit. The final full run had **102 passed / 3 failed** because the newly added row-count helper included an empty KaTeX positioning span. After correcting that helper, the complete nine-case acceptance file passed **9/9** across the three browsers, superseding all three helper failures. No renderer/expectation change was made for those row-count failures. No unresolved failures, skips or flaky cases. |
| Production build | Default **Next.js 16.2.6 Turbopack production build passed** on the isolated full-application snapshot. Webpack also compiled the corrected relative font paths during the defect investigation. |
| Production guards and actual renderer | **Passed in Chromium, Firefox and WebKit**: HTML/RSC 404, no fixture content/hooks, required local fonts, correct 18px mathematical size against 18px prose, 1em indent, 0.6em display gaps, 0.8em paragraph gap, 0.25em inline clearance, MathML and reliable fit. No page errors or failed production static assets. |
| Existing application units | **420 passed**. |
| Existing Info Card database integration | **26 passed**, disposable replica set. |
| Existing Info Card capacity browsers | **5 passed**, isolated fixture port 4179. |
| Existing Info Card consultation/layout browsers | **19 passed**, isolated fixture port 4192. |
| Existing real Info Card authoring/consultation | **36 passed**, existing Phase 2 disposable runner and separate `.next-phase2-test` output. |
| Scoped ESLint / TypeScript | Passed. TypeScript used `--noEmit --incremental false`; no shared type generation/build changes. |
| Scope/production isolation | Passed. No Info Card/application/global CSS/configuration/manifest edits; production test consumer exists only in the temporary snapshot and its server is stopped afterwards. Existing review servers remain unchanged. |

Evidence is under `tests/maths-renderer/evidence/stage5/`:

- `browser-tests.json`: all 105 effective case results, raw full-run counts, resolved helper errors and the independent 9/9 corrected rerun. This explicitly preserves the distinction between one clean full run and acceptance established through a focused rerun.
- `geometry.json`: actual alignment, size/gap/clearance, capacity, approved row-pitch and long-display measurements. `accessibility.json`: reading-order snapshots and Chromium native accessibility evidence.
- `production-acceptance.json`, `production-build.log`, `production-server.log`: full production build, guard, browser font/presentation and shutdown evidence. The temporary directory is removed after the successful verification.
- `production-font-resolution-before.log`, `production-presentation-before.log`: the demonstrated production failures before their fixes.
- `production-chromium.png`, `production-firefox.png`, `production-webkit.png`: current production-probe rendering; fixed test content and actual application root styling, not new product designs.
- `chromium-a-tall.png`, `chromium-b-columns-tall.png`, `chromium-b-phantom-tall.png`, and corresponding `webkit-` images: both exact layouts and both B candidates with current accepted row spacing. Earlier stage evidence is untouched.
- `regression-checks.json`: commands, counts and isolation of the existing checks. `change-manifest.json`: complete Stage 5 changed-file list relative to the clean `323123f` preflight, including all evidence files.

### 17.6 Limitations and next boundary

**Automated accessibility checks are not equivalent to physical VoiceOver or NVDA verification. No manual screen-reader testing was performed or is claimed.** The user has already approved Stage 4 appearance; no repeat manual visual review is requested. Automated mobile WebKit is not physical iPhone hardware testing.

Geometry describes browser layout boxes, not exact painted glyph outlines or identical font metrics on every operating system. Unknown euro metrics remain diagnostics. Complex transforms and unavailable/failed fonts cannot declare fit. Arbitrary external descendant CSS overrides remain outside the agreed reliable styling contract. Consumers must supply constraints and establish bounded container height independently.

Standalone use remains independent of publication, saving and persistence. Browser measurements cannot simply be trusted for future server publication validation. No Info Card integration, legacy migration, server-side validation/measurement service, editor, Markdown or future-consumer implementation was undertaken.

**Stop after Stage 5. Any next phase, including Info Card integration, requires separate explicit authorisation.**

### 17.7 Complete Stage 5 changed-file list

Paths are relative to the repository root and the clean `323123f` Stage 5 preflight. Historical evidence, dependency manifests, application configuration/global styles and all Info Card files are unchanged. The machine-readable manifest includes content hashes (excluding its own self-hash).

- `docs/engineering/features/maths-renderer/maths-renderer-engineering-plan.md`
- `src/app/dev/maths-renderer/CapacityFixtures.tsx`
- `src/app/dev/maths-renderer/PresentationFixtures.tsx`
- `src/app/dev/maths-renderer/page.tsx`
- `src/app/dev/maths-renderer/presentationSamples.ts`
- `src/components/maths-renderer/MathsExpression.module.css`
- `src/components/maths-renderer/MathsRenderer.module.css`
- `src/components/maths-renderer/MathsRenderer.tsx`
- `src/components/maths-renderer/katex.scoped.css`
- `src/components/maths-renderer/typesetMath.ts`
- `tests/maths-renderer/acceptance.browser.ts`
- `tests/maths-renderer/evidence/stage5/accessibility.json`
- `tests/maths-renderer/evidence/stage5/browser-tests.json`
- `tests/maths-renderer/evidence/stage5/change-manifest.json`
- `tests/maths-renderer/evidence/stage5/chromium-a-tall.png`
- `tests/maths-renderer/evidence/stage5/chromium-b-columns-tall.png`
- `tests/maths-renderer/evidence/stage5/chromium-b-phantom-tall.png`
- `tests/maths-renderer/evidence/stage5/geometry.json`
- `tests/maths-renderer/evidence/stage5/production-acceptance.json`
- `tests/maths-renderer/evidence/stage5/production-build.log`
- `tests/maths-renderer/evidence/stage5/production-chromium.png`
- `tests/maths-renderer/evidence/stage5/production-firefox.png`
- `tests/maths-renderer/evidence/stage5/production-font-resolution-before.log`
- `tests/maths-renderer/evidence/stage5/production-presentation-before.log`
- `tests/maths-renderer/evidence/stage5/production-server.log`
- `tests/maths-renderer/evidence/stage5/production-webkit.png`
- `tests/maths-renderer/evidence/stage5/regression-checks.json`
- `tests/maths-renderer/evidence/stage5/webkit-a-tall.png`
- `tests/maths-renderer/evidence/stage5/webkit-b-columns-tall.png`
- `tests/maths-renderer/evidence/stage5/webkit-b-phantom-tall.png`
- `tests/maths-renderer/isolation.test.ts`
- `tests/maths-renderer/presentation.browser.ts`
- `tests/maths-renderer/production-acceptance.mts`
