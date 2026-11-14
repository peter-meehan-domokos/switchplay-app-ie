# Info Card Improvements — Engineering Plan

**Status:** Updated with approved decisions D0–D10, resolved questions Q1–Q7 and resolved points P1–P3 (12 November 2026), and R1 and C1–C4 (13 November 2026). Checkpoints 5–10 and 4.0–4.2 are implemented. Checkpoints 4.2b–4.4 and the Delete and Hide from Group terminology refinement are implemented. Checkpoints 4.5a–4.5c and the Atlas index installation (decisions V1–V7, 14 November 2026) are planned and await approval to start.
**Specification:** [Info Card Improvements — Product Specification and Engineering Planning Brief](../../../design/features/group-experience/info-cards-integration-spec.md)
**Branch:** `feat/group-experience`

This plan turns the specification into checkpoints. It keeps the specification's phase boundaries and numbering (checkpoints 5–10, then Phase 4). The approach is proportionate to an MVP with few trial users and no published Info Cards needing backward compatibility: no feature flags, no new services, no large refactors.

**Terminology** follows the specification exactly:

| Term | Meaning |
| --- | --- |
| *Personal Info Card* | A content type only |
| *Standalone* / *Group Experience* | Contexts |
| *Me* / *Group* / *Other followers* | Perspectives |
| *Follower* / *Admin* | Roles |
| *Group-created Personal Info Card* | A Personal Info Card created by a follower in a Group Experience context |
| *Group Admin Info Card* | An Info Card created by an admin in the Group perspective |
| *Admin contribution* / *Follower contribution* | Content created in the Group perspective / in Me. Separate identities, even for one dual-role user (P1, P3) |
| *Acting identity* | The identity a user acts as, set by the perspective they are in: Group perspective is the Admin identity; Me and the standalone Card are the Follower identity. Ownership is the author; permission to delete needs both author and matching acting identity (R1) |
| *Creation context* | Where an item was created: the standalone Card, Group A · Me or Group A · Group. Editing and permanent deletion happen only in that exact context (C1). For Group items it is the pair (`experienceId`, `creationContext`) stored on the record, which is the only authority |
| `creationContext` | The immutable field recording `"group"` (Admin contribution) or `"self"` (Follower contribution) |

**Decisions:**
- Approved decisions are in [section 6.1](#61-approved-decisions).
- Resolved questions and points, including R1, are in [section 6.2](#62-resolved-questions-and-points).

---

## 1. Current implementation assessment

### 1.1 Phase 1 — implemented, manually accepted and pushed

| Item | How it was done | Where |
| --- | --- | --- |
| 1. Merge `main` | Merged `origin/main` into the branch, reconciled conflicts, then independent review corrections and a merge handoff. | `6abeda4`, `4212690`, `0cb5ee5`, `20c7d67`; [merge handoff](merge-main-into-group-experience-HANDOFF.md) |
| 2. Decks and Creator recovery | Verified only. Creator upload recovery from `6176ce8` was confirmed present after the merge; its browser spec passes 4/4. | No new code |
| 3. Preview media uploads | Cloudflare R2 CORS policies for `path-assets` and `path-user-data` updated to add the stable Preview origin while keeping existing origins. | Cloudflare only; no Git change |
| 4. Personal Info Card creation and recovery | **Series dropdown:** the Personal editor uses an in-page listbox instead of a native `<select>`; the Creator editor keeps the native select. **Form fields:** the dialog focus-retention hook checked focus in a microtask, which stole focus back during a native tap; it now waits one task. **Upload recovery:** the chosen file is kept after failure, with Retry upload and Cancel upload; network failures are classified as transfer failures; leaving is blocked with an accurate message; stale messages are cleared. **Index:** the non-unique `users` index `cardsData.personalInfoCardIds_1` was installed in the shared Atlas database with `scripts/setup-info-cards.ts`. Readiness checks pass and a before/after snapshot showed no other change. | `d31edeb`, `13ab03a`; Atlas index |

### 1.2 Git state

- `feat/group-experience`: `13ab03a` is pushed.
- The first version of the specification and this plan was committed locally as `1424eb4`, not pushed.
- This revision is not yet committed.

### 1.3 Environment facts that affect every checkpoint

- Local development, Preview and production all use the same production Atlas database `switchplay` (`SWITCHPLAY_DATABASE_MODE=production` in `.env.local`). **Any write from a local dev server or phone is a production write.**
- Automated tests never touch Atlas. They run against disposable in-memory replica sets through `scripts/test-phase2.ts` (browser) and the `*.integration.ts` suites.
- Manual iPhone review of unfinished work should use the disposable review runner rather than `npm run dev`.

---

## 2. Architecture and dependencies

### 2.1 Info Card presentation

| Concern | Module | Notes |
| --- | --- | --- |
| Card face | [InfoCardFace.tsx](../../../../src/components/info-cards/InfoCardFace.tsx), [InfoCardFace.module.css](../../../../src/components/info-cards/InfoCardFace.module.css) | Fixed `height: 204px`, `padding: 12px 12px 60px`, `box-sizing: border-box`. Header is 33px (12px top padding, about 12px line, 9px gap); text area 109px; the footer reserve is 60px and holds the media button, creator credit (24px) and three-dot menu (32px). Creator colour is a `#303947 → #252d39` gradient; Personal is currently `#263b36`. The only type flag is `personal`. |
| Stack | [InfoCardPhysicalStack.tsx](../../../../src/components/info-cards/InfoCardPhysicalStack.tsx) | Renders up to **two generic backing strips** (`stepStyles.backing`, flat `#2c3543`) whatever the upcoming cards are, plus only the current card and, during a turn, the next card. |
| Step View geometry | [StepView.module.css](../../../../src/components/decks/StepView.module.css) | `.preview` places the stack at `left/right: 6px; bottom: 15px`; `.backing` offsets are −3px and −6px. |
| Consultation dialog | [InfoCardConsultation.tsx](../../../../src/components/info-cards/InfoCardConsultation.tsx) | Full-screen transparent native modal. The empty state is a full card-sized `.empty` box (240 × 204) with a "+" button and a × Close button. Opening and closing animations live in `InfoCardPhysicalStack`. |
| Pouch | [InfoCardPouch.tsx](../../../../src/components/info-cards/InfoCardPouch.tsx) | Shown with zero cards only when `allowEmpty`. |
| Focus handling | [useInfoCardDialog.ts](../../../../src/components/info-cards/useInfoCardDialog.ts) | Shared by both editors, the consultation and the media viewer; fixed in Phase 1. |

### 2.2 Info Card content and capacity

- **New Info Cards are always maths-format** (`bodyFormat: "latex-v1"`): the editor controller sets it for every new card. The plain-text path survives only for legacy test cards.
- **Maths cards** render through the shared [MathsRenderer](../../../../src/components/maths-renderer/MathsRenderer.tsx), using the parser in [parseContent.ts](../../../../src/components/maths-renderer/parseContent.ts).
  - Fit is measured in the browser by [infoCardMaths.ts](../../../../src/components/info-cards/infoCardMaths.ts) against the header and the footer's top edge.
  - The server's Chromium rendering check mounts the **same `InfoCardFace`** through [/internal/info-maths](../../../../src/app/internal/info-maths/Host.tsx), so face changes reach the server check automatically.
  - At publish, the server runs only a syntax check (`prepareContent`).
- **Legacy plain-text cards** are measured by the server-side model in [capacity.ts](../../../../src/lib/infoCards/capacity.ts), using fixed constants (`innerHeight: 131`, `mediaHeight: 36`, …) derived from the 204px face.
- **Renderer behaviour relevant to checkpoint 9:**
  - Display maths is forced to `text-align: left` with a 1em indent.
  - Any run of blank lines is collapsed into one paragraph break: `split(/\n[ \t]*\n(?:[ \t]*\n)*/)`.
  - Info Cards are its only production consumer; `/dev/maths-renderer` and `/dev/maths-fonts` also use it. D4 forbids changing it.

### 2.3 Info Card media and publishing

- **Editor and controller:** [InfoCardEditor.tsx](../../../../src/components/info-cards/InfoCardEditor.tsx) and [infoCardEditorController.ts](../../../../src/components/info-cards/infoCardEditorController.ts).
  - Autosave is debounced at 250ms.
  - `ensureCreated` → `PATCH` drafts → `publish` (Creator) or `save` (Personal).
  - A `sessionStorage` journal records submitted commands for recovery.
- **Upload:** [infoCardUpload.ts](../../../../src/components/info-cards/infoCardUpload.ts). Images use a presigned R2 PUT; videos use a Cloudflare Stream direct upload. Info video items do not reliably store `width`/`height`.
- **Video status:** [useInfoVideoStatus.ts](../../../../src/components/info-cards/useInfoVideoStatus.ts) polls `GET /api/info-cards/:id/media/status` every 2s while processing.
- **Media section today:** up to eight independently conditional elements:
  - a file input, or a disabled placeholder button;
  - an "Image attached" or "Video attached" line;
  - an uploading status;
  - Retry upload, Cancel upload and Remove media buttons;
  - an upload error;
  - a video status, plus a video error.
- **Publish:** `publishVersion` in [repository.ts](../../../../src/lib/infoCards/repository.ts) calls `mediaSecurity.assertReady` **before** publishing.
  - Stream video must be `readyToStream`; otherwise `INFO_MEDIA_NOT_READY_OR_UNPROTECTED`.
  - R2 images are verified immediately, so only **video** can be "still processing".
  - A `sourceRevision` receipt makes a repeated publish of the same revision return the existing version rather than create another.
- **Background mechanisms:** none. There are no Stream webhooks, no Vercel cron jobs and no queues, and Q7 keeps it that way.

### 2.4 Info Card attachment viewer (portrait video bars)

- Tapping an Info Card's video opens [InfoCardMediaViewer.tsx](../../../../src/components/info-cards/InfoCardMediaViewer.tsx), a full-screen dialog. Remote publications open through [InfoCardRemoteMediaViewer.tsx](../../../../src/components/info-cards/InfoCardRemoteMediaViewer.tsx).
- The video is wrapped in `mediaStyles.videoArea` from [CardMediaViewer.module.css](../../../../src/components/media/CardMediaViewer.module.css). The player shell is stretched to `width: 100%; height: 100%` with `object-fit: contain`.
- The shared player (`.cloudflare-stream-player` in `globals.css`) has a near-black background `#05070a`.
- **Cause, by inspection:** a portrait video is contained inside a box the size of the whole viewer. On an iPhone the viewer is taller relative to its width than a 9:16 video, so the remaining height is painted near-black above and below.

### 2.5 Group media items: the canonical reference (Q1)

Media items are the **only** reference for Info Card behaviour in Group Experiences. Reflections are not used. The approved storage design is [Group Experience engineering plan](group-experience-engineering-plan.md) §11 and §11.1 ("Option B"). The tables below describe the code **as it is today**. Phase 4 reproduces it **as corrected by checkpoint 4.0** (section 2.6), which removes Admin contributions from owner history and Other followers views.

**Storage:**

| Item | Where | Code |
| --- | --- | --- |
| Standalone media item | `users.cardsData[].mediaItems` (CardData) | existing personal media |
| Group-created media item (follower in Me, or admin in Group perspective) | `groupMediaContributions`: one author-owned record per item with `authorUserId`, immutable `experienceId` + `cardTemplateId` origin, `groupVisible` (default `true`) and `state` `pending`/`attached`/`deleted`. Never copied into CardData. | [media/model.ts](../../../../src/lib/groupExperiences/media/model.ts), [media/repository.ts](../../../../src/lib/groupExperiences/media/repository.ts) |
| Indexes | `group_media_owner_history` (author, Card, state, date) and `group_media_shared_history` (experience, Card, state, `groupVisible`, date) | [media/indexes.ts](../../../../src/lib/groupExperiences/media/indexes.ts) |

There is **no Group-owned media item**. Media added by an admin from the Group perspective is a Group-origin contribution authored by that admin.

**Who can add (`memberMediaCapabilities` in [mediaCollection/permissions.ts](../../../../src/lib/mediaCollection/permissions.ts)):**
- In the Group perspective, only admins (`canUpload = isAdmin`).
- In Me, the active follower themselves.
- Never while viewing another follower.

**Visibility (`authorized` and `groupAuthority` in the media repository; feeds in [media/reads.ts](../../../../src/lib/groupExperiences/media/reads.ts)):**

| Perspective | Media items shown |
| --- | --- |
| Standalone context | The owner's standalone items plus **all** their Group-created items for that Card, from every Group, unlabelled |
| Me | The owner's whole history for that Card. Anything not currently shared with this Group (standalone items, items from other Groups, items hidden here) is marked **private** with the existing subdued date-lock glyph |
| Group | Every contribution originating in this Group with `groupVisible: true`, from any author, including former members |
| Other followers | Only that follower's contributions originating in this Group with `groupVisible: true`. Allowed when the viewer is an admin or the Group has `allowFollowerInspection` (`canInspectPeers` in [policy.ts](../../../../src/lib/groupExperiences/policy.ts)) |

**Permissions before checkpoint 4.0 (`mediaRemoveOperation`, `hide` and `delete`; deletion is changed by checkpoint 4.0 under R1 and by checkpoint 4.2b under C1):**

| Operation | Who | Notes |
| --- | --- | --- |
| Delete | The author only, as a tombstone, with best-effort provider cleanup | In a Group view, only for items originating in that exact Group. Standalone and other-Group items are read-only there. From the standalone context the author can delete any of their own items. |
| Hide from this Group | Current admins only | Applies to any author's item originating in this Group, including other admins' items. It sets `groupVisible: false` and never deletes. The author still sees the item, marked private. |
| Membership and role changes | — | The author keeps ownership and delete rights after leaving. Their visible items stay in the Group feed. Losing the admin role ends the right to hide. |
| Editing | — | No equivalent: media items are immutable. |

**Attribution:** each item carries `authorUserId` and its origin. The media gallery shows "By: *username*" and the origin name (Group name or "Personal").

### 2.6 Group media contribution identity: the P1 gap and its correction

**Why Admin media leaks today.** The server never records where a contribution was created, and every owner-history read selects by author and Card only:

| Read | Code | Filter today | Used by |
| --- | --- | --- | --- |
| Owner history page | `readOwnerMediaPage` in [ownerHistory.ts](../../../../src/lib/mediaCollection/ownerHistory.ts) (`baseGroup`) | `{ authorUserId, cardTemplateId, state: "attached" }` | `/api/media/history`: the standalone Media Centre (no `experienceId`) and Me (with `experienceId`, marking other origins private) |
| Owner previews and counts | `ownerPreviewPages` in [preparation.ts](../../../../src/lib/mediaCollection/preparation.ts) | the same | Card media previews and counts |
| Owner feed | `readMediaPage` owner branch in [reads.ts](../../../../src/lib/groupExperiences/media/reads.ts) | `{ authorUserId, cardTemplateId, state }` | `GET /api/group-media` (no UI client today) |

- The upload command (`allocationCommand` in [media/contracts.ts](../../../../src/lib/groupExperiences/media/contracts.ts)) carries no perspective.
- `creationAuthority` in [media/repository.ts](../../../../src/lib/groupExperiences/media/repository.ts) checks only Group membership.
- The rule that only admins upload in the Group perspective and only the follower uploads in Me exists only in the client (`memberMediaCapabilities`).
- A dual-role user's perspective cannot be derived from stored data, so a field is required.

**Is `creationContext` plus owner-history filtering sufficient for separate identities?** It fixes listing, but not on its own. Every place that compares `authorUserId` with the viewer must also compare the identity:

| Place | Code | Problem without an identity check |
| --- | --- | --- |
| Owner-history listing | the three reads above | Admin contributions appear on the standalone Card and in Me (P1 itself). |
| Other followers views | `subjectPreviewPages` in `preparation.ts`; `groupFeed` with `subjectUserId` (`readMediaPage`) | Viewing a dual-role user as a follower shows their Admin contributions as theirs. |
| Delete offered in the UI | `mediaRemoveOperation` in [permissions.ts](../../../../src/lib/mediaCollection/permissions.ts) | In the Group perspective, a dual-role user is offered Delete on their own Follower contributions (author equals viewer). That lets the Admin identity delete the Follower identity's content. |
| Delete enforced on the server | `delete` in `media/repository.ts`, reached through `/api/group-experiences/:id/media/:contributionId`, which both Me and the Group perspective call | Checks only author and originating Group, so it cannot tell which identity is acting. |
| "Own" management count | `readMediaPage` group branch (`canManage`); the `own` sum in `sharedPreviewPages` | Counts both identities' contributions as the viewer's own. |

**Unaffected:**
- **Group feed visibility** (`groupFeed` without a subject, `sharedPreviewPages`): it filters by `experienceId` and `groupVisible`, so Admin and Follower contributions of this Group both appear, each as its own item.
- **Hiding** (`hide`): any current admin may hide any contribution of this Group. That is consistent with two users.
- **Private icon:** computed in `readOwnerMediaPage` and `ownerPreviewPages` as "other origin or hidden". Its meaning is unchanged; Admin contributions simply never reach those reads.
- **Id-based owner access** (`authorized` with `kind: "owner"`): used for upload status polling and upload cancel (`GroupMediaUpload` in [operations.ts](../../../../src/lib/mediaCollection/operations.ts) calls `/api/group-media/:id`). It must keep working for the author's own items whatever their identity. It lists nothing, so it causes no cross-context visibility, and it is left unchanged.
- **Role changes:** every role change increments the member's `accessEpoch` ([management.ts](../../../../src/lib/groupExperiences/management.ts), `repository.ts`). An in-flight upload whose role changes fails its commit, so `creationContext` always matches the role held at creation.

**Existing records (read-only check, re-verified 12 November 2026):** 14 contributions. 12 are deleted (all by admin-only users) and excluded from every read. 2 are attached, both by follower-only users whose current `accessEpoch` equals the epoch stored at upload, so their role is unchanged since creation and both were created in Me. Treating a missing `creationContext` as `"self"` is therefore evidence-based. No migration is needed.

**Indexes:** none needed. `group_media_owner_history` still drives the owner queries, and the extra condition is evaluated on rows already narrowed by author and Card.

**Known limitations (accepted, not engineered around):** Admin contributions are reachable only through their originating Group perspective. An Admin contribution hidden by another admin is visible to nobody, its author included. An admin who leaves the Group, or can no longer view its Group perspective, cannot reach or delete their Admin contributions. There is no private Admin view, no owner-only route and no change to private-icon semantics. See [section 9](#9-future-work).

### 2.7 Group Experiences and Info Cards today

- Group Cards are `ExperienceCardPresentation` (`surface: "experience"`).
- In `FocusedCardView`, `personalEnabled` requires `hasPersonalCard(card)`, which is false for any presentation with a `surface`. **Personal Info Cards are absent in every Group perspective today.**
- Group Cards carry canonical `infoCardIds`, and the consultation requests them in canonical mode, so Creator Info Cards are expected to appear in Groups. No Group browser test covers this.
- **Server:** `createPersonal` and the first `savePersonal` validate only a standalone Deck context (`consultationCardVersion(..., { mode: "working", … })`, which requires the user's own Deck membership). Standalone attachment is `users.cardsData[].personalInfoCardIds` per `cardTemplateId`.
- **Withdrawn earlier design:** the earlier Group plan §11.3 and Phases 8–9 designed an audience-based Group Info Card model. None of it is implemented, and Q6 withdraws it.

### 2.8 Project conventions applied

- **Layout pipeline rule** ([.claude/CLAUDE.md](../../../../.claude/CLAUDE.md)): new presentational logic goes into small pure `*Layout.ts` modules with `build…Layout` functions. Existing components are not refactored beyond the checkpoint's scope.
- Immutable data, D3 where aggregation is needed, no in-place mutation.

---

## 3. Checkpoint-by-checkpoint plan

Every checkpoint follows the execution strategy in [section 8](#8-execution-strategy).

### Phase 2 — Improve the Info Card experience

#### Checkpoint 5 — Card dimensions, stack and colours

**Approach:**

1. **Type and colour.** Introduce one Info Card type, `"creator" | "personal" | "groupAdmin"`, derived from existing data. Today that is the `personal` flag; `groupAdmin` arrives in Phase 4.
   - Add `infoCardTypeLayout.ts` with `buildInfoCardTypeLayout(type)`. It returns the face class, strip colour and type label.
   - Colours as specified:
     - Creator keeps the slate gradient.
     - Personal changes from `#263b36` to `#305047`.
     - Group Admin is `#147D6C`, with all face text white `#FFFFFF`, including secondary text.
   - Measured contrast: light text `#c9d0da` on `#305047` is 5.7:1; white on `#147D6C` is 5.0:1. Both pass WCAG AA for the 8.8–9.5px card text. Tinted secondary text on teal (for example `#d9f2ec`, 4.3:1) would fail, so it is not used.
   - **Type indication:** add a short type label to the focused card's footer. The wording is settled in the visual review. Strips are too small for text, so colour is a supplementary cue there.
2. **Strips.** Add `infoCardStackLayout.ts` with `buildInfoCardStackLayout(cards, index)`.
   - It returns up to **four** upcoming cards (wrapping, excluding the current one) as strips `{ id, type, offsetY, inset }`, each revealing about **5px**.
   - `InfoCardPhysicalStack` renders these instead of the two generic `backing` divs.
   - Turn, drag, open and close keyframes are unchanged; the existing "settle" nudge applies to every strip.
   - The strips sit in existing space above the card, so the Step View does not grow.
3. **Dimensions (D1).** Header 33px (unchanged), text area 93px, footer 45px, overall about 173px, width 240px.
   - Re-lay out the footer in 45px: media button, type label, credit and three-dot menu. The menu keeps its 32px tap target.
   - Update `capacity.ts` geometry (`innerHeight`) to the new text area. No compatibility is kept for legacy test content.
   - Maths measurement reads the footer's top edge, so it, and therefore the server Chromium check, follows automatically. So does the editor preview, which uses the same face.
4. **Visual review.** Before committing, take Chromium and WebKit screenshots at 390 × 844 of a mixed stack: Creator and Personal cards, plus a Group Admin fixture card.

**Likely files:**
- `InfoCardPhysicalStack.tsx` and `.module.css`
- `InfoCardFace.tsx` and `.module.css`
- new `infoCardStackLayout.ts` and `infoCardTypeLayout.ts`
- `StepView.module.css`
- `capacity.ts`
- `InfoCardConsultation.module.css` (`.empty` height until checkpoint 6)

**Acceptance:**
- A stack of three Creator and two Personal cards shows four strips in order, each in its card's colour.
- Strips update while browsing. A one-card stack shows none; a three-card stack shows two.
- The focused card shows its type label.
- Card dimensions match the targets.
- Interaction and animation are unchanged.
- No vertical scrolling at 390 × 844 or in short landscape.

**Tests:**
- Unit tests: `buildInfoCardStackLayout` (order, wrap-around, counts 1, 2, 5 or more, unavailable cards, all three types) and `buildInfoCardTypeLayout`.
- Update `info-cards-capacity.test.ts` to the new geometry.
- Update geometry assertions in `info-card-consultation.browser.ts` and `personal-info-cards.browser.ts`.
- Run `info-maths.browser.ts` and `info-maths-performance.browser.ts`.

**iPhone checks:** strip legibility and colours, card height, text contrast, type label, swipe feel.

#### Checkpoint 6 — Empty pouch

**Approach:**
- Replace the card-sized `.empty` box in `InfoCardConsultation` with a small panel containing **Add Personal Info Card**.
- **Animation (D2):** the panel animates out of the pouch using the **same opening sequence as the stack**: the hidden pouch position, 12° rotation and the 0.48s two-stage ease, with reduced-motion handling. Extract that geometry and sequence from `InfoCardPhysicalStack` into a small shared helper so the two cannot drift. The close animation reverses it.
- There is no × button. The existing `dismissSurface` closes on an outside tap, and Escape keeps working.
- The action calls the existing `edit()`.
- **After the first save:** the new card opens as the focused card. The post-save refresh already selects the saved card; the change is that the stack replaces the panel with its normal opening animation.
- Focus containment, the pouch toggle and editor return focus are reused unchanged.

**Likely files:**
- `InfoCardConsultation.tsx` and `.module.css`
- `InfoCardPhysicalStack.tsx` (extract the opening animation)
- new small `infoCardPouchMotion.ts` helper

**Acceptance:**
- An empty pouch tap animates the compact panel out of the pouch: no empty card and no Close button.
- An outside tap or Escape dismisses it.
- The action opens the existing editor.
- After the first save, that card is focused in the stack.
- Pouches with cards are unchanged.

**Tests:**
- Update "empty pouch creates a private note…" and "last Remove shows the true empty plus…" in `personal-info-cards.browser.ts`.
- Add Chromium and WebKit touch tests for the open animation phase, outside-tap dismissal, the action, and focus after the first save.

**iPhone checks:** animation feel compared with the stack opening, panel size, tap target, dismissal.

#### Checkpoint 7 — Media attachment UI

**Approach:**
- Add `infoCardMediaLayout.ts` with `buildInfoCardMediaLayout({ mediaItem, uploading, failedFile, uploadError, videoStatus, ready, pendingPublication })`. It returns exactly one state plus its permitted actions:

  | State | Message (draft wording) | Actions |
  | --- | --- | --- |
  | `unavailable` | Choose a series and title first. | none |
  | `empty` | Add an image or video (optional). | Choose file |
  | `uploading` | Uploading… your text keeps saving. | Cancel |
  | `processing` | Video processing (n%) | Replace, Remove |
  | `ready` | Image attached / Video ready | View, Replace, Remove |
  | `failed-upload` | Upload failed. Your text is saved. | Retry, Choose another, Cancel |
  | `failed-processing` | The video could not be processed. | Choose another, Remove |

  The `pendingPublication` input is used from checkpoint 10 onwards.
- Replace the editor's media `<section>` with one `InfoCardMediaArea` component that renders the layout. It reuses `UploadIcon`, `uploadInfoCardMedia`, `useInfoVideoStatus` and the Phase 1 `chooseMedia`, `cancelUpload` and `failedFile` logic. **No new upload system.**
- The Step-media components (`CreatorMediaUploadSlot`, `UserCardMediaUploadPanel`) are bound to other pipelines; only their visual patterns are reused.
- Keep the `infoCardErrors.ts` mapping and add friendly processing messages. Technical codes are never shown.
- **Scope:** both Info Card editors (same component). Step media, Deck introductions and user Card media are untouched.

**Likely files:** `InfoCardEditor.tsx`, new `InfoCardMediaArea.tsx` and `infoCardMediaLayout.ts`, `InfoCardEditor.module.css`, `infoCardErrors.ts`.

**Acceptance:**
- One media area: never conflicting messages, never duplicate controls.
- Every state is reachable and shows only its actions.
- Phase 1 recovery is preserved.
- Text is preserved through every failure.

**Tests:**
- Unit tests for every state and these transitions:
  - ready → replace → uploading → failed → retry → ready;
  - remove during processing.
- Update the Phase 1 failure and retry browser tests to the new labels.
- Add a processing-state test using mocked Stream status.
- Run `creator-upload-recovery.browser.ts`, `info-cards-authoring.browser.ts` and `info-card-upload.test.ts`.

**iPhone checks:**
- Photo library and camera.
- Airplane-mode failure, then Retry.
- Replace and remove.
- A real video through processing on Preview (the harness mocks Stream).

#### Checkpoint 8 — Portrait video borders (Info Card attachment viewer)

**Approach (straightforward; no repeat investigation):**
- In `InfoCardMediaViewer` only, size the video area to the video's own aspect ratio and centre it, instead of stretching the player over the whole viewer.
  - The ratio comes from the media item's stored `width`/`height` when present.
  - Otherwise it comes from the `<video>` element's `videoWidth`/`videoHeight` on `loadedmetadata`.
  - The box is limited by the viewer's width and height, so it never crops.
- The change is an Info-viewer-scoped wrapper and CSS module rule. `CloudflareHlsVideoPlayer`, `CardMediaViewer.module.css` and `globals.css` are not changed.
- **Fallback (D3):** if this proves not straightforward, stop and defer to the separate media-presentation task below. Do not alter shared video infrastructure.

**Likely files:** `InfoCardMediaViewer.tsx`, `InfoCardConsultation.module.css` (viewer rules).

**Acceptance:**
- A portrait Info Card video fills its height with no near-black bands above or below.
- Its ratio is preserved and nothing is cropped.
- Landscape Info Card videos and images are unchanged.
- Step, Card-introduction and Deck-introduction videos are unchanged.

**Tests:**
- Browser geometry test: with a mocked portrait and a mocked landscape video in the viewer at 390 × 844, the player box ratio equals the video ratio.
- Run `info-card-consultation.browser.ts`, `step-multimedia.browser.ts` and `video-source-transition.spec.ts`.

**If deferred, record a separate media-presentation task covering:**
- black bars above and below Info Card portrait videos in the attachment viewer;
- unwanted borders to the left and right of images elsewhere in the application.

#### Checkpoint 9 — Info Card formatting

All changes stay in the Info Card layer (D4). The shared maths renderer is not modified.

**Display maths:**
- Info-scoped overrides in `InfoCardMaths.module.css` cancel the renderer's forced `text-align: left` and 1em indent inside Info Card faces.
- KaTeX's own `.katex-display` centring and alignment (including `aligned` environments) then apply across a full-width container.

**Alignment tags and blank lines:**
- Add `infoCardContentLayout.ts` with `buildInfoCardContentLayout(body)`, which:
  - splits the source into segments `{ source, centre, vCentre }` on `[[centre]]…[[/centre]]` and `[[v-centre]]…[[/v-centre]]`;
  - interprets nesting and combining consistently in either order;
  - converts extra blank lines into explicit spacer segments, because the renderer collapses them;
  - reports unmatched or malformed tags as editor diagnostics, never silently dropping text;
  - ignores tags inside maths delimiters.
- `InfoCardFace` renders one `MathsRenderer` per segment inside a column body, with spacers between:
  - `centre` segments get `text-align: center`;
  - a `vCentre` segment is a flex item that takes the free space in the body area (between header and footer, already excluding the media button and fixed elements) and centres within it.
- `infoMathsMeasurement` combines per-segment results: safe only if every segment is safe and the stacked content fits the same body box.
- Untagged content renders as now: left-aligned, with existing spacing.
- **Legacy plain-text test cards:** normal rendering is preserved and no new syntax is added.

**Server:** publish syntax validation runs on the tag-stripped segments, so tags never reach KaTeX as text. The Chromium rendering check inherits the change through `InfoCardFace`.

**Likely files:**
- `InfoCardFace.tsx` and `.module.css`
- `InfoCardMaths.module.css`
- `infoCardMaths.ts`
- new `infoCardContentLayout.ts`
- `repository.ts` (segment validation)
- `InfoCardEditor.tsx` (diagnostics)

**Acceptance:**
- Display maths centres per KaTeX.
- Untagged text stays left-aligned.
- `centre`, `v-centre` and both combined behave as specified, with and without media.
- Intentional blank lines are preserved.
- Nothing overflows or overlaps fixed elements.
- Cards, Steps and Decks are unaffected.

**Tests:**
- Unit tests for the content layout: nesting, combining, unmatched tags, tags inside maths, blank-line runs.
- Browser geometry and screenshot tests in `info-maths.browser.ts`.
- Run `tests/maths-renderer` unchanged, to prove the renderer is untouched.
- Run `info-maths-trusted.test.ts` and `info-maths-performance.browser.ts`.

**iPhone checks:** centred, vertically centred and blank-line examples, with and without media.

### Phase 3 — Improve publishing

#### Checkpoint 10 — Automatic publication

One persisted pending-request mechanism serves Creator **Publish** and Personal **Save**, in every context, for scenarios A–E of the specification (Q7). There is no background infrastructure: no cron, webhooks, queues or workers.

**Mechanism:**

1. **Request.** Publish or Save always calls the existing `publish`/`save` route.
   - The server runs every check except media readiness, then calls `assertReady`.
   - **Ready (scenario A):** it publishes as today.
   - **Still processing:** it stores `pendingPublication: { revision, requestedAt, context? }` on the `infoCards` root and returns `202 { status: "pending" }`. `context` holds a standalone Personal first-save context.

   The field is optional; missing means none. No index and no migration.
2. **Completion.** One shared `completePendingPublication(actor, id)` helper in `repository.ts`:
   - checks readiness;
   - if ready, publishes through the existing `publishVersion` and clears the intent;
   - if failed, clears the intent and records `lastPublicationFailure: { revision, at }` for an accurate failure state (scenario D);
   - if still processing, does nothing.

   The `sourceRevision` receipt plus a conditional clear (`pendingPublication.revision` must match) means repeated or concurrent checks create **at most one** version. For a standalone Personal first save, it reads the user's current `personalInfoRevision` itself.
3. **Stays open (B).** The existing `useInfoVideoStatus` poll calls the media-status route, which runs the helper. The editor shows the pending state in the media area (checkpoint 7), then a confirmation or the named failure with Retry and Choose another file.
4. **Leaves and returns (C).** Leaving the editor is no longer blocked by pending media. The helper runs, bounded to the user's own pending cards, when they open the relevant interfaces:
   - the Info Card editor;
   - My Drafts;
   - the Creator Info list;
   - the Info Card consultation (pouch) for that Card.

   Each shows "Publishing when the video is ready", then a confirmation or failure.
5. **Edit cancels (E).** Any draft save of a newer revision clears `pendingPublication`. The user presses again after editing.

**Obvious limitations (stated, not engineered around):**
- If the user never returns to one of those interfaces, the card stays unpublished, with the request kept.
- Other users see the previous published version, or nothing, until the owner returns.
- These are accepted under Q7.

**Likely files:**
- `repository.ts`, `model.ts`
- the `publish`, `save` and `media/status` routes
- `infoCardEditorController.ts`, `InfoCardEditor.tsx`, `infoCardMediaLayout.ts`
- the My Drafts entry loader, the consultation snapshot route

**Acceptance:**
- Scenarios A–E behave as specified, identically for Publish and Save.
- Duplicate or concurrent completions produce exactly one version.
- Failure never publishes and keeps the draft or previous version.

**Tests:**
- Integration tests with the injected `InfoMediaSecurity`, covering:
  - ready → immediate publication;
  - processing → intent recorded;
  - ready → one completion;
  - concurrent completions → one version;
  - failure → cleared, failure recorded, nothing published;
  - an edit cancels the intent;
  - standalone Personal first save with a changed `personalInfoRevision`.
- Browser test with mocked Stream status: press while processing, see pending, then the confirmation. Also leave and reopen the editor, and see the completion.
- Run the `info-cards-release` and `personal-info-cards` suites.

**iPhone and Preview checks:**
- A real video: press, wait.
- Press, close Safari, reopen the Creator or the pouch.
- A failed or rejected video.

### Phase 4 — Info Cards within Group Experiences

Phase 4 first corrects Group media to the contribution-identity rules (checkpoint 4.0). It then reproduces the corrected media-item behaviour for Info Cards. It is **not** based on reflections and has **no** audience system (Q1, Q6).

**Confirmed requirements:**
- Standalone Personal Info Cards stay on CardData (D8).
- Group-created Personal Info Cards are Follower contributions; Group Admin Info Cards are Admin contributions. Neither is stored in CardData (Q1, P3).
- A dual-role user's Admin and Follower contributions are separate identities in storage, history, visibility, editing, deletion and presentation (P1).
- Follower contributions keep cross-context owner history. Admin contributions appear only in their originating Group perspective (P1, Q3).
- Only the original author edits or deletes, and only in the exact context where the item was created: the standalone Card, Group A · Me or Group A · Group (P2, R1, refined by C1 in checkpoint 4.2b). Admins hide.
- Colours are the same in every context and perspective (D10).

#### Checkpoint 4.0 — Group media contribution identity correction

A small, independent correction of existing Group media, with its own tests and commit, before any Info Card work. Section 2.6 has the evidence.

**Changes:**
1. **Record the identity.**
   - Add `creationContext: "self" | "group"` to `allocationCommand` (`media/contracts.ts`) and `GroupMediaRecord` (`media/model.ts`), and store it in `allocate` (`media/repository.ts`). It is part of the existing `operationHash`, so a retry cannot change it.
   - In `creationAuthority`, accept `"group"` only from a current admin and `"self"` only from an active follower. This is server enforcement of the rule the client already applies.
   - The client sends it from the upload context: Me sends `"self"`, the Group perspective sends `"group"` (`GroupUploadContext` and `GroupMediaUpload` in `mediaCollection/operations.ts`, set by `CardMediaCentre` / `GroupExperienceDeck`).
   - A missing value reads as `"self"` (section 2.6 evidence).
2. **One shared identity module.** Add `src/lib/groupExperiences/media/contributionIdentity.ts` with:
   - the follower-history filter (`creationContext` is not `"group"`, missing counting as `"self"`);
   - `viewerIdentity(perspective)`: Group perspective gives `"group"`; Me and standalone give `"self"`;
   - `sameIdentity(item, viewerUserId, identity)`.

   Every read and permission below uses it, so the rule lives in one place.
3. **Owner history excludes Admin contributions:**
   - `baseGroup` in `readOwnerMediaPage`, which also corrects its totals and paging counts;
   - the group match in `ownerPreviewPages`;
   - the owner branch of `readMediaPage`.
4. **Other followers views exclude Admin contributions:** `subjectPreviewPages`, and `readMediaPage` when `subjectUserId` is set.
5. **Deletion respects the acting identity (R1).**

   | Contribution | Delete allowed from | Server check |
   | --- | --- | --- |
   | Admin contribution (`"group"`) | The Group perspective of its originating Group | Group-context delete with acting perspective `"group"`; author matches; `row.experienceId` matches |
   | Follower contribution (`"self"`) | Me or the standalone Card | Group-context delete with acting perspective `"self"`, or the owner route; author matches |
   | Another author's contribution | Nowhere (admins may only hide) | Rejected |

   - `mediaRemoveOperation` uses `viewerIdentity` and `sameIdentity` from `contributionIdentity.ts`. Delete is offered only when the viewer is the author **and** the acting identity matches.
   - Follower-only users therefore lose Delete in the Group perspective and keep it in Me and on the standalone Card. A dual-role user is never offered a cross-identity Delete.
   - The Group-context delete command (`/api/group-experiences/:id/media/:contributionId` DELETE) carries the acting perspective. `delete` in `media/repository.ts` requires `row.creationContext` to equal it.
   - **Group perspective is the Admin identity only for admins.** A follower-only user viewing the Group perspective has no Admin identity, so the server rejects a `"group"` delete from them. Their Follower contributions are deleted from Me.
   - The owner route (`/api/group-media/:id` DELETE) accepts attached Follower contributions only. It also accepts **pending** contributions of either identity, so upload cancel (`GroupMediaUpload` in `operations.ts`) keeps working; nothing pending is listed anywhere.
   - Role changes never reclassify: the check compares the stored `creationContext`, never the current role.
   - **Refined by checkpoint 4.2b (C1):** Follower contributions are no longer deleted from the standalone Card; the owner route then accepts pending contributions only.
6. **"Own" counts use the identity:** `canManage` in `readMediaPage` and the `own` sum in `sharedPreviewPages`.
7. **Unchanged:**
   - the Group feed without a subject;
   - `hide`;
   - id-based owner access (`authorized` with owner authority) for upload status, cancel and cleanup;
   - private-icon semantics;
   - indexes.

**Required explanatory comment:** at the top of `contributionIdentity.ts`, with a one-line pointer from `baseGroup` in `readOwnerMediaPage`, the place most likely to be edited in future. The comment explains why the filtering exists:
- Follower-created contributions join the author's cross-context history.
- Admin-created contributions belong only to their originating Group.
- A dual-role user's Admin and Follower contributions are separate identities.
- Classification comes from the creation perspective, never the current role.
- Info Cards must follow the same distinction.

**Tests**, using existing infrastructure (`tests/group-media.integration.ts`, `tests/media-collection.integration.ts`, `tests/group-media-routes.test.ts`, `tests/media-collection-operations.test.ts`, existing Group media browser specs):
- **Coach scenario:** a coach uploads in Group A's Group perspective. They also administer Group B with the same Card template and hold that Card in a standalone Deck. The item:
  - appears in Group A's Group feed and previews;
  - is absent from Group B (Group and Me);
  - is absent from the coach's standalone history and previews.
- **Follower scenario:** a follower uploads in Me. The item appears in their standalone history, in Me in other Groups marked private, and in its own Group feed. Unchanged.
- **Dual-role user in one Group:**
  - an Admin and a Follower upload each;
  - Me and standalone show only the Follower one;
  - the Group feed shows both as separate items;
  - viewing them as Other followers shows only the Follower one;
  - Delete is offered only in the creating perspective;
  - the server rejects a cross-identity delete through both the Group-context route and the owner route.
- **Follower-only deletion:** no Delete offered in the Group perspective; Delete works from Me and the standalone Card; a `"group"` delete from a non-admin is rejected.
- **Upload cancel:** cancelling a pending Admin or Follower upload through the owner route still works.
- **Management controls:** `canManage` and the `own` counts reflect only the acting identity's contributions.
- **Role changes after creation:** promotion and demotion never reclassify. An in-flight upload across a role change fails its commit.
- **Server enforcement:** `"group"` from a non-admin and `"self"` from a non-follower are rejected.
- **Hiding:** an admin hides another author's contribution and the same user's Follower contribution; nothing is deleted.
- **Private icon:** unchanged for Follower contributions (other origin or hidden).
- **Existing records:** a record without `creationContext` behaves as `"self"`.
- **Counts and paging:** owner-history totals, `olderCount` and older/newer cursors are consistent with the filtered set.

**Acceptance:** all the tests above pass; existing Group media and media-collection suites pass unchanged except where they encoded the old leak.

**iPhone checks:** coach uploads in Group A, then checks Group B and the standalone Card; a follower's Me and standalone views are unchanged.

#### Proposed Info Card persistence: one mapping, not a parallel system

| Corrected media item | Info Card equivalent |
| --- | --- |
| `groupMediaContributions` record per item | `infoCards` root with `kind: "group"` |
| `authorUserId` | `ownerUserId` (the author) |
| `experienceId`, `cardTemplateId` origin | `experienceId`, `originCardTemplateId` (immutable) |
| `creationContext: "self" \| "group"` | the same field and values, set by the creation perspective |
| `groupVisible` (default `true`) | `groupVisible` (default `true`) |
| `state` attached/deleted | the existing `latestVersion > 0` / `deletedAt` |
| `group_media_owner_history` index | an equivalent `infoCards` index on owner, origin Card and date |
| `group_media_shared_history` index | an equivalent `infoCards` index on experience, origin Card, `groupVisible` and date |

- **Identity rules:** the same `contributionIdentity.ts` filters and checks are used for Info Card reads, edit and delete. Media and Info Cards cannot diverge.
- **Colour:** `"group"` gives a Group Admin Info Card (teal); `"self"` gives a Personal Info Card (green).
- **New indexes:** the two Info Card indexes are new and need explicit approval before installation in Atlas (section 8.3).
- **Delivery:** as `authorized()` in the media repository. The owner by id; a current member when the card is shared with that Group.
- **Ownership checks:** standalone Personal Info Cards keep their existing CardData path unchanged. Group checks use explicit branches and never `author === actor || isAdmin`.

#### Checkpoint 4.1 — Verify media patterns

- Re-read the corrected media code against the specification and confirm the mapping above.
- Add Group browser coverage that Creator Info Cards appear correctly in Group, Me and Other followers perspectives.
- Add privacy assertions that standalone Personal Info Cards never reach another user.
- **Gate:** if a contradiction with an explicit requirement is found, stop and report it with code references (specification mandatory consistency rule). Otherwise continue.

#### Checkpoint 4.2 — Personal Info Cards in Groups

- **Server:**
  - Create and save a `kind: "group"`, `creationContext: "self"` Info Card from Me, authorised like media upload from Me: an active follower, the current access epoch, and the Card in the Group manifest at that version.
  - Edit and delete only by the author acting as the Follower identity, from Me or the standalone Card (P2, R1). Hide by current admins. **Refined by checkpoint 4.2b (C1):** from Me of the originating Group only.
- **Reads:**
  - **Me:** the author's Follower contributions for this Card from every Group, and their standalone Personal Info Cards. Those not originating in this Group, or hidden here, carry the existing private glyph. Their Admin contributions are never shown.
  - **Standalone context:** their standalone Personal Info Cards plus all their Follower contributions. Their Admin contributions are never shown.
- **Client:**
  - Enable the pouch on the follower's own Card in Me, using the existing editor with a Group transport.
  - Apply the private glyph, Personal green and the type label.
- **Acceptance:**
  - Creation from Me never writes CardData.
  - Me and standalone show the correct sets and glyphs.
  - Edit, delete and hide follow the identity rules.
  - No other user sees a standalone Personal Info Card.

#### Checkpoint 4.2b — Creation-context editing and deletion

**Purpose.** Apply C1–C4 to media items and Info Cards: an item is edited or permanently deleted only in the exact context where it was created (C1), Delete and Hide stay separate (C2), unfinished drafts are recovered through the existing My Drafts (C3), and leaving a Group ends management of its contributions (C4). This extends checkpoint 4.0 (`b416db7`):
- **4.0** records *which identity* created a Group contribution (`creationContext`) and limits deletion to that identity.
- **4.2b** adds *which context*: the standalone Card, or a specific Group together with that identity.

Visibility, hiding, uploading, playback, automatic publication, owner-history ordering and paging, Admin/Follower isolation, the private glyph and Creator Info Cards are unchanged. There is **no new field, collection, index, migration or backfill**, and no new request field.

**Creation contexts from existing records:**

| Creation context | Media item | Info Card |
| --- | --- | --- |
| Standalone Card | Entry in the user's CardData `mediaItems` (collection source `personal`) | `kind: "personal"` root, attached through CardData `personalInfoCardIds` |
| Group A · Me | `groupMediaContributions` record: `experienceId: A`, `creationContext: "self"` or missing | `kind: "group"` root: `experienceId: A`, `creationContext: "self"` |
| Group A · Group | The same record with `creationContext: "group"` | `kind: "group"`, `creationContext: "group"` (created from 4.3) |

- `"self"` alone does not identify the context.
  - **Group items:** the pair (`experienceId`, `creationContextOf(record)`) does.
  - **Standalone items:** the storage location (CardData) does.
- A Group item shown on a standalone Card is read from its Group record (`readOwnerMediaPage`, `mainInfoConsultation`). It is never copied into CardData.
- **The stored record is the only authority for an item's creation context.** The server never accepts a client-declared identity in its place.

**Findings after 4.0–4.2:**

| Item | Already correct | To change |
| --- | --- | --- |
| Media, standalone | Delete only on the standalone Card. In Group contexts `mediaRemoveOperation` returns nothing for personal items, and `/api/cards-data/:card/media/:id` is a standalone route | Origin indication in Me |
| Media, Group A · Me | Delete in Me of A is a genuine Delete: `mutateCollectionItem` sends it to the Group route with perspective `"self"`, which sets `state: "deleted"`. Read-only in Me of B | **The standalone Card offers Delete** (`permissions.ts` `!experienceId` branch), and the owner route accepts attached Follower contributions (`repository.ts` `delete`). The Group route accepts `"self"` from any member (`"member"` role), not only an active follower |
| Media, Group A · Group | Server: Group route, admin and identity checked; owner route refuses attached Admin contributions | **Client defect from 4.0:** the Group feed transport drops `creationContext` (`fetchMediaCollection`, `transport.ts`), so the item reads as `"self"`. The Group Media Centre therefore offers an admin **Hide instead of Delete** on their own Admin upload, and a hidden Admin upload is unreachable (P1 limitation). Verified by evaluating `mediaRemoveOperation` on a transport-shaped item; the covering browser test fails earlier, in its drag-to-flip helper, so it never reached this assertion |
| Info Card, standalone | Edit and Remove on the standalone Card only; read-only in Me | Origin indication in Me |
| Info Card, Group A · Me | Edit and Remove in Me of A; read-only in Me of B; creation authorised as for media | **The standalone Card offers Edit and Remove** (`groupNote.editable` in working mode). **The server checks no Group permission after the first Save** (`owner()` only): draft PATCH, `save`, `upload`, DELETE and pending completion all succeed after the author leaves. **My Drafts lists saved Group notes with unsaved edits** and opens any Group note in the Creator editor, so it is an editing route for saved cards |
| Info Card, Group A · Group | Not implemented (4.3) | 4.3 and 4.4 apply C1–C4 |
| Origin indication | — | Missing for both |

**Reused from checkpoint 4.0, unchanged:**
- `contributionIdentity.ts`: `CreationContext`, `isCreationContext`, `creationContextOf` (missing reads as `"self"`), `viewerIdentity`, `sameIdentity`, `FOLLOWER_CONTRIBUTIONS`.
- The Group-context media delete command (`groupDeleteCommand`), with `groups.access` at the client's access epoch, `fence`, and the stored-identity and `experienceId` checks in `GroupMediaRepository.delete`.
- The role-per-identity predicate in `creationAuthority`: `"group"` needs a current admin, `"self"` an active follower.
- `groups.access` and `groups.fence` for Group authorisation and write fencing.
- The owner route's pending exception for upload cancellation.
- All reads, counts, hiding (`GroupMediaRepository.hide`, `InfoCardRepository.hideGroup`) and the private glyph.

**Added to `contributionIdentity.ts`** (pure, shared by server and client, with the top comment extended to C1–C4):
- `CreationOrigin`: `{ kind: "standalone" }` or `{ kind: "group"; experienceId; identity: CreationContext }`.
- `mediaOrigin(item)` and `infoCardOrigin(root)`.
  - A personal source or `kind: "personal"` gives standalone.
  - A Group record gives `experienceId` with `creationContextOf`.
- `actingOrigin(experienceId?, identity)`: no Group is standalone, Me in A is (A, `"self"`), the Group perspective of A is (A, `"group"`). Callers pass `viewerIdentity(context)`.
- `sameOrigin(a, b)`.
- `identityRole(identity)`: `"group"` gives `"admin"`, `"self"` gives `"follower"`. It is extracted from `creationAuthority`, which then uses it, and every Group-context write uses it.
- `originLabel(origin, groupName)`: "Personal Card", "{Group} · Me" or "{Group} · Group". A missing name uses the existing "Group unavailable".

**Delete and Hide (C2).** Delete permanently removes; Hide sets `groupVisible: false` and never deletes. Their routes, commands and server authorisation stay separate and unchanged except as listed below. The client decides between them with one pure function, so an author in their creation context always gets Delete and never Hide:

| Viewer and item | Operation |
| --- | --- |
| Author, in the item's creation context | **Delete** |
| Author, outside it, and not allowed to Hide it there (standalone Card, Me, or the Group perspective without admin rights) | none; origin shown |
| Current admin in the Group perspective, item originating in this Group, not in its creation context (another author's item, or the admin's own Follower item) | **Hide**; for their own item the origin is shown as well |
| Anyone else | none |

**Media changes:**
1. **`mediaRemoveOperation`** follows the table: Delete only when the viewer is the author, `canRemoveOwn`, and `sameOrigin(mediaOrigin(item), actingOrigin(experienceId, identity))`. This replaces the `!experienceId` branch. The Hide branch is unchanged.
2. **`mutateCollectionItem`:** the same `sameOrigin` check before any delete request. The routes it chooses are unchanged.
3. **`fetchMediaCollection`:** the Group branch keeps `creationContext` from the server DTO. **This fixes the 4.0 defect** and supplies the origin labels.
4. **Owner route** (`/api/group-media/:id` DELETE): refuse every attached contribution, of either identity. Pending contributions are still accepted, so upload cancellation keeps working.
5. **Group route:** a `"self"` delete requires `identityRole("self")`, an active follower, instead of `"member"`. `"group"` already requires an admin. The access epoch, fence, experience and stored-identity checks are unchanged.
6. **The standalone personal-media route is unchanged.** It is the standalone context.

**Info Card server changes:**
1. **One guard, `InfoCardRepository.manageable(actor, id, session)`**, built on `owner()`, run inside the write's transaction:
   - **Creator and standalone Personal roots:** `owner()` only, as today.
   - **Group roots:** `groups.access(actor, root.experienceId, identityRole(creationContextOf(root)), session)` then `groups.fence([member], session)`. Everything comes from the stored root: no client-supplied Group, identity or perspective.
   - **Fencing:** creation keeps its existing client access epoch (`createGroup`). Later writes fence the current membership record in the same transaction, so a concurrent removal, demotion or rejoin conflicts instead of interleaving. No client epoch is needed, because no client view of the Group is being trusted.
2. **Every write path uses it:** draft PATCH (autosave), `savePersonal` (Save), `createInfoUpload` and its retries, DELETE (Remove), and `completePendingPublication`. The first Save keeps its existing check that the Card is still selected in the Group; its role check becomes the guard's.
3. **Pending completion** re-runs the guard, as a media commit re-runs `creationAuthority`. A refusal clears the request and records the existing `lastPublicationFailure` with the guard's error code, so the editor, the stack and My Drafts show it as a failure, not as pending forever.
4. **Unchanged:** creation (`createGroup`), hiding (`hideGroup`), and reads (editor GET, media delivery, publication snapshots, `check-rendering`, which writes nothing).
5. **No `groupContext` field and no new pending-publication shape.** The earlier proposal is withdrawn. Investigation found no technical need: for an existing root, the editor needs only its id, and the root holds the context.

**My Drafts (C3):**
1. **Listing** (`InfoCardRepository.drafts`):
   - Group roots are listed only while **unsaved** (`latestVersion: 0`), for both identities, and only where the guard would pass: `experienceId` among the user's Groups as an active follower (`creationContext` `"self"` or missing) or as an admin (`"group"`). The membership lookup runs before pagination.
   - **Saved Group roots are no longer listed**, even with unsaved changes. Those changes are continued from Edit in the creation context, which already opens `root.draft`.
   - Creator and standalone Personal predicates are unchanged.
   - Records are never deleted or changed by this filtering.
2. **Entries** (`loadCreatorDraftEntries`, `CreatorDraftsModal`): a Group draft carries its origin label, for example "Group A · Me", built with `originLabel` from the Group name, beneath the title in the existing entry style.
3. **Opening** (`/creator/info-cards/[infoCardId]`):
   - **Unsaved Group draft:** the page runs `manageable` before rendering, then opens the existing `InfoCardEditor` directly, in its note mode (Save and Cancel), as today. No navigation through the Group, Card or perspective.
   - The editor shows a small read-only **Created in: Group A · Me** in its header, through the editor's layout, not on the face.
   - **Saved Group root, or the guard refuses:** the existing "Info Card unavailable" view, naming its origin. No editor.
   - **Standalone Personal and Creator Info Cards:** unchanged, including the existing return of standalone Personal drafts to their Card.
4. **After Save from My Drafts:** once a Save is confirmed, either immediately or when a pending Save completes while the editor is open, the Creator-hosted Group note editor closes and returns to My Drafts with the confirmation. It never continues editing a saved card.

**Info Card client changes:**
- `groupNote.editable` (`infoCardConsultationClient.ts`) becomes `sameOrigin(infoCardOrigin(root), actingOrigin(...))`, so working mode no longer makes Group notes editable.
- The Me editor and Remove keep their existing requests. They gain no new fields.
- Standalone notes keep their CardData path.

**Client presentation:**
- **Media Centre** (`UserCardMediaUploadPanel`, fed by `CardMediaCentre`, with the decision computed in the existing Media Centre metadata pipeline, `centreMetadata.ts`):
  - For the viewer's own items outside their creation context, the Delete slot holds a non-interactive block: a small **Created in:** above the context name.
  - Where the viewer may also Hide the item, Hide stays as its own action beside the origin.
  - No disabled button is shown.
  - Card faces, the Gallery and back-of-Card previews are unchanged.
- **Info Card menu:**
  - New `infoCardMenuLayout.ts` with `buildInfoCardMenuLayout(card, context)`. It returns the actions (+ New, and Edit and Remove in the creation context) and, outside it, the origin, following the layout-pipeline convention.
  - **+ New is kept in every menu where it appears today**, because it creates a new Info Card in the current context.
  - `InfoCardMenu` renders the origin as text, not a menu item: a small "Created in:" above the name.
  - The menu's minimum width is unchanged. Its maximum width is the card width less its inset, and text wraps (`overflow-wrap: anywhere`). The menu opens upwards within the card, so the consultation's `overflow: hidden` cannot clip it.
  - The face, its dimensions and Creator Info Cards are unchanged.
- **Origin data:**
  - Media pages already carry `originName`, and `creationContext` after media change 3.
  - Consultation entries and My Drafts entries for Group notes gain `originName`, looked up as `readOwnerMediaPage` does, which needs no membership for the author's own items.

**Existing records.** Group Experience has not launched. Missing `creationContext` keeps reading as `"self"` (4.0). No production audit, migration or backfill, and no production access. Info Card Group roots all carry both fields.

**Leaving a Group or losing a role (C4):**
- Management needs the creation context to be reachable: an active follower of A for Group A · Me, a current admin of A for Group A · Group.
- A former follower or former admin cannot edit, Save, upload to, Remove or continue drafts of those items, and their pending Saves fail when completed.
- Visibility and hiding are unchanged. Rejoining with the role restores management.
- Accepted limitation without workarounds. Managing past Groups' contributions belongs to the future general Media Centre (section 9), backlog only.

**Tests**, extending the 4.0 identity suite and the 4.2 suites:
- **Unit:**
  - origin helpers and labels: the three contexts, a missing `creationContext`, a missing Group name;
  - `mediaRemoveOperation` for every row of the Delete and Hide table, including dual-role users in both perspectives;
  - `buildInfoCardMenuLayout`: in and out of context, + New kept.
- **Media integration, Delete versus Hide:**
  - an admin deleting their own Admin upload from the Group perspective: record `state: "deleted"`, not merely `groupVisible: false`;
  - a follower deleting their own upload from Me of A: genuinely deleted;
  - a dual-role user: their own Follower item deleted from Me; the same item hidden, not deleted, from the Group perspective; their own Admin item deleted from the Group perspective;
  - admin Hide of another author's item, unchanged.
- **Media integration, context:**
  - the owner route refuses attached Follower and Admin contributions and still cancels pending uploads of both identities;
  - a Group-route `"self"` delete from an admin who is not an active follower is refused;
  - Me of B cannot delete an A item; cross-identity deletes stay refused;
  - after leaving, deletion is refused; after rejoining, it is allowed.
- **Transport:** Group feed items keep `creationContext`.
- **Info Card integration**, for every write path (autosave, Save, upload, Remove, pending completion):
  - a Group note is accepted for its author while an active follower of its Group;
  - refused after leaving, accepted again after rejoining;
  - refused for another user;
  - a concurrent membership change conflicts through the fence;
  - a standalone Personal note and a Creator Info Card behave exactly as before.
- **Regression of the guarded paths** (these must be shown to work, not assumed because the editor is shared):
  - initial creation and first Save from Me;
  - autosave of an unfinished draft;
  - a media upload, its retry and its cancellation;
  - a Save with a video still processing while the editor stays open, completing to one version;
  - leaving and returning: completion from My Drafts and from the stack;
  - processing failure and Cancel behaviour unchanged;
  - pending completion after leaving: recorded as a failure, no version created.
- **My Drafts:**
  - lists an unsaved Group draft with its origin label; omits a saved Group note with unsaved edits; omits drafts from a Group the user has left;
  - opens an unsaved Group draft directly in the editor, with no navigation, autosaves, Saves, and returns to My Drafts;
  - refuses a saved Group note on the Creator page;
  - Creator and standalone Personal draft entries and opening unchanged.
- **Browser** (opening the Card back without the flaky drag-to-flip helper, so the assertions run):
  - the standalone Media Centre shows "Created in: Group A · Me" and no Delete;
  - Me of B shows the origin for A items and the standalone items;
  - an admin's own Admin upload in the Group Media Centre is deleted, with no hide notice;
  - a dual-role admin sees Hide and the origin on their own Follower item in the Group perspective;
  - an out-of-context Info Card menu shows the origin and + New only, and a long Group name wraps unclipped at phone width;
  - in-context Edit and Remove are unchanged;
  - an unsaved Group draft reopens from My Drafts directly in the editor.
- **Regression gate:** `group-media-identity`, `group-media`, `media-ux`, the Info Card suites, the My Drafts suites and `group-info-cards`. Update only the expectations that encoded standalone management of Group items or My Drafts editing of saved Group notes.

**Regression risks:**
- **Upload cancellation:** keep the owner route's pending exception, and test it for both identities.
- **Guarded writes:** a write path that skips `manageable` reopens cross-context management; one that applies it wrongly breaks autosave, upload or completion. Each path has an integration test.
- **My Drafts filtering:** must not hide Creator or standalone Personal drafts. The membership lookup runs before pagination.
- **Menu width:** at the narrowest phone width.
- **Masked browser coverage:** the existing `media-ux` failures in the drag-to-flip helper hide Media Centre assertions. The new checks avoid that helper.

**Model and effort:** Opus, High. **Commit:** separate, after the regression gate. **Approval gate:** stop for human review after 4.2b, before checkpoint 4.3.

**Open points:** none. O1–O5 from the earlier draft are resolved by C2 (Hide with the origin), C3 (My Drafts without navigation), C4 (leaving), + New kept, and no legacy audit.

#### Checkpoint 4.3 — Group Info Card backend

- **Group perspective reads:** all `kind: "group"` Info Cards originating in this Group with `groupVisible: true`, Admin and Follower contributions alike, including former members, ordered as the media feed is.
- **Other followers reads:** that follower's Follower contributions for this Group, allowed by `canInspectPeers`.
- **Create:** a Group Admin Info Card (`creationContext: "group"`) from the Group perspective, admin-only as for media: `createGroup` accepts `"group"` and authorises it with `creationAuthority(..., "group")`. Same `infoCards` root and identity model as 4.2; no new field, collection or draft store.
- **Drafts (C3):** unfinished Admin Info Cards use the existing root `draft`, autosave and revision checks. They are listed in the existing My Drafts while unsaved, through the 4.2b `drafts()` filter, which already covers `creationContext: "group"` for Groups where the user is a current admin.
- **Permissions:** every write (autosave, Save, upload and retries, Remove, pending completion) goes through the 4.2b `manageable` guard, which requires a current admin of the originating Group for `"group"` roots. The first Save's role check uses `identityRole(creationContextOf(root))`, not the Follower role.
- **Save and automatic publication:** the existing `savePersonal` and `pendingPublication` mechanisms, unchanged. The Group perspective consultation resumes the admin's own pending Admin Info Cards for that Card, as `resumingInfoConsultation` does in Me.
- **Edit and delete after Save:** only by the author acting as the Admin identity, from the Group perspective of the originating Group (P2, R1, C1), through the 4.2b guard. Delete is genuine deletion. Hide as for media (C2), never in place of Delete.
- **Leaving (C4):** a former admin's writes are refused, and their unsaved drafts leave My Drafts.
- **Integration tests:**
  - admin-only creation in the Group perspective;
  - autosave, first Save, Save with a processing video, completion after leaving and returning, and completion refused after demotion;
  - My Drafts lists an unsaved Admin draft and omits it after demotion or once saved;
  - the coach and dual-role scenarios from 4.0 applied to Info Cards;
  - member reads;
  - inspection permission and `allowFollowerInspection`;
  - Delete and Hide semantics, separately;
  - former members;
  - foreign-Group denial;
  - no CardData written.

#### Checkpoint 4.4 — Group Info Card client

- The Group perspective pouch and consultation show Group Admin Info Cards in teal and Follower contributions in green, with type labels.
- Attribution as media: the author username, plus the Group origin where media shows it.
- **Admins** get + New and Hide in the Group perspective, with Edit and Remove only on their own Admin contributions.
- **Creation and editing** use the existing editor modal (`PersonalInfoEditorDialog`, `InfoCardEditor`) with the Group transport. The editor's Group creation context carries the creation perspective (`"group"`) instead of the fixed `"self"`. No new editor.
- **My Drafts:** an unsaved Admin draft shows its origin ("Group A · Group") and reopens directly in the shared editor, through the 4.2b flow. No Group navigation and no separate interface.
- **Followers** have no admin actions there.
- Menus follow C1 (4.2b): outside an item's creation context, the author's menu shows "Created in" and + New, without Edit or Remove. Dual-role admins see Hide and the origin on their own Follower contributions (C2).
- Group Admin Info Cards never appear in Me, on a standalone Card or in another Group.
- The established visual design and interactions are preserved.
- Browser tests per perspective, for the colours of mixed stacks, and for an Admin draft reopened from My Drafts.

#### Terminology refinement after 4.4 — Delete and Hide from Group

Commit `66b4cf1`. Wording only; no server, route, storage or permission change.

- **Delete** replaces Remove for permanent deletion, and **Hide from Group** replaces Hide for the admin visibility action. They apply to the Info Card three-dot menu and the Media Centre button, busy text ("Deleting…", "Hiding…"), accessible names, hide notice ("Hidden from this Group. The creator still has their copy.") and failure messages.
- The Media Centre label follows the operation from `mediaRemoveOperation` (`"delete"` or `"hide"`) through a `getRemoveAction` prop on the upload panel. Internal names (`onRemove`, `mediaRemoveOperation`, the `"hide"` action) are unchanged.
- Unrelated Remove actions are unchanged: Remove attachment, Remove media in the Info Card editor, the Creator media modal, followers and Reflections.
- Text above that says Remove or Hide for these actions means Delete and Hide from Group.
- **Remove stays for standalone Personal Info Cards (decision):** the menu item detaches the card from the Card and keeps the record, so a Personal Info Card can later be converted into a Creator Info Card. `buildInfoCardMenuLayout` returns `removeLabel` ("Remove" for a standalone Personal card, "Delete" for a Group note) and the menu shows it; an inline comment in `infoCardMenuLayout.ts` explains the difference. Existing removed cards stay as unreachable records; no clean-up or migration.
- **My Drafts (decision):** after Save, an unsaved Group draft reopened from My Drafts keeps the editor open on "Saved.". The earlier return to the My Drafts list is withdrawn. No notice after Hide from Group; the pouch count may lag as described for 4.4.
- **Indexes (approved):** `group_info_owner_history` (`ownerUserId`, `originCardTemplateId`, `createdAt`) and `group_info_shared_history` (`experienceId`, `originCardTemplateId`, `groupVisible`, `createdAt`) are now created by `createInfoCardIndexes`. Performance only; no readiness check depends on them. They still need installing in Atlas, which has not been done.
- **Not decided:** whether Admin Info Cards (and Admin media) should appear in followers' Me perspectives. Nothing has changed.

#### Checkpoints 4.5a–4.5c — Admin contributions in followers' Me, and the inspection toggle

**Purpose.** Apply decisions V1–V7 of the specification: Admin contributions (Info Cards and media) also appear in every active follower's Me of the originating Group; inspecting a follower shows only their contributions unless the central **Include Group content** toggle is on. Nothing is implemented yet. **Model and effort:** Opus, High.

**Step 0 — Atlas index installation (approved; completed 14 November 2026, run by the owner and verified from the index listing: `group_info_owner_history` and `group_info_shared_history` exist on `infoCards` in the `switchplay` database, and the readiness check reported "Info Cards indexes ready.").** The steps were:
1. Read-only: list the indexes on `infoCards` in Atlas, confirm the database and that `group_info_owner_history` and `group_info_shared_history` do not exist.
2. Run `npx tsx scripts/setup-info-cards.ts`. It calls `createInfoCardIndexes` (the two new indexes; the existing ones are identical, so re-creation is a no-op) and the read-only readiness check. It rewrites no data.
3. Read-only: list the indexes again and report them.
4. Rollback: drop the two indexes by name; nothing depends on them.
- `.env.local` points at production Atlas, so this is a deliberate production index write. State before and after running it. Do not run anything else against Atlas.

**Shared rules (all three checkpoints).**
- **B-readiness:** an optional `audience?: "group-perspective-only"` on Info Card roots and Group media records. Missing means shown in followers' Me. Read filter `audience: { $ne: "group-perspective-only" }`. Nothing writes it now. No migration, no index change.
- **Query parameter:** `includeGroupContent=1` (internal name `includeGroupContent`) on the consultation and media reads for follower inspection. The server authorises it with the existing member and `canInspectPeers` checks, so there is no new permission surface.
- **Sorting:** unchanged. Admin items use their saved date like every other item.
- **No private icon** on Admin items in Me; `private` stays computed as now for the viewer's own Follower contributions.
- **Identity:** any new query compares through `identityFilter` and `creationContext`, never `authorUserId` alone (identity drift, section 7).
- **Existing content:** Admin contributions already stored become visible in followers' Me on deploy. Confirmed acceptable.

**4.5a — Info Cards in followers' Me (continues automatically if within scope).**
- **Backend:** in `mainInfoConsultation`'s experience mode ([queries.ts](../../../../src/lib/infoCards/queries.ts)), add this Group's roots for the Card with `kind: "group"`, `creationContext: "group"`, `groupVisible ≠ false`, `latestVersion > 0`, not deleted and without the audience opt-out. Pass their IDs into `publicationSnapshotEntries` as `sharedGroupIds`. In group mode with a subject, add them only when `includeGroupContent` is set.
- **Media delivery:** `authorizeInfoMedia` already serves Group members; confirm with a follower viewer in Me.
- **Client:** `editable` stays false in Me for Admin cards; a plain follower sees only + New, and a dual-role admin sees the origin "Group A · Group". The pouch count includes them.
- **Tests:** integration (a follower sees them; absent for other Groups, hidden, former followers and standalone Cards; subject inspection excludes them by default and includes them with the parameter; order unchanged), unit (menu layout), browser (Me and mixed stack colours).

**4.5b — Media items in followers' Me (approval gate: permission-sensitive media change, as 4.0).**
- **Backend:** the Me page ([ownerHistory.ts](../../../../src/lib/mediaCollection/ownerHistory.ts), `readOwnerMediaPage`) reads only the viewer's own items. Add a third source, this Group's Admin records (`creationContext: "group"`, `groupVisible: true`, same Card, not opted out), merged with the same sort tuple. Extend cursors, `total`, `start`, `olderCount` and the neighbour lookups so counts and paging do not drift. Author name per row instead of the viewer's. Extend `ownerPreviewPages` ([preparation.ts](../../../../src/lib/mediaCollection/preparation.ts)) and the Group refresh path ([refresh.ts](../../../../src/lib/groupExperiences/refresh.ts)) for thumbnails and the exact Gallery item.
- **Delivery:** items the viewer did not author use the Group route with `experienceId`, as the shared feed does; capabilities give a plain follower no controls.
- **Client:** Media Centre in Me shows "By: [admin]"; a dual-role admin sees "Created in: Group A · Group" in place of Delete.
- **Tests:** integration (paging, totals and cursors with all three sources; hidden, other-Group, former-follower exclusions; delivery to followers), browser (Me thumbnails, Gallery, Media Centre).

**4.5c — Inspection toggle (approval gate).**
- **State:** one client setting in the Group deck, off by default, reset when the deck is left or the page reloads, kept across followers and across the deck and Focused Card views. It feeds `includeGroupContent` into the Info Card and media reads and the pouch count prefetch.
- **Deck view (list):** the row sits at the bottom of the popover below a divider; add a wrapper so only the follower names scroll and the row is fixed.
- **Focused Card view (grid):** a thin fixed row along the bottom of the panel with the toggle in the bottom-right corner; add a wrapper so only the tiles scroll.
- **Toggle:** label "Include Group content", a proper switch role, at least 44px high, clear of the safe area; dimmed (not hidden) while the Group perspective is selected.
- **Marker:** a "+ Group" tag after the follower's name in the status chip and the Focused Card header, on the same line, adding no vertical height.
- **Refresh:** switching refreshes the content and the pouch count without closing the chooser or losing the stack position.
- **Tests:** unit for the layout of the two choosers and the toggle state; browser for both choosers with many followers (about 30) to prove the footer stays fixed while names scroll, keyboard operation, narrow iPhone widths down to the smallest, landscape, the marker adding no height, and reset on leaving the deck.
- **Regression risk:** the list and grid DOM change, so test follower selection, dismissal, focus order and scrolling in both views.

**iPhone checks (4.5a–4.5c):**
- A follower's Me shows Admin cards and media from all admins, sorted with everything else, with no private icon and no Edit, Delete or Hide.
- The same items appear in the Group perspective; they never appear on a standalone Card or in another Group.
- Hide from Group on an Admin item removes it from followers' Me.
- A dual-role admin sees their own Admin items in Me with "Created in: [Group] · Group".
- Inspecting a follower shows only that follower's contributions by default; with Include Group content on, the Group's items join, and the "+ Group" tag shows.
- The toggle stays fixed at the bottom of both choosers while names scroll, and the tag does not enlarge the chip.
- It resets after leaving the Group deck.

**iPhone checks (4.2–4.4):**
- Follower Me: their Follower contributions plus standalone cards with the private icon.
- Group perspective: Group Admin cards in teal and follower cards in green.
- Admin creates and deletes their own Admin cards, and hides contributions; Delete never hides.
- An unsaved Group draft (Me or Group) reopens from My Drafts directly in the editor, with its origin shown.
- A dual-role user sees their two identities kept apart.
- Inspecting another follower shows only their shared Follower contributions.
- No standalone card leaks.

---

## 4. Testing strategy

| Layer | Command | Used by |
| --- | --- | --- |
| Unit | `npm run test:unit`; new `*Layout` unit tests | Every checkpoint |
| Integration | `node --import tsx --test --test-concurrency=1 tests/info-cards.integration.ts tests/info-card-attachments.integration.ts tests/personal-info-cards.integration.ts tests/info-cards-release.integration.ts`, plus `tests/group-media.integration.ts`, `tests/media-collection.integration.ts` and the Group suites for Phase 4 | 9 (server validation), 10, 4.0, Phase 4 |
| Browser (disposable) | `npm run test:phase2 -- --info-cards <files>` with an explicit file list; `--group-experiences` for Group specs | Every UI checkpoint |
| Static | `npm run typecheck`, `npx eslint <changed files>` | Every checkpoint |
| Regression gate per checkpoint | All Info Card browser specs (84 tests at Phase 1) plus `creator-upload-recovery.browser.ts`; video specs for checkpoint 8; Group media and perspective specs for Phase 4 | Every checkpoint |

- **Device behaviour:** WebKit and Chromium touch emulation catches some iPhone issues but does not replace physical-device checks. Each approval report lists exactly what needs an iPhone.
- **Real media providers:** `info-cards-live-media.browser.ts` is restricted to authorised live runs. Real Stream processing and R2 verification are checked manually on Preview.

---

## 5. Dependencies and sequencing

1. **5 first.** It introduces the type and colour layout that 6 and Phase 4 rely on, and fixes the dimensions that 6's panel and 9's measurement depend on.
2. **5 before 6.** Both change the consultation geometry. 6 extracts the opening animation that 5 must leave unchanged.
3. **7 before 10.** The pending and failure states are shown in the new media area.
4. **9 after 5.** Both edit `InfoCardFace` and capacity geometry.
5. **8 is independent.** It is small and can run in any slot.
6. **10 before Phase 4.** Group Info Cards use the same Save and pending mechanism.
7. **4.0 before all Phase 4 Info Card work.** It corrects the media rules that 4.1–4.4 reproduce. It depends on nothing in Phases 2–3, so it could be done earlier, but placing it directly before 4.1 keeps the Info Card phases together and lets 4.1 verify the corrected code.
8. **Phase 4 in order.** 4.0, then 4.1, 4.2, 4.2b, 4.3 and 4.4. 4.2b comes before 4.3 so Group Info Cards are built on the C1 guard.

---

## 6. Decisions

### 6.1 Approved decisions

| # | Decision | Effect on this plan |
| --- | --- | --- |
| D0 | Commit the specification and plan as one docs commit; do not push. | First version committed as `1424eb4`; this revision awaits review before commit. |
| D1 | Header 33px, text 93px, footer 45px, about 173px total, width 240px; four strips of about 5px in type colours; no capacity compatibility for legacy test content; accessible contrast and a type indication. | Checkpoint 5 |
| D2 | Compact panel with "Add Personal Info Card"; animates out of the pouch with the existing opening animation; outside tap dismisses; no Close; the first saved card opens focused. | Checkpoint 6 |
| D3 | Bars above and below portrait videos in the Info Card attachment viewer. Fix if straightforward; otherwise defer. | Checkpoint 8 |
| D4 | Formatting entirely in the Info Card layer; renderer unchanged. | Checkpoint 9 |
| D5 | One press; completion after the media is ready; no substantial new infrastructure. | Checkpoint 10, refined by Q7 |
| D6 | The same mechanism for Personal Save. | Checkpoint 10 |
| D7 | Info Card behaviour in Groups follows established patterns; inconsistencies are reported. The canonical pattern is narrowed to media items by Q1. | Sections 2.5 and 2.6 |
| D8 | Standalone Personal Info Cards follow CardData across Decks and Groups; never duplicated. | Unchanged standalone path |
| D9 | Admins create Group Admin Info Cards as Group content, never in their CardData. Its pattern is narrowed to media items by Q1. | 4.3, 4.4 |
| D10 | One palette everywhere; strips reflect actual types in every perspective. | Checkpoints 5 and 4.4 |

### 6.2 Resolved questions and points

| # | Resolution | Replaces |
| --- | --- | --- |
| Q1 | Media items are the sole canonical reference. Standalone Personal Info Cards stay on CardData; Group-created and Group Admin Info Cards belong to the Group Experience context like Group media items. Reflections are not a reference. | The earlier recommendation that Group-created Personal Info Cards stay private on CardData |
| Q2 | Mirror media visibility: own Group-created and standalone cards in Me, standalone ones with the private icon; standalone cards never exposed to others. | The earlier "owner's own views only" recommendation |
| Q3 | Group Admin Info Cards only in the Group perspective; follower-created Group Info Cards also appear there. | The earlier "Group and Me" recommendation |
| Q4 | Follow Group media permissions. | The earlier "all admins edit" recommendation |
| Q5 | Match Group media attribution. | The earlier "Group name" recommendation |
| Q6 | No audience-selection system; the audience-based design is withdrawn. | The earlier simpler-audience recommendation |
| Q7 | One persisted pending mechanism, resumed on return; no background infrastructure. | The optional Vercel Cron |
| P1 | Follower contributions keep cross-context owner history; Admin contributions belong only to their originating Group; a dual-role user's two identities stay separate. Media is corrected first (4.0). Hidden and departed Admin contributions are an accepted limitation with no workaround. | The earlier choice between mirroring media exactly or making an Info Card exception |
| P2 | Only the original author edits an Info Card; admins hide; only the original author deletes; admin status grants neither. **Refined by C1.** | The earlier editing options |
| P3 | Immutable `creationContext` set by the creation perspective: Group perspective gives Admin contribution, Me gives Follower contribution; role changes never reclassify. Shared by media and Info Cards. | The earlier Info Card-only `createdAs` proposal |
| R1 | Deletion needs author **and** matching acting identity: Admin contributions only from the Group perspective of their originating Group; Follower contributions only from Me or the standalone Card; never another author's. Server-enforced; media and Info Cards alike. **Refined by C1.** | Current media behaviour, which lets an author delete from the Group perspective whatever the identity |
| C1 | Editing and permanent deletion only in the exact creation context: the standalone Card, Group A · Me or Group A · Group. Outside it, Media Centre shows "Created in" instead of Delete, and the Info Card menu shows the origin and + New only. Visibility and hiding are unchanged. The interface places the controls; the server enforces ownership and current Group permissions from the stored context (checkpoint 4.2b). | Follower contributions being editable and deletable on the standalone Card (P2, R1) |
| C2 | Delete and Hide are separate: Delete is permanent, author-only and only in the creation context, and never silently hides; Hide is for current admins on any contribution originating in their Group, including their own Follower contributions seen in the Group perspective. | The earlier open point on dual-role Hide (O2) |
| C3 | All four Info Card workflows (Creator, standalone Personal, follower Group, admin Group) keep unfinished drafts in the existing My Drafts. Unsaved Group drafts reopen directly in the shared editor, identified by origin and authorised from the stored context. Saved cards are never edited through My Drafts. An exception to C1's navigation only. | Redirecting Group drafts through Group and Card navigation (O3); a client-supplied `groupContext` |
| V1–V7 | Admin contributions (Info Cards and media) also appear in the Me of every active follower of their Group, sorted like all items, with no private icon and no mute. Inspecting a follower shows only their contributions unless the central **Include Group content** toggle is on (off by default, reset on leaving the deck, a "+ Group" tag, no extra height). A later per-contribution option, `audience: "group-perspective-only"`, needs no migration. Supersedes "Admin contributions never appear in Me" for followers of the originating Group (specification, V1–V7). | Admin content reaching only followers who open the Group perspective |
| C4 | A former follower or admin cannot edit or delete contributions created in that Group context; rejoining with the role restores it. Visibility and hiding unchanged. Managing past Groups' items is backlog (section 9). | The earlier open point O1 |

---

## 7. Risks and uncertainties

- **Shared production database.** Local or phone testing outside the disposable runner writes production data.
- **Smaller text area (5).** Existing test cards may no longer fit and will show overflow states. This is accepted under D1.
- **Measurement complexity (9).** Per-segment rendering multiplies measurement callbacks, and the trusted Chromium check must combine them identically. This is the highest-effort Phase 2 checkpoint.
- **Shared opening animation (6).** Extracting it must not change the stack's timing. Existing motion tests guard this.
- **Return-only completion (10).** Pending cards complete only when the owner returns to a relevant interface. My Drafts and the pouch must make that visible.
- **New indexes (Phase 4).** The owner and shared Info Card indexes need approval and explicit installation in Atlas before 4.2 is deployed.
- **Ownership checks (Phase 4).** A Group branch beside the existing owner checks must stay explicit. Unknown kinds stay denied.
- **Identity drift (4.0 onwards).** Any new query or permission that compares `authorUserId` with the viewer without the identity check would re-mix a dual-role user's contributions. All such checks go through `contributionIdentity.ts`, and the comment there explains why.
- **Owner-history paging (4.0).** The owner page merges two sources with separate counts. The filter must be on the shared `baseGroup`, not only on the page query, or totals and cursors drift.
- **Upload retries across a deploy (4.0).** An upload retried by a client from before the change, without `creationContext`, is rejected by the stricter command. Client and server ship together, so this affects only an upload in flight during deployment.
- **Known limitations (accepted).** Hidden Admin contributions are unreachable even by their author; departed or demoted admins without Group perspective access cannot reach or delete their Admin contributions (section 2.6, section 9).
- **Admin content in Me (4.5).** The Me media page assumes every row is the viewer's own (totals, cursors, author name, delivery). A third source must keep totals, cursors and `start` in step, or paging drifts. Existing Admin content becomes visible in followers' Me on deploy, and followers cannot mute it, so a heavy posting admin can crowd a stack; the per-contribution option (V6) is the planned relief.
- **Inspection toggle (4.5c).** Changing the follower list and grid DOM can disturb scrolling, focus and selection. The state must reset on leaving the deck, or an admin may mistake Group content for a follower's own work; the "+ Group" tag guards against this.
- **Creation-context drift (4.2b onwards).** Any new write path for a Group item that skips the shared guard would reopen cross-context management. Media deletes go through `contributionIdentity.ts`, and every Info Card write goes through `manageable`, which reads the context from the stored record.
- **Departed members (4.2b, C4, accepted).** A former follower or admin cannot manage their contributions from that Group until they rejoin with the role. No workaround in this work.

---

## 8. Execution strategy

### 8.1 Every checkpoint

1. Investigate the relevant existing code. Implement only the approved scope.
2. Run the checkpoint's focused tests, its regression gate (section 4), `npm run typecheck` and lint on changed files.
3. **Commit the checkpoint separately**, with a descriptive commit message without apostrophes, even when human review follows.
4. Report: commit hash, summary of changes, test results, remaining risks.
5. Never push, merge or deploy without explicit authorisation.

### 8.2 Approval gates and model recommendations

| Checkpoint | Recommended model | Effort | Human approval |
| --- | --- | --- | --- |
| 5 — Card dimensions, stack and colours | Sonnet | Medium | Yes |
| 6 — Empty pouch | Sonnet | Medium | Yes |
| 7 — Media attachment UI | Sonnet | High | Yes |
| 8 — Portrait video borders | Sonnet | Low | No, if straightforward |
| 9 — Info Card formatting | Opus | High | Yes |
| 10 — Automatic publication | Opus | High | No, if within approved scope |
| Phase 4.0 — Group media contribution identity correction | Opus | High | Yes |
| Phase 4.1 — Verify media patterns | Opus | High | No, unless discrepancies found |
| Phase 4.2 — Personal Info Cards in Groups | Opus | High | Yes |
| Phase 4.2b — Creation-context editing and deletion | Opus | High | Yes, before 4.3 |
| Phase 4.3 — Group Info Card backend | Opus | High | No, if within approved scope |
| Phase 4.4 — Group Info Card client | Opus | High | Yes |
| Phase 4.5a — Info Cards in followers' Me (after the Atlas step) | Opus | High | No, if within approved scope |
| Phase 4.5b — Media in followers' Me | Opus | High | Yes |
| Phase 4.5c — Inspection toggle | Opus | High | Yes |

- **Approval checkpoints:** test, commit, report the changes with a concise manual testing checklist, then **stop and wait** for approval.
- **Other checkpoints:** test, commit, record the report and **continue automatically**.
- **4.0:** an approval gate after implementation and testing, before 4.1, because it changes permission-sensitive media behaviour that is already in use.
- **4.1:** becomes an approval gate if it finds a contradiction between the media implementation and an explicit requirement.

### 8.3 Exceptions: stop and ask

Stop and ask for approval, at any checkpoint, if:

- a consequential product decision arises that the specification does not cover;
- a change would materially expand the agreed scope;
- a database migration, a new index or a potentially destructive operation becomes necessary (this includes the Phase 4 Info Card indexes);
- automated tests reveal a significant unresolved regression;
- new infrastructure would be needed beyond what was approved;
- the media-item implementation contradicts an explicit requirement (specification mandatory consistency rule).

Do not stop for routine implementation decisions, minor technical trade-offs or issues adequately covered by automated tests.

### 8.4 Credit efficiency

- Use the recommended model and effort as a guide: Sonnet for straightforward implementation, Opus for complex reasoning.
- Avoid prolonged investigation of non-critical issues. Checkpoint 8 defers rather than digging.
- Reuse the existing disposable harness and fixtures; do not rebuild test infrastructure.

### 8.5 Implementation sequence

1. **Checkpoint 5:** card dimensions, stack and colours. **Approval gate.**
2. **Checkpoint 6:** empty pouch. **Approval gate.**
3. **Checkpoint 7:** media attachment UI. **Approval gate.**
4. **Checkpoint 8:** portrait video borders. Continues automatically; defers if not straightforward.
5. **Checkpoint 9:** Info Card formatting. **Approval gate.**
6. **Checkpoint 10:** automatic publication. Continues automatically if within scope.
7. **Phase 4.0:** correct Group media contribution identities. **Approval gate.**
8. **Phase 4.1:** verify media patterns. Continues automatically unless discrepancies are found.
9. **Phase 4.2:** Personal Info Cards in Groups. **Approval gate.** Index installation needs its own approval.
10. **Phase 4.2b:** creation-context editing and deletion for media and Info Cards. **Approval gate before 4.3.**
11. **Phase 4.3:** Group Info Card backend. Continues automatically if within scope.
12. **Phase 4.4:** Group Info Card client. **Approval gate.**
13. **Atlas index installation (Step 0 of 4.5):** approved; run before 4.5a, reporting before and after.
14. **Phase 4.5a:** Info Cards in followers' Me. Continues automatically if within scope.
15. **Phase 4.5b:** media in followers' Me. **Approval gate.**
16. **Phase 4.5c:** the Include Group content toggle. **Approval gate.**

---

## 9. Future work

### Distinguishing Admin media in the Media Centre (backlog only; not in scope)

- Followers should be able to see quickly which media in the Media Centre came from admins. Info Cards already distinguish Admin content by their teal colour and "Group" type label; media has no equivalent beyond the "By:" attribution.
- Backlog only: find a subtle, low-height distinction for Admin media. It is not part of checkpoints 4.5a–4.5c.
- Considered and **abandoned** for now: extending the "Include Group content" toggle to the Group perspective (a narrow Admin-only default there). The toggle stays an inspection control only. Reasons: it would change the Group perspective's default and complicate admin moderation, and Admin content already reaches followers through Me (V1).

### Central media management (investigation only; not in scope)

**Problem:**
- Media items can originate in standalone Cards, in followers' Me perspectives and in Group Admin perspectives, and where they can be found and managed depends on that context.
- After the 4.0 correction, hidden Admin contributions, departed members and role changes can leave authors unable to locate or manage their own uploads.

**Possible future solution:** a central Media Centre, independent of individual Decks, Cards and Group Experiences. It would hold references to a user's uploads across contexts and give one consistent place to find and manage them, while preserving each item's original ownership and visibility rules.

**Status:**
- To investigate in future.
- Do not build a Media Centre, management UI or additional access routes as part of this work.
- It would also be the place for users to manage contributions from Groups they have left (C4). Backlog only.
- The Group Experience engineering plan has no existing backlog entry for this; its closest notes are the deferred moderation and history interfaces in §11.2.

