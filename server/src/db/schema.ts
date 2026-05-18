import {
  pgTable,
  text,
  integer,
  serial,
  doublePrecision,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  sourcePath: text("source_path").default(""),
  processedAt: text("processed_at").default(""),
  model: text("model").default(""),
  cardCount: integer("card_count").default(0),
  transcriptMtime: doublePrecision("transcript_mtime").default(0),
});

export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    cardIndex: integer("card_index").notNull(),
    type: text("type").notNull(),
    userSaid: text("user_said").notNull(),
    aiPhrased: text("ai_phrased").notNull(),
    vocab: jsonb("vocab").$type<string[]>().default([]),
    pattern: text("pattern").default(""),
    contextHint: text("context_hint").default(""),
    userLine: integer("user_line"),
    aiLine: integer("ai_line"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [unique().on(t.sessionId, t.cardIndex)],
);

export const reviews = pgTable("reviews", {
  cardId: integer("card_id")
    .primaryKey()
    .references(() => cards.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["new", "learning", "learned", "skipped"],
  })
    .notNull()
    .default("new"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});
