import { DataAPIClient, Db } from "@datastax/astra-db-ts";

let cachedClient: DataAPIClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  try {
    if (cachedClient && cachedDb) {
      return { client: cachedClient, db: cachedDb };
    }

    const client = new DataAPIClient(process.env.ASTRADB_TOKEN || "");

    const db = client.db(process.env.ASTRADB_ENDPOINT || "");

    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    throw new Error("Failed to connect to database");
  }
}
