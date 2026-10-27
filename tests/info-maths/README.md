# Maths Renderer integration into Info Cards

Implemented under the user's production-integration authorisation. This is a source implementation and local verification record, **not a deployment**. The disposable Vercel proof project and existing application deployment settings were not changed.

## Behaviour and boundaries

- Reuses `InfoCardFace` in the existing editor, Library and learner physical stack. The standalone renderer implementation, parser, measurement contract and styling defaults are unchanged.
- New cards receive optional `bodyFormat: "latex-v1"` on their first edit. Untouched new editors do not create a draft. Missing format means legacy literal text, including dollar signs and backslashes. Existing unmarked drafts/publications remain literal when edited or republished; there is no automatic conversion, activation control or migration.
- Source remains in the existing textarea. Existing 250ms serial autosave, revision checks and recovery journal remain. Browser preview updates directly; only the existing renderer performs mathematical measurement. Header/series/media changes remount the renderer to invalidate consumer collision results even when the mathematical source is unchanged.
- Uniform face height changes from 157px to **204px**, including legacy faces. Width240px, padding12px, border1px, logical body width214px and existing navigation/scaling/animation implementation remain unchanged. There are no height profiles or automatic resizing. Reference development boxes mirror the new height; their five source strings are unchanged.
- Maths cards alone use the approved, self-hosted Liberation Sans/Serif font profile. Legacy cards keep Arial/Helvetica. Balanced scale1, indentation1em, display gap0.6em, paragraph gap0.8em, inline clearance0.25em and `arraystretch = 2.3125` remain unchanged.
- `infoCardMaths.ts` compares the renderer's public bounds with existing card, header/control and media boundaries. It does not measure mathematical descendants or estimate content. Normal wrapping width and padding never change. Content may use existing spare bottom padding (or the existing gap before media), but cannot reach the border, header controls or media. The existing corner radius constrains horizontal borrowing. No fit tolerance or extra margin was added; the renderer's own `fits` and overflow flags remain intact.
- Mathematical explanations remain rendered and visible in the editor, Library and consultation for fits, overflow, pending, invalid and unavailable measurements, including failed header checks. Editor measurement diagnostics remain active. No scrolling, shrinking, resizing or replacement warning is introduced. Learner views never launch Chromium.

## Publication and optional Chromium diagnostics — current behaviour

Normal publication is a saved-revision database operation. The endpoint accepts only `revision`; it does not import the trusted browser runner, accept a client fit result, launch Chromium or wait for rendered geometry. The repository reuses the existing renderer's **pure** `prepareContent` function to validate mathematical syntax and existing KaTeX safety protections. It retains source/permissions/media validation, transaction revision checks, immutable publications and receipt recovery. Valid mathematics may publish despite overflow. The legacy plain-text estimator remains unchanged.

New mathematical publications need no `mathsValidation` certificate. Historical certificate metadata remains readable but is not required by catalogue or consultation. Structural checks and media/identity authorisation remain in place. Learner reads never launch Chromium, and mathematical explanations remain visible regardless of measurement status or overflow.

**Check rendering** appears beside the existing maths preview. The editor uses its existing flush/creation path, then posts only the acknowledged revision to the owner-authenticated `/api/info-cards/[infoCardId]/check-rendering` endpoint. The repository loads authoritative saved content (or the latest published content when the editor is clean), verifies ownership/revision before launching, and rechecks both revision and series title afterward. It makes no database writes. Edits clear the displayed result; a generation/revision guard discards results for older edits. Diagnostic errors are separate from publication/save recovery and do not block publication.

The same existing controlled Chromium runner mounts the real `InfoCardFace` on its authenticated internal host and consumes the standalone renderer's public callback. Actual glyph-font verification and the latest definitive result are retained. The diagnostic returns dimensions, independent overflow flags, diagnostics and an in-memory PNG. The image includes the actual 240×204px card and visible overflowing explanation; it is not resized or clipped to force a fit. Screenshot framing consumes renderer bounds and does not decide capacity. Chromium capture can invalidate layout, so the runner reads the latest definitive public callback after capture as well. No image is written to storage by the application.

Screenshot capture is bounded to8192px on either axis and8million pixels, with a2.8million-character base64 limit. Exceeding a limit returns the measurement and a screenshot error instead of a shortened image. These are diagnostic resource limits, not content/publication limits. Unavailable/invalid measurements never claim a fit; original content can still be inspected in the image when capture succeeds.

The runner retains pinned `@sparticuz/chromium@153.0.0` / `playwright-core@1.63.0`, the previously verified Linux Chromium153.0.8010.0 binary/hash/font profile, minimal child environment, exact-origin request allowlist, disabled downloads/service workers, short-lived internal host authentication, Vercel server-only bypass headers and `finally` cleanup. One browser is allowed per function instance; contention returns a recoverable error without a queue. Serverless instances can execute separately; this is not a deployment-wide concurrency quota.

The execution deadline remains25s, diagnostic creator transport timeout45s and diagnostic function maximum60s. Publication returns to the ordinary15s creator transport timeout. Next's browser/font tracing now applies only to `check-rendering`. The local production build verifies that the publication function's dependency trace contains neither Chromium's binary nor Playwright. Proof infrastructure and dependencies are retained unchanged in purpose; `trustedInfoMaths` remains a compatibility entry point for historical proof tools, not publication.

### Local verification of on-demand diagnostics and publication performance

No deployment, Vercel setting change, live record change, commit or push was performed for this change. Existing development servers were retained. An isolated production snapshot built under Node24, used its own loopback server and no live database, and passed tracing/protected-host/font/cleanup checks. Historical deployment verification below predates this architecture change; it is not evidence of the updated endpoint running on Vercel.

Three real-editor publications before and after the change used the same disposable local database/browser harness. Warm publication API time decreased from **1009–1131ms** to **62–80ms**. Before-change first-request dev compilation took3838ms and is excluded from the warm comparison. After-change click/action-start to visible success was **354–541ms**, compared with warm baseline1251–1366ms. These are local development timings, not a deployed latency guarantee.

After-change draft PATCH requests took **48–75ms**. Click/action-start through flush and publication-request initiation took167–332ms; this includes existing actor verification and Playwright action scheduling, not only database save time. The baseline instrumented that combined interval (125–236ms), but did not separately record draft PATCH duration; no separate before-save time is claimed. The repository benchmark measured full Mongo transaction/commit time: before26–28ms, after28–31ms. Total maths repository publication decreased from870–965ms to31–44ms; current plain-text publication was31–33ms. The recorded9.487s protected Preview publication is the earlier deployed baseline only; updated remote timings require a separately authorised deployment.

Verification passed: **448 unit/isolation tests**, **61 Info Card integration tests**, **12 focused Info Card browser/performance checks** (including the corrected nonblocking-overflow authoring expectation), and **87 standalone renderer browser tests** across Chromium, Firefox and WebKit. Full-project TypeScript, scoped ESLint and `git diff --check` passed. The isolated production build and real Chromium screenshot/protection/font/cleanup checks passed. An initial screenshot attempt was rejected after capture advanced the renderer lifecycle generation; reading the latest definitive public callback after capture fixed it without changing the renderer. The prior authoring test expected overflow publication rejection; it now checks successful publication with the existing advisory warning and source preserved. Automated accessibility coverage does not claim physical VoiceOver/NVDA testing.

Execution evidence is local-only: `/tmp/switchplay-maths-publication-baseline.json`, `/tmp/switchplay-maths-publication-after.json`, `/tmp/switchplay-maths-on-demand-*.log` and `/tmp/switchplay-maths-on-demand-production/production.json`. Reproduce current timings with `node --import tsx scripts/test-phase2.ts --info-cards info-maths-performance.browser.ts`; it uses only disposable local records. The before-change JSON was captured before removing the browser call; the current script measures the new implementation only.

Production-built example diagnostic: nested fractions measured **124.21875×95.8125px** in214×157.016px available, no overflow; PNG240×204px. Deliberately wide/tall input measured **390.5×451.28125px**, overflow on both axes; PNG404×486px showing overflow. Both screenshots are in the temporary production evidence directory. All five approved source fixtures also retained their previous measurements with and without media.

## Protected Preview authentication

The real application's protected Preview requires **Protection Bypass for Automation** on the `switchplay-app-ie` Vercel project. Vercel supplies `VERCEL_AUTOMATION_BYPASS_SECRET` to a **new build** after configuration; a previously built Preview must be redeployed. Do not disable Deployment Protection. Configuring the project or deploying requires separate user approval. Project bypass tokens are project-wide capabilities, not Preview-only tokens.

The trusted runner adds `x-vercel-protection-bypass` only on its server-controlled, exact-origin internal-host and Next-static requests. It fetches with redirects disabled and aborts authentication redirects/401/403 responses, so credentials cannot follow the SSO redirect. No bypass URL parameter, cookie or client environment variable is used. The existing short-lived host token remains independently required. Missing Preview configuration, invalid credentials and startup failures fail closed, with controlled failure categories; browser exception text and credentials are not logged or returned. Draft/receipt recovery is unchanged.

`production.mts` exercises the real production-built host through a local simulated protection gate, including missing/invalid bypass, independently forged host authentication, real renderer results and resource cleanup. Set `INFO_MATHS_PRODUCTION_OUTPUT` to a temporary directory to avoid replacing historical evidence. **This local gate is not Vercel verification.** The previous deployed runner was verified below. The new diagnostic endpoint has only local production-build verification until a further deployment is authorised.

### Integration bug-fix verification — 26 October 2026

- Application/renderer unit and isolation tests: **445 passed**.
- Info Card repository/API/attachment/release integration tests: **57 passed**, including exact revision checks and immutable publication/receipt recovery.
- Focused editor/publication/Library/consultation browser regressions: **10 passed**. Chromium, Firefox and mobile WebKit cover visible fits, horizontal/vertical overflow, pending fonts, unavailable measurement and header overflow; real mobile WebKit consultation preserves overflowing content. Failed-font output and invalid-source fallback stay visible. Learner reads do not request the trusted host.
- Existing renderer alignment/presentation/capacity/acceptance browser regressions: **87 passed** across Chromium, Firefox and WebKit.
- Full-project TypeScript, scoped ESLint and `git diff --check`: passed.
- Isolated production build/tracing and real Chromium protected-host proof: passed. All five unchanged explanations with/without media yielded ready, safe results; wide and invalid inputs remain unsuccessful publication candidates. Missing/invalid bypass and forged internal host authentication fail closed, redirects are not followed, cleanup/contention recovery passes. The runner consumes a definitive callback value atomically and retains its stale-result guard.

Raw verification output is local-only in `/tmp/switchplay-maths-fixes-*.log`; production results are in `/tmp/switchplay-maths-fixes-production/production.json`. New browser screenshots go to Playwright's test-output directory instead of overwriting historical references. These temporary locations are execution evidence, not required runtime assets. That local verification run changed no live database records, existing servers, Vercel settings or deployments. The subsequently authorised live Preview verification is recorded below.

### Protected application Preview verification — 27 October 2026

The user explicitly authorised configuring Vercel's generated automation bypass on `switchplay-app-ie`, creating a protected **Preview only**, and using a short-lived Daniel verification session with labelled private test records. No Production deployment, commit, push or paid service was introduced.

- Deployment `dpl_2hXzMsEfzDbAmUivWniqkJ9f7gSU`: [protected Preview](https://switchplay-app-nqzf0i4ep-peter-meehan-domokos-projects.vercel.app). Vercel target is Preview; all six changed production source files were retrieved and compared with the intended snapshot. This documentation update follows deployment.
- A new `latex-v1` Info Card autosaved the unchanged nested-fraction explanation through the existing textarea, published successfully (HTTP200, observed9.487s), retained trusted acceptance/sourceRevision1, and returned the same version on receipt retry. It rendered in real Library and learner consultation.
- Six actual-deployment consultation checks passed: Chromium normal; mobile WebKit normal, horizontal/vertical overflow, pending fonts, failed fonts, and Daniel's original `Quad`. Overflow used a browser-local oversized QA snapshot; font failures/delays were browser-local simulations. Stored publication content stayed unchanged. No content replacement, opacity masking or inert wrapper remained. Logical face240×204px, body214px and padding12px were confirmed in every case.
- Request logs show the real internal host returned200 to Linux HeadlessChrome153.0.8010.0. Exactly one canonical-browser host request accompanied publication; receipt retry and learner reads did not launch additional measurements in the observed log window.
- Unauthenticated visitors still receive302; bypass alone and forged internal-host authentication still receive404 at the measurement host. The Production deployment and visitor protection configuration remain unchanged. Inspected client responses contained no bypass credential.
- One labelled private maths Info Card plus its private carrier Card/Deck remain as verification records. Existing `Quad` source was checked unchanged. The carrier is accessed through My Decks because Library Deck browsing is public-only. No existing card content or password was changed.

Local-only evidence: `/tmp/switchplay-maths-fix-live-evidence/` contains workflow/results, redacted request summaries and screenshots. Automated mobile WebKit is not a claim of physical iPhone Safari testing. Temporary operator credential files were removed after verification; Vercel's server-side bypass remains configured; the current source uses it only for explicit diagnostics.

## Fonts

Eight unmodified Liberation2.1.5 TTFs and `Liberation-LICENSE.txt` were copied into `src/components/info-cards/fonts/` after checking against `src/app/dev/maths-fonts/fonts/sources.json`. Source: official [Liberation2.1.5 release](https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5); SIL OFL1.1 and copyright notices are retained. No proprietary font was copied. CSS font faces are local to the consumer module; the serif fallback selector is scoped to maths faces. Next emits browser font assets, and diagnostic-function tracing includes the raw files for restricted Linux fontconfig. KaTeX fonts remain unchanged.

The production test rejects non-custom or unapproved actual glyph fonts via Chromium CDP. Currency verifies Liberation Serif fallback, not merely a declared CSS family. Mathematical euro warnings remain the renderer's existing diagnostics, not silent repairs.

## Verification

`evidence/verification.json` records commands, results, resolved initial failures and omissions. `evidence/production.json` contains actual public renderer results, with source examples indexed0–4. `production.mts` builds an ordinary temporary application snapshot, starts its own loopback production server, checks diagnostic function tracing, absence of the browser runtime from publication tracing, and protected host access, and runs the real trusted runner. It uses no live database or repository environment secrets and cleans up its server/snapshot.

All five examples fit at204px with and without media. Production Chromium reported approximately157.016px available explanation height without media and121.016px with media, at214px width. Occupied heights remain76.453125,78.8125,95.8125,91.84375 and22.765625px respectively. The first source's occupied width is194.96875px; none overflows horizontally. A deliberately wide rule reports overflow and is unsafe. Currency is ready; malformed source is invalid. Forged host authentication fails, a subsequent request succeeds, and same-instance concurrent execution fails closed without affecting the successful request.

Browser coverage exercises all five exact strings, media, physical safety boundaries, padding borrowing, legacy literal text, live editing, source-validated publication without Chromium, Library, actual learner consultation and mixed legacy/maths stack navigation. Existing regression checks exercise media authorisation, immutable receipts, concurrent revisions, navigation/animations, mobile geometry and legacy publication availability. Automated MathML/ARIA checks are not physical VoiceOver/NVDA testing; none is claimed.

## Remaining limits

- Canonical Chromium supplies optional rendering diagnostics, not publication acceptance. Other browsers can have different line metrics near the physical boundary; there is no guarantee of identical line breaks for every authored string. Fixed logical width, exact approved fonts and whole-card scaling minimise differences. The consumer retains actual renderer measurements; explanations remain visible even for overflow or unavailable measurements. Publication does not require a browser capacity certificate.
- Earlier Linux Vercel proof performance/memory numbers are feasibility evidence, not guarantees for the integrated application. The prior integration was exercised on the protected Preview, but these new diagnostic/publication changes have not been deployed. Updated remote latency/load measurements remain unverified. No server pool or measurement cache is introduced.
- The legacy estimator remains conservative at its previous157px reference. Legacy content is protected; this milestone does not expand legacy plain-text publication capacity or add a conversion workflow.
- The existing dependency audit flags security advisories in the unchanged Next16.2.6/framework dependency tree. No advisory was introduced by the pinned Chromium/driver additions. Existing framework remediation needs separate deployment/security review; this work performs no deployment or unrelated dependency upgrade. See [Next's image-optimisation advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- The only new ordinary visual decision is the already authorised uniform204px height. `evidence/library-maths.png` and `evidence/consultation-maths.png` show actual integrated contexts; `maths-204.png` shows the shared face with media. No further product choice blocks the implementation.

## Complete changed-file manifest

See `evidence/changed-files.json` for every changed/new file and content hash relative to this task's preflight, including evidence and this documentation. It excludes pre-existing unrelated working changes. Existing changes to `tests/maths-renderer/explanation-review.browser.ts` were preserved; this task additionally makes its readiness assertion atomic. Neither proof project nor standalone renderer implementation was modified.

Raw `*.log` execution/deployment transcripts in the evidence directory are local-only and intentionally ignored. Local copies are retained; the documented verification commands generate fresh logs. Committed JSON summaries, proof-test inputs, scripts and reference screenshots remain available. Historical change manifests describe their original verification runs, including local artifacts; they are not the current Git staging inventory.

## On-demand diagnostic change manifest (27 October 2026)

Existing files changed in this milestone:

- `next.config.ts`
- `src/app/api/info-cards/[infoCardId]/publish/route.ts`
- `src/components/creator/creatorRequest.ts`
- `src/components/info-cards/InfoCardEditor.module.css`
- `src/components/info-cards/InfoCardEditor.tsx`
- `src/components/info-cards/infoCardEditorController.ts`
- `src/components/info-cards/infoCardErrors.ts`
- `src/lib/infoCards/mathsValidation.ts`
- `src/lib/infoCards/model.ts`
- `src/lib/infoCards/queries.ts`
- `src/lib/infoCards/repository.ts`
- `src/lib/infoCards/trustedMaths.ts`
- `tests/info-card-editor.test.ts`
- `tests/info-cards-api.integration.ts`
- `tests/info-cards.integration.ts`
- `tests/info-maths/README.md`
- `tests/info-maths/production.mts`
- `tests/phase2/info-cards-authoring.browser.ts`
- `tests/phase2/info-maths.browser.ts`

New files:

- `src/app/api/info-cards/[infoCardId]/check-rendering/route.ts`
- `tests/phase2/info-maths-performance.browser.ts`

This list excludes uncommitted changes already present before this milestone, including the prior visibility fix in `InfoCardFace.tsx`, HTTP failure classification and its tests. Standalone renderer files, card geometry/typography, font assets, dependency versions, proof projects and database schemas were not changed.
