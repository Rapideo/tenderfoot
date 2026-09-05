-- R9 -- A PROBED ABSENCE STOPS READING AS AN UNEXAMINED ONE.
--
-- ⚖️ RULED BY MATT 2026-09-04, ruling sheet D3, option A: "Fix it — record
-- checked-and-absent differently." He was shown option C as well (fix it, then
-- audit every other dimension for the same flaw) and did not take it, so this
-- migration touches R9 AND NOTHING ELSE. The audit is not refused; it is
-- unasked, and doing it here would be doing work he declined.
--
-- THE DEFECT. rubric.ts graded R9 `watermark_field IS NULL ? unknown : strong`
-- -- a null check, which is the exact shape R7 carried until migration 026 and
-- the second instance of it found in two days. Illinois BidBuy was probed on
-- 2026-09-04 (migration 027) across both its filter surface and its sort
-- surface: "modified" appears 0 times in 263,822 bytes, and no modification
-- time is offered anywhere. Kentucky eMARS VSS has never been looked at; its
-- registry row says INFERRED FROM PLATFORM, not tested. Both graded `unknown`
-- carrying an identical note, so a day of probing left no trace on the matrix
-- it was performed to inform.
--
-- 🔴 WHY A MEASURED ABSENCE IS `weak` AND NOT `unknown`, because this is the
-- judgement worth challenging. Spec §5.3 forbids recording `unknown` as
-- `weak`: "Recording those as `weak` would convert an absence of evidence into
-- evidence of absence." BidBuy is the INVERSE case -- evidence of absence,
-- gathered on purpose. R2 has always drawn exactly this line, and gradeArchive
-- still says it in one sentence: "Documented as retaining nothing. That is
-- evidence, not an absence of it." R9 is brought into line with R2. Nothing
-- new is being invented, and §5.3's protected branch -- the unprobed source --
-- still grades `unknown`.

-- ---------------------------------------------------------------------------
-- 1. THE COLUMN
-- ---------------------------------------------------------------------------
-- A TIMESTAMP RATHER THAN A BOOLEAN, and rather than a key in verified_facets.
-- Migration 006 established the pattern this follows: source health records
-- `health_checked_at`, and SP3.6's demo criterion turned on precisely that
-- stamp -- a skipped row was left `unknown` AND UNSTAMPED, which is what made
-- "we did not look" legible next to "we looked and it was fine". The same
-- distinction, the same instrument.
--
-- ⚠️ NOT a key in verified_facets, though 027 wrote its finding there too.
-- `watermark_probe_2026_09_04` carries the date IN THE KEY NAME, so reading it
-- back means matching a pattern rather than a column, and the next probe
-- invents a new key. The prose stays where it is -- it is the evidence a person
-- reads -- but the GRADE must turn on something a query can see.
ALTER TABLE source ADD COLUMN watermark_probed_at timestamptz;

COMMENT ON COLUMN source.watermark_probed_at IS
  'When a watermark was deliberately looked for. NULL = nobody has looked, and R9 grades `unknown`. Set while watermark_field is still NULL = looked for and none exists, and R9 grades `weak` (§5.3: that is evidence of absence, not an absence of evidence).';

-- ---------------------------------------------------------------------------
-- 2. THE TWO SOURCES PROBED ON 2026-09-04
-- ---------------------------------------------------------------------------
-- Both probes ran the same day under migration 027, and they returned opposite
-- answers. Both are stamped, because the stamp records THAT WE LOOKED, not what
-- we found -- stamping only the failures would rebuild the same blind spot one
-- level down.
UPDATE source SET watermark_probed_at = TIMESTAMPTZ '2026-09-04 00:00:00+00'
 WHERE name IN ('Illinois BidBuy', 'USASpending');

-- ⚠️ SAM.gov AND THE EDS REGISTER ARE DELIBERATELY NOT STAMPED. Migration 021
-- wrote their watermarks and its comment says it recorded ones it had
-- verified, but it recorded no date, and inventing one to tidy a column would
-- be manufacturing evidence. They carry a `watermark_field`, so R9 grades them
-- `strong` with or without a stamp -- rubric.test.ts pins that, so this
-- omission cannot silently downgrade them. If someone later establishes when
-- those probes ran, the stamp is one UPDATE away.

-- ---------------------------------------------------------------------------
-- 3. THE GUARD -- the same one 027 needed, for the same reason
-- ---------------------------------------------------------------------------
-- 026 demonstrated what a silent no-op costs here: the registry records "never
-- measured" for the very source the migration exists to measure, and the only
-- symptom is an `unknown` that nobody questions. A name that does not match is
-- the failure mode, and it is invisible without this block.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(n, ', ') INTO missing
    FROM unnest(ARRAY['Illinois BidBuy', 'USASpending']) AS n
   WHERE NOT EXISTS (
     SELECT 1 FROM source s
      WHERE s.name = n AND s.watermark_probed_at IS NOT NULL
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'migration 028 stamped nothing for: %. The name did not match, so the UPDATE was a silent no-op and R9 still hides the probe.',
      missing;
  END IF;

  -- The assertion that proves the fix actually separates the two cases. If this
  -- ever fires, the column exists but the distinction it was added for does
  -- not.
  IF EXISTS (SELECT 1 FROM source
              WHERE name = 'Illinois BidBuy' AND watermark_field IS NOT NULL) THEN
    RAISE EXCEPTION
      'migration 028 found a watermark on Illinois BidBuy. 027 established there is none -- see its block 2.';
  END IF;

  IF EXISTS (SELECT 1 FROM source
              WHERE name = 'Kentucky eMARS VSS' AND watermark_probed_at IS NOT NULL) THEN
    RAISE EXCEPTION
      'migration 028 stamped Kentucky eMARS VSS, which has never been probed. The stamp means we looked; writing it where we did not is the defect this migration removes, rebuilt.';
  END IF;
END $$;
