import PQueue from "p-queue";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { cards, transcripts } from "../db/schema.js";
import { analyzeTranscript, maxTranscriptLine } from "../services/analyze.js";

const CONCURRENCY = Number(process.env.LLM_CONCURRENCY) || 2;

const queue = new PQueue({ concurrency: CONCURRENCY });
const inflight = new Set<string>();

export function enqueueAnalyze(sessionId: string): void {
  if (inflight.has(sessionId)) return;
  inflight.add(sessionId);
  queue
    .add(() => runAnalyze(sessionId))
    .catch((err) => console.error(`[queue] uncaught ${sessionId}:`, err))
    .finally(() => inflight.delete(sessionId));
}

async function runAnalyze(sessionId: string): Promise<void> {
  const row = await db.query.transcripts.findFirst({
    where: eq(transcripts.sessionId, sessionId),
  });
  if (!row) {
    console.warn(`[queue] transcript ${sessionId} missing, skipping`);
    return;
  }
  if (row.status === "done" && row.analyzedMtime === row.transcriptMtime) {
    return;
  }

  const through = row.analyzedThroughLine;
  const maxLine = maxTranscriptLine(row.content);

  // No new content beyond the analyzed cursor (defensive — should not happen
  // for append-only sessions). Mark done without an LLM call.
  if (maxLine <= through) {
    await db
      .update(transcripts)
      .set({
        status: "done",
        analyzedMtime: row.transcriptMtime,
        analyzedAt: sql`now()`,
        error: null,
      })
      .where(eq(transcripts.sessionId, sessionId));
    console.log(
      `[queue] ${sessionId} no new lines (through L${through}), skipped`,
    );
    return;
  }

  await db
    .update(transcripts)
    .set({ status: "analyzing", error: null })
    .where(eq(transcripts.sessionId, sessionId));

  const isIncremental = through > 0;
  console.log(
    `[queue] analyzing ${sessionId} (${row.content.length} chars, ` +
      `${isIncremental ? `incremental after L${through}` : "full"})`,
  );

  let result;
  try {
    result = await analyzeTranscript(
      row.content,
      isIncremental ? { extractAfterLine: through } : {},
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[queue] failed ${sessionId}: ${message}`);
    await db
      .update(transcripts)
      .set({ status: "failed", error: message.slice(0, 2000) })
      .where(eq(transcripts.sessionId, sessionId));
    return;
  }

  // Server-side guard: drop cards anchored at or before the analyzed cursor.
  // Cards with a null user_line can't be checked here — the
  // (session_id, content_hash) unique constraint is the dedup net for those.
  let newCards = result.cards;
  if (isIncremental) {
    newCards = newCards.filter(
      (c) =>
        c.source_ref.user_line == null || c.source_ref.user_line > through,
    );
  }

  const nowIso = new Date().toISOString();

  await db.transaction(async (tx) => {
    let baseIndex = 0;
    if (isIncremental) {
      const [maxRow] = await tx
        .select({
          max: sql<number>`COALESCE(max(${cards.cardIndex}), 0)::int`,
        })
        .from(cards)
        .where(eq(cards.sessionId, sessionId));
      baseIndex = maxRow?.max ?? 0;
    }

    for (let i = 0; i < newCards.length; i++) {
      const card = newCards[i];
      await tx
        .insert(cards)
        .values({
          sessionId,
          cardIndex: baseIndex + i + 1,
          type: card.type,
          userSaid: card.user_said,
          aiPhrased: card.ai_phrased,
          vocab: card.takeaway.vocab,
          pattern: card.takeaway.pattern,
          contextHint: card.context_hint,
          userLine: card.source_ref.user_line,
          aiLine: card.source_ref.ai_line,
          contentHash: card.content_hash,
          createdAt: nowIso,
        })
        .onConflictDoNothing({
          target: [cards.sessionId, cards.contentHash],
        });
    }

    await tx
      .update(transcripts)
      .set({
        status: "done",
        analyzedMtime: row.transcriptMtime,
        analyzedThroughLine: maxLine,
        analyzedAt: sql`now()`,
        model: result.model,
        error: null,
      })
      .where(eq(transcripts.sessionId, sessionId));
  });

  console.log(
    `[queue] done ${sessionId} → +${newCards.length} cards (through L${maxLine})`,
  );
}

export async function recoverPending(): Promise<void> {
  const rows = await db
    .select({ id: transcripts.sessionId })
    .from(transcripts)
    .where(inArray(transcripts.status, ["pending", "analyzing"]));
  if (rows.length === 0) return;
  console.log(`[queue] recovering ${rows.length} pending/analyzing transcripts`);
  for (const r of rows) enqueueAnalyze(r.id);
}

export function queueStats() {
  return { size: queue.size, pending: queue.pending, inflight: inflight.size };
}
