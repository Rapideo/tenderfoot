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
