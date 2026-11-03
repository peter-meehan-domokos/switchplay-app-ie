import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";
import { assertProductionDatabase } from "../src/lib/applicationDatabase";
import { assertDisposableDatabase } from "../src/lib/cards/localDatabase";
import { requireCondition } from "../src/lib/cards/domain";
import { executeGroupCardRename, planGroupCardRename, validateGroupCardRenamePlan, verifyGroupCardRename, type GroupCardRenamePlan } from "./migration/groupCardDataRename";

// No dotenv loading or application URI fallback. Persistent execution requires
// its own explicit authorisation, reviewed plan, backup and stopped writers.
export async function main(args = process.argv.slice(2), env: Record<string, string | undefined> = process.env) {
  let client: MongoClient | undefined;
  try {
    if (args.length === 1 && args[0] === "--help") {
      console.log("--inspect|--plan|--execute|--verify --mode disposable|production [--file PLAN] [--reverse]\nUse GROUP_CARD_RENAME_URI, GROUP_CARD_RENAME_DB and (production) GROUP_CARD_RENAME_HOST. No .env file is loaded.\nPlan is read-only against MongoDB and creates a new private plan file. Execute requires --confirm DATABASE --writers-stopped; production also requires --backup-confirmed.\nStop/drain only clients using the target database before cutover. Reverse rollback requires a fresh --plan --reverse after draining writers; never restore an old backup over newer writes.");
      return 0;
    }
    let operation = ""; const flags = new Map<string, string>(), toggles = new Set<string>();
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (["--inspect", "--plan", "--execute", "--verify"].includes(arg)) {
        requireCondition(!operation, "ONE_RENAME_OPERATION_REQUIRED"); operation = arg; continue;
      }
      if (["--reverse", "--writers-stopped", "--backup-confirmed"].includes(arg)) {
        requireCondition(!toggles.has(arg), "INVALID_RENAME_ARGUMENTS"); toggles.add(arg); continue;
      }
      requireCondition(["--mode", "--file", "--confirm"].includes(arg) && !flags.has(arg) && args[i + 1] && !args[i + 1].startsWith("--"), "INVALID_RENAME_ARGUMENTS");
      flags.set(arg, args[++i]);
    }
    requireCondition(operation && ["disposable", "production"].includes(flags.get("--mode") ?? ""), "RENAME_MODE_AND_OPERATION_REQUIRED");
    requireCondition(operation === "--plan" || !toggles.has("--reverse"), "REVERSE_REQUIRES_NEW_PLAN");
    const uri = env.GROUP_CARD_RENAME_URI, database = env.GROUP_CARD_RENAME_DB;
    if (flags.get("--mode") === "production") assertProductionDatabase(uri, database, env.GROUP_CARD_RENAME_HOST);
    else assertDisposableDatabase(uri, database);
    requireCondition(operation === "--inspect" || flags.has("--file"), "RENAME_PLAN_FILE_REQUIRED");
    if (operation === "--execute") requireCondition(flags.get("--confirm") === database && toggles.has("--writers-stopped")
      && (flags.get("--mode") !== "production" || toggles.has("--backup-confirmed")), "RENAME_EXECUTION_CONFIRMATION_REQUIRED");
    let plan: GroupCardRenamePlan | undefined;
    if (operation === "--execute" || operation === "--verify") {
      plan = JSON.parse(await readFile(resolve(flags.get("--file")!), "utf8"));
      validateGroupCardRenamePlan(plan!); requireCondition(plan!.database === database, "RENAME_DATABASE_MISMATCH");
    }
    client = await new MongoClient(uri!, { appName: "switchplay-explicit-group-card-rename", serverSelectionTimeoutMS: 15000 }).connect();
    const db = client.db(database);
    if (operation === "--inspect") {
      const rows = await db.listCollections({}, { nameOnly: true }).toArray();
      console.log(JSON.stringify({ database, namespaces: rows.map(row => row.name).filter(name => ["groupCardState", "groupCardData"].includes(name)) }));
    } else if (operation === "--plan") {
      const planned = await planGroupCardRename(db, toggles.has("--reverse"));
      await writeFile(resolve(flags.get("--file")!), JSON.stringify(planned, null, 2) + "\n", { mode: 0o600, flag: "wx" });
      console.log(JSON.stringify({ database, from: planned.from, to: planned.to, count: planned.snapshot.count, planHash: planned.planHash }));
    } else console.log(JSON.stringify(operation === "--execute" ? await executeGroupCardRename(db, plan!) : await verifyGroupCardRename(db, plan!)));
    return 0;
  } catch (error) {
    const code = error instanceof Error && "code" in error && /^[A-Z0-9_]+$/.test(String(error.code)) ? String(error.code) : "GROUP_CARD_RENAME_FAILED";
    console.error(JSON.stringify({ code, instruction: "Stop and inspect namespaces before retry. No automatic rollback, overwrite or cleanup was performed." }));
    return 1;
  } finally { await client?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().then(code => { process.exitCode = code; });
