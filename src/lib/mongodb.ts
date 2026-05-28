import { MongoClient, type Collection, type Db, type Document } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;

if (!uri) {
	throw new Error("MONGODB_URI is not set.");
}

if (!databaseName) {
	throw new Error("MONGODB_DB is not set.");
}

const globalForMongo = globalThis as typeof globalThis & {
	mongoClientPromise?: Promise<MongoClient>;
};

const clientPromise = globalForMongo.mongoClientPromise ?? new MongoClient(uri).connect();

if (process.env.NODE_ENV !== "production") {
	globalForMongo.mongoClientPromise = clientPromise;
}

export async function getDatabase(): Promise<Db> {
	const client = await clientPromise;
	return client.db(databaseName);
}

export async function getCollection<TSchema extends Document>(
	name: string,
): Promise<Collection<TSchema>> {
	const database = await getDatabase();
	return database.collection<TSchema>(name);
}
