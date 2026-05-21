import { Hono } from "hono";
import { eq, like, sql, and, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { cards, cardStates } from "../db/schema.js";

const app = new Hono();

const selectCard = {
  id: cards.id,
  sessionId: cards.sessionId,
  cardIndex: cards.cardIndex,
  type: cards.type,
  userSaid: cards.userSaid,
  aiPhrased: cards.aiPhrased,
  vocab: cards.vocab,
  pattern: cards.pattern,
  contextHint: cards.contextHint,
  userLine: cards.userLine,
  aiLine: cards.aiLine,
  createdAt: cards.createdAt,
  favorite: sql<boolean>`COALESCE(${cardStates.favorite}, false)`,
  hidden: sql<boolean>`COALESCE(${cardStates.hidden}, false)`,
  viewCount: sql<number>`COALESCE(${cardStates.viewCount}, 0)::int`,
  lastViewedAt: cardStates.lastViewedAt,
};

app.get("/", async (c) => {
  const type = c.req.query("type");
  const sessionId = c.req.query("session_id");
  const view = c.req.query("view") ?? "all"; // all | favorites | hidden
  const q = c.req.query("q");

  const conditions = [];

  if (type) conditions.push(eq(cards.type, type));
  if (sessionId) conditions.push(eq(cards.sessionId, sessionId));
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(cards.userSaid, pattern),
        like(cards.aiPhrased, pattern),
        sql`${cards.vocab}::text LIKE ${pattern}`,
      ),
    );
  }

  if (view === "favorites") {
    conditions.push(eq(cardStates.favorite, true));
  } else if (view === "hidden") {
    conditions.push(eq(cardStates.hidden, true));
  } else {
    // all: exclude hidden
    conditions.push(
      or(eq(cardStates.hidden, false), sql`${cardStates.hidden} IS NULL`),
    );
  }

  const rows = await db
    .select(selectCard)
    .from(cards)
    .leftJoin(cardStates, eq(cardStates.cardId, cards.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${cards.createdAt} DESC`);

  return c.json(rows);
});

app.get("/daily", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 8, 30);

  // Prioritize: never-viewed first, then longest-ago-viewed, with random tie-breaker.
  // Exclude hidden cards.
  const rows = await db
    .select(selectCard)
    .from(cards)
    .leftJoin(cardStates, eq(cardStates.cardId, cards.id))
    .where(
      or(eq(cardStates.hidden, false), sql`${cardStates.hidden} IS NULL`),
    )
    .orderBy(sql`${cardStates.lastViewedAt} ASC NULLS FIRST, random()`)
    .limit(limit);

  // Record the view: upsert state with bumped view_count + now.
  for (const row of rows) {
    await db
      .insert(cardStates)
      .values({
        cardId: row.id,
        viewCount: 1,
        lastViewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cardStates.cardId,
        set: {
          viewCount: sql`${cardStates.viewCount} + 1`,
          lastViewedAt: new Date(),
        },
      });
  }

  return c.json(rows);
});

app.get("/stats", async (c) => {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cards);

  const [sessionRow] = await db
    .select({
      count: sql<number>`count(distinct ${cards.sessionId})::int`,
    })
    .from(cards);

  const typeRows = await db
    .select({
      type: cards.type,
      count: sql<number>`count(*)::int`,
    })
    .from(cards)
    .groupBy(cards.type);

  const [favRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cardStates)
    .where(eq(cardStates.favorite, true));

  const [hiddenRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cardStates)
    .where(eq(cardStates.hidden, true));

  return c.json({
    totalCards: totalRow.count,
    totalSessions: sessionRow.count,
    byType: Object.fromEntries(typeRows.map((r) => [r.type, r.count])),
    favoriteCount: favRow.count,
    hiddenCount: hiddenRow.count,
  });
});

app.get("/types", async (c) => {
  const rows = await db
    .selectDistinct({ type: cards.type })
    .from(cards)
    .orderBy(cards.type);
  return c.json(rows.map((r) => r.type));
});

async function setFlag(
  cardId: number,
  field: "favorite" | "hidden",
  value: boolean,
) {
  const [existing] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.id, cardId));
  if (!existing) return null;

  await db
    .insert(cardStates)
    .values({
      cardId,
      [field]: value,
    } as typeof cardStates.$inferInsert)
    .onConflictDoUpdate({
      target: cardStates.cardId,
      set: { [field]: value },
    });
  return true;
}

app.post("/:id/favorite", async (c) => {
  const cardId = Number(c.req.param("id"));
  const { value } = await c.req.json<{ value: boolean }>();
  const ok = await setFlag(cardId, "favorite", !!value);
  if (!ok) return c.json({ error: "card not found" }, 404);
  return c.json({ ok: true });
});

app.post("/:id/hide", async (c) => {
  const cardId = Number(c.req.param("id"));
  const { value } = await c.req.json<{ value: boolean }>();
  const ok = await setFlag(cardId, "hidden", !!value);
  if (!ok) return c.json({ error: "card not found" }, 404);
  return c.json({ ok: true });
});

export default app;
