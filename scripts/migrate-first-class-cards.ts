import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BSON, MongoClient } from "mongodb";
import { failureDiagnostics } from "./audit-pre-library-migration.mjs";
import { createMigrationPlan, type LegacySources, type MigrationPlan } from "./migration/plan";
import { applyMigrationPlan } from "./migration/apply";
import { requireCondition } from "../src/lib/cards/domain";

const HELP = `Phase 1 migration tooling (offline planning / disposable local targets only)
Plan: node --import tsx scripts/migrate-first-class-cards.ts --fixtures PATH --plan migration-plans/RUN/plan.ejson
Local clone: replace --fixtures PATH with --source (MIGRATION_SOURCE_URI / MIGRATION_SOURCE_DB).
Re-run planning with the same path reuses its IDs and rejects source drift.
Apply: node --import tsx scripts/migrate-first-class-cards.ts --apply --plan migration-plans/RUN/plan.ejson
Apply requires MIGRATION_TARGET_URI (local Mongo replica set) and MIGRATION_TARGET_DB
(must start switchplay_migration_). No app/Atlas environment variables are used.
Plans may contain private user/auth metadata: ignored directory, permissions 0600.
There is deliberately no production-write or rename mode in Phase 1.
`;
export function decodePlan(text: string): MigrationPlan {
  return BSON.deserialize(BSON.serialize(BSON.EJSON.parse(text, { relaxed: false }))) as MigrationPlan;
}
export async function main(args: string[] = process.argv.slice(2), env: Record<string, string | undefined> = process.env) {
  let client: MongoClient | undefined; let stage = "configuration"; let reportDirectory: string | undefined;
  try {
    if (args.includes("--help")) { console.log(HELP); return 0; }
    const options = new Map<string, string>(); let apply = false; let sourceDatabase = false;
    for (let index = 0; index < args.length; index++) {
      const flag = args[index]; if (flag === "--apply") { apply = true; continue; }
      if (flag === "--source") { sourceDatabase = true; continue; }
      requireCondition(["--fixtures", "--plan"].includes(flag) && args[index + 1] && !args[index + 1].startsWith("--") && !options.has(flag), "INVALID_ARGUMENTS");
      options.set(flag, args[++index]);
    }
    const filename = options.get("--plan"); requireCondition(filename, "PLAN_PATH_REQUIRED");
    const planPath = resolve(filename); const directory = resolve(planPath, "..");
    const relative = planPath.slice(resolve("migration-plans").length);
    requireCondition(planPath.startsWith(resolve("migration-plans") + "/") && relative.length > 1, "IGNORED_PLAN_DIRECTORY_REQUIRED");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    reportDirectory = directory;
    let previous: MigrationPlan | undefined;
    try { previous = decodePlan(await readFile(planPath, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    let plan: MigrationPlan;
    if (apply) {
      requireCondition(!options.has("--fixtures") && !sourceDatabase && previous, "REVIEWED_PLAN_REQUIRED"); plan = previous;
      requireCondition(env.MIGRATION_TARGET_URI && env.MIGRATION_TARGET_DB, "EXPLICIT_DISPOSABLE_TARGET_CONFIG_REQUIRED");
      requireCondition(/^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/,])/.test(env.MIGRATION_TARGET_URI) && !env.MIGRATION_TARGET_URI.includes("@"), "LOCAL_MIGRATION_TARGET_REQUIRED");
      requireCondition(/^switchplay_migration_[a-zA-Z0-9_-]+$/.test(env.MIGRATION_TARGET_DB), "DISPOSABLE_TARGET_DATABASE_REQUIRED");
      stage = "connect disposable target";
      client = new MongoClient(env.MIGRATION_TARGET_URI, { serverSelectionTimeoutMS: 5000, directConnection: true });
      requireCondition(client.options.hosts.every((host) => host.host !== undefined && ["localhost", "127.0.0.1", "::1"].includes(host.host)), "LOCAL_MIGRATION_TARGET_REQUIRED");
      await client.connect();
      stage = "apply disposable target";
      const result = await applyMigrationPlan(client, client.db(env.MIGRATION_TARGET_DB), plan);
      await writeFile(join(directory, "apply-status.json"), JSON.stringify({ status: "complete", planHash: plan.planHash, ...result }, null, 2), { mode: 0o600 });
      console.log(JSON.stringify(result, null, 2));
    } else {
      const sourcePath = options.get("--fixtures"); requireCondition(Boolean(sourcePath) !== sourceDatabase, "ONE_SOURCE_REQUIRED");
      let sources: LegacySources;
      if (sourceDatabase) {
        requireCondition(env.MIGRATION_SOURCE_URI && env.MIGRATION_SOURCE_DB && /^switchplay_migration_[a-zA-Z0-9_-]+$/.test(env.MIGRATION_SOURCE_DB), "EXPLICIT_DISPOSABLE_SOURCE_CONFIG_REQUIRED");
        requireCondition(/^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/,])/.test(env.MIGRATION_SOURCE_URI) && !env.MIGRATION_SOURCE_URI.includes("@"), "LOCAL_MIGRATION_SOURCE_REQUIRED");
        client = new MongoClient(env.MIGRATION_SOURCE_URI, { serverSelectionTimeoutMS: 5000, directConnection: true });
        requireCondition(client.options.hosts.every((host) => host.host !== undefined && ["localhost", "127.0.0.1", "::1"].includes(host.host)), "LOCAL_MIGRATION_SOURCE_REQUIRED");
        stage = "read disposable source"; await client.connect();
        const db = client.db(env.MIGRATION_SOURCE_DB);
        const deckTemplates = await db.collection("deckTemplates").find({}, { projection: { savedTemplate: 0, previousVersions: 0 } }).toArray();
        const users = await db.collection("users").find({}).toArray(); // Keep untouched auth/sharing metadata intact in the target copy.
        sources = { deckTemplates, users };
      } else {
        stage = "read offline source";
        sources = BSON.deserialize(BSON.serialize(BSON.EJSON.parse(await readFile(sourcePath!, "utf8"), { relaxed: false }))) as LegacySources;
      }
      stage = "plan and validate"; plan = createMigrationPlan(sources, previous);
      if (!previous) await writeFile(planPath, BSON.EJSON.stringify(plan, { relaxed: false }, 2) + "\n", { mode: 0o600, flag: "wx" });
      await writeFile(join(directory, "summary.json"), JSON.stringify({ status: "planned", planHash: plan.planHash, counts: plan.counts, policy: "personal media only; learning state reset; sharing untouched" }, null, 2), { mode: 0o600 });
      console.log(JSON.stringify({ status: "planned", counts: plan.counts, planPath, reused: Boolean(previous) }, null, 2));
    }
    await writeFile(join(directory, "run-status.json"), JSON.stringify({ status: "complete", operation: apply ? "apply disposable target" : "plan", planHash: plan.planHash }, null, 2), { mode: 0o600 });
    return 0;
  } catch (error) {
    const diagnostic = { status: "failed", ...failureDiagnostics(error, stage), code: error instanceof Error && "code" in error && /^[A-Z0-9_:.-]+$/.test(String(error.code)) ? error.code : null };
    if (reportDirectory) await writeFile(join(reportDirectory, "run-status.json"), JSON.stringify(diagnostic, null, 2), { mode: 0o600 }).catch(() => {});
    console.error(JSON.stringify(diagnostic));
    return 1;
  } finally { await client?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().then((code) => { process.exitCode = code; });
