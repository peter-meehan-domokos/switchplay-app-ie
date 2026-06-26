import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import ts from "typescript";

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is not set.`);
  }

  return value.trim();
}

async function importTypeScriptModule(filePath) {
  const source = await readFile(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: filePath,
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`;

  return import(moduleUrl);
}

function createSummary() {
  return {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    missingOwners: new Set(),
    missingTemplateIds: new Set(),
  };
}

function printSummary(summary) {
  console.log(`Templates processed: ${summary.processed}`);
  console.log(`Templates inserted: ${summary.inserted}`);
  console.log(`Templates updated: ${summary.updated}`);
  console.log(`Templates skipped: ${summary.skipped}`);
  console.log(`Missing owners: ${summary.missingOwners.size === 0 ? "none" : [...summary.missingOwners].join(", ")}`);
  console.log(`Missing template IDs: ${summary.missingTemplateIds.size === 0 ? "none" : [...summary.missingTemplateIds].join(", ")}`);
}

const client = new MongoClient(requireEnv("MONGODB_URI"));

async function seedDeckTemplates() {
  const [
    { deckTemplates },
    { DECK_TEMPLATES_COLLECTION, seedDeckTemplateOwnership },
  ] = await Promise.all([
    importTypeScriptModule("src/mocks/deckTemplates.ts"),
    importTypeScriptModule("src/lib/deckTemplateDocuments.ts"),
  ]);
  const db = client.db(requireEnv("MONGODB_DB"));
  const users = db.collection("users");
  const templates = db.collection(DECK_TEMPLATES_COLLECTION);
  const templatesById = new Map(
    deckTemplates.map((template) => [template.deckTemplateId, template]),
  );
  const ownerUsersByUsername = new Map();
  const summary = createSummary();

  for (const ownership of seedDeckTemplateOwnership) {
    let ownerUser = ownerUsersByUsername.get(ownership.ownerUsername);

    if (ownerUser === undefined) {
      ownerUser = await users.findOne({ username: ownership.ownerUsername });
      ownerUsersByUsername.set(ownership.ownerUsername, ownerUser);
    }

    if (!ownerUser) {
      summary.missingOwners.add(ownership.ownerUsername);
    }

    for (const deckTemplateId of ownership.deckTemplateIds) {
      summary.processed += 1;
      const template = templatesById.get(deckTemplateId);

      if (!template) {
        summary.missingTemplateIds.add(deckTemplateId);
      }

      if (!ownerUser || !template) {
        summary.skipped += 1;
        continue;
      }

      const now = new Date();
      const result = await templates.updateOne(
        { deckTemplateId },
        {
          $set: {
            deckTemplateId,
            ownerUserId: ownerUser._id.toString(),
            visibility: ownership.visibility,
            template,
            savedTemplate: template,
            savedAt: now,
            publishedAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount === 1) {
        summary.inserted += 1;
      } else if (result.matchedCount === 1) {
        summary.updated += 1;
      }
    }
  }

  printSummary(summary);
}

try {
  await client.connect();
  await seedDeckTemplates();
} finally {
  await client.close();
}
