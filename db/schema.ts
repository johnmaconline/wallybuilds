import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  problem: text("problem").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const experimentEvents = sqliteTable("experiment_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  experimentSlug: text("experiment_slug").notNull(),
  eventType: text("event_type").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
