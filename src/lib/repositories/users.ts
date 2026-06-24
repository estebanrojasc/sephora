import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb, COLLECTIONS } from "@/lib/mongo";
import type { User, UserDTO } from "@/features/users/types";

interface UserDoc extends User {
  passwordHash: string;
}

async function col() {
  const db = await getDb();
  const c = db.collection<UserDoc>(COLLECTIONS.users);
  await c.createIndex({ email: 1 }, { unique: true });
  return c;
}

function toDTO(doc: UserDoc): UserDTO {
  const { passwordHash: _ph, ...rest } = doc;
  void _ph;
  return rest;
}

export async function countUsers(): Promise<number> {
  return (await col()).countDocuments();
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return (await col()).findOne({ email: email.toLowerCase().trim() });
}

export async function findUserById(id: string): Promise<UserDTO | null> {
  const doc = await (await col()).findOne({ id });
  return doc ? toDTO(doc) : null;
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<UserDTO> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date().toISOString();
  const doc: UserDoc = {
    id: randomUUID(),
    email: input.email.toLowerCase().trim(),
    name: input.name.trim(),
    role: "admin",
    passwordHash,
    createdAt: now,
  };
  await (await col()).insertOne(doc);
  return toDTO(doc);
}

export async function verifyPassword(
  email: string,
  password: string
): Promise<UserDTO | null> {
  const doc = await findUserByEmail(email);
  if (!doc) return null;
  const ok = await bcrypt.compare(password, doc.passwordHash);
  return ok ? toDTO(doc) : null;
}
