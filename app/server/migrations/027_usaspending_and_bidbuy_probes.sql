-- PASS 2, PROBES P3 AND P4 -- run 2026-09-04, both free, no API key anywhere.
--
-- Pass 1 (docs/2026-09-03-source-assessments.md) left a probe list ordered by
-- cost. These are the two free ones that close a dimension. Neither touches
-- HigherGov and neither spends a metered record.
--
-- ⚠️ THE TWO RESULTS ARE OPPOSITE, AND BOTH ARE WORTH HAVING. USASpending is
-- the first source this project has tested that honours every parameter it
-- accepts AND rejects the ones it does not. Illinois BidBuy has no watermark at
-- all, and the finding is recorded so nobody probes it a third time.

-- ---------------------------------------------------------------------------
-- 1. USASpending -- R4 AND R9 BOTH CLOSE, AND THE SOURCE BEHAVES BETTER THAN
--    ANY OTHER WE HAVE MEASURED
-- ---------------------------------------------------------------------------
-- §5.4's check is "vary one parameter and watch the total move". Design spec
-- §5.7-5.8 record FOUR instances across THREE platforms of a parameter accepted
-- and silently ignored, and HigherGov made a fifth -- its three state
-- parameters each returned HTTP 200 with the count UNCHANGED.
--
-- USASpending does the opposite, measured on /search/spending_by_award_count/
-- with award_type_codes A,B,C,D over FY2025:
--
--     no location filter                     5,782,489 contracts
--     place_of_performance state = IN           28,958
--     place_of_performance state = ZZ (control)      0
--
-- The control is the part that matters. A filter that is silently ignored
-- returns the BASELINE for a nonsense value; this returned zero, so the
-- parameter is genuinely applied rather than merely accepted.
--
-- 🔴 AND A BOGUS ENUM IS REJECTED, NOT SWALLOWED. `date_type: "bogus_date_type"`
-- returns HTTP 400 naming the valid values, where every other platform we have
-- tested would have returned 200 and ignored it. A source that fails LOUDLY is
-- worth more than one that fails quietly, and nothing else in this registry
-- has been shown to do it.
UPDATE source SET
  verified_facets = '{
    "works": ["time_period", "date_type", "place_of_performance_locations", "award_type_codes"],
    "silently_ignored": [],
    "verified": "§5.4 run 2026-09-04 on /api/v2/search/spending_by_award_count/. FY2025 contract awards: unconstrained 5,782,489; place_of_performance state=IN 28,958; state=ZZ (control) 0. The ZZ control is the proof -- an ignored filter returns the baseline for a nonsense value, and this returned zero.",
    "rejects_bad_input": "date_type=bogus_date_type returns HTTP 400 listing [action_date, last_modified_date, date_signed, new_awards_only]. FIRST source measured in this project that REJECTS an unknown parameter value instead of accepting and ignoring it. Contrast the five recorded silent-ignore instances across four platforms.",
    "date_type_moves_the_count": "Indiana contracts, 2025-01-01..2025-01-31: omitted 5,828 · action_date 2,018 · last_modified_date 1,826 · date_signed 1,865. Each named type yields a DIFFERENT number, so date_type is honoured.",
    "⚠️ default_date_type_is_unexplained": "Omitting date_type returns 5,828, which matches NONE of the three named types. Whatever the implicit default means, it is not one of the documented values. ALWAYS PASS date_type EXPLICITLY -- an adapter that omits it is filtering on semantics nobody here has established.",
    "archive_confirmed": "The API states searches are limited to an earliest date of 2007-10-01, which is exactly FY2008 and corroborates the archive_depth already on this row. Older data needs the Custom Award Download or bulk_download endpoints, not search."
  }'::jsonb,

  -- R9. `last_modified_date` works BOTH ways, which is what makes it a real
  -- watermark rather than a readable field: it is a `date_type` the search
  -- filters on, AND it is exposed per row as `Last Modified Date` with
  -- timestamp precision (observed `2026-08-27 10:18:29`). A source with a
  -- watermark can resume; one without re-reads everything, which on a metered
  -- source is a bill and on this one is merely waste.
  watermark_field = 'last_modified_date',

  -- ⚠️ NOT THE ENDPOINT THE PROBE ACTUALLY USED, AND DELIBERATELY SO.
  -- /search/spending_by_award_count/ is POST-only and answers GET with 405, so
  -- recording it here would have made the generic URL probe report this source
  -- `failing` forever -- a health signal that lies. Checked before writing.
  --
  -- This endpoint is better than a reachability ping: it returns
  -- {"last_updated":"09/04/2026"}, so a STALE value is itself the §5.4 rot
  -- signal. §5.4's whole argument is that the failure mode is a source that
  -- quietly stops returning fresh rows, and this answers that question directly.
  probe_url = 'https://api.usaspending.gov/api/v2/awards/last_updated/',

  source_note = coalesce(source_note, '') || ' PROBED 2026-09-04 (P3): §5.4 passed with a control, `last_modified_date` confirmed as a true watermark, and a bogus enum value rejected with HTTP 400 rather than ignored. Freshness endpoint /api/v2/awards/last_updated/ answered 09/04/2026 on the day of the probe. See migration 027 and docs/2026-09-03-source-assessments.md.'
WHERE name = 'USASpending';

-- ---------------------------------------------------------------------------
-- 2. Illinois BidBuy -- R9 STAYS OPEN, AND THAT IS NOW A MEASURED ANSWER
-- ---------------------------------------------------------------------------
-- 🔴 watermark_field IS DELIBERATELY LEFT NULL. The advanced search offers
-- exactly two date controls -- `Opening Date From` and `Opening Date To` -- and
-- the strings "modified" and "Modified" do not appear ONCE in 263,822 bytes of
-- the search page. The results grid's sort list is equally complete and equally
-- unhelpful: Bid Solicitation #, Organization Name, Buyer, Description, Bid
-- Opening Date, Status, Alternate Id. Neither the filter surface nor the sort
-- surface exposes a modification time.
--
-- ⚠️ THE TEMPTING WRONG ANSWER IS `openingDateFrom`, AND IT WAS RULED OUT
-- BEFORE THE PROBE RAN (Matt, 2026-09-04). It is already in this row's verified
-- `works` list, so writing it into watermark_field would cost nothing and would
-- grade R9 `strong`. AN OPENING DATE IS NOT A MODIFIED DATE. A run resuming on
-- it collects newly-opened solicitations and SILENTLY MISSES every amendment to
-- one already opened -- addenda, deadline changes, cancellations -- which is
-- precisely the class of quiet loss §5.4 exists to catch. A column that makes
-- the rubric say `strong` about a resume that loses data is worse than a null.
--
-- So R9 remains `unknown` for this source. The finding is recorded here so the
-- next reader does not spend a third probe rediscovering it.
UPDATE source SET
  verified_facets = coalesce(verified_facets, '{}'::jsonb) || '{
    "watermark_probe_2026_09_04": "NO WATERMARK EXISTS. Advanced search offers only Opening Date From / Opening Date To; \"modified\" appears 0 times in 263,822 bytes. Results-grid sort offers Bid Solicitation #, Organization Name, Buyer, Description, Bid Opening Date, Status, Alternate Id -- no modification time on either surface. openingDateFrom is a proxy that catches new solicitations and misses every amendment, so it was NOT written into watermark_field (Matt, 2026-09-04). An adapter here must re-read its window every run."
  }'::jsonb,
  source_note = coalesce(source_note, '') || ' PROBED 2026-09-04 (P4): no watermark of any kind. R9 stays unknown by measurement, not by omission -- see migration 027.'
WHERE name = 'Illinois BidBuy';

-- ---------------------------------------------------------------------------
-- 3. THE GUARD -- both rows are SEEDED, so absence is always a bug
-- ---------------------------------------------------------------------------
-- Neither name carries an em dash, but 026 demonstrated what a silent no-op
-- costs: the registry records "never measured" for a source the migration
-- exists to measure, and the only symptom is an `unknown` nobody questions.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(n, ', ') INTO missing
    FROM unnest(ARRAY['USASpending', 'Illinois BidBuy']) AS n
   WHERE NOT EXISTS (
     SELECT 1 FROM source s
      WHERE s.name = n
        AND s.source_note LIKE '%PROBED 2026-09-04%'
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'migration 027 recorded nothing for: %. The name did not match, so the UPDATE was a silent no-op.',
      missing;
  END IF;

  -- The one assertion that would catch a copy-paste between the two blocks.
  IF EXISTS (SELECT 1 FROM source WHERE name = 'Illinois BidBuy'
                                    AND watermark_field IS NOT NULL) THEN
    RAISE EXCEPTION
      'migration 027 wrote a watermark for Illinois BidBuy. There is none -- see the block above.';
  END IF;
END $$;
