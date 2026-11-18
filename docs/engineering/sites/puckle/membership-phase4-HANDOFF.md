# Membership Phase 4 handoff — tuition enquiry integration

Branch `site/puckle`, base `9ab06c9` (Phase 3 + refinements). Authorisation: Phase 4 only; commit it (subject `feat(puckle-membership): phase 4 tuition enquiry integration`) before reporting; no push/merge/deploy; no Phase 5.

## Resume point
> **Status: COMPLETE, TESTED AND COMMITTED** (see `git log -1`). Results in `membership-phase4-completion.md`. Stop for review; do not start Phase 5.

## Design
- Enquiry stays independent of membership. `src/lib/puckleEnquiries.ts`: `resolveTuitionContext` (signed-in user + `users.safeguarding.dateOfBirth` + student `puckleMemberships` profile -> `student-under-18` | `student-adult` | `unknown`) and `saveTuitionEnquiry` (server overrides a client-claimed `student-adult/under-18` with the DOB-derived path; links `userId`/`membershipId` only for the student's own enquiry, never `parent-guardian`; saves `founderNotification: pending`).
- Unknown DOB / no profile / teacher / anonymous => original selection flow, no link. Under-18 prefill: student first name + course only (guardian fields stay blank; never the student's login email/mobile). Adult prefill: name, account email, profile mobile, course (editable). Registration "Don't know" course stays unanswered; "Other" -> Other.
- `POST /api/public/puckle/early-access` keeps URL, validation, honeypot and success text; now uses the shared `notifyFounder` via `after()` (falls back to unawaited call outside request scope so direct-handler tests still work). Account lookup errors return the existing recoverable 500, never an adult fallback.
- `GET /api/public/puckle/tuition-context`: Puckle-only (404 elsewhere), own account only, no-store, never returns DOB.
- Client: `TuitionEnquiryForm.tsx` fetches the context on mount, applies `applyTuitionContext` (pure, `tuitionEnquiryLayout.ts`, fills only untouched fields) and hides the selector; any failure keeps the original flow.
- `auth.ts`: `getCurrentUser` split into `getUserForSessionToken` + `sessionTokenFromCookieHeader` (identical checks; lets the route read the cookie header without next/headers).
- Not done by design: adult "offer Join after success" (optional in plan; Join page must not change).

## Files (so far)
Modified: `src/lib/auth.ts`, `src/app/api/public/puckle/early-access/route.ts`, `src/app/sites/puckle/components/TuitionEnquiryForm.tsx`, `src/app/sites/puckle/lib/memberEmailTemplates.ts`, `tests/site-independence.test.ts`.
New: `src/lib/puckleEnquiries.ts`, `src/app/api/public/puckle/tuition-context/route.ts`, `src/app/sites/puckle/lib/tuitionEnquiryLayout.ts`.
