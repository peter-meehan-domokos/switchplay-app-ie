# Info Card media — accepted temporary risk

Status: explicitly accepted for the small-scale trial, 28 October 2026. This is
not an outstanding blocker for that trial and is not private-storage certification.

## Current policy

`INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL=1` explicitly permits Info Card media while
`INFO_CARDS_PRIVATE_MEDIA_VERIFIED` remains unset. Protected application delivery
(`NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1`) remains required. The verified mode
is still available for a future genuinely verified configuration.

Info Card image uploads use the existing `path-assets` bucket. Its configured
`pub-121cf28a94a14f79a0d3145eac12674b.r2.dev` origin and legacy
`assets.tebostudio.com` origin allowed anonymous image access in read-only checks.
The separate existing personal-media bucket `path-user-data`, served through
`user-uploads.tebostudio.com`, also allowed anonymous access; Info Card uploads
do not move into that bucket or change its behaviour.

Application ownership, upload proofs/provenance, draft revisions, immutable
publication visibility, exact-publication media authorisation and reference
guards remain enforced. However, anyone obtaining an image's direct R2 URL can
bypass application authorisation and retrieve it, including an image belonging
to a private card. An unguessable URL is not an access-control guarantee.

## Video protection

The previous read-only inspection listed 131 Stream videos, 130 without signed
URL protection. These are existing assets, not proof that every video is private
or belongs to Switchplay. Do not bulk-change them without an ownership/use audit.
New Info Card videos continue to request signed-only delivery; publication checks
the creator, `requireSignedURLs` and processing readiness. Application grants bind
the authorised actor and exact Info Card publication. Existing bearer URLs last
approximately one hour and are not immediately revoked by logout; reopening media
obtains a fresh grant. No renewal scheduler or new media system is introduced.

## Future hardening (deferred)

1. Inventory R2 public/custom/Worker aliases and other sites using them before
   changing shared storage. Inspect CORS with suitable read permissions; existing
   credentials returned 403 for bucket configuration reads.
2. Protect private image storage/delivery across every origin, preserving existing
   Card/Deck media. Plan any shared-origin changes separately; no migration or
   public-access change is part of this trial.
3. Verify anonymous image denial on all aliases; authenticated owner/private/public
   access; rejected foreign/private-era access; real upload CORS including
   `Content-Type`, `If-None-Match`, `x-amz-meta-creator` and
   `x-amz-meta-info-card-id`; and rejection of overwrite attempts.
4. Verify real Stream signed playback, denied unsigned manifest/thumbnail access,
   provenance, expiry and exact-publication reopening. Review existing unsigned
   assets separately without assuming their visibility policy.
5. Only after those checks pass, enable `INFO_CARDS_PRIVATE_MEDIA_VERIFIED=1`,
   remove `INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL`, and recheck application/provider
   behaviour. Removing the trial flag alone restores fail-closed media when no
   verified configuration is acknowledged. Update Vercel runtime configuration
   deliberately; never label accepted public access as verified protection.

Live verification results and any functional limitations are recorded in the
implementation handoff/final report; automated provider simulations alone do not
certify Cloudflare delivery.

## Trial implementation and functional verification

- The trial flag is enabled in the ignored local `.env.local`, not as a false
  verification acknowledgement. Vercel needs the same server-side trial flag
  when these changes are deployed; no deployment/settings change was performed.
- Real Stream browser upload, processing, private/public publication, signed
  playback in Library and the attached pouch, foreign/private-era rejection and
  return to the selected Info Card passed using disposable MongoDB records.
- Live R2 testing exposed an additional integration defect: metadata hoisted into
  presigned query parameters was not retained by R2. Info Card uploads now sign
  and send the two provenance headers explicitly. Existing ordinary image upload
  paths are unchanged; the immutable-key overwrite protection remains.
- With those headers, real R2 upload, proof-checked saving, private/public
  publication, owner/foreign/private-era authorisation, Library image decoding,
  pouch image decoding and selected-card restoration passed. The repeated
  conditional PUT was rejected with 412. This run used test-only API transfer
  after the browser preflight failed; it is not a browser-upload success.
- Browser PUT preflight returned 403 without `Access-Control-Allow-Origin` for
  `http://localhost:3000`, `http://127.0.0.1:3000` and disposable test origins.
  This is a **functional CORS configuration blocker**, distinct from the accepted
  public-image risk. Existing credentials cannot inspect/modify bucket CORS.
  Add/extend a `path-assets` CORS rule for actual application origins, PUT and
  the four required headers above, preserving any rules used by other clients.
  Do not change public access or replace unknown existing rules blindly.
- The opt-in live check is
  `node --import tsx scripts/test-phase2.ts --info-cards --live-info-media info-cards-live-media.browser.ts`.
  It uses its own replica set, labels provider assets and deletes those exact
  assets, never writes the production database, and is skipped in ordinary runs.
  An API-only image transfer used to diagnose later lifecycle stages is explicitly
  test-only: the final browser-upload assertion still fails if CORS rejects it.

Latest combined live result: video passed; image reached the end of its real
storage/publication/viewer checks but failed the explicit browser-CORS assertion.
The labelled R2 object and Stream clip were cleaned up. No production MongoDB
records, existing Stream protections or R2 public-access settings were modified.
Runtime evidence is in `/tmp/info-cards-trial-live-verified/` (local-only traces);
rerunning requires explicit permission for live disposable provider assets.

### Required CORS rule for local trial use

In Cloudflare R2 → `path-assets` → Settings → CORS Policy, **append** this rule
to the existing JSON array; preserve other rules. These are application origins,
not R2 delivery domains. Add the actual deployed application origin separately
when enabling hosted use. The LAN address below was observed on this Mac and may
change with Wi-Fi/DHCP; each origin includes its exact port.

```json
{
  "AllowedOrigins": [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.38:3000"
  ],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": [
    "Content-Type",
    "If-None-Match",
    "x-amz-meta-creator",
    "x-amz-meta-info-card-id"
  ],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

Do not change bucket public access, existing video protection or the private-media
verification acknowledgement to resolve CORS. See Cloudflare's
[CORS instructions](https://developers.cloudflare.com/r2/buckets/cors/).
