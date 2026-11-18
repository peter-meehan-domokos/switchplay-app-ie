# Puckle membership — Phase 8 final verification

16 November 2026, `site/puckle`. Final verification of Phases 1–7 and the committed welcome/publishing refinements. The interrupted work was preserved in `36fc250`; this completion commit follows it without rewriting history.

## Assessment

**Pass with outstanding launch prerequisites.** Membership is technically ready for branch integration and launch preparation. No unresolved implementation regression remains in the checks run. Public launch remains separately authorised and requires real email delivery and the safeguarding/privacy decisions below.

## Review and fixes

Read the design, engineering plan, independent review, phase completion/handoff records and backfill manifest; checked current source and history rather than treating historical completion records as current instructions.

Two confirmed defects were reproduced and fixed:

- **Welcome acknowledgement before display:** the host previously acknowledged a welcome while its lazy view was suspended, including when the chunk could not load. Acknowledgement now comes from the committed view. Production browser tests delay or abort the actual view chunk and check that `seenAt` remains absent until the welcome renders; application navigation remains usable on failure.
- **Approval history using the wrong explanation:** decision, withdrawal, operator revocation and renewal events previously copied the current deployment's disclosure, even when the guardian saw a previously issued version. They now retain the record's actual explanation/version. A disposable integration test exercises approval, decline, withdrawal, revocation and renewal across that version difference, also checking unrelated account/learning fields remain unchanged.

Runtime edits are confined to `src/components/onboarding/Onboarding.tsx`, `OnboardingHost.tsx` and `src/lib/parentalApproval.ts`. No learning model, permission policy, authentication contract or group experience enforcement was changed.

Added production mode to `scripts/test-phase2.ts`: it builds with the installed Next.js and runs `next start`, always with its own disposable replica set, local captured mail and fixture sender/origins. Production registration is enabled only in that child test environment. No live configuration is read as a database target or changed.

Two existing browser tests needed timing corrections: install the delayed onboarding response before the first navigation (otherwise the welcome may already have been acknowledged), and measure welcome duration from its recorded presentation event rather than a later Playwright assertion. The new mobile fixture now uses populated published steps and ordinary UUID content identifiers, and explicitly checks the completion-save response before verifying persisted progress. Production cookie assertions use browser fetch: Chromium honours Secure cookies on loopback, whereas Playwright's API-only cookie jar does not. Cookie security was not weakened.

## Verification evidence

- Full unit suite: `npm run test:unit` — **532 passed**, zero failed/skipped.
- Full integration suite: `npm run test:integration` — **444 passed**, zero failed/skipped; disposable MongoDB only. Covers account/proof/profile atomicity, uniqueness, age/course/contact validation, legacy credentials and reset races, approval lifecycle, publishing/revocation/Copy concurrency, learning/progress, media and backfill preservation.
- Focused approval lifecycle: `node --import tsx --test tests/parental-approval.integration.ts` — **16 passed**. The added history test first failed against the old code, then passed after the correction; its final renewal assertions are also covered by the full integration run.
- Initial development browser batch: **81 passed** across Join, tuition, parental approval, onboarding, welcome refinements, backfill regression, publishing permissions, Creator visibility, Card reuse and progress.
- Additional development browser runs: **31 passed** (Info Card authoring and security/recovery) and **4 passed** (private learning, media, swipe/flip and mobile Creator).
- Production browser verification: **24 distinct tests passed**. The combined final run passed 22/24; the two new learning fixtures needed valid published content/identifiers and were affected by overlapping trace-output cleanup. A subsequent isolated `membership-final.browser.ts` run passed all **6**, including both corrected 320px/390px checks. The other 18 production onboarding/welcome tests passed in the combined run. No failed assertion was removed.
- `npm run typecheck`: passed. Production `next build` also passed its TypeScript check after the final test edits.
- `npm run lint`: passed with **0 errors / 6 existing warnings**; targeted ESLint on the final edited tests also passed. `git diff --check`: passed.
- Browser fixtures and provider captures are disposable. No real-provider, deployment, physical Android or combined group experience E2E result is claimed.

Production comparison uses an isolated archive of pre-membership commit `c76b8d3`; no branch was checked out or modified. The baseline used Next's supported webpack build because Turbopack rejects its external `node_modules` symlink; the candidate uses the default Turbopack production build. All **98 pre-existing routes retain their classification**. This comparison establishes route classification/cache behaviour, not bundler performance equivalence. Both anonymous home/contact/privacy responses are private/no-store; `/step-visuals` is static with `x-nextjs-cache: HIT` and `s-maxage=31536000`. The new recovery request page is an additional static route.

The client host remains a sibling under synchronous RootLayout, with no server authentication lookup. Browser checks cover retained DOM nodes/no learning DOM mutations during onboarding edits/dismissal, identity changes, preserved guardian drafts on focus, failures, delayed welcome, reminder dismissal and mobile-width presentation. DOM observations plus the sibling architecture support isolation; no React Profiler render-count benchmark or physical Android testing is claimed. The user has already performed initial physical iPhone testing.

## Compatibility and integration handover

Reviewed current user writes and read-only snapshots of `main` (`69a4bc6`), `feat/group-experience` (`a859683`) and `merge/main-into-group-experience` (`20c7d67`). No whole-user replacement path was found in the inspected application code. Learning writes target their own arrays/fields; shared optional safeguarding, permissions and session fields can coexist. New accounts initialise the arrays those readers require. Student/teacher is profile category, not an elevated role.

Concrete merge risks:

- Group integration's login route still uses `authenticateUser` followed by `setSession`. Preserve this branch's `signInWithPassword` credential-snapshot/session-version binding while integrating `visualGuestLoginContext` and its response/cache additions. Reverting to the old sequence would break recovery security/compatibility.
- Combine `AuthScreen` group/visual-login handoffs and working-store cleanup with membership auth notifications and the recovery link. Retain both logout cleanup paths and notifications.
- Preserve transactional publishing guards in the substantially changed Card/Deck and Info Card repositories, including Copy and subsequent public versions. Group reads of existing public content must not acquire a public-publishing requirement.
- Preserve the root client sibling and review Group dialogs/perspective transitions against onboarding's exact route/presentation checks. Group member `isAdmin`, account `isAdmin`, public publishing and parental approval remain separate concepts.

After integration, rerun auth/reset/version races, permission/revocation/Copy tests, personal and group learning/progress/media tests, and shared account preservation. Manually check login/logout/account changes, group selection/perspectives and dialogs with welcome/reminders on iPhone. Separate safeguarding work must enforce under-16 approval across group entry points, handle withdrawal/age transitions and unknown or teacher-declared ages before those group capabilities are exposed. Full combined Group E2E is deferred and is not a prerequisite for completing this membership verification.

## Launch prerequisites and remaining decisions

1. **Real email:** configure verified `ACCOUNT_EMAIL_<SITE>_FROM` and canonical HTTPS `ACCOUNT_EMAIL_<SITE>_ORIGIN` for each enabled site, reviewed optional `_ALLOWED_ORIGINS`, `RESEND_API_KEY`, `ACCOUNT_EMAIL_SECRET` (at least 32 bytes), and `PUCKLE_FOUNDER_EMAIL`. Preserve the existing `SESSION_SECRET`. Disable provider open/click tracking before setting `ACCOUNT_EMAIL_TRACKING_DISABLED=1`. Do not deploy `ACCOUNT_EMAIL_TEST_ENDPOINT` or LAN-review overrides. Enable `ACCOUNT_TRUST_PROXY_IP=1` only with an ingress that overwrites forwarded IP headers. Confirm hosting supports the bounded Next `after()` callback.
2. **Real-delivery smoke test, separately authorised:** use controlled addresses to verify inbox arrival, correct sender/origin and unmodified fragment links for verification, reset, parent request and withdrawal management; complete each explicit action, replay/expiry checks and founder notification. Confirm saved submissions survive delivery failure and the founder can retrieve pending/failed/unknown records. Local capture proves flow logic, not provider/inbox delivery.
3. **Safeguarding/privacy acceptance:** `parentalApprovalScope.ts` still contains `shared-group-experiences-v1-draft`. Approve actual cross-site group visibility/sharing wording and version before real parental requests; confirm the already agreed children's privacy/legal review, evidence-retention/correction criteria and human under-18 tuition-permission process. Group enforcement remains separate.
4. **Explicit approval still required:** unused `src/app/api/users/route.ts` still allows any authenticated account to enumerate usernames/IDs. Earlier instructions expressly withheld permission to remove it. No current source caller was found. Resolve removal or a narrowly justified restriction before public signup; it was left untouched here.

The production migration is **complete**, per the user's 15 November report: all 11 accounts processed, no remaining dry-run work, logical backup restored and independently checked. Older Phase 7/handoff statements saying live execution is outstanding are historical. No production migration, backup, database assessment or permission assignment was repeated. The manifest's old blanket statement excluding `isAdmin` is superseded by `d82b1f5` and its explicit reviewed disposition support.

(Superseded: the `PUCKLE_JOIN_ENABLED` flag was removed; Join is always enabled, so merge to `main` only when ready to accept students.) Phase 8 does not authorise deployment or live configuration changes.

## Final scope

Only disposable tests and read-only branch inspection were used. No live data or email, other-branch edits, merge, push or deployment. The completion commit contains the final test corrections and this report; the two runtime fixes and initial regression additions are already preserved in `36fc250`.

## Reproducible browser commands

```sh
npm run test:phase2 -- puckle-join.browser.ts puckle-tuition.browser.ts parental-approval.browser.ts onboarding.browser.ts welcome-polish.browser.ts backfill-regression.browser.ts public-publishing-permissions.browser.ts creator-visibility.browser.ts card-reuse.browser.ts progress.browser.ts
npm run test:phase2 -- --production membership-final.browser.ts onboarding.browser.ts welcome-polish.browser.ts
npm run test:phase2 -- --info-cards info-cards-authoring.browser.ts membership-security.browser.ts
npm run test:phase2 -- private-deck.browser.ts
```

Run all browser commands sequentially: production and development runs also share the Playwright trace-output directory. The two development commands additionally share their Next build directory; keep password-reset security tests separate from the private Deck suite, which uses the original fixture password. An initial combined batch was deliberately interrupted to avoid that known fixture dependency; an overlapping development start hit the build-directory lock and is not an application failure.

## Post-Phase 8: email branch merged (17 November 2026)

`site/puckle-email` (`3ce543a`) was merged into `site/puckle` in merge commit `3df6e71`. It adds real email through Resend (`docs/engineering/sites/puckle/membership-email-delivery.md` is the setup and production guide), founder alerts, the optional parent mobile and phone-only contact route, Reply-To `support@puckleup.com`, Puckle branding with the `puckleup.com` domain mapping and addresses, the shorter welcome without its button, and the `--real-email` review mode.

**Parental withdrawal was removed intentionally.** The guardian withdrawal link, its management email and `withdrawParentalApproval` no longer exist. Statements above about withdrawal (the explanation-retention fix and the real-delivery smoke test of "withdrawal management") are historical. Parents currently withdraw by replying to the approval email or writing to `support@puckleup.com`, and the founder records it with `revokeParentalApprovalAsOperator`. The product owner will add a withdrawal UI component before public launch. The parent explanation is now `shared-group-experiences-v4-draft` (not `v1-draft`) and still needs approval before real parental requests.

Conflict decisions worth keeping:
- Explanation retention (Phase 8) is kept on approve, decline, operator revoke and resend events. Only the withdrawal path was dropped.
- Onboarding keeps both `welcomePresented` (acknowledge only once the lazy view has rendered) and `setPhoneDraft` (parent mobile).
- `scripts/test-phase2.ts` keeps `--production` and `--real-email` and refuses to combine them.
- Welcome timing tests measure from the first rendered phase and assert the intended 0.5 s in + 4 s readable + 0.5 s out (4 s with reduced motion).

Corrections found during combined verification (both also present on `b649649`, not merge regressions):
- `dc8bbd8`: in production builds the Join page scrolled sideways on a 390 px phone because `.field input { width: 100% }` and `.checkbox input` had equal specificity and production reverses the CSS load order; the "Show password" checkbox rule is now more specific. Phase 8 never ran Join in production mode; dev mode (used for iPhone review) never showed it.
- `f5200d6`: the slow-connection onboarding test clicked during the "Loading Library…" fallback, before the host's listeners attached (2/4 failures on `b649649` in production); it now clicks once the Library has rendered, still before the delayed status.

Verification on the merged branch: typecheck and lint (0 errors) clean; 553 unit and 449 integration tests (including shared-membership, public-publishing-permissions and onboarding-status group experience compatibility) pass; production mode `membership-final`, onboarding and welcome 25/25; dev suites for Join, tuition, welcome, onboarding, parental approval, Library, deck menu and creator navigation pass; `info-cards-authoring` + `membership-security` 31/31 and `private-deck` + `public-publishing-permissions` 19/19 in their own commands. Join and parental approval are dev-mode only: under `--production`, Playwright's API-only cookie jar does not send Secure cookies on loopback, so their `page.request` calls get `401` (noted in `membership-final.browser.ts`).

Known, non-merge test failures:
- `area-navigation.browser.ts` "Creator retains Progress return context": the Progress return was removed deliberately in `79ce232` (24 October); the test was never updated. Unrelated to membership or email.
- Login throttling makes runs order-dependent: `membership-security.browser.ts` deliberately submits wrong passwords for the shared `phase2` user, so suites run after it in the same command that log in as `phase2` (for example `private-deck`, `public-publishing-permissions`) get `401`. They pass in their own command. Keep the security suite in a separate command, as in the commands above.
