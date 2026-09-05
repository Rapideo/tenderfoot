-- R7 FOR HIGHERGOV -- RULED, NOT MEASURED FURTHER.
--
-- ⚖️ RULED BY MATT 2026-09-04, ruling sheet D1, option C: "Rate only what's
-- unambiguous, leave the rest unknown." Confirmed 2026-09-05 as the NARROW
-- reading -- record the ruling, change nothing structural. He was shown two
-- wider readings of his own note and declined both, so this migration writes
-- data and touches no grading code.
--
-- WHAT WAS ACTUALLY DECIDED. Migration 026 measured R7 for every source and
-- deliberately left HigherGov alone, so its R7 reads `unknown`. Two of the
-- three judgements needed to translate it decide what a $500/yr source looks
-- like, and both are arguable in a way arithmetic cannot settle:
--
--   P6  34 of 100 feed rows carry NO description, so the feed's p10 is 0
--       characters and P6 would grade `weak`. But where a description exists
--       the median is 579-815 chars, healthier than our own sample-2 median of
--       515. The field is BIMODAL -- good or absent, rarely thin -- and a p10
--       character count is the wrong instrument for it. 019's own comment
--       forbids the flattering alternative: quoting the answer-key subset's
--       p10 of 436 as if it described the feed is "the error this column
--       exists to prevent."
--
--   P8  val_est on 92 of 100 would grade `strong`, but 019's caveat is
--       explicit that those are INFERRED BANDS, not published figures -- ten
--       records returned only six distinct low values. Derived data must never
--       sit beside sourced facts.
--
-- Both are therefore recorded `unknown`: looked at, and deliberately not
-- graded. Matt's note on the ruling gives the reason in his own words --
-- "I think we will find that this is the nature of the data - not everyone
-- will post the same; and things might be left out. My concern is that we have
-- THE ABILITY to see and record the data properly if and when it is there.
-- Quality will always vary."
--
-- ⚠️ THE MATRIX LINE DOES NOT CHANGE, AND THAT IS THE RULING WORKING AS
-- CHOSEN. gradeCompleteness SKIPS `unknown` properties (§5.3: a property
-- nobody measured is not a property the source lacks), so known.length stays
-- 0 and R7 still reads "Not enough measured to grade. 0 of 5 properties
-- measured; 2 needed before a profile is asserted." The ruling lives on the
-- row, not in the computed note. That is the same trade-off D3 option B
-- described, taken deliberately here where D3 itself was ruled the other way.
--
-- 🔴 population_n IS DELIBERATELY NOT SET. The 100 in `indiana_feed_n100` is a
-- SAMPLE of a 9,286-row archive, not the population. Writing it into
-- population_n would let the rubric read a sample size as a source's whole
-- extent, and 100 sits exactly on the minPopulation boundary -- a number that
-- misleads by one row is worse than no number.

-- ---------------------------------------------------------------------------
-- 1. THE RULING, MERGED ONTO THE MEASUREMENT
-- ---------------------------------------------------------------------------
-- `||` rather than a replacement: every figure migration 019 measured against
-- a live trial key stays exactly as recorded. This adds the two property
-- grades and the reason they are what they are.
UPDATE source SET
  field_completeness = coalesce(field_completeness, '{}'::jsonb) || '{
    "P6": "unknown",
    "P8": "unknown",
    "ruled_on": "2026-09-04",
    "ruling": "D1 option C (Matt, ruling sheet 2026-09-04; narrow reading confirmed 2026-09-05): rate only what is unambiguous and leave the rest unknown. P6 UNKNOWN -- the feed description field is bimodal (66/100 present, median 579-815 chars where present, 0 where absent), so a p10 character count returns 0, which is arithmetically correct and the wrong instrument. Quoting the answer-key subset p10 of 436 instead is forbidden by migration 019 as the error the column exists to prevent. P8 UNKNOWN -- val_est covers 92/100 but 019 records those as INFERRED BANDS, not published figures, and derived data must not sit beside sourced facts. Neither is a downgrade: nothing about this source changed, and the earlier `adequate` was a null check firing on prose no grader can read. Deliberately NOT recorded: population_n, because the 100 is a sample of a 9,286-row archive rather than a population."
  }'::jsonb,

  source_note = coalesce(source_note, '') || ' R7 RULED 2026-09-04 (ruling sheet D1, option C): P6 and P8 recorded `unknown` by judgement rather than graded, so R7 stays `unknown` for this source. See migration 029.'
WHERE name = 'HigherGov';

-- ---------------------------------------------------------------------------
-- 2. THE GUARD -- 026 showed what a silent no-op costs here
-- ---------------------------------------------------------------------------
-- A name that does not match leaves the registry recording "never measured"
-- for the very source the migration exists to rule on, and the only symptom is
-- an `unknown` that reads exactly like the one it replaced.
DO $$
DECLARE
  fc jsonb;
BEGIN
  SELECT field_completeness INTO fc FROM source WHERE name = 'HigherGov';

  IF fc IS NULL THEN
    RAISE EXCEPTION
      'migration 029 recorded nothing for HigherGov. The name did not match, so the UPDATE was a silent no-op.';
  END IF;

  IF fc->>'P6' IS DISTINCT FROM 'unknown' OR fc->>'P8' IS DISTINCT FROM 'unknown' THEN
    RAISE EXCEPTION
      'migration 029 did not write P6/P8 as unknown for HigherGov (got P6=%, P8=%).',
      fc->>'P6', fc->>'P8';
  END IF;

  -- The assertion that proves 019's measurement survived the merge. If this
  -- fires, the ruling overwrote the evidence it was ruling on.
  IF fc->'indiana_feed_n100' IS NULL OR fc->>'measured_on' IS NULL THEN
    RAISE EXCEPTION
      'migration 029 replaced HigherGov field_completeness instead of merging into it -- migration 019 measurements are gone.';
  END IF;

  -- §5.3, stated as a check rather than a hope: recording a judgement must not
  -- have quietly promoted this source to a grade.
  IF fc->>'P6' = 'weak' OR fc->>'P8' = 'strong' THEN
    RAISE EXCEPTION
      'migration 029 graded a property the ruling declined to grade.';
  END IF;
END $$;
