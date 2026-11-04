# Group Experiences Phase 5 — Independent Product, UX and Architecture Review

## Resume Here

Ignore this line I'm just writing it to trigger another commit Because the last commit message didn't have the description 

**Investigation complete — awaiting founder decisions; implementation is not authorised.** All requested sections A–J and the eight human-use scenarios are complete. Incremental evidence checkpoints have been consolidated into the report. On resumption, begin with the six decisions in **Section I**, then update recommendations only in response to new evidence or user decisions. Do not repeat the source audit or treat these recommendations as approved requirements.

Reviewed on 1 November 2026 against `feat/group-experience`, HEAD `a6f2e32`, and the existing uncommitted Checkpoint 5.0 work. This review file is the only permitted write. No application, test, fixture, configuration, other documentation or database changes, service operations, commits, pushes or deployments were made. Source/test inspection is evidence of implementation and intended contracts, not a newly executed runtime test. No automated suites or browser measurements were run for this review.

Final preservation check: content checksums for all ten other pre-existing modified/untracked files were unchanged; Git reported no unexpected changed/untracked paths. All sections A–J are present; code fences and trailing whitespace were checked. These document checks are not application regression tests.

**Evidence and authority:**

- **Implemented facts** are supported by file/function/line references below. Paths beginning `frameworks/`, `cards/`, `assessments/` or `groupExperiences/` refer to `src/lib/`; component names refer to their `src/components/` subdirectory. Source line ranges are audit references, not promises about future line positions.
- **Approved product direction** comes from the current independent-review brief: complete Framework hierarchy with Group-bounded results, identical self/peer coverage, authorised assessment visibility, raw eligible-Step weighting, Group/player navigation, two Group table modes and touch comparisons. Earlier owner-only assessment statements in the engineering plan are superseded requirements, not newly implemented APIs.
- **Provisional design** includes the hierarchical menu, direct Item inclusion and the precise history/entry boundaries. The proposed end-to-end behavior below is a recommendation pending approval.
- **Challenges to established decisions** are explicitly identified in B3–B5 and I1/I4/I6. They were considered under the broadened-authority amendment, not applied to code or authoritative specifications.
- **Verification limits:** the 5.0 handoff records its earlier 28 unit and 9 browser passes; they were not rerun and do not validate the new scope, disclosure or navigation proposals. Findings about enrolment trust are verified source behavior conditional on feature enablement, not evidence of a production disclosure. Sticky/menu usability remains subject to browser and physical iPhone review after authorisation.

## A. Executive recommendation

**The plan needs targeted revisions, not a replacement data architecture.** Retain one personal learning record per actual CardTemplate identity, separate Group-owned learning, the existing Progress table, embedded assessment lists and explicit version adoption. Establish scope and disclosure authority before implementing further assessment readers or UI.

The product rule should be understandable without explaining storage:

> Your learning stays with you. My Progress shows your eligible learning overall. A Group view shows how you are doing on that Group's current learning. Results you recorded elsewhere can still be relevant; recording them somewhere else does not make you repeat them.

“Current learning” means the Group's adopted Cards, not activity performed since joining, and not proof the Group caused an improvement. Group scores are the Admin's independently maintained assessment of the Group, not an automatically synchronised team average. Player averages is the comparison against the players' actual shared learning.

My preferred end-to-end design is:

1. **Player-first entry to one Progress surface.** Global Progress opens My Progress. A contextual Group entry opens the same surface in that Group, with the existing role-appropriate perspective. Retain Framework plus Viewing selectors; use a simple grouped list, not a recursive menu of every Group and every roster. Within a Group, arrows move through Group and authorised active players.
2. **One scope calculation, different owners.** Group scope is the current adopted composition intersected with Framework mappings, identical for Group scores, player averages and individual players, including self. Personal scope uses lifetime eligibility and highest legitimately adopted versions. Keep the complete hierarchy; distinguish outside scope from unset, all-skipped, loading and corrupt data.
3. **Target-based assessment relevance.** Recommend all direct assessments of an in-scope Item, regardless of entry context, alongside histories of in-scope Cards. This is Approach A, still requiring approval. Direct Item tests are evidence about the Item as a whole; they are not evidence of completing the Group's particular Card exercises. Do not let tests change progress/confidence or claim they were earned in this Group.
4. **Record provenance, but do not use it as ownership, inclusion permission or a new colour system.** Preserve unknown legacy origins. The server stamps the actual entry context, never guesses from memberships.
5. **Resolve a real trust gap before real participants.** Current automatic membership grants inspection to anyone able to create a Group and add the subject. Narrow queries do not fix this. Keep the fixture gate; approve a participation/relationship trust boundary before opening the feature to real players.

Two recommendations explicitly challenge earlier decisions: the automatic-enrolment trust rule, and personal Framework's all-skipped 100% display. Section B demonstrates the problems and compares the consequences. A further proposed restriction concerns new min/max disclosures to viewers without peer-inspection permission. None is implemented or silently treated as approved.

## B. Contradictions and risks in the current thinking

### B1. A Group bounds practice, but an Item test measures a broader target

Suppose an Item maps to Cards A, B and C, while the Group assigns A. A player's tests attached directly to B or C must not appear in the Group. But a direct Item test has no A/B/C subset encoded. We cannot prove it measures A, whether it was entered personally or in the Group. **Origin-based inclusion does not solve this semantic mismatch.** It merely selects where the user clicked Save.

Retaining Item tests as broad, relevant evidence is coherent if the Tests column means assessment history, not a certificate that the displayed practice subset is mastered. Existing history already labels Card versus Item sources (`assessments/history.ts:71–88`; `AssessmentModal.tsx:122–129`). Reuse that distinction. If the intended meaning is instead “tests of these exact assigned exercises”, direct Item tests are the wrong target. That would require a narrower assessment target/rubric, which is a significant product change, not a clever provenance filter.

**Recommendation:** keep the current two targets and adopt Approach A. Accept and explain the difference between practice coverage and Item-level evidence. No extra table column or per-entry context choice is necessary.

### B2. Group Progress is not a course completion ledger

The same stable Step value changes across personal/A/B contexts; prior tests remain visible. A player may join already done; progress can decrease when a new Step is adopted or increase when an unfinished Card is removed. These are intended consequences of current-scope learning, not erroneous reset/double counting.

Duplicating CardData per Group would create competing truth, ambiguous edits and a migration of existing learning. It would not tell us what “mastery” means. If coaches later need improvement since joining, the correct additional concept is a separately commissioned baseline/observation, not replacement of shared learning. Keep shared state now and avoid “completed during this course” claims.

Also, **canonical ancestry is not identity deduplication**: `frameworks/calculations.ts:63–70` deliberately keeps original/fork IDs distinct. A fork may map to the same Item and inherit history while retaining its own subsequent learning. Collapsing it to its ancestor would be a regression.

### B3. Current membership creation manufactures inspection authority

This is the most important challenge to an established principle.

Verified source chain:

- `api/group-experiences/route.ts:5–6` forwards creation to the repository.
- `groupExperiences/http.ts:8–15` checks the feature flag and session; `cards/http.ts:8–13` requires authentication, not coach certification.
- `groupExperiences/repository.ts:49–53,75–82` checks that selected users exist, makes the creator Admin and selected followers active immediately.
- `groupExperiences/policy.ts:4–13` grants that Admin inspection. Management and membership operations can repeat the process later.

Therefore an otherwise unrelated authenticated user can, when the feature is enabled, create a public-Deck Group and add a registered player to establish the very membership needed to inspect them. Existing progress/confidence already have this exposure; Phase 5 expands it to historical assessments. This is **not** an IDOR bypass or a claim of a production incident: the application correctly applies a policy whose trust premise is too weak.

| Choice | Consequence | Cost and migration |
| --- | --- | --- |
| Keep unrestricted automatic enrolment | Smallest code; any creator can turn public curriculum into access to another person's shared history | No migration, but cannot honestly promise only trusted coaches/peers see results |
| Restrict enrolment to an independently verified coach/player relationship | Preserves automatic assignment for a bounded club pilot | Needs a real, non-self-asserted relationship grant; a creator-only allowlist is insufficient if they may select arbitrary unrelated players |
| Subject accepts a Group participation/disclosure relationship | General solution without needing Organisations | New state and UX; existing memberships cannot silently be treated as consent; decline/revocation and later audience changes need definition |

**Recommendation:** separate assignment from authority to disclose pre-existing learning. Do not enable real participants until one of the latter two trust models is approved. Subject acceptance is the stronger general model; an explicitly curated relationship boundary can be a smaller pilot step. This does not require redesigning CardData, a generic permission engine or implementing Organisations now. Public content eligibility, projection allowlists and origin filters cannot solve it. The change affects enrolment/management authority and possibly existing membership confirmation, so it needs explicit approval and its own scoped implementation, not covert inclusion in Phase 5.

### B4. Aggregate visibility is not anonymity

`presentationReads.ts:77–83` and `repository.ts:220–226` expose aggregates to all members, regardless of `allowFollowerInspection`. With two players, a player who knows their own readings can sometimes derive the other's from the mean. Min/max of individual player scores makes disclosure more direct; removing names does not make it anonymous.

**Recommendation:** preserve the existing aggregate policy only with an explicit understanding of this limitation. Gate the **new individual min/max values** to viewers allowed to inspect peers. Others can retain the approved aggregate mean if the founder accepts the existing inferential disclosure. This is a proposed change to the newly approved popover content, not an implementation detail. If peer Off is intended to mean mathematical non-disclosure, the existing aggregates also need restriction; a small-count threshold alone does not guarantee that. Do not introduce statistical privacy infrastructure for this MVP.

### B5. The same all-skipped work can read 100% personally and blank in a Group

This is verified, not merely hypothetical: `progress.ts:19–29` returns 100 when all Steps are skipped; `frameworks/calculations.ts:91` uses it; `tests/frameworks.test.ts:196–202` protects that display. Group `metrics` returns null for the same nonempty all-skipped selection (`groupExperiences/readModels.ts:7–10`). The difference exists even with identical Card/version coverage.

Calling one a display convention is technically accurate but does not make it intelligible to a player comparing the same Progress cells. It also conflicts with the plain-language meaning of “percentage actually completed”.

**Recommendation challenging the preserved display:** in **Framework Progress only**, return no completion percentage when the eligible-Step denominator is zero, in personal as well as Group views. Keep all-todo at 0, skipped+done at 100 when all eligible Steps are done, and confidence independent. Use the existing in-scope unset presentation, not the faint out-of-scope mark. No data migration or Card visual change is needed; explicit approval and deliberate updates of the specific Framework tests are required. Retaining 100 is feasible but leaves a known product inconsistency; do not disguise it as a scope effect or “fix” it by changing Group semantics.

### B6. History and provenance do not establish current-version mastery

Current tests record Boolean result, assessment date and entry time, but no event Card version or marking rubric. Current source titles are read from a later adopted version. A later edit changes result/date without creating an audit event (`assessments/repository.ts:73–86`). Provenance records original entry, not who last edited or what content was examined. These limitations apply equally to Group and personal tests.

Keep these records as assessment **events**, not a formal verified attainment system. Do not invalidate or recolour old tests merely because the Group adopts a new version. Capturing an event Card version could support a future assessment-validity feature, but it does not by itself establish equivalence or a rubric and is not necessary for this Phase 5 scope. No test catalogue/audit subsystem is recommended now.

### B7. Catalogue identity and scope must not be inferred from convenient arrays

- `configurationContracts.ts:42–67` guarantees Item uniqueness across the validated catalogue and disallows one Card mapped to two Items in the same Framework. Cross-Framework reuse is supported. `frameworkItemId` alone is sufficient for assessment identity; `frameworkId` still selects a view. There is no historical ID-reuse enforcement. Preserve Item meaning over time; use a new ID for a materially different skill, not a renamed unrelated target.
- `GroupExperience.cardSelections` retains removed selections; `publicVersions.ts:32–38` intersects them with the adopted Deck. Using all selections would silently include removed learning. Lifetime retained assignments likewise never define current Group coverage.
- Missing canonical data or invalid mapping is not outside scope. Do not replace a failed or ambiguous read with faint dashes that imply an intentional curriculum boundary.
- The preview's whole Framework is in scope. It did not exercise these distinctions, foreign history authorization or context navigation.

## C. User-experience alternatives

These are proposals, not retroactive approvals. They reuse the current Progress surface and existing learning/assessment editors.

| Approach | Teenage use | Coaching / multiple Groups | Main downside | Implementation |
| --- | --- | --- | --- | --- |
| **1. Unified hierarchical Viewing menu**: My Progress, then every Group with its Group/player children | Everything is discoverable in one place, but ordinary use asks the player to understand context before a simple action | Direct jump to any player; arrows can compare within the selected Group | Long menus, repeated names, hidden permission-driven omissions; a native select has only one optgroup level, so a true tree needs a custom mobile control | Moderate; roster paging across Groups and a custom hierarchy add complexity |
| **2. Separate personal and Group Progress entries**: global personal page; each Group opens a scoped instance with its own player selector | Most local decisions are clear, especially while working in a Group | Strong fixed context for comparison | Cross-Group comparison requires leaving/re-entering; personal Item entry can feel disconnected if origin determines inclusion | Lowest initial UI cost; shared table/reader adapters still required |
| **3. Player-first contextual entry with a simple combined Viewing selector** | Global Progress always means My Progress; record personal tests naturally. Entering from a Group preserves its context. No mandatory context choice before each test | Group entries remain directly selectable; arrows move through its permitted subjects without leaving the Item | Context must stay visibly identified; choosing a player in a different Group may take an extra menu selection | Moderate and bounded; one Group roster at a time, existing native controls, no recursive menu |

**Recommend approach 3.** It keeps the two-selector baseline while avoiding the overloaded tree. Personal assessment entry should not be burdened with solving context bookkeeping.

Proposed menu semantics: My Progress; Group entries by name; and, for the currently selected Group, a section containing **Group** and its authorised active players. Choosing another Group resolves its role-appropriate default and loads that Group's roster. The selected Group perspective still displays **Group**, with “Galway U18 · 8 players” beneath; a player's selection displays their identity with the same metadata. Use group-labelled option sections/option text to disambiguate repeated usernames. No search or third persistent selector is proposed. The exact native-select rendering on iPhone must be reviewed before treating this as final UX.

Defaults: global Progress opens My Progress rather than silently restoring a coach's last inspected subject. Group entry inherits a valid explicit current perspective; otherwise use existing defaults, Admin → Group, follower → self. Keep Group scores as the initial Group mode and remember the user's mode while comparing within that visit. Arrows stay within the current Group's authorised ordered perspectives, disable at ends, and never jump unexpectedly to another Group or My Progress. With one option, there is no meaningful stepping.

Keep the Framework selection and expansion state across perspective/context switches where the Framework still exists. Preserve the visible row and its viewport offset, not merely scrollY when header height changes. Keep the comparison controls sticky and the current Group identity visible. The Framework selector can remain above that sticky block if pinning both would consume too much portrait height; this is a visual refinement to approve in the fixture, not permission to change the table. Group mode controls must not cause content jumps when selecting a person.

There is a concrete implementation dependency to verify: `.app-shell` currently uses `overflow-x: hidden` (`src/app/globals.css:315`), which can change the scroll container against which sticky positioning operates. Use a Progress-specific solution if needed; do not alter the shared Card shell to make sticky controls work. This is a code-identified risk, not a newly measured browser failure. Cell popovers should be small non-modal portals outside table flow, placed above/below and clamped to the viewport, closing on outside tap, Escape and context change. Existing components provide dismissal/focus patterns, but there is no existing complete collision-aware cell-popover primitive to reuse unchanged.

For a player who belongs to A and B, ordinary Card work stays in their existing Deck flow. They need the Viewing selector only to inspect a different scope. For a coach with many Groups, Group selection is occasional and player arrows are frequent; optimising the frequent action is more useful than putting every roster in one enormous menu.

**Destinations:** preserve personal Progress's current active/archived/Library behavior, adding named Group destinations under existing My Decks treatment as proposed previously. Personal destinations into a Group must explicitly select self, not the dual-role Admin's Group default. Within Group Progress, mapped learning destinations stay within that experience and preserve the selected subject/read-only capability. Unrelated public content may still be browsed through existing Library navigation, but must never silently expand Group scope or initialise personal assignments. No separate planner or automatic Group content-add flow is proposed. Exact Group entry and destination affordances belong to founder decision 3.

## D. Assessment inclusion and entry-context alternatives

| Policy | What a test means / entry effort | Cross-context and mistakes | Legacy / partial Items | Verdict |
| --- | --- | --- | --- | --- |
| **A. Item-based** | Evidence about the named Item; enter from a natural personal or Group view | Same result visible wherever that Item is in authorised scope; no wrong-context loss | Legacy valid; broad Item evidence remains broad when the Group covers only some Cards | **Recommended**, subject to disclosure trust and clear target meaning |
| **B. Origin-based** | Evidence about the Item, but inclusion depends on the place Save happened | A personal entry vanishes from coach view; simultaneous A/B participation requires choosing, duplicating, or a later sharing feature | Unknown legacy origins excluded or need an exceptional rule; a Group-origin test still does not specify which subset was tested | Reject for MVP: tighter context bookkeeping does not produce better semantic evidence |
| **C. Assisted attribution** | Adds a choice or confirmation of Group, potentially preselected | One Group can be suggested, but personal entry is not necessarily for it; multiple memberships require explicit decisions and corrections | Still cannot infer legacy origin; changing immutable provenance to repair a mistake is wrong | Useful only if future Group-specific submission/credit is a genuine requirement |
| **D. Personal evidence plus separate explicit Group submission/reference** | Result stays owned by player; a distinct association says “use this for Group A” | Can submit one result to several Groups without copying it; origin remains honest | Handles legacy and corrections, but requires sharing/revocation UI and association storage | Coherent alternative if Group attribution is essential; materially more product and engineering work, defer |

Approach D is preferable to falsifying provenance if Group-specific credit eventually matters. Do not implement it just to rescue origin-only filtering now.

Under A, the governing rule is **visible relevant evidence follows its target, not its entry door**:

- Group Item completion/confidence: current in-scope Card Step projections only.
- Group Item player test history: histories legitimately exposed through those Cards, plus that player's direct tests targeting this Item.
- Exclude tests directly attached to other Cards merely because they map to the same Item.
- A whole Item outside current Group scope exposes neither tests nor counts, even to the selected player's own Group view. Their personal view still contains their legitimate results.
- Group-owned histories use only the Group's own Card and Item lists. Player results never become Group-owned results.

There is a deliberate difference in target granularity, not an arbitrary privacy exception: a Card test targets a particular exercise; an Item test targets the skill. The existing history source labels express this already. With A, entering personally while in two Groups has a predictable outcome; with B, provenance becomes an invisible distribution switch. Defer origin-based colours: grey can be mistaken for less valid, missing, disabled or not counted, and legacy unknown is not “elsewhere”.

**Minimal compatible storage recommendation (not implemented):**

```ts
type StoredTest = {
  id: string;
  date: string;       // assessment date, YYYY-MM-DD
  result: boolean;
  createdAt: Date;    // immutable server entry timestamp
  provenance?: {
    enteredByUserId: string | null;
    entryMethod: "manual" | "import" | "automated" | null;
    groupExperienceId: string | null;
    deckTemplateId: string | null;
  };
};
// Personal CardData.tests: StoredTest[]; target inherited from CardData.
// Personal user.itemTests: (StoredTest & { itemId: string })[]; legacy key kept.
// GroupCardState.tests: StoredTest[]; owner and Card target inherited.
// GroupExperience.itemTests: (StoredTest & { frameworkItemId: string })[].
```

Expose a discriminated conceptual target `{cardTemplateId}` or `{frameworkItemId}`, never two simultaneously populated IDs. An adapter can retain the legacy API/storage key without a destructive rename. There is no need to store redundant parent IDs in embedded Card tests or `frameworkId` in direct tests. New manual entries stamp authenticated actor/manual/time and validate explicit current entry context. Personal Framework entry sets Group/Deck null; Group Item entry sets Group context, with Deck null when the assessment was against the Item rather than a particular Deck; Group Card entry records the actual Deck. Never infer a Deck just because the Group currently has one.

Legacy records retain their actual existing `createdAt`; actor/method/Group/Deck remain unknown. If a conceptual DTO exposes `enteredAt`, derive it from valid stored `createdAt`, while reporting missing provenance fields as unknown. Do not invent a second clock or backfill origin. Edits preserve original provenance and createdAt; deletion retains existing semantics. New additions after deletion are new events. Group ownership comes from storage, never the provenance Group field.

Embedded lists remain the smallest compatible design. There is no evidence here of a workload requiring a new collection, assessment index service or generalised event log. Their growth and document-level write contention are real future limits, especially for the shared direct-Item list revision; retain batching and narrow updates, and revisit storage if measured usage makes those limits material. A possible future import feature is not sufficient reason to migrate now.

Preserve per-list CAS and desired-state retries. Capture intended owner/target/context once before submission; a retry after switching Group cannot silently change origin. Compare immutable origin when recognising a new Add with the same ID, as well as the existing value/date checks. Do not call current assessment reconciliation an exact operation receipt. An uncertain Group-owned write after access revocation must not disclose history merely to reconcile it; keep current-authority checks and report uncertainty unless an explicitly approved minimal acknowledgement mechanism exists.

## E. Recommended unified architecture

### E1. A few functions and explicit data, not a policy framework

```text
authenticated request + selected context/perspective
              |
       resolve viewer authority
              |
  resolve learning scope from current/retained evidence
              |
 Framework mapping -> scope plan (versions, Items, Areas, sources)
              |
     bounded allowlisted data readers
              |
 raw metrics + assessment history + permitted capabilities
              |
  existing Progress table and assessment presentation
```

Implement a small server orchestrator and pure scope/mapping function around the existing helpers. Keep authority, scope and presentation data distinct, but do not create five classes or a generic policy engine.

Conceptually:

```ts
type View =
  | { kind: "personal" }
  | { kind: "group"; experienceId: string;
      perspective: { kind: "group" } | { kind: "player"; userId: string } };

type ScopePlan = {
  selectedCards: Map<CardTemplateId, AdoptedVersion>;
  items: Map<FrameworkItemId, {
    coverage: "inside" | "outside" | "unknown";
    cardIds: CardTemplateId[];
    directItemTarget: FrameworkItemId | null;
  }>;
  // Area unions, issues and revision evidence accompany this plan.
};
```

These are explanatory contracts, not a prescription to rename every existing type. A request does not get to supply its own authorised Card IDs. Resolve scope on the server; return only its permitted presentation summary. `View` identifies context, not ownership: Group/player is still personal storage owned by that player.

### E2. Personal and Group scope

**Personal:** union active/archived personal assignments, current active-follower compositions and retained personal/member references. Choose maximum legitimately adopted version per exact CardTemplate identity; never use a newer unadopted publication, all historical Steps, or a current former Group's later composition. Reuse `mergeRetainedAssignments`. Admin-only membership does not create personal eligibility. Existing direct personal Item tests can exist without eligible Cards; a configured personal Item must still show those tests. Thus personal assessment eligibility is not incorrectly reduced to “at least one Card”.

**Group:** resolve adopted Deck composition via `selectedContent`, and use the experience's adopted version for each current Card. Intersect through existing canonical mapping rules. Self/peer/Group/averages share this scope, not this storage owner. Active followers supply the cohort, including explicit dual-role followers once, excluding Admin-only and removed people. A genuinely absent personal row for a valid new assignment supplies default todo/null; corrupt required data supplies incomplete, not fabricated zero.

**Evidence closure:** after selecting current Cards, derive permitted inherited assessment sources from the subject's actual stored personal lineage if the founder approves it. This closure contributes test events only, never ancestor progress, additional current Cards, media or navigation grants. Direct Item targets follow the chosen A/B policy centrally. Do not union all personal Item history and strip nonmatching rows afterwards.

The same scope plan drives metrics, histories and coverage, but they are not forced to have identical raw inputs. Confidence uses readings, completion uses statuses, tests use target/evidence sources. This distinction prevents the “one dataset” abstraction from dropping legitimate direct Item tests or expanding numeric learning to ancestors.

### E3. Row states and calculation rules

| State | Meaning | Presentation / queries |
| --- | --- | --- |
| Known outside Group scope | No current Group Card maps here | Full hierarchy retained; very faint metric/Test dashes, readable slightly subdued label; no personal assessment query or Add action |
| Inside, genuinely unstarted | Valid assigned Cards, no recorded progress | Existing 0% and unset-confidence/empty-test treatment; not out-of-scope styling |
| Inside, all eligible Steps skipped | Covered curriculum but no completion observations | Null completion under Group policy; confidence/tests can still exist; personal Framework alignment requires decision 6 |
| Inside, complete read | Valid projections | Existing numbers/history, plus approved touch comparisons |
| Unknown/incomplete | Mapping/storage/source unavailable or corrupt | Existing unavailable/error treatment, never out-of-scope dashes |

Area coverage is a union of child Card sets. Do not average displayed Item percentages or count one Card again through overlapping sources. Assessments remain independent of learning metrics; Area Tests stays as currently designed rather than inventing an Area assessment roll-up.

For a player cohort and Item/Area:

```text
completion = round(100 * sum(done Step observations)
                       / sum(non-skipped Step observations))
confidence = round(sum(valid raw readings) / count(valid raw readings))
doing/done = classify each player's selected non-skipped Steps, then count people
min/max    = lowest/highest valid player's calculated confidence in this scope
```

Example: one player has 1/1 eligible Steps done and another 0/3. Completion is **25%, not 50%**. For confidence, one valid reading of 10 and three of 2 give mean **4**, not the unweighted mean of player scores, 6. The approved label “Player averages” is shorthand for this weighted pool, not equal weighting per player. Keep the approved label but document/test the definition. Min/max uses the same rounded personal scope scores displayed in individual views; the pooled mean still uses raw readings. Completion and confidence denominators are independent; skipped does not discard a confidence reading.

No eligible observation means null, not zero; a valid rounded 100 does not establish everyone done. Missing/corrupt required rows must not silently disappear from the cohort. Same checks feed summaries and popovers; no second arithmetic implementation in JSX.

### E4. Safe data transport and state

Keep existing personal endpoints owner-only. Add Group-scoped assessment/Progress readers that require current viewer membership and permitted active subject, plus current scope. Add a narrowly projected assessment reader beside `learningReads.ts`; do not generalise it into fetching every personal field. Project only permitted tests, list revisions and the next authorised lineage link; bound the traversal with cycle/duplicate/missing-source handling and expose an incomplete result when needed. Reuse pure ordering/deduplication without reusing a foreign full-CardData history fetch.

Group summary returns Group values, authorised aggregate statistics and compact Group tests. Selected-player summary returns that player's scoped data. Fetch full history on opening its existing modal, not every player's every assessment during roster loading. Batch by owners/Cards and avoid an HTTP request per cell. Do not use 5.0's synthetic actor substitution as a production authorization strategy.

Cache identity includes authenticated viewer, context/experience, subject or Group owner, Framework, adopted composition and authority generation. List dependencies include assessment revisions; a membership lease alone does not signal another person's new test. Reuse existing focus/visible-page revalidation and bounded resources; no new realtime/cache service. Cancel/discard stale responses, hide data when authority cannot be verified, and clear inaccessible history/modal data at lease expiry. Preserve table structure while loading a new perspective, but never show previous personal/foreign numbers under the new label.

Use the existing read-only/modal capabilities for inspected players; owner self can edit their own results, Admins can edit Group-owned tests. “Admin can see” never means “Admin can edit the player's result”. Personal pending operations remain keyed to personal owner/list across contexts; Group operations have a distinct Group owner key.

### E5. Future multi-Deck support without implementing it

Have the scope function accept a resolved list of adopted Card references, not depend internally on a single Deck field. Today's adapter supplies one Deck; a future adapter could supply a deduplicated union. Membership and authority remain experience-level. Shared Card learning is still counted once.

However, two Decks can request different versions of the same Card. A union alone does not decide which version defines the denominator. Prefer retaining one explicit adopted Card version per experience, with future addition review resolving conflicts, rather than silently taking the latest publication. This is a future product/adoption decision, not a reason to change Group storage now. Provenance's nullable Deck ID remains the actual entry path; Group Item entry without a Deck continues to work.

## F. Human-use scenarios

The following uses the recommended Item-based policy and contextual navigation. Those recommendations still await approval. Existing record ownership/adoption rules are identified separately from proposed entry points.

### 1. Ordinary teenage player

A 15-year-old opens their assigned Group Deck. The current follower default is their own perspective. They complete a Step and set confidence using the accepted Card controls. The write changes their one personal Card record; no additional personal Deck or deadline is created.

Later, global Progress opens **My Progress**, with the whole eligible Framework. From the proposed Group Progress entry, or by choosing Galway U18 in Viewing, they instead see their name and **Galway U18 · 8 players**. The same learning appears only on Cards currently covered by that Group. Out-of-scope rows remain as context, not accusations of no learning. Switching back to My Progress is a direct Viewing choice, not a journey back through Decks.

**Governing rule:** the learning is theirs; the view selects which part to show. The remaining usability risk is whether the Group identity and faint outside-scope treatment communicate this sufficiently on iPhone. Review that, rather than teaching CardData or provenance terminology. A brief context explanation near existing metadata may be needed if observation shows confusion; its exact copy/placement is a proposal for the visual review, not an invented permanent banner.

### 2. Direct Item assessment entered personally

The player opens My Progress, taps the existing Tests cell for Shooting, and records the result/date. One personal direct Item test is saved with `frameworkItemId` conceptually, authenticated actor, manual method and server createdAt. Group/Deck provenance is null because this was a personal Item entry.

With recommended A, a trusted authorised coach sees it wherever Shooting is currently in Group scope. The player did not choose the “wrong door”; no duplicate test or attribution prompt is required. The Group-owned Tests column is unchanged because this is the player's result.

If the player expected the entry to be private from a coach, A would surprise them. Do not pretend navigation solves disclosure expectations: the accepted participation/visibility boundary must explain that relevant shared learning includes assessments. B provides narrower origin-based sharing but exchanges that problem for invisible missing work; it does not establish a general privacy preference mechanism.

### 3. Previously used Card

The player completed Card X and tests before joining. Their Card remains done and keeps its confidence/tests. Group individual Progress and an authorised coach's player view show those same personal results, projected against the Group's selected version. Personal Framework includes X once at the highest legitimately adopted eligible version. Group-owned completion/tests are separate and need not be done.

No values or tests are copied at enrolment. Existing tests retain unknown or personal provenance. **Rule:** prior relevant learning counts; joining does not reset skills. A new version with different Step IDs can change the displayed projection; history remains events, not evidence every new Step was done.

### 4. Two concurrent Groups

Groups A and B contain the same CardTemplate. The player adds a personal Card test through A. It is stored once on their personal Card with A and the actual Deck as entry provenance. Personal history, A player history and B player history can all show it. B does not gain access to A's name, other members or private content from that provenance. Neither Group-owned test list receives it.

Completion/confidence may differ if A/B adopted different Step versions, but the test list does not split by version or origin. If a direct Item test is entered through A, recommended A likewise allows B to show it only when that Item is in B's scope. The user sees ordinary result symbols everywhere; no grey penalty for entering through A.

### 5. Coach comparing players halfway down a Framework

The coach keeps the same Item in view. From Group scores, one tap opens its comparison popover; an outside tap dismisses it. Switching the entire table to Player averages is one selector action. The Tests column remains Group tests in both modes.

To compare three adjacent players: next arrow from Group to the first permitted player is one tap; two further next taps show the next two. The mode control is inapplicable to an individual; their own Tests appear read-only to the coach. This costs three perspective taps, with no repeated Framework/Item selection. If the desired players are non-adjacent, use a dropdown selection for each rather than promising one-tap access to arbitrary people.

Expansion, Framework, row position and scroll remain stable. A delayed response never paints player 1's values beneath player 2's name. The coach cannot edit those personal results; their Group-owned tests remain editable only in Group perspective. Changing Groups may require one Group choice plus a player choice, an acceptable cost for avoiding an enormous menu.

### 6. Partial Framework coverage

An Item maps to A, B and C; the Group includes A only. The player's A is unstarted, B/C are done. Group individual completion is 0%, not the overall personal Item percentage. Group confidence is from A's selected Step readings only. Group player history includes A's permitted assessment history and direct Item tests, but no independently attached B/C tests. Personal Progress includes all eligible A/B/C and their histories, deduplicated.

This means Group practice can read 0% beside a passed direct Item test. That is not a mathematical error: the practice and assessment are different evidence. Existing source-labelled history explains the distinction; do not infer that a pass should mark Steps done. If this juxtaposition is unacceptable to the product, approve a different test target/inclusion policy before coding rather than secretly adding automatic completion.

### 7. Group content changes

An Admin adopts a new Deck/Card version. Current Group scope is recomputed atomically against the adopted composition and versions. New stable Step IDs begin with default values unless the player's authoritative record already has them; old IDs are retained. Removing a Card removes its progress/confidence and independently sourced tests from current Group roll-ups. If it was the last mapped Card for an Item, the entire Item becomes outside scope, including direct Item test cells. Its stored tests are not deleted.

If another current Card still maps to the Item, that Item remains in scope; direct Item evidence remains relevant under A. A removed Card's tests could remain visible **only** through an approved actual inherited-history relationship from another in-scope Card, not because all retained selections are accidentally included. Group-owned stored events remain retained and can reappear if their target returns; retained-source management requires decision 5.

Personal Framework retains legitimate assignment references and maximum adopted versions. A departed player's references freeze at their legitimate assignments, not later Group adoptions. Removed players disappear from ordinary Group navigation/aggregates, and later personal tests do not appear through frozen removal snapshots. Existing scalar snapshots remain scalar; this review does not authorise adding historical assessment browsing.

**Rule:** current Group coverage can change without erasing personal learning. No navigation permission follows from retained eligibility.

### 8. Legacy assessments

Valid old Card/Item tests continue to appear by target under A, with their original result, assessment date and existing createdAt. Unknown actor/method/Group/Deck stays unknown. They receive the existing pass/fail presentation, not inferred Group attribution or an “elsewhere” colour.

An owner correcting an old date/result does not make its origin the Group they happen to be visiting. Group viewers see the corrected shared result when revalidated, because this is current owned history, not a tamper-proof audit. If source data is malformed, use existing incomplete-history behavior; do not quietly claim the readable subset is the complete history.

## G. Privacy and security

### G1. Two separate questions: who is trusted, and what can they read?

The membership trust issue in B3 must be resolved independently of field projection. Once a valid relationship exists, server checks still require current viewer access, current subject participation, current selected composition and applicable peer policy. A client-provided subject/Framework/Item is never authority.

| Viewer and selected owner | Results permitted in Group scope | Mutations |
| --- | --- | --- |
| Current Admin → Group | Group metrics and Group tests | Group tests, subject to current target/new-entry rules and CAS |
| Current follower → Group | Group metrics/tests and permitted aggregate fields | No Group test writes |
| Active follower → self | Same Group-scoped personal results that an authorised inspector would see | Own test edits/deletes; new entries only through valid target/context |
| Admin → active player | Allowlisted personal progress/confidence/assessments | No personal writes |
| Follower with peer inspection → active player | Same allowed results | No personal writes |
| Follower without peer inspection → another player | Denied, including test count/history/prefetch | Denied |
| Unrelated/removed viewer or removed subject in ordinary Progress | Denied | Denied |

Admin-only members are not a player perspective and have no personal assignment merely by administering. Existing removed-subject scalar snapshot endpoints are a separate historical capability; do not accidentally route ordinary Progress through them.

### G2. Assessment-specific query boundaries

For Card tests, filter to current in-scope Card IDs and, if approved, permitted subject-owned lineage sources. For direct Item tests, filter to the exact in-scope Item IDs under A. Do not retrieve unrelated direct tests and then hide them in React. Do not call the existing owner reader with a forged viewer ID to impersonate the player.

The historical walker currently expects full `CardData` and calls `readablePersonalHistory`, which also processes media/chats. Reuse its cycle/dedup concepts through a minimal assessment-source shape; do not invent a second unrelated ancestry interpretation. Resolve `historySourceCardTemplateId` one bounded layer at a time with only test fields/revision/next link. Canonical fork metadata is used for mapping, not authority to retrieve another personal source. Siblings and unrelated same-Item Cards never enter this evidence closure.

This deliberately changes earlier “no foreign tests” expectations. Update tests by route purpose: scalar-only readers should **still** exclude tests; explicit assessment readers should prove authorised tests are present and private fields absent. Media/reflections/Info references/target dates/adoption pointers/private activity metadata remain excluded at the database projection boundary.

### G3. Inherited history requires an explicit product decision

The current personal chain is live, not frozen when a fork is created (`cards/forks.ts:76–103`). A later test on a source Card can appear in the fork's personal history. Preserving exact parity for a Group viewer therefore exposes those later source events too, potentially from a Card not currently assigned in the Group.

**Recommendation:** preserve the subject's established assessment-only history for an in-scope Card, including the actual live chain, with source deduplication and read-only foreign access. This avoids coaches seeing a different version of the same Card's history. It is not justified merely by canonical relatedness and must not include all Cards mapped to the Item. The trade-off is broader historical evidence than the practice subset. If that is unacceptable, the smallest alternative is exact-current-Card source tests only in foreign Group views, explicitly acknowledging the owner/coach history difference. A timestamp cutoff is neither established inheritance behavior nor reliable without a stored inheritance event boundary; do not invent one from createdAt.

Never expose inaccessible private source titles/content simply because a test is inherited. Return a neutral unavailable/source label through the existing history presentation and no navigation grant. Deduplicate internally by actual owner/source/test ID; a read-only foreign DTO can use an opaque row identity without revealing raw private lineage identifiers. Do not supply mutation dependencies/capabilities for inaccessible sources to the client.

### G4. Provenance is not a cross-Group directory

Store stable original IDs, but do not return all of them to every authorised result viewer. Another Group's ID/name, its Deck, or an entering actor's account details are not automatically visible just because the result is relevant. Use a deliberately projected result DTO. Initially the existing history display needs result/date/appropriate source label, not provenance UI. Full storage can remain server-side.

Unknown context must remain distinct from recorded personal context. No grey treatment or guessed origin is necessary. A future origin indicator should use a safe current/other/unknown classification and independently authorise any detail resolution. Seeing a result never grants a link into the originating Group.

### G5. Revocation, retries and measurement disclosure

Reuse immediate server denial and existing approximately five-second visible-page authority lease/focus revalidation. Clear stale subject/history data when verification fails; scope/revision changes invalidate histories and summaries, not just menus. Previously downloaded data cannot be recalled. Store no foreign results in the personal working store.

Final access loss must not be bypassed by an assessment retry. Personal owners can reconcile through their continuing owner authority; Group result reconciliation needs current Group authority or a separately approved minimal acknowledgement, never a stale historical payload. New-entry checks use current composition; edits do not rewrite original provenance.

Anonymous aggregate statistics remain an inferential disclosure in small cohorts. Recommendation B4 is an explicit limit on new extrema, not a claim that all remaining aggregate results are private. If stricter non-disclosure is required, settle it before connecting these new fields to non-inspecting viewers.

## H. Revised Phase 5 implementation plan

**Keep 5.0 intact.** It is a useful visual baseline, not a production Group assessment adapter. No fixture changes have been made during this review. Scope/authority decisions should precede the previous storage/read/UI sequence; otherwise each adapter will encode its own answer.

| Order | Checkpoint and deliverable | Reuse and main affected modules | Verification / review |
| --- | --- | --- | --- |
| 0 | Approve founder decisions and reconcile authoritative docs. Record deployment trust gate and any deliberately deferred remedy. | Existing engineering plan §§7–9, Phase 4 privacy statements and Phase 5 acceptance criteria | Review target/scope/authority matrix before code. No silent changes to old invariants |
| 1 | **5.1a — scope and evidence contract**, pure mapping plan, row-state model, selected-version rules | `frameworks/{mapping,eligibility,calculations,readModels}`, `groupExperiences/publicVersions`, retained assignment helper | Table-driven partial Items/Areas, unmapped/unknown, same scope self/peer, canonical versus personal ancestry, no query side effects |
| 2 | **5.1b — lifetime personal eligibility** and explicit version projection/history titles | Current/member-retained references, personal retention, `cards/learning`, existing Framework readers | Personal+A/B dedup, exact max adopted vs unadopted publication, departed membership freeze, original/fork distinction, missing/corrupt defaults, no adoption writes |
| 3 | **5.2a — assessment target/provenance contracts** and compatible personal storage | Embedded lists, validation, `assessments/{contracts,repository,history,client}`, `personalHistory` | Actor/context spoofing, unchanged createdAt on edit, legacy unknowns, provenance survives every projection, old APIs still work, fixed-ID retry across context switch |
| 4 | **5.2b — personal assessment entry through Group** | Real session actor, Group context authorization/member fences, narrow first-row materialisation, existing personal queue | Never-opened Group-only Card, own direct Item entry, self/foreign writes, removal/adoption races, no dates/private-field replacement, HTTP LAN-compatible IDs |
| 5 | **5.3 — Group-owned assessment lists and commands** | Group Card state/experience lists, separate assessment revisions, existing pure CAS/history logic | Independence from personal/A/B, concurrent Admin writes, rollback, stale lists, new-source versus retained-result policy, uncertain response then role loss |
| 6 | **5.4a/b — scope-driven metrics and authorised history reads** | Narrow scalar reader plus assessment-specific projection, `metrics`, `followerMetrics`, raw unions | Eligible-Step weights, per-player confidence extrema, all-skipped/unset/corrupt cases, membership/peer permissions, private sentinel exclusion, source closure and dedup |
| 7 | **5.5 — entry/destination/return context**, followed by **5.6a — stable selectors and table modes** | Existing Overview/Deck menu entry points, Progress navigation/destination dialogs, shell/table/hooks, Group identity pages | Global personal default, contextual Group entry, all roster pages, dual-role self destination, no removed destinations, reverse-order network responses, stable Item/expansion/scroll |
| 8 | **5.6b — scoped Tests cells and metric popovers**, then focused iPhone review | Existing `ItemTestsCell`, AssessmentModal/Symbols; small anchored portal with current outside/Escape patterns | No extra columns/row movement, one popover, touch/outside dismissal, edge positioning, no stale content after subject changes, Group Tests retained in both modes |
| 9 | **5.7 — integration/handoff** | Existing disposable Framework/Group browser harnesses and accepted Phase 4 regression suites | All approved policies, current permissions, personal learning/history, retry/retention, physical Card geometry/gestures unchanged; actual results and limits documented |

**Trust-boundary work:** implementing participant acceptance or verified enrolment grants crosses the previous Phase 4 automatic-assignment scope. Authorise it separately and place it before any real-player rollout; fixture-only Phase 5 scope/storage work can proceed after approval without pretending that deployment gate is solved. Do not expand Phase 5 opportunistically into invitation/Organisation tooling.

### Required focused test cases

- **Scope:** Group A includes one of three mapped Cards; B includes two; a third personal-only Card has sentinel results. Outside Item has genuine personal progress/direct tests but Group response has only scope state, no hidden data. Complete Framework remains visible. Self and inspected views have equal learning/evidence coverage, differing only in mutation capability.
- **History:** same source reachable through two current Cards counted once; sibling excluded; live ancestor addition/edit; cycle/missing source incomplete; legacy with unknown provenance; private source title not leaked; Group-owned histories never traverse personal lineage.
- **Numeric:** unequal eligible denominators; raw confidence weighting; min/max per player's calculated score; zero followers; all todo; all skipped; one eligible player; skipped readings still valid; rounded 100 not explicitly done; Area union and no repeated Card. Test approved personal all-skipped choice explicitly.
- **Authority:** arbitrary enrolment threat at the approved trust boundary; current Admin/peer/self/no peer/removed/outside Group; direct guessed Item IDs; stale/revoked cached subject; forbidden provenance identity resolution; aggregation limitations treated as policy, not UI hiding.
- **Writes:** group-only missing personal row; shared list across contexts; concurrent scalar/test mutation; CAS conflicts; lost response; no resurrection after deletion; immutable provenance on edits; safe error handling before request preparation; retained owner edits after leaving.
- **Presentation:** actual controls at portrait iPhone and desktop in Chromium/WebKit; no table remount/scroll jump when rapidly switching; no loading label showing old subject values; full hierarchy/partial coverage/outside marks; Group Tests unchanged across modes; personal Tests retained for player inspection; pending modal work remains bound to its original owner.

Tests should assert privacy at the database projection and HTTP response, not merely whether buttons are hidden. Do not weaken old private-field tests wholesale; supersede only the exact personal-assessment prohibition in the new assessment contracts.

### Use 5.0 for the next visual decision, not as permission bypass

Once authorised, extend the disposable fixture with an additional personal-only Card inside a partly covered Item, a wholly outside Item/Area with personal tests, a second Group overlapping Cards at a different version, a legacy test, a direct personal Item test and an inherited-source example. Retain the accepted preview route/data as a baseline or explicit scenario; do not replace production configuration. Fixture-only assessment arrays remain appropriate until real storage exists. Test the final read models separately against disposable data.

Review on iPhone: whether My Progress versus the named Group is obvious; whether arrows keep the same Item in view; whether sticky controls leave usable table space; whether 0%, blank and outside-scope dashes are distinguishable; whether a pass beside incomplete practice is understandable in the history; popover placement/touch dismissal. Arithmetic, authorization and persistence remain automated checks. Do not ask the user to validate them manually.

### Changes needed to the existing documentation after approval

- Replace owner-only foreign assessment prohibitions in overarching §§7–9, data/API tables, privacy tests and Phase 4 forward dependencies with the exact new allowlist. Preserve private media/reflection/Info/target-date restrictions.
- Replace §9.4's self/foreign history asymmetry and §9.8's extra-values/extra-columns proposals with the approved scope and table modes.
- Record complete hierarchy/outside/unknown row states, partial-Item practice versus direct-Item evidence, active scope versus retained assignment boundaries, and the approved inherited history rule.
- Add provenance/storage compatibility, truthful desired-state retry semantics, explicit Group entry handling and separate Group/personal mutation owners.
- Reorder scope before read/storage adapters, retain 5.0 as a prototype, and turn the six founder decisions into explicit acceptance contracts.
- Mark the enrolment trust condition as a rollout blocker; do not describe fixture acceptance as participant-security approval.

**Not now:** multiple-Deck storage, origin colours, imports, assessment types/rubrics, coach-on-behalf entry, historical audit logs, baseline improvement tracking, removed-follower history UI, Organisations, new contribution phases or statistical privacy systems.

## I. Decisions for the founder

These are six decision groups, prioritised. Everything else above is a recommended engineering choice under the selected product rules, not a request to approve class names or endpoint spelling.

### 1. What establishes trust to inspect a player?

**Choice:** unrestricted automatic activation; independently verified coach/player relationship; or subject-accepted participation/disclosure.

**Recommendation:** stop treating arbitrary enrolment as sufficient authority. Keep real-participant enablement blocked; use explicit participation acceptance as the general solution, or a separately approved curated relationship gate for a bounded pilot. Define audience expansion/revocation, not just initial Group entry, when commissioning that work.

**Trade-off:** some onboarding/administrative effort versus exposing shared learning/history to anyone who creates a Group. Existing fixtures need no migration; real pre-existing memberships cannot simply be presumed accepted.

**Affected work:** creation/member management authority, disclosure checks and rollout; not CardData ownership. This explicitly challenges the existing no-acceptance/automatic-assignment principle.

### 2. What does direct Item assessment inclusion mean?

**Choice:** all tests of an in-scope Item (A); current-origin only (B); or a separate entry/submission attribution workflow (C/D).

**Recommendation:** A. Treat these as Item-level evidence, even when the Group practices only part of the Item. Reuse existing source labels and ordinary symbols; no origin colours or attribution prompt.

**Trade-off:** natural entry and complete relevant history versus broader evidence than the particular assigned exercises. If “only tests of exactly our exercises” is required, target granularity must change; provenance alone cannot provide it.

**Affected work:** scope resolver, personal/foreign Item history, direct Group Item eligibility, fixture expectations. Keep new Group-owned Item assessments limited to currently in-scope configured Items; personal direct Item entry retains its broader configured-Item behavior.

### 3. Approve the player-first contextual navigation contract?

**Choice:** all-rosters hierarchical menu; separate pages/entries; or proposed contextual entry plus Framework/Viewing selectors and current-Group player choices.

**Recommendation:** approach 3, global My Progress default, contextual Group entry, within-Group non-wrapping arrows, current Group identity visible, and selected Item/position preserved. Offer configured Frameworks consistently; a Group with no matching learning shows the full out-of-scope hierarchy rather than silently switching Framework. Use existing personal destination dialogs with named Group choices and explicit self entry. Confirm the fixture version on iPhone before permanent wiring is considered final.

**Trade-off:** one extra selection for an arbitrary player in another Group versus a much shorter, clearer menu. No compulsory context navigation before personal assessment entry.

**Affected work:** entry/menu adapter, roster loading, selectors/sticky state, destinations/return transport; no Card redesign.

### 4. What should peer visibility Off promise about aggregates?

**Choice:** maintain aggregate disclosure with its small-cohort inference limitation; restrict new extrema to authorised inspectors; or require stronger non-disclosure and restrict existing aggregates too.

**Recommendation:** explicitly accept existing summary inference for MVP, but allow the **new individual min/max** only to Admins/authorised peer inspectors. Keep mean-only comparison for non-inspectors. If inferred personal values are unacceptable, choose the broader restriction before rollout rather than an arbitrary “safe” cohort threshold.

**Trade-off:** less comparison detail for restricted followers versus a stronger meaning for disabling named inspection. This does not make remaining aggregates anonymous.

**Affected work:** server aggregate capability/DTO and confidence popover content. This challenges part of the approved all-viewer comparison presentation; do not implement without approval.

### 5. Approve precise historical evidence boundaries?

**Choice:** Group inspection matches the actual personal Card assessment lineage, including live ancestor sources, or shows only tests stored directly on current Card IDs. Separately, permit current Admins to manage retained Group-owned results by their existing source, or make them dormant outside current composition.

**Recommendation:** preserve legitimate assessment-only lineage for parity with the player's Card, with opaque/private source metadata redaction; no unrelated same-Item Cards or canonical-only inheritance. For Group-owned retained tests, preserve records and allow current Admin read/edit/delete of existing exact-source results, but require current coverage for new results. Keep them out of current summaries and ordinary removed-Card navigation. No new historical browser is proposed.

**Trade-off:** coherent retained history and correction rights versus broader historical evidence. An exact-source-only alternative is safer in scope but visibly differs from the owner's established Card history. Retained management APIs do not alone provide a historical discovery screen; that UI remains deferred.

**Affected work:** assessment-only lineage projection, source-title/ID redaction, retained-source permissions, history tests. No personal-media or removed-player assessment access is granted.

### 6. Correct the personal Framework all-skipped percentage?

**Choice:** retain its historical 100% convention or align Framework completion with the Group's no-eligible-observations state.

**Recommendation:** null/unset completion in Framework Progress when the denominator is zero, across personal and Group contexts. Keep existing all-todo zero, actual done arithmetic, confidence and all Card geometry/controls unchanged.

**Trade-off:** a narrowly visible change to an established personal display versus eliminating a concrete contradiction in the same Progress table. No data migration; targeted calculation/reader tests must deliberately change after approval.

**Affected work:** personal Framework metric adapter/calculation boundary and specific regression expectations. This explicitly challenges a previously preserved display convention, not neutral-skipped classification.

## J. Independent assessment of the previous Sol plan

### Retain

Sol correctly identified the existing storage seams, stable Step projection, lifetime assignment foundations, missing Group assessment APIs, narrow foreign queries, explicit owner distinctions, list revisions and the need to preserve real Progress components. Reusing immutable createdAt, keeping legacy records valid, avoiding parent-ID duplication/new assessment collections, and deferring origin colours are proportionate decisions. Its warning that group-only Card assessment Add must materialise a valid own row before list access is important. The fixture preview was appropriately isolated and proved visual reuse without authorising production integration.

### Correct

- Start with a shared scope/evidence contract, not independent storage and presentation adapters that later need reconciliation.
- Resolve direct Item relevance as a product meaning question. “Existing direct tests are easy to reuse” is not enough justification; partial Item coverage makes the distinction explicit.
- Treat inherited history as an authorised evidence closure, not an automatic consequence of reusing an owner-only walker.
- Do not equate membership role checks with legitimate enrolment authority, or anonymous aggregates with non-disclosure.
- Do not call assessment desired-state reconciliation an exact operation receipt. Provenance must survive legacy projection helpers and be bound to original request context.
- Do not explain all-skipped 100 versus null solely as harmless display conventions. It is a visible inconsistency requiring an explicit decision.
- Update the old plan's privacy/Tests-column/self-history and additional-column statements before agents implement from it; they are substantively superseded.

### Substantially missing

The earlier proposal did not sufficiently connect navigation to where teenagers actually record work, or distinguish Group curriculum coverage from Group-attributed activity. It did not expose the arbitrary-enrolment trust problem, small-cohort aggregate inference, live inherited-source exposure, or the semantic limit of tests without an assessment definition/version. The provisional multi-Deck union also needs a version-conflict policy eventually; it is not just deduplication.

These findings do **not** justify a new database, duplicated personal CardData, a universal policy framework or a redesigned table. They justify explicit product contracts and a small set of shared scope/projection functions.

### Readiness

Once decisions 2–6 are settled and the authoritative plan is reconciled, the fixture-backed Phase 5 implementation can proceed in the sequence above. Decision 1 remains a real-participant rollout gate and any required new enrolment work needs separate authorisation; passing Phase 5 tests under the existing membership rules is not sufficient to remove it.

The design is broadly sound after these targeted revisions. The strongest improvement is not a new feature: it is making the same few rules govern context, evidence, authority and calculations everywhere.
