BEGIN;

ALTER TABLE transcripts ADD COLUMN analyzed_through_line INTEGER NOT NULL DEFAULT 0;

-- Backfill: treat already-analyzed sessions as analyzed through their highest
-- card source line. This is a lower bound (true max message line may be higher),
-- so a first incremental run may re-see a few messages — harmless, deduped by
-- the (session_id, content_hash) unique constraint.
UPDATE transcripts t SET analyzed_through_line = COALESCE(
  (
    SELECT max(greatest(coalesce(c.user_line, 0), coalesce(c.ai_line, 0)))
    FROM cards c
    WHERE c.session_id = t.session_id
  ),
  0
)
WHERE t.status = 'done';

COMMIT;
