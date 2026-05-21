import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { cards, transcripts } from "../db/schema.js";
import { requireBearer } from "../middleware/auth.js";
import { enqueueAnalyze, queueStats } from "../worker/queue.js";

const app = new Hono();

interface UploadPayload {
  session_id: string;
  source_path?: string;
  content: string;
  transcript_mtime?: number;
}

// All write routes are bearer-protected; reads are public for the web UI.
app.post("/", requireBearer, async (c) => {
  const body = await c.req.json<UploadPayload>();
  if (!body.session_id || !body.content) {
    return c.json({ error: "session_id and content required" }, 400);
  }

  const existing = await db.query.transcripts.findFirst({
    where: eq(transcripts.sessionId, body.session_id),
  });

  const incomingMtime = body.transcript_mtime ?? 0;
  const unchanged =
    existing &&
    existing.status === "done" &&
    existing.transcriptMtime === incomingMtime &&
    existing.content === body.content;

  if (unchanged) {
    return c.json({
      ok: true,
      session_id: body.session_id,
      status: "done",
      queued: false,
      message: "already analyzed, no changes",
    });
  }

  await db
    .insert(transcripts)
    .values({
      sessionId: body.session_id,
      sourcePath: body.source_path ?? "",
      content: body.content,
      transcriptMtime: incomingMtime,
      status: "pending",
      error: null,
    })
    .onConflictDoUpdate({
      target: transcripts.sessionId,
      set: {
        sourcePath: body.source_path ?? "",
        content: body.content,
        transcriptMtime: incomingMtime,
        status: "pending",
        error: null,
      },
    });

  enqueueAnalyze(body.session_id);

  return c.json({
    ok: true,
    session_id: body.session_id,
    status: "pending",
    queued: true,
  });
});

app.get("/", async (c) => {
  const rows = await db
    .select({
      sessionId: transcripts.sessionId,
      sourcePath: transcripts.sourcePath,
      transcriptMtime: transcripts.transcriptMtime,
      status: transcripts.status,
      analyzedMtime: transcripts.analyzedMtime,
      error: transcripts.error,
      model: transcripts.model,
      uploadedAt: transcripts.uploadedAt,
      analyzedAt: transcripts.analyzedAt,
    })
    .from(transcripts)
    .orderBy(desc(transcripts.uploadedAt));
  return c.json({ transcripts: rows, queue: queueStats() });
});

app.get("/:sid", async (c) => {
  const sid = c.req.param("sid");
  const row = await db.query.transcripts.findFirst({
    where: eq(transcripts.sessionId, sid),
  });
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// Full re-analysis: drop all existing cards and re-analyze from scratch.
// This is the only destructive path — it discards user curation (favorites,
// view history) and must be triggered explicitly.
app.post("/:sid/analyze", requireBearer, async (c) => {
  const sid = c.req.param("sid");
  const row = await db.query.transcripts.findFirst({
    where: eq(transcripts.sessionId, sid),
  });
  if (!row) return c.json({ error: "not found" }, 404);
  await db.transaction(async (tx) => {
    await tx.delete(cards).where(eq(cards.sessionId, sid));
    await tx
      .update(transcripts)
      .set({ status: "pending", analyzedThroughLine: 0, error: null })
      .where(eq(transcripts.sessionId, sid));
  });
  enqueueAnalyze(sid);
  return c.json({ ok: true, status: "pending" });
});

app.delete("/:sid", requireBearer, async (c) => {
  const sid = c.req.param("sid");
  await db.delete(cards).where(eq(cards.sessionId, sid));
  await db.delete(transcripts).where(eq(transcripts.sessionId, sid));
  return c.json({ ok: true });
});

export default app;
