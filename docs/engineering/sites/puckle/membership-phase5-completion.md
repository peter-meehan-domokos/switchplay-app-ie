# Puckle membership — Phase 5 completion (shared parental approval)

15 November 2026, branch `site/puckle`, on top of `ebf7ebb`. Simulated email only; no push, merge, deploy, live data or provider configuration.

## Implemented
- **One shared approval per account** at `users.safeguarding.groupExperienceApproval`, scope `shared-group-experiences`, covering equivalent Group Learning on Puckle, Switchplay and Strat17. The sending site is stored as `sourceSite` provenance only; there are no per-site keys. Approval is not live-tuition permission and never changes `ageAssurance`.
- **Eligibility:** a known DOB with age under 16 (Europe/Dublin; the 16th birthday ends eligibility; leap day handled). Unknown DOB returns `age-unknown` and is never treated as adult; the request is refused with guidance to contact support.
- **Student request:** `POST /api/account/parental-approval` (signed in, origin-checked, optional `expectedUserId`). It refuses the student's own email, an invalid email and an already-approved state (changing an approved guardian needs reviewed support). The shared limits apply (60 s recipient cooldown, 3/h and 5/day per recipient, requester 10/h). A resend to the same guardian keeps the generation and replaces the old link. A new guardian, or a re-request after decline/withdrawal, starts a new generation and clears the current decision fields; the history keeps the evidence. Delivery is recorded separately and truthfully; "pending" is never proof of delivery. Forged body fields are ignored. `GET` returns the student's own summary (guardian masked), identical on every site.
- **Parent links:** `accountEmailActions` purposes `parent-request` / `parent-management`, 7-day expiry, digest only, a newer link of the same purpose marks older ones `replacedAt`, `cleanupAt` = expiry + 30 days (the renewal window). The target always comes from the persisted capability, never from cookies or another tab.
- **Decision:** the existing self-contained action document (same CSP, fragment token, no Analytics/RootLayout) now renders the parent review: child's name, the common explanation, an unchecked declaration checkbox, and Approve and Decline buttons. The decision is an explicit POST to `/api/account-actions/parental-approval`. One transaction consumes the link and conditionally updates the approval on scope, pending status, generation and recipient. Concurrent or replayed attempts fail with "can no longer be used". Approval records `guardianDeclaration {textVersion, declaredAt, emailConfirmedAt}` and a history event, then sends a **separate** 7-day management link.
- **Withdrawal:** the management link, plus a confirmation tick, sets the status to `withdrawn` with a guardian event. `revokeParentalApprovalAsOperator` (library only, no HTTP) records a reviewed operator revocation as `withdrawn` with a distinct `revoked` event, actor and reason. Neither touches learning data.
- **Renewal:** an expired or replaced link (within the window) offers "Email me a new link". This sends only to the guardian on record and always returns a neutral response. A link superseded by a different guardian is final.
- **Privacy page:** a factual "Parent or guardian approval" section. The site-independence guard forbids naming the other sites on Puckle pages, so it refers to "the other learning websites that share its account system"; the approval page names them.
- **No student UI:** the welcome and reminder UI is Phase 6. For manual review, `npm run dev:phase2 -- --info-cards --lan` seeds `young` and `young2` (under 16, password `local-test-only`), sends their requests through the real endpoint and prints phone-ready links in `phase2-test-results/phone-review.log`.

## Draft content needing approval before launch
`GROUP_EXPERIENCE_EXPLANATION` (version `shared-group-experiences-v1-draft`) and `GUARDIAN_DECLARATION` (`guardian-declaration-v1`) in `src/lib/parentalApprovalScope.ts`, plus the two email templates in `src/lib/accountEmailTemplates.ts`. Any wording change needs a new version string.

## Files
New: `src/lib/parentalApproval.ts`, `src/lib/parentalApprovalHttp.ts`, `src/app/api/account/parental-approval/route.ts`, `src/app/api/account-actions/parental-approval/route.ts`, `src/app/api/account-actions/renewal/route.ts`, `tests/parental-approval.test.ts`, `tests/parental-approval.integration.ts`, `tests/phase2/parental-approval.browser.ts`, this record and `membership-phase5-HANDOFF.md`.
Modified: `src/lib/emailActionDocument.ts` (reset and parent panels), `src/app/api/account-actions/details/route.ts` (reset first, then parent), `src/lib/parentalApprovalScope.ts` (explanation, declaration, site names, optional evidence fields on events), `src/lib/accountEmailTemplates.ts`, `src/lib/puckleMemberships.ts` (`replacedAt`, `sourceSite` on actions), `src/app/sites/puckle/privacy/page.tsx`, `scripts/test-phase2.ts` (review seeding and phone links).

## Tests
| Command | Result |
| --- | --- |
| `npm run test:unit` | 510 pass (3 new) |
| integration: parental-approval (15 new), account-security, shared-membership, puckle-registration, puckle-tuition, puckle-enquiry | 74 pass |
| `npm run test:phase2 -- parental-approval.browser.ts` (390px) | 4 pass |
| `npm run test:phase2 -- membership-security.browser.ts` (shared action document) | 7 pass |
| typecheck; lint; `git diff --check` | clean; 0 errors / 6 existing warnings; clean |

Not run: full suites, a production build, a real provider, a physical device. The renewal browser test clears the disposable database's one-minute cooldown, because a real renewal happens days after the original email.
