# Personal Info Cards — Engineering Plan

**Date:** 28 October 2026

**Repository baseline:** `feat/info-cards`, `de7d378` (`feat(info-cards): enable trial media uploads and verify live Cloudflare workflows`). No newer commit was present when this final planning pass began. This document was already untracked; no existing application changes are overwritten.

**Status:** Final implementation plan, incorporating the finalisation attachment and the subsequent explicit decisions on My Drafts and attachment dates. **Planning only: no application implementation is authorised by this task.** Once implementation is separately authorised, checkpoints A–E may proceed in one autonomous run with checkpoint tests and progress recording, not repeated product-approval requests.

**Authority:** The latest explicit product decisions override earlier proposals in this document and conflicting historical shared-feature wording. [QUESTIONS](#questions) records the resolved questions and remaining engineering checks; no blocking product questions remain.

## 1. Executive summary

Personal Info Cards are independently owned, permanently private notes associated with the signed-in user's **CardData for a CardTemplate**, not with the shared CardTemplate, an individual step or a Deck. Both an author and a follower can create one through the pouch in an authorised working CardData context. A canonical Library preview is not such a context.

- Reuse `infoCards`, `infoCardVersions`, the existing Info Card editor/controller, maths source/renderer, media provenance, exact-publication delivery and transaction infrastructure. Add immutable personal purpose/origin; do not build another note domain.
- Keep local personal reference IDs, **explicit attachment timestamps**, and an independent list revision on existing CardData. Read inherited references through the existing actor-owned `historySourceCardTemplateId` chain; do not copy ancestor arrays, notes or dates into forks.
- Save creates a private immutable usable version and, on first Save only, attaches it atomically. Retry receipts acknowledge the original operation and never reattach removed content. Ordinary autosave still accepts incomplete drafts.
- One pouch contains shared, local and inherited entries in **attachment-date order, newest first**, regardless of source. This supersedes the finalisation attachment's original-creation-date proposal: the owner subsequently required newly attached older material to move to the front and explicitly required an attachment-date property. Edits, Info Card republication, reopening and list reordering do not promote an existing attachment.
- Reuse the existing editor inside a thin local native-dialog shell, leaving consultation, StepView, player and activity mounted. Save/Edit/Remove keep the pouch open and update its pinned snapshot only at the explicit successful operation boundary.
- Add the approved **bottom-right three-dot menu**: shared cards offer only `+ New`; own personal cards offer `+ New`, `Edit`, `Remove`. Zero working attachments expose one visual `+` in the open empty pouch, not a fabricated card or toolbar.
- Every available Info Card face has the actual card creator's username **centred at the bottom**. Media stays bottom-left and contextual dots bottom-right. Personal faces use approved muted sage `#263B36`; shared faces retain their existing surface.
- Personal cards are excluded from Library and shared pickers **even for their owner**. The existing owner-only **My Drafts** workflow includes unfinished personal work. Clean saved and removed personal cards are not recovery-list entries. Remove retains data; inaccessible clean removed records are an accepted V1 limitation.
- Owner-only application privacy remains mandatory. Direct public R2 image-URL exposure for non-sensitive notes is an **accepted temporary risk for the 10–20-person trial**, not a new blocker or a claim that private storage is verified.

**Highest-risk work:** permanent purpose enforcement across generic APIs; atomic first Save/reference guards; attachment-date preservation across canonical writers and forks; independent per-source list freshness; and stable selection/focus across modal authoring and controlled snapshot replacement. These are addressed using existing repositories, CAS, receipts, history traversal and mounted state—not new collections, ancestry frameworks, caches or media schedulers.

## 2. Confirmed requirements and scope

### 2.1 Authority and decision labels

This document consolidates the original Personal Info Cards investigation, the verified fork-inheritance correction, the attached **Finalise the Personal Info Cards Engineering Plan** task, and the subsequent answers approving My Drafts recovery and attachment-date ordering. The latest answers supersede conflicting earlier wording.

References:

- [Shared functional specification](../../../design/features/info-cards/info-cards-functional-spec.md), especially §§2, 5–11.
- [Shared engineering plan](info-cards-engineering-plan.md), especially §§4–8 and deferred-work §13.
- [Phase 4 handoff](phase-4/README.md), [Phase 5 report](phase-5/README.md), [current maths integration](../../../../tests/info-maths/README.md), and [accepted media trial policy](info-card-media-security-backlog.md).

**Labels:** **Approved** = explicit product requirement; **Existing** = inspected repository behaviour; **Engineering decision** = recommended implementation within that behaviour; **Implementation check** = bounded verification, not another approval gate. An unforeseen contradiction affecting visible behaviour or permissions still requires escalation; routine technical choices do not.

Historical shared documents contain superseded “no maths,” 157px prototype sizing and original index/provider gates. Current code supports optional `latex-v1`, a common 240×204px face and advisory maths overflow, and has an explicit public-image trial allowance. Preserve those later decisions. No unrelated document is changed here.

### 2.2 Approved feature requirements

| Area | Required behaviour |
| --- | --- |
| Entry | Create new personal Info Cards only through the pouch in an authorised working Card, whether author-owned or followed. No personal creation from canonical Library previews. |
| Scope and ownership | Actor-owned CardData for the whole CardTemplate; same notes across Intro/Steps 1–3 and Decks containing that template. Permanent private personal purpose and immutable origin. |
| Save | One Save, no Publish or visibility selector. First usable private version and attachment commit atomically; incomplete autosave remains possible. |
| Common menu | Bottom-right three dots; shared: only `+ New`; owner-personal: exactly `+ New`, `Edit`, `Remove`. No action row above the stack. |
| Empty pouch | Working count-zero pouch remains available; open empty state has one visual `+` and existing close behaviour, no instructional text or fake Info Card. |
| Common face | Actual card creator username centred at bottom on every available face; existing media bottom-left, contextual dots bottom-right. Approved sage personal background. Fixed outer dimensions. |
| Successful operations | Save selects the new card; Edit keeps the same card; Remove selects the next surviving position in the previous visible order. Pouch remains open. Cancel restores prior snapshot/selection. |
| Ordering | Mixed shared/local/inherited entries by stored attachment date, newest first, deterministic ties. Old material newly attached moves forward. Content edits/publications do not change that date. |
| Inheritance | Reuse same-actor CardData history. X → Y → Z resolves source attachments without copying them; inherited Edit/Remove targets the actual original source. UI says only `Remove`, without exposing ancestry. |
| Discovery/recovery | No personal Library or shared-picker entries. Existing My Drafts includes incomplete personal cards and saved personal cards with unfinished edits; clean saved and removed cards excluded. |
| Removal | Association-only, no deletion, new confirmation, reattach picker or descendant-only hiding. Clean detached records may be inaccessible in V1. |
| Privacy/media | Owner-only application APIs, no foreign CardData leakage. Accepted non-sensitive public-image trial; preserve signed new videos, exact-version grants and existing provenance. |
| Compatibility | Shared publication/adoption, Library and My Decks sorting/navigation, CardData progress/media, pouch geometry/animations, mounted activity/player and current maths rules remain intact. |

### 2.3 Non-goals and bounded visual change

No personal Library, separate pouch, consultation tabs, step-specific notes, reuse picker, public promotion, colour setting, badge, new inheritance pointers, note-copying workflow, retention worker, deletion UI, new media renewal manager or broad storage migration. No search or additional management controls.

The approved footer is a deliberate **common-face change**: a little less body space is permitted to accommodate centred authorship and corner actions. It is not permission to enlarge/shrink the face, reduce fonts, silently clip essential source, add scrolling, change mathematical publication rules or redesign the pouch.

Checkpoints A–E are the personal feature's implementation structure, not new numbered phases appended to completed shared Info Cards Phases 1–5.

## 3. Existing architecture

Code references below are relative to the baseline above. Appendix B groups the implementation inventory.

### 3.1 Canonical content versus personal data

**Existing:** `src/lib/cards/model.ts:21–76` defines Card/Deck roots, drafts and immutable versions. Ordered shared `CardContent.infoCardIds` is part of the main-card content. Changing those attachments is an author edit, publication and follower-adoption event. Info Card content updates are independent.

`CardData` lives in `users.cardsData`, not a separate collection (`model.ts:78–107`). It is keyed within each user's document by `cardTemplateId` and contains adopted main version, completion, signals, reflection, personal media, tests and timestamps. DeckData owns membership and deck selection. Neither series ownership nor main-template ownership conveys another user's CardData access.

`CardRepository.ensureCompositionCardData` (`repository.ts:825–847`) and the direct working-entry initializer (`949–961`) preserve existing records and use guarded `$push` for missing template IDs. This is an application invariant, **not** a database uniqueness constraint. A unique multikey index would not prevent duplicate matching elements within one user's document. New personal commands must reject ambiguous duplicate CardData rather than update an arbitrary match.

The existing `personal-lifecycle.integration.ts:68–105` tests global personal reuse across Decks and retention through archive/re-entry. Reference-only Copy keeps the same template ID (`repository.ts:255–325`), so it naturally sees the same user's CardData. A **fork** has a new template ID: `forks.ts:37–72` constructs fresh CardData, inherits selected current state and sets the existing personal history pointer. Empty local media/attachment arrays do **not** mean an empty resolved experience. See §3.7 for the verified live ancestry mechanism.

### 3.2 All material CardData writes and projections

| Path | Current behaviour | Personal feature implication |
| --- | --- | --- |
| `cards/domain.ts:84–89` | Fresh CardData defaults. | Optional list/revision may remain absent, meaning `[]`/`0`. |
| `cards/repository.ts:843–844,957–958` | Initialize only missing CardData. | Preserve existing personal IDs; never add a per-Deck duplicate. |
| `repository.ts:140–181` / `updateAdoption.ts:52–73` | Adopt main version; update nested step-related fields. | Preserve personal association independent of adopted version. |
| `repository.ts:673–688` / `forks.ts:37–72` | First fork publication initializes selected current state and an actor-owned history pointer. | Keep the new local personal list empty; resolve original notes through the existing ancestry pointer, not copied arrays. |
| `repository.ts:900–970` | Archive/restore writes DeckData. | Retained CardData/notes survive; no orphan cleanup. |
| `repository.ts:1022–1086,1129–1163` | Dates/reflection/media/completion/readings use nested updates. | Preserve new fields and association revision. |
| `assessments/repository.ts:24–36,78–87` | Exactly-one record validation and list-specific CAS revision. | Reuse this pattern for personal association commands. |
| `cards/readModels.ts:44–78,123` | Working card DTO explicitly projects personal fields and shared info IDs. | Add own personal IDs/revision explicitly; an added schema field alone is insufficient. |
| `components/decks/types.ts:157–183`; layout builders | Typed working card; layout adapters largely spread it. | Extend the type and audit every explicit projection. |
| `cards/workingCardStore.ts:5–49` | Actor/template-keyed progress store; freshness based on adopted version. | Add independent association freshness; same main version can have newer personal references. |
| `cards/personalHistory.ts:20–45`; `forks.ts:76–103` | Existing traversal exposes original-context tests/chats/media. | Extend its readable fields with local personal refs/revisions and reuse its traversal; no new ancestry or content copying. |
| `scripts/migration/plan.ts:95–135` | Historical whole-document migration refuses sources with `cardsData`. | No rerun or modification is needed for this additive feature. |

No active runtime writer deleting CardData on ordinary Card/Deck removal was found. Missing/inaccessible parent content can prevent a working view, but that must not erase independently retained notes.

### 3.3 Existing Info Card lifecycle and publication

**Existing:** `src/lib/infoCards/model.ts:5–29` separates roots/drafts, immutable publications, series, decorated publication DTOs and exact media contexts. A root has stable ID/owner, effective visibility, draft intent, content revision and reference guard revision. Publications carry `(infoCardId, version, sourceRevision)`, private/public visibility and immutable content. **Published is not synonymous with public.**

`InfoCardRepository.save` (`repository.ts:126–141`) accepts incomplete/oversized drafts with revision preconditions and exact retry handling. `publish` (`144–183`) checks media readiness outside retriable transactions, then rechecks the revision, validates content, inserts an immutable publication and clears the draft atomically. The unique `(infoCardId, sourceRevision)` index supplies publication receipt recovery. Publication creates no main-card version, adoption record or progress event.

Current private creator cards can later become public; own private publications are included in the catalogue and selectable as shared attachments. Therefore **ordinary `visibility: "private"` alone cannot represent permanently personal content**.

**Existing creator behaviour:** all owner Info drafts are listed independently of decks (`repository.ts:203–208`); clean private creator publications are accessible through the Info Cards Library. Personal roots do not exist yet; the new personal-purpose exclusions and approved unfinished-work predicate must be implemented rather than inherited from this broad current query. The editor loader (`queries.ts:11–20`) reads the root, latest publication and retained series. Opening a clean publication does not itself create a draft.

### 3.4 Content, maths and media

- Content remains a source string plus optional `bodyFormat: "latex-v1"`. Missing format is literal legacy text. Reuse `InfoDraft`/`InfoContent`, not a new note document format or HTML storage.
- Current maths publication validates syntax/safety through pure `prepareContent` (`repository.ts:152–159`). Browser measurement is an optional owner diagnostic, not a Save/publication prerequisite. Valid overflowing mathematics may be saved/published; do not reinstate an obsolete mandatory certificate or shrink source.
- The shared face is 240×204 logical pixels, 12px padding, 1px border and 214px normal body width. Maths uses the approved local Liberation font profile; legacy text retains Arial/Helvetica. See `InfoCardFace.module.css:1–18` and the current [maths record](../../../../tests/info-maths/README.md).
- `media.ts:35–49,67–117` binds allocations/proofs to actor and Info ID, validates saved media, and authorises exact draft revisions/publication versions. The registry prevents legacy media routes from becoming alternate grant endpoints. New Info videos are signed-only and checked for ownership/readiness.
- `media.ts:14–20` explicitly permits the accepted public-image trial without claiming private storage verification. Application-proxy authorisation does not protect the direct public R2 URL. §10 and Appendix A distinguish this from application privacy.

### 3.5 Current consultation flow and privacy boundary

`GET /api/card-templates/[cardTemplateId]/info-cards` authenticates the actor and reads the exact displayed main version plus latest authorised Info publications in one Mongo snapshot (`infoCards/queries.ts:100–106`). Working mode validates active membership/effective composition/adopted main version; canonical mode validates the immutable public main version actually displayed (`cards/repository.ts:1093–1127`). The server, not a client list, determines shared attachment authority.

`publicationSnapshotEntries` (`queries.ts:86–97`) preserves order and anonymous unavailable positions. Its ACL currently allows public or own private creator publications. `decorate` batches usernames, distinguishing Info Card owner from series creator (`32–37`). There is no persisted consultation or content cache.

`infoCardConsultationClient.ts:6–29` performs actor/context checks and validates entry count/IDs against the expected **shared** list. `FocusedCardView.tsx:356,567–578` also derives count/request state from shared IDs only. Extending just the backend would fail that client contract.

HTTP boundaries already provide initiating-actor checks, `private, no-store` and `Vary: Cookie` (`cards/http.ts:31–42,51–59`; `infoCards/http.ts:7–32`). Parked sharing metadata is not authority; active shared-deck routes return 410. No operational coach-sharing grant to read personal CardData was found.

### 3.6 Current pouch, editor and attribution limitations

- Zero attachments are suppressed by `FocusedCardView.tsx:567`, `StepView.tsx:182–191` and `InfoCardPouch.tsx:39`. The current physical stack reads `cards[index]` and cannot safely receive `[]` (`InfoCardPhysicalStack.tsx:257`). An empty creation shell must be explicit, not a fabricated Info Card.
- `FocusedCardView` owns suspension/isolation and keeps StepView/player/activity mounted. `InfoCardConsultation` uses a transparent native modal, physical stack and nested media viewer. It preserves selected publication and focus. Leave that ownership intact.
- The editor currently hardcodes router/history changes, Library return, visibility/Publish controls and source-revision recovery (`InfoCardEditor.tsx:25–119,173–185`; controller `10–13,91–169`). Merely relabelling Publish would not make a safe personal Save flow.
- Ordinary route navigation unmounts the focused card and arbitrary activity subtree; `AppShell.tsx:57–102` can restore a working selection but not arbitrary activity state, step focus or playback position. The player cleanup resets its instance on unmount (`CloudflareHlsVideoPlayer.tsx:609–612`).
- `PublishedInfo` already carries `ownerUserId` and `creatorUsername`; the consultation face mapper currently drops both. `InfoCardFaceContent` only has **series** creator username (`InfoCardFace.tsx:10–17`). Library displays card attribution outside the face. The required centred bottom credit and bottom-right contextual dots are deliberate common-face changes; they are not present yet.
- `creatorUsernames` projects username only and supplies `Unknown creator` (`cards/creatorAttribution.ts:5–10`). `auth.ts:19–28` provides no public full-name field. Use username as the existing creator name; never substitute email/contact/session data.

### 3.7 Verified fork/media ancestry and required personal-note continuity

The original plan correctly identified that fork construction does not copy media arrays, but incorrectly concluded that a new local personal list should exclude ancestor notes from consultation. The application already makes original-context media available without copying. The product clarification requires personal Info Cards to reuse that mechanism.

#### Existing stored relationship and creation timing

There are two different relationships; do not confuse them:

- Canonical `CardTemplateRoot.forkedFrom` and per-step `forkedFrom` record authoring lineage/version (`cards/model.ts:56–61`; `forks.ts:14–33`). Those are not permission to read any learner's personal history.
- `CardData.historySourceCardTemplateId` is the **authenticated user's immediate personal-history source** (`model.ts:89`). `inheritForkCardData` sets it to that user's source CardData ID (`forks.ts:37–72`). It is already the required parent pointer; no new personal-note parent is needed.

`cardForkInSession` creates the new canonical **draft**, not personal history (`repository.ts:341–383`). At the fork's **first successful main-card publication**, `publishCard` obtains the publishing actor's own `user.cardsData`, requires no target record, finds at most one immediate source record and calls `inheritForkCardData` (`repository.ts:672–683`). The target has selected current completion/signals/date/reflection but empty local tests/chats/media. The source record is unchanged. Receipt recovery and later main republication do not repeat this initialisation (`651–655,685–688`).

If the actor has no source CardData at first publication, no personal inheritance record is created by that branch. Later normal working entry may create ordinary empty CardData, but does **not** manufacture a history link from canonical ancestry. Preserve that distinction. An archived source Deck does not itself prevent inheritance from retained actor-owned source CardData; the Library-origin fork regression explicitly establishes this.

#### Existing resolution and frontend flow

1. `personalHistorySegments(records, currentId)` in `forks.ts:76–103` indexes only the supplied actor's CardData, traverses **current → immediate parent → further ancestors**, and returns each record once. It does not fetch canonical roots, another user's data or per-ancestor Deck membership.
2. `readablePersonalHistory` in `personalHistory.ts:20–45` safely projects each source record's current tests/chats/media, stripping untrusted display-origin fields. Invalid individual historical items do not invalidate unrelated readable items.
3. `projectWorking` in `readModels.ts:65–77` obtains those segments from `deck.personalRecords` and exposes `personalHistory`; current `mediaItems` stays separate. `personalCardHistoryDTO` (`14–18`) likewise reads only the authenticated user's records and does not require source membership.
4. `visiblePersonalMedia` in `personalHistoryProjection.ts:14–19` returns local media first, then the inherited segments' media with derived `sourceCardTemplateId` and `historyReadOnly: true`. The current segment is excluded from the inherited suffix so it is not replayed twice. `buildCardLayout` consumes that projection for the Card back (`components/cards/cardLayout.ts:107–123`).
5. `WorkingFocusedCardView.tsx:67–72,96–116` displays that combined media but directs removals to `item.sourceCardTemplateId ?? currentId`. The viewer also carries current and source identities separately (`components/media/CardMediaViewer.tsx:24–32`). `historyReadOnly` means the item is not a current upload input; it does **not** prohibit the owner's source-targeted removal.
6. Server media reads independently traverse the authenticated actor's chain, require the requested source to occur there, and select the original item (`cardMediaAccess.ts:31–43`). Caller `viewerUserId` must match the session. Admin/template ownership/canonical ancestry grants no other learner's media. Media allocations and records remain at their original source.
7. `removePersonalMedia` authorises the actor's exact source CardData without source Deck membership (`repository.ts:1065–1086`). `useWorkingDeck.ts:266–280` updates both the source and displayed descendant history segments after confirmation. This is the concrete **global source-removal from a fork** precedent; it is not descendant-only hiding.

#### Live history, multi-generation and missing ancestors

The pointer is established at initial publication, but its event/media arrays are **read live from retained source CardData**, not frozen at the canonical fork version or source adoption version. `currentAdoptedCardTemplateVersion` is only current metadata; `eventVersionAttribution: "not-recorded"` expressly avoids claiming an event-time version. Later source removals are visible in later authoritative reads. Selected current reflection/progress initially copied into Y is different: it is not repeatedly overwritten from X.

For X → Y → Z, traversal returns `[Z, Y, X]`, provided each same-actor record/link exists. A visited set stops cycles. There is no arbitrary depth cap. Missing, duplicated or malformed ancestor source records/pointers stop traversal at the break while retaining the usable prefix (`forks.ts:86–101`). It does not skip a missing Y to discover X through template lineage. Archive or loss/deletion of a **canonical ancestor** is not checked on this personal-history read; retained actor CardData remains usable. Deletion/loss of the **ancestor CardData record** itself is different and breaks the chain. The current displayed main card still needs its ordinary working-view authorisation.

Existing source evidence, inspected but not rerun for this documentation task:

- `tests/card-forks.test.ts:22–35,46–94`: empty local media, parent pointer, current-first traversal, adoption metadata, missing/duplicate sources, cycles, malformed data and a 512-record chain.
- `tests/card-forks.integration.ts:95–138,218–237`: initial-publication timing, source untouched, live source removals, archived/Library-origin continuity, no source record, multi-generation lineage and no repeat inheritance.
- `tests/personal-history-projection.test.ts`: original-context display, no current-segment replay, source-aware keys, source disappearance and actor-separated store mutation.
- `tests/card-media-access.integration.ts`: same-actor retained media without writes, foreign/admin/forged-source denial and ambiguous source failure.

#### Smallest compatible adaptation for personal Info Cards

Extend the **existing readable history segment** with that record's optional `personalInfoCardIds` and `personalInfoRevision`; reuse `personalHistorySegments` unchanged in its ancestry algorithm. The current CardData owns new attachments. Ancestor arrays stay on their original CardData. Do not copy arrays, create a note-specific chain or infer links from `CardTemplateRoot.forkedFrom`.

For consultation, flatten those actor-owned source segments into transient reference descriptors, then reuse the current Info publication snapshot join/ACL/decoration. Each available personal entry carries its validated source CardData identity. Check root owner/kind and `root.originCardTemplateId === sourceSegment.cardTemplateId`, **not necessarily the displayed fork ID**. These are Info-specific adaptations that media does not need: immutable saved versions, reference guards, partial-unavailable positions and source revisions. No second inheritance resolver is justified.

Traversal order remains current-first for finding the authorised source records, **not for pouch sorting**. Flatten valid shared/local/ancestor descriptors and sort the combined result by stored attachment date (§5). Shared attachments come only from the displayed main version; do not add ancestor shared lists already handled by canonical forking. Preserve original association dates across inheritance; no copied arrays, new timestamps on fork, source-block sorting or new parent pointers.

After source Edit, subsequent consultations resolve its latest authorised private saved version, without changing attachment date. Approved source-level Remove while viewing any descendant removes that original association; later source/descendant consultations omit it, with no descendant-only exclusion. Retain content but do not expose clean/removed personal roots in Library or My Drafts. Already-open snapshots remain pinned except the explicit acknowledged operation refresh in §8.3. The visible label is only `Remove`, without source/fork wording or new confirmation.

### 3.8 Further verified reuse and differences

- **Attachment dates are absent today:** `CardContent.infoCardIds` is an ID array (`cards/model.ts:21`), without an association timestamp. InfoRoot `createdAt` is written on root creation and is not a later attachment date; decorated publication DTOs do not currently expose it. The new approved ordering therefore requires explicit per-association metadata, not a client sort by Info publication time.
- **Canonical version writer:** `CardRepository.publishCard` directly inserts immutable main versions (`repository.ts:668`). Other graph/draft/fork writers feed it and must preserve date metadata; checking this insert alone is not sufficient.
- **Attribution precedent:** `CardCreatorAttribution.tsx` plus `globals.css:4642–4645` centres actual main-card authorship independently of side controls. Its source-lineage popover is not an Info author tooltip and must not leak personal ancestry.
- **Menu precedent:** `DeckMenu.tsx`/`OverviewMenu.tsx` supply restrained three-dot styling, outside-pointer dismissal and Escape/focus-return conventions. Their Deck-specific links/archive commands and incomplete arrow-key handling are not a reusable Info management controller.
- **Authoring precedent:** real Info authoring is `InfoCardEditor`, not `CreatorEditModal`, a nested ordinary title/media editor in `CreatorDragLab.tsx:375`. Reuse the former's form, maths/media validation and controller.
- **Draft journal limit:** `infoCardEditorController.ts:51–78` stores only a pending submitted command and clears it after acknowledgement. It cannot enumerate acknowledged unfinished drafts on another device. Existing `creatorDraftEntries.ts` paginates owner Info drafts and dispatches their editor routes; extend that path with personal scope/context.
- **Dialog difference:** `useInfoCardDialog` gives native modal/body-lock/focus conventions; `LibraryDialog` has Library-specific surface/header styling. Personal authoring needs a thin scoped shell/embedded mode, not a second form or global overlay manager.
- All findings above are source inspection, not a fresh test run. No existing fork/media/Creator behaviour has been modified by this planning task.

## 4. Architecture decisions and alternatives

| Decision | Alternatives considered | Engineering decision within approved behaviour |
| --- | --- | --- |
| Association | Another collection or copied fork arrays adds identity/repair work. | Existing CardData local IDs, attachment dates and list revision; existing history chain resolves ancestor references. |
| Storage | Draft-only lacks immutable usable/media snapshots; ordinary private creator cards can become public; another domain duplicates functionality. | Immutable personal purpose/origin in existing Info domain, with private immutable saved versions. |
| Save | Separate publish and attach can strand a version or duplicate retries. | One first-Save transaction; existing source-revision receipt. Later Save never appends. |
| Ordering | Original creation, latest content publication and current-first source grouping no longer match the approved rule. | Store attachment date on each association. Sort the combined authorised snapshot by that date, not its content's age or source. |
| Shared timestamp storage | InfoRoot cannot represent different attachment dates on different main cards. A side collection/version-only inferred date adds joins or loses actual draft attachment time. | Optional server-owned `infoCardAttachedAt` map beside `CardContent.infoCardIds`; it travels with main drafts/immutable content. Additions receive a server date when actually persisted, not merely when selected in an unsaved modal. |
| Personal timestamp storage | Root creation precedes usable Save; latest publication changes on edits. Inference alone does not meet the explicit-property requirement. | `personalInfoCardAttachedAt` map beside CardData IDs, written in the atomic first Save. Inherited reads retain source dates without copying them. |
| Editor | Route exit loses live activity state; a second editor duplicates maths/media/recovery. | Parameterise the existing form/controller and use a thin local dialog shell. Ordinary Creator remains its existing route. |
| Snapshot update | Remounting/reopening replays animation and loses selection. Blind local append is not authoritative. | After a confirmed mutation, reuse the authorised consultation read and atomically replace snapshot plus stable-ID selection in the same mounted consultation. See §8.3 for failure handling. |
| Discovery | Owner Library would contradict explicit exclusion; sessionStorage alone cannot recover acknowledged drafts cross-device. | Existing My Drafts for unfinished personal work only. Accept inaccessible clean removed notes, with no new recovery/reattach interface. |
| Face | Side-aligned credit depends on unequal controls and collides with menu/media. | Common centred username with independent absolute centring; scoped footer bands for controls and text. |
| Fork changes | Template lineage or copied associations could expose another learner's data. | Actual same-actor CardData history, live source semantics and approved source-level Remove; no new ancestry framework. |
| Media | A storage migration or new refresh manager is unnecessary for the approved trial. | Existing authorisation/provenance/signed-video paths plus explicitly accepted public-image allowance. |
| Infrastructure | New cache, store, scheduler, relation collection or generic menu system. | None required; reuse actor-keyed working store, current transaction helper and local menu/dialog patterns. |

## 5. Data model, attachment dates and consultation contracts

All declarations below are **planned additive changes**, not claims that the feature exists today.

### 5.1 Personal purpose and local CardData fields

```ts
type InfoPurpose =
  | { kind?: "creator"; originCardTemplateId?: never }
  | { kind: "personal"; originCardTemplateId: string };

// Existing embedded CardData; lists are local, not flattened ancestry.
type PersonalInfoCardDataFields = {
  personalInfoCardIds?: string[];
  personalInfoCardAttachedAt?: Record<string, Date>;
  personalInfoRevision?: number; // missing === 0; independent of adopted version
};

// Additional existing main-card content field, alongside infoCardIds.
type SharedInfoAttachmentFields = {
  infoCardAttachedAt?: Record<string, string>; // server-generated ISO UTC dates
};
```

Dates are association metadata: the map key is an ID present in that list. Mongo CardData uses Date consistently with its existing personal timestamps; JSON/main content uses validated ISO UTC strings. Transport serialises dates explicitly. Use the existing ID validator and safe own-key lookup; reject unsafe keys/malformed incoming maps and never merge an untrusted object into a prototype.

Owner, purpose and origin are immutable. Personal effective/draft/publication visibility is always private, including when stored data is corrupt. A missing legacy kind means creator. Explicit creator-purpose queries match only absent kind or `"creator"`; unknown kinds do not inherit public permissions. No personal-series namespace, extra parent pointer, association collection or Deck-scoped CardData is introduced.

### 5.2 Attachment-date assignment and writer coverage

**Approved rule:** a date is stored whenever an attachment is actually committed. Selection followed by Cancel is not an attachment. The date belongs to that association, not to InfoRoot, publication, user session or last-opened state.

- **Shared:** the first successful main draft/content write adding an ID assigns server `now` in the existing guarded transaction. Persist dates with the draft and copy them unchanged into immutable main publications. Info Card publication or main-card republication does not refresh retained dates.
- **Personal:** first successful usable Save appends ID and date atomically to origin CardData. Autosave/root creation does not establish a usable attachment or its date. Later Save, clean no-op Save and receipt recovery leave it unchanged.
- Retained IDs keep server-stored dates through reordering and unrelated edits, regardless of client values. Removal drops only that association's map entry with the ID. A genuinely new shared attachment after a committed removal gets a new date; an old request/retry cannot change dates or resurrect removed personal content.
- An unsaved remove/re-add of the same shared ID is still the same persisted association, not a promotion. Re-add after a successfully persisted removal is a new association. No personal reattachment workflow is added.
- Shared associations carried into a fork preserve the exact source version's dates. New attachment edits in that fork receive new dates. Reference-only Copy retains main identity/version and therefore its existing dates. Personal ancestor associations are never copied or redated on fork, adoption or Deck entry.
- An old shared Info Card newly attached today sorts ahead of a personal card attached yesterday once the actor is viewing the main version containing that addition. Shared attachment visibility still follows main publication/adoption; an unpublished attachment cannot appear in a follower's pouch.

**Canonical writer audit:** extend the Phase 4 inventory, not only the modal Save handler. Normalise/validate timestamp metadata for `createPrivateGraph`, standalone/combined `cardForkInSession`, `createCardDraft`, `saveCardDraft`, `createAndAttachCard`, construction step moves and `publishCard`; preserve it in `copyOwnedCard`, Deck graph/fork orchestration, publication receipts/hashes, validators/equality, `creatorBoardState`, coordinator `cardContent`, `cardArchitectureAdapter`/private graph, working/canonical projections and presentation types. At this baseline `publishCard` is the sole direct runtime `cardVersions().insertOne` writer (`repository.ts:668`); indirect writers still require tests.

Do not accept caller-provided date changes as authority. For retained references use current authoritative draft dates, or the selected immutable source content when constructing a fork. Recover dates from the already-committed command/state on retry, rather than generating a second value before equality checks. Additions without client timestamps are valid. Reject malformed metadata, but a valid historical map missing entirely remains compatible. No-op comparisons normalise absent/empty maps and ignore untrusted proposals for retained dates; a genuine attachment change still follows ordinary publication rules. The normalizer is a small repository/domain helper, not a second persistence coordinator. Preserve the existing default-only constraints on `createDeckFork.newCards` and `createAndAttachCard`; this audit does not authorise accepting arbitrary content on those operations.

### 5.3 Legacy dates, ordering and unavailable entries

No data migration or historical rewrite is required. Old references have no attachment dates; **do not invent knowledge of their original attachment time**.

1. Use the valid stored association date.
2. For a legacy reference without one, use the authorised InfoRoot's immutable `createdAt` as a documented compatibility fallback, without persisting a guessed date on read or promoting every old reference on its next edit.
3. If neither date can safely be established, keep the position, sort it after dated entries and use deterministic tie-breaking. Do not drop or rewrite content.

Sort after authorisation and descriptor validation: effective date descending, then stable Info ID for available distinct entries, with source/occurrence identity only to disambiguate invalid/unavailable positions. The exact technical tie-breaker is not a visible new sorting option. Missing dates and unavailable entries do not create a new UI. Known association dates may order unavailable slots because they belong to the already-authorised attachment list; never join a forbidden root merely to learn its title, timestamp or owner.

Malformed/foreign/wrong-origin references remain generic unavailable positions; valid duplicate personal IDs are deduplicated after origin validation, never by an earlier invalid source that could mask a valid one. Preserve known invalid positions without exposing diagnostics or silently repairing arrays. Distinguish missing legacy date from corrupt content: a missing date alone does not make an otherwise authorised card unavailable.

Original InfoRoot creation dates remain unchanged for identity/history and the legacy fallback; they are **not** the new pouch sorting rule. Library retains its separately agreed latest-successful-publication ordering.

### 5.4 Invariants and compatibility

1. Personal roots are never generic-Publish targets, public-readable roots or canonical shared attachments—even on the owner's private main card.
2. Only initial successful Save attaches a newly created personal ID to its immutable origin. No arbitrary existing ID, other origin or old receipt can append.
3. Local lists are unique. Valid shared and personal lanes cannot share an ID because purpose guards are disjoint.
4. Personal associations/dates/revisions survive main adoption, publication, archive and cross-Deck reuse. Never replace the whole user/CardData record.
5. Remove changes only the source association, date and list revision. Root/content/draft/media remain. Removed roots are not My Drafts entries, even if an old dirty draft remains.
6. Direct owner content access may survive parent loss/removal, but it grants no working access or new association. Clean removed records have no V1 discovery UI.
7. Fork Y has an empty local list until something is created there, yet resolves X's retained references and dates through the existing same-actor history chain.
8. Canonical/shared DTOs never contain personal IDs, dates, sources, counts or revisions. Another actor never receives the current actor's ancestry.
9. Inherited Edit keeps original ID/owner/origin/date. Inherited Remove targets that source CardData revision, without local exclusions or copied references.
10. Missing lists/maps/revisions mean empty/empty/zero. Missing legacy dates use §5.3; absent and empty shared attachments remain semantically equal.

Current ambiguous/duplicate CardData fails closed. Missing/ambiguous ancestor records retain the existing traversal's usable prefix and safe stop. No arbitrary depth cap, new parent resolution or silent database repair. Do not add a user-visible note count cap.

### 5.5 Indexes and setup

Retain existing Info identity/version/source-revision, series, provenance and canonical reference indexes. Add one ordinary nonunique index on `users: { "cardsData.personalInfoCardIds": 1 }` for retained personal-reference deletion checks. No date-order index is needed for a bounded per-consultation in-memory sort, and a unique multikey index would not solve duplicate embedded records.

Extend explicit setup/readiness checks; do not create indexes on import or application requests. Existing twelve-index deployment does not include this new index. Verify idempotence and unchanged documents on disposable databases. Installing the new live index requires separate permission. Normal `npm run dev` deliberately uses Atlas production; it is not a test-seeding target. No schema/data backfill is proposed.

### 5.6 Working projections and consultation DTO

Add local IDs/dates/revision and the same optional fields on the **existing personal-history segments**, not a flattened stored list or new ancestry DTO family. Canonical presentation remains personal-free.

Proposed extension of the current response:

```ts
type PersonalAwareConsultation = {
  mainCardId: string;
  mainCardVersion: number;
  personalSources?: Array<{ // working mode only, actor-owned
    cardTemplateId: string;
    personalInfoRevision: number;
  }>;
  entries: Array<
    | { key: string; status: "available"; source: "shared";
        attachedAt: string | null; info: PublishedInfo }
    | { key: string; status: "available"; source: "personal";
        sourceCardTemplateId: string; attachedAt: string | null; info: PublishedInfo }
    | { key: string; status: "unavailable" }
  >;
};
```

Dates here are normalised effective ordering metadata; the stored attachment fields remain authoritative. `source` is derived from the authorised lane plus validated root purpose, not “this actor owns it.” Personal root owner must be the actor and origin must equal its validated source segment, which may differ from the displayed fork.

A generic unavailable entry contains **no Info ID, title, owner, series, reason or personal-source identity**. Use an opaque actor/context-bound stable key derived server-side from the reference identity, rather than an ordinal that changes after removal. A small keyed hash using existing server secret/crypto conventions is sufficient; it is not a new persisted consultation/session system. Do not return the raw invalid-reference ID as its key or log the hash input.

One Mongo snapshot authorises the exact displayed main version, reads the actor's retained CardData/history segments and resolves all creator/personal publications via the existing snapshot join. No per-ancestor HTTP requests or second publication resolver. Authorisation precedes decoration, date fallback and response assembly. Canonical mode has only shared entries, no personalSources or personal counts.

Client validation must change from “shared positions equal the whole response prefix” to checking shared membership/count against the displayed immutable main list, source-aware personal ownership/origin/revisions, unique available IDs and the actor/context. Mixed date sorting makes a shared-first prefix invalid. Authoritative snapshot source revisions need not equal a potentially stale local history projection. Keep ready count, order, attribution, selected exact publications and media contexts pinned until close or an explicit acknowledged operation refresh (§8.3). External edits alone do not splice an open pack.

## 6. Private Info Card lifecycle

### 6.1 Start, autosave and usable Save

1. `+ New` (or empty-pouch `+`) captures actor, displayed working Card/Deck/main version and origin CardData. For a new card the origin is the displayed Card, not its ancestor. Authorise the working context server-side.
2. Reuse stable-ID creation and empty personal draft storage. Do not attach on allocation, editor mount or autosave. Do not allocate multiple roots for repeated activation while one editor is active; reuse the current lazy-creation/controller convention.
3. Preserve series → title → explanation/media prerequisites, grouped series selection, maths format/source, 250ms serial autosave, field errors and media replacement/cancellation. No default title or generated personal series.
4. Save flushes/recovers pending autosave and upload/status work using existing safeguards, then commits a usable private version. Reuse complete-content validation: selected series, title/body, legacy capacity or valid maths preparation, media provenance/readiness. Existing advisory maths overflow is not converted into a blocking fit certificate.
5. First Save commits publication, ID, explicit attachment date and list revision together. Success means authoritative receipt, not a request having been sent. See §6.2 for lost responses.
6. After successful Save and authorised snapshot reconciliation, close only the editor; the **same open pouch selects the new ID**. No main/Deck Publish, route reload, automatic video resume or replayed emergence animation.

No public selector, Publish control, permanent-public confirmation or generic Create-mode switch belongs in personal authoring. Discreet Saving/Saved status remains.

### 6.2 Atomic first Save, receipts and deletion concurrency

Extend the existing repository transaction/receipt implementation rather than call generic Publish and append separately.

1. Verify owner, live root, personal purpose and immutable origin. Recover a matching consumed-source-revision receipt before any repeated provider work. A recovered receipt acknowledges history; it does not authorise another attachment.
2. For an uncommitted operation, check provider readiness outside the retriable Mongo callback. Inside it, reread root/receipt and recheck the exact draft/root revision, purpose, owner, origin, series and content.
3. **First Save only:** revalidate active working context and displayed/adopted main version, exactly one origin CardData and expected personal list revision. Take the same Info root `referenceRevision` guard used by deletion.
4. Insert private immutable content/receipt, clear draft and advance root revision. First Save additionally appends ID, sets server attachment date and advances origin personal revision with a narrow element-level CAS. Any unmatched guard throws and rolls back all writes.
5. Later Save changes private content only; it never appends, redates or requires origin Deck membership. Clean saved Save is an acknowledgement/no-op, not a publication of null content.
6. Retry uses the original receipt and then reads current root/association state. The first attachment date is the already-committed date, not retry time. Concurrent Save commands use root/list CAS and existing transaction retries, not last-write-wins whole arrays.

**Critical case:** Save succeeds → response lost → Remove elsewhere → retry. Return the historical acknowledgement and current removed state; never resurrect or newly date the reference. If the requested card is no longer attached, do not fabricate it in a local refreshed pack.

Two new notes saving against one list may conflict. Preserve both drafts and recover/read the current list before retrying the still-uncommitted operation. Do not silently overwrite another note or unrelated progress.

Deletion and first attachment must write the same Info root guard. A transactional reference scan alone permits write skew. If deletion wins, first Save cannot attach a tombstone; if first Save wins, deletion sees the retained personal reference. Existing canonical draft/historical protection remains.

### 6.3 Edit, Cancel and Remove

- **Edit:** load the owner's outstanding draft or latest saved content. Inherited Edit uses the existing Info ID and original source, not a new root on the displayed fork. Save preserves original owner/origin/attachment date and leaves the pouch open on the same ID with updated content.
- **Cancel:** finish recoverable draft persistence through current save/upload safeguards, but do not create a usable version/attachment or update the pinned consultation. Return to its prior selection and snapshot. Do not call an uncertain submitted Save “cancelled” until receipt recovery establishes the outcome. Preserve all entered source and prior saved media after an unsuccessful replacement.
- **Remove:** source-level association CAS removes only ID/date and increments that source revision. Retain root, private versions, outstanding draft and media. No Delete, new confirmation or inherited-source wording. Keep pouch open and select the next surviving entry from the **previous visible order**, wrapping; last removal shows the true empty state.
- Already-absent Remove is an idempotent relationship outcome only after reading current source state. Never overwrite newer unrelated changes. If a stored broken ID is removed through the owner association API, do not require disclosing/authorising its foreign root merely to clean up the actor's relationship. The generic unavailable face itself has no Edit/Remove menu because it lacks a safe owned identity.
- Failed Save/Remove keeps recoverable data and an existing-style actionable error. Do not pretend a rejected command changed a reference or content.
- Owner-only direct backend reads/edits can remain possible for retained roots, but there is **no V1 clean-detached discovery, recovery picker or reattachment**. Editing through a retained old URL never appends.

### 6.4 My Drafts recovery and accepted retained-data limit

**Approved during finalisation:** reuse existing **My Drafts** for unfinished personal work. Add a purpose-aware draft entry/context, not a new list or Library section.

Include:

- Owner personal roots with no usable saved version and an actual unfinished draft.
- Owner saved personal roots with unfinished draft changes **while their original association is still retained**. An archived/inaccessible main context does not itself erase the origin association.

Exclude clean saved personal cards and saved personal cards whose association has been removed, including removed roots with an old dirty draft. Do not label removed content “recoverable in My Drafts.” No clearing/deletion of their retained content is implied. The ordinary Info Card draft rules remain unchanged.

Apply owner/purpose/association predicates **before pagination**. Extend existing typed draft entries and `creatorDraftHref` dispatch. Never send a personal root to the generic Publish editor. Retain draft/source after context loss; saving a usable first attachment still requires a valid authorised working context.

**Cross-device recovery:** the existing sessionStorage journal stores submitted commands, not a durable acknowledged draft index. My Drafts therefore loads personal roots from the server. Use its purpose/origin to derive a current valid working context through existing membership/composition checks and reopen the same reusable personal editor above that Card's pouch. A narrow explicit recovery query/loader can initialise the existing AppShell working Deck/Card selection; it must be actor-authorised, not client authority to read an ancestor. No Deck picker, new membership, general navigation system or activity-memento layer.

If no eligible working context remains, preserve the existing unfinished-work entry/source and show the existing editor/context error treatment. Owner draft reading/autosave remain possible; do not attach to a different template or silently recreate a Deck. No new recovery controls are required. Already-saved edits are owner commands and need no renewed origin membership, but cannot recreate a removed association.

Normal contextual authoring keeps live DOM/state. Full browser reload or cross-device re-entry restores stored draft and authorised context, not arbitrary previous activity DOM/scroll/playback state. Do not promise that unsupported restoration or implement new serialisation.

### 6.5 Forks, source changes and retention

Follow the verified media precedent:

- A's Y → X history resolves A's original X references/dates. Y stores no copied personal IDs, roots, dates or additional parent relationship.
- New notes created on Y belong locally to Y. Z → Y → X reads all actual same-actor source lists, deduplicates validated identities and sorts by attachment dates **across** those sources.
- Source lists/content are live on fresh reads. Later X Save/edit/Remove is reflected on the next authorised descendant opening or explicit operation refresh; canonical fork version does not freeze personal history.
- Edit/Remove while viewing Y targets the validated X root/source revision. Source Remove affects subsequent X/Y/Z pouches, retains content and has only the label `Remove`. This scope is approved; do not add source explanations, confirmations or per-fork exclusions.
- Archive/loss of canonical X does not hide retained same-actor X CardData behind an otherwise authorised Y. Missing/ambiguous CardData or a broken pointer safely stops at the existing usable prefix.
- A different actor following/forking Y sees only that actor's CardData chain. Canonical lineage never grants access to A's X/Y records.

Existing backend deletion checks gain indexed retained personal references, including inactive/archived CardData. A descendant has no copied reference to lock/scan. Remove itself is not deletion, and no physical-media garbage collection is proposed. Preserve root tombstones, media provenance, canonical historical guards and exact-version media rules.

## 7. API and authorisation design

### 7.1 Operations and contracts

Reuse current Info HTTP/session/error patterns and the existing repository/session. Proposed route names are implementation entry points, not a second API stack.

| Operation | Route / reuse | Required authority and result |
| --- | --- | --- |
| Personal create | `POST /api/cards-data/[cardTemplateId]/personal-info-cards` — proposed | Current actor's valid working context, stable new ID, immutable personal origin; returns recoverable draft, not an attachment. |
| Autosave / editor read | Existing `GET/PATCH /api/info-cards/[infoCardId]` | Owner root/purpose checks; fixed private personal intent; incomplete draft and revision-recovery behaviour preserved. |
| Usable Save | `POST /api/info-cards/[infoCardId]/save` — proposed | Personal purpose/owner/root revision; first Save also exact working/origin/list revision. Returns exact receipt plus current association date/revision; never generic public Publish. |
| Remove | `PATCH /api/cards-data/[cardTemplateId]/personal-info-cards` — proposed | Authenticated actor's exact source association and expected revision; reference removal only. Route ID is original source, not necessarily displayed fork. |
| Consultation | Existing `GET /api/card-templates/[cardTemplateId]/info-cards` | Exact displayed main version and working membership/adoption; same-session actor history and latest authorised publications; §5.6 mixed chronological snapshot. |
| My Drafts | Existing paginated `GET /api/info-cards` | Owner filtering plus unfinished personal scope in §6.4 before pagination; purpose-aware context/route dispatch. |
| Library / shared picker | Existing `GET /api/library/info-cards` | Creator-purpose roots only, for every actor including owner. No owner-personal transport scope or section. Existing latest-publication sorting unchanged. |
| Publication read | Existing `GET .../[infoCardId]/publication` | Strict creator default; any personal direct read must separately require owner purpose/context, never public visibility. |
| Media allocation/status | Existing upload/status routes | Owner/personal root, exact draft context, existing signed proof/headers/registry/provider checks. |
| Media display | Existing `GET .../[infoCardId]/media?revision=N` or `?version=N` | Exact owner draft revision or saved publication; actor-bound personal purpose regardless of public-looking corruption. |
| Maths diagnostic | Existing `POST .../check-rendering` | Owner acknowledged draft revision, current advisory result; no attachment/publication effect. |

No personal list reorder endpoint, arbitrary-list replacement, existing-personal attach endpoint or extra recovery/Library endpoint. The canonical title-modal attachment picker stays creator-only and otherwise unchanged.

### 7.2 Error and asynchronous safety

- Existing unauthorised/session conflict categories and `private, no-store`/`Vary: Cookie` remain. Foreign/nonexistent personal roots/context get the same safe forbidden/not-found treatment, without existence/owner details.
- Root/list/adoption conflicts retain local text and use existing save/recovery errors. An old receipt is not current list state. Unknown transaction outcome must be resolved before issuing a potentially duplicating command.
- Invalid complete Save produces structured field/content errors without a version/reference commit; incomplete autosave remains available. Current maths overflow stays advisory.
- Reject generic personal Publish/public intent/canonical attachment before receipt/provider side effects; translate internal codes through current friendly messages.
- Capture actor, displayed/origin identities and operation generation. Abort where possible; ignore late results after account switch, close, unmount or superseding operation. Keep recovery journals actor/Info-ID scoped.
- Do not log source text, titles, personal references, proof/token/signed URL or private request bodies. No new public cache or sensitive telemetry.

### 7.3 Mandatory scope-enforcement inventory

| Existing surface | Required personal behaviour |
| --- | --- |
| Generic create and stable-ID recovery | Creator commands cannot create/recover a personal root as creator content; personal creation requires actual authorised working origin. |
| Owner/editor loaders and generic save | Authoritative purpose dispatch, private intent, immutable owner/origin; no normal Publish UI even on reload/direct links. |
| Generic Publish | Reject personal purpose before recovering any private saved receipt or doing provider work. |
| Catalogue/search/count/pagination | Personal roots excluded even for owner and even if visibility fields falsely say public. Filter before joins/count/pagination. |
| Series discovery/eligibility | Only creator-purpose public members establish discovery; personal membership/counts never leak. |
| Canonical reference guard | Reject personal IDs across every main draft/create/save/fork/publish writer, including private mains. Keep common root guard/deletion locking. |
| Combined publication resolver | Shared lane is creator-purpose only; personal lane requires actor owner, immutable origin and actual traversed source. ACL precedes names and date fallback. |
| Personal history/read projections | Add optional local refs/dates/revision only to actor-owned history; canonical data never gains them. Client segments are not snapshot authority. |
| My Drafts | Unfinished-work predicate, source relationship and pagination enforced server-side; no removed/clean personal rows. |
| Media upload/status/diagnostics | Existing root-owner/provenance validation plus personal scope; no arbitrary provider ID or foreign proof adoption. |
| Media historical version access | Personal scope remains owner-only for every exact version, including corrupt-public roots/publications. |
| Deletion | Existing owner policy, canonical draft/history blockers and indexed retained personal refs, common guard, tombstone/registry preserved. |
| Legacy media grant/status/download | Registry exclusion remains for every personal Info asset; no broad Card/Deck fallback grant. |

`CardRepository.guardInfoReferences` (`repository.ts:63–72`) is the existing canonical choke point; extend its delegated `InfoCardRepository.guardReferences`, then test the full writer inventory rather than only the picker. Reference-only Copy and construction moves must not start copying personal fields.

Relevant existing media bypass boundaries: `cards/protectedMedia.ts:18–20,49–53`, `cardMediaAccess.ts:21–28`, `cards/libraryMedia.ts:7–12`, `infoCards/mediaRegistry.ts:11–28` and `/api/media/{protected,card,card/file,card/video-file,stream/status}` plus `/api/library/media/stream-status`.

### 7.4 Series without a second grouping system

Keep the existing single grouped own-first/discoverable-others dropdown, explicit series creation, stable IDs and per-creator normalised-title uniqueness. Series and title remain required in the existing sequence; no generated “personal” series, default title or search UI.

A personal-only series is not publicly discoverable through its personal membership. Selecting an already-discoverable series exposes no personal members. Its creator can later use the same series for an ordinary public creator card; that makes the name discoverable through the public card, not the private membership. Retain selected series even when discovery later disappears. Series creator and Info Card creator remain separate identities.

## 8. Frontend and UX integration

All visible behaviour in this section is approved. Measurements labelled **starting geometry** are engineering specifications to verify in existing browser fixtures, not claims of completed visual tests.

### 8.1 One pouch, empty state and bottom-right menu

Preserve the actual corner-integrated pouch, enlarged invisible hit area/Previous separation, footer navigation, stack resting position, 240×204 face, physical animation and top-right consultation X. No controls above the pack.

**Working zero state:** update the zero gates in `FocusedCardView`, `StepView` and `InfoCardPouch` together. Opening count zero still obtains an authorised snapshot; if empty, show exactly one visual `+` in the existing consultation area and the existing close affordances. An accessible name such as “New personal Info Card” is nonvisual. No “No Info Cards yet” copy, fake card, backs, positional `1`, action row or permanent extra closed-state button. Open pouch count/position is `0`. Do not pass `[]` to the physical stack; empty close must not wait for a nonexistent animation exit or leave motion locked. Canonical zero-pouch behaviour is unchanged.

**Menu:** put a subdued three-dot trigger inside the available face's bottom-right footer in an authorised working context. Shared cards offer only `+ New`; owner-personal cards offer exactly `+ New`, `Edit`, `Remove`, in that order. Generic unavailable positions can offer `+ New` only, derived from the working context, without a protected identity. No inert dots in read-only/canonical contexts and no shared-card Edit/Remove.

Reuse the existing `DeckMenu` trigger styling/dismissal convention, not its Deck-specific routing/archive actions. Implement only the small Info-local menu required here, with scoped styles; no global menu framework or unrelated DeckMenu refactor. Open upward/inward according to space inside the current consultation. No new portal/top-layer architecture. Popover may cover card content while deliberately open; it must not obscure the existing consultation close control or clip outside the permitted pack region.

Use a button with `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; labelled menu/menuitems; focus first item on deliberate open; ArrowUp/Down, Home/End, Escape and normal Tab handling; return focus to trigger on dismissal. Outside dismissal consumes its pointer event so the same tap cannot close the pouch or activate the underlying Card. Menu clicks/keys must not browse the stack. Freeze menu opening/actions during pack motion, nested media, editor or unresolved mutation.

Existing `DeckMenu.tsx` has pointer-outside/Escape patterns but does not implement all this keyboard handling and is hardwired to Deck actions. Reusing its conventions is not evidence of complete menu accessibility. Verify touch, keyboard and accessible names in tests; VoiceOver speech remains a limited device check.

### 8.2 Reuse the real Info Card Creator, not the main title modal

The actual reusable authoring form/controller is `InfoCardEditor.tsx`/`infoCardEditorController.ts`, currently mounted by `/creator/info-cards/new` and `/[infoCardId]`. The nested `CreatorEditModal` in `CreatorDragLab.tsx:375` edits ordinary Card/Deck titles/media; it is **not** an Info Card editor and must not become a second personal authoring implementation.

Add an explicit personal embedded mode with injected Save/Cancel/result callbacks; extract only the form/header/controller seams required to keep the ordinary Creator route intact. Reuse series/title sequencing, explanation and maths source, approved face preview, media adapters/status/preview, validation, serial autosave, revision conflicts, lost-response journal and pending-upload safeguards.

Use the existing native-modal lifecycle/focus conventions (`useInfoCardDialog`, `LibraryDialog`) in a thin personal shell. Prefer the Info dialog hook with a narrowly scoped embedded-editor wrapper rather than inheriting LibraryDialog's cream surface, duplicate heading and global button styles. Extend the reused focus containment narrowly to include textarea/select/contenteditable where needed; do not make a generic overlay framework. Embedded CSS removes the current route's full-screen minimum height and allows the **editor shell** to scroll on mobile; the Info Card face itself still does not scroll.

Personal UI uses its existing contextual heading, discreet status, Save and familiar close/Cancel semantics. Hide generic Publish, visibility selector, Deck/Info creation switch, Library/My Drafts route controls and ordinary history/router effects inside the overlay. Keep series/title requirements—no auto-created series or extra shortcut. Existing normal Creator navigation is unaffected.

Keep consultation, StepView, hosted player and activity mounted and inert beneath authoring. Editor media preview is nested above the editor using current viewer/dialog mechanisms. Focus returns preview → originating editor control, editor Cancel → previous contextual trigger or consultation X, successful Save/Edit → the newly selected card's trigger (or X if unavailable), Remove → successor's trigger/X, empty → its `+`. Do not focus hidden/unmounted elements.

Capture `{actor, infoCardId, displayedCardTemplateId, originCardTemplateId, deckTemplateId, mainCardVersion, personalInfoRevision, selectedEntryKey, stepContext}`. For inherited Edit/Remove, origin/revision refer to the source; displayed fork/step remain return context. Extend the existing actor/ID submitted-command journal with personal intent and origin. Journal/query metadata is not server authority. Actor change clears active content and rejects late results.

### 8.3 Pinned snapshots, successful mutations and stable selection

**Ordinary boundary:** a genuine new pouch opening fetches a fresh authorised snapshot, sorts once by attachment dates and starts at its first entry. Closing/reopening retains the existing first-card reset. While open, external source edits, publication, adoption, counts and catalogue responses do not reorder/change its pinned content or media version.

**Approved exception:** explicit successful Save/Edit/Remove may replace the snapshot in the **same mounted open consultation**. Use the existing authorised consultation GET, actor/context/generation checks and one atomic state update for `{snapshot, selectedEntryKey}`. No new fetch manager, cache, automatic background subscription or second resolver.

| Operation | Confirmed result and selection |
| --- | --- |
| New Save | Finish usable Save/receipt recovery, obtain current authorised consultation, install it and select the saved Info ID even if concurrent newer attachments changed its rank; then close editor only. |
| Edit Save | Same process, retain selected Info ID with its new saved publication. Attachment date/order remain unchanged unless independent authorised changes are included in this explicit refresh. |
| Remove | After source CAS success, remove that entry from the already-authorised pinned snapshot (confirmed, not optimistic). Choose first surviving successor in its previous visible order, wrapping. Reconcile through the existing authorised read and retain that successor if present; skip concurrently vanished successors. Last remaining entry → empty state. |
| Cancel | Restore the exact prior consultation snapshot/key, not the latest autosaved draft or an unsolicited refresh. |
| Failed/unconfirmed operation | Keep draft/previous snapshot as applicable, recover outcome and surface the existing error treatment; do not count or select a fictitious attachment. |

Use stable available Info IDs and opaque unavailable keys (§5.6), not stale numeric indexes, to preserve selection across insertion/removal. If the selected target has already been removed elsewhere, respect the authoritative list and choose a surviving neighbour/empty state, never append it locally based on a receipt. Existing unavailable positions remain part of the stack and circular navigation; no protected data is revealed to choose a successor.

**Refresh failure after durable Save:** keep the existing editor/error/recovery state available rather than dismiss it with false success. Retrying the same Save recovers its receipt and reruns the same consultation read, without another attachment/date. Continue using existing save status/error controls, not a new loading UI. The underlying pouch remains open/mounted.

**Refresh failure after durable Remove:** the confirmed filtered pinned remainder is safe to show; retain it with the existing discreet error treatment and normal close/reopen retry. Never undo a confirmed removal, show a fabricated new card or add a Retry button. Account/context loss invalidates the consultation rather than exposing a cached private pack under a different actor.

The physical stack currently owns an array index and cannot receive an empty list. Add the smallest controlled selection/reconciliation seam: derive index from the selected stable key on a settled replacement, clamp safely before rendering, and keep opening/closing effects independent of immutable snapshot object changes. Block navigation/mutation during replacement; motion generation cancels stale completions. Do **not** remount/key the entire stack or consultation, replay opening, crossfade text as a browsing replacement or change approved animation keyframes.

Normal Save/Edit/Remove leaves underlying video paused at the same time and activity DOM/input/scroll intact. No auto-resume or new alert/toast/navigation behaviour.

### 8.4 Approved personal surface

Use solid `#263B36` on server-validated personal purpose. Shared retains `linear-gradient(145deg, #303947, #252d39)`. An actor-owned creator card is still shared blue-grey. No user setting, badges, bright accents or global token changes.

Calculated sRGB contrast against sage: body `#c9d0da` 7.68:1; secondary `#b2bdcc` 6.27:1; title `#f0f2f6` 10.64:1; media `#d2deeb` 8.74:1; focus `#a8d6e4` 7.61:1. These are colour calculations, not device acceptance. Unavailable placeholders remain neutral and do not advertise a hidden personal owner/source.

### 8.5 Centred creator footer on every available face

Every available shared/personal Info Card displays its **actual creator username**, independently of main-card or series creator. Use existing batched decoration, authenticated username for new previews and `Unknown creator` fallback. No email/full-name/profile query or source-author fallback.

Wire the field and validated presentation purpose through all `InfoCardFaceContent` consumers: ordinary/personal Creator preview, Library, consultation mapper, diagnostic host and fixtures. Remove redundant external Library “Card by …” once the common face supplies it. Preserve the separate agreed series attribution; do not redesign/reorder Library.

Reuse the main Card attribution positioning principle (`CardCreatorAttribution`, `globals.css:4642–4645`): **left: 50%; transform: translateX(-50%)**, relative to the face itself. Do not use space-between or the midpoint of the remaining media/menu gap. Do not reuse its main-card immediate-source popover semantics for Info attribution.

**Starting footer geometry to verify:** keep face 240×204, border/padding/fonts/header unchanged. Use one common reserved footer with a 32-logical-pixel controls band (media left, three dots right) and a 24px creator interaction band beneath it, bottom 1px inside the border. A 9px/12px creator text line centred within that lower band yields roughly 7px visible bottom clearance, less than the main Card's 14px. With a 4px separation above footer, body ends near logical y=143, about 109px below the current header/body start. This modest body reduction is explicitly permitted. It is a footer inside the face, **not** another toolbar/header or enlarged card.

The separate lower band avoids centred long names overlapping unequal-width media/menu controls. Reserve the same body/footer boundary across previews, diagnostics and hosts, including faces without media/menu, so capacity measurements are not host-dependent. Leave the media control compact with its existing target; do not reduce body fonts to recover space.

One-line username ellipsis is explicitly approved **only for attribution**, with full username exposed on deliberate tap/focus through the existing small tooltip/popover convention. Give it an accessible full label and keyboard dismissal. No profile navigation or extra menu. Long name text must not change its centre or collide with media/dots.

At 360/390/430px portrait and short landscape, measure actual scaled targets and non-overlap. Logical 32px is about 44px in normal portrait but not universally; use available non-overlapping invisible padding, not overlap with body/media/X/navigation. Verify the popover can fit upward inside the consultation clipping boundary. Avoid global CSS modifications.

**Capacity:** update the existing consumer/diagnostic footer collision boundary (`infoCardMaths.ts`) and common rendered geometry, not mathematical rendering/source policy. Source-derived arithmetic is encouraging: the current no-media estimator allows 109.875px, but its line/paragraph increments permit at most 109px (eight lines plus two 7px gaps); the starting footer leaves approximately 109.016px. Media-bearing legacy validation is already stricter. This is not browser evidence: verify actual wrapping, subpixel geometry and existing valid samples before claiming parity. Plain-text validation remains modular and conservative. Do not rewrite old publications, invalidate them solely for a new footer, silently truncate body text or turn advisory maths overflow into a publication blocker. A demonstrated incompatible legacy sample is a real implementation issue to report, not permission to change typography/content rules.

### 8.6 Per-source working-state freshness

Extend existing actor-keyed `workingCardStore`, not a new cache. Track each source's IDs, dates and personal revision independently of adopted main version. An unchanged Y revision does not mean inherited X is unchanged. Merge adoption and personal field groups separately; an older main response may contain newer personal revision data, and a stale same-main response must not restore removed references or old dates.

Use the media precedent in `useWorkingDeck.ts:266–280` to update the source and source segments in loaded descendant histories. Do not replace progress/media, manufacture incomplete ancestor CardData or mutate whichever fork happens to be focused. Recompute closed-pouch counts from authorised source projections; ready open counts remain pinned except §8.3 operations.

Same template in multiple Decks shares its actor CardData and dates. Another actor gets separate state. Clear active editor/consultation/recovery on session change; ignore late snapshot/save/media results. No global aggregate revision, cross-tab broadcast service or ancestry cache is necessary.

## 9. Edge cases and acceptance contracts

These outcomes are requirements or engineering safety decisions within approved behaviour, not unresolved proposals. Test filenames in §12 identify existing suites to extend; a small personal integration/browser file is appropriate where it avoids distorting unrelated tests.

### 9.1 Creation, saves, editing and recovery

| Case | Required outcome | Decisive verification |
| --- | --- | --- |
| First note, no refs | Working zero pouch → single `+` → existing personal-mode editor. No fake card/positional 1. | Browser count/focus/close and first Save; zero array never reaches stack. |
| Authored or followed working Card | Both permit personal creation; neither changes canonical ownership/publication. | Two actors, same template; root/version/progress comparison. |
| Canonical preview | No personal creation/actions/history, including for template owner. | Actual Library preview and direct forged working context. |
| Shared/personal menu | Shared only `+ New`; owner personal exactly three approved actions. | Visible/accessible labels; no toolbar/extra action. |
| Repeated New/Save | One editor/stable root, serial command, one first append/date. | Controlled repeated requests, not only disabled-button assertions. |
| Incomplete legacy draft | Preserve title/body/media even before prerequisites; no clearing/reclassification. | Existing draft/sequence tests in personal mode. |
| Oversized/invalid content | Draft source saves; complete Save follows current legacy/maths rules, no fake usable reference. | DB version/list unchanged after failed Save; exact source recovery. |
| Valid first Save | Private version + association/date/revision atomic; editor closes after reconciliation, new card selected in same pouch. | Transaction failure injection plus actual UI journey. |
| Provider/DB failure | No partial usable version/reference; draft retained; editor actionable. | Failure before/inside transaction, unchanged previous state. |
| Lost create/autosave/Save response | Same ID/command and authoritative receipt, no duplicate date/version/reference. | Existing controller recovery with controlled response loss. |
| Save committed then Remove then retry | Historical acknowledgement never reattaches or redates. | Deterministic interleaving plus fresh snapshot absence. |
| Concurrent new notes | CAS conflict/retry preserves both drafts and each successful association once. | Two sessions and unrelated CardData field comparison. |
| Same note in two editors | Root conflict preserves local text, not silent overwrite. | Controller/DB conflict and clean Save no-op. |
| Edit local/inherited | Same root/origin/date; new private version, same selected ID. | Selected key/version, source arrays and date unchanged. |
| Cancel authoring | Previous pinned snapshot/selection, autosaved unfinished text; no usable Save/attach. | Pending upload/autosave/error cases; uncertain Save recovered first. |
| Cross-device unfinished recovery | My Drafts lists eligible unfinished personal work without old sessionStorage; purpose-aware recovery. | Empty journal, valid/missing origin context and paginated list. |
| Clean or removed personal note | Not in Library, shared picker or recovery lists; retained backend content not deleted. | Server filtering before pagination, including removed dirty root. |
| Context/adoption changes mid-create | Uncommitted first Save rechecks captured origin/main/list context, never attaches to newly focused Card. | Delayed command with membership/adoption/actor change. |
| Old receipt after archive/adoption | Read-only historical acknowledgement allowed; no new first-attach authority. | DB exact retry versus uncommitted command. |
| Save committed, snapshot refresh fails | Keep recoverable editor/status; retry same receipt/read, no duplicated publication or attach. | Delayed/failing consultation after successful mutation. |
| Normal authoring return | Same activity/player/step/input/scroll, no auto-resume. | DOM identity/mount counter and playback time. |
| Reload/sign out | Stored drafts survive; no prior actor's content flash. Arbitrary pre-reload activity state not promised. | Real application reload/account switch with late replies. |

### 9.2 Stack, actions, footer and media

| Case | Required outcome | Decisive verification |
| --- | --- | --- |
| Shared-only/personal-only/mixed | One date-sorted stack; proper count/colours; owned creator card stays shared blue. | DB/client/browser mixed-source response. |
| Inherited-only refs | Empty local list can produce nonzero pouch via history. | X refs unchanged; Y no copied refs/dates/roots. |
| Unavailable reference | Anonymous position/count preserved; no source/title/owner/diagnostics; optional context-only `+ New`. | Exact response fields and no Edit/Remove for unknown identity. |
| Pending/error versus ready empty | Existing one-second loading/cancel/error behaviour; ready zero is not loading or placeholder. | Fake clock 999/1001ms and late cancellation. |
| External shared/personal update | Open publications/count/order unchanged; next genuine open is fresh. | Concurrent source mutation/publication and exact media version. |
| Explicit Save/Edit refresh | Atomic snapshot + selected stable key, no emergence replay/remount/flicker. | Element identity, selected ID/version, motion completion guards. |
| Remove middle/last/wrap | Pouch open; next surviving previous-order position, wrap; final item → true empty. | Mixed-source neighbours including unavailable slot. |
| Concurrent successor removal | Walk prior successor order until a survivor; never index wrong card or resurrect. | Controlled refresh after two removals. |
| Remove committed/read fails | Confirmed filtered pinned remainder safe; ordinary error/close-reopen recovery, no reattach/Retry button. | Separate mutation success/read failure interception. |
| Rapid close/reopen/different Card | Ignore old context/generation replies, reset first only on genuine opening. | Reversed responses and motion lock assertions. |
| Intro/Steps 1–3 | Same whole-Card personal association; underlying state retained. | All four actual Step View compositions. |
| Menu gesture isolation | Menu taps/arrows/outside dismissal do not browse/close/click-through. | Pointer/keyboard and lock tests during motion/media/editor. |
| Nested authoring/media | Correct modal layer and focus return; consultation cannot browse beneath either. | Native dialogs, return-target disappearance, pending media cancellation. |
| Image/video exact version | Same selected publication on media close/reauthorisation; old grant not latest content. | Personal edit while nested viewer open, owner/foreign API tests. |
| Media delivery failure | Card/text/count remain, current viewer error only. | Denied/expired response and blocked processing. |
| Long-paused video | Existing roughly one-hour bearer limit; reopen viewer for same-version fresh grant. | Mock expiry/reopen; no scheduler requirement. |
| Legacy/maths content | Exact source/bodyFormat, existing syntax safety/fallback/advisory overflow. | Literal dollars/backslashes, malformed draft recovery, mixed-height examples. |
| Every available face credit | Actual Info author, distinct series attribution, mathematically centred name. | Creator/Library/pouch/diagnostic DOM centre and data identity assertions. |
| Long username | One line with approved identity-only ellipsis and deliberate full-name access. | Touch/focus tooltip, no email/profile menu, no body truncation. |
| Media/dots/credit geometry | Separate usable targets, common footer boundary; smaller visible bottom margin than main Card. | Actual bounds at 360/390/430px and short landscape. |
| Smaller body space | Fonts/face unchanged; diagnostics honour footer; no newly invented fit gate. | Existing valid legacy/maths samples, content preservation and collision measurements. |
| Reduced motion/touch | Existing stack behaviour and enlarged pouch target/Previous separation intact. | Existing motion, hit-area and event-propagation regressions. |

### 9.3 Attachment chronology, versions and forks

| Case | Required outcome | Decisive verification |
| --- | --- | --- |
| Old shared card attached now | Explicit current association date moves it ahead of older personal/shared associations. | Deliberately different root creation/Info publication/attachment dates. |
| New draft started earlier, first Save now | Personal date is first usable attach, not draft creation. | Saved root creation stays old; association date is new. |
| Retained attachment edited/reordered | Same date; no promotion on title/main/Info edits or reopening. | Normalised content round trips and store snapshots. |
| Shared attachment removed then committed re-add | New date; unsaved remove/re-add does not count as new. | Separate CAS writes, retries and cancelled modal. |
| Shared addition unpublished | Owner working/follower uses only the displayed adopted published main version, never latest unsaved draft IDs. | Main publication/adoption checks. |
| Publication failure | Existing published IDs/dates/order remain; draft still recoverable. | Main/Deck failure and retry receipts. |
| Every canonical writer | Preserves retained dates, assigns only new associations, does not trust client redating. | Phase 4 full writer/adapter inventory, timestamp forgery. |
| Reference-only Copy | Same CardTemplate/version, same actor data and attachment dates. | Cross-Deck and cross-actor reuse tests. |
| Fork inherited shared attachments | Exact source content/dates retained; only genuinely new shared additions dated now. | Standalone/combined forks and first-publication recovery. |
| X → Y → Z personal sources | Dates remain on original CardData, mixed globally by date, not Z/Y/X blocks. | Interleaved dates across all sources, no copied arrays. |
| Source-level Edit/Remove on Y | Changes X content/reference; fresh X/Y/Z sees it; no origin/date change on Edit. | Captured source command and per-source revision refresh. |
| Another user follows/forks Y | Only their real history chain; A's X/Y refs/dates/counts never inherited. | Canonical lineage versus two actual actor histories. |
| Archived/inaccessible canonical ancestor | Retained same-actor CardData remains readable through authorised current fork. | Missing canonical root, archived Deck, valid current context. |
| Missing/duplicate/cyclic ancestor | Existing safe prefix, no guessed canonical ancestry/depth cap. | Current-versus-ancestor ambiguity and 512-segment existing traversal. |
| Legacy missing date | Authorised root creation fallback only; no read/backfill/republication promotion. | Old immutable version round trip with/without timestamp map. |
| Equal/invalid/unavailable dates | Deterministic ordering, generic slot; no forbidden metadata lookup/leak. | Equal dates, malformed map, foreign root, repeated reads. |
| Same template across Decks/adoption | Personal list/date/revision survive; adopted shared version remains exact. | Adoption/copy/read model tests and field-group merge. |
| Stale descendant projection | Unchanged Y revision cannot overwrite newer X association state. | Out-of-order loaded histories with same/different adopted version. |
| Root deletion while referenced | Canonical history and retained personal references block; attach/delete serialise. | Both race orders, rollback, archived/inactive source refs. |
| Detach then deletion API | Existing remaining canonical guards still apply; no deletion UI/physical asset cleanup. | Tombstone/old receipt/provenance retention tests. |

### 9.4 Adversarial privacy matrix

| Actor / attack | Required result | Coverage |
| --- | --- | --- |
| Owner | Read/edit/Save own content; attach only first Save in valid origin context; source Remove own association. | Positive real journey plus detached direct-read no-append case. |
| Another follower, coach, main/series author | No personal body, IDs, dates, sources/counts or media by role alone. | Two followers/source author, canonical/working/media endpoints. |
| Anonymous or forged session/context | No content, allocation or media grant; generic safe error. | Actor headers/cookies/source swapping. |
| Owner generic Publish/canonical attach | Permanent personal prohibition, including private mains and saved-receipt replay. | All canonical writer paths and generic Publish. |
| Corrupt-public personal root/version | Still owner-only and excluded from catalogue/series discovery. | Adversarial fixture and direct media grants. |
| Forged parent/date/map/receipt | No other origin, redating retained refs or reattachment after Remove. | Strict transport/server normalisation and retry tests. |
| Foreign asset/proof or legacy media route | Provenance/registry boundary prevents transplantation/bypass. | Existing upload/media security matrix with personal roots. |
| Stale response/account switch | No actor-crossing editor/snapshot/journal installation. | Delayed read/save/media and session reset. |
| Search/count/page/error probes | ACL before metadata/count/pagination; generic unavailable entries and safe logs. | Response field assertions, not merely hidden UI. |
| Direct R2 image URL | Known trial exposure remains, not application ACL success or a verified-private-storage claim. | Documented accepted risk; separately authorised live provider evidence only. |

## 10. Risks and mitigations

| Risk | Significance | V1 mitigation / status |
| --- | --- | --- |
| Personal content promoted/discovered through generic APIs | High data/privacy risk. | Immutable purpose, owner/origin enforcement and negative tests at every §7.3 surface. Mandatory. |
| Actor or ancestry confusion | High cross-user disclosure risk. | Same-actor retained CardData traversal, origin/source validation, no canonical-lineage grants. Mandatory. |
| First Save partial commit or retry resurrection | High integrity risk. | Atomic version/ID/date/CAS, existing receipt, historical acknowledgement separate from current state. Mandatory. |
| Attach/delete write skew | High integrity risk. | Shared root reference guard, indexed personal existence check, deterministic transaction races. Mandatory. |
| Attachment dates lost/redated on a canonical path | Medium–high incorrect-order risk. | Full writer/projection audit, server-owned dates, retry normalisation, fork/legacy preservation tests. Mandatory consequence of latest ordering decision. |
| Pinned snapshot replaced by background result | Medium integrity/interaction risk. | Explicit operation-only reconciliation, stable selection and actor/context/generation checks; no auto refresh service. Mandatory. |
| Editor or stack remount resets player/activity | Medium–high and reproducible with route exit. | Reuse editor locally, controlled settled selection, native nested dialogs, DOM-identity tests. Mandatory. |
| Same-main stale response restores removed ancestor count/date | Medium stale-state risk. | Independent per-source revisions in existing store; source-aware loaded descendant refresh. Mandatory. |
| Footer reduces body area or menu/credit overlaps | Medium visible/capacity risk. | Approved modest reduction, common measured geometry, independent centring, existing rules/typography and no silent body truncation. Mandatory tests. |
| Cross-device incomplete draft stranded | Medium recovery risk. | Approved existing My Drafts and purpose-aware contextual re-entry, not sessionStorage alone. Mandatory. |
| Clean removed record inaccessible | Accepted V1 limitation, not blocker. | Retain content; exclude it from Library/recovery; no invented reattach/delete workflow. |
| Direct public image URL access | Accepted trial confidentiality risk for non-sensitive media. | Honest documented allowance, owner-only app checks, no false verified flag; public-launch hardening deferred to Appendix A. |
| Old deployment unaware of personal purpose | High rollback risk. | Keep permanent purpose/media/reference guards in any rollback build; never assume old code ignoring fields is safe. |
| Overbuilding for hypothetical scale | Maintenance risk. | No new collections, managers, generic frameworks, arbitrary caps or ancestry cache; monitor real user-document size before redesign. |

## 11. End-to-end implementation checkpoints

Execute **A → B → C → D → E** after a separate implementation instruction. Each checkpoint includes its focused tests, progress/handoff update and preservation of prior behaviour. Continue automatically when those checks pass; do not request approval simply because the next checkpoint begins. Stop only for an unexpected material product contradiction, security concern or architectural blocker, and continue independent safe work where possible.

Read applicable installed Next guides before implementation as required by `AGENTS.md`. Keep an incremental implementation handoff with completed commands/results, remaining work and blockers so a usage-limit interruption can resume without repetition. This task itself only finalises the plan.

### A — Domain, privacy, attachment dates and CardData contracts

1. **Objective:** additive permanent-personal identity and association contracts, with backward-compatible shared timestamp storage.
2. **Prerequisites:** current baseline and approved decisions in §§1–2; no further product approval gate.
3. **Files:** `src/lib/infoCards/{model,domain,repository,queries,media,http}.ts`; `src/lib/cards/{model,domain,repository,personalHistory,personalHistoryProjection,readModels,workingCardStore}.ts`; shared validators/adapters/types; explicit setup/readiness; draft entry/loaders.
4. **Required modifications:** purpose/origin invariants; optional local IDs/dates/revision; shared date map and server normalisation across §5.2 writers; additive history projection; independent working-store field groups; unfinished personal draft predicate.
5. **Reuse:** existing Info collections, canonical writer guards, CardData defaults, exactly-one/CAS assessment pattern, history traversal and actor-keyed store.
6. **Contracts:** §§5.1–5.5; legacy absent fields compatible, immutable origin and stable association dates. No history backfill or copied fork associations.
7. **Security:** generic Publish/shared attachment/catalogue/series/media reject personal misuse; canonical projections remain personal-free; dates never widen ACL.
8. **Automated tests:** corrupt-public purpose, legacy creator/private compatibility, every writer/date round trip, timestamp forgery, absent/empty equality, current/ancestor ambiguity, store adoption/source-revision races, server draft filtering/pagination, index idempotence/readiness on disposable replicas.
9. **Acceptance:** shared workflows unchanged; one actor's local/source references safely projected; no new public personal rows; dates persist only for actual associations and cannot be refreshed by content edits.
10. **Regression risks:** strict validators drop maps, semantic equality/receipt conflicts, fork date resets, personal drafts routed to generic Publish, whole-user writes.
11. **Failure/recovery:** no silent repairs; unknown kinds fail closed; safe ancestor prefix; CAS conflicts preserve drafts; setup never runs implicitly.
12. **Done:** focused domain/security/projection tests and types pass, full canonical writer inventory recorded, new live index explicitly outstanding rather than claimed installed.

### B — Atomic private Save, combined consultation, chronology and source Remove

1. **Objective:** complete owner-private lifecycle and authoritative mixed-source snapshot before UI wiring.
2. **Prerequisites:** A's fields/guards; existing transaction/receipt/index infrastructure.
3. **Files:** Info repository/queries/model/HTTP; current consultation route/client mapper; narrow working-authorisation helper; proposed personal create/Remove route and personal Save route.
4. **Required modifications:** first Save version+ID+date+revision in one transaction; clean/later Save and historical receipt semantics; source-level Remove CAS; retained personal deletion checks; same-session history join, date ordering and stable selection keys.
5. **Reuse:** existing publish precheck/transaction primitives, source-revision unique receipt, shared root reference guard, publication resolver/decoration, current history traversal.
6. **Contracts:** §5.6 response and §7.1 operations; available source identity validated, unavailable keys opaque/content-free, canonical shared-only.
7. **Security:** exact displayed main version, actor-only ancestors, purpose/origin guards, authorised timestamp fallback; no client IDs/sources as authority.
8. **Automated tests:** rollback between insert/append, both attach/delete race orders, lost responses after Remove, concurrent same/different note Saves, clean Save, source CAS, personal-public injections, mixed chronology/ties/legacy fallback, corrupted/foreign slots, snapshot concurrency, archived sources and X → Y → Z without copying.
9. **Acceptance:** one first attachment/date, no resurrection or partial commit; source Remove affects later descendants, not content; sorted pinned response is coherent and actor-bound.
10. **Regression risks:** recovered receipt incorrectly treated as current state, origin equated with displayed fork, shared-prefix client assumptions, broad snapshot ACL, source failure aborting entire consultation.
11. **Failure/recovery:** provider I/O stays outside retriable callback; uncertain outcomes recovered before new commands; unavailable positions remain generic; DB/request failures remain request failures.
12. **Done:** new route positive/negative and concurrency tests pass on disposable replica sets; current creator snapshot/media regressions remain green.

### C — Common face, centred creator attribution, sage surface and menu layout

1. **Objective:** implement approved common-face changes without redesigning the pack.
2. **Prerequisites:** A/B purpose/creator/date DTO contract; tests can use controlled fixtures.
3. **Files:** `InfoCardFace.tsx`/scoped CSS, `infoCardMaths.ts`, consultation mapping, Creator/Library consumers, diagnostic host and fixtures; narrow local menu if needed.
4. **Required modifications:** centred actual author, full-name access/ellipsis, common footer bands, media-left/menu-right geometry, sage personal purpose, remove redundant external Library card credit; provide menu action slots without alternative UI.
5. **Reuse:** main Card attribution centring, series tooltip convention, DeckMenu styling/dismiss pattern and Info dialog/face primitives.
6. **Contracts:** §8.1 exact menus and §8.5 common footer; all available faces receive creator/purpose; unavailable slots reveal no owner.
7. **Security:** presentation purpose from validated server lane; owned creator card not personal; no profile/source metadata leakage.
8. **Automated tests:** exact username centre independent of side controls, long-name full access, action/credit/media bounds and focus, correct menu labels/dismissal/arrow keys, legacy/maths/media sample capacity and diagnostic parity, all face consumers.
9. **Acceptance:** 240×204 outer face and fonts remain unchanged; modest measured body reduction, smaller credit bottom margin, no overlap/extra toolbar/index/badge, existing maths publication policy intact.
10. **Regression risks:** host-dependent footer, clipping menu, inaccessible small targets, duplicate Library credit, old diagnostic collision boundary or renderer changes.
11. **Failure/recovery:** missing creator uses safe fallback; no profile fetch; unexpected incompatible content sample is reported, not silently shrunk/truncated.
12. **Done:** focused component/browser geometry, content and accessibility tests pass; subjective sage/spacing/VoiceOver checks identified for final acceptance, not used to stop deterministic implementation.

### D — Existing Creator integration, empty pouch and open-stack operations

1. **Objective:** deliver the complete `+ New`/Edit/Remove experience with live working Card state intact.
2. **Prerequisites:** B operations and C common-face/menu contract.
3. **Files:** existing editor/controller/scoped CSS and loaders/draft entries; thin personal dialog wrapper if needed; `FocusedCardView`, `StepView`, pouch, consultation, physical stack's narrow selected-key seam, working-state subscribers.
4. **Required modifications:** embedded personal mode and journal intent; zero-pouch gates/single plus; exactly approved contextual actions; Save/Edit/Remove snapshot reconciliation and selected keys; existing My Drafts purpose-aware recovery; source/descendant store acknowledgements.
5. **Reuse:** current form/media/maths/validation/autosave, native dialog/focus, existing active Deck/Card bootstrap and source-targeted media update precedent.
6. **Contracts:** §§6.3–6.4 and 8; no route/history effects in mounted overlay; close only editor on Save; Cancel keeps prior snapshot; Remove chooses prior-order successor/empty.
7. **Security:** working-context gating, no canonical creation, actor/generation guards, root-origin versus displayed fork identity, no personal Library/picker/recovery leakage.
8. **Automated tests:** real Next and stateful fixtures; zero/shared/inherited-only/mixed packs; Save/Edit/Remove/Cancel, final removal, refresh failure after durable command, stale selected ID, keyboard/touch/focus, nested previews, incomplete cross-device recovery, removed/clean draft exclusion, account switch, no remount/playback reset.
9. **Acceptance:** pouch stays open; new/same/successor selection correct; no re-emergence animation; player/activity/scroll preserved and paused; no generic Publish/visibility/route controls in personal mode.
10. **Regression risks:** hook focus containment missing textarea/select, native dialog nesting, event leakage to swipe/close, empty close waiting forever, old journal replay, unrelated Creator navigation changes.
11. **Failure/recovery:** existing status/errors and uncertain-command recovery; no new Retry controls/overlays; stale replies ignored; confirmed Remove not undone on refresh failure.
12. **Done:** normal and delayed actual application journeys pass with disposable data, existing shared motion/media/navigation suites still pass, review app preparation documented.

### E — Combined regression, mobile preparation and rollout handoff

1. **Objective:** establish end-to-end correctness and honest trial readiness, not add feature scope.
2. **Prerequisites:** A–D passing; production/provider changes remain separately authorised operational work.
3. **Files:** justified extensions to existing tests, at most small focused personal integration/browser files, implementation/testing handoff. No additional application architecture planned.
4. **Required modifications:** close genuine coverage gaps; record exact commands/counts, geometry/content evidence, skipped checks and remaining operations; review complete diff for unintended work.
5. **Reuse:** existing Mongo memory replica set, authenticated Next runner, Chromium touch fixtures, maths and gesture regressions.
6. **Contracts:** complete create → draft/recovery → usable Save → pouch → Edit/media → source Remove workflow, with main publication/adoption independent.
7. **Security:** two actors plus source author/series creator; permanent personal boundaries, canonical exclusions, exact media/provenance and legacy-route negatives.
8. **Automated tests:** §12 relevant combined regression; TypeScript, scoped lint, standard production build, whitespace/diff review; existing production motion evidence reused unless a real new timing risk appears.
9. **Acceptance:** no known ownership/data-integrity defect; required setup tested on disposable DB; no false live-provider/index claim; approved UI and all operation-selection outcomes covered.
10. **Regression risks:** runner accidentally seeds normal production-connected environment; duplicate fixture-only implementation; unverified provider results described as live acceptance.
11. **Failure/recovery:** distinguish application/test/environment failures; preserve prior results and resume record; unexpected defects escalated without speculative UX/security changes. No production write to force a pass.
12. **Done:** complete handoff with copyable verified desktop/LAN URLs, disposable login/start/stop commands, short subjective Safari/VoiceOver checklist, actual automated evidence and separate rollout prerequisites. No stage/commit/deploy without instruction.

## 12. Test strategy

### 12.1 Coverage inventory: extend existing suites

All tests below are **planned**, not executed for this documentation task. Prior shared-feature passes are reusable evidence/infrastructure, not proof of the new personal feature.

| Existing suite / layer | Required additions or focused regression |
| --- | --- |
| `tests/info-cards.integration.ts`, `tests/info-cards-api.integration.ts` | Personal purpose/owner/origin, first/later/clean Save, source receipts, rollback and concurrency, generic Publish rejection, server draft predicates/pagination, catalogue/series exclusions. |
| `tests/info-card-attachments.integration.ts` | Every canonical writer rejects personal IDs; shared attachment dates assigned/preserved/forgery-resistant; historical main content, absent/empty metadata, fork/copy/adoption and deletion guard compatibility. |
| `tests/personal-lifecycle.integration.ts`, `tests/card-reuse.integration.ts`, `tests/update-adoption.integration.ts` | Same actor/template across Decks, archive/re-entry retention, independent personal revision/date versus adopted main version, reference-only Copy and main/Deck publication invariants. |
| `tests/card-forks.test.ts`, `tests/card-forks.integration.ts`, `tests/personal-history-projection.test.ts` | Existing first-publication pointer and empty local arrays; X → Y → Z mixed chronology, live source edits/Remove, source-aware keys, safe-stop/missing/duplicate/cyclic ancestors and no copied data. |
| `tests/working-updates.test.ts` | Source IDs/dates/revision merges independent of adoption; unchanged Y/newer X; older main/newer personal fields; loaded descendant refresh and actor clearing. |
| `tests/info-card-editor.test.ts`, `tests/info-card-drafts.test.ts`, `tests/info-card-errors.test.ts` | Personal Save-only mode, sequencing, incomplete source preservation, acknowledged/lost-response recovery, friendly errors, clean/removed personal exclusions. |
| `tests/info-card-consultation-client.test.ts` | Mixed-order shared membership validation rather than prefix; owner/origin/source/date checks, canonical exclusion, unavailable opaque keys, pinned ready snapshot, cancellation/session isolation. |
| `tests/info-cards-media.test.ts`, `tests/info-card-upload.test.ts`, `tests/protected-media.integration.ts`, `tests/card-media-access.integration.ts` | Personal exact publication through inherited context, foreign/main-author denial, proof transplantation, registered assets denied by legacy grants, existing media unchanged. |
| `tests/info-cards-release.integration.ts` | New users reference index, missing-index refusal, idempotent setup/no document changes, historical guards and honest trial-versus-verified media policy. |
| `tests/phase2/info-cards-authoring.browser.ts`, `tests/phase2/info-card-consultation.browser.ts` | Actual reusable editor and Next working journey, zero `+`, menus, saved/edited/removed selection, open pouch and mounted state, cross-device My Drafts recovery. |
| `tests/phase2/info-cards-release.browser.ts`, `info-card-attachments.browser.ts`, `info-card-eligibility.browser.ts` in that same directory | Full owner/follower journey, canonical picker personal exclusion, existing public/private eligibility and metadata-race correction, Library/My Decks/Creator regressions. |
| `tests/browser/info-cards-integration.browser.ts`, `info-cards-motion.browser.ts`, `info-cards-pouch.browser.ts`, `info-cards-production.browser.ts` in that same directory | Pouch hit area/Previous boundary, same DOM activity/player, opening/circular/closing locks, controlled selected-key refresh, nested editor/media focus, empty handling, reduced motion. |
| `tests/phase2/info-maths.browser.ts`, `tests/browser/info-cards-capacity.browser.ts`, `tests/info-maths/production.mts` | Common footer/creator in every host, actual body/collision bounds, source/bodyFormat preservation, legacy fit parity, current maths advisory policy. |
| `tests/creator-navigation.test.ts` and existing coordinator/collection browser tests | Embedded personal mode does not trigger ordinary routing/history effects; normal Creator returns, detached work, Library latest-publication ordering and My Decks rules unchanged. |

Prefer one focused personal-domain integration/browser file if otherwise unrelated suites become unwieldy, and register it with the existing runner. Do not recreate Phase 5's historic 902-case exercise simply to increase counts.

### 12.2 Highest-value scenarios and controlled asynchronous tests

Prioritise two followers plus source author; same actor across Decks and X → Y → Z; inherited-only pouch; source Remove from descendant; first Save rollback; lost Save response after Remove; generic personal-public injection; both attach/delete race orders; exact-publication media; unfinished cross-device recovery and clean/removed exclusion.

For chronology, construct roots whose original creation/publication dates intentionally disagree with association dates. Include newly attached old shared material, new draft started earlier, fork-carried dates, remove/re-add, equal/legacy missing dates, authorisation failures and adoption. A test merely sorting a page in React is insufficient; assert the server combined order and date preservation.

For UI, cover New Save selects new ID, Edit keeps same ID/version update, Remove uses previous-order successor/wrap/empty, Cancel leaves pinned snapshot, durable mutation followed by read failure, late prior response, concurrent disappearance, and **no stack/consultation remount**. Assert actual DOM centres/target rectangles and menu event isolation rather than only CSS strings.

Use network interception/barriers/fake clocks for 999/1001ms loading, transaction races, snapshot inversion and pending commands. Do not rely on long sleeps. Existing production animation timing evidence need not be rerun unless a concrete changed path creates a timing risk; no motion tuning is planned.

### 12.3 Execution and environment safety

Suggested commands for the later implementation session, **not run here**:

```sh
node --import tsx --test tests/info-card-editor.test.ts tests/info-card-consultation-client.test.ts tests/working-updates.test.ts
node --import tsx --test --test-concurrency=1 tests/info-cards.integration.ts tests/info-cards-api.integration.ts tests/info-card-attachments.integration.ts tests/personal-lifecycle.integration.ts tests/card-reuse.integration.ts tests/update-adoption.integration.ts tests/card-forks.integration.ts
node --import tsx --test --test-concurrency=1 tests/info-cards-media.test.ts tests/protected-media.integration.ts tests/card-media-access.integration.ts tests/info-cards-release.integration.ts
node --import tsx scripts/test-phase2.ts --info-cards info-cards-authoring.browser.ts info-card-consultation.browser.ts info-cards-release.browser.ts info-card-attachments.browser.ts info-card-eligibility.browser.ts --reporter=line
SWITCHPLAY_FIXTURE_PORT=4190 npx playwright test --config=playwright.info-cards-integration.config.ts --reporter=line
npx playwright test --config=playwright.info-cards-capacity.config.ts --reporter=line
npx tsc --noEmit
npm run build
git diff --check
```

Add actual new personal test files to the selection. Run scoped ESLint against changed files, not unrelated cleanup. Sequence Next browser runners that share build/output paths; pure independent tests may run in parallel. Record exact commands/counts/skips and distinguish historical evidence from current runs.

Before any test writes, verify the existing runner's disposable Mongo replica-set guard and target. **Normal dev deliberately connects to production Atlas. Do not seed, Save, migrate or install indexes there as testing.** Use existing disposable Next infrastructure with provider mocks where appropriate. No live Cloudflare settings/assets or database writes are authorised by this planning task.

Chromium is baseline for automated touch/keyboard/responsive tests. WebKit, if available, is additional browser evidence, not real iPhone certification; do not revisit its old sandbox-crash investigation or create virtual-iPhone infrastructure.

## 13. Focused manual mobile acceptance

Use the **actual authenticated Next application** with disposable users/data. Existing review entry: `node --import tsx scripts/test-phase2.ts --dev --lan --info-cards`. The implementation handoff must verify the printed host/port/database, provide copyable desktop/LAN URLs, disposable credentials and exact start/stop commands. Do not substitute Phase 1 fixtures or the production-connected normal dev app for seeded testing. Browser uploads require that review origin's actual CORS allowance.

Only genuinely subjective/device-specific checks are manual:

| Check | Expected observation |
| --- | --- |
| Zero pouch and three-dot affordance | Single `+` understandable, dots calm/reachable, no new toolbar; inherited source distinction remains invisible. |
| Sage and common footer | Personal/shared distinction, centred credit and long-name reveal comfortable; body/media still readable without visible overlap. |
| iPhone keyboard/native dialogs | Form usable with keyboard open; textarea/select focus, preview → editor → consultation restoration, no accidental background interaction. |
| Save/Edit/Remove touch feel | Same open pack shows new/same/next card; last removal empty; no emergence replay, state reset or video resume. |
| Physical pouch/swipes | Existing enlarged target/Previous separation and physical motion remain natural with footer/menu controls. |
| VoiceOver/Safari media | Meaningful menu/full-username/empty-plus announcements, nested media focus and actual playback in supported Safari. |

Do not ask humans to verify deterministic ownership/date ordering/CAS/database cases already covered automatically. Record engine/device and actual observations; do not claim Safari verified from Chromium. No manual server was started in this planning task.

## 14. Rollout and compatibility-safe rollback

### 14.1 Controlled-trial readiness

1. After one implementation instruction, complete A–E and record evidence incrementally using disposable data; no planned checkpoint requires another product decision.
2. Separately authorise the new users personal-reference index on the intended application database. Inspect definitions before setup, verify idempotence/readiness and unchanged document counts after; existing twelve indexes are not evidence this additional index is installed.
3. Preserve current R2 buckets/domains/headers and signed new Info videos. The personal non-sensitive image trial risk is explicitly accepted; do not set `INFO_CARDS_PRIVATE_MEDIA_VERIFIED=1` or imply origin confidentiality.
4. Run actual authenticated text/maths/media/ancestor journeys with no production test content. Any live labelled disposable provider test/cleanup requires the appropriate separate permission.
5. Supply the verified disposable review app and focused §13 checklist. Owner visual/touch acceptance precedes trial rollout, not completion of deterministic coding checkpoints.
6. Keep operational scope honest: 10–20 known users/non-sensitive notes. A generally exposed app must not be described as restricted merely because the test group is small; no registration/entitlement redesign is authorised here.

No association backfill, new collection, image migration, retention process, scheduler or flag service is needed. Personal timestamps and shared optional metadata are additive. A startup/readiness failure is not permission to install live indexes silently.

### 14.2 Rollback

Old readers ignoring new fields are **not** sufficient: a pre-purpose generic editor/Publish API could expose personal roots, and a pre-date writer could strip association metadata. Keep permanent personal-purpose/media/reference checks and timestamp-preserving canonical writes in a compatibility build.

If entry UI must be withdrawn, use the smallest forward compatibility change disabling new contextual entry while retaining owner draft access, safe direct content reads and existing shared consultations. Preserve roots/versions/associations/dates/indexes. Do not erase personal data or suddenly expose clean/removed cards in Library as recovery.

A whole-deployment rollback requires that compatibility patch before deploying older code. Record the resulting recovery limitations honestly; no new recovery screen is authorised. Stop rollout on cross-user disclosure, public promotion, source/progress loss or receipt/reference corruption. Provider availability or subjective spacing is not justification for weakening ACLs.

## Appendix A. Protect private Info Card images before public launch

**Accepted temporary risk, not a blocker for the controlled 10–20-person non-sensitive trial:** direct public R2 URLs can bypass application owner checks. This allowance explicitly includes personal-note media. Keep it accurately described; do not claim verified private delivery.

Mandatory from the first trial use: session/owner/purpose/origin checks; private/no-store responses; atomic first Save/date/reference and deletion guards; safe maths/text rendering; upload provenance; exact-publication media contexts; signed new videos; legacy-route exclusion; actor-bound journals/late-response rejection; no private source/tokens in logs.

**Deferred public-launch backlog task — Protect private Info Card images before public launch**

- **Problem:** current public R2 delivery permits anyone with a direct image URL to view it; another currently public bucket would not fix this. Application authorisation and storage-origin confidentiality are different.
- **Why deferred:** explicitly accepted temporary exposure for non-sensitive media in the small trial; no bucket/security migration belongs in personal V1.
- **Future scope:** under separate approval, inventory existing public/custom/Worker aliases and ordinary Card/Deck consumers, then protect private image origin/delivery using existing infrastructure wherever possible. Do not alter provider settings in this task.
- **Acceptance:** anonymous/foreign denial across relevant direct aliases; owner exact-version success; upload CORS and existing Card/Deck media regressions; honest verified configuration and removal of the trial allowance only after live checks pass.
- **Priority:** before general public launch with a private-image confidentiality promise; not a source-merge or current trial blocker.

Existing [media security backlog](info-card-media-security-backlog.md) remains the provider-wide record. Signed-video ownership/readiness/exact-version protections remain current requirements, and the known long-pause expiry/reopen behaviour remains accepted. Do not add periodic renewal, unrelated rate-limit/scan/audit programmes or bulk changes to existing unsigned videos as part of this feature.

## Appendix B. Code reference inventory

All files below existed at investigation time unless explicitly labelled **proposed new**. Links resolve relative to this document; line ranges are approximate baseline locations, not claims that future edits retain line numbers.

### B.1 Domain, persistence and permissions

| File | Baseline symbol / role |
| --- | --- |
| [Card/Deck and personal models](../../../../src/lib/cards/model.ts) | `CardContent` at 21; roots/versions at 41–76; `CardData`, `DeckData`, `PersonalUser`, capabilities at 78–113. |
| [Card repository](../../../../src/lib/cards/repository.ts) | Canonical `guardInfoReferences` 63–72; adoption 140–181; Copy 255–325; writers/forks; CardData initialisation 825–847/949–961; consultation/working auth 1093–1127. |
| [Card defaults](../../../../src/lib/cards/domain.ts) | `initialCardData` 84–89; architecture errors/validation. |
| [Fork inheritance](../../../../src/lib/cards/forks.ts) | `inheritForkCardData` 37–72; selective personal/history rules. |
| [Adoption](../../../../src/lib/cards/updateAdoption.ts) | Personal step-field reconciliation, not whole-record replacement. |
| [Working projections](../../../../src/lib/cards/readModels.ts), [resolvers](../../../../src/lib/cards/resolvers.ts) | `projectWorking` 44–78 and membership reuse; resolver `resolveCards` selects personal records before projection. |
| [Canonical projection](../../../../src/lib/cards/libraryProjection.ts), [Library reads](../../../../src/lib/cards/libraryReadModels.ts) | Canonical content/author attribution; must not acquire follower personal associations. |
| [Personal history](../../../../src/lib/cards/personalHistory.ts) | Safe current source-field projection; add personal refs/revisions to the existing history segments, not a new ancestry model. |
| [Personal history presentation](../../../../src/lib/cards/personalHistoryProjection.ts) | `inheritedHistory`, `visiblePersonalMedia`, `personalMediaKey`: current-first origin-aware display without copying/current-segment replay. |
| [Source-aware media authority](../../../../src/lib/cardMediaAccess.ts) | Actor-only history traversal and requested-source validation; no admin/template-author privilege. Reuse ancestry principle, not legacy media grants for Info assets. |
| [Personal history route](../../../../src/app/api/cards-data/[cardTemplateId]/history/route.ts) | Existing actor-owned history DTO; not a client-authoritative consultation source. |
| [Working state store](../../../../src/lib/cards/workingCardStore.ts) | Actor/template key, accept/project at 26–48; current adoption-only freshness. |
| [Assessment persistence](../../../../src/lib/assessments/repository.ts) | Existing exactly-one embedded record/CAS example at 24–36/78–87. |
| [Info model](../../../../src/lib/infoCards/model.ts) | Draft/root/publication/series/DTO/media context; proposed kind/origin/list not yet present. |
| [Info validation](../../../../src/lib/infoCards/domain.ts) | Strict fields and transport ceilings; `infoReferences` ordered unique IDs without count cap. |
| [Info repository](../../../../src/lib/infoCards/repository.ts) | Index setup/readiness 17–72; owner/create 79–98; series/save 100–141; publish/receipt 144–183; drafts/guards/deletion 203–250. |
| [Info queries](../../../../src/lib/infoCards/queries.ts) | Owner editor 11–20; batched names 32–37; snapshot 86–106; catalogue 109–127; series discovery 130–148. |
| [Capacity](../../../../src/lib/infoCards/capacity.ts) | Existing plain-text estimator/field-specific issues; do not copy into form components. |
| [Maths validation](../../../../src/lib/infoCards/mathsValidation.ts), [source preparation](../../../../src/components/maths-renderer/prepareContent.ts) | Optional diagnostic/error types and pure syntax/safety rules. |
| [Mongo transaction helper](../../../../src/lib/mongodb.ts) | `withMongoTransaction`; reuse same client/session. |
| [Info setup CLI](../../../../scripts/setup-info-cards.ts) | Explicit idempotent index setup; no execution authorised here. |
| [Creator names](../../../../src/lib/cards/creatorAttribution.ts), [auth](../../../../src/lib/auth.ts) | Username-only projection/fallback; session actor. |
| [HTTP boundaries](../../../../src/lib/cards/http.ts), [Info HTTP](../../../../src/lib/infoCards/http.ts) | Strict fields, actor binding, safe errors/private no-store. |

### B.2 API and route loaders

| File | Role / proposed change |
| --- | --- |
| [Info root collection route](../../../../src/app/api/info-cards/route.ts) | Owner drafts GET gains unfinished personal scope before pagination; creator-only create POST remains separate. |
| [Info editor route](../../../../src/app/api/info-cards/[infoCardId]/route.ts) | Owner GET/PATCH/DELETE; personal purpose invariant and removed-record retention. |
| [Publish route](../../../../src/app/api/info-cards/[infoCardId]/publish/route.ts) | Must reject personal kind, not relabel public publication. |
| [Publication reader](../../../../src/app/api/info-cards/[infoCardId]/publication/route.ts) | Strict creator-purpose default; personal direct reads require separate owner scope, never a Library inclusion rule. |
| [Catalogue route](../../../../src/app/api/library/info-cards/route.ts) | Creator-purpose only, including owner Library; personal roots never appear in Library or the shared picker. |
| [Series route](../../../../src/app/api/info-card-series/route.ts) | Reuse own-first discovery/create, no new search UI/series namespace. |
| [Main-context consultation](../../../../src/app/api/card-templates/[cardTemplateId]/info-cards/route.ts) | Combined working snapshot; canonical excludes personal. |
| [Upload](../../../../src/app/api/info-cards/[infoCardId]/upload/route.ts), [status](../../../../src/app/api/info-cards/[infoCardId]/media/status/route.ts), [delivery](../../../../src/app/api/info-cards/[infoCardId]/media/route.ts) | Owner allocation/status and exact-version media access. |
| [Rendering diagnostic](../../../../src/app/api/info-cards/[infoCardId]/check-rendering/route.ts) | Owner optional diagnostic with saved revision. |
| [Existing editor loader](../../../../src/app/creator/info-cards/[infoCardId]/page.tsx), [new editor loader](../../../../src/app/creator/info-cards/new/page.tsx) | Authoritative purpose dispatch on direct URL/reload; normal Creator behaviour preserved. |
| `src/app/api/cards-data/[cardTemplateId]/personal-info-cards/route.ts` — **proposed new** | Context-bound create POST and owner-association detach PATCH, not another content domain. |
| `src/app/api/info-cards/[infoCardId]/save/route.ts` — **proposed new** | Personal-only usable Save/receipt entry. |

### B.3 Presentation, lifecycle and media

| File | Role |
| --- | --- |
| [FocusedCardView](../../../../src/components/decks/FocusedCardView.tsx) | Consultation identity/count/request, mounted player/activity, gesture guards and actor lifecycle. |
| [StepView](../../../../src/components/decks/StepView.tsx), [scoped styles](../../../../src/components/decks/StepView.module.css) | Zero gate; real footer, pouch and fixed stack placement; header/X reservation. |
| [Pouch](../../../../src/components/info-cards/InfoCardPouch.tsx), [pouch styles](../../../../src/components/info-cards/InfoCardPouch.module.css) | Visible triangle, larger invisible hit region, closed count/open position; zero gate. |
| [Consultation](../../../../src/components/info-cards/InfoCardConsultation.tsx), [styles](../../../../src/components/info-cards/InfoCardConsultation.module.css) | Native dialog, geometry, delayed status, nested media and pinned selection. |
| [Physical stack](../../../../src/components/info-cards/InfoCardPhysicalStack.tsx), [styles](../../../../src/components/info-cards/InfoCardPhysicalStack.module.css) | Circular order, physical motion/locks, zero-array assumption; do not redesign. |
| [Client snapshot mapping](../../../../src/components/info-cards/infoCardConsultationClient.ts) | Current shared-only ID/count check and actor postcheck; needs mixed date-order membership validation and card creator mapping. |
| [Common face](../../../../src/components/info-cards/InfoCardFace.tsx), [face styles](../../../../src/components/info-cards/InfoCardFace.module.css) | Shared header/body/media; planned centred creator footer, approved personal surface and scoped contextual action slots. |
| [Maths consumer](../../../../src/components/info-cards/infoCardMaths.ts), [font styles](../../../../src/components/info-cards/InfoCardMaths.module.css) | Consumer collision boundary and approved presentation; renderer remains shared. |
| [Diagnostic host](../../../../src/app/internal/info-maths/Host.tsx) | Actual common face for optional server-side diagnostics; must receive new presentation data. |
| [Editor](../../../../src/components/info-cards/InfoCardEditor.tsx), [controller](../../../../src/components/info-cards/infoCardEditorController.ts) | Existing form/media/maths/serial autosave/journal/receipt machinery; extract only contextual mode seams. |
| [Series selector](../../../../src/components/info-cards/InfoSeriesSelector.tsx) | Grouped own/discoverable dropdown, retained selection and explicit creation. |
| [Creator requests](../../../../src/components/creator/creatorRequest.ts), [navigation](../../../../src/components/creator/creatorNavigation.ts), [draft entries](../../../../src/components/creator/creatorDraftEntries.ts) | Actor lifetime, ordinary hybrid routes and independent draft dispatch. |
| [Library cards](../../../../src/components/library/InfoCardsLibrary.tsx) | Existing own/public face-up grid, external creator credit and Edit; preserve creator-only collection; common face carries centred creator credit, so remove redundant external card attribution. |
| [Attachment picker](../../../../src/components/creator/InfoCardAttachments.tsx) | Canonical creator-only catalogue consumer; preserve My Cards/Other Cards design and metadata race fix. |
| [Dialog](../../../../src/components/library/LibraryDialog.tsx), [Info dialog hook](../../../../src/components/info-cards/useInfoCardDialog.ts) | Existing native modal/focus/isolation patterns, not a generic new overlay framework. |
| [Remote media](../../../../src/components/info-cards/InfoCardRemoteMediaViewer.tsx), [viewer](../../../../src/components/info-cards/InfoCardMediaViewer.tsx) | Exact publication fetch, nested focus restoration and image/video composition. |
| [Upload adapter](../../../../src/components/info-cards/infoCardUpload.ts), [video status hook](../../../../src/components/info-cards/useInfoVideoStatus.ts) | Required upload headers/proof, processing, cancellation and stale-response handling. |
| [Info media security](../../../../src/lib/infoCards/media.ts), [registry](../../../../src/lib/infoCards/mediaRegistry.ts) | Scope-aware proof/authorisation, provider readiness and durable provenance. |
| [R2](../../../../src/lib/cloudflareR2.ts), [Stream](../../../../src/lib/cloudflareStream.ts), [protected delivery](../../../../src/lib/cards/protectedMedia.ts), [grant reuse](../../../../src/lib/cardPlaybackGrants.ts) | Existing storage/upload/signed token/proxy infrastructure; no new renewal manager. |
| [HLS player](../../../../src/components/media/CloudflareHlsVideoPlayer.tsx), [DeckScene](../../../../src/components/decks/DeckScene.tsx), [AppShell](../../../../src/components/layout/AppShell.tsx) | Playback suspension versus unmount/reset; focused activity/navigation context. |
| [Working media interface](../../../../src/components/decks/WorkingFocusedCardView.tsx), [working updates](../../../../src/components/decks/useWorkingDeck.ts) | Current uploads versus source-targeted ancestor removals; update source/descendant histories after acknowledgement. |
| [Main Card creator attribution](../../../../src/components/cards/CardCreatorAttribution.tsx), [existing app styles](../../../../src/app/globals.css) | Centre convention at CSS 4642–4645; reuse positioning, not main-card lineage popover. No global CSS changes planned. |
| [Deck contextual menu](../../../../src/components/decks/DeckMenu.tsx), [Overview menu](../../../../src/components/layout/OverviewMenu.tsx) | Restrained trigger/dismissal styling; Deck-specific actions remain unrelated and unchanged. |
| [Main Creator title modal](../../../../src/components/creator/CreatorDragLab.tsx) | Nested `CreatorEditModal` is not the Info authoring form. |

### B.4 Tests, evidence and documentation

- §12 inventories the exact existing test suites to extend. New personal-specific filenames/routes in this document are proposals, not claims they exist.
- [Phase 1A](phase-1a/README.md), [1B](phase-1b/README.md), [1C](phase-1c/README.md) document approved pouch geometry, physical interaction and playback/activity isolation. Their older screenshots are visual history, not current 204px maths measurements.
- [Phase 2](phase-2/README.md), [Phase 3](phase-3/README.md), [Phase 4](phase-4/README.md) record independent content, Creator/Library and main-context integration. Historical open gates must be reconciled with later decisions/source, not blindly repeated.
- [Phase 5 report](phase-5/README.md), [security notes](phase-5/security-release-notes.md), [workflow notes](phase-5/workflow-notes.md) record broad prior verification and the subsequently fixed metadata race; no historical test count is a fresh personal-feature pass.
- [Current maths integration record](../../../../tests/info-maths/README.md) supersedes old “maths deferred”/required-certificate assumptions.
- [Media trial/backlog](info-card-media-security-backlog.md) records accepted direct-R2 risk and signed new videos. Its last combined image CORS failure is historical; the task history reports a later authorised localhost browser-upload pass. This planning run did not rerun or independently certify either live provider result.
- [Browser runner](../../../../scripts/test-phase2.ts), [integration config](../../../../playwright.info-cards-integration.config.ts), [capacity config](../../../../playwright.info-cards-capacity.config.ts), [package commands](../../../../package.json) provide existing disposable/Chromium/build conventions.

## QUESTIONS

### 1. Product decisions — resolved

**No blocking product questions remain.**

The original Question 5 recommendation to start forks without inherited personal notes is withdrawn. Verified CardData ancestry is required, inherited Remove targets its original source, and no fork/source explanation, warning, confirmation or descendant-only state is added.

The finalisation decisions are incorporated throughout §§1–14, not left in an addendum that conflicts with older recommendations:

- Approved common-face footer, centred actual creator, sage, bottom-right menu, single empty-state plus and open-pouch Save/Edit/Remove/Cancel outcomes replace the old toolbar/right-aligned-credit/close-after-Save proposals.
- Personal cards never appear in Library. Clean removed records may remain inaccessible.
- The owner subsequently approved **existing My Drafts for unfinished personal work**: incomplete and saved-but-dirty attached personal cards only; clean/removed cards excluded.
- The owner subsequently rejected original-creation ordering for older material attached later and then explicitly confirmed **attachment date must be a stored property whenever an Info Card is attached**. §§4–5 specify dates on both shared and personal associations, mixed newest-attached-first ordering and legacy fallback. No source-block or latest-content-publication ordering remains.
- Direct public R2 image URL exposure for non-sensitive personal notes is accepted for the small trial; public-launch protection is deferred in Appendix A.

### 2. Bounded implementation checks — not approval gates

- Verify the starting footer geometry with real legacy/maths/media samples and measured hit rectangles; preserve outer face/fonts and current publication rules. Report an actual incompatibility rather than silently introducing a new rule.
- Complete the canonical timestamp writer/semantic-equality/receipt audit against the actual modified code and use existing transaction boundaries. Date maps are proposed additive fields, not an installed schema change.
- Verify purpose-aware My Drafts recovery using server context with an empty browser journal; no personal Library or arbitrary-parent fallback.
- Verify native nested-dialog focus containment for textarea/select and controlled settled-stack reconciliation without replay/remount.
- Test setup on disposable replicas and report the separately authorised live users index; verify actual provider results only when permitted. Neither a planning document nor an old test result is live deployment evidence.

Routine implementation details within these contracts are delegated to engineering judgement. Unexpected product/ownership/security contradictions must be reported; planned checkpoints themselves do not require repeated approval.

### 3. Deferred work — not V1 blockers

- Protect private image origin/delivery before a public-launch confidentiality promise (Appendix A).
- Consistent account-wide deletion/export/retention and any future clean-detached recovery/reattachment experience, under separate product design.
- Scale-driven association migration or stronger media-token revocation only if observed needs justify them. No speculative service, scheduler or new ancestry framework.

**Readiness:** this plan is ready for a subsequent single-instruction autonomous A–E implementation. This document is not that coding authorisation. Deterministic tests and a progress handoff are required at each checkpoint; production index/provider actions and deployment remain separately authorised.
