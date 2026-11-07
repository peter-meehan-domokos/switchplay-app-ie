# Loading architecture V2 — independent architectural review (Claude)

Reviewed: [loading-architecture-engineering-plan-v2.md](loading-architecture-engineering-plan-v2.md) (current disk version), with targeted reads of `groupResource.ts`, `GroupExperienceDeck.tsx`, `PerspectivePicker.tsx`, `useMediaCollection.ts`, `workingCardStore.ts`, `presentationReads.ts`/`repository.ts` (transactions) and `auth.ts` (session lifetime). Nothing was run, measured or modified.

Labels: **[Fact]** verified in code/V2; **[Evidence]** a measurement already in V2; **[Hypothesis]** my inference, not verified.

## 1. Overall assessment

The direction is sound and I would not ask for a rethink. The central diagnosis is right: the current pop-in comes from *lifetime* (resources owned by components that unmount) and *request shape* (serial authority bookends, per-Card contribution fetches), not from missing data. Completing metadata for the entered perspective while leaving bytes lazy is the right reading of object constancy.

My reservations are about **proportion and unverified premises**, not direction:

* The plan bundles roughly six separable projects (session retention, composed Group reader, staged follower preparation, speculative collection prefetch, session marker, intro timestamps, refresh coordinator). Only the first three serve Priorities A and B directly.
* The 1–2 s opening aspiration rests on local MongoDB timings. A hosted 4 s versus a local 107 ms baseline strongly suggests round-trip latency, not query cost, dominates. V2 acknowledges this (H5) but schedules the test late.
* The staged All followers design saves little at the standard group size (16 followers) and creates a recurring wait for the persona most likely to use it (the coach).

## 2. What the plan gets right

1. **Complete-metadata-for-the-entered-perspective, bytes lazy (D1/D2).** Correctly separates *complete Card information* from *image/video resources*, and rejects the "wait at an unprepared Card" option. Matches the verified reason a 12-Card Personal Deck browses well: swiping selects from an in-memory array (C).
2. **Evidence-led reversal of V1's all-perspectives-upfront gate.** The focused investigation (H2a) showed aggregates need neither media nor reflections (4.1 KB, unchanged with 600 attachments), which justifies computing Group aggregates from narrow learning without stored derived values.
3. **Rejecting stored aggregates and a global change counter (D3, G2).** The deletion/visibility/skipped-Step consistency fan-out is real; ephemeral calculation is the right call at this scale.
4. **Authority and display are separate (G1).** A timeout is not a revocation; confirmed denial withdraws content. This is the right model for object constancy plus safeguarding, and it keeps server authorisation untouched.
5. **Batched reader helpers rather than wrapping per-Card queries in one HTTP call (Decision 5).** The 72-commands-versus-1 contribution result (H2a) and 41 → 71 command growth with roster size are genuine, structural problems.
6. **Honest evidence labelling and measurement gates (H, I).** Hosted numbers, local numbers and estimates are kept distinct, and the plan explicitly refuses to relax completeness silently.
7. **No persistent private client cache (F4).** Right for minors' data.

## 3. Most important concerns (ranked)

### 3.1 The hosted latency model is unverified, and may make 1–2 s unreachable whatever the payload design — *gate before Checkpoint 1 commitment*

* **V2 refs:** H1, H2, H5, E1 ("keep operations sequential inside a MongoDB transaction"), A/H6 targets.
* **Concern.** Local 107 ms / 41 commands versus hosted 2.4–4.1 s [Evidence] is a ~25–40× gap. **[Hypothesis]** the dominant term is *commands × round-trip time* (Vercel `iad1` ↔ Atlas `EU_WEST_1`), plus function cold start and authentication, not query work. If so, the cost of V2's initial read is roughly (sequential commands in the critical path) × RTT. The ten-command aggregate read alone, run sequentially inside a transaction (`repo.transaction` in `presentationReads.ts` [Fact]), would be about ten RTTs before any contribution work. Local milliseconds say nothing about this.
* **Consequence.** The team could build the whole composed-reader architecture, then find the 3–4 s investigation threshold is hit by latency that no payload design can remove. Conversely, a region change may do more for Priority C than most of V2's mechanisms, and would change how much staging is worth.
* **Suggestion.** Before Checkpoint 1: (a) from a deployed function, time a trivial indexed Atlas read to obtain RTT per command and cold/warm start; (b) run the H5 same-build region comparison *now* rather than after the composed reader; (c) decide whether the composed reader may issue independent reads in parallel (non-transactional, fenced by the existing access/structure/adoption revisions) rather than strictly sequentially. Compare "N sequential commands" against "~3 parallel rounds" using the measured RTT.
* **Status:** measurement gate, not an objection to the direction. Without it the success criteria cannot be judged.

### 3.2 Staged All followers saves little at standard size and puts a recurring wait on the coach — *discuss before approval*

* **V2 refs:** D3 table ("Automatically prepare all followers after entry — not the default"), J2, J8, A.3.
* **Concern.** At 16 followers the evidence says follower preparation is cheap: all follower learning 35.8 ms / 9 commands / ~32 KB, and the bare per-follower top-five projection ~105 KB JSON in one command (H2a, local, unauthorised contract; real rows will be larger, so treat as lower bounds). Even at 3–4× that, it is roughly tens of KB gzipped, comparable to one image thumbnail. The three-stage model plus a separate follower-set readiness state exists to avoid transferring this for users who never open All followers. But the Admin's default perspective is Group, and inspecting followers is the coach's main reason to be there. Retention is session-memory only (F4), so every Safari discard, reload and new session repeats the first-use "Loading followers…" wait for exactly that user.
* **Alternative (same machinery, different trigger).** Keep the agreed contract and the All followers fallback gate unchanged, but let the *same* coordinated followers operation also start at idle priority once the initial and other-primary perspectives are ready, **conditioned on size** (e.g. Admin or Shared-inspection viewer and an estimated payload below a threshold such as roster ≤ ~25). For ordinary groups the wait is then rarely seen; for large groups behaviour is exactly V2's. This adds a trigger condition, not a new subsystem, because the registry already shares/dedupes the operation.
* **Contention (question A).** At 16 followers the cost is ~tens of KB of transfer plus a JSON parse and store merge, well below the contention of video playback. The real risk is main-thread parse/merge on an older iPhone during a swipe; mitigated by `requestIdleCallback`/post-interaction scheduling and by **never starting it while a save is in flight or video is playing**. This needs one iPhone measurement, not a design change.
* **Common data fetched repeatedly.** Per stage the repeated costs are authority/publication resolution (the six repeated reads in H2a) and follower learning (read once by aggregates, again by followers, which V2 accepts). On hosted latency (3.1), each stage's fixed overhead (~6–7 commands × RTT) may exceed its marginal data cost. Another reason to resolve 3.1 first, and to make later stages reuse an already-resolved composition rather than re-authorise from scratch where the revision fence allows.
* **Early Me selection by a dual-role Admin (Codex's J10 case): not symmetric with early Group selection, and a simpler solution exists.** Group preparation is roster-proportional (aggregates over all followers, member carousel, Group top-five across all authors). Me is O(1) in roster size: the viewer's learning (already returned today as `bootstrap.own`/`ownDates`, [Fact] `groupResource.ts`), one reflection per Card and one top-five list per Card. Deferring Me buys almost nothing, while creating a wait in the *opposite* direction to where waiting is least defensible (a person's own work). Recommend: **for a viewer who is also a follower, bundle Me into the initial response whatever the entered perspective** (Group for a dual-role Admin; a restored foreign view too). Then only a *follower selecting Group early* needs the pending-picker treatment, which is the already-agreed J8 case. Caveat: if the heavy-history fixture in 3.6 shows Me-with-owner-history is expensive, fall back to V2's J10 (same picker "Loading…" mechanism, extended to Me). Because that mechanism is already generic over a "pending target", approving J10 as the fallback costs nothing, so I would approve it as a fallback rather than as the primary design.
* **Status:** product/architecture decision before approval.

### 3.3 All followers is "all or nothing", which does not scale to ~100 members and shows no progress — *potential blocker for the large-group case*

* **V2 refs:** D3 ("Populate selectable entries only after all relevant perspectives are ready"), E1 (2 MiB transport pages), F3, J10 paragraph on ~100 members.
* **Concern.** The contract "every *displayed* follower is fully selectable" is right. The additional rule "*publish together*" is not required by it. At ~100 members: per-follower media rows scale to roughly 650 KB bare (extrapolating H2a: 105 KB at 16), probably 1.5–2.5 MB once names, presentation references and capabilities are added **[Hypothesis]**; add 600 reflections (short typical; up to 20,000 characters each by contract). That is several continuation pages beyond the 2 MiB target, each a sequential round trip on a slow link, behind one static "Loading followers…" with no indication of progress. The same roster-proportional growth exists in the *initial Group* stage: the member-reflection carousel includes every visible member contribution across all Cards, so stage 1 for a large Group is not "narrow" either.
* **Consequence.** A coach with 100 players on a poor connection could wait many seconds on an unexplained blank panel, and the plan's own "six seconds is not acceptable" threshold has no bound here.
* **Suggestion.** Keep "never show an unready follower as selectable", but allow *ready-only incremental population*: entries appear (in roster order) as their complete projections arrive, with a simple count ("Loading followers… 40 of 97"). Every visible entry remains fully selectable with no further wait, so the stated principle is preserved; for 16 followers it is a single response and behaves as V2 does. Ask the product owner (6.2) whether a list/grid that grows is acceptable, versus a longer blank state. For the Group carousel, measure realistic reflection length before deciding anything.
* **Status:** blocker only for large-group claims; ordinary for the 16-follower case.

### 3.4 Proportionality: the registry, scheduler and speculative collection prefetch outweigh the evidence — *simplify before approval*

* **V2 refs:** F1–F3, D4/D5, E2 (Read-only metadata batch), Decisions 6–7, J3.
* **Concern (registry).** `workingCardStore` and `personalWork` are already module-level singletons with actor/epoch guards [Fact]. The needed change is mostly *lifetime* (stop creating `createGroupResource` and `MediaCollectionController` in component effects and disposing on unmount, `GroupExperienceDeck.tsx`, `useMediaCollection.ts`). A Context-provided registry with request interest, priorities, cancellation, resumable follower coverage and compatible-window hints is a second framework layered over that. V2 itself notes that cancellation cannot stop the server work (D4) and that "closing the surface releases interest" (B), yet both add state machinery.
* **Concern (collection prefetch).** The measured slow journey is *Group* (41–71 commands). Personal opening is 6 commands / 5–8 ms locally [Evidence] and, by the user's own observation, already fast for a 12-Card Deck. There is no baseline showing My Decks → Personal open is a problem, yet D4/D5 add viewport observers, a 8/48/512 budget, a speculative lane plus a foreground lane, promotion/reissue, filter/reorder reprioritisation and Library next-cursor prefetch. These are exactly the "speculative scalability infrastructure" Priority E warns against, and the constants are admittedly unmeasured.
* **Suggestion.** (a) Use per-key module stores with a single `clearForSessionChange()`, shared in-flight promises for dedupe, and **no** interest/cancellation/resumable-coverage framework: let started reads complete and retain them. (b) Replace viewport-led prefetch with *intent-led* preparation: start the Deck's initial-perspective read on intro tap or on tile pointer-down/touch-start (and optionally for the first one or two tiles after tiles render). That captures the "intro hides opening cost" benefit with no scheduler. Defer viewport/budget logic until a measured My Decks → open delay exists. (c) Drop the "known manifest / compatible coverage hints" delta protocol for MVP: canonical content for six Cards is ~10–40 KB uncompressed [Evidence]; resending it costs less than the coverage protocol costs to build and verify.
* **Status:** design simplification; ordinary, but decide before approval so scope is not locked in.

### 3.5 Staged background preparation collides with the existing write-discard behaviour — *must be specified before Checkpoint 2*

* **V2 refs:** F4, G2, I (Checkpoint 2 tests), question A (user edits).
* **Concern.** **[Fact]** `groupResource.load()` discards its *entire* result if any save occurred during the load (`if (… || writes || workRevision !== revision) return;`) and publishes the whole `LoadedGroup` atomically. That was tolerable when loading happened once, before editing. Under V2, Group/followers preparation starts *just after Me becomes usable*, which is precisely when a follower begins editing a signal or reflection. Each edit can void an in-flight Group preparation; with a 4 s refresh and slow links it can starve. V2 mentions per-source barriers ("a read started before a save cannot publish over it") but does not say how coarse whole-snapshot discard becomes field/source-level reconciliation, which is a significant rewrite of the part of `groupResource.ts` that currently gets optimistic saves right.
* **Consequence.** Either lost or repeated preparation work during active editing, or a correctness regression in optimistic saves, which the plan rightly treats as sacred.
* **Suggestion.** Before Checkpoint 2, specify (and characterise with tests) the merge rule: reads publish per source and are overlaid with pending-save state, instead of "any write voids the load". Add a test "edit during in-flight Group preparation neither loses the edit nor discards the preparation".

### 3.6 Completeness cost is unmeasured for the data shapes most likely to hurt — *evidence gap before commitment*

* **V2 refs:** D1, H2 ("do not simulate… thousands of owner-history entries or adversarially long reflection text"), C.
* **Concern.** Personal "top five across the owner's existing reusable history sources" requires fork-lineage/history resolution; the Me projection inside a Group must do this too, and all fixtures are simple. Reflection payload is the other open variable: a Group Card back carries current-context text for the viewer plus every visible member entry. None of this is measured, yet the all-Cards-complete rule makes it a precondition of first presentation.
* **Suggestion.** Add (i) a heavy-owner-history fixture (a Card reused across several Decks/Groups) and (ii) a realistic reflection-length distribution (plus one deliberately long case) to the Checkpoint 1 measurement gate. If Me-with-history is expensive it changes whether Me can be bundled into the initial Group response (see amendment answer below).
* **Status:** ordinary, but gates how complete-first-presentation can be priced.

### 3.7 Safeguarding policies are right in principle but J4/J5 are mis-sized — *product decision; separate from loading*

* **V2 refs:** G3, G5, J4, J5.
* **J4 (offline retention).** **[Fact]** sessions last 30 days (`SESSION_DURATION_SECONDS`). "Retain until confirmed denial or *known expiry*" therefore means a tab on a device that went offline can keep showing *other children's* contributions for up to a month if a removed member keeps it open. Risk is modest (in-memory only, needs an open tab and no connectivity), but the mitigation is nearly free: apply a bounded unverified-age window (for example hours, product's choice) **to foreign/peer content only**; Me and Personal content stay. Do not use a polling-based five-second rule (agreed with V2).
* **J5 (session marker).** The justification (a shared device, one tab showing the previous user's data after another tab switches accounts) is real if learners share devices (e.g. school iPads), and is weak if not. The marker changes the signed session payload and login route, so it is an authentication change inside a loading project. Keep it, but as its own checkpoint, retaining the identity-check fallback exactly as V2 describes, and do not let it block Checkpoints 1–2.
* **Other mechanisms.** BroadcastChannel is cheap and fine; the hidden-tab suspension and coalesced resume refresh are correct; confirmed-denial handling matches the existing generation protection. I found no security gap in the retained-versus-authorised model as described.

## 4. Alternatives worth discussing

| # | Alternative | Replaces | Gain | Sacrifice |
|---|---|---|---|---|
| 1 | **Size-aware idle preparation of followers** using the same coordinated operation, with the All followers gate retained as fallback (3.2) | "Not the default" row in D3 / J2 trigger | Coach rarely sees the first-use wait at 16 followers; retained agreed contract | Some background transfer/parse; needs a payload threshold and an iPhone contention check |
| 2 | **Bundle Me into every initial response for a follower-viewer** (3.2) | J10's early-Me wait; part of Stage 2 | Removes the early-Me case entirely; own work never waits | Slightly larger initial response; depends on 3.6 owner-history cost |
| 3 | **Ready-only incremental follower population** for large groups (3.3) | "Publish all together" in B/F3 | Bounded perceived wait and progress at ~100 members; every visible entry still fully selectable | A list/grid that grows; needs product agreement |
| 4 | **Intent-led preparation** (intro tap, tile touch-start) instead of viewport-led scheduling (3.4) | D4/D5, 8/48/512 budgets, Library next-page prefetch | No scheduler, lanes, observers or tuning constants; keeps the intro-hides-latency benefit | First Deck opened without an intro may not be warm; revisit only if measured |
| 5 | **Per-key module stores with a `clearForSessionChange()`** in place of a Context registry with interest/priority/cancellation (3.4) | F1 registry, interest release, resumable coverage | Matches the existing `workingCardStore`/`personalWork` pattern; fewer moving parts to test | Less central visibility of in-flight work; fewer cancellation optimisations (V2 admits these cannot stop the server anyway) |
| 6 | **Parallel, revision-fenced reads in the composed reader** instead of strictly sequential transactional reads (3.1) | E1's "sequential inside a transaction" | Critical path of ~3 round trips rather than ~10 if RTT dominates | Weaker single-snapshot guarantee; needs fence tests; only worth it if the RTT probe confirms the premise |

I do **not** recommend replacing: complete-metadata-for-entered-perspective, computed (not stored) aggregates, no persistent client cache, or the authority-versus-display separation.

## 5. Evidence and testing gaps

### Essential before major implementation commitment

1. **Hosted RTT and cold/warm start probe**, then the **same-build Vercel/Atlas region comparison** (H5), before building the composed reader. It determines the floor for Priority C and which of alternatives 1 and 6 matter.
2. **Authorised, realistic-shape payload sizing for All followers**: 16 and ~100 members, real presentation references and names, typical and long reflections, 20 uploaders × 5 uploads × 6 Cards. The current "bare" projections (H2a) are lower bounds and omit the fields that drive size.
3. **Heavy owner-history fixture** (Card reused across Decks/Groups) for Personal and Me-in-Group top-five/count (3.6).
4. **Characterisation of edit-during-load** in `groupResource` (3.5): what is lost/discarded today, to fix the reconciliation rule before design.

### Reasonable during implementation

* Browser slow-profile measurements and the H4 metric table (as planned); the first slice should measure *title tap → complete usable perspective* both in-app and by direct URL, as V2 already says.
* One physical-iPhone check of JSON parse/store-merge cost for the follower set while a swipe or video playback is in progress (alternative 1's contention risk) and iPhone heap with a prepared 100-follower set.
* Command-count/N+1 tests as listed in E3/Checkpoint 1.

### The five unresolved WebKit thumbnail checks

They deserve a **time-boxed attribution step before Checkpoint 2, not a production change**. iPhone Safari (WebKit) is the primary target, and V2 relies on bounded thumbnail warming. Cheap discriminators: run the five specs with media methods un-stubbed; check whether WebKit issues requests for off-screen `Image()`/lazy images at all in the harness; and run the same scenario once on a physical iPhone through remote inspection. **[Hypothesis]** a harness artefact (stubbed `decode`/lazy loading), but unproven. Not a blocker for approving the direction.

## 6. Questions for the product owner

1. **Coach behaviour:** in a typical coaching session, how soon after opening a Group does the Admin open All followers or an individual follower? (If routinely within the first minute, alternative 1 should be the default rather than an option.)
2. **Large groups:** for ~100 members, is a follower list/grid that fills in as followers become ready (each entry fully usable, with a count) acceptable, or must it appear all at once even if the blank state is longer?
3. **Offline/revocation window (J4):** with 30-day sessions and minors' data, what is the longest unverified period before *other members'* content is concealed on a device that cannot reach the server? (Own and Personal content unaffected.)
4. **Shared devices:** will trial learners share phones/tablets? (This determines whether the session marker, J5, must ship with the first release or can follow.)

## 7. Final recommendation

**Approve conditionally.** The architecture is fundamentally sound and the staged direction is acceptable, but approval should be conditional on:

1. The hosted RTT/region probe (5.1) and a decision on parallel-versus-sequential composed reads, because it governs whether the 1–2 s aspiration is reachable.
2. A decision on the follower-preparation trigger (alternative 1) and the large-group population rule (alternative 3), informed by realistic payload sizing (5.2).
3. A written read/write reconciliation rule for retained Group data before Checkpoint 2 (3.5).
4. Simplifying the registry/scheduler scope (alternatives 4 and 5), and moving J4–J7 and speculative collection preparation into later, separately approved checkpoints so they cannot delay the high-value core: session lifetime, composed Group reader and complete Cards.

For the amendment, early Me selection should not be handled symmetrically with early Group; bundling Me into the initial response is simpler and is the preferred approach, with J10 as the fallback.
