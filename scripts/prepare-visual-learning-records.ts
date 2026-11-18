import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../src/lib/cards/localDatabase";
import { createVisualLearningRecordIndexes, VISUAL_INDEXES } from "../src/lib/visualLearningRecords/repository";

// Default is offline inspection. Production setup requires a separately approved deployment operation.
async function main() {
const args = process.argv.slice(2);
if (args.length === 0 || args.length === 1 && args[0] === "--plan") {
  console.log(JSON.stringify({ operation: "plan", collections: [...new Set(VISUAL_INDEXES.map(i => i.collection))], indexes: VISUAL_INDEXES,
    legacyBackfill: false, rewritesExistingData: false, note: "No database connection. Apply is limited to an explicitly configured disposable localhost database." }, null, 2));
} else if (args.length === 1 && args[0] === "--apply-local") {
  assertDisposableDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB);
  const client = new MongoClient(process.env.MONGODB_URI!);
  try { await client.connect(); await createVisualLearningRecordIndexes(client.db(process.env.MONGODB_DB!)); console.log("Visual Learning Records indexes prepared in the disposable database."); }
  finally { await client.close(); }
} else { throw new Error("Use --plan or --apply-local. No production execution is supported by this command."); }
}
void main().catch(() => { console.error("Visual Learning Records setup failed. No production setup is permitted; check arguments and disposable database configuration."); process.exitCode = 1; });
