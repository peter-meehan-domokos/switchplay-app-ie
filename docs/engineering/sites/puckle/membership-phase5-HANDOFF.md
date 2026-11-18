# Membership Phase 5 handoff — shared parental approval

Branch `site/puckle`, base `ebf7ebb` (Phase 4). Authorisation: Phase 5 only; commit as `feat(puckle-membership): phase 5 parental approval` before reporting; simulated email only; no push/merge/deploy; no Phase 6.

## Resume point
> **Status: COMPLETE, TESTED AND COMMITTED** (see `git log -1`). Results in `membership-phase5-completion.md`. Stop for review; do not start Phase 6.

## Design (implemented)
- `src/lib/parentalApproval.ts`: eligibility (known DOB, age < 16; unknown DOB => `age-unknown`, never treated as adult), student summary, request/resend (new generation for new guardian or after decline/withdrawal; resend keeps generation; approved => refused), 7-day `parent-request` / `parent-management` links in `accountEmailActions` (older link of same purpose gets `replacedAt`; `cleanupAt = expires + 30d` renewal window), explicit decide (declaration required; transaction consumes link + conditional user update on scope/status/generation/recipient), withdrawal via management link, operator revocation (lib only, no HTTP), neutral renewal to the recorded guardian.
- Record: `users.safeguarding.groupExperienceApproval` (scope `shared-group-experiences`, common explanation version, sourceSite provenance, guardian declaration, timestamps, delivery of the request email, history with generation/guardian/declaration on each event). Targeted `$set`/`$push` only; DOB, assurance and learning data untouched.
- Routes: `src/app/api/account/parental-approval` (GET own summary, POST request; origin-checked; optional `expectedUserId`), `src/app/api/account-actions/parental-approval` (approve/decline/withdraw), `src/app/api/account-actions/renewal`; `details` route dispatches reset then parent. `emailActionDocument.ts` now renders reset or parent panels (same CSP/no-analytics/fragment design).
- Draft common disclosure + declaration in `parentalApprovalScope.ts` (`shared-group-experiences-v1-draft`, needs approval before launch).
- No student UI: the welcome/reminder UI is Phase 6.
