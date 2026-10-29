# Phase 5 — Backend, security and operational evidence

Baseline: `feat/info-cards`, commit `4b10ba6`. Investigation only; no application changes, live database/provider access, deployment or commits.

## Progress

- Read the specification, relevant Phase 2/4 handoffs, repository/query/media/index code, disposable-database safeguards and CI workflow.
- Existing coverage already exercises immutable publication recovery/rollback, both deletion/attachment race outcomes, historical references, exact main-context snapshots, private metadata filtering, media provenance and legacy-route rejection. Do not duplicate those assertions solely to inflate test counts.
- Existing security/database suites completed: `info-cards.integration.ts`, `info-card-attachments.integration.ts`, `info-cards-api.integration.ts`, `info-cards-media.test.ts`, `protected-media.integration.ts`, `card-media-access.integration.ts`: **57/57 passed**.
- Added six narrowly scoped release checks for actual setup CLI idempotence/content preservation, duplicate-data setup failure, malformed index fail-closed/recovery, provider-gate combinations and exact-publication reauthorisation. **6/6 passed**. No production state was used.

## Operational facts established by inspection

- `scripts/setup-info-cards.ts` only creates indexes, explicitly connects through application database guards, closes the client and exits nonzero on failure. It does not migrate content.
- Required indexes cover Info roots, immutable versions/source revisions, per-creator normalised series names, media allocations and both main-card draft/historical reference paths.
- `assertIndexesReady` rejects nonunique, sparse or partial substitutes for required identity indexes; required main-reference indexes are checked before nonempty canonical reference writes. Successful readiness is cached per client/database; operational index removal while the process remains alive is not continuously polled.
- Media upload, media publication and delivery require both `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1` and `INFO_CARDS_PRIVATE_MEDIA_VERIFIED=1`. The latter is operator acknowledgement, not proof of live provider protection.
- Stream bearer grants expire at approximately one hour; ordinary in-memory grant reuse is ten minutes. Info media reauthorises the exact publication when nested media is reopened; no periodic renewal scheduler exists.
- `.github/workflows/deploy.yml` is manual-dispatch production-build verification only. It does not execute Info Card database/browser/security tests or deploy indexes/provider configuration.

## Outstanding release operations

- Verify/install application-database indexes only with explicit authorisation, after checking existing duplicate identities and the intended database/host. No live check performed here.
- Verify live R2 anonymous denial across every public/custom/Worker alias, authorised proxy delivery, CORS for `Content-Type` and `If-None-Match`, conditional create and overwrite rejection.
- Verify live Stream creator attribution, signed-only access, owner/public/private publication permissions and signed playback. Never set the verification flag based solely on mocked tests.
- Supply `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1` at the **production build** as well as in the matching runtime configuration; Next compiles public client variables into the bundle. The build/static verification work is tracked separately and does not certify live bucket/Stream settings. Keep server-side `INFO_CARDS_PRIVATE_MEDIA_VERIFIED` closed until live verification succeeds.
- Known long-pause Stream expiry and device/Safari playback remain previously documented operational limitations; no new mechanism proposed.

## Executed checks — incremental results

- **6/6 new release/security integration cases passed**: `node --import tsx --test --test-concurrency=1 tests/info-cards-release.integration.ts` (70.6 seconds). Actual setup CLI ran twice successfully against the same disposable database, with identical index definitions and unchanged existing documents. A second disposable database containing duplicate identities correctly produced a nonzero CLI exit without mutating or deleting those documents.
- New cases also prove identity-index sparse/partial/nonunique substitutes fail closed and explicit repair recovers; partial main draft/history reference indexes fail readiness; all five incomplete/disabled provider-flag combinations block upload, media publication and delivery before provider contact; exact-publication media reauthorisation continues using the old authorised asset after replacement, refuses a private-era publication and fails closed on provider token refusal.
- Scoped ESLint for the new test and `git diff --check` passed. A subsequent test-only explicit `NodeJS.ProcessEnv`/`NODE_ENV: test` annotation corrects TypeScript's Next-augmented process environment requirement; the **two actual setup CLI cases passed again** after this annotation (31.8 seconds). This two-case recheck overlaps the six-case run and is not six additional distinct tests.
- Existing six-file backend/security regression command completed **57/57 passed**, no failures/skips/cancellations, 262.0 seconds. The disposable Mongo harness emitted its known owned-child shutdown fallback warning twice, then completed successfully; this is cleanup of owned disposable processes, not a failed security assertion or a live database operation.
- Root independently ran the existing protected-media/grant unit cases; not duplicated here. **5/5 `phase8.test.ts` cases passed**, including production/mock/TLS boundary checks and offline fixture plan regressions; no migration/deployment was executed.

## Writer and production reachability audit

- Nonempty references are guarded in standalone/combined Card forks, private graph creation, direct Card draft creation, draft save and publication, within the canonical transaction. The other direct Card insert paths construct or require the exact default empty Card content, so cannot introduce unguarded nonempty references. Construction step moves retain each Card's existing reference list.
- Copy/reference-only reuse keeps canonical Card identity and immutable references; adoption changes the actor's chosen immutable version, not canonical references. Main draft/history references remain protected even when detached from any discoverable Deck.
- The consultation endpoint accepts exact main context, never client attachment IDs. Canonical reads require a public immutable version; working reads check actor membership, adopted main version and containment. Main and Info latest publications resolve in one database snapshot; row-local invalidity becomes metadata-free placeholders, infrastructure errors remain whole-request failures.
- No `src/app` route exposes the standalone Info Cards fixtures. The legacy media fixture adapter is loopback/disposable-database constrained; production database mode refuses disposable browser/media flags. No new production-reachable fixture switch was identified.

## Findings

No new confirmed backend defect from the audit or completed new tests. Successful readiness caching means indexes must not be dropped out-of-band in a running deployment; this is an operational constraint, not a newly introduced requirement or reason to add polling. CI currently provides no automated security/regression gate beyond manual build execution; enabling test execution in CI is a follow-up recommendation, not an implementation change in this run.

## Reproduction commands and coverage matrix

```sh
node --import tsx --test --test-concurrency=1 tests/info-cards.integration.ts tests/info-card-attachments.integration.ts tests/info-cards-api.integration.ts tests/info-cards-media.test.ts tests/protected-media.integration.ts tests/card-media-access.integration.ts
node --import tsx --test --test-concurrency=1 tests/info-cards-release.integration.ts
node --import tsx --test --test-name-pattern='release setup CLI' tests/info-cards-release.integration.ts
node --import tsx --test tests/phase8.test.ts
npx eslint tests/info-cards-release.integration.ts
git diff --check
```

| Contract | Fresh execution evidence | Remaining gap |
| --- | --- | --- |
| Independent creation, incomplete drafts, CAS/lost-response recovery, rollback, public permanence | `tests/info-cards.integration.ts` — 26 passed | None identified at repository/API boundary |
| Series identity, collaboration, discovery and metadata ACLs; owner-first publication order before pagination | Same 26-case file plus real API cases | Actual collection/index deployment unverified |
| All canonical writers, history, both deletion race outcomes, copies/forks/adoption, absent/empty compatibility | `tests/info-card-attachments.integration.ts` — 17 passed | Detached-draft recovery UI remains previously deferred, without weakening guards |
| Authenticated/actor-switched/injected requests, draft/public separation, generic deletion blockers, legacy route rejection | `tests/info-cards-api.integration.ts` — 6 passed | Browser/UI negative cases covered separately by root workflow run |
| Provider-ready creator/signed-only checks and conditional image-upload signing | `tests/info-cards-media.test.ts` — 2 passed | Live Cloudflare settings/delivery/CORS not verified |
| Existing canonical/public/private-era/adopted/personal media access | `tests/protected-media.integration.ts` and `tests/card-media-access.integration.ts` — 3 + 3 passed | Existing bearer lifetime trade-off retained; no claim of live playback |
| Actual setup CLI twice, duplicates fail without content mutation, malformed index guards/recovery, both provider flags, exact-publication token reauthorisation | New `tests/info-cards-release.integration.ts` — 6 passed; setup cases repeated successfully | No live database touched; no production flag enabled |
| Production database host/TLS guard and refusal of disposable media settings | `tests/phase8.test.ts` — 5 passed | Production values intentionally not inspected or changed |

This worker executed **68 distinct tests, all passing**, plus the overlapping two-case CLI recheck. The root report must not add the repeat as two new distinct cases. All created/modified files owned by this worker are `tests/info-cards-release.integration.ts` and this testing evidence note. No application implementation, functional specification, engineering plan, environment configuration, live indexes or provider settings changed.

## Follow-up: existing operator runbooks and bounded harness check

Existing release instructions, not newly invented deployment tooling:

- [Phase 2 provider security and deployment gate](../phase-2/README.md#provider-security-and-deployment-gate) records the actual supported setup command: `node --env-file=.env.local --import tsx scripts/setup-info-cards.ts`. This **writes indexes** and requires approval of the exact environment/database; it is not a read-only verification command. The script has no `--verify`, `--dry-run` or `--confirm` options. No such flags should be invented in the main checklist. `assertIndexesReady(true)` is the existing read-only programmatic gate, not an existing deployment CLI.
- [Vercel production preparation](../../../phase-8-preparation.md#vercel-preparation) lists required environment names, guarded production database mode, strong session signing secret, Node 22, protected-media build flag and forbidden disposable flags. This historical runbook contains earlier migration commands: **do not rerun that completed migration** for Info Cards; only the additive Info Card index setup is relevant.
- [Media preparation and outstanding provider approval](../../../phase-8-preparation.md#media-preparation-and-outstanding-provider-approval) explains direct old-origin exposure, shared-bucket/other-site checks and authorisation before changing R2/Stream settings. It links the original Cloudflare configuration documentation. No supported repository command currently certifies the live provider configuration. Operator checks must cover every actual R2 alias/Worker/custom origin and signed-only Stream playback; do not infer success from a build or gate flag.
- [Current system media behaviour](../../../system-behaviour.md) records one-hour bearer expiry and authenticated R2 proxy delivery. Existing direct origin protection remains an operator responsibility, not automatically established by the proxy.

**Fresh bounded harness check:** `node --import tsx --test tests/presentation-foundation.test.ts` exits 1 in approximately 0.6 seconds, before its nine named test bodies register/run. Importing `FocusedCardView` reaches `InfoCardPouch.module.css:1`; the bare Node/tsx loader parses `.pouch[type="button"]` as JavaScript and throws `SyntaxError: Unexpected token '.'`. The test runner reports one file-level `ERR_TEST_FAILURE`. This reproduces the previously documented CSS-loader limitation, not an application assertion failure or a demonstrated browser regression. No attempted workaround, framework, loader, source change or repeated investigation was made. Existing real Next/component-browser presentation checks and production-build checks remain separate passing evidence; this failed unit-file entry must not be described as nine passing/skipped tests.

The earlier passing total remained **68 distinct completed assertions**; the original file-load failure is historical failed-run evidence, not nine assertion failures. No further live requests or provider/database operations were run for this follow-up.

### Narrow test-only harness repair and recheck

The root subsequently authorised a bounded repair of this existing test harness. `tests/presentation-foundation.test.ts` now imports its four CSS-dependent components in a `before` hook while a test-process-local `.css` require hook supplies empty exports. The original loader hook is restored in `finally` before assertions execute. Existing nine assertion bodies are unchanged. A comment explicitly limits the evidence to **server-rendered structure**, not styling/layout; real-browser checks remain responsible for CSS and geometry. No shared loader/framework or application change was added.

Fresh rerun: `node --import tsx --test tests/presentation-foundation.test.ts` — **9/9 passed**, zero skips/cancellations, approximately 0.8 seconds. Together with this worker's earlier runs, there are now **77 distinct completed passing cases**, plus the two overlapping CLI recheck cases. Preserve the original one file-load failure as a corrected harness failure, not an unresolved application defect. `npx tsc --noEmit --incremental false`, `npx eslint tests/presentation-foundation.test.ts tests/info-cards-release.integration.ts` and `git diff --check` all passed after the repair.

Final worker-owned change inventory: `tests/info-cards-release.integration.ts` (new six-case release checks), `tests/presentation-foundation.test.ts` (existing SSR-only test loader repair) and this evidence note. No production implementation file changed.
