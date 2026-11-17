# Puckle pre-launch mode

Pre-launch mode lets puckleup.com take registrations, tuition enquiries and parental approvals now, while the general learning platform stays closed to ordinary members. Selected accounts keep the real platform on the same domain.

It is two server-side environment variables and a small access decision. It is not a feature-flag system.

## The two settings

| Variable | Value | Meaning |
| --- | --- | --- |
| `PUCKLE_PRELAUNCH_MODE` | `1` | Pre-launch experience on, for **puckleup.com only**. |
| | `0` or not set | Normal platform for everyone. The access list is ignored. |
| `PUCKLE_PRELAUNCH_ACCESS` | comma-separated account emails | These accounts get the normal platform while mode is `1`. |
| | empty or not set | Nobody is exempt. |

Switchplay and Strat17 are never affected, whatever the values. The decision uses the website the request arrived on.

Example value (typed directly into the Value field in Vercel, no quotes):

```
peter@puckleup.com,student1@example.com, student2@example.com
```

Spaces around addresses and upper or lower case do not matter, and empty entries are ignored.

**Which email is compared:** the email of the signed-in account, read from the server-signed session cookie (and from the account record on pages). It is never read from a query string, header, form field or any other request input.

## Turn it on or off, and edit the list

1. Vercel project, **Settings, Environment Variables, Production**.
2. Add or edit `PUCKLE_PRELAUNCH_MODE` (`1` to enable) and, optionally, `PUCKLE_PRELAUNCH_ACCESS`.
3. To leave the list empty, leave `PUCKLE_PRELAUNCH_ACCESS` out, or leave its Value empty.
4. To add a tester or tuition student, append their account email. To remove one, delete it from the list.
5. **Redeploy.** Vercel only applies environment variable changes to a new deployment. Until you redeploy, the previous values stay in force.

An account's email is the one on its account (what it signs in with), which may differ from any email the student mentioned elsewhere. A person on the list must sign out and back in only if they were signed in before the list changed and the page still looks restricted after the redeploy. Nothing else is needed.

## What a non-exempt member can and cannot reach

Applied by the proxy (`src/proxy.ts`) before any page or API runs, using the pure helpers in `src/lib/prelaunch.ts` and `src/lib/sites/prelaunchRouting.ts`.

**Blocked, for a signed-in member who is not on the list**
- Pages: `/decks` (My Decks), `/library` and every library page, `/progress`, `/creator` and every Creator page. These show the pre-launch welcome at the same address.
- APIs: every `/api/...` route that is not in the open list below, for any method. They answer `403` with `{"code":"PRELAUNCH"}`. This fails closed: a new API route is blocked automatically until it is deliberately added to the open list.

**Still open**
- The public site, Join, contact, privacy, sign-in and password reset pages.
- `/api/auth/*` (sign in, sign out, email verification, password reset), `/api/public/*` (registration, tuition and interest enquiries, contact), `/api/account-actions/*` (the links in emails, including the parent's approval page), `/api/account/onboarding` and `/api/account/parental-approval`.
- `/step-visuals`, the public lab page, which has no account data.

**Signed-out visitors** are not touched by the gate: the existing sign-in screen and `401` responses apply. Route handlers and pages still authenticate on their own, so the gate only ever narrows access.

## The pre-launch welcome

Shown at `/decks` (and the other restricted pages) in place of the platform, and as the landing page after registration and after every sign-in. It is a separate presentation (`prelaunchLayout.ts`, `PrelaunchWelcome.tsx`) and is not dismissible into the platform.

- **Student:** early-access message, "Request a free session" (the same wording as the public site; opens the existing tuition enquiry form on the home page at `/#early-access`), and a small secondary "Parent or guardian approval" section only for a student who is under 16 and has not yet been approved. It opens the existing parent request form and uses the existing request and email.
- **Teacher:** early-access message with `hello@puckleup.com` as a plain email link. No button or form.
- **Signed-in account with no student or teacher membership:** the general message, with the same email link. The Join "I'm interested in Puckle" choice creates no account, so it is unchanged and keeps its own "You're on the list" confirmation.

Join (`/join`) shows extra wording above the student and teacher forms only while the mode is on. All fields, validation, verification and emails are unchanged.

After registering in pre-launch mode, a signed-in member goes straight to the pre-launch welcome instead of the timed registration welcome. A registrant whose email is on the list gets the normal timed welcome and the platform.

## The original welcome is preserved

The original welcome (the timed registration welcome and the My Decks welcome with its parent reminder) is unchanged.

- While a member is in pre-launch mode, `/api/account/onboarding` reports nothing to show, so the original welcome and reminder never appear, and the acknowledgement endpoint refuses (`403`) to record it. Seeing the pre-launch welcome never marks it as seen.
- Their `welcome` record stays eligible and unseen. The original welcome appears by its normal rules when mode is switched off, or when the account is added to the access list.
- Exempt accounts and everyone when mode is off follow the existing rules exactly.

## Switching it off for the general opening

1. Set `PUCKLE_PRELAUNCH_MODE` to `0` (or remove it). The access list can stay; it is ignored.
2. Redeploy.

Members who have not yet seen the original welcome receive it on their next visit to My Decks, by the existing rules. Nothing needs to be migrated.

## Testing

```
node --import tsx --test tests/prelaunch.test.ts
node --import tsx --test --test-concurrency=1 tests/onboarding-status.integration.ts

# Browser, mode on (development server)
PUCKLE_PRELAUNCH_MODE=1 PUCKLE_PRELAUNCH_ACCESS="  Allowed-One@Example.invalid , allowed-two@example.invalid ,, ALLOWED-THREE@example.invalid " \
  npm run test:phase2 -- prelaunch.browser.ts

# Browser, mode off
npm run test:phase2 -- prelaunch.browser.ts
```

The browser suite uses the disposable test database and the captured test mailbox. It never sends real email.
