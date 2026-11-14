# Info Card Improvements — Product Specification and Engineering Planning Brief

**Status:** Product decisions incorporated below: D0–D10, Q1–Q7, P1–P3 (12 November 2026), R1 and C1–C4 (13 November 2026). C1 refines P2 and R1. No open product points remain for checkpoint 4.2b.
**Engineering plan:** [info-cards-integration-engineering-plan.md](../../../engineering/features/group-experience/info-cards-integration-engineering-plan.md)

## Purpose

This specification defines four phases of work to fix existing problems and improve the Info Card experience in the Switchplay application.

The application is currently an MVP with very few trial users and no published Info Cards that need backward compatibility. Keep the engineering approach straightforward and proportionate. Avoid unnecessary abstractions, large refactors, feature flags or enterprise-style rollout procedures.

## Terminology

The word *personal* has caused confusion because it has been used for a content type, a storage location and a viewing perspective. This specification uses the following terms precisely.

### Info Card types (content types)

| Type | Meaning |
| --- | --- |
| **Creator Info Card** | Published by a creator and attached to a Card template. Everyone who can view the Card sees it. |
| **Personal Info Card** | Created on the fly by a user following a Card. The term describes the type of content only, not where it is stored, who can see it or which perspective it is viewed from. |
| **Group Admin Info Card** | Created by a Group admin in the Group perspective, as Group content. |

### Contexts (where a Card is being used)

| Context | Meaning | Where Personal Info Cards created here belong |
| --- | --- | --- |
| **Standalone context** | A Card used outside any Group Experience | The user's CardData |
| **Group Experience context** | A Card used within a Group Experience | The Group Experience, following the existing Group media-item architecture (not the user's CardData) |

A **standalone Personal Info Card** is one created in the standalone context. A **Group-created Personal Info Card** is one created by a follower in a Group Experience context.

### Perspectives (within a Group Experience)

| Perspective | Meaning |
| --- | --- |
| **Me** | A follower's own perspective on their own Card. |
| **Group** | The collective perspective, where Group content and followers' Group-created content are brought together. For a Group admin, the Me perspective is effectively the Group perspective. |
| **Other followers** | Viewing another follower's Card, where the Group's visibility settings permit it. |

### Roles

| Role | Meaning |
| --- | --- |
| **Follower** | A member participating in the Group Experience. |
| **Admin** | A user managing the Group Experience and its collective content. |

### Contribution identities (P1, P3)

Content a user creates inside a Group Experience is either an **Admin contribution** or a **Follower contribution**. The perspective it was created in decides which, fixed at the moment of creation.

| Created in | Contribution | Info Card type | Colour |
| --- | --- | --- | --- |
| The Group perspective | Admin contribution | Group Admin Info Card | Teal `#147D6C` |
| The follower's Me perspective | Follower contribution | Personal Info Card | Muted green `#305047` |

- A user who is both admin and follower in the same Group Experience has **two separate contribution identities**, treated as though they were two different users. Their Admin and Follower contributions never mix in storage, history, visibility, editing, deletion or presentation, even though both carry the same account.
- Later role changes never reclassify an existing contribution.
- **Follower contributions** keep the existing media-item owner history: the author sees them on their standalone Card and in their Me perspective in every Group Experience using that Card template, marked private where they did not originate in the current Group. They appear in their originating Group perspective under the existing sharing and hiding rules. Other users never gain access to the author's private cross-context content.
- **Admin contributions** belong exclusively to their originating Group Experience. They appear in that Group's Group perspective under the existing visibility rules. They never appear on a standalone Card, in another Group Experience (even one the same admin manages) or in the same user's Me perspective, and never become Follower contributions.
- These rules apply identically to **media items and Info Cards**.

### Canonical reference for Info Card behaviour (Q1)

**Media items are the sole canonical reference** for Info Card storage, ownership, visibility, privacy, permissions, attribution and perspective behaviour in Group Experiences. Reflections are not a reference: they are lightweight comments with a different contextual model.

- Info Cards reproduce media-item behaviour. They do not get their own visibility, audience or permission system.
- If the media-item implementation conflicts with an explicitly stated requirement in this specification, stop, report the conflict and ask for approval before proceeding.
- Never silently change the requested Info Card behaviour to match the code. Never silently change media-item behaviour to match this specification.
- The approved, deliberate changes to media-item behaviour are:
  - the contribution-identity correction above (P1): Admin contributions stop appearing in the author's other contexts;
  - identity-aware deletion (R1);
  - creation-context management (C1): an item is edited or permanently deleted only in the exact context in which it was created (see [Permissions](#permissions-q4-p2-c1-c2));
  - Delete and Hide kept strictly separate (C2), including the correction of an admin's own Admin upload receiving Hide instead of Delete.

  Media items and Info Cards then follow the same corrected rules. Visibility and Group hiding are not changed by R1, C1 or C2.

### Approved colour palette (D1, D10)

The same colours apply in the standalone context and in every Group Experience perspective. There is no alternative Group colour scheme.

| Type | Background | Text |
| --- | --- | --- |
| Creator Info Card | Slate gradient `linear-gradient(145deg, #303947, #252D39)` | Existing text styling |
| Personal Info Card (standalone or Group-created) | Muted green `#305047` | Accessible light text |
| Group Admin Info Card | Prominent teal `#147D6C` | White `#FFFFFF` |

- Group Admin Info Cards are the most visually prominent. Personal Info Cards are comparatively subdued but clearly distinguishable from Creator Info Cards.
- Text on every type meets accessible contrast.
- Card type is never communicated by colour alone. The focused card also shows a visible type indication.

---

## Phase 1 — Fix existing problems

Phase 1 has been implemented, manually tested, committed and pushed. Do not reopen completed Phase 1 work without evidence of a problem.

### 1. Merge main into feat/group-experience

- Carefully merge `main` into `feat/group-experience`.
- Reconcile conflicting files while preserving Group Experience functionality.
- Run regression tests to identify merge-related problems.

**Status:** Completed.

### 2. Verify unavailable Decks and Creator recovery

- Confirm that the two previously unavailable Decks reappear.
- Verify that failed uploads no longer trap users inside the Creator.
- Investigate further only if problems remain.

**Status:** Completed and manually verified.

### 3. Fix Preview media uploads

- Identify and use the stable Vercel Preview URL for `feat/group-experience`.
- Verify the R2 CORS requirements.
- Ensure the relevant Preview origins are authorised for both `path-assets` and `path-user-data`.
- Preserve existing legitimate upload permissions.

**Status:** Completed. Both Cloudflare R2 bucket policies have been updated and uploads successfully tested. No Git commit is required for these policy changes.

### 4. Fix Personal Info Card creation and error recovery

- Diagnose and fix the unresponsive series dropdown on iPhone.
- Resolve problems interacting with the title and other form fields.
- Ensure failed Info Card uploads can be retried without reselecting the original file.
- Allow users to dismiss or abandon failed uploads without becoming trapped in the editor.
- Preserve existing form content through errors.
- Display accurate, understandable error messages.
- Resolve the missing MongoDB index required for Personal Info Cards.

**Status:** Completed and manually accepted. The missing non-unique index on `users.cardsData.personalInfoCardIds` has been installed in the shared MongoDB Atlas database, and index-readiness checks pass.

### Phase 1 completion

All Phase 1 code is committed and pushed.

---

## Phase 2 — Improve the Info Card experience

Phase 2 contains five checkpoints. Implement them separately so each can be tested and reviewed before moving on.

### 5. Info Card dimensions, colours and stack visibility

**Objective:** Make the Info Card more compact and let users recognise the mixture of Info Card types in a stack at a glance.

**Approved initial dimensions (D1):**

| Element | Current | Approved initial target |
| --- | --- | --- |
| Header | 33px | 33px |
| Text area | 109px | 93px (about 15% less) |
| Footer | 60px | 45px |
| Overall height | 204px | About 173px |
| Width | 240px | Unchanged |

These are initial targets, subject to visual review on iPhone. Text capacity does not need to be preserved for legacy test content.

**Requirements:**

- Apply the approved colour palette to each Info Card type.
- Replace the existing generic grey strips behind the top card with **four visible strips of about 5px each**. Each strip represents an actual upcoming Info Card and uses that card's type colour.
- A user looking at a stack of, for example, three Creator Info Cards and two Personal Info Cards recognises that mixture from the strips. The same applies to Group Admin Info Cards once they exist.
- When fewer cards are upcoming, show only as many strips as there are upcoming cards.
- The focused card shows a visible type indication as well as its colour.
- Preserve the existing stacked-card interaction, navigation and animation.
- Maintain a clean, mobile-first presentation without introducing unnecessary vertical scrolling.

### 6. Empty Info Card pouch

**Objective:** Provide a simple way to create the first Personal Info Card when the pouch is empty.

**Requirements (D2):**

- Tapping an empty Info Card pouch opens a small panel containing an **Add Personal Info Card** action.
- The panel animates out of the pouch using the same opening animation as existing Info Cards. It must not simply appear.
- Do not display a full-sized empty Info Card.
- Do not include a Close button.
- Tapping outside the panel dismisses it.
- Selecting the action opens the existing Personal Info Card creation flow.
- After the first Personal Info Card is saved, it opens automatically as the focused card in the stack.
- Preserve the normal pouch behaviour when Info Cards already exist.

Keep the interaction compact and appropriate for iPhone.

### 7. Simplify the media attachment interface

**Objective:** Replace fragmented or confusing media controls with one coherent media area.

The interface should clearly support the complete media lifecycle:

- Selecting an image or video.
- Uploading.
- Processing.
- Ready for use.
- Upload or processing failure.
- Retrying.
- Replacing existing media.
- Removing media.

**Requirements:**

- Present these states within one clear media area.
- Avoid duplicated controls or conflicting status messages.
- Use human-readable messages rather than technical errors.
- Make it obvious what the user can do in each state.
- Preserve entered content if a media operation fails.
- Ensure retry, replacement, removal and abandonment behave predictably.
- Preserve the successful upload-recovery behaviour established in Phase 1.
- Reuse existing media components where practical rather than creating another independent upload system.
- Do not change unrelated media workflows unless required for the agreed scope.

### 8. Fix portrait video presentation in the Info Card attachment viewer

**Objective:** Remove the black bars that appear **above and below portrait videos attached to Info Cards**, when viewed after tapping the Info Card's video attachment.

This concerns the Info Card attachment viewer only. It does not concern Card introductions, Step videos or Deck introductions.

**Requirements (D3):**

- Portrait Info Card videos display without application-introduced bars above and below.
- Preserve the video's aspect ratio. Do not distort, stretch or unnecessarily crop meaningful content.
- Do not introduce significant changes to shared video infrastructure.
- Avoid regressions in other video presentations.
- Build on the existing investigation rather than repeating it, and do not spend substantial effort on this relatively minor issue.
- If the fix is not straightforward, defer it to a separate media-presentation task covering both:
  - black bars above and below Info Card portrait videos;
  - unwanted borders to the left and right of images elsewhere in the application.

### 9. Improve Info Card content formatting

**Objective:** Support predictable mathematical formatting and explicit content alignment controls.

All formatting behaviour is specific to Info Cards (D4). It must not change how maths or text appears anywhere else in the application.

#### Mathematical formatting

- Display maths uses full-width containers.
- KaTeX controls its own centring and mathematical alignment within those containers.
- Avoid wrapping display maths in restrictive inline-width elements.

#### Default text alignment

- Ordinary text remains left-aligned by default.
- Do not automatically centre all Info Card content.

#### Horizontal centring

Support `[[centre]]...[[/centre]]`. Content within these tags is centred horizontally.

#### Vertical centring

Support `[[v-centre]]...[[/v-centre]]`. Content within these tags is centred vertically within the available content space.

- The available space is the area remaining after accounting for media and fixed Info Card elements.
- Vertical centring must not cause content to overlap fixed elements or disappear outside the Card.

#### Combined alignment

- Both tags can be combined to centre content horizontally and vertically.
- Nested or combined tags are interpreted consistently, whichever order they appear in.

#### Blank lines

- Support intentional blank lines in Info Card content.
- Preserve meaningful spacing between paragraphs and mathematical expressions.
- Avoid collapsing deliberate blank lines unexpectedly.

#### Scope

- Existing plain-text test cards need no additional compatibility work beyond preserving normal functionality.
- Do not introduce formatting changes that could affect Cards, Steps, Decks or other content.

---

## Phase 3 — Improve publishing

### 10. Automatic publication after media processing

**Objective:** Let users press Publish or Save once, even when their intended media is still being processed.

One mechanism applies to Creator Info Card **Publish** and Personal Info Card **Save** (D6, Q7). The pending request is stored persistently. There is no background processing for the MVP: no scheduled jobs, webhooks, queues or workers.

#### Scenario A — media is already ready

1. The user presses Publish or Save.
2. The application verifies that the intended media is ready.
3. Publication or saving completes normally.
4. The user receives confirmation.

#### Scenario B — media is processing and the user stays

1. The user presses Publish or Save once.
2. The application records a pending request.
3. While the relevant interface stays open, the application checks whether processing has finished.
4. Once the intended media is ready, publication or saving completes and the pending request is cleared.
5. The user receives confirmation.

The user does not press Publish or Save again.

#### Scenario C — media is processing and the user leaves

1. The user presses Publish or Save, and the pending request is recorded.
2. The user closes the browser or leaves the relevant interface.
3. The pending request stays stored. The draft stays unpublished, or the existing published version stays unchanged.
4. Nothing checks for completion while the user is away.
5. When the user returns to the relevant Creator or Info Card interface, checking resumes.
6. If the media is ready, publication or saving completes automatically and the pending request is cleared.
7. The user receives confirmation.

The user does not press Publish or Save again.

#### Scenario D — processing fails

- Never publish an Info Card without its intended media.
- Preserve the draft or existing published version.
- Keep enough of the pending context to show an accurate failure state.
- Show a clear, human-readable error identifying the affected Info Card.
- Provide a retry or replacement path.
- Never silently publish incomplete content.

#### Scenario E — the user edits while publication is pending

- Editing the Info Card cancels its pending request.
- The user may press Publish or Save again after making changes.
- An outdated version is never published unexpectedly.

#### Pending state

The pending state must be understandable to the user wherever the affected Info Card appears in the relevant interface.

---

## Phase 4 — Info Cards within Group Experiences

**Objective:** Extend Info Cards into Group Experience contexts by reproducing the existing Group media-item behaviour exactly (Q1, Q6). There is no separate Info Card audience, sharing or visibility system.

Phase 4 covers:

- **Standalone Personal Info Cards** as they appear inside a Group Experience.
- **Group-created Personal Info Cards** created by followers.
- **Group Admin Info Cards** created by admins in the Group perspective.

### Prerequisite: Group media correction (P1)

Before any Phase 4 Info Card work, Group media items are corrected to follow the [contribution identities](#contribution-identities-p1-p3) rules. Today, media an admin adds in the Group perspective also appears on that admin's standalone Card and in other Group Experiences using the same Card template. After the correction it appears only in its originating Group perspective. Follower media visibility is unchanged. Management of follower media changes only as R1, C1 and C2 state (see [Permissions](#permissions-q4-p2-c1-c2)); this supersedes any earlier statement that follower media behaviour is entirely unchanged. Info Cards are then built on the corrected rules.

### Storage and ownership (Q1, D8, P3)

| Info Card | Belongs to | Notes |
| --- | --- | --- |
| Standalone Personal Info Card | The user's CardData | Existing behaviour. Reused wherever the same Card template appears, as standalone media items are. |
| Group-created Personal Info Card | The Group Experience context, as a Follower contribution | Never stored in the user's standalone CardData. |
| Group Admin Info Card | The originating Group Experience only, as an Admin contribution | Never uses the admin's CardData. Separate from the same user's Follower contributions and standalone Info Cards. |

### Visibility (Q2, Q3, P1)

Visibility mirrors the corrected media-item rules exactly.

| Perspective | Info Cards shown, besides Creator Info Cards |
| --- | --- |
| **Standalone context** | The user's standalone Personal Info Cards and all their Follower contributions for the same Card template. Never their Admin contributions. |
| **Me** (follower) | Their Follower contributions for the same Card template, and their standalone Personal Info Cards. Those not originating in the current Group (standalone ones, those from other Group Experiences, and those hidden here) carry the existing **private icon**. Never their own Admin contributions. |
| **Group** | Admin contributions and Follower contributions originating in this Group Experience, under the established visibility and hiding rules. Never anyone's standalone Personal Info Cards. |
| **Other followers** | That follower's Follower contributions originating in this Group, under the Group's sharing settings. Never their standalone Personal Info Cards, and never Admin contributions by the same person. |

- Group Admin Info Cards appear only in the Group perspective of their originating Group Experience. Followers visit the Group perspective to see them.
- Standalone Personal Info Cards are never exposed to admins or other followers, whether through the Group perspective or follower comparison.

### Permissions (Q4, P2, C1, C2)

**Canonical rule (C1): an item may only be edited or permanently deleted from the exact context in which it was created.** It applies to media items and Info Cards alike.

| Creation context | Meaning | Where its author may edit or delete it |
| --- | --- | --- |
| **Standalone Card** | Created on the user's standalone Card | The standalone Card only |
| **Group A · Me** | Created by a follower in their Me perspective of Group A | Me in Group A only |
| **Group A · Group** | Created by an admin in the Group perspective of Group A | The Group perspective of Group A only |

- Different Groups are different contexts, even when they use the same Card template.
- The context comes from where the item was created, as stored on the item. It never comes from the user's current role or from the perspective they happen to view it in.
- Only the original author edits or deletes. Admin status never grants editing or deletion of another author's item.
- **Visibility is unchanged:** items stay visible wherever the visibility rules above allow, including cross-context owner history and the private icon. Admin and Follower contributions stay isolated. Only the management controls follow C1.
- C1 refines R1 and P2. A Follower contribution is no longer deletable from the standalone Card, and a Group contribution is no longer editable there.
- **Who enforces what:** the interface decides where Edit, Remove and Delete appear. The server enforces ownership and current Group permissions against the creation context stored on the item, on every write. It never accepts a client-declared identity in place of the stored one.
- **Membership and role changes:** a role change never reclassifies an item. Editing and deleting need the creation context to be reachable: an active follower for Group A · Me, a current admin for Group A · Group. See [Known limitations](#known-limitations-accepted).
- **One exception, for navigation only:** an unfinished Info Card draft may be reopened from My Drafts (C3). Ownership and Group permissions still apply in full.

**Delete and Hide are separate operations (C2):**

| | Delete | Hide |
| --- | --- | --- |
| Effect | Permanently removes the contribution | Removes it from Group visibility; nothing is deleted |
| Who | The original author only | Current admins of the Group, for any contribution originating there: by followers, other admins or themselves |
| Where | Only the exact creation context | The Group perspective of that Group |

- Delete always performs a genuine deletion. It never silently performs Hide.
- An admin who is also a follower may hide their own Follower contribution when viewing it in the Group perspective. This is ordinary admin hiding; no dual-role exception exists.
- The existing hiding rules and their server-side authorisation are unchanged.

**Media Centre:**
- **Inside the creation context:** the existing Delete control.
- **Outside the creation context:** in place of Delete, a read-only origin indication. A small, visually subordinate **Created in:** label sits above the context name, for example:
  - Created in: Personal Card
  - Created in: Group A · Me
  - Created in: Group A · Group
- The origin is shown even where the viewer, as an admin, may also hide the item. Hide stays as its own separate action.
- No disabled Delete control is shown.
- This appears only in Media Centre. Nothing is added to the Card face.
- Uploading, playback, hiding and visibility are unchanged.

**Info Card three-dot menu:**
- **Inside the creation context:** the existing **+ New**, **Edit** and **Remove**, under the existing ownership and permission requirements.
- **Outside the creation context:** the three-dot button stays. The menu contains the read-only **Created in: [originating context]** and **+ New**. It has no Edit, no Remove and no disabled equivalents.
  - + New stays because it creates a new Info Card in the current context, not a change to the displayed one.
- The menu is wide enough for the Group name. Long names wrap without clipping or leaving the screen, in the existing menu styling.
- No origin label is added to the Info Card face. The card's layout, dimensions and visual hierarchy are unchanged.
- Creator Info Cards are unchanged.
- These rules apply to Group Admin Info Cards as soon as they exist (checkpoints 4.3–4.4).

### Drafts and My Drafts (C3)

Creator Info Cards and Personal Info Cards use the same Info Card editor, shown in Creator mode or as the modal over a Card. All four creation workflows keep unfinished drafts in the **existing My Drafts list**:

| Workflow | Status |
| --- | --- |
| Creator Info Cards attached to Card templates | Existing |
| Standalone Personal Info Cards | Existing |
| Follower-created Personal Info Cards in a Group's Me perspective | Existing (checkpoint 4.2); refined by checkpoint 4.2b |
| Admin-created Group Info Cards in the Group perspective | Checkpoints 4.3–4.4 |

- Unfinished work is autosaved, as today.
- **An unfinished Group draft** (a Group Info Card that has never been saved) opens from My Drafts **directly in the existing editor**. There is no navigation through its Group, Card or perspective, and no separate Group My Drafts interface.
- The draft stays identifiable as belonging to its originating context, for example "Group A · Me", in My Drafts and in the editor.
- The server checks current ownership and Group permissions against the creation context stored on the Info Card, on every write. A user who can no longer act in that context cannot continue the draft.
- **Saved Info Cards are not edited through My Drafts.** Once a Group Info Card has been saved, Edit and Remove are available only in its creation context. Unsaved changes to a saved Group Info Card are continued from Edit there; My Drafts does not list them.
- Save and automatic publication after video processing work as today.
- Reopening an unfinished draft from My Drafts is an **exception to the navigation aspect of C1 only**. It is never an exception to ownership or Group permissions.
- Standalone Personal and Creator Info Card drafts keep their existing My Drafts behaviour.

### Known limitations (accepted)

Because Admin contributions belong only to their originating Group:

- If another admin hides an Admin contribution, its author may no longer be able to see or reach it.
- If an admin leaves the Group, or can no longer view its Group perspective, they may lose access to their previous Admin contributions and be unable to delete them.

Because of C1 (C4):

- A former follower of Group A cannot edit or delete contributions created in Group A · Me, including unfinished drafts.
- A former admin of Group A cannot edit or delete contributions created in Group A · Group, including unfinished drafts.
- Rejoining with the appropriate role restores management.
- Visibility and Group hiding are unchanged: the items remain visible where the visibility rules allow, and admins can still hide them.

These are accepted for the MVP, without workarounds. There is no private Admin view, no separate owner-only access route, and no change to the meaning of the private icon. A general Media Centre that lets users manage contributions from Groups they have left is backlog only, recorded as future work in the engineering plan.

### Attribution (Q5)

Attribution matches Group media attribution exactly, for both Group Admin Info Cards and follower Group-created Info Cards. The distinction between Group Admin Info Cards and Personal Info Cards also remains clear through their approved colours and type indications.

### No audience-selection system (Q6)

- No audience-selection controls.
- No separate public, private or Group audience modes for Info Cards.
- No Info Card-specific visibility conditions.
- The objective is equivalent behaviour to media items, not a parallel system.

### Phase 4 rules

- Before implementing Phase 4, inspect the actual media-item code thoroughly.
- Apply the mandatory consistency rule under [Canonical reference for Info Card behaviour](#canonical-reference-for-info-card-behaviour-q1).
- Do not invent or lock additional Phase 4 behaviour without approval.

---

## Resolved questions

| # | Resolution |
| --- | --- |
| Q1 | Media items are the sole canonical reference. Standalone Personal Info Cards stay on CardData. Group-created and Group Admin Info Cards belong to the Group Experience context, following Group media items. Reflections are not a reference. |
| Q2 | Visibility mirrors media items exactly: own Group-created and standalone Info Cards in Me (standalone ones with the private icon); standalone ones never exposed to others. |
| Q3 | Group Admin Info Cards appear only in the Group perspective. Follower-created Group Info Cards also appear there. |
| Q4 | Editing, hiding and deleting follow existing Group media permissions. **Refined by C1 and C2.** |
| Q5 | Attribution matches Group media attribution. |
| Q6 | No audience-selection system. The earlier audience-based Group Info Card proposal is withdrawn. |
| Q7 | One persisted pending-publication mechanism for Publish and Save, resumed when the user returns. No background infrastructure. |
| P1 | Follower contributions keep cross-context owner history. Admin contributions belong only to their originating Group. A dual-role user's Admin and Follower contributions are separate identities. Media items are corrected to these rules before Phase 4. |
| P2 | Only the original author edits an Info Card. Admins hide under Group media permissions. Only the original author deletes. Admin status grants neither. **Refined by C1:** editing and deleting happen only in the item's creation context. |
| P3 | Creation perspective fixes the contribution type: Group perspective means Admin contribution (Group Admin Info Card), Me means Follower contribution (Personal Info Card). Role changes never reclassify. |
| R1 | Deletion respects the contribution identity: Admin contributions are deleted only from the Group perspective of their originating Group, Follower contributions only from Me or the standalone Card, and nobody deletes another person's contribution. Applies to media items and Info Cards, and is enforced by the server. **Refined by C1:** Follower contributions are deleted only from Me of their originating Group, no longer from the standalone Card. Superseded where it conflicts with C1. |
| C1 | An item may only be edited or permanently deleted from the exact context in which it was created: the standalone Card, Group A · Me or Group A · Group. Different Groups are different contexts. The context comes from the creation context stored on the item, never from the current role or viewing perspective. Outside that context, Media Centre shows "Created in: [context]" in place of Delete, and the Info Card menu shows that origin and + New only. Visibility and hiding are unchanged. The interface decides where controls appear; the server enforces ownership and current Group permissions against the stored context. Applies to media items and Info Cards. Refines P2 and R1. |
| C2 | Delete and Hide are separate. Delete permanently removes a contribution, only by its author, only from its creation context, and never silently hides. Hide is for current admins, on any contribution originating in their Group, including their own Follower contributions seen in the Group perspective; it never deletes. |
| C3 | All four Info Card workflows keep unfinished drafts in the existing My Drafts list: Creator, standalone Personal, follower Group (Me) and admin Group (Group perspective). An unfinished Group draft reopens directly in the existing editor, with no Group navigation, and stays identified with its originating context. The server checks current permissions against the stored context on every write. Saved Info Cards are never edited through My Drafts; that remains only in the creation context. An exception to the navigation aspect of C1 only. |
| C4 | Leaving a Group: a former follower cannot edit or delete Group A · Me contributions; a former admin cannot edit or delete Group A · Group contributions. Rejoining with the role restores this. Visibility and hiding are unchanged. A general Media Centre for past Groups is backlog only. |

---

## Implementation rules

These rules apply to every checkpoint.

### Investigation before implementation

- Inspect the relevant existing code and documentation first.
- Identify the current behaviour and architecture.
- Reuse existing components and patterns where practical.
- Distinguish genuine defects from intentional design decisions.
- Raise consequential product decisions before implementing them.

### Scope control

- Implement only the agreed checkpoint.
- Avoid unrelated refactors or architectural changes.
- Keep the work appropriate for an MVP.
- Preserve existing functionality outside the checkpoint.

### Testing

- Add or update focused automated tests.
- Run relevant integration and regression tests.
- Run TypeScript and lint checks where applicable.
- Identify behaviour that requires manual iPhone testing.
- Do not claim physical-device behaviour has been verified through automated tests alone.

### Reporting, commits and approval

- Every checkpoint ends with its own commit, after its automated tests pass.
- Some checkpoints require human approval before work continues; others continue automatically. The engineering plan defines which.
- For each completed checkpoint, report the commit hash, the changes, the test results, remaining risks and, where approval is required, a concise manual testing checklist.
- **Never push, merge or deploy without explicit authorisation.**

---

## Engineering plan deliverable

The engineering plan, in the repository's existing documentation structure, contains:

1. **Current implementation assessment:** what exists already, including the state of Phase 1.
2. **Architecture and dependencies:** relevant components, routes, services, data structures and media workflows.
3. **Checkpoint-by-checkpoint implementation plan:** files or modules likely to change, intended approach and acceptance criteria.
4. **Testing strategy:** focused tests, regression tests and manual iPhone checks for each checkpoint.
5. **Dependencies and sequencing:** work that should precede other work, and why.
6. **Decisions:** approved decisions, resolved questions and points still to confirm.
7. **Risks and uncertainties:** only concrete, relevant concerns.
8. **Execution strategy and implementation sequence:** checkpoint commits, approval gates and model recommendations.

Preserve the requirements and phase boundaries in this specification. Do not silently expand scope, remove requirements or reinterpret approved behaviour.
