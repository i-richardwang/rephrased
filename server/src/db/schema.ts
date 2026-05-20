import {
  pgTable,
  text,
  integer,
  serial,
  doublePrecision,
  jsonb,
  timestamp,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

export const transcripts = pgTable("transcripts", {
  sessionId: text("session_id").primaryKey(),
  sourcePath: text("source_path").notNull().default(""),
  content: text("content").notNull(),
  transcriptMtime: doublePrecision("transcript_mtime").notNull().default(0),
  status: text("status").notNull().default("pending"),
  analyzedMtime: doublePrecision("analyzed_mtime"),
  error: text("error"),
  model: text("model").default(""),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
});

export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => transcripts.sessionId, { onDelete: "cascade" }),
    cardIndex: integer("card_index").notNull(),
    type: text("type").notNull(),
    userSaid: text("user_said").notNull(),
    aiPhrased: text("ai_phrased").notNull(),
    vocab: jsonb("vocab").$type<string[]>().default([]),
    pattern: text("pattern").default(""),
    contextHint: text("context_hint").default(""),
    userLine: integer("user_line"),
    aiLine: integer("ai_line"),
    contentHash: text("content_hash").notNull(),
    stale: boolean("stale").notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [unique().on(t.sessionId, t.contentHash)],
);

export const cardStates = pgTable("card_states", {
  cardId: integer("card_id")
    .primaryKey()
    .references(() => cards.id, { onDelete: "cascade" }),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  hidden: boolean("hidden").notNull().default(false),
  favorite: boolean("favorite").notNull().default(false),
});
