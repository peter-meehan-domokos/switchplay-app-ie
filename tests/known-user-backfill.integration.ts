import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { preparePuckleMembership } from "../scripts/prepare-puckle-membership";
import { applyBackfill, assessAccounts, parseManifest, planBackfill, type Manifest, type ManifestEntry } from "../src/lib/knownUserBackfill";
import { requirePublicPublishing } from "../src/lib/userPermissions";
import { withMongoTransaction } from "../src/lib/mongodb";

let server: MongoMemoryReplSet, client: MongoClient, db: Db;
const T0 = new Date("2026-11-15T09:00:00Z"), LATER = new Date("2026-11-16T09:00:00Z");
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(server.getUri()).connect(); db = client.db("switchplay_test_backfill");
});
after(async () => { await client?.close(); await server?.stop(); });
async function reset() {
  for (const name of ["users", "puckleMemberships", "cardTemplateVersions", "deckTemplateVersions", "infoCardVersions"]) await db.collection(name).deleteMany({});
  await preparePuckleMembership(db);
}
const hash = bcrypt.hashSync("legacy secret", 4);
async function legacy(name: string, extra: Record<string, unknown> = {}) {
  const _id = new ObjectId();
  await db.collection("users").insertOne({ _id, email: `${name.toLowerCase()}@example.invalid`, username: name, passwordHash: hash, sessionVersion: 3, publicPublishingRevision: 7, isAdmin: name === "Admin",
    cardsData: [{ cardTemplateId: `c-${name}`, progress: [1, 2, 3] }], decksData: [{ deckTemplateId: `d-${name}` }], sharedDeckData: [{ deckTemplateId: "s", deckUserId: "u" }],
    createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-06-01"), ...extra });
  return _id;
}
const manifest = (accounts: ManifestEntry[], id = "live-1"): Manifest => ({ manifestId: id, reviewedBy: "founder", reviewedAt: "2026-11-15T08:00:00Z", accounts });
const ok = (m: Manifest) => { const parsed = parseManifest(m); assert.deepEqual(parsed.problems, []); return parsed.manifest; };
const dump = async () => JSON.stringify(await Promise.all(["users", "puckleMemberships"].map(name => db.collection(name).find().sort({ _id: 1 }).toArray())));
const user = async (id: ObjectId) => (await db.collection("users").findOne({ _id: id }))!;
const strip = (doc: Record<string, unknown>) => { const { permissions, safeguarding, membershipBackfill, ...rest } = doc; void permissions; void safeguarding; void membershipBackfill; return rest; };

test("assessment is read-only, lists every account with evidence and offers no disposition", async () => {
  await reset(); const a = await legacy("Alice"), b = await legacy("Bob", { permissions: { publicPublishing: true } }); await legacy("Cara", { permissions: [{ publicPublishing: true }] });
  await db.collection("cardTemplateVersions").insertOne({ cardTemplateId: "c-Alice", version: 1, visibility: "public", publishedByUserId: a.toHexString(), publishedAt: T0 });
  await db.collection("cardTemplateVersions").insertOne({ cardTemplateId: "c-Bob", version: 1, visibility: "private", publishedByUserId: b.toHexString(), publishedAt: T0 });
  const before = await dump(), draft = await assessAccounts(db);
  assert.equal(await dump(), before);
  assert.deepEqual(draft.accounts.map(row => [row.username, row.publicPublishing, row.currentPublicPublishing]), [["Alice", null, "missing"], ["Bob", null, true], ["Cara", null, "MALFORMED: decide individually"]]);
  assert.deepEqual(draft.accounts[0].evidence.publicVersionsPublished, { cards: 1, decks: 0, infoCards: 0 }); assert.equal(draft.accounts[1].evidence.publicVersionsPublished.cards, 0, "private versions are not evidence");
  assert.ok(!JSON.stringify(draft).match(/example\.invalid|passwordHash|\$2/), "no emails or credentials in the review sheet");
  assert.ok(parseManifest(draft).problems.length > 0, "the draft cannot be applied until a person decides");
});
test("dry-run changes nothing and reports each account; email/username resolution is reported but cannot be applied", async () => {
  await reset(); const a = await legacy("Alice"), b = await legacy("Bob", { permissions: { publicPublishing: false } });
  const entries: ManifestEntry[] = [{ userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }, { username: "Bob", publicPublishing: false, currentPublicPublishing: false }];
  const before = await dump(), plan = await planBackfill(db, ok(manifest(entries)), T0);
  assert.equal(await dump(), before); assert.deepEqual(plan.items.map(item => item.status), ["apply", "apply"]); assert.equal(plan.blockers.length, 0);
  assert.match(plan.items[0].actions.join(), /missing -> true/); assert.match(plan.items[1].actions.join(), /already false/);
  await assert.rejects(applyBackfill(db, client, ok(manifest(entries)), T0), /BACKFILL_REFUSED/); assert.equal(await dump(), before, "an email/username-only entry is never applied");
  void b;
});
test("apply: every existing account gets an explicit disposition; only permitted fields change; identities, credentials, sessions and learning data are untouched", async () => {
  await reset();
  const trusted = await legacy("Trusted"), reviewedFalse = await legacy("Other", { permissions: { publicPublishing: false } }), admin = await legacy("Admin"), teacher = await legacy("Teacher", { permissions: { publicPublishing: true } });
  const publication = { cardTemplateId: "c-Trusted", version: 1, visibility: "public", publishedByUserId: trusted.toHexString(), publishedAt: T0 };
  await db.collection("cardTemplateVersions").insertOne({ ...publication });
  const before = new Map(await Promise.all([trusted, reviewedFalse, admin, teacher].map(async id => [id.toHexString(), await user(id)] as const)));
  const accounts: ManifestEntry[] = [
    { userId: trusted.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" },
    { userId: reviewedFalse.toHexString(), publicPublishing: false, currentPublicPublishing: false },
    { userId: admin.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" },
    { userId: teacher.toHexString(), publicPublishing: true, currentPublicPublishing: true, puckle: { name: "Ms Teacher", registrationCategory: "teacher", teacherIntroduction: "Maths, 5th year" } },
  ];
  const result = await applyBackfill(db, client, ok(manifest(accounts)), T0); assert.equal(result.applied, 4);
  for (const [key, original] of before) {
    const after = await user(new ObjectId(key));
    assert.deepEqual(strip(after), strip(original), `${key}: nothing but permissions, safeguarding and the receipt may change`);
    assert.equal(after.passwordHash, hash); assert.equal(after.sessionVersion, 3); assert.equal(after.publicPublishingRevision, 7, "the internal publication counter is never reset");
    assert.deepEqual(after.membershipBackfill, { manifestId: "live-1", entryDigest: result.items.find(item => item.userId === key)!.digest, appliedAt: T0 });
  }
  assert.deepEqual([(await user(trusted)).permissions, (await user(reviewedFalse)).permissions, (await user(admin)).permissions, (await user(teacher)).permissions],
    [{ publicPublishing: true }, { publicPublishing: false }, { publicPublishing: false }, { publicPublishing: true }], "isAdmin is not trust");
  assert.equal(await db.collection("users").countDocuments(), 4, "no account was created");
  assert.equal(await db.collection("puckleMemberships").countDocuments({ userId: { $ne: teacher } }), 0, "unselected accounts acquire no Puckle profile");
  const profile = (await db.collection("puckleMemberships").findOne({ userId: teacher }))!;
  assert.deepEqual([profile.registrationCategory, profile.initialRegistrationSource, profile.welcome, profile.provisioning.method, profile.provisioning.recordedBy, profile.teacherIntroduction], ["teacher", "unknown", { eligible: false }, "known-account-backfill", "founder", "Maths, 5th year"]);
  const cardPublication = (await db.collection("cardTemplateVersions").findOne({ cardTemplateId: "c-Trusted" }))!; assert.deepEqual({ ...cardPublication, _id: undefined }, { ...publication, _id: undefined }, "existing public versions are never reclassified");
});
test("the 2P guard honours the reviewed grants immediately, without re-login", async () => {
  await reset(); const yes = await legacy("Yes"), no = await legacy("No"), odd = await legacy("Odd", { permissions: "true" });
  await applyBackfill(db, client, ok(manifest([{ userId: yes.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }, { userId: no.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }])), T0).catch(error => assert.match(String(error), /REFUSED/));
  assert.equal((await user(yes)).permissions, undefined, "refused whole run: the unresolved malformed account blocks everything");
  await db.collection("users").updateOne({ _id: odd }, { $set: { permissions: { publicPublishing: false } } });
  await applyBackfill(db, client, ok(manifest([{ userId: yes.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }, { userId: no.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }, { userId: odd.toHexString(), publicPublishing: false, currentPublicPublishing: false }])), T0);
  const allowed = (id: ObjectId) => withMongoTransaction(client, session => requirePublicPublishing(db, id.toHexString(), session));
  await allowed(yes); await assert.rejects(allowed(no), /PUBLIC_PUBLISHING_FORBIDDEN/);
  await db.collection("users").updateOne({ _id: no }, { $set: { "permissions.publicPublishing": true } }); await allowed(no);
});
test("anything unresolved refuses the WHOLE run before a single write: unlisted account, missing id, wrong expectation, malformed record", async () => {
  await reset(); const a = await legacy("Alice"), b = await legacy("Bob"), odd = await legacy("Odd", { permissions: null });
  const good: ManifestEntry = { userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" };
  const cases: [string, ManifestEntry[], RegExp][] = [
    ["unlisted", [good], /no reviewed permission disposition/],
    ["missing account", [good, { userId: b.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }, { userId: odd.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }, { userId: "f".repeat(24), publicPublishing: true, currentPublicPublishing: "missing" }], /no account has this id/],
    ["wrong expectation", [good, { userId: b.toHexString(), publicPublishing: false, currentPublicPublishing: true }, { userId: odd.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }], /expects true/],
    ["malformed", [good, { userId: b.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }, { userId: odd.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }], /malformed/],
  ];
  const before = await dump();
  for (const [label, accounts, pattern] of cases) {
    await assert.rejects(applyBackfill(db, client, ok(manifest(accounts)), T0), error => /BACKFILL_REFUSED/.test(String(error)) && pattern.test((error as { plan: { blockers: string[] } }).plan.blockers.join(" | ")), label);
    assert.equal(await dump(), before, `${label}: zero writes`);
  }
});
test("repeat execution is a safe no-op; it creates no duplicate profile or history", async () => {
  await reset(); const a = await legacy("Alice", { safeguarding: { dateOfBirth: "2011-01-01", dobSource: "operator-entered", ageAssurance: { verification: "none" } } });
  const accounts: ManifestEntry[] = [{ userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing", puckle: { name: "Alice", registrationCategory: "student", education: { course: "gcse", courseOther: "", level: "higher-tier", levelOther: "" } }, safeguarding: { dateOfBirth: "2011-01-01" } }];
  await applyBackfill(db, client, ok(manifest(accounts)), T0); const once = await dump();
  const again = await applyBackfill(db, client, ok(manifest(accounts)), LATER);
  assert.deepEqual(again.items.map(item => item.status), ["already-applied"]); assert.equal(again.applied, 0); assert.equal(await dump(), once, "byte-for-byte identical");
  assert.equal(await db.collection("puckleMemberships").countDocuments({ userId: a }), 1); assert.deepEqual((await user(a)).safeguarding.dateOfBirthHistory, undefined);
});
test("drift after apply: a later direct revocation or grant is refused, never reapplied over", async () => {
  await reset(); const a = await legacy("Alice"), b = await legacy("Bob");
  const accounts: ManifestEntry[] = [{ userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }, { userId: b.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }];
  await applyBackfill(db, client, ok(manifest(accounts)), T0);
  await db.collection("users").updateOne({ _id: a }, { $set: { "permissions.publicPublishing": false } }); await db.collection("users").updateOne({ _id: b }, { $set: { "permissions.publicPublishing": true } });
  const before = await dump();
  await assert.rejects(applyBackfill(db, client, ok(manifest(accounts)), LATER), error => /drift/.test((error as { plan: { blockers: string[] } }).plan.blockers.join()));
  assert.equal(await dump(), before); assert.deepEqual([(await user(a)).permissions, (await user(b)).permissions], [{ publicPublishing: false }, { publicPublishing: true }]);
  const reviewed = (await planBackfill(db, ok(manifest([{ ...accounts[0], publicPublishing: false }, accounts[1]])), LATER)).items[0];
  assert.equal(reviewed.status, "conflict", "changed instructions for an applied account also need a new review");
});
test("date of birth: unknown stays unknown; recorded honestly; mismatch is a conflict; a reviewed correction keeps history and invalidates assurance", async () => {
  await reset();
  const unknown = await legacy("Unknown"), fresh = await legacy("Fresh"), same = await legacy("Same", { safeguarding: { dateOfBirth: "2012-05-05", dobSource: "self-declared", ageAssurance: { verification: "none" } } });
  const differs = await legacy("Differs", { safeguarding: { dateOfBirth: "2010-01-01", dobSource: "operator-entered", ageAssurance: { verification: "independent", method: "doc", verifiedAt: T0, evidenceReference: "r1" } } });
  const approval = { scopeId: "shared-group-experiences", status: "approved", generation: 1, guardianEmail: "g@example.invalid", history: [{ kind: "approved" }] };
  await db.collection("users").updateOne({ _id: same }, { $set: { "safeguarding.groupExperienceApproval": approval } });
  const e = (id: ObjectId, over: Partial<ManifestEntry> = {}): ManifestEntry => ({ userId: id.toHexString(), publicPublishing: false, currentPublicPublishing: "missing", ...over });
  const mismatch = manifest([e(unknown), e(fresh, { safeguarding: { dateOfBirth: "2011-03-03" } }), e(same, { safeguarding: { dateOfBirth: "2012-05-05" } }), e(differs, { safeguarding: { dateOfBirth: "2009-09-09" } })]);
  const blocked = await planBackfill(db, ok(mismatch), T0); assert.match(blocked.items[3].conflicts.join(), /explicit reviewed correction/); assert.equal(blocked.items[3].status, "conflict");
  const accounts = [e(unknown), e(fresh, { safeguarding: { dateOfBirth: "2011-03-03" } }), e(same, { safeguarding: { dateOfBirth: "2012-05-05" } }),
    e(differs, { safeguarding: { dateOfBirth: "2009-09-09", expectedDateOfBirth: "2010-01-01", correction: { actor: "founder", reason: "parent supplied a corrected birth certificate date" } } })];
  await applyBackfill(db, client, ok(manifest(accounts)), T0);
  assert.equal((await user(unknown)).safeguarding, undefined, "missing DOB stays missing");
  assert.deepEqual({ ...(await user(fresh)).safeguarding, dobRecordedAt: undefined }, { dateOfBirth: "2011-03-03", dobSource: "operator-entered", ageAssurance: { verification: "none" }, dobRecordedAt: undefined });
  assert.equal((await user(fresh)).safeguarding.dobRecordedAt.getTime(), T0.getTime());
  const kept = (await user(same)).safeguarding; assert.deepEqual([kept.dobSource, kept.groupExperienceApproval], ["self-declared", approval], "existing source and approval evidence preserved");
  const corrected = (await user(differs)).safeguarding;
  assert.deepEqual([corrected.dateOfBirth, corrected.ageAssurance, corrected.dateOfBirthHistory.length], ["2009-09-09", { verification: "none" }, 1]);
  assert.deepEqual([corrected.dateOfBirthHistory[0].previous, corrected.dateOfBirthHistory[0].actor, corrected.dateOfBirthHistory[0].invalidatedAssurance.verification], ["2010-01-01", "founder", "independent"]);
});
test("a wrong or missing expectation for a correction is a conflict; independent evidence and self-declaration are only recorded when supplied", async () => {
  await reset(); const a = await legacy("Alice", { safeguarding: { dateOfBirth: "2010-01-01", dobSource: "operator-entered", ageAssurance: { verification: "none" } } }), b = await legacy("Bob"), c = await legacy("Cara");
  const evidence = { verification: "independent" as const, method: "school record", verifiedAt: "2026-10-01T00:00:00Z", evidenceReference: "case-12" };
  const wrongExpectation = await planBackfill(db, ok(manifest([{ userId: a.toHexString(), publicPublishing: false, currentPublicPublishing: "missing", safeguarding: { dateOfBirth: "2009-01-01", expectedDateOfBirth: "2008-08-08", correction: { actor: "f", reason: "r" } } }])), T0);
  assert.match(wrongExpectation.items[0].conflicts.join(), /does not name the recorded date/);
  const expectsOne = await planBackfill(db, ok(manifest([{ userId: b.toHexString(), publicPublishing: false, currentPublicPublishing: "missing", safeguarding: { dateOfBirth: "2009-01-01", expectedDateOfBirth: "2008-08-08" } }])), T0);
  assert.match(expectsOne.items[0].conflicts.join(), /expects an existing date/);
  await applyBackfill(db, client, ok(manifest([{ userId: a.toHexString(), publicPublishing: false, currentPublicPublishing: "missing", safeguarding: { dateOfBirth: "2010-01-01", ageAssurance: evidence } },
    { userId: b.toHexString(), publicPublishing: false, currentPublicPublishing: "missing", safeguarding: { dateOfBirth: "2011-11-11", dobSource: "self-declared", selfDeclarationProvenance: "old signup form" } },
    { userId: c.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }])), T0);
  assert.deepEqual([(await user(a)).safeguarding.ageAssurance.verification, (await user(a)).safeguarding.ageAssurance.evidenceReference], ["independent", "case-12"]);
  assert.deepEqual([(await user(b)).safeguarding.dobSource, (await user(b)).safeguarding.ageAssurance], ["self-declared", { verification: "none" }]);
});
test("Puckle profiles: A-level is null, incomplete student facts stay unknown, an existing different profile is never overwritten, duplicates are impossible", async () => {
  await reset(); const alevel = await legacy("Alevel"), partial = await legacy("Partial"), existing = await legacy("Existing");
  await db.collection("puckleMemberships").insertOne({ userId: existing, name: "Real Name", registrationCategory: "student", mobile: null, initialRegistrationSource: "join", welcome: { eligible: true }, createdAt: T0, updatedAt: T0 });
  const entry = (id: ObjectId, puckle: ManifestEntry["puckle"]): ManifestEntry => ({ userId: id.toHexString(), publicPublishing: false, currentPublicPublishing: "missing", puckle });
  const conflict = await planBackfill(db, ok(manifest([entry(existing, { name: "Different", registrationCategory: "student" })])), T0);
  assert.match(conflict.items[0].conflicts.join(), /will not be overwritten/);
  await applyBackfill(db, client, ok(manifest([entry(alevel, { name: "Ann", registrationCategory: "student", mobile: "087 123 4567", education: { course: "a-level", courseOther: "", level: null, levelOther: "" } }),
    entry(partial, { name: "Pat", registrationCategory: "student" }), { userId: existing.toHexString(), publicPublishing: false, currentPublicPublishing: "missing", puckle: { name: "Real Name", registrationCategory: "student" } }])), T0);
  const a = (await db.collection("puckleMemberships").findOne({ userId: alevel }))!; assert.deepEqual([a.education, a.mobile], [{ course: "a-level", courseOther: null, level: null, levelOther: null }, "+353871234567"]);
  assert.equal((await db.collection("puckleMemberships").findOne({ userId: partial }))!.education, undefined);
  const kept = (await db.collection("puckleMemberships").findOne({ userId: existing }))!; assert.deepEqual([kept.welcome, kept.initialRegistrationSource], [{ eligible: true }, "join"], "an existing real profile is untouched");
  assert.equal(await db.collection("puckleMemberships").countDocuments(), 3);
});
test("a concurrent personal-data write is never lost, and credentials/IDs/learning fields match before and after", async () => {
  await reset(); const a = await legacy("Alice"); const before = await user(a);
  const writes = Promise.all(Array.from({ length: 12 }, (_, index) => db.collection("users").updateOne({ _id: a }, { $push: { cardsData: { cardTemplateId: `new-${index}` } } as never })));
  const [, result] = await Promise.all([writes, applyBackfill(db, client, ok(manifest([{ userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }])), T0)]);
  assert.equal(result.applied, 1); const after = await user(a);
  assert.equal(after.cardsData.length, 1 + 12, "every concurrent learning write survived"); assert.deepEqual(after.decksData, before.decksData);
  assert.deepEqual([after._id, after.username, after.email, after.passwordHash, after.sessionVersion], [before._id, before.username, before.email, before.passwordHash, before.sessionVersion]);
  assert.deepEqual(after.permissions, { publicPublishing: true });
});
test("legacy credentials still verify and legacy sessions stay valid after backfill (version unchanged)", async () => {
  await reset(); const a = await legacy("Alice");
  await applyBackfill(db, client, ok(manifest([{ userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }])), T0);
  const after = await user(a); assert.equal(await bcrypt.compare("legacy secret", after.passwordHash), true); assert.equal(after.sessionVersion, 3);
  assert.equal(after.emailVerifiedAt, undefined, "email and age are never marked verified because the founder knows the person");
});
test("command line: assess and dry-run are read-only, apply works on a disposable database and a stale or broken manifest never writes", async () => {
  const { writeFile, mkdtemp } = await import("node:fs/promises"), { tmpdir } = await import("node:os"), { join } = await import("node:path"), { main } = await import("../scripts/backfill-known-puckle-users");
  await reset(); const a = await legacy("Alice"), b = await legacy("Bob");
  Object.assign(process.env, { MONGODB_URI: server.getUri(), MONGODB_DB: "switchplay_test_backfill", SWITCHPLAY_DATABASE_MODE: "disposable" });
  const fresh = () => { (globalThis as { mongoClientPromise?: unknown }).mongoClientPromise = undefined; };
  const run = async (args: string[]) => { fresh(); const logs: string[] = [], errors: string[] = [], log = console.log, error = console.error;
    console.log = (...parts) => void logs.push(parts.join(" ")); console.error = (...parts) => void errors.push(parts.join(" "));
    try { return { code: await main(args), out: logs.join("\n"), err: errors.join("\n") }; } finally { console.log = log; console.error = error; } };
  const dir = await mkdtemp(join(tmpdir(), "backfill-")), file = join(dir, "m.json"), before = await dump();
  const assessed = await run(["--assess"]); assert.equal(assessed.code, 0); assert.equal(JSON.parse(assessed.out).accounts.length, 2); assert.equal(await dump(), before);
  await writeFile(file, JSON.stringify({ manifestId: "cli-1", reviewedBy: "founder", reviewedAt: "2026-11-15T00:00:00Z", accounts: [{ userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }] }));
  const partial = await run(["--manifest", file]); assert.equal(partial.code, 2); assert.match(partial.out, /UNLISTED/); assert.equal(await dump(), before);
  const refused = await run(["--manifest", file, "--apply"]); assert.equal(refused.code, 2); assert.match(refused.err, /BACKFILL_REFUSED/); assert.equal(await dump(), before);
  await writeFile(file, JSON.stringify({ manifestId: "cli-1", accounts: [{ userId: a.toHexString(), publicPublishing: null }] }));
  const invalid = await run(["--manifest", file, "--apply"]); assert.equal(invalid.code, 1); assert.match(invalid.err, /MANIFEST_INVALID/); assert.equal(await dump(), before);
  await writeFile(file, JSON.stringify({ manifestId: "cli-1", reviewedBy: "founder", reviewedAt: "2026-11-15T00:00:00Z", accounts: [{ userId: a.toHexString(), publicPublishing: true, currentPublicPublishing: "missing" }, { userId: b.toHexString(), publicPublishing: false, currentPublicPublishing: "missing" }] }));
  const dry = await run(["--manifest", file]); assert.equal(dry.code, 0); assert.match(dry.out, /No blockers/); assert.equal(await dump(), before);
  const applied = await run(["--manifest", file, "--apply"]); assert.equal(applied.code, 0); assert.match(applied.out, /Applied 2 account/);
  assert.deepEqual([(await user(a)).permissions, (await user(b)).permissions], [{ publicPublishing: true }, { publicPublishing: false }]);
  assert.equal((await run(["--help"])).code, 0); assert.equal((await run([])).code, 1);
  fresh();
});
test("isAdmin dispositions: grant, revoke and confirm with exact preconditions; nothing else changes; reruns refuse drift", async () => {
  await reset();
  const missing = await legacy("Peter"); await db.collection("users").updateOne({ _id: missing }, { $unset: { isAdmin: "" } }); // a legacy account with no isAdmin field
  const granted = await legacy("Admin"), revoke = await legacy("Investigator", { isAdmin: true }), keepFalse = await legacy("Simeon", { isAdmin: false });
  const originals = new Map(await Promise.all([missing, granted, revoke, keepFalse].map(async id => [id.toHexString(), await user(id)] as const)));
  const entry = (id: ObjectId, isAdmin: boolean, currentIsAdmin: "missing" | boolean): ManifestEntry => ({ userId: id.toHexString(), publicPublishing: true, currentPublicPublishing: "missing", isAdmin, currentIsAdmin });
  // "Admin" fixture is created with isAdmin true by the helper.
  const wrong = await planBackfill(db, ok(manifest([entry(missing, true, false), entry(granted, true, true), entry(revoke, false, true), entry(keepFalse, false, false)])), T0);
  assert.match(wrong.items[0].conflicts.join(), /current isAdmin is missing but the manifest expects false/);
  const accounts = [entry(missing, true, "missing"), entry(granted, true, true), entry(revoke, false, true), entry(keepFalse, false, false)];
  const plan = await planBackfill(db, ok(manifest(accounts)), T0);
  assert.deepEqual(plan.items.map(item => item.actions.find(action => action.startsWith("isAdmin"))), ["isAdmin: missing -> true", "isAdmin already true; unchanged", "isAdmin: true -> false", "isAdmin already false; unchanged"]);
  await applyBackfill(db, client, ok(manifest(accounts)), T0);
  assert.deepEqual(await Promise.all([missing, granted, revoke, keepFalse].map(async id => (await user(id)).isAdmin)), [true, true, false, false]);
  for (const [key, original] of originals) { const { isAdmin: a, ...after } = strip(await user(new ObjectId(key))); const { isAdmin: b, ...before } = strip(original); void a; void b; assert.deepEqual(after, before); }
  await db.collection("users").updateOne({ _id: revoke }, { $set: { isAdmin: true } }); // a later direct change
  await assert.rejects(applyBackfill(db, client, ok(manifest(accounts)), LATER), error => /drift/.test((error as { plan: { blockers: string[] } }).plan.blockers.join()));
  assert.equal((await user(revoke)).isAdmin, true, "never reapplied over a later decision");
});
