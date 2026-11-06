# Group Experiences — iPhone regression investigation

> Follow-up: the four approved corrections, updated Preview and final verification are recorded in [the iPhone corrections handoff](group-experience-iphone-corrections-handoff.md). This document retains the original checkpoint/investigation evidence.


Date: 6 November 2026. Investigation only; fixes require founder approval.

Target: `feat/group-experience`, working implementation deployed as `dpl_91HZqU9QbcC8rH44sNoaVSMw6VR4`:

```text
https://switchplay-app-opuj2i8iy-peter-meehan-domokos-projects.vercel.app
```

Comparisons:

- Immediately before Deployment Checkpoint 1: committed `7d6102c`.
- Current Preview: that commit plus the checkpoint changes inventoried in `group-experience-deployment-checkpoint-1-handoff.md` (18 files before this investigation).
- Before Group shared presentation changes: `a4e4f8f`, parent of `39aa33a`. An unchanged source export ran beside the current source against the **same new disposable database**, using the same long Deck title and browser viewport. This is a pre-Group UI baseline, not a claim to know the last build physically accepted as smooth.

## A. Executive findings

1. **There is a confirmed new access-check race in this checkpoint.** A slow old renewal can withdraw a newer successful verification for the same membership/version. The grid's visible state depends directly on verification, so this produces a close/reopen path while leaving the focused Card mounted. A controlled reproduction demonstrates the state sequence. The sustained one-second loop was **not** reproduced naturally in either deployed browser run; its exact occurrence on the iPhone remains unproven.
2. **The reflection delay is a confirmed earlier Group Experiences regression affecting ordinary Personal Cards too.** Phase 10 stopped using the existing optimistic Personal reflection setter. The new editor closes after POST succeeds, then waits for a GET before updating its preview. With a controlled 900 ms GET delay, current Personal and Group previews remained stale for about 930–980 ms after closing. The old Personal preview was already updated before closing.
3. **Group and Gallery latency is confirmed and substantially application-driven.** The Group bootstrap makes five dependent HTTP requests, although three page reads are independent once the initial authority is known. Every newly constructed Group repository enumerates collection/index metadata again. A small authority read performs 18 MongoDB commands, 11 of them metadata checks. Gallery waits for a new metadata request before mounting its existing viewer. These paths predate this checkpoint; the new two-second renewal adds further steady-state work.
4. **The reported continuous stack vibration and general Personal jerkiness are not conclusively attributed.** Both old and current Personal implementations showed short initial settling, then stable positions. No continuous vertical oscillation appeared in the measured idle windows. Group WebKit motion was expensive in one disposable development run; Personal results varied by engine. Neither result proves or disproves a physical Safari regression.
5. **The original retained review image is a 1 × 1 PNG.** Both deployed engines successfully decoded `deployment-image-check.png`, contribution `9e388223-90ad-49e0-9678-f363c1cbbc37`. It is a provider probe, not useful visual acceptance content. It can look blank without a failed request. This does not establish that every reported blank image was that item or eliminate an intermittent viewer problem.

The current checkpoint should not be described as physically accepted. Fix the confirmed renewal race, address the confirmed reflection/latency problems as agreed, and retain the unresolved motion observations for targeted iPhone investigation rather than rewriting the animation system.

## B. Regression and root-cause matrix

| Issue | Reproduced? | Root cause / classification | Introduced when? | Evidence | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| A — Repeating comparison grid | Natural sustained loop: no,25seconds per deployed engine after settling, or35seconds in an additional early focused-back WebKit run. Same-scope access race: yes, controlled transport/clock reproduction. | **Confirmed latest-checkpoint regression:** an old expired renewal invalidates a newer successful grant. **Not yet established:** that it caused the reported natural loop. Existing expiry can independently hide the grid. | Independent `renewAuthority()` added in the current uncommitted checkpoint; grid's verification gating existed in Phase 4. | `authority-race.json`; `groupResource.ts` `renewAuthority`, `verificationFailed`, `grant`; `GroupExperienceDeck.tsx:128,172,176`; live DOM identity trace. | Protect a newer successful same-scope grant from an older timeout/expiry failure; retain immediate denial on actual revocation/account/scope conflict. Keep existing lease duration and focused object. |
| B1 — Initial high/clipped stack | Short initial positioning changes reproduced; exact screenshot displacement not reproduced. | **Confirmed pre-existing mechanism:** post-paint viewport sizing and motion layout settling. **Not yet established:** whether that explains the particular Group-only displacement. | `useDeckSceneLayout` and stack geometry predate Group UI; Group wrapper added `39aa33a`. | Historical/current source comparison; long-title initial position traces; founder screenshot. | First capture iPhone frame/header/viewport transforms during the displacement. If it is the initial scale-one paint, gate geometry or measure before paint narrowly; do not change fixed stack constants without proof. |
| B2 — Continuous close-position vibration | No sustained oscillation in deployed 15-second idle or disposable 8-second idle windows. | **Not yet established.** Measurement/layout feedback and Group revalidation are candidates, not proven causes. | Unknown. | Stable post-settle stack coordinates in both engines; unchanged measurement math; Group-specific transform wrapper and frequent renders documented below. | Correlate actual repeated positions with viewport, verification and motion transforms before deciding a fix. |
| C — Jerky ordinary Personal animations | Flip/traversal exercised in both engines and native Chromium touch. A consistent Personal regression was not reproduced. | **Not yet established.** Shared media/reflection work changed; original stacking, gesture algorithms and motion constants were not rewritten by Group work. | Potential contributors: Phase 4 shared adapters, Phase 7 media polling, Phase 10 reflection controller. | Historical/current motion samples and full shared-code audit below. | Target measured render/network work; obtain the exact iPhone sequence and a comparable physical baseline. Do not replace animation parameters based on these results. |
| D1 — Gallery slow to open | Yes: 2.87 s Chromium, 3.90 s WebKit in the initial deployed run. | **Confirmed earlier Group Experiences issue, environment-amplified:** metadata-first viewer mounting plus expensive reads. | `CollectionGallery` introduced `2dd1c0d`; shared collection infrastructure `642171d`; Group media reads `8dc572c`. | Deployed request timings; `CollectionGallery.tsx:11–17`; media read profile. | Reuse the already-authorised selected item to open the existing Gallery promptly; fetch bounded history without hiding the whole viewer. Preserve source identity and revocation handling. |
| D2 — Blank image | An original image looking blank is explainable: successful 1 × 1 fixture decode. Intermittent failure of a real photograph: not yet established. | **Confirmed current-checkpoint fixture weakness**, plus **not yet established** intermittent loading failure. No observed image authorisation failure in the initial read-only run. | One-pixel probe retained during this deployment checkpoint. Existing image loading/error component predates Group work. | Actual image dimensions, source identity and HTTP trace; real-photo follow-up below. | Use real review media for visual acceptance; keep explicit loading/error/retry in the existing Gallery. Do not label a successful one-pixel decode as provider failure. |
| E — Saved reflection appears late | Yes, both current Personal and own Group contexts; historical Personal comparison is immediate behind the modal. | **Confirmed earlier Group Experiences regression.** Save path bypasses optimistic setter, closes modal, then refetches. | `36bbd6f` Phase 10; `9a7eb86` retains this save lifecycle in the final redesign. | Disposable delayed-read comparisons; `WorkingFocusedCardView` discards `onCommitReflection`; `ReflectionArea.tsx:98–105`. | Update exact-source local state on submission/acknowledgement, with revision and stale-response protection and rollback on rejection; background refresh must not gate the preview. |
| F — Group load 4–5 s or longer | Yes; measured full navigations were even slower (11.52–14.72 s to visible Group stack). | **Confirmed earlier Group Experiences implementation cost, environment-amplified.** Additional frequent heavy authority reads are a **confirmed latest-checkpoint overhead**. Cold-start contribution not isolated. | Index-read architecture in `eedccd2`; bootstrap waterfall in `39aa33a`; two-second renewal in current checkpoint. | Five-stage waterfall, SSR source, command counts and timing tables below. | Remove repeated index inventories from hot requests, keep current membership checks, reduce duplicate content reads, and parallelise independent bootstrap pages while retaining revision checks. |

### A: exact demonstrated state sequence

`comparisonOpen = expanded && focused && boot.canInspectFollowers && state.verified`.

The opening intent (`expanded`) is not itself a timer. Picker actions, collapse, focus closure and an empty Deck change it. Motion completion and layout measurements do **not** directly call `setExpanded`. The rendered grid can nevertheless disappear without changing that intent when `verified` becomes false.

Controlled reproduction against the **unchanged current resource**:

1. Initial authority succeeds at time 0.
2. A renewal starts at 1,000 ms and is held.
3. A separate full load succeeds at 4,000 ms, establishing authority valid through 9,000 ms.
4. The old renewal arrives at 6,001 ms. Its own age exceeds five seconds.
5. Its error handler sees the same scope/revisions and calls `verificationFailed()`, cancelling the newer valid grant.
6. The next renewal succeeds. Verification changes **true → false → true** without membership, account or publication changes.

The existing render conditions then remove/recreate the comparison panel and change the focused Card's comparison fraction **0.38 → 0 → 0.38**, causing visible resizing. The same stale-failure problem can affect suspended media overlays.

Before this checkpoint there was no independent renewal channel, so this particular overlap did not exist. However, genuine lease expiry and the grid's expiry-driven disappearance already existed. It would be inaccurate to attribute every observed grid loop to the new race without the iPhone event trace.

In both natural deployed comparison runs, the focused stage retained the same diagnostic DOM identity across grid opening; it was not replaced by a second focused Card. The approved object-continuity requirement is still implemented. Panel removal and Card rescaling are distinct from Card remounting.

## C. Change-history audit

The full path-filtered history is retained in ignored `phase2-test-results/iphone-investigation/change-history.txt`. Relevant material changes are listed here; untouched mechanisms are identified explicitly.

| Commit / checkpoint | Before → after and reason | Personal impact and attribution |
| --- | --- | --- |
| `eedccd2` — Group foundations, 29 October | Add instance-local repository readiness and repeated collection/index enumeration before first transaction per instance. | HTTP repositories are rebuilt per request, so this is the origin of repeated schema-read overhead. `ec863de` later adds the legacy-name existence check; provisioning indexes does not remove the enumeration. |
| `a4e4f8f` — pre-Group UI baseline, 29 October | Existing shared DeckScene, CardStack, focused Card, gestures, measurements and optimistic Personal reflection workflow. | Unchanged historical export used for comparison. Not a certified last smooth physical build. |
| `39aa33a` — Phase 4, 30 October | Add Group presentation adapters, optional comparison fraction, face-change reporting, perspective exchange wrapper, picker/grid and Group polling. Reuse shared physical scene instead of copying Cards. | Personal still traverses changed `DeckScene`/`FocusedCardView`. Its fraction defaults to zero; explicit 18px bottom padding matches existing CSS. Exchange component adds no DOM wrapper when Personal identity is absent. New Group wrapper uses transforms/preserve-3d. Possible composition/measurement risk for Groups; not proof of Personal jank. |
| `39aa33a` — server entry and resource | `/decks` now also gathers Group tiles; Group scene waits for authority → presentation → perspectives → aggregates → final authority. Expiring access bounds peer display. | Initial Personal `/decks` document also pays Group tile retrieval. No Group scene polling continues after its component unmounts. Earlier Group implementation, not a new bucket effect. |
| `39aa33a`, `cccb0ba` — signals/progress and visual alignment | Shared BackCardFaceContent supports Group read-only signals, custom headings/identity; pulse SVG definitions memoised; explicit Group progress slots and count annotations match Personal geometry. Refine picker-to-grid transition. | Personal uses these shared components. Read-only parameters default off for editable Personal rows; memoisation was intended to reduce work. CSS selector changes preserve ordinary strip offsets; generic confidence colour/weight changed. These are real shared changes, but no observed causal link to C. |
| `76064aa`, `974175f` — Phase 5 | Contextual Progress navigation; Group Card composition reconciliation; all-skipped neutral styling and reserved header slots. | Personal all-skipped headers/strips and shared confidence appearance changed. No change to core swipe thresholds or stack positions. No evidence tying these paint changes to ongoing oscillation. |
| `642171d` — Phase 7A | Add typed collection adapters/controllers, source-aware owner history and bounded Gallery pagination. Personal viewer can merge Group-origin items. | Personal Gallery and thumbnail paths acquire collection reads; previously Personal arrays were locally sufficient. Potential latency/render contributor requiring attention, not a demonstrated animation regression. |
| `2dd1c0d` — Phase 7B | Add CollectionGallery and shared CardMediaCentre; move management out of WorkingFocusedCardView; add icon/count and approved visibility UI. | Personal uses changed management/viewer plumbing. Group Gallery waits for page metadata; Personal viewer can initially use existing local Personal media. Shared CardMediaViewer remains the renderer. `DeckDetail`/`WorkingFocusedCardView` changed overlay ownership and interaction locking; `WorkingCardMediaViewer` gained source-aware metadata/paging, while `CardMediaViewerVideo` and the download button gained Group targets. No independent replacement Gallery or Card stack was introduced. |
| `4447011` / `00a157e` — Phase 7 review refinements | Filenames/By–In metadata, source-aware Remove rules, read-only gesture shielding/tooltips, visibility indicators and owner media preservation while Group checks are pending. | Shared signal event handling and media components changed. Personal editable rows keep the original gesture branch; Group read-only rows intercept swipes deliberately. Not evidence that ordinary Personal flipping was rewritten. |
| `36bbd6f` — Phase 10 | Shared ReflectionArea and source-aware reflection API replace the Personal-only editor state path. Current WorkingFocusedCardView explicitly ignores its `onCommitReflection` prop. | **Confirmed regression E:** the previous optimistic `useWorkingDeck.commitFocusedReflection` still exists but is bypassed by the current editor. New five-second reflection polling and post-save reads affect Personal too. |
| `9a7eb86` — final Phase 10 redesign | Select only current-context individual notes; shared Group note and manual member carousel. Preserve source/revision architecture. | Keeps the new non-optimistic save/refetch path. Reflection text/layout edits do not modify stack coordinates. No auto-carousel timer remains in the approved preview. |
| `225f957` — Phase 11 | Explicit Admin Group Update controls and protection against old background responses misreporting committed changes. | Group-specific update controls. No changes to shared core stack/gesture implementation. |
| `7d6102c` — before latest checkpoint | Remove the two unnecessary environment gates. | Already the baseline before deployment work. Group tile queries are now unconditional deployed functionality; do not restore flags as a performance workaround. |
| Current uncommitted checkpoint | Shared user-data R2 bucket selection; Stream empty-success cleanup handling; deploy exclusions; separate authority renewal; newest-page refresh for the two thumbnail consumers; tests/docs/index provisioning. | Only latest shared Personal presentation change is thumbnail refresh policy, plus the shared hook/controller option. Gallery's anchored refresh remains default. **New confirmed race is in Group authority renewal.** No changes to DeckScene, CardStack, FocusedCardView, gesture thresholds, layout CSS or motion durations in this checkpoint. |

### What was not rewritten

`git diff a4e4f8f HEAD` is empty for `CardStack.tsx`, `src/constants/cardStack.ts` and the shared `decks/gestures` implementation. The last material core stack/gesture changes predate Group UI. Existing timings remain: traversal360ms, focus420ms, defocus340ms, flip680ms, restore240ms. The Group-specific exchange adds a separate160ms transition; it does not replace them.

`getDeckSceneLayout`/`useDeckSceneLayout` retain the pre-Group measurement algorithm: initial scale1 and unset frame height; measure viewport minus frame top in an effect; observe detail/frame; respond to viewport resize/scroll and scheduled updates. The Group path imports the same `DeckScene`, `CardStack` and `FocusedCardView`, adding a perspective transform wrapper and data adapter. It is not a separately implemented stack.

This rules out a wholesale geometry rewrite, **not** indirect regressions from wrappers, extra renders, observers, media polling or server-driven state changes.

### Motion and layout observations

- Deployed normal comparison: same focused stage node before/after grid opening; no natural grid oscillation in25seconds per engine. A separate early focused-back WebKit grid run stayed open for35seconds. The real-photo run did show repeated access-indicator alternations before the Gallery tap; access instability is therefore observed, but a natural grid loop was not reproduced. Initial stack position settled by a few pixels, then stayed stable over the measured15second idle window.
- Equal long-title disposable comparison: pre-Group/current Personal initial movement about12.0/13.9px in Chromium and7.16/7.22px in WebKit; all measured8second settled idle windows had zero stack-top range. These are short startup movements, not the reported continuous vibration.
- Flip plus vertical traversal, mobile viewport414×740, development builds, single sample per case:

| Engine | Pre-Group Personal p95 frame interval | Current Personal | Current own Group |
| --- | --- | --- | --- |
| Chromium, pointer drag | 16.8ms | 33.3ms | 33.4ms |
| WebKit, pointer drag | 36ms | 18ms | 121ms |
| Chromium, native touch input | 16.7ms | 16.8ms | 33.3ms |

All tested flip/traversal paths completed. Current Group WebKit stalling is a concern, not a demonstration of its root cause. Personal results do not show a consistent cross-engine regression. These short development/headless samples are not physical iPhone GPU/compositor acceptance or reliable production performance budgets. Earlier diagnostic swipes accidentally hit reserved title/creator controls; those failed attempts were excluded, not called product failures.


### Reproducible history and source references

```sh
git diff a4e4f8f HEAD -- src/components/decks/DeckScene.tsx src/components/decks/FocusedCardView.tsx
git diff a4e4f8f HEAD -- src/components/decks/CardStack.tsx src/constants/cardStack.ts src/components/decks/gestures
git show 36bbd6f -- src/components/decks/WorkingFocusedCardView.tsx src/components/reflections/ReflectionArea.tsx
git diff 7d6102c -- src/components/group-experiences/groupResource.ts src/components/group-experiences/GroupExperienceDeck.tsx src/components/media/useMediaCollection.ts src/lib/mediaCollection/controller.ts
```

Primary current locations: `GroupExperienceDeck.tsx:128` gates grid visibility, `:172` changes comparison geometry; `groupResource.ts:54` starts renewal and `:74` rejects an expired response; `DeckScene.tsx:83` measures frame geometry and `:110` starts with default layout; `CollectionGallery.tsx:17` suppresses the viewer pending metadata; `ReflectionArea.tsx:105` closes then refetches; `groupExperiences/indexes.ts:28` enumerates schema; `cards/protectedMedia.ts` is a separate canonical media path, not the Group Gallery image route.

## D. Performance analysis

### Deployed observations

Full authenticated navigation to the existing Group, before any diagnostic data mutation:

| Measurement | Chromium | WebKit |
| --- | --- | --- |
| Document/DOMContentLoaded observed | 4.60s | 2.92s |
| Five initial Group HTTP responses, sum | 9.84s | 8.19s |
| Remaining client dispatch/hydration/render/waiter overhead | about0.29s | about0.41s |
| Group stack visible from navigation | 14.72s | 11.52s |
| Gallery tap → dialog visible | 2.87s | 3.90s |
| Gallery metadata HTTP request | 2.71s | 3.46s |

This was a complete URL navigation, not a cached click from an already-open My Decks page. It must not be presented as identical to the founder's four-to-five-second journey. It establishes a real slow path and its waterfall.

Initial Group sequence, in order, with response times:

| Endpoint | Chromium | WebKit |
| --- | --- | --- |
| Base Group read | 3.17s | 1.54s |
| Presentation page | 1.74s | 1.67s |
| Perspective page | 1.74s | 1.68s |
| Aggregate page | 1.74s | 1.83s |
| Final base Group read | 1.45s | 1.47s |

Almost all each response's duration was before first byte, rather than transferring JSON. Initial scripts/styles/fonts typically transferred in tens of milliseconds. The evidence points to serial server/request work, not a multi-second client render being the main initial-load cost.

`src/app/decks/page.tsx` first awaits authentication, then personal memberships, then Group tiles before returning AppShell. `groupResource.load()` adds the five serial client requests. Independent page reads are currently awaited in sequence. All reads still need correct actor/revision validation; removing them indiscriminately would weaken established access rules.

### Database command profile

Separate **local Node-to-Atlas** measurements, using monitored commands and fresh repository instances to match request lifecycle. These are not invented Vercel internal spans:

| Read | Warm elapsed | MongoDB commands | Collection/index commands | Metadata time within that local sample |
| --- | --- | --- | --- | --- |
| Authentication user lookup | 11ms | 1 | 0 | 0 |
| Personal membership projection | 82ms | 6 | 0 | 0 |
| Group tiles | 275ms | 24 | 11 | 115ms |
| Base Group / authority | 200ms | 18 | 11 | 111ms |
| Presentation | 232ms | 21 | 11 | 114ms |
| Perspectives | 237ms | 21 | 11 | 112ms |
| Aggregates | 254ms | 22 | 11 | 116ms |
| Group media feed | 282ms | 25 | 13 | 132ms |

The first local Mongo connection took329ms. A second operation round reproduced similar costs. The five bootstrap reads total about100 repository commands, plus their HTTP authentication lookups;55 of the repository commands enumerate collection/index metadata. These checks do not become cheaper merely because the indexes exist.

`GroupExperienceRepository.ready` is instance-local; HTTP requests construct new instances. `assertGroupExperienceIndexes` therefore checks the legacy collection, existence of five collections and their index lists repeatedly. Media adds its own readiness checks. The two-second renewal uses `groups.get()`, which also loads and validates Deck/Card publications, not only a small membership identity.

This does **not** mean user permission checks should be cached away. Membership/role/scope checks are necessary; repeated deployment-schema enumeration and repeated full content selection are separate work.

Vercel internal authentication/JWT duration, individual hosted database spans, connection reuse/startup duration and function cold-start time were **not directly observable without changing/instrumenting the deployment**. The first request was slower, but two browser runs do not establish a cold-start cause. No database profiler was enabled, no deployment/configuration was changed, and no estimated region/network explanation is presented as measured fact.

### Gallery path and blank-state distinction

1. A valid tap stores overlay/source identity locally; it does not start an upload or check upload metadata.
2. `CollectionGallery` mounts a new bounded30-item controller and returns `null` until metadata arrives. No Gallery dialog/loading state is visible during that wait.
3. The controller obtains an authorised Group feed. This includes current Group/Card access, contribution filtering, counts, identities and index-readiness checks.
4. The existing CardMediaViewer opens at the selected typed identity.
5. Its image uses the same application-mediated `/api/group-media/{id}?action=playback&experienceId=...` image URL as the thumbnail. This is not a separate low-trust thumbnail service.
6. Image delivery authorises the contribution, performs R2 GET and rechecks authority/revision afterwards. Upload allocation, HEAD/metadata verification and upload completion are separate operations, **not** repeated for an ordinary image display.
7. A failed image load already has `Loading image…`, an error and `Retry image` in CardMediaViewerImage. Those controls cannot explain away the metadata-stage silence, a suspended viewer, or a successfully loaded but visually empty1×1 image.

Image requests observed around opening took approximately2.7–3.7seconds. Thumbnail and Gallery URLs overlap, so every request cannot be uniquely attributed to one element from this trace alone. The original image ultimately decoded as1×1, with no image HTTP failure in the first browser run. Protected responses use `private, no-store`; an already decoded thumbnail does not guarantee a new viewer instance avoids another authorised request.

**Real-photograph follow-up:** WebKit waited until the real thumbnail had decoded, then tapped that exact photo. Gallery appeared after2,419ms and the3024×4032 photograph was already decoded/visible3ms later. The metadata request took2,012ms. No real-photo blank reproduced in this run. The thumbnail and Gallery had the same authorised source URL. Evidence: `live-photo-readonly.json`; screenshot `webkit-real-photo.png`. This excludes the one-pixel probe and blocks reflection reads that write internal counters.

This fresh-load run also captured genuine verification-banner oscillations before the tap: several verified/unverified alternations between18.5s and29.9s. The grid was not open at that time, so this proves natural access-state instability but not yet the reported repeating grid. A separate early-grid WebKit check then opened comparison as soon as the focused back was available: it stayed open for35seconds with the same focused stage node. Its only503 responses were the deliberately blocked reflection endpoint. Evidence: `live-grid-early-readonly.json`.

### Reflection lifecycle and measured delay

Historical: `WorkingFocusedCardView` called `useWorkingDeck.commitFocusedReflection`; it applied `withUpdatedReflection` to local Cards **before** awaiting persistence, rolling back if persistence failed. The modal closed after the awaited operation, by which time the preview was updated.

Current: `ReflectionArea.apply` awaits POST; invalidates the Personal overlay where relevant; closes the modal; awaits a feed GET; then broadcasts an event that also triggers its own listener, causing another GET. The preview reads `feed`, not the submitted draft or POST result. It is stale until a GET is accepted. The same controller is used by Personal, own Group and collective Group reflections.

With a300ms artificial save delay and900ms reflection-GET delay, all against disposable data:

| Context | Chromium: new text relative to modal disappearance | WebKit |
| --- | --- | --- |
| Historical Personal | already visible2.88s before close (first route compilation included) | already visible0.51s before close |
| Current Personal | about934ms after close | about931ms after close |
| Current own Group | about977ms after close (unique-text retry) | about972ms after close |

The inserted latency is deliberate reproduction, not a claim that every real request lasts900ms. It proves which operation gates visible state. One repeated unchanged Group save was excluded and rerun with unique text.

There is no explicit full Deck/router refresh in this save handler. `workingCardStore.invalidateLearning` deletes a cached Personal overlay and notifies subscribers; it is not itself a full Deck fetch. Group polling runs independently. Request generations reject older reads once a newer read starts, but there is no submitted-text optimistic state to display while the new read is pending.

## E. Proposed focused fixes — not implemented

1. **Late verification failure race:** `src/components/group-experiences/groupResource.ts`, focused client tests and the mobile Group motion suite. Track the ordering of successful grants and transient failures within the same scope, so an older timeout cannot cancel a newer unexpired success. Preserve the five-second bound, hard revocation/account clearing, subject generation checks and focused Card identity. Test old failure after new success, true expiry, role loss, account switch, and repeated grid/overlay stability. Small, independent correction; security-sensitive regression tests required.
2. **Reflection preview continuity:** `ReflectionArea.tsx`, existing working-store integration and reflection browser tests. Patch the exact current source locally instead of waiting for a GET. Restore optimistic submission with a per-source mutation token and rollback/error on rejection, or at minimum merge the acknowledged text/revision **before** closing the modal. Do not let an earlier poll overwrite newer submitted/acknowledged text. Remove the saving component's redundant self-refetch while retaining cross-view invalidation. Preserve revision conflicts and author/collective permissions. Test Personal, own Group, collective Admin, failures, rapid reopening, late polls and perspective switches. Small-to-moderate, independently correctable; shared Personal path must be tested.
3. **Group read cost:** Group index readiness/repository lifecycle, `presentationReads`, base Group read and `groupResource.load`. Keep explicit index provisioning and actual access checks; avoid full collection/index inventories on every warmed request. Avoid using full Deck/Card retrieval for every authority heartbeat. Parallelise only independent page reads after a common reference, then validate all returned revisions before publication. Retain bounded pagination and immediate revocation. Measure query counts and cold/warm request timings before/after. Moderate, targeted backend/controller work; do not add flags, services or a new permission model.
4. **Gallery responsiveness and failure states:** `GroupCardBack`, captured overlay props in `GroupExperienceDeck`, `CollectionGallery`, existing CardMediaViewer/Image and source-scoped collection tests. Reuse the authorised selected-thumbnail identity/item to open the existing viewer promptly, while bounded metadata loads. Show its restrained existing loading/error/retry treatment during pending/error states instead of rendering nothing or silently disappearing. Test real image decoding, cold requests, interrupted reads, revocation, item removal, selection and older/newer pages in both engines. Preserve all server authorisation and the single Gallery/Media Centre separation. Moderate, can be delivered separately from reflection work.
5. **Stack/Personal motion:** no animation rewrite proposed. Capture an actual repeating iPhone trace before altering geometry. If the initial scale-one paint is confirmed as the initial displacement, correct only that measurement/first-paint ordering. Inspect repeated Group renders/polling and hidden media work if they correlate with frame stalls. Tests must compare unchanged stack constants, normal flipping/traversal, long titles, changing visual viewport and stable settled positions. The right correction is not established yet.
6. **Review image clarity:** use the already uploaded real photograph/video for visual acceptance. The1×1 probe is inappropriate as evidence of visual correctness. Do not silently replace/delete the existing contribution or invent a provider error to explain its appearance. Any review-data change needs approval.

No proposed fix changes storage buckets, media ownership, visibility, reflection ownership, Card identity, deferred moderation, Info Cards or Organisations.

## F. Prioritisation and checkpoint scope

### Priority 1 — Current-checkpoint regressions

- Correct the demonstrated same-scope renewal race before signing off this checkpoint. Its grid/overlay consequence can interrupt meaningful iPhone review even though the natural one-second cycle was not reproduced.
- The new heartbeat's expensive full-content reads should be addressed with the read-cost work, not compensated for by widening authority or adding flags.
- Correct the review handoff's reliance on the one-pixel probe for visual expectations; preserve the record unless a data change is authorised.

### Priority 2 — Earlier Group Experiences regressions/issues

- Reflection E is conclusively a Phase10 regression into ordinary Personal Cards; recommend including the narrow continuity fix before further acceptance.
- Group/Gallery latency is severe enough to obstruct useful acceptance regardless of historical origin. Recommend the focused metadata/read-waterfall and Gallery-open changes before trial readiness.
- Group-only rendering/viewport feedback and hidden media/polling work remain relevant suspects for B/C, not proven causes. Investigate against physical traces; do not assume a full Card implementation replacement is required.

### Priority 3 — Existing unrelated defects

No reported ongoing animation defect has been proved to be an unrelated pre-existing bug. The initial sizing/settling mechanism demonstrably predates Group UI; that does not establish that the reported continuous vibration is pre-existing. Do not put B/C into a general backlog merely to clear this checkpoint.

The separately observed Library incompatibility with newer `mediaItems` content on another branch is already explained by shared database/branch version mismatch. It is not evidence for these animation failures and should not be “fixed” by changing Group ownership or Card storage.

## G. Unresolved evidence, methodology and boundaries

Needed to settle the remaining issues:

- A: exact account/perspective and a screen recording of the natural oscillation, correlated with verification banner and request timings. The controlled race is established; the reported on-device event sequence is not.
- B: recording from initial open through sustained vibration; iOS/Safari version, orientation and browser-toolbar state; frame/header/visualViewport rectangles and motion transforms during both positions. The supplied screenshot alone cannot distinguish clipping, initial scaling and ongoing feedback.
- C: exact ordinary Deck/Card, gesture region and sequence; ideally the last physically smooth commit/build on the same device. Repeated production/physical frame traces, not one short headless sample, are needed to attribute a subtle smoothness regression.
- D: filename/contribution and viewer counter for an actual real-image blank, screenshot of any loading/error state and failing request/status/timing. This distinguishes the1×1 probe, delayed metadata, suspension, decoder failure and server rejection.
- Server spans: Vercel function startup/auth/database segments are not available as exact timings without additional approved deployment instrumentation. No cold-start claim is inferred from a slower first request.
- Eamonn live browser sign-in was not performed: his existing password is not available to the investigation. His role/perspective was reproduced with the existing follower fixture in disposable data; live measurements used Joe's already-authorised session. No session forgery or password reset was used.

Executed evidence (ignored directory `phase2-test-results/iphone-investigation/`):

- `live-readonly.ts` / `.json`: two deployed mobile engines; network waterfall, Gallery latency, original image decode. Initial DOM sampler had a diagnostic serialisation problem; its empty DOM arrays are **not** used as layout evidence.
- `live-grid-readonly.ts` / `.json`: corrected raw-JavaScript sampler, two deployed engines; natural grid/verification/DOM identity and stack positions. Reflection GETs blocked, alongside all non-read requests.
- `read-path-profile.ts` / `.json`: two rounds of explicitly read-only local-to-Atlas command profiles; no write commands recorded. No Mongo profiler/settings changes.
- `authority-race.ts` / `.json`: deterministic unchanged-resource overlap reproduction; no database/provider involved.
- `local-compare.ts` / `.json`, `local-compare-group-retry`: six successful historical/current reflection/layout cases plus unique-text Group retry; saves only in a new owned disposable database. Invalid swipe attempts and the unchanged-text observation are excluded from the conclusions.
- `motion-compare.ts` / `.json`: six historical/current mobile-viewport flip/traversal cases, Chromium/WebKit.
- `motion-touch.ts` / `.json`: native Chromium touch input for historical Personal, current Personal and current Group; all completed. WebKit pointer tests are not represented as physical Safari native-touch/GPU acceptance.
- `live-photo-readonly`: separate real-photograph check and screenshot, without saves or reflection-fence writes.
- `live-grid-early-readonly`: additional35second deployed WebKit comparison opened during a fresh focused-back load, with the same write protections.
- Historical export: `/private/tmp/switchplay-iphone-baseline-uz5qd1pn`, commit `a4e4f8f`, beside current isolated export. Only disposable fixture title was changed to match the screenshot. Both owned diagnostic servers (4203 and4205) were stopped after comparison, with PID/command and disposable database checks. Existing4191/4192 review servers/data were not reset or terminated.

**Execution exception:** the first deployed GET-only browser pass occurred before source inspection identified that `readReflectionFeed()` calls `groups.fence()` and increments internal `writeFence` counters. Those bookkeeping counters therefore advanced; it would be incorrect to claim literally zero Atlas writes. No reflection text, media, learning, membership or visibility data was changed by the investigation. Subsequent live diagnostics blocked that endpoint; saves and all other non-read requests were blocked throughout. No attempt was made to reset the counters. This is disclosed rather than hidden behind HTTP method terminology.

No application fixes, Cloudflare/Vercel configuration changes, deployments, commits or pushes were made. The pre-existing checkpoint working changes remain intact. This report is the only new tracked deliverable; diagnostics and screenshots are ignored local evidence. Approval is required before implementing the proposed corrections.
