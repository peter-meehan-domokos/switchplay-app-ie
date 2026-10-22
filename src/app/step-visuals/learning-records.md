# Card 1 learning-record interface (v1)

Import `RootsFactorsActivity` and the exported record types from `./public`.
The activity owns learning decisions and produces immutable, JSON-serializable data.
Its host chooses which data to retain, when to persist it, and how to associate it
with application users/cards. All records are in memory. There is no refresh recovery.
Callbacks must be passed by a React client component when using Next.js.

## Public callbacks and lifecycle controls

```tsx
<RootsFactorsActivity
  onComplete={(result) => receiveCompletedAttempt(result)}
  onEvent={(event) => receiveLearningEvent(event)}
  onRecordsChange={(records) => inspectCurrentSession(records)}
  onExit={() => closeActivity()}
/>
```

- `onEvent(Card1LearningEvent)` receives accepted semantic events after React commits.
- `onComplete(Card1LearningResult)` receives each completed attempt once, following
  its `attempt-completed` event. It is triggered by the successful explicit Check.
- `onRecordsChange(Card1SessionRecords)` receives the initial snapshot and meaningful
  updates, including current/partial attempts, completed archives and ordered history.
  It also makes the latest archive available when this callback is first attached later.
- `onExit()` runs after exit events and the final session snapshot have been delivered.
  Hosts can then unmount or navigate. The activity's Exit button appears only when supplied.
- Changing `restartKey` requests a full restart with a fresh attempt ID. Changing
  `exitKey` requests an explicit exit, including when `visible` is false. Keys are
  non-negative safe integers; their initial values do not trigger requests. If both
  change together, restart is processed before exit.
- `visible={false}` cancels editing and preserves the current attempt. It does not
  create an exit event. Temporary previews use this contract.

Notifications never execute during rendering or inside a reducer. Delivery cursors
guard Strict Mode effect replay, callback identity changes and reentrant delivery.
Handlers added later receive future events/completions, rather than replaying past
notifications; use `onRecordsChange` to inspect earlier snapshots. Notifications do
not guarantee durable storage or delivery across a true unmount/browser shutdown.
Synchronous callback errors are reported and do not undo learning progress or block
remaining notifications. Hosts own async storage/error handling; callbacks are not awaited.

## Records

All snapshots include `schemaVersion: 1`, `activityVersion: 1` and
`activityId: "roots-and-factors"`. Schema version identifies the data shape; activity
version identifies this mathematical task (fixed root 1, prediction root −3, target x+4).

`Card1AttemptSnapshot` contains:

- Opaque random `attemptId` and session-local `attemptNumber`.
- `status`: `in-progress`, `completed`, `restarted` or `exited`.
- `stage`: the portable reducer stage, and integer `settledRoot`.
- Nullable `prediction`: `proposedRoot`, `chosenFactorRoot`, `rootAtSubmission`, `correct`.
  Chosen factor root 3 means x−3; chosen factor root −3 means x+3. Correctness remains
  null until the learner settles the root at −3 and tests the prediction.
- `placements`: changed committed roots with `fromRoot`, `toRoot`, `stage` and input
  method (`pointer` or `keyboard`). Unchanged placements and cancelled edits add nothing.
- `checks`: ordered individual records with `checkNumber`, `root`, `targetFactorConstant: 4`,
  `factorValue`, `correct` and `assistanceRequested` at that Check. `factorValue` evaluates
  x+4, not the plotted quadratic, which is zero at every movable root.
- `checkAttempts`, `incorrectChecks`, persistent `assistanceRequested` and nullable `successMode`.

`Card1LearningResult` refines the snapshot to completed stage/status, settled/final
root −4, tested prediction correctness and non-null `successMode` (`independent` or
`assisted`). Independent means no Guided explanation was requested; incorrect
predictions/Checks alone do not make the result assisted. Lab preview exposure is
outside Guided evidence and must not be interpreted as proof of unseen answers.

`Card1SessionRecords` includes the current snapshot, `completedAttempts`,
`partialAttempts`, `events` and an `exited` flag. Start again preserves the old completed
snapshot, begins a fresh attempt at root 3 and resets current learning evidence. Explicit
restart archives an incomplete snapshot with restarted status. Explicit exit archives
an incomplete snapshot with exited status; an already completed result remains completed.

## Events

Each event carries the version/activity fields, attempt ID/number, a strictly increasing
session-wide `sequence` and an `eventId` composed from attempt ID and sequence.

| Event | Mathematical payload |
| --- | --- |
| `attempt-started` | Initial root 3. |
| `root-placed` | Changed committed placement. |
| `prediction-submitted` | Choice and submission root, with correctness null. |
| `prediction-tested` | Choice with revealed correctness. |
| `stage-changed` | Previous and next learning stages. |
| `answer-checked` | Individual Check record. |
| `assistance-requested` | Preserved settled root. |
| `attempt-completed` | Immutable completed result. |
| `attempt-restarted` | Previous snapshot, new attempt ID and reason (`start-again` or `restart-request`). |
| `attempt-exited` | Final complete/partial snapshot. |

Example Check:

```json
{"checkNumber":1,"root":-3,"targetFactorConstant":4,"factorValue":1,"correct":false,"assistanceRequested":false}
```

A subsequent correct Check at −4 produces factor value 0. If assistance was requested,
that Check records true and the completion is assisted. Start again preserves these
Checks in the completed archive while the new current attempt starts with empty lists.

Dragging start/preview/cancel, stale/invalid actions, menu opening and temporary
preview changes produce no learning events. There are no timestamps or intermediate
pointer samples. Root previews reuse the same record envelope: no history traversal,
copying, freezing or callback delivery is added to the high-frequency drag path.
Arrays grow only on accepted meaningful actions and are retained for the mounted session.

## Lab inspection

The collapsed **Learning records** inspector demonstrates host consumption of all three
callbacks, retaining received events/results across explicit navigation. JSON is mounted
only when requested, so closed inspection does not expose answer-bearing record markup.
The inspector is never imported by or exported with the reusable activity. Dropdown A–E
and Sparkline preview preserve Guided records; leaving the actual experience reports exit.
Native tab closure, refresh and arbitrary parent unmount are not treated as guaranteed exits.

During `npm run dev`, the lab also automatically writes collapsed **Step Visuals** console
groups. Each accepted-action callback batch logs its full session snapshot and delivered
events/results as objects. Events and completion arrive before the snapshot; exit arrives
afterwards. Logging closes at the snapshot, not separately for each callback. Initial open,
restart and exit are included; pointer previews, cancellations and dropdown changes are not.
The logger is lab-only and silent unless `NODE_ENV` is `development`. It adds no identity
data, storage, new controls or reusable-activity behaviour.

The non-drag touch alternative remains deferred. Physical iOS/Android assistive-technology
testing and a host-specific sizing/lifecycle review are still needed before integration.
