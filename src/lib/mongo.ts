import "server-only";
import { MongoClient, type Db } from "mongodb";

/**
 * Cliente Mongo compartido en server-side.
 *
 * En desarrollo guarda la conexión en `globalThis` para sobrevivir al hot
 * reload de Next.js. En producción crea una sola instancia.
 *
 * URI por defecto: mongodb://localhost:27017/proyectoisaqwen
 * Cambia con MONGODB_URI en .env.local.
 */

const DEFAULT_URI = "mongodb://localhost:27017/proyectoisaqwen";

/** Almacenamos la promesa en globalThis para sobrevivir hot reloads. */
interface GlobalWithMongo {
  __mongoClient?: Promise<MongoClient>;
}
const globalForMongo = globalThis as unknown as GlobalWithMongo;

function getUri(): string {
  return process.env.MONGODB_URI ?? DEFAULT_URI;
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
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  console.log(`[mongo] conectado a ${uri.replace(/\/\/[^@]+@/, "//***@")}`);
  return client;
}

function getClient(): Promise<MongoClient> {
  if (!globalForMongo.__mongoClient) {
    globalForMongo.__mongoClient = createClient();
  }
  return globalForMongo.__mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(extractDbName(getUri()));
}

/** Para tests o scripts que necesiten cerrar la conexión manualmente. */
export async function closeMongo(): Promise<void> {
  if (!globalForMongo.__mongoClient) return;
  const client = await globalForMongo.__mongoClient;
  await client.close();
  globalForMongo.__mongoClient = undefined;
}

export const COLLECTIONS = {
  records: "records",
  users: "users",
  catalogs: "catalogs",
  extractionAttempts: "extraction_attempts",
} as const;
