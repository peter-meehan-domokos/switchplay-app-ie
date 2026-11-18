# Puckle membership — Phase 4 completion (tuition enquiry integration)

15 November 2026, branch `site/puckle`, on top of `9ab06c9`. Local only; no push, merge, deploy, live data or real email.

## Implemented
- **One tuition form, unchanged for visitors.** Same URL (`/api/public/puckle/early-access`), validation, honeypot, success text, three enquirer choices. No account needed; an enquiry never creates a user, profile, invitation or credential.
- **Signed-in Puckle student with a known DOB.** The form fetches `GET /api/public/puckle/tuition-context`, hides the selector and prefills. Under-18: student's first name and course only (guardian fields stay blank; the student's login email/mobile are never offered). Adult: name, account email, profile mobile, course; all editable. Prefill never overwrites typed text.
- **Server-authoritative age path.** On submit the server reloads `users.safeguarding.dateOfBirth` (Europe/Dublin, `ageOn`) and overrides a client-claimed `student-adult`/`student-under-18` with the derived path before the existing validation, so a forged adult payload from an under-18 still needs the student's name, guardian name and a guardian contact. 18th birthday today = adult; the day before = under-18 (tested). A signed-in student may still enquire as `parent-guardian`; that type is kept and not linked.
- **Own-account link only.** For student-typed enquiries by that student, `userId`/`membershipId` are stored. Guardian contact matches are never used to identify a student; siblings sharing contact details remain independent enquiries.
- **Unknown DOB, no Puckle profile, teacher profile, anonymous, or any context failure** keep the original three-way flow (no bypass). A failed account lookup at submit returns the existing recoverable 500, not an adult fallback.
- **Founder notification.** Saved with `founderNotification: {status: "pending"}`; `after()` then uses the shared `notifyFounder` (Phase 3) to email "Puckle: new tuition enquiry" and records sent/failed/unknown. Delivery failure never affects the saved enquiry or the response. No CRM/queue.
- DOB, credentials, permissions and learning data are never written by an enquiry (asserted by snapshot comparisons).

## Files
Modified: `src/app/api/public/puckle/early-access/route.ts`, `src/app/sites/puckle/components/TuitionEnquiryForm.tsx`, `src/app/sites/puckle/lib/memberEmailTemplates.ts` (+tuition alert), `src/lib/auth.ts` (`getCurrentUser` split into `getUserForSessionToken` + `sessionTokenFromCookieHeader`; identical checks), `tests/site-independence.test.ts` (+`@/lib/puckleEnquiries` alias; Puckle form may also call its own `tuition-context`), `tests/puckle-enquiry.integration.ts` (stored shape now also carries `founderNotification`).
New: `src/lib/puckleEnquiries.ts`, `src/app/api/public/puckle/tuition-context/route.ts`, `src/app/sites/puckle/lib/tuitionEnquiryLayout.ts`, `tests/puckle-tuition-context.test.ts`, `tests/puckle-tuition.integration.ts`, `tests/phase2/puckle-tuition.browser.ts`, this record and `membership-phase4-HANDOFF.md`.

## Data
`puckleTuitionEnquiries` gains optional `userId`, `membershipId`, `founderNotification` (all optional; existing rows untouched; no migration, index or backfill). Retrieval of pending/failed alerts: filter `founderNotification.status`.

## Tests
| Command | Result |
| --- | --- |
| `npm run test:unit` | 507 pass |
| integration: account-security, puckle-registration, shared-membership, puckle-enquiry (existing 5), puckle-tuition (9 new) | 59 pass |
| `npm run test:phase2 -- puckle-tuition.browser.ts` (390px) | 7 pass |
| `membership-security.browser.ts`; `puckle-join.browser.ts` (separate runs) | 7 pass; 15 pass |
| typecheck; lint; `git diff --check` | clean; 0 errors / 6 existing warnings; clean |

Not run: full integration/browser suites (unrelated), production build, real mail provider, physical iPhone. One `account-security` test (recipient budgets) failed once in a batch and passed on every rerun (timing-sensitive, pre-existing).

## Deviations from the plan (see report)
Context endpoint lives at `/api/public/puckle/tuition-context` (plan said `/api/puckle/…`) because an existing guard requires each site's forms to call only that site's `/api/public/<site>/` folder. The optional "offer Join after an adult enquiry" was not added (Join page must not change). `auth.ts` refactor above.
