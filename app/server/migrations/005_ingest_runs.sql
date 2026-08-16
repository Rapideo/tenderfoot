-- The ingest ledger. THE AUTHORITY for "what do we have".
--
-- `ingested_through` advances ONLY on successful import, never on a
-- successful fetch. An artifact fetched and never imported must cost a
-- re-fetch rather than open a gap nobody is told about -- which matters more
-- under hand-invocation than it did under a schedule, because nothing
-- guarantees anyone runs anything on a given day.
--
-- Deliberately NOT source.last_run_at, which stays as it is and means "when
-- a scrape was last attempted". "When we last ran" and "what we have
-- through" are different facts; conflating them reopens the gap.
CREATE TABLE ingest_run (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  ingested_through text,
  artifact_sha256 text NOT NULL UNIQUE,
  rows_imported   integer NOT NULL DEFAULT 0,
  imported_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingest_run_source ON ingest_run(source_id, imported_at DESC);

-- Provenance on every sighting (spec §3.4). `mode` exists from day one and
-- only ever reads 'mechanical'; without the column, a later smart path
-- cannot be COMPARED against this one on the same records, and backfilling
-- it is guesswork.
ALTER TABLE sighting ADD COLUMN extractor_ver text;
ALTER TABLE sighting ADD COLUMN mode text NOT NULL DEFAULT 'mechanical'
  CHECK (mode IN ('mechanical', 'smart'));
ALTER TABLE sighting ADD COLUMN ingest_run_id integer REFERENCES ingest_run(id);
