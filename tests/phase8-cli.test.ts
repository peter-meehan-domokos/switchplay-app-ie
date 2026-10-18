import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BSON } from "mongodb";
import { main } from "../scripts/prepare-phase8";
import { ORIGINAL_COLLECTIONS } from "../scripts/migration/phase8";
import { phase8Fixture } from "./fixtures/phase8";

test("offline CLI reads dump without changing it, preserves plan IDs and refuses unconfirmed/incorrect Atlas execution", async (t) => {
  t.mock.method(console, "log", () => {}); t.mock.method(console, "error", () => {});
  const source = await mkdtemp(join(tmpdir(), "switchplay-phase8-dump-"));
  await mkdir("migration-plans", { recursive: true });
  const target = await mkdtemp(join("migration-plans", "phase8-cli-test-"));
  t.after(async () => { await rm(source, { recursive: true, force: true }); await rm(target, { recursive: true, force: true }); });
  const fixture = await phase8Fixture();
  for (const name of ORIGINAL_COLLECTIONS) {
    await writeFile(join(source, `${name}.bson`), Buffer.concat(fixture.sources[name].map((d) => Buffer.from(BSON.serialize(d)))));
    await writeFile(join(source, `${name}.metadata.json`), JSON.stringify({ indexes: fixture.indexes[name] }));
  }
  const original = await readFile(join(source, "users.bson"));
  const output = join(target, "plan.ejson"), options = ["--backup", source, "--output", output];
  assert.equal(await main(["--plan", ...options], {}), 0);
  const plan = await readFile(output);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  assert.equal(await main(["--plan", ...options], {}), 0);
  assert.deepEqual(await readFile(output), plan);
  assert.deepEqual(await readFile(join(source, "users.bson")), original);
  assert.equal(await main(["--execute", ...options], {}), 1);
  assert.equal(await main(["--execute", ...options, "--confirm", "switchplay"], { PHASE8_ATLAS_URI: "mongodb+srv://fixture@wrong.example.invalid", PHASE8_ATLAS_HOST: "approved.mongodb.net" }), 1);
  assert.equal(await main(["--plan", "--backup", join(source, "missing"), "--output", output], {}), 1);
});
