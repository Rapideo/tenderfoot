-- SP3.6. `source.health` becomes a live statement about whether a source is
-- REACHABLE, written by an operator-invoked probe. `source.last_run_at`
-- stays a separate statement about when we last ran it. See
-- docs/superpowers/specs/2026-08-17-source-health-design.md §1.

-- A verdict with no timestamp is the stale-green trap: health is only
-- measured when someone asks, so a value can be arbitrarily old, and a green
-- dot from three weeks ago reads as current.
ALTER TABLE source ADD COLUMN health_checked_at timestamptz;

-- WHICH probe ran. A `generic-url` pass and a `sam` pass are different
-- strengths of claim, and only the adapter probes can ever return 'rot'.
ALTER TABLE source ADD COLUMN health_method text;

-- WHY. Without it, 'failing' is a red dot with no lead.
ALTER TABLE source ADD COLUMN health_note text;

-- The generic probe's target. Null where a platform probe exists.
ALTER TABLE source ADD COLUMN probe_url text;

-- Overdue. legal_posture has had a CHECK since 002; health never did, and
-- PATCH /api/sources/:id writes this field unvalidated, so any string at all
-- could be stored.
--
-- FINAL REVIEW FINDING 4 (Minor). This CHECK lands BEFORE the excluded-row
-- backfill below, and Postgres validates every existing row at ADD
-- CONSTRAINT time (no NOT VALID) -- so if any environment had ever picked up
-- a stray invalid `health` string through the previously-unvalidated PATCH,
-- this migration would fail outright rather than degrade. Harmless today,
-- verified directly: production and every test schema hold only 'unknown'
-- at migration time, which trivially satisfies this CHECK. Left in this
-- order rather than reordered -- this migration has already run against the
-- test branch, and a migration that has already run must not change shape.
ALTER TABLE source ADD CONSTRAINT source_health_valid
  CHECK (health IN ('ok', 'failing', 'rot', 'excluded', 'unknown'));

-- Never measured, and never will be. Two different reasons, one state --
-- health_note carries which, so the reason survives a row read without its
-- neighbouring columns.
UPDATE source
   SET health = 'excluded',
       health_note = 'legal_posture=' || legal_posture
 WHERE legal_posture <> 'in';

UPDATE source
   SET health = 'excluded',
       health_note = 'no endpoint -- fixed snapshot, not a feed'
 WHERE platform = 'Manual import';
