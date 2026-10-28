# Open-font compatibility evaluation

Status: **Candidates prepared for separate visual and product approval. No production font selected.**

This follows the Phase 1 licensing stop in the trusted Chromium feasibility work. The authorised next step was to evaluate open-font alternatives. It does not authorise production typography changes or an external Vercel deployment.

## Findings and recommendation

The previous trusted proof found actual Arial prose, KaTeX mathematics and Times New Roman fallback for mathematical euros on the development machine. Those proprietary fonts have not been copied, redistributed or installed by this work. Their server-deployment rights remain unestablished.

Two self-hosted alternatives are now available for comparison:

| Candidate | Provision | Raw font bytes | Assessment |
| --- | --- | ---: | --- |
| Liberation Sans + Liberation Serif | Version 2.1.5; four static styles per family | 3,166,056 | Recommended technical starting point, subject to visual approval. Static faces simplify an explicit regular/bold/italic/bold-italic profile. |
| Arimo + Tinos | Pinned upstream revisions; two variable-weight Arimo files and four static Tinos styles | 3,302,924 | Viable alternative. Variable font support is present in the tested browsers; the exact Linux Chromium profile still needs verification. |

All supplied files are unmodified upstream fonts under SIL OFL 1.1, with copyright and licence notices retained. The licences permit redistribution and bundling subject to their conditions. This establishes a deployable open-font candidate, not permission to substitute it in production. No licence purchase is required for these supplied assets.

Official sources and immutable revisions:

- [Liberation Fonts 2.1.5 release](https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5), [licence](https://raw.githubusercontent.com/liberationfonts/liberation-fonts/2.1.5/LICENSE).
- [Arimo licence at the selected Google Fonts revision](https://raw.githubusercontent.com/google/fonts/903d46673260c1f4c7f7ef67f5190fb03eab5042/ofl/arimo/OFL.txt).
- [Tinos source](https://github.com/googlefonts/tinos), [licence at the selected revision](https://raw.githubusercontent.com/googlefonts/tinos/3b4482a99b80ea5fc75f187b1be3120a3f5905b3/OFL.txt).

`src/app/dev/maths-fonts/fonts/sources.json` records the exact official URLs, byte sizes and SHA-256 checksums. `fetch-fonts.mts` reproduces the downloads without installing system fonts or dependencies. Arimo's filenames are shortened locally, but the variable font bytes are unchanged. No claim of universal metric or visual equivalence to Arial/Times is made.

## Independent review page

Verified Wi-Fi address:

```text
http://192.168.1.38:4181/dev/maths-fonts
```

The existing server was preserved. Automated mobile WebKit accessed this exact address, received HTTP 200, found the actual review page and waited for all 24 renderer instances to return ready results. This is not a claim of physical iPhone testing.

The page compares the current device's system reference against both candidates. The five authored explanations are imported directly from the existing review fixtures without changing their source. Each profile also contains a larger reading/currency sample and the same tall explanation under 160px and 320px explicit content-height constraints.

The reference frame remains 240 × 157px, border-box, with 12px padding and a 1px border. After the ordinary header reservation, the content width is 214px. Measured content heights vary with browser header metrics: approximately 110.016px Chromium, 110.117px Firefox and 111px WebKit. These are reference dimensions, not permanent product limits.

The unchanged standalone `MathsRenderer` renders and measures every sample through its public `onResult` callback. Its own overflow stays visible; scrolling belongs to the review wrapper. No duplicate mathematical measurement algorithm is introduced.

Balanced numerical settings are unchanged: 1× maths, 1em indentation, 0.6em display gaps, 0.8em paragraph gaps, 0.25 mathematical em inline clearance, and working-row `arraystretch` 2.3125. Review prose uses the existing 9.5px / 1.25 reference, plus an 18px reading sample. Both alignment layouts retain the existing full-suite regression coverage.

Candidate aliases are explicit (`ReviewLiberationSans`, `ReviewArimo`, etc.). Review-scoped CSS changes the missing-glyph serif fallback after `KaTeX_Main`; it does not replace KaTeX's mathematical font files. This is a comparison technique, not a new public renderer API. A production fallback configuration remains a later implementation decision.

## Actual font inspection

Chromium CDP inspection verified the fonts used for the sampled text, rather than relying on declared CSS names:

| Probe | Liberation profile | Arimo/Tinos profile |
| --- | --- | --- |
| Prose “Example” | Liberation Sans, custom web font | Arimo, custom web font |
| Bold mathematical expression | KaTeX Math BoldItalic | KaTeX Math BoldItalic |
| Mathematical euro, regular | Liberation Serif | Tinos |
| Mathematical euro, bold | Liberation Serif Bold | Tinos Bold |
| Mathematical euro, italic | Liberation Serif Italic | Tinos Italic |
| Mathematical euro, bold italic | Liberation Serif BoldItalic | Tinos BoldItalic |

All four euro probes used the supplied custom fonts. KaTeX euro metric warnings are retained in the reading sample diagnostics. Testing these characters does not establish deterministic fallback for every Unicode character or every KaTeX sub-family. The existing twenty KaTeX font faces remain unchanged.

## Measurement results

Within each browser, all three profiles produced the same dimensions for the five reference explanations in this run. The sample contains substantial mathematics, so equality here is not proof that the prose fonts have identical metrics for arbitrary text.

| Example | Chromium required height | Firefox required height | WebKit required height |
| --- | ---: | ---: | ---: |
| 1. Composition | 76.453px | 78.800px | 74.406px |
| 2. Multiply all terms | 78.813px | 78.917px | 77.938px |
| 3. Nested fractions | 95.813px | 96.217px | 94.547px |
| 4. Negative fractions | 91.844px | 92.250px | 90.578px |
| 5. Subtract brackets | 22.766px | 23.800px | 22.375px |

Chromium and WebKit report that all five fit. Firefox reports vertical overflow for examples 2–4 because of an approximately 0.05px top overhang, despite sufficient bottom space; examples 1 and 5 fit. This existing engine difference is preserved and reported, not hidden by a new tolerance.

For the repeated nested-fraction sample, required heights are 287.438px Chromium, 288.550px Firefox and 283.641px WebKit. All profiles overflow a 160px budget. With 320px, Chromium and WebKit fit; Firefox has no bottom excess but retains its small top-overhang result. The unchanged fit threshold remains authoritative in each engine. A 0.001px tolerance in one independent geometry-comparison assertion accounts for viewport-coordinate subtraction far down the page; it does not alter the renderer's fit calculation.

The larger-height experiment confirms that height is an input to the renderer. Future publication validation must bind acceptance to the consumer's actual dimensions/layout version, not assume a permanent 157px outer height. Changing real Info Card height, media reservation, responsive scaling and publication rules remains outside this milestone. The existing trusted-proof evidence covers media-constrained reference inputs; this font page adds text-only reference and larger explicit-height comparisons without changing that proof.

## Verification

| Check | Result |
| --- | --- |
| Font provenance/licence, renderer unit/isolation and prior proof-evidence checks | 24 passed |
| Existing application unit suite | 420 passed |
| Complete Maths Renderer browser suite, Chromium/Firefox/WebKit | 117 passed, 6 intentional engine-specific skips, no failures or flaky tests |
| Focused final screenshot/font rerun | 5 passed, 4 intentional engine-specific skips |
| Existing Info Card capacity browser regressions | 5 passed |
| TypeScript, `tsc --noEmit --incremental false` | Passed |
| ESLint scoped to changed TypeScript/TSX/MTS | Passed |
| Normal Next.js production build in a temporary source snapshot | Passed |
| Production HTTP and RSC requests for both review routes | All 404, no review fixture markup |

The older explanation-review test expected an obsolete display-only introduction. Its assertions now match the existing approved inline introduction, “Example” paragraph and unchanged two example equations. No explanation content was edited to satisfy the test. Initial new test-harness assertions were corrected for that existing paragraph structure and documented Firefox geometry; renderer assertions and fit policy were not weakened. Final screenshots establish viewport size before waiting for ready measurements, avoiding capture-induced pending labels.

Commands used:

```sh
node --import tsx --test tests/maths-fonts/*.test.ts tests/maths-renderer/*.test.ts tests/maths-renderer/trusted-proof/verify-results.test.ts
npm run test:unit
npx playwright test -c playwright.maths-renderer.config.ts
npx playwright test -c playwright.maths-renderer.config.ts font-review.browser.ts
npx playwright test -c playwright.info-cards-capacity.config.ts
npx tsc --noEmit --incremental false
npx eslint src/app/dev/maths-fonts tests/maths-fonts tests/maths-renderer/font-review.browser.ts tests/maths-renderer/explanation-review.browser.ts
node --import tsx tests/maths-fonts/production.mts
```

Full-suite JSON, measurements, actual-font inspection, production build/guard logs and screenshots are in `evidence/`. Existing Info Card unit coverage in the application unit suite and the five capacity browser regressions passed; database-backed integration tests were not run in this font-only evaluation. Automated accessibility checks in the renderer suite are not physical VoiceOver or NVDA verification. No manual screen-reader test is claimed.

## Isolation and remaining approval boundaries

- No existing renderer implementation, Info Card component, schema, draft/edit/save flow, publication rule or consultation logic changed.
- No dependency manifest/lockfile changes, system font installation, production settings changes, new external services or deployments. Font downloads used official upstream sources.
- Fonts and styles are confined to the new development review route. Production guards were tested for both HTML and RSC responses in a real local production build. The review is not a public production automation endpoint.
- Build verification used a disposable filesystem snapshot, not another Git worktree. Environment files were excluded; dummy database values were used without database access. Its temporary server and snapshot were removed.
- Original development servers were preserved. The temporary reference fixture started by this evaluation was stopped after its tests.
- Historical trusted-proof files/evidence are unchanged. `evidence/change-manifest.json` lists only this evaluation's changes and their hashes.

**Next decision:** visually approve one candidate, request a different candidate, or retain the licence-investigation direction. The recommendation is Liberation Sans/Serif for initial Linux proof preparation because its static profile is straightforward and slightly smaller. This recommendation is not an approved production substitution.

**Still unproven:** Linux/serverless selected fonts, Chromium-driver compatibility, Vercel bundle/resource limits, deployed startup/latency/memory/concurrency and production font parity. The tested runtime remains the existing local Chromium 145.0.7632.6 / Playwright 1.58.1 profile; no new production runtime was selected. Once a font profile is approved, prepare the isolated Linux/build proof, inspect the exact Vercel target/account/environment/protection, and obtain explicit deployment approval before creating any external deployment. A font approval alone does not authorise deployment or Info Card integration.

Raw `*.log` execution/deployment transcripts in the evidence directory are local-only and intentionally ignored. Local copies are retained; the documented verification commands generate fresh logs. Committed JSON summaries, proof-test inputs, scripts and reference screenshots remain available. Historical change manifests describe their original verification runs, including local artifacts; they are not the current Git staging inventory.
