# Existing-account backfill: manifest schema and example

The real manifest names real accounts and is **private data**: keep it out of Git. This file documents the format only. Nothing in this repository has been run against a live database.

## Format (`--manifest <file>`, JSON)

```json
{
  "manifestId": "2026-11-live-1",
  "reviewedBy": "founder",
  "reviewedAt": "2026-11-20T09:00:00Z",
  "accounts": [
    { "userId": "<24-hex _id>", "publicPublishing": true, "currentPublicPublishing": "missing" },
    { "userId": "<24-hex _id>", "publicPublishing": false, "currentPublicPublishing": false },
    {
      "userId": "<24-hex _id>", "publicPublishing": false, "currentPublicPublishing": "missing",
      "safeguarding": { "dateOfBirth": "2011-04-02" },
      "puckle": { "name": "Aoife", "registrationCategory": "student", "mobile": "087 123 4567",
                  "education": { "course": "a-level", "courseOther": "", "level": null, "levelOther": "" } }
    }
  ]
}
```

- **Every existing account must appear** with an explicit `publicPublishing` (true or false). `null`, a missing value, or an unlisted account refuses the whole run. Nothing is inferred from account age, teacher status or `isAdmin`.
- `currentPublicPublishing` is a precondition: the state you reviewed (`"missing"`, `true` or `false`). If the database differs at apply time, the run is refused. A malformed `permissions` value (null, array, extra keys, non-boolean) is always a conflict needing an individual decision.
- Identity: `userId` is required to apply. `email` or `username` may be used in a dry run, which reports the unique resolution; put the resolved `userId` in the manifest before applying.
- `safeguarding` (optional, selected accounts): `dateOfBirth` is recorded as `operator-entered` with assurance `none`. `dobSource: "self-declared"` needs `selfDeclarationProvenance`. Independent assurance needs `ageAssurance {verification: "independent", method, verifiedAt, evidenceReference}`. A different recorded date is a conflict unless `expectedDateOfBirth` names it and `correction {actor, reason}` is supplied (history is appended and old assurance invalidated). Missing DOB stays missing.
- `puckle` (optional, selected accounts): creates one profile (`initialRegistrationSource: "unknown"`, `provisioning: known-account-backfill`, `welcome.eligible: false`). An existing different profile is never overwritten. A-level means `level: null`. Incomplete student facts may be omitted.
- Unknown fields are rejected, so the manifest cannot set `isAdmin`, credentials, sessions, learning data or approvals.

## Commands

```
npm run backfill:known-puckle-users -- --assess                       # read-only draft for you to complete (no emails/credentials)
npm run backfill:known-puckle-users -- --manifest m.json              # dry run (default); exit 2 if blockers
npm run backfill:known-puckle-users -- --manifest m.json --apply      # disposable databases only
npm run backfill:known-puckle-users -- --manifest m.json --apply --confirm-live <manifestId>   # live: production mode + exact manifest id
```

Each applied account gets a minimal `users.membershipBackfill {manifestId, entryDigest, appliedAt}` receipt in the same transaction. A rerun is a no-op while the reviewed values still hold; if a grant or fact has since changed it reports drift and refuses, never overwriting a later decision.
