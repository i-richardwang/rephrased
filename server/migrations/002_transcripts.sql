-- Migration: add transcripts table for server-side analysis pipeline.
-- Source markdown is uploaded here; an in-process worker calls the LLM
-- and writes resulting cards into the existing `cards` table.

BEGIN;

CREATE TABLE transcripts (
  session_id        text PRIMARY KEY,
  source_path       text NOT NULL DEFAULT '',
  content           text NOT NULL,
  transcript_mtime  double precision NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending',
  analyzed_mtime    double precision,
  error             text,
  model             text DEFAULT '',
  uploaded_at       timestamp with time zone NOT NULL DEFAULT now(),
  analyzed_at       timestamp with time zone
);

CREATE INDEX transcripts_status_idx ON transcripts (status);

COMMIT;
