# Info Cards — Reconciled Engineering Plan

Date: 22 October 2026; Phase 3 corrections incorporated 23 October; Phase 4 refined and implemented 24 October 2026. Status: **Phases 1–3 implemented; Phase 4 implementation and acceptance evidence are recorded in the [Phase 4 handoff](phase-4/README.md). Application index deployment and live media-provider verification remain explicit production gates.** Historical test reports describe their recorded runs; the handoff identifies fresh implementation checks and remaining manual/operational coverage.

Implementation order is **1A → 1C → 1B → final integration verification**. Phase 1A's committed visual baseline is `a4c2e2a`; its [refinement evidence](phase-1a/visual-refinement.md) remains authoritative for prototype styling. The 1B start inspection found a clean `feat/info-cards` worktree at `666abb4` (committed Phase 1C). Later visual decisions (secondary series/primary title, dedicated consultation X and positional number confined to the open pouch) are now reconciled in specification §§4.2/10. Preserve them during production integration.

Authority: [functional specification v0.3](../../../design/features/info-cards/info-cards-functional-spec.md), together with subsequent approved visual decisions. Section 12 records the earlier reconciliation; section 13 contains deferred improvements and section 14 retains the original 1A task. See [Phase 1B evidence and review instructions](phase-1b/README.md) and the historical [Phase 1C handoff](phase-1c/README.md).

This document distinguishes **Fact** (inspected repository), **Approved product decision**, **Engineering recommendation** and **Unresolved product decision**. The subsequent explicit Phase 4 go-ahead authorises checkpoints 4A–4E, not live deployment, commits or Phase 5 implementation. See the [Phase 2 handoff](phase-2/README.md) for backend contracts and verification status and the [Phase 4 handoff](phase-4/README.md) for implemented integration choices.

### Phase 4 refinement: decisions versus proposals

- **Approved:** visually closed pouch during loading; immediate playback suspension/input isolation; discreet `Loading Info Cards…` only after one second, outside the main card near the pouch; remove before the existing opening animation. Whole-request failure uses a short error in the same area; retry by closing/reopening, never a Retry button, spinner, loading card or new overlay.
- **Approved:** preserve every authorised attachment position. An unresolved item becomes a neutral, same-size unavailable placeholder without protected metadata. Successful publications and unavailable positions remain fixed for that consultation. Media failure leaves the resolved info card intact.
- **Approved:** one non-searchable dropdown in the existing title modal, My Cards then Other Cards, two-line metadata, select/remove/reorder local until Save. No previews, inline creation or additional screens/controls.
- **Approved:** deletion UI is deferred beyond Phase 4; backend reference/deletion protections remain mandatory. No editor/Library Delete buttons or new detached-draft recovery workflow.
- **Implemented engineering choices:** adapt the existing snapshot query for positional results; reuse the existing exact-publication media viewer without a new renewal manager; use a small local grouped listbox for the approved two-line options. Details in §§7.5/8 and the Phase 4 handoff.
- **Approved — pending/error dismissal:** existing pouch tap, exposed-background tap and Escape cancel/dismiss while the pouch is visually closed. Retain video pause, abort requests where possible, discard late responses, and make the next opening fresh. No additional pending-state close control.

### Phase 3 readiness corrections

1. Use implemented contracts: offset/limit pagination and `nextOffset`, caller-stable creation IDs, and `/api/info-cards/:id/media` with exact draft revision or publication version. Earlier route tables are conceptual where these differ; no history reader is added.
2. Use a small independent info editor persistence controller with serial revision-checked autosaves, captured-command retries, publication-receipt recovery and retained local edits on conflicts. Preserve structured capacity/error details in the actor-bound transport. Do not instantiate the deck board/coordinator for info content.
3. My Drafts combines typed deck and independently owner-queried info entries, routes by kind/ID, handles every info page and reports source failures. Finish current saves/uploads before switching, without implicit publication.
4. Add collection-level Library tabs with an independent static info panel; preserve existing deck detail/navigation. Apply owner-first/latest-successful-publication ordering server-side before pagination; Decks retains latest-publication ordering without owner priority. No series groups or Library search/create controls. Use ordinary client-side returns and established loading/data fetching; discard stale/account-mismatched responses and preserve editing origin through reloads.
5. Add info-specific upload adapters honouring returned headers/proofs, an authorised exact-context processing-status read, explicit image delivery source and the player's playback resolver. Preserve the fail-closed provider gate and test replacement, cancellation, stale results and publication-specific access.
6. Reuse the approved fixed-width `InfoCardFace` and shared capacity validator; preserve secondary-series/primary-title hierarchy. Invalid drafts remain editable and saved, with explicit overflow feedback rather than silent truncation/shrinking.
7. Extend real-Next disposable browser setup with info indexes and controlled media boundaries. Automated UI acceptance uses authenticated real routes; the port 4180 Phase 1 fixture is not Phase 3 evidence. Provide opt-in LAN access to the disposable application for phone review.
8. Main-card attachment UI, canonical writer guards and production pouch fetching remain Phase 4. Reference-feedback/deletion UI is now deferred; backend protections remain mandatory. Phase 3 must not enable unguarded attachment writes. No unrelated Creator/Library framework refactor.

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
- The present task implements Phase 4 against completed Phases 1–3. It preserves the functional specification and prototype. Index setup is explicit; no live database migration or provider configuration changes have been made.

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
| Header attachment picker | Existing title modal; no attachment UI yet | Non-searchable My Cards/Other Cards dropdown with two-line metadata, remove/reorder and full persistence audit. |
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

Working context must verify the actor's adopted main version and effective deck membership. Canonical/public preview must verify the exact immutable public main version displayed, not substitute the root's latest version or the deck's original publication pin. An arbitrary client-supplied list of IDs is not attachment authority. Read main context and info publications in one transaction/session. No new Creator-draft consultation endpoint is required. Guard late responses after close, navigation, account changes or a second opening.

No eager media fetching, persistent content cache or real-time subscription is needed. Preserve known ordered slots with safe unavailable placeholders, not silent omissions. Whole-request failure uses the discreet error outside the main card, not a Retry control. Pending/error dismissal is the unresolved question above. The underlying step remains paused and mounted; do not present old content as refreshed.

## 3. Library architecture and implementation cost

**Decision: implement the actual Decks/Info Cards Library in v1.** The earlier comparison found its incremental cost reasonable: published queries, visibility filtering, owner routes and attribution are already required. Additional work is the tab wrapper, static grid, pagination and navigation/accessibility states. There is no temporary selector phase. Search remains an existing backend capability, not a Library or attachment-picker control; Phase 4 can consume catalogue pages without a search parameter.

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
| `GET /api/library/info-cards` | Published catalogue, bounded search/filter/offset pagination, server visibility filtering. Reusable query core for attachment results. |
| `/api/info-cards`, `/api/info-cards/[id]` and publish action | Owner create/read-draft/save/publish/delete; explicit revision preconditions. Public catalogue reads never return draft fields. |
| `/api/info-card-series` | Authenticated eligible-series search and creator-scoped get-or-create; policy in section 4. |
| Main-card consultation endpoint | Implemented `GET /api/card-templates/[id]/info-cards` with validated context/version; snapshot response, not a client-authorised ID batch. |
| Info media endpoint | `/api/info-cards/[id]/media`; publication/owner-draft context, exact stored asset match, authenticated delivery. Owner draft video processing uses `/api/info-cards/[id]/media/status?revision=N`. |

Choose one thin tab wrapper at the Library collection level. Do not mount the deck navigation controller while the info panel is active. Retain existing deck deep links and refresh behaviour. Account switching clears private lists, searches and previews; session-aware no-store responses prevent cross-viewer cache reuse.

**Agreed UX correction:** no grouping, search form or creation link. In `infoCatalogue`, after ACL filtering and the existing latest-publication join, sort `(own ASC, publication.publishedAt DESC, infoCardId ASC)` **before** offset/limit. A successful republication promotes the item within its owner group; draft/root update/creation/series order has no effect. Decks retains its existing latest-publication timestamp/cursor order without owner grouping. The client appends server-ordered pages without independently sorting them. Stable IDs break timestamp ties. Ordinary pagination remains; concurrent catalogue mutations are not a frozen multi-request snapshot.

Use the approved face-up `InfoCardFace`, no extra opening interaction. Show secondary `Series title (series by username)` above each face and `Card by username` immediately beneath it (small gap), followed by privacy/owner Edit actions. No series headings, duplicate permanent creator labels, animated packs, membership or adoption controls. Card face/tooltip and media publication identity remain unchanged.

## 4. Shared collaborative series

### 4.1 Identity, names and attribution

**Decision:** stable caller-generated UUID validated by the server; immutable original `createdByUserId` bound to the authenticated actor; display title plus `normalisedTitle`. Enforce a unique compound index on `(createdByUserId, normalisedTitle)`, never on title alone. Normalise consistently using Unicode NFKC, trim/collapse whitespace and locale-independent lowercase. Preserve the confirmed display title; do not strip punctuation/diacritics or fuzzy-merge titles. This is a documented technical normalisation policy, not a series rename feature.

Creation is explicit, not a request on each keystroke. The actor supplies a title, never an arbitrary series creator ID. If that actor already has the normalised title, return their existing ID. Concurrent creations by the same actor use the unique-index duplicate-key/re-read pattern; creations by different actors produce distinct IDs. A match belonging to another creator is selectable only through eligible search results and is never substituted automatically for Create.

Display `Series title (username)` in the Info Card Creator series selector. Library uses `Series title (series by username)` and separately `Card by username` to distinguish creators. The approved main-card attachment dropdown is an exception: My Cards shows series name alone; Other Cards shows `Series name · by username`, identifying the card owner. Resolve usernames through existing attribution helpers/fallback; username changes do not change identity. On the actual face retain only the series title, revealing its creator through the existing tooltip. Do not redesign Phase 1 markup/styling.

### 4.2 Derived discovery and retained selections

General series-search/direct-discovery eligibility is precisely:

`series.createdByUserId === actor OR exists a current published public info card whose latest published content has this seriesId`.

Use the **latest published** series membership and effective published visibility, not drafts or every retained info publication. A draft move does not reveal/hide a group; publishing a move or deleting the last unreferenced public member can. Historical publications do not keep an otherwise hidden series searchable. No stored manual visibility flag or public-member count is needed. At this scale, use an indexed existence/aggregation query over roots and their current publication records in a consistent read snapshot. Add denormalised membership/counts only if measured query cost later justifies them.

Search filters eligible series before returning names, attribution, suggestions, pagination or any metadata. A hidden foreign series must produce the same unavailable result as an unknown ID. Bound and escape search input. Sort matching own-created series alphabetically first, then eligible other-created series alphabetically, with stable ID tie-breakers **before pagination**. Empty/private-only/unpublished-only own series are included for the creator; those of others are excluded. No private member counts are exposed.

Library rows start from **authorised current published info cards**, then project their series labels/attribution without grouping or enumerating hidden series. An owner can still see their own private member in a formerly discoverable series; no private members are exposed to others.

If a contributor already owns a card referencing a series which later becomes undiscoverable, permit its existing selected label in that card's authorised draft/published editor/preview and permit retaining that ID on save/publish. This limited context is necessary to keep their own content editable; it is not general search eligibility. New assignments to a foreign series must be discoverable when validated in the save snapshot. Revalidate after selection; if eligibility has disappeared before save, preserve entered content and ask the creator to choose an eligible series. Do not erase an existing valid selection merely because discovery changed. No new cross-document series locks or permanent contributor ACL are justified.

### 4.3 Ownership and scope

Any eligible creator can contribute independently owned info cards; the series creator cannot edit those contributions. Every save/publish/delete verifies the info-card owner separately. Series existence is validated, but series creation ownership is not required for an eligible contribution.

Keep unused series metadata: the creator can still find it and drafts may refer to it. No series rename/delete/admin/merge/moderation screens, automatic cleanup jobs or public standalone series directory are required. Tests must cover the last-public-member transition, identical titles across creators, same-creator concurrent creation, unpublished public intent, historical membership, direct-ID probing and existing private contributors' retained selections.

## 5. Revised creator workflows

### 5.1 Mode switching and editing

Keep the application's main Create menu as the authoritative entry. Show the Deck/Info Card selector **only in explicit new-item sessions**, never ordinary existing-item edits. Carry `entry=create` when autosave installs a stable edit URL so reload preserves creation intent. Existing Library/My Drafts/Deck edit entries default to editing. Switching modes or destinations waits for saves/uploads without publishing; failure keeps the editor visible.

Header: New Info Card/Edit Info Card, discreet save status, appropriate publication controls. Form: single Series dropdown, initially empty Title, Explanation, optional media, live preview. No duplicate title/series summary, separate series search/buttons or permanent requirements block. The dropdown loads all eligible pages, groups own/other series with a divider and usernames, offers explicit inline creation then auto-selects, and retains an authorised selected series excluded by general discovery.

**Series-first Title correction:** the title input is focusable/read-only (`aria-disabled`) until the desired series ID matches an available selected series DTO, including its actual title. Keyboard/focus/touch interaction gives “Choose or create a series first.” New-series intent is not a selection: only the successful returned ID unlocks Title. No changes to series discovery/creation APIs are required. Existing stored title/body/media are preserved; a no-series legacy title stays visible and read-only. The downstream explanation/media gate uses that resolved selection plus nonblank title. Capacity feedback uses the real selected series; no speculative title-width warning is shown before it is known. No backend measurement, typography, rendering, navigation or Phase 4 changes.

Series plus nonblank title gate **only UI explanation/media add/replace**, not backend draft saves. Read-only focusable explanation and a keyboard/touch-operable unavailable media control provide the exact contextual prerequisite message; stored body/media are never cleared. Missing fields appear beside controls after attempted publication. Live capacity diagnostics appear directly beneath Title/Explanation, with `aria-invalid` and `aria-describedby`, updating on typing, series changes and media changes. The preview becomes an explicit “Preview unavailable.” state, without repeating the field warnings. The shared capacity module returns typed field/code/message diagnostics alongside its existing aggregate issues/metrics; React consumes those diagnostics without text measurement or fixed-line-height assumptions. Only server capacity messages already visible at current fields are suppressed; other structured validation, upload and persistence errors remain actionable. Oversized drafts autosave; server publication validation remains authoritative. No mathematical rendering, dimensions, typography or wrapping/paragraph policy changes are included.

Public publication retains permanent-public confirmation. Persist identity before upload allocation; clean published editing creates no spurious draft. Reverting to published content clears outstanding state. Incomplete/overflow drafts remain recoverable but cannot publish.

Approved collection-return rules supersede the earlier draft-dialog return. Small `creatorNavigation.ts` helpers return Info Cards to Library → Info Cards; new Decks follow visibility intent; existing owned Decks retain an explicit collection origin. Direct/draft routes use a valid same-item origin or visibility fallback. Private copies use My Decks after the actual owned identity exists. Labels are My Decks/Library; the Library Decks tab remains Decks. URL context for copying, adopted version selection and recovery is retained; no generic framework or history/referrer authority is introduced.

Resolve the destination again after save/publication/copy completion using current visibility and resulting ID, not a stale render closure/source ID. Collection links never invoke working `openDeck` entry. Preserve Deck's upload/save/leave-confirmation/publication recovery barriers, adding relevant saved-draft absence text to its existing dialog. Info Card collection return flushes uploads/saves and confirms deliberate leave for a saved unpublished root. Published Info Cards do not receive the absence warning. No implicit publication.

`myDecksLayout.ts` sorts by max(personal createdAt, openedAt), newest first, with stable ID ties and no new persistence. **My Decks is unchanged by the publication-order correction**, including existing collection-return discovery and working-entry behaviour. Remove Library `reveal` query contracts, `revealedId`, target seek windows/anchor bookkeeping and Show newest controls. Keep ordinary Deck cursor and Info offset pagination and existing authorisation.

**SPA return correction (24 October 2026):** withdraw the earlier first-render guarantee and full-document navigation. Both Creator return handlers use the existing Next `router.push`; do not add a freshness workaround, cache system, optimistic list edit, delay or new persistence barrier. Keep the established Deck server page and mounted Library navigation hook; restore Info's ordinary authenticated mount-time catalogue read and existing loading message. Remove reload-only Info initial-page plumbing and persisted-history reload guards. Existing actor/lifetime/sequence checks and publication/save/upload safeguards remain, including detached Card saves/uploads continuing after SPA unmount. Observe normal, throttled and delayed-data transitions before proposing any further change; record stale ordering or loading issues without fixing them in this pass.

Entity lanes/info editor retain a minimal in-memory `confirmedPublicationVersion` only after a successful server publication acknowledgement or verified recovery receipt, never from opening an existing root or saving a draft. Only then does the Library return URL carry `published=<resulting ID>`. `CollectionReturnHighlight.tsx` applies the existing expiring outline to an authorised rendered item, **without Library scrolling**, promotion or extra controls. My Decks explicitly retains its pre-existing scroll behaviour through the same helper. Returning without publication uses the plain relevant Library tab, its normal top and no highlight. No publication schema/rules, indexes or security policy change is required; Phase 4 is excluded.

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

Extend the existing card-title modal with **one non-searchable dropdown**. My Cards contains eligible owned published cards; a divider precedes Other Cards, containing other creators' public published cards. Each option has a medium-weight title on its first line and smaller muted metadata on its second: series name for My Cards, `Series name · by username` for Other Cards. This username identifies the info-card owner, not the series creator. Use comfortable padding and unobtrusive group labels. No search/autocomplete, thumbnails, previews, inline creation, sorting/filter controls or separate management screen. Foreign private cards and unpublished drafts are ineligible.

Selected IDs are ordered. Retain the agreed removal/reordering inside this modal; no additional drag feature is needed. Prevent duplicate IDs on one main card; reuse across main cards remains allowed. Save title and attachments as one normal main-card draft update; Cancel discards modal-local edits. Public publication, not merely picker UI, enforces the private-attachment restriction; a draft may hold an own-private attachment meanwhile. Retain selected IDs independently of catalogue loading/failure; never silently detach them.

Audit `creatorBoardState.ts`, `cardArchitectureAdapter.ts`, `privateGraph`, presentation/read DTOs, strict content validators, fork/copy construction and main publication hashing. Every normalise/copy/edit path must preserve the optional field. Old content defaults to an empty list without rewriting immutable history. Existing main-card fork ownership rules remain unchanged; do not bypass them because only attachments changed.

“Remove attachment” never invokes deletion. Backend deletion remains protected under section 7; deletion controls, confirmation and reference-feedback UI are deferred to DELETE-1, not delivered in Phase 4.

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
- No position indicator on an info-card face, including an injected carousel counter. Preserve the already-implemented open-pouch positional number and closed-pouch attachment count. Provide keyboard Up/Down and existing assistive labels without inventing another visible index.
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

Retain the backend's safe blocker categories; no reference-feedback UI is added in Phase 4. Future deletion UX must distinguish draft/history blockers without exposing other creators' titles, deck names or private counts. Do not link to a nonexistent editor or imply every detached draft is recoverable through My Drafts. The normal editor can resolve reachable draft-only blockers; editing the current draft cannot remove historical references.

**Remaining limitation:** some detached draft-only references can make an otherwise unused info card undeletable through the existing UI. Keep the draft/info records intact; never silently detach/discard them or bypass the guard. Direct owner APIs remain available for a future narrow recovery implementation, but manual database editing is not a product workflow. Backlog **DRAFT-1** (section 13) specifies the eventual improvement. This is a deliberate scope decision under the user's discretion, not an outstanding approval request. Independent My Drafts access for **all info-card drafts** remains mandatory in Phase 3.

### 7.5 Media delivery and consultation stability

Extend upload targets with an independent info-card owner scope; validate ownership/existence on the server, namespace R2 keys by info identity/owner, and verify Stream asset provenance/readiness before publication. Reuse provider upload and status code. Do not invent a fake deck ID or accept client-supplied arbitrary media URLs as proof of ownership.

Published media access verifies exact stored media in the requested info publication and its immutable visibility. Owner draft preview verifies the owner/current draft reference. Keep the consulted publication identity while nested media opens. Any fresh grant must recheck the same publication and actor, never switch to latest content. This does **not** require automatic renewal. R2 proxy delivery and listing DTOs remain private/no-store where viewer-specific.

Historical backend records do not imply anonymous private-media URLs are safe. Verify bucket/provider delivery configuration at implementation time: an ACL in an API cannot protect a directly public storage object. Reuse the existing protected delivery pattern and fail closed for unrecognised assets. Tests must include private-era media after public promotion, forged IDs, another creator's draft and expired/session-changed grants.

**Phase 2 implementation:** a signed upload proof binds the owner, stable info ID, creation identity and allocated asset. R2 uploads use signed `If-None-Match: *` to prevent replacing an already-published object. Stream readiness checks require the issuing creator and signed-only playback. A small immutable allocation registry prevents older broad media routes, exact main-card playback and personal downloads/status from accepting an info asset through a forged legacy reference. Registry records survive info deletion; this is provenance protection, not a reverse attachment index. Provider operations remain outside Mongo transaction callbacks. New info upload/publication-with-media/delivery fail closed unless protected delivery and the explicit provider-verification deployment gate are enabled. Real provider configuration remains unverified; automated stubs are not evidence of private-bucket delivery.

#### Existing media preparation: confirmed implementation, 24 October

Evidence: [system behaviour](../../system-behaviour.md), `src/lib/cardPlaybackGrants.ts`, `deckVideoPreparation.ts`, `cardVideoThumbnails.ts`, `src/components/media/DeckVideoPreparation.tsx`, `CloudflareHlsVideoPlayer.tsx`, `src/lib/cards/protectedMedia.ts`, and [the original delivery trade-off](../../phase-8-preparation.md).

- **Lifetime:** `streamPlaybackGrant` issues a **one-hour** Stream bearer token. `PLAYBACK_GRANT_REUSE_MS` is **ten minutes**, an in-memory authorisation reuse window, not the token's expiry. Reuse is capped at token expiry minus 30 seconds; `prepare` refreshes a cached grant when its reuse window is within 60 seconds of ending.
- **Batching:** `prepare` deduplicates assets and runs independent grant requests in parallel with `Promise.allSettled`; it is not a single batch HTTP endpoint. On focus, `FocusedCardView` prepares Intro and all three step-video grants/thumbnails. The deck-level manager prepares a bounded seven-card Intro window, with at most two low-priority neighbour jobs after active-image readiness. It does not prepare every step of every deck card or mount spare players.
- **Renewal:** event-driven on preparation/focus, step navigation and visible-tab return, not a periodic idle scheduler. Expired cache entries trigger a new request on the next read. Background refresh does **not** replace the active player's manifest or disturb its playhead. This is not seamless playback-token renewal: the player resolves a manifest on load; ordinary play after a pause does not itself reauthorise an expired source. Reloading a source is not proven to preserve its position.
- **Images:** Stream poster thumbnails share the video grant and decoded-image preparation. Ordinary R2 images instead use the authenticated protected proxy; they do not use the ten-minute Stream grant cache.
- **Long pause:** after ten minutes an already-loaded video's one-hour URL can still be valid. After token expiry, buffered playback might work but subsequent provider requests are not guaranteed; automatic recovery of indefinitely paused playback is not implemented. Reopening the media obtains a fresh grant. Current Stream upload maximum is 150 seconds (`cloudflareStream.ts`), far shorter than a freshly minted token's lifetime. Live provider behaviour remains an operational verification gate, not established by code inspection.

**Implemented Phase 4 approach:** reuse `InfoCardRemoteMediaViewer.tsx`, `InfoCardMediaViewer.tsx` and the common HLS player. The remote adapter obtains a fresh grant for its actor and **exact info publication version** on media opening; closing/reopening the nested viewer retains that version and gets fresh authorisation. R2 reads use the same exact-context endpoint. Preserve the card when delivery fails; use the existing media viewer's failure handling. No new media controls.

The ordinary grant reader is hardwired to main-card/version/mode authorisation; the deck preparation manager additionally assumes Intro thumbnails. Passing info media through fake main context would be incorrect and is blocked by existing asset provenance checks. A small injected-request adapter could reuse grant caching if measured repeated-view latency later warrants it, but the existing info viewer already supplies the necessary security adapter. **No new cache, batch manager, scheduler or automatic midstream renewal belongs in Phase 4.** The earlier readiness concern is narrowed to documenting the existing long-pause limitation and checking exact-publication fresh grants. Any future renewal must retain that actor/publication, not resolve latest content.

## 8. Phased implementation and acceptance checkpoints

The user now authorises **Phase 3 only**, following completion of Phases 1–2. Historical checkpoints remain below as evidence. Later phases still require separate authorisation.

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
- **Validation:** new/unattached draft reload; dirty published snapshot separation; creation-only selector including autosave/reload; no implicit publishing on switch; approved hybrid collection returns, unpublished-item leave warnings and no working-entry writes; unchanged My Decks recency; latest-publication Library ordering before pagination and deterministic ties; ordinary SPA navigation/loading with account isolation, publication-only expiring highlight without scrolling (perfect first-frame order was explicitly withdrawn); plain collection-top returns for draft-only edits; removed Show newest/reveal contracts; distinct series/card attribution; no Library search/create controls; own/other series dropdown ordering, creation and retained hidden selection; accessible prerequisites preserving incomplete body/media; contextual validation; media/session regressions and normal mobile/keyboard operation.
- **Done when:** two creators can contribute to one series without edit-right leakage; all required drafts are recoverable; Library Decks behaviour is unchanged; real media and understandable publication feedback work.

Implementation checkpoints are **3A editor/persistence → 3B series/publication → 3C My Drafts/Library → 3D media → 3E combined acceptance**. Check each before proceeding. The local controller journals submitted commands, serialises captured save retries and recovers publications by consumed revision; no historical-publication UI/API is added. Local conflicts retain text and offer an explicitly confirmed reload of saved content. Native Back drains an outstanding actor-bound save. Upload cancellation retains the previous media; processing status is exact-owner-draft scoped. Viewer adapters preserve the consulted publication and default Phase 1 behaviour. See [Phase 3 handoff](phase-3/README.md) for evidence and operational limitations.

Full media acceptance remains gated on actual Cloudflare protection/CORS verification; mocked provider contracts are not live delivery evidence. Install indexes explicitly in the intended deployed database before exposing these routes. The disposable review runner creates its own indexes and test users; `--dev --lan --info-cards` serves the authenticated Next app on port 4181, with only the actual review hostnames allowed by Next's development-origin check. It is separate from the Phase 1 fixture on 4180.

### Phase 4 — Main attachments and production consultation

**Scope:** connect the approved title-modal attachment UI, ordinary main publication/adoption and the completed pouch. Preserve Phase 1 geometry/motion/positional numbering and Phase 3 SPA navigation. No deletion UI, detached-draft recovery UI, production content migration or new permission scheduler. The following checkpoint requirements are retained; the [Phase 4 handoff](phase-4/README.md) records their implementation, tests and deployment limitations.

#### 4A — Attachment persistence, every writer and reference safety

- Add optional ordered `infoCardIds` to `CardContent` and its strict validator. Reuse `infoReferences`/`sameInfoReferences` in `src/lib/infoCards/domain.ts`: absent and `[]` are semantically equal; actual ordering is significant. Wire this equality into main dirty/publication/fork/recovery comparisons, including generic `sameContent`/`isDeepStrictEqual` call sites. Do not normalise by rewriting historical publications or ignore unrelated empty fields.
- Audit **all canonical content writers** in `src/lib/cards/repository.ts`, not just Creator Save:

| Writer/path | Required treatment |
| --- | --- |
| `createPrivateGraph`, `createCardDraft` | Validate/guard complete incoming references; retain exact creation-retry semantics. |
| `saveCardDraft` | Revision precondition and same-transaction reference/access guard; private attachment eligibility is permitted in a draft, even with public main visibility intent. |
| `cardForkInSession` via card fork and combined deck fork | Preserve inherited references and attachment-only edits, ownership/fork rules and transaction guards. |
| `createDeckFork.newCards`, `createAndAttachCard` | Currently constrained to exact/default empty content; preserve this constraint. If full-content input is ever enabled, it must use the guarded path first. |
| `publishCard` immutable version insert | Check actual publication visibility against attached info publications before inserting. Public main publication cannot include private info. Preserve reference history. |
| `moveConstructionStep` | Two cloned main draft writes; retain each main card's attachments, not move them with its step. Since references are unchanged this need not add redundant guard writes; test the invariant. |

- Audit reference-only paths too: `copyOwnedCard` retains the same main ID, not copied info content; `saveDeckDraft` and `publishDeckInSession` pin already-published main versions; adoption changes personal version selection. Creator publish-and-leave publishes owned main drafts then the deck in separate operations, not an atomic graph publication. Keep its recovery behaviour. Private forking preserves attachments only when the actor can legitimately use them; public-source attachments are already required to be public. No implicit info publication/promotion.
- Reuse `guardReferences` with the **existing main transaction session**, not nested `withReferences` transactions. Gather affected info IDs across composite writes, sort guards before main/deck root guards, preserve stored creator order. Empty-reference paths need no info locks. Ensure required index readiness for nonempty reference writes, not only info APIs. The info `referenceRevision` remains separate from authoring revisions.
- Preserve the field through Creator `creatorBoardState.ts` column/editing state and both board conversions, `cardArchitectureAdapter.ts` (`creatorBoard`/`privateGraph`), coordinator `cardContent`, `forks.ts`, working `readModels.ts`, canonical `libraryProjection.ts`, and `components/decks/types.ts`/`presentation.ts` into the actual `FocusedCardView`. Explicit projections currently drop unknown fields; a spread in one adapter is insufficient. Preserve intro, steps, dates, media and personal progress.
- **Acceptance:** round-trip every writer/projection; attachment-only dirty/fork/publish; absent/empty no-op; title-only edits preserve attachments; move-step/copy/adoption retain correct lists; strict public/private checks through direct and composite workflows; retained draft/history deletion blockers and deterministic attach/delete races in both orders. Reuse the disposable replica set and existing transaction helper; no provider calls in retriable callbacks.

#### 4B — Approved attachment dropdown inside the existing modal

- **Approved follow-up:** derive public-only new-selection eligibility from either lane's permanent published-public state or desired public visibility. Foreign source roots are not the resulting fork's visibility. Filter the existing authorised catalogue without changing the dropdown; retain selected IDs and saveability, showing an existing-style contextual message naming only authorised private attachments. Reuse Creator publication-error presentation for `PRIVATE_INFO_BLOCKS_PUBLICATION` across direct Card/Deck and publish-and-leave paths. Do not change backend guards or block Deck-only publication of an older valid main publication.

- Reuse `CreatorEditModal`'s title Save/Cancel boundary and existing fork confirmations; attachments remain local until Save and autosave through the normal main lane. No changes to Info Card authoring or Library UI.
- **Implemented control:** `InfoSeriesSelector` and Creator visibility/mode controls use classic native selects. Native `<option>` rendering, especially iPhone pickers, cannot reliably express the required medium title plus smaller muted second line. No existing rich grouped listbox was found. `InfoCardAttachments` therefore uses one small local, non-editable button-triggered listbox with labelled My Cards/Other Cards groups and one scrollable options area, not a generic dropdown framework. Reuse `DeckMenu`'s outside/Escape/focus-restoration conventions, **not its action-menu role**. Support touch, arrow/Home/End navigation, Enter/Space selection, Escape dismissal, Tab, selected/disabled states, labelled groups and focus restoration. No search input/autocomplete or extra panel/control. Test within the existing non-native title modal; its current presentation wrapper is not evidence of a complete focus trap.
- **Implemented pagination approach:** consume existing authorised `GET /api/library/info-cards?offset=N&limit=50` pages without a search parameter, following `nextOffset` until complete, as the current series selector already does. Deduplicate by ID and keep server owner-first/latest-publication order within the two groups; ordinary dropdown scrolling, no Load more/search/filter UI. At current startup scale this is simpler than another endpoint or pagination interaction. It fetches catalogue DTOs, not media assets. Offset pages can shift during concurrent publication; this is a best-effort picker, with eligibility rechecked atomically on Save/publication, not a new cross-request snapshot system.
- Retain modal-selected IDs/metadata independently of catalogue pages. Existing exact-publication reads can hydrate authorised labels; a failed lookup must not clear the stored reference or disclose protected metadata. Catalogue refresh cannot reorder or discard the selected list. Final server validation remains authoritative. No new selected-item recovery controls are proposed; unresolved visible errors should use existing modal feedback.
- **Acceptance:** two-line hierarchy and correct owner attribution; grouped keyboard/touch selection; all pages consumed; selected references retained without catalogue membership; duplicate prevention, remove/reorder, Save/Cancel, foreign fork flow and stale access changes. Chromium accessibility/focus assertions plus limited actual-phone touch/VoiceOver judgement; no test can establish screen-reader speech solely from ARIA markup.

#### 4C — Main-context snapshots and the existing consultation lifecycle

**Implemented backend contract:** `GET /api/card-templates/[id]/info-cards`, authenticated and no-store, with `mode`, expected/displayed main version and working deck context. Do not accept a client list of info IDs as attachment authority.

- Working mode: validate actor-owned deck/card membership and effective composition; select the main version adopted in `cardsData`, not merely the deck's original main-version pin. `CardRepository.workingCard` already performs these checks with a session; extract/reuse its narrow context logic rather than add assessment behaviour to consultation. A stale expected version fails explicitly, not a silent substitution underneath an older displayed main card.
- Canonical mode: verify access to the exact immutable public main version shown by `libraryReadModels`/`CanonicalCardPresentation.version`. Library preview currently selects latest public main versions, which can differ from `cardVersionAtPublish` stored in the deck. Do not read attachments from a different root/latest/deck-pin version. An older still-displayed authorised public main version remains the consultation source.
- Obtain authorised main content and info latest publications in **one read-only Mongo transaction/session**. Exported resolvers that currently read without a session are not adequate merely because a subsequent info query starts a transaction. Existing snapshot transaction infrastructure suffices; no persisted consultation entity is required.

**Implemented response contract:**

```ts
{
  mainCardId: string,
  mainCardVersion: number,
  entries: Array<
    | { status: "available"; info: PublishedInfo }
    | { status: "unavailable" }
  >
}
```

`PublishedInfo` includes exact info ID/version/content/media/authorised attribution. Array positions exactly match the main version's ordered IDs; unavailable entries carry **no ID, title, series, owner or diagnostic reason**. Client keys can use main identity/version/position. Count includes all entries; a known list containing only unavailable entries still produces a pack. No references means no pouch/request. Invalid main context/auth or database/system failures are whole-request failures, not fake unavailable entries.

**Smallest partial-resolution change:** adapt `src/lib/infoCards/queries.ts`'s `publishedSnapshot` aggregation/join/decoration core. Its existing `rows.length === ordered.length` check makes it all-or-nothing. Add a positional read path over that same core; keep the strict wrapper for existing single-publication consumers and their API/error semantics. Query once in the supplied session, filter ACL before attribution, validate each joined publication's identity/version/visibility, series and renderable content using existing domain/capacity primitives, then map onto the original ID order. Missing/inaccessible or expected malformed row data yields a neutral slot. Do not fall back to older publications/drafts. Catch only expected per-item validation failures; DB, auth and unexpected programming failures remain request failures. No provider readiness calls in this read transaction. Real image/video delivery failure after resolution is handled inside the existing media viewer, not converted into a lost card. Strict writer guards remain unchanged.

**Implemented lifecycle:** extend `FocusedCardView`'s current consultation owner with pending/ready/failed states; immediately apply its existing suspension and input isolation even before cards are ready. Reuse the existing transparent consultation layer/dismiss surface rather than add an overlay. Do not mount `InfoCardPhysicalStack` with an empty collection; mount ready entries only, with a neutral same-geometry placeholder renderer. Retain the existing animations, selected position, nested-media freeze, focus rules and underlying mounted Step View/player/activity. Keep the closed pouch appearance in pending/failed states. Existing pouch/background/Escape dismissal is approved in both states.

**Implemented status placement:** `StepView.module.css` anchors the pouch at `left:0; bottom:0` in the existing footer; the surface and consultation alignment clip overflow. Status is a sibling of the clipped alignment in the **existing** consultation layer, just outside the main-card bounds near its lower-left corner. Actual measured bottom clearance chooses text below the card, or in the left gutter for short landscape. Controlled browser tests cover 390×844 portrait and 844/932×390 landscape bounds; the Phase 4 handoff records evidence and device limitations. Historical Phase 1A measurements are not proof of all viewports. No card dimension changes or status-on-placeholder treatment.

Start a one-second timer only for a still-pending request; success immediately clears status and starts opening, without an artificial wait. Whole-request failure uses the approved short error in the same area. Abort and invalidate responses/timers on actor/main/step change, unmount, cancellation or genuine close/reopen. Pin all response entries through browsing and nested media. A reversal of an unfinished return remains the existing consultation; only a genuinely new opening fetches latest/reset-first. Keep video paused after dismissal and discard stale results; never reset/remount or automatically resume it.

- **Acceptance:** adopted-main/actual-canonical version matrix; actor/context rejection and stale versions; exact ordered partial results including all-unavailable; corruption versus infrastructure failure; no metadata leaks; concurrent republication freezes successes and unavailable slots; next opening refreshes. Test fast/999ms/over-one-second loading, error, approved cancellation, late responses, account/step changes, unchanged video position and activity state, geometry/motion and positional numbering. Cancellation approval is recorded above.

#### 4D — Exact-publication media and permission integration

- Reuse the existing remote info-media adapter/player and delivery endpoint (§7.5), passing snapshot info ID/version and current actor. Closing nested media returns to the same slot. Fresh media grants must use that exact publication even after republication; private-era records remain private. Actor changes invalidate requests and close the consultation.
- No deck thumbnail preparation for info faces, no new grant cache/scheduler and no automatic midstream renewal. Document the existing one-hour long-pause limitation; reopening nested media refreshes its grant without fetching newer content. Keep media delivery failure separate from card resolution; do not remove/reorder slots.
- Preserve legacy-route provenance protections and both deployment gates (`NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA` and `INFO_CARDS_PRIVATE_MEDIA_VERIFIED`). Do not treat a configured flag or stubbed provider as live verification.
- **Acceptance:** exact-publication image/Stream requests, media reopening after republication, actor/private-era denial, legacy forged access, stale results and delivery errors retaining card/position. Test fresh grants against expired ones with existing contracts, not a new timer service. Live private-media delivery/CORS acceptance remains blocked until operator verification; text-only work and mocked contract tests can proceed.

#### 4E — Combined regression, deployment gates and handoff

- Real authenticated Next application and disposable replica-set tests, not only the Phase 1 fixture: full Creator add/remove/reorder/publish/adopt/fork, existing absent-field compatibility, stale editor recovery, all canonical writers and deterministic attach/delete races/transaction rollback. Deletion tests exercise existing backend APIs; **no deletion UI**.
- Extend real-component browser coverage for loading, partial slots, circular order/numbering, snapshot consistency during republication, nested media, video play/pending-play cancellation, activity input/scroll/mount preservation and gesture/focus isolation through transitions. Re-run relevant Creator, Library and My Decks regressions without changing their ordering/navigation. Automated deterministic workflows do not need manual repetition for acceptance.
- Limited actual-phone judgement: status placement, physical opening/closing/browsing, touch targets and screen-reader behaviour. Use Chromium automation; WebKit only where supported, with unavailable coverage reported. No virtual-iPhone infrastructure or browser repair programme.
- Before production enablement, explicitly deploy/inspect required indexes in the application database (unique roots/publications/series/media identities **and main draft/history reference indexes**), not just the disposable database. `assertIndexesReady(true)` now also verifies main draft/history reference indexes before nonempty attachment writes; disposable readiness is not evidence of deployed production setup. Do not deploy indexes to a live database without authorisation.
- **Done when:** two independent versioning timelines, privacy and concurrency invariants, approved partial/loading behaviour and unchanged Phase 1 interactions are demonstrated; necessary pending-dismissal approval is recorded; provider/index gates are verified or explicitly block the affected production acceptance. No saved draft, immutable history or personal progress is silently discarded/rewritten. Handoff records actual tests, manual gaps and operational evidence.

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
| 4 attachments/reference guards/live reads | Sol 6.1 / High (selected for implementation) | Existing transaction/reference primitives, a complete writer inventory and deterministic race/snapshot tests make this bounded integration suitable without a model escalation. Deletion UI is excluded. | Focused writer/security review and race tests; no duplicate implementation or automatic model escalation. |
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
| Prototype | Phases 1–3 implemented; Phase 4 integration evidence and limitations are recorded in its handoff. |
| Phase 4 loading/partial results | Visually closed pouch until ready, message after one second, ordered neutral unavailable slots, no extra controls. Pouch/background/Escape dismissal during pending/errors is approved. |
| Phase 4 deletion/media | Deletion UI deferred; backend guards unchanged. Reuse exact-publication media adapter; no new automatic renewal system. |

**No architectural obstacle requires 1B before 1C.** Card dimensions/capacity have 1A evidence; motion tuning remains a 1B output. Phone evidence requires access to the actual device; absent coverage must be reported. WebKit availability does not block progress.

## 12. Functional specification v0.3 reconciliation

The companion specification records the product baseline, Phase 3 corrections and the explicitly approved Phase 4 decisions. This table is reconciled with its current section numbers:

| Specification area | Reconciled behaviour |
| --- | --- |
| §§2–3 series | Stable creator-associated identity, per-creator duplicate prevention, independent contributions and attributed series selection. |
| §3.2 discovery | Current-public membership only; hidden empty/private-only foreign series, retained authorised selection. |
| §5.2 drafts | All owner info drafts independently accessible; published-dirty separation and clean Library access. |
| §§5.5–6 Library | Static catalogue; latest-publication pagination, own-first info grouping, no series headings/search/create controls; ordinary SPA returns. |
| §7 attachments | Non-searchable My Cards/Other Cards dropdown, approved two-line metadata with card-owner attribution for others; remove/reorder local until Save; normal main publishing/adoption. |
| §§3.3/4.2 face | Secondary series · primary title on one body-sized line; series tooltip; no face index/dots, thumbnail, scroll or truncation. Existing open-pouch positional number is distinct. |
| §8 publication/deletion | Stable open snapshots and ordered unavailable positions; all draft/history blockers; deletion UI deferred, backend rules unchanged. |
| §§9–11 interactions | Existing geometry/motion/isolation/state/media return; visually closed loading with delayed discreet status and whole-request error outside the main card. Pending/error dismissal unresolved. |
| §§12–13 scope | Wider recovery/accessibility and coordinated deletion UX deferred; separate coding authorisation. |

The original reconciliation predated the 1A reference-image correction. The approved images now govern composition, subject to later written overrides including the taller card and header hierarchy. Phase 1C preserves the corrected 1A presentation.

## 13. Deferred Improvements / Backlog Recommendations

These tasks are recommendations for later scheduling, not additions to Phase 1 or implicit implementation authorisation. Priorities are relative: P2 = worthwhile follow-up based on observed use; P3 = optional maintenance when evidence justifies it. Normal-viewport readability, new-interface focus/zoom access, correct series privacy, all info drafts and reference guards are required work and cannot be deferred under these entries.

### DRAFT-1 — Recover inaccessible detached main-card drafts

- **Problem:** `creatorDrafts.ts` discovers main drafts through effective owned deck compositions. Detached independent drafts can become inaccessible through UI while correctly blocking deletion of referenced info cards.
- **Why safe to defer:** drafts and references remain intact; deletion fails safely with accurate feedback. This rare usability limitation does not compromise publication integrity or info-draft access.
- **Acceptance criteria:** discover owned detached main drafts independently of deck membership; provide the smallest owner-only open/recover path after evaluating extraction of the existing title editor; preserve all unrelated steps/media/draft fields and revision preconditions; no automatic detach/discard/delete; cannot expose foreign private drafts; removing a draft-only attachment can clear that blocker, while historical references still block; reload and stale-tab cases tested. Reuse an ordinary deck editor link only when it genuinely reaches that draft.
- **Priority:** P2; schedule earlier if actual users encounter blocked deletion. No new route is included in the present implementation phases.

### DELETE-1 — Design coordinated content deletion controls

- **Problem:** Decks, main cards and Info Cards do not yet have a consistent deletion experience. Adding an isolated Info Card Delete control in Phase 4 would pre-empt that design.
- **Why safe to defer:** attachment removal is distinct and remains available; backend ownership, retained-draft/history guards and attach/delete concurrency protection continue to enforce safety without a UI.
- **Acceptance criteria:** agree a consistent owner-only deletion experience across content types before implementation; clearly distinguish detach/delete and recoverable drafts versus immutable-history blockers; never expose other creators' private metadata; retain publication/permanence rules, no silent draft deletion and tested concurrent reference protection. Any recovery link must reach a real authorised editor. No Delete button is included in Phase 4.
- **Priority:** P2, coordinated future design; not a Phase 4 acceptance dependency.

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

Historical 1A task retained below; it has since been implemented and visually refined. The current task authorises **Phase 4 checkpoints 4A–4E**, now recorded in the Phase 4 handoff. No prototype styling redesign, live index/provider deployment, commit or Phase 5 implementation is included.

**Recommended task:** “Info Cards Phase 1A — actual Step View footer geometry and static info-card capacity fixture.” Preferred model: **Sol 6.1, High thinking effort**, consistent with section 10. Geometry, scoped styling and meaningful browser measurement are a bounded coding task; device evidence matters more than escalating model effort. No independent second implementation is warranted for this checkpoint.

After explicit coding authorisation:

1. Read the relevant installed Next guides required by `AGENTS.md`. Extend the existing real-component fixture with temporary attributed info cards; keep fixture data out of production/API persistence.
2. Put the pouch in `StepView`'s actual footer using scoped styles, equal Previous/Next tracks and centred index. Render the actual scaled focused-card/Step View geometry, not a separately drawn mock footer. Keep zero-attachment behaviour covered.
3. Add the reusable minimalist `InfoCardFace`, including compact optional media affordance and the small series-attribution tooltip. A fixture control can switch to a **static** open-card placement for measurement; animation, circular browsing and playback integration arrive in 1B/1C.
4. Add focused Chromium geometry/content tests and record normal-viewport text fit with media/no media, realistic two-paragraph copy and long combined headers. Do not choose publication limits or add backend validation now. Report measurements, screenshots and exceptional-size observations.
5. Add opt-in LAN fixture access with the loopback default retained. Supply the exact local phone URL/instructions and collect user phone feedback; record manual coverage as pending until it happens.

**Reviewable output:** a working geometry/capacity fixture, scoped component changes and focused automated checks, with actual fit/fail samples and phone-access instructions. Checkpoint acceptance follows section 8's Phase 1A criteria; its evidence now resides in `phase-1a/`.
