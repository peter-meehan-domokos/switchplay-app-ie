# Info Cards Phase 2 — implementation handoff

Status: backend implemented and acceptance checks completed, subject to the provider-verification gate below. No commit made. Phases 3/4 are excluded. Functional specification and Phase 1 components/styles are unchanged.

The engineering plan's eight readiness amendments have been applied. The functional specification and completed prototype are unchanged.

## Acceptance checkpoints

| Checkpoint | Implemented and tested |
| --- | --- |
| Domain/indexes | Independent info roots, immutable publications, collaborative series; owner-associated stable IDs; compound creator/normalised-title uniqueness under concurrent creation. Explicit index setup, with fail-closed API readiness check. |
| Drafts/recovery | Empty/incomplete and overflow drafts are saveable. Caller-stable creation, owner-only reads/writes, revision conflicts, exact save retry, independent owner draft listing, and clearing a reverted clean draft. No deck or personal-progress records are created. |
| Publication | Valid title/body/series and measured capacity required. Immutable insert and root/draft update commit together; consumed authoring revision provides lost-response recovery without duplicate publication or overwriting a newer draft. Public visibility cannot revert. Provider checks happen before the transaction, and the revision is checked again inside it. |
| Queries/permissions | Public plus owner-private catalogue, published-only search, creator usernames, series grouping/order, own series first, current-public-only foreign discovery and retained selection in an authorised contributor editor. No draft/private-member counts or hidden names in public responses. Ordered, coherent publication snapshots. |
| Deletion/references | Owner/revision checks, all retained main drafts/history scanned, shared reference guard, both attach/delete race orders, failure rollback. Deleted IDs stay reserved without content or publications. |
| Media | Owner/target/asset upload proofs, exact draft revision or publication authorisation, private-era protection after promotion, expiry/forgery tests, late provider completion checks, scoped R2 keys and signed create-only uploads, Stream creator/signed-playback/readiness checks. Legacy media routes cannot grant access through forged references to registered info assets. **Real provider configuration/delivery is not verified.** |

No Creator/Library UI, main-card attachment field integration, production pouch fetching, adoption change, live database update, provider configuration change or asset deletion was performed.

## Files and responsibilities

New backend domain:

- `src/lib/infoCards/model.ts`: root/draft/publication/series/media/snapshot types.
- `domain.ts`: strict content/ID/visibility validation, name normalisation, absent/empty attachment equivalence.
- `capacity.ts`: shared deterministic measured layout validator and actionable overflow issues.
- `repository.ts`: explicit indexes, draft/publication/recovery, series eligibility, guarded references and deletion.
- `queries.ts`: owner editor, catalogue, discoverable series, exact ordered publication snapshots.
- `media.ts`: upload allocation/proofs, readiness, exact-context authorisation and delivery.
- `mediaRegistry.ts`: durable asset provenance and exclusion from legacy media grants.
- `http.ts`: existing authenticated Creator boundary, actor checks, private/no-store responses and structured capacity/deletion errors.

New API routes are listed below. `scripts/setup-info-cards.ts` supplies explicit index setup. No index creation occurs on import.

Narrow existing-file changes:

- `src/lib/cloudflareR2.ts`: independent owner/info-card upload namespace, signed conditional PUT, and object provenance/readiness verification; existing upload helpers unchanged.
- `src/lib/cards/protectedMedia.ts`: excludes info assets from broad and exact-main playback authorisation.
- `src/lib/cardMediaAccess.ts`: excludes info assets from personal playback/download/file access.
- `src/lib/cards/libraryMedia.ts` and `src/app/api/media/stream/status/route.ts`: exclude info assets from legacy status metadata reads.
- Engineering plan: eight readiness amendments plus the implemented ID-reservation/provenance safeguards.

New tests: `tests/info-cards.integration.ts`, `tests/info-cards-api.integration.ts`, `tests/info-cards-capacity.test.ts`, `tests/info-cards-media.test.ts`, `tests/browser/info-cards-capacity.browser.ts`, and `playwright.info-cards-capacity.config.ts`.

## Backend contracts for Phase 3

All routes require the existing authenticated session. Creator requests can bind `X-Creator-Actor`; Library requests can bind `X-Library-Viewer`. A mismatch is rejected. Responses, including errors, are private/no-store and vary by Cookie. Do not treat a delayed response as belonging to a newly signed-in actor.

| Route | Contract |
| --- | --- |
| `POST /api/info-cards` | `{infoCardId}` with a stable caller-generated ID. Creates an empty private draft; retry returns the same untouched initial record. A changed/foreign/retired ID conflicts. |
| `GET /api/info-cards?offset=0&limit=30` | Owner's outstanding drafts directly, including unpublished and dirty-published records, independent of attachments/decks. `{items,nextOffset}`. |
| `GET /api/info-cards/:id` | Owner-only `{root,publication,selectedSeries}`. Retains authorised contributor attribution even if the foreign series is no longer generally discoverable. |
| `PATCH /api/info-cards/:id` | `{revision,content,visibility,mediaProof?}`. Full draft content is `{title,body,seriesId,mediaItem}`; blank strings/null series/null media allowed. Visibility is explicit. Returns saved root. |
| `POST /api/info-cards/:id/publish` | `{revision}`. Returns the immutable publication. Retrying the consumed revision returns its original publication even if newer edits/publications now exist; refresh the editor separately. |
| `GET /api/info-cards/:id/publication` | Latest authorised published DTO only. No user-facing history query. Includes publication number and attributed series metadata. |
| `GET /api/library/info-cards` | Public and own-private publications, ordered by series/name/identity, never drafts. `search`, `seriesId`, `offset`, `limit` (1–50). Search title, series and creator usernames. |
| `GET /api/info-card-series` | Searchable own-created or currently public-discoverable series. Own first, others alphabetically. `search`, `offset`, `limit`. |
| `POST /api/info-card-series` | `{seriesId,title}`. NFKC, whitespace normalisation and lowercase matching; reuse same creator's normalised match. Different creators' matches remain separate. |
| `DELETE /api/info-cards/:id` | `{revision}`. Refusal gives `{blockers:{draft,historical}}` without foreign titles/IDs/counts. Successful exact retry is safe. |
| `POST /api/info-cards/:id/upload` | `{kind:"image",contentType}` or `{kind:"video"}` after saving identity. Returns provider upload URL, media descriptor, target-bound proof and required image headers. Provider verification gate applies. |
| `GET /api/info-cards/:id/media?revision=N` | Owner preview of the exact current draft revision and stored asset. |
| `GET /api/info-cards/:id/media?version=N` | Media for an exact immutable authorised publication. Image bytes or a Stream playback descriptor; renewing never switches to latest publication. |

UI integration should use `measureInfoCapacity` with the actual selected series title and the approved `InfoCardFace` preview. A 422 capacity response contains measured dimensions and understandable issues. Save drafts even when invalid; do not discard them on publication failure. A 409 revision conflict requires refresh/reconciliation, not blind overwrite. The draft content ceiling is a storage/transport safeguard, not a publication character budget.

Simple offset pagination is adequate at current scale. Concurrent publications may shift pages; Phase 3 should deduplicate by stable ID and refresh on explicit reload. No private totals are exposed. Reuse the existing media upload progress/retry pattern in Phase 3; the new routes do not add an upload queue UI or provider polling UI.

## Capacity evidence

The validator uses rounded-up Arial glyph advances measured in Chromium, word/anywhere wrapping, explicit newlines, paragraph spacing, optional media reservation and combined header width. Unknown glyphs reserve a conservative two ems; this can reject text which a particular font would fit. Control characters are reported explicitly. No client `fits` flag or publication-time browser service is trusted.

The unchanged face is **240×157 layout pixels**, with 12px padding, 214px content width, 186px header budget after Close reservation, 9.5px body/11.875px line height, 7px paragraph gap and 36px optional media reservation. Browser checks found the series button makes the header slightly taller than the body's nominal line box; the validator reserves 12.125px for it.

At 360×780, 390×844 and 430×932, the measured media-present body budget is approximately **74.016 layout pixels**; the server conservatively allows **73.875**. The approved maths example uses **five lines/two paragraphs, 66.375px**, and passes. The basketball example uses **four lines/two paragraphs, 54.5px**, and passes. The long combined header requires about 300px and fails; the repeated body uses 359.875px and fails. No typography or Phase 1 CSS was changed.

The browser suite compares the actual existing fixture/face with server predictions, including no-media space, long headers/bodies, Unicode, explicit breaks, narrow/wide words, preserved spaces and every ASCII glyph in regular/bold Arial. Detailed runtime attachments are in the OS temporary `switchplay-info-capacity-report.json`. This is Chromium evidence, not new iPhone/Safari/font-fallback certification; keep matching Creator preview and later device checks.

## Reference and deletion integration requirements for Phase 4

1. Introduce optional ordered `infoCardIds` into `CardContent`, strict validators and every projection/save/fork path. Use `infoReferences`/`sameInfoReferences` so absent and `[]` mean the same thing; do not rewrite immutable historical content.
2. Derive the main-card ownership/content/version context server-side. For working pouch reads verify the actor's adopted main version; canonical previews must verify published main access. Never accept arbitrary caller IDs as proof of attachment authority.
3. In the same Mongo snapshot/session, read the authorised main references then call `publishedSnapshot(repo,actor,ids,session)`. Preserve the returned DTO/media publication until close. New openings request fresh data. The current single-item publication endpoint is catalogue access, not a production pouch endpoint.
4. Every main create, draft-save, graph-create, fork and publication that writes attachment references must call `guardReferences` inside its existing transaction before its canonical write. `withReferences` is a convenience transaction wrapper. Lock info IDs in sorted order before affected main/deck writes. Draft saves validate published selection eligibility using `private`; public main publication must pass `public`. This permits staging an own-private attachment while preventing public publication of it.
5. Audit `createPrivateGraph`, `createCardDraft`, create-and-attach, `saveCardDraft`, card/deck fork helpers and `publishCard`. Copying an existing owned main root into another deck adds no new main content but must preserve its stable reference identity. Deck publication pins published main versions; Creator's separate publish-and-leave sequence is not an atomic graph publish.
6. Do not enable attachment writes until all writers participate. Tests must extend the current guarded fixture races to those real entry points. The current main validator rejects the new field, so Phase 2 exposes no unguarded production attachment writer.

Deletion scans all retained main drafts and publications, including detached drafts and old versions. Detaching from a deck or removing only the latest attachment does not remove historical blockers. DRAFT-1 remains deferred; no recovery UI or silent cleanup was introduced. A deleted root retains only identity/owner/revision/visibility/timestamps and guard metadata with null content, so it cannot be recreated under an old publication address. No provider assets or series are automatically deleted.

## Provider security and deployment gate

**No real Cloudflare account/bucket access controls, anonymous URLs, CORS policy or real provider uploads were tested. Private media delivery is not certified.** The deployment variable `INFO_CARDS_PRIVATE_MEDIA_VERIFIED=1` is an explicit operator acknowledgement, not automatic verification. Until it and `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1` are set, new info uploads, publication with media and media delivery fail closed. Text-only authoring/publishing remains usable after index setup.

Before enabling media:

- Verify canonical R2 objects cannot be read anonymously through **any** configured public/custom/Worker origin, including aliases. If the shared canonical bucket is still public, leave the gate off and arrange protected storage/delivery before rollout.
- Verify R2 CORS accepts the returned `Content-Type` and `If-None-Match` headers, the first signed PUT succeeds and repeat writes fail. The latter uses Cloudflare's documented atomic [conditional PutObject](https://developers.cloudflare.com/r2/api/s3/extensions/) behaviour; automated tests verify the signed request, not the live bucket.
- Exercise Stream allocation, owner attribution, processing and signed playback. Publication checks the documented `creator`, `readyToStream` and `requireSignedURLs` fields in [video details](https://developers.cloudflare.com/api/resources/stream/methods/get/). Verify anonymous UID playback/thumbnail/download access is denied.
- Test owner/private/foreign/public/private-era access, expired-session access and renewal of the exact consulted publication with real assets. Existing Stream grants are one-hour bearer URLs; logout does not instantly revoke an already-issued token.

`infoCardMediaAssets` stores server-issued provider identities before returning upload credentials/proofs. This prevents a malicious creator copying a private info asset ID into an older main/personal record and using the old routes to mint a grant. The registry is retained after info deletion. It is not an asset-management UI or a reverse main-attachment index. Failed allocation/transfer may leave a private orphan provider asset; safe garbage collection remains deferred.

Explicit index setup, in a separately reviewed intended environment:

```sh
node --env-file=.env.local --import tsx scripts/setup-info-cards.ts
```

This creates indexes only. Existing database safety guards apply. It was exercised through the disposable test setup, **not run against the application's live database**. Restart application processes after index/schema deployment changes; readiness is cached per client/database after successful verification.

## Tests and results

- Combined Info Cards/backend regression command below: **74 passed** (36 new feature tests plus 38 existing publication, reuse, visibility and media tests).
- Final focused rerun after ID/media-identity validation tightening: **34 passed** (Info Cards repository, capacity, media and existing protected-media tests; overlaps the combined suite).
- `tests/library-read-models.integration.ts`: **15 passed**.
- New browser capacity suite: **5 passed**, including no-media space and every measured ASCII glyph.
- Existing `playwright.info-cards.config.ts`: **9 passed**.
- `next typegen`, TypeScript no-emit and scoped ESLint: passed; final checks repeated after documentation/test completion.
- Full `npm run test:unit`: **377 passed, 1 failed**. `tests/presentation-foundation.test.ts` fails at import with `SyntaxError: Unexpected token '.'` in `InfoCardPouch.module.css`; Node's test loader does not handle that existing CSS-module import. The test and component graph are unchanged from HEAD. This pre-existing harness issue was reproduced separately and left outside Phase 2 scope. It is not a passing full-unit run.
- Initial sandbox runs could not bind Mongo ports/start Chromium; successful runs used the permitted outside-sandbox local execution context. An initial browser selector error and the 0.11px header-height assumption were corrected before successful comparison.
- No WebKit retry, new manual iPhone test, live provider smoke test or full production Next build is claimed. No Phase 1B/1C component was modified; the full motion/lifecycle browser suite was not rerun for these backend changes.

```sh
node --import tsx --test --test-concurrency=1 \
  tests/info-cards.integration.ts tests/info-cards-api.integration.ts \
  tests/info-cards-capacity.test.ts tests/info-cards-media.test.ts \
  tests/protected-media.integration.ts tests/card-media-access.integration.ts \
  tests/card-foundation.integration.ts tests/creator-visibility.integration.ts \
  tests/card-reuse.integration.ts
node --import tsx --test tests/library-read-models.integration.ts
npx playwright test -c playwright.info-cards-capacity.config.ts
npx playwright test -c playwright.info-cards.config.ts
```

Integration tests start their own `MongoMemoryReplSet`; they cannot fall back to an environment/Atlas database. Real route tests substitute only session identity and the disposable database boundary; permission, validation, repository and response handling remain real. Provider tests use explicit stubs/fake credentials or local signing only. Deterministic barriers cover attach/delete order, coherent snapshot reads and pending provider completion; injected transaction failure covers rollback after writes.

## Remaining work

- **Phase 3:** Creator mode/editor/preview, reliable media upload/retry UX, independent My Drafts presentation and static Library tab using these contracts. Resolve the real provider gate before enabling private uploads.
- **Phase 4:** main attachment persistence/round trips, all canonical writer guards, public-main publication checks, authorised main-context snapshot endpoint, production pouch fetching and publication-bound media delivery adapters. Preserve Phase 1's pinned consultation lifecycle.
- **Phase 5:** combined live-provider/device/regression acceptance, including Safari and exceptional layout/font behaviour. Address the existing CSS-loader unit-harness failure in a separate test-maintenance change.

No unresolved product decision was discovered. Provider verification and later-phase integration remain explicit release prerequisites, not completed acceptance claims.
