# Info Cards — Functional Specification

**Product:** Switchplay / Puckle  
**Version:** 0.3 — revised product specification  
**Date:** 22 October 2026; agreed Phase 3 UX corrections incorporated 23 October 2026
**Status:** Product-design baseline for the approved prototype-first programme; this document does **not** itself authorise application-code changes or later implementation phases.  
**Supersedes:** Functional specification v0.2 (21 October 2026).  
**Companion document:** `docs/engineering/features/info-cards/info-cards-engineering-plan.md` (technical recommendations and implementation checkpoints).

## 1. Purpose and product principles

Info cards are small, reusable pieces of **creator-authored supplementary information** associated with a main card in a deck (path). They address incidental knowledge, reminders and practical tips without becoming additional learning steps.

For example, a main maths card teaches inverse functions. Supporting info cards might explain function notation or rules for manipulating negative signs. They can be reused on other cards. Ideally, the student completes the main activity without using them; help is available **only when requested**.

- **Main card:** a piece of progress in a deck, with Intro and three steps.
- **Info card:** an optional quick reference, with **no progress, confidence, completion, schedule or adoption state**.

Principles:

1. **Atomic and graspable:** one coherent point whose gist is usually understandable within about ten seconds.
2. **Reusable:** a single info card may support many main cards across decks and creators.
3. **Student-controlled:** never surface info cards automatically.
4. **Minimalist:** protect the calm appearance of the existing main-card front, back and Step View.
5. **Physical metaphor:** info cards emerge as a small bundle from a discreet physical-looking pouch.
6. **Small-scale first:** favour a reliable, straightforward maths and basketball-club launch over elaborate governance or animation.

A detailed basketball session plan is **not** an info-card use case in v1; a document associated with the deck introduction could address that separately. Follower-created notes/media on the **back** of a main card are also separate.

## 2. Vocabulary, identity and relationships

- **Info card:** independently identifiable content with a stable ID, owner, series, title, short body, optional media and publication/visibility state.
- **Series:** a lightweight **globally usable, collaborative grouping** with its own stable series ID, title and originating creator. It is neither a different card type nor an attachable object by itself.
- **Series contributor:** any creator who adds their independently owned info card to an eligible series. Contributing does not transfer ownership or editing rights.
- **Attachment:** an ordered reference to an info-card ID in a **main-card template**. Content is not copied into that template.
- **Step View:** the existing Intro, Step 1, Step 2 and Step 3 surface of a **particular main card**, distinct from the deck introduction.

Info cards attach to main cards, **not** to individual steps or directly to decks. The same ordered attachments are available in all four Step Views of the main card. A single info card can be referenced by different main cards, including multiple main cards within the same deck.

## 3. Series: collaboration, naming and discovery

### 3.1 Series creation and ownership

Any creator can select an eligible existing series or create a new one when authoring an info card. Series have stable IDs and record the originating creator, but do **not** control ownership or editing rights over their member info cards.

- **Different creators may create series with the same name**, each with its own ID.
- **One creator may not create two series with the same normalised name.** The app should identify/reuse their existing series when appropriate, rather than create their duplicate.
- Similar or identical series names belonging to other creators must not be silently merged.
- Other creators may contribute independently owned info cards to a discovered series without requiring an invitation.
- Series need no separate rename/delete/administration interface in v1.

### 3.2 Visibility derives from member cards

There is **no manually set public/private visibility field on a series**.

- A newly created or empty series is visible to its creator, but not discoverable by others.
- A series with only draft or private info cards is likewise not discoverable by other creators.
- A series becomes discoverable to others only if it contains **at least one published public info card**.
- If it no longer has a published public member, other creators cease to discover it; its creator retains access.
- Members shown to any viewer are filtered by each info card's own permissions. Discoverability of a series must **not** reveal another creator's private cards, media, titles or counts.

### 3.3 Series selector and attribution

In Info Card Creator mode, **one dropdown** presents eligible series in two clearly distinguished groups, separated visually:

1. Series originally created by the signed-in user, first.
2. Other discoverable series, below, alphabetically.

The dropdown includes an option to create a new series, using a small inline input or modal. Creation is explicitly confirmed, then the new series is selected automatically. There is no separate series search text box or collection of selection buttons. An existing authorised selection remains valid in its editor even if no longer generally discoverable.

**Show the series creator's username wherever series are selected or managed**, for example `What You Need (username)`. Use compact secondary typography; do not add the words “Created by”. The same applies when two creators have identically named series. Library attribution uses the explicit `What You Need (series by username)` format described in §6 to distinguish series creator from card creator.

**Exception:** on the compact **info-card face**, show only the series name followed by that info card's title. Tapping the series name reveals its originating creator username in a small tooltip/popover; on desktop, hover also reveals it. The tooltip must be accessible without hover alone, and must not interfere with browsing the cards.

## 4. Info-card content and minimalist presentation

Each info card conceptually contains:

- Stable info-card ID and creator/owner identity.
- Title and series ID (with corresponding series name and creator attribution).
- Short plain-text body, potentially two brief paragraphs.
- **Zero or one** media item: a video **or** an image.
- Public/private visibility, draft and published states.

### 4.1 First-release content

The initial version supports plain text, including paragraph breaks. It does **not** require in-card equation typesetting, fractions, LaTeX or rich text. Those can be added later.

The body should communicate a useful point without opening media. In a future maths-capable version, the layout should accommodate approximately **three taller lines of mathematical expressions**, potentially containing fractions.

### 4.2 Card face and capacity

The info card is a **fixed-size, landscape-oriented** reference card, smaller than a main card and with no internal scrolling.

- **One compact top-left header line:** **series name followed by info-card title**, bold, at approximately body-text size. No oversized title treatment.
- A modestly greater gap **after the header** than between ordinary lines of content.
- The great majority of the card's area is reserved for the explanation.
- Target roughly **five normal-text lines spread across two paragraphs**, or the future three taller maths lines.
- **No separate INFO identifier, info-card position number (`1/5`), dots, progress markers or other index** anywhere on the info-card stack. The **closed pouch's count** and the **underlying Step View index** are different controls and remain permitted.
- A single compact, comfortably tappable **media control along the bottom**, only if media exists. It should consume minimal vertical room. **No thumbnail.**
- Only the dedicated media control opens the media viewer. Tapping body text does not.

**No scroll, silent truncation, line clamp or automatic tiny-font shrinkage.** The creator sees a preview matching the student-facing face. Publishing can be rejected if the information will not fit, with a clear explanation and the draft preserved. Quantitative limits must be informed by real prototype measurements, including a test with media present.

The approximate initial size remains the agreed mockup width, with height about **33% greater** than the earlier flat mockups, aiming at roughly half the height of a normal main card. Do not lock pixel values before on-device testing.

Very short viewports and unusual text enlargement may require an accessibility alternative. Investigate existing main-card behaviour and record broader improvements in the backlog rather than silently clipping information; agree any exceptional full-text fallback after Phase 1 evidence. Do not disable browser zoom.

## 5. Creator mode: creation, editing and drafts

### 5.1 Mode switch

The application's main **Create** menu is the authoritative creation entry point. New-item Creator sessions show a top-left **Deck / Info Card** selector. Existing-item editing never shows that selector, whether entered from Library, My Drafts or an existing Deck. Creation versus editing is explicit navigation context and survives autosave/reload where appropriate; obtaining a saved draft ID during new-item creation does not itself change that context.

- Deck mode retains its current functionality.
- Info Card mode provides the editor for the info-card title, series, short text, optional single image/video, draft and public/private publication.
- The main-card attachment selector is **not** a second inline info-card creation tool.
- Switching new-item modes finishes saves/uploads without implicit publication or loss of work.

### 5.2 My Drafts

**My Drafts must discover info-card drafts directly by authenticated owner**, independently of deck membership, card attachments or series membership. It must include:

- All unpublished saved info-card drafts, including info cards never attached anywhere.
- Published info cards with outstanding draft edits, including those not attached to any main card.

An info card with outstanding draft edits remains visible in the Library **as its last published snapshot**; the owner's Edit action opens the outstanding draft. Clean published info cards do not appear in My Drafts; they remain accessible through the Info Cards Library. Successfully publishing removes the outstanding draft entry.

Failed saves, uploads, mode changes and publishing must not silently abandon or orphan an info-card draft. Do not inherit the existing deck-led discovery limitation for detached main-card drafts.

### 5.3 Opening published content for editing

An owner can open their published info card from the **Info Cards Library** and enter Info Card Creator mode to edit it. Do not add a temporary “Open existing…” selector as the expected v1 route.

Return navigation preserves the editing entry point, including across reloads: Library → Edit → Library's Info Cards tab; My Drafts → Edit → the originating drafts context. Existing Deck editing keeps its appropriate originating context. Opening a clean published info card for editing must not create an outstanding draft.

### 5.4 Editor structure and contextual feedback

The header says **New Info Card** during creation or **Edit Info Card** during existing-item editing, with discreet Saving…/Saved status and appropriate publication controls. Do not repeat the card title above the form or add a separate `Series: …` summary.

Form order is **Series → Title → Explanation → Image/video (optional) → Live preview**. Title starts empty: there is no default title. The live preview uses the approved fixed-size `InfoCardFace` and updates as the user edits.

Authoring sequence is **Series → Title → Explanation/media**. Title is read-only but focusable until an existing series is selected or a new series has been successfully created and selected with its returned ID. Merely choosing Create a new series, entering its name, or waiting on/receiving a failed creation response does not unlock Title. Premature Title interaction by keyboard or touch explains: **Choose or create a series first.** Once selected, use the actual series name for live combined-header validation.

Series selection and a non-empty title are prerequisites for explanation entry and media addition/replacement. Controls and form order communicate this sequencing. An attempted premature interaction explains: **Choose a series and enter a title first.** Do not rely on unreachable disabled fields. Remaining controls become available automatically when prerequisites are met.

This is UI sequencing, not a new backend completeness rule. Incomplete drafts continue to save and recover. Existing titles, explanation and media remain intact when a prerequisite is missing. A legacy draft's stored title is displayed read-only until a series is selected. Changing series preserves all content and may immediately expose title overflow; never erase, truncate or shrink stored content to enforce sequencing or capacity.

Missing-field feedback appears by relevant controls when needed. Capacity errors appear immediately beneath Title and Explanation as the creator types, updating for series changes and media addition/removal. The title error concerns the combined series/title header; the explanation error concerns the available body space. Associate errors accessibly with the relevant field. When either exceeds capacity, keep the explicit unavailable-preview state without repeating generic capacity advice. Oversized drafts remain saveable with their full content; server-side capacity validation still prevents publication. Other publication/persistence errors remain visible and actionable near Publish or the relevant field. There is no large permanent requirements/explanation block below the preview. Do not shrink, clip, truncate or silently discard invalid content.

## 6. Info Cards Library

The Library includes two tabs:

- **Decks:** existing behaviour and permissions remain unchanged.
- **Info Cards:** a simple, static catalogue; no deck-style animations or adoption controls.

The Info Cards tab shows:

- All **published public** info cards.
- Additionally, the signed-in user's own **published private** info cards.
- **No** other creator's private info cards and **no** unpublished draft content.

Cards appear face-up in **one simple chronological grid**, without series headings or a separate opening interaction:

1. All published info cards owned by the current user, newest original creation date first.
2. All other public published info cards, newest original creation date first.

Publication/update dates do not affect this order; series do not affect it. The complete order remains correct across pagination, rather than sorting fetched pages independently.

Each card has secondary series attribution, e.g. `Basics (series by other)`, and **Card by phase2** immediately beneath the face with a small gap. Use actual names/usernames and clearly distinguish the two creators without redundant series-creator labels. The compact face itself remains unchanged, with its creator-attribution tooltip rather than a permanent username.

The Info Cards tab has **no Search Info Cards input, Search button or Create Info Card link**. Creation belongs to the main Create menu. Decks / Info Cards tabs and existing Deck Library behaviour remain unchanged. No new filters, management controls or animated packs are required.

A creator may use the Library to open **their own** published info card for editing, whether public or private. Viewing another creator's public info card does not grant editing rights. A published card that also has an outstanding draft remains represented by its published content in the Library, not by draft changes.

Series labels in the Library derive only from authorised published cards; no empty/hidden foreign series are enumerated. Series selection in Creator mode remains distinct from browsing published info-card content.

## 7. Attaching info cards to main cards

Attachments are managed in Creator mode, **inside the existing main-card header/title-editing modal**.

The creator can:

1. Search and select **published** info cards only.
2. See each search result's **info-card title, series (with series creator username) and info-card creator username**, in a compact readable presentation.
3. Attach multiple eligible info cards, remove attachments and reorder the selected list.
4. Save the title and attachment edits into the normal **main-card draft**, then publish through existing main-card publishing/versioning/adoption.

Eligible info cards are published public cards from any creator and the signed-in creator's own **published private** cards. Another creator's private info cards and all unpublished info-card drafts are ineligible. The selection UI must not expose draft content.

**Removing an attachment is not deleting the underlying info card.** Actual info-card deletion is a separate owner action subject to reference restrictions.

An info-card ID occurs at most once in a given main-card attachment list; reuse across different main cards is unrestricted. Ordering is creator-defined for each main card. Content updates to an attached info card do not change that main-card attachment list or its version.

## 8. Visibility, publication, latest-content resolution and deletion

### 8.1 Info-card publication

- An info card's **draft** is separate from its published content. Students and other creators never receive draft changes.
- On each new pouch opening, authorised references resolve to the **latest published** info-card content.
- The content **and selected media publication remain stable throughout that open consultation**, including nested media viewing. Closing and reopening requests the latest publication again.
- Publishing an info-card content change does **not** update main-card versions, adoption records, progress or follower notifications.
- Info-card publication history may be retained **internally** for reliable media and publishing behaviour, but there is **no user-facing historical version selector or info-card adoption process**.

Creators should preserve the basic meaning of an info card when updating it; substantial changes should generally be a new info card. This is guidance, not a new approval workflow.

### 8.2 Visibility and permissions

- Public published info cards are readable in authorised contexts and selectable by other creators.
- Private published info cards remain accessible only to their owner, including the owner's private editing and attachment workflows.
- Once an info card is published **public**, it cannot subsequently be changed back to private. This follows the existing public-publication rule for main cards.
- **Server-side restriction:** a public main card cannot be published with any private info-card attachment. The creator must remove the attachment or publish that info card publicly first.
- Private main cards may attach eligible published public info cards and their owner's own published private info cards; participation in a collaborative series grants no extra access rights.
- Direct-ID requests, search, Library counts, attachment resolution and media delivery must all enforce permissions, not merely hide buttons in the UI.

### 8.3 Removal, deletion and historical references

- Creators may remove an info-card attachment from a main-card draft without deleting the info card.
- An info card **cannot be deleted while referenced** by any retained main-card draft (including a detached draft) or any retained historical published main-card version.
- Removing the attachment from the *latest* main-card version may therefore **not** make the info card deletable: an older retained version can still reference it.
- The owner **may delete an otherwise unreferenced info card**, including a public one. Permanent public visibility does not imply permanent retention of an unreferenced info card.
- The UI should explain a blocked deletion without disclosing other creators' private card information.

**Detached-main-draft edge case:** Some existing detached main-card drafts may be absent from the deck-led My Drafts interface while still retaining info-card references. This is separate from the mandatory independent discovery of **info-card** drafts in §5.2. The engineering plan should choose the simplest safe approach (small permitted recovery mechanism, or an explicit limitation with a backlog task). Do not weaken deletion protection, delete drafts silently or impose an elaborate new workflow as a product requirement.

## 9. Student access: the closed pouch and navigation

Info cards appear **only inside the main card's Step View**, including Intro and Steps 1–3. There is no info pouch on the main card's front/back or as a normal card in the deck sequence.

When attachments exist, show a discreet **diagonal pouch in the actual bottom-left corner of the Step View, inside the same bottom navigation band** as Previous / step index / Next. **It must never be positioned in a row above the Previous/Next controls.**

The closed pouch:

- Shows only an information icon and attachment count, e.g. **ⓘ 5**; no word “Info” or extra arrow.
- Is roughly 20–25% smaller and somewhat lower contrast than the approved standalone closed-state mockup, subject to practical touch sizing.
- Has a clickable/tappable target covering the **entire visible pouch** and an adequately sized hit area.
- Does not reduce the video/activity content height or overlap Previous's touch target.
- Is absent when there are no attached info cards.

**Footer layout:** Previous and Next have **identical width, height and styling**, placed symmetrically around the step-position indicator. The indicator remains centred relative to the **video/step content area**, with tighter horizontal gaps and comfortable margins. The pouch occupies the far-left available region of that same navigation band.

## 10. Opening, appearance and circular browsing

### 10.1 Emerging bundle and resting position

Tapping the pouch pulls a **fixed-size bundle** diagonally upward and right from the actual pouch, with restrained rotation. The stack settles horizontally **over the lower navigation area**, remains visually connected to the pouch, and temporarily obscures Previous/Next and potentially the lower video/activity. The upper part of the underlying paused Step View remains visible as context; it need not be fully visible.

- Move the bundle together when opening and closing.
- Keep each card's width, height and aspect ratio **constant through the animation**: no unnatural growing/shrinking or morphing.
- Render a readable top card and a few subtle underlying edges, not a visually heavy pile.
- Keep the pouch visible, accessible and tappable while open.
- Keep opening/closing motion restrained and consistent with the app's physical-card grammar.

### 10.2 Circular vertical swipes

Info cards form an **ordered circular stack**. For A, B, C, D, E initially:

- Swipe **down:** A moves downward and around to the bottom; B is now on top.
- Repeat to cycle B, C, D, E, then A again.
- Swipe **up:** reverse that movement, bringing the previous card upward from underneath.
- With one attached card, there is no spurious duplicate-card movement.

The gesture must convey physical rearrangement; the implementation need not animate every hidden card if the visible behaviour is faithful.

**No info-card position indicator of any kind.** No `1/5`, dots, page numbers or progress controls. Only the closed pouch's attachment count is displayed.

### 10.3 Isolation and closing

While the stack is open, underlying deck/card/Step View gestures and controls, video interactions and competing keyboard actions are unavailable. Swipes on the info cards affect only the circular stack.

Close by **tapping the pouch** or **tapping the exposed background above/outside the cards**. Tapping an info-card face must **not** close the stack, nor should a closing tap accidentally activate the underlying video/activity.

Closing returns the bundle to the pouch, restores the Step View interactions and resets the collection to the creator's attachment order. **Every new opening starts at the first info card**, not the one last read.

## 11. Step state and media viewing

### 11.1 Video and interactive activities

Opening the pouch pauses a playing step video **without resetting its playhead**. The visible remaining portion acts as context. Closing the pouch **never automatically resumes** it; the student resumes manually.

Pending video playback/loading must not cause playback to start behind an open info stack. Consultation should not remount the Step View or erase an interactive activity's state, input or scroll position. The pouch is anchored to the **fixed Step View interface**, not to its inner, potentially scrollable content.

### 11.2 Info media

An info card may contain one optional image or video, accessed only through a **single compact bottom media control**. No thumbnail. The media opens in an overlay above the info-card stack with a **top-right Close** control. Closing media returns to the **same currently selected info card**, keeping the pouch open; a separate close action then returns to the step.

Layer order: **Step View → info stack → info media viewer**. Background input is isolated at each layer, including during animations.

## 12. Scope, acceptance scenarios and prototype checkpoints

### 12.1 Included in the eventual v1 feature

Independent owned info cards; collaborative series; creator-mode editor; independent My Drafts; actual two-tab Library; published-only attachment picker in the main-card modal; ordered references with normal main-card adoption; simple always-latest info publishing; private/public rules; guarded deletion; compact one-item media; step-view pouch; circular swipe stack; nested media viewer; state preservation and gesture isolation.

### 12.2 Deferred or excluded

Info-card-only revision decks; mathematical equation rendering/rich text; AI selection or generated/composite info cards; progress/schedule/confidence state; directly deck- or step-attached info; multiple media items; elaborate series management and animated Library collections; session-plan cards; follower-added notes on the main-card back.

Broader text-enlargement/very-small-screen accessibility and detached-main-card draft recovery enhancements may be captured in the engineering backlog after the simplest safe baseline is selected. They must not be claimed complete without verification.

### 12.3 Creator and publication acceptance

1. Main Create opens a new-item session with the Deck/Info Card selector; existing-item edits have no selector. Mode changes preserve saved work without publishing; return navigation preserves Library, drafts and existing Deck origins across reloads.
2. Creating a series assigns stable identity; selecting an eligible series created by someone else does not confer rights over that creator's cards.
3. Two creators may use identical series titles with distinct IDs; one creator cannot create their own normalised duplicate.
4. One series dropdown shows own series first, a divider, other discoverable series alphabetically, and explicit new-series creation with automatic selection. Options show series creator usernames; retained authorised selections survive discovery loss.
5. Private-only/empty series are not discoverable to others; a series with a public published member becomes discoverable without exposing its private members.
6. Every saved unpublished or outstanding published info draft is discoverable in My Drafts **regardless of attachments or decks**.
7. A clean published info card is accessible for owner editing from the Library; a dirty published card shows its published snapshot there while its draft remains in My Drafts.
8. Library Decks stays unchanged; Info Cards shows published own cards first then others' public cards by original creation date across pagination, without series grouping, search/create controls, draft/private leakage or an extra opening interaction. Series and card creator attribution are distinct; card attribution sits immediately beneath the face.
9. The main-card header modal searches **published only** info cards by title, series/series creator and info-card creator; allows ordered attachment and removal without deleting the info content.
10. Publishing attachments follows normal main-card versions/adoption; republishing info content updates the next consultation without changing a main-card version.
11. Public main-card publication rejects private info attachments at the server; direct routes and media enforce access independently of the UI.
12. A referenced info card cannot be deleted if any retained main-card draft or historical version refers to it; an unreferenced public info card may be deleted by its owner.
13. Preview and publication validation disclose overflow without clipping, scrolling, discarding the draft or silently shrinking text.

Creator acceptance also includes §5.4: empty initial title; series/title prerequisites with accessible feedback; preserved incomplete content/recovery; minimal contextual header/status/validation.

### 12.4 Student interaction acceptance

14. Pouch appears only in Intro and Steps 1–3 of a main card with attachments, **within the bottom-left navigation row**, never above that row or on the main-card front/back.
15. Closed pouch shows **ⓘ + count** only, is entirely tappable and leaves step content height unchanged. Previous and Next are equal-width with a truly centred step index.
16. The opened bundle emerges **from that same pouch**, maintaining fixed card dimensions and aspect ratios throughout rotation/translation.
17. The stack covers the lower navigation and possibly the lower video while retaining enough upper paused video/activity as visual context.
18. The card face displays a **single compact series + title header**, readable body, and optional minimal media control; no large headings, thumbnails, INFO label, card index/dots or scrolling.
19. Circular up/down swipes physically cycle cards, including wraparound; opening again starts at the first attached card.
20. Tapping the pouch or the exposed upper backdrop closes the stack; tapping a card face does not; there is no background click-through.
21. Underlying card/deck/step/video gestures are isolated while the stack or nested media viewer is open.
22. Opening pauses video without resetting or later auto-resuming it; interactive activity state and mounted identity survive opening and closing.
23. Dedicated media control opens one image/video viewer; closing it returns to the same info card and leaves the stack open.
24. The layout is evaluated on representative small and normal mobile viewports and on an actual phone; exceptional accessibility limitations are explicitly documented rather than hidden.

### 12.5 Prototype-first checkpoints

- **Phase 1A:** pouch/footer geometry and realistic minimal-content capacity, with temporary fixture data.
- **Phase 1B:** fixed-size physical emergence/closing and circular vertical swiping.
- **Phase 1C:** real Step View integration: hosted video, media, gesture isolation, state retention and on-phone evaluation.

The prototype does **not** constitute permission to build the backend/Creator/Library phases. The corresponding engineering plan defines dependencies and test evidence. Ordinary Chromium automated tests plus actual-phone Safari testing form a pragmatic baseline; an unavailable Playwright WebKit environment is reported, not called a pass or allowed to block all progress. Do not introduce virtual iPhone infrastructure as a prerequisite.

## 13. Status, planning boundaries and implementation decisions

This v0.3 incorporates the product decisions reached after the v0.2 repository review and the engineering plan's Section 12 amendment list. The engineering plan is responsible for technical architecture, file changes, concurrency, media delivery, testing specifics and phase/model recommendations. The functional spec remains the authority for **what** the product does.

Before code is written, Codex should verify compatibility with the actual repository and flag genuine conflicts rather than silently changing these requirements. It may choose the simplest safe implementation for detached-main-draft recovery and create an explicit backlog recommendation for deferred UX improvements. Decisions on exact content budgets, minimum display envelope and exceptional accessibility behaviour must follow measured Phase 1 evidence.

Approval of the overall prototype-first direction is **not blanket authorisation** of later phases. Each coding checkpoint should be explicitly authorised in the engineering workflow.

## 14. Visual references and authority

The approved standalone **“Master the Pull-Up Basics”** image establishes the closed pouch **within the bottom-left navigation row**, with Previous and Next moved inward. Apply subsequent agreed refinements: smaller/lower-contrast pouch, equally sized buttons, index centred relative to video/content.

The earlier **“Info Cards Interaction Storyboard”** is useful only for the emergence and lower-overlapping open-stack concept; its pouch **above** navigation is wrong and **must not** be copied. Other generated images may contain invented media, inconsistent card dimensions, oversized titles or misplaced pouches. They are not binding.

**The written requirements, especially the minimal face and exact footer geometry, supersede inconsistent images.**

---

**End of functional specification v0.3.**
