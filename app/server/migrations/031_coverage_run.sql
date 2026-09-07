-- COVERAGE DECAY: DOES HIGHERGOV KEEP FINDING THINGS?
--
-- Step (3) of the sequence Matt set 2026-09-03, and the gate holding the
-- adapter backlog (Illinois, Michigan, Kentucky, Ohio, the OpenGov
-- municipalities). Spec: 2026-09-06-highergov-coverage-reliability-design.md.
--
-- WHY NEW TABLES, HAVING LOOKED FOR AN EXISTING HOME. Two candidates were
-- checked. `triage_sample`/`triage_sample_item` is a frozen, dated, sized
-- cohort -- structurally the right idea -- but triage_sample_item.
-- solicitation_id is NOT NULL REFERENCES solicitation(id). `assessment` is
-- the same. BOTH FORBID THE ONE ROW THIS TEST EXISTS TO RECORD: a miss is a
-- notice we do NOT hold. `sighting` can hold an unlinked observation, but a
-- miss is the ABSENCE of a sighting, and an absence is not a row in a table
-- of presences. The obstruction is structural, not stylistic.
CREATE TABLE coverage_run (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_at        timestamptz NOT NULL DEFAULT now(),
  source_id     integer NOT NULL REFERENCES source(id),
  -- The window the NEW-NOTICE cohort was drawn from. Re-observations of
  -- earlier, unsettled notices also ride on this run (see coverage_item).
  cohort_from   date NOT NULL,
  cohort_to     date NOT NULL,
  -- 🔴 HAZARD: THE INDIANA FILTER LIVES IN HIGHERGOV'S ACCOUNT, NOT OUR CODE.
  -- R1 (docs/2026-09-03-platform-comparison.md) established that
  -- /opportunity/ takes exactly twelve parameters and NONE is a location:
  -- three state parameters were accepted and SILENTLY IGNORED. State
  -- filtering exists only through a saved search. That is an external
  -- dependency on a mutable object we do not version -- if somebody edits or
  -- deletes the saved search the cohort changes and nothing errors. These two
  -- columns are the detector: a step change in feed_count with no change in
  -- our source is the signal.
  search_id     text,
  feed_count    integer,
  records_spent integer NOT NULL DEFAULT 0,
  -- R6: "several source_id lookups returned count=2" -- versioning, via
  -- version_key. A rising duplicate rate is itself a finding, so it is
  -- recorded rather than merely handled.
  duplicates_collapsed integer NOT NULL DEFAULT 0,
  aborted       boolean NOT NULL DEFAULT false,
  note          text
);

CREATE TABLE coverage_item (
  run_id        integer NOT NULL REFERENCES coverage_run(id),
  -- The answer key's identity for this notice. NOT a solicitation_id, for
  -- the reason in this file's header.
  external_id   text NOT NULL,
  segment       text NOT NULL CHECK (segment IN ('state_agency', 'sub_state')),
  -- WHERE THE KEY CAME FROM. Two columns, because only one of the two answer
  -- keys has a registry row: IDOA is seeded as 'Indiana IDOA solicitations',
  -- while the sub-state buyers are pages we read and never ingest. Seeding a
  -- `source` row per municipality would give each one a legal posture, an
  -- adapter tier and a rubric grade it has no business carrying, and would
  -- put buyers we never ingest into the rubric matrix.
  key_source_id integer REFERENCES source(id),
  key_origin    text NOT NULL,
  key_seen_at   timestamptz NOT NULL,
  -- `date`, not timestamptz: merge/closes-at.ts's closesAt() returns a bare
  -- YYYY-MM-DD and its own header explains why -- IDOA states the deadline in
  -- its own civil time, so the date component IS the answer. A timestamptz
  -- here would invent precision the parser does not produce.
  deadline      date,
  -- Three states, not two, and for the reason document.extract_status gives:
  -- "we looked and it is not there" is a different fact from "we have not
  -- looked yet". `unchecked` is written when a run aborts at
  -- maxRecordsPerRun with cohort left unqueried -- those notices are NOT
  -- misses and must never be counted as any.
  carried       text NOT NULL CHECK (carried IN ('carried', 'missing', 'unchecked')),
  captured_date date,
  lead_days     integer,
  PRIMARY KEY (run_id, external_id)
);

-- The query the re-observation rule needs: every unsettled notice, cheapest
-- first. Spec §5.5 -- a notice enters the cohort once and is re-queried until
-- it settles, because a notice carried LATE is exactly what C2 exists to catch.
CREATE INDEX coverage_item_unsettled ON coverage_item(carried, external_id);
