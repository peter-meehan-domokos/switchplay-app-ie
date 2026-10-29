# Disposable Vercel proof — completed Preview verification

**26 October 2026: actual Linux Preview verification passed.** The user explicitly approved the inert Production-classified bootstrap, keeping it deployed while the actual proof ran in Preview. No further deployment or production integration is implied.

## Resources and verified targets

| Resource | Verified value |
| --- | --- |
| Account/team | `peter-meehan-domokos-projects`, Hobby |
| Separate project | `switchplay-maths-renderer-proof` / `prj_KIkD92Ngbvl0b7IF1QSFU0l1D63o` |
| Retained bootstrap | `dpl_CbrdnyWE4rqepVTi55vg1ATgf3fs`, Production, READY |
| Actual proof | `dpl_89GFXKA4tYrXR7VeykuCUX4dxcio`, Preview, READY |
| Actual proof URL | `https://switchplay-maths-renderer-proof-pw2l5uwpz.vercel.app` |
| Live project, untouched | `switchplay-app-ie` / `prj_DJ3l13AXX5vhETO9uZ77A28BcC5E` |
| Protection | Vercel Authentication `all_except_custom_domains`; no custom domains |
| Runtime | Node 24.x / actual v24.21.0, Linux x64; configured region iad1 |

Standard Preview is represented by `target: null` with no custom environment in Vercel's deployment API. The actual target was checked after upload and before exercising measurement. The proof additionally refuses non-Preview builds and non-Preview runtime execution. Final safety evidence rechecks target/protection/bootstrap retention, Hobby resources and the distinct live project's identity.

## Bootstrap

`bootstrap.mts` prepares an ordinary temporary Build Output API directory with exactly `config.json` and `static/404.html`. It contains zero functions, dependencies, browser runtime, database connection, application routes or measurement capability. Its route matches every path and returns 404. Vercel Authentication precedes the static response. Authenticated checks of `/`, arbitrary paths, `/measure-host` and POST `/api/proof` return 404.

The authorised deployment used `vercel deploy <bootstrap> --prebuilt --prod --scope peter-meehan-domokos-projects --project switchplay-maths-renderer-proof --yes --json`. The bootstrap is retained, including its proof-project Production alias. No alias/domain of the live application was changed.

Vercel forces a new project's initial deployment into Production; the prior actual proof that encountered this behaviour was removed before measurement. The bootstrap was only deployed after the user's explicit amendment. Historical initial-attempt/removal evidence remains available.

## Actual Preview sequence

1. `verify.mts` builds the minimal isolated source with Node 24 and verifies the actual renderer through local controlled Chromium. No root application build output is modified.
2. `deploy-preview.mts` reads that exact prepared directory, writes only the disposable project's link metadata, verifies the retained inert bootstrap, then executes `vercel deploy <prepared> --environment preview --scope peter-meehan-domokos-projects --project switchplay-maths-renderer-proof --yes --json --no-wait`.
3. The script polls deployment metadata and **stops if target is Production**. The actual successful target was Preview; only then was `verify-deployed.mts` run.
4. The verifier checks authentication/host/API guards before any browser launch, then uses fixed server-selected scenarios. It records callbacks, actual font selection, geometry, latency, Linux process-tree memory and cleanup without credentials.
5. Final read-only API/HTTP checks confirmed the bootstrap remains READY, the proof remains Preview, authentication remains enabled and the plan remains Hobby.

The first actual Preview had an incomplete dynamic Playwright trace and was corrected; the second failed closed on the official browser's reported-version discrepancy. Their evidence is retained as `preview-attempt1-*` and `preview-attempt2-*`. Later successful Preview verification does not erase these findings. No actual proof was exercised under a Production classification.

## Credentials and network boundary

The new project's only custom variable is sensitive `MATHS_PROOF_KEY`, scoped to Preview. Its automation bypass is project-specific. `VERCEL`, `VERCEL_ENV` and `VERCEL_URL` are platform-provided. No application/database/session/AWS credentials or shared application variables were copied. Private operator credentials are outside the repository and never included in artifacts or reports.

Without platform authentication, the deployment redirects to Vercel login. With platform bypass but no execution key, POST `/api/proof` returns 404. The host requires a different HMAC-derived key and otherwise returns 404. Unknown scenario IDs return 400; application/dev routes are absent. Inputs cannot specify arbitrary source, URLs, dimensions, launch flags or browser instructions.

Browser network interception permits the fixed deployment's host, static Next assets and font paths only. The browser has a minimal child environment; only the derived host key and this project's bypass are passed on allowed same-origin requests. Vercel's external feedback script was blocked. Request interception is not an OS network sandbox; proof security is limited to controlled fixtures. No public automation interface was exposed.

## Runtime, packaging and resources

Pinned dependencies are local to this proof folder: Sparticuz Chromium 153.0.0, Playwright Core 1.63.0, Next 16.2.6, React 19.2.4 and KaTeX 0.19.1. The actual distributed Chromium reports 153.0.8010.0; both its exact executable SHA-256 and reported version are enforced. All eight Liberation 2.1.5 faces and the unchanged KaTeX fonts were confirmed through actual browser glyph inspection.

Explicit tracing includes Sparticuz binaries/libraries, the full small Playwright Core runtime (including dynamically read `browsers.json`) and the exact licensed font assets. The final Next trace is 88,379,426 bytes / 263 files. That is not a final Vercel artifact-size claim; the inspected deployment API did not expose artifact size. Packaging and real Linux execution succeeded on the existing Hobby plan without a large-function setting, paid upgrade, queue, browser provider or other new service.

Maximum sampled simultaneous Node/descendant RSS was 528.988MiB. Cgroup telemetry was unavailable, so exact container/billed memory and separate host-function resources remain unmeasured. First observed browser execution took 6.567s client time, with authentication guards already run; warm ready requests took 2.456–3.172s. These are feasibility samples, not untouched-function cold-start percentiles or load guarantees. The creator's 15s transport timeout is unchanged.

Two simultaneous requests were served by different cleanly released browser instances. A single function instance permits only one active browser; local same-instance contention returns 503 with `Retry-After`. No pool or queue was introduced. Proof internal deadline 25s, function maximum 60s, operator caller deadline 45s.

## Retention and next approval

The inert bootstrap and successful protected Preview are left in place for review as requested; failed historical Previews remain protected. No autonomous promotion, live deployment, production typography change, Info Card integration or publication/schema work is authorised. See [README](README.md) and [linux-summary.json](evidence/linux-summary.json) for results and limitations. Further integration should begin with explicit approval of a small implementation plan, including legacy activation, exact consumer constraints, immutable acceptance and publication-specific timeout/retry behaviour.
