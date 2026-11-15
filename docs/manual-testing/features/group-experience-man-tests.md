# Group Experiences — Manual Testing Checklist

**Status:** Pre-merge / release acceptance checklist  
**Scope:** Group Experiences, standalone Deck/Card interactions, Creator and Personal Info Cards, media, progress, assessments, reflections, membership and privacy.

## How to use this checklist

- **👁️** = Priority visual/touch check. Prefer testing on a physical iPhone.
- All other checkpoints are functional tests, suitable for desktop or iPhone.
- Tick each checkpoint when satisfied.
- Record defects separately, with the section letter and checkpoint number.
- Do not spend time testing every rare edge case. The purpose is to verify normal user journeys and the most important permission boundaries.

### Suggested test setup

Ideally have:

- A published Deck containing several Cards, including Cards with Creator Info Cards and instructional videos.
- A standalone Personal Deck using the same Cards.
- Two Group Experiences (Group A and Group B) using the same Deck.
- Two Admin accounts, including one Admin who is also a Follower.
- At least two Follower-only accounts.
- One image, one short video and one larger video suitable for testing slow uploads.
- Enough existing media and Info Cards to test mixed stacks, counts and pagination.

Use disposable/test content for deletion, hiding and membership changes.

---

## A. Published content and Group creation

- [ ] **A1.** Open a published public Deck in the Library and create a Group Experience using **Add as Group**.
- [ ] **A2.** Confirm unpublished/private Decks are not eligible for Group Experience creation.
- [ ] **A3.** Create a Group with a name, zero Followers and the creator as Admin. Confirm it opens and works.
- [ ] **A4.** Create another Group with multiple Followers, additional Admins and a dual-role Admin/Follower.
- [ ] **A5. 👁️** Check the My Decks tiles for standalone and Group versions of the same Deck: Group name, category badge, layout and distinguishing information.
- [ ] **A6.** Confirm each Group has independent Group progress, confidence and contributions.
- [ ] **A7.** Open Group settings, change the Group name and save. Check the updated name appears consistently.
- [ ] **A8.** As an Admin, adopt an available published Card/Deck update. Confirm the Group updates independently of standalone and other Group versions.

## B. Membership, roles and Group visibility

- [ ] **B1.** Add and remove Followers through Group settings. Check their Group Deck appears or disappears as appropriate.
- [ ] **B2.** Add another Admin and confirm they can manage Group settings and collective learning.
- [ ] **B3.** Confirm a Follower cannot access Admin-only settings or modify Group-owned learning.
- [ ] **B4.** Confirm peer visibility defaults to **Off**. A Follower can switch between Group and Me but cannot inspect another Follower.
- [ ] **B5.** Turn peer visibility **On**. Confirm Followers can inspect one another but cannot edit another person's values.
- [ ] **B6.** Turn peer visibility Off again. Confirm previously accessible peer perspectives become unavailable without retaining exposed private information.
- [ ] **B7.** Confirm Admins can inspect active Followers regardless of the peer visibility setting.
- [ ] **B8.** Test removing and re-adding a Follower: access changes correctly, their personal learning survives and their contributions are not automatically deleted.

## C. Perspectives, navigation and mobile interactions

- [ ] **C1.** Confirm an Admin initially opens in Group perspective, a Follower-only user in Me, and a dual-role user in Group.
- [ ] **C2. 👁️** In ordinary Deck view, open the perspective picker. Confirm Group and authorised Followers are listed clearly, with sensible scrolling.
- [ ] **C3. 👁️** Switch perspectives in ordinary Deck view. Confirm the whole-Deck depth animation feels smooth and the active Card is preserved.
- [ ] **C4. 👁️** In focused Card view, open All followers. Check the three-column comparison grid, selected identity and collapse control.
- [ ] **C5. 👁️** Switch Followers from the focused grid. Confirm the Card exchange animation feels natural and the grid remains open.
- [ ] **C6.** Navigate vertically between Cards while the comparison grid is open. Confirm perspective, grid state and scroll position remain intact.
- [ ] **C7. 👁️** Test Card flipping, vertical swiping, grid scrolling and outside-tap dismissal. Check gestures don't interfere with one another.
- [ ] **C8.** Close and reopen focused Card view. Confirm it starts with the grid collapsed and preserves the appropriate perspective.
- [ ] **C9. 👁️** Check long Group names, usernames, initials, progress counts, confidence indicators and Card controls on iPhone.
- [ ] **C10.** Switch rapidly between Group, Me and other Followers. Confirm previous users' values are not briefly shown under the newly selected identity.

## D. Progress, confidence and Frameworks

- [ ] **D1.** Set personal progress and confidence on a standalone Card, then open the same Card through Group · Me. Confirm the values match.
- [ ] **D2.** Change personal progress/confidence in Group · Me, then check the standalone Card and another Group using the same Card.
- [ ] **D3.** As an Admin, change Group-controlled progress and confidence. Confirm these changes do not overwrite Followers' personal values.
- [ ] **D4.** Test a mixture of Followers marked To do, Doing, Done and Skipped. Confirm Group doing/done counts and denominators handle Skipped correctly.
- [ ] **D5.** Check Group confidence displays G and F correctly, including unset values, no Followers and changes to individual confidence.
- [ ] **D6.** Confirm another person's progress and confidence are read-only, including when inspected by an Admin.
- [ ] **D7.** Open Group Progress and navigate between Frameworks, Areas, Items and Cards. Confirm the correct Group and individual information appears.
- [ ] **D8.** Check personal Framework progress includes eligible learning from Group assignments without duplicating the same Card's contribution.

## E. Assessments and testing history

- [ ] **E1.** In a standalone Card, add, edit and delete a personal Card assessment. Check the history updates correctly.
- [ ] **E2.** Record a personal Framework Item assessment and confirm it appears in the appropriate personal Progress view.
- [ ] **E3.** In Group Progress · Me, view personal assessment results previously recorded in a standalone Deck. Confirm relevant results and origin labels appear.
- [ ] **E4.** Record a personal assessment through Group Progress, then confirm it is available in the relevant standalone personal history.
- [ ] **E5.** As an Admin, create/edit Group-controlled Card and Item assessments. Confirm Followers can inspect them but cannot edit them.
- [ ] **E6.** As an Admin, inspect a Follower's relevant personal assessment history, including dates and pass/fail results. Confirm inspection is read-only.
- [ ] **E7.** Test Follower assessment inspection with peer visibility On and Off. Confirm unrelated Cards/Items remain outside scope and removed Followers' live histories are inaccessible.

## F. Reflections

- [ ] **F1.** Create/edit a standalone personal reflection. Confirm it remains separate from reflections in Group Experiences.
- [ ] **F2.** In Group A · Me, create/edit an individual reflection. Confirm it appears in that perspective, not in the standalone Card or Group B.
- [ ] **F3.** Inspect another Follower's Card. Confirm their Group A reflection appears, without access to their standalone reflection.
- [ ] **F4.** As an Admin, edit the shared Group reflection. Confirm another Admin sees and can edit the same shared value.
- [ ] **F5.** As a Follower, check the shared Group reflection is visible but read-only.
- [ ] **F6. 👁️** In Group perspective, inspect the individual-reflection carousel: attribution, manual navigation, readable text and separation from the shared reflection.
- [ ] **F7.** As a dual-role Admin/Follower, write both an individual reflection and the shared Group reflection. Confirm they remain independent.

## G. Creator and standalone Personal Info Cards

- [ ] **G1.** Publish a Creator Info Card attached to a Card. Confirm it appears in standalone, Group, Me and authorised Other follower views.
- [ ] **G2. 👁️** On a standalone Card with no Info Cards, tap the empty pouch. Confirm the small Add Personal Info Card panel animates from the pouch and dismisses on outside tap.
- [ ] **G3.** Create and save the first standalone Personal Info Card. Confirm it opens automatically and appears green.
- [ ] **G4.** Edit and Delete a standalone Personal Info Card from its original standalone context.
- [ ] **G5. 👁️** Check a mixed stack of Creator and Personal Info Cards: type colours, visible coloured strips, pouch count, ordering and type labels.
- [ ] **G6. 👁️** Check Info Card dimensions, text wrapping, blank lines, alignment and mathematical formatting where applicable.
- [ ] **G7.** Attach, replace and remove images/videos in the Info Card editor. Confirm entered text is preserved if an upload fails.
- [ ] **G8. 👁️** Open an Info Card's portrait video attachment. Check the viewer has no unwanted black bars and playback controls work comfortably on iPhone.
- [ ] **G9.** View a standalone Personal Info Card within Group · Me. Confirm its private indicator appears and other users cannot access it.

## H. Group Info Cards and Admin content visibility

- [ ] **H1.** In Group A · Me, create a Follower Personal Info Card using **+ New**. Confirm it appears green and is visible in the Group perspective.
- [ ] **H2.** Check that Follower Info Card appears in the author's standalone Card history and Group B · Me, with appropriate private indicators.
- [ ] **H3.** Open its menu on the standalone Card. Confirm **Created in: Group A · Me** and **+ New** appear, but not Edit or Delete.
- [ ] **H4.** Return to Group A · Me and confirm the originating author can Edit and Delete the Info Card.
- [ ] **H5.** As an Admin, create a Group Info Card from Group perspective. Confirm its teal styling, Group type indication and correct attribution.
- [ ] **H6.** Confirm Admin-created Info Cards contribute to the Group pouch count even when there are no Creator Info Cards.
- [ ] **H7.** Confirm Admin-created Info Cards do not appear in standalone Cards or unrelated Groups, including the author's own standalone history.
- [ ] **H8.** As a Follower-only user, confirm **Include admin content** defaults On and Admin Info Cards appear immediately in Me with the **+ Admin** indication.
- [ ] **H9.** Turn Include admin content Off and On. Confirm Info Card visibility, pouch counts and associated media presentation update correctly.
- [ ] **H10.** As an Admin or dual-role user, confirm the toggle defaults Off, remains operable in Group perspective and the follower picker/grid, and resets to its role default when leaving/reloading the Deck.
- [ ] **H11. 👁️** Check Info Card menus, mixed stacks, + Admin labels and long Group names for clipping, awkward alignment, sluggish animation or difficult touch targets.

## I. Media Centre, uploads and galleries

- [ ] **I1.** On a standalone Card, upload an image and a video. Confirm both appear in Media Centre and the Card's media thumbnails.
- [ ] **I2.** In Group · Me, upload image/video media. Confirm correct attribution and visibility in the originating Group and the author's owner history.
- [ ] **I3.** Upload Admin media from Group perspective. Confirm it appears there and in Follower perspectives when Include admin content is On, but not in standalone or other Groups.
- [ ] **I4.** Start a large Personal video upload, close Media Centre and reopen it. Confirm the upload continues, its progress is shown and the completed item appears.
- [ ] **I5.** Start a Group video upload, close Media Centre and reopen it. Confirm the same continuing-upload behaviour.
- [ ] **I6.** Start a Group upload, switch Cards or perspectives and return. Confirm the upload stays attached to its original Card and creation context.
- [ ] **I7.** Leave a Deck/Group Experience during an upload. Confirm cancellation does not leave a visible broken item or destabilise the interface.
- [ ] **I8.** Start a Personal upload and trigger an Update. Confirm Update waits appropriately and the uploaded media remains attached.
- [ ] **I9. 👁️** Check thumbnail layout with more than five media items, newest-item selection, older-item indicators and exact Gallery opening.
- [ ] **I10. 👁️** Test Gallery scrolling, image zoom, video playback, portrait media and iPhone download/share behaviour.
- [ ] **I11.** Test one failed upload and retry. Check understandable errors, retained context and successful recovery without duplicate attachments.

## J. Ownership, privacy, Delete and Hide from Group

- [ ] **J1.** Delete standalone Personal media/Info Cards from their creation context. Confirm genuine deletion.
- [ ] **J2.** Delete a Follower-created media item or Info Card in Group A · Me. Confirm it disappears from its Group and owner-history locations.
- [ ] **J3.** Delete an Admin-created media item or Info Card from Group A · Group. Confirm it is genuinely deleted rather than merely hidden.
- [ ] **J4.** As an Admin, Hide from Group a Follower's media/Info Card. Confirm it disappears from Group visibility but remains in the author's history with the appropriate private indicator.
- [ ] **J5.** As an Admin, Hide from Group your own Admin-created media/Info Card. Confirm the action succeeds immediately without errors or unintended deletion.
- [ ] **J6.** As a dual-role Admin, inspect your own Follower-created contribution from Group perspective. Confirm Hide from Group is available but Delete/Edit are not.
- [ ] **J7.** As another Admin, inspect somebody else's Group contribution. Confirm Hide from Group is available where authorised, but Edit/Delete are not.
- [ ] **J8.** Inspect another Follower and confirm their standalone private media/Info Cards, target dates and standalone reflection are never exposed.
- [ ] **J9. 👁️** Check **Created in**, **Delete** and **Hide from Group** labels and stacked controls in Media Centre and Info Card menus. Confirm long names wrap and controls remain aligned and tappable.

## K. Drafts, saving and media processing

- [ ] **K1.** Begin an unpublished Creator Info Card and leave before publication. Confirm it remains accessible through My Drafts.
- [ ] **K2.** Start a standalone Personal Info Card and leave before the first Save. Confirm the unfinished draft appears in My Drafts and can be reopened.
- [ ] **K3.** Start a Group Follower Info Card in Group A · Me, leave before Save and reopen it directly from My Drafts. Confirm its origin is displayed.
- [ ] **K4.** Repeat with an unfinished Group Admin Info Card. Confirm **Group A · Group** is shown and the draft can be saved.
- [ ] **K5.** Edit an already-saved Group Info Card, leave without saving and confirm My Drafts does not list it. Return to Edit in its creation context and confirm unfinished changes are restored.
- [ ] **K6.** Save or publish an Info Card while its video is still processing. Remain in the interface and confirm saving/publication completes automatically when ready.
- [ ] **K7.** Repeat with the user leaving the relevant interface. Return after processing is complete and confirm pending Save/Publish resumes without requiring another click or creating a duplicate.
- [ ] **K8.** Simulate a video-processing failure or failed attachment. Confirm the draft/content remains intact, no incomplete Info Card is published, and retry or replacement works.

---

## Final acceptance notes

**After completing each section**, record any failures separately. For visual issues, a screenshot or short screen recording is usually sufficient; for functional failures, note the account role, Group, perspective and steps needed to reproduce them.

### Final acceptance criteria

The Group Experience feature should be considered manually accepted when:

- Normal Admin, Follower and dual-role journeys work.
- Standalone personal learning and Group learning remain correctly separated.
- Perspectives and peer visibility expose only authorised information.
- Assessments and reflections follow their distinct visibility rules.
- Creator, Personal, Follower and Admin Info Cards behave correctly.
- Media uploads, galleries, deletion and Group hiding work reliably.
- Drafts and pending video processing survive normal navigation.
- No significant iPhone visual, gesture or touch problems remain.
- No reproducible application crash or data-loss problem remains in normal use.

**This checklist is for manual product acceptance, not a substitute for automated regression tests.**