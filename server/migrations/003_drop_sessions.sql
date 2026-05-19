-- Migration: drop the `sessions` table; cards now FK directly to transcripts.
-- The sessions table was a metadata cache that became fully redundant once the
-- transcripts table started carrying the same fields plus processing state.

BEGIN;

-- Ensure every card has a matching transcript (the worker has been writing
-- both since the transcripts table was introduced, so this should be a no-op).
INSERT INTO transcripts (session_id, source_path, transcript_mtime, status, content)
SELECT s.id, s.source_path, s.transcript_mtime, 'done', ''
FROM sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM transcripts t WHERE t.session_id = s.id
);

ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_session_id_sessions_id_fk;
ALTER TABLE cards
  ADD CONSTRAINT cards_session_id_transcripts_session_id_fk
  FOREIGN KEY (session_id) REFERENCES transcripts (session_id) ON DELETE CASCADE;

DROP TABLE sessions;

COMMIT;
