-- R7 -- FIELD COMPLETENESS, RECORDED FOR THE FIRST TIME.
--
-- Migration 018 added `field_completeness` and documented its shape as a
-- property->grade map: {"P6":"strong","P8":"weak","P11":"unknown", ...}.
-- Nothing has ever written that shape. On 2026-09-03 pass 1 found R7 `unknown`
-- for nine of ten scored sources and called it "the cheapest gap on the page to
-- close" -- the numbers were already in the database and nobody had read them.
--
-- Measured 2026-09-04 by `npm run fitness`, whose R7 section prints exactly the
-- values below. fitness/ contains no INSERT, UPDATE or DELETE, which is what
-- lets it be pointed at production; the values reach the registry HERE, as a
-- diff a person reviewed, exactly as migration 021 recorded the watermarks it
-- had verified.
--
-- ⚠️ THE GRADES ARE PRODUCED BY UNRATIFIED THRESHOLDS. `R7` in
-- app/server/src/fitness/thresholds.ts holds every boundary, each marked
-- UNRATIFIED, on the same footing as the floor's F1/F5/F6/F7. Ratifying them is
-- one visible edit and will change grades recorded here.
--
-- 🔴 WHY THE GRADE AND NOT JUST THE NUMBERS. Until 2026-09-04 rubric.ts graded
-- R7 with a NULL CHECK -- any recorded measurement, however bad, came out
-- `adequate`. Writing SAM.gov's numbers under that rule would have graded it
-- `adequate` on a p10 of 84 characters, 0 of 7,070 rows carrying a value, and
-- 3 of 979 document-deferring rows readable, level with HigherGov on the
-- dimension where they differ most. Spec §5.3 forbids collapsing `unknown` into
-- `weak`; that was the same error inverted. R7 now grades the measurement and
-- takes the WEAKEST property, so a rich description cannot compensate for an
-- absent value.

-- ---------------------------------------------------------------------------
-- 1. SAM.gov -- MEASURED AGAINST PRODUCTION
-- ---------------------------------------------------------------------------
-- The only source that has ever completed a real ingest, and its field
-- completeness had never been measured. F6 and F7 are its numbers in all but
-- name and have sat in a floor report for a day.
--
-- 📌 p10 = 84 HERE, WHERE F6 REPORTS 57, AND BOTH ARE RIGHT. F6 measures OUR
-- HOLDINGS -- every biddable row from every source, 7,271 of them. This
-- measures A SOURCE: SAM.gov's own 7,070. The 201-row difference is the two
-- corpus imports, which carry NO descriptions at all, and they drag the global
-- tenth percentile from 84 down to 57. floor.ts's header insists the two
-- readings must not be conflated; this is what that looks like in numbers.
-- Neither figure is comfortable -- 84 characters is still far below the 200 a
-- triage decision needs -- but the published 57 is a blend, not SAM's number.
UPDATE source SET field_completeness = '{
  "P6": "weak",
  "P7": "weak",
  "P8": "weak",
  "P11": "unknown",
  "P14": "unknown",
  "measured_on": "2026-09-04",
  "measured_against": "production",
  "population_n": 7070,
  "evidence": {
    "solicitations_biddable": 7070,
    "description_p10_chars": 84,
    "description_median_chars": 739,
    "open_biddable": 3769,
    "value_presence": 0,
    "defers_to_document": 979,
    "document_reachability": 0.003,
    "insert_lag_median_days": 2.2
  },
  "note": "P8 is 0 of 3,769 open biddable rows: SAM publishes no estimate for open notices, so this is a property of the source and not a gap in the ingest. P11 is recorded but never graded -- solicitation has no capture column and created_at is OUR insert time, so 2.2 days is a proxy nobody has ratified."
}'::jsonb
WHERE name = 'SAM.gov';

-- ---------------------------------------------------------------------------
-- 2. Corpus import -- federal calibration (2026-08-10) -- PRODUCTION
-- ---------------------------------------------------------------------------
-- 140 rows and NOT ONE DESCRIPTION. p10 and median are both 0, which is what a
-- backfill of identifiers without payload looks like. Graded rather than left
-- unknown because 140 rows clears the population floor: this is measured
-- absence, not absence of measurement.
UPDATE source SET field_completeness = '{
  "P6": "weak",
  "P7": "unknown",
  "P8": "weak",
  "P11": "unknown",
  "P14": "unknown",
  "measured_on": "2026-09-04",
  "measured_against": "production",
  "population_n": 140,
  "evidence": {
    "solicitations_biddable": 140,
    "description_p10_chars": 0,
    "description_median_chars": 0,
    "open_biddable": 13,
    "value_presence": 0,
    "defers_to_document": 0,
    "insert_lag_median_days": 411.2
  },
  "note": "P7 is `unknown` and not `weak`: no description matched a deferral marker, and zero of zero is not zero percent -- there is nothing to reach. The 411-day insert lag is the backfill, not latency, which is why P11 is never graded."
}'::jsonb
WHERE name = 'Corpus import — federal calibration (2026-08-10)';

-- ---------------------------------------------------------------------------
-- 3. Corpus import -- Indiana open (2026-08-04) -- PRODUCTION
-- ---------------------------------------------------------------------------
-- ⚠️ MEASURED, AND STILL `unknown` ON EVERY PROPERTY. 61 rows is below the
-- population floor of 100, so nothing is graded -- spec §5.3: too few rows to
-- grade is not the same as graded badly, and recording an untested source as
-- weak converts absence of evidence into evidence of absence.
--
-- Recorded anyway, deliberately. "Measured, and too small to grade" is a
-- different and more useful fact than "never measured", and it stops the next
-- reader spending the effort again.
UPDATE source SET field_completeness = '{
  "P6": "unknown",
  "P7": "unknown",
  "P8": "unknown",
  "P11": "unknown",
  "P14": "unknown",
  "measured_on": "2026-09-04",
  "measured_against": "production",
  "population_n": 61,
  "evidence": {
    "solicitations_biddable": 61,
    "description_p10_chars": 0,
    "description_median_chars": 0,
    "open_biddable": 12,
    "defers_to_document": 0
  },
  "note": "Below the population floor of 100. Every property is `unknown` BY RULE, not by outcome. The p10 of 0 is real and would grade P6 weak on a larger population, but 61 rows will not be made to carry that claim."
}'::jsonb
WHERE name = 'Corpus import — Indiana open (2026-08-04)';

-- ---------------------------------------------------------------------------
-- 4. Indiana EDS contract register -- MEASURED AGAINST THE `test` BRANCH
-- ---------------------------------------------------------------------------
-- ⚠️ AND THAT IS NOT A COMPROMISE. Production holds ZERO contracts; the
-- register's 204,920 rows live on `test`, where they were ingested 2026-09-03.
-- R7 scores A SOURCE, not our holdings -- spec §5.1 -- and whether the register
-- supplies a vendor, a value and an end date on every row is a property of the
-- register, not of which branch we happened to load it into. The floor is what
-- reads holdings, and it still says production has none.
--
-- 🔴 THE VENDOR IS PRESENT ON ALL 204,920 ROWS AND `vendor_id` IS NULL ON ALL
-- 204,920 ROWS. contracts/import.ts lands the raw name in `source_note` as
-- "vendorName: ..." by a documented v1 ruling: normalising TIMOTHY WARRICK
-- against Timothy Warrick, Inc. is its own slice, and an un-normalised corpus
-- beats one that does not exist. Measuring presence as `vendor_id IS NOT NULL`
-- graded this register P14 `weak` on its first run -- a measurement punishing a
-- deliberate decision. Fixed before recording; the unresolved count is kept as
-- evidence, because incumbency means GROUPING a vendor's contracts and nobody
-- can group by a name no one has normalised.
UPDATE source SET field_completeness = '{
  "P6": "unknown",
  "P7": "unknown",
  "P8": "strong",
  "P11": "unknown",
  "P14": "strong",
  "measured_on": "2026-09-04",
  "measured_against": "test branch — production holds no contracts",
  "population_n": 204920,
  "evidence": {
    "contracts": 204920,
    "value_presence": 1,
    "contract_completeness": 1,
    "contracts_vendor_unresolved": 204920
  },
  "note": "P6 and P7 are `unknown` because they are solicitation properties and this register publishes no solicitations -- not because it failed them. P8 reads the value on the CONTRACT: for a register that is where a value lives, and reading it there is what gives this source two known properties rather than one, without which R7 could never grade it at all. ⚠️ All 204,920 vendors are UNRESOLVED raw names; the register supplies the vendor, we have not normalised it."
}'::jsonb
WHERE name = 'Indiana EDS contract register';

-- ---------------------------------------------------------------------------
-- 5. HigherGov -- DELIBERATELY NOT TOUCHED, AND ITS R7 CHANGES ANYWAY
-- ---------------------------------------------------------------------------
-- ⚠️ READ THIS BEFORE CONCLUDING THE MATRIX GOT WORSE. HigherGov's R7 moves
-- from `adequate` to `unknown` with this migration, and NOTHING ABOUT THE
-- SOURCE CHANGED. The old `adequate` was produced by a null check on a column
-- that happened to be non-null -- it was never a reading of field completeness.
-- Its row holds a rich, real measurement (migration 019) in a shape no grader
-- can read: raw counts and prose, not the property map 018 specified.
--
-- 🅿️ TRANSLATING IT NEEDS A RULING, NOT A MIGRATION. Two of the three
-- judgements change what a paid source looks like on the page:
--
--   * P6. 34 of 100 feed rows carry NO description, so the feed's tenth
--     percentile is 0 characters and P6 would grade `weak`. The arithmetic is
--     not in doubt. But 019's own comment forbids the alternative -- quoting
--     the answer-key subset's p10 of 436 as if it described the feed is "the
--     error this column exists to prevent" -- so the honest number is the
--     unflattering one, on the source we are about to buy.
--   * P8. `val_est` is present on 92 of 100, which would grade `strong` -- but
--     019's caveat says val_est_low/high are INFERRED BANDS, not published
--     figures, and "must never be written into value_cents beside sourced
--     facts". Grading a modelled value as value presence would launder derived
--     data into a measured fact.
--
-- Under weakest-wins those two produce R7 `weak` for HigherGov. That may well
-- be the truth -- the missing-description rate IS the open question STATUS
-- carries as "the description ruling" -- but it is a judgement about a $500/yr
-- purchase, read out of prose, and CLAUDE.md is explicit that a conflict like
-- this is surfaced for Matt rather than resolved quietly in either direction.
-- Left `unknown` until he rules. `unknown` blocks; it does not flatter.

-- ---------------------------------------------------------------------------
-- 6. THE GUARD -- because a name that does not match updates NOTHING, silently
-- ---------------------------------------------------------------------------
-- Three of the four names above contain an EM DASH, and two carry a
-- parenthesised date. A single wrong character makes the UPDATE a no-op: it
-- reports success, applies cleanly, and records nothing. The registry would
-- then say "never measured" for a source this migration exists to measure, and
-- the only symptom would be an `unknown` nobody questions.
--
-- This project has been bitten by exactly this shape before -- an empty paste
-- that looks identical to a missing value, a Discover count that answered a
-- different question than the one asked. So the migration refuses to apply
-- unless every row it names actually took its value.
-- ⚠️ THE TWO TIERS ARE NOT FUSSINESS, they are the only way this check means
-- anything. `SAM.gov` and `Indiana EDS contract register` are SEEDED, so they
-- exist in every database and their absence is always a bug. The two corpus
-- imports are created BY AN IMPORT RUN, so a fresh database legitimately has
-- neither -- and a first attempt at this guard failed every DB-backed test in
-- the suite by treating "not imported here" as "misspelt".
--
-- 🔴 BUT "SKIP IT IF THE NAME IS ABSENT" WOULD MAKE THE GUARD INERT for exactly
-- the failure it exists to catch: a misspelt name is also an absent name. So
-- the corpus rows are checked BY PREFIX instead. A typo in either full name
-- leaves a real `Corpus import%` row unmeasured, and this still fires -- while
-- a database that never ran an import has no such row and passes vacuously.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(n, ', ') INTO missing
    FROM unnest(ARRAY['SAM.gov', 'Indiana EDS contract register']) AS n
   WHERE NOT EXISTS (
     SELECT 1 FROM source s
      WHERE s.name = n
        AND s.field_completeness ? 'measured_on'
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'migration 026 recorded nothing for the seeded source(s): %. The name did not match, so the UPDATE was a silent no-op.',
      missing;
  END IF;

  SELECT string_agg(s.name, ', ') INTO missing
    FROM source s
   WHERE s.name LIKE 'Corpus import%'
     AND (s.field_completeness IS NULL OR NOT s.field_completeness ? 'measured_on');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'migration 026 left a corpus import unmeasured: %. The name in the UPDATE above does not match the row that exists.',
      missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- WHAT IS STILL UNMEASURED, so the gap is a decision and not an oversight
-- ---------------------------------------------------------------------------
-- Illinois BidBuy, Kentucky eMARS, Michigan SIGMA, USASpending, Ohio OhioBuys,
-- GovWin IQ, BidNet Direct, BidPrime and Indiana IDOA all hold nothing on
-- production, so there is nothing to measure from data. IDOA holds 45 rows on
-- `test` -- below the floor, and red-flagged 2026-09-02 besides. Closing these
-- needs a probe, which is pass 2's job and costs a request, not a query.
