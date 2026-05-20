BEGIN;

ALTER TABLE cards ADD COLUMN content_hash TEXT;
ALTER TABLE cards ADD COLUMN stale BOOLEAN NOT NULL DEFAULT false;

UPDATE cards SET content_hash = left(md5(user_said || '||' || ai_phrased), 16);

ALTER TABLE cards ALTER COLUMN content_hash SET NOT NULL;

ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_session_id_card_index_unique;

ALTER TABLE cards ADD CONSTRAINT cards_session_id_content_hash_unique UNIQUE (session_id, content_hash);

COMMIT;
