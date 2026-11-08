# Group Experience hosted region benchmark comparison

**Completed.** Recorded run began at `2026-11-08T00:02:30.153Z`. The new Git deployment is verified in Dublin. All 20 timed browser journeys completed: five direct navigations and five in-app reopens in each engine. The user was told immediately after browser completion that the VPN could be restored.

**Result:** median contribution readiness improved from **5.098→2.354 seconds in Chromium** and **5.403→1.971 seconds in WebKit** on direct entry. In-app contribution readiness improved from **3.477→1.371 seconds** and **4.673→1.151 seconds**, respectively. These are observed deployment comparisons, not a measurement of pure database latency or proposed V2 behaviour.

No application changes, deployments, settings changes, fixture mutations, commits, pushes or merges were performed. Loading Architecture V2 is unchanged.

## A. Environment verification

### Deployment and source

New tested deployment:

```text
https://switchplay-app-aleirimhm-peter-meehan-domokos-projects.vercel.app
```

| Item | Evidence |
|---|---|
| New deployment | `dpl_5NNWNZquEK4gh8Kz7sT7TPgmdAqq`, READY, Git source |
| Verified deployment region | `regions: ["dub1"]` |
| Verified Function inventory | All **277 lambda entries** specify `deployedTo: ["dub1"]`, including `/decks`, auth, Group authority/presentation/perspectives/aggregates, media and reflections |
| Sample live response IDs | `dub1::dub1::…`; corroborating routing evidence, not the sole placement proof |
| New deployed Git commit | `4bca8b5be6d307a104308b2702e8de2da2eca4de`, `feat/group-experience` |
| Baseline source | Investigation baseline `202f909`; new commit's parent |
| Source difference | Only `docs/engineering/features/group-experience/loading-architecture-independent-review-claude.md`; no tracked application/dependency/configuration changes |
| Project | `switchplay-app-ie`, `prj_DJ3l13AXX5vhETO9uZ77A28BcC5E` |
| Original deployment | `dpl_9hpu1nBJgaufPamZ3NZxeNWRZn5s`, `…-l1415n0zl-…vercel.app`, verified `iad1` |
| Earlier unsuitable redeployment | `dpl_E7FdzfMa3yyzKrfga257Zy1JFVps`, `…-bvts9h3b9-…vercel.app`; still `iad1`; not timed |
| Function runtime | Original and new inventories both `nodejs24.x` |
| Atlas region | Previously verified AWS `EU_WEST_1` / Ireland; not changed or reprofiled from a local client |

Verified through authenticated read-only `vercel inspect … --json` and Vercel deployment API GETs. The new deployment's Git SHA is independently supplied by Vercel metadata. The original was CLI-created and has no deployed Git SHA; `202f909` is the recorded investigation source baseline. Thus the Git comparison demonstrates no application change between recorded baseline and new commit, but is not a cryptographic proof of the old CLI deployment's source/artifact or every runtime environment value.

### Browser, fixture and safety conditions

* Same existing Group `738ebc9c-6a48-4148-8d89-7928d4cf7ce1`, initial Card `44c3fa5a-1aeb-4502-aa26-fbc504cfaad4`, and Joe user `6ab81255984ff553b3514bf2` (Admin, not a follower). Existing session verified by read-only `/api/auth/me`; no application login or record write was needed.
* Playwright test package **1.58.1**; actual launched Chromium **145.0.7632.6**, WebKit **26.0**; headless, mobile/touch, viewport **414×740**, no artificial network throttling. Historical exact browser binary versions were not recorded, so exact version equality cannot be certified.
* User reported VPN off throughout the successful timed run. Historical VPN/competing-traffic state is not recorded. No claim of a controlled physical-iPhone or slow-4G result is made.
* Same original routing interception: navigation-preference PATCH is fulfilled locally; all other non-GET/HEAD/OPTIONS requests are blocked. Actual open/save/upload/member mutations cannot reach the application. Standard session/Preview-access cookies are local browser state only.
* The new host first needed its own Vercel access cookie. An initial browser attempt failed Preview protection before producing any samples; it is preserved as `protection-attempt.json` and excluded. A normal authorised GET established the host's access cookie before restarting the timed suite. WebKit's protection `/login/validate` POSTs were blocked, as in the original methodology.
* Primed DOM observations match the original markers: same Card/Group perspective, three signals, two media elements, collective and member notes present. No data was reset. Full stored-content hashes were not compared, so fixture-content identity beyond these checks is not proven.

## B. Before-and-after comparison

### Summary

Historical direct-entry baseline: two samples per engine. Historical in-app baseline: one sample per engine. New results: **five samples per journey per engine**. Positive differences indicate improvement; percentages use unrounded millisecond values.

| Engine | Journey / marker | Original median / sole sample | Dublin median | Absolute improvement | Improvement | Dublin range |
|---|---|---:|---:|---:|---:|---:|
| Chromium | Direct URL: Stack visible | 4.064 s | 1.872 s | 2.192 s | 53.9% | 1.114–2.343 s |
| Chromium | Direct URL: Contributions ready | 5.098 s | 2.354 s | 2.744 s | 53.8% | 2.013–2.874 s |
| Chromium | In-app reopen: Stack visible | 2.371 s | 0.508 s | 1.863 s | 78.6% | 0.346–0.847 s |
| Chromium | In-app reopen: Contributions ready | 3.477 s | 1.371 s | 2.106 s | 60.6% | 0.468–1.422 s |
| Webkit | Direct URL: Stack visible | 4.357 s | 1.492 s | 2.865 s | 65.8% | 0.539–1.855 s |
| Webkit | Direct URL: Contributions ready | 5.402 s | 1.971 s | 3.432 s | 63.5% | 0.793–2.962 s |
| Webkit | In-app reopen: Stack visible | 3.857 s | 0.346 s | 3.511 s | 91.0% | 0.325–0.348 s |
| Webkit | In-app reopen: Contributions ready | 4.673 s | 1.151 s | 3.522 s | 75.4% | 1.128–1.207 s |

The original published baseline comes from `loading-lifecycle/hosted.json` for Chromium and the completed `hosted-webkit.json` rerun for WebKit. The interrupted first WebKit sequence is not substituted. Original direct-stack ranges were 4.059–4.070 s / 4.120–4.595 s; original direct-contribution ranges were 5.068–5.128 s / 5.299–5.506 s.

### All new timed samples

| Engine | Journey | Sample | Stack visible (s) | Contributions ready (s) |
|---|---|---:|---:|---:|
| Chromium | Direct URL | 1 | 1.680 | 2.383 |
| Chromium | Direct URL | 2 | 2.293 | 2.874 |
| Chromium | Direct URL | 3 | 1.114 | 2.013 |
| Chromium | Direct URL | 4 | 1.872 | 2.040 |
| Chromium | Direct URL | 5 | 2.343 | 2.354 |
| Chromium | In-app reopen | 1 | 0.508 | 0.924 |
| Chromium | In-app reopen | 2 | 0.799 | 1.390 |
| Chromium | In-app reopen | 3 | 0.378 | 1.422 |
| Chromium | In-app reopen | 4 | 0.346 | 0.468 |
| Chromium | In-app reopen | 5 | 0.847 | 1.371 |
| Webkit | Direct URL | 1 | 0.539 | 0.793 |
| Webkit | Direct URL | 2 | 1.855 | 2.962 |
| Webkit | Direct URL | 3 | 1.492 | 1.971 |
| Webkit | Direct URL | 4 | 1.549 | 2.149 |
| Webkit | Direct URL | 5 | 1.094 | 1.944 |
| Webkit | In-app reopen | 1 | 0.348 | 1.207 |
| Webkit | In-app reopen | 2 | 0.325 | 1.128 |
| Webkit | In-app reopen | 3 | 0.346 | 1.173 |
| Webkit | In-app reopen | 4 | 0.347 | 1.151 |
| Webkit | In-app reopen | 5 | 0.330 | 1.151 |

### Timing definitions preserved

Stack visibility uses the original `.deck-card.is-active` Playwright waiter. Contribution readiness uses the original diagnostic predicate: expected Group/Card, at least one `.back-card-media-carousel-item`, and a collective reflection paragraph in the applicable Card back. DOM sampling runs every 50 ms and also records the member snippet. Timers begin before direct `page.goto` or the in-app tile click, as originally.

These markers **do not establish complete all-Card/all-perspective readiness**, full image decode, video readiness, or absence of every partial intermediate frame. They are retained to make the historical comparison meaningful. Sometimes contribution metadata arrives before the stack visibility waiter resolves, making the two recorded milestones almost simultaneous; that does not change either definition.

## C. Measurement reliability

* One priming navigation precedes each engine's timed series, using the original 1.2-second dwell. Each in-app measurement leaves the Group, waits for its tile, retains the original 1.5-second dwell, then clicks. New sample counts are increased from two/one to five/five; engine order remains Chromium then WebKit.
* These are **warm-path observations**, not guaranteed warm Lambda/connection states. The priming elapsed field includes its dwell and is not reported as cold-opening performance. No forced cold-start/deployment experiment was run. Outliers remain in the table: Chromium direct contribution readiness reached 2.874 s; WebKit reached 2.962 s.
* Browser routing remains enabled as in the original harness; Playwright routing affects normal HTTP caching. These timings therefore should not be relabelled as untouched everyday Safari cache behaviour.
* Code evidence and a large reduction across both engines support regional alignment as a substantial contributor. However, the runs are on different dates/builds, the original sample is small, the original CLI SHA/environment is incompletely attested, and network/platform load and old browser versions are not fully controlled. Do not interpret “53.8% faster” as an exact causal percentage attributable only to geography.
* Completed media/reflection metadata requests in the run returned 200. Navigation/teardown cancelled 18 Chromium requests (`net::ERR_ABORTED`) and 9 WebKit requests (`cancelled`); these are recorded, not hidden. No timed journey failed its marker. Attachment delivery for one existing asset produced three Chromium and one WebKit 302 redirects; a redirect alone is not a failed image decode, which this benchmark does not measure.
* Six WebKit deployment-protection validation POSTs were locally blocked; related `/decks` responses included 204s. This protection activity is also a historical caveat. No application mutation was permitted through the interception.

Raw evidence and adapted read-only script are under ignored `phase2-test-results/loading-region-dub1/`: `hosted.ts`, `hosted.json`, `summary.json`, and excluded `protection-attempt.json`. Original scripts and baseline evidence are unchanged. Saved cookies are outside the repository and must not be published.

## D. Remaining bottlenecks and server/database limits

### Observed HTTP timings

The following are medians of completed successful responses captured across each engine's successful run, **including priming and applicable background requests**, not a matched per-stage causal comparison or pure server execution time:

| Request | Chromium median | WebKit median |
|---|---:|---:|
| Authority | 67.7 ms | 60.4 ms |
| Presentation | 96.0 ms | 69.9 ms |
| Perspectives | 128.6 ms | 85.6 ms |
| Aggregates | 103.6 ms | 85.5 ms |
| Group Card media metadata | 558.9 ms | 840.3 ms |
| Reflections | 725.2 ms | 856.3 ms |

Bootstrap content requests commonly finish in tens to low hundreds of milliseconds, but outliers remain (for example Chromium authority 872.1 ms). Media/reflection metadata is still a noticeable later phase. Their median request-to-first-byte times were approximately 534/705 ms in Chromium and 814/823 ms in WebKit, respectively. The browser timing's request-start delay was typically around 0–1 ms; this does not prove database time or rule out platform/network/server queuing.

A representative fast WebKit direct entry (sample 1) illustrates the preserved dependencies. Rounded intervals are reconstructed from request-finish logging and response duration, so treat them as approximate, not server spans:

| Work | Approximate interval from navigation |
|---|---:|
| `/decks` document | 0.063–0.171 s |
| Initial authority | 0.230–0.283 s |
| Parallel presentation / aggregates / perspectives | approximately 0.280–0.418 s |
| Final authority | 0.420–0.475 s |
| Stack waiter | 0.539 s |
| Current-Card reflection / media metadata | approximately 0.495–0.770 s |
| Contribution waiter | 0.793 s |

This is the fastest direct sample, not the median promise. Other samples show slower document/API phases. Five Update-discovery requests and four Card media feeds can also fan out after bootstrap. Overlapping work from the previous view can still be finishing during a new navigation. Do not add overlapping request durations or attribute every residual delay to rendering.

### What remains unchanged

The authority → parallel content → final authority sequence, repeated protected reads and post-mount contribution fetching remain. The historical code-path accounting was 41 warm repository commands plus five authentication lookups for bootstrap, excluding later contributions. **This task did not measure deployed MongoDB command counts anew**, and does not substitute that historical accounting for a new trace. Regional alignment reduces round-trip cost; it does not remove the operations or retain component-disposed data.

### Server-to-database timing was not directly measurable

No captured application response supplied `Server-Timing`. Read-only Vercel runtime-log inspection returned no runtime records in the queried window. Request logs supplied route/status/cache/edge fields but no per-query timing, application preparation spans or reliable cold-start markers. Therefore this task cannot isolate:

* Pure Vercel→Atlas round-trip latency or database execution time.
* Auth versus repository versus platform scheduling cost.
* Proven cold versus warm Function execution.
* Exact current Mongo command counts or per-query server durations.

No local MongoDB/Atlas profiler was used as a substitute. The measured HTTP and browser improvements are real observations, but an exact server-to-database latency figure would require separately approved instrumentation.

## E. Architectural implications

The original 4–5-second wait was **materially sensitive to deployment location**. With unchanged tracked application code, the new medians are approximately 1.5–1.9 s to the stack and 2.0–2.4 s to current contribution readiness on direct entry; in-app stack reopens are approximately 0.35–0.51 s, with contributions around 1.15–1.37 s.

This reduces the urgency of treating the entire old wait as an application-architecture problem. Performance decisions should use the new Dublin baseline, not forecast savings from the Washington timings. Initial loading is near the provisional 1–2-second aspiration in some cases, but contribution readiness is not consistently within it and still does not mean complete all-Card preparation.

The object-constancy work retains its independent purpose: component-lifetime loss, routine verification clearing known content and post-mount assembly were demonstrated by the earlier investigation and are not corrected by a region change. Retained scoped data and stable refresh remain relevant. The amount/order of further request/query optimisation should be reassessed against these measurements before implementation. This report does not revise V2, propose a new architecture, or implement Claude's review recommendations.

## F. Further measurements needed

Only two follow-ups are especially useful:

1. **Physical iPhone confirmation on this same Dublin deployment:** direct and in-app entry, then focus/revisit/live Safari resume. Confirm the visible improvement and whether known media/reflections still disappear. This browser run does not claim new resume regression coverage.
2. **If the remaining metadata delay requires attribution:** separately approve private timing/count instrumentation inside existing authenticated Group/media/reflection reads (auth, repository, Mongo command duration/count and request ID). Avoid a public diagnostic endpoint. Existing platform spans should be used if they become available; otherwise changes/new deployment need explicit approval. A necessary existing command, or a specifically approved authenticated-path ping, could establish server→database round-trip cost. Do not infer it from HTTP timing or add a diagnostic now.

There is no current deployment/access blocker. The user has already been notified that the timed tests are finished and the VPN can be restored. No further timed run or architectural investigation starts automatically.

## Preservation

Only this comparison report was edited among engineering documents. V2, V1, the supporting investigations and the user's independently modified review file were left untouched. Additional diagnostic scripts/results are ignored test evidence. No application code/tests, deployment configuration, real fixture data/media or Git history were changed.
