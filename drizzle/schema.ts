import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const carbonCalculations = mysqlTable("carbon_calculations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  totalKg: int("totalKg").notNull(),
  transportKg: int("transportKg").notNull(),
  electricityKg: int("electricityKg").notNull(),
  dietKg: int("dietKg").notNull(),
  lifestyleKg: int("lifestyleKg").notNull(),
  inputsJson: text("inputsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const carbonGoals = mysqlTable("carbon_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  baselineKg: int("baselineKg").notNull(),
  targetKg: int("targetKg").notNull(),
  targetDate: varchar("targetDate", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CarbonCalculation = typeof carbonCalculations.$inferSelect;
export type CarbonGoal = typeof carbonGoals.$inferSelect;
