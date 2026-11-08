# Group Experiences — Loading and Card data lifecycle investigation

Date: 6 November 2026. Baseline: `feat/group-experience`, `202f909`.

**Investigation only. No application changes, data mutations, configuration changes, deployment, commit, push or merge were performed.** The four accepted iPhone corrections are the baseline, not proposed rollback candidates. Earlier handoff statements about awaiting their acceptance/commit are historical; the user has confirmed acceptance and they are committed in `202f909`.

## A. Executive diagnosis

The reported loss of object constancy is real. There are three verified causes:

1. **The initial Group snapshot does not include the media and reflections needed to present a complete Card.** It provides canonical content, learning, dates and comparison data. The Card then mounts separate media and reflection readers. In the hosted measurements, the stack became visible after approximately **4.06–4.60 seconds**, while its initial media metadata and reflection text were not complete until **5.07–5.51 seconds**. These are different milestones; the first is not a complete-Card loading time.
2. **Previously loaded contribution data belongs to component instances rather than a reusable session snapshot.** Leaving a Group disposes its resource. Moving from the Deck Card to its focused representation creates new contribution readers. Those readers start with no media page/no reflection feed. Returning therefore repeats the assembly even when the user has already seen the same content.
3. **Routine access revalidation is treated as a reason to remove displayed content.** Focus, `pageshow` and visibility events invalidate authority immediately. In Group and inspected-member perspectives this sets contribution contexts to `null`, disposing media state and unmounting reflection state. Signals remain because they come from the retained Group snapshot. A controlled hosted resume test reproduced precisely this split, without changing permissions or unmounting the focused Card.

There are additional confirmed costs:

- A direct `/decks?openExperience=…` navigation waits for ordinary Personal memberships and Group tile content before the browser begins the Group bootstrap. The streamed document completed at approximately **1.7 seconds** in the representative repeated navigations.
- Bootstrap still makes an authority request, three concurrent page requests, then a final authority request. Those are three serial network stages, not five serial requests. The accepted concurrency correction is working.
- The **41 warm repository commands** belong only to those five bootstrap calls. They exclude their five authentication lookups, the My Decks server render, subsequent media/reflection reads, update-discovery requests and image/video delivery.
- Full Group refresh runs every four seconds, separate authority renewal every two seconds, reflection refresh every five seconds and media refresh every fifteen seconds, plus overlapping focus/visibility/change-event triggers. There is some coalescing within individual controllers, but no common content owner across the different representations of a Card.

**Recommendation:** retain the accepted save/renewal/Gallery safeguards; assemble a complete initial visible-Card snapshot in one protected read; retain complete snapshots at session level; and separate display continuity from editing freshness. Routine refresh should update retained content, not reconstruct it from empty section states.

The deployment also places Functions in `iad1` while Atlas reports AWS `EU_WEST_1`. This is verified placement, but its exact contribution to the delay has not been isolated. It warrants a controlled configuration assessment, not an assertion that changing region alone will solve the lifecycle problems.

## B. Current loading sequence

### Login, collection and Group opening

Login authenticates and establishes the session; it does **not** load Group memberships. `AuthScreen` then navigates/refreshes. Group membership and role information arrives later through My Decks or Group API reads.

Relevant source:

- `src/app/api/auth/login/route.ts:16–25`; `src/components/auth/AuthScreen.tsx:22–41`.
- `src/app/decks/page.tsx:8–18`: authentication → Personal membership DTOs → Group tiles, including all tile pages → `AppShell`.
- `src/lib/groupExperiences/presentationReads.ts:87–100`: tiles first list memberships/Groups, then retrieve each Group's content and learning. Each Group is handled in turn.
- `src/components/layout/AppShell.tsx:229–264`: leaving unmounts the Group and refreshes tiles; reopening creates a new `GroupExperienceDeck`. Existing tile content is not used to seed its resource.

```mermaid
sequenceDiagram
    participant B as Browser
    participant D as My Decks server render
    participant G as Group APIs
    participant M as MongoDB
    B->>D: GET /decks?openExperience=knownGroup
    D->>M: Session user, Personal memberships, Group tiles/content
    D-->>B: AppShell data in streamed document
    B->>G: GET authority
    G->>M: Current membership, Group, selected publication visibility
    G-->>B: Actor and Group revision reference
    par Presentation
        B->>G: GET presentation
        G->>M: Membership, canonical content, Group/own learning and own dates
        G-->>B: Presentation page
    and Perspectives
        B->>G: GET perspectives
        G->>M: Membership, canonical content, follower identities/learning
        G-->>B: Perspective page
    and Aggregates
        B->>G: GET aggregates
        G->>M: Membership, canonical content, follower learning, Group learning
        G-->>B: Aggregate page
    end
    Note over B,G: Repeat pages until all Cards/followers are collected
    B->>G: GET authority again
    G-->>B: Matching current scope
    Note over B: Publish resource; render Card with signals, without contribution feeds
    par Contribution metadata
        B->>G: GET media, newest five for each mounted Card back
        G-->>B: Media items, count and capabilities
    and Reflection text
        B->>G: GET reflections for current Card/perspective
        G-->>B: Collective/member/current-context reflection data
    and Admin update discovery
        B->>G: GET Deck and individual Card update reviews
        G-->>B: Available explicit updates
    end
    Note over B: Media and reflections appear after initial Card presentation
```

This diagram describes the current implementation, not a proposed design. Already-open pages can also have renewal requests in flight while a full navigation starts; those are not prerequisites for the new page's bootstrap.

### What blocks initial presentation

`groupResource.load()` at `src/components/group-experiences/groupResource.ts:92–144` collects **every Card page** and every follower page before publishing `data`. Each of the three page responses is compared against the initial actor/experience/access/structure/adoption reference; a final authority read must match too.

`GroupExperienceDeck.tsx:82–93` shows the Group loading state until the resource contains data. At that point it can render the Card, despite contribution data being absent. There is no readiness boundary that combines signals, dates, media slots and reflection previews.

For a large Deck, the current code also waits for later Card pages that the initial Card does not need. `presentationReads.ts:23–25,69–84` loads selected canonical Card content before slicing each page. Thus pagination bounds the response but does not avoid all repeated full-selection database work. This is established from source; the hosted review Group has only four Cards, so no multi-page latency is attributed to the measured four seconds.

### What can load later without changing the initial Card

The initial snapshot needs the visible Card's template/Step content, selected perspective's progress/confidence/date state, reflection previews and empty-slot state, and newest-five media identities/order/count/visibility/capabilities. It needs enough media information to reserve the final thumbnail arrangement.

It need not wait for full-resolution Gallery images, video manifests/playback tokens, downloads, complete Media Centre history, unseen older Gallery pages or every follower's detailed comparison matrix. Thumbnail bytes may finish loading within already-reserved slots. First presentation must not later acquire an entire previously absent media strip or reflection note merely because its metadata was deferred.

The Deck outline and visible surrounding Card fronts still need their normal content. Fetching a lightweight outline is different from awaiting complete back-of-Card contribution feeds for every Card.

## C. Timing breakdown

### Method and safety

Read-only mobile-width Playwright measurements used the existing hosted Preview, Joe's existing authenticated session, viewport `414×740`, touch enabled, Chromium and WebKit:

```text
https://switchplay-app-l1415n0zl-peter-meehan-domokos-projects.vercel.app/decks?openExperience=738ebc9c-6a48-4148-8d89-7928d4cf7ce1
```

The Group currently selects four Cards. Joe is an Admin, not a follower. No accounts, content, roles, visibility or stored preferences were changed. Non-read requests were blocked; the navigation-preference PATCH was fulfilled locally so navigation could be exercised without writing Atlas. This does not test persistence of navigation preferences. WebKit's deployment-protection `/login/validate` POSTs were also blocked; application GETs used the existing valid session.

Each engine first opened the Group to warm the tested paths. The following are repeated navigations, **not** measurements of the separate twelve-second first-load problem. The visible-stack milestone uses Playwright visibility; the completeness milestone additionally requires the initial Card's known media entries and collective reflection to exist. The loaded member snippet was also observed. Neither milestone waits for full media bytes. DOM state was sampled every 50 ms.

Diagnostics are local, ignored files under `phase2-test-results/loading-lifecycle/`: `hosted.ts`, `hosted.json`, `hosted-webkit.ts`, `hosted-webkit.json`, `profile.ts`, `database-profile.json`, request-log extracts and pending-resume screenshots. They are not shipped application code or a new test service. An initial diagnostic counted only clickable thumbnails, overlooking passive thumbnail elements; that detector was corrected before the measurements below. A subsequent delayed-route cleanup error interrupted the first harness after its completed navigations; the WebKit sequence was rerun with safe cleanup. The table uses the completed Chromium sequence and completed WebKit rerun.

### Repeated hosted opening

| Engine / run | Visible stack | Initial contribution data complete | Interval after stack visibility |
| --- | ---: | ---: | ---: |
| Chromium 1 | 4.070 s | 5.128 s | 1.058 s |
| Chromium 2 | 4.059 s | 5.068 s | 1.009 s |
| WebKit 1 | 4.120 s | 5.506 s | 1.386 s |
| WebKit 2 | 4.595 s | 5.299 s | 0.704 s |

Two completed WebKit navigations before the harness cleanup interruption independently measured 4.072/4.081 s to stack and 5.225/5.239 s to contribution completeness. They support the same finding, but are not substituted for the completed rerun.

### Representative Chromium waterfall

Times below are rounded relative to document navigation. Request timestamps and DOM waiters have separate clock origins; do not infer millisecond-level server spans from their small differences.

| Work | Approximate start → finish | Dependency / interpretation |
| --- | --- | --- |
| Initial streamed document | 0 → 1.69 s | Browser navigation timing records first streamed bytes around 0.012 s; the Group cannot initialise from that shell alone. |
| DOM ready | 1.71 s | Does not mean Group data is ready. |
| Initial Group authority | 1.77 → 2.30 s | First serial Group API stage. |
| Perspectives | 2.31 → 3.20 s | Runs concurrently with the next two rows. |
| Presentation | 2.31 → 3.26 s | Repeats membership/canonical reads in its own transaction. |
| Aggregates | 2.31 → 3.34 s | Slowest of these parallel reads in this run. |
| Final Group authority | 3.40 → 4.03 s | Second serial authority wait. |
| Visible stack | 4.07 s | Resource exists; contribution feeds are still pending. |
| Current Card reflection feed | approximately 4.03 → 5.10 s | Launched after resource publication. |
| Current Card media metadata | approximately 4.03 → 5.17 s | Parallel with reflection/feed/update requests; DOM completeness was observed at 5.13 s. |
| Complete initial Card data observed | 5.13 s | Different clocks/sampling account for small offsets relative to request-event timestamps. |

The main bootstrap responses in this run were small: roughly 0.24–0.35 KB for authority, 2.02 KB presentation, 0.91 KB perspectives and 0.82 KB aggregates on the wire. The document was approximately 16.5 KB compressed / 112.6 KB decoded. These payload sizes do not establish server execution time, but do rule out a large JSON download as the obvious explanation.

Observed dispatch/hydration work between the completed document and the first authority request was about 0.08 s. The interval from final authority completion to the visible-stack waiter was about 0.04 s in the representative run. The slower WebKit run had a larger visibility-wait interval, while DOM sampling already found Card signals around 4.17 s. This residual includes browser scheduling, visibility/animation criteria and diagnostic observation; it is **not a measured React CPU or animation duration**. Network/data dependencies dominate the representative four-second path, but no browser CPU profile proves every residual cause.

### In-app leave and reopen

| Engine | Stack after reopening tile | Contribution data complete |
| --- | ---: | ---: |
| Chromium | 2.371 s | 3.477 s |
| WebKit | 3.857 s | 4.673 s |

These avoid a fresh My Decks document render, yet still reconstruct the Group resource and contribution feeds. They demonstrate lack of immediate reuse, rather than a promised fixed reopening latency. Previous image requests can remain in flight across the transition. WebKit also encountered the existing deployment-protection validation requests; its slower reopen cannot be attributed entirely to repository work.

### Database work: what the 41 commands actually do

The read-only profiler constructed fresh repositories sharing one connected MongoClient, called the same read functions against `switchplay`, and monitored commands. Warm results contain **zero collection/index metadata commands**. The accepted readiness-cache correction is working.

| Warm operation | Repository commands | Local Node → Atlas elapsed, round 2 | Purpose |
| --- | ---: | ---: | --- |
| Authority, each call | 5 | 121 ms | Member, experience, Deck visibility aggregate, selected Card visibility aggregate, transaction commit. |
| Presentation | 10 | 340 ms | Member/experience, Deck and selected Card roots/versions, creator attribution, Group learning, commit. |
| Perspectives | 10 | 450 ms | Member/experience, same canonical roots/versions, follower identities, Personal learning projection and missing-row validity check, commit. |
| Aggregates | 11 | 410 ms | Member/experience, same canonical roots/versions, follower list and learning projection, Group learning, commit. |
| **Five-call bootstrap** | **41** | **Not additive: three calls overlap in the browser** | `5 + 10 + 10 + 11 + 5`. |
| Authentication, each HTTP call | 1 extra | 15 ms | Current session's user lookup; excluded from the 41. |
| Current Card Group media feed | 12 | 485 ms | Authority/selected Card, contribution page/count/position, uploader/origin information, commit. |
| Current Card Group reflection feed | 12 | 472 ms | Authority/selected Card, visible and Admin-own rows, identities/origins, collective reflection, commit. |
| My Decks Personal memberships | 6 | 108 ms | Ordinary memberships, canonical versions and user data; not Group bootstrap. |
| Group tile listing/content, this one Group | 13 | 365 ms | Membership/Group list plus tile's content/learning transaction. |

Thus the bootstrap is **46 database commands including its five session-user lookups**. The current Card's two contribution requests add another **26 including their authentication**, outside that number. The warm My Decks path adds approximately **20** for authentication + Personal memberships + Group tiles. This is an accounting of individually profiled paths, not a server-side trace claiming that every hosted navigation executed exactly 92 commands: additional mounted Cards, provider reads, update reviews and recurring requests execute too.

The first profiler round performed one-time readiness metadata work: Group tiles had 24 commands instead of 13, media had 14 instead of 12. Subsequent calls reused the readiness result. It is not appropriate to remove the genuine cold-instance index validation as if the old 55 repeated warm checks still existed.

The same follower learning is retrieved separately for perspectives and aggregates. Canonical Group/Deck/Card reads repeat across all three main APIs and the tile path. Each authority response is small, but still requires five commands. The current session lookup reads the full user document before constructing the small auth DTO; Joe's measured source document serialisation was 27,278 bytes. This is server-side work, not exposure of that whole document to the browser. The local 15 ms warm lookup is not evidence that authentication alone explains the hosted delay.

### What was and was not measured on Vercel

Hosted HTTP durations include network, platform scheduling/startup, session lookup and database processing. The deployment has no relevant `Server-Timing` spans. Accessible Vercel request logs identify paths/status/edge routing, but did not expose per-query or function-processing spans. Therefore **an exact hosted auth-versus-Mongo-versus-function-startup split is unavailable** without additional diagnostic instrumentation in a future approved build.

The profiler's Mongo command durations include the local process's network round trips; they are not pure database execution time and must not be subtracted from hosted HTTP durations. First connection establishment was 464 ms in that separate local process. Repeated-call variability was substantial: for example, presentation was 220 ms in round 1 and 340 ms in round 2. No cold-start percentage is claimed.

Read-only Atlas `hello` reports AWS `EU_WEST_1`. The deployed Function inventory records `iad1`; this means Function compute in Washington, D.C., versus the database region in Ireland. Vercel's `dub1` request-edge log entry does not prove the Function runs in Dublin. The provider's [Function-region documentation](https://vercel.com/docs/functions/configuring-functions/region) and [region mapping](https://vercel.com/docs/regions) explain that distinction. Cross-region database round trips are a credible contributor, but a controlled same-region comparison is required to quantify it. No region setting was changed.

## D. Verification audit

“Authority” here means the application's current evidence that the signed-in account can use a particular Group/perspective. It is not a separate authentication system. The browser's five-second lease is an additional display/edit freshness policy; the server still authorises every protected request.

The likelihood descriptions below are product judgments for this small trial, not measured probabilities. First open and mid-session both require correct server authorisation. The question is whether an **extra preliminary or repeated browser wait** is required.

| Check / current location | Concrete invalidating event; first-open / revisit relevance | Necessary protection and proposed presentation treatment |
| --- | --- | --- |
| Session and response viewer identity: `auth.ts:162`, `groupClient.ts:5–12`, Group HTTP wrapper | Logout, expiry, another account signs in; relevant at any request, rather than ordinary collaborative editing. | Keep server session validation and response actor/header checks. Perform within protected data/save requests. A browser membership hint is never a private-data grant. On confirmed account change clear that actor's scoped display/cache and reject delayed results. No separate login-blocking Group lookup is required. |
| Membership/role: `repository.ts:37–41` and each protected read/write | Viewer removed, follower leaves, Admin role removed. Unusual during an initial few-second load; possible on any revisit. | Always authorise protected server reads/writes. Reuse the authorised context inside one composed read rather than repeating it through multiple HTTP prerequisites. Cached display can remain during a routine check; actual denial evicts the affected Group data. Role loss can remove editing without removing read access if the user remains a follower. |
| Selected Deck/Card root and adopted-version visibility: `publicVersions.ts:32–45,66–99` | Creator withdraws a required publication or selected content becomes unavailable. Uncommon during a first load; possible later. | Keep server eligibility checks for the selected content. Run once for a coherent initial snapshot; subsequent checks can refresh retained display. Do not equate a newly published version with invalidation of the Group's explicitly selected older version. Do not remove this check merely to reduce query count. |
| Initial and final authority bookends: `groupResource.ts:100,136` | Membership/composition/adoption changes between independent page reads. Rare in a small initial load but a real race. | They compensate for several separate transactions. Simply deleting them while keeping unrelated page responses is unsafe. A single protected snapshot read can establish one scope once, removing both separate HTTP waits. Later pages/operations still validate their scope. |
| Per-page scope comparison: `groupResource.ts:52–57,116–132` | A response belongs to another account/Group, or pages straddle a membership/structure/adoption change. | Keep actor, source and revision validation. A single initial snapshot reduces opportunities to mix versions. Later pagination still needs these checks. Do not publish mismatched pages or fall back to someone else's data. |
| Five-second lease and two-second renewal: `groupResource.ts:8,34–87`, `GroupExperienceDeck.tsx:58–66` | Time passes, browser sleeps, network stalls, or an actual role/visibility change occurs. Time passing itself is not evidence of revocation. | Renewal is already narrow, not a full-content request. Keep its corrected request ordering. A five-second editing-freshness policy can coexist with retained read-only display; using expiry as an instruction to remove known content conflicts with the newly stated continuity requirement. Active rechecks and a resume recheck still detect real denial. Prolonged unverifiable/offline foreign display requires an explicit failure policy; see F. |
| Immediate focus/pageshow/visibility invalidation: `GroupExperienceDeck.tsx:55–68` | Safari background/resume or ordinary focus changes, normally with unchanged membership. Very common on revisit; can also occur during initial mounting. | The need to recheck on resume is justified; immediate removal before receiving an answer is not necessary for server-side protection. Keep the existing complete Card during this routine check. Restrict only actions requiring fresh capability information. |
| Inspection permission and active subject: `policy.ts:5–25`, reflection/media subject checks | Shared inspection is turned off, subject leaves, or viewer loses inspection authority. Usually unchanged at first open; plausible collaborative change later. | Must protect all foreign reads. Recheck in the protected snapshot/refresh and evict the affected inspected scope on denial. Do not expose owner histories in an inspected view. Do not switch temporarily to another perspective merely because a refresh is pending. |
| Structure/access/adoption floor after a known mutation: `groupResource.ts:77–78,141` | A locally acknowledged settings or adoption change makes an older in-flight response obsolete. | Keep the minimum accepted revision and generation checks. Known changes need targeted invalidation/replacement; an old response must not restore the previous grant or Card list. This differs from speculative invalidation on every resume. |
| Ordinary progress/confidence/reflection revisions | Another member or Admin records normal learning or reflection text. Expected collaboration, not a privacy event. | Refresh those fields without invalidating the entire Card. The bootstrap bookends do not guarantee that normal learning reads from different transactions represent exactly the same moment. A composed snapshot improves that consistency too. Save-time field/revision checks remain authoritative. |
| Media feed identity, visibility and adopted scope: `mediaCollection/controller.ts:12–20`, `groupExperiences/media/repository.ts:165–188` | Contribution hidden/deleted, inspected subject changes, Card removed by adoption, viewer revoked. | Keep server filters and typed source identities. Pending fetch is not “empty media”. Confirmed removal changes only that item; denial clears the relevant foreign scope. Do not reuse an owner's private page as a Group page. |
| Reflection feed context and revision: `ReflectionArea.tsx:39–52`, `reflections/reads.ts:19–37` | Different viewer/context, membership or adoption changes; hidden/deleted reflection; stale read during an edit. | Keep context validation and current server authorisation. Preserve the accepted optimistic mutation generation/rollback rules. Reuse known feed during ordinary refresh; distinguish transient errors from confirmed denial rather than clearing every failed Group read. |
| Save-time access, expected revisions, idempotency and transaction fences | Two Admins edit the same collective reflection; removal or adoption races an upload/save; retry arrives twice. | These are necessary server write protections. Keep them. Most edits can be safely authorised within their existing save request; a separate network preflight does not eliminate the race before save. A stale capability can cause a rejected save and rollback, not permission bypass. |
| Explicit Update availability: `GroupUpdateControls.tsx:25–45` and `adoption.ts` | Creator publishes a newer Deck/Card; an Admin explicitly accepts it. | Discovery is background work and must not block first Card presentation. Only actual acceptance changes the Group's selected content/revisions. Keep fresh server validation/fences on acceptance and Admin-only controls. Current discovery starts up to five requests for this four-Card Group. |
| Index/schema readiness: `groupExperiences/readiness.ts:7–18` | A fresh application worker connects, a required index is absent, or schema changes. Not a per-Card permission event. | Keep the accepted per-client/database/schema success cache and explicit provisioning. Warm checks already cost zero metadata commands. Do not create another runtime certification gate. |
| Provider upload verification and media delivery authorisation | Failed/incomplete upload, mismatched provider metadata, contribution hidden/revoked during provider latency. | Preserve these checks where operations/bytes are requested. They do not justify waiting for provider HEAD/playback/download verification before presenting known Card layout metadata. The current investigation does not change media delivery or security architecture. |

The final read/snapshot check cannot make browser data permanently current. Conversely, removing that separate request does not mean removing authorisation if the content request itself is protected. These are different decisions.

## E. Card data-lifecycle audit

### State ownership and lifetime

| Content | Current owner/cache | Navigation/remount and refresh behaviour |
| --- | --- | --- |
| Group canonical Card, progress/confidence and aggregates | Component-owned `groupResource` snapshot; `GroupExperienceDeck` presents it. | Normal `load()` preserves the previous `data` while pending. Leaving the Group disposes the resource and loses it. Authority invalidation normally retains the learning snapshot, which is why signals can remain when other sections disappear. |
| Own individual learning and date within a Group | Bootstrap's `own`/`ownDates`, selected through `presentGroup`; no extra Group CardData for this person. | Returned with the Group snapshot, unlike contribution sections. Dates are deliberately excluded from the foreign learning matrix. Context/source and existing learning reuse semantics must remain intact. |
| Ordinary Personal learning/date/legacy media/reflection | `AppShell` membership display plus module-level `workingCardStore` and working Deck state. | Has a usable owner-only cache. The warm presentation rule is limited to 60 seconds and invalidated by blur/hidden state. Group contribution readers do not reuse this complete presentation. `workingCardStore` explicitly refuses foreign/Group learning contexts. |
| Personal reflection preview in the shared editor path | `ReflectionAreaSession` local `feed`, initially `null`, even when the working Card already contains the Personal reflection. | Remount makes it absent until a new GET. Saving now updates this local feed immediately, reconciles the acknowledgement and rolls back failures correctly. That accepted fix does not make the feed survive unmount. |
| Own Group / inspected / collective / member reflections | The same local `ReflectionAreaSession`, keyed by full context. | Mounted separately for Deck/focused representations. Context change/unmount discards its feed. Focus/visible events and five-second polling refetch. Group read failures clear it; some own HTTP failures clear it too. Current-context filtering and the two-note Group presentation are already correct. |
| Media newest-five metadata/count/visibility | A `MediaCollectionController` created by `useMediaCollection` per component and context. | Ordinary in-place refresh retains a good page while pending. Cleanup calls `dispose()` and clears the page; the next instance starts at `null`. Any non-aborted refresh failure also clears the page, including transient failures. There is no reusable session registry for these pages. |
| Gallery page/selection | The accepted seeded collection controller and existing viewer. | Known selected media can open promptly. Do not replace this with a complete-history wait. Scope/removal checks still matter. It is separate from the thumbnail readers' lifetime. |

Key source:

- `src/components/group-experiences/GroupCardBack.tsx:23–50` maps absent media page to `[]`, chooses `--no-media`, and adjusts the reflection offset according to that empty list.
- `src/components/media/useMediaCollection.ts:10–24`; `src/lib/mediaCollection/controller.ts:31–59` own, refresh, clear and dispose media state.
- `src/components/reflections/ReflectionArea.tsx:21–65,98–128` owns feed lifetime, refresh errors and the accepted save protection.
- `src/components/decks/BackCardFaceContent.tsx:579–580` falls back to `card.backMediaItems` when its unified collection is unavailable. This helps legacy Personal items, but cannot preserve all Group-origin entries from a lost unified page.
- `src/components/decks/WorkingFocusedCardView.tsx:29` uses the independent Personal `ReflectionArea`.
- `src/lib/cards/workingCardStore.ts:40–87` contains actor/session guards, owner-only projections and scoped invalidation. `src/lib/cards/workingEntry.ts:7–18` defines Personal warm-entry freshness.

### Confirmed resume sequence

The hosted diagnostic began with a loaded Group Card back. It held subsequent authority GETs in the browser, dispatched the application's existing focus event, sampled after 250 ms, then released the responses. This exercises the actual resume handler without mutating the server. It is not an assertion that automated WebKit is identical to physical Safari background restoration.

Chromium observations:

| State | Focused Card node | Back-face node | Signal rows | Media entries | Collective/member notes | No-media layout |
| --- | --- | --- | ---: | ---: | --- | --- |
| Before focus event | 1 | 2 | 3 | 2 | Both present | No |
| Recheck pending | 1 | 2 | 3 | 0 | Both absent | Yes |
| After refresh finishes | 1 | 2 | 3 | 2 | Both present | No |

The unchanged node identities prove that **Card remounting is not required to cause this problem**. Child content is removed from the same physical Card. WebKit reproduced the same missing sections and no-media layout. By its 250 ms sample, verification had already become valid again through another completed check, but the newly mounted contribution feeds were still empty. Thus restoring `verified: true` alone does not restore the previous content.

Exact mechanism:

1. `GroupExperienceDeck.tsx:56` calls `resource.invalidate()` immediately on focus/pageshow/visibility changes.
2. `groupResource.ts:33` sets `verified: false`, preserving the existing learning snapshot.
3. `GroupExperienceDeck.tsx:105–112` changes Group/foreign media and reflection contexts to `null`. Its own-follower special case deliberately retains owner context; preserve that accepted protection.
4. The media hook disposes its controller, and the reflection component unmounts.
5. `GroupCardBack` maps the absent collection to an empty array and renders its no-media arrangement.
6. Successful verification creates fresh section readers; only their later responses restore content.

This is **not a recurrence of the corrected older-renewal-failure race**. It happens on the intentional invalidation path with no failed or out-of-order response.

### Confirmed ordinary focus/unfocus reconstruction

After a successful load, the diagnostic closed and reopened the focused representation while delaying only its media/reflection GETs by 1.4 seconds. Both engines showed three signal rows, no media and no reflection notes, despite valid authority. The sections appeared after their new requests completed. This is the component-local cache-lifetime problem independent of resume invalidation.

Deck and focused backs use separate readers; `GroupExperienceDeck.tsx:170–175` also deliberately mounts the reflection area only for the current applicable representation. Card/perspective changes therefore have legitimate different scopes but no saved complete snapshots to restore when returning to a previously authorised scope.

### Additional loss paths and stale data

- Media refresh catches currently set `page: null` for **all** non-aborted failures, not just 401/403. A temporary server/network error can erase known media. Source-confirmed; transient-503 injection was not separately run in this investigation.
- Reflection HTTP errors/context failures clear `feed`; Group-mode catch also clears on other failures. These paths can make a refresh look like an empty reflection. Source-confirmed, not measured as the cause of every physical report.
- Structure changes purge foreign follower rows and can make the effective perspective fall back from an inspected member to Group/Me while verification is pending. This protects privacy but couples a routine verification flag to visible perspective identity.
- Media generations/abort guards and actor/context validation already prevent many delayed responses from populating the wrong controller. Group resource generations, work revisions, write lanes and minimum structure revision protect against old bootstrap/save results. Reflection submission increments its read generation, pauses polling, patches only its exact source and reconciles its revision. These protections must carry forward into retained session state.
- Normal in-place media loading already keeps its existing page, and normal Group loading already keeps its existing snapshot. **Not every refetch blanks the Card.** The problem is disposal, context nulling and error handling around those otherwise useful controllers.
- A full page reload, Safari process discard or restored page that starts a new JavaScript runtime loses all current in-memory state, including `workingCardStore`. That is a new first-load boundary. The proposed session solution must solve ordinary live-page resume/remount; it cannot honestly promise instant recovery after process discard without additional persistent storage, which is not recommended here.

No real role revocation, sharing change or account mutation was performed during the hosted diagnostics. Correct denial behaviour is established from source and existing tests; additional cache-retention/revocation interaction tests are required when implementing the change.

## F. Proposed architecture

### 1. Background membership hints, without delaying login or private reads

After session establishment, asynchronously load the lightweight Group listing/roles through the existing listing capability. Reuse these hints for navigation, defaults and a membership-aware session registry. Do not use the full tile builder merely to discover membership.

If a user opens a known Group before this completes, start its protected data request immediately. That request performs current membership checks itself. Do not first await the background listing or issue a redundant browser authority preflight. A stale browser hint cannot authorise data or saves.

My Decks can retain its existing tile needs when actually displaying the collection. A known-Group direct route should not first assemble all ordinary Deck displays and all Group tile content. Whether accomplished within the existing route or a small route-level branch is an implementation choice; neither requires a new service or login flow.

### 2. One coherent initial read for the required visible Card

Compose a protected Group opening read using existing repository/query helpers and one appropriate snapshot transaction. Return the selected Deck outline, effective perspective, current authority/revision metadata, necessary learning/aggregates/date, current reflection preview data and newest-five media metadata/count/capabilities.

Reuse server-authorised query components **within that read**. Do not implement composition by calling the existing HTTP routes sequentially or by nesting multiple public repository transactions. Preserve the foreign-field allowlists, selected publication checks and independent contribution ownership.

The detailed follower comparison matrix and other Cards' contribution feeds can follow when needed, or prefetch after the initial Card is complete. Required counts still need correct aggregation; omitting the raw matrix must not omit those counts. Fetching another Card with no saved snapshot should have a deliberate readiness boundary before presenting it, rather than an empty temporary back. No new loading design is prescribed by this report; reuse the existing scene/loading boundary without altering geometry or timings.

Individual reflection previews need only the current context's reflection. Today's owner reflection feed also retrieves the author's other Group origins and their edit-explanation metadata (`reflections/reads.ts:39–66`), even though those entries are not displayed in the preview. Keep the unified history retrieval and stored history intact, but do not require that whole history and all its origin checks to assemble this current-context snippet.

### 3. Session ownership of complete Card snapshots

Move lifetime ownership above the Deck/focused component instances. Retain each successfully completed read model for the signed-in session, and let existing views/controllers subscribe to it. Unmounting a representation stops its listeners/transports; it does not destroy the last good content.

Scope entries by authenticated actor, Group, CardTemplate, perspective/subject and exact source. Keep adopted-version/access/revision metadata for validation and targeted replacement. Do not key physical Card nodes by every changing revision. Owner history, Group shared media and inspected-member projections must remain distinct; “same Card” never means interchangeable permissions.

Reuse `workingCardStore` for its existing owner-only fields and source identity, plus the current media/reflection controller logic where suitable. A small Group session read-model owner is needed because the current resource is component-owned and the Personal store intentionally rejects Group/foreign contexts. Do not duplicate the same Group snapshot into a second component cache, and do not add Redux, a caching library, IndexedDB or browser-persisted private payloads.

Represent **unknown** separately from **known empty**. Until all required initial sections are known, do not present the complete Card scene. Once a snapshot is complete, retain it through background requests. A confirmed empty collection is a valid no-media layout; a pending request is not.

### 4. Background refresh and targeted editing freshness

Separate “we have a complete authorised snapshot to display” from “this action's capability/revision is freshly verified”. Resume triggers a background check; it should not synchronously null contribution contexts or switch the visible perspective. While necessary checks run, retain the same Card and disable only affected editing actions. Navigation and flipping need not inherit the current whole-Card `interactionLocked={!verified}` rule solely because refresh is pending.

Server reads and saves remain authorised. An edit that can safely be submitted with the known source and expected revision need not perform a separate preflight; its existing save validates current membership, role, revision and idempotency atomically. A rejection uses the existing rollback/draft/error handling. Do not remove the membership/adoption fences that prevent concurrent revocation or delayed uploads from bypassing permissions.

Consolidate refresh ownership for the active Group instead of letting full bootstrap, renewal and multiple contribution instances independently reread the same scope. Reuse coalescing and the accepted old-failure/new-grant ordering. Do not simply suppress errors or extend grants indefinitely. Ordinary learning/reflection changes update their fields; source/adoption changes replace the affected complete snapshot; genuine access denial removes the affected scope and exits it appropriately.

The separate two-second renewal was introduced to keep the five-second lease alive while slower full content loading was pending. Its frequency is not required by JWT authentication, MongoDB or a media provider. A completed authorised content refresh can supply the same current scope evidence; a separate narrow check is useful when no suitable refresh is available. There is no need to assume that a full refresh every four seconds and an additional heartbeat every two seconds must both remain forever. Choose the minimal bounded refresh/check schedule after separating display continuity from edit freshness, retaining a prompt resume check and explicit denial handling.

### 5. Revocation, account change and failure policy

- **Confirmed account change / 401:** clear the old account's retained Group/private state and reject all old-generation responses. Do not show the previous account's Card while the new account loads.
- **Viewer removed / 403:** remove that Group's protected snapshot/overlays. Retain ownership-based histories only through their independently authorised owner context.
- **Inspection turned Private or subject removed:** evict/stop showing that inspected scope when confirmed, without deleting unrelated own history or resetting the whole Group unnecessarily.
- **Admin loses role but remains follower:** remove edit/settings/moderation capabilities and retain only the read scopes still authorised. Other Admins continue editing the same collective reflection.
- **Accepted Deck update:** validate new selection/revisions and atomically apply the updated Card manifest/readiness. Preserve stored histories and surviving Card identities. Publication without acceptance is not adoption.
- **Ordinary collaborative update:** refresh changed values only; do not invalidate permission or clear all sections.
- **Pending check / temporary error:** retain last good content and distinguish stale editing capability from revoked access. Never treat an old failed request as stronger evidence than a newer matching success.

There is a genuine policy boundary: the new requirement to keep known foreign content visible during routine checks differs from the current “hide it when the five-second display lease expires” policy. **The same five-second threshold can remain for edit freshness without being a display-deletion deadline.** That does change the display policy and should be explicit in implementation approval, rather than silently removing expiry tests.

One unresolved case is a prolonged offline/unverifiable connection: should previously authorised **other-member/Group** content remain visible read-only until the server reports denial, or be concealed after a defined failure interval? Routine resume retention is already specified; this question concerns sustained inability to contact the server. No polling architecture can know about a remote revocation instantly while offline. Retain current protections for this exceptional case until its replacement is approved; no push service or new infrastructure is proposed.

## G. Prioritised implementation recommendations

| Stage | Essential change | Expected effect and evidence | Main files / risk |
| --- | --- | --- | --- |
| 1 — Complete snapshot lifetime | Retain exact-scope media/reflection/learning state above view instances; distinguish unknown/empty; stop clearing known sections merely because a routine check starts; add initial Card readiness. | Directly addresses both reproduced content-loss mechanisms. Eliminates the **partial-presentation interval**, currently roughly 0.7–1.4 s in the hosted samples. This is not a claim of 0.7–1.4 s faster complete loading; a correct first presentation may initially wait longer until Stage 2. | `GroupExperienceDeck`, `groupResource`, `GroupCardBack`, shared media hook/controller, `ReflectionArea`, scoped session owner; medium risk around privacy and mutation reconciliation. Keep this coherent rather than adding competing caches. |
| 2 — Compose Group opening and remove repeated entry work | One authorised initial read; reuse membership/selected content/learning reads within it; fetch required contributions before publishing the Card; bypass unrelated collection work on known-Group entry; background membership hints. | Removes the two separate authority network waits and repeated reads across three APIs, while moving necessary contribution work into the first read. In the representative sample the two authority calls consumed about **1.16 s** combined, so that serial overhead is a concrete opportunity. It is not a guaranteed 1.16 s net saving: the composed response has additional necessary work. Immediate repeat presentation should come from Stage 1's cache, not a new network target. | `decks/page`, `AppShell`, auth-success integration, Group HTTP/read-model functions and controller. Medium scope; maintain foreign projections and do not load every Card's detailed contributions first. |
| 3 — Consolidate background refresh | One active-scope refresh owner, narrower changed-data handling and action-level freshness; preserve denial/order/epoch rules; apply approved prolonged-failure policy. | Reduces duplicate polling and repeated contribution remounts; no exact request-rate or latency gain claimed before implementation. Current 4/2/5/15-second mechanisms are verified. | Group resource/deck, update discovery, media/reflection subscribers. Medium correctness risk; needs deterministic revocation/stale-response tests. |
| Independent platform check | Assess placing the existing Vercel Functions close to the existing Atlas region, subject to separate configuration approval and plan support. | Confirmed region mismatch; gain unquantified. A controlled same-build comparison can establish whether this materially reduces database round-trip latency. It does not solve component state loss. | Existing Vercel region configuration only; no new service/database. No setting changed in this investigation. |

These are implementation checkpoints within one focused correction, not separate new product phases. Design the initial-read contract and cache ownership together; do not build temporary caches that Stage 2 discards.

Optional later work: prefetch the next Card after the current one is complete, reuse immutable selected template payloads by exact version, and tune comparison loading if measured. None requires a new library or speculative hundreds-of-Groups design. Do not promise a sub-second first network load without measuring the composed path.

Keep the following completed work intact: old-renewal/new-grant ordering; optimistic exact-source reflection submission/acknowledgement/rollback; warm schema-check reuse and parallel independent reads; seeded immediate Gallery opening. No Card stack geometry, gesture thresholds, motion timing, media provider/storage rules, reflection ownership, deferred moderation or Info Card work is part of this recommendation.

## H. Regression and verification plan

### Deterministic controller and storage coverage

Extend the existing tests rather than inventing a second harness architecture:

- `tests/group-experience-client.test.ts`: retained complete snapshots through dispose/remount/subscription changes; matching-scope refresh; new account/Group/Card/subject cannot receive old results; continued older-failure/newer-success protection; real expiry, denial and scope-change tests adjusted only to the explicitly approved display/edit distinction.
- `tests/media-collection-client.test.ts`: known data survives pending/transient refresh and ordinary view unmount; true denial clears affected foreign content; exact source identity and selection survive insertion/removal/pagination; no owner page leaks into an inspected Group page. Preserve immediate seeded Gallery coverage.
- `tests/reflection-feedback.test.ts` and reflection controller/browser tests: seed from the retained exact-source snapshot; delayed reads cannot replace a submitted value; failed saves reconcile/retain draft; rapid edit/reopen works across retained views; collective and member slots remain separate.
- Group integration tests: one composed snapshot authorises once within its transaction, projects only allowed foreign fields, preserves own/history semantics, filters hidden contributions, and rejects genuine membership/publication/adoption changes. Learning/default-row validity checks, write fences, revisions, concurrent Admin conflicts and provider verification remain protected.
- Add query-count diagnostics for the composed path on disposable data. Count authentication, contribution and update-discovery work separately; do not report only a smaller bootstrap subtotal. Preserve the warm zero-metadata assertion and cold-instance correctness.

### Chromium and WebKit, mobile width and touch

1. First open with independently delayed learning/media/reflection responses: no incomplete Card is presented; the eventual Card has its final layout. Known empty content gives the correct genuine empty state. Media byte delays use reserved thumbnail positions and do not block on Gallery/video resources.
2. Reopen the same Card, flip it, focus/unfocus, navigate to another Card and return, leave/reenter the Deck: complete retained content appears without empty-section frames. Returning to an authorised previously visited perspective reuses only that exact scope.
3. Dispatch focus/pageshow/visibility restoration with delayed and out-of-order reads. Keep the same Card/face and content while checking; editing follows its capability state. Confirmed revocation must still remove foreign data. Test real browser visibility where supported in addition to synthetic events.
4. Switch accounts while requests/saves are pending: no old-account payload flashes. Shared-to-Private inspection, subject removal, viewer removal and role-only loss each have distinct expected effects. Use disposable databases/accounts for these mutations.
5. Normal collaborative progress/reflection changes update their fields without clearing media or switching perspectives. Adopt a Deck update explicitly; preserved Cards retain histories, removed Cards cease to be selectable and newly required Card data has a readiness boundary.
6. Personal independently: reflection Add/Edit/save failure, immediate preview, unified owner media, focus/re-entry, Gallery/video/download controls and normal Card flips/traversal. The shared controller changes must not make Personal wait for unrelated Group data.
7. Preserve physical Card node identity during comparison, refresh and overlay use; retain existing motion and read-only signal gesture/tooltip regression coverage. A faster data path is not authorisation to retune animation.

### Performance and physical iPhone acceptance

Repeat the same hosted review Group/account/browser journeys and report **both** complete-first-Card time and immediate cached-revisit behaviour, not merely stack appearance. Record HTTP overlap, data bytes, all relevant Mongo command counts, recurring request rate, complete-data readiness and browser-visible presentation. A future approved diagnostic build should add temporary scoped server timing if an exact hosted database/auth split is required; no production credentials or personal content should be logged.

On physical iPhone: open/reopen Card 1, change Cards and perspectives, focus/unfocus, return to My Decks, briefly background Safari, then leave it inactive longer. Note whether Safari resumed the live page or reloaded it. Check media/reflections remain together with signals, editing recovers correctly, and real-photo Gallery/video/download behaviour stays unchanged. Use existing review data for non-mutating checks; permission-change tests need explicitly identified disposable content/accounts.

**Remaining evidence limits:** no physical iPhone trace, no simulated Safari process kill, no hosted per-query spans and no controlled same-region deployment. The investigation confirms actual partial-presentation mechanisms and measured request dependencies; it does not claim to have observed every reported iPhone instance or measured a future implementation's speed.

### Approval boundary

Approve the focused snapshot/session/refresh implementation before source changes. The only unresolved product policy is prolonged offline/unverifiable display of previously authorised foreign content, described in F. A Vercel region change would require separate explicit configuration approval. No implementation, build, deploy, fixture reset or commit is included in this investigation.
