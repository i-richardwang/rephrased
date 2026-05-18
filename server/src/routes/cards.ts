import { Hono } from "hono";
import { eq, like, sql, and, or, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { cards, reviews } from "../db/schema.js";

const app = new Hono();

app.get("/", async (c) => {
  const type = c.req.query("type");
  const sessionId = c.req.query("session_id");
  const status = c.req.query("status");
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
  if (status) {
    if (status === "new") {
      conditions.push(or(isNull(reviews.status), eq(reviews.status, "new")));
    } else {
      conditions.push(
        eq(
          reviews.status,
          status as "new" | "learning" | "learned" | "skipped",
        ),
      );
    }
  }

  const rows = await db
    .select({
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
      reviewStatus: sql<string>`COALESCE(${reviews.status}, 'new')`,
    })
    .from(cards)
    .leftJoin(reviews, eq(reviews.cardId, cards.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${cards.createdAt} DESC`);

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

  const statusRows = await db
    .select({
      status: sql<string>`COALESCE(${reviews.status}, 'new')`,
      count: sql<number>`count(*)::int`,
    })
    .from(cards)
    .leftJoin(reviews, eq(reviews.cardId, cards.id))
    .groupBy(sql`COALESCE(${reviews.status}, 'new')`);

  return c.json({
    totalCards: totalRow.count,
    totalSessions: sessionRow.count,
    byType: Object.fromEntries(typeRows.map((r) => [r.type, r.count])),
    byStatus: Object.fromEntries(statusRows.map((r) => [r.status, r.count])),
  });
});

app.get("/types", async (c) => {
  const rows = await db
    .selectDistinct({ type: cards.type })
    .from(cards)
    .orderBy(cards.type);
  return c.json(rows.map((r) => r.type));
});

app.post("/:id/review", async (c) => {
  const cardId = Number(c.req.param("id"));
  const { status } = await c.req.json<{ status: string }>();

  if (!["new", "learning", "learned", "skipped"].includes(status)) {
    return c.json({ error: "invalid status" }, 400);
  }

  const [existing] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.id, cardId));
  if (!existing) return c.json({ error: "card not found" }, 404);

  await db
    .insert(reviews)
    .values({
      cardId,
      status: status as "new" | "learning" | "learned" | "skipped",
      reviewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: reviews.cardId,
      set: {
        status: status as "new" | "learning" | "learned" | "skipped",
        reviewedAt: new Date(),
      },
    });

  return c.json({ ok: true });
});

export default app;
