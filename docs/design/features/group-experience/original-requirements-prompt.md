# Codex task: Group Experiences — Draft Engineering Plan

## 1. Mission and boundaries

You are working in the Switchplay application repository:

`/Users/peterdomokos/projects/switchplay-app`

Expected branch: `feat/info-cards`

Your task is to investigate the existing architecture and produce a comprehensive **draft engineering plan for Group Experiences**.

The application supports both basketball coaching and maths learning. Group Experiences will allow an admin to assign an existing Deck to selected followers, maintain group-specific data, inspect individual follower progress, and view aggregated follower contributions.

We have completed an extensive product-design Q&A and established the requirements below.

**This is strictly a planning and investigation task. Do not implement anything.**

You must:

- Inspect the existing implementation thoroughly.
- Read the relevant engineering documentation.
- Identify reusable functionality, architectural conflicts, dependencies and risks.
- Recommend the simplest robust implementation approach.
- Produce a detailed phased engineering plan.
- Identify unresolved decisions in a clearly labelled QUESTIONS section.

You must NOT:

- Modify application code, schemas, APIs, components, tests or configuration.
- Create database migrations.
- Refactor existing functionality.
- Implement any part of Group Experiences.
- Invent or finalise new UX behaviour that has not been approved.
- Make unrelated product recommendations or expand the scope.
- Switch branches, reset existing changes or make Git commits.

You may create and edit only the new draft engineering-plan document.

The output should be detailed enough for us to review the architecture and subsequently commission implementation in controlled phases.

## 2. Essential existing documentation

Read these three documents carefully before designing the new architecture.

**Personal Info Cards — implementation handoff**

`/Users/peterdomokos/projects/switchplay-app/docs/engineering/features/info-cards/personal-info-cards-handoff.md`

**Personal Info Cards — engineering plan**

`/Users/peterdomokos/projects/switchplay-app/docs/engineering/features/info-cards/personal-info-cards-engineering-plan.md`

**Original Info Cards — engineering plan**

`/Users/peterdomokos/projects/switchplay-app/docs/engineering/features/info-cards/info-cards-engineering-plan.md`

Personal Info Cards have recently been implemented on this branch. You should therefore be able to inspect their actual implementation rather than treating them as a future dependency.

The handoff and plans explain their data model, versioning, ownership, privacy, attachment lifecycle and interactions with CardData.

Pay particular attention to any assumptions about Personal Info Cards being private to one user, since Group Experiences introduces shared visibility and cross-user authorship.

Inspect all relevant implementation code as well. Documentation may be incomplete or outdated. Where documentation and code disagree, explain the discrepancy.

Also locate and examine the existing first-class Card architecture and its engineering documentation.

## 3. Product context and terminology

Use the following terminology consistently:

- **CardTemplate:** Canonical Card content.
- **DeckTemplate:** Canonical ordered collection of CardTemplates.
- **CardData:** User-specific data associated with a Card.
- **DeckData:** User-specific Deck state.
- **Group Experience:** Working term for an instance of a Deck followed by a specified collection of users.
- **GroupData:** Working term for data owned by the group experience itself.
- **Admin:** User with management permissions over the group experience.
- **Follower:** User completing the Deck as part of the group experience.

These are working engineering terms. Do not introduce new product-facing terminology without approval.

The application serves both basketball and maths education, so architecture and interface terminology must remain domain-neutral.

A creator of a CardTemplate or DeckTemplate is not necessarily an admin of a group experience, and vice versa.

## 4. Group creation and membership

### 4.1 Creating an experience

Any eligible registered user can act as a group creator.

Initially, the workflow is deliberately simple:

1. Select an existing Deck.
2. Select registered users who will be followers.
3. Create the group experience.
4. Optionally appoint additional admins.

The Deck is automatically assigned to the selected followers, appearing in their My Decks.

No invitation or acceptance workflow is required in V1.

A group follows a particular Deck once. We do not need functionality for restarting the same Deck or assigning repeated runs of it to the same group.

### 4.2 Whether to introduce persistent Groups now

This remains an architectural decision for you to investigate.

Our initial intention was to support ad hoc groups created on the spot, without introducing a full Groups feature.

However, we are open to introducing persistent Group records immediately if doing so is simpler or avoids substantial reworking later.

Future features will include named, reusable Groups and Organisations.

Compare:

- A lightweight ad hoc Group Experience record containing membership and Deck association.
- A separate persistent Group entity associated with a Deck experience.

Recommend the simplest approach that supports the current requirements and provides a sensible foundation for future Groups and Organisations.

**Do not implement a Groups or Organisations management feature now.**

### 4.3 Membership changes

Admins can add or remove followers after creation.

New followers automatically receive the group Deck and independent personal data for it.

Existing followers are unaffected.

Removed followers lose access to the experience, and the Deck disappears from their My Decks.

However, their group-specific CardData is preserved.

If they rejoin, their previous CardData is restored rather than creating a fresh record.

### 4.4 Former followers

Removed followers must not contribute to current group completion counts or confidence averages.

However:

- Their uploaded media remains visible in the group media collection.
- Their reflections remain visible in the group reflection carousel.
- Their previously shared Info Cards can remain visible.
- Their contributions retain author attribution.
- Their personal CardData remains intact unless an admin deletes particular contributions.

Admins can inspect former followers through a collapsed **Removed / Left Group** section.

Active followers cannot inspect former followers' personal Cards.

Removed followers themselves cannot access the group experience.

### 4.5 Admins

All admins have equal permissions.

Any admin may:

- Manage followers.
- Appoint or remove other admins.
- Edit group-owned data.
- Manage group experience settings.
- Adopt published CardTemplate and DeckTemplate updates.
- Delete follower contributions within this group experience.

There is no privileged primary admin by default.

Investigate whether a primary admin is genuinely necessary for a technical reason, but do not introduce one without a compelling justification.

Prevent the experience from accidentally being left with no admins.

Admin and follower are independent roles.

An admin is not automatically a follower but may optionally join as one. If so, that user also has independent follower CardData and contributes to follower aggregations.

## 5. Fundamental CardData architecture change

This is probably the most important technical area to investigate.

Our existing first-class Card architecture allows a user to share the same CardData when the same CardTemplate appears in different Decks.

We now need CardData to be independent across different **contexts**.

Example:

- User A follows CardTemplate X personally.
- User A follows CardTemplate X in Group Experience 1.
- User A follows CardTemplate X in Group Experience 2.

These must result in three independent sets of CardData.

Each stores its own:

- Step completion.
- Confidence signals.
- Reflection.
- Uploaded media.
- Personal Info Cards.
- Other existing CardData fields and associated records.

The same principle applies to the relevant DeckData.

Group experiences must never accidentally share or overwrite data belonging to another context.

**Preserve the existing personal CardData reuse semantics wherever they currently apply.** We are extending the architecture to support group-scoped data, not replacing all personal behaviour.

Investigate:

- Existing CardData identity and uniqueness assumptions.
- Database indexes.
- CardData creation and lookup.
- Relationships between CardData and DeckData.
- APIs, hooks, caching and optimistic updates.
- My Decks behaviour.
- Media, reflections, confidence and progress.
- Version updates.
- Personal Info Card ownership and attachment references.
- Any other functionality dependent on one CardData record per user and CardTemplate.

Recommend how context-specific CardData should be identified and resolved throughout the application.

This must be designed to avoid regressions for existing personal users.

Do not assume the correct solution is to duplicate CardTemplates or DeckTemplates.

## 6. Group-owned data versus aggregated personal data

The group Card should behave as much as possible like a normal personal Card.

It has its own group-owned data, which admins can edit using familiar interactions.

At the same time, it displays information aggregated from individual followers.

These are distinct sources of data.

**Group-owned data** includes:

- Admin-controlled progress.
- Admin-controlled confidence signals.
- Group reflection.
- Media uploaded directly by admins to the group Card.
- Group assessment/test data where applicable.

**Aggregated follower data** includes:

- Individual completion counts.
- Individual confidence averages.
- Uploaded media.
- Individual reflections.
- Shared Info Cards where applicable.

Personal follower data remains stored against the relevant follower's group-specific CardData.

Do not unnecessarily copy all personal data into GroupData.

Investigate how the group Card can efficiently retrieve and display this information while maintaining proper data ownership and permissions.

## 7. Progress and confidence

### 7.1 Group progress

Group progress uses the existing progress controls and existing roll-up calculations.

There must be no new or competing completion algorithm.

Admins control group progress through the same interactions currently used on personal Cards.

Group progress rolls up from:

Step → Card → Deck

Exactly as existing personal progress works.

### 7.2 Follower completion aggregation

Immediately to the right of the admin-controlled progress indicator, display the aggregated follower completion count.

Example:

`8/12 completed`

This applies at all three levels:

- Individual step.
- Individual Card.
- Entire Deck.

Only active followers contribute to these counts.

An admin who is also a follower contributes as a normal follower.

Investigate how existing Card and Deck completion calculations can be reused to derive these counts.

Do not invent alternative completion criteria.

### 7.3 Confidence signals

There are three confidence signals per Card, each associated with a particular step.

The group Card always displays two values:

1. **Group confidence:** The value manually assigned by an admin.
2. **Follower average:** The mean of individual followers' confidence values for that step.

The admin sets confidence using exactly the existing drag interaction.

The follower average appears immediately to the right, with clear labelling or another minimal distinguishing treatment.

For example:

`Group 7    Followers avg 6.4`

Only active followers contribute to averages.

Unset/null signals must be excluded, following existing confidence semantics.

Reuse the current confidence roll-up and rounding rules wherever applicable.

The previous idea of choosing between admin-set and aggregated confidence at group creation has been discarded.

**Both values must always be available. There is no signal-mode configuration.**

## 8. Media

### 8.1 Unlimited media

The existing five-item media limit must be removed entirely.

This applies to both personal and group contexts.

Do not introduce a new arbitrary numerical cap.

Inspect all enforcement points, including client-side validation, server APIs, persistence and media handling.

### 8.2 Group media

Admins can upload media directly onto the group Card using the existing personal media workflow.

These uploads belong to the group.

Followers upload media onto their own personal Cards.

Their uploads automatically appear in the group media collection.

The group collection shows both sources together, ordered by upload timestamp.

Every item retains attribution to its uploader.

Media from removed followers remains visible in the group collection.

### 8.3 Engineering investigation

Examine the existing Cloudflare Stream/R2 integration, upload lifecycle, storage model, permissions and media viewer.

Determine how the aggregated collection should be queried and kept current.

Consider large groups and substantial numbers of media items.

We will need an efficient implementation that does not eagerly load excessive media.

You may recommend pagination, incremental loading or virtualization, but do not finalise a new media interface without approval.

Preserve existing mobile viewing, upload, removal and download functionality.

## 9. Reflections

The group Card retains the existing reflection area in the bottom-right corner.

We do not want a separate dashboard, modal or expanding interface for group reflections.

Instead, this area becomes a continuously rotating reflection carousel.

Requirements:

- The admin-created group reflection receives prominence.
- Individual follower reflections are also included.
- Each reflection is attributed by name beneath it.
- The displayed reflection changes automatically every few seconds.
- Tapping the displayed reflection advances to the next one.
- The carousel cycles continuously.
- Transitions use a gentle fade in/out.
- **No sliding or elaborate carousel animations.**
- The reflection area retains its existing physical position on the Card.
- Reflections from removed followers remain included.

Exact timing, prominence treatment and editing interactions can be refined during UX design.

Investigate how to reuse the existing reflection component and editing behaviour without creating a separate group reflection interface.

## 10. Personal Info Cards and shared Info Cards

This is a particularly important integration area.

The new Personal Info Cards implementation already exists on this branch.

Inspect it thoroughly before proposing any architectural changes.

Personal Info Cards are associated with CardData rather than CardTemplate.

They appear in the same existing pouch as CardTemplate Info Cards.

That pouch and its current behaviour should be preserved.

Group Experiences extends Personal Info Cards to support authorship and sharing across users.

### 10.1 Creating Info Cards

A follower may create an Info Card:

- For themselves only.
- For the entire group, if permitted.

Followers cannot select arbitrary subsets of other followers.

An admin may create an Info Card:

- For the whole group.
- For one follower.
- For any selected collection of followers.

For example, a basketball admin might create one Info Card for all defenders.

An admin-created Info Card targeted to an individual appears in that follower's personal Card pouch, even though the follower is not its author.

### 10.2 One identity, multiple recipients

A shared Info Card is one logical object.

For example, if an admin creates one Info Card for five followers, those five followers must reference the same underlying Info Card.

They must not receive independently editable copies.

Editing the shared Info Card updates it for all recipients.

Admins can subsequently add or remove recipients.

Group-wide Info Cards automatically become available to newly joined followers.

### 10.3 Group-wide visibility

A group-wide Info Card appears:

- In the group Card pouch.
- In every active follower's personal Card pouch.

This applies regardless of whether an admin or follower created it.

A targeted Info Card appears only for the specified recipients, while remaining accessible to admins through their management permissions.

### 10.4 Author permissions

Followers control the Info Cards they create themselves.

They can edit and delete them.

They cannot edit or delete an admin-created Info Card.

Admins can delete any follower-created Info Card associated with the group experience.

Admin-created Info Cards are managed by admins.

Preserve author identity and relevant ownership metadata.

### 10.5 Follower sharing permission

Each group experience has a setting determining whether followers can create group-wide Info Cards.

Admins can change this setting at any time.

When enabled, followers may create their own or group-wide Info Cards.

When disabled, followers may create only personal Info Cards.

Disabling the setting does not remove existing shared Info Cards.

Followers can continue editing their previously created group-wide Info Cards.

Followers may change their own Info Cards between personal and group-wide visibility.

Changing from personal to group-wide requires the permission to be enabled.

Changing from group-wide back to personal is always allowed.

### 10.6 Shared Info Card architecture

This requires careful investigation.

The current Personal Info Card implementation may assume a single owner and private CardData association.

Our new requirement introduces:

- A distinction between author and recipients.
- Admin-authored Info Cards attached to follower CardData.
- One shared identity visible across multiple CardData contexts.
- Group-wide visibility.
- Recipient management.
- Cross-user access permissions.
- Shared-card editing and deletion.
- Preserving existing CardTemplate Info Cards.

Determine the safest and simplest architecture that satisfies these requirements.

Do not weaken existing Personal Info Card privacy for unrelated personal or group contexts.

Do not implement a parallel Info Card feature.

Build upon the existing implementation wherever possible.

If the existing design needs significant changes, explain them and identify migration or compatibility risks.

## 11. Viewing and editing permissions

### 11.1 Followers

Followers can:

- Edit their own group-specific personal CardData.
- Set progress and confidence.
- Upload and remove their own media.
- Write reflections.
- Manage their own Info Cards.
- View the group Card.
- View group media, group reflections and group-wide Info Cards.

Followers cannot directly edit group-owned progress, confidence, reflection or media.

They cannot inspect another follower's complete personal Card.

### 11.2 Admins

Admins can:

- Edit group-owned CardData.
- Inspect any follower's personal CardData.
- Inspect former followers' preserved CardData.
- Create Info Cards targeted to followers.
- Delete any follower contribution within the group experience.

An admin cannot otherwise edit a follower's personal progress, signals, reflection or media.

The general rule is:

**Admins may view and delete follower data, but cannot modify follower-owned values.**

Admin-authored Info Cards are the specific exception: admins can create and manage these on behalf of selected followers.

Deletion rights apply only to CardData within the relevant group experience.

They must never grant an admin access to unrelated personal data or another group experience.

Investigate exactly what deletion entails for each existing CardData field and associated record.

Preserve existing access-control guarantees and identify any new server-side authorization requirements.

## 12. CardTemplate and DeckTemplate versioning

Group experiences reference existing CardTemplates and DeckTemplates.

They do not own or duplicate the canonical templates.

**There is no template editing or forking from within a group experience.**

This applies to everyone, including admins who happen to be the original template creators.

Creator Mode is not available within the group experience.

If an admin is also the template creator, they must use the normal Library workflow to edit and publish.

When a creator publishes a new CardTemplate version:

- The existing Update mechanism makes the new version available.
- For a group experience, the Update button appears only on the group Card.
- Only admins can adopt the update.
- Followers do not see Update buttons on their group-specific personal Cards.

The same rules apply to DeckTemplate updates.

When an admin accepts an update, it applies to the entire group experience.

All followers use the same adopted template versions.

No individual acceptance is required.

Existing CardData must be preserved according to current versioning semantics.

Updating one group experience must not automatically update other group experiences or independent personal Decks.

Investigate how the existing versioning model supports this, including changes to Card ordering, step identity and Deck membership.

Identify any conflicts with existing automatic version-adoption behaviour.

## 13. Progress component and assessments

The application has a Progress component showing data across the existing learning hierarchy.

The group experience needs its own Progress view, using the existing structure as far as possible.

For progress:

- Display admin-controlled group completion.
- Display follower completion aggregation alongside it.
- Use existing roll-up logic at Step, Card and Deck levels.

For confidence:

- Display admin-controlled confidence.
- Display aggregated follower confidence.

For the Test/assessment column:

- Admins can maintain a group assessment.
- Individual follower assessments remain available in their personal views.
- Individual assessments are **not aggregated**.

Inspect the actual Progress component and assessment implementation.

Do not invent new assessment data types or behaviours.

If any required functionality does not yet exist, distinguish the dependency from the Group Experiences implementation.

## 14. Synchronized Card perspectives and UX

This is the primary part of the UX still awaiting detailed design.

We have established one fundamental behaviour:

**All perspectives within a group experience track the same active Card.**

Individual data remains independent, but navigation is synchronized.

### 14.1 Admin experience — desktop-oriented

Our current design direction is:

- One main Card in the primary viewing area.
- A row/grid of miniature Cards along the bottom.
- Each miniature represents the group or an individual follower.
- Selecting a miniature changes which perspective occupies the main viewing area.
- Moving forward or backward through the Deck updates all perspectives to the same CardTemplate.
- Switching perspectives should feel physically continuous and seamless.

The group view is the default admin perspective.

### 14.2 Follower experience — mobile-oriented

Followers have only two perspectives:

- Personal.
- Group.

Our provisional idea is to display the alternate perspective as a small Card, potentially in the bottom-right corner.

Tapping it would switch between the two.

Both perspectives follow the same active Card position.

### 14.3 Design restrictions

These layouts are **provisional design directions**, not final approved implementations.

We will complete detailed UX design separately.

For now:

- Investigate the architectural requirements for synchronized navigation.
- Identify which existing Card components and state can be reused.
- Explain how to maintain separate data contexts while sharing active Card navigation.
- Identify potential performance and rendering problems.

Do not invent new navigation controls, animations, dashboards or interaction models.

Do not finalise visual layouts or Card geometry.

Our fundamental design principles are:

- Object continuity.
- Physical Card behaviour.
- Minimal software magic.
- Reuse of existing interactions.
- No unnecessary pop-ups, transitions or navigation layers.

Preserve the existing Card front/back interactions, step navigation, media presentation and Info Card pouch unless a change is explicitly required.

## 15. Architectural investigations required

Your investigation must cover at least the following areas.

### A. Data model

- Group Experience identity.
- Membership and admin relationships.
- Group-owned CardData/DeckData.
- Context-specific follower CardData/DeckData.
- Existing personal data compatibility.
- Info Card sharing and ownership.
- Historical membership.
- Template version selection.
- Uniqueness constraints and indexes.
- Migration requirements.

### B. Server APIs and authorization

- Creation and membership changes.
- Automatic assignment.
- Group data reads/writes.
- Aggregation queries.
- Admin inspection of follower data.
- Admin deletion permissions.
- Shared Info Card authorization.
- Template update adoption.
- Cross-group isolation.

### C. Frontend integration

- My Decks.
- Existing Card components.
- Existing Deck navigation.
- Progress component.
- Confidence signals.
- Reflection component.
- Media viewers/uploaders.
- Info Card pouch.
- Personal Info Card editor.
- Update buttons.
- Creator Mode restrictions.

### D. Performance and concurrency

- Potential group sizes and data volume.
- Aggregation query costs.
- Unlimited media collections.
- Multiple admins editing group data.
- Concurrent membership changes.
- Multiple admins adopting template updates.
- Optimistic updates and rollback.
- Data caching and invalidation.
- Synchronizing displayed group aggregates after personal updates.
- Avoiding unnecessary re-fetches or rendering of all full-resolution media.

### E. Privacy and data lifecycle

- Personal versus group access boundaries.
- Media visibility after membership removal.
- Persistent historical contributions.
- Content deletion and underlying media storage.
- Removing or changing Info Card recipients.
- Privacy of unrelated personal CardData.
- Safe handling of under-18 participants.
- Any consent, retention or safeguarding issues requiring product/legal review.

Do not silently resolve a safeguarding or privacy question through an assumed product rule. Flag it explicitly.

## 16. How to evaluate architecture options

For major architectural decisions, particularly context-specific CardData and shared Info Cards:

1. Describe the relevant current implementation, with file references.
2. Explain why the new requirements affect it.
3. Identify the realistic implementation alternatives.
4. Compare their complexity, reuse, migration risk and likely performance.
5. Recommend one approach.
6. Explain any assumptions or unresolved questions.

Do not produce an abstract system design disconnected from the existing code.

Prefer straightforward extensions of the current architecture over unnecessary abstractions.

Do not create a generic multi-tenant platform, permission framework or organisation-management system unless the existing implementation genuinely requires it.

Where a future feature may influence a decision, explain how the proposed design accommodates it without implementing that feature now.

## 17. Required engineering-plan document

Create:

`docs/engineering/features/group-experiences/group-experiences-engineering-plan-draft.md`

Create the directory if necessary.

The document should contain these sections:

### 1. Executive summary

What we are building, the architectural approach recommended and the largest implementation risks.

### 2. Confirmed product requirements

A structured account of the requirements in this prompt.

Distinguish confirmed requirements from provisional UX directions.

### 3. Existing architecture audit

Describe the relevant existing implementations.

Include specific source paths and, wherever helpful, functions, types, routes and line references.

State clearly when a requirement is already partially supported.

### 4. Architectural decisions and alternatives

Explain the key design choices, recommended data model and rationale.

Include the ad hoc versus persistent Group decision.

### 5. Proposed data model

Identify proposed entities, fields, references and relationships.

Pay special attention to contextual CardData identity, GroupData and shared Info Cards.

Identify changes to indexes and constraints.

### 6. Data ownership and authorization

Define who can read, create, edit and delete each relevant data category.

A permissions matrix would be useful.

Cover active followers, removed followers, followers who are also admins, and multiple admins.

### 7. Data flows and APIs

Describe the main interactions and how data flows through the system.

Cover creation, membership changes, personal updates, group aggregation, Info Card sharing, template updates and deletion.

### 8. Frontend architecture

Explain how existing components can be reused.

Identify only the architectural requirements for synchronized views. Leave detailed UX provisional.

### 9. Media and aggregation architecture

Explain how group media, reflections, confidence and completion data will be obtained and displayed.

Cover performance and historical membership.

### 10. Versioning and lifecycle

Explain how group adoption of CardTemplate and DeckTemplate updates will work.

Include preserved CardData, joining, leaving, rejoining and deletion.

### 11. Phased implementation plan

Propose a logical sequence of implementation phases.

For each phase include:

- Purpose.
- Main files/components likely to change.
- Dependencies.
- Work involved.
- Acceptance criteria.
- Automated tests required.
- Manual verification required.
- Risks or decisions blocking the phase.

Do not execute these phases.

### 12. Regression and test strategy

Include tests for:

- Existing personal CardData.
- Existing shared-Card semantics in personal contexts.
- Group-specific data isolation.
- Group ownership and admin permissions.
- Membership changes.
- Removed follower visibility and aggregation.
- Media and Info Card permissions.
- Version updates.
- Progress and confidence calculations.
- Concurrent operations.
- iPhone/mobile behaviour.
- Existing Personal Info Cards.

Do not run the full test suite merely to produce the document unless a particular read-only check is needed to verify an important assumption.

### 13. QUESTIONS

This section is mandatory.

List unresolved questions requiring our input.

For each question:

- Explain what is unresolved.
- Explain why it matters.
- Identify the realistic alternatives.
- Give your recommendation, where appropriate.
- State whether the decision is needed before implementation or can wait until a later phase.

Prioritise questions by their impact on architecture and implementation.

Do not ask questions already answered explicitly in this prompt.

Do not silently decide unresolved product or UX questions.

### 14. Risks, assumptions and readiness

Identify:

- Major architectural risks.
- Potential regressions.
- Security/privacy issues.
- Dependencies.
- Outstanding design decisions.
- What is ready for implementation planning.
- What must be settled first.

## 18. Working process

Work in this order:

**First:** Confirm the expected branch and inspect repository status. Preserve all existing work.

**Second:** Read the three Info Card documents and locate the current first-class Card architecture.

**Third:** Trace the actual CardData, DeckData, progress, confidence, media, reflections, Info Card, versioning and authorization implementations.

**Fourth:** Compare the existing architecture against the confirmed requirements.

**Fifth:** Identify important conflicts and architecture alternatives.

**Sixth:** Produce the complete draft engineering plan.

**Seventh:** Review the draft for internal consistency, missing requirements, unsupported assumptions and unapproved product decisions.

Do not stop after producing a high-level outline. Deliver a substantive engineering investigation and proposed plan.

Where inspection reveals a serious conflict with one of our confirmed requirements, explain it clearly. Recommend alternatives, but do not silently change the requirement.

## 19. Final response

After creating the document, give a concise handoff containing:

**A. Draft plan location**

The exact file path.

**B. Recommended architecture**

A short explanation of your preferred approach, particularly for context-specific CardData, GroupData and shared Info Cards.

**C. Existing code compatibility**

The most important reuse opportunities and architectural conflicts discovered.

**D. Main risks**

The most consequential issues, not a generic risk list.

**E. QUESTIONS**

The decisions requiring our attention, prioritised.

**F. Changes made**

Confirm that only the permitted draft documentation was created or edited, and that no application code, schemas, migrations or tests were modified.

---

**Final instruction:** This is an investigation and architecture-planning exercise, not an implementation task. Be thorough and critical. Reuse existing functionality wherever possible. Preserve existing application behaviour. Do not introduce new product or UX decisions without approval. Produce the draft engineering plan and stop.