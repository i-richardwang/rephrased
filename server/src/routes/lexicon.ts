import { Hono } from "hono";
import { db } from "../db/index.js";
import { cards } from "../db/schema.js";

const app = new Hono();

app.get("/", async (c) => {
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
