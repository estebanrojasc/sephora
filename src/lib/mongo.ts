import "server-only";
import {
  MongoClient,
  type Collection,
  type Db,
  type Document,
} from "mongodb";

/**
 * Cliente Mongo compartido en server-side.
 *
 * En desarrollo guarda la conexión en `globalThis` para sobrevivir al hot
 * reload de Next.js. En producción (Vercel) reutiliza la conexión del
 * contenedor serverless y reintenta si falló.
 */

const DEFAULT_URI = "mongodb://localhost:27017/proyectoisaqwen";

interface GlobalWithMongo {
  __mongoClient?: Promise<MongoClient>;
  __mongoIndexesReady?: Set<string>;
}

const globalForMongo = globalThis as unknown as GlobalWithMongo;

function getUri(): string {
  return process.env.MONGODB_URI ?? DEFAULT_URI;
}

function isServerlessProd(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function extractDbName(uri: string): string {
  try {
    const url = new URL(uri);
    const pathname = url.pathname.replace(/^\//, "");
    return pathname || "proyectoisaqwen";
  } catch {
    return "proyectoisaqwen";
  }
}

async function createClient(): Promise<MongoClient> {
  const uri = getUri();
  const prod = isServerlessProd();
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: prod ? 15_000 : 5_000,
    connectTimeoutMS: prod ? 15_000 : 5_000,
    maxPoolSize: prod ? 10 : 5,
  });
  await client.connect();
  await client.db(extractDbName(uri)).command({ ping: 1 });
  console.log(`[mongo] conectado a ${uri.replace(/\/\/[^@]+@/, "//***@")}`);
  return client;
}

function getClient(): Promise<MongoClient> {
  if (!globalForMongo.__mongoClient) {
    globalForMongo.__mongoClient = createClient().catch((err) => {
      globalForMongo.__mongoClient = undefined;
      throw err;
    });
  }
  return globalForMongo.__mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(extractDbName(getUri()));
}

export type IndexSpec = {
  key: Record<string, 1 | -1>;
  unique?: boolean;
};

/** Crea índices una sola vez por contenedor (evita saturar Mongo en cada request). */
export async function collectionWithIndexes<T extends Document>(
  name: string,
  specs: IndexSpec[]
): Promise<Collection<T>> {
  const db = await getDb();
  const collection = db.collection<T>(name);

  if (!globalForMongo.__mongoIndexesReady) {
    globalForMongo.__mongoIndexesReady = new Set();
  }
  if (!globalForMongo.__mongoIndexesReady.has(name)) {
    for (const spec of specs) {
      await collection.createIndex(
        spec.key,
        spec.unique ? { unique: true } : {}
      );
    }
    globalForMongo.__mongoIndexesReady.add(name);
  }

  return collection;
}

/** Para tests o scripts que necesiten cerrar la conexión manualmente. */
export async function closeMongo(): Promise<void> {
  if (!globalForMongo.__mongoClient) return;
  const client = await globalForMongo.__mongoClient;
  await client.close();
  globalForMongo.__mongoClient = undefined;
  globalForMongo.__mongoIndexesReady = undefined;
}

export const COLLECTIONS = {
  records: "records",
  users: "users",
  catalogs: "catalogs",
  extractionAttempts: "extraction_attempts",
  bitacoras: "bitacoras",
} as const;
