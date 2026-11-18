# Independent Engineering Review — Plugged-in Step Visuals

**Status: COMPLETE (reduced scope, agreed with the owner to limit cost).** Built in stages so partial progress was always saved. Findings are listed in verification order; a severity index is in the Appendix. Section 2.3 states what was **not** read.

**Reviewed artefacts (not modified by this review):**
- Specification: `docs/design/features/step-visuals/plugged-in/plugged-in-step-visuals-specification.md` (265 lines)
- Draft plan: `docs/engineering/features/step-visuals/plugged-in/plugged-in-step-visuals-engineering-plan.md` (1,093 lines, 176 KB)

## Stage log

| Stage | Content | State |
| --- | --- | --- |
| 0 | Skeleton, baseline verification | Done |
| 1 | Plan read-through (§1–§14) and plan-internal findings (F-01…F-07) | **Done** — all 14 plan sections read; cross-reference checks run |
| 2 | Source trace: autoplay / media controller (priority area 1) | **Done** — F-08…F-10, §5 area 1 |
| 3 | Source trace: snapshot completeness, Integration + Roots and Factors (area 2) | **Done** — F-11, F-12, F-06 sharpened, §5 area 2 |
| 4 | Source trace: legacy media, uploads, creator, validators (area 8) | **Done** — F-13…F-15, §5 area 8 |
| 5 | Source trace: auth/guest/claim, framework, publication (areas 4, 7) | **Done** — F-16, §5 areas 3, 4, 5, 7, 9 |
| 6 | Layout / label fitting / no-scroll (area 6) | **Done** (reduced scope) — F-17…F-19, §5 area 6 |
| 7 | Complexity audit, owner questions, amendments, verdict | **Done** — §1, §6–§10, appendix (findings not re-ordered; severity index instead) |

---

## 1. Executive verdict

**Architecturally sound, but requiring specific corrections.** It is not blocked by a fundamental design problem, and I found no Critical issue. It is a thorough, evidence-labelled investigation whose direction I would keep: one persistent player, an embedded media configuration with a first-class activity reference, snapshot separate from history, activity-owned codecs, explicit new-attempt rules, and a guest-first foundation with demo decks deferred.

**Main reasons it needs correcting first:**
1. **It would regress ordinary single-video autoplay** in three cases (video ended, stream stalled, rapid next-next), one of which an existing test asserts is deliberate (F-08). It also proposes re-adding a video expansion control the owner removed on purpose, mis-framed as a gap (F-09).
2. **One locked requirement cannot be met as built:** Integration stages 3–7 need about 700 px of height, so "no vertical scrolling in full screen" fails on most phones in Safari, and Stage 7's input opens the keyboard (F-18). That needs an owner decision, not an implementation choice.
3. **Over-built machinery** for the initial product: server-side recomputation, batch receipts, divergent branches with a new reconciliation UI, offline provisional attempts, alias-based claim, modal staging with an allocation ledger, a stored legacy projection and a server text-measurement profile (F-01…F-05, F-13, F-14, F-17). Each has a simpler design that still preserves work, avoids implicit attempts and avoids last-write-wins loss.
4. **Omissions:** instructional image delivery scales poorly (F-15), concrete hydration traps (F-11, F-12), an untouched guest attempt could hide a learner's real progress (F-16), no early vertical slice (F-06).

**Actual implementation blockers:** F-18 (owner decision), F-08/N1 (owner decision), Q1, Q2, Q5, Q9, Q13, and the F-10 device experiment. Everything else is a plan amendment (§9).

## 2. Inspection baseline and limitations (see §2.1–2.6)

The checkout's tree is byte-identical to the plan's recorded baseline, so no finding is attributable to later code changes. Scope was deliberately reduced part-way (agreed with the owner) to limit cost; §2.3 lists what was not read.

### 2.1 Repository state

| Item | Observed | Notes |
| --- | --- | --- |
| Repository root | `/Users/peterdomokos/projects/step-visuals` | Matches brief. |
| Current branch | `main` | Not switched. The plan was written on `feat/step-visuals-pluggedin`. |
| HEAD | `cbffc8d58bd23f129548a113fc15beaebac33725` — "Merge pull request #34 from peter-meehan-domokos/feat/step-visuals" | A merge commit that did not exist when the plan was written. |
| HEAD tree | `d00e5a4beaa1c7e06f55a31d809e89d1cfae826c` | **Byte-identical to the plan's recorded tree.** Verified with `git rev-parse HEAD^{tree}` and `git diff --quiet 090676e HEAD`. |
| Plan baseline commit | `090676e4ad1f654c2c9d0638cc25c231df88a6aa` ("Merge latest main into step-visuals") | Present locally; ancestor of HEAD. |
| Working tree | Only two untracked directories: `docs/design/features/step-visuals/plugged-in/` and `docs/engineering/features/step-visuals/plugged-in/`. No tracked modifications. | The review report is a third untracked file in the second directory. |
| Applicable `AGENTS.md` | 5 lines: Next.js "this is NOT the Next.js you know" notice — read `node_modules/next/dist/docs/` before writing framework code. | Relevant to implementation only. No code was written in this review. |
| Repo Copilot instructions | `.github/copilot-instructions.md` exists | Not yet read; see stage 6 (project layout-pipeline conventions may bear on the plan's proposed modules). |

### 2.2 Differences from the plan's recorded baseline

| Plan statement (§1.1) | Current checkout | Classification |
| --- | --- | --- |
| Active branch `feat/step-visuals-pluggedin`, HEAD `090676e` | Now on `main`, HEAD `cbffc8d` | **Not an error in the plan.** `main` has since gained a merge commit (PR #34) whose tree equals the plan's tree. |
| "Local `main` is `36dab2e`" | `main` is now `cbffc8d` | **Obsolete by later ref movement**, not by later code. No source line the plan cites has changed. |
| "Local `feat/step-visuals` is `6881123`, one documentation-only commit ahead of HEAD"; source changes empty; relocates Integration docs from `activities/` to `maths-areas/` | Verified: `feat/step-visuals` = `6881123`; it differs from the baseline tree by one added file (`.../functions-and-graphs/engineering-plan.md`, +1,208 lines) plus renames shown as zero-line changes | **Plan statement confirmed.** |
| Initial worktree: exactly two untracked files; plan was 0 bytes beforehand | Not independently checkable (plan has since been written) | **Unverified assumption** — immaterial to findings. |

**Consequence:** because the tree is identical, every source citation in the plan can be checked against the current checkout without allowance for drift. Any discrepancy found is therefore an error in the original audit (or a legitimate interpretation difference), not a later change.

### 2.3 Documents read

**Read in full:** the specification; the engineering plan (§1–§14, evidence table E01–E20, test matrix T01–T20, questions Q1–Q13); `src/app/step-visuals/learning-records.md`.
**Read in part:** `.github/copilot-instructions.md` (the layout-pipeline rule, lines 67–81); `AGENTS.md` (5 lines, read in full); the WebKit "New video policies for iOS" post the plan cites (first 6,000 characters).
**Cross-reference checks on the plan** (`grep`): every `Q1`–`Q13` reference has a heading; every `E01`–`E20` and `T01`–`T20` ID used is defined.
**Existence confirmed but content NOT read:** `ai-maths-visuals-support-guide.md`, `great-maths-visuals.md`, the Integration experience specification and approved design, `maths-visuals-engineering-guide.md` and its v1-1 sibling, `engineering-guide-recommended-changes.md`, `engineering-retrospective1-1.md`, the five Integration activity documents under `activities/integration-area/`, `src/app/step-visuals/lab/README.md`, `docs/engineering/{architecture,data-model,system-behaviour}.md`, `info-card-media-security-backlog.md` and `README.md`. These mainly describe the mathematics, historical decisions and media-security history; findings here rest on current source instead. Some statements in the plan that cite them (for example the historical public-image exposure) are therefore **unverified by me**.
All 22 required paths exist on this checkout (both `activities/integration-area/*` and `maths-areas/integration-area/*`).

### 2.4 Significant source inspected

- **Playback:** `src/components/decks/FocusedCardView.tsx`, `StepView.tsx`; `src/components/media/CloudflareHlsVideoPlayer.tsx`, `videoPlaybackState.ts`; `src/components/cards/IntroMediaBlock.tsx`; `tests/video-source-transition.spec.ts` (read), `tests/deck-intro-preview.test.ts` (relevant cases).
- **Activities:** `src/app/step-visuals/activities/roots-factors/{learning,manipulation,recordedLearning}.ts`, `RootsFactorsActivity.tsx`; `activities/integration-area/{learning,use-stage-motion,stage-controls,integration-activity,notifications}.ts(x)`; `platform/web/learningNotifications.ts`; `lab/experienceRegistry.ts`, `public.ts`; CSS `later-stages.module.css`, `intro-stages.module.css`, `integration.module.css` (grep), `ActivityFrame.module.css`, `Lab.module.css` (grep).
- **Cards, media, creator:** `src/lib/cards/{domain,publicationRules,uploadAuthorization,prospectiveUpload,protectedMedia,http}.ts`; `src/lib/media.ts` (types), `mediaDelivery.ts` (grep); `src/app/api/media/{stream/status,stream/direct-upload,protected}/route.ts`; `src/components/creator/{CreatorMediaUploadSlot,cardArchitectureAdapter}.ts(x)`, `creatorBoardState.ts` (grep), `CreatorDragLab.tsx` (upload handlers).
- **Auth, database, framework:** `src/lib/auth.ts`, `mongodb.ts`; `src/app/api/{auth,users,public/early-access}/`; `src/lib/frameworks/{configuration,configurationContracts}.ts`; `next.config.ts`; `package.json` scripts; `src/app/globals.css`.
- **Not inspected:** `src/lib/cards/repository.ts` internals, `creatorPersistenceCoordinator.ts`, `useWorkingDeck.ts` (grep only), `DeckVideoPreparation.tsx` (grep only), `CardMediaViewer*`, Cloudflare/R2 client code beyond a deletion grep, `src/app/progress`, and all tests other than those named.

### 2.5 Commands and tests actually run

| Command | Purpose | Result |
| --- | --- | --- |
| `git branch --show-current`, `git rev-parse HEAD`, `git status --short` | Baseline | See §2.1 |
| `git rev-parse HEAD^{tree} 090676e^{tree}`; `git diff --quiet 090676e HEAD` | Tree comparison | Identical |
| `git rev-parse feat/step-visuals`; `git rev-list --left-right --count feat/step-visuals...HEAD`; `git diff --stat HEAD feat/step-visuals` | Verify plan's branch claim | Confirmed |
| `ls` / `wc` over the 22 required inputs | Existence check | All present; review report absent at start |
| `git log -S"setIsVideoExpanded(true)"`, `git show 4fdd50e`, `git log --grep autoplay`, `git show --stat 0b3c5d7` | History of Step View expansion and iOS autoplay | Expansion deliberately removed 2026-09-21 (F-09) |
| `grep`/`sed`/`wc` over source and docs | Source tracing, line references | As cited per finding |
| `web_fetch` of the WebKit video-policies post | Check what the plan's cited source establishes | Supports the call-stack rule only (F-10) |

**No tests, builds, type checks, servers or installs were run.** The plan's "29/29 node tests and 157/157 pure tests" are not independently reproduced. No fetch, commit, checkout or merge was performed. One batch of line-number corrections in this report used a script (see Appendix).

### 2.6 Limitations

- No physical iPhone or real Safari was available; anything about native autoplay or device heights is labelled "requires runtime validation" or "estimate".
- No database, secrets, provider accounts or production configuration were opened.
- Scope was reduced part-way to limit cost (see §2.3 for the documents not read).

---

## 3. Specification coverage

**Status: preliminary at stage 1 (plan text vs specification text), then re-checked against source in stages 2–6. No locked outcome is contradicted by the plan; where source changed my view (video expansion, the no-scroll requirement), it is recorded in F-09 and F-18.**

### 3.1 Locked outcomes versus the plan

All locked outcomes listed in the brief are present in the plan's requirement inventory (§2, rows M01–M13, C01–C05, A01–A04, R01–R08, S01–S02, G01–G04, D01–D02, X01–X02). I found **no locked outcome that is contradicted** by the plan text. Points where coverage is thin rather than absent:

| Locked outcome / spec clause | Plan treatment | Review note |
| --- | --- | --- |
| Spec §8.3 last bullet: "assess whether events are sufficiently interpretable for later learning analysis" | Scattered across E12 and §8.3 (no timestamps/context/principal in existing events; ServerSequence is acceptance order) | No consolidated audit of event-vocabulary gaps. Re-checked in stage 3 against `learning-records.md` and the reducers. |
| Spec §3.1 "Zero items: preserve existing empty behaviour" | M03 notes the current "Video placeholder" for an empty step | Plan says "preserve actual zero baseline" — correct; needs a characterisation fixture (P0 does list zero-media fixtures). |
| Spec §3.2 "validate the combined rendered width … prevent saving an invalid label configuration" | §6.3 items 6–7: client DOM measurement **plus** server-side canonical text measurement | Higher-cost than the spec requires — see priority area 6 (stage 6). |
| Spec §4.1 "origin-appropriate return destination" | `ActivityOrigin` discriminated union (§6.4) | Adequate; only `step` is built initially. |
| Spec §10.1 "Provide a contextual, non-blocking sign-in invitation" | §9.1, P6 | Covered. The invitation is the only new UI element in guest flow; the plan correctly reuses the existing sign-in surface. |
| Spec §8.3 "small, non-blocking indication when changes are not yet safely saved" | §8.4.2 five-state durability | Covered. The five internal states are richer than the single small indicator the spec describes — keep the UI to the minimum (pending / saved / failed). |
| Spec §6 "Reuse of already uploaded files only if inexpensive" | §5.7, P7: deferred with recommendation | Correctly deferred. See area 8 (stage 4) for whether any *necessary* asset-lifecycle work is hidden in the core upload path (plan §6.3 item 4 introduces allocation receipts in P2). |

### 3.2 Acceptance scenarios 1–19

The plan maps all 19 scenarios to tests (§12.4, final paragraph): 1→T01/T07/T08; 2→T01/T02/T05; 3→T02/T03; 4→T03/T04/T10; 5→T04/T12; 6→T05/T06; 7→T07/T08; 8→T08; 9→T09; 10→T01/T11; 11→T10/T13; 12→T12; 13→T13; 14→T15; 15→T12/T18; 16→T14; 17→T16/T17; 18→T20 (future); 19→T06/T08/T19. I checked each row's stated assertions against the scenario wording; **all 19 are addressed**. Gaps are in *negative* and *depth* coverage, listed in §7 of this report once the source stages are done.

## 4. Prioritised findings

**Ordering note:** findings appear in the order they were verified, not by severity; a severity index is in the Appendix. Each finding states its evidence basis. "Plan text" means the finding rests on reading the plan, not on source.

### F-01 — Server-side recomputation of learner-reported outcomes is an unscoped subsystem

- **Severity:** Medium · **Confidence:** Strong inference (plan text) · **Product approval needed:** No
- **Spec:** §8.1/§8.3 require durable meaningful history; nothing requires server-verified correctness. §8.2 says existing mathematical rules are preserved.
- **Plan:** §8.3, paragraph after the persistent-envelope JSON: "Server validation recomputes/checks bounded mathematical outcomes with activity-owned pure validation where appropriate; learner-supplied `correct:true` is not trusted achievement."
- **Scenario:** An Integration `calculation-checked` event arrives from an offline client holding release `integration-area@3` while the server's current release is `@4`. To "recompute", the server must load release `@3`'s mathematics (including rounding and problem-revision state that is not in the event), for every retained historical release, for the whole offline-client horizon.
- **Consequence:** The persistence layer acquires a runtime dependency on every activity's maths at every historical release. A legitimate event rejected because of a rounding or revision-state mismatch is lost learner evidence — the opposite of the "never lose history" rule. The same paragraph also says the records are not exam-grade proof, so the recomputation buys no stated product value.
- **Smallest adequate correction:** Server validates *envelope, schema, size, finiteness, ownership, ordering and idempotency only*. `correct` etc. are stored as client-reported facts. Add one sentence to §8.3 saying so. Revisit only if a later product need (e.g. teacher-visible mastery) requires verified outcomes.
- **Verification:** Fuzz tests on envelope validation; a negative test showing a forged `correct:true` is stored and never feeds card completion or Progress (this holds by construction because §8.4 forbids those writes).

### F-02 — Batch receipts are redundant with event-ID uniqueness, and create the retention problem the plan then has to manage

- **Severity:** Medium · **Confidence:** Strong inference (plan text) · **Product approval needed:** No
- **Spec:** Scenario 14 — "ultimately syncs without duplicate history".
- **Plan:** §8.1 (`visualBatchReceipts`, three unique event indexes), §8.4 items 4–5, §12.5 and the retention caveat "Retention must not undercut advertised offline retry horizon".
- **Scenario:** Response to batch B is lost; client retries after the receipt retention window closed. With receipts, the dedupe guarantee silently expires; without them, it cannot.
- **Consequence:** An additional collection, an additional retention policy, and a time-bounded idempotency guarantee, where an indefinite one is available for free.
- **Smallest adequate correction:** Idempotency by the unique `{attemptId, eventId}` index (insert tolerant of duplicate-key errors) plus a monotonic snapshot `stateRevision`/`throughClientSequence` that the server only advances. Acknowledge by event IDs. Store a payload hash *on the event row* and compare on duplicate to detect a client reusing an ID with different content. Keep `batchId` as a non-unique correlation ID in logs. Drop `visualBatchReceipts`. The `{attemptId, writerId, clientSequence}` unique index can then become a consistency check or be dropped.
- **Verification:** Replay the same batch 1×, 2×, 10× and after an arbitrary delay: identical final state. Replay with one event's payload altered: rejected as conflict and nothing written.

### F-03 — Alias-based claim leaves permanent redirect indirection that every endpoint must honour

- **Severity:** Medium · **Confidence:** Strong inference (plan text); validity of the alternative depends on the event/attempt keying checked in stage 5 · **Product approval needed:** No (technical), though it interacts with Q7
- **Spec:** §10.1 — preserve both histories, no duplicates or overwrites, continue the guest's attempt.
- **Plan:** §5.6 (chosen alias design), §8.1 (`redirectedTo`, record-source association), §9.2 steps 3 and 6, §9.3 ("authorize record → attempt → source alias → canonical principal").
- **Scenario:** Two years after a claim, a new endpoint (e.g. a history export) must resolve `recordId → redirectedTo → canonical record → principal`, and each future authorization check must remember the alias hop. One missed hop is either a lockout or an IDOR.
- **Consequence:** Permanent query/authorization complexity for a one-off event. The plan itself rates reparenting "reasonable medium scale" in §5.6 but rejects it for unspecified reasons.
- **Smallest adequate correction:** Events are keyed by `attemptId` (plan §8.1), not by principal. So ownership lives on `attempt → record → principal`. A claim therefore reparents the guest's *attempts* (and visits) to the account's canonical record in a bounded transaction (a guest has few attempts per activity; cap them), leaves events untouched, sets `activeAttemptId`, keeps `originGuestId`/`originRecordId` as **non-authorising provenance fields**, and tombstones the guest record. Queued guest batches drain under the account after login because the attempt now belongs to it; an in-flight batch is serialised by the attempt-revision check inside the same transaction.
- **Verification:** The adversarial claim cases in plan §9.2 (lost response, two tabs, concurrent account attempt, duplicate event IDs) run unchanged against the simpler design; add a test that no read path references a `redirectedTo`-style field.

### F-04 — "Divergent branches" and a reviewed continuation choice add a data concept and a UI the spec did not authorise

- **Severity:** High (design-scope) · **Confidence:** Strong inference (plan text) · **Product approval needed:** Yes — this is the plan's own Q6
- **Spec:** §8.3 asks for conflict resolution but §9 and §14 forbid unapproved UX; §8.2 forbids implicit new attempts and silent loss.
- **Plan:** §8.4 item 9, §8.1 (`branchId`, `baseRevision`, `visualSnapshotCheckpoints`), Q6-A.
- **Scenario:** Phone and laptop both open attempt A; the laptop was offline for an hour. Under Q6-A the laptop's batch becomes a durable branch and a "minimal reviewed continuation choice" appears — a new screen the product owner has not seen.
- **Consequence:** A new persistent concept (branch) in event storage, plus an undesigned reconciliation UI, to solve a multi-device edge case for a single learner doing a maths activity.
- **Smallest adequate correction (preserves work, no implicit attempt, no last-write-wins loss):** Events are append-only and idempotent, so they **never conflict**: accept all of them whichever writer sent them. Only the *snapshot* is contested. Install a snapshot only if its base `stateRevision` equals the stored one (compare-and-swap). If stale, **do not install it**; store it as an immutable checkpoint (`reason: stale-revision`) and return the current server snapshot so the client adopts it. The stale draft/typed answer is preserved in the checkpoint and its events are in history. Writer epochs and BroadcastChannel leases then become optimisations to reduce thrash, not correctness requirements — defer them. A reconciliation UI can follow later if usage shows collisions matter.
- **Trade-off to be honest about:** the stale device's *visible* state is replaced by the server's state, with nothing lost in storage. Whether a one-line "updated from another device" notice is needed is a small UX decision for the owner.
- **Verification:** Two-writer tests: interleaved batches, stale snapshot after server advance, stale snapshot after offline return — in all cases event count = union of unique events, current snapshot = the CAS winner, checkpoint count = number of rejected stale snapshots, attempt count unchanged.

### F-05 — Offline *provisional first attempt* creates a conflict case that need not exist

- **Severity:** Medium · **Confidence:** Strong inference (plan text) · **Product approval needed:** Confirm reading of spec §8.3 (low risk)
- **Spec:** §8.3 "Never require a Save button or block *continued* interaction during temporary loss of network connectivity."
- **Plan:** §8.4 item 7 (provisional local attempt, then "preserve provisional work as a conflict branch of that initial-open operation pending Q6 reconciliation").
- **Scenario:** A learner who already has progress on another device opens the activity on a new device that is momentarily offline. The plan lets them start a fresh provisional attempt; when the network returns, two attempts exist, one of which the learner never meant to start — an *implicit* new attempt, which the spec forbids.
- **Consequence:** The "conflict branch of initial-open" machinery exists only to repair a state the design chose to allow.
- **Smallest adequate correction:** First open of an activity on a device with no local record requires one successful `open` response (the activity code must already have loaded over the network anyway — the plan states there is no offline boot). Once a record exists locally or on the server, all subsequent interaction is offline-capable. If offline at first open, show a truthful "needs a connection to start" state.
- **Verification:** Test: offline first open shows the message and creates no attempt; online open then network loss mid-session continues interaction and queues; reconnect drains with no duplicate attempt.

### F-06 — The phase plan is layer-by-layer; no early end-to-end slice

- **Severity:** Medium · **Confidence:** Strong inference (plan text §11.1) · **Product approval needed:** No
- **Plan:** §11.1 critical path `P0 → P1 → P4 → P5 → P6 → P9`; first moment at which "select media → open activity → save → restore" works end to end is after P2, P3, P4 and P5 are all complete.
- **Consequence:** The hardest integration risks (restoration completeness, outbox semantics, preview-to-host handoff) are met late, after the creator modal and shared shell have been built around assumptions.
- **Smallest adequate correction:** Insert a thin flagged slice immediately after P1: a *fixture-driven* `mediaItems` array containing one activity item, the preview → full-screen host, one activity's snapshot codec, the open / batch / current endpoints, and a local outbox. No creator modal, no tabs, no second activity, no guest. **Use Roots and Factors for the slice** (verified in stage 3): its whole runtime state is `{ movingRoot, lesson }` plus the per-attempt evidence, the lesson is one-way (no Previous action), and it has a pure view component (`RootsFactorsView`); Integration needs an 18-field panel plus two stacks of saved panels, a completed-attempt unlock, and animation-frame normalisation (F-12). Integration is the second adapter.
- **Verification:** Hard reload and a second-browser visit restore the exact state; kill network mid-session and confirm pending → saved transitions are truthful.

### F-07 — Small internal inconsistencies in the plan

- **Severity:** Low · **Confidence:** Verified (plan text) · **Product approval needed:** No
- **(a)** §1.2 item 3 recommends "a central current-publication pointer"; §5.3 prefers the build-time registry with **no** database pointer as the initial source of truth, and Q8-A (recommended) also has none. One of them is wrong. Correct §1.2 to "a *current-release field in the registry manifest*".
- **(b)** §11.1 lists "Q1–5/Q9 clarified enough to characterize" as a P0 dependency. P0 characterises *existing* behaviour and needs none of those answers to start; only the pass/fail threshold for the supported viewport (Q2) needs one. Remove the dependency so P0 can start immediately.
- **(c)** Question numbering lists Q13 before Q10–Q12 (§13). Cosmetic.
- **(d)** §12.1's "29/29 node tests and 157/157 pure tests passed" are the plan author's historical results; they exercise the **old** Start-again semantics (the plan says so). They should not appear as a baseline for the new semantics.

### F-08 — The proposed "observed playing" eligibility rule changes ordinary single-video behaviour in three cases, one of which an existing test asserts is deliberate

- **Severity:** High · **Confidence:** Verified in source for today's behaviour; the consequence for the new rule is Strong inference (plan §7.2–7.3 text) · **Product approval needed:** **Yes** — the plan does not raise this as a question
- **Spec:** §4.4 table and the closing paragraph: autoplay only when the immediate source was "actively playing", **and** the plan "must not regress existing ordinary single-video-step autoplay without explicit approval".
- **Plan:** §4 finding 2; §7.2 ("A 'play requested' flag is insufficient"; use observed `playing` corroborated by `!paused && !ended`); §7.3 row 3 ("Ended never grants autoplay") and the rapid A→B→C paragraph ("C uses B's observed state … If B never played, C stays paused").
- **Source (today):**
  - `src/components/decks/FocusedCardView.tsx:537` — `goToStepViewItem` derives eligibility from `videoPlaybackIntentRef.current === "continue"`, a *chain* flag, not from the element's state. It is set to `"idle"` when the next step has no video (line 554) and to `"paused"` on a genuine pause or consultation.
  - `src/components/media/CloudflareHlsVideoPlayer.tsx:557–570` — `handlePause` calls `shouldRecordPlaybackPause({hasEnded, isInternalTransition})`; `handleEnded` (line 570) deliberately does **not** change the intent.
  - `src/components/media/videoPlaybackState.ts` — `shouldRecordPlaybackPause` returns `false` when `hasEnded`. `tests/deck-intro-preview.test.ts:104–106` is titled *"an ended video pause is not treated as an explicit user pause"*.
- **Scenarios where today's behaviour and the plan's rule differ (all on single-video cards):**
  1. **Ended:** learner watches the Introduction video to the end and taps Next → today the next step's video autoplays; plan: stays paused.
  2. **Buffering:** learner is watching, the HLS stream stalls (`waiting`), learner taps Next → today continues; plan: the source is not "observed playing", so paused. This is the common mobile case.
  3. **Rapid navigation:** Next, Next in quick succession while the middle video is still loading → today the third video autoplays (chain unbroken); plan: paused.
- **Consequence:** A regression in exactly the flow spec §4.4 says must not regress, introduced by a refinement the plan presents as a tightening, and with no existing automated test of the decision logic (see below).
- **Smallest adequate correction:** Keep the existing *intent-chain* semantics and extend them rather than replace them. A chain is **broken** by a genuine user pause, by selecting a non-video item, by a `blocked`/`failed` result, and by leaving the card. It is **not** broken by ended, buffering or in-flight loading. Apply the same synchronous read in the new tab-change handler that `goToStepViewItem` uses. This satisfies every row of the spec §4.4 table (playing→video autoplays; paused→video paused; image/visual→video paused; playing→image/visual pauses; any→new step with first tab video uses the rule) with no new state machine. The plan's `MediaSessionState` (selection generation, transition object, observed states) can then shrink to: selected tab, step-entry key, and a position map.
- **Owner decision (new Q):** "If a video has played to its end, does the next video autoplay?" Recommended: **yes**, because that is today's tested behaviour and the learner has not paused. If the owner prefers the strict reading, it is a deliberate behaviour change and must be approved as such.
- **Verification:** Add a characterisation test that drives real step navigation in `FocusedCardView` (not the player handle) for: play→next, pause→next, ended→next, stalled→next, rapid next-next, video→non-video→video, in **both** modes (protected-media flag 0 and 1). Today **no** automated test covers this decision: `tests/video-source-transition.spec.ts` calls `loadMedia(..., {shouldPlay})` on the player handle with an explicit argument, and `tests/deck-intro-preview.test.ts` covers only the pure helper. A grep of `tests/` for `autoplay|shouldPlay|goToNextStepViewItem` finds nothing else relevant.

### F-09 — Q3 is mis-framed: the Step View custom expand control was deliberately removed, and the video already has native controls

- **Severity:** High · **Confidence:** Verified (source and git history) · **Product approval needed:** Confirm interpretation of "existing optional full-screen/expanded behavior"
- **Spec:** §4.2 "Video plays within the Step View media area, with the **existing** optional full-screen/expanded behavior"; §4.4 forbids regressing iPhone playback.
- **Plan:** §4 finding 4; E04; Q3 (recommended A: "wire the existing HLS player's expand/collapse capability into FocusedCardView"); §7.3 rows "Video expand/collapse", "Native fullscreen exit"; P3 ("approved video expansion wiring").
- **Source:**
  - `src/components/decks/FocusedCardView.tsx` — `isVideoExpanded` (line 290) is only ever set to `false`; there is no `setIsVideoExpanded(true)`. The `<CloudflareHlsVideoPlayer>` is rendered without `onRequestExpand`/`onRequestCollapse` (JSX near line 925).
  - `git show 4fdd50e` (2026-09-21, "change/removed custom expand from step videos") **deleted exactly that wiring** (`onRequestExpand={() => setIsVideoExpanded(true)}` and the collapse twin) and made the player render the control only when the callback exists.
  - `src/components/media/CloudflareHlsVideoPlayer.tsx:648` — `<video controls={!isDeckPreview} playsInline …>`: in Step View the element has **native controls**, which on iPhone include native full screen.
- **Consequence:** The plan describes the missing expansion as a baseline gap and recommends re-adding it. That would *reinstate* behaviour the owner removed, add custom-expansion state to the most fragile component (gesture lock, host sizing, backdrop, landscape sizing effects at `FocusedCardView.tsx` 643–700), and add transition-table rows (§7.3) that need not exist. It also risks the iPhone behaviour the spec most wants preserved.
- **Smallest adequate correction:** Interpret "existing optional full-screen behaviour" as the native full-screen already available through the controls. Delete the custom-expand tasks from P3. Keep one test for native-full-screen exit (what state is the video in afterward?) — that **requires a physical iPhone**. Reword Q3 to a confirm-only question: "Native full screen via the video's own controls is the existing behaviour; confirm no additional custom expand control is wanted." Note: image full screen is a *new* control either way (spec §4.3).
- **Verification:** Owner confirmation; device test: enter native full screen while playing, exit, record `paused`/`playing`/position; confirm no autoplay is inferred.

### F-10 — In production mode the existing play call runs after awaited grants; the plan's gesture analysis does not separate the two paths

- **Severity:** Medium (analysis gap, not a proven defect) · **Confidence:** Verified in source; whether it matters on iPhone **requires runtime validation** · **Product approval needed:** No
- **Plan:** §7.1 items 3–4 ("calls `loadMedia(next, {shouldPlay})` synchronously from the navigation event"), §7.3 ("request play in originating gesture path where possible"), brief question "Could added asynchronous work move playback outside the usable gesture path?"
- **Source:** `CloudflareHlsVideoPlayer.tsx:365–405` — when `beforeLoad` or `resolvePlayback` is provided, `loadMedia` does `await guard?.(…)` (line 397) and `await resolvePlayback?.(…)` (line 399) and only then calls `loadMediaDirect`, which calls `requestUnmutedPlayback` → `video.play()` (line 195). `resolvePlayback` is supplied by `FocusedCardView` whenever protected media is on (`NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1"`, or a shared preparation resource exists). Docs (`docs/engineering/phase-8-preparation.md:143`) list that flag as `1` for the production build. Only the flag-off/direct path calls `play()` synchronously within the click.
- **What the cited WebKit post establishes:** play() must result "directly" from a `touchend`/`click`/`keydown` handler; a `canplaythrough` handler does not qualify. It does **not** say what happens on a media element that has already been started by a gesture and then has its source replaced. No repository document records how unmuted cross-step autoplay works on iPhone today (the history is PR #18 "issuefix/ios-autoplay" → the move to the in-house HLS player in `4a9c492`).
- **Consequence:** The plan's design principle ("play in the gesture path where possible") is not what the production path does today. Either iPhone grants the persistent element a lasting allowance (so the design principle that matters is *keep the same element*), or production autoplay across steps does not work on iPhone today. The plan cannot tell which, and its proposed controller changes could break the former silently.
- **Smallest adequate correction:** Make this the **first** P0 device experiment, run in *both* modes: (flag 0) synchronous path; (flag 1) grant-await path; sequence Intro play → Next → Next, record whether the second and third videos start with sound. State the invariant the controller must preserve: *one persistent `<video>` element, eligibility decided synchronously in the click handler, no new `await` inserted between the click and `loadMedia`*. Also note that the structure already breaks the element on non-video items: the host layer is rendered only when an active video exists (`FocusedCardView.tsx:374,400` and the conditional render near line 875), and `pauseAndReset` runs when it disappears. That matches the spec's rule that crossing an image/activity ends the chain, so a tab design that unmounts the player on non-video tabs is *consistent with* the platform constraint, provided positions are held outside the player. The plan's "retain across tab switches where practical" (§5.2) should be read accordingly.
- **Verification:** Physical iPhone, recorded OS/Safari build; both flag modes; Play→Next→Next and Play→video tab→video tab.

### F-11 — Roots and Factors: the restoration problem is smaller than the plan implies, but one hard invariant will crash the reducer if a hydrated state is inconsistent

- **Severity:** Medium · **Confidence:** Verified (source) · **Product approval needed:** No
- **Spec:** §8.2 restore the current attempt "including stage and state"; §8.3 no duplicate history.
- **Plan:** §4 finding 6 ("Root snapshot lacks lesson/manipulation details needed for exact gates, help-panel state and navigation restoration"); §8.2 "Root snapshot must include …".
- **Source:**
  - Runtime state is `LearningState = { manipulation, lesson }` (`roots-factors/learning.ts:11–17`). `manipulation` is `{ contextKey, revision, lastSessionId, math{movingRoot}, edit, hasChangedPlacement }` (`manipulation.ts`); `edit`, `revision` and `lastSessionId` are transient input counters. `lesson` is a five-case discriminated union.
  - The existing attempt record (`Card1AttemptSnapshot`, built in `recordedLearning.ts:13–18`) already holds `stage`, `settledRoot`, `prediction`, `placements`, `checks`, `checkAttempts`, `incorrectChecks`, `assistanceRequested`, `successMode`. From it one can derive `movingRoot` (= `settledRoot`), `hasChangedPlacement` (= `placements.length > 0`), the prediction choice (`chosenFactorRoot` 3 ⇒ "minus", −3 ⇒ "plus") and `lesson.evidence`.
  - **The only lesson fields not recoverable from the record** are `retrieval.panel` (`"challenge" | "explanation"`) and `retrieval.feedback` (`{checkedRoot, attempt}`).
  - `recordedLearning.ts:100`: when the lesson reaches `completed`, the reducer does `if (!current.prediction || current.prediction.correct === null || current.settledRoot !== -4) throw new Error("Incomplete completion evidence.")`.
- **Scenario:** A hydrated state has `lesson.stage === "retrieval"` but a record whose `prediction` is null (a half-written or tampered snapshot, or a codec bug). The learner's first correct Check throws inside the reducer and the React tree errors.
- **Consequence:** A restoration defect surfaces as a crash on the next ordinary interaction, not at load time. Conversely, the plan overstates the difficulty of Roots: its snapshot is a few hundred bytes, and Roots has no navigation to restore.
- **Smallest adequate correction:** The codec serialises `{ movingRoot, lesson }` plus `records.current`, and `validateSnapshot` enforces cross-field invariants *at hydrate time*: stage ∈ {reveal-explanation, retrieval, completed} ⇒ `prediction` non-null and `chosenFactorRoot` consistent with `lesson.prediction`; stage ∈ {reveal-explanation+} ⇒ `prediction.correct !== null`; `completed` ⇒ `settledRoot === -4`; `retrieval.evidence` agrees with the record's counters. An invalid snapshot is quarantined (plan §8.6), never hydrated.
- **Verification:** For every reachable lesson stage: serialize → hydrate → apply each legal action → same result as the un-restored run. Mutation tests: each invariant violated in turn ⇒ rejected at hydrate, no throw later.

### F-12 — Integration: hydration traps that the plan names in principle but not in their concrete form

- **Severity:** Medium · **Confidence:** Verified (source) · **Product approval needed:** No
- **Spec:** §8.2 resume the current attempt including stage and state; §8.3 meaningful events only, no duplicates; §8.2 completed attempts remain editable.
- **Plan:** §8.2 (Integration snapshot field list; "Hydration must not emit attempt-started or duplicate completion events"), §8.5, E13.
- **Source and traps:**
  1. **The field list is complete.** `IntegrationPanel` (`integration-area/learning.ts:8–15`) has exactly the fields the plan lists (stage, part, region, function, rectangles, divisionSubsection, prediction, comparisons, demonstration, comparisonRun, draft, feedback, helpOpen, checked, problemRevision, answerRevision). `previousPanels`/`nextPanels` are arrays of that same type, built by the existing `panelSnapshot` (line 100), so the codec should reuse `panelSnapshot` rather than re-implement it. The plan does not mention `comparisonRun` (the animation run key) or that attempt-level evidence in `records.current` — `predictions[]`, `checks[]` (the check number is `checks.length + 1`, line 240), `assistanceRequested` — is *not* in the panel and must be restored too. Its "cumulative meaningful evidence" wording covers this generically.
  2. **Constructors emit `attempt-started`.** `initialIntegration` (`learning.ts:42`) and, for Roots, `initialRecordedLearning` (`recordedLearning.ts:29`) each create the `attempt-started` event inside the constructor. A hydrate implemented as "construct, then overlay saved fields" will emit a spurious `attempt-started` for the resumed attempt. Hydration needs its own constructor.
  3. **Sequence/ID reuse.** `sequence = records.events.length + index + 1` and `eventId = attemptId + ":" + sequence` (`learning.ts:62–63`; `recordedLearning.ts:25`), and the delivery cursor indexes `records.events[cursor.sequence]` (`platform/web/learningNotifications.ts:27`, `integration-area/notifications.ts:44`). A hydrated state with an empty `events` array will mint `attemptId:1…` again — identical to IDs already stored. The plan's host-level UUID envelope avoids a database collision only if it *ignores* the activity's own `eventId`/`sequence`; say so explicitly.
  4. **No completion replay through notifications.** Completion is delivered only when an `attempt-completed` *event* appears (`notifications.ts` loop), not from `completedAttempts`, so restoring `completedAttempts` without events does not re-fire `onComplete`. `onRecordsChange` will fire once with the restored snapshot; the host must treat that as a snapshot, not a completion.
  5. **Animation frames are reducer state.** `use-stage-motion.ts` dispatches `demonstrate` with a fractional `progress` roughly 54 times per run; the reducer writes `state.demonstration = progress` **without** changing `revision` (`learning.ts:136–139`). A snapshot trigger keyed to "state changed" would capture frames. Key it to *a change in the serialised committed content* and normalise `demonstration` to 0 or 1 and `edit` to null. A hydrated `0 < demonstration < 1` is harmless but looks like a stall, because the reducer rejects `progress <= demonstration`.
  6. **Completed attempts are locked.** `finish` sets `part: "finished"`; `canGoPrevious` and nearly every action return early when finished (`learning.ts:98,177`), and the only control is "Start again" (`stage-controls.tsx:28`), which calls `restart`. "Completed attempts remain editable" and Back to Start therefore require *reducer* changes (unlock, then a jump to Stage 1 that pushes intermediate panels onto `nextPanels`), not only relabelling the button.
  7. **Back to Start is natural here.** Because `nextStage` already restores `nextPanels[0]` wholesale (`next = { ...next, ...saved }`, `learning.ts:127`), "repeat Previous to Stage 1 with `nextPanels` preserved" gives a same-attempt Back to Start that retains per-stage work. Each stage derives its own region, so stale cross-stage feedback is not a concern; stage 7's `checked` carries `problemRevision`/`answerRevision`, which `canFinish` compares.
- **Smallest adequate correction:** Add to P4: a dedicated `hydrate*` constructor per activity; a content-hash-based snapshot trigger; normalised `demonstration`; explicit statement that activity `eventId`/`sequence` are ignored by the host envelope; and the unlock-on-finish reducer change.
- **Verification:** T12 must assert **zero** events after hydrate for both activities; a test that hydrates a snapshot taken mid-demonstration and a snapshot of a finished attempt, then continues editing.

### F-13 — The modal's temporary staging, "apply to draft" boundary and allocation-receipt ledger are not needed; today's upload flow already attaches on completion

- **Severity:** Medium (avoidable subsystem) · **Confidence:** Verified for today's flow; Strong inference for the alternative · **Product approval needed:** Confirm that a modal-level Cancel/discard is not required (the spec does not ask for one)
- **Spec:** §6 "The modal changes only the card's **draft** until the creator uses the existing card save/publish workflow." Nothing requires a separate staging layer or a Cancel that reverts uploads.
- **Plan:** §5.1 (temporary modal editing with one "apply to draft" boundary), §6.3 items 3–5 and 9, P2 ("pending-asset status receipts"), §5.7 ("pending-allocation reconciliation ledger … quarantine orphans").
- **Source (today's behaviour):**
  - `src/components/creator/CreatorDragLab.tsx:1546–1579` (`uploadPairMedia`) and `:1581–1604` (`uploadIntroMedia`): after `uploadVideoMedia(...)` succeeds, the code calls `persistence.editCard(cardTemplateId, {…desired, steps: … mediaItem })` and then `persistence.flushCard(...)`. The media is **attached to the draft as soon as the upload finishes**; there is no staging.
  - `src/app/api/media/stream/status/route.ts:20` requires `media.some(item => isCloudflareStreamVideoMediaItem(item) && item.assetId === body.assetId)` where `media` comes from the *stored* card (`uploadAuthorization.ts:19–21`). The plan is right that status polling only works for media already attached to saved content — and right that this would deadlock a *staged* upload.
  - A grep of `src/` finds **no provider-asset deletion anywhere** (the only `DELETE` is the personal-media record route, `deckMutations.ts:34`). So "no provider delete on Remove/Replace/Cancel" (plan §5.7) is simply the status quo, and unattached assets already accumulate today.
- **Consequence:** The plan builds a new authorisation object (actor/target/asset-bound receipts, expiry, reconciliation, quarantine) solely to make *staged* uploads pollable. It also introduces a Cancel semantic ("Cancel discards temporary configuration") that the spec did not ask for and that interacts with already-attached uploads.
- **Smallest adequate correction:** Keep the existing model. Each valid change in the modal — including a completed upload — goes to the coordinator lane via `editCard` exactly as today; the existing outer autosave/publish stays authoritative. Only edits that are *not yet valid* (a label set that does not fit; see priority area 6) are held as ephemeral local state inside the modal, which the project's rules explicitly allow for uncommitted input. Count in-flight uploads against the four-item cap with a local counter. Abort and generation checks stay (the existing `isActivePairUpload` / `session` pattern already does this). Drop the allocation-receipt ledger from P2.
- **What this does not remove:** the prospective-fork proofs (`prospectiveUpload.ts`) — those protect non-owners and are unrelated.
- **Verification:** Upload into a slot, close the modal immediately, reload: the item is in the draft and its processing status is readable; abort mid-upload: the previous item is intact; cap counts pending uploads; a fork's first upload still needs and honours the proof.

### F-14 — Storing both `mediaItems` and a legacy `mediaItem` projection invites silent divergence; the code already shows the mechanism

- **Severity:** Medium · **Confidence:** Verified (mechanism), Strong inference (consequence) · **Product approval needed:** No
- **Spec:** §6 existing single-video cards "migrate or adapt transparently"; §11 additive vs migrated schema is an engineering choice; the card-front thumbnail rule (§5).
- **Plan:** §6.1 (`mediaItems?` and `mediaItem?` both on the same object), §6.2, §10.1 item 3 ("Server materializes/validates the legacy projection deterministically"), P1/P2.
- **Source:** `src/components/creator/cardArchitectureAdapter.ts` `privateGraph` rebuilds the **intro** from scratch (line 51) — `intro: { title, description, mediaItem: column.introMediaItem ?? null }` — so any other intro field (such as `mediaItems`) is **dropped** on every board save. For **steps** the same function spreads the old step (line 55, `const retained = { ...old }`; line 61 sets `mediaItem` from the board), so an existing `mediaItems` would be **retained stale** while `mediaItem` is overwritten from the board. The same code path therefore loses an array for the Introduction and keeps a stale one for a step. `assertCardContent` (`domain.ts:29,37`) rejects any unknown key on `intro` and on a step, so the first symptom would be a `UNSUPPORTED_CONTENT_FIELD` or a silent overwrite depending on which side wrote.
- **Also verified:** `sameContent` (`publicationRules.ts:7–20`) is a generic deep equality in which array order and optional-field **presence** are significant. So (a) label/order edits are correctly seen as unpublished changes with no extra work, and (b) materialising `mediaItems` on a card whose media did not change makes it differ from its published version and shows "unpublished changes" for no learner-visible reason.
- **Consequence:** Two sources of truth for one thing. Every future reader/writer must keep them in step; one missed adapter silently loses or contradicts media.
- **Smallest adequate correction:**
  1. Persist **one** field per destination. Define the projection for old readers *at the presentation layer* (`PresentedCard`): `intro.mediaItem` := the first video of the array (or the legacy value for legacy content). `IntroMediaBlock` (`IntroMediaBlock.tsx:61–63`) and `DeckVideoPreparation` (`:17`) already read `card.intro.mediaItem`; leaving them untouched and feeding them a derived value satisfies the card-front preservation rule and the plan's own "narrow selector before the renderer" (§6.2).
  2. Protect stale browser clients by requiring a `mediaProtocol` marker on any full-content write to a card whose stored draft contains arrays (already in plan §10.1.3) — no stored legacy copy needed.
  3. Materialise `mediaItems` **per destination, only when that destination's media is edited**, so untouched legacy destinations stay byte-identical and do not show spurious unpublished changes.
- **What needs changing vs what already works** (a concrete list the plan only gives in general terms):
  - *Must change:* `assertCardContent` (`domain.ts:25–55`), `authorizeUpload` card-template enumerator (`uploadAuthorization.ts:21`), `validateForkAttachments` (`prospectiveUpload.ts`, both the `originals` list and the `after` list), `privateGraph` and the board state (`cardArchitectureAdapter.ts`; `creatorBoardState.ts` lines 24, 38, 471, 482, 578, 632), `instructionalVideos` (`FocusedCardView.tsx:314`), `StepView`'s `getStepViewMediaItem`, the presented-card builder (`useWorkingDeck.ts`), `DeckVideoPreparation.tsx:17`.
  - *Already array-safe:* `contentMedia` (`protectedMedia.ts:12–17`, which recurses through any object, so wrapped descriptors are found), therefore `authorizeCardPlayback` and `authorizeProtectedMedia`; `sameContent`; `cardPublicationIssue`.
- **Verification:** Round-trip tests that save through the board for a card with an Introduction array and a step array and assert byte-equality of untouched destinations; a stale-client write is rejected, not merged.

### F-15 — Embedded instructional images would multiply an uncached, full-scan delivery path that the plan treats as already adequate

- **Severity:** Medium · **Confidence:** Verified for today's path; scale impact is Strong inference (no measurement) · **Product approval needed:** No
- **Spec:** §4.3 images display directly in the Step View, selecting an image tab must show it (no gating), with an optional full-screen control.
- **Plan:** E10/E11 note a "broad legacy image lookup"; §12.5 mentions decoded-image reuse and bounded preparation; P3 shows embedded images. Nothing in core scope changes image *authorisation or caching*; exact-version authorisation for images appears only in P8 (demo decks).
- **Source:** `src/app/api/media/protected/route.ts` serves images (`provider=r2`) through `authorizeProtectedMedia` (`lib/cards/protectedMedia.ts:18–47`), which for **every request** reads the actor's personal user document and then scans all roots the actor owns or that are public, plus their versions in batches of 100, looking for a matching descriptor. The response is streamed from R2 with `Cache-Control: private, no-store` (`protectedMedia.ts` `readProtectedImage`). Video playback, by contrast, uses an exact-context lookup (`authorizeCardPlayback`, `:49–69`).
- **Scenario:** A card has four image tabs in each of four destinations; each tab selection fetches an image of up to 10 MiB through the app server with a database scan and no browser caching, and the same image is re-fetched every time the learner returns to the tab.
- **Consequence:** Cost and latency that scale with the number of public cards and versions, on the learner's critical path, for a feature that makes images first-class. Today images are rarely shown this way.
- **Smallest adequate correction:** Add to P3: an exact-context image route analogous to playback grants (`cardTemplateId + version + mode + attachmentId`, resolved from the exact immutable version), and allow private browser caching (`Cache-Control: private, max-age=…` with `Vary: Cookie`) for the exact-context route. Keep the scan only for legacy/personal paths. Measure first (one number: p95 for the current route on a realistic dataset) before deciding how much caching is needed.
- **Verification:** Authorisation tests for cross-card and cross-version substitution; a measured p95 before and after; an assertion that an unauthorised actor still receives 403 with no cache hit.

### F-16 — On claim, an untouched guest attempt can displace an advanced account attempt that the learner then cannot reach

- **Severity:** Medium (product risk) · **Confidence:** Strong inference (spec + plan text; no claim code exists yet) · **Product approval needed:** **Yes** — a new question, not a reopening of a locked outcome
- **Spec:** §8.2 and §10.1 — continue "the attempt the guest was just using"; keep pre-existing account attempts intact; a history UI is explicitly deferred.
- **Plan:** §9.2 step 5; Q7 (recommends guest-current per activity for *every* guest activity); §12.3 trace B.
- **Scenario:** A learner has a long, advanced Integration attempt on their account. On a new phone they open the same activity as a guest, tap around at Stage 1, then sign in. The guest's near-empty attempt becomes `activeAttemptId`. The advanced attempt is preserved but, with no history viewer in this project, nothing in the product can bring it back.
- **Consequence:** Locked wording is honoured and data is kept, yet the learner experiences lost progress.
- **Smallest adequate correction:** Ask the owner a narrow question: should a guest attempt containing no meaningful events (only `attempt-started`) displace an account attempt that has progress? Recommended: **no** — keep the account's current attempt in that case, and keep the "guest attempt wins" rule whenever the guest attempt has any meaningful event. The locked outcome stays intact for every case the spec describes. Also narrow Q7's "every guest activity" default to "foreground activity, plus any other guest attempt with meaningful events".
- **Verification:** Claim tests with (a) empty guest attempt vs advanced account attempt, (b) advanced guest attempt vs advanced account attempt, (c) account has no record.

### F-17 — Exact server-side label-width validation is not achievable with this app's fonts; a conservative deterministic contract plus client measurement is

- **Severity:** Medium (cost/reliability) · **Confidence:** Verified (font setup); Strong inference (consequence) · **Product approval needed:** Yes, narrowly — the allowed label character set and the supported text-size policy (the plan's Q2 covers the latter)
- **Spec:** §3.2 validate the *combined rendered width* of labels against the supported layout and prevent saving an invalid configuration; one line, no horizontal scroll, no truncation, no miniature text; "exact validation mechanics are engineering questions".
- **Plan:** §5.2 "Label fit" row, §6.3 items 6–7 (DOM measurement plus a "canonical server measurement profile", "pinned-font label measurer or release-generated glyph metrics", Chromium/WebKit boundary fixtures), T03, Q2.
- **Source:** `src/app/globals.css:15` sets `font-family: Arial, Helvetica, sans-serif`. There is no `next/font` or web-font loading in `src/app/layout.tsx` (grep found none). Text is therefore drawn in whatever the viewer's platform maps those names to. Arial and Helvetica are metric-compatible for Latin text, but Android's generic `sans-serif` commonly resolves to a different face, and browser text-size or zoom settings change widths further.
- **Scenario:** A creator on a laptop fits four labels exactly; a learner's phone renders them 3% wider and the single line overflows — the one outcome the spec forbids. Conversely, a server that measures with one pinned font rejects configurations that would fit on the learner's device.
- **Consequence:** A canonical server profile can be *neither exact nor safe* unless the product also adopts a web font for the tabs, which is a new asset, loading and licensing concern the plan does not mention. The plan's own "fail closed if fonts/profile are unavailable" adds an availability dependency to every card save.
- **Smallest adequate correction:**
  1. Fix the tab styling first (font size, padding, gap). The budget cannot be computed before it, and the plan's statement that four "Explore" defaults "may be invalid on the minimum width" (§6.3 item 6) is unverified — with plausible 14 px type my rough estimate fits at 320 px, with 16 px it does not.
  2. In the creator, measure with the real DOM and the device's actual font and require a safety margin (for example 10%).
  3. On the server, enforce a **conservative deterministic bound only**: an allowed character set (for example Basic Latin plus Latin-1 accented letters, which covers Irish fadas), a per-label grapheme cap, and a weighted-width budget using the widest plausible advance per character. No glyph tables, no font files, no new dependency. It may reject some labels that would fit; that is acceptable and predictable for creators.
  4. Never rely on the server bound alone to guarantee the layout: the renderer must be designed so that a label configuration that passed the bound cannot overflow at the supported text size.
- **Owner decisions:** which characters labels may contain (emoji and non-Latin scripts would be refused under this contract); the supported text-size policy (Q2).
- **Verification:** Boundary tests on the weighted budget with the widest strings ("WWWW"), accented letters and the 320/360/390/430 px widths at 100% text size; a device check with Safari's text-size setting at its larger steps to record what happens (a documented limit, not a silent failure).

### F-18 — The no-vertical-scroll full-screen requirement conflicts with Integration's later stages as built; this is the one genuine conflict with a locked requirement

- **Severity:** High · **Confidence:** Verified (CSS floor); the device heights are my estimate and **require measurement on a phone** · **Product approval needed:** **Yes**
- **Spec:** §9 "Mobile portrait is primary; full-screen visuals should not require vertical scrolling"; §13 scenario 19.
- **Plan:** §6.4 (Integration later stages "reserve 200px graph plus up to 372px panels and a 700px minimum … Do not clip content with `overflow:hidden` and claim success … Q2 requires product resolution"), Q2, T19, risk register. The plan identifies the problem correctly.
- **Source:** `integration-area/later-stages.module.css:1` sets `min-height: max(700px, calc(var(--spv-surface-height, 100dvh) - 52px))` on the frame with grid rows 44 px, 2.8 em, 44 px, `minmax(200px, 1fr)` for the graph, `--panel-height` 304 px (292 px at stage 4) and 44 px plus four 4 px gaps — about 695 px before any host chrome. `.frame .graph` has `min-height: 200px` (`:21`). The introductory stages do adapt: `intro-stages.module.css:24–28` shrinks gaps and the graph (to a 200 px minimum) when the height is 760 px or less. In the lab, `--spv-surface-height` already subtracts a 52 px header and the safe areas (`lab/Lab.module.css:9,12`). Roots uses `min-height: var(--spv-surface-height, 100dvh)` with a graph region of 210–480 px (`platform/web/ActivityFrame.module.css:6,24`); I did not total its other regions.
- **Scenario:** In a full-screen host, stages 3–7 of Integration need roughly 700 px plus the host's close/status chrome. The visible height of Safari on current iPhones in portrait is roughly 550–750 CSS px depending on model and toolbar state (my estimate from device sizes, not a measurement). On most phones in Safari, the content would scroll; stage 7 also has a numeric input, and the on-screen keyboard removes a further ~300 px, so "no scroll" cannot hold while it is open on any phone.
- **Consequence:** The requirement cannot be met by a shell change; it needs either a denser Integration layout (a mathematical-layout redesign the spec did not ask for) or an approved exception. Silent clipping is ruled out.
- **Smallest adequate correction:** Do not decide this in implementation. Put the measured heights (P0) and these two options to the owner: (a) accept scrolling inside the activity region only on screens shorter than a stated height, with the header/controls pinned; (b) approve a compact later-stage layout as separate design work. Either way, state an explicit **keyboard exception** for Stage 7's input.
- **Verification:** P0 measurement at 320/360/375/390/393/430 px widths with real browser chrome; a recorded pass/fail per stage.

### F-19 — The plan does not adopt the repository's mandatory layout-pipeline convention for the new visual components

- **Severity:** Low · **Confidence:** Verified · **Product approval needed:** No
- **Source:** `.github/copilot-instructions.md:67–81` requires every visual component to receive its presentational structure from a pure `[ComponentName]Layout.ts` exporting `build[ComponentName]Layout`, with no downstream patching of the returned object. A grep of the plan for `Layout.ts` or `build…Layout` finds nothing; its proposed modules (`StepMediaRegion`, `StepMediaModal`, `ActivityHost`, `labelLayout.ts`) are not named in that pattern.
- **Consequence:** Reviewers will ask for the rework later; the tab-label fit result (F-17) is exactly a layout projection and belongs in such a function.
- **Smallest adequate correction:** Name `buildStepMediaRegionLayout` (tabs, selected item, fit result) and `buildActivityHostLayout` in §6.3–6.4 and say that the controller's selection and position state flows through them; keep the pure selection reducer separate from React state.
- **Verification:** Code review against the convention; unit tests on the build functions.


## 5. Second-opinion assessment of each priority area

Each area states what was verified in source, what I agree with, what I would change, what remains uncertain and the simplest recommended approach. Areas 3, 5 and 9 rest mainly on plan text plus the findings cited.

### Area 1 — Native iPhone autoplay and media-controller ownership *(stage 2 — complete)*

**What I verified in source** (`FocusedCardView.tsx`, `CloudflareHlsVideoPlayer.tsx`, `StepView.tsx`, `videoPlaybackState.ts`, `tests/video-source-transition.spec.ts`, `tests/deck-intro-preview.test.ts`):
- One persistent `<video>` element in a host layer *outside* the keyed `StepView`; it is mounted only while the current step has a video (`FocusedCardView.tsx:374,400`).
- Chain eligibility is the ref `videoPlaybackIntentRef` (`idle | continue | paused`), read synchronously in `goToStepViewItem` (line 537) and passed to `loadMedia(..., {shouldPlay})`.
- `loadMedia` has two routes: direct (sync `play()`), and guarded (awaits grant, then `play()`) when protected media is on.
- Staleness protection already exists and is source-scoped: `abort.signal.aborted` after each await, `operationId` via `isCurrentOperation`, `sourceGeneration` + `isCurrentSource()`, `pauseGeneration`, a 4 s token-scoped internal-pause guard (`INTERNAL_TRANSITION_GUARD_MS`, line 58), and `setPlaybackSuspended`, which never resumes by itself.
- The handle exposes no position getter or restore input (`loadMedia, pausePlayback, pauseAndReset, setPlaybackSuspended, togglePlayback`). The player's `onPlaybackStateChange` prop exists but `FocusedCardView` does not pass it.
- Step View video has native controls (`controls={!isDeckPreview}`, line 648); the custom expand was removed in `4fdd50e`.
- `FocusedCardView` has an unused `renderStepActivity` slot (line 58/354) feeding `StepView`'s `activity` prop; when an activity is supplied the video item is nulled (line 374).
- A `TEMP DIAGNOSTIC` instance counter and `data-diag-video-id` remain in the player (lines 76, 103–110 and the `assignVideoRef` callback). Harmless but should be removed or kept deliberately before the controller is extended.

**What I agree with:** one persistent player, no player per tab; capturing the source *before* pausing; session position as a memory map outside the player (the handle has none today); generation guards on every callback; refusing to replace the HLS player with the iframe fallback (`CloudflareStreamPlayer`); real-iPhone gates.

**What I would change:**
1. Do not replace the intent chain with "observed playing" — **F-08**. Extend the chain with chain-breaking rules instead.
2. Drop custom video expansion — **F-09**.
3. State the real invariant — one persistent element, synchronous eligibility, no new awaits before play — and test it in both flag modes — **F-10**.
4. Shrink §7.2's `MediaSessionState` to selected tab, step-entry key and a position map.
5. Position restore: add `getPosition()` and a `startAt` option to `loadMedia`; apply it after `loadedmetadata` (native HLS ignores early `currentTime` writes; hls.js has a start-position setting). Expect that the poster handoff, which fades from the frame-0 Stream poster, will visibly jump at a restored position; decide in the spike whether to skip the fade when `startAt > 0`.

**Specific answers to the brief's questions:**
- *Gesture-sensitive unmuted playback preserved?* Not provable from source. The persistent element is the design's real protection (F-10).
- *Async work moving play out of the gesture path?* The production path already does this (two awaits before `play()`); new work must not add more.
- *"Actually playing" precise enough?* No — it would drop ended, stalled and rapid-nav chains (F-08).
- *Internal pause overwriting intent?* Guarded by a 4 s token-scoped window cleared on `playing`/play-resolved; adequate for today's flows. New flows involving a seek must be exercised.
- *Stale grant or play promise starting a hidden source?* Existing guards cover this; the only unscoped call is `video.pause()` inside the `play()` resolution handler (`CloudflareHlsVideoPlayer.tsx:204`), which fires only when suspended or after a newer pause generation and is safe. New callbacks (position, tab) must adopt the same generation checks.
- *Full-screen return preserving position without autoplay?* For video there is no custom full screen once F-09 is accepted; native full-screen exit needs a device test. For image/activity overlays the host is unmounted anyway (no video item), and returning to a video tab loads paused at the saved position.
- *Position restoration interfering with readiness?* Possible poster-handoff jump (above); otherwise guarded by `hasCurrentData()` and `isCurrentSource()`.
- *Proposed tests capable of exposing these failures?* Controlled tests can expose ordering, staleness and concealment bugs (the existing ones do). They cannot expose gesture rejection. The plan says so, correctly.

**What remains uncertain (device needed):** whether unmuted `play()` after an awaited grant on an already-gesture-started element is accepted on current iOS; native fullscreen exit state; HLS seek-before-metadata behaviour; stall behaviour on real networks.

**Simplest recommended approach:** keep the intent chain and the single persistent player; add a pure selection reducer (tab + entry key), a position map, two player-handle additions, and a source-aware chain-break on non-video selection. No new state machine.

### Area 2 — Snapshot completeness and safe activity restoration *(stage 3 — complete)*

**What I verified in source:** `roots-factors/{learning,manipulation,recordedLearning,RootsFactorsActivity,learningRecords}.ts(x)`, `integration-area/{learning,use-stage-motion,stage-controls,integration-activity,notifications}.ts(x)`, `platform/web/learningNotifications.ts`, `learning-records.md`. Both activities initialise via `useReducer(..., undefined, () => initial…(createAttemptId()))` with no hydration input (confirmed). Neither reducer or notification path stores timestamps or context.

**What I agree with:** snapshot and event stream are different things; activity-owned pure codecs; host owns transport; no DOM/pointer/frame persistence; debounce draft snapshots; keep every meaningful submission as its own event; hydration must emit nothing; the old `exit` flag must not be hydrated (both reducers return early when `records.exited`).

**What I would change:**
- Roots: the snapshot is `{ movingRoot, lesson }` + `records.current`; add hydrate-time invariants because the reducer throws on inconsistent completion evidence (**F-11**).
- Integration: reuse `panelSnapshot`; restore `records.current`; trigger snapshots on serialised-content change; normalise `demonstration`; separate hydrate constructor; unlock `finished` (**F-12**).
- Make the activity's own `eventId`/`sequence` explicitly non-authoritative in the host envelope (**F-12.3**).

**Direct answers to the brief's questions:**
- *Every state needed for the next valid interaction captured?* Integration: yes — the plan's list equals the 16 `IntegrationPanel` fields, plus two stacks of saved panels, plus `records.current` evidence (`predictions`, `checks`, `assistanceRequested`, `status`). Not captured by the plan's list: `comparisonRun` and the instruction to restore `records.current`. Roots: the plan overstates the gap; only `retrieval.panel` and `retrieval.feedback` are absent from the existing record.
- *Typed but unchecked answers?* They live only in `draft`; `action.type === "draft"` (line 220) updates state **without** `record(...)`, so no event ever carries them. The plan is right that persisting `onRecordsChange` alone would lose them.
- *Panel memories, feedback, help, calculation revisions, demonstration state?* All are `IntegrationPanel` fields; included.
- *Hydration emitting duplicate attempt-started or completion events?* Completion is not replayed (it is delivered from `attempt-completed` events only). `attempt-started` **is** emitted by the constructors, so a naive hydrate duplicates it (**F-12.2**).
- *Restoration granting a completed demonstration or unlocking a stage?* `predict` requires `demonstration === 1` and `canAdvance` at stage 3 requires `prediction.observed`. A snapshot with `demonstration: 1` and no prediction would let the learner predict without seeing the demonstration, so the validator must enforce stage-3 consistency (prediction ⇒ demonstrated). Impact is limited to the learner's own activity; nothing writes card completion.
- *Transient gestures/frames excluded?* `edit`, `settleTo`, `lastEditId` are transient; `demonstration` is a per-frame field and needs normalising (**F-12.5**).
- *Are the proposed serialize/hydrate equivalence tests sufficient?* Good starting point. Add: property-style generation over reachable states using the pure reducers (cheap), hydrate-rejects-invalid, zero-events-after-hydrate, mid-animation and finished-attempt cases.
- *Back to Start without stale feedback?* Integration: the saved-panel design makes this natural and each stage re-derives its own region; stage 7's `checked` carries revisions that `canFinish` compares. Roots: retrieval feedback depends on the current root and must be cleared on return; and `orientation` bounds are `[0, 5]` while a completed root is −4, so Back to Start must define the root position (Q5 is a genuine owner question for Roots).
- *Does continued work in a completed attempt need a clearer completion-history model?* Yes. Both reducers append to `completedAttempts` on every completion with the same `attemptId` (`finish`, `learning.ts:230`; `recordedLearning.ts:104`), and re-emit `attempt-completed`. The plan's `firstCompletedAt` + `latestCompletionReference` summary is the right shape; add that readers must de-duplicate by `attemptId`.

**Uncertain:** how the activity's presentational components behave when remounted from a snapshot at a different viewport (layout recomputation is claimed, not demonstrated); whether the stage-3 replay of an already-demonstrated comparison (existing behaviour: `demonstration` resets to 0 and the animation re-runs without a new event) is acceptable after a restore.

**Simplest recommended approach:** Roots first (tiny codec, no navigation), Integration second; both via hydrate constructors and a content-hash snapshot trigger; host stores `{snapshot, schemaVersion}` and an append-only event stream with host-minted IDs.

### Area 3 — Offline concurrency and conflict branches *(plan-text analysis plus F-01…F-05)*

**Essential:** idempotent append of events by unique `{attemptId, eventId}`; a compare-and-swap on the attempt's `stateRevision` when installing a snapshot; the explicit, idempotent Start New Attempt command (client-generated `attemptId` + command ID); a local outbox that keeps unsynced work and survives reload; an honest pending/saved/failed indicator.
**Deferrable:** writer epochs and BroadcastChannel leases (CAS already detects divergence; leases only reduce thrash); branches within an attempt and the reconciliation choice (F-04); batch receipts (F-02); provisional offline first attempts (F-05); server-side recomputation (F-01).
**Server acceptance order versus learner causality:** keep both, cheaply — `serverSequence` (acceptance order) plus the client's `writerId`/`clientSequence`/`clientOccurredAt` on each event. Do not try to linearise offline writers.
**Duplicate history or silent change of the active attempt on retry?** Not possible if events are keyed by unique ID and the active attempt changes only via the explicit command with an expected `activeAttemptId`.
**Hidden subsystem:** yes — "branches + reviewed continuation" (F-04) is a new product surface; server recomputation (F-01) is a second.
**Simplest design that preserves work:** events always accepted; stale snapshot stored as an immutable checkpoint and replaced on the client by the server's current snapshot; no implicit attempts; no last-write-wins loss because the stale snapshot and all its events are retained. **Uncertain:** whether a one-line "updated from another device" notice is wanted (owner).

### Area 4 — Guest identity and non-destructive account claim *(stage 5 — complete)*

**What I verified in source:** `lib/auth.ts` (30-day HS256 JWT, line 11; `setSession` HttpOnly, `sameSite: "lax"`, `secure` only in production, lines 137–145; `getCurrentUser` looks the user up by ObjectId on every request, line 177; no server-side revocation); `app/api/auth/` contains only `login`, `logout`, `me`; no registration or user-creation code exists outside seed scripts (grep for `passwordHash` outside `auth.ts`: none); `app/api/users/route.ts:14–15` returns every user's `username` to any signed-in user; `lib/mongodb.ts:30` `withMongoTransaction` (snapshot read, majority write) is already used by the repository, so transactions are available; `lib/cards/http.ts:34,53` already bind requests to the initiating actor with `X-Personal-Viewer` / `X-Creator-Actor`; there is no `middleware`/`proxy` file, so access control is per route and `/step-visuals` is public.

**What I agree with:** a *separate* guest principal rather than guest rows in `users` (adding rows without `username`/`email`/`passwordHash` would leak into the directory route and the login lookup); an opaque HttpOnly credential with a stored hash and server-side expiry, domain-separated from the account signing secret; guest access being orthogonal to publication; claim requiring **both** the account session and the guest credential (never `{guestId, accountId}` in a body); fail-closed on expiry before any purge; reusing the actor-binding header pattern for the outbox; deferring demo-deck storage choices.

**What I would change:**
1. Claim by **reparenting attempts** (events are keyed by `attemptId`), not alias records — **F-03**.
2. Drop credential rotation, overlap windows and claim/writer epochs from the first release; use a fixed expiry with sliding `lastUsedAt`. Rotation can be added if a threat requires it.
3. Cap guest attempts per activity so a claim is always one small per-activity transaction; keep the idempotent `claimId` receipt but only build a resumable job if a real cap is exceeded.
4. Narrow the default for which guest attempt becomes current — **F-16**.

**Answers to the brief's questions:** *Ownership resolution understandable and enforceable at every endpoint?* Yes with reparenting (one hop: attempt → record → principal); no with aliases (F-03). *Claimed guest credential reaching account records?* No, if the credential is marked claimed in the same transaction and every guest route checks status. *In-flight requests crossing the boundary?* A guest batch after claim receives `GUEST_CLAIMED`; the client re-sends the same event IDs under the account, which are idempotent. *Guest and account both having attempts for the same activity?* Both are kept; current-attempt precedence is F-16. *Claim retries, partial failure, multiple tabs?* Safe with a unique `claimId` and per-activity transactions. *Token loss, expiry, shared device?* The plan is honest about these; keep it. *Foundation for later guest CardData/DeckData?* Yes — nothing here prevents it.

**Technical versus owner decisions:** technical — credential format, claim mechanism, indexes. Owner — retention period, minor-safeguarding, guest entry point (Q4), local-data handling on logout, and the F-16 question.

### Area 5 — Data-model proportionality, event volume and recovery *(plan-text analysis)*

**Necessary now:** `visualRecords`, `visualAttempts` (holding the latest snapshot), `visualEvents`. **Cheap and worthwhile:** a minimal `visualVisits` insert at open (context for journey reconstruction), and checkpoints **only** for pre-migration and stale-snapshot cases. **Deferrable:** `visualBatchReceipts` (F-02), claim-source alias associations (F-03), a general checkpoint-per-conflict machinery (F-04), a visit-close endpoint (record closure as an event or omit).
**Volume:** the plan's scenarios (§5.4) state their assumptions, which is the right form. For these two activities a meaningful event is a stage change, committed boundary/root, prediction, check or help request; a full run is plausibly tens of events, not 100, so the plan's figures are an upper-side planning input. I did not measure anything.
**Duplicate guarantees after cleanup:** with event-ID uniqueness there is nothing to clean up, so the guarantee does not expire (F-02).
**Rebuildability and recovery:** summaries derived from events and snapshots are rebuildable — agree. Corrupt snapshot → quarantine as a checkpoint and never install — agree (see F-11 for hydrate-time validation).
**Deletion/export across aliases:** moot under reparenting; attempt → record → principal is the only path.
**Are events meaningfully useful rather than telemetry?** Yes for the existing vocabulary (accepted semantic actions only; no pointer samples). They lack timestamps, context and principal, which the host envelope adds.

### Area 6 — Four-label fitting and no-scroll mobile layout *(stage 6 — reduced scope, complete)*

**What I verified:** the global font is a platform-dependent stack with no web font (`globals.css:15`); Integration later stages have a 700 px height floor (`later-stages.module.css:1`); intro stages adapt below 760 px (`intro-stages.module.css:24–28`); Roots uses a viewport-height frame with a 210–480 px graph region (`ActivityFrame.module.css:6,24`). I did not measure on a device or total Roots' regions.
**Is exact server-side text-width validation practical?** No (F-17). **Unnecessarily sophisticated?** Yes for the server half; keep DOM measurement. **Simpler deterministic contract?** Allowed character set + grapheme cap + conservative weighted budget on the server, DOM measurement with a margin in the creator. **Could it reject configurations that fit / accept ones that overflow?** It may reject some that fit (acceptable); it must be sized so it cannot accept one that overflows at the supported text size. **Small heights, safe areas, keyboard, text scaling:** inadequately addressed by the plan's "measure in P0" alone — the keyboard exception and text-size policy need an owner decision (F-18, Q2). **Do activity layouts support a no-scroll shell?** Not Integration stages 3–7 as built (F-18); intro stages adapt; Roots not fully checked.
**Genuine conflict needing approval:** F-18. Nothing here silently introduces scrolling, truncation or tiny text, and I am not recommending any.

### Area 7 — Activity publication and version migration *(stage 5 — complete)*

**What I verified in source:** the existing lab registry is a typed union of lab experiences, not a catalogue (`lab/experienceRegistry.ts:1`); Roots and Factors is `card-1-interactive` in the lab (`:19`) but `activityId: "roots-and-factors"` in its records (`recordedLearning.ts:13`); Integration is `integration-area` in both (`:26`). Events and snapshots already carry `schemaVersion` and `activityVersion` (`learning-records.md`; `recordedLearning.ts:13`). The framework catalogue is static code with a strict validator that rejects any item key other than `id`, `title`, `cardTemplateIds` (`lib/frameworks/configurationContracts.ts:59`), and is labelled a development sample.

**What I agree with:** deployment-based publication initially; **no** database publication pointer; cards store only the stable ID; immutable release records; adopt the newest release at the next open and never swap code under a running interaction (a loaded bundle cannot be swapped anyway); keep references to unavailable activities representable; incompatible state preserves history and routes to the explicit Start New Attempt.

**What I would change:**
1. Use `roots-and-factors` as the stable ID; do **not** reuse lab IDs.
2. Trim the release manifest to `{ activityId, title, status, activityVersion, snapshotSchema, migrations }` plus a build identifier string recorded on attempts. `activityVersion` and `schemaVersion` already exist, so the spec's "record the version that produced the attempt" is met without new axes. Drop `adapterProtocol`, `previewHash` and `restoreFrom` unless the preview-capture pipeline is kept (carry-forward note 1).
3. Defer `GET /api/activities` and `GET /api/activities/[id]/manifest`: with a build-time registry the creator selector can import a client-safe metadata module and the server validates against the same module.
4. Add one small essential: a server-side **per-activity disable list** (configuration, no redeploy) giving the "unavailable" state. Deployment-based rollback redeploys the whole app, which is too coarse for one broken visual.
5. Defer framework `activityIds` (P7 plumbing): the catalogue is a sample, the validator is strict, and the activity identity itself already satisfies "design now".

**Answers:** *Is deployment-based publication sufficient initially?* Yes. *Is a DB pointer needed?* No. *Old client opening a card that references a newer release?* The server compares the client's declared `snapshotSchema`/`activityVersion`; events are still accepted, snapshot install is refused with a typed reload response, and the outbox is kept (this matches the plan). *Rollback without corrupting newer saved state?* Only if the older build can read the newer snapshot; otherwise treat it as incompatible and preserve it (plan §10.3 is right). *Soft retirement consistent with the spec?* The spec is silent on unpublishing; soft retirement does not contradict §7 or §8.4 — owner confirms (Q8). *Does every card adopt the newest activity safely?* Yes at next open.

### Area 9 — Shared shell, educational behaviour and phase sequencing *(plan-text plus stages 2–4)*

**Genuinely common controls:** Close/return-to-origin, the safe-area frame, the save indicator, Back to Start, and Start New Attempt on Stage 1. **Not common:** Previous/Next — Roots has no backward transition (`RootsFactorsActivity.tsx` actions: ready, continue, check, explanation, predict, start-again), Integration does. The plan's "minimal adapter exposing capabilities" is right; a universal stage model would distort Roots.
**Existing completion rules preserved?** The plan says so and I agree (§8.5); Integration Finish is allowed after an *incorrect* check (`canFinish`, `learning.ts:97`), Roots completion requires a correct −4 check — keep both.
**Can a smaller adapter validate the approach first?** Yes — F-06: Roots and Factors first.
**Phase dependency cycles?** None found; one soft dependency that should be removed (F-07b).
**Which questions genuinely block?** Q1 (Introduction front video), Q2 (supported viewport, see area 6), Q5 (Roots Back to Start), Q9 (target activity), Q13 (storage security before guest media/new images). Q3 is largely obsolete (F-09). Q6 shrinks to a small notice decision (F-04). Q4, Q7, Q8 are partly technical.

### Area 8 — Legacy media compatibility and upload lifecycle *(stage 4 — complete)*

**What I verified in source:** `src/components/decks/types.ts`, `lib/cards/{domain,publicationRules,uploadAuthorization,prospectiveUpload,protectedMedia}.ts`, `lib/media.ts`, `app/api/media/{stream/status,stream/direct-upload,protected}/route.ts`, `components/creator/{CreatorMediaUploadSlot,cardArchitectureAdapter,creatorBoardState}.ts(x)`, `CreatorDragLab.tsx` upload handlers, `components/cards/IntroMediaBlock.tsx`, `components/media/DeckVideoPreparation.tsx`.

**What I agree with:** additive reader-first rollout; no rewrite of immutable versions; no provider deletion on Remove/Replace/Cancel (and none exists today); optional file-reuse picker deferred (`prospectiveUpload`, `protectedMedia` and `mediaRegistry` show there is no asset catalogue or reference count, so a picker is not cheap); the video-only front projection; the stale-client protection by a protocol marker; exact-context video grants; server validation of the whole destination; the real-phone requirement for anything touching the player.

**What I would change:**
1. One stored field per destination, with the legacy projection derived at the presentation layer; per-destination lazy materialisation (**F-14**).
2. Drop modal staging and the allocation-receipt ledger; attach on upload completion as today (**F-13**).
3. Add exact-context, cacheable image delivery to core scope (**F-15**).
4. Replace "update all explicit projections" with the concrete list in F-14 (what must change versus what is already array-safe).
5. Proof cap: `assertProspectiveAttachment` (`prospectiveUpload.ts:40`) limits a request to **8** proofs, each verified against every item (O(items × proofs) HMAC checks, negligible). A fork that adds more than 8 new items across a card's four destinations would be rejected. Derive the cap from the 16-item maximum (or per destination) — the plan says this correctly; it is a one-line change, not a redesign.

**Answers to the brief's specific risks:**
- *Arrays silently dropped by a projection?* Yes today, for the Introduction (**F-14**).
- *Old clients overwriting new data?* A stale client's board save would drop or contradict arrays (same mechanism); the plan's marker rule fixes this if it is mandatory for any card containing arrays.
- *Multi-video Introduction poster ambiguity?* Real (Q1), but small: the front reads `card.intro.mediaItem` and `useDeckVideoResource`/`DeckVideoPreparation.tsx:17` follow it; deriving that field from the array in one place resolves both. The owner's choice is only *which* video (Q1).
- *Temporary uploads not qualifying for processing-status access?* Correct for a staged design (`status/route.ts:20`); unnecessary if uploads attach on completion (**F-13**).
- *Existing proof/allocation limits inadequate?* The proof cap is (above). There is no allocation limit to speak of.
- *Reuse/deletion rules breaking assets referenced elsewhere?* No provider deletion exists; the risk arises only if a deletion feature is added later.
- *Is optional reuse correctly deferred, and is necessary asset-lifecycle work accidentally deferred with it?* Reuse is correctly deferred. Nothing necessary is deferred with it **provided** F-13 is accepted; if the allocation ledger is kept, that ledger *is* hidden asset-lifecycle work that grows into the picker's prerequisites.
- *Playback grants and image access?* Video: exact-version, fine. Image: **F-15**.

**What remains uncertain:** the real counts of legacy providerless images/YouTube items and unusual data shapes in the deployed database (plan P0 correctly asks for a redacted, read-only audit); provider CORS/private-origin settings (plan Q13) — not inspected.

**Simplest recommended approach:** single canonical `mediaItems` per edited destination; presentation-layer projection; creator modal writes straight to the existing coordinator lane; exact-context image route.

## 6. Complexity audit

Classification: **E** = essential now; **C** = cheap and worthwhile now; **D** = deferrable; **A** = avoid / replace.

| Proposed mechanism | Class | Reason | Simpler alternative | Consequence of simplifying |
| --- | --- | --- | --- | --- |
| Ordered `mediaItems` with stable attachment IDs, labels, activity references | E | Needed for 0–4 mixed media and repeated items | — | — |
| Stored legacy `mediaItem` alongside the array | A | Two sources of truth; drift already visible in `privateGraph` (F-14) | Derive the legacy value at the presentation layer; write one field | Stale browser tabs are handled by a protocol marker instead |
| New `MediaSessionState` with observed playback states, transition tokens, selection generation | A | Changes ordinary behaviour in three cases (F-08) | Extend the existing intent chain; selection reducer + position map | Smaller change to the most fragile code |
| In-memory session position map; `getPosition`/`startAt` on the player | E | Spec §4.2 | — | — |
| Custom video expansion wiring in Step View | A | Deliberately removed in `4fdd50e`; native controls exist (F-09) | Native full screen | None for the spec |
| Modal staging, "apply" boundary, allocation-receipt ledger | A | Uploads already attach on completion (F-13) | Live edits through the coordinator lane; invalid labels held locally | No modal Cancel/discard (owner confirms) |
| Client DOM label measurement | E | Only accurate source on the device | — | — |
| Server canonical text-width profile / pinned font | D | Fonts are platform-dependent (F-17) | Character set + grapheme cap + conservative weighted bound | Some fitting labels rejected |
| Build-time activity registry with immutable release records | E | Spec §7 | Trim manifest to id/title/status/activityVersion/snapshotSchema/migrations (area 7) | — |
| Database publication pointer; `GET /api/activities` and manifest endpoints | D | Deployment is the publication step | Client-safe static metadata module | None initially |
| Per-activity server-side disable list | C | Whole-app redeploy is too coarse to disable one visual | — | — |
| Release-time browser-capture preview pipeline (hashed assets, closure checks, 3-tier fallback) | D | Needs a pure initial-view render anyway | Live inert static render of that view; add capture only if measured cost demands it | Larger Step View bundle; needs a spike |
| Side-entry overlay host | E | Accepted fallback; lowest risk | — | — |
| Shared-element expansion transition | D | Plan already defers | — | — |
| Per-activity pure snapshot codecs with hydrate-time validation | E | Restoration correctness (F-11, F-12) | — | — |
| `visualRecords`, `visualAttempts`, `visualEvents` | E | Spec §8 | — | — |
| `visualVisits` (insert at open only) | C | Context for journey reconstruction | Drop the close endpoint | Closure not recorded |
| `visualBatchReceipts` | D | Duplicates event-ID uniqueness (F-02) | Unique `{attemptId, eventId}` | Idempotency no longer expires |
| Checkpoints for pre-migration and stale-snapshot cases | C | Preserve work cheaply | — | — |
| Branches within an attempt; reviewed continuation UI; writer epochs; BroadcastChannel leases | D | New UI and concept (F-04) | CAS + stale-snapshot checkpoint | Stale device adopts the server state |
| Server recomputation of outcomes | A | Unscoped subsystem (F-01) | Validate envelope only | Outcomes are learner-reported |
| Offline provisional first attempt | A | Creates implicit attempts (F-05) | Require one successful first open | First open needs a connection |
| IndexedDB outbox and truthful saved/pending/failed indicator | E | Spec §8.3 | — | — |
| Opaque guest credential with hashed lookup, expiry, revocation | E | Spec §10.1 | — | — |
| Credential rotation / overlap windows | D | Not required initially | Fixed expiry, sliding `lastUsedAt` | Add if a threat needs it |
| Claim by source-record aliases | A | Permanent indirection (F-03) | Reparent attempts in a bounded transaction | None |
| Framework `activityIds` plumbing (P7) | D | Sample catalogue; strict validator | Keep activity IDs stable; add when needed | None for the initial release |
| Exact-context cacheable image route | C | Embedded images multiply the current scan (F-15) | — | — |
| Demo decks (P8) | D | Plan already defers | — | — |

## 7. Phase and validation review

- **Dependency order:** no true cycles. One soft dependency should go: P0 characterises *existing* behaviour and does not need Q1–Q5/Q9 answered (F-07b). The critical path (P0 → P1 → P4 → P5 → P6 → P9) is right; the plan's own warning that the creator modal is not the hardest part is correct.
- **Earliest safe vertical slice:** missing (F-06). Add a flagged slice after P1: fixture `mediaItems` with one activity item, preview → full-screen host, **Roots and Factors** codec, open/batch/current endpoints, local outbox, no tabs, no creator modal, no guest.
- **Objective acceptance criteria:** the plan's per-phase gates are mostly objective. Add: P0 records the device experiment in F-10 before any controller work; P3 passes the new characterisation test (F-08) *before* tabs are added; P4 asserts zero events after hydrate (F-12).
- **Missing negative tests:** ended→next, stalled→next, rapid next-next (F-08); hydrate of an inconsistent snapshot rejected (F-11); stale-client full-content write rejected, not merged (F-14); image cross-card and cross-version substitution denied (F-15); claimed guest credential denied on every route; claim with an empty guest attempt versus an advanced account attempt (F-16); label character-set and widest-string boundary tests (F-17); keyboard open at Stage 7 (F-18); offline first open creates no attempt (F-05); replay of a batch long after the original (F-02); duplicate event with altered payload rejected.
- **Real-iPhone gates:** keep the plan's list, with the F-10 experiment first, both flag modes. Add native full-screen exit, Safari text-size steps (F-17), and the Stage 3–7 height measurements (F-18).
- **Migration and deployment ordering:** reader-first is right. Add: a `mediaProtocol` marker enforced server-side before any modern writer ships; per-destination lazy materialisation; the per-activity disable list before any public interactive release; explicit index creation consistent with the repository's own setup scripts (`scripts/setup-info-cards.ts` exists; note that `app/api/public/early-access/route.ts:30,109` creates indexes at request time, which the plan rightly avoids).
- **Rollback with new data:** the plan's §10.3 is right that rollback means returning to a reader-compatible release, never a pre-schema server. Clarify that deployment-based activity rollback reverts the whole app, hence the disable list; claimed guests cannot be un-claimed, so claim code needs the most pre-release testing; pending outboxes must survive a rollback.
- **Gates that can be removed without changing product behaviour:** Q3 becomes confirm-only (F-09); Q6 collapses to a notice decision (F-04); Q10–Q12 are already deferred or evidence-triggered; the P0 dependency on Q1–Q5/Q9.

## 8. Questions requiring owner decisions

I evaluated the plan's questions; I have not reopened any locked outcome.

**Genuine product / UX / privacy decisions**
- **Q1** Which video supplies the Introduction front when there are several. Agree it is a real question. Note that "first video in order" lets a reorder change the thumbnail; the spec's wording "original video thumbnail" leans towards option B.
- **Q2** Smallest supported phone, text-size policy and usable height — agreed, and now tied to **F-18** (a real conflict, with a keyboard exception for Stage 7) and **F-17** (allowed label characters).
- **Q4** Where guest access launches. Agreed; blocks public release only.
- **Q5** Roots and Factors Back to Start. Agreed; for Integration it is mostly a reducer-unlock matter (F-12.6–7).
- **Q7** Retention, shared-device handling and guest-current precedence — agreed, with the narrowing in **F-16**.
- **Q8** Soft retirement versus immediate unavailability — owner decision; the release mechanism itself is technical.
- **Q9** Which implementation is the "Factor Theorem" activity. Verified: only `integration-area` and `roots-factors` exist under `src/app/step-visuals/activities/`; `factor-theorem` is an empty framework item (`lib/frameworks/configuration.ts`).
- **Q13** Media-storage security scope — agreed; I did not inspect provider settings.

**New questions found by this review**
- **N1** If a video plays to its end, does the next video autoplay? Recommended yes — today's tested behaviour (**F-08**).
- **N2** Confirm that native full screen via the video's own controls is the "existing optional full-screen behaviour" and no custom expand is wanted (**F-09**; replaces Q3).
- **N3** For Integration stages 3–7: accept scrolling inside the activity region on short screens, or fund a compact layout; and approve a keyboard exception (**F-18**).
- **N4** Should an untouched guest attempt displace an advanced account attempt on claim? (**F-16**)
- **N5** Which characters may tab labels contain (**F-17**), and is a modal Cancel/discard wanted at all (**F-13**)?
- **N6** (small) Is a one-line "updated from another device" notice wanted when a stale snapshot is replaced (**F-04**)?

**Technical choices for the implementing engineer:** concurrency mechanism (Q6), principal storage (Q7 architecture), release operation (Q8 mechanism), guest credential format, claim mechanism, preview approach, index design. **Evidence-triggered:** Q12. **Future:** Q10, Q11.
**Obsolete or reframed by current code:** Q3 (F-09); Q6 (F-04).

## 9. Recommended amendments

A finite list, in priority order. Each names the plan section and the correction; none rewrites the plan.

1. **§7.2–7.3, P3:** replace "observed playing" eligibility with the existing intent chain plus chain-break rules; add ended, stalled and rapid-navigation rows; add owner question N1 (F-08).
2. **§4 item 4, §7.3 expand rows, P3, Q3:** remove custom video expansion; reword Q3 as N2 (F-09).
3. **§7.1, P0:** make the two-mode (flag 0 / 1) gesture experiment the first device test; state the "one persistent element, synchronous decision, no new awaits" invariant (F-10).
4. **§6.4, P3/P4, Q2, risk register:** record the Integration no-scroll conflict as a blocker with options N3 and a Stage 7 keyboard exception (F-18).
5. **§8.1, §8.4, Q6:** simplify concurrency — events always accepted by unique ID; snapshot CAS; stale snapshot → checkpoint; drop receipts, epochs, branches, offline provisional attempts, server recomputation (F-01, F-02, F-04, F-05).
6. **§5.6, §8.1, §9.2, Q7:** claim by reparenting attempts; narrow current-attempt precedence (F-03, F-16).
7. **§6.1, §6.2, §10.1:** one stored field; presentation-layer projection for the card front; per-destination lazy materialisation; add the concrete change list from F-14.
8. **§5.1, §5.7, §6.3, P2:** drop modal staging and the allocation-receipt ledger; keep fork proofs and raise the cap from 8 to the 16-item maximum (F-13).
9. **§5.2, §6.3 items 6–7, T03:** conservative deterministic label contract with DOM measurement; fix tab styling first (F-17).
10. **P3, §12.5, T-matrix:** add the exact-context cacheable image route and its negative tests (F-15).
11. **§8.2, P4, T12:** dedicated hydrate constructors, hydrate-time invariants, content-hash snapshot trigger, `demonstration` normalisation, ignore activity `eventId`/`sequence`, unlock-on-finish (F-11, F-12).
12. **§11.1:** add the Roots-first vertical slice after P1; remove the P0→question dependency; defer P7 framework plumbing (F-06, F-07b, area 7).
13. **§5.3, §6.4, §6.5:** trim the release manifest; defer the two catalogue endpoints; add the per-activity disable list; use `roots-and-factors` as the stable ID; consider the existing unused `renderStepActivity` slot (`FocusedCardView.tsx:58,354`) for the static preview.
14. **§6.3–6.4:** name `buildStepMediaRegionLayout` / `buildActivityHostLayout` per the repository convention (F-19).
15. **§1.2, §12.1:** fix the "central current-publication pointer" wording and label the historical test counts as pre-change baselines (F-07).

## 10. Final recommendation

**Proceed to implementation only after the owner approvals below and amendments 1–4 are made.** The plan is a strong, honest investigation; its weakness is breadth of machinery, not direction.

**Must happen first:** amendments 1–4 (they protect existing single-video behaviour and surface the one genuine requirement conflict); owner answers to Q1, Q2/N3, Q5, Q9, Q13, N1, N2 (N4 and N5 before their phases); the F-10 device experiment.
**Needs device or measurement evidence, not argument:** gesture-sensitive autoplay in both flag modes; native full-screen exit state; HLS seek-before-metadata and poster handoff at a restored position; Stage 3–7 usable heights on real phones; Safari text-size behaviour; p95 of the current image route; the actual legacy data shapes (P0 audit).
**Strong parts of the plan to retain:** the single persistent player and refusal to use the iframe fallback; the hybrid data model with embedded configuration and a first-class activity reference; separation of snapshot and history; activity-owned codecs; the explicit-new-attempt rule; the guest-first foundation without demo decks; the actor-bound request pattern; reader-first rollout; and its candid evidence labels, historical-test caveats and risk register.

## Appendix — severity index and observations carried from earlier stages

**Severity index (findings are in verification order above):**
- **Critical:** none.
- **High:** F-04 (branches/continuation UI), F-08 (autoplay eligibility), F-09 (video expansion), F-18 (no-scroll conflict).
- **Medium:** F-01, F-02, F-03, F-05, F-06, F-10, F-11, F-12, F-13, F-14, F-15, F-16, F-17.
- **Low:** F-07, F-19.

**Observations not placed in a finding:**
- **Preview generation:** the release-time capture pipeline is only needed if a live inert static render proves too costly. Roots has a pure props-only view (`RootsFactorsView`); Integration's `IntroStages` takes `state` + `dispatch` and could be fed `initialIntegration(...)` with a no-op dispatch. Needs a spike and a bundle-size measurement.
- **Event vocabulary (spec §8.3):** existing events carry no timestamps, principal, context or release identity (`learning-records.md`); the host envelope adds them. The plan should state which learning questions the events can answer (for example, time on task is inferable only from client time on the envelope).
- **Process note:** one batch of four line-number corrections in this report was applied with a script rather than the edit tool; the content was checked afterwards. All other edits used the edit tool.

---

End of report.

