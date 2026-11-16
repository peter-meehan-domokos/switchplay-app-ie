# Puckle email: how it is set up, and how to turn it on for the live site

This guide records the real email arrangement for **puckleup.com** and the steps to switch it on in production. It is also the template for the next sites (PuckleClubs and Puckleyard, once renamed): repeat the same steps with their own domain.

## What sends email, and what it is for
Every email the app sends goes through one adapter, `src/lib/siteEmail.ts`, which calls the Resend API (`POST https://api.resend.com/emails`, 8 s timeout). There is no other mail path. Until the settings below are present on the server, every send is recorded as `failed` (`configuration-required`) and nothing leaves it. Public Join stays closed until `PUCKLE_JOIN_ENABLED=1`, independently of email.

**To students, parents and teachers** (sent from `Puckle <hello@puckleup.com>`):
- Join verification code (and the "you already have an account" notice).
- Password reset link.
- Parental approval request: one email to the parent, with one link to approve or decline. There is no withdrawal link. A parent withdraws by replying to that email (it reaches `hello@puckleup.com`), and the founder records it with the operator revocation tool.

**To the founder** (`PUCKLE_FOUNDER_EMAIL`, sent after the page has responded, so they never delay a visitor). Subjects follow `[ACTION|FYI] <icon> EVENT: name` so they can be filtered in Gmail:
- New student registration, new teacher registration (the account and course details, never a password or date of birth).
- No-email contact request (someone without an email address who left a mobile number).
- Interest registration (keep-me-updated) and tuition enquiry.
- Parent approval sent, and parent contact request (a parent given by mobile number only, so the founder phones them).
- Parent approved and parent declined.

The outcome of each alert is stored on the record it came from (`sent`, `failed` or `unknown`), so a missed alert can be found later. "Sent" means Resend accepted it, not that it reached an inbox.

## How the live arrangement fits together
- **Sending** is by Resend, from the verified domain `puckleup.com`. DNS (in Cloudflare) holds Resend's DKIM record (`resend._domainkey`) and the bounce subdomain `rsend.puckleup.com`.
- **Receiving** is by Google Workspace. `puckleup.com` is a secondary domain, `hello@`, `support@` and `notifications@` are aliases of the primary user, and replies to any email we send arrive in that mailbox. The root MX and SPF records are Google's. Resend does not use them.
- **DMARC** is `v=DMARC1; p=none;` (monitor only). It can be tightened later, once every legitimate sender is passing.
- **Addresses shown to the public:** `hello@puckleup.com` on the contact and privacy pages; `support@puckleup.com` where the site says something went wrong.

## One-time setup (already done for puckleup.com; repeat for each new domain)
1. **Resend domain:** add the domain, add the DNS records Resend shows, wait for "Verified".
2. **Turn off open and click tracking** for the domain in Resend. Tracking rewrites links, which would break the fragment-token security of reset and parent links. The adapter refuses to send until `ACCOUNT_EMAIL_TRACKING_DISABLED=1` confirms this.
3. **Create an API key** with *Sending access* only, restricted to that domain. Keep it out of chat, Git and screenshots.
4. **Set the environment variables** where the app runs (Vercel project settings → Environment Variables → Production), never in Git:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | the `re_...` key |
| `ACCOUNT_EMAIL_TRACKING_DISABLED` | `1` (only after step 2) |
| `ACCOUNT_EMAIL_SECRET` | a new random secret, at least 32 bytes (e.g. `openssl rand -base64 48`) |
| `ACCOUNT_EMAIL_PUCKLE_FROM` | `Puckle <hello@puckleup.com>` |
| `ACCOUNT_EMAIL_PUCKLE_ORIGIN` | `https://puckleup.com` (email links are built from this, never from request headers) |
| `ACCOUNT_EMAIL_PUCKLE_ALLOWED_ORIGINS` | optional, e.g. `https://www.puckleup.com` |
| `ACCOUNT_EMAIL_SWITCHPLAY_FROM` / `_ORIGIN`, `ACCOUNT_EMAIL_STRAT17_FROM` / `_ORIGIN` | the same for the other two sites, once they are live (needed for password reset sent from those sites) |
| `PUCKLE_FOUNDER_EMAIL` | the address that receives founder alerts (`notifications@puckleup.com`) |
| `ACCOUNT_TRUST_PROXY_IP` | `1` on Vercel (its proxy sets `x-forwarded-for`), so rate limits are per visitor |

**Never set these in production:** `ACCOUNT_EMAIL_REDIRECT_TO` (see below) and `ACCOUNT_EMAIL_TEST_ENDPOINT` (test fixture only). `--check` reports both.

## Testing safely with real delivery
`ACCOUNT_EMAIL_REDIRECT_TO` is a **testing-only** setting: when set to one address, every email is delivered to that inbox instead of its real recipient, labelled `[TEST for <intended address>]` with `TEST REDIRECT:` at the top of the body. It lets real delivery be exercised with made-up recipient addresses without emailing anyone. In production it is simply not set, and each email goes to its real recipient.

To try the whole app with real email on the disposable test database (never the production one), with the settings in a private file outside the repository (`~/.puckle-email.env`, mode 600):
```
npm run dev:phase2 -- --info-cards --lan --real-email
```
It refuses to start unless the file contains a single redirect address, so a test can never email a real person. With `--lan`, links in emails open on the phone.

## Check and test
```
npm run email:delivery -- --check
npm run email:delivery -- --send-test --site puckle --to you@example.com --confirm-send
```
Run them with the same variables loaded (for example `node --env-file=<file> --import tsx scripts/email-delivery.ts ...` with a private env file). `--check` lists anything missing by name only and warns if a test redirect is active. `--send-test` sends exactly one plain message and prints only the outcome and Resend id. It uses no database. Then check the inbox and spam folder, and the Resend dashboard's Emails page. In Gmail, "Show original" should show SPF, DKIM and DMARC all as PASS.

## Going live: the remaining steps
1. Add `puckleup.com` (and `www.puckleup.com`) to the Vercel project and point DNS at it (see `docs/engineering/sites/vercel-domain-setup.md`).
2. Set the production variables above, with no `ACCOUNT_EMAIL_REDIRECT_TO`.
3. Run `--check` against them, then one `--send-test` to yourself.
4. Only then set `PUCKLE_JOIN_ENABLED=1` to open public Join.
