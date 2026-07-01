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
 * En Vercel Hobby el límite de función es ~10 s: los timeouts de Mongo deben
 * ser menores para devolver error claro, no FUNCTION_INVOCATION_TIMEOUT.
 */

const DEFAULT_URI = "mongodb://localhost:27017/proyectoisaqwen";

/** Vercel Hobby ≈ 10 s; dejamos margen para el handler. */
const SERVERLESS_MONGO_TIMEOUT_MS = 5_000;

interface GlobalWithMongo {
  __mongoClient?: Promise<MongoClient>;
  __mongoIndexesReady?: Set<string>;
}

const globalForMongo = globalThis as unknown as GlobalWithMongo;

function getUri(): string {
  return process.env.MONGODB_URI ?? DEFAULT_URI;
}

function isVercelServerless(): boolean {
  return process.env.VERCEL === "1";
}

function isServerlessProd(): boolean {
  /** Solo Vercel functions (~10s). Railway/Docker = servidor persistente. */
  return isVercelServerless();
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
  const vercel = isVercelServerless();
  const timeout = vercel ? SERVERLESS_MONGO_TIMEOUT_MS : 10_000;

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: timeout,
    connectTimeoutMS: timeout,
    socketTimeoutMS: vercel ? timeout : 30_000,
    maxPoolSize: vercel ? 1 : 10,
    minPoolSize: 0,
    maxIdleTimeMS: vercel ? 10_000 : 60_000,
  });

  await client.connect();
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

/** Comprueba conexión (para /api/health/db). */
export async function pingMongo(): Promise<{ ok: true; ms: number }> {
  const start = Date.now();
  const db = await getDb();
  await db.command({ ping: 1 });
  return { ok: true, ms: Date.now() - start };
}

export type IndexSpec = {
  key: Record<string, 1 | -1>;
  unique?: boolean;
};

function ensureIndexesBackground(
  collection: Collection<Document>,
  name: string,
  specs: IndexSpec[]
): void {
  if (globalForMongo.__mongoIndexesReady?.has(name)) return;
  if (!globalForMongo.__mongoIndexesReady) {
    globalForMongo.__mongoIndexesReady = new Set();
  }
  globalForMongo.__mongoIndexesReady.add(name);

  void (async () => {
    try {
      for (const spec of specs) {
        await collection.createIndex(
          spec.key,
          spec.unique ? { unique: true } : {}
        );
      }
    } catch (err) {
      globalForMongo.__mongoIndexesReady?.delete(name);
      console.warn(`[mongo] índices ${name}:`, err);
    }
  })();
}

/** Colección Mongo; en Vercel no bloquea la request creando índices. */
export async function collectionWithIndexes<T extends Document>(
  name: string,
  specs: IndexSpec[]
): Promise<Collection<T>> {
  const db = await getDb();
  const collection = db.collection<T>(name);

  if (isServerlessProd()) {
    ensureIndexesBackground(
      collection as unknown as Collection<Document>,
      name,
      specs
    );
    return collection;
  }

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
