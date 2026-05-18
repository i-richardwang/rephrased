import { Hono } from "hono";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, cards } from "../db/schema.js";

const app = new Hono();

interface IngestPayload {
  session_id: string;
  source_path?: string;
  processed_at?: string;
  model?: string;
  card_count?: number;
  transcript_mtime?: number;
  cards: Array<{
    type: string;
    user_said: string;
    ai_phrased: string;
    takeaway?: { vocab?: string[]; pattern?: string };
    context_hint?: string;
    source_ref?: { user_line?: number; ai_line?: number };
  }>;
}

app.post("/ingest", async (c) => {
  const body = await c.req.json<IngestPayload>();

  await db
    .insert(sessions)
    .values({
      id: body.session_id,
      sourcePath: body.source_path ?? "",
      processedAt: body.processed_at ?? "",
      model: body.model ?? "",
      cardCount: body.card_count ?? body.cards.length,
      transcriptMtime: body.transcript_mtime ?? 0,
    })
    .onConflictDoUpdate({
      target: sessions.id,
      set: {
        sourcePath: body.source_path ?? "",
        processedAt: body.processed_at ?? "",
        model: body.model ?? "",
        cardCount: body.card_count ?? body.cards.length,
        transcriptMtime: body.transcript_mtime ?? 0,
      },
    });

  await db.delete(cards).where(eq(cards.sessionId, body.session_id));

  let count = 0;
  for (let i = 0; i < body.cards.length; i++) {
    const card = body.cards[i];
    const takeaway = card.takeaway ?? {};
    const sourceRef = card.source_ref ?? {};
    await db.insert(cards).values({
      sessionId: body.session_id,
      cardIndex: i + 1,
      type: card.type,
      userSaid: card.user_said,
      aiPhrased: card.ai_phrased,
      vocab: takeaway.vocab ?? [],
      pattern: takeaway.pattern ?? "",
      contextHint: card.context_hint ?? "",
      userLine: sourceRef.user_line ?? null,
      aiLine: sourceRef.ai_line ?? null,
      createdAt: body.processed_at ?? new Date().toISOString(),
    });
    count++;
  }

  return c.json({ ok: true, session_id: body.session_id, cards_ingested: count });
});

app.get("/sessions", async (c) => {
  const rows = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.transcriptMtime));
  return c.json(rows);
});

app.get("/lexicon", async (c) => {
  const rows = await db
    .select({
      sessionId: cards.sessionId,
      vocab: cards.vocab,
      aiPhrased: cards.aiPhrased,
      pattern: cards.pattern,
    })
    .from(cards);

  const vocabMap = new Map<
    string,
    { count: number; sessions: Set<string>; examples: string[] }
  >();
  const patternMap = new Map<
    string,
    { count: number; sessions: Set<string> }
  >();

  for (const row of rows) {
    const vocabArr = (row.vocab ?? []) as string[];
    for (const v of vocabArr) {
      const word = v.trim();
      if (!word) continue;
      let entry = vocabMap.get(word);
      if (!entry) {
        entry = { count: 0, sessions: new Set(), examples: [] };
        vocabMap.set(word, entry);
      }
      entry.count++;
      entry.sessions.add(row.sessionId);
      if (row.aiPhrased && entry.examples.length < 3) {
        entry.examples.push(row.aiPhrased);
      }
    }

    const pat = (row.pattern ?? "").trim();
    if (pat) {
      let entry = patternMap.get(pat);
      if (!entry) {
        entry = { count: 0, sessions: new Set() };
        patternMap.set(pat, entry);
      }
      entry.count++;
      entry.sessions.add(row.sessionId);
    }
  }

  const vocab = [...vocabMap.entries()]
    .map(([word, d]) => ({
      word,
      count: d.count,
      sessions: [...d.sessions],
      examples: d.examples,
    }))
    .sort((a, b) => b.count - a.count);

  const patterns = [...patternMap.entries()]
    .map(([pattern, d]) => ({
      pattern,
      count: d.count,
      sessions: [...d.sessions],
    }))
    .sort((a, b) => b.count - a.count);

  return c.json({ vocab, patterns, cardTotal: rows.length });
});

export default app;
