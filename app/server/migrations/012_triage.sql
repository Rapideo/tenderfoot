-- SP6. The gate's measurement needs a denominator that is a STORED FACT,
-- not a recomputation.
--
-- A seeded ORDER BY is a deterministic permutation of the ELIGIBLE SET, and
-- eligibility is "not closed and not yet decided" -- a set that moves under
-- the session as deadlines pass and ingests land. So a re-seeded draw is
-- reproducible only against a population that no longer exists. The number
-- outlives the session: six months on, "Interested-per-hundred was 3.2 for
-- SAM.gov" needs a denominator somebody can reconstruct.
--
-- This is the discipline corpus/calibration/README.md already imposes, and
-- the discipline two failures this month came from lacking.
CREATE TABLE triage_sample (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       integer NOT NULL REFERENCES source(id),
  drawn_at        timestamptz NOT NULL DEFAULT now(),
  seed            text NOT NULL,
  -- What was ASKED for. Kept apart from the item count on purpose: a source
  -- with 40 eligible rows and n=100 draws 40, and those are different facts.
  n_requested     integer NOT NULL,
  -- Eligible rows AT DRAW TIME. THE DENOMINATOR.
  population_size integer NOT NULL,
  note            text
);

CREATE TABLE triage_sample_item (
  sample_id       integer NOT NULL REFERENCES triage_sample(id),
  solicitation_id integer NOT NULL REFERENCES solicitation(id),
  position        integer NOT NULL,
  PRIMARY KEY (sample_id, solicitation_id)
);

-- Decisions are APPEND-ONLY (spec §5.1). `pursuit_solicitation` was already
-- a plain index rather than a unique constraint, so history was legal in the
-- schema before this migration -- what it was missing was a way to read the
-- latest row cheaply.
--
-- created_at, NOT decided_at: decided_at is a `text` column in migration 002
-- and cannot be sorted reliably. id DESC breaks a same-millisecond tie.
CREATE INDEX pursuit_latest ON pursuit(solicitation_id, created_at DESC, id DESC);
