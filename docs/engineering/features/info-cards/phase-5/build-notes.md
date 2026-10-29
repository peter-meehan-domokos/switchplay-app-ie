# Phase 5 — Static analysis and isolated production build

Status: completed; baseline `feat/info-cards` at `4b10ba6`.

Scope: TypeScript, focused ESLint, an actual optimised Next.js production build in a temporary copy, and read-only CI/build configuration review. No application/configuration edits, live database access, deployment or animation-timing repetition. An initial working-directory error loaded the repository environment before that build was stopped; the execution correction and explicit database overrides are recorded below.

## Baseline and method

- Worktree was clean when this investigation started.
- Read root `AGENTS.md` and installed Next CLI/ESLint guidance before taking build actions.
- Installed application dependencies: Next 16.2.6, React 19.2.4, Playwright 1.58.1.
- Build copy will exclude `.env*`, `.git`, existing generated outputs and live credentials. Existing `node_modules` will be symlinked read-only; copied application source/configuration remains unmodified.
- Existing review servers and `.next-phase2*` outputs are not changed by these checks. See the execution correction below concerning generated root `.next` artifacts.

## Completed observations

- `npm run build` invokes the normal `next build` (Turbopack default in this installed Next version).
- `.github/workflows/deploy.yml` is a manually dispatched, Node 22 production-build check; it runs `npm ci` and `npm run build`, supplying empty MongoDB settings. It does **not** automatically run tests, TypeScript as a separate command, or ESLint.
- `vercel.json` selects Next.js and runs `npm ci` / `npm run build`; no deployment was attempted.
- Installed Next 16 documentation confirms production builds no longer provide an ESLint substitute, so focused ESLint is run independently.

## Execution record

- Runtime versions: Node v22.14.0, npm 10.9.2, Next 16.2.6, React 19.2.4, TypeScript 5.9.3, ESLint 9.39.4, Playwright 1.58.1.
- TypeScript: `npx tsc --noEmit --incremental false` **passed**. Unlike the package `typecheck` helper, this command does not remove/rewrite current Next-generated route directories.
- Focused ESLint: **passed, zero warnings/errors** for 53 Info Card/attachment source, route, setup-script and test files, plus a separate pass of all 46 script files changed by the Phase 4 commit. Both inventories were restricted to `.ts/.tsx/.mjs/.cjs`. The initial overly broad file list also supplied six CSS modules; ESLint reported them as ignored (zero code errors), so the command was rerun with script files only.
- Isolated copy: `/private/tmp/switchplay-phase5-build.QSDcBI`; copied `src`, `public`, package manifests and normal build/config files; existing `node_modules` symlink only; no `.env*` or `.git` copied.
- Normal `npm run build` in the isolated copy **could not run with Turbopack** because its dependency symlink points outside its inferred filesystem root. This is a confirmed isolated-harness limitation, not an application compilation failure.
- The documented `npm run build -- --webpack` **passed**, including compilation (20.4 seconds), integrated TypeScript (11.0 seconds), all 41 static-page generation tasks, optimization and trace generation. The first sandboxed attempt could not resolve `fonts.googleapis.com` for the existing Space Grotesk font; the same command passed with approved network access. No font configuration was changed or mocked.
- First passing build supplied `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=0` and `INFO_CARDS_PRIVATE_MEDIA_VERIFIED=0` in disposable mode. The second optimized build **also passed** with the protected-media client flag enabled (`1`) while provider verification remained closed (`0`): compilation 12.4 seconds, integrated TypeScript 12.6 seconds, all 41 static-page generation tasks, optimization and build traces completed. Final isolated build ID: `mc6WMDp8-0Hrp6pZuylBJ`.
- MongoDB settings remained explicitly empty, no provider credentials were supplied, and these are build checks rather than production media acceptance. Production must supply `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1` at **build time** as well as the required server configuration; live verification is still outstanding and provider verification must not be enabled merely to pass a build.
- `npm ls --depth=0` passed: declared top-level packages are present with no missing/invalid dependency report. It listed five local extraneous WASM helper packages; no dependency change or fresh installation was attempted. CI's fresh `npm ci` path remains a separate deployment-environment check.
- Final `git diff --check` passed. No tracked application, scripts, package manifests or Next configuration changes were produced. Other agents' test changes are separate from this work.

Exact isolated build invocation (working directory `/private/tmp/switchplay-phase5-build.QSDcBI`):

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" NEXT_TELEMETRY_DISABLED=1 CI=1 NODE_ENV=production SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=0 INFO_CARDS_PRIVATE_MEDIA_VERIFIED=0 npm run build -- --webpack
```

Focused lint commands (working directory is the repository):

```sh
rg --files src tests scripts | rg '(infoCards/|components/info-cards/|components/creator/(InfoCardAttachments|creatorPublicationPresentation)|app/api/info-card|app/api/library/info-card|card-templates/\[cardTemplateId\]/info-cards|tests/(info-card|creator-info-attachments)|tests/phase2/info-card|scripts/setup-info-cards)' | rg '\.(ts|tsx|mjs|cjs)$' | xargs npx eslint
git diff-tree --no-commit-id --name-only -r 4b10ba6 | rg '\.(ts|tsx|cjs|mjs)$' | xargs npx eslint
```

### Execution correction and safeguards

The first shell command copied files successfully but then mistakenly invoked the build from the repository working directory rather than the temporary directory. That attempt reported loading `.env.local`; its process environment explicitly supplied **empty** `MONGODB_URI` / `MONGODB_DB`, disposable database mode, disabled private-media verification and telemetry, overriding database settings. It was stopped by terminating only its identified build processes (PIDs 11224/11207), before any build completion. No database request was made or production data accessed. No environment contents were printed or copied.

The attempt created/updated generated root `.next/package.json` (timestamp 2026-10-24 18:41:43); it did not modify the tracked application, scripts, package manifests or Next config. `git diff --stat -- src scripts next.config.ts package.json package-lock.json next-env.d.ts` was empty afterwards. `next-env.d.ts` retained its earlier 2026-10-23 timestamp. Existing review servers and the independent `.next-phase2-test` browser runner were not terminated or reconfigured. Subsequent commands use the explicit temporary-copy working directory.

## Qualifications and release follow-up

- The default Turbopack build was not established by this isolated symlink-based harness. Run the existing CI's normal `npm ci` + `npm run build` in its fresh Linux checkout before deployment; no configuration workaround is proposed. The actual optimized Webpack production build passed without app changes.
- Build success does not establish live Atlas indexes, provider protection/CORS, runtime media delivery, secret configuration or Safari acceptance. Those are tracked separately.
- CI currently requires manual dispatch and does not enforce the completed test/lint results. This is a release-process gap, not an additional product requirement; no workflow was changed.
- Existing production animation timing evidence was deliberately not repeated.
- Source files and runtime review servers were not changed. The static/build portion authored only this testing document; the supplementary regression portion below makes one narrow test-port portability correction. No stage, commit, deployment or live-data operation occurred.

## Supplementary capacity and ordinary-media regressions

Additional testing was assigned after the static/build checks:

- `CI=1 npx playwright test -c playwright.info-cards-capacity.config.ts --reporter=line`: **5/5 passed** in 7.7 seconds, with a fresh owned fixture on unused port 4179. Covers actual face/server capacity parity at 360/390/430px, Unicode, explicit paragraph/line breaks, narrow/wide characters and conservative font bounds.
- Existing port 4178 belongs to PID 94317, an unrelated fixture started 2026-10-22 that serves old HTML without the current build ID. It was inspected read-only and left running; it was **not** reused as current-source evidence.
- Ordinary media/download suites **20/20 passed** in 59.2 seconds on a fresh owned fixture at 4188, using a temporary config at `/private/tmp/switchplay-phase5-build.QSDcBI/playwright.media-regression.config.ts` importing the existing repository config. No tracked config was added. Exact command: `npx playwright test -c /private/tmp/switchplay-phase5-build.QSDcBI/playwright.media-regression.config.ts media-viewer.browser.ts ios-video-download.browser.ts`.
- The 20 tests cover 10 ordinary gallery cases (selection/traversal, touch/zoom/download, failed images, paused video/navigation, inherited repeated IDs, real decoding/retry under ordinary and Strict Mode mounting, and controls/focus/layout at 320/390/1280px) and 10 download cases. The download suite's nine **iPhone Safari simulations run in Chromium** with a Safari user-agent and mocked sharing APIs; this is not actual Safari behaviour verification.
- Structured supplementary media result: `/private/tmp/switchplay-phase5-media-report.json`; screenshots/traces/output: `/private/tmp/switchplay-phase5-media-results/`. Existing Playwright-managed fresh servers terminate after the suite.
- The only test change needed to use an independent fresh port is four expected-root-URL assertions in `tests/browser/ios-video-download.browser.ts`: derive the root from Playwright's configured `baseURL` rather than hardcode port 4178. Assertions still require the viewer page to remain on its original configured URL; no application behaviour changed.
- Exactly one installed-WebKit launch/click smoke **passed**, reporting engine version **26.0**, under approved execution outside the sandbox. It launched the existing `/Users/peterdomokos/Library/Caches/ms-playwright/webkit-2248/pw_run.sh` with a 10-second timeout, created an inline button and clicked it, then closed. No browser download or environment repair occurred. This establishes only basic engine availability in that execution context, not that the historical sandbox crash is generally fixed, and **does not establish Info Cards behaviour, actual iPhone Safari or VoiceOver acceptance**.
- Scoped ESLint for the four-line test portability change and `git diff --check` **passed**.
- Repeated `npx tsc --noEmit --incremental false` after the supplementary test changes: **passed**. Fresh fixture ports 4179/4188 had no remaining listeners; the unrelated original 4178 listener remained running.

## Stale foreign-Creator regression expectations

The combined authenticated-application regression run exposed old return-destination assertions in `tests/phase2/creator-foreign-session.browser.ts`. Source inspection confirmed these conflict with already approved functional specification §5.5 and the existing `deckCollectionTarget` / `CreatorDragLab.collectionDestination` implementation, rather than identifying a new product requirement or an application defect.

Narrow test corrections:

- Cancelling an unchanged foreign Deck edit returns to the **Library collection** (`/library`), not its original detail URL.
- Once editing creates an unpublished private owned copy, the return control is **My Decks**, and deliberate leave returns to `/decks`.
- Publishing a private copy returns to `/decks?reveal=<resulting-copy-id>`, displays its collection item, and does not automatically open a working Deck.
- Publishing a public Library copy returns to `/library?published=<resulting-copy-id>` and briefly highlights that actual published copy, rather than reopening the original source.
- The self-use private-copy path likewise returns to the My Decks collection with the resulting ID; membership/original-retention assertions remain unchanged, and the test now explicitly rejects automatic working-detail opening.
- Two obsolete test names were updated to describe these approved collection-return rules. All source-version selection, identity, no-write, copy, publication, personal-state and recovery assertions were preserved.

Scoped ESLint, standalone TypeScript and `git diff --check` **passed** after these test-only changes. The coordinating 18-case foreign/private recheck subsequently passed **all 14 foreign Creator cases**. Its one private-journey failure was an old unresolved injected-save assumption, corrected separately; the final private rerun passed **4/4**. No application code changed. The parent report records the original combined failures and rechecks separately.
