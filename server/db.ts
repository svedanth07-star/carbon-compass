import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { carbonCalculations, carbonGoals, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createCarbonCalculation(input: typeof carbonCalculations.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(carbonCalculations).values(input);
}

export async function getRecentCalculations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(carbonCalculations).where(eq(carbonCalculations.userId, userId)).orderBy(desc(carbonCalculations.createdAt)).limit(12);
}

export async function saveCarbonGoal(input: typeof carbonGoals.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(carbonGoals).values(input).onDuplicateKeyUpdate({
    set: { baselineKg: input.baselineKg, targetKg: input.targetKg, targetDate: input.targetDate, updatedAt: new Date() },
  });
}

export async function getCarbonGoal(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(carbonGoals).where(eq(carbonGoals.userId, userId)).limit(1);
  return result[0];
}
