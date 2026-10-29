# Plugged-in Step Visuals - Product Specification

**Status:** Product decisions agreed; technical design and implementation pending.
**Working branch:** `feat/step-visuals-pluggedin` (branched from `feat/step-visuals`).
**Intended repository path:** `docs/design/features/step-visuals/plugged-in/plugged-in-step-visuals-specification.md`.
**Engineering-plan destination:** `docs/engineering/features/step-visuals/plugged-in/plugged-in-step-visuals-engineering-plan.md`.

## 1. Purpose and product boundaries

Plug existing, independently developed interactive maths Step Visuals into the existing card Step View as reusable media, alongside videos and images. Preserve the existing card experience where possible while giving creators control over the order and labels of media in an introduction or step. Establish first-class, durable **Visual Learning Records**, independent of cards, so that learners can continue an activity across visits and access paths. Design for guest learning and future guest-accessible demo decks without making the entire demo-deck facility a prerequisite for the initial multimedia integration.

This is a product specification, not an approved architecture or implementation plan. Codex must inspect the real codebase before choosing schemas, APIs, UI components, persistence strategies or release phases. Where a product or UX question remains open, Codex must flag it for approval rather than silently decide it.

The product has four step-like destinations per card: the **Introduction** plus **three main steps**. Unless a requirement explicitly distinguishes them, all four have the same multimedia capabilities.

## 2. Scope and phasing intent

**Core product requirements:**

1. Introduce a creator-managed media collection of **one to four items** per introduction/main step, with zero media remaining possible where already supported.
2. Support video, interactive visual and static image/diagram as media items; mixed or repeated types and any creator-defined order are allowed.
3. Preserve the existing Step View and iPhone video behavior for single-video steps.
4. Enable the selection and display of centrally published, reusable interactive visuals, with a static automatic preview and full-screen interaction.
5. Implement first-class, persistent Visual Learning Records with attempts, meaningful history and resumable state, shared across entry points.
6. Support unauthenticated activity access without a login gate where the activity is otherwise accessible, with guest persistence and later account association. Determine sequencing and dependencies during engineering planning.
7. Update Creator Mode through the existing entry point, preserving the existing card draft/publish process.

**Design explicitly now, but plan as a separate/later phase:**

- Guest-accessible **demo decks**, including selective deck/card permissions, guest DeckData/CardData, end-to-end guest journey reconstruction and secure access from a deck URL.
- Independent direct activity links, Progress menu, and framework-driven discovery/display where not currently implemented. Their identity and data-model requirements must be anticipated now; do not invent a new Progress UI in this project.
- A full attempt-history viewer or analytics dashboard. Record meaningful data now; do not build these interfaces without approval.
- Reuse of already uploaded video/image files by creators: include only if inexpensive within the existing media architecture; otherwise defer with an explicit recommendation.

**Out of scope:** A tool for creators to author/program new interactive visuals, arbitrary external URL/iframe embedding, automatic card-step completion based on visual completion, a wholesale redesign of card fronts or Step Views, and redesign of the Introduction thumbnail.

## 3. Multimedia model and Step View

### 3.1 Supported media and capacity

- Each Introduction or main step supports **up to four media items**, in an arbitrary combination of video, interactive visual and image/diagram.
- Creators determine item order and short tab labels. The first item is the default media presentation when the step is entered.
- **Zero items:** Preserve existing empty/no-media behavior. **One item:** Show media directly with **no tab bar**, preserving the familiar single-video UI. **Two to four items:** Show labelled tabs above/alongside the media within the existing Step View media region.
- Keep the introduction and the three main steps as the existing card navigation units. The existing **Previous/Next** buttons still navigate between Introduction and steps, **not** between media tabs.
- Media-tab selection affects the content within the media region, not the surrounding step content or card completion state.

### 3.2 Tabs and labels

- All tabs must be visible together on **one line**, including on the narrowest supported iPhone; no horizontal tab scrolling, truncated labels, or miniature unreadable text.
- Suggest editable labels by type: **Watch** for video, **Explore** for interactive visual, **Image** for image.
- In the creator modal, validate the **combined rendered width** of labels against the supported layout, rather than relying solely on individual character limits. Prevent saving an invalid label configuration. The exact validation mechanics and responsive breakpoint approach are engineering questions.
- Do not add numbering, hierarchical lesson substeps, or a mandatory pedagogical order.
- Clicking/tapping a tab selects its item. Any new gesture navigation or transition effects not already agreed require explicit approval. Keep switching visually coherent and lightweight.

### 3.3 Step entry versus return from full-screen

- On **every new entry or re-entry into a step**, select the **first media tab** again, even if the learner last selected another tab.
- This resets only the **selected tab**, **not** the activity's learning state, attempts or applicable session video playback position.
- Closing expanded/full-screen media returns to the **same step and tab** that launched it. This is a return to the current step context, not a fresh entry that would select the first tab.

## 4. Media behavior

### 4.1 Interactive visuals

- An interactive visual appears in the Step View as a **noninteractive preview** representing the initial activity screen, with a clear control to open/expand it.
- Preview generation must be **automatic**; creators must not need to upload a thumbnail. Codex should compare robust approaches for initial-state preview generation and caching. The preview must not start a learning attempt or emit learning events.
- Interactive activities are **usable only in full-screen mode**; no reduced-size interactive mode within the media region.
- Prefer a smooth expansion from preview into full screen with strong object continuity. If that is disproportionate to implement robustly, a simple full-screen overlay entering from the side is the accepted fallback. Codex must document feasibility and the selected approach; do not introduce a wholly new viewer design.
- The activity's Close control returns to the **originating Step View and media tab** and preserves the learner's state.
- For access from a catalogue or future direct link, provide an origin-appropriate return destination rather than hard-coding a return to Step View.

### 4.2 Video

- Video plays **within the Step View media area**, with the existing optional full-screen/expanded behavior.
- Preserve the existing hard-won iPhone/Safari playback and pause-aware autoplay behavior. A technical change that regresses ordinary one-video steps is not acceptable.
- Playback position is retained while navigating among tabs/steps **during the current session**; no requirement to save playback position across separate visits. On a fresh visit the video may begin at the start.
- Video must not continue playing invisibly behind another tab, step, image or visual.

### 4.3 Images and diagrams

- Images display directly within the Step View media area. Selecting an image tab must **not** automatically open full screen.
- Provide an explicit optional full-screen/expanded image control. Closing returns to the originating step and media tab.

### 4.4 Precise pause-aware autoplay contract

The destination video starts **automatically only when the immediate source was a video actively playing**. This applies to video-to-video tab changes and to moving between card steps, including Introduction.

| Immediate source -> destination | Required behavior |
| --- | --- |
| Actively playing video -> another video | Destination video autoplays. |
| Paused video -> another video | Destination video remains paused. |
| Interactive visual/image -> video | Destination video remains paused until Play is pressed. |
| Playing video -> visual/image | Pause source immediately and preserve session position. |
| Any media -> a new step | First tab is selected; if it is a video, use the same source-aware autoplay rule. |
| Return to a video tab in the same session | Preserve position; do not infer autoplay merely because it was playing earlier. |

Codex must investigate route changes, component unmounts, browser autoplay permission, mobile Safari and fullscreen transitions. If the preferred multimedia autoplay handling is genuinely disproportionately costly, Codex may offer an **explicitly approved fallback** that disables autoplay for transitions involving multimedia steps, but it **must not** regress existing ordinary single-video-step autoplay without explicit approval.

## 5. Card front and Introduction thumbnail - preservation rule

**Do not redesign or alter the existing Introduction thumbnail logic.** The card front currently shows the Introduction **video thumbnail** if a video exists; if no Introduction video exists, it shows no thumbnail. This must remain true even when the Introduction contains images or interactive visuals.

- The Introduction itself gains the same multimedia functionality as all other steps.
- Media attached to the Introduction must not cause the card front to substitute visual/image thumbnails for the existing video thumbnail.
- Do not introduce thumbnails for the three main steps on the card front.
- If the old thumbnail implementation cannot safely coexist with the proposed media model, Codex must explain the issue and raise a **QUESTION**. No speculative workaround or behavior change is authorised.

## 6. Creator Mode and publishing

- Retain the **single existing media upload/link control** in the card header (Introduction) and in each of the three main step cells, in their current locations.
- Clicking that control now opens a **multimedia management modal**, rather than directly uploading one video.
- Within the modal, creators can add new videos/images, select an existing published interactive visual, view the configured items, change their order, edit labels, replace media and remove individual items, subject to the four-item cap.
- The order controls the first tab presented to learners; creators can reorder without deleting and re-adding items.
- Any creator may add **any published interactive visual** to their cards, but creators **cannot author or modify** the interactive visual implementation. Interactive visuals continue to be built through the existing developer-led Step Visuals process and centrally published to an internal catalogue/registry.
- The selector stores a **stable activity identity**, not an external URL or a manually pinned version. The activity's **latest published version** is used throughout the app.
- Use existing upload services and media flows where feasible; do not silently change their ownership or permissions.
- If inexpensive, allow selection/reuse of a creator's previously uploaded video/image without duplicating files. Investigate reference ownership, media deletion and access controls. If significant, explicitly defer this option.
- The modal changes only the card's **draft** until the creator uses the **existing card save/publish workflow**. No independent media publishing.
- Do not reset existing step-completion state when a card creator adds, removes, replaces or reorders media. Existing CardTemplate version notes can communicate published changes.
- Existing cards containing a single video per step must migrate or adapt transparently to the new representation, while preserving the current single-video presentation.

## 7. First-class interactive activity identity

An **interactive activity** is a centrally maintained, reusable learning experience with a stable immutable ID, distinct from any CardTemplate or DeckTemplate. Multiple cards, decks, future framework items and direct links may reference one activity. Cards reference the same published activity instead of cloning its implementation.

- An activity can be published independently of any card.
- Publishing an updated activity automatically makes that version available in **every card referencing it**. Individual creators do **not** opt in to updates and do not pin versions per card.
- Attempts/history record the activity version that produced them. Compatible saved state must be restored across minor updates; incompatible state must never be corrupted or silently discarded. Prior attempts remain as history and the learner can start a fresh attempt on the new version if necessary.
- Codex must investigate activity registry, metadata, publish/version semantics, compatibility and state migration; do not presume this is already implemented.
- Future framework entries should be able to reference **activity IDs independently of card IDs**. Inspect the existing framework configuration, particularly `src/lib/frameworks/configuration.ts` if present, and trace how framework entries currently reference CardTemplates. Schema choice is for the engineering plan.
- Future direct activity links and Progress views should reuse the same activity identity and learner records. Do not build their complete UX without approval.

## 8. Visual Learning Records - terminology, identity and persistence

### 8.1 Terminology and ownership

Use the exact product term **Visual Learning Records**. Avoid the generic label "learning records" where it could be confused with CardData, DeckData or other learner data.

Visual Learning Records are **first-class data separate from CardData and DeckData**. They belong to the **learner identity + stable interactive activity ID**, not to the card/deck in which the activity appears. They must be reusable across all contexts.

These are conceptual requirements, **not** a prescribed collection or database schema:

- Per learner and activity: a durable record identity, associated attempts and progress.
- Per attempt: unique attempt identity, creation/version metadata, meaningful action history and restorable state.
- Per access/event/context: enough source information to reconstruct the learner's journey, e.g. deck, card, step, framework, catalogue or direct-link context where applicable, without creating duplicate per-card activity progress.
- Distinguish **history of what happened** from the **snapshot needed to resume**. Codex must audit the existing Step Visual learning events and state models for sufficiency and missing semantics.

### 8.2 Attempts and restoration

- A learner can have **multiple attempts** at the same visual. Old attempts, answers and meaningful history must be retained.
- Reopening an activity restores its **current/latest active attempt**, including stage and state, even after leaving for days; completion alone does not make an attempt immutable.
- Existing "Start Again"-type behavior after completion should be relabelled **Back to Start**. It returns to Stage 1 **within the same attempt** and must **not** delete earlier work, previous stages, attempts or events. Learners may continue modifying their completed attempt, and those modifications remain part of its history.
- On Stage 1 provide a **secondary Start New Attempt** action with a confirmation. Only this action creates a fresh attempt with fresh state. Past attempts remain available in the underlying data even if a history UI is deferred.
- Generic navigation controls and attempt semantics should be consistent across interactive activities; each activity retains its own mathematical interactions.
- After guest-to-account association, if the guest was in a current attempt, continue **that guest attempt**. Keep pre-existing account attempts intact; neither source overwrites the other.

### 8.3 Autosave, offline and interrupted connectivity

- Persist meaningful interactions and restorable state **automatically throughout the experience**, not just when the learner closes a visual.
- Never require a Save button or block continued interaction during temporary loss of network connectivity.
- Retain unsynchronised work locally, retry automatically and expose a **small, non-blocking indication** when changes are not yet safely saved to the server. Do not falsely indicate saved status.
- Avoid recording every pointer frame, graph redraw or animation tick; capture meaningful changes and learning decisions. Codex must evaluate throttling/batching, ordering, retries, conflict resolution, unload/navigation and multi-tab behavior.
- Session-only state is **insufficient**; eventual database persistence must support return days later.
- The plan must distinguish already-implemented event instrumentation from new durable persistence and assess whether events are sufficiently interpretable for later learning analysis.

### 8.4 Completion independence and deletion semantics

- Finishing all stages of an interactive activity records activity completion but **does not automatically mark the host card step complete**. Step completion remains the user's explicit card action.
- Removing an activity from a card or replacing/reordering that media item must **not delete or reset** the learner's Visual Learning Records. Historical access context should remain interpretable even if a reference is later removed.
- Updating card media also must not reset previously completed card steps.

## 9. Shared full-screen activity shell

Develop a concept of a reusable **host-level activity shell/frame** based on the existing seven-stage Integration visual, but only extract genuinely generic functionality after inspecting several actual visuals.

Candidate generic responsibilities: close/return-to-origin, responsive full-screen frame and safe area, activity-stage Previous/Next, Back to Start, the Stage 1 Start New Attempt action and consistent positions for truly shared controls.

Activity-specific responsibilities remain activity-specific: mathematical graphs, sliders, drag points, prediction prompts, rectangle counts, formula controls and tailored visual arrangements. Do not impose one generic layout on incompatible learning interactions.

- Mobile portrait is primary; full-screen visuals should not require vertical scrolling.
- Prefer stable control positions for shared actions across activities.
- Inspect existing control ownership before choosing extraction boundaries; Codex must avoid refactors that break already-tested visual behavior.
- No novel common shell controls or UX patterns may be introduced without review.

## 10. Guest identities, guest learning and future demo decks

### 10.1 Immediate unauthenticated access to an activity

Where an activity is accessible (e.g. future direct link or a designated demo deck), a visitor can open it and interact **without first signing in**. Guest Visual Learning Records are **persisted to the database**, not held only in browser memory. Use a stable pseudonymous guest identity and keep activity attempts/history/restorable state just as for an authenticated learner. Do not depend on collecting precise location or fingerprinting a device.

- Returning with the same still-valid guest identity should recover previous activity progress.
- Provide a **contextual, non-blocking sign-in invitation** after meaningful progress or activity completion, e.g. to keep progress across devices. Do not interrupt the start of the experience with login demands.
- If a guest registers or signs into an account that already has progress, **preserve both sets of attempts and histories** without duplicates or overwrites, and continue the attempt the guest was just using.
- Codex must investigate guest token/session issuance, tamper resistance, least-privilege access, guest retention/expiry, privacy/minor safeguarding, ownership transfer, idempotency and concurrency. Any consequential policy trade-off should appear in QUESTIONS.

### 10.2 Selectively accessible demo decks - explicitly deferred implementation

The application should eventually support **designated** decks accessible to anyone possessing their URL, without requiring sign-in. Other decks must retain their existing restrictions.

- A creator or authorised party marks a deck as available to guests through a suitable property or existing visibility/status model; **the exact representation is not decided**.
- Guests can open that deck, navigate its cards and introduction/steps, watch its media and use its interactive visuals immediately.
- Cards should be accessible in the context of a demo deck without accidentally making them universally accessible outside authorised contexts. Codex must investigate whether separate card-level access metadata is required or whether permission should be inherited/contextual.
- The preferred conceptual model is **a guest user with ordinary DeckData, CardData and Visual Learning Records**, with the same general progress semantics as signed-in users, not an entirely separate demo-only database model.
- The system must be able to reconstruct the visitor's journey through the demo deck and its activities. **Keep Visual Learning Records separate from DeckData/CardData**, but include durable contextual associations/events that allow the journey to be reconstructed. Investigate whether DeckData/CardData need visit/history additions or a separate contextual event mechanism.
- Codex must compare possible models for guest deck/card access and data association, recommend one, and explain how to phase it later without needing to redo the core visual data architecture.
- **Do not implement the demo-deck facility in the initial multimedia phase.** Include it in the engineering plan as a clearly distinct later phase or optional extension, with dependencies and acceptance criteria.

## 11. Publishing, migrations and backward compatibility

- The application must continue to read/render existing cards and draft data that use the current single-video structure, including if the visual activity catalogue contains no items yet.
- Investigate additive versus migrated media schema, draft/published version handling, data backfill strategy, read/write compatibility and rollback. A phased migration must not lose Cloudflare video identity, posters or access policies.
- The card-level publish workflow is authoritative for *changes to card media configuration*. The central interactive-activity publication workflow is authoritative for *changes to a visual implementation*; all card references automatically pick up the latest published activity version.
- Preserve CardData, per-step completion, historical attachment relationships and stable source identities.
- Avoid regressions in existing Introduction thumbnail, card navigation, ordinary one-video playback and upload workflows.

## 12. Engineering-planning requirements and open decisions

Codex must **investigate**, not guess, existing code and documentation for the Step Visual implementations, media components, the card creator, templates/data, activity records, publishing, Cloudflare storage/video playback, account/session handling, and framework configuration. The plan must compare realistic options, describe trade-offs and make recommendations. The following are deliberately **not** product decisions yet:

1. Exact media-item schema and migration pattern.
2. Visual registry/catalogue and central publishing/versioning implementation.
3. Automated preview generation: static first-frame capture, browser snapshot, generated asset, server cache or other supported solution.
4. Fullscreen architecture and animation feasibility/fallback.
5. Shared shell extraction boundaries and preservation of existing visual interactions.
6. Visual Learning Records schema, event granularity, snapshot frequency, autosave/queued offline mechanism and conflict resolution.
7. Activity version compatibility detection and migration behavior when state cannot safely resume.
8. Guest credential/identity method, retention/privacy constraints, and reconciliation with signed-in records.
9. Future demo deck/card permissions, guest DeckData/CardData and visitor-journey reconstruction.
10. Framework activity references, direct activity entry points and Progress integration boundaries.
11. Video/image upload reuse if cheap, or explicit deferral otherwise.
12. Any genuine unresolved product UX or access-control trade-off uncovered by code inspection.

Codex should select ordinary engineering choices itself with reasons. For **material product, UX, policy or architecture choices with meaningful trade-offs**, offer options and a clearly labelled **QUESTION** with a recommendation, and await approval before implementing. This specification is the authority for agreed behavior; do not invent or silently implement new requirements.

## 13. Acceptance scenarios for engineering plan and later testing

Codex must turn the following into a device/browser and automated test matrix, plus any additional discovered cases:

1. An existing published card with a single Introduction video and single videos in its steps looks and works as before, including mobile autoplay.
2. A step with exactly one video, one image or one interactive visual renders directly without a tab bar; a visual is still preview-only until expanded.
3. Steps, including Introduction, can contain four items of mixed types, custom order and short valid labels; tabs fit on the narrowest supported iPhone.
4. Invalid combined label widths are prevented in Creator Mode; changing tab order changes default media without changing card completion.
5. Navigating away from a step and returning selects its first tab again, while the same activity attempt resumes intact.
6. Closing full-screen media returns to the exact host step/tab and preserves learning/video session state as applicable.
7. An active playing video hands autoplay to a new video; paused video does not; image/visual never triggers video autoplay; hidden video stops playing.
8. A video resumes at its session position after a tab or step switch, but fresh visits do not require persistent playback position.
9. Introduction card-front thumbnail remains the original video thumbnail if one exists, and remains absent if no Introduction video exists, regardless of other media.
10. Adding or replacing multimedia is draft-only until card publication; an existing video is not lost in migration.
11. Activity completion does not tick a card step; removing an activity from a card does not delete its Visual Learning Records.
12. A learner progresses through an activity, closes/reloads/returns days later and resumes the correct stage/state/attempt from the database.
13. Back to Start navigates within the same attempt without erasing previous history; Start New Attempt requires confirmation and preserves prior attempts.
14. Progress made while offline remains usable, is visibly pending rather than falsely saved and ultimately syncs without duplicate history.
15. Two different cards referencing the same activity share the learner's activity record while preserving the contexts in which it was opened.
16. Publishing a compatible new activity version updates all cards and resumes progress; an incompatible version preserves prior history without corrupted restoration.
17. A guest can interact with an accessible activity without login, save Visual Learning Records to the DB and later link them into an account retaining both guest and existing attempts.
18. Future demo-deck design ensures only designated decks are guest-accessible, card permissions are not leaked, guest DeckData/CardData/Visual Learning Records remain coherent, and a visitor's journey can be reconstructed.
19. iPhone Safari safe-area, portrait sizing, no-scroll full-screen interaction, fullscreen close, rapid navigation and play/pause edge cases are verified on a real phone.

## 14. Non-negotiable collaboration rules

- **No code implementation or UX redesign until the engineering plan has been reviewed and approved.**
- Codex must identify conflicts, missing information and novel proposals in a prominently labelled **QUESTIONS** section rather than deciding them without approval.
- Preserve the existing product language: Introduction, Step View, CardTemplate/CardData, DeckTemplate/DeckData, published interactive activity, **Visual Learning Records**.
- Engineering phases should be practical, independently testable, regression-conscious and reversible where feasible. Include manual **real-iPhone** checks, not only simulated mobile viewport tests.
- Any fallbacks that materially deviate from agreed behavior require explicit approval.
