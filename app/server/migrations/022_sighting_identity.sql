-- SIGHTING IDENTITY, because merge.ts groups by external_id alone and that is
-- only safe while every source emits a globally unique id.
--
-- merge.ts's own header has carried the warning since SP3.5:
--
--   "grouping is by `external_id` ALONE... If it happens, this code fuses two
--    UNRELATED opportunities into one canonical row, and nothing errors or
--    logs: the merge reports one solicitation with two sightings, which *reads
--    as corroboration*, not as corruption. That is the dangerous part -- it
--    looks like the system working."
--
-- It also named the trigger: "the next sources in line are STATE PORTALS, which
-- commonly emit human-assigned identifiers." Measured 2026-09-03: Allen County,
-- arriving through HigherGov, publishes external ids `132`, `134`, `135`.
--
-- ⚠️ THE OBVIOUS FIX IS THE WRONG ONE, and the header says so: "Do NOT change
-- the grouping key to work around this -- that would break the demo criterion."
-- Grouping by (source_id, external_id) would destroy cross-source dedup, which
-- is the FEATURE: two sources seeing one notice must merge into one record.

-- ---------------------------------------------------------------------------
-- 1. Whether a source's external ids may be trusted GLOBALLY
-- ---------------------------------------------------------------------------
-- DEFAULT 'local', and that default is the safety property. A source added
-- tomorrow cannot fuse anything until somebody deliberately declares its ids
-- global and records why -- the same default-out shape as §5.5.1's legal
-- posture, and for the same reason: the costs are asymmetric. Wrong in the
-- `local` direction under-merges, which is visible and repairable. Wrong in the
-- `global` direction fuses unrelated records, silently and permanently.
ALTER TABLE source ADD COLUMN external_id_scope text NOT NULL DEFAULT 'local'
  CHECK (external_id_scope IN ('global', 'local'));

-- The two the header already vouched for by name: "SAM's opaque `_id` and
-- USASpending's `generated_internal_id` are both effectively globally unique."
-- This records an established fact rather than making a new claim, which is
-- what keeps the demo criterion -- same external_id => same opportunity --
-- working exactly as ruled.
UPDATE source SET external_id_scope = 'global' WHERE name IN ('SAM.gov', 'USASpending');

-- ---------------------------------------------------------------------------
-- 2. The identity a merge groups by, computed once at WRITE time
-- ---------------------------------------------------------------------------
-- Ruled by Matt 2026-09-03: write time, not read time.
--
-- The alternative was computing identity inside merge's correlated subqueries.
-- Those subqueries are covered by a "CRITICAL, hard-won" invariant in merge.ts:
-- three of them must stay UNSCOPED by source, and the original version of that
-- query failed SILENTLY AND PERMANENTLY because a source filter crept into
-- them. Read-time identity needs a source join in exactly those subqueries.
-- Write time keeps their shape and puts the rule in one place.
ALTER TABLE sighting ADD COLUMN identity_key text;

-- Backfill every existing sighting under the same rule the importer now
-- applies. Idempotent: re-running produces identical values.
UPDATE sighting s
   SET identity_key = CASE
         WHEN src.external_id_scope = 'global' THEN s.external_id
         ELSE src.id::text || ':' || s.external_id
       END
  FROM source src
 WHERE src.id = s.source_id
   AND s.external_id IS NOT NULL;

CREATE INDEX sighting_identity ON sighting(identity_key);

-- ⚠️ DELIBERATELY NULLABLE, AND THE COLUMN IS A CACHE, NOT A SECOND RULE.
--
-- external_id_scope above is the single source of truth. identity_key is that
-- rule evaluated once at import time, and merge's coalesce falls back to
-- recomputing THE SAME rule -- not to a different, "safer" one.
--
-- An earlier draft of this migration fell back to the scoped form
-- unconditionally, on the reasoning that forgetting to write the column could
-- then only ever under-merge. It was wrong, and the merge tests caught it: a
-- sighting inserted directly behaved differently from one imported, FOR THE
-- SAME SOURCE. Two rules for one fact is worse than either rule, because the
-- divergence is silent and depends on which code path wrote the row.
--
-- A NOT NULL constraint would be the tidier schema and still the wrong tool:
-- the safety property lives in the DEFAULT of external_id_scope, where a new
-- source is 'local' until somebody declares otherwise with evidence on the row.

-- ---------------------------------------------------------------------------
-- 3. The canonical row carries its identity too
-- ---------------------------------------------------------------------------
-- Not symmetry for its own sake. merge inserts new solicitations with
-- `RETURNING id, external_id` and maps the results back by external_id -- which
-- is ambiguous the moment two sources legitimately share one. Two rows both
-- returning "134" cannot be told apart, and the sightings would be linked to
-- whichever the planner happened to pair them with.
--
-- Returning the identity instead makes the mapping exact, which means the
-- column has to exist on the row.
ALTER TABLE solicitation ADD COLUMN identity_key text;

UPDATE solicitation sol
   SET identity_key = (
         SELECT coalesce(sg.identity_key, sg.source_id::text || ':' || sg.external_id)
           FROM sighting sg
          WHERE sg.solicitation_id = sol.id
          ORDER BY sg.seen_at ASC, sg.id ASC
          LIMIT 1
       )
 WHERE identity_key IS NULL;

CREATE INDEX solicitation_identity ON solicitation(identity_key);
