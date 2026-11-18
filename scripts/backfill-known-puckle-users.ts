import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertDisposableDatabase } from "../src/lib/cards/localDatabase";
import { getDatabase, getMongoClient } from "../src/lib/mongodb";
import { applyBackfill, assessAccounts, liveApplyAllowed, parseManifest, planBackfill, type Plan } from "../src/lib/knownUserBackfill";

/**
 * Command line for the one-time reviewed backfill (logic and safeguards: src/lib/knownUserBackfill.ts).
 *   --assess                      read-only draft manifest for the founder to complete
 *   --manifest <file>             dry-run report (the default; writes nothing)
 *   --manifest <file> --apply     explicit apply (disposable DB, or production mode + --confirm-live <manifestId>)
 */
const USAGE = "usage: backfill-known-puckle-users --assess | --manifest <file> [--apply [--confirm-live <manifestId>]]\nDry-run is the default and writes nothing.";
function render(plan: Plan) {
  const lines = [`Manifest ${plan.manifestId}: ${JSON.stringify(plan.summary)}`];
  for (const item of plan.items) lines.push(`- ${item.username ?? item.userId} [${item.status}]${item.actions.length ? `\n    ${item.actions.join("\n    ")}` : ""}${item.conflicts.length ? `\n    CONFLICT: ${item.conflicts.join("; ")}` : ""}`);
  for (const user of plan.unlisted) lines.push(`- ${user.username ?? user.userId} [UNLISTED: needs a reviewed disposition]`);
  lines.push(plan.blockers.length ? `BLOCKERS (apply refused):\n  ${plan.blockers.join("\n  ")}` : "No blockers: this manifest can be applied.");
  return lines.join("\n");
}
export async function main(args = process.argv.slice(2)) {
  const flag = (name: string) => args.includes(name), value = (name: string) => args[args.indexOf(name) + 1];
  try {
    if (flag("--help") || (!flag("--assess") && !flag("--manifest"))) { console.log(USAGE); return flag("--help") ? 0 : 1; }
    const client = await getMongoClient(), db = await getDatabase();
    try {
      if (flag("--assess")) { console.log(JSON.stringify(await assessAccounts(db), null, 2)); return 0; }
      const { manifest, problems } = parseManifest(JSON.parse(await readFile(resolve(value("--manifest")), "utf8")));
      if (problems.length) { console.error(`MANIFEST_INVALID:\n  ${problems.join("\n  ")}`); return 1; }
      if (!flag("--apply")) { const plan = await planBackfill(db, manifest); console.log(render(plan)); return plan.blockers.length ? 2 : 0; }
      let disposable = true;
      try { assertDisposableDatabase(); } catch { disposable = false; }
      if (!liveApplyAllowed({ disposable, mode: process.env.SWITCHPLAY_DATABASE_MODE, confirmation: value("--confirm-live"), manifestId: manifest.manifestId })) {
        console.error("LIVE_APPLY_REFUSED: a non-disposable database needs production mode and --confirm-live <manifestId>, after separately approved review."); return 1;
      }
      const result = await applyBackfill(db, client, manifest); console.log(render(result), `\nApplied ${result.applied} account(s).`); return 0;
    } finally { await client.close(); }
  } catch (error) {
    if (error instanceof Error && error.message === "BACKFILL_REFUSED") { console.error(`BACKFILL_REFUSED: nothing was written.\n${render((error as unknown as { plan: Plan }).plan)}`); return 2; }
    console.error(`BACKFILL_FAILED:${error instanceof Error ? error.message.slice(0, 120) : "unknown"}`); return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().then(code => { process.exitCode = code; });
