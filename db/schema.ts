import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  problem: text("problem").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
