import PQueue from "p-queue";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { cards, transcripts } from "../db/schema.js";
import { analyzeTranscript } from "../services/analyze.js";

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
  if (
    row.status === "done" &&
    row.analyzedMtime === row.transcriptMtime
  ) {
    return;
  }

  await db
    .update(transcripts)
    .set({ status: "analyzing", error: null })
    .where(eq(transcripts.sessionId, sessionId));

  console.log(`[queue] analyzing ${sessionId} (${row.content.length} chars)`);

  let result;
  try {
    result = await analyzeTranscript(row.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[queue] failed ${sessionId}: ${message}`);
    await db
      .update(transcripts)
      .set({ status: "failed", error: message.slice(0, 2000) })
      .where(eq(transcripts.sessionId, sessionId));
    return;
  }

  const nowIso = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.delete(cards).where(eq(cards.sessionId, sessionId));

    if (result.cards.length > 0) {
      await tx.insert(cards).values(
        result.cards.map((card, i) => ({
          sessionId,
          cardIndex: i + 1,
          type: card.type,
          userSaid: card.user_said,
          aiPhrased: card.ai_phrased,
          vocab: card.takeaway.vocab,
          pattern: card.takeaway.pattern,
          contextHint: card.context_hint,
          userLine: card.source_ref.user_line,
          aiLine: card.source_ref.ai_line,
          createdAt: nowIso,
        })),
      );
    }

    await tx
      .update(transcripts)
      .set({
        status: "done",
        analyzedMtime: row.transcriptMtime,
        analyzedAt: sql`now()`,
        model: result.model,
        error: null,
      })
      .where(eq(transcripts.sessionId, sessionId));
  });

  console.log(`[queue] done ${sessionId} → ${result.cards.length} cards`);
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
