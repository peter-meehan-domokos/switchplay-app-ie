import { getDatabase, getMongoClient } from "../src/lib/mongodb";
import { createInfoCardIndexes } from "../src/lib/infoCards/repository";

// Explicit deployment prerequisite, never import-time setup or a content migration.
// Existing application database guards apply. Does not rewrite any historical data.
async function main() {
  const client = await getMongoClient();
  try { await createInfoCardIndexes(await getDatabase()); console.log("Info Cards indexes ready."); }
  finally { await client.close(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Index setup failed"); process.exitCode = 1; });
