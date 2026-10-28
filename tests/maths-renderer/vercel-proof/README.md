# Liberation / Vercel trusted-renderer feasibility proof

**Status: demonstrated on an actual protected Vercel Preview, 26 October 2026. Production Info Card integration remains unauthorised.**

The user approved an inert 404-only bootstrap in the separate proof project, followed by the real proof in Preview. The bootstrap remains deployed. The live `switchplay-app-ie` project, existing local servers, renderer implementation, Info Card geometry, editor, autosave, publication/consultation validation and database schemas were not changed.

## Result and evidence

Server-controlled Linux Chromium mounted the **actual unchanged MathsRenderer component**, supplied consumer-owned constraints, and consumed its existing public `onResult` callback. The renderer performed all parsing, typesetting and capacity calculation. Font and DOM inspection are corroborating tests, not another estimator. No client-submitted fit result is trusted.

- Actual Preview: `https://switchplay-maths-renderer-proof-pw2l5uwpz.vercel.app`, deployment `dpl_89GFXKA4tYrXR7VeykuCUX4dxcio`.
- Retained inert Production-classified bootstrap: `dpl_CbrdnyWE4rqepVTi55vg1ATgf3fs`.
- Separate project: `peter-meehan-domokos-projects/switchplay-maths-renderer-proof`, ID `prj_KIkD92Ngbvl0b7IF1QSFU0l1D63o`, Hobby, protected, no custom domains or production application integrations.
- The actual deployment's REST target is `null`, meaning standard **Preview**, with no custom environment. This was verified **before** exercising measurement. Both build and runtime guards reject non-Preview execution.

Primary evidence:

| Evidence | Contents |
| --- | --- |
| [linux-summary.json](evidence/linux-summary.json) | Results, parity, timings, memory and limitations |
| [deployed-results.json](evidence/deployed-results.json) | Every callback result, glyph-font inspection, geometry, histories, resource samples and cleanup |
| [final-deployment-safety.json](evidence/final-deployment-safety.json) | Final Preview target, bootstrap retention, Hobby/protection and live-project read-only inspection |
| [bootstrap-preparation.json](evidence/bootstrap-preparation.json), [bootstrap-deployment.json](evidence/bootstrap-deployment.json) | Two-file static output; no functions/browser/application/database; authenticated 404 checks |
| [preparation.json](evidence/preparation.json) | Exact copied input/font hashes and isolated source directory |
| [local-results.json](evidence/local-results.json) | Production-built local comparison with identical source/font bytes |
| [regressions.json](evidence/regressions.json) | Completed automated checks |
| [change-manifest.json](evidence/change-manifest.json) | Complete proof-file list, sizes and SHA-256 values |

Credentials are excluded from evidence. Authentication is required; the URL is not a public review page or an invitation to use its privileged endpoints.

## Canonical runtime and fonts

| Part | Verified configuration |
| --- | --- |
| Next / React / KaTeX | 16.2.6 / 19.2.4 / 0.19.1, matching the application |
| Node | Vercel Node 24.x; actual Linux execution `v24.21.0`; local build 24.22.1 |
| Browser package | Exactly pinned `@sparticuz/chromium@153.0.0`, Linux x64 |
| Actual browser | `HeadlessChrome/153.0.8010.0`, revision `86cee6df69e0463a839c0cc8435c9d4c259434d3` / main revision 1681091 |
| Driver | Exactly pinned `playwright-core@1.63.0`; actual Linux launch/CDP/scenarios passed |
| Browser profile | 1100 × 900 CSS px, device scale factor 1, en-GB, UTC |
| Prose / serif | Liberation Sans / Liberation Serif 2.1.5, all four faces each |
| Mathematical fonts | Existing KaTeX fonts, unchanged |

The official Sparticuz release notes call the source version `153.0.8010.36`, but the distributed binary embeds and reports `.0`. This discrepancy was investigated rather than allowing any same-major browser. The Linux executable must match **both** `.0` and SHA-256 `53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0`. Its embedded source revision matches the official release revision. The hash was independently calculated by decompressing the separately locked official npm asset locally, then verified on Vercel. An unexpected executable fails closed. No renderer measurement threshold changed.

The exact assets are `LiberationSans-{Regular,Bold,Italic,BoldItalic}.ttf` and `LiberationSerif-{Regular,Bold,Italic,BoldItalic}.ttf`, plus `Liberation-LICENSE.txt`, copied from the previously approved `src/app/dev/maths-fonts/fonts/` assets after verifying `sources.json` hashes. Raw fonts total 3,166,056 bytes. They are unmodified official Liberation 2.1.5 release files under SIL OFL 1.1, with notices retained. [Official release](https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5), [licence](https://raw.githubusercontent.com/liberationfonts/liberation-fonts/2.1.5/LICENSE).

Proof-only CSS self-hosts those exact files at `/fonts/` under `Switchplay Liberation Sans/Serif` aliases. Linux fontconfig restricts system fallback to the approved bundled directory. No Arial, Helvetica, Times New Roman or package-provided Open Sans is configured. No global application typography changed.

Chromium CDP confirmed actual **custom/webfont glyph selection**, including all eight Sans/Serif faces and mathematical euro probes in regular, bold, italic and bold-italic. Selected families across the controlled content were Liberation Sans, Liberation Serif, KaTeX_Main, KaTeX_Math and KaTeX_Size2. No unapproved sampled fallback occurred. This is not a universal Unicode-coverage guarantee: unexpected glyph fonts prevent profile verification.

Approved Balanced settings remain maths 1× prose, display indent 1em, display gaps 0.6em, paragraph gaps 0.8em, local inline clearance 0.25 mathematical em, and `arraystretch = 2.3125`. Consumer prose in this reference profile is 9.5px, line height 1.25. Font readiness/failure remains owned by the renderer.

## Actual Linux geometry and taller constraints

An ordinary reference shell reproduces the inspected 240 × 157px border-box card, 12px padding, 1px border, header metrics/gap and 36px media reservation. It imports no Info Card component/model/business logic. Its font-ready content budgets are **214 × 110.015625px** without media and **214 × 74.015625px** with media, matching local Chromium.

| Unchanged explanation | Linux required width | Required height | Width delta vs Mac Chromium | Reference without media | Reference with media |
| --- | ---: | ---: | ---: | --- | --- |
| 1. Composition and Example | 194.984375 | 76.453125 | +0.015625 | Fits | Vertical overflow |
| 2. Aligned working / result annotation | 138.515625 | 78.812500 | +0.046875 | Fits | Vertical overflow |
| 3. Bold nested-fraction rule | 124.250000 | 95.812500 | +0.031250 | Fits | Vertical overflow |
| 4. Bold negative-fraction rule | 124.250000 | 91.843750 | +0.031250 | Fits | Vertical overflow |
| 5. Subtracting brackets | 102.531250 | 22.765625 | 0 | Fits | Fits |

All five heights match the local production-built Chromium reference exactly. Width differences are at most 3/64 CSS px despite identical custom font bytes; they are platform/browser geometry differences, not evidence of fallback. The proof does not establish precisely which native shaping/rounding step accounts for every difference. Fit/overflow outcomes match for every corresponding ready fixture. No arbitrary fit margin or cross-browser publication rule was added. Existing Firefox/WebKit differences remain compatibility findings under the approved single-canonical-Chromium policy.

The same five explanations were measured against **160px and 320px content-height allocations**, both without media and with 36px reserved (124px and 284px). All five fit these larger budgets. A repeated tall nested-fraction explanation requires **287.4375px**: it exceeds 160px, fits 320px without media, and exceeds the media-reduced 284px. Its source was not shortened.

These are supplied content constraints, not automatic card resizing or new outer-card heights. Future acceptance must bind to the consumer's actual width/height/media/layout inputs and saved revision; a permanent 157px outer-card assumption would be wrong. Actual Info Card dimensions/scaling/animations remain unchanged.

## Scenarios, failures and cleanup

Deployed verification passed **42 representative cases** (36 five-explanation/tall height/media combinations plus six additional cases), **8 lifecycle/failure cases**, four initial/repeated executions and two simultaneous requests: **56 requests with browser orchestration attempted**, including deliberate pre-launch failures. Cases cover inline composition/prose, aligned working with result annotation, separate-equals-column chains, bold rules, nested fractions, currency, a wide equation, invalid LaTeX and an unmatched delimiter. Both explicit and container-derived constraints are exercised.

- Wide mathematics stays intact and reports horizontal overflow.
- Invalid/incomplete source returns `invalid-input`, without `fits`.
- Hidden content, denied fonts and font timeout return `measurement-unavailable`.
- Deliberate execution deadline, host exception and missing binary return failed executions, never a successful fit.
- Superseded content ends in the current invalid result, not the older fit.
- Every owned browser/context/process was closed on success and failure, including launch completion after cancellation.
- Simultaneous requests both succeeded on **different function instances**; the new instance extracted its own binary and cleaned up. Local same-instance contention returns 503 with a retry hint. One active browser per instance is enforced; no pool/queue/service was added.

Vercel attempted to inject its Preview feedback script; the browser allowlist blocked `vercel.live`. The controlled measurement page had no uncaught errors in successful cases. This extra request did not gain privileged access.

## Performance and combined memory

| Actual deployed observation | Result |
| --- | ---: |
| First observed browser execution, client wall time | 6.567s |
| First execution, server orchestration including cleanup | 6.376s |
| First extraction/fontconfig/executable-hash preparation | 4.326s |
| First execution through definitive inspected result | 6.322s |
| Warm ready requests, client wall time | 2.456–3.172s |
| Warm ready requests, server orchestration | 2.337–3.031s |
| Second instance, first browser execution, server time | 5.880s |
| Forced font timeout, client wall time | 12.100s |
| Maximum sampled Node RSS across tested invocations | 324.422MiB |
| Maximum sampled simultaneous Node + descendant process-tree RSS | **528.988MiB** |

First execution followed non-executing authentication guards, which can initialise the API module. Therefore 6.567s is a **cold-browser/extraction and first-host execution observation**, not a guaranteed untouched-function cold-start percentile. Two first-instance browser extractions were observed; this is a small feasibility sample, not a load/tail-latency guarantee. Warm execution still launches a fresh browser and verifies its executable hash; it does not reuse a browser pool.

Memory is sampled every 100ms. Combined RSS is a simultaneous Node-and-descendant sample, not a sum of separate peaks. Shared pages can be counted twice; short peaks, separately scheduled host functions/other instances and Vercel platform overhead are outside its scope. Cgroup usage/limit/peak files were unavailable, so exact whole-container/billed memory is **not measured**. No OOM occurred. The documented Hobby allowance is 2GB/1 vCPU, but RSS samples are not a replacement for platform memory telemetry. [Vercel limits](https://vercel.com/docs/functions/limitations).

The existing creator 15-second timeout was unchanged. Successful observed executions fit inside it, but a cold extraction plus the approximately 10s font deadline could exceed it. A later publication-specific bounded timeout/retry policy is recommended for review; no global timeout increase or publication change was implemented. The proof's internal deadline is 25s, API maximum 60s, and test caller deadline 45s.

## Packaging and deployment findings

The full pinned Sparticuz package includes compressed Chromium, AL2023 libraries, fonts and SwiftShader assets; there is no request-time external binary download. Node 24 on Vercel Linux x64 successfully extracted and executed it. Local decompressed executable size is approximately 209MB. The final Next API trace is **88,379,426 bytes / 263 files** (not a final Vercel function-size report). Vercel accepted and executed the package without a large-function opt-in, paid service or plan change. The inspected deployment API does not expose the final function artifact byte size.

Two real deployment defects were caught and fixed in proof-owned files:

1. The first actual Preview omitted Playwright's dynamically loaded `browsers.json`. The API could not load its module; no Chromium ran. Explicit tracing now includes the entire small pinned `playwright-core` runtime as well as browser/font assets. Local build checks assert the dynamic registry exists in the trace. Historical attempt-1 metadata/runtime error is retained.
2. The next Preview correctly rejected the release-note/binary version discrepancy. The official executable identity was established as described above; actual `.0`, revision and binary hash are recorded. Historical attempt-2 results retain that fail-closed execution and cleanup.

The earlier first-ever proof deployment was automatically classified Production by Vercel despite requesting Preview and was removed before execution. After the user's subsequent explicit approval, the two-file inert bootstrap established the disposable project's Production deployment. It has **no functions, dependencies, browser runtime, host, measurement API, application functionality or database connection**. Authenticated requests to arbitrary paths, `/measure-host` and POST `/api/proof` return 404. Anonymous access reaches Vercel authentication. It remains deployed during/after Preview verification as requested. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Isolation and security boundary

`prepare.mts` makes an ordinary temporary Next app, copying only the unchanged standalone renderer, controlled fixture strings, eight licensed fonts, template and separately locked dependencies. It copies no application env files, live deployment link, database clients/models, Info Card internals or production routes. Root dependency manifests and configuration remain unchanged.

The only custom project secret is a new Preview-only `MATHS_PROOF_KEY`; the proof project also has its own Vercel automation bypass. Secrets remain outside the repository/evidence. The API requires the execution key and accepts fixed scenario IDs only, not arbitrary content/URLs/dimensions/browser instructions. The host additionally requires a distinct HMAC-derived key. Vercel Authentication remains enabled, with no custom domains.

The browser receives a minimal process environment and only the host's derived key plus project-specific bypass on allowlisted same-origin host/static/font requests. It cannot navigate to the execution API, application APIs, external networks or database credentials through the intercepted request path. This is **not an OS firewall**; serverless Chromium uses no OS sandbox. Controlled fixtures are an appropriate feasibility boundary, not proof of security for arbitrary authored input. Production integration still needs its own authentication, abuse/resource limits, origin isolation and failure-policy review.

No paid upgrades/resources, queues, remote browsers, databases or production settings were introduced. Hobby build/function/request/transfer allowances are consumed. No exact per-publication cost or sustained throughput claim is made.

## Tests and reproduction

Fresh checks for this deployment:

| Check | Result |
| --- | --- |
| Renderer/font/historical/new proof unit checks | 31 passed (including 7 current proof-evidence checks) |
| Application unit suite | 420 passed |
| Renderer/font browsers, Chromium / Firefox / WebKit | 117 passed, 6 intentional engine-specific skips |
| Existing Info Card capacity browsers | 5 passed |
| Local production build and controlled scenarios | Passed |
| Actual protected Vercel Preview build and Linux scenarios | Passed |
| Root TypeScript, scoped ESLint, 8 template sources | Passed; no lint warnings |

See the machine-readable regression record for timings and outcomes. Automated geometry/MathML/accessibility checks do **not** constitute physical VoiceOver/NVDA verification; none was performed or claimed. No physical iPhone retest was required for this isolated server proof.

```sh
npm ci --prefix tests/maths-renderer/vercel-proof
PROOF_NODE=<node24> PROOF_LOCAL_EXECUTABLE=<chromium153> node --import tsx tests/maths-renderer/vercel-proof/verify.mts
node --import tsx --test tests/maths-renderer/vercel-proof/*.test.ts
```

`bootstrap.mts` only prepares static output. `deploy-preview.mts` requires the retained bootstrap and verifies Preview before measurement. `verify-deployed.mts` requires private proof-project credentials and checks only the approved deployment. It is an operator proof script, not a public API or automatic production deployment workflow. Re-deployment requires authorisation; these reproduction commands do not grant it.

## Recommendation and stopping point

**The architecture is technically feasible in the actual Vercel environment for the tested canonical profile.** A dedicated measurement service is not required by this evidence. Recommend a separately reviewed integration plan: keep the existing source textarea/autosave; supply actual consumer constraints to this renderer; perform trusted measurement outside publication transactions; recheck the saved revision; store minimal immutable acceptance/profile/layout metadata; ensure consultation consumes that acceptance without rerunning the incompatible old estimator. Legacy content activation and caller timeout/retry policy still need explicit decisions.

Do not copy this fixed-fixture API directly into production or treat feasibility as production security/load acceptance. Next milestone should define those narrow integration contracts and tests before coding. **No production Info Card integration, publication validation change, migration, content-format activation, automatic resizing or new consumer work has begun.**

Raw `*.log` execution/deployment transcripts in the evidence directory are local-only and intentionally ignored. Local copies are retained; the documented verification commands generate fresh logs. Committed JSON summaries, proof-test inputs, scripts and reference screenshots remain available. Historical change manifests describe their original verification runs, including local artifacts; they are not the current Git staging inventory.
