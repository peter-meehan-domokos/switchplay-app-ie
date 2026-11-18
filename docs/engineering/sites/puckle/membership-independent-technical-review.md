# Independent technical review — Puckle membership architecture

**Date:** 14 November 2026.
**Reviewed:** [Membership engineering plan](membership-engineering-plan.md) and [Membership specification](../../../design/sites/puckle/membership-spec.md).
**Method:** Read-only. Both documents were read in full and checked against the repository code. No files other than this report were changed.

## A. Overall verdict

**Proceed with specific modifications.** The core design holds up against the real code:

- the client onboarding host as a sibling in the root layout;
- safeguarding fields on `users`;
- one transaction for account + profile + proof;
- `sessionVersion` for logging out old sessions after a reset.

Within that, there are two real bugs in the onboarding lifecycle, a gap in the trust model that open registration creates, and a few mechanisms that add work without adding safety.

## B. Onboarding findings

**B1 — Bug: the session-expiry timer fires immediately.** Plan §5.2 says to schedule removal of onboarding at the session's expiry time. Sessions last 30 days ([auth.ts:11](../../../../src/lib/auth.ts#L11)), which is 2.59 billion ms. Browsers store `setTimeout` delays as 32-bit integers, and anything over about 24.8 days overflows and runs straight away. So for any session younger than about 5 days, including one created seconds ago by registration, the timer removes the welcome as soon as it appears.
**Fix:** delete the expiry timer and the midnight age-change timer. Re-checking on focus/pageshow and on auth events, plus the server checking the expected user on every action, already covers expiry.

**B2 — Bug: clearing the panel on blur loses the guardian email.** §5.2 says to remove panel contents on blur/hidden. A 13–15-year-old will often switch apps to find a parent's email address. Under this rule, coming back loses what they typed, and the "never resurrect a dismissed panel" rule can then hide the welcome for good.
**Fix:** keep the contents on blur. On focus, re-check, and clear only if the user has changed or the session returns 401.

**B3 — Risk: the onboarding layer always paints above the app's own overlays.** `.app-shell--deck` is `position: fixed` ([globals.css:322-333](../../../../src/app/globals.css#L322-L333)), so it forms its own stacking context. Every app overlay sits inside it: the expanded deck intro (z 39/40, [globals.css:2105-2122](../../../../src/app/globals.css#L2105-L2122)) and the Creator modal backdrops (z 80, [globals.css:1196](../../../../src/app/globals.css#L1196)). Any fixed sibling in `body` will paint above all of them.
The plan's "defer during native modal/fullscreen" check doesn't catch these overlays. They aren't native dialogs: for example, [CreatorDraftsModal.tsx](../../../../src/components/creator/CreatorDraftsModal.tsx) is a `div role="dialog"` with its own Tab trap. Creator also has drag interactions, inert headers and a `beforeunload` guard.
**Fix:** limit eligible routes to exactly `/decks` and `/library`, and drop `/progress` and `/creator/**`. Show expanded panels only before the first outside interaction, and after that only a small pill. Test the pill against the expanded deck intro.

**B4 — Simplify: Shadow DOM and the portal aren't worth their cost.** `globals.css` has only a `*` reset and `font: inherit` on buttons and inputs ([globals.css:1-35](../../../../src/app/globals.css#L1-L35)). Inherited font and colour cross a shadow boundary anyway, so the plan has to reset them regardless. The costs:

- styles move into TypeScript strings instead of the CSS modules used everywhere else;
- window/document listeners see the shadow host as `event.target`;
- testing is harder.

The retargeting is harmless today, because [DeckScene.tsx:236](../../../../src/components/decks/DeckScene.tsx#L236) and [DeckGrid.tsx:204](../../../../src/components/decks/DeckGrid.tsx#L204) only react to Escape. A future "ignore typing in inputs" check would misfire, though. The portal isn't needed either: the host is already a fixed sibling in `body`.
**Recommendation:** render directly in the host's fixed container with a CSS module, and stop keydown/pointer bubbling at the panel root. That also stops Escape inside the panel from closing an expanded deck intro.

**B5 — Simplify: drop the two-second presentation window.** The interaction gate is what actually protects learning. The timer only hides the welcome from new users on slow mobile connections, which is exactly when the import and fetch are slow, and that goes against the spec's "do not postpone this initial offer". Gate only on "no outside pointerdown/keydown/wheel since mount".

**B6 — Auth notifications: necessary, and same-tab is enough.**

- They are necessary. `/decks` shows `EmbeddedAuthScreen` → `AuthScreen` with no `redirectTo`, which calls `router.refresh()` on the same URL ([decks/page.tsx](../../../../src/app/decks/page.tsx), [AuthScreen.tsx:39-46](../../../../src/components/auth/AuthScreen.tsx#L39-L46)). Both logout paths also only refresh ([LogoutButton.tsx:28](../../../../src/components/auth/LogoutButton.tsx#L28), [OverviewMenu.tsx:27](../../../../src/components/layout/OverviewMenu.tsx#L27)). The pathname doesn't change, and siblings in the root layout don't remount on refresh.
- The cross-tab BroadcastChannel plus storage-event fallback isn't needed. A background tab has to be focused before anyone can use it, and the plan already falls back to re-checking on focus.
- **Keep:** a same-tab CustomEvent, focus/pageshow re-checks, and the server checking the expected user on mutations.

**B7 — Registration hand-off.** A full document navigation to `/decks` is right, because the host remounts. Drop the "new-registration hint": the server already knows `welcomeEligible && !seenAt`.

**Confirmed safe:**

- **No re-renders or remounts.** RootLayout is a Server Component and `children` arrives as an RSC prop, so the host's state can't re-render the app beside it.
- **No hydration mismatch.** The eligible routes are reserved, not rewritten ([siteRouting.ts:5](../../../../src/lib/sites/siteRouting.ts#L5)). Rendering null until mount avoids the rewrite mismatch described in the local `use-pathname.md`.
- **Caching unchanged.** A client component that renders null on the server doesn't change how the route is classified.
- **Native dialogs win.** The app's dialogs ([useInfoCardDialog.ts:18](../../../../src/components/info-cards/useInfoCardDialog.ts#L18), [LibraryDialog.tsx:8](../../../../src/components/library/LibraryDialog.tsx#L8), `CardMediaViewer`) sit in the top layer and make the host inert, so onboarding can't take their focus.
- **Capture listeners are fine.** The listeners in [InfoCardFace.tsx:42](../../../../src/components/info-cards/InfoCardFace.tsx#L42) only treat a panel click as an outside click, which is acceptable.
- **Sign-out mid-request.** The plan's abort + generation counter + expected user is enough.

**Still needs a real-device test:** on iOS, focusing an input inside a fixed panel over a fixed `100svh` app shell can leave the page scrolled after the keyboard closes.

## C. Safeguarding findings

**C1 — Confirmed in code, should block launch: open sign-up opens publishing to strangers.** Today, accounts are created only by [seed-user.mjs](../../../../scripts/seed-user.mjs). Once anyone can sign up, any account can:

- make cards, decks and info cards public, permanently ([repository.ts:26-29](../../../../src/lib/cards/repository.ts#L26-L29));
- upload media;
- run the Chromium `check-rendering` endpoint.

The only `isAdmin` checks are Creator preview flags. Public content appears in Library for everyone, including 13–15-year-olds, and DOB is self-declared, so a stranger can publish content children will see. This can't be fixed inside "no Creator changes", so it needs an explicit pre-launch decision.

**C2 — Confirmed in code: `/api/users` lists every username.** [api/users/route.ts](../../../../src/app/api/users/route.ts) returns all usernames to any signed-in user, and nothing in `src` calls it any more. With children signing up, anyone can list their usernames, which may be real names.
**Fix:** remove it or restrict it to admins. It's an existing runtime file, so add it to REQUIRES EXPLICIT APPROVAL.

**C3 — No whole-document leaks today.**

- `toAuthUser` builds an explicit object ([auth.ts:62](../../../../src/lib/auth.ts#L62)).
- `/api/users`, `sharedDecks`, `getPersonalUser` and the infoCards `$lookup` all use projections.
- There is no `replaceOne` anywhere, and every learning write is a targeted `$set`/`$push` with `arrayFilters`.

So keeping safeguarding on `users` is safe, and a separate collection would add work without reducing risk. One cheap improvement: `getCurrentUser`'s `findOne` has no projection, so every request, including public headers, loads DOB, guardian and history data along with `decksData`/`cardsData`. Add a projection in the `auth.ts` edit that is already planned.

**C4 — Separate source from verification.** `ageAssurance` mixes where the DOB came from with whether it was verified ("self-declared" and "unverified" are both unverified). Use `dobSource: self-declared | operator-entered` plus `verification: none | independent` with an evidence reference. The approval design (current state, append-only history, a generation precondition, one shared scope) is sound.

## D. Registration findings

- **D1 — Keep the transaction.** [applicationDatabase.ts](../../../../src/lib/applicationDatabase.ts) requires Atlas `mongodb+srv`, which is a replica set, and [withMongoTransaction](../../../../src/lib/mongodb.ts#L30) already exists. Compensating deletes wouldn't be simpler. `withTransaction` doesn't retry a duplicate-key error (11000), so map it to a field conflict. The prepare script must create `puckleMemberships` and its indexes in advance.
- **D2 — New users need empty learning arrays.** A new user must include `cardsData: []` and `decksData: []`. Otherwise [membershipDTO](../../../../src/lib/cards/readModels.ts#L84) and `assertUser` ([repository.ts:220](../../../../src/lib/cards/repository.ts#L220)) throw `NEW_MODEL_USER_REQUIRED`. `seed-user.mjs` leaves out `cardsData`, so don't copy it. Make "a new account opens /decks" an explicit test.
- **D3 — Session invalidation is backward-compatible.** `readSessionToken` accepts an extra claim, and `getCurrentUser` already reloads the user, so the version check costs nothing. The login/reset race is real but narrow. The two-line login-route edit is the cleanest fix, and **I recommend approving it.**
- **D4 — Account exists without a session.** Pre-generate the `ObjectId` and sign the JWT before committing. Then a signing failure can't leave an account with no session.
- **D5 — Founder notifications can delay the response.** Awaiting the email provider before responding risks a timeout, a resubmit and a duplicate enquiry. Record `pending`, then send inside `after()` from `next/server` (local `after.md`; on Vercel it uses `waitUntil`).
- **D6 — Email-action machinery is the biggest simplification available.** The context exchange, Strict cookie and opaque expected-action ID exist only to carry the token from the analytics-free entry page into React pages that Analytics loads on. Instead, make the analytics-free Route Handler document the approval/reset page itself, keep the token in memory, and POST it in the body. Security is the same (fragment, no-referrer, no Analytics, explicit POST). It removes the cookie, the two-tab problem and the Puckle-only parent-approval page.
- **D7 — Duplicate email or username at the end.** At present someone learns about a duplicate email only after finishing the form. Recommended: always say "we've emailed you". If the account already exists, that email says "sign in or reset" instead of giving a code, which gives nothing away. On a username clash, the transaction aborts and the proof isn't used up, so allow resubmitting without a new code.
- **D8 — Contact collections.** No-email requests stay a plain record, which is fine. You could merge `puckleJoinContactRequests` and `puckleInterestContacts` into one `puckleContacts` collection with a `kind` field.

## E. Ranked changes

**Must fix before implementation**

1. Remove the expiry and midnight timers (B1). Otherwise the welcome disappears immediately.
2. Don't clear contents on blur (B2). Otherwise the guardian email is lost.
3. Limit routes to exactly `/decks` and `/library` (B3). Otherwise the layer floats over non-native overlays.
4. Record the open-publishing exposure as a launch blocker, and add `/api/users` to the approval list (C1, C2).

**Should improve if inexpensive**

5. Make the email-action page self-contained (D6).
6. Replace the Shadow DOM portal with a CSS module (B4).
7. Drop the cross-tab channels, the two-second timer and the registration hint (B5–B7).
8. Add a projection to `getCurrentUser` (C3).
9. Send founder notifications with `after()` (D5).
10. Pre-sign the token (D4).
11. Split the `ageAssurance` fields (C4).
12. Use the neutral existing-account email (D7).
13. Merge the contact collections (D8).

**Defer:** cross-tab sync, a username-availability check, approval pages for other sites, and any rate-limiting beyond simple counters.

## F. Questions

1. Can self-registered accounts publish public content and upload media at launch? Gating that is separate Creator work.
2. Do you approve removing (or restricting to admins) `src/app/api/users/route.ts`?
3. When a code is requested for an email that already has an account, should it get the neutral "account exists" email (recommended) or an on-screen message?
4. Do you approve the login-route edit? I recommend yes.

## G. Recommendation to Codex

- §5.2: delete the session-expiry and calendar timers. Re-check identity on auth events, focus and pageshow only, and keep the server-side expected-user check.
- §5.2: on blur/hidden keep panel contents; on focus re-check and clear only if the user changed or the session returns 401. Remove BroadcastChannel and the storage fallback; keep a same-tab CustomEvent.
- §5.1: eligible routes are exactly `/decks` and `/library`. Render in the host's fixed container with a CSS module, with no Shadow DOM or portal. Stop keydown/pointer bubbling at the panel root. Explain that the app shell's fixed stacking context puts onboarding above all non-native app overlays.
- §5.3: remove the two-second window and gate only on outside interaction. §4.1: remove the registration hint, pre-generate `_id`, and sign the token before commit.
- §4.6: replace the context exchange, action cookie and expected ID with a self-contained, analytics-free action document that POSTs the in-memory token.
- §4.5: record the notification as pending, then send it in `after()`.
- §2: add a projection to `getCurrentUser` in the `auth.ts` change. Add `src/app/api/users/route.ts` (remove or admin-only) under REQUIRES EXPLICIT APPROVAL.
- §8: add a launch dependency. Open registration exposes public publishing, media upload and `check-rendering` to any account. Decide on Creator gating before public launch.
- §3.1: split `ageAssurance` into `dobSource` and `verification`. Make "a new account has `cardsData: []` and opens /decks" an explicit test.
