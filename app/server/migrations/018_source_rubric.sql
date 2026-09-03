-- THE REGISTRY WAS ALREADY THE RUBRIC'S DATA MODEL, minus three columns.
--
-- Six of the nine dimensions in the 2026-09-03 source rubric score columns that
-- have existed since SP1: legal_posture (R1, a GATE rather than a score),
-- archive_depth (R2), adapter_tier (R3), verified_facets (R4), platform (R5)
-- and jurisdiction (R6). This migration adds the three that were never needed
-- while every source was free and every adapter was written by hand.
--
-- ⚠️ COST IS TWO COLUMNS, NOT ONE, AND THAT IS THE POINT. A nullable
-- annual_cost_usd would mean "free" and "nobody has priced it" with the same
-- NULL -- the exact conflation health = 'unknown' exists to avoid (migration
-- 006). A source nobody has priced is not a free source, and a rubric that
-- treated it as one would rank an unpriced aggregator above a $500 API.
--
-- Every existing row defaults to 'free', which is TRUE and not a convenience:
-- SAM.gov, USASpending, the state portals and the corpus imports have never
-- cost anything. HigherGov, added in 019, is the first paid source in this
-- project's history.
ALTER TABLE source ADD COLUMN cost_posture text NOT NULL DEFAULT 'free'
  CHECK (cost_posture IN ('free', 'paid', 'unknown'));

-- Whole US dollars per year. NULL is correct for BOTH 'free' and 'unknown';
-- cost_posture is the column that tells them apart.
ALTER TABLE source ADD COLUMN annual_cost_usd integer;

-- R7. Which of the rubric's properties this source actually supplies, MEASURED
-- rather than assumed: {"P6":"strong","P8":"weak","P11":"unknown", ...}. jsonb
-- rather than a column each, because the property list is expected to grow and
-- a migration per property would be absurd.
ALTER TABLE source ADD COLUMN field_completeness jsonb;

-- R9. The field that permits an incremental resume -- SAM's modifiedDate,
-- Indiana EDS's endDate, HigherGov's captured_date. NULL means no watermark is
-- known, which forces a full re-read every run. On a metered source that is not
-- an inefficiency, it is a bill.
ALTER TABLE source ADD COLUMN watermark_field text;
