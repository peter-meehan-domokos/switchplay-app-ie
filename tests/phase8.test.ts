import assert from "node:assert/strict";
import { test } from "node:test";
import { BSON } from "mongodb";
import { assertApplicationDatabase, assertProductionDatabase } from "../src/lib/applicationDatabase";
import { createPhase8Plan, decodeBsonFile, documentSetHash, preservationExceptions, validatePhase8Plan } from "../scripts/migration/phase8";
import { phase8Fixture } from "./fixtures/phase8";

test("production is explicit, host/database bound, TLS safe and incompatible with mock providers", () => {
  const env = { SWITCHPLAY_DATABASE_MODE: "production", MONGODB_URI: "mongodb+srv://fixture:fixture@approved.mongodb.net/switchplay", MONGODB_DB: "switchplay", SWITCHPLAY_ATLAS_HOST: "approved.mongodb.net", NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1" };
  assert.doesNotThrow(() => assertApplicationDatabase(env));
  for (const changed of [{ SWITCHPLAY_DATABASE_MODE: "disposable" }, { MONGODB_DB: "legacy" }, { SWITCHPLAY_ATLAS_HOST: "other.mongodb.net" }, { PHASE2_MEDIA_FIXTURE_ORIGIN: "http://127.0.0.1:1" }, { NEXT_PUBLIC_PHASE2_MOCK_MEDIA: "1" }, { NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "0" }]) assert.throws(() => assertApplicationDatabase({ ...env, ...changed }));
  assert.throws(() => assertApplicationDatabase({ ...env, SWITCHPLAY_DATABASE_MODE: undefined }));
  for (const uri of ["mongodb://127.0.0.1/switchplay", ...["tls=false", "TLS=false", "SSL=FALSE", "tlsInsecure=true", "TLSINSECURE=TRUE", "tlsAllowInvalidCertificates=true", "TLSALLOWINVALIDHOSTNAMES=true", "tls=true&TLS=false"].map((query) => env.MONGODB_URI + "?" + query)]) assert.throws(() => assertProductionDatabase(uri, "switchplay", env.SWITCHPLAY_ATLAS_HOST));
  assert.doesNotThrow(() => assertProductionDatabase(env.MONGODB_URI + "?TLS=true", "switchplay", env.SWITCHPLAY_ATLAS_HOST));
  assert.doesNotThrow(() => assertApplicationDatabase({ ...env, SWITCHPLAY_DATABASE_MODE: "disposable", MONGODB_URI: "mongodb://127.0.0.1:27017", MONGODB_DB: "switchplay_phase2_owned", PHASE2_MEDIA_FIXTURE_ORIGIN: "http://127.0.0.1:1" }));
});
test("BSON dump decoding preserves identities/dates and refuses truncation", () => {
  const value = { _id: new BSON.ObjectId(), date: new Date(), reading: new BSON.Long(123) };
  const bytes = Buffer.from(BSON.serialize(value));
  assert.deepEqual(decodeBsonFile(Buffer.concat([bytes, bytes])).map((d) => d._id.toHexString()), [value._id.toHexString(), value._id.toHexString()]);
  assert.equal(decodeBsonFile(bytes)[0].date.getTime(), value.date.getTime());
  assert.throws(() => decodeBsonFile(bytes.subarray(0, bytes.length - 1)), { code: "INVALID_BACKUP_BSON" });
  assert.throws(() => decodeBsonFile(Buffer.from([1, 2])), { code: "INVALID_BACKUP_BSON" });
});
test("offline plan keeps mappings, all ancillary BSON identities, original data and accepted backup risk", async () => {
  const backup = await phase8Fixture(), before = documentSetHash(backup.sources.users);
  const plan = createPhase8Plan("/fixture-backup", backup);
  validatePhase8Plan(plan); assert.equal(plan.backupRestoreVerified, false);
  assert.equal(documentSetHash(backup.sources.users), before);
  assert.equal(createPhase8Plan("/fixture-backup", backup, plan), plan);
  assert.deepEqual(plan.ancillary.earlyAccessSignups, backup.sources.earlyAccessSignups);
  assert.equal(plan.migration.targets.users[0]._id.toHexString(), backup.sources.users[0]._id.toHexString());
  assert.equal(plan.migration.counts.personalMedia, 3);
  assert.equal(documentSetHash([...backup.sources.users].reverse()), before);
  plan.ancillary.earlyAccessSignups[0].fixture = "tampered";
  assert.throws(() => validatePhase8Plan(plan), { code: "INVALID_PHASE8_PLAN" });
});
test("unexpected counts, meaningful drafts and modern personal state require review", async () => {
  const backup = await phase8Fixture(); backup.sources.deckTemplates[0].savedTemplate = { title: "Unpublished" };
  assert.equal(preservationExceptions(backup.sources)[0].deckTemplateId, "deck-1");
  assert.throws(() => createPhase8Plan("/fixture", backup), { code: "OUTSTANDING_DRAFT_REQUIRES_DECISION" });
  delete backup.sources.deckTemplates[0].savedTemplate;
  backup.sources.users[0].cardsData = [];
  assert.throws(() => createPhase8Plan("/fixture", backup), { code: "NEW_SCHEMA_OR_ITEM_TESTS_REQUIRE_DECISION" });
  delete backup.sources.users[0].cardsData; backup.sources.users.pop();
  assert.throws(() => createPhase8Plan("/fixture", backup), { code: "UNEXPECTED_BACKUP_COUNTS" });
});
test("only the explicitly discarded demo illustration is omitted; originals and uploaded media remain intact", async () => {
  const backup = await phase8Fixture();
  backup.sources.users[0].decksData[0].cards[0].mediaItems.push({ id: "old-demo", mediaType: "image", description: "demo", src: "/images/media-traces/gym-trace-01.png" });
  const before = documentSetHash(backup.sources.users);
  const plan = createPhase8Plan("/fixture", backup);
  assert.equal(plan.discardedMockMediaReferences, 1);
  assert.equal(plan.migration.counts.personalMedia, 3);
  assert.equal(documentSetHash(backup.sources.users), before);
  assert.equal(backup.sources.users[0].decksData[0].cards[0].mediaItems.at(-1).id, "old-demo");
});
