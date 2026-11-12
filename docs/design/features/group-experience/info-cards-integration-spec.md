# Info Card Improvements — Product Specification and Engineering Planning Brief

**Status:** Product decisions D0–D10 approved on 12 November 2026 and incorporated below. Open questions arising from them are listed under [Open product questions](#open-product-questions).
**Engineering plan:** [info-cards-integration-engineering-plan.md](../../../engineering/features/group-experience/info-cards-integration-engineering-plan.md)

## Purpose

This specification defines four phases of work to fix existing problems and improve the Info Card experience in the Switchplay application.

The application is currently an MVP with very few trial users and no published Info Cards that need backward compatibility. Keep the engineering approach straightforward and proportionate. Avoid unnecessary abstractions, large refactors, feature flags or enterprise-style rollout procedures.

## Info Card types

Three types of Info Card are referred to throughout this specification.

| Type | Belongs to | Who sees it |
| --- | --- | --- |
| **Creator Info Card** | The creator who published it; attached to a Card template | Everyone who can view the Card |
| **Personal Info Card** | An individual user; attached to their own CardData | Only its owner |
| **Group Info Card** | A Group Experience; created by Group admins on behalf of the Group | Members of that Group (see Phase 4) |

### Approved colour palette (D1, D10)

The same colours apply everywhere in the application, including every Group Experience perspective. There is no alternative Group colour scheme.

| Type | Background | Text |
| --- | --- | --- |
| Creator Info Card | Existing slate gradient `#303947` → `#252D39` | Existing text styling |
| Personal Info Card | Muted green `#305047` | Accessible light text |
| Group Info Card | Prominent teal `#147D6C` | White `#FFFFFF` |

- Group Info Cards are the most visually prominent. Personal Info Cards are more subdued but clearly distinguishable from Creator Info Cards.
- Text on every type must meet accessible contrast.
- Card type must not be communicated by colour alone. The focused card must also identify its type in text.

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

All Phase 1 code is committed and pushed. The only remaining administrative step was committing this specification and its engineering plan (D0).

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
- A user looking at a stack of, for example, three Creator Info Cards and two Personal Info Cards should recognise that mixture from the strips. The same applies to Group Info Cards once they exist.
- When fewer cards are upcoming, show only as many strips as there are upcoming cards.
- The focused card identifies its type in text as well as colour.
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

**Objective:** Allow creators to press Publish once, even when their intended media is still being processed.

This applies to Creator Info Card **Publish** and to Personal Info Card **Save**, using the same behaviour (D6).

#### Required behaviour

- The user presses **Publish** (or **Save** for a Personal Info Card) once.
- If all intended media is already ready, publication proceeds normally.
- If media is still processing, the application keeps the request and waits for the media to become ready.
- Once the intended media is ready, the application completes publication automatically.
- The user can see that publication is pending.
- The user receives a clear confirmation when publication succeeds.

#### Leaving before processing finishes (D5)

- If it can be done with existing infrastructure or another straightforward, low-cost mechanism, publication completes even after the user closes the browser.
- Otherwise, the pending request is retained and publication completes when the user next opens the application.
- Either way, the pending request is never lost silently, and the user is told the outcome next time they are in the application.
- Do not build substantial new background-processing systems, complex webhooks, queues or services for this.

#### Failure handling

If media processing fails:

- Do not publish an incomplete Info Card.
- Preserve the draft or previously published version.
- Show a clear error identifying the affected Info Card.
- Provide a straightforward retry path.
- Never publish without the media the user intended to include.

If the user edits the Info Card after pressing Publish and before publication completes, the pending request no longer matches what they confirmed. It must not publish the edited content without a fresh Publish.

---

## Phase 4 — Info Cards within Group Experiences

**Objective:** Extend Info Cards into Group Experience contexts, covering two separate concepts:

- **4A — Personal Info Cards in Groups:** a user's own private Personal Info Cards, available while they are in a Group Experience.
- **4B — Group Info Cards:** Info Cards created by Group admins on behalf of the Group.

These are separate concepts and must never be confused. An admin's own private Personal Info Cards are not Group Info Cards, and creating a Group Info Card never creates or uses the admin's personal CardData.

### 4A — Personal Info Cards in Groups

**Approved principles (D7, D8):**

- Personal Info Cards belong to individual users and remain private to their owners.
- They are attached to the user's CardData. The same CardData is reused wherever the same Card template appears, so a user's Personal Info Cards for a Card are the same set in their personal Decks and in every Group Experience that uses that Card. They are never duplicated per Deck or Group.
- Personal Info Cards follow the same ownership, storage, visibility and perspective rules as personal media attachments and reflections in Group Experiences. No separate set of visibility rules is created for them.
- They must not automatically become shared Group content.
- The existing Personal Info Card pouch and attachment behaviour stays consistent across personal and Group contexts.
- Personal Info Cards use the muted green Personal colour in every perspective.

**Behaviour, applying the established personal media and reflection rules** (subject to the open questions below):

| Perspective | Personal Info Cards shown |
| --- | --- |
| The owner's ordinary personal Deck | The owner's own, as today |
| The owner's own Card within a Group (Me) | The owner's own, marked as private to them |
| Group perspective | None |
| An admin inspecting a follower | None (the follower's are private; the admin's are not part of that view) |

### 4B — Group Info Cards

**Approved principles (D9):**

- Group admins can create Group Info Cards on behalf of the Group, mirroring the way admins add Group reflections and Group media.
- Group Info Cards belong to the Group context, not to the admin's personal CardData.
- They follow the existing Group reflection and Group media patterns for permissions, ownership, visibility and perspective.
- They use the prominent teal Group colour with white text.
- Followers can distinguish Group Info Cards from their own Personal Info Cards, by colour and by text.
- They are never confused with the admin's own private Personal Info Cards.
- Group Info Cards are a new concept for this phase. Do not introduce wider sharing features such as per-member audiences without approval.

### Phase 4 rules

- Distinguish confirmed requirements from recommendations.
- Do not invent or lock additional Phase 4 behaviour without approval.
- Any additional data-model or permission decisions are identified before implementation.

---

## Open product questions

These arise from the approved decisions and need answers before the affected work starts. The engineering plan explains the evidence behind each.

| # | Question | Affects |
| --- | --- | --- |
| Q1 | In the established Group pattern, media and reflections a member creates **from inside a Group** belong to that Group context and are shared with the Group by default (an admin can hide them). Applying that rule to Personal Info Cards would make them shared, which conflicts with "private to their owner" and "follow the user's CardData". Should a Personal Info Card created inside a Group stay private and attached to CardData (recommended), or follow the Group-origin sharing pattern? | 4A |
| Q2 | Should a member's Personal Info Cards appear only in their own views (personal Deck and Me), never in the Group perspective or when an admin inspects them? This matches personal media and reflections. | 4A |
| Q3 | Where do Group Info Cards appear: in the Group perspective only, or also on each member's own Card within that Group (Me)? D9 implies followers see them beside their own Personal Info Cards, but the collective Group reflection appears on the Group Card only. | 4B |
| Q4 | Can every current Group admin edit and delete any Group Info Card (like the collective Group reflection), or only the admin who created it? | 4B |
| Q5 | What does a Group Info Card show as its credit: the Group name or the admin who wrote it? | 4B |
| Q6 | The earlier Group Experience plan described a much larger Group Info Card design (per-member audiences, private per-admin drafts, audience versions). Should the simpler model in this specification replace it for the MVP? | 4B |
| Q7 | Completing publication after the browser has closed is possible with a small scheduled job on Vercel. It needs one new configuration entry and a secret. Is that acceptable, or should completion happen only when the user next opens the application? | 10 |

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
6. **Decisions:** approved decisions and any that remain open.
7. **Risks and uncertainties:** only concrete, relevant concerns.
8. **Execution strategy and implementation sequence:** checkpoint commits, approval gates and model recommendations.

Preserve the requirements and phase boundaries in this specification. Do not silently expand scope, remove requirements or reinterpret approved behaviour.
