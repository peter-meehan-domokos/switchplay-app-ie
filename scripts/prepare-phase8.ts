import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { BSON, MongoClient } from "mongodb";
import { assertProductionDatabase } from "../src/lib/applicationDatabase";
import { requireCondition } from "../src/lib/cards/domain";
import { createPhase8Plan, executePhase8, readBackup, validatePhase8Plan, verifyPhase8, type Phase8Plan } from "./migration/phase8";

export async function main(args = process.argv.slice(2), env: Record<string, string | undefined> = process.env) {
  let client: MongoClient | undefined;
  let statusPath: string | undefined;
  try {
    if (args.includes("--help")) {
      console.log("Offline: --plan --backup DIRECTORY --output migration-plans/phase8/plan.ejson\nAtlas (separate explicit approval): --execute|--verify --backup DIRECTORY --output PLAN --confirm switchplay\nAtlas requires PHASE8_ATLAS_URI and PHASE8_ATLAS_HOST. Execute renames originals; verify is read-only. No .env file is loaded automatically. Backup restoration is not required or claimed.");
      return 0;
    }
    const flags = new Map<string, string>(); let operation: "plan" | "execute" | "verify" | undefined;
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (["--plan", "--execute", "--verify"].includes(flag)) {
        requireCondition(!operation, "ONE_OPERATION_REQUIRED"); operation = flag.slice(2) as "plan" | "execute" | "verify"; continue;
      }
      requireCondition(["--backup", "--output", "--confirm"].includes(flag) && !flags.has(flag) && args[i + 1] && !args[i + 1].startsWith("--"), "INVALID_ARGUMENTS");
      flags.set(flag, args[++i]);
    }
    requireCondition(operation && flags.has("--backup") && flags.has("--output"), "OPERATION_BACKUP_AND_OUTPUT_REQUIRED");
    const backupPath = resolve(flags.get("--backup")!), path = resolve(flags.get("--output")!);
    requireCondition(path.startsWith(resolve("migration-plans") + "/") && !path.startsWith(backupPath + "/"), "PRIVATE_PLAN_PATH_REQUIRED");
    const backup = await readBackup(backupPath);
    let previous: Phase8Plan | undefined;
    try { previous = BSON.deserialize(BSON.serialize(BSON.EJSON.parse(await readFile(path, "utf8"), { relaxed: false }))) as Phase8Plan; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const plan = createPhase8Plan(backupPath, backup, previous);
    if (operation === "plan") {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      if (!previous) await writeFile(path, BSON.EJSON.stringify(plan, { relaxed: false }, 2), { mode: 0o600, flag: "wx" });
      console.log(JSON.stringify({ operation, counts: plan.migration.counts, originalCounts: plan.counts,
        backupRestoreVerified: false, discardedMockMediaReferences: plan.discardedMockMediaReferences, planHash: plan.planHash, reused: !!previous }, null, 2));
      return 0;
    }
    requireCondition(previous && flags.get("--confirm") === "switchplay", "REVIEWED_PLAN_AND_CONFIRMATION_REQUIRED");
    validatePhase8Plan(previous);
    statusPath = resolve(dirname(path), `${operation}-status.json`);
    await writeFile(statusPath, JSON.stringify({ operation, status: "started", planHash: plan.planHash }), { mode: 0o600 });
    assertProductionDatabase(env.PHASE8_ATLAS_URI, "switchplay", env.PHASE8_ATLAS_HOST);
    client = new MongoClient(env.PHASE8_ATLAS_URI!, { appName: "switchplay-phase8-explicit-execution", serverSelectionTimeoutMS: 15000 });
    await client.connect();
    const db = client.db("switchplay");
    const result = operation === "execute" ? await executePhase8(client, db, plan) : await verifyPhase8(db, plan);
    await writeFile(statusPath, JSON.stringify({ operation, status: "complete", planHash: plan.planHash, result }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ operation, status: "complete", result }, null, 2));
    return 0;
  } catch (error) {
    const code = error instanceof Error && "code" in error && /^[A-Z0-9_]+$/.test(String(error.code)) ? String(error.code) : "PHASE8_OPERATION_FAILED";
    if (statusPath) await writeFile(statusPath, JSON.stringify({ status: "failed", code }), { mode: 0o600 }).catch(() => {});
    console.error(JSON.stringify({ status: "failed", code, errorName: error instanceof Error ? error.name : "UnknownError",
      instruction: "Stop. Inspect namespace/target state before any approved retry. No cleanup or rollback was performed." }));
    return 1;
  } finally { await client?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().then((code) => { process.exitCode = code; });
