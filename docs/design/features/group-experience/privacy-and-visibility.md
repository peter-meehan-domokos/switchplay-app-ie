# Group Experiences — Privacy, Visibility and Ownership

**Status:** Product and implementation reference  
**Scope:** Standalone Cards and Decks, Group Experiences, perspectives, roles, learning data, assessments, reflections, media and Info Cards.

## Outstanding tasks

- [ ] **Restrict individual Group reflection creation to followers.** The current API permits an Admin-only user to create an individual reflection, even though the interface provides no way to do this. Individual reflections should belong to followers (including dual-role Admin/Followers); Admin-only users should contribute through the shared Group reflection instead.
- [ ] **Correct the superseded Phase 4 assessment documentation.** The Phase 4 specification describes personal assessment history as owner-only, but the subsequently approved Phase 5 behaviour permits authorised Group-scoped inspection.

Neither item requires a redesign of the Group Experience model.

---

## 1. Purpose and fundamental principles

A Group Experience allows a set of users to learn from the same published Deck while retaining their own learning histories and contributing to a shared Group environment.

The privacy model has five fundamental principles:

1. **Published learning content is distinct from personal learning data.** Making a Card or Deck public does not make an individual's work on it public.
2. **Personal learning data belongs to the individual.** Progress, confidence and personal assessment history are reused across standalone Decks and Group Experiences, subject to the specific Group inspection permissions described below.
3. **Each Group Experience has its own collective learning data and contributions.** These do not become part of the canonical Deck or Card templates.
4. **Viewing another person's Card does not grant access to their complete personal CardData.** The Group provides only the information explicitly authorised for that perspective.
5. **Different kinds of contributions have different visibility models.** Media items and Info Cards can appear across contexts; reflections are deliberately context-specific.

The terms *public*, *private*, *personal*, *Group*, *Admin* and *Follower* must be interpreted according to the definitions below.

## 2. Terminology: the different meanings of public and private

The application uses related concepts that must not be confused.

### 2.1 Public and private Decks/Cards — publication status

These terms describe the ordinary publication and accessibility of `DeckTemplate` and `CardTemplate` content.

A **public published Deck or Card** is available through the normal published-content access rules.

A **private or unpublished Deck or Card** is not generally available through those public access rules.

A Group Experience can currently be created only from an eligible **public, published Deck**, whose selected Cards and versions must also be public and published.

The Group Experience does not turn a private template into a public one or grant special access to unpublished content.

Crucially, public publication applies to the learning material, not to users' personal progress, assessments, reflections or attachments.

### 2.2 Group membership — access to the experience

A Group Experience has an authorised membership consisting of Admins and Followers.

An underlying Deck may be publicly published, but the Group Experience itself is not openly accessible to everyone who can view that Deck.

Group membership determines who may enter the experience, which perspectives they may view and which Group contributions they may access.

### 2.3 Group peer visibility — permission to inspect followers

Each Group Experience has an Admin-controlled setting:

**"Can followers view each other's Cards?"**

- **Off (default):** Followers cannot inspect other followers' perspectives.
- **On:** Active Followers may inspect other active Followers' perspectives, subject to the restricted Group read permissions.
- Admins may inspect active Followers independently of this setting.
- The setting does not control access to the collective Group perspective or ordinary Group contributions.

This setting is sometimes described informally as making a Group *private* or *shared*. That shorthand must not be confused with public/private template publication or the privacy of individual attachments.

The setting controls **peer inspection**, not whether the underlying Deck is publicly published.

### 2.4 Owner-private information

Owner-private information is available only to the individual who owns it.

Examples include:

- Standalone personal reflections.
- Standalone Personal Info Cards.
- Standalone personal media.
- Personal target dates.
- Personal content and history outside the specific information authorised for Group inspection.

A user may encounter their own owner-private content while working within a Group Experience. That does not make it available to other participants.

### 2.5 The Private indicator on media and Info Cards

The Private indicator communicates that an item is not shared with the **Group Experience currently being viewed**.

It does not necessarily mean the item has never been shared anywhere.

For example, a media item created in Group A may appear in its owner's history while they are viewing Group B. It can be marked Private relative to Group B while remaining visible to authorised participants in Group A.

Thus:

**Private to this Group is not necessarily private everywhere.**

### 2.6 The Include admin content control

**Include admin content** is a viewer-controlled presentation setting that determines whether Group Admin media and Info Cards appear alongside follower content in individual perspectives.

It is not a publication setting, a Group privacy setting or an ownership permission.

Changing it does not publish, delete, hide or reassign any contribution.

---

## 3. Standalone Cards and Group Experiences

### 3.1 Canonical learning content

`DeckTemplate` defines a Deck and its ordered Card references.

`CardTemplate` defines the canonical learning content of a Card.

The same CardTemplate can appear in several Decks and Group Experiences.

A Group Experience references existing published templates. It does not create independent copies of them.

### 3.2 Personal CardData is shared across contexts

Each user has authoritative personal `CardData` for a CardTemplate.

That personal record is reused when the person encounters the same Card through:

- A standalone Deck.
- Group Experience A.
- Group Experience B.
- Another Deck containing the same CardTemplate.

Consequently, personal progress and confidence are not reset when someone joins a Group Experience.

A Group assignment can immediately reflect learning the person completed before joining.

Personal Card assessment history also follows the shared personal data model.

### 3.3 Group-controlled learning is separate

Each Group Experience maintains its own Group-controlled learning values, including progress, confidence and assessments.

These values are not the same as the personal learning values of any particular Admin or Follower.

For example, an Admin may mark a Group Step as complete while several Followers have not yet completed it personally.

The Group perspective can display both:

- The Group's own progress or confidence.
- Aggregated information about active Followers.

The Group's collective learning values are edited by Admins.

### 3.4 Separate Group Experiences remain separate

Group A and Group B can reference the same canonical Deck and Cards while having different:

- Memberships and Admins.
- Group-controlled progress and confidence.
- Group assessments.
- Group reflections.
- Group media and Info Cards.
- Selected published template versions.
- Peer visibility settings.

The individual's authoritative personal learning data remains shared where the same CardTemplate and relevant Step identities are used.

### 3.5 Template editing and version selection

Deck and Card templates are edited and published through the normal Creator/Library workflow, not from inside a Group Experience.

Admins control adoption of available published updates within their Group Experience.

A Group's version adoption does not automatically change an individual's standalone adoption choice or another Group's selected version.

Publication/version control and personal-data visibility are separate concerns.

---

## 4. Roles: Admin and Follower

### 4.1 Admin

An Admin manages a particular Group Experience.

Admins can:

- Manage the Group's membership and roles.
- Control the Group peer visibility setting.
- Edit Group-owned progress, confidence and assessments.
- Edit the shared Group reflection.
- Create Admin media and Info Cards.
- Inspect authorised learning information for active Followers.
- Hide Group contributions under the applicable moderation permissions.

Admins do not gain unrestricted access to Followers' complete personal CardData.

In particular, being an Admin does not confer ownership of another person's standalone reflections, media, Info Cards or personal learning values.

### 4.2 Follower

A Follower participates in the Group's learning experience.

Followers can:

- View the collective Group perspective.
- Edit their own personal progress and confidence.
- Create and manage their own authorised assessments.
- Write their individual reflection for the Group and Card.
- Create Group Follower media and Info Cards.
- Inspect other active Followers only when peer visibility is enabled.

Followers cannot edit the Group's collective learning values or another person's personal learning values.

### 4.3 Dual-role Admin/Follower

Admin and Follower are independent roles.

A user can hold both simultaneously.

Such a person has:

- Admin rights over Group-controlled learning and contributions.
- Their own Follower perspective and personal learning data.
- An individual Follower reflection.
- Access to edit the shared Group reflection.
- Separate Admin and Follower creation identities for media and Info Cards.

Being an Admin does not automatically make someone a Follower.

A user with both roles contributes to Follower aggregates once, as a Follower.

All current Admins have equivalent Group administrative permissions.

---

## 5. The three Group Experience perspectives

A perspective determines whose learning values are being represented and which content the viewer is authorised to see.

### 5.1 Group perspective

The Group perspective represents the collective learning experience.

It displays:

- Group-controlled progress and confidence.
- Aggregate Follower progress and confidence information.
- Group-controlled assessments where provided by Group Progress.
- The shared Group reflection.
- The carousel of visible individual Group reflections.
- Visible Group Follower media and Info Cards.
- Visible Group Admin media and Info Cards.
- Creator Info Cards associated with the selected Card.

Admins may edit Group-controlled learning. Followers can view it but cannot edit it.

The Group perspective is not an unrestricted view of every member's private information.

### 5.2 Me perspective

Me represents the selected user's own Follower perspective.

It displays:

- The user's personal progress and confidence.
- Their own Group-specific individual reflection.
- Their authorised personal assessments in Group Progress.
- Their own Group Follower media and Info Cards.
- Their owner-private media and Info Cards associated with the Card.
- Other authorised owner-history contributions.
- Optional Group Admin media and Info Cards, according to Include admin content.
- Creator Info Cards.

The owner can edit their own personal learning.

Owner-private content remains private from other participants even when displayed inside this Group Experience.

### 5.3 Other follower perspective

This is a restricted view of another active Follower.

It may be opened by:

- An Admin.
- Another active Follower when Group peer visibility is enabled.

It displays permitted information such as:

- The selected Follower's progress and confidence.
- Their individual reflection for that Group and Card.
- Their Group-created media and Info Cards, subject to contribution visibility rules.
- Their relevant personal assessment history through Group Progress.
- Optional Admin media and Info Cards, according to Include admin content.
- Creator Info Cards.

It does **not** expose the Follower's standalone private media, standalone private Info Cards, standalone reflection, target date or unrelated personal history.

The inspector cannot edit the selected person's personal learning.

### 5.4 Perspective permissions summary

| Perspective | Admin | Follower | Editing authority |
|---|---|---|---|
| Group | View | View | Admin edits collective learning |
| Own Me | View if also Follower | View | Owner edits personal learning |
| Another Follower | View | Only when peer visibility On | Read-only |

The user interface must not display private fields merely because someone can select another person's perspective.

Access restrictions must be enforced by the server.

---

## 6. Progress and confidence

Personal progress and confidence are authoritative per user/CardTemplate and relevant Step identity.

They are reused across standalone and Group contexts.

### 6.1 Standalone

The user views and edits their own progress and confidence.

### 6.2 Group · Me

The user views and edits the same underlying personal values, subject to the Group's selected Card version.

This is not a separate Group-only copy of their personal progress.

### 6.3 Group · Other follower

An authorised inspector sees the selected Follower's permitted progress and confidence.

This is read-only.

### 6.4 Group · Group

The Group perspective displays Group-controlled progress and confidence.

It also presents aggregate Follower information, including doing/done counts and Follower confidence.

Only active Followers contribute to current aggregates.

Skipped progress is neutral and excluded from eligible doing/done denominators, rather than being counted as completed.

A dual-role Admin/Follower contributes once to Follower aggregates.

---

## 7. Assessments and assessment visibility

Assessment visibility is distinct from media, Info Cards and reflections.

The central rule is:

**Personal assessment visibility follows the Group's authorised learning scope, not necessarily the context in which an assessment was originally recorded.**

### 7.1 Four assessment storage categories

| Assessment | Storage/ownership |
|---|---|
| Personal Card assessment | Individual's CardData |
| Personal direct Framework Item assessment | Individual's personal Item tests |
| Group Card assessment | Group-controlled Card assessment data |
| Group Framework Item assessment | Group-controlled Item assessment data |

Personal assessment results are shared across eligible contexts using the same personal learning records.

Group assessments remain separate.

### 7.2 Where assessments appear

In a standalone Card, the Card assessment controls display the user's personal assessments.

Within Group Experiences, Card faces currently do not provide assessment controls. **Group Progress** is the interface for viewing and managing assessments.

Within Group Progress:

- Group perspective displays Group assessments.
- Me perspective displays the user's relevant personal assessments.
- Other follower perspective displays the selected person's relevant personal assessments, where inspection is authorised.

### 7.3 Personal assessment inspection permissions

| Viewer | Personal assessments |
|---|---|
| Standalone owner | Own history; can manage own results |
| Group Follower · Me | Own in-scope history; can manage own results |
| Group Admin inspecting Follower | In-scope history, read-only |
| Another Follower, peer visibility On | In-scope history, read-only |
| Another Follower, peer visibility Off | No inspection access |
| Former Group member | No continuing Group inspection access |

An Admin may not edit or delete another Follower's personal assessment results.

### 7.4 Group-controlled assessment permissions

Group-controlled Card and Item assessments are visible through Group Progress.

Admins can create, edit and delete Group assessments.

Followers can view Group assessments but cannot change them.

A dual-role user may edit Group assessments in their Admin capacity and personal assessments in their own Follower capacity.

### 7.5 Assessment scope

When inspecting a Follower within a Group, the viewer can see relevant personal assessment history for:

- CardTemplates currently selected by the Group.
- Framework Items covered by the Group's selected Cards.

Results outside that scope are not disclosed.

Within scope, results may originate from:

- Standalone learning.
- The current Group.
- Another Group Experience.

The inspection permission is determined by the target Card/Item and Group membership, not simply by the assessment's origin.

### 7.6 Assessment details exposed

Authorised inspection can include individual results, not merely an aggregate score.

The implemented read model can expose:

- Pass/fail result.
- Assessment date.
- Creation time.
- Relevant history and counts.
- Origin labels, subject to origin visibility rules.

An origin is identified by a Group name only when the viewer is currently authorised to know that Group. Otherwise, a generic label such as **Other group** is used.

This prevents assessment provenance from unnecessarily revealing membership in another Group.

### 7.7 Example

A Follower completes a quadratic-equations assessment in a standalone Deck and later joins Group A, which covers the same Card.

An Admin inspecting that Follower through Group A can see the relevant result even though it was completed before Group A existed.

The Admin cannot see unrelated assessment results on Cards or Framework Items outside Group A's scope.

The Admin cannot modify the Follower's results.

### 7.8 Removal from a Group

Removing a Follower does not delete their personal assessment history.

However, the former Group no longer receives their live personal assessment results through ordinary inspection.

Restricted historical progress/confidence snapshots are separate from assessment history; they do not grant continuing access to assessment details.

Group-owned assessments remain with the Group.

---

## 8. Reflections: a separate contextual model

**Reflections do not follow the cross-context visibility rules of media items and Info Cards.**

They are lightweight written responses associated with a particular context.

There are three distinct kinds of reflection:

1. Standalone personal reflection.
2. Individual Follower reflection within a particular Group Experience.
3. Shared collective Group reflection.

Reflections are not copied or accumulated into owner-history collections across Group contexts.

### 8.1 Standalone reflection

A standalone Card displays the user's own standalone reflection.

It belongs to the person's ordinary personal CardData and is owner-private.

Other people cannot see that reflection merely because they share the same published Card or belong to a Group using it.

### 8.2 Individual Follower reflection

Each Follower may have an individual reflection for a particular Group Experience and Card.

This is distinct from the standalone reflection for the same CardTemplate.

The reflection appears:

- In its author's Group · Me perspective.
- In that person's Group · Other follower perspective when inspection is authorised.
- In the individual-reflection carousel of the Group perspective.

It does not automatically appear in another Group or in a standalone Card.

The author can edit their own individual reflection.

### 8.3 Shared Group reflection

Each Group Experience has **one shared collective reflection per Card**.

This is not one reflection per Admin.

Every current Admin can edit the same shared reflection.

A successful save replaces the shared text, with concurrency protection to avoid conflicting simultaneous writes.

Followers can read the shared Group reflection but cannot edit it.

### 8.4 Group perspective: two reflection areas

The Group Card has two distinct reflection areas:

**Main reflection area**

- Shows the single shared Group reflection.
- Editable by authorised Admins.
- Read-only for Followers.

**Individual reflection carousel**

- Shows visible individual reflections associated with that Group and Card.
- Each entry is attributed to its author.
- The carousel is manually navigated rather than automatically rotating.
- It does not display standalone personal reflections or individual reflections from unrelated Groups.

The current implementation may also include retained, visible reflections from removed Followers.

### 8.5 Dual-role Admin/Follower

A dual-role user has two independent reflection capabilities:

- In Me, they edit their own individual Follower reflection.
- In Group, they may edit the shared Group reflection.

Their individual reflection may also appear in the Group carousel.

Editing either reflection does not modify the other.

### 8.6 Admin-only reflection exception

The intended user-facing model is:

- Admin-only users contribute through the shared Group reflection.
- Followers contribute through individual reflections.
- Dual-role users may contribute through both.

The current backend also permits an Admin-only user to create an individual reflection directly through the API, although the ordinary UI does not expose this capability.

This is an outstanding API restriction task, identified at the beginning of this document.

It should not be interpreted as an intended third category of Admin-authored reflection.

### 8.7 Reflection visibility summary

| Context | Main reflection | Additional reflection display |
|---|---|---|
| Standalone | Own standalone reflection | None |
| Group · Me | Own individual Group reflection | None |
| Group · Other follower | Selected person's individual Group reflection | None |
| Group · Group | Shared Group reflection | Individual Group reflection carousel |

---

## 9. Media items and Info Cards: the contribution model

Media items and Info Cards share a common visibility, ownership, attribution and management model.

**The Group media-item architecture is the canonical reference for Group Info Card behaviour.**

Reflections do not use this model.

The important distinction is between where an item was created, who created it and which contexts can display it.

### 9.1 Creator Info Cards

Creator Info Cards are published content associated with CardTemplates.

They belong to the creator's published learning material rather than to an individual Follower's CardData or a particular Group Experience.

Everyone authorised to view the relevant published Card can see its Creator Info Cards.

They are not private personal notes and are not Group member contributions.

### 9.2 Standalone Personal media and Info Cards

These are created outside Group Experiences and belong to the user's personal CardData.

They are owner-private.

They can appear when the owner views the same Card within a Group Experience, but they remain private from Admins and other Followers.

Their appearance in a Group context does not import them into the Group or give the Group moderation ownership over them.

### 9.3 Group Follower media and Info Cards

These are created by a Follower in their **Group · Me** perspective.

They belong to the originating Group Experience's contribution records, with retained owner-history visibility.

They can appear:

- In the originating Group perspective.
- In the author's Me perspective within that Group.
- In authorised other-Follower views within the originating Group.
- In the author's owner-history views when encountering the same Card in standalone or other Group contexts.

When appearing outside the originating Group, they are not automatically shared with the other Group.

Their ownership and original creation context remain unchanged.

### 9.4 Group Admin media and Info Cards

These are created by an Admin in the **Group perspective**.

They belong specifically to that originating Group Experience.

They appear in:

- The originating Group perspective.
- Individual Follower perspectives within that Group when Include admin content is enabled.

They do not become part of the Admin's standalone personal history.

They do not appear in unrelated Group Experiences.

### 9.5 Contribution identity and attribution

Group contributions retain:

- Their originating Group Experience.
- Their CardTemplate association.
- Their creator.
- Their creation role/context.
- Their distinct contribution identity.

A dual-role user may create both Follower and Admin contributions.

These do not become interchangeable merely because the same account authored them.

---

## 10. Media/Info Card visibility matrix

The following matrix describes the normal visibility of saved, non-hidden content for authorised viewers.

| Content type | Standalone owner | Origin Group · Me (owner) | Origin Group · Other follower | Origin Group · Group | Other Group · Me (owner) |
|---|---|---|---|---|---|
| Creator Info Card | Yes | Yes | Yes | Yes | Yes |
| Standalone Personal media/Info | Yes | Yes, private | No | No | Yes, private |
| Group Follower media/Info | Yes, owner history | Yes | Yes, with inspection permission | Yes | Yes, private to other Group |
| Group Admin media/Info | No owner-history copy | If Include admin content On | If Include admin content On | Yes | No |

**Interpretation:**

- "Owner" means the person entitled to see their own personal content or owner history.
- "Other follower" means another person inspecting the contribution author's Follower perspective under the applicable Group permissions.
- The final column refers to the original author of a Follower contribution viewing the same Card in a different Group.
- Group Admin content stays with its originating Group.
- Hidden items, removed membership and revoked inspection permissions can further restrict visibility.
- The matrix does not imply that any viewer can edit all visible items.

### 10.1 No custom audience-selection system

Group-created media and Info Cards do not have independent audience-picking controls.

Their visibility follows the established Group contribution rules.

The earlier proposal for author-selected recipient subsets was withdrawn.

---

## 11. Include admin content

The **Include admin content** switch controls whether Admin-created Group media and Info Cards are included in individual perspectives.

### 11.1 Initial state

| Viewer role | Default |
|---|---|
| Follower-only | On |
| Admin-only | Off |
| Dual-role Admin/Follower | Off |

This helps Followers immediately encounter content provided by their coach or teacher, while Admins can inspect individual contributions without Admin material mixed in by default.

### 11.2 Behaviour

- Controls Admin media and Admin Info Cards together.
- Applies to the viewer's own Me perspective and authorised Other follower perspectives.
- Does not alter the contents of the collective Group perspective.
- Remains operable even while Group perspective is selected.
- Persists while switching perspectives, Cards and Deck/focused views inside the experience.
- Resets to the role-based default on leaving/re-entering the Deck or reloading.

When enabled, individual perspectives can show a **+ Admin** indication.

The toggle also affects associated media thumbnails, Info Card pouches, counts, gallery and Media Centre presentation.

### 11.3 Privacy implications

The switch does not make content publicly available.

It does not authorise inspection of another person's private learning.

It does not change the originating Group or ownership of Admin content.

It merely controls the presentation of Admin contributions to an already authorised viewer within that Group.

---

## 12. Creating, editing, hiding and deleting media/Info Cards

### 12.1 Author ownership

An author can edit or permanently delete their own contribution only from its original creation context.

The principal contexts are:

- Standalone Card.
- Group A · Me.
- Group A · Group.

Seeing a contribution elsewhere through owner history or Group inspection does not grant an additional edit/delete route.

### 12.2 Admin moderation: Hide from Group

Current Group Admins can use **Hide from Group** under the applicable Group moderation permissions.

Hiding affects visibility within that Group without necessarily deleting the author's underlying contribution.

This is distinct from permanently deleting the item.

For a Follower contribution:

- The item is removed from Group visibility.
- Its author retains the item in their permitted owner history.
- The item may show a Private indicator outside the originating Group.

For an Admin contribution:

- The item is hidden from Group presentation.
- It does not become a standalone personal item.
- Under current MVP behaviour, a hidden Admin contribution may become inaccessible through the existing UI, even to its author.

That limitation is accepted for the MVP.

### 12.3 Admins and authors

The original author controls permanent deletion in the original creation context.

An Admin may Hide from Group another author's Group contribution but does not thereby become its editor or owner.

An Admin may also Hide from Group their own Admin contribution.

The Admin's own Group media and Info Card controls therefore distinguish **Delete** from **Hide from Group**.

### 12.4 Drafts

Unfinished media/Info Card creation and unpublished Info Card drafts do not become visible Group contributions merely because work has begun.

Drafts retain their creator and original creation context.

Saved/publication-pending operations follow the authorised creation context and the media-processing rules.

### 12.5 Future management improvements

A general top-level Media Centre for managing contributions across contexts, including inaccessible or departed-Group contributions, is backlog work.

The current model deliberately avoids introducing extra recovery interfaces solely to handle uncommon cases.

---

## 13. Membership changes and revocation

### 13.1 Removing a Follower

Removing someone as a Follower:

- Revokes their Follower access to that Group.
- Removes them from ordinary active-Follower perspective selection.
- Excludes them from current Follower aggregates.
- Prevents ongoing inspection of their live personal assessment history.
- Does not erase their authoritative personal CardData.
- Does not automatically delete their previously created Group contributions.

Existing Group contributions retain their attribution and applicable visibility rules.

### 13.2 Historical learning information

The Group may retain restricted historical learning snapshots for removed Followers.

These snapshots are not unrestricted copies of personal CardData.

They must not expose subsequent changes to the person's live personal information.

The planned removed-member history presentation is separate from the normal active-Follower picker.

### 13.3 Role changes

Admin and Follower roles are independent.

Losing one role does not necessarily remove the other.

A person who remains an Admin can retain their Admin access even if no longer a Follower.

A person who loses the relevant Group role may lose the ability to manage contributions they previously created in that context.

Rejoining with the appropriate role can restore permitted management access.

### 13.4 Revocation and security

Current server permissions must be checked when accessing or changing protected Group information.

Changing Group permissions cannot retroactively erase information already downloaded by another person's device, but future protected requests must respect current authorisation.

Group access must never act as a general permission to retrieve unrelated personal records or media URLs.

---

## 14. Practical examples

### Example A — Public Card, private personal work

A publicly published Card on differentiation is followed by Alice and Bob.

Both can access the published teaching material.

Alice's standalone reflection, private media and Personal Info Cards do not become available to Bob.

If both participate in the same Group Experience, the Group's specific inspection and contribution rules apply, without publishing their complete personal CardData.

### Example B — Peer visibility Off

A coach creates a Group Experience with several players.

The setting "Can followers view each other's Cards?" is Off.

Each player can view their own Follower perspective and the collective Group perspective, but cannot inspect other players' individual perspectives.

The coach, as an Admin, can inspect permitted information for the active players.

Group contributions visible in the collective Group perspective remain available according to the Group contribution rules.

### Example C — Personal assessment completed elsewhere

Bob passes a Card assessment in a standalone Deck.

Later, he joins a Group using the same Card.

His personal assessment history is not reset.

The Group Admin can inspect Bob's relevant result through Group Progress, even though it was originally recorded outside the Group.

The Admin cannot modify it or inspect unrelated assessments.

### Example D — Follower media in several contexts

Alice uploads a video while working in Group A · Me.

The video appears as her Group A Follower contribution.

When Alice later opens the same Card in a standalone Deck or in Group B, her owner history can show that video.

Group B does not thereby receive the video as a shared Group B contribution.

### Example E — Admin media

A coach adds an Info Card in Group A · Group.

All authorised Group A participants can encounter it through the Group perspective.

A player's Me perspective can additionally include it when Include admin content is On.

The Info Card does not become part of the coach's standalone personal history or automatically appear in Group B.

### Example F — Individual and shared reflections

Alice is a Follower in Group A and writes an individual reflection.

It appears in her Me perspective and in Group A's individual-reflection carousel.

Coach Bob edits Group A's shared Group reflection for the same Card.

That shared reflection appears in the Group perspective's main reflection area.

Neither action modifies the other reflection or Alice's standalone reflection.

### Example G — Dual-role user

Charlie is both Admin and Follower.

In Group · Me, Charlie has personal progress, personal assessments and an individual Group reflection.

In Group perspective, Charlie can edit collective learning and the single shared Group reflection.

Charlie's individual reflection can appear in the carousel, but it is not the shared Group reflection.

Charlie can also create Follower or Admin media/Info Card contributions in their respective contexts, with different subsequent visibility rules.

---

## 15. Implementation principles for future work

The following rules should remain authoritative when extending Group Experiences.

**Separate template access from user-data access.** Public access to published Card/Deck content must never imply public access to personal learning records.

**Treat perspective selection as a restricted view, not ownership transfer.** Inspecting someone else's Card does not make their data editable.

**Keep the shared personal learning model.** Do not create unnecessary per-Group copies of personal progress, confidence or assessment history.

**Keep Group-controlled learning independent.** Group progress, confidence, assessments and the shared Group reflection are not personal Follower values.

**Preserve contribution provenance.** Media items and Info Cards retain their original author, Group, Card and creation context even when displayed elsewhere.

**Do not apply media/Info Card visibility to reflections.** Reflections remain context-specific, and the shared Group reflection is distinct from individual Follower reflections.

**Apply assessment scope precisely.** Relevant personal assessments may be inspected through Group Progress regardless of origin, but unrelated tests and owner-private content remain protected.

**Separate viewing, hiding, editing and deleting.** These are different capabilities and must not be inferred from one another.

**Enforce privacy on the server.** Do not obtain full personal records and rely on the interface to conceal forbidden fields.

**Keep Group permissions independent of template publication.** A public published Deck can support a membership-restricted Group Experience without making Group data publicly available.

---

## 16. Summary

A Group Experience combines shared published learning material, individual learning histories and a separately controlled Group environment.

The boundaries are:

- **Decks and Cards:** Public/private refers to normal template publication and access.
- **Group membership:** Determines who participates in the experience.
- **Peer visibility:** Determines whether Followers can inspect other Followers.
- **Personal learning:** Shared across appropriate standalone and Group contexts, with restricted inspection.
- **Group learning:** Controlled separately by Group Admins.
- **Assessments:** Relevant personal results may be inspected within a Group's authorised learning scope, regardless of where they originated.
- **Reflections:** Context-specific; individual Follower reflections and one shared Group reflection are separate.
- **Media and Info Cards:** Source-aware contributions with defined cross-context owner history, visibility and management permissions.
- **Owner-private content:** Remains private even when its owner encounters it while participating in a Group Experience.

The overarching rule is:

**A Group Experience makes learning collaborative without turning every participant's personal Card into shared or publicly accessible data.**