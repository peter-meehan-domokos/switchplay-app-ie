import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is not set.`);
  }

  return value.trim();
}

function getOptionalBooleanEnv(name, defaultValue = false) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    return defaultValue;
  }

  return value.trim().toLowerCase() === "true";
}

const client = new MongoClient(requireEnv("MONGODB_URI"));

async function seedUser() {
  const db = client.db(requireEnv("MONGODB_DB"));
  const users = db.collection("users");

  const email = requireEnv("SEED_USER_EMAIL").toLowerCase();
  const username = requireEnv("SEED_USER_USERNAME");
  const password = requireEnv("SEED_USER_PASSWORD");
  const isAdmin = getOptionalBooleanEnv("SEED_USER_IS_ADMIN", false);

  const existingUser = await users.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    console.log(`Seed user already exists (email: ${email}, username: ${username})`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const result = await users.insertOne({
    email,
    username,
    passwordHash,
    isAdmin,
    decksData: [],
    sharedDeckData: [],
    createdAt: now,
    updatedAt: now,
  });

  console.log(
    `Created seed user ${email} with id ${result.insertedId.toString()} (isAdmin: ${isAdmin})`,
  );
}

try {
  await client.connect();
  await seedUser();
} finally {
  await client.close();
}
