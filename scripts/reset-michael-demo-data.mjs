import { MongoClient } from "mongodb";
import { michaelDemoDeckData } from "../src/seed/michaelDemoDeckData.mjs";

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is not set.`);
  }

  return value.trim();
}

const client = new MongoClient(requireEnv("MONGODB_URI"));

async function resetMichaelDemoData() {
  const db = client.db(requireEnv("MONGODB_DB"));
  const users = db.collection("users");
  const demoDeckData = structuredClone(michaelDemoDeckData);
  const result = await users.updateOne(
    { username: "Michael" },
    {
      $set: {
        decksData: demoDeckData,
        updatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new Error('Unable to reset demo data: user "Michael" was not found.');
  }

  //console.log(`Reset Michael demo data with ${demoDeckData.length} decks.`);
}

try {
  await client.connect();
  await resetMichaelDemoData();
} finally {
  await client.close();
}
