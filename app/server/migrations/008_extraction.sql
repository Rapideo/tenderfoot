-- SP4. Documents are fetched, parsed and DISCARDED: a citation quotes the
-- extracted passage, so there are no bytes to keep. `path` (a filesystem
-- path from the pre-Vercel design) is left alone rather than dropped --
-- dropping a column is a claim about rows that may yet mean something by it.
ALTER TABLE document ADD COLUMN source_url         text;
ALTER TABLE document ADD COLUMN parent_document_id integer REFERENCES document(id);

-- Every extracted field carries its confidence AND the passage it came from.
-- `assessment.evidence` is the right shape but belongs to scoring, parked.
--
-- CONFLICTS ARE ROWS, NOT A FLAG. One solicitation may hold a 'listing' row
-- and several 'document' rows for the same field_name with different values.
-- Precedence is applied at READ time, so the rule can change without
-- re-extraction and nothing is discarded at ingest.
--
-- value_text NULL = looked for and ABSENT. No row at all = never looked for.
-- The same three-state distinction extract_status already enforces.
CREATE TABLE extracted_field (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitation_id integer NOT NULL REFERENCES solicitation(id),
  field_name      text NOT NULL,
  value_text      text,
  origin          text NOT NULL CHECK (origin IN ('listing','document')),
  document_id     integer REFERENCES document(id),
  quote           text,
  confidence      double precision,
  produced_by     text CHECK (produced_by IN ('mechanical','smart') OR produced_by IS NULL),
  -- Carries what a value cannot: chiefly that a spreadsheet total is a CACHED
  -- value replayed by SheetJS rather than one computed now. A stale cache is
  -- indistinguishable from a fresh one.
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extracted_field_solicitation ON extracted_field(solicitation_id, field_name);
