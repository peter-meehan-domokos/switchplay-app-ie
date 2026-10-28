# Trusted publication measurement — isolated feasibility proof

**26 October 2026. Verdict: partially demonstrated.** Server-controlled execution of the actual renderer is demonstrated in a local production Next.js build. Execution in Vercel's deployed Linux function, and a reproducible licensed font profile there, are **not demonstrated**. This is not production publication validation or permission to integrate Info Cards.

## What ran

`run.mts` creates an ordinary temporary snapshot of the current application and installed dependencies, without repository environment files. It adds two test pages and a Node Route Handler **only inside that snapshot**, builds with the installed Next.js 16.2.6/Turbopack, and starts its own random loopback port. Nothing is added to `src/app` in the repository.

The server-controlled handler accepts only two fixed proof actions with an ephemeral secret. It loads fixed fixture sources itself; it accepts no submitted fit result, source, navigation URL, browser options or evaluation instructions. Its Chromium mounts `Host.tsx`, which imports the unchanged public `MathsRenderer` component and records `onResult` notifications. Source and presentation are supplied as React props. No private measurement helper is called, copied or replaced.

`Reference.tsx` is a separate test-only reference using the actual `InfoCardFace` presentation component and actual application styles. Its measured content-box budgets are passed into the generic host. The host and renderer have no Info Card business dependencies.

Every measurement gets an isolated browser context. Normal representative jobs reuse a browser, then close their contexts; three additional samples start fresh browser processes. The proof-only `launchServer`/loopback connection exposes an owned PID for RSS/cleanup evidence. A deployed implementation should normally use `chromium.launch()` and its pipe transport, without a publicly accessible browser websocket.

Reproduction, for engineering use:

```sh
node --import tsx tests/maths-renderer/trusted-proof/run.mts
node --import tsx --test tests/maths-renderer/trusted-proof/verify-results.test.ts
node --import tsx tests/maths-renderer/trusted-proof/inspect-packaging.mts
node --import tsx tests/maths-renderer/trusted-proof/compare-review.mts
```

The first command uses the existing installed Mac browsers and a macOS Arial file fingerprint; it is intentionally a local-profile proof, not a portable Linux runner. Package inspection downloads checksum-verified upstream archives into a temporary directory, never installs or executes them. The last command reads the existing port-4181 review server without managing it. All proof servers, browser processes and temporary snapshots are removed afterwards.

## Canonical environment and actual fonts

| Property | Verified local proof |
| --- | --- |
| Browser | Chrome Headless Shell **145.0.7632.6**, Playwright revision **1208**, `playwright-core` **1.58.1** |
| Runtime | macOS x64, Node **22.14.0**; exact OS release is in `results.json` |
| Viewport | 1100 × 900 CSS px, device scale factor 1, en-GB, UTC, reduced motion |
| Application | Next **16.2.6**, React **19.2.4**, KaTeX **0.19.1**, unchanged renderer sources |
| Presentation | 9.5px Arial/Helvetica/sans-serif, weight 400, line height 1.25; Balanced: maths 1×, indentation 1em, display gap .6em, paragraph gap .8em; inline clearance .25 mathematical em per side; existing arraystretch **2.3125** |

The executable path, renderer/CSS hashes and local Arial file hash are recorded in `results.json`. CDP `CSS.getPlatformFontsForNode` checks actual glyph-bearing elements rather than trusting declared family names. Prose/header use **ArialMT** and **Arial-BoldMT**. Mathematical regular, italic, bold and bold-italic examples use the corresponding downloaded **KaTeX** faces; the right-hand operation annotation uses **KaTeX_Main-Italic**. Local font readiness, MathML and visual HTML accessibility hiding are preserved.

**Important fallback finding:** prose € and £ use Arial. Mathematical `\text{€}` uses **TimesNewRomanPSMT** on this Mac and returns the existing `unknownSymbol` and `symbolNotInFont` warnings. It is a ready result with warnings, not silently repaired or rejected. This is existing renderer behaviour. The Linux profile must account for fallback fonts too; bundling only Arial and KaTeX does not establish identical glyph coverage.

The upstream serverless package includes Open Sans, not Arial. No substitute font was selected, no system font was copied into the repository, and server-installation/redistribution rights for the Mac fonts have not been established. Preferred next investigation: provision appropriately licensed Arial and necessary fallback faces, pin their files, verify actual Linux glyph fonts, and compare geometry. Even identical files can differ across OS text engines. [Microsoft's Arial information](https://learn.microsoft.com/en-us/typography/font-list/arial#licensing-and-redistribution-info) points to server/redistribution licensing. [Liberation Fonts](https://github.com/liberationfonts/liberation-fonts) is an alternative aiming at Arial/Times metric compatibility, **not proof of identical metrics or an approved substitution**. A substitute validation profile would need an explicit decision and evidence; production typography remains unchanged.

## Real geometry and representative results

Source: `src/components/info-cards/InfoCardFace.module.css`, `InfoCardFace.tsx`, and the actual reference rendered under application global styles. The outer frame is **240 × 157px border-box**, with **12px padding** and **1px border**. Body width is **214px**. The real header is **11.984375px** high plus its **9px** gap. Available body height is **110.015625px** without media and **74.015625px** with media: media reserves **32px + 4px margin**. These are measured local-profile dimensions, not the old estimator's nominal 109.875/73.875px budgets.

All five explanation strings are read unchanged from the current `ExplanationReviewFixtures.tsx`. In particular, explanation 1 currently contains one inline composition/meaning expression, `Example`, and two displays. The proof does not revert it to an earlier conversation revision.

| Explanation | Occupied height | No media | Media |
| --- | ---: | --- | --- |
| 1. Function composition | 76.453125px | Fits | Vertical overflow |
| 2. Multiplying all terms, aligned result annotation | 78.8125px | Fits | Vertical overflow |
| 3. Bold nested-fraction general rule/special case | 95.8125px | Fits | Vertical overflow |
| 4. Bold negative-fraction general rule/special case | 91.84375px | Fits | Vertical overflow |
| 5. Subtracting brackets | 22.765625px | Fits | Fits |

None has horizontal overflow in the canonical local profile. The additional inline-composition example occupies 17.140625px; a three-row chain occupies 108.03125px and overflows the media budget. A deliberately wide expression occupies **509.75px** and reports horizontal overflow. The **98,000-character** prose case occupies **24,937.5px** in height and reports vertical overflow. Invalid LaTeX, an unmatched opener, an unsafe resource command and recursive macro expansion all produce `invalid-input`, with no fit field. Currency prose and mathematical currency forms render; the mathematical euro warnings are retained.

Both constraint modes were exercised. Their measured bounds and fit agree; computed-style height serialisation differs by 0.000375px. That comparison is not a capacity allowance. Tests place width and height budgets **0.02px below/above** known occupied extents and verify the unchanged strict overflow contract. Natural content and overflowing descendants are measured by the renderer; independent DOM readings corroborate bounds. No shrinking, scrolling, clipping, rewriting, mathematical wrapping or threshold change is introduced.

`compare-review.mts` compares the current five examples across all three engines. Development Chromium and production-host Chromium heights differ by less than **0.0002px** after whole-card scale conversion. Firefox heights differ by approximately **+0.10 to +2.35px** and examples 2–4 report about **0.053px top excess**; WebKit heights differ by approximately **−0.39 to −2.05px** and all five fit. These remain compatibility findings. Only the approved canonical Chromium profile governs a future publication; no all-browser gate or new safety margin is proposed.

## Timing, resources and failures

Final local measurements, including fresh context/navigation/hydration, renderer font/layout readiness and evidence collection:

- Browser startup: **0.19–0.26s** in three fresh-process samples; through-result time **0.65–0.74s**. The Node server and OS caches were already warm. These are **not Vercel cold starts**, and do not include a database/publication transaction or Internet request.
- Ten five-example/media jobs in a reused browser: **0.37–0.66s** each. The large prose cases took **1.85–2.02s**. Two simultaneous isolated contexts completed in about **0.50s**.
- Browser-tree RSS maximum observed at 500ms intervals: **246.79MiB**. Temporary Next Node process maximum observed: **251.21MiB**. These are sampled local RSS, not guaranteed peaks, Vercel billed memory or Linux cgroup measurements. Fresh browser samples after a job were approximately **105MiB**.
- Denied mathematical fonts and a missing declared prose font return `measurement-unavailable / FONT_LOAD_FAILED`. Held font requests return **FONT_TIMEOUT** in about **10.36s**. The artificial job deadline and injected host exception yield failed executions with **no result**, rather than fabricated renderer fits. Hidden and rotated hosts are unavailable; positive scale/translation remain measurable.
- Replacing pending source with invalid source cannot yield a stale fit. Multiple contexts remain independent. Missing executable startup fails explicitly. Contexts close after each normal/failure case; final browser process exits and the owned server/snapshot are removed. Existing port-3000 and port-4181 servers remain running with their original PIDs.

Proof-harness defects found and fixed: TypeScript inference around asynchronous result capture; over-exact equality of computed-style and explicit budget serialisation; reading a callback in a separate operation after a readiness wait; and a comparison-page initial-null readiness check. No renderer or application behaviour was changed to resolve them.

The existing creator transport timeout is **15s** (`creatorRequest.ts`), unchanged. Local ordinary cases fit well inside it, but deployed package extraction, function startup, asset access, fonts, database work and network latency remain unmeasured. Do not declare the timeout production-safe from these samples. Measure deployed tails first; if needed, propose a **publication-specific** deadline/retry policy. Never globally increase creator timeouts or accept an incomplete measurement.

## Vercel feasibility and packaging

**Confirmed repository configuration:** `vercel.json` uses the normal Next.js/npm-ci build. There is no production browser dependency, font pack, browser trace inclusion, Node engine pin or measurement endpoint. The temporary proof builds and runs with current Next.js without changing that configuration. Its Node route trace has **434 files / about 9.03MB**, excluding the locally cached browser. This trace is **not a complete Vercel function artifact**.

`inspect-packaging.mts` verified the npm archive integrity of **@sparticuz/chromium 153.0.0**. It is **69,995,309 downloaded bytes / 70,091,665 unpacked package bytes**, including compressed assets. Its Chromium decompresses to **209,022,176 bytes**, an **ELF x86-64 Linux binary**. The package supplies AL2023 NSS/NSPR/expat libraries, SwiftShader and three Open Sans faces. Local Mac Brotli decompression of Chromium took about **1.31s**; this is not Linux extraction/startup timing. Its Node requirement is **^22.17.0 or >=24**; local Node 22.14.0 does not meet that package's requirement.

There is **no package release for Chromium 145**. The inspected **playwright-core 1.63.0** maps to Chromium **153.0.8010.12**, making it a sensible major-matched Linux-test candidate with package 153.0.0. Matching majors is **not verified binary/driver compatibility**; the serverless binary's precise runtime version and behaviour must be measured. Neither package was installed or used to claim deployed success. [Playwright documents its compatibility limits for alternate executables](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).

[Vercel documents](https://vercel.com/docs/functions/limitations) a standard **250MB uncompressed function bundle**, 2GB standard memory, and Fluid duration limits much larger than the current client timeout. A 5GB large-function beta exists, but no opt-in or hosting change is currently justified. The inspected compressed-assets package is not obviously too large for the standard path; only a complete traced deployment can establish that. [Vercel's browser guide](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel) confirms the serverless-Chromium approach as a supported integration pattern, not this application's compatibility. Prefer testing the full pinned package first to avoid runtime remote-binary downloads if it fits the complete artifact. Narrow Next output tracing for binary/library/font assets will need verification. [Sparticuz's documentation](https://github.com/Sparticuz/chromium) covers runtime/font provisioning.

Recommend testing a Node 24 Linux profile, with exact browser/driver/package/font assets pinned and runtime versions recorded. Vercel exposes Node major selection and updates patches itself; OS/runtime immutability must not be assumed. The repository does not establish the account plan, configured runtime, Fluid settings or effective function limits. The documented Vercel **build** image is AL2023; build-image libraries alone do not prove the deployed **function** has them.

**Not tested:** Linux launch/shared-library resolution, deployed font parity, Vercel artifact tracing, filesystem/extraction constraints, self-host asset access, actual cold/warm latency, memory/concurrency limits, descriptor usage and financial cost. No Docker/Vercel CLI execution environment or deployment credentials were used. No deployment was attempted. A later deployment test needs approval: a separate disposable preview with dummy/no database credentials, fixed protected host and cases, bounded resource usage, no existing project/domain changes, and teardown. Font provisioning must be resolved first. The local loopback `next start` topology does not exist automatically inside a Vercel function: a deployed browser would need a protected, fixed host on the exact immutable deployment (including preview protection handling), or a separately verified packaged host. Neither is implemented.

## Security boundaries and remaining work

The proof server receives no production credentials; it uses an unreachable dummy database and no repository env files. Browser children receive a restricted environment, fresh storage, blocked service workers/downloads, fixed local navigation and an allowlist for host/static requests. Analytics and all other requests are denied. Existing KaTeX `trust: false`, per-expression macros and expansion protection are unchanged. No author HTML/JavaScript is executed.

Request interception is **not an OS firewall** or proof of protection after a browser compromise. Playwright's Chromium sandbox defaults to disabled; deployed isolation, inherited filesystem access, actual egress and resource exhaustion need review in the real runtime. The proof is not a security-hardened public browser-automation endpoint. Existing 100,000-character storage protection, bounded job deadlines and bounded per-instance concurrency should remain separate from mathematical fit decisions. The large/recursive tests demonstrate specific cases, not a complete adversarial performance bound.

The public component API is sufficient for this execution proof. Renderer generations are instance-local, so production orchestration still needs to bind the current callback to its own exact saved revision/configuration and fail closed on browser/host exceptions. That orchestration must not duplicate measurement. The callback consumer takes a current terminal snapshot atomically and rechecks it after inspection, rather than accidentally accepting a stale intermediate state.

## Proposed publication architecture — not implemented

1. Authorise the request and load the exact saved draft revision. An existing immutable receipt for that revision returns idempotently. Resolve source, title/header inputs, media reservation and the pinned presentation/profile.
2. Outside the database transaction, use a server-controlled browser to mount the same renderer under those actual constraints. Accept only the current **ready + fits** result. Invalid/pending/unavailable/error/timeout keeps the draft and prevents publication.
3. Start the existing short transaction, recheck receipt, ownership, draft revision and all capacity-relevant layout inputs (including any separately loaded series/header inputs). Reject stale work; do not silently publish a newer draft using an older result.
4. Atomically insert the immutable publication and trusted acceptance metadata, then advance the root as the current implementation does. Existing `sourceRevision`, immutable content, publication time and unique receipt already provide much of the binding/idempotency machinery (`repository.ts:141–169`).
5. Minimal additional metadata would identify the **measurement profile** and effective width/height, unless constraints are completely determined by that versioned profile/content. The existence of this server-written acceptance records success. Measured bounds are useful diagnostic evidence, but storing every callback, signatures, client evidence, duplicate source hashes or a provenance/caching system is unnecessary for integrity. No schema change is made in this proof.
6. Consultation and Library reads for newly accepted mathematical publications must consume this same acceptance, retain structural/access checks and **not re-run the old body estimator**. Current `queries.ts:59–79` does revalidate old capacity; changing it requires the separately approved integration. Legacy plain-text publications must remain on their existing interpretation and must not be retrospectively rejected or reinterpreted. Activation/legacy selection is not settled by this proof.
7. Renderer/font/layout changes need an explicit compatibility policy: retain the accepted profile or deliberately revalidate under an approved migration. Do not make an accepted publication disappear merely because a later estimator/profile disagrees. Preserve idempotent retries after a lost response and preserve drafts after unavailable measurement.

Recommended next sequence: resolve fonts and approve a disposable deployed feasibility test; verify the exact Linux browser/driver/profile and deployment limits; only then design/authorise view/preview measurement wiring and atomic publication acceptance together with consultation/Library consistency and legacy protection. Keep the textarea, source and autosave unchanged. Immediate editor feedback and final trusted measurement use the same component but remain different trust levels. No integration or format activation has begun.

Complexity is **moderate**, dominated by font licensing/provisioning, reproducible packaging, protected host delivery and failure/concurrency handling. No dedicated service or queue is needed on present evidence. Operating overhead is browser CPU/memory per validation, binary/font storage and coordinated profile updates; actual price per publication and production concurrency cannot be estimated responsibly from Mac RSS and three local launches. Begin conservatively with bounded in-instance browser work, not an elaborate pool.

## Tests, evidence and limits

- Actual production Next build + server-driven proof: passed; 28 representative/media measurements, both constraint modes, strict boundaries, font/missing-binary/deadline/exception cases, stale replacement, transforms, concurrency and cleanup.
- Fresh proof evidence acceptance: **5/5 passed**.
- Existing renderer unit/isolation: **17/17 passed**.
- Existing renderer core browsers: **105/105 passed**, 35 each Chromium/Firefox/WebKit, including exact alignment A/B geometry and **2.3125** row spacing. No test weakening or renderer change.
- Five current review examples: compared in **all three engines**; canonical Chromium matches production-host geometry. The older `explanation-review.browser.ts` reference test still expects an earlier explanation-1 fixture and its separate port-4193 reference server; it was not modified or claimed as passing. The new comparison covers current sources directly.
- Existing application units: **420/420 passed**. Existing Info Card integration/API/release tests: **38/38 passed** on their disposable replica sets. No production database was accessed. Additional full authoring browser flows were not rerun for this isolated proof; no production file changed.
- TypeScript (`--noEmit --incremental false`) and scoped ESLint: passed. No shared Next output/types were regenerated.
- Automated accessibility/MathML checks remain distinct from physical VoiceOver/NVDA verification. No manual screen-reader testing or physical iPhone testing is claimed.

Evidence is in `../evidence/trusted-proof/`: complete measurements/profile/cleanup in `results.json`, package/archive data in `runtime-inspection.json`, compatibility results in `review-comparison.json`, test commands/counts in `regressions.json`, production build/server logs, and five actual-renderer screenshots. `change-manifest.json` lists every new proof/evidence file. The design specification and approved engineering plan are unchanged.

**Decisions before deployment:** approve the deployable prose/fallback font provision (licensed Arial/Times or an explicitly approved alternative profile), then approve the concrete isolated Vercel test and proposed Linux browser/driver/runtime candidate. No new fit margin, cross-browser publication gate, editor redesign or production typography change is requested or assumed. Actual publication integration requires a further, separate authorisation.

Raw `*.log` execution/deployment transcripts in the evidence directory are local-only and intentionally ignored. Local copies are retained; the documented verification commands generate fresh logs. Committed JSON summaries, proof-test inputs, scripts and reference screenshots remain available. Historical change manifests describe their original verification runs, including local artifacts; they are not the current Git staging inventory.
