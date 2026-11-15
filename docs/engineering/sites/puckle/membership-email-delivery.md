# Real email delivery (Resend)

All account email (Join verification codes, password resets, parent approval and withdrawal links) and founder alerts go through one adapter, `src/lib/siteEmail.ts`, which calls the Resend API (`POST https://api.resend.com/emails`, 8 s timeout). There is no other mail path. Until the settings below are present, every send is recorded as `failed` (`configuration-required`) and nothing leaves the server; public Join stays closed regardless until `PUCKLE_JOIN_ENABLED=1`.

## What the adapter records
`sent` with the Resend message id (`resend:<id>`, findable in the Resend dashboard), or `failed` with `provider-http-<status>` / `provider-rate-limited` / `configuration-required`, or `unknown` (`transport-interrupted`, e.g. a timeout where Resend may still have accepted it). Response bodies, API keys, codes and links are never stored or logged. "Sent" means Resend accepted it, not that it reached an inbox.

## One-time setup (yours; nothing here has been done)
1. **Resend account and domains:** add and verify each sending domain you will use (e.g. `puckle.co`; Switchplay/Strat17 only if they will send account email). Add the DNS records Resend shows (SPF/DKIM, and a DMARC record is recommended) and wait for "Verified".
2. **Turn off open and click tracking** for each sending domain in Resend. Tracking rewrites links, which would break the fragment-token security of reset and parent links; the adapter refuses to send until you confirm this with `ACCOUNT_EMAIL_TRACKING_DISABLED=1`.
3. **Create an API key** with *Sending access* only, restricted to the verified domain(s).
4. **Set environment variables** where the app runs (Vercel project settings → Environment Variables, Production), never in Git:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | the `re_...` key |
| `ACCOUNT_EMAIL_TRACKING_DISABLED` | `1` (only after step 2) |
| `ACCOUNT_EMAIL_SECRET` | a new random secret, at least 32 bytes (e.g. `openssl rand -base64 48`) |
| `ACCOUNT_EMAIL_PUCKLE_FROM` | e.g. `Puckle <hello@puckle.co>` (must be on a verified domain) |
| `ACCOUNT_EMAIL_PUCKLE_ORIGIN` | `https://puckle.co` (email links are built from this, never from request headers) |
| `ACCOUNT_EMAIL_PUCKLE_ALLOWED_ORIGINS` | optional, e.g. `https://www.puckle.co` |
| `ACCOUNT_EMAIL_SWITCHPLAY_FROM` / `_ORIGIN`, `ACCOUNT_EMAIL_STRAT17_FROM` / `_ORIGIN` | the same for the other two sites (needed for password reset and parent emails sent from those sites) |
| `PUCKLE_FOUNDER_EMAIL` | the address that receives founder alerts |
| `ACCOUNT_TRUST_PROXY_IP` | `1` on Vercel (its proxy sets `x-forwarded-for`), so rate limits are per visitor |

Never set `ACCOUNT_EMAIL_TEST_ENDPOINT` outside the disposable test runner.

## Check and test
```
npm run email:delivery -- --check
npm run email:delivery -- --send-test --site puckle --to you@example.com --confirm-send
```
Run them with the same variables loaded (for example `node --env-file=<file> --import tsx scripts/email-delivery.ts ...` with a private env file). `--check` lists anything missing by name only. `--send-test` sends exactly one plain message and prints only the outcome and Resend id. It uses no database. Then check the inbox and spam folder, and the Resend dashboard's Emails page.
