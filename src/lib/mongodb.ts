import { MongoClient, type ClientSession, type Collection, type Db, type Document } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
	mongoClientPromise?: Promise<MongoClient>;
};

// Importing a repository must not connect to Atlas (including during builds/tests).
export async function getMongoClient(): Promise<MongoClient> {
	const uri = process.env.MONGODB_URI;
	if (!uri) throw new Error("MONGODB_URI is not set.");
	if (!globalForMongo.mongoClientPromise) {
		globalForMongo.mongoClientPromise = new MongoClient(uri).connect().catch((error) => {
			globalForMongo.mongoClientPromise = undefined;
			throw error;
		});
	}
	return globalForMongo.mongoClientPromise;
}

export async function getDatabase(): Promise<Db> {
	const databaseName = process.env.MONGODB_DB;
	if (!databaseName) throw new Error("MONGODB_DB is not set.");
	const client = await getMongoClient();
	return client.db(databaseName);
}

// Callbacks can be retried by Mongo. Keep writes sequential and external side effects outside.
export async function withMongoTransaction<T>(client: MongoClient, operation: (session: ClientSession) => Promise<T>): Promise<T> {
	const session = client.startSession();
	try {
		return await session.withTransaction(() => operation(session), {
			readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary",
		});
	} finally {
		await session.endSession();
	}
}

export async function getCollection<TSchema extends Document>(
	name: string,
): Promise<Collection<TSchema>> {
	const database = await getDatabase();
	return database.collection<TSchema>(name);
}
