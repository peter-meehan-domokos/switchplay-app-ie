# Info Cards — Reconciled Engineering Plan

Date: 22 October 2026; Phase 2 handoff updated 23 October 2026. Status: **Phases 1A–1C completed; Phase 2 backend implemented and tested, with live media-provider verification still outstanding.**

Implementation order is **1A → 1C → 1B → final integration verification**. Phase 1A's committed visual baseline is `a4c2e2a`; its [refinement evidence](phase-1a/visual-refinement.md) remains authoritative for prototype styling. The 1B start inspection found a clean `feat/info-cards` worktree at `666abb4` (committed Phase 1C), so no concurrent edits require another worktree. The functional specification is unchanged. Later visual decisions (secondary series/primary title and dedicated consultation X) supersede older wording in specification §§4.2/10.3 and are preserved.

Authority: [functional specification v0.3](../../../design/features/info-cards/info-cards-functional-spec.md), together with subsequent approved visual decisions. Section 12 records the earlier reconciliation; section 13 contains deferred improvements and section 14 retains the original 1A task. See [Phase 1B evidence and review instructions](phase-1b/README.md) and the historical [Phase 1C handoff](phase-1c/README.md).

This document distinguishes **Fact** (inspected repository or observed diagnostic result), **Decision** (agreed product behaviour or a technical choice made under the user's delegated discretion), and **Recommendation** (implementation guidance). Current coding authority covers **Phase 2 only**. Creator/Library UI and production attachments remain later phases. See the [Phase 2 handoff](phase-2/README.md) for implementation and verification status.

### Phase 2 readiness amendments

1. Phases 1A–1C are complete per the user's acceptance; historical checkpoint instructions below do not reopen them.
2. Separate incomplete draft content (blank title/body and nullable series allowed) from valid publication content. Save identity before uploads; query drafts directly by owner. Publication alone requires complete, fitting content.
3. Creation uses a caller-stable ID and exact retry recovery. Save uses revision preconditions; immutable publications retain the consumed revision for lost-response recovery without a second publication or overwriting newer edits.
4. Capacity validation uses the measured 240×157 face, combined header and close-control reservation, body wrapping/paragraphs, and optional media reservation. Use deterministic measured font advances with conservative fallback and browser comparisons; no arbitrary word limit, client `fits` flag, or publication-time browser service.
5. Deck publication pins already-published main-card versions. Creator's publish-and-leave separately publishes owned main drafts first; that sequence is not an atomic graph publication. Enforce private-attachment rules in every actual main-card publication entry point in Phase 4.
6. Phase 2 supplies reference guards, indexed draft/history deletion checks and permission primitives. Phase 4 must wire every canonical main create/save/fork/publish writer before enabling attachments. Copying an owned main card by reference into another deck creates no new main content. Do not add reverse-reference counts.
7. Media must prove owner/target/provider provenance and be read through an exact owner-draft or immutable-publication context. Private-era versions remain private after promotion. Provider-side protection is a separate deployment gate; fail closed until verified. No eager asset garbage collection.
8. Absent and empty attachment lists are semantically equal. Phase 2 provides normalisation/guard primitives; Phase 4 audits strict validators, equality and all projections/forks before persisting the optional field. Do not rewrite historical publications.

## 1. Confirmed repository findings

### 1.1 Repository and scope

- Working directory/repository: `/Users/peterdomokos/projects/switchplay-app`.
- Current worktree branch: `feat/info-cards`; 1C start HEAD `a4c2e2a`, with a clean worktree and committed 1A corrections. The original planning inspection was at `5bf8992`.
- At the original inspection, design/engineering documents were untracked; they are now committed. Existing design and 1A evidence remain preserved.
- A separate `feat/step-visuals` worktree exists. Its work is not assumed to be available in this branch. In particular, future interactive activities must not be claimed as already integrated here.
- The present task implements Phase 2 against completed Phases 1A–1C. It preserves the functional specification and prototype. Index setup is explicit; no live database migration or provider configuration changes have been made.

### 1.2 Architecture evidence

All source paths in this document are relative to the repository root.

| Area | Confirmed implementation and relevant sources | Consequence |
| --- | --- | --- |
| First-class templates | [model.ts](../../../../src/lib/cards/model.ts) defines card/deck roots, draft content, authoring `revision`, `latestVersion`, and immutable publication records. A card has an Intro and three embedded steps; [domain.ts](../../../../src/lib/cards/domain.ts) strictly validates content keys and structure. | An info card is not a main card with empty steps. Add an independent domain. Attachment fields need explicit validation and round-trip support. |
| Personal data | `model.ts` separates `cardsData` adoption/progress/media from `decksData` membership and adopted deck version. [resolvers.ts](../../../../src/lib/cards/resolvers.ts) resolves working cards against adopted versions; canonical previews resolve published content. | Do not put info-card content or consultation order into personal progress/adoption records. |
| Publication and visibility | [repository.ts](../../../../src/lib/cards/repository.ts), notably `publishCard`, creates immutable versions and clears drafts. Public visibility is permanent. [versionAccess.ts](../../../../src/lib/cards/versionAccess.ts) checks historical version visibility as well as root visibility. | Reuse these rules, not the complete adoption workflow. Making a root public must not expose private-era media or content. |
| Concurrency | `repository.ts` has transactions, expected-revision checks, `recordReferenceChanges` and `guardCardRoots`. `referenceRevision` is explicitly separate from authoring revisions. | There is an existing, concrete pattern for preventing attach/delete races without inventing a reference-counting service. |
| Private sharing | Shared-deck routes are disabled; parked sharing metadata does not confer an active private collaboration permission. | Do not invent private-info sharing grants. Private info remains owner-only, including during server reads. |
| Creator entry and editing | [CreatorDragLab.tsx](../../../../src/components/creator/CreatorDragLab.tsx) contains the Create New Deck header, draft switching and local `CreatorEditModal`, including its card-title variant. Overview's Create control enters `/creator/new`. | Add the Deck/Info Card switch here; put the attachment picker in the existing main-card title modal. |
| Creator persistence | [creatorPersistenceCoordinator.ts](../../../../src/components/creator/creatorPersistenceCoordinator.ts) exports generic `EntityLane`, queues saves and handles conflicts/recovery. Its board coordinator is deck/card specific. Navigation already awaits persistence preparation. | Reuse the single-entity save mechanism where economical, not an artificial deck around each info card. |
| My Drafts gap | [creatorDrafts.ts](../../../../src/lib/cards/creatorDrafts.ts) starts with owned decks, obtains their effective compositions, then finds drafts of referenced owned main cards. `detachCard` in the persistence coordinator removes a board reference; it does not erase the independent main-card draft. | A detached main draft can persist without a My Drafts entry. Info-card drafts must use an independent owner query from the outset. |
| Library | [library/page.tsx](../../../../src/app/library/page.tsx) authenticates and loads the deck collection. [LibraryShell.tsx](../../../../src/components/library/LibraryShell.tsx) mixes page chrome with animated deck navigation, previews, Add/Restore and adoption-related status. [libraryReadModels.ts](../../../../src/lib/cards/libraryReadModels.ts) deliberately returns public decks without an owner-private bypass. | Add a separate info collection/panel. Do not alter Decks visibility or turn info cards into deck previews. |
| Library navigation | [useLibraryNavigation.ts](../../../../src/components/library/useLibraryNavigation.ts) recognises `/library/:deckId`, maintains deck detail caches, refreshes manifests and controls preview state. [libraryHttp.ts](../../../../src/lib/cards/libraryHttp.ts) supplies authentication/session checks and private/no-store responses. | Reuse transport/security patterns; leave the deck navigation hook deck-specific. |
| Step View | [StepView.tsx](../../../../src/components/decks/StepView.tsx) renders Intro or a step and its footer. [FocusedCardView.tsx](../../../../src/components/decks/FocusedCardView.tsx) owns the Intro + Steps 1–3 sequence, active step, video host and transition lifecycle. | Host consultation state at the focused-card boundary; place the pouch in the actual Step View footer. |
| Layout/animation | `StepView` and focused-card surfaces use `motion/react`. [globals.css](../../../../src/app/globals.css) currently defines footer columns as `auto 1fr auto`; that does not guarantee equal button widths. Focused cards use scaled layout geometry, and the hosted video has a distinct stacking layer. [useDeckGestures.ts](../../../../src/components/decks/gestures/useDeckGestures.ts) contains the existing swipe grammar. | Use scoped component styles and measured rendered coordinates. Copying the footer unchanged or adding a high z-index inside the wrong stacking context will not meet the design. |
| Playback | [CloudflareHlsVideoPlayer.tsx](../../../../src/components/media/CloudflareHlsVideoPlayer.tsx) exposes `pausePlayback` and `pauseAndReset`. `FocusedCardView` resets playback for existing step-close/navigation actions. | Pouch opening must use a pause-only path, not those existing close/reset handlers. Test pending load/play cancellation as well as already-playing video. |
| Media | [mediaUploadClient.ts](../../../../src/lib/mediaUploadClient.ts), upload API routes and provider helpers support R2 images and Cloudflare Stream video. Existing target contracts are deck/main-card/personal-card oriented. [protectedMedia.ts](../../../../src/lib/cards/protectedMedia.ts) authorises stored references; instructional playback also has exact card/version checks. | Extend ownership and target validation for independent info cards. There is no generic reusable asset library to plug into without additional work. |
| Media viewer | [CardMediaViewer.tsx](../../../../src/components/media/CardMediaViewer.tsx), `CardMediaViewerImage.tsx`, `CardMediaViewerVideo.tsx` and [LibraryDialog.tsx](../../../../src/components/library/LibraryDialog.tsx) provide viewer/rendering/focus patterns. The personal-card viewer has personal-data assumptions. | Reuse rendering and modal primitives, with a small info-specific wrapper and top-right close. Do not fake a personal media record. |

### 1.3 Requirement support assessment

| Requirement | Existing support | Necessary change / difficulty |
| --- | --- | --- |
| Separate reusable info content | No current info domain | New roots/publications/series and owner APIs; no progress records. |
| Latest info, adopted main attachments | Main immutable versions and adoption exist | Keep ordered IDs in main versions; separately resolve latest info publications on each opening. |
| All info drafts in My Drafts | Existing list is deck-led | Add owner-led info query and typed entries; never join through attachments. |
| Shared series | No applicable shared-series domain | Stable ID with original creator; unique name per creator; derived discovery and independent card ownership. |
| Library and owner edit | Auth, shell patterns, dialogs exist | Static info grid and separate query; deck shell/navigation are not generic collection components. |
| Header attachment picker | Existing title modal | Published-only search, title/series/username, remove/reorder and full persistence audit. |
| Historical deletion restrictions | Transaction/reference-lock patterns exist | Indexed canonical reference checks plus guards on every attachment-producing path. |
| Physical pouch and circular stack | Motion and card gesture grammar exist | New local stack controller/animation; no suitable existing info-stack component. |
| Preserve video/activity state | Stable Step View/player lifecycle is possible | Do not remount or reset on consultation; explicitly isolate hosted video and all underlying controls. |
| Minimal fixed-size text layout | Existing card styling is a starting point only | Prototype actual capacity, including single-line header, before agreeing publication limits. |
| Phone validation | Chromium fixtures/configs exist | Opt-in local-network fixture access and real Safari checks; WebKit launch success is not device validation. |

### 1.4 Responsive sizing and accessibility inspection

**Facts:** `getFocusedCardScale` in `FocusedCardView.tsx` fits a baseline card to available width **and height**, using `visualViewport` where available. It listens to window and visual-viewport resize events and applies a whole-card transform. Reuse that geometry when measuring a footer; CSS dimensions before transform do not establish rendered text size or touch-target size. Zoom can reduce the visual viewport and trigger further fit-scaling, so this is not evidence of accessible text reflow.

`globals.css` gives Step View an absolute, fixed outer surface with `overflow: hidden`; `.step-view-title` is line-clamped to two lines with an 11.9px baseline font, and other main-card content also uses clamps. These are existing limitations, not suitable patterns for info-card content, which must remain complete. The inspected root layout/app sources contain no custom maximum-scale/user-scalable restriction; the prototype must preserve browser zoom.

**Reusable accessibility patterns:** actual buttons and visible focus outlines in Step View; `aria-hidden`/`inert` for inactive main-card faces; native dialog, background inertness and focus restoration in `CardMediaViewer`; reduced-motion handling in that viewer. The inspected focused-card and Step View transitions have no equivalent explicit reduced-motion branch. The hosted-video layer is marked `aria-hidden="true"` despite containing player controls, warranting a focused accessibility audit rather than a claim that those controls are already correctly exposed to assistive technology.

**Decision:** Phase 1 prioritises standard text and normal supported mobile viewports, records enlarged-text/short-screen observations, and retains keyboard labels, focus, zoom and reduced-motion support for the new interface. It does not build an exceptional-size reading mode or refactor main-card reflow. Existing clamps are not copied into `InfoCardFace`. Broader fit-scaling/reflow and existing video/motion accessibility issues are backlog items A11Y-1/A11Y-2 in section 13. An ordinary supported-viewport failure remains a prototype defect, not a backlog exemption.

## 2. Updated architecture recommendation

### 2.1 Separate domain, small familiar persistence model

**Recommendation:** place the domain under proposed `src/lib/infoCards/` with narrowly scoped model, validation, repository and read-model modules. Reuse database/auth/provider facilities; do not generalise the whole card repository into a new framework.

| Proposed record | Responsibilities |
| --- | --- |
| `infoCards` root | Stable `infoCardId`, immutable owner, published visibility, draft visibility intent, `draft`, authoring `revision`, `latestVersion`, timestamps, separate reference guard counter. No step IDs, progress, deck membership or adoption fields. |
| `infoCardVersions` | Immutable `{infoCardId, version, content, visibility, publishedAt, publishedByUserId}`. Content contains title, series ID, plain text and zero/one validated media item. Unique `(infoCardId, version)`. |
| `infoCardSeries` | Stable `seriesId`, display title, normalised name/search key, `createdByUserId`, timestamp. Unique `(createdByUserId, normalisedTitle)`; no manually managed visibility or member-edit ACL. Different creators can have identical titles. |
| `infoCardMediaAssets` | Server-issued upload provenance, unique provider/asset identity and owner/info target. Retained after deletion to prevent private info assets being served through forged references in older main/personal media APIs; no asset browser or management UI. |
| Existing main `CardContent` | Optional ordered `infoCardIds: string[]`; absence means empty for old content. Persist in normal draft and immutable main-card publications. No info publication numbers in this array. |

Retaining immutable backend info publications is **approved**. It lets existing save/recovery mechanics verify a publication after a lost response, and keeps a consultation's media authorisable after a newer publication. Private-era versions remain owner-only. There is no history selector, old-version browsing UI, follower migration or per-deck pinning.

**Simpler alternative:** store just draft and latest published content on one document. That is sufficient for text-only latest reads and atomic publishing. But stable nested-media access then needs retained snapshot grants/assets or a second historical media mechanism. Recommend familiar immutable publications instead of inventing that mechanism. Do not duplicate a latest content blob and version content unnecessarily; the root pointer plus publication lookup is sufficient at this scale.

Info-card records remain owner-authored even in collaborative series. Another creator may attach a public info card, never edit it. Reuse does not transfer ownership. No info-card fork feature is required in v1.

### 2.2 Main version versus info publication

The two timelines must remain independent:

| Event | Main-card version/adoption | Info content seen |
| --- | --- | --- |
| Author edits an info draft | Unchanged | Existing publication only. |
| Author publishes new info content | Unchanged; no fan-out writes | Next pouch opening reads the new publication. Current consultation retains its snapshot. |
| Author adds/removes/reorders an attachment | Main draft changes; normal publication and adoption apply | Working viewers retain their adopted main attachment list until adoption. |
| Viewer opens an old adopted main version | Its ordered IDs remain authoritative | Each of those IDs still resolves to its latest permitted publication. |

At pouch opening, the server validates the actual main-card context/version, reads its ordered references, and resolves the permitted latest info publications in one read-only snapshot. Return an immutable consultation DTO, including publication identities for media authorisation. Preserve that DTO until close, including while nested media is open. Do not poll or merge newer info content into an open consultation. The next opening makes a fresh no-store request.

Working context must verify the actor's adopted main version; canonical/public preview context must verify its published access. An arbitrary client-supplied list of IDs is not proof of a main attachment. Creator preview may use an owner-authorised draft context separately. Guard against late responses after close, navigation, account changes or a second opening.

No eager fetch of every media asset, persistent content cache or real-time subscription is needed. An opening failure shows a bounded retry/error state and leaves the underlying step paused and mounted; it must not silently omit unavailable attachments or show stale content as if refreshed.

## 3. Library architecture and implementation cost

**Decision: implement the actual Decks/Info Cards Library in v1.** The earlier cost comparison found its incremental cost reasonable: published search, visibility filtering, owner editor routes and attribution are already required for Creator and the attachment picker. Additional work is the tab wrapper, static grouped grid, pagination and navigation/accessibility states. There is no temporary published-item selector phase.

Most complexity is in permissions, editor persistence and derived series discovery. A static grid does not need the existing animated deck-detail state machine, adoption manifests or membership actions. This is a source-based relative estimate, not a time quote.

**Reuse:** existing authenticated Library entry, Overview menu/header conventions, session-bound fetch pattern, errors/loading patterns, `LibraryDialog` and creator attribution lookup. `libraryClient.ts` can share transport if deck-specific error wording is not imposed on info cards. Keep new styles local.

**Do not reuse wholesale:** `LibraryShell` deck-detail state, `useLibraryNavigation`, deck collection cursors/projections, animated `DeckGrid`/`DeckScene`, adoption manifests and Add/Restore controls. The Decks query must remain public-only exactly as now; own-private inclusion applies only to the new info panel.

**Proposed routes:**

| Route | Contract |
| --- | --- |
| `/library` / `/library?tab=decks` | Existing Decks behaviour. |
| `/library?tab=info-cards` | Authenticated static grid of all published public info cards plus the actor's published private cards, progressively paginated. No drafts. |
| Existing `/library/[deckTemplateId]` | Unchanged deck detail links. Do not accidentally treat `info-cards` as a deck ID. |
| `/creator/info-cards/new`, `/creator/info-cards/[infoCardId]` | Creator mode entry/editor; existing record route is owner-only. |
| `GET /api/library/info-cards` | Published catalogue, bounded search/filter/cursor, server visibility filtering. Reusable query core for attachment results. |
| `/api/info-cards`, `/api/info-cards/[id]` and publish action | Owner create/read-draft/save/publish/delete; explicit revision preconditions. Public catalogue reads never return draft fields. |
| `/api/info-card-series` | Authenticated eligible-series search and creator-scoped get-or-create; policy in section 4. |
| Main-card consultation endpoint | Proposed `GET /api/card-templates/[id]/info-cards` with validated context/version; snapshot response, not a client-authorised ID batch. |
| Info media endpoint | Proposed `/api/media/info-cards/[id]`; publication/owner-draft context, exact stored asset match, authenticated delivery. |

Choose one thin tab wrapper at the Library collection level. Do not mount the deck navigation controller while the info panel is active. Retain existing deck deep links and refresh behaviour. Account switching clears private lists, searches and previews; session-aware no-store responses prevent cross-viewer cache reuse.

Group cards by series **ID**, ordered alphabetically by series title with creator ID/series ID tie-breakers, and within series by title then info ID. Headings display `Series title (username)` with secondary username styling; identical titles from different creators never collapse into one group. Apply card permissions **before** grouping, counts and pagination. Pagination may continue a large series on the next page with a repeated heading; it must eventually expose every accessible published card. Use a simple InfoCardFace presentation without stack motion; info-owner attribution and owner Edit actions can sit outside the constrained face. The face itself retains only series/title text and a series attribution tooltip. No independent animated series packs, membership or adoption controls.

## 4. Shared collaborative series

### 4.1 Identity, names and attribution

**Decision:** stable server-generated UUID; immutable original `createdByUserId`; display title plus `normalisedTitle`. Enforce a unique compound index on `(createdByUserId, normalisedTitle)`, never on title alone. Normalise consistently using Unicode NFKC, trim/collapse whitespace and locale-independent lowercase. Preserve the confirmed display title; do not strip punctuation/diacritics or fuzzy-merge titles. This is a documented technical normalisation policy, not a series rename feature.

Creation is explicit, not a request on each keystroke. The actor supplies a title, never an arbitrary series creator ID. If that actor already has the normalised title, return their existing ID. Concurrent creations by the same actor use the unique-index duplicate-key/re-read pattern; creations by different actors produce distinct IDs. A match belonging to another creator is selectable only through eligible search results and is never substituted automatically for Create.

Display `Series title (username)` in Library headings, Creator fields, dropdown results and attachment metadata, with secondary username styling and no “Created by” label. Resolve creator usernames through existing attribution helpers, with the established unavailable-user fallback; a changed/deleted username does not change series identity. On the actual face, omit the username from the single-line header and reveal it on series-title tap, hover or keyboard focus/activation. `CardCreatorAttribution.tsx` is an existing small popover/event-isolation pattern, but its main-card placement/source labels are not reusable face markup.

### 4.2 Derived discovery and retained selections

General series-search/direct-discovery eligibility is precisely:

`series.createdByUserId === actor OR exists a current published public info card whose latest published content has this seriesId`.

Use the **latest published** series membership and effective published visibility, not drafts or every retained info publication. A draft move does not reveal/hide a group; publishing a move or deleting the last unreferenced public member can. Historical publications do not keep an otherwise hidden series searchable. No stored manual visibility flag or public-member count is needed. At this scale, use an indexed existence/aggregation query over roots and their current publication records in a consistent read snapshot. Add denormalised membership/counts only if measured query cost later justifies them.

Search filters eligible series before returning names, attribution, suggestions, pagination or any metadata. A hidden foreign series must produce the same unavailable result as an unknown ID. Bound and escape search input. Sort matching own-created series alphabetically first, then eligible other-created series alphabetically, with stable ID tie-breakers **before pagination**. Empty/private-only/unpublished-only own series are included for the creator; those of others are excluded. No private member counts are exposed.

Library grouping starts from **authorised current published info cards**, then projects their series labels/attribution. It never enumerates all series as empty headings. This lets an owner see their own private member in a formerly discoverable series without showing that private group to anyone else.

If a contributor already owns a card referencing a series which later becomes undiscoverable, permit its existing selected label in that card's authorised draft/published editor/preview and permit retaining that ID on save/publish. This limited context is necessary to keep their own content editable; it is not general search eligibility. New assignments to a foreign series must be discoverable when validated in the save snapshot. Revalidate after selection; if eligibility has disappeared before save, preserve entered content and ask the creator to choose an eligible series. Do not erase an existing valid selection merely because discovery changed. No new cross-document series locks or permanent contributor ACL are justified.

### 4.3 Ownership and scope

Any eligible creator can contribute independently owned info cards; the series creator cannot edit those contributions. Every save/publish/delete verifies the info-card owner separately. Series existence is validated, but series creation ownership is not required for an eligible contribution.

Keep unused series metadata: the creator can still find it and drafts may refer to it. No series rename/delete/admin/merge/moderation screens, automatic cleanup jobs or public standalone series directory are required. Tests must cover the last-public-member transition, identical titles across creators, same-creator concurrent creation, unpublished public intent, historical membership, direct-ID probing and existing private contributors' retained selections.

## 5. Revised creator workflows

### 5.1 Mode switching and editing

Keep Create as the existing entry. Add Deck/Info Card to the top-left control without redesigning the header. Switching modes, drafts or Library destinations waits for in-flight saves using the existing navigation preparation pattern; failure keeps the editor visible with retry/recovery feedback.

The info editor has series search/create, title, plain text, one media item, visibility, draft status, preview and Publish. Public publication has the existing style of permanent-public confirmation. Persist an info draft identity before requesting upload credentials. Reopening a clean published card does not itself manufacture an outstanding draft; the first actual content/visibility edit does. If saved content and intent return to the published baseline, clear the outstanding draft rather than leave a false My Drafts entry. Invalid/over-capacity content may remain a recoverable draft but cannot publish.

Reuse `EntityLane`'s save/revision/recovery mechanics if its small generic contract fits. Do not instantiate the deck coordinator or broaden its board, fork and publication-review machinery for info cards. Any extraction should be limited to genuinely shared persistence code and covered by its existing tests.

### 5.2 My Drafts — mandatory independent discovery

Add typed entries such as `kind: "deck" | "infoCard"` to the draft response and `CreatorDraftsModal`. For info cards, query roots directly by authenticated owner and outstanding draft state, independent of decks, series ownership, attachment count, adoption and archived deck state.

Required outcomes:

- Unpublished info cards appear, even if never attached anywhere.
- Published info cards with outstanding content or visibility changes appear, even if detached everywhere.
- A dirty published info card also remains in the Library as its **published** snapshot; Edit opens the existing draft.
- Clean published info cards appear in the Library, not My Drafts.
- Publish clears the draft entry; reload and another browser tab reproduce the same result.
- Failed publication, pending uploads, transient save failures and title/series changes do not orphan the saved draft.

This is not a second deck-derived traversal. A fresh query and direct owner editor route are acceptance requirements, not a later recovery enhancement.

### 5.3 Main-card header attachments

Extend the existing card-title modal with a searchable published-info dropdown showing **info title, series and info-card creator username**. Show series as `Series title (series-creator username)` in secondary metadata; series creator and card owner can differ. Eligible results are public published info cards plus the actor's own private published info cards. No inline info creation and no draft attachment option.

Selected IDs are ordered. Provide explicit Remove attachment and Move up/down controls, with optional drag reordering only if it adds little complexity. Prevent duplicate IDs on the same main card; reuse across different main cards remains allowed. Save title and attachment edits as one normal main-card draft update; cancel discards modal-local edits. Public-main publication, not merely picker UI, enforces the private-attachment restriction. A draft may hold an own-private attachment while the creator resolves that restriction.

Audit `creatorBoardState.ts`, `cardArchitectureAdapter.ts`, `privateGraph`, presentation/read DTOs, strict content validators, fork/copy construction and main publication hashing. Every normalise/copy/edit path must preserve the optional field. Old content defaults to an empty list without rewriting immutable history. Existing main-card fork ownership rules remain unchanged; do not bypass them because only attachments changed.

“Remove attachment” never invokes info-card deletion. Reusable deletion is a separate owner action with reference feedback and confirmation, subject to section 7.

## 6. UX and interaction implementation

### 6.1 Footer geometry and minimal content

Use a small proposed `InfoCardPouch` inside `StepView`'s **existing footer row**. Use locally scoped CSS/module classes: symmetric outer gutters (left contains pouch, right balances it), equal-width Previous/Next tracks, and a centred step-index track. Keep equal heights/styles and preserve video/body height. Measure actual rendered bounding boxes; logical widths inside the focused card's scaled coordinate system are not sufficient evidence. Whole visible pouch is a button, with a comfortably tappable target, no overlap with Previous, and no word “Info” or added arrow.

Prototype normal supported mobile widths first, including the existing 390×844 test viewport and representative 360×780 and 430×932 portrait viewports. Sample a short landscape viewport to record limitations without building a separate reading mode. These are test samples, not newly imposed minimum-device requirements. The pouch's lower contrast and approximate 20–25% reduction are visual targets, not permission to shrink the hit target. Aim for at least 44 CSS-pixel rendered touch targets where practical. No new global CSS overrides or main-card typography redesign.

`InfoCardFace` retains the corrected 1A layout: one top-left, approximately body-sized line with **secondary series label · primary card title**. Restored padding and paragraph spacing use the taller card approved in the final visual correction. No separate INFO label, stack index, dots, thumbnail, large label bar or ornamental title area. The closed pouch count and underlying step index remain. Series attribution appears only in a small tooltip/popover from the series-title trigger; support tap, desktop hover and keyboard interaction. Isolate its events from browse/close gestures. Escape/outside activation dismisses the tooltip before affecting the stack; opening media or changing the top card dismisses it. Do not append the username to the face header or fetch forbidden series metadata just because a title is tapped. Phase 1C does not redesign these styles.

Target roughly five ordinary text lines across two paragraphs, reserving a compact bottom control only when media exists. Test representative three-taller-maths-line placeholders to avoid painting a future design into a corner; do not implement equation rendering. Validate long series/title combinations, wide glyphs, punctuation, explicit newlines, Unicode, and media/no-media cases. No silent ellipsis, line clamp, text shrinking-to-fit or internal scroll.

**Capacity gate:** Phase 1 must record real usable dimensions and representative passing/failing content before proposing limits. Afterwards, choose conservative shared server-enforced budgets for combined header, body, paragraph breaks and media reservation, backed by browser measurements. Character count alone is not a reliable layout guarantee. If empirical budgets cannot safely cover the supported text/font envelope, use a deterministic font-metric validator, not a new headless-browser service on every publication. This choice remains gated on prototype evidence. Creator preview must use the same face/layout and explain which content exceeds capacity; reject publication, preserve the draft.

Phase 1 focuses on ordinary supported mobile layouts, standard text and realistic content. Observe zoom/enlargement and unusually small/short screens without building an elaborate fallback or delaying the prototype. Preserve browser zoom, readable complete content in the normal envelope, keyboard/focus access and new-interface reduced motion; do not copy existing line-clamp behaviour or introduce avoidable regressions. Broader reflow/fallback work is explicitly deferred to A11Y-1 (section 13); capacity measurements and any serious observed failure are recorded rather than presented as a pass.

### 6.2 Stack mechanics and placement

Use a small consultation owner for the immutable open snapshot, playback suspension, interaction isolation and nested media. Phase 1C uses immediate static open/closed states and the first fixture card. Phase 1B subsequently adds a local `motion/react` presentation controller for opening/browsing/closing, with no ownership of underlying playback or activity lifecycle. Avoid a global overlay framework.

**1B implementation:** `InfoCardPhysicalStack` supplies measured, clipped translation/rotation and keyed current/adjacent card layers. It reuses the corrected 1A CSS, keeps at most two backing edges, and uses a local pointer session with the existing dead-zone/axis-lock conventions and a smaller card-relative commitment threshold. Committed turns are serial: inputs during motion are ignored, not queued. Cancelled drags restore the same card. The pouch can reverse an unfinished return within the still-open session; a fully closed/new consultation always starts at the first attachment. Reduced motion uses a short pack fade and small physical card movement. Freeze the pack's portal geometry during each movement and apply viewport changes after settling, preserving card dimensions in flight. The pouch independently follows the live Step View corner; if resizing moves it during closing, retarget the return without resizing the pack.

- Set a landscape card size from the current viewport/layout before opening. Translation and subtle rotation move the **whole fixed-size bundle** diagonally up/right out of the actual pouch; neither scale nor dimensions change through the transition. Clip/mask the emergence if necessary rather than shrink cards into the pouch.
- Settle over the lower navigation region, allowing the lower video/activity to be covered while its upper context remains visible. Keep the pouch separately reachable above the stack hit-blocking layer.
- Use the top card and two or three subtle backing layers, not every hidden card. Down sends top to bottom; up brings bottom to top; wrap modulo attachment count. With one card, consume swipes without artificial movement to a duplicate card.
- Reset to creator order on every new opening. Media close preserves the current top card. Cancelled drags settle back; rapid/reversing swipes must not duplicate or lose cards. Lock or coalesce transitions explicitly.
- No stack-position indicator, including an automatically injected carousel counter. Provide keyboard Up/Down and assistive labels without a visible progress UI; announce the active title, not an invented index.
- Respect reduced-motion preferences with minimal displacement while preserving ordering and clear open/close state. On viewport/orientation changes, recalculate settled geometry without treating the new size as an opening morph or resetting active content.

### 6.3 Real Step View integration and isolation

`FocusedCardView` owns the stable consultation state and pause callback. Keep Step View's component identity/key and underlying activity subtree unchanged when opening/closing info. Do not use its normal close, item navigation or personal-media-open handlers, which can reset playback.

The hosted video sits outside parts of the transformed card stage. **1C choice:** a transparent native modal dialog, portalled to the document body and aligned to measured Step View bounds, above both the stage and hosted video. Reuse existing native-dialog patterns rather than an arbitrary z-index ladder. A second native dialog contains info media. This gives `step → info stack → info media` with background inertness, local focus containment and no dark consultation backdrop. The real Step View/footer/player stay mounted; the unchanged 1A pack and open pouch are presented in the aligned top layer.

Isolation needs both layers of defence:

1. A **transparent** input surface and focus scope cover the underlying video/activity/footer, with inert or equivalent keyboard exclusion for those siblings; pouch remains active. Parent deck/flip/step gesture handlers receive an explicit disabled signal while consultation or its exit animation is active.
2. Phase 1C consumes pointer/click/wheel/keyboard events and contains focus; Phase 1B adds pointer capture and the local vertical browsing threshold. `stopPropagation` on pointer-down alone is insufficient for document handlers, keyboard events or native video controls. Do not globally disable touch behaviour outside this surface.

Reuse the existing swipe direction/physical grammar in 1B, not necessarily the main deck's larger distance threshold. Close via pouch, exposed upper background or the approved dedicated consultation X; tapping text does not close. Static 1C closes on the completed click; 1B must retain isolation until its exit also finishes, avoiding click-through. Escape dismisses a visible series tooltip, otherwise closes the topmost media viewer or pouch; restore focus to its trigger accordingly. Navigation/unmount/account change cancels pending requests and tears down the overlay safely.

### 6.4 Playback, state and nested media

Call pause-only playback when consultation begins and keep time/source/player mounted. `pausePlayback` currently aborts pending loading and pauses a playing element; it is not evidence that all delayed play promises/preparation paths are cancelled. Test opening before readiness and during a pending play request. Add a narrow suspension/cancellation guard if necessary so no delayed autoplay starts behind the stack; closing never resumes automatically. Manual play must still work afterward without resetting position.

**1C choice:** add `setPlaybackSuspended` plus a prop guard for late player mounting. Suspend immediately at pouch activation, invalidate earlier play intent with a local generation counter and suppress late load/play results, including after close. Do not abort readiness/source preparation or call `pauseAndReset`. Unsuspending is never a play request. This narrow player mechanism is necessary because a lone `video.pause()` cannot invalidate delayed application-level playback work; existing non-info playback paths retain their behaviour.

The prototype should mount a stateful mock activity inside the real Step View host and assert preserved input, scroll position and mount count. This proves the hosting contract without pretending the separate step-visuals branch is already integrated.

Use image zoom/rendering and HLS player primitives in an info-media wrapper; do not import the personal media queue/download contract. Dedicated compact media button only; explicit top-right close. Freeze the stack underneath, pause/dispose only the nested video on viewer close, and return to the same info card. Native dialog/top-layer behaviour is useful, but must be tested with the existing Library/Creator dialogs to avoid competing focus traps. Nested media gesture handling must not cycle cards behind it.

## 7. Publishing, permissions and deletion safeguards

### 7.1 Access and publication rules

**Decisions enforced server-side:**

- Draft read/write/publish/delete: owner only, regardless of series creator.
- Published search/read: public or owner-private; no foreign private records in lists, direct-ID responses, counts or media delivery.
- Attach: published only; validate every ID, including API submissions bypassing the picker.
- Public main-card publish: every referenced info card must already be published public. Private main cards may use public info or their owner's own private info; series participation grants no exception.
- Once an info card has been published public, a later draft cannot make it private. Publication intent stays distinct from current effective access.
- Content updates affect only the info publication/root, never main versions, followers' data or adoption notifications.
- Main attachment updates follow existing main draft/publication/adoption rules. Deck publication pins existing published main versions; Creator publishes owned main drafts separately before publishing the deck.

Use a unique root ID and `(infoCardId, version)` index, plus owner/draft listing and published visibility/series indexes. Publish the immutable record and root pointer/draft clear atomically. Reuse expected revisions and bounded ambiguous-response recovery; a retry must not create an extra publication or overwrite later edits. Unchanged clean content need not create a publication.

### 7.2 Mechanisms: why they are worth their cost

| Mechanism | Why needed / existing reuse | Simpler alternative and its risk |
| --- | --- | --- |
| Authoring `revision` | Existing compare-and-set/`EntityLane` pattern prevents two tabs overwriting changes; useful for save/publish/delete preconditions. | Last-write-wins silently loses drafts. Not acceptable. |
| Internal publication number | Stable publication/media identity and recovery. Existing immutable-version pattern fits, without adoption. | Single latest blob is smaller but needs a separate way to authorise media for an older open consultation. |
| Separate reference guard counter | Existing `referenceRevision` pattern serialises a new reference against deletion without causing irrelevant creator autosave conflicts. | Read-then-delete can race. Using authoring revision for attachments makes another creator's reuse spuriously conflict with editing. |
| Mongo transactions | Needed for root/publication atomicity and cross-document reference/delete invariants. Existing repository transaction helper and disposable replica-set test infrastructure can be reused. | Single-document CAS remains sufficient for ordinary info draft saves. Transactions everywhere add cost; transactions with only reads of the referenced root still permit write skew. |
| Exact media-context authorisation | Extend existing card/version playback and stored-reference checks; bind requests to an info publication or owner draft and actor. | Trusting an asset ID, series ID or public-looking provider URL leaks private/unpublished media. |
| Local layer coordination | Hosted video, transformed stage and nested viewer have separate lifecycle/stacking concerns. Reuse current focused-card ownership and modal primitives. | More arbitrary z-index values/independent booleans create click-through and inconsistent focus. No global overlay service is justified. |
| Gesture disable + event interception | Existing parent gestures and native controls can operate outside a child event handler. | Backdrop-only or pointer-down propagation-only solutions miss keyboard, capture-phase and release events. |

### 7.3 Canonical reference checks and races

Deletion checks must inspect **all main-card drafts and all retained immutable main-card versions**, not just latest published versions, visible decks, active memberships or a creator's current board. Add multikey indexes for `draft.infoCardIds` on roots and `content.infoCardIds` on main versions. A historical reference permanently blocks deletion while that history is retained. Removing the latest attachment does not remove history and must not be described as sufficient to unlock deletion.

Recommend indexed existence checks over these canonical stores, not a reverse-reference collection or denormalised reference count requiring repair. All main attachment-writing paths—including create, save, fork/copy and publication—must participate in the guard protocol. Optional field absence means no refs; attachment-bearing paths cannot skip validation just because they copy trusted main content.

Within the transaction, both a reference-creating operation and deletion write the relevant info root's guard. Deletion scans references and removes content/publications in that same transaction; it retains a content-free root reservation (`deletedAt`, draft null, latestVersion zero) so the stable ID cannot be recreated and confuse delayed publication/media requests. The exact owner/revision deletion retry succeeds safely. Reference creation revalidates existence/publication/access. Concurrent operations then conflict/retry instead of leaving a dangling reference. Test both race orders. Document a consistent lock order extending the existing card/deck guard order (info IDs sorted, then affected main cards, then decks) and audit existing composite write paths rather than assuming the new order is already true everywhere. No provider deletion/network side effects inside retriable transaction callbacks.

**Confirmed:** an owner may delete an unreferenced public or private info card. Public visibility is permanent while the record exists. Retained main drafts and every historical main reference block deletion. Provider asset garbage collection is separate and conservative: never delete a historical/shared asset as part of removing a current media field. No new media cleanup framework is required for v1.

### 7.4 Detached-main-draft recovery

Concrete failure sequence: an owned main draft references info X; the creator detaches that main card from its effective deck composition; the draft survives but is no longer found through `creatorDrafts`; deletion of X correctly finds that draft and refuses. Filtering deletion to reachable decks would hide the symptom by breaking reference safety.

**Chosen approach: defer a new detached-main-card recovery interface; retain safe deletion refusal and clear feedback.** Existing `GET/PATCH /api/card-templates/[cardTemplateId]` can read/save an owned main draft directly, but `/creator/edit/[deckTemplateId]` loads a deck-based `creatorSessionDTO`. The current title editor is local to `CreatorDragLab`; there is no existing independent recovery page to link. Building the previously proposed standalone attachment route would add editor extraction, routing, navigation/recovery and permission tests for this rare case. It is not necessary to prove the prototype or maintain data integrity.

Use the deletion response to distinguish draft blockers from historical blockers. Display owned reference titles/IDs where authorised and a clear message that detaching from a deck does not remove all saved references. Do not link to a nonexistent editor or imply the user can currently recover every draft through My Drafts. Other creators' private blockers receive a generic explanation without titles, deck names or private counts. The normal editor can resolve reachable draft-only blockers; historical blockers cannot be removed by editing the current draft.

**Remaining limitation:** some detached draft-only references can make an otherwise unused info card undeletable through the existing UI. Keep the draft/info records intact; never silently detach/discard them or bypass the guard. Direct owner APIs remain available for a future narrow recovery implementation, but manual database editing is not a product workflow. Backlog **DRAFT-1** (section 13) specifies the eventual improvement. This is a deliberate scope decision under the user's discretion, not an outstanding approval request. Independent My Drafts access for **all info-card drafts** remains mandatory in Phase 3.

### 7.5 Media delivery and consultation stability

Extend upload targets with an independent info-card owner scope; validate ownership/existence on the server, namespace R2 keys by info identity/owner, and verify Stream asset provenance/readiness before publication. Reuse provider upload and status code. Do not invent a fake deck ID or accept client-supplied arbitrary media URLs as proof of ownership.

Published media access verifies exact stored media in the requested info publication and its immutable visibility. Owner draft preview verifies the owner and current draft reference. Keep the consulted publication identity while nested media opens, so republishing does not invalidate that consultation's media. Signed Stream URLs can expire; renewal rechecks the same publication and actor rather than switching to latest content. R2 proxy delivery and all listing DTOs remain private/no-store where viewer-specific.

Historical backend records do not imply anonymous private-media URLs are safe. Verify bucket/provider delivery configuration at implementation time: an ACL in an API cannot protect a directly public storage object. Reuse the existing protected delivery pattern and fail closed for unrecognised assets. Tests must include private-era media after public promotion, forged IDs, another creator's draft and expired/session-changed grants.

**Phase 2 implementation:** a signed upload proof binds the owner, stable info ID, creation identity and allocated asset. R2 uploads use signed `If-None-Match: *` to prevent replacing an already-published object. Stream readiness checks require the issuing creator and signed-only playback. A small immutable allocation registry prevents older broad media routes, exact main-card playback and personal downloads/status from accepting an info asset through a forged legacy reference. Registry records survive info deletion; this is provenance protection, not a reverse attachment index. Provider operations remain outside Mongo transaction callbacks. New info upload/publication-with-media/delivery fail closed unless protected delivery and the explicit provider-verification deployment gate are enabled. Real provider configuration remains unverified; automated stubs are not evidence of private-bucket delivery.

## 8. Phased implementation and acceptance checkpoints

The user now authorises **Phase 2 only**, following completion of Phases 1A–1C. Historical prototype checkpoints remain below as evidence. Later phases still require separate authorisation.

### Phase 1A — Footer geometry and content-capacity prototype

- **Objective:** put a real pouch in the actual footer and evaluate readable minimalist card geometry with temporary data.
- **Files:** `StepView.tsx`, a scoped Step View/info-card CSS module (new), `InfoCardPouch`/`InfoCardFace` (new), `tests/browser/fixture.tsx` and fixture server. Read relevant installed Next guides before any application edits.
- **Dependencies:** spec v0.3 and existing viewport conventions; no backend prerequisite. Use a fixture-only entry, temporary attributed series/card data and the actual Step View footer/scaled focused-card geometry. Include a static open-card preview; interactive emergence/browsing belongs to 1B.
- **Validation:** rendered bounds for equal button widths, centred index, disjoint targets and unchanged step body height; snapshots at 360×780, 390×844 and 430×932, with a short-landscape observation; realistic five-line/two-paragraph text, combined header, future tall-line placeholders, optional media, font load and attribution tap/hover/focus. Check basic keyboard/zoom access; record exceptional-size issues without a new fallback. Provide opt-in LAN fixture access and open on a real phone early.
- **Done when:** closed/footer and static-open geometry plus the measured capacity report are reviewable on phone; complete normal content, no scroll/truncation/index, face username hidden until tooltip interaction. Report actual fit/fail samples and observations. Publication limits follow this evidence; a larger validation engine and exceptional-accessibility mode are outside this checkpoint. Section 14 defines the precise first task.

### Phase 1C — Real Step View, playback, media and isolation

- **Objective:** prove the difficult integration before committing to creator infrastructure.
- **Files:** `FocusedCardView.tsx`, `StepView.tsx`, narrowly scoped player integration, proposed info media wrapper using existing image/HLS primitives, real-component fixtures and browser tests.
- **Dependencies:** completed 1A static presentation, deterministic video samples and a stateful test activity inside the real Step View. **No dependency on 1B.** Reuse the corrected face, backing edges, pouch and close control with static opening/closing and the first attached fixture card. Real provider media smoke checks can follow in Phase 3, but actual Safari playback must not be inferred from local transport tests.
- **Validation:** all Intro/Steps 1–3, hosted-video stacking, pending play/load race, pause without time reset/resume, preserved activity mount/input/scroll, pointer/keyboard/capture isolation, nested media return, focus restoration, no click-through, unmount cleanup. Test on actual iPhone Safari.
- **Done when:** user approves phone behaviour and tests demonstrate the stable Step View lifecycle. Record pending manual/provider coverage explicitly. Passing 1C does not accept 1A visuals or 1B motion.

### Phase 1B — Physical bundle and circular browsing

- **Objective:** implement faithful fixed-size emergence, settle/close motion and both directions of circular browsing using temporary ordered cards.
- **Files:** `InfoCardConsultation`/new local stack controller, scoped styles, existing `motion/react` and gesture patterns; focused browser fixture tests.
- **Dependencies:** 1A dimensions and the completed 1C consultation/layer boundary; fixture data only. Add motion and circular order inside that boundary, preserving the integration owner and its pinned snapshot/media state. Hold its suspension and isolation until exit completion; media freezes browsing. Do not replace the real Step View/player with an animation fixture.
- **Validation:** 0/1/2/many cards, wrap order, cancelled/rapid/reverse swipes, fixed dimensions through animation, pouch/upper-background/X closing, face and series-tooltip taps, reset on reopen, reduced motion and orientation changes. Attribution interaction must not trigger browsing or closing.
- **Done when:** both physical directions and close/open feel correct on the phone, count exists only on pouch, stack overlays the footer and retains upper step context.

#### Phase 1C / 1B boundary and final integration gate

`FocusedCardView` owns open/closed consultation identity and an opening-time copy of the temporary ordered data, suspends its mounted player, and guards its navigation/flip callbacks. An info-specific modal above the hosted video supplies transparent input interception and focus containment; the unchanged static face/pack aligns to the actual Step View bounds. Nested media uses a second modal and existing image/HLS rendering primitives, with no personal-media queue/download context. Closing media returns to its originating card/control; closing consultation restores the real pouch and never plays the step.

Phase 1B supplies current-card selection, movement and transition completion within this modal. The integration owner's session stays alive through return/cancel/reversal, selection is frozen while media is open, and closure is notified only after exit completes. A new consultation creates a new snapshot and starts at its first card. No generic overlay/gesture framework is required. See the 1B handoff for combined automated evidence; a fresh physical-interaction phone review is required despite the earlier successful manual 1C review.

**Verify now:** real Intro/Steps 1–3 composition; pause without reset/resume; pending authorization/load/play races; stable player/activity identity, inputs and scroll; static hit testing above hosted video; close click-through prevention; pointer/keyboard/focus isolation and restoration; nested image/video return and disposal; navigation/account/unmount cleanup. The first card is the temporary static selection, not a circular browsing implementation.

**Verify after 1B:** circular/wrap/reverse swipes, physical emergence/return at constant dimensions, reduced-motion transitions, drag cancellation and interrupted/reversed opening/closing, media return after choosing a non-first card, gesture handoff and the entire exit input sequence. Repeat 1C's playback/state/focus tests while motion is in flight, including viewport changes and delayed playback. Final integration requires combined Chromium regressions and actual-phone Safari review. **Gate:** approve layout/capacity and combined 1B/1C findings before Phase 2; unavailable WebKit coverage never becomes an implicit pass.

### Phase 2 — Independent domain, series and security foundations

- **Objective:** roots/publications/series, owner drafts, publish rules, catalogue queries, consultation DTO and reference/media permission contracts.
- **Files:** new `src/lib/infoCards/*`, new API routes, existing database/index setup, auth/transaction/media permission helpers, `creatorDrafts.ts` typed query. Plan indexes here; do not run migrations until implementation is authorised.
- **Dependencies:** accepted final 1A → 1C → 1B integration verification and measured publication capacity envelope. Series identity/discovery, public deletion and backend retention are resolved in this plan. No main attachment UI yet.
- **Validation:** repository/API tests against existing disposable replica-set harness; same-creator compound uniqueness under concurrent creation, different-creator identical titles, eligible search/direct-ID access, last-public-member disappearance, draft/historical membership exclusion, existing contributor retention, no hidden names/counts, direct owner draft query with no decks, draft/public isolation, CAS conflicts, publish retries, permanent public visibility, internal historical visibility and media checks.
- **Done when:** domain/API invariants pass independently of UI; no application caller can use an unguarded reference write. Review the guard integration design before attachments become available.

Implementation checkpoints: (1) domain/indexes and per-creator series uniqueness; (2) stable incomplete drafts, revisions and recovery; (3) measured capacity and atomic publications; (4) authorised catalogue/series/snapshots; (5) deletion/reference guards and exact media security; (6) replica-set acceptance, failure/race regressions and documented Phase 4 writer requirements. Tests must include deterministic transaction rollback/interleavings as well as concurrent calls. Existing `test:phase2` is an unrelated historical test programme, not this feature's acceptance command.

### Phase 3 — Creator, real Library and info media

- **Objective:** complete create/edit/publish workflows, independent My Drafts, static Library and real single-item media upload/preview.
- **Files:** Creator header and `CreatorDraftsModal.tsx`, new info editor/routes, `LibraryShell.tsx` collection chrome or thin wrapper, `library/page.tsx`, new grid/query UI, upload target validation/routes and info media delivery.
- **Dependencies:** Phase 2 APIs and accepted preview/validation.
- **Validation:** new/unattached draft persists after reload; dirty published item in My Drafts and published snapshot in Library; clean item Library-only; mode switch save failures; owner/foreign editor access; public/own-private list; distinct identically titled attributed groups; hidden/private-only series not discoverable through search/API; authorised own-card label still available after discovery loss; pagination/session change; image/video readiness/replacement; rejected overflow preserves draft.
- **Done when:** two creators can contribute to one series without edit-right leakage; all required drafts are recoverable; Library Decks behaviour is unchanged; real media and understandable publication feedback work.

### Phase 4 — Main attachments, guarded deletion and live consultation

- **Objective:** connect header picker/order, existing main publishing/adoption and the prototype's live snapshot reader. Deliver reference-safe deletion with honest blocker feedback; detached recovery UI is deferred.
- **Files:** main content model/domain, Creator title modal/board adapters, repository create/save/fork/copy/publish paths, main read/presentation DTOs, new reference query/deletion feedback and Step View consultation endpoint/controller.
- **Dependencies:** Phases 2–3; all guard pathways and indexes ready **before enabling attachments**. Do not ship an interim race-prone attachment feature.
- **Validation:** round-trip field preservation; adopted-old-main versus latest-info matrix; public-main/private-info rejection through direct API and composite deck publish; reachable/detached draft and historical references; delete-vs-attach race both orders; stale editor restore; concurrent publication during open consultation including nested old media; next opening refresh; remove attachment does not delete info; unreferenced public deletion succeeds and hidden blockers reveal no private metadata.
- **Done when:** tests prove the two versioning timelines, concurrency invariants and clear deletion feedback, including the documented detached-draft limitation. No historical publication, saved draft or personal progress data is silently discarded or rewritten.

### Phase 5 — Release hardening and acceptance

- **Objective:** regression, accessibility, responsiveness, permissions and actual-device sign-off; remove fixture-only switches from production reachability.
- **Files:** existing Chromium/phase2/media suites, new info tests, device checklist and feature documentation; only narrowly justified implementation fixes.
- **Dependencies:** Phase 4 complete, test accounts/media and actual phone available.
- **Validation:** full relevant existing regressions, keyboard/VoiceOver, reduced motion, touch targets, orientation/browser-chrome resizing, long text, slow/offline requests, expired grants, account switching and provider playback. Run WebKit conditionally as section 9 describes.
- **Done when:** required automated cases pass, manual phone evidence is recorded, unresolved deviations are explicitly accepted, and the user approves release. A skipped or unavailable WebKit run is reported, never called a pass.

## 9. Testing, actual-device access and bounded WebKit investigation

### 9.1 Confirmed configuration and observed result

The investigation was deliberately bounded to configuration/cache inspection and two launch checks, with no repair/install loop. The supplied crash excerpt was considered; it is not a full causal stack trace.

- Environment confirmed: macOS **14.8.7 (23J520)**, native **x86_64**, consistent with the supplied Intel MacBook Pro. Installed Playwright package is **1.58.1**, expecting WebKit **2248** / browser version **26.0**. A separate `webkit_mac14_special-2251` cache exists, but its presence proves neither use nor a fix; it was not substituted.
- The sandboxed WebKit launch aborted before any app test. Its browser PID **66612** matches the supplied report: native Playwright, `EXC_CRASH (SIGABRT)`, signal 6, `abort() called`.
- **One authorised launch check outside the sandbox succeeded for both WebKit and Chromium**, creating a page and reading its title. This establishes that these installed binaries can launch in that context. It does **not** establish that the full WebKit suite, app animations or native HLS work.
- The contrast points to a launch-environment/sandbox interaction, but no specific root cause has been proved. The failure has not been declared generally fixed. No additional diagnostic loop is proposed.
- `playwright.config.ts` uses the normal default Chromium engine; `playwright.phase2.config.ts` targets the phase2 browser suite with Desktop Chrome; `playwright.media-viewer.config.ts` explicitly uses Chromium at 390×844 with the real-component fixture server.
- Important exception: `tests/card-video-preparation.spec.ts` explicitly calls `webkit.launch()` for some cases. A nominally Chromium run can therefore still launch WebKit. A previous `.last-run.json` saying “passed” is not engine-specific evidence.

### 9.2 Practical automation policy

Use existing Chromium suites as the reliable baseline, adding the targeted info tests rather than creating a new device-testing platform. When running an explicitly Chromium-only subset, exclude/tag those explicit WebKit variants transparently; merely selecting a Chromium project is insufficient. Record which cases were excluded. Any future test-tag/config edits are implementation work, not part of this plan update.

For WebKit, a targeted run in the known launch-capable context is optional when the implementation environment supports it. It is not a prototype gate. If it fails, preserve the concise failure and stop: continue Chromium and manual iPhone Safari. No further investigation is part of this document reconciliation. No repeated browser downloads, random cached binary substitutions, OS upgrades or virtual iPhone infrastructure are prerequisites. Playwright WebKit is useful engine coverage, not the installed Safari browser or a physical iPhone; see the [official browser documentation](https://playwright.dev/docs/browsers).

| Can automate effectively | Needs actual-device confirmation |
| --- | --- |
| API ownership, draft/public filters, publication/deletion races and history rules | Safari/native video playback, autoplay/pause behaviour under real user interaction |
| DOM bounds, equal button widths, index centring, card dimensions at sampled animation frames | Physical swipe feel, cancelled edge gestures and whether motion feels connected to the pouch |
| Pointer sequences, circular order, click-through, keyboard focus and reduced motion | Browser chrome/safe areas, orientation, comfortable thumb targets and perceived text capacity |
| Component mount count, input/scroll/time preservation and controlled pending-play races | VoiceOver/touch navigation, real network/provider timing and visual compositing |
| Nested viewer return, stale network response handling and viewport screenshot regressions | Performance and readable remaining step context on the actual phone |

Touch emulation and screenshots are useful but not a substitute for the right-hand column. Existing video fixtures/mock capability probes do not prove real Safari codec/HLS support.

### 9.3 Straightforward phone prototype access

The existing fixture server now supports an explicit opt-in host setting, keeping loopback as default. For integrated 1C review run `SWITCHPLAY_FIXTURE_HOST=0.0.0.0 SWITCHPLAY_FIXTURE_PORT=4180 node tests/browser/server.cjs`. On the same trusted Wi-Fi, open the printed `http://<laptop-LAN-IP>:4180/info-cards/integration` URL in iPhone Safari; allow the local firewall connection if necessary. Stop the fixture server afterward. It bundles the actual DeckScene/FocusedCardView/StepView/player without credentials, database, deployment or public tunnel. The original static 1A fixture remains at `/info-cards`.

The 1C fixture includes a locally generated H.264 MP4 with real browser decoding, served through a fixture-only transport adapter; this does not test real protected Stream/HLS delivery. Repeat that coverage later. If a required feature truly needs HTTPS, use an existing approved development deployment or a narrowly scoped HTTPS solution then; do not add certificate/tunnel infrastructure speculatively. The fixture exposes no secrets or real personal data when LAN-bound.

## 10. Model and effort recommendations by phase

These task-specific recommendations are retained from the reviewed plan; they are not benchmark guarantees. Astra (`gpt-6-astra`) and Sol 6.1 (`gpt-6.1-sol`) were advertised in this session's model tools; exact access in the user's chosen client may differ. Official [model guidance](https://learn.chatgpt.com/docs/models) and [Sol 6.1 documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol) were consulted during the preceding review using the OpenAI documentation skill. Availability and comparative performance can change; no new comparative capability claim is needed for this reconciliation.

Use the exposed effort names where possible: Medium, High, or `xhigh`/Extra High when offered. Do not assume a client label “Very High” maps identically. Instant is unsuitable for these integration phases. Pro reasoning mode is distinct from the effort setting in the [reasoning documentation](https://developers.openai.com/api/docs/guides/reasoning); neither Pro nor maximum effort is required by default.

| Phase | Preferred model / effort | Why; benefit of a more capable model | Independent opinion? |
| --- | --- | --- | --- |
| 1A geometry/capacity | Sol 6.1 / High | Precise CSS/layout and real-device feedback dominate. Astra is unlikely to replace the value of measured phone results. Medium is adequate for small follow-up styling changes after geometry is agreed. | User/device review is more valuable than another whole-code review. |
| 1C Step View/media integration | Astra / High | Cross-component lifecycle, portal stacking, native playback and event isolation are the highest UI integration risk. Extra High only for a specific unresolved race. | Sol 6.1 High review against explicit lifecycle/isolation cases, plus actual Safari evidence. |
| 1B physical stack | Sol 6.1 / High | Stateful animation and cancellation need careful coding/tests; the scope is local. Use Astra High only for persistent gesture/state-machine ambiguity. | A small focused review of wrap/cancellation tests, not a duplicate implementation. |
| 2 domain/security foundations | Astra / High | Ownership, snapshot semantics, historical visibility and concurrent reference writes benefit from deliberate architectural reasoning. Extra High for the guard protocol if required, not every endpoint. | Yes: independent review of ACL matrix, transaction interleavings and draft discovery, ideally Sol 6.1 High. |
| 3 Creator/Library/media | Sol 6.1 / High | Mostly concrete repository-guided coding, bounded UI state and tests. Astra adds material value only where upload permissions or recovery contracts remain ambiguous. | Focused permission/media review; no need to repeat the complete Library build. |
| 4 attachments/deletion/live reads | Astra / High | Many existing create/fork/publish paths must preserve references and lock ordering; mistakes can leak data or corrupt history. Targeted Extra High is justified for concurrency analysis. | Yes: a separate reviewer checks every reference-producing path and races, not just UI success. |
| 5 hardening | Sol 6.1 / High | Reproduction, regression triage and evidence collection dominate. Medium is sufficient for straightforward test additions; Astra High for unexplained lifecycle/security failures. | Narrow final security/concurrency review; user performs/approves device acceptance. |

Higher capability does not replace disposable-database concurrency tests or phone validation. Avoid automatic Max/Pro, multiple full independent implementations, or endless diagnostic reasoning. A cheaper available model can handle isolated documentation/test-data chores, but this plan does not assume an unverified capability/availability ranking for those models. Independent reviews are proposed checkpoints, not agents launched or costs incurred by this planning task.

## 11. Risks, resolved decisions and remaining measurements

### 11.1 Principal risks and controls

- **Silent field loss:** strict validators and board/fork projections can drop attachment IDs. Audit every round trip and test old/missing fields without rewriting history.
- **Two different “versions”:** retain immutable main references while resolving info latest at opening; freeze the resulting consultation. No adoption machinery for info.
- **Private-data leakage:** filter before groups/counts, bind requests to the actor, authorise media separately, and never infer ownership from series attribution.
- **Deletion write skew:** a transaction alone is insufficient if attachment creation and deletion never write a common guard. Include deterministic concurrent tests.
- **Inaccessible blockers:** independently list all info drafts; preserve safe refusal for detached main drafts, distinguish historical blockers and track deferred recovery as DRAFT-1.
- **Lifecycle regressions:** preserve mounted Step View/player/activity, cancel delayed play, and isolate the hosted-video layer as well as the card DOM.
- **Capacity/accessibility tension:** one-line combined header and fixed dimensions do not guarantee arbitrary text fits. Measure the normal envelope and reject excessive publication content; record broader reflow needs as A11Y-1 rather than adding a fallback to the prototype.
- **Series discovery regression:** use latest published memberships, never draft intent or retained historical versions; authorise existing owner-card labels without reopening general discovery.
- **Asset history:** a removed current media item can remain required by an open consultation/private-era publication. Do not eagerly delete provider assets.
- **Misleading test confidence:** a successful browser launch, Chromium touch emulation and a mock video do not prove real iPhone Safari behaviour.

### 11.2 Final decision record

| Former question | Resolution |
| --- | --- |
| Series discovery | Own-created series plus series with a current published public member. Hidden foreign names/counts excluded; already-authorised card context retains its label/selection. |
| Duplicate titles | Unique per `(series creator, normalised title)`; identical titles across creators remain separate stable IDs with visible attribution. |
| Detached main-draft recovery | Defer new workflow under delegated engineering discretion; retain all guards and clear blocker feedback. Backlog DRAFT-1. |
| Public deletion | Owner can delete an unreferenced public record; public visibility remains permanent while it exists. Historical/main-draft refs still block. |
| Capacity/accessibility | Measure normal content/mobile envelope first, keep ordinary faces complete and fixed; broader extreme-size accessibility work is backlog, with zoom preserved. |
| Backend publications | Immutable retention approved; no user-facing history or adoption. |
| Prototype | Phases 1A–1C completed; user has authorised Phase 2 following readiness review. |

**No architectural obstacle requires 1B before 1C.** Card dimensions/capacity have 1A evidence; motion tuning remains a 1B output. Phone evidence requires access to the actual device; absent coverage must be reported. WebKit availability does not block progress.

## 12. Functional specification v0.3 reconciliation

The companion specification was updated during the earlier planning task, not during 1C. The following table records that reconciliation; the subsequent visual overrides noted at the top of this document remain authoritative:

| Specification area | Reconciled behaviour |
| --- | --- |
| §§2, 4.4 series | Stable creator-associated identity, per-creator duplicate prevention, independent contributions and attributed selectors. |
| §4.4 discovery | Derived current-public membership, hidden empty/private-only foreign series, no historical/draft visibility leakage; retained owner-card context. |
| §4.3 drafts | All owner info drafts independently accessible; published-dirty snapshot separation and clean Library access. |
| §4.5 Library | Real static Decks/Info Cards Library in v1, authorised published cards only, distinct attributed series groups and owner editing. |
| §5 attachments | Published-only title/series/card-owner picker, attributed series metadata, remove/reorder, normal main publishing/adoption. |
| §§3.1, 8 face | One bold body-sized series/title line; series creator tooltip; no separate INFO label, index/dots, thumbnail, scroll or truncation; measured capacity. |
| §6 publication/deletion | Permanent public visibility, owner deletion when unreferenced, all main draft/history blockers, immutable backend publications and stable open consultations. |
| §§7–10 interactions | Actual footer placement, symmetric controls, constant card dimensions, circular movement, isolation, pause/state preservation and nested viewer return. |
| §§11, 13 scope | Prototype first; wider main-draft recovery/accessibility deferred, pragmatic Chromium/WebKit/actual-phone strategy, separate coding authorisation. |

The original reconciliation predated the 1A reference-image correction. The approved images now govern composition, subject to later written overrides including the taller card and header hierarchy. Phase 1C preserves the corrected 1A presentation.

## 13. Deferred Improvements / Backlog Recommendations

These tasks are recommendations for later scheduling, not additions to Phase 1 or implicit implementation authorisation. Priorities are relative: P2 = worthwhile follow-up based on observed use; P3 = optional maintenance when evidence justifies it. Normal-viewport readability, new-interface focus/zoom access, correct series privacy, all info drafts and reference guards are required work and cannot be deferred under these entries.

### DRAFT-1 — Recover inaccessible detached main-card drafts

- **Problem:** `creatorDrafts.ts` discovers main drafts through effective owned deck compositions. Detached independent drafts can become inaccessible through UI while correctly blocking deletion of referenced info cards.
- **Why safe to defer:** drafts and references remain intact; deletion fails safely with accurate feedback. This rare usability limitation does not compromise publication integrity or info-draft access.
- **Acceptance criteria:** discover owned detached main drafts independently of deck membership; provide the smallest owner-only open/recover path after evaluating extraction of the existing title editor; preserve all unrelated steps/media/draft fields and revision preconditions; no automatic detach/discard/delete; cannot expose foreign private drafts; removing a draft-only attachment can clear that blocker, while historical references still block; reload and stale-tab cases tested. Reuse an ordinary deck editor link only when it genuinely reaches that draft.
- **Priority:** P2; schedule earlier if actual users encounter blocked deletion. No new route is included in the present implementation phases.

### A11Y-1 — Main and info card readability under enlarged text and constrained screens

- **Problem:** existing whole-card fit-scaling, fixed surfaces and main-text clamps do not provide a general reflow/full-text solution at extreme zoom or very short viewports. The info face deliberately requires complete fixed-size normal content.
- **Why safe to defer:** Phase 1 measures standard-size supported layouts and preserves zoom; a broader alternative reading experience would expand scope before the ordinary design is validated. Record limitations honestly. A regression or essential clipping in a normal supported case must still be fixed immediately.
- **Acceptance criteria:** record actual phone/browser text-size and zoom behaviour; assess main and info faces together at representative enlargement and constrained sizes; provide an agreed accessible route to complete essential text/controls without disabling zoom or silently truncating content; maintain normal info-card geometry and activity state; verify keyboard and VoiceOver behaviour on a real device; document supported behaviour and remaining limits.
- **Priority:** P2 after prototype evidence; raise priority for an observed inability to access essential content.

### A11Y-2 — Audit existing Step View video accessibility and motion

- **Problem:** the hosted-video ancestor is `aria-hidden` while containing player controls; existing Step View/focused-card motion lacks the media viewer's explicit reduced-motion handling. Source inspection identifies concerns, not completed assistive-technology test results.
- **Why safe to defer:** a broad audit of current main-card behaviour is independent of initial footer/capacity work. The new info interface must still have labels, focus isolation/restoration and reduced-motion support. Any conflict that prevents the required Phase 1C accessible interaction must be fixed there.
- **Acceptance criteria:** audit real player control exposure, tab order and VoiceOver before/during/after info consultation; correct hidden-focusable states without reopening underlying controls during consultation; apply a coherent reduced-motion policy to existing relevant transitions; retain video position and existing navigation behaviour; record actual-device results.
- **Priority:** P2, informed by Phase 1C testing.

**1C progress:** the hosted video is now excluded from accessibility only while consultation is open, instead of permanently hidden. Wider VoiceOver/reflow/reduced-motion auditing remains deferred and is not claimed complete.

### TEST-1 — Document a reliable WebKit launch context on the development Mac

- **Problem:** sandboxed WebKit aborts on the supplied Intel/macOS 14.8.7 environment, while the single outside-sandbox smoke check launched successfully. Full app coverage in that context remains unproven.
- **Why safe to defer:** Chromium automation and actual iPhone Safari cover the agreed prototype strategy; no simulator/browser-repair programme is required.
- **Acceptance criteria:** when worth revisiting, use a separate bounded investigation; record the launch context and exact command/version; run a targeted relevant test if supported; clearly distinguish launch success, app-test success, exclusion and failure; document which explicit WebKit variants are omitted from Chromium-only runs. Stop on the agreed timebox and retain manual fallback if unresolved.
- **Priority:** P3; never a Phase 1 gate.

## 14. Precise first implementation task

Historical 1A task retained below; it has since been implemented and visually refined. The currently authorised checkpoint is **Phase 2**, with its dependencies and acceptance criteria in section 8. No prototype styling redesign is included.

**Recommended task:** “Info Cards Phase 1A — actual Step View footer geometry and static info-card capacity fixture.” Preferred model: **Sol 6.1, High thinking effort**, consistent with section 10. Geometry, scoped styling and meaningful browser measurement are a bounded coding task; device evidence matters more than escalating model effort. No independent second implementation is warranted for this checkpoint.

After explicit coding authorisation:

1. Read the relevant installed Next guides required by `AGENTS.md`. Extend the existing real-component fixture with temporary attributed info cards; keep fixture data out of production/API persistence.
2. Put the pouch in `StepView`'s actual footer using scoped styles, equal Previous/Next tracks and centred index. Render the actual scaled focused-card/Step View geometry, not a separately drawn mock footer. Keep zero-attachment behaviour covered.
3. Add the reusable minimalist `InfoCardFace`, including compact optional media affordance and the small series-attribution tooltip. A fixture control can switch to a **static** open-card placement for measurement; animation, circular browsing and playback integration arrive in 1B/1C.
4. Add focused Chromium geometry/content tests and record normal-viewport text fit with media/no media, realistic two-paragraph copy and long combined headers. Do not choose publication limits or add backend validation now. Report measurements, screenshots and exceptional-size observations.
5. Add opt-in LAN fixture access with the loopback default retained. Supply the exact local phone URL/instructions and collect user phone feedback; record manual coverage as pending until it happens.

**Reviewable output:** a working geometry/capacity fixture, scoped component changes and focused automated checks, with actual fit/fail samples and phone-access instructions. Checkpoint acceptance follows section 8's Phase 1A criteria; its evidence now resides in `phase-1a/`.
